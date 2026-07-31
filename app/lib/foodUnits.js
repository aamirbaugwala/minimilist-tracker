/**
 * app/lib/foodUnits.js
 *
 * A non-destructive standardization layer over the food database. Every DB key
 * carries its serving inside the name — "almonds (10 pcs)", "dal fry (1 bowl)",
 * "rice (brown, cooked 100g)". The macros are per that whole serving.
 *
 * The problem: a spoken "5 almonds" was logged as 5 × the 10-piece serving = 50.
 * The fix: parse each serving into a canonical { count, unit }, then interpret a
 * spoken quantity in the food's NATURAL unit:
 *   - "5 almonds"      → 5 pieces of a 10-piece serving  → 0.5 servings
 *   - "2 rotis"        → 2 pieces of a 1-piece serving   → 2 servings
 *   - "a bowl of dal"  → 1 bowl                          → 1 serving
 *   - "100 g chicken"  → 100 g of a 100 g serving        → 1 serving
 *
 * Tap-to-log is unaffected — a tap is always one serving.
 */

const UNIT_ALIASES = {
  pc: "pc", pcs: "pc", piece: "pc", pieces: "pc",
  half: "pc", halves: "pc", clove: "pc", cloves: "pc", // walnuts "5 halves", garlic "5 cloves"
  g: "g", gm: "g", gram: "g", grams: "g",
  ml: "ml", milliliter: "ml", millilitre: "ml",
  bowl: "bowl", bowls: "bowl",
  cup: "cup", cups: "cup",
  plate: "plate", plates: "plate",
  slice: "slice", slices: "slice",
  glass: "glass", glasses: "glass",
  tbsp: "tbsp", tablespoon: "tbsp",
  tsp: "tsp", teaspoon: "tsp",
  scoop: "scoop", scoops: "scoop",
  cube: "cube", cubes: "cube",
  // Serving-style words map to "serving" (NOT "pc") so quantity is read as whole
  // servings — "a handful of almonds" = 1 serving (~10), not 1 almond.
  handful: "serving", handfuls: "serving",
  serving: "serving", servings: "serving", portion: "serving", portions: "serving",
};

export function canonicalUnit(u) {
  const k = String(u || "").toLowerCase().trim().replace(/\.$/, "");
  return UNIT_ALIASES[k] || UNIT_ALIASES[k.replace(/s$/, "")] || "";
}

// Units where a spoken bare number means individual COUNTABLE items (5 almonds),
// vs. serving-style units (1 bowl) where a bare number means whole servings.
const COUNTABLE = new Set(["pc"]);
const WEIGHT = new Set(["g", "ml"]);

/**
 * Parse the serving out of a DB key's descriptor.
 * "almonds (10 pcs)"            → { count: 10, unit: "pc",   label: "10 pcs" }
 * "rice (brown, cooked 100g)"   → { count: 100, unit: "g",   label: "100g" }
 * "dal fry (1 bowl)"            → { count: 1,  unit: "bowl", label: "1 bowl" }
 * no parseable serving          → { count: 1,  unit: "serving", label: "1 serving" }
 */
export function parseServing(key) {
  const m = String(key || "").match(/\(([^)]*)\)/);
  const desc = m ? m[1] : "";
  const cu = desc.match(
    /(\d+(?:\.\d+)?)\s*(g|gm|grams?|ml|pcs?|pieces?|halves|half|cloves?|bowls?|cups?|plates?|slices?|glass(?:es)?|tbsp|tablespoons?|tsp|teaspoons?|scoops?|cubes?)/i,
  );
  if (cu) {
    return {
      count: Number(cu[1]) || 1,
      unit: canonicalUnit(cu[2]) || "serving",
      label: `${cu[1]} ${cu[2]}`.trim(),
    };
  }
  return { count: 1, unit: "serving", label: "1 serving" };
}

/**
 * Resolve a spoken { quantity, unit } for a matched food key into:
 *   - servings: multiplier for the DB's per-serving macros (the source of truth)
 *   - qty:      the number to STORE/DISPLAY, in the food's natural unit
 *               (pieces for countable multi-packs, else servings)
 *   - unit:     "pc" | "serving" — how to phrase qty
 */
export function resolveQuantity({ quantity, unit, foodKey }) {
  const q = Number(quantity) > 0 ? Number(quantity) : 1;
  const s = parseServing(foodKey);
  const uu = canonicalUnit(unit);

  // "5 almonds" — individual pieces of a multi-piece serving.
  if (COUNTABLE.has(s.unit) && s.count > 1 && (uu === "" || uu === "pc")) {
    return { servings: q / s.count, qty: q, unit: "pc" };
  }
  // "100 g chicken" — an explicit weight against a weight-based serving.
  if (WEIGHT.has(s.unit) && WEIGHT.has(uu)) {
    const servings = q / s.count;
    return { servings, qty: servings, unit: "serving" };
  }
  // Everything else: the number is whole servings ("2 rotis", "a bowl of dal").
  return { servings: q, qty: q, unit: "serving" };
}
