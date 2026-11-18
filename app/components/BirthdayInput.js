"use client";

/**
 * Birthday field (Direction A) — replaces the typed "Age" box so age is always
 * calculated from the date. Shows the resulting age, and nudges people who only
 * ever entered an age to add their birthday.
 */

import { ageFromBirthDate, birthDateBounds, isValidBirthDate, MAX_AGE, MIN_AGE } from "../lib/age";
import { sheetInput, sheetLabel } from "./Sheet";

export default function BirthdayInput({ value, legacyAge, onChange, compact = false }) {
  const { min, max } = birthDateBounds();
  const valid = isValidBirthDate(value);
  const age = valid ? ageFromBirthDate(value) : null;
  const hint = value
    ? valid
      ? `Age ${age}`
      : `Enter a date that makes you ${MIN_AGE}–${MAX_AGE}`
    : legacyAge
      ? `You entered age ${legacyAge} before. Add your birthday so it stays right.`
      : "Used to work out your daily calories.";

  return (
    <label style={{ ...sheetLabel, ...(compact ? { fontSize: 12, gap: 4 } : {}) }}>
      Birthday
      <input
        type="date"
        value={value || ""}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label="Birthday"
        aria-invalid={value && !valid ? true : undefined}
        style={{ ...sheetInput, ...(compact ? { height: 44 } : {}), colorScheme: "inherit" }}
      />
      <span style={{ fontSize: 12, color: value && !valid ? "var(--danger)" : "var(--text-faint)" }}>{hint}</span>
    </label>
  );
}
