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

// Direction A chips: selection = accent outline + soft fill; allergies use the
// warning tone so "avoid" reads differently from "applies to me".
const chip = (active, tone = "accent") => ({
  border: active ? `1.5px solid var(--${tone === "warn" ? "warn" : "accent"})` : "1px solid var(--border)",
  background: active ? `var(--${tone === "warn" ? "warn" : "accent"}-soft)` : "transparent",
  color: active ? "var(--text)" : "var(--text-muted)",
  borderRadius: 99,
  padding: "8px 13px",
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "background .15s, border-color .15s",
});

const label = {
  fontSize: 13,
  color: "var(--text-muted)",
  marginBottom: 8,
  display: "block",
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Conditions */}
      <div>
        <label style={label}>
          Any of these apply to you?{" "}
          <span style={{ color: "var(--text-faint)" }}>We&apos;ll tailor your targets.</span>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          <button
            onClick={() => onChange({ ...profile, health_conditions: [] })}
            style={chip(noneSelected)}
          >
            None
          </button>
          {SELF_REPORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => toggleArray("health_conditions", o.key)}
              style={chip(conditions.includes(o.key))}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dietary pattern */}
      <div>
        <label style={label}>Diet</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {DIETS.map((d) => (
            <button
              key={d.key}
              onClick={() => onChange({ ...profile, dietary_pattern: d.key })}
              style={chip(profile.dietary_pattern === d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Allergies */}
      <div>
        <label style={label}>Allergies · foods to avoid</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {COMMON_ALLERGENS.map((a) => (
            <button
              key={a}
              onClick={() => toggleArray("allergies", a)}
              aria-pressed={allergies.includes(a)}
              style={chip(allergies.includes(a), "warn")}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
