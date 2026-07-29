"use client";

/**
 * UsualCard — one-tap "your usual" for the current meal period, predicted from
 * the user's recent history. Logging a whole familiar meal in a single tap is
 * the biggest friction win: most meals repeat.
 */

import { getMealPeriod } from "../lib/mealPeriod";

export default function UsualCard({ recents, onLog }) {
  // Take the top few most-recent distinct foods as "the usual" for right now.
  const items = (recents || []).filter((n) => n && n !== "Water").slice(0, 3);
  if (items.length < 2) return null; // not enough history to predict yet

  const period = getMealPeriod();

  return (
    <section style={{ padding: "12px 20px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderRadius: 18,
          padding: "13px 14px",
          border: "1px solid rgba(20,184,166,0.25)",
          background: "linear-gradient(120deg, rgba(20,184,166,0.08), rgba(20,184,166,0.02))",
        }}
      >
        <span style={{ fontSize: "1.4rem" }}>{period.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#14b8a6", fontWeight: 800 }}>
            Your usual {period.label.toLowerCase()}
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.85rem",
              marginTop: 2,
              textTransform: "capitalize",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {items.join(" · ")}
          </div>
        </div>
        <button
          onClick={() => onLog(items)}
          style={{
            border: "none",
            fontFamily: "inherit",
            cursor: "pointer",
            background: "#14b8a6",
            color: "#04110f",
            fontWeight: 800,
            fontSize: "0.78rem",
            padding: "9px 14px",
            borderRadius: 12,
            flexShrink: 0,
          }}
        >
          + Log all
        </button>
      </div>
    </section>
  );
}
