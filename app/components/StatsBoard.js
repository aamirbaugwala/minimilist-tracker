"use client";

/**
 * Today's hero (Direction A): one big "kcal left" number, a thin progress bar,
 * and four quiet macro bars. Water moved to the tiles at the bottom of Today.
 * Targets include enforced medical adjustments, same as Settings and Coach.
 */

import { memo } from "react";
import { calculateTargets, capPct } from "../lib/nutrition";

const fmt = (n) => Math.round(n).toLocaleString("en-IN");

const Macro = ({ label, value, target, color }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
    <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {Math.round(value)}
      <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>/{Math.round(target)}g</span>
    </span>
    <div style={{ height: 3, borderRadius: 99, background: "var(--track)" }}>
      <div style={{ width: `${capPct(value, target)}%`, height: "100%", borderRadius: 99, background: color }} />
    </div>
  </div>
);

const StatsBoard = memo(({ totals, userProfile, conditions, onEditGoal }) => {
  const t = calculateTargets(userProfile, conditions);
  const over = totals.calories > t.cals;
  const left = Math.abs(t.cals - totals.calories);
  const pct = capPct(totals.calories, t.cals);

  return (
    <section aria-label="Calories" style={{ padding: "4px 20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 60,
            fontWeight: 600,
            letterSpacing: -2,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            color: over ? "var(--warn)" : "var(--text)",
          }}
        >
          {fmt(left)}
        </span>
        <span style={{ fontSize: 15, color: "var(--text-muted)" }}>{over ? "kcal over" : "kcal left"}</span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={Math.round(totals.calories)}
        aria-valuemin={0}
        aria-valuemax={Math.round(t.cals)}
        aria-label="Calories eaten"
        style={{ height: 6, borderRadius: 99, background: "var(--track)", overflow: "hidden" }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 99,
            background: over ? "var(--warn)" : "var(--accent)",
            transition: "width .5s cubic-bezier(.2,.8,.2,1)",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, lineHeight: "18px", color: "var(--text-muted)" }}>
        <span>{fmt(totals.calories)} eaten</span>
        <button
          onClick={onEditGoal}
          style={{ background: "none", border: "none", padding: 0, color: "var(--text-muted)", font: "inherit", lineHeight: "inherit", cursor: onEditGoal ? "pointer" : "default" }}
        >
          Goal {fmt(t.cals)}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 4 }}>
        <Macro label="Protein" value={totals.protein} target={t.p} color="var(--protein)" />
        <Macro label="Carbs" value={totals.carbs} target={t.c} color="var(--carbs)" />
        <Macro label="Fat" value={totals.fats} target={t.f} color="var(--fats)" />
        <Macro label="Fibre" value={totals.fiber || 0} target={t.fib} color="var(--fiber)" />
      </div>
    </section>
  );
});

StatsBoard.displayName = "StatsBoard";
export default StatsBoard;
