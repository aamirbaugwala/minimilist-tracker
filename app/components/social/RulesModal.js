"use client";

import { Trophy, X } from "lucide-react";

const RulesModal = ({ showGlobalRules, setShowGlobalRules }) =>
  !showGlobalRules ? null : (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 7, fontSize: "0.95rem" }}>
            <Trophy size={16} color="#f59e0b" /> Scoring System
          </h3>
          <button onClick={() => setShowGlobalRules(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: "0.65rem", color: "#888", marginBottom: 2 }}>Max Possible</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#f59e0b" }}>135 pts</div>
        </div>
        {[
          { label: "Base Score (max 100)", color: "#3b82f6", items: ["Average % across all 6 daily goals, each capped at 100%"] },
          { label: "Bonuses (+35 max)", color: "#22c55e", items: ["+15 pts — Hit 90%+ Protein", "+10 pts — Hit 90%+ Fiber", "+10 pts — Hit 90%+ Water"] },
          { label: "Penalties (unlimited)", color: "#ef4444", items: ["−5 per 10% over Calories", "−5 per 10% over Fats", "−3 per 10% over Carbs"] },
        ].map(({ label, color, items }) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color, fontSize: "0.78rem", marginBottom: 5 }}>{label}</div>
            {items.map((item) => (
              <div key={item} style={{ fontSize: "0.73rem", color: "#bbb", marginBottom: 2, paddingLeft: 8, borderLeft: `2px solid ${color}55` }}>{item}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

export default RulesModal;
