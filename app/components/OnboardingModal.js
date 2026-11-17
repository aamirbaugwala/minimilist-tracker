"use client";

/**
 * Onboarding (Direction A) — full-screen first-run setup for a user with an
 * incomplete profile (no weight). Four steps: Basics → Goal → Health → Review.
 * Progress is always visible, each choice says what it does, and the daily
 * target preview (already respecting self-reported conditions) updates live.
 * Basics are required; Health is optional.
 */

import { useState } from "react";
import { AlertTriangle, Check, Info, Loader2 } from "lucide-react";
import { calculateTargets, GOAL_PRESETS } from "../lib/nutrition";
import { conditionsFromProfile } from "../lib/conditions";
import HealthProfileFields from "./HealthProfileFields";
import { sheetInput, sheetLabel, primaryBtn, secondaryBtn } from "./Sheet";

const STEPS = ["Basics", "Goal", "Health", "Review"];
const GOAL_TITLE = { lose: "Lose fat", gain: "Build muscle", maintain: "Maintain", recomp: "Lose fat, gain muscle" };
const GOAL_HINT = {
  lose: "About 0.5 kg a week · protects muscle",
  maintain: "Keep your weight, eat well",
  gain: "A small surplus with steady protein",
  recomp: "Same calories, more protein",
};
const ACTIVITY = [
  { id: "sedentary", label: "Mostly sitting", hint: "Desk job, little exercise" },
  { id: "light", label: "Lightly active", hint: "Exercise 1–3 days a week" },
  { id: "moderate", label: "Active", hint: "Exercise 3–5 days a week" },
  { id: "active", label: "Very active", hint: "Exercise 6–7 days a week" },
];
const fmt = (n) => Math.round(n || 0).toLocaleString("en-IN");

function RadioCard({ on, title, hint, onClick }) {
  return (
    <button
      role="radio"
      aria-checked={on}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: 16,
        borderRadius: 16,
        border: on ? "1.5px solid var(--accent)" : "1px solid var(--border)",
        background: on ? "var(--accent-soft)" : "var(--surface)",
        color: "var(--text)",
        fontFamily: "inherit",
        textAlign: "left",
        cursor: "pointer",
        width: "100%",
      }}
    >
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 16, fontWeight: 600 }}>{title}</span>
        {hint && <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: "50%",
          boxSizing: "border-box",
          border: on ? "none" : "2px solid var(--border)",
          background: on ? "var(--accent)" : "transparent",
          color: "var(--on-accent)",
          display: "grid",
          placeItems: "center",
        }}
      >
        {on && <Check size={13} strokeWidth={3} />}
      </span>
    </button>
  );
}

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
  const preview = calculateTargets(p, conditionsFromProfile(p));

  const finish = async () => {
    setSaving(true);
    await onComplete(p);
    setSaving(false); // parent unmounts us on success
  };

  const title = [
    `Welcome${username ? `, ${username}` : ""}`,
    "What are you aiming for?",
    "Anything we should know?",
    "You’re all set",
  ][step];
  const intro = [
    "Takes about a minute. This is how we work out your daily calories and protein.",
    "This sets your daily calories and protein. You can change it any time in Me.",
    "Optional. It tailors your targets and food suggestions — skip if none apply.",
    "Here’s your daily plan. It adapts as you log and if you add a blood report.",
  ][step];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10001, background: "var(--bg)", color: "var(--text)", overflowY: "auto" }}>
      <div style={{ maxWidth: 560, minHeight: "100%", margin: "0 auto", boxSizing: "border-box", display: "flex", flexDirection: "column", padding: "calc(24px + env(safe-area-inset-top, 0px)) 24px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        <div role="progressbar" aria-label={`Step ${step + 1} of ${STEPS.length}`} aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length} style={{ display: "grid", gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))`, gap: 6 }}>
          {STEPS.map((s, i) => (
            <span key={s} style={{ height: 4, borderRadius: 99, background: i <= step ? "var(--accent)" : "var(--track)" }} />
          ))}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>Step {step + 1} of {STEPS.length} · {STEPS[step]}</div>
        <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 600, letterSpacing: -0.5 }}>{title}</h1>
        <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.5, color: "var(--text-muted)" }}>{intro}</p>

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          {step === 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                {[
                  ["weight", "Weight", "kg", "70"],
                  ["height", "Height", "cm", "172"],
                  ["age", "Age", "", "28"],
                ].map(([k, l, u, ph]) => (
                  <label key={k} style={sheetLabel}>
                    {l}{u ? ` (${u})` : ""}
                    <input type="number" inputMode="decimal" value={p[k]} placeholder={ph} onChange={(e) => set({ [k]: e.target.value })} style={sheetInput} />
                  </label>
                ))}
              </div>
              <div role="radiogroup" aria-label="Sex" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", padding: 3, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
                {["male", "female"].map((g) => (
                  <button key={g} role="radio" aria-checked={p.gender === g} onClick={() => set({ gender: g })} style={{ height: 38, border: "none", borderRadius: 9, background: p.gender === g ? "var(--surface-highlight)" : "none", color: p.gender === g ? "var(--text)" : "var(--text-muted)", fontFamily: "inherit", fontSize: 14, fontWeight: p.gender === g ? 600 : 400, textTransform: "capitalize", cursor: "pointer" }}>
                    {g}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>How active are you?</div>
              <div role="radiogroup" aria-label="Activity" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ACTIVITY.map((a) => (
                  <RadioCard key={a.id} on={p.activity === a.id} title={a.label} hint={a.hint} onClick={() => set({ activity: a.id })} />
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <div role="radiogroup" aria-label="Goal" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {GOAL_PRESETS.map((g) => (
                <RadioCard
                  key={g.id}
                  on={p.goal === g.id}
                  title={GOAL_TITLE[g.id] || g.label}
                  hint={GOAL_HINT[g.id] || g.desc}
                  onClick={() => set({ goal: g.id, calorie_adjustment: g.calorie_adjustment, protein_priority: g.protein_priority })}
                />
              ))}
            </div>
          )}

          {step === 2 && <HealthProfileFields profile={p} onChange={setP} />}

          {step === 3 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6, padding: 16, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center" }}>
                {[
                  [fmt(preview.cals), "kcal"],
                  [`${fmt(preview.p)} g`, "protein"],
                  [`${fmt(preview.c)} g`, "carbs"],
                  [`${fmt(preview.f)} g`, "fat"],
                  [`${fmt(preview.fib)} g`, "fibre"],
                ].map(([v, l]) => (
                  <div key={l}><div style={{ fontSize: 16, fontWeight: 600 }}>{v}</div><div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{l}</div></div>
                ))}
              </div>
              {preview.medical.conflicts.map((c) => (
                <div key={c.title} style={{ display: "flex", gap: 10, padding: 12, borderRadius: 12, background: "var(--warn-soft)", fontSize: 13, lineHeight: 1.5 }}>
                  <AlertTriangle size={16} color="var(--warn)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span><strong style={{ color: "var(--warn)" }}>{c.title}.</strong> {c.detail}</span>
                </div>
              ))}
              {preview.medical.adjustments.map((a) => (
                <div key={a.title} style={{ display: "flex", gap: 10, padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
                  <Info size={16} color="var(--accent-text)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span><strong style={{ color: "var(--text)" }}>{a.title}.</strong> {a.detail}</span>
                </div>
              ))}
              <div style={{ borderRadius: 16, border: "1px solid var(--border)" }}>
                {[
                  ["Goal", GOAL_TITLE[p.goal] || "Custom", 1],
                  ["Activity", ACTIVITY.find((a) => a.id === p.activity)?.label || "—", 0],
                  ["Diet & health", [p.dietary_pattern, ...(p.health_conditions || [])].filter(Boolean).length ? `${[p.dietary_pattern, ...(p.health_conditions || [])].filter(Boolean).length} set` : "None", 2],
                ].map(([label, value, to], i) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 15 }}>
                    <span style={{ color: "var(--text-muted)", flex: 1 }}>{label}</span>
                    <span style={{ fontWeight: 600 }}>{value}</span>
                    <button onClick={() => setStep(to)} style={{ background: "none", border: "none", padding: 4, color: "var(--accent-text)", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>Edit</button>
                  </div>
                ))}
              </div>
              {p.health_conditions?.length > 0 && (
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-faint)", lineHeight: 1.5 }}>
                  Based on what you told us. Upload a blood report any time for lab-based targets. Not medical advice.
                </p>
              )}
            </>
          )}
        </div>

        {step < 3 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, padding: "14px 16px", borderRadius: 14, border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Your daily target</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{basicsDone ? `${fmt(preview.cals)} kcal · ${fmt(preview.p)} g protein` : "—"}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {step > 0 && <button onClick={() => setStep((s) => s - 1)} style={secondaryBtn}>Back</button>}
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && !basicsDone}
              style={{ ...primaryBtn, flex: 1, opacity: step === 0 && !basicsDone ? 0.5 : 1, cursor: step === 0 && !basicsDone ? "not-allowed" : "pointer" }}
            >
              {step === 0 && !basicsDone ? "Fill in weight, height and age" : step === 2 ? "Continue (or skip)" : "Continue"}
            </button>
          ) : (
            <button onClick={finish} disabled={saving} style={{ ...primaryBtn, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : "Start tracking"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
