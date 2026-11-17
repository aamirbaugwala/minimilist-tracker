"use client";

/**
 * Insights → Details (Direction A): history trend line, 30-day consistency
 * calendar (tap a day to see it below) and today's water. Same props as before.
 */

import { ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { COLORS } from "./ui";

const card = { padding: 20, borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)" };
const title = { margin: 0, fontSize: 16, fontWeight: 600 };
const METRICS = [
  ["calories", "Calories"],
  ["protein", "Protein"],
  ["carbs", "Carbs"],
  ["fats", "Fat"],
  ["fiber", "Fibre"],
  ["weight", "Weight"],
];

function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "flex", padding: 3, borderRadius: 12, background: "var(--bg)", border: "1px solid var(--border)" }}>
      {options.map(([id, l]) => (
        <button
          key={id}
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          style={{ padding: "6px 12px", border: "none", borderRadius: 9, background: value === id ? "var(--surface-highlight)" : "none", color: value === id ? "var(--text)" : "var(--text-muted)", fontFamily: "inherit", fontSize: 13, fontWeight: value === id ? 600 : 400, cursor: "pointer" }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export default function TrendCharts({
  calendarData,
  metrics,
  selectedDate,
  trendMetric,
  setTrendMetric,
  trendRange,
  setTrendRange,
  visibleTrendData,
  getTrendColor,
  getCurrentTarget,
  handleDateSelect,
}) {
  const unit = trendMetric === "calories" ? " kcal" : trendMetric === "weight" ? " kg" : " g";
  const target = getCurrentTarget();
  const color = getTrendColor();
  const waterPct = Math.round((metrics.water.current / (metrics.water.target || 1)) * 100) || 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h3 style={title}>History</h3>
          <Segmented label="Range" options={[[7, "7 days"], [30, "30 days"]]} value={trendRange} onChange={setTrendRange} />
        </div>
        <div className="chip-scroll" role="radiogroup" aria-label="Metric" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "14px -20px 0", padding: "0 20px" }}>
          {METRICS.map(([id, l]) => {
            const on = trendMetric === id;
            return (
              <button key={id} role="radio" aria-checked={on} onClick={() => setTrendMetric(id)} style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 99, border: on ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--text)" : "var(--text-muted)", fontFamily: "inherit", fontSize: 14, fontWeight: on ? 600 : 400, cursor: "pointer" }}>
                {l}
              </button>
            );
          })}
        </div>
        <div style={{ width: "100%", height: 240, marginTop: 16 }}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}>
            <LineChart data={visibleTrendData} margin={{ top: 10, right: 6, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: COLORS.axis, fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={{ fill: COLORS.axis, fontSize: 12 }} axisLine={false} tickLine={false} domain={trendMetric === "weight" ? ["auto", "auto"] : [0, "auto"]} />
              <Tooltip
                contentStyle={{ background: "var(--sheet)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)", fontSize: 13 }}
                labelStyle={{ color: "var(--text-muted)" }}
                itemStyle={{ color: "var(--text)" }}
                formatter={(v) => [`${v}${unit}`, METRICS.find(([id]) => id === trendMetric)?.[1]]}
              />
              {target && <ReferenceLine y={target} stroke={COLORS.axis} strokeDasharray="4 4" label={{ position: "insideTopRight", value: "Goal", fill: COLORS.axis, fontSize: 12 }} />}
              <Line type="monotone" dataKey={trendMetric} stroke={color} strokeWidth={2.5} connectNulls={trendMetric === "weight"} dot={{ r: 3, fill: "var(--surface)", stroke: color, strokeWidth: 2 }} activeDot={{ r: 5, fill: color }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section style={card}>
        <h3 style={title}>Last 30 days</h3>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Tap a day to see what you ate</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, marginTop: 14 }}>
          {calendarData.map((day) => {
            const on = day.date === selectedDate;
            return (
              <button
                key={day.date}
                onClick={() => handleDateSelect(day.date)}
                aria-label={`${day.date}: ${day.cals ? `${day.cals} kcal` : "nothing logged"}`}
                aria-pressed={on}
                style={{ aspectRatio: "1 / 1", borderRadius: 8, background: day.color, border: on ? "2px solid var(--text)" : "none", padding: 0, cursor: "pointer" }}
              />
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
          {[
            ["var(--accent)", "On target (±10%)"],
            ["var(--accent-muted)", "Logged"],
            ["var(--track)", "Nothing logged"],
          ].map(([c, l]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} /> {l}
            </span>
          ))}
        </div>
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={title}>Water</h3>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{waterPct}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10 }}>
          <span style={{ fontSize: 28, fontWeight: 600 }}>{metrics.water.current} L</span>
          <span style={{ fontSize: 15, color: "var(--text-muted)" }}>of {metrics.water.target} L</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "var(--track)", marginTop: 12, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, waterPct)}%`, height: "100%", borderRadius: 99, background: "var(--water)", transition: "width 0.6s ease" }} />
        </div>
      </section>
    </div>
  );
}
