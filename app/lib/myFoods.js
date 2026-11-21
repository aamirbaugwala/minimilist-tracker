/**
 * app/lib/myFoods.js — create a user's own food (browser or server).
 *
 * Writes to the new `foods` + `food_portions` tables (private to the user).
 * Before docs/foods-schema.sql has been run it falls back to the old
 * custom_foods table, encoding the portion in the name the old way
 * ("grilled paneer (150 g)") so nothing is lost and it migrates cleanly later.
 *
 * Callers do the duplicate check first (foodSearch.similarFoods / matchOne).
 */

import { customRowToFood, dbRowToFood, defaultPortion, portionMacros } from "./foodModel";

const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const isMissingTable = (error) => !!error && (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache|Could not find the table/i.test(error.message || ""));

/**
 * A food spec from the form or a picked item.
 *   per: macros for ONE portion { calories, protein, carbs, fats, fiber }
 *   portionLabel: "1 bowl" (optional), grams: weight of that portion (optional)
 *   per100: true when `per` is already per 100 g / ml (web results)
 */
export function specFrom({ name, per, portionLabel, grams, per100 = false, basis: basisIn, source = "user", barcode = null }) {
  const n = { kcal: Number(per?.calories) || 0, protein: Number(per?.protein) || 0, carbs: Number(per?.carbs) || 0, fat: Number(per?.fats) || 0, fiber: Number(per?.fiber) || 0 };
  const clean = String(name || "").trim();
  const g = Number(grams) || 0;
  const basis = basisIn || "g";
  if (per100) {
    const portions = [{ label: `100 ${basis}`, amount: 100, is_default: !g }];
    if (g && g !== 100) portions.unshift({ label: portionLabel || `${g} ${basis}`, amount: g, is_default: true });
    return { name: clean, basis, ...n, portions, source, barcode };
  }
  if (g > 0) {
    const f = 100 / g;
    const portions = [{ label: portionLabel || `${g} ${basis}`, amount: g, is_default: true }];
    if (g !== 100) portions.push({ label: `100 ${basis}`, amount: 100, is_default: false });
    return { name: clean, basis, kcal: r1(n.kcal * f), protein: r1(n.protein * f), carbs: r1(n.carbs * f), fat: r1(n.fat * f), fiber: r1(n.fiber * f), portions, source, barcode };
  }
  return { name: clean, basis: "serving", ...n, portions: [{ label: portionLabel || "1 serving", amount: 1, is_default: true }], source, barcode };
}

/** An item named the old way ("Oats (100g)", "Brand bar (30 g)") → a spec. */
export function specFromNamedItem(item, source = "user") {
  const f = customRowToFood({ id: "x", name: item.name, calories: item.calories, protein: item.protein, carbs: item.carbs, fats: item.fats, fiber: item.fiber });
  return { name: f.name, basis: f.basis, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber, portions: f.portions.map(({ label, amount, is_default }) => ({ label, amount, is_default })), source, barcode: item.barcode || null };
}

/** Save a spec as the user's food. → { ok, food, error } */
export async function createMyFood(db, userId, spec) {
  if (!userId || !spec?.name) return { ok: false, error: "Missing name." };
  const row = {
    name: spec.name.charAt(0).toUpperCase() + spec.name.slice(1),
    basis: spec.basis,
    kcal: spec.kcal, protein: spec.protein, carbs: spec.carbs, fat: spec.fat, fiber: spec.fiber,
    owner_id: userId,
    source: spec.source || "user",
    barcode: spec.barcode || null,
    aliases: spec.aliases || [],
    legacy_keys: spec.legacy_keys || [],
  };
  const { data, error } = await db.from("foods").insert(row).select().single();
  if (!error && data) {
    const portions = (spec.portions || []).map((p, i) => ({ food_id: data.id, label: p.label, amount: p.amount, is_default: !!p.is_default, sort: i }));
    const { data: saved, error: pErr } = portions.length ? await db.from("food_portions").insert(portions).select() : { data: [], error: null };
    if (pErr) console.warn("[foods] portions not saved:", pErr.message);
    return { ok: true, food: dbRowToFood(data, saved || []) };
  }
  if (!isMissingTable(error)) return { ok: false, error: error?.message || "Couldn't save the food." };

  // Old table: one row for the default portion, the portion written into the name.
  const tmp = { ...spec, portions: spec.portions || [] };
  const dp = defaultPortion(tmp);
  const m = portionMacros(tmp, dp);
  const name = spec.basis === "serving" && dp.label === "1 serving" ? row.name.toLowerCase() : `${row.name.toLowerCase()} (${dp.label})`;
  const legacy = { user_id: userId, name, calories: m.calories, protein: m.protein, carbs: m.carbs, fats: m.fats, fiber: m.fiber };
  const { data: old, error: oldErr } = await db.from("custom_foods").insert([legacy]).select().single();
  if (oldErr) return { ok: false, error: oldErr.message };
  return { ok: true, food: customRowToFood(old), legacy: true };
}
