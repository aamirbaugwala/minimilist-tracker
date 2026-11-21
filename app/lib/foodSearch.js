/**
 * app/lib/foodSearch.js — the ONE way foods are found: the food sheet, voice,
 * photo, Coach and the custom-food duplicate check all use this.
 *
 *   searchFoods(catalog, query)  → ranked foods, forgiving (search-as-you-type)
 *   matchOne(catalog, name)      → one { food, portion } or null, PRECISION-FIRST:
 *                                  a wrong match ("water" → watermelon) is worse
 *                                  than none, so loose matches are not used.
 *   similarFoods(catalog, name)  → close matches for "Is it one of these?"
 *
 * Text is normalised the same way on both sides: lower-case, portion words and
 * numbers removed ("1 bowl", "150g", "medium"), plurals singular, and common
 * Hinglish spelling variants folded (aa→a, ee→i, oo→u, w→v, ph→f, doubled
 * letters) so "paneer"/"panir", "rasgulla"/"rasgula", "bhindi"/"bhendi"-ish and
 * "palak dal"/"dal palak" meet.
 */

import { defaultPortion } from "./foodModel";

const UNIT = "(?:g|gm|gms|grams?|kg|ml|l|ltr|litres?|liters?|pcs?|pieces?|nos?|bowls?|katoris?|cups?|plates?|glass(?:es)?|slices?|tbsp|tsp|spoons?|scoops?|servings?|portions?|packs?|packets?)";
const QTY_UNIT = new RegExp(`(?:^|\\s)(?:\\d+(?:\\.\\d+)?|½|¼|¾|half|one|two|three|a|an)\\s*${UNIT}\\b`, "g");
const BARE_UNIT = new RegExp(`\\b${UNIT}\\b`, "g");
const SIZE = /\b(small|medium|large|big|regular|mini|full|whole|fresh|homemade|home made|home style|plain style)\b/g;
const STOP = new Set(["of", "with", "and", "the", "a", "an", "in", "some", "my"]);

const singular = (w) =>
  w.length <= 3 ? w : w.endsWith("ies") ? w.slice(0, -3) + "y" : /(oes|ches|shes|xes)$/.test(w) ? w.slice(0, -2) : w.endsWith("ss") ? w : w.endsWith("s") ? w.slice(0, -1) : w;
const fold = (w) =>
  w.replace(/ph/g, "f").replace(/w/g, "v").replace(/q/g, "k").replace(/z/g, "j")
    .replace(/aa+/g, "a").replace(/ee+/g, "i").replace(/oo+/g, "u").replace(/([bcdfghjklmnprstv])\1+/g, "$1")
    .replace(/h(?=$)/, ""); // "dalh"/"dahl" style trailing h

/** Normalised word list for any food text or query. */
export function tokens(text, { keepSmall = false } = {}) {
  let s = String(text || "").toLowerCase().replace(/&/g, " and ").replace(/[()[\],/+\-_.:;!?'"’]/g, " ");
  s = s.replace(QTY_UNIT, " ").replace(/^\s*\d+(\.\d+)?\s*(x|×)?\s+/, " ").replace(/\b\d+(\.\d+)?\b/g, " ");
  s = s.replace(BARE_UNIT, " ").replace(SIZE, " ");
  return s.split(/\s+/).filter((w) => w && (keepSmall || !STOP.has(w))).map((w) => fold(singular(w)));
}
export const normalize = (text) => tokens(text).join(" ");

/** "150g paneer" → { count: 150, unit: "g" }; "2 rotis" → { count: 2, unit: "" }. */
export function parseAmount(text) {
  const s = String(text || "").toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)\s*(g|gm|gms|grams?|kg|ml|l|ltr)\b/);
  if (m) {
    const n = Number(m[1]);
    const u = m[2];
    if (u === "kg") return { count: n * 1000, unit: "g" };
    if (u === "l" || u === "ltr") return { count: n * 1000, unit: "ml" };
    return { count: n, unit: u.startsWith("m") ? "ml" : "g" };
  }
  const c = s.match(/^\s*(\d+(?:\.\d+)?)\s*(x|×)?\s+/);
  return c ? { count: Number(c[1]), unit: "" } : null;
}

// ── Index ───────────────────────────────────────────────────────────────────
const INDEX = new WeakMap();
function indexOf(catalog) {
  let idx = INDEX.get(catalog);
  if (idx) return idx;
  idx = catalog.foods.map((food, order) => {
    const texts = [food.name, ...(food.aliases || [])];
    const terms = texts
      .map((t, i) => {
        const tk = tokens(t);
        return { norm: tk.join(" "), tokens: tk, alias: i > 0 };
      })
      .filter((t) => t.norm);
    return { food, order, terms, family: food.family ? normalize(food.family) : "" };
  });
  INDEX.set(catalog, idx);
  return idx;
}

const own = (food) => !!food.owner_id;
const tieBreak = (a, b) => b.score - a.score || Number(own(b.food)) - Number(own(a.food)) || a.food.name.length - b.food.name.length || a.order - b.order;

// ── Search (forgiving, for the food sheet) ─────────────────────────────────
function searchScore(q, qt, term) {
  if (!q) return 0;
  if (term.norm === q) return 100;
  if (term.norm.startsWith(q + " ")) return 88;
  if (term.norm.startsWith(q)) return 82; // typing: "tik" → "tikka"
  const last = qt.length - 1;
  const has = (w, i) => term.tokens.some((t) => t === w || (i === last && w.length >= 2 && t.startsWith(w)));
  if (qt.every(has)) return 70 + Math.round((10 * qt.length) / Math.max(qt.length, term.tokens.length));
  if (q.startsWith(term.norm + " ")) return 45; // "dal tadka with rice" → "dal tadka"
  const hits = qt.filter((w, i) => w.length >= 3 && has(w, i)).length;
  if (hits && hits / qt.length >= 0.5) return 20 + Math.round((30 * hits) / qt.length);
  if (q.length >= 3 && term.norm.includes(q)) return 30;
  return 0;
}

export function searchFoods(catalog, query, { limit = 40 } = {}) {
  if (!catalog) return [];
  const qt = tokens(query);
  const q = qt.join(" ");
  if (!q) return [];
  const out = [];
  for (const entry of indexOf(catalog)) {
    let score = 0;
    // Names beat aliases; a typed prefix of an alias ("dal" → "dalimb") ranks well below real names.
    for (const t of entry.terms) {
      const sc = searchScore(q, qt, t);
      score = Math.max(score, t.alias ? sc - (sc === 100 ? 2 : 8) : sc);
    }
    if (entry.family && entry.family === q) score = Math.max(score, 75);
    if (score > 0) out.push({ food: entry.food, score, order: entry.order });
  }
  return out.sort(tieBreak).slice(0, limit);
}

/** Close matches for the duplicate check ("Is it one of these?"). */
export function similarFoods(catalog, name, { limit = 4, minScore = 40 } = {}) {
  return searchFoods(catalog, name, { limit: limit * 3 }).filter((r) => r.score >= minScore).slice(0, limit);
}

// ── Match one (precision-first, for voice / photo / Coach) ─────────────────
// Everyday words that should pick a particular food (by slug).
const DEFAULT_SLUG = {
  tea: "chai-with-sugar", chai: "chai-with-sugar", "milk tea": "chai-with-sugar", "masala chai": "chai-with-sugar", "masala tea": "chai-with-sugar", "cutting chai": "chai-with-sugar",
  rice: "white-rice-cooked", "white rice": "white-rice-cooked", "plain rice": "white-rice-cooked", chaval: "white-rice-cooked",
  milk: "toned-milk", curd: "curd-dahi", dahi: "curd-dahi", yogurt: "curd-dahi", yoghurt: "curd-dahi",
  roti: "chapati", egg: "boiled-egg", anda: "boiled-egg", dal: "dal-tadka", bread: "white-bread",
};
const DEFAULT_NORM = Object.fromEntries(Object.entries(DEFAULT_SLUG).map(([k, v]) => [normalize(k), v]));

export function matchOne(catalog, name) {
  if (!catalog) return null;
  const raw = String(name || "").toLowerCase().trim().replace(/\s+/g, " ");
  if (!raw) return null;
  // 1. an exact stored name, old or new style ("biryani (chicken, 1 bowl)")
  const exact = catalog.lookup.get(raw);
  if (exact) return exact;
  const qt = tokens(raw);
  const q = qt.join(" ");
  if (!q) return null;
  const idx = indexOf(catalog);
  const pick = (entries) => (entries.length ? entries.sort(tieBreak)[0].food : null);
  const withPortion = (food) => (food ? { food, portion: defaultPortion(food) } : null);

  // 2. the user's own foods by exact name first, then everyday defaults
  const ownExact = idx.filter((e) => own(e.food) && e.terms.some((t) => t.norm === q));
  if (ownExact.length) return withPortion(pick(ownExact.map((e) => ({ ...e, score: 1 }))));
  const slug = DEFAULT_NORM[q];
  if (slug) {
    const d = idx.find((e) => e.food.slug === slug);
    if (d) return withPortion(d.food);
  }
  // 3. exact name or alias; a family name ("biryani") → that family's first food
  const eq = idx.filter((e) => e.terms.some((t) => t.norm === q)).map((e) => ({ ...e, score: e.terms[0].norm === q ? 2 : 1 }));
  if (eq.length) return withPortion(pick(eq));
  const fam = idx.filter((e) => e.family && e.family === q);
  if (fam.length) return withPortion(fam.sort((a, b) => a.order - b.order)[0].food);
  // 4. the query is the start of a name, whole words ("paneer" → "paneer tikka"; never "water" → "watermelon")
  const fwd = idx
    .map((e) => ({ ...e, t: e.terms.find((t) => (t.norm + " ").startsWith(q + " ")) }))
    .filter((e) => e.t)
    .map((e) => ({ ...e, score: -e.t.norm.length }));
  if (fwd.length) return withPortion(pick(fwd));
  // 5. two or more words, all present in one name ("dal palak" → "Palak dal"; "masala dosa" ≠ "bhindi masala")
  const words = qt.filter((w) => w.length > 2);
  if (words.length >= 2) {
    const all = idx
      .map((e) => ({ ...e, t: e.terms.find((t) => words.every((w) => t.tokens.includes(w))) }))
      .filter((e) => e.t)
      .map((e) => ({ ...e, score: -e.t.norm.length }));
    if (all.length) return withPortion(pick(all));
  }
  // 6. a longer phrase that starts with a specific (2+ word) name ("paneer tikka masala" → "Paneer tikka")
  const rev = idx
    .map((e) => ({ ...e, t: e.terms.find((t) => t.tokens.length >= 2 && (q + " ").startsWith(t.norm + " ")) }))
    .filter((e) => e.t)
    .map((e) => ({ ...e, score: e.t.norm.length }));
  if (rev.length) return withPortion(pick(rev));
  return null;
}
