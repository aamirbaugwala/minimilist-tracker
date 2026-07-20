"use client";

/**
 * Site-wide traffic panel for /admin.
 *
 * Built around decisions rather than counts. A bare "142 visitors" is inert —
 * every headline metric carries the previous equal-length period beside it, and
 * the Insights block turns the numbers into statements you can act on.
 *
 * Self-fetching, mobile-first, and degrades with a real error message if the
 * SQL in docs/telemetry.sql hasn't been run.
 */

import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import {
  Loader2,
  Globe,
  TrendingUp,
  TrendingDown,
  Users,
  Smartphone,
  Lightbulb,
  MapPin,
  LogIn,
  LogOut,
  Monitor,
  Clock,
} from "lucide-react";

const RANGES = [7, 30, 90];

const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 14,
};

const num = (n) => Number(n || 0).toLocaleString();
const pctOf = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

/**
 * Change vs the previous period. `higherIsBetter` flips the colour for metrics
 * like bounce rate where a fall is the good outcome.
 */
function delta(cur, prev, higherIsBetter = true) {
  const c = Number(cur || 0);
  const p = Number(prev || 0);
  if (p === 0) return c > 0 ? { label: "new", good: true, dir: "up" } : null;
  const change = Math.round(((c - p) / p) * 100);
  if (change === 0) return { label: "0%", good: null, dir: "flat" };
  const up = change > 0;
  return {
    label: `${up ? "+" : ""}${change}%`,
    good: higherIsBetter ? up : !up,
    dir: up ? "up" : "down",
  };
}

function Kpi({ label, value, sub, d }) {
  const color = d?.good === true ? "#22c55e" : d?.good === false ? "#ef4444" : "#71717a";
  const Arrow = d?.dir === "down" ? TrendingDown : TrendingUp;
  return (
    <div style={card}>
      <div style={{ fontSize: "0.64rem", color: "#52525b", textTransform: "uppercase", letterSpacing: 0.6 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: "1.45rem", fontWeight: 800, color: "#e4e4e7", lineHeight: 1.1 }}>
          {value}
        </span>
        {d && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color, fontSize: "0.72rem", fontWeight: 700 }}>
            {d.dir !== "flat" && <Arrow size={11} />}
            {d.label}
          </span>
        )}
      </div>
      {sub && <div style={{ fontSize: "0.66rem", color: "#3f3f46", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Section({ icon: Icon, title, hint, children }) {
  return (
    <div style={{ ...card, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: hint ? 3 : 11 }}>
        <Icon size={15} color="#6366f1" />
        <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>{title}</span>
      </div>
      {hint && <div style={{ fontSize: "0.68rem", color: "#3f3f46", marginBottom: 11 }}>{hint}</div>}
      {children}
    </div>
  );
}

function Table({ head, rows, empty }) {
  if (!rows.length) return <div style={{ color: "#52525b", fontSize: "0.8rem" }}>{empty}</div>;
  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: 300 }}>
        <thead>
          <tr style={{ color: "#52525b" }}>
            {head.map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? "left" : "right", fontWeight: 600, paddingBottom: 6, whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid #1f1f23" }}>
              {r.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: "7px 0",
                    paddingLeft: j === 0 ? 0 : 10,
                    textAlign: j === 0 ? "left" : "right",
                    color: j === 0 ? "#e4e4e7" : "#a1a1aa",
                    fontWeight: j === 0 ? 600 : 400,
                    maxWidth: j === 0 ? 180 : undefined,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Turn the raw numbers into statements worth acting on. Only fires a card when
 * there's enough data to mean something — a 2-visitor sample shouldn't produce
 * confident advice.
 */
function buildInsights({ k, sources, cohorts, entries, days }) {
  const out = [];
  if (!k) return out;

  const visitors = Number(k.visitors || 0);
  const signups = Number(k.signups || 0);
  const convRate = pctOf(signups, visitors);

  // Best / worst converting source, only where the sample can support a claim.
  const ranked = (sources || [])
    .filter((s) => Number(s.visitors) >= 5)
    .map((s) => ({ ...s, rate: pctOf(Number(s.signups), Number(s.visitors)) }))
    .sort((a, b) => b.rate - a.rate);

  if (ranked.length >= 2) {
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (best.rate > convRate && best.rate > 0) {
      out.push({
        tone: "good",
        text: `“${best.source}” converts at ${best.rate}% vs ${convRate}% overall — your strongest channel. Worth more investment.`,
      });
    }
    if (worst.rate < convRate && Number(worst.visitors) >= 10) {
      out.push({
        tone: "bad",
        text: `“${worst.source}” sent ${num(worst.visitors)} visitors but converts at just ${worst.rate}% — that traffic isn't matching what the page promises.`,
      });
    }
  }

  // Activation leak: signed up but never logged anything.
  const totalSignups = (cohorts || []).reduce((n, c) => n + Number(c.signups || 0), 0);
  const totalActivated = (cohorts || []).reduce((n, c) => n + Number(c.activated || 0), 0);
  if (totalSignups >= 5) {
    const lost = totalSignups - totalActivated;
    const lostPct = pctOf(lost, totalSignups);
    if (lostPct >= 30) {
      out.push({
        tone: "bad",
        text: `${lostPct}% of signups (${num(lost)}) never logged a single meal. The leak is onboarding, not acquisition.`,
      });
    } else if (totalActivated > 0) {
      out.push({
        tone: "good",
        text: `${pctOf(totalActivated, totalSignups)}% of signups logged at least one meal — onboarding is holding up.`,
      });
    }
  }

  // Retention among activated users.
  const totalRetained = (cohorts || []).reduce((n, c) => n + Number(c.retained || 0), 0);
  if (totalActivated >= 5) {
    const r = pctOf(totalRetained, totalActivated);
    out.push({
      tone: r >= 40 ? "good" : "bad",
      text: `${r}% of activated users logged food in the last 7 days${r < 40 ? " — most people try it once and drift away." : " — the habit is sticking."}`,
    });
  }

  // Engagement quality.
  const bounce = Number(k.bounce_pct || 0);
  if (Number(k.sessions || 0) >= 10 && bounce >= 60) {
    out.push({
      tone: "bad",
      text: `${bounce}% of sessions are single-page. Check whether the landing page answers what people arrived looking for.`,
    });
  }

  // Worst entry point.
  const badEntry = (entries || [])
    .filter((e) => Number(e.entries) >= 10)
    .sort((a, b) => Number(b.bounce_pct) - Number(a.bounce_pct))[0];
  if (badEntry && Number(badEntry.bounce_pct) >= 70) {
    out.push({
      tone: "bad",
      text: `${badEntry.bounce_pct}% of people landing on ${badEntry.path} leave without a second page.`,
    });
  }

  // How long people deliberate before signing up.
  const lag = Number(k.median_days_to_signup || 0);
  if (signups >= 3) {
    out.push({
      tone: "neutral",
      text:
        lag < 1
          ? "Most people sign up on their first visit — the pitch is landing immediately."
          : `Median ${lag} days from first visit to signup — people are returning to think about it, so follow-up could help.`,
    });
  }

  // Are you reaching new people, or the same ones?
  const nw = Number(k.new_visitors || 0);
  const rt = Number(k.returning_visitors || 0);
  if (nw + rt >= 10) {
    out.push({
      tone: "neutral",
      text: `${pctOf(nw, nw + rt)}% of visitors in the last ${days}d were new — the rest came back.`,
    });
  }

  return out;
}

export default function TrafficPanel() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState(null);
  const [email, setEmail] = useState("");
  const [data, setData] = useState({
    kpis: null,
    overview: [],
    sources: [],
    pages: [],
    entries: [],
    exits: [],
    countries: [],
    cities: [],
    devices: [],
    browsers: [],
    engagement: null,
    retention: [],
    funnel: null,
    cohorts: [],
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      let issue = null;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) setEmail(session?.user?.email || "");

      const rpc = async (fn, args) => {
        const { data: d, error } = await supabase.rpc(fn, args);
        if (!error) return d || [];

        const message = error.message || "";
        const kind =
          // PGRST202 = PostgREST can't see the function. 42883 = Postgres
          // "no such function". Deliberately NOT matching a bare /does not
          // exist/: that also matches `column "x" does not exist`, which is an
          // ordinary runtime error — treating it as "function missing" hides
          // the real bug.
          error.code === "PGRST202" ||
          error.code === "42883" ||
          /could not find the function/i.test(message)
            ? "missing"
            : /not authoris|not authoriz|permission denied/i.test(message)
              ? "forbidden"
              : "error";

        if (!issue) issue = { kind, message, fns: [] };
        issue.fns.push(fn);
        if (kind === "error" && issue.kind !== "error") {
          issue.kind = kind;
          issue.message = message;
        }
        console.warn(`[traffic] ${fn}:`, message);
        return [];
      };

      const [
        kpis, overview, sources, pages, entries, exits,
        countries, cities, devices, browsers, engagement, retention, funnel, cohorts,
      ] = await Promise.all([
        rpc("get_traffic_kpis", { days }),
        rpc("get_traffic_overview", { days }),
        rpc("get_traffic_sources", { days }),
        rpc("get_traffic_pages", { days }),
        rpc("get_entry_pages", { days }),
        rpc("get_exit_pages", { days }),
        rpc("get_traffic_countries", { days }),
        rpc("get_traffic_cities", { days }),
        rpc("get_traffic_devices", { days }),
        rpc("get_traffic_browsers", { days }),
        rpc("get_engagement_stats", { days }),
        rpc("get_retention_cohorts", { weeks: 8 }),
        rpc("get_signup_funnel", { days }),
        rpc("get_acquisition_cohorts", { days }),
      ]);

      if (cancelled) return;
      setProblem(issue);
      setData({
        kpis: Array.isArray(kpis) ? kpis[0] : kpis,
        overview,
        sources,
        pages,
        entries,
        exits,
        countries,
        cities,
        devices,
        browsers,
        engagement: Array.isArray(engagement) ? engagement[0] : engagement,
        retention,
        funnel: Array.isArray(funnel) ? funnel[0] : funnel,
        cohorts,
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [days]);

  if (loading) {
    return (
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 10 }}>
        <Loader2 size={16} className="animate-spin" color="#6366f1" />
        <span style={{ color: "#71717a", fontSize: "0.85rem" }}>Loading traffic…</span>
      </div>
    );
  }

  if (problem) {
    const body =
      problem.kind === "missing" ? (
        <>
          Postgres can&apos;t see{" "}
          <code style={{ color: "#818cf8" }}>{problem.fns.join(", ")}</code>.
          <br />
          If only SOME are missing, the SQL batch aborted partway — re-run{" "}
          <code style={{ color: "#818cf8" }}>docs/telemetry.sql</code> and read the
          first error. If ALL are missing, reload the schema cache with{" "}
          <code style={{ color: "#818cf8" }}>notify pgrst, &apos;reload schema&apos;;</code>
        </>
      ) : problem.kind === "forbidden" ? (
        <>
          The RPCs exist, but <strong style={{ color: "#e4e4e7" }}>{email || "this account"}</strong>{" "}
          isn&apos;t in the <code style={{ color: "#818cf8" }}>is_admin()</code> allowlist.
        </>
      ) : (
        <>
          <code style={{ color: "#818cf8" }}>{problem.fns.join(", ")}</code> failed:{" "}
          <span style={{ color: "#fca5a5" }}>{problem.message}</span>
        </>
      );

    return (
      <div style={{ ...card, textAlign: "center", padding: 24 }}>
        <Globe size={26} color="#3f3f46" style={{ marginBottom: 10 }} />
        <div style={{ fontWeight: 700, color: "#a1a1aa" }}>
          {problem.kind === "forbidden" ? "Not authorised" : "Traffic data unavailable"}
        </div>
        <div style={{ fontSize: "0.8rem", color: "#52525b", lineHeight: 1.7, maxWidth: 520, margin: "8px auto 0" }}>
          {body}
          {problem.kind !== "error" && problem.message && (
            <div style={{ marginTop: 10, color: "#fca5a5", fontSize: "0.74rem", wordBreak: "break-word" }}>
              Postgres said: {problem.message}
            </div>
          )}
        </div>
      </div>
    );
  }

  const k = data.kpis;
  const f = data.funnel || {};
  const visitors = Number(k?.visitors || 0);
  const signups = Number(k?.signups || 0);
  const convRate = pctOf(signups, visitors);
  const prevConv = pctOf(Number(k?.prev_signups || 0), Number(k?.prev_visitors || 0));
  const peak = Math.max(1, ...data.overview.map((d) => Number(d.visitors || 0)));
  const insights = buildInsights({
    k,
    sources: data.sources,
    cohorts: data.cohorts,
    entries: data.entries,
    days,
  });

  const toneColor = { good: "#22c55e", bad: "#ef4444", neutral: "#6366f1" };

  return (
    <div>
      {/* Range */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setDays(r)}
            style={{
              padding: "8px 15px",
              minHeight: 38,
              borderRadius: 20,
              cursor: "pointer",
              fontSize: "0.78rem",
              fontWeight: 700,
              border: `1px solid ${days === r ? "#6366f1" : "var(--border)"}`,
              background: days === r ? "#6366f120" : "transparent",
              color: days === r ? "#818cf8" : "#71717a",
            }}
          >
            {r}d
          </button>
        ))}
        <span style={{ marginLeft: "auto", alignSelf: "center", fontSize: "0.66rem", color: "#3f3f46" }}>
          vs previous {days}d
        </span>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
        <Kpi label="Visitors" value={num(visitors)} d={delta(visitors, k?.prev_visitors)}
             sub={`${num(k?.new_visitors)} new · ${num(k?.returning_visitors)} returning`} />
        <Kpi label="Signups" value={num(signups)} d={delta(signups, k?.prev_signups)}
             sub={k?.median_days_to_signup > 0 ? `median ${k.median_days_to_signup}d to convert` : "mostly first visit"} />
        <Kpi label="Conversion" value={`${convRate}%`} d={delta(convRate, prevConv)}
             sub="visitor → signup" />
        <Kpi label="Bounce" value={`${Number(k?.bounce_pct || 0)}%`}
             d={delta(k?.bounce_pct, k?.prev_bounce_pct, false)}
             sub={`${Number(k?.pages_per_session || 0)} pages/session`} />
      </div>

      {/* Session depth. Duration is last-view minus first-view, so single-page
          sessions read as 0 — the same limitation Universal Analytics had.
          "over 30s" is the honest engagement proxy without heartbeat tracking. */}
      {data.engagement && Number(data.engagement.total_sessions) > 0 && (
        <Section icon={Clock} title="Session depth"
                 hint="Duration spans first to last pageview, so single-page sessions count as 0s.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            {[
              { label: "Median session", value: `${Number(data.engagement.median_session_seconds)}s` },
              { label: "Average session", value: `${Number(data.engagement.avg_session_seconds)}s` },
              { label: "Pages / session", value: Number(data.engagement.avg_pages_per_session) },
              {
                label: "Engaged (>30s)",
                value: `${pctOf(Number(data.engagement.sessions_over_30s), Number(data.engagement.total_sessions))}%`,
              },
            ].map((s) => (
              <div key={s.label} style={{ background: "#111116", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px" }}>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#e4e4e7" }}>{s.value}</div>
                <div style={{ fontSize: "0.64rem", color: "#52525b", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Insights — the part that turns numbers into decisions */}
      {insights.length > 0 && (
        <Section icon={Lightbulb} title="What the numbers say">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insights.map((ins, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 9,
                  alignItems: "flex-start",
                  background: `${toneColor[ins.tone]}0d`,
                  border: `1px solid ${toneColor[ins.tone]}30`,
                  borderRadius: 10,
                  padding: "9px 11px",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: toneColor[ins.tone], marginTop: 6, flexShrink: 0 }} />
                <span style={{ fontSize: "0.79rem", color: "#d4d4d8", lineHeight: 1.6 }}>{ins.text}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Daily traffic + signups */}
      <Section icon={TrendingUp} title="Daily visitors">
        {data.overview.length === 0 ? (
          <div style={{ color: "#52525b", fontSize: "0.8rem" }}>No traffic recorded yet.</div>
        ) : (
          <>
            {/* Legend and scale. Bars with neither are just coloured blocks —
                there's no way to tell what a tall one means. */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: "0.66rem", color: "#52525b", marginBottom: 9 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: "#6366f1" }} /> Visitors
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} /> Signup that day
              </span>
              <span style={{ marginLeft: "auto", color: "#3f3f46" }}>peak {peak}/day</span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "flex-start",
                gap: 3,
                height: 96,
                overflowX: "auto",
                borderBottom: "1px solid #27272a",
                paddingBottom: 2,
              }}
            >
              {data.overview.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day} · ${d.visitors} visitors · ${d.signups} signups`}
                  style={{
                    // Capped width. With flex:"1 0 7px" a single day stretched
                    // across the whole panel and read as one solid block rather
                    // than a bar on a scale.
                    flex: "0 1 26px",
                    maxWidth: 26,
                    minWidth: 6,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 3,
                  }}
                >
                  {Number(d.signups) > 0 && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                  )}
                  <div
                    style={{
                      width: "100%",
                      height: `${Math.max(4, (Number(d.visitors) / peak) * 100)}%`,
                      background: "linear-gradient(180deg,#818cf8,#4338ca)",
                      borderRadius: "3px 3px 0 0",
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "#3f3f46", marginTop: 5 }}>
              <span>{data.overview[0]?.day}</span>
              {data.overview.length > 1 && <span>{data.overview[data.overview.length - 1]?.day}</span>}
            </div>
          </>
        )}
      </Section>

      {/* Funnel with explicit drop-off */}
      <Section icon={Users} title="Visitor → signup → activated">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { label: "Visited", value: Number(f.visitors || 0), of: null },
            { label: "Signed up", value: Number(f.signups || 0), of: Number(f.visitors || 0) },
            { label: "Logged a meal", value: Number(f.activated || 0), of: Number(f.signups || 0) },
          ].map((step, i, arr) => {
            const prev = i > 0 ? arr[i - 1].value : null;
            const lost = prev !== null ? prev - step.value : 0;
            const width = arr[0].value > 0 ? Math.max(6, (step.value / arr[0].value) * 100) : 6;
            return (
              <div key={step.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: 3 }}>
                  <span style={{ color: "#e4e4e7", fontWeight: 600 }}>{step.label}</span>
                  <span style={{ color: "#a1a1aa" }}>
                    {num(step.value)}
                    {step.of !== null && step.of > 0 && (
                      <span style={{ color: "#22c55e", fontWeight: 700 }}> · {pctOf(step.value, step.of)}%</span>
                    )}
                  </span>
                </div>
                <div style={{ height: 8, background: "#18181b", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${width}%`, height: "100%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 99 }} />
                </div>
                {lost > 0 && (
                  <div style={{ fontSize: "0.66rem", color: "#ef4444", marginTop: 2 }}>
                    −{num(lost)} dropped here
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section icon={TrendingUp} title="Which sources produce users who stay"
               hint="Signed up → ever logged → logged in the last 7 days.">
        <Table
          head={["Source", "Signups", "Activated", "Active 7d"]}
          rows={data.cohorts.map((c) => [c.source, num(c.signups), num(c.activated), num(c.retained)])}
          empty="No attributed signups yet."
        />
      </Section>

      {/* Weekly retention triangle — the clearest read on habit formation */}
      {data.retention.length > 0 && (
        <Section
          icon={Users}
          title="Weekly retention"
          hint="Of the people who signed up that week, how many were still logging N weeks later."
        >
          <Table
            head={["Signup week", "Users", "Wk 0", "Wk 1", "Wk 2", "Wk 3"]}
            rows={data.retention.map((r) => [
              r.cohort_week,
              num(r.users),
              `${pctOf(Number(r.w0), Number(r.users))}%`,
              `${pctOf(Number(r.w1), Number(r.users))}%`,
              `${pctOf(Number(r.w2), Number(r.users))}%`,
              `${pctOf(Number(r.w3), Number(r.users))}%`,
            ])}
            empty="No cohorts yet."
          />
        </Section>
      )}

      <Section icon={LogIn} title="Entry pages" hint="Where sessions start, and how many leave immediately.">
        <Table
          head={["Path", "Entries", "Bounce", "Signups"]}
          rows={data.entries.map((e) => [e.path, num(e.entries), `${e.bounce_pct}%`, num(e.signups)])}
          empty="No entry data yet."
        />
      </Section>

      <Section icon={LogOut} title="Exit pages" hint="The last page of each session — where people leave from.">
        <Table
          head={["Path", "Exits", "Exit rate"]}
          rows={data.exits.map((e) => [e.path, num(e.exits), `${e.exit_pct}%`])}
          empty="No exit data yet."
        />
      </Section>

      <Section icon={Globe} title="Traffic sources">
        <Table
          head={["Source", "Visitors", "Signups", "Conv."]}
          rows={data.sources.map((s) => [
            s.source, num(s.visitors), num(s.signups), `${pctOf(Number(s.signups), Number(s.visitors))}%`,
          ])}
          empty="No sources recorded yet."
        />
      </Section>

      <Section icon={MapPin} title="Countries">
        <Table
          head={["Country", "Visitors", "Signups"]}
          rows={data.countries.map((c) => [c.country, num(c.visitors), num(c.signups)])}
          empty="No geography yet — Vercel only injects this in production."
        />
      </Section>

      <Section icon={MapPin} title="Cities">
        <Table
          head={["City", "Region", "Visitors"]}
          rows={data.cities.map((c) => [c.city, c.region || c.country || "—", num(c.visitors)])}
          empty="No city data yet — production only."
        />
      </Section>

      <Section icon={Smartphone} title="Devices & installed PWA">
        <Table
          head={["Device", "Mode", "Visitors"]}
          rows={data.devices.map((d) => [d.device, d.display_mode, num(d.visitors)])}
          empty="No device data yet."
        />
      </Section>

      <Section icon={Monitor} title="Browser & OS" hint="Brave reports itself as Chrome, so it lands in that bucket.">
        <Table
          head={["Browser", "OS", "Visitors"]}
          rows={data.browsers.map((b) => [b.browser, b.os, num(b.visitors)])}
          empty="Recorded from now on — existing rows predate this."
        />
      </Section>

      <Section icon={Globe} title="Top pages">
        <Table
          head={["Path", "Views", "Visitors"]}
          rows={data.pages.map((p) => [p.path, num(p.views), num(p.visitors)])}
          empty="No pageviews recorded yet."
        />
      </Section>
    </div>
  );
}
