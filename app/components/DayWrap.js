"use client";

/**
 * Evening day wrap (Direction A) — from 7 pm (until the 4 am day rollover),
 * once something is logged. No grades: a neutral one-line verdict, what went
 * well, and ONE tip for tomorrow (the weakest of protein / fibre / water).
 * "Close the day" folds it into a single line for the rest of the night.
 */

import { Check } from "lucide-react";
import { calculateTargets } from "../lib/nutrition";
import { useLocalStorageValue } from "../hooks/useLocalStorageValue";

const fmt = (n) => Math.round(n).toLocaleString("en-IN");

export default function DayWrap({ totals, userProfile, conditions, logs, todayKey, onAddLateSnack }) {
  const [closed, setClosed] = useLocalStorageValue(`nt_day_closed_${todayKey}`);
  const hour = new Date().getHours();
  const evening = hour >= 19 || hour < 4;
  const foods = (logs || []).filter((l) => l.name !== "Water");
  if (!evening || !foods.length || !userProfile?.weight || closed === undefined) return null;

  const t = calculateTargets(userProfile, conditions);
  const cals = totals.calories || 0;

  if (closed === "1") {
    return (
      <div style={{ margin: "0 20px", fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
        <Check size={15} color="var(--accent-text)" strokeWidth={2.4} /> Day closed · {fmt(cals)} kcal · see you tomorrow
      </div>
    );
  }

  const diff = cals - t.cals;
  const verdict =
    Math.abs(diff) <= t.cals * 0.1 ? "Right on plan" : diff < 0 ? "A lighter day" : "A bit over today";

  const meals = new Set(foods.map((l) => l.meal).filter(Boolean)).size;
  const waterL = (totals.water || 0) * 0.25; // totals.water counts glasses
  const ratios = {
    protein: (totals.protein || 0) / (t.p || 1),
    fiber: (totals.fiber || 0) / (t.fib || 1),
    water: waterL / (t.water || 1),
  };
  const highlights = [
    { ok: ratios.protein >= 0.9, text: ratios.protein >= 0.9 ? `Protein ${Math.round(totals.protein)} g — goal reached` : `Protein ${Math.round(totals.protein)} of ${Math.round(t.p)} g` },
    { ok: meals >= 3, text: `${meals} of 4 meals logged` },
    { ok: ratios.water >= 1, text: ratios.water >= 1 ? "Water goal reached" : `Water ${waterL.toFixed(1)} of ${t.water} L` },
  ];
  const weakest = Object.entries(ratios).sort((a, b) => a[1] - b[1])[0];
  const tip =
    weakest[1] >= 0.9
      ? "Same again tomorrow — today worked."
      : weakest[0] === "protein"
        ? `Protein was ${Math.round(totals.protein)} of ${Math.round(t.p)} g. Eggs, paneer or dal at breakfast would close most of it.`
        : weakest[0] === "fiber"
          ? `Fibre was low (${Math.round(totals.fiber)} of ${Math.round(t.fib)} g). A fruit with your afternoon chai would help.`
          : `Water was ${waterL.toFixed(1)} of ${t.water} L. Keep a bottle within reach tomorrow.`;

  return (
    <section aria-label="Your day" style={{ margin: "0 20px", padding: 20, borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Your day</div>
      <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 600, lineHeight: 1.35, letterSpacing: -0.2 }}>
        {verdict} — {fmt(cals)} of {fmt(t.cals)} kcal.
      </p>
      <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {highlights.map((h) => (
          <li key={h.text} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 15, lineHeight: 1.45 }}>
            {h.ok ? (
              <Check size={18} color="var(--accent-text)" strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 2 }} />
            ) : (
              <span aria-hidden="true" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2, display: "grid", placeItems: "center" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--text-faint)" }} />
              </span>
            )}
            {h.text}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "var(--bg)", border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-text)", textTransform: "uppercase", letterSpacing: 0.8 }}>For tomorrow</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 6 }}>{tip}</div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          onClick={() => setClosed("1")}
          style={{ flex: 1, height: 46, border: "none", borderRadius: 14, background: "var(--accent)", color: "var(--on-accent)", fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
        >
          Close the day
        </button>
        <button
          onClick={onAddLateSnack}
          style={{ height: 46, padding: "0 16px", borderRadius: 14, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}
        >
          Add a late snack
        </button>
      </div>
    </section>
  );
}
