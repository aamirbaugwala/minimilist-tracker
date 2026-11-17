"use client";

/**
 * CoachNudge — the ONE helpful moment on Today (replaces scattered AI widgets).
 * Deterministic (no LLM call → instant, free, predictable):
 *   • protein behind pace for the time of day  → 3 protein-rich foods
 *   • else fibre low in the evening            → 3 fibre-rich foods
 * Foods come from the user's recents first, then the food DB, and always pass
 * the same diet/allergy filter Coach uses. Dismissed = hidden for the day.
 */

import { useMemo } from "react";
import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { calculateTargets } from "../lib/nutrition";
import { exclusionReason } from "../lib/dietFilter";
import { foodLabel } from "../lib/foodLabel";
import { useLocalStorageValue } from "../hooks/useLocalStorageValue";

const DISMISS_KEY = (day) => `nt_nudge_dismissed_${day}`;

// Share of the day's target you'd expect to have eaten by this hour.
const expectedShare = (hour) => (hour < 11 ? 0 : hour < 15 ? 0.35 : hour < 19 ? 0.55 : 0.75);

function pickFoods({ foodDb, recents, nutrient, rules, maxCalories }) {
  const score = (item) => (item?.[nutrient] || 0) / Math.max(item?.calories || 1, 40);
  const ok = (name, item) =>
    item && name !== "water" && (item[nutrient] || 0) >= (nutrient === "protein" ? 8 : 3) &&
    (item.calories || 0) > 0 && (item.calories || 0) <= maxCalories && !exclusionReason(name, rules);

  const fromRecents = (recents || [])
    .map((n) => [n.toLowerCase(), foodDb[n.toLowerCase()]])
    .filter(([n, item]) => ok(n, item));
  const fromDb = Object.entries(foodDb)
    .filter(([n, item]) => ok(n, item))
    .sort((a, b) => score(b[1]) - score(a[1]));

  const seen = new Set();
  const out = [];
  for (const [n, item] of [...fromRecents, ...fromDb]) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push({ name: n, amount: Math.round(item[nutrient]) });
    if (out.length === 3) break;
  }
  return out;
}

export default function CoachNudge({ totals, userProfile, conditions, foodDb, recents, day, currentMeal, onAdd }) {
  const [dismissedFlag, setDismissedFlag] = useLocalStorageValue(DISMISS_KEY(day));
  const dismissed = dismissedFlag === undefined || dismissedFlag === "1"; // undefined = not read yet

  const nudge = useMemo(() => {
    if (!userProfile?.weight) return null;
    const t = calculateTargets(userProfile, conditions);
    const hour = new Date().getHours();
    const share = expectedShare(hour);
    if (!share) return null;
    const rules = { dietaryPattern: userProfile.dietary_pattern, allergies: userProfile.allergies || [] };
    const maxCalories = Math.max(150, Math.min(450, t.cals - totals.calories));

    if (totals.protein < t.p * share * 0.8) {
      return {
        text: "Protein is running behind today. Any of these would help:",
        foods: pickFoods({ foodDb, recents, nutrient: "protein", rules, maxCalories }),
        unit: "g protein",
      };
    }
    if (hour >= 17 && (totals.fiber || 0) < t.fib * 0.5) {
      return {
        text: "Fibre is low today. An easy fix:",
        foods: pickFoods({ foodDb, recents, nutrient: "fiber", rules, maxCalories }),
        unit: "g fibre",
      };
    }
    return null;
  }, [totals, userProfile, conditions, foodDb, recents]);

  if (dismissed || !nudge || nudge.foods.length === 0) return null;

  const dismiss = () => setDismissedFlag("1");

  return (
    <section
      aria-label="Coach suggestion"
      style={{ margin: "0 20px", padding: 16, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Sparkles size={18} color="var(--accent-text)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, fontSize: 15, lineHeight: 1.45 }}>{nudge.text}</div>
        <button
          onClick={dismiss}
          aria-label="Dismiss suggestion"
          style={{ width: 32, height: 32, margin: "-6px -8px 0 0", border: "none", background: "none", color: "var(--text-faint)", display: "grid", placeItems: "center", cursor: "pointer" }}
        >
          <X size={16} />
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {nudge.foods.map((f) => (
          <button
            key={f.name}
            onClick={() => onAdd(f.name)}
            aria-label={`Add ${f.name} to ${currentMeal}`}
            style={{
              maxWidth: "100%",
              display: "flex",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text)",
              font: "inherit",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <span style={{ color: "var(--accent-text)", fontWeight: 700 }}>+</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "capitalize" }}>
              {foodLabel(f.name)}
            </span>
            <span style={{ color: "var(--text-faint)", flexShrink: 0 }}>{f.amount} g</span>
          </button>
        ))}
      </div>
      <Link href="/agent" style={{ display: "inline-block", marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--accent-text)", textDecoration: "none" }}>
        Ask Coach for more
      </Link>
    </section>
  );
}
