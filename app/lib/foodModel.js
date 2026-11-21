/**
 * app/lib/foodModel.js — one food, many portions.
 *
 * A food: { id, slug, name, family, category, aliases[], basis, kcal, protein,
 *           carbs, fat, fiber, owner_id, source, portions[], legacy_keys[] }
 *   basis "g" / "ml": nutrition per 100 g / 100 ml, portion.amount in g / ml
 *   basis "serving":  nutrition per 1 serving, portion.amount in servings
 *                     (old custom foods whose weight we don't know)
 * A portion: { label: "1 bowl", amount: 200, is_default, legacy_key? }
 *
 * buildCatalog() also produces the FLAT LOOKUP the rest of the app has always
 * used ({ "dal tadka (1 bowl)": { calories, protein, carbs, fats, fiber } }),
 * keyed by every portion ("dal tadka (1 bowl)") AND every old name
 * ("biryani (chicken, 1 bowl)"), so logs, recents, saved meals and Coach keep
 * working unchanged while the UI moves to foods + portions.
 */

const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

/** The name stored on a log: "chicken tikka (4 pcs)" (lower-case, like old keys). */
export const portionKey = (food, portion) => `${String(food.name).toLowerCase()} (${portion.label})`;

export const defaultPortion = (food) =>
  food?.portions?.find((p) => p.is_default) || food?.portions?.[0] || { label: food?.basis === "ml" ? "100 ml" : food?.basis === "serving" ? "1 serving" : "100 g", amount: food?.basis === "serving" ? 1 : 100, is_default: true };

/** Macros for `amount` g / ml / servings of a food, in the app's row shape. */
export function macrosForAmount(food, amount) {
  const f = food.basis === "serving" ? Number(amount) || 0 : (Number(amount) || 0) / 100;
  return {
    calories: Math.round((Number(food.kcal) || 0) * f),
    protein: r1((Number(food.protein) || 0) * f),
    carbs: r1((Number(food.carbs) || 0) * f),
    fats: r1((Number(food.fat) || 0) * f),
    fiber: r1((Number(food.fiber) || 0) * f),
  };
}

export const portionMacros = (food, portion, count = 1) => macrosForAmount(food, (Number(portion?.amount) || 0) * count);

/** Unit word for a food's amounts: "g", "ml" or "serving". */
export const basisUnit = (food) => (food?.basis === "ml" ? "ml" : food?.basis === "serving" ? "serving" : "g");

/** "1 bowl · 200 g" — the portion with its weight, when that adds information. */
export function portionLabel(food, portion) {
  if (!portion) return "";
  if (food.basis === "serving") return portion.label;
  const unit = basisUnit(food);
  const plain = new RegExp(`^\\d+(\\.\\d+)?\\s*${unit}$`, "i");
  return plain.test(portion.label) ? portion.label : `${portion.label} · ${Math.round(portion.amount)} ${unit}`;
}

/** A portion for a typed weight ("150 g"), not one of the food's saved portions. */
export const customPortion = (food, amount) => ({ label: `${Math.round(amount)} ${basisUnit(food) === "serving" ? "serving" : basisUnit(food)}`, amount: Number(amount) || 0, is_default: false, custom: true });

/**
 * Build the catalog from a list of foods (built-ins + the user's own).
 * Later foods win on key clashes, so a user's own food shadows a built-in with
 * the same portion name.
 */
export function buildCatalog(foods) {
  const list = (foods || []).filter((f) => f && f.name && f.status !== "hidden" && f.status !== "merged");
  const byId = new Map();
  const lookup = new Map(); // key → { food, portion }
  const db = {}; // key → macros (the flat, legacy-shaped lookup)
  const defaults = {}; // default key → macros (one per food: listing / planning)
  const categoryOf = {}; // default key → category

  const put = (key, food, portion) => {
    const k = String(key || "").toLowerCase().trim();
    if (!k) return;
    lookup.set(k, { food, portion });
    db[k] = { ...portionMacros(food, portion), food_id: food.id, portion: portion.label, amount: portion.amount };
  };

  for (const food of list) {
    if (!food.portions?.length) food.portions = [defaultPortion(food)];
    byId.set(food.id, food);
    for (const p of food.portions) {
      put(portionKey(food, p), food, p);
      if (p.legacy_key) put(p.legacy_key, food, p);
    }
    // Old names without their own portion (merged custom foods) → default portion.
    const dp = defaultPortion(food);
    for (const k of food.legacy_keys || []) if (!lookup.has(String(k).toLowerCase())) put(k, food, dp);
    const dk = portionKey(food, dp);
    defaults[dk] = db[dk];
    if (food.category) categoryOf[dk] = food.category;
  }

  // Merged duplicates: their old names resolve to the food they were merged into.
  for (const m of (foods || []).filter((f) => f?.status === "merged" && f.merged_into)) {
    const target = byId.get(m.merged_into);
    if (!target) continue;
    const dp = defaultPortion(target);
    for (const k of [...(m.legacy_keys || []), String(m.name || "").toLowerCase()]) if (k && !lookup.has(String(k).toLowerCase())) put(k, target, dp);
  }

  const categories = [...new Set(list.filter((f) => !f.owner_id && f.category).map((f) => f.category))];
  const byName = new Map(); // lower-case name → food (your own food wins)
  for (const f of list) if (!byName.has(f.name.toLowerCase()) || f.owner_id) byName.set(f.name.toLowerCase(), f);
  const catalog = { all: foods || [], foods: list, byId, byName, lookup, db, defaults, categoryOf, categories };
  // Lets code that only has the flat lookup (voiceLog.matchFood) reach the
  // catalog's search. Non-enumerable, so iterating the lookup is unchanged.
  Object.defineProperty(db, "__catalog", { value: catalog, enumerable: false });
  return catalog;
}

/**
 * { food, portion } for a stored name, or null: any saved portion or old name,
 * or a typed amount of a known food ("paneer (150 g)").
 */
export function resolveName(catalog, name) {
  const key = String(name || "").toLowerCase().trim();
  const hit = catalog?.lookup.get(key);
  if (hit) return hit;
  const m = key.match(/^(.*) \((\d+(?:\.\d+)?) (g|ml|serving)\)$/);
  const food = m && catalog?.byName?.get(m[1]);
  return food && basisUnit(food) === m[3] ? { food, portion: customPortion(food, Number(m[2])) } : null;
}

/**
 * An old custom_foods row → a food. A weight in the name becomes the portion
 * ("grilled paneer (150g)" → per-100 g food with a "150 g" portion); otherwise
 * it is per 1 serving ("dal palak (1 bowl)" → portion "1 bowl").
 */
export function customRowToFood(row) {
  const raw = String(row.name || "").trim();
  const m = raw.match(/^(.*?)\s*\((.*)\)\s*$/);
  let base = (m ? m[1] : raw).trim() || raw;
  let desc = m ? m[2] : "";
  // An amount at the front: "150g grilled chicken breast", "3 boiled eggs", "1 cup low fat curd".
  const lead = base.match(/^(\d+(?:\.\d+)?)\s*(g|gm|gms|grams?|ml|cups?|bowls?|katoris?|glass(?:es)?|plates?|slices?|tbsp|tsp|pcs?|pieces?|nos?)?\s+(.+)$/i);
  let pieces = 0;
  if (lead && lead[3]) {
    base = lead[3].trim();
    const unit = (lead[2] || "").toLowerCase();
    if (!desc) desc = unit && !/^(pcs?|pieces?|nos?)$/.test(unit) ? `${lead[1]} ${unit}` : `${lead[1]} pcs`;
    if (!unit || /^(pcs?|pieces?|nos?)$/.test(unit)) pieces = Number(lead[1]);
  }
  const w = desc.match(/(\d+(?:\.\d+)?)\s*(g|gm|gms|grams?|ml)\b/i);
  const n = { kcal: Number(row.calories) || 0, protein: Number(row.protein) || 0, carbs: Number(row.carbs) || 0, fat: Number(row.fats) || 0, fiber: Number(row.fiber) || 0 };
  const name = base.charAt(0).toUpperCase() + base.slice(1);
  const common = { id: `custom:${row.id}`, custom_id: row.id, name, family: null, category: null, aliases: [], owner_id: row.user_id || "me", source: "user", legacy_keys: [raw.toLowerCase()], status: "active" };
  if (w) {
    const amount = Number(w[1]);
    const basis = /ml/i.test(w[2]) ? "ml" : "g";
    const f = 100 / amount;
    return {
      ...common,
      basis,
      kcal: r1(n.kcal * f), protein: r1(n.protein * f), carbs: r1(n.carbs * f), fat: r1(n.fat * f), fiber: r1(n.fiber * f),
      portions: [{ label: `${amount} ${basis}`, amount, is_default: true, legacy_key: raw.toLowerCase() }, ...(amount !== 100 ? [{ label: `100 ${basis}`, amount: 100, is_default: false }] : [])],
    };
  }
  const pc = desc.match(/^(\d+)\s*(pcs?|pieces?|nos?|eggs?)$/i);
  if (!pieces && pc) pieces = Number(pc[1]);
  const label = desc && /\d/.test(desc) ? desc.replace(/\s+/g, " ").trim() : "1 serving";
  return { ...common, basis: "serving", ...n, pieces: pieces || undefined, portions: [{ label, amount: 1, is_default: true, legacy_key: raw.toLowerCase() }] };
}

/** A foods-table row (+ its portions) → the in-app food shape. */
export const dbRowToFood = (row, portions = []) => ({
  ...row,
  aliases: row.aliases || [],
  legacy_keys: row.legacy_keys || [],
  portions: portions
    .filter((p) => p.food_id === row.id)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((p) => ({ label: p.label, amount: Number(p.amount), is_default: !!p.is_default, legacy_key: p.legacy_key || undefined })),
});

/** A seed entry (app/data/foods-seed.json) → the in-app food shape. */
export const seedToFood = (s) => ({ ...s, id: s.id || `seed:${s.slug}`, owner_id: null, status: "active" });

export const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ""));
