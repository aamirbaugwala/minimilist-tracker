"use client";

/**
 * Insights cards (Direction A): the week, the Monday review, weight/protein
 * tiles and blood markers. Pure presentation — numbers come from lib/insights.
 */

import Link from "next/link";
import { Check, X, ChevronRight, Sparkles } from "lucide-react";
import { isOnTarget } from "../../lib/insights";

const card = { padding: 18, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)" };
const fmt = (n) => Math.round(n).toLocaleString("en-IN");
const dayName = (date, today) =>
  date === today ? "Today" : new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });

export function WeekCard({ summary, today, selectedDate, onSelect }) {
  const { week, loggedDays, onTargetDays, avgCals, targetCals } = summary;
  const max = Math.max(targetCals * 1.25, ...week.map((d) => d.cals), 1);
  const H = 120;
  const sel = week.find((d) => d.date === selectedDate);

  return (
    <section aria-label="This week" style={{ ...card, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Average, last 7 days</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: -1, fontVariantNumeric: "tabular-nums" }}>
            {loggedDays ? fmt(avgCals) : "—"}
          </span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>kcal / day · goal {fmt(targetCals)}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--accent-text)", marginTop: 4, fontWeight: 500 }}>
          {loggedDays ? `Within 10% of your goal on ${onTargetDays} of ${loggedDays} logged days` : "Log a few days to see your week"}
        </div>
      </div>

      <div
        role="group"
        aria-label="Calories per day. Tap a day for details."
        style={{ position: "relative", height: H, display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 10, alignItems: "end", borderBottom: "1px solid var(--border)" }}
      >
        <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: (targetCals / max) * H, borderTop: "1px dashed var(--text-faint)" }} />
        {week.map((d) => {
          const isToday = d.date === today;
          const h = Math.max(d.cals ? 4 : 0, (d.cals / max) * H);
          const active = d.date === selectedDate;
          return (
            <button
              key={d.date}
              onClick={() => onSelect(d.date)}
              aria-label={`${dayName(d.date, today)}: ${fmt(d.cals)} kcal${isToday ? ", in progress" : ""}`}
              aria-pressed={active}
              style={{ height: "100%", padding: 0, border: "none", background: "none", display: "flex", alignItems: "flex-end", cursor: "pointer" }}
            >
              <span
                style={{
                  width: "100%",
                  height: h,
                  boxSizing: "border-box",
                  borderRadius: "6px 6px 0 0",
                  background: isToday ? "transparent" : isOnTarget(d) ? "var(--accent)" : "var(--accent-muted)",
                  border: isToday ? "1.5px dashed var(--accent-text)" : "none",
                  borderBottom: "none",
                  outline: active ? "2px solid var(--text)" : "none",
                  outlineOffset: 2,
                }}
              />
            </button>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 10, fontSize: 11, color: "var(--text-faint)", textAlign: "center", marginTop: -6 }}>
        {week.map((d) => (
          <span key={d.date} style={d.date === today ? { color: "var(--text)", fontWeight: 600 } : undefined}>
            {dayName(d.date, today)}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
        {sel && sel.date !== today
          ? `${new Date(`${sel.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })} · ${fmt(sel.cals)} kcal · protein ${Math.round(sel.protein)} g`
          : `Today is in progress · ${fmt(week[week.length - 1]?.cals || 0)} so far, no score until the day ends.`}
      </div>
    </section>
  );
}

export function WeeklyReview({ review, onDismiss }) {
  if (!review) return null;
  const range = `${new Date(`${review.start}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(`${review.end}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
  return (
    <section aria-label="Your week in review" style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Last week · {range}</span>
        <button onClick={onDismiss} aria-label="Hide weekly review" style={{ width: 32, height: 32, margin: "-6px -8px -6px 0", border: "none", background: "none", color: "var(--text-faint)", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <X size={16} />
        </button>
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>{review.headline}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 16 }}>
        <div><div style={{ fontSize: 22, fontWeight: 600 }}>{review.loggedDays}<span style={{ fontSize: 14, color: "var(--text-muted)" }}>/7</span></div><div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>days logged</div></div>
        <div><div style={{ fontSize: 22, fontWeight: 600 }}>{review.onTarget}</div><div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>days on target</div></div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, color: review.weightChange != null && review.weightChange <= 0 ? "var(--accent-text)" : "var(--text)" }}>
            {review.weightChange == null ? "—" : `${review.weightChange > 0 ? "+" : ""}${review.weightChange}`}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>kg this week</div>
        </div>
      </div>

      {review.worked.length > 0 && (
        <>
          <div style={{ marginTop: 18, fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>What worked</div>
          <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 15, lineHeight: 1.45 }}>
            {review.worked.map((w) => (
              <li key={w} style={{ display: "flex", gap: 10 }}>
                <Check size={16} color="var(--accent-text)" strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 3 }} />
                {w}
              </li>
            ))}
          </ul>
        </>
      )}

      <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "var(--bg)", border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-text)", textTransform: "uppercase", letterSpacing: 0.8 }}>One thing to try</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 6 }}>{review.tryNext}</div>
      </div>
      <Link href="/agent" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 46, marginTop: 14, borderRadius: 14, border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
        <Sparkles size={16} color="var(--accent-text)" /> Plan this week with Coach
      </Link>
    </section>
  );
}

export function InsightTiles({ weight, profileWeight, avgProtein, targetP, hasLoggedDays }) {
  const pts = weight?.points || [];
  const ws = pts.map((p) => p.w);
  const lo = Math.min(...ws);
  const hi = Math.max(...ws);
  const poly = pts
    .map((p, i) => `${pts.length > 1 ? (i / (pts.length - 1)) * 140 : 70},${hi === lo ? 18 : 4 + ((hi - p.w) / (hi - lo)) * 28}`)
    .join(" ");
  const proteinPct = targetP ? Math.min(100, Math.round((avgProtein / targetP) * 100)) : 0;

  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Weight</div>
        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
          {weight ? `${weight.latest} kg` : profileWeight ? `${profileWeight} kg` : "—"}
        </div>
        {pts.length > 1 ? (
          <svg role="img" aria-label={`Weight over the last ${pts.length} weigh-ins, from ${ws[0]} to ${ws[ws.length - 1]} kg`} width="100%" height="36" viewBox="0 0 140 36" preserveAspectRatio="none" style={{ marginTop: 8, display: "block" }}>
            <polyline points={poly} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : (
          <div style={{ height: 36, marginTop: 8 }} />
        )}
        <div style={{ fontSize: 12, color: weight && weight.change <= 0 ? "var(--accent-text)" : "var(--text-muted)", marginTop: 4 }}>
          {weight
            ? weight.change === 0
              ? "Steady over 2 weeks"
              : `${weight.change > 0 ? "+" : "−"}${Math.abs(weight.change)} kg in 2 weeks`
            : "No weigh-ins in 30 days — log one on Today"}
        </div>
      </div>
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Protein, avg</div>
        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{hasLoggedDays ? `${avgProtein} g` : "—"}</div>
        <div style={{ height: 6, borderRadius: 99, background: "var(--track)", marginTop: 20 }}>
          <div style={{ width: `${hasLoggedDays ? proteinPct : 0}%`, height: "100%", borderRadius: 99, background: "var(--protein)" }} />
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
          {hasLoggedDays ? `${proteinPct}% of ${Math.round(targetP)} g goal` : `Goal ${Math.round(targetP)} g · no logged days this week`}
        </div>
      </div>
    </section>
  );
}

export function MarkersCard({ report }) {
  const flags = (report?.flags || []).filter((f) => f.status && f.status !== "normal").slice(0, 3);
  const date = report
    ? new Date(report.report_date || report.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : null;
  return (
    <section style={{ borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 6px", fontSize: 13, color: "var(--text-muted)" }}>
        {report ? `Blood markers · report from ${date}` : "Blood markers"}
      </div>
      {!report && (
        <div style={{ padding: "4px 16px 12px", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Upload a blood report and your food advice and targets will adapt to it.
        </div>
      )}
      {report && flags.length === 0 && (
        <div style={{ padding: "4px 16px 12px", fontSize: 14, color: "var(--text)" }}>All markers in range on your latest report.</div>
      )}
      {flags.map((f) => (
        <div key={f.marker} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 16px" }}>
          <span style={{ fontSize: 15, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.marker}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--warn)", flexShrink: 0 }}>
            {/* capitalise the status word only — units like "ng/mL" must keep their case */}
            {String(f.status).charAt(0).toUpperCase() + String(f.status).slice(1)} · {f.value}
          </span>
        </div>
      ))}
      <Link
        href={report ? "/medical/trends" : "/medical"}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderTop: "1px solid var(--border)", color: "var(--text)", textDecoration: "none", fontSize: 14, fontWeight: 500 }}
      >
        {report ? "All marker trends" : "Upload a report"} <ChevronRight size={16} color="var(--text-faint)" />
      </Link>
    </section>
  );
}
