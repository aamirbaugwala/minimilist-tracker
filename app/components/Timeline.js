"use client";

/**
 * Today's log (Direction A): quiet, scannable rows grouped by meal.
 *
 * - Meals with food: uppercase label · kcal · "+" (opens the logger on it).
 * - The CURRENT meal, when empty, is always shown with a way forward:
 *   "Same as yesterday's lunch" (one tap, if yesterday had one) or "Add lunch".
 *   Previously an empty meal had no add button at all.
 * - Water taps are clubbed into one row per meal.
 * - Rows keep edit / delete (small icon buttons, 32px targets).
 */

import { Loader2, Pencil, Trash2, Plus, RotateCcw } from "lucide-react";
import { defaultMeal, mealMeta, MEALS } from "../lib/mealPeriod";

const labelStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: 0.8,
};
const iconBtn = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "none",
  background: "none",
  color: "var(--text-faint)",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  flexShrink: 0,
};
const r = (n) => Math.round(Number(n) || 0);

function MealHeader({ label, kcal, onAdd }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={labelStyle}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, color: kcal == null ? "var(--text-faint)" : "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
          {kcal == null ? "—" : r(kcal)}
        </span>
        {onAdd && (
          <button
            onClick={onAdd}
            aria-label={`Add food to ${label}`}
            style={{ ...iconBtn, border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-muted)" }}
          >
            <Plus size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Timeline({
  logs,
  loading,
  totals,
  openEditModal,
  deleteLog,
  onAddToMeal,
  currentMeal,
  yesterdayByMeal = {},
  onRepeatMeal,
}) {
  const nowMeal = currentMeal || defaultMeal();

  // Group by the meal the user filed things under; legacy rows (no meal) fall
  // back to their time-of-day bucket.
  const groups = {};
  (logs || []).forEach((log) => {
    const label = log.meal || defaultMeal(log.created_at);
    if (!groups[label]) groups[label] = { label, order: mealMeta(label).order, items: [] };
    groups[label].items.push(log);
  });
  if (!groups[nowMeal]) groups[nowMeal] = { label: nowMeal, order: mealMeta(nowMeal).order, items: [] };
  const sorted = Object.values(groups).sort((a, b) => a.order - b.order);

  const foodCount = (logs || []).filter((l) => l.name !== "Water").length;
  const later = MEALS.map((m) => m.label).filter(
    (m) => mealMeta(m).order > mealMeta(nowMeal).order && !groups[m],
  );

  return (
    <section aria-label="Today's log" style={{ padding: "0 20px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Today</h2>
        <span style={{ fontSize: 13, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
          {r(totals?.calories)} kcal · {foodCount} {foodCount === 1 ? "item" : "items"}
        </span>
      </div>

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: 24, color: "var(--text-faint)" }}>
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : (
        sorted.map((group) => {
          const foodLogs = group.items.filter((l) => l.name !== "Water");
          const waterLogs = group.items.filter((l) => l.name === "Water");
          const glasses = waterLogs.reduce((s, l) => s + (Number(l.qty) || 0), 0);
          const kcal = group.items.reduce((s, l) => s + (l.calories || 0), 0);
          const isEmpty = group.items.length === 0;
          const repeat = isEmpty ? yesterdayByMeal[group.label] : null;

          return (
            <div key={group.label} style={{ marginTop: 8 }}>
              <MealHeader
                label={group.label}
                kcal={isEmpty ? null : kcal}
                onAdd={!isEmpty && onAddToMeal ? () => onAddToMeal(group.label) : null}
              />

              {foodLogs.map((log) => (
                <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 0" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "capitalize" }}>
                      {log.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                      {log.qty}× · P {r(log.protein)} · C {r(log.carbs)} · F {r(log.fats)}
                    </div>
                  </div>
                  <span style={{ fontSize: 15, fontVariantNumeric: "tabular-nums", marginLeft: 6 }}>{r(log.calories)}</span>
                  <button onClick={() => openEditModal(log)} aria-label={`Edit ${log.name}`} style={iconBtn}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteLog(log.id)} aria-label={`Delete ${log.name}`} style={{ ...iconBtn, marginRight: -8 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {waterLogs.length > 0 && (() => {
                const latest = waterLogs.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 0" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15 }}>Water</div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                        {glasses} {glasses === 1 ? "glass" : "glasses"} · {(glasses * 0.25).toFixed(2)} L
                      </div>
                    </div>
                    <button onClick={() => deleteLog(latest.id)} aria-label="Remove a glass of water" style={{ ...iconBtn, marginRight: -8 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })()}

              {isEmpty && repeat?.items?.length > 0 && onRepeatMeal && (
                <button
                  onClick={() => onRepeatMeal(group.label, repeat.items)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 10,
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text)",
                    font: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <RotateCcw size={18} color="var(--accent-text)" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>
                      Same as yesterday’s {group.label.toLowerCase()}
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "capitalize" }}>
                      {repeat.items.map((i) => i.name).join(" · ")} · {r(repeat.kcal)} kcal
                    </span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-text)" }}>Log</span>
                </button>
              )}

              {isEmpty && onAddToMeal && (
                <button
                  onClick={() => onAddToMeal(group.label)}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 0 4px",
                    border: "none",
                    background: "none",
                    color: "var(--text-muted)",
                    font: "inherit",
                    fontSize: 14,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span>{repeat?.items?.length ? "Something else?" : "Nothing yet"}</span>
                  <span style={{ color: "var(--accent-text)", fontWeight: 600 }}>Add {group.label.toLowerCase()}</span>
                </button>
              )}
            </div>
          );
        })
      )}

      {!loading && later.length > 0 && (
        <div style={{ fontSize: 13, color: "var(--text-faint)", paddingTop: 12 }}>
          {later.join(" and ")} later today
        </div>
      )}
    </section>
  );
}
