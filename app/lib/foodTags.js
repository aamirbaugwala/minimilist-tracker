/**
 * app/lib/foodTags.js — one short, honest tag per food for users with an
 * enforced medical condition (from blood reports or self-reported).
 *
 * Two kinds: "watch" (amber) and "helps" (green). Worded as nudges, never
 * diagnosis or prescription. Driven only by data we actually have per serving
 * (calories, protein, carbs, fats, fibre) plus a few unambiguous name cues
 * (e.g. "fried", "pickle"), so tags stay conservative.
 *
 * Condition ids: glycemic, lipid, renal, hepatic, purine, anemia, thyroid,
 * hypertension (lib/conditions.js).
 */

const has = (name, words) => words.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`, "i").test(name));

const SWEET = ["sugar", "sweet", "jalebi", "gulab", "halwa", "barfi", "ladoo", "laddu", "cake", "pastry", "brownie", "ice cream", "soft drink", "cola", "soda", "juice", "kheer", "rasgulla", "mithai", "candy", "chocolate bar", "donut", "doughnut"];
const FRIED = ["fried", "fry", "pakora", "bhajia", "bhaji", "samosa", "kachori", "puri", "bhatura", "vada", "chips", "french fries", "namkeen", "butter", "ghee", "cream", "malai", "makhani"];
const SALTY = ["pickle", "achar", "papad", "chips", "namkeen", "instant", "noodles", "soy sauce", "salted", "bhujia", "maggi", "processed", "sausage", "ham", "bacon"];
const PURINE = ["mutton", "lamb", "beef", "liver", "kidney", "prawn", "prawns", "shrimp", "crab", "sardine", "anchovy", "mackerel", "organ", "keema"];
const IRON = ["spinach", "palak", "rajma", "chana", "chole", "beetroot", "dates", "jaggery", "gur", "methi", "lentil", "masoor", "soya", "tofu", "egg", "mutton", "liver", "pomegranate"];

/**
 * @param {string} name   food name / DB key
 * @param {object} n      per-serving nutrients { calories, protein, carbs, fats, fiber }
 * @param {Set<string>} active  enforced condition ids
 * @returns {{kind:"watch"|"helps", text:string} | null}
 */
export function foodTag(name, n = {}, active) {
  if (!active || active.size === 0) return null;
  const nm = String(name || "").toLowerCase();
  const carbs = Number(n.carbs) || 0;
  const fats = Number(n.fats) || 0;
  const protein = Number(n.protein) || 0;
  const fiber = Number(n.fiber) || 0;

  // Cautions first — one tag per food, the most relevant one wins.
  if (active.has("renal") && protein >= 25) return { kind: "watch", text: "High protein · kidney markers" };
  if (active.has("glycemic") && (has(nm, SWEET) || (carbs >= 45 && fiber < 4)))
    return { kind: "watch", text: "Watch blood sugar" };
  if (active.has("lipid") && (fats >= 18 || has(nm, FRIED))) return { kind: "watch", text: "Rich in fat · watch cholesterol" };
  if (active.has("hepatic") && (has(nm, FRIED) || has(nm, SWEET))) return { kind: "watch", text: "Go easy · liver" };
  if (active.has("hypertension") && has(nm, SALTY)) return { kind: "watch", text: "Salty · watch blood pressure" };
  if (active.has("purine") && has(nm, PURINE)) return { kind: "watch", text: "High purine · uric acid" };

  // Then the helpful ones.
  if ((active.has("lipid") || active.has("glycemic")) && fiber >= 6)
    return { kind: "helps", text: active.has("lipid") ? "Fibre helps cholesterol" : "Fibre helps blood sugar" };
  if (active.has("anemia") && has(nm, IRON)) return { kind: "helps", text: "Good source of iron" };
  return null;
}

/** Enforced condition ids from the merged conditions list. */
export const activeConditionIds = (conditions) =>
  new Set((conditions || []).filter((c) => c && c.enforced).map((c) => c.id));
