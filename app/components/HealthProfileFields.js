"use client";

/**
 * HealthProfileFields — self-reported health conditions, dietary pattern, and
 * allergies. Shared by onboarding and the settings sheet so both stay in sync.
 *
 * Conditions here feed lib/conditions.js → conditionsFromProfile, which drives
 * the same target adjustments as lab data. Reads/writes three profile fields:
 * health_conditions[], dietary_pattern, allergies[].
 */

import { SELF_REPORT_OPTIONS } from "../lib/conditions";

const DIETS = [
  { key: "veg", label: "Vegetarian", emoji: "🥦" },
  { key: "eggetarian", label: "Egg-etarian", emoji: "🥚" },
  { key: "nonveg", label: "Non-veg", emoji: "🍗" },
  { key: "vegan", label: "Vegan", emoji: "🌱" },
  { key: "jain", label: "Jain", emoji: "🙏" },
];

const COMMON_ALLERGENS = ["Peanuts", "Tree nuts", "Dairy", "Gluten", "Soy", "Eggs", "Shellfish", "Fish"];

const chip = (active, color = "#3b82f6") => ({
  border: `1px solid ${active ? color : "#27272a"}`,
  background: active ? `${color}1f` : "#000",
  color: active ? "#fff" : "#a1a1aa",
  borderRadius: 20,
  padding: "8px 12px",
  fontSize: "0.8rem",
  fontWeight: active ? 700 : 500,
  cursor: "pointer",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  gap: 6,
  transition: "all .15s",
});

const label = {
  fontSize: "0.72rem",
  color: "#888",
  fontWeight: 600,
  marginBottom: 8,
  display: "block",
  letterSpacing: 0.2,
};

export default function HealthProfileFields({ profile, onChange }) {
  const conditions = profile.health_conditions || [];
  const allergies = profile.allergies || [];

  const toggleArray = (field, value) => {
    const cur = profile[field] || [];
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
    onChange({ ...profile, [field]: next });
  };

  const noneSelected = conditions.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Conditions */}
      <div>
        <label style={label}>
          🩺 Any of these apply to you?{" "}
          <span style={{ color: "#52525b", fontWeight: 400 }}>— we&apos;ll tailor your targets</span>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          <button
            onClick={() => onChange({ ...profile, health_conditions: [] })}
            style={chip(noneSelected, "#22c55e")}
          >
            ✅ None
          </button>
          {SELF_REPORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => toggleArray("health_conditions", o.key)}
              style={chip(conditions.includes(o.key), "#f59e0b")}
            >
              {o.emoji} {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dietary pattern */}
      <div>
        <label style={label}>🍽 Dietary pattern</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {DIETS.map((d) => (
            <button
              key={d.key}
              onClick={() => onChange({ ...profile, dietary_pattern: d.key })}
              style={chip(profile.dietary_pattern === d.key, "#8b5cf6")}
            >
              {d.emoji} {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Allergies */}
      <div>
        <label style={label}>🚫 Allergies / foods to avoid</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {COMMON_ALLERGENS.map((a) => (
            <button
              key={a}
              onClick={() => toggleArray("allergies", a)}
              style={chip(allergies.includes(a), "#ef4444")}
            >
              {allergies.includes(a) ? "✓ " : ""}
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
