"use client";

/**
 * OnboardingModal — the first-run goal setter. Opens automatically for a user
 * with an incomplete profile (no weight). Four steps: Basics → Goal → Health →
 * Review, with a live target preview that already reflects self-reported
 * conditions (via lib/conditions.js). Basics are required to finish.
 */

import { useState } from "react";
import { ArrowLeft, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { calculateTargets, GOAL_PRESETS } from "../lib/nutrition";
import { conditionsFromProfile } from "../lib/conditions";
import HealthProfileFields from "./HealthProfileFields";

const inputStyle = {
  width: "100%",
  padding: 11,
  background: "#000",
  border: "1px solid #333",
  color: "#fff",
  borderRadius: 10,
  fontSize: 16, // 16px avoids iOS focus-zoom
  boxSizing: "border-box",
};
const fieldLabel = { fontSize: "0.72rem", color: "#888", marginBottom: 5, display: "block", fontWeight: 600 };

export default function OnboardingModal({ initialProfile, username, onComplete }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [p, setP] = useState({
    weight: "", height: "", age: "", gender: "male", activity: "sedentary",
    goal: "maintain", calorie_adjustment: 0, protein_priority: "balanced",
    health_conditions: [], dietary_pattern: "", allergies: [],
    ...initialProfile,
  });

  const set = (patch) => setP((prev) => ({ ...prev, ...patch }));
  const basicsDone = p.weight && p.height && p.age;

  const STEPS = ["Basics", "Goal", "Health", "Review"];

  // Live preview already respects self-reported conditions.
  const preview = calculateTargets(p, conditionsFromProfile(p));

  const finish = async () => {
    setSaving(true);
    await onComplete(p);
    // parent unmounts us on success; if it doesn't, release the button
    setSaving(false);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10001, alignItems: "flex-end", paddingBottom: 62 }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 480,
          maxHeight: "calc(92dvh - 62px)",
          display: "flex",
          flexDirection: "column",
          margin: "0 auto",
          boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header + progress */}
        <div style={{ padding: "18px 20px 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", padding: 0, display: "flex" }}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.68rem", color: "#14b8a6", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Step {step + 1} of {STEPS.length}
              </div>
              <div style={{ fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.01em" }}>
                {step === 0
                  ? `Welcome${username ? `, ${username}` : ""} 👋`
                  : STEPS[step] === "Goal"
                    ? "What's your goal?"
                    : STEPS[step] === "Health"
                      ? "Your health"
                      : "You're all set 🎯"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 12 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 99,
                  background: i <= step ? "linear-gradient(90deg,#14b8a6,#3b82f6)" : "#27272a",
                  transition: "background .3s",
                }}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "6px 20px 20px" }}>
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: "0.82rem", color: "#a1a1aa", lineHeight: 1.5, marginBottom: 2 }}>
                A few details so we can calculate targets that fit <em>you</em> — not a generic 2,000 kcal.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={fieldLabel}>Weight (kg)</label>
                  <input type="number" inputMode="decimal" value={p.weight} placeholder="70"
                    onChange={(e) => set({ weight: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Height (cm)</label>
                  <input type="number" inputMode="decimal" value={p.height} placeholder="172"
                    onChange={(e) => set({ height: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Age</label>
                  <input type="number" inputMode="numeric" value={p.age} placeholder="28"
                    onChange={(e) => set({ age: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Sex</label>
                  <div style={{ display: "flex", height: 44, background: "#000", border: "1px solid #333", borderRadius: 10, overflow: "hidden" }}>
                    {["male", "female"].map((g) => (
                      <button key={g} onClick={() => set({ gender: g })}
                        style={{ flex: 1, background: p.gender === g ? "#27272a" : "transparent", border: "none",
                          color: p.gender === g ? "#fff" : "#666", textTransform: "capitalize", fontSize: "0.85rem",
                          cursor: "pointer", fontFamily: "inherit", fontWeight: p.gender === g ? 700 : 400 }}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label style={fieldLabel}>Activity level</label>
                <select value={p.activity} onChange={(e) => set({ activity: e.target.value })}
                  style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="sedentary">Sedentary (office job)</option>
                  <option value="light">Light exercise (1–3 days)</option>
                  <option value="moderate">Moderate (3–5 days)</option>
                  <option value="active">Active (6–7 days)</option>
                </select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {GOAL_PRESETS.map((g) => {
                const on = p.goal === g.id;
                return (
                  <button key={g.id}
                    onClick={() => set({ goal: g.id, calorie_adjustment: g.calorie_adjustment, protein_priority: g.protein_priority })}
                    style={{
                      padding: "16px 14px", textAlign: "left", borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
                      background: on ? `${g.color}22` : "#000",
                      border: on ? `2px solid ${g.color}` : "1px solid #333",
                      color: on ? g.color : "#aaa",
                    }}>
                    <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{g.label}</div>
                    <div style={{ fontSize: "0.7rem", opacity: 0.8, marginTop: 3, lineHeight: 1.4 }}>{g.desc}</div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && <HealthProfileFields profile={p} onChange={setP} />}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#0a0a0a", border: "1px solid #27272a", borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ fontSize: "0.68rem", color: "#52525b", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>
                  Your daily targets
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4, textAlign: "center" }}>
                  {[
                    { l: "Cals", v: preview.cals, u: "", c: "#f59e0b" },
                    { l: "Protein", v: preview.p, u: "g", c: "#3b82f6" },
                    { l: "Carbs", v: preview.c, u: "g", c: "#22c55e" },
                    { l: "Fat", v: preview.f, u: "g", c: "#ef4444" },
                    { l: "Fiber", v: preview.fib, u: "g", c: "#8b5cf6" },
                  ].map((m) => (
                    <div key={m.l}>
                      <div style={{ fontWeight: 800, fontSize: "0.95rem", color: m.c }}>{m.v}{m.u}</div>
                      <div style={{ fontSize: "0.58rem", color: "#52525b", marginTop: 1 }}>{m.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Medical adjustments / conflicts from self-reported conditions */}
              {preview.medical.conflicts.map((c) => (
                <div key={c.title} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "0.8rem", color: "#ef4444", marginBottom: 3 }}>
                    <AlertTriangle size={13} /> {c.title}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#a1a1aa", lineHeight: 1.5 }}>{c.detail}</div>
                </div>
              ))}
              {preview.medical.adjustments.map((a) => (
                <div key={a.title} style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 10, padding: "9px 12px", fontSize: "0.75rem", color: "#93c5fd", lineHeight: 1.5 }}>
                  <strong style={{ color: "#bfdbfe" }}>{a.title}.</strong> {a.detail}
                </div>
              ))}

              {(p.health_conditions?.length > 0) && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "0.72rem", color: "#52525b", lineHeight: 1.5 }}>
                  <Sparkles size={13} style={{ marginTop: 2, flexShrink: 0, color: "#14b8a6" }} />
                  <span>Based on what you told us. Upload a blood report anytime for precise, lab-driven targets — this is not medical advice.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", paddingBottom: "calc(20px + env(safe-area-inset-bottom,0px))", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && !basicsDone}
              style={{
                width: "100%", padding: 14, borderRadius: 12, border: "none", fontWeight: 800, fontSize: "0.95rem",
                cursor: step === 0 && !basicsDone ? "not-allowed" : "pointer", fontFamily: "inherit",
                background: step === 0 && !basicsDone ? "#1e1e26" : "linear-gradient(135deg,#14b8a6,#3b82f6)",
                color: step === 0 && !basicsDone ? "#52525b" : "#fff",
              }}
            >
              {step === 0 && !basicsDone ? "Fill in your basics" : "Continue →"}
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              style={{
                width: "100%", padding: 14, borderRadius: 12, border: "none", fontWeight: 800, fontSize: "0.95rem",
                cursor: "pointer", fontFamily: "inherit", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : "Start tracking 🚀"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
