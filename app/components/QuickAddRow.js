"use client";

/**
 * QuickAddRow (Direction A) — one-tap re-logging of recent foods into the
 * current meal. Each chip logs ONE serving; the +kcal burst and Undo toast
 * give feedback and a way back. Long names truncate cleanly.
 */

import { foodLabel } from "../lib/foodLabel";

export default function QuickAddRow({ recents, foodDb, selectedMeal, onAdd, onMore }) {
  const items = (recents || []).filter((n) => n && n !== "Water").slice(0, 8);
  if (items.length === 0) return null; // new users: the capture row covers it

  return (
    <section aria-label="Quick add" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 20px" }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Quick add to <span style={{ color: "var(--text)", fontWeight: 600 }}>{selectedMeal}</span>
        </span>
        <button
          onClick={onMore}
          style={{ background: "none", border: "none", padding: 0, color: "var(--accent-text)", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          All foods
        </button>
      </div>

      <div
        className="chip-scroll"
        style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 20px 2px", scrollbarWidth: "none" }}
      >
        {items.map((name) => {
          const kcal = foodDb?.[name.toLowerCase()]?.calories;
          return (
            <button
              key={name}
              onClick={() => onAdd(name)}
              aria-label={`Add ${name} to ${selectedMeal}`}
              style={{
                flexShrink: 0,
                maxWidth: 190,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 12px",
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                font: "inherit",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <span style={{ color: "var(--accent-text)", fontWeight: 700 }}>+</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "capitalize" }}>
                {foodLabel(name)}
              </span>
              {kcal != null && <span style={{ color: "var(--text-faint)", flexShrink: 0 }}>{Math.round(kcal)}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
