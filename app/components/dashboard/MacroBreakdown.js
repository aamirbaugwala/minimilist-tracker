"use client";

/**
 * Insights → Details (Direction A): the selected day — calories and macros
 * against targets, then everything eaten that day. Tap a calendar day above
 * to change it. Same props as before.
 */

import { FLATTENED_DB } from "@/app/food-data";

const card = { padding: 20, borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)" };
const fmtDay = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "");

function Bar({ label, eaten, target, unit, color }) {
  const over = target > 0 && eaten > target * 1.1;
  const pct = target > 0 ? Math.min(100, (eaten / target) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {color && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />}
          {label}
        </span>
        <span>
          <span style={{ fontWeight: 600, color: over ? "var(--warn)" : "var(--text)" }}>{Math.round(eaten)}</span>
          <span style={{ color: "var(--text-faint)" }}> / {Math.round(target)}{unit}</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: "var(--track)", marginTop: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: over ? "var(--warn)" : color || "var(--accent)", transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

const fibreOf = (log) => log.fiber || (FLATTENED_DB[log.name.toLowerCase()]?.fiber ? Math.round(FLATTENED_DB[log.name.toLowerCase()].fiber * log.qty) : 0);

export default function MacroBreakdown({ metrics, selectedDate, selectedLogs }) {
  const foods = (selectedLogs || []).filter((l) => l.name !== "Water");
  const glasses = (selectedLogs || []).filter((l) => l.name === "Water").reduce((n, l) => n + (Number(l.qty) || 0), 0);
  const total = Math.round(foods.reduce((n, l) => n + (l.calories || 0), 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{fmtDay(selectedDate) || "Today"}</h3>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>vs your targets</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
          <Bar label="Calories" eaten={metrics.eaten} target={metrics.target} unit=" kcal" />
          <Bar label="Protein" eaten={metrics.macros.p || 0} target={metrics.targets.p} unit=" g" color="var(--protein)" />
          <Bar label="Carbs" eaten={metrics.macros.c || 0} target={metrics.targets.c} unit=" g" color="var(--carbs)" />
          <Bar label="Fat" eaten={metrics.macros.f || 0} target={metrics.targets.f} unit=" g" color="var(--fats)" />
          <Bar label="Fibre" eaten={metrics.macros.fib || 0} target={metrics.targets.fib} unit=" g" color="var(--fiber)" />
        </div>
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>What you ate</h3>
          {total > 0 && <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{total} kcal</span>}
        </div>
        {foods.length === 0 && !glasses ? (
          <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--text-faint)" }}>Nothing logged on this day.</p>
        ) : (
          <div style={{ marginTop: 8 }}>
            {foods.map((l, i) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.name}{l.qty !== 1 ? ` × ${l.qty}` : ""}
                  </span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                    P {Math.round(l.protein || 0)} · C {Math.round(l.carbs || 0)} · F {Math.round(l.fats || 0)} · Fibre {fibreOf(l)}
                  </span>
                </span>
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{Math.round(l.calories || 0)}</span>
              </div>
            ))}
            {glasses > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderTop: foods.length ? "1px solid var(--border)" : "none", fontSize: 15 }}>
                <span>Water</span>
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{(glasses * 0.25).toFixed(2)} L</span>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
