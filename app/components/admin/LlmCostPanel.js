"use client";

/**
 * Gemini spend, per feature and per user.
 *
 * The agent route was already computing cost per request and discarding it into
 * a log line; every other AI route ignored usage entirely. This surfaces what
 * the app actually costs to run and which users drive it.
 *
 * Schema + RPCs: docs/llm-usage.sql
 */

import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { Loader2, DollarSign, Cpu, Users, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

const RANGES = [7, 30, 90];

const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 14,
};

const usd = (n, dp = 2) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
const num = (n) => Number(n || 0).toLocaleString();

function Section({ icon: Icon, title, hint, children }) {
  return (
    <div style={{ ...card, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: hint ? 3 : 11 }}>
        <Icon size={15} color="#22c55e" />
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
                <td key={j} style={{
                  padding: "7px 0", paddingLeft: j === 0 ? 0 : 10,
                  textAlign: j === 0 ? "left" : "right",
                  color: j === 0 ? "#e4e4e7" : "#a1a1aa",
                  fontWeight: j === 0 ? 600 : 400,
                  maxWidth: j === 0 ? 190 : undefined,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
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

export default function LlmCostPanel() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [data, setData] = useState({ summary: null, byRoute: [], byUser: [], daily: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let notInstalled = false;

      const rpc = async (fn, args) => {
        const { data: d, error } = await supabase.rpc(fn, args);
        if (!error) return d || [];
        if (
          error.code === "PGRST202" ||
          error.code === "42883" ||
          /could not find the function/i.test(error.message || "")
        ) {
          notInstalled = true;
        } else {
          console.warn(`[llmCost] ${fn}:`, error.message);
        }
        return [];
      };

      const [summary, byRoute, byUser, daily] = await Promise.all([
        rpc("get_llm_cost_summary", { days }),
        rpc("get_llm_cost_by_route", { days }),
        rpc("get_llm_cost_by_user", { days, limit_n: 25 }),
        rpc("get_llm_cost_daily", { days }),
      ]);

      if (cancelled) return;
      setMissing(notInstalled);
      setData({
        summary: Array.isArray(summary) ? summary[0] : summary,
        byRoute,
        byUser,
        daily,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [days]);

  if (loading) {
    return (
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 10 }}>
        <Loader2 size={16} className="animate-spin" color="#22c55e" />
        <span style={{ color: "#71717a", fontSize: "0.85rem" }}>Loading spend…</span>
      </div>
    );
  }

  if (missing) {
    return (
      <div style={{ ...card, textAlign: "center", padding: 24 }}>
        <DollarSign size={26} color="#3f3f46" style={{ marginBottom: 10 }} />
        <div style={{ fontWeight: 700, color: "#a1a1aa" }}>Cost tracking not set up</div>
        <div style={{ fontSize: "0.8rem", color: "#52525b", marginTop: 6, lineHeight: 1.6 }}>
          Run <code style={{ color: "#818cf8" }}>docs/llm-usage.sql</code> in the Supabase
          SQL editor. Recording starts on the next AI call.
        </div>
      </div>
    );
  }

  const s = data.summary || {};
  const cost = Number(s.total_cost || 0);
  const prev = Number(s.prev_total_cost || 0);
  const change = prev > 0 ? Math.round(((cost - prev) / prev) * 100) : null;
  const up = change !== null && change > 0;
  // Rising spend is bad news, so the arrow colours invert versus traffic.
  const changeColor = change === null ? "#71717a" : up ? "#ef4444" : "#22c55e";
  const Arrow = up ? TrendingUp : TrendingDown;

  const peak = Math.max(0.000001, ...data.daily.map((d) => Number(d.cost || 0)));
  const cachedShare =
    Number(s.total_tokens || 0) > 0
      ? Math.round((Number(s.cached_tokens || 0) / Number(s.total_tokens || 0)) * 100)
      : 0;

  // Rough monthly run-rate from the selected window.
  const perDay = days > 0 ? cost / days : 0;
  const monthly = perDay * 30;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setDays(r)}
            style={{
              padding: "8px 15px", minHeight: 38, borderRadius: 20, cursor: "pointer",
              fontSize: "0.78rem", fontWeight: 700,
              border: `1px solid ${days === r ? "#22c55e" : "var(--border)"}`,
              background: days === r ? "#22c55e20" : "transparent",
              color: days === r ? "#4ade80" : "#71717a",
            }}
          >
            {r}d
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
        <div style={card}>
          <div style={{ fontSize: "0.64rem", color: "#52525b", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Spend ({days}d)
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: "1.45rem", fontWeight: 800, color: "#e4e4e7", lineHeight: 1.1 }}>
              {usd(cost, 2)}
            </span>
            {change !== null && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: changeColor, fontSize: "0.72rem", fontWeight: 700 }}>
                <Arrow size={11} />
                {up ? "+" : ""}{change}%
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.66rem", color: "#3f3f46", marginTop: 3 }}>
            ≈ {usd(monthly, 2)}/month at this rate
          </div>
        </div>

        {[
          { label: "Calls", value: num(s.calls), sub: `${num(s.failed_calls)} failed` },
          {
            label: "Cost / user",
            value: usd(s.cost_per_user, 4),
            sub: `${num(s.users_served)} users served`,
          },
          {
            label: "Cost / call",
            value: usd(s.avg_cost_per_call, 4),
            sub: `${num(s.total_tokens)} tokens`,
          },
        ].map((m) => (
          <div key={m.label} style={card}>
            <div style={{ fontSize: "0.64rem", color: "#52525b", textTransform: "uppercase", letterSpacing: 0.6 }}>
              {m.label}
            </div>
            <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#e4e4e7", marginTop: 4, lineHeight: 1.1 }}>
              {m.value}
            </div>
            <div style={{ fontSize: "0.66rem", color: "#3f3f46", marginTop: 3 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {cachedShare > 0 && (
        <div style={{
          ...card, marginBottom: 12, display: "flex", gap: 9, alignItems: "flex-start",
          background: "#22c55e0d", border: "1px solid #22c55e30",
        }}>
          <Cpu size={14} color="#22c55e" style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: "0.79rem", color: "#d4d4d8", lineHeight: 1.6 }}>
            <strong style={{ color: "#4ade80" }}>{cachedShare}%</strong> of tokens were served
            from the agent&apos;s context cache, billed at roughly a quarter of the normal
            input rate. Without it this bill would be materially higher.
          </span>
        </div>
      )}

      <Section icon={TrendingUp} title="Daily spend" hint="Spot a runaway before the invoice does.">
        {data.daily.length === 0 ? (
          <div style={{ color: "#52525b", fontSize: "0.8rem" }}>No AI calls recorded yet.</div>
        ) : (
          <>
            <div style={{ fontSize: "0.66rem", color: "#3f3f46", marginBottom: 8, textAlign: "right" }}>
              peak {usd(peak, 4)}/day
            </div>
            <div
              style={{
                display: "flex", alignItems: "flex-end", justifyContent: "flex-start",
                gap: 3, height: 80, overflowX: "auto",
                borderBottom: "1px solid #27272a", paddingBottom: 2,
              }}
            >
              {data.daily.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day} · ${usd(d.cost, 4)} · ${d.calls} calls`}
                  style={{
                    // Capped, like the traffic chart: an unbounded flex bar
                    // stretches to fill the panel when there's only a day or two
                    // of data and stops reading as a chart.
                    flex: "0 1 26px", maxWidth: 26, minWidth: 6,
                    height: `${Math.max(4, (Number(d.cost) / peak) * 100)}%`,
                    background: "linear-gradient(180deg,#4ade80,#15803d)",
                    borderRadius: "3px 3px 0 0",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "#3f3f46", marginTop: 5 }}>
              <span>{data.daily[0]?.day}</span>
              <span>{data.daily[data.daily.length - 1]?.day}</span>
            </div>
          </>
        )}
      </Section>

      <Section icon={Cpu} title="Cost by feature" hint="Which part of the product is spending the budget.">
        <Table
          head={["Feature", "Calls", "Cost", "Share", "Avg ms"]}
          rows={data.byRoute.map((r) => [r.route, num(r.calls), usd(r.cost, 4), `${r.share_pct}%`, num(r.avg_latency_ms)])}
          empty="No calls recorded yet."
        />
      </Section>

      <Section icon={Users} title="Cost by user" hint="A handful of heavy users usually drive most of the bill.">
        <Table
          head={["User", "Calls", "Tokens", "Cost"]}
          rows={data.byUser.map((u) => [u.email, num(u.calls), num(u.tokens), usd(u.cost, 4)])}
          empty="No per-user spend yet."
        />
      </Section>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "0.68rem", color: "#3f3f46", lineHeight: 1.6, padding: "0 2px" }}>
        <AlertCircle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
        <span>
          Cost is computed at write time from Gemini&apos;s reported token counts using the
          rates in <code style={{ color: "#52525b" }}>app/lib/llmCost.js</code>, so historical
          rows keep the price that applied when the call happened. Re-check those rates
          against Google&apos;s current pricing when you change models.
        </span>
      </div>
    </div>
  );
}
