"use client";
import {
  BookOpen,
  X,
} from "lucide-react";
const ResearchModal = ({ showResearch, setShowResearch }) => {
  if (!showResearch) return null;
  return (
        <div className="modal-overlay">
          <div
            className="modal-content"
            style={{
              maxWidth: 500,
              background: "#18181b",
              border: "1px solid #333",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: "1.2rem",
                }}
              >
                <BookOpen size={22} color="#3b82f6" /> Nutritional Science
              </h3>
              <button
                onClick={() => setShowResearch(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#666",
                  cursor: "pointer",
                }}
              >
                <X />
              </button>
            </div>
            <div style={{ color: "#ccc", lineHeight: 1.7 }}>
              <p style={{ marginBottom: 20 }}>
                NutriTrack uses the <strong>Mifflin-St Jeor Equation</strong>,
                the current gold standard for calculating metabolic rate in
                clinical settings.
              </p>
              <div
                style={{
                  background: "#121214",
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 16,
                  border: "1px solid #222",
                }}
              >
                <h4
                  style={{
                    color: "#f59e0b",
                    marginBottom: 8,
                    fontSize: "0.95rem",
                  }}
                >
                  1. BMR (Basal Metabolic Rate)
                </h4>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    background: "#000",
                    padding: 10,
                    borderRadius: 6,
                    color: "#888",
                    marginBottom: 10,
                  }}
                >
                  Men: (10 × W) + (6.25 × H) - (5 × A) + 5<br />
                  Women: (10 × W) + (6.25 × H) - (5 × A) - 161
                </div>
                <p style={{ fontSize: "0.85rem", color: "#888" }}>
                  This calculates the energy your body burns just to exist at
                  rest.
                </p>
              </div>
              <div
                style={{
                  background: "#121214",
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 16,
                  border: "1px solid #222",
                }}
              >
                <h4
                  style={{
                    color: "#3b82f6",
                    marginBottom: 8,
                    fontSize: "0.95rem",
                  }}
                >
                  2. Protein Needs (ISSN)
                </h4>
                <p style={{ fontSize: "0.85rem", color: "#888" }}>
                  We prioritize protein based on <strong>Lean Body Mass</strong>{" "}
                  retention:
                </p>
                <ul
                  style={{
                    fontSize: "0.85rem",
                    color: "#888",
                    marginTop: 8,
                    paddingLeft: 20,
                  }}
                >
                  <li style={{ marginBottom: 4 }}>
                    <strong>Fat Loss:</strong> 2.2g / kg (Prevents muscle
                    catabolism)
                  </li>
                  <li style={{ marginBottom: 4 }}>
                    <strong>Maintenance:</strong> 1.6g / kg (Optimal synthesis)
                  </li>
                  <li>
                    <strong>Muscle Gain:</strong> 1.8g / kg (Support
                    hypertrophy)
                  </li>
                </ul>
              </div>
              <div
                style={{
                  background: "#121214",
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid #222",
                }}
              >
                <h4
                  style={{
                    color: "#10b981",
                    marginBottom: 8,
                    fontSize: "0.95rem",
                  }}
                >
                  3. Hydration (ACSM)
                </h4>
                <p style={{ fontSize: "0.85rem", color: "#888" }}>
                  <strong>Formula:</strong> Body Weight (kg) × 0.035 Liters.
                </p>
              </div>
            </div>
          </div>
        </div>
  );
};
export default ResearchModal;
