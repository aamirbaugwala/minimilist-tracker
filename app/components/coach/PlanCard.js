"use client";

/**
 * PlanCard — Coach's meal plan as plates you can log (Direction A).
 * Rendered from the structured "plan" event the agent route emits after
 * generate_meal_plan, so the numbers are exact (not re-parsed from text).
 * Each meal: items, kcal/protein, one "why", and "Log to <meal>" with Undo.
 */

import { Check, Loader2, Undo2 } from "lucide-react";

const fmtQty = (q) => (q === 0.5 ? "½" : q === 1.5 ? "1½" : String(q));
const short = (name) => String(name).split(" (")[0];

export default function PlanCard({ plan, logged = {}, busy, onLog, onUndo }) {
  if (!plan?.length) return null;
  const total = plan.reduce((t, m) => ({ kcal: t.kcal + (m.totals?.calories || 0), p: t.p + (parseFloat(m.totals?.protein) || 0) }), { kcal: 0, p: 0 });

  return (
    <div style={{ margin: "4px 0 12px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-faint)" }}>
        <span>Plan for the rest of today</span>
        <span>
          {Math.round(total.kcal)} kcal · {Math.round(total.p)} g protein
        </span>
      </div>
      {plan.map((m) => {
        const state = logged[m.meal];
        const isLogged = state && !state.undone;
        return (
          <div key={m.meal} style={{ padding: "14px 16px", borderRadius: 16, background: "var(--surface)", border: `1px solid ${isLogged ? "var(--accent)" : "var(--border)"}` }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{m.meal}</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {Math.round(m.totals?.calories || 0)} kcal · {Math.round(parseFloat(m.totals?.protein) || 0)} g protein
              </span>
            </div>
            <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {m.items.map((i) => (
                <li key={i.food} style={{ display: "flex", gap: 10, fontSize: 14 }}>
                  <span style={{ minWidth: 26, color: "var(--text-muted)" }}>{fmtQty(i.qty)}×</span>
                  <span style={{ flex: 1, minWidth: 0, textTransform: "capitalize" }}>{short(i.food)}</span>
                  <span style={{ color: "var(--text-faint)" }}>{i.calories}</span>
                </li>
              ))}
            </ul>
            {m.why?.[0] && <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-muted)" }}>{m.why[0]}</div>}
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
              {isLogged ? (
                <>
                  <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "var(--accent-text)" }}>
                    <Check size={16} strokeWidth={2.6} /> Logged to {m.meal}
                  </span>
                  <button onClick={() => onUndo(m.meal)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 4, color: "var(--accent-text)", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    <Undo2 size={15} /> Undo
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onLog(m)}
                  disabled={busy === m.meal}
                  style={{ flex: 1, height: 40, borderRadius: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  {busy === m.meal ? <Loader2 size={16} className="animate-spin" /> : `Log to ${m.meal}`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
