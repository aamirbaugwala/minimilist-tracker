"use client";

/**
 * "How your targets are worked out" (Direction A). Mirrors lib/nutrition.js
 * exactly — keep the numbers here in sync with it.
 */

import Sheet from "../Sheet";

const box = { padding: 16, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" };
const h = { margin: "0 0 6px", fontSize: 15, fontWeight: 600 };
const p = { margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)" };
const mono = { margin: "8px 0", padding: "10px 12px", borderRadius: 10, background: "var(--bg)", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 };

export default function ResearchModal({ showResearch, setShowResearch }) {
  if (!showResearch) return null;
  return (
    <Sheet title="How your targets are worked out" onClose={() => setShowResearch(false)} tall>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={box}>
          <h4 style={h}>1. Calories</h4>
          <p style={p}>Your resting burn (Mifflin-St Jeor, the standard used in clinics), times your activity, plus your goal’s adjustment.</p>
          <div style={mono}>
            Men: 10×kg + 6.25×cm − 5×age + 5<br />
            Women: 10×kg + 6.25×cm − 5×age − 161<br />
            × 1.2 desk · 1.375 light · 1.55 moderate · 1.725 active
          </div>
        </div>
        <div style={box}>
          <h4 style={h}>2. Protein</h4>
          <p style={p}>Per kg of body weight, set by your protein priority (ISSN guidance):</p>
          <div style={mono}>Balanced 1.8 g/kg · Preserve 2.0 g/kg · Maximize 2.4 g/kg</div>
          <p style={p}>Fat is 24–32% of calories depending on the same priority; carbs fill the rest.</p>
        </div>
        <div style={box}>
          <h4 style={h}>3. Fibre and water</h4>
          <p style={p}>Fibre: 14 g per 1,000 kcal (+3 g on high-protein priorities). Water: 0.035 L per kg, +0.5 L if you’re active.</p>
        </div>
        <div style={box}>
          <h4 style={h}>4. Your health</h4>
          <p style={p}>
            Conditions you add — or a blood report — can safely adjust these: for example, protein is capped for kidney concerns, fat is capped and fibre raised when LDL is high. Your Profile & goals screen lists any changes made.
          </p>
        </div>
        <p style={{ ...p, fontSize: 12, color: "var(--text-faint)" }}>Not medical advice. Your doctor’s targets always come first.</p>
      </div>
    </Sheet>
  );
}
