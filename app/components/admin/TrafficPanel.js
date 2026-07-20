"use client";

/**
 * Site-wide traffic panel for /admin.
 *
 * Fills the gap the admin page had: every existing get_admin_* RPC reads
 * authenticated product data, so there was total visibility into what users do
 * AFTER login and none at all before it.
 *
 * Self-fetching, and degrades to an empty state if the SQL in
 * docs/telemetry.sql hasn't been run yet.
 */

import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { Loader2, Globe, TrendingUp, Users, Smartphone } from "lucide-react";

const RANGES = [7, 30, 90];

const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 16,
};

const num = (n) => Number(n || 0).toLocaleString();
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

function Section({ icon: Icon, title, children, right }) {
  return (
    <div style={{ ...card, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon size={15} color="#6366f1" />
        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{title}</span>
        {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
      </div>
      {children}
    </div>
  );
}

/** Minimal table that scrolls rather than overflowing the panel. */
function Table({ head, rows, empty }) {
  if (!rows.length) {
    return <div style={{ color: "#52525b", fontSize: "0.82rem" }}>{empty}</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", minWidth: 320 }}>
        <thead>
          <tr style={{ color: "#52525b", textAlign: "right" }}>
            {head.map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? "left" : "right", fontWeight: 600, paddingBottom: 7 }}>
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
                    padding: "8px 0",
                    textAlign: j === 0 ? "left" : "right",
                    color: j === 0 ? "#e4e4e7" : "#a1a1aa",
                    fontWeight: j === 0 ? 600 : 400,
                    maxWidth: j === 0 ? 220 : undefined,
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

export default function TrafficPanel() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  // { kind: "missing" | "forbidden" | "error", fn, message } — surfaced verbatim
  // rather than collapsed into one generic message, because "SQL not run",
  // "you're not on the admin allowlist" and "query blew up" need different fixes.
  const [problem, setProblem] = useState(null);
  const [email, setEmail] = useState("");
  const [data, setData] = useState({
    overview: [],
    sources: [],
    pages: [],
    devices: [],
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
          // the real bug and sends you off reloading schema caches for nothing.
          error.code === "PGRST202" ||
          error.code === "42883" ||
          /could not find the function/i.test(message)
            ? "missing"
            : /not authoris|not authoriz|permission denied/i.test(message)
              ? "forbidden"
              : "error";

        // Record EVERY failure, not just the first. These run concurrently, so
        // "the first to fail" is whichever lost the race — reporting one name
        // when several are broken points at the wrong culprit.
        if (!issue) issue = { kind, message, fns: [] };
        issue.fns.push(fn);
        // A hard error outranks a merely-missing function when summarising.
        if (kind === "error" && issue.kind !== "error") {
          issue.kind = kind;
          issue.message = message;
        }
        console.warn(`[traffic] ${fn}:`, message);
        return [];
      };

      const [overview, sources, pages, devices, funnel, cohorts] = await Promise.all([
        rpc("get_traffic_overview", { days }),
        rpc("get_traffic_sources", { days }),
        rpc("get_traffic_pages", { days }),
        rpc("get_traffic_devices", { days }),
        rpc("get_signup_funnel", { days }),
        rpc("get_acquisition_cohorts", { days }),
      ]);

      if (cancelled) return;
      setProblem(issue);
      setData({
        overview,
        sources,
        pages,
        devices,
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
          Edit that function in the SQL editor to include this email.
        </>
      ) : (
        <>
          <code style={{ color: "#818cf8" }}>{problem.fns.join(", ")}</code> failed:{" "}
          <span style={{ color: "#fca5a5" }}>{problem.message}</span>
        </>
      );

    return (
      <div style={{ ...card, textAlign: "center", padding: 26 }}>
        {/* The raw Postgres message is always rendered below, whatever the
            classification. A guessed category must never be the only
            information available while debugging. */}
        <Globe size={28} color="#3f3f46" style={{ marginBottom: 10 }} />
        <div style={{ fontWeight: 700, color: "#a1a1aa" }}>
          {problem.kind === "forbidden" ? "Not authorised" : "Traffic data unavailable"}
        </div>
        <div style={{ fontSize: "0.82rem", color: "#52525b", marginTop: 8, lineHeight: 1.7, maxWidth: 520, margin: "8px auto 0" }}>
          {body}
          {problem.kind !== "error" && problem.message && (
            <div style={{ marginTop: 10, color: "#fca5a5", fontSize: "0.75rem", wordBreak: "break-word" }}>
              Postgres said: {problem.message}
            </div>
          )}
        </div>
      </div>
    );
  }

  const totals = data.overview.reduce(
    (a, d) => ({
      visitors: a.visitors + Number(d.visitors || 0),
      sessions: a.sessions + Number(d.sessions || 0),
      pageviews: a.pageviews + Number(d.pageviews || 0),
    }),
    { visitors: 0, sessions: 0, pageviews: 0 },
  );

  const peak = Math.max(1, ...data.overview.map((d) => Number(d.visitors || 0)));
  const f = data.funnel || {};

  return (
    <div>
      {/* Range picker */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setDays(r)}
            style={{
              padding: "6px 14px",
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
      </div>

      {/* Headline numbers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Visitors", value: totals.visitors, color: "#6366f1" },
          { label: "Sessions", value: totals.sessions, color: "#8b5cf6" },
          { label: "Pageviews", value: totals.pageviews, color: "#3b82f6" },
          { label: "Signups", value: Number(f.signups || 0), color: "#22c55e" },
        ].map((s) => (
          <div key={s.label} style={card}>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: s.color, lineHeight: 1.1 }}>
              {num(s.value)}
            </div>
            <div style={{ fontSize: "0.68rem", color: "#52525b", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.6 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Daily visitors */}
      <Section icon={TrendingUp} title="Daily visitors">
        {data.overview.length === 0 ? (
          <div style={{ color: "#52525b", fontSize: "0.82rem" }}>
            No traffic recorded yet — data appears as soon as someone visits.
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90, overflowX: "auto" }}>
            {data.overview.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.visitors} visitors`}
                style={{
                  flex: "1 0 6px",
                  minWidth: 6,
                  height: `${Math.max(3, (Number(d.visitors) / peak) * 100)}%`,
                  background: "linear-gradient(180deg,#6366f1,#4338ca)",
                  borderRadius: "3px 3px 0 0",
                }}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Funnel */}
      <Section icon={Users} title="Visitor → signup → activated">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Visitors", value: Number(f.visitors || 0), of: null },
            { label: "Signed up", value: Number(f.signups || 0), of: Number(f.visitors || 0) },
            { label: "Logged a meal", value: Number(f.activated || 0), of: Number(f.signups || 0) },
          ].map((step) => (
            <div key={step.label} style={{ flex: "1 1 110px", background: "#111116", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#e4e4e7" }}>{num(step.value)}</div>
              <div style={{ fontSize: "0.66rem", color: "#52525b", marginTop: 2 }}>{step.label}</div>
              {step.of !== null && (
                <div style={{ fontSize: "0.68rem", color: "#22c55e", fontWeight: 700, marginTop: 3 }}>
                  {pct(step.value, step.of)}% conversion
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Acquisition quality — the reason this is first-party */}
      <Section icon={TrendingUp} title="Which sources produce users who stay">
        <Table
          head={["Source", "Signups", "Activated", "Active last 7d"]}
          rows={data.cohorts.map((c) => [c.source, num(c.signups), num(c.activated), num(c.retained)])}
          empty="No signups attributed yet — needs visitors who sign up after this is live."
        />
      </Section>

      <Section icon={Globe} title="Traffic sources">
        <Table
          head={["Source", "Visitors", "Signups"]}
          rows={data.sources.map((s) => [s.source, num(s.visitors), num(s.signups)])}
          empty="No sources recorded yet."
        />
      </Section>

      <Section icon={Globe} title="Top pages">
        <Table
          head={["Path", "Views", "Visitors"]}
          rows={data.pages.map((p) => [p.path, num(p.views), num(p.visitors)])}
          empty="No pageviews recorded yet."
        />
      </Section>

      <Section icon={Smartphone} title="Devices & installed PWA">
        <Table
          head={["Device", "Mode", "Visitors"]}
          rows={data.devices.map((d) => [d.device, d.display_mode, num(d.visitors)])}
          empty="No device data yet."
        />
      </Section>
    </div>
  );
}
