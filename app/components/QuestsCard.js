"use client";

/**
 * Daily goals (Direction A keeps gamification quiet): one line with a dot per
 * goal; tap to see the three goals and their progress. Same quests as before
 * (lib/gamification.js), still awarding XP when completed.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function QuestsCard({ quests }) {
  const [open, setOpen] = useState(false);
  if (!quests?.length) return null;
  const done = quests.filter((q) => q.done).length;

  return (
    <section style={{ padding: "0 20px" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 0",
          border: "none",
          background: "none",
          color: "var(--text-muted)",
          font: "inherit",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <span>Daily goals · {done} of {quests.length} done</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {quests.map((q) => (
            <span
              key={q.id}
              aria-hidden="true"
              style={{ width: 8, height: 8, borderRadius: "50%", background: q.done ? "var(--accent)" : "var(--track)" }}
            />
          ))}
          <ChevronDown size={14} style={{ marginLeft: 4, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </span>
      </button>

      {open && (
        <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {quests.map((q) => {
            const pct = Math.min(100, (q.current / q.max) * 100);
            return (
              <li key={q.id}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: q.done ? "var(--text-muted)" : "var(--text)" }}>{q.title}</span>
                  <span style={{ color: q.done ? "var(--accent-text)" : "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                    {q.done ? "Done" : `${q.current}/${q.max}${q.unit || ""}`} · +{q.xp} XP
                  </span>
                </div>
                <div style={{ height: 3, borderRadius: 99, background: "var(--track)", marginTop: 6 }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: "var(--accent)" }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
