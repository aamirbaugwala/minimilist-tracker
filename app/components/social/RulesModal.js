"use client";

import Sheet from "../Sheet";

const GROUPS = [
  { label: "Base · up to 100", tone: "var(--text)", items: ["Average of your 6 daily goals (calories, protein, carbs, fat, fibre, water), each capped at 100%"] },
  { label: "Bonuses · up to +35", tone: "var(--accent-text)", items: ["+15 for 90% of your protein", "+10 for 90% of your fibre", "+10 for 90% of your water"] },
  { label: "Penalties", tone: "var(--warn)", items: ["−5 for every 10% over calories", "−5 for every 10% over fat", "−3 for every 10% over carbs"] },
];

export default function RulesModal({ showGlobalRules, setShowGlobalRules }) {
  if (!showGlobalRules) return null;
  return (
    <Sheet title="How points work" subtitle="Scores reset every day · best possible 135" onClose={() => setShowGlobalRules(false)}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {GROUPS.map((g) => (
          <div key={g.label}>
            <div style={{ fontSize: 14, fontWeight: 600, color: g.tone, marginBottom: 6 }}>{g.label}</div>
            {g.items.map((it) => (
              <div key={it} style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-muted)", padding: "3px 0" }}>{it}</div>
            ))}
          </div>
        ))}
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-faint)", lineHeight: 1.5 }}>
          Everyone is scored against their own targets, so a small eater and a big eater compete fairly.
        </p>
      </div>
    </Sheet>
  );
}
