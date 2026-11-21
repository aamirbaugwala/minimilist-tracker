/**
 * Build the food catalog seed from app/food-data.js.
 *
 *   node scripts/food-seed/build.mjs
 *
 * Writes:
 *   app/data/foods-seed.json   foods with per-100 g nutrition, portions, aliases, legacy keys
 *   docs/food-gram-weights.csv every estimated gram weight, for review
 *
 * Each old key ("biryani (chicken, 1 bowl)") becomes one food ("Chicken biryani")
 * plus a portion ("1 bowl", 250 g). Old keys are kept as legacy_keys so logs,
 * recents and saved meals still resolve, and their default-portion calories
 * stay exactly what they were.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GRAMS } from "./grams.mjs";
import { NAME, PORTION_WORDS, ALIASES, EXTRA_PORTIONS } from "./names.mjs";
import { EXTRAS } from "./extras.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = fs.readFileSync(path.join(root, "app/food-data.js"), "utf8");
const { FOOD_CATEGORIES } = await import("data:text/javascript," + encodeURIComponent(src));

const r = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const slugify = (s) => s.toLowerCase().replace(/&/g, "and").replace(/%/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const QTY = /^(cooked\s+)?(\d+(?:\.\d+)?)\s*(g|ml|pcs?|pc|bowl|plate|glass|cup(?: cubes)?|slice|tbsp|serving|scoop|pack|eggs|halves|cloves|inch)$/i;
const BEVERAGE_CUP = new Set(["Beverages"]);

function parse(key, category) {
  const m = key.match(/^(.*?)\s*\((.*)\)\s*$/);
  const base = (m ? m[1] : key).trim();
  const parts = m ? m[2].split(",").map((s) => s.trim()).filter(Boolean) : [];
  let qty = null;
  let cooked = false;
  if (parts.length && QTY.test(parts.at(-1))) {
    const q = parts.pop().match(QTY);
    cooked = !!q[1];
    qty = { count: Number(q[2]), unit: q[3].toLowerCase() };
  }
  let portionWord = null;
  const variant = parts.filter((p) => {
    if (PORTION_WORDS[p.toLowerCase()]) {
      portionWord = p.toLowerCase();
      return false;
    }
    return true;
  });
  if (cooked) variant.push("cooked");
  // basis + grams
  let basis = "g";
  let grams = null;
  let method = "estimate";
  if (qty && (qty.unit === "g" || qty.unit === "ml")) {
    grams = qty.count;
    basis = qty.unit === "ml" ? "ml" : "g";
    method = "from name";
  } else if (qty && (qty.unit === "glass" || (qty.unit === "cup" && BEVERAGE_CUP.has(category)))) {
    basis = "ml";
  }
  const est = GRAMS[key];
  if (grams == null) {
    if (!est) throw new Error(`No gram weight for "${key}"`);
    grams = est[0];
  }
  const confidence = method === "from name" ? "high" : est?.[1] || "medium";
  // portion label
  let label;
  if (portionWord) {
    label = PORTION_WORDS[portionWord];
    if (portionWord === "half" && /avocado/.test(base)) label = "½ avocado";
  } else if (!qty) label = "1 serving";
  else if (qty.unit === "g" || qty.unit === "ml") label = `${qty.count} ${qty.unit}`;
  else if (qty.unit === "cup cubes") label = `${qty.count} cup`;
  else if (qty.unit === "pcs" || qty.unit === "pc") label = `${qty.count} ${qty.count === 1 ? "pc" : "pcs"}`;
  else label = `${qty.count} ${qty.unit}`;
  return { base, variant, label, grams, basis, confidence, method, qty, portionWord };
}

function composeName(key, base, variant) {
  if (NAME[key]) return NAME[key];
  const names = base.split("/").map((s) => s.trim());
  const b = names[0];
  if (!variant.length) return cap(names.length > 1 ? `${b} (${names.slice(1).join(", ")})` : b);
  const after = variant.filter((v) => /^(with|without|no)\b/.test(v) || v === "cooked");
  const before = variant.filter((v) => !after.includes(v));
  return cap([before.join(" "), b].filter(Boolean).join(" ") + (after.length ? `, ${after.join(", ")}` : ""));
}

// ── Group legacy keys into foods ─────────────────────────────────────────────
const foods = new Map(); // identity → food
const baseVariants = {}; // base → Set(identity)
const csv = [["slug", "name", "portion", "grams_or_ml", "basis", "confidence", "method", "legacy_key", "kcal_per_portion", "kcal_per_100"]];

for (const [category, items] of Object.entries(FOOD_CATEGORIES)) {
  for (const [key, v] of Object.entries(items)) {
    const p = parse(key, category);
    const name = composeName(key, p.base, p.variant);
    const identity = name.toLowerCase();
    (baseVariants[p.base.split("/")[0].trim()] ||= new Set()).add(identity);
    let food = foods.get(identity);
    if (!food) {
      food = { name, category, base: p.base.split("/")[0].trim(), basis: p.basis, aliases: new Set(), legacy_keys: [], portions: [], _defaultSource: null };
      foods.set(identity, food);
    }
    p.base.split("/").slice(1).forEach((a) => food.aliases.add(a.trim()));
    food.legacy_keys.push(key);
    // The first non-cut portion (not slice/wedge/cube/spoon) is the default and sets per-100 values.
    const isCut = ["slice", "wedge", "cube", "spoon"].includes(p.portionWord);
    if (!food._defaultSource || (food._defaultSource.isCut && !isCut)) {
      food._defaultSource = { v, grams: p.grams, isCut, label: p.label };
      food.basis = p.basis;
    }
    if (!food.portions.some((x) => x.label === p.label)) food.portions.push({ label: p.label, grams: p.grams, legacy: key, confidence: p.confidence, method: p.method, kcal: v.calories });
  }
}

const out = [];
for (const food of foods.values()) {
  const d = food._defaultSource;
  const f = 100 / d.grams;
  const slug = slugify(food.name);
  const per = { kcal: r(d.v.calories * f), protein: r(d.v.protein * f), carbs: r(d.v.carbs * f), fat: r(d.v.fats * f), fiber: r((d.v.fiber || 0) * f) };
  // amount = grams for g foods, ml for ml foods (the portion's weight or volume).
  // A second old serving of the same food ("apple (slice)") gets its weight from
  // its old calories, so every old name keeps exactly the calories it had.
  for (const p of food.portions) {
    if (p.label !== d.label && per.kcal > 0 && p.kcal > 0) {
      p.grams = r((p.kcal * 100) / per.kcal);
      p.method = "from old calories";
    }
  }
  const portions = food.portions.map((p) => ({ label: p.label, amount: p.grams, is_default: p.label === d.label, legacy_key: p.legacy }));
  // Helpful extra portions: "1 pc" for multi-piece servings, and 100 g / 100 ml.
  for (const p of food.portions) {
    const m = p.label.match(/^(\d+) (pcs|halves|eggs)$/);
    if (m && Number(m[1]) > 1 && !portions.some((x) => x.label === "1 pc")) portions.push({ label: "1 pc", amount: r(p.grams / Number(m[1])), is_default: false });
  }
  for (const [label, amount] of EXTRA_PORTIONS[slug] || []) if (!portions.some((x) => x.label === label)) portions.push({ label, amount, is_default: false });
  const hundred = food.basis === "ml" ? "100 ml" : "100 g";
  if (!portions.some((x) => x.label === hundred)) portions.push({ label: hundred, amount: 100, is_default: false });
  const family = baseVariants[food.base]?.size > 1 ? cap(food.base) : null;
  const aliases = [...new Set([...food.aliases, ...(ALIASES[slug] || [])])].filter((a) => a.toLowerCase() !== food.name.toLowerCase());
  out.push({ slug, name: food.name, family, category: food.category, aliases, basis: food.basis, ...per, portions, legacy_keys: food.legacy_keys, source: "builtin", verified: false });
  for (const p of food.portions) csv.push([slug, food.name, p.label, p.grams, food.basis, p.confidence, p.method, p.legacy, p.kcal, r((p.kcal * 100) / p.grams, 0)]);
}

for (const x of EXTRAS) {
  const slug = slugify(x.name);
  if (out.some((f) => f.slug === slug)) throw new Error(`Duplicate extra ${slug}`);
  const [kcal, protein, carbs, fat, fiber] = x.n;
  const basis = x.basis || "g";
  const portions = x.portions.map(([label, grams], i) => ({ label, amount: grams, is_default: i === 0 }));
  const hundred = basis === "ml" ? "100 ml" : "100 g";
  if (!portions.some((p) => p.label === hundred)) portions.push({ label: hundred, amount: 100, is_default: false });
  out.push({ slug, name: x.name, family: null, category: x.category, aliases: [...new Set([...(x.aliases || []), ...(ALIASES[slug] || [])])], basis, kcal, protein, carbs, fat, fiber, portions, legacy_keys: [], source: "builtin", verified: false });
  for (const [label, grams] of x.portions) csv.push([slug, x.name, label, grams, basis, x.confidence || "medium", "new food", "", r((kcal * grams) / 100, 0), kcal]);
}

// ── Checks ───────────────────────────────────────────────────────────────────
const slugs = new Set();
for (const f of out) {
  if (slugs.has(f.slug)) throw new Error(`Duplicate slug ${f.slug}`);
  slugs.add(f.slug);
  if (f.portions.filter((p) => p.is_default).length !== 1) throw new Error(`Default portion count for ${f.slug}`);
}
const allLegacy = out.flatMap((f) => f.legacy_keys);
const totalKeys = Object.values(FOOD_CATEGORIES).reduce((n, c) => n + Object.keys(c).length, 0);
if (allLegacy.length !== totalKeys) throw new Error(`Legacy keys ${allLegacy.length} ≠ ${totalKeys}`);

const version = new Date().toISOString().slice(0, 10) + "-" + out.length;
fs.writeFileSync(path.join(root, "app/data/foods-seed.json"), JSON.stringify({ version, foods: out }) + "\n");
const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
fs.writeFileSync(path.join(root, "docs/food-gram-weights.csv"), csv.map((row) => row.map(esc).join(",")).join("\n") + "\n");
console.log(`foods ${out.length} (from ${totalKeys} old keys + ${EXTRAS.length} new) · portions ${out.reduce((n, f) => n + f.portions.length, 0)} · families ${new Set(out.map((f) => f.family).filter(Boolean)).size} · version ${version}`);
