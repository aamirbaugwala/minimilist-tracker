/**
 * app/lib/mealPeriod.js
 * The meal period for a timestamp (or now) — shared by the timeline grouping
 * and the "your usual {period}" predictive card.
 */
export function getMealPeriod(createdAt) {
  const h = createdAt ? new Date(createdAt).getHours() : new Date().getHours();
  if (h >= 5 && h < 11) return { label: "Breakfast", icon: "☀️", order: 0 };
  if (h >= 11 && h < 15) return { label: "Lunch", icon: "🌤️", order: 1 };
  if (h >= 15 && h < 18) return { label: "Snacks", icon: "🍵", order: 2 };
  if (h >= 18 && h < 22) return { label: "Dinner", icon: "🌙", order: 3 };
  return { label: "Late Night", icon: "🌑", order: 4 };
}

// The four meals the user files food under (their explicit choice at log time).
export const MEALS = [
  { label: "Breakfast", icon: "☀️" },
  { label: "Lunch", icon: "🌤️" },
  { label: "Snacks", icon: "🍵" },
  { label: "Dinner", icon: "🌙" },
];

const MEAL_ORDER = { Breakfast: 0, Lunch: 1, Snacks: 2, Dinner: 3 };

// The meal we pre-select for a given time, so the picker starts on the sensible
// one. Anything after 6pm (incl. late night) defaults to Dinner.
export function defaultMeal(createdAt) {
  const h = createdAt ? new Date(createdAt).getHours() : new Date().getHours();
  if (h >= 5 && h < 11) return "Breakfast";
  if (h >= 11 && h < 16) return "Lunch";
  if (h >= 16 && h < 18) return "Snacks";
  return "Dinner";
}

// Icon + sort order for a stored meal label; falls back for legacy/unknown ones.
export function mealMeta(label) {
  const found = MEALS.find((m) => m.label === label);
  if (found) return { ...found, order: MEAL_ORDER[label] };
  return { label: label || "Other", icon: "🍽️", order: 9 };
}
