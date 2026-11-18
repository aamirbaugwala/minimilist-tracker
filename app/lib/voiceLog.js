/**
 * app/lib/voiceLog.js
 *
 * Pure, deterministic helpers for voice food-logging. The LLM's ONLY job is to
 * turn a spoken sentence into a structured list of { name, quantity, unit };
 * everything after that — matching to the food DB, de-duplicating, computing
 * macros, and phrasing the confirmation — happens here in plain code so it is
 * testable and can never "hallucinate a double-log" or silently log nothing.
 */

import { resolveQuantity } from "./foodUnits";

// Base food name without the serving descriptor: "roti (chapati, 1 pc)" → "roti"
export function baseName(key) {
  return String(key || "").split("(")[0].trim();
}

const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
// Macros multiplier (in DB servings). Wider floor than clampQty so a single
// almond (0.1 of a 10-pc serving) isn't rounded up to a quarter-serving.
const clampServings = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return 1;
  return Math.max(0.02, Math.min(x, 30));
};

// Servings are clamped to a sane range so a mis-heard "twenty" can't nuke a day.
export function clampQty(q) {
  const n = Number(q);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(0.25, Math.min(n, 20));
}

const singularize = (w) => w.replace(/(ies|es|s)$/, (s) => (s === "ies" ? "y" : ""));
// Word set of a full key incl. the parenthetical descriptor: "biryani (veg, 1
// plate)" → {biryani, veg, 1, plate}. Lets "veg biryani" match it.
const keyWords = (k) =>
  new Set(String(k).toLowerCase().replace(/[(),]/g, " ").split(/\s+/).filter(Boolean));

/**
 * Match a spoken food name to a DB key — PRECISION-FIRST. A wrong match ("water"
 * → "watermelon", "masala dosa" → "bhindi masala") is worse than no match, so
 * loose substring/single-shared-word matching is deliberately NOT used. Anything
 * that doesn't match cleanly returns null and is reported to the user instead.
 */
// Everyday words whose default entry would otherwise be picked by DB order
// ("milk" → chocolate milk, "rice" → brown rice, "tea" → iced tea). Values are
// full keys; an alias is only used when that key exists.
const DEFAULT_FOR = {
  tea: "chai (with sugar, 1 cup)",
  "milk tea": "chai (with sugar, 1 cup)",
  "masala chai": "chai (with sugar, 1 cup)",
  "masala tea": "chai (with sugar, 1 cup)",
  "cutting chai": "chai (with sugar, 1 cup)",
  rice: "rice (white, cooked 100g)",
  "white rice": "rice (white, cooked 100g)",
  "plain rice": "rice (white, cooked 100g)",
  milk: "milk (toned, 200ml)",
  curd: "curd / yogurt (100g)",
  dahi: "curd / yogurt (100g)",
  yogurt: "curd / yogurt (100g)",
  yoghurt: "curd / yogurt (100g)",
};
// Too ambiguous to guess (hot vs cold, with or without milk): report unmatched.
const AMBIGUOUS = new Set(["coffee"]);

export function matchFood(name, db) {
  const n = String(name || "").toLowerCase().trim().replace(/\s+/g, " ");
  if (!n || !db) return null;
  const keys = Object.keys(db);
  const base = (k) => baseName(k).toLowerCase();

  // 1. exact key (covers custom foods stored under their plain name)
  if (db[n]) return n;
  // 1b. everyday defaults / deliberately ambiguous words
  if (DEFAULT_FOR[n] && db[DEFAULT_FOR[n]]) return DEFAULT_FOR[n];
  if (AMBIGUOUS.has(n)) return null;
  // 2. exact base-name match
  let m = keys.find((k) => base(k) === n);
  if (m) return m;
  // 3. singular/plural tolerance ("rotis" → "roti")
  const sing = singularize(n);
  m = keys.find((k) => {
    const b = base(k);
    return b === sing || b === n + "s" || b + "s" === n;
  });
  if (m) return m;
  // 4. WORD-BOUNDARY prefix only: "paneer" → "paneer tikka" (yes),
  //    "water" → "watermelon" (no — not a whole leading word). Shortest base wins.
  const pre = keys.filter((k) => {
    const b = base(k);
    return (b + " ").startsWith(n + " ") || (n + " ").startsWith(b + " ");
  });
  if (pre.length) return pre.sort((a, b) => base(a).length - base(b).length)[0];
  // 5. EVERY significant spoken word must appear as a word in the key (incl. the
  //    descriptor). "veg biryani" → "biryani (veg,…)" yes; "masala dosa" →
  //    "bhindi masala" no (no "dosa"); "water" → "watermelon" no.
  const nWords = n.split(" ").filter((w) => w.length > 2);
  if (nWords.length) {
    const cands = keys.filter((k) => {
      const kw = keyWords(k);
      return nWords.every((w) => kw.has(w) || kw.has(singularize(w)) || kw.has(w + "s"));
    });
    if (cands.length) return cands.sort((a, b) => base(a).length - base(b).length)[0];
  }
  return null;
}

// Spoken references to plain water → the app's hydration entry, not a food.
export const isWaterPhrase = (name) =>
  /^(a |one )?(glass(es)?|cup(s)?|bottle(s)?)?\s*(of\s+)?water$/i.test(String(name || "").trim());

// Water rows count GLASSES (250 ml). Convert a spoken amount into glasses so
// "500 ml of water" is 2 glasses (not 500) and "1 litre" is 4 (not 1).
export const GLASS_ML = 250;
export function waterGlasses(quantity, unit, name = "") {
  const q = Number(quantity) > 0 ? Number(quantity) : 1;
  const u = `${unit || ""} ${name || ""}`.toLowerCase();
  if (/\b(ml|millilit(?:re|er)s?)\b/.test(u)) return q / GLASS_ML;
  if (/\b(l|ltrs?|lit(?:re|er)s?)\b/.test(u)) return (q * 1000) / GLASS_ML;
  if (/\bbottles?\b/.test(u)) return (q * 1000) / GLASS_ML; // a 1 L bottle
  return q; // glasses / cups / bare count
}

/**
 * Turn extracted { name, quantity } items into food_logs rows.
 * - Matches each to the DB; unmatched names are reported, never invented.
 * - CONSOLIDATES by matched key (summing quantity) so a model that repeats an
 *   item — or two phrasings that resolve to the same food — produce ONE row.
 * Returns { rows, matched, unmatched }.
 */
export function buildLogRows(items, db, { userId, meal, date, createdAt } = {}) {
  // "meal|key" -> { key, meal, qty (natural display count), servings (macros multiplier) }
  // Items can carry their own meal ("eggs for breakfast and dal for lunch").
  const MEAL_OK = ["Breakfast", "Lunch", "Snacks", "Dinner"];
  const mealOf = (it) => (MEAL_OK.includes(it?.meal) ? it.meal : meal);
  const byKey = new Map();
  const unmatched = [];
  let waterQty = 0; // hydration, tracked separately from food

  for (const it of Array.isArray(items) ? items : []) {
    const name = (it?.name || "").trim();
    if (!name) continue;
    if (isWaterPhrase(name)) {
      waterQty += waterGlasses(it?.quantity, it?.unit, name);
      continue;
    }
    const key = matchFood(name, db);
    if (!key) {
      if (!unmatched.some((u) => u.toLowerCase() === name.toLowerCase())) unmatched.push(name);
      continue;
    }
    // Interpret the spoken quantity in the food's natural unit (foodUnits.js):
    // "5 almonds" → 0.5 servings but qty 5; "2 rotis" → 2 servings, qty 2.
    const { qty, servings } = resolveQuantity({ quantity: it?.quantity, unit: it?.unit, foodKey: key });
    const itemMeal = mealOf(it);
    const slot = `${itemMeal}|${key}`;
    const prev = byKey.get(slot) || { key, meal: itemMeal, qty: 0, servings: 0 };
    byKey.set(slot, { ...prev, qty: prev.qty + qty, servings: prev.servings + servings });
  }

  const rows = [];
  const matched = [];

  // Hydration: the app stores water as a "Water" row measured in glasses.
  if (waterQty > 0) {
    const qty = Math.min(20, Math.max(1, Math.round(waterQty))); // glasses, sane cap
    const row = { user_id: userId, name: "Water", qty, calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, meal, date, created_at: createdAt };
    Object.keys(row).forEach((k) => row[k] === undefined && delete row[k]);
    rows.push(row);
    matched.push({ name: "Water", qty, calories: 0, protein: 0 });
  }

  for (const { key, meal: itemMeal, ...agg } of byKey.values()) {
    const servings = clampServings(agg.servings); // scales the per-serving macros
    const qty = Math.round(agg.qty * 100) / 100; // shown in the natural unit
    const item = db[key] || {};
    // Store the clean base name ("almonds", not "almonds (10 pcs)") so the log
    // reads "5× Almonds" rather than "5× the 10-piece serving".
    const displayName = baseName(key) || key;
    const row = {
      user_id: userId,
      name: displayName,
      qty,
      calories: Math.round((item.calories || 0) * servings),
      protein: r1((item.protein || 0) * servings),
      carbs: r1((item.carbs || 0) * servings),
      fats: r1((item.fats || 0) * servings),
      fiber: r1((item.fiber || 0) * servings),
      meal: itemMeal,
      date,
      created_at: createdAt,
    };
    // Drop undefined optional fields so callers can omit meta.
    Object.keys(row).forEach((k) => row[k] === undefined && delete row[k]);
    rows.push(row);
    matched.push({ name: displayName, qty, calories: row.calories, protein: row.protein, meal: itemMeal });
  }

  return { rows, matched, unmatched };
}

// "a", "a and b", "a, b and c"
export function listJoin(names) {
  const arr = names.filter(Boolean);
  if (arr.length === 0) return "";
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;
}

/** Deterministic spoken confirmation — no LLM, so it always matches what was saved. */
export function buildSpokenConfirmation(matched, unmatched) {
  const parts = [];
  if (matched.length) {
    const names = matched.map((m) => {
      if (m.name === "Water") return `${m.qty} ${m.qty === 1 ? "glass" : "glasses"} of water`;
      const b = baseName(m.name);
      return m.qty && m.qty !== 1 ? `${+m.qty.toFixed(2)} ${b}` : b;
    });
    const cals = matched.reduce((s, m) => s + (m.calories || 0), 0);
    const hasFood = matched.some((m) => m.name !== "Water");
    parts.push(hasFood ? `Logged ${listJoin(names)} — about ${cals} calories.` : `Logged ${listJoin(names)}.`);
  }
  if (unmatched.length) {
    const which = unmatched.length > 1 ? "those" : "that";
    parts.push(
      `I couldn't find ${listJoin(unmatched)} in the database, so ${which} ${
        unmatched.length > 1 ? "weren't" : "wasn't"
      } logged — add ${unmatched.length > 1 ? "them" : "it"} manually.`,
    );
  }
  if (!parts.length) {
    return "I didn't catch anything to log. Try again — for example: “I ate two rotis and a bowl of dal.”";
  }
  return parts.join(" ");
}
