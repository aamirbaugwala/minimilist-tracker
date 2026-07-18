/**
 * app/lib/biomarkers.js
 *
 * Canonical biomarker registry — the single source of truth for "are these two
 * rows the same analyte?" and "which panel does it belong to?".
 *
 * ─── The problem ─────────────────────────────────────────────────────────────
 * Different labs name the same analyte differently. One report says "HbA1c",
 * the next says "Glycosylated Hemoglobin (HbA1c)", a third says "Serum Total
 * Iron Binding Capacity (TIBC)" where another wrote "TOTAL IRON BINDING
 * CAPACITY (TIBC)". Keyed on the raw string, each variant becomes its own
 * series, so a marker with four readings looks like four markers with one
 * reading each and no trend is ever shown.
 *
 * ─── The approach ────────────────────────────────────────────────────────────
 * Resolution is EXACT-MATCH ONLY against a curated alias table, tried in order:
 *
 *   1. the whole normalised name            "hba1c"
 *   2. any parenthesised abbreviation       "Glycosylated Hemoglobin (HbA1c)" -> "hba1c"
 *   3. the name with parentheses stripped   "Vitamin D (25-OH)" -> "vitamin d"
 *
 * Step 2 is what does the heavy lifting: labs almost always put the canonical
 * abbreviation in parentheses.
 *
 * Substring matching is deliberately NOT used. "cholesterol" is a substring of
 * "hdl cholesterol", "ldl cholesterol" and "non-hdl cholesterol" — fuzzy
 * matching would silently fuse three different analytes into one bogus trend
 * line. On medical data, under-merging is a cosmetic annoyance; over-merging
 * invents clinical history that does not exist. We always prefer the former.
 *
 * Unrecognised markers are kept as their own series in the "other" panel rather
 * than being dropped, so nothing disappears from the user's reports.
 */

// ─── PANELS ──────────────────────────────────────────────────────────────────
export const PANELS = {
  metabolic:    { id: "metabolic",    label: "Diabetes & Metabolic", color: "#f59e0b", order: 1 },
  lipid:        { id: "lipid",        label: "Lipid Profile",        color: "#ef4444", order: 2 },
  liver:        { id: "liver",        label: "Liver",                color: "#a855f7", order: 3 },
  kidney:       { id: "kidney",       label: "Kidney",               color: "#3b82f6", order: 4 },
  electrolyte:  { id: "electrolyte",  label: "Electrolytes",         color: "#06b6d4", order: 5 },
  thyroid:      { id: "thyroid",      label: "Thyroid",              color: "#14b8a6", order: 6 },
  blood:        { id: "blood",        label: "Blood Count",          color: "#ec4899", order: 7 },
  iron:         { id: "iron",         label: "Iron Studies",         color: "#f97316", order: 8 },
  vitamin:      { id: "vitamin",      label: "Vitamins",             color: "#eab308", order: 9 },
  inflammation: { id: "inflammation", label: "Inflammation & Heart", color: "#f43f5e", order: 10 },
  other:        { id: "other",        label: "Other Markers",        color: "#71717a", order: 99 },
};

export const PANEL_ORDER = Object.values(PANELS).sort((a, b) => a.order - b.order);

/**
 * Canonical markers. `aliases` are matched after normalisation (lowercased,
 * non-alphanumerics stripped), so "SGPT (ALT)" and "sgpt/alt" both reduce here.
 * Every distinct analyte gets its own entry — note total vs direct bilirubin,
 * and each lipid fraction, are separate on purpose.
 */
export const MARKERS = [
  // ── Diabetes & metabolic ──────────────────────────────────────────────────
  { id: "hba1c", label: "HbA1c", panel: "metabolic", aliases: ["hba1c", "hb a1c", "a1c", "glycosylated hemoglobin", "glycosylated haemoglobin", "glycated hemoglobin", "glycated haemoglobin", "hemoglobin a1c", "haemoglobin a1c", "glycohemoglobin", "glycohaemoglobin"] },
  { id: "glucose_fasting", label: "Fasting Glucose", panel: "metabolic", aliases: ["fasting glucose", "fasting blood sugar", "fbs", "fasting plasma glucose", "fpg", "glucose fasting", "blood sugar fasting", "sugar fasting", "plasma glucose fasting"] },
  { id: "glucose_pp", label: "Post-Prandial Glucose", panel: "metabolic", aliases: ["post prandial glucose", "postprandial glucose", "post prandial blood sugar", "ppbs", "pp2bs", "glucose post prandial", "blood sugar post prandial", "2 hour postprandial glucose", "glucose pp"] },
  { id: "glucose_random", label: "Random Glucose", panel: "metabolic", aliases: ["random glucose", "random blood sugar", "rbs", "glucose random"] },
  { id: "insulin", label: "Insulin", panel: "metabolic", aliases: ["insulin", "fasting insulin", "insulin fasting"] },
  { id: "eag", label: "Est. Average Glucose", panel: "metabolic", aliases: ["estimated average glucose", "eag", "average glucose"] },

  // ── Lipids ────────────────────────────────────────────────────────────────
  { id: "cholesterol_total", label: "Total Cholesterol", panel: "lipid", aliases: ["total cholesterol", "cholesterol total", "cholesterol"] },
  { id: "ldl", label: "LDL Cholesterol", panel: "lipid", aliases: ["ldl", "ldl cholesterol", "cholesterol ldl", "low density lipoprotein", "ldl c"] },
  { id: "hdl", label: "HDL Cholesterol", panel: "lipid", aliases: ["hdl", "hdl cholesterol", "cholesterol hdl", "high density lipoprotein", "hdl c"] },
  { id: "vldl", label: "VLDL Cholesterol", panel: "lipid", aliases: ["vldl", "vldl cholesterol", "very low density lipoprotein"] },
  { id: "triglycerides", label: "Triglycerides", panel: "lipid", aliases: ["triglycerides", "triglyceride", "tg", "trigly"] },
  { id: "non_hdl", label: "Non-HDL Cholesterol", panel: "lipid", aliases: ["non hdl cholesterol", "non hdl"] },
  { id: "chol_hdl_ratio", label: "Chol / HDL Ratio", panel: "lipid", aliases: ["cholesterol hdl ratio", "total cholesterol hdl ratio", "chol hdl ratio", "tc hdl ratio"] },
  { id: "ldl_hdl_ratio", label: "LDL / HDL Ratio", panel: "lipid", aliases: ["ldl hdl ratio"] },

  // ── Liver ─────────────────────────────────────────────────────────────────
  { id: "alt", label: "ALT (SGPT)", panel: "liver", aliases: ["alt", "sgpt", "alt sgpt", "sgpt alt", "alanine aminotransferase", "alanine transaminase"] },
  { id: "ast", label: "AST (SGOT)", panel: "liver", aliases: ["ast", "sgot", "ast sgot", "sgot ast", "aspartate aminotransferase", "aspartate transaminase"] },
  { id: "alp", label: "Alkaline Phosphatase", panel: "liver", aliases: ["alp", "alkaline phosphatase"] },
  { id: "ggt", label: "GGT", panel: "liver", aliases: ["ggt", "ggtp", "gamma gt", "gamma glutamyl transferase", "gamma glutamyl transpeptidase"] },
  { id: "bilirubin_total", label: "Total Bilirubin", panel: "liver", aliases: ["total bilirubin", "bilirubin total", "bilirubin"] },
  { id: "bilirubin_direct", label: "Direct Bilirubin", panel: "liver", aliases: ["direct bilirubin", "bilirubin direct", "conjugated bilirubin"] },
  { id: "bilirubin_indirect", label: "Indirect Bilirubin", panel: "liver", aliases: ["indirect bilirubin", "bilirubin indirect", "unconjugated bilirubin"] },
  { id: "albumin", label: "Albumin", panel: "liver", aliases: ["albumin"] },
  { id: "protein_total", label: "Total Protein", panel: "liver", aliases: ["total protein", "protein total", "total proteins"] },
  { id: "globulin", label: "Globulin", panel: "liver", aliases: ["globulin"] },
  { id: "ag_ratio", label: "A/G Ratio", panel: "liver", aliases: ["a g ratio", "ag ratio", "albumin globulin ratio"] },

  // ── Kidney ────────────────────────────────────────────────────────────────
  { id: "creatinine", label: "Creatinine", panel: "kidney", aliases: ["creatinine"] },
  { id: "urea", label: "Urea", panel: "kidney", aliases: ["urea", "blood urea"] },
  { id: "bun", label: "BUN", panel: "kidney", aliases: ["bun", "blood urea nitrogen", "urea nitrogen"] },
  { id: "uric_acid", label: "Uric Acid", panel: "kidney", aliases: ["uric acid"] },
  { id: "egfr", label: "eGFR", panel: "kidney", aliases: ["egfr", "gfr", "estimated gfr", "estimated glomerular filtration rate", "glomerular filtration rate"] },
  { id: "bun_creat_ratio", label: "BUN / Creatinine Ratio", panel: "kidney", aliases: ["bun creatinine ratio", "urea creatinine ratio"] },

  // ── Electrolytes & minerals ───────────────────────────────────────────────
  { id: "sodium", label: "Sodium", panel: "electrolyte", aliases: ["sodium", "na"] },
  // No bare "k" alias: single characters are indistinguishable from noise once
  // normalised, and the min-length guard below would discard them anyway.
  { id: "potassium", label: "Potassium", panel: "electrolyte", aliases: ["potassium"] },
  { id: "chloride", label: "Chloride", panel: "electrolyte", aliases: ["chloride", "cl"] },
  { id: "calcium", label: "Calcium", panel: "electrolyte", aliases: ["calcium", "total calcium"] },
  { id: "phosphorus", label: "Phosphorus", panel: "electrolyte", aliases: ["phosphorus", "phosphate", "inorganic phosphorus"] },
  { id: "magnesium", label: "Magnesium", panel: "electrolyte", aliases: ["magnesium", "mg"] },

  // ── Thyroid ───────────────────────────────────────────────────────────────
  { id: "tsh", label: "TSH", panel: "thyroid", aliases: ["tsh", "thyroid stimulating hormone", "thyrotropin"] },
  { id: "t3", label: "T3", panel: "thyroid", aliases: ["t3", "total t3", "triiodothyronine", "tri iodothyronine"] },
  { id: "t4", label: "T4", panel: "thyroid", aliases: ["t4", "total t4", "thyroxine"] },
  { id: "ft3", label: "Free T3", panel: "thyroid", aliases: ["ft3", "free t3", "free triiodothyronine"] },
  { id: "ft4", label: "Free T4", panel: "thyroid", aliases: ["ft4", "free t4", "free thyroxine"] },

  // ── Blood count ───────────────────────────────────────────────────────────
  { id: "hemoglobin", label: "Hemoglobin", panel: "blood", aliases: ["hemoglobin", "haemoglobin", "hb", "hgb"] },
  { id: "rbc", label: "RBC Count", panel: "blood", aliases: ["rbc", "rbc count", "red blood cell", "red blood cell count", "total rbc count", "erythrocyte count"] },
  { id: "wbc", label: "WBC Count", panel: "blood", aliases: ["wbc", "wbc count", "white blood cell", "white blood cell count", "tlc", "total leucocyte count", "total leukocyte count", "leucocyte count", "leukocyte count"] },
  { id: "platelets", label: "Platelet Count", panel: "blood", aliases: ["platelet", "platelets", "platelet count", "plt"] },
  { id: "hematocrit", label: "Hematocrit (PCV)", panel: "blood", aliases: ["hematocrit", "haematocrit", "hct", "pcv", "packed cell volume"] },
  { id: "mcv", label: "MCV", panel: "blood", aliases: ["mcv", "mean corpuscular volume"] },
  { id: "mch", label: "MCH", panel: "blood", aliases: ["mch", "mean corpuscular hemoglobin", "mean corpuscular haemoglobin"] },
  { id: "mchc", label: "MCHC", panel: "blood", aliases: ["mchc", "mean corpuscular hemoglobin concentration", "mean corpuscular haemoglobin concentration"] },
  { id: "rdw", label: "RDW", panel: "blood", aliases: ["rdw", "rdw cv", "red cell distribution width"] },
  { id: "mpv", label: "MPV", panel: "blood", aliases: ["mpv", "mean platelet volume"] },
  { id: "neutrophils", label: "Neutrophils", panel: "blood", aliases: ["neutrophils", "neutrophil", "polymorphs", "neutrophils percent"] },
  { id: "lymphocytes", label: "Lymphocytes", panel: "blood", aliases: ["lymphocytes", "lymphocyte", "lymphocytes percent"] },
  { id: "monocytes", label: "Monocytes", panel: "blood", aliases: ["monocytes", "monocyte"] },
  { id: "eosinophils", label: "Eosinophils", panel: "blood", aliases: ["eosinophils", "eosinophil"] },
  { id: "basophils", label: "Basophils", panel: "blood", aliases: ["basophils", "basophil"] },
  { id: "esr", label: "ESR", panel: "blood", aliases: ["esr", "erythrocyte sedimentation rate"] },

  // ── Iron studies ──────────────────────────────────────────────────────────
  { id: "iron", label: "Iron", panel: "iron", aliases: ["iron"] },
  { id: "ferritin", label: "Ferritin", panel: "iron", aliases: ["ferritin"] },
  { id: "tibc", label: "TIBC", panel: "iron", aliases: ["tibc", "total iron binding capacity", "iron binding capacity"] },
  { id: "uibc", label: "UIBC", panel: "iron", aliases: ["uibc", "unsaturated iron binding capacity"] },
  { id: "transferrin_sat", label: "Transferrin Saturation", panel: "iron", aliases: ["transferrin saturation", "transferrin sat", "tsat", "iron saturation", "percent transferrin saturation"] },

  // ── Vitamins ──────────────────────────────────────────────────────────────
  { id: "vitamin_d", label: "Vitamin D", panel: "vitamin", aliases: ["vitamin d", "vitamin d3", "vit d", "25 hydroxy vitamin d", "25 oh vitamin d", "25 hydroxyvitamin d", "vitamin d 25 hydroxy", "cholecalciferol"] },
  { id: "vitamin_b12", label: "Vitamin B12", panel: "vitamin", aliases: ["vitamin b12", "b12", "vit b12", "cobalamin", "cyanocobalamin"] },
  { id: "folate", label: "Folate", panel: "vitamin", aliases: ["folate", "folic acid", "serum folate"] },

  // ── Inflammation & cardiac ────────────────────────────────────────────────
  { id: "crp", label: "CRP", panel: "inflammation", aliases: ["crp", "c reactive protein"] },
  // hs-CRP is a genuinely different test from CRP (different reference range,
  // used for cardiac risk). Every "sensitive" spelling is listed explicitly so
  // it matches at step 1 and never gets denoised down into plain CRP.
  { id: "hs_crp", label: "hs-CRP", panel: "inflammation", aliases: ["hs crp", "hscrp", "high sensitivity c reactive protein", "high sensitivity crp", "highly sensitive c reactive protein", "highly sensitive crp", "ultra sensitive crp", "ultrasensitive crp"] },
  { id: "homocysteine", label: "Homocysteine", panel: "inflammation", aliases: ["homocysteine"] },
  { id: "troponin", label: "Troponin", panel: "inflammation", aliases: ["troponin", "troponin i", "troponin t", "trop i"] },
  { id: "ck_mb", label: "CK-MB", panel: "inflammation", aliases: ["ck mb", "ckmb", "creatine kinase mb"] },
  { id: "cpk", label: "CPK", panel: "inflammation", aliases: ["cpk", "ck", "creatine kinase", "creatine phosphokinase"] },
];

// ─── NORMALISATION ───────────────────────────────────────────────────────────

/**
 * Words that never identify WHICH analyte was measured — only the specimen it
 * came from, the assay used, or filler. Removed as whole tokens (so position
 * doesn't matter: "Serum TSH" and "TSH, Serum" both reduce to "tsh").
 *
 * What is deliberately NOT here: "total", "direct", "indirect", "free",
 * "fasting", "random", "post prandial". Those DO change the analyte —
 * stripping them would merge total with direct bilirubin, or fasting with
 * post-prandial glucose.
 */
const NOISE_WORDS = new Set([
  // specimen / sample
  "serum", "plasma", "blood", "whole", "urine",
  // assay sensitivity & generation ("TSH Ultrasensitive", "TSH 3rd Generation")
  "ultrasensitive", "ultra", "sensitive", "hypersensitive", "highly",
  "1st", "2nd", "3rd", "first", "second", "third", "generation", "gen",
  // measurement method / instrument
  "clia", "eclia", "elisa", "cmia", "ecl", "ria", "chemiluminescence",
  "immunoassay", "hplc", "lcms", "nephelometry", "spectrophotometry",
  "photometric", "photometry", "colorimetric", "turbidimetric",
  "immunoturbidimetric", "immunoturbidimetry", "enzymatic", "kinetic", "jaffe",
  "hexokinase", "ise", "method", "by",
  // filler
  "test", "tests", "assay", "estimation", "level", "levels", "value", "values",
  "study", "studies", "report", "reports",
]);

/** Single-letter specimen abbreviations, stripped only when leading. */
const LEADING_SPECIMEN_ABBR = new Set(["s", "p", "b"]);

/**
 * Lowercase and collapse to space-separated alphanumeric tokens.
 *
 * camelCase is split first: labs emit "sensitiveTSH" as one glued word, and
 * without splitting it becomes the single token "sensitivetsh", which matches
 * nothing.
 */
export function normalise(raw) {
  if (!raw) return "";
  const s = String(raw)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // sensitiveTSH -> sensitive TSH
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.length >= 2 ? s : "";
}

/**
 * Normalised name with noise tokens removed. Returns "" when nothing but noise
 * is left, which is how a bare "Serum" heading gets rejected.
 */
export function denoise(raw) {
  let tokens = normalise(raw).split(" ").filter(Boolean);

  // "S. Creatinine", "P. Glucose" — single-letter specimen abbreviations common
  // on Indian lab reports. Only stripped in LEADING position: a lone "s" or "p"
  // elsewhere in a name is far more likely to be part of the analyte.
  if (tokens.length > 1 && LEADING_SPECIMEN_ABBR.has(tokens[0])) {
    tokens = tokens.slice(1);
  }

  const s = tokens.filter((t) => !NOISE_WORDS.has(t)).join(" ");
  return s.length >= 2 ? s : "";
}

/**
 * Space-insensitive form. Labs are inconsistent about spacing inside
 * abbreviations — "HbA1c" / "Hb A1c", "T3" / "T 3", "hs-CRP" / "hsCRP" — and
 * enumerating every spacing variant as an alias would be endless.
 */
const tight = (s) => s.replace(/ /g, "");

/** Built once. Collisions would be a registry bug — asserted in tests. */
const ALIAS_INDEX = new Map();
const TIGHT_INDEX = new Map();
for (const marker of MARKERS) {
  for (const alias of marker.aliases) {
    const key = normalise(alias);
    if (!key) continue;
    ALIAS_INDEX.set(key, marker.id);
    TIGHT_INDEX.set(tight(key), marker.id);
  }
}

const BY_ID = new Map(MARKERS.map((m) => [m.id, m]));

/**
 * Aliases resolving to more than one canonical marker. Should always be empty —
 * a collision means two different analytes would silently merge.
 * Checks the space-insensitive index too, since that is the looser of the two.
 */
export function findAliasCollisions() {
  const collisions = [];
  for (const [index, kind] of [[ALIAS_INDEX, "exact"], [TIGHT_INDEX, "tight"]]) {
    const seen = new Map();
    for (const marker of MARKERS) {
      for (const alias of marker.aliases) {
        const key = normalise(alias);
        if (!key) continue;
        const k = kind === "tight" ? tight(key) : key;
        const owner = seen.get(k);
        if (owner && owner !== marker.id) {
          collisions.push({ kind, alias: k, markers: [owner, marker.id] });
        }
        seen.set(k, marker.id);
      }
    }
    void index;
  }
  return collisions;
}

/** Aliases that vanish under normalisation (e.g. single characters). */
export function findDeadAliases() {
  const dead = [];
  for (const marker of MARKERS) {
    for (const alias of marker.aliases) {
      if (!normalise(alias)) dead.push({ marker: marker.id, alias });
    }
  }
  return dead;
}

/** Parenthesised chunks: "Glycosylated Hemoglobin (HbA1c)" -> ["hba1c"]. */
function parentheticals(raw) {
  const out = [];
  for (const m of String(raw).matchAll(/\(([^)]+)\)/g)) {
    const n = normalise(m[1]);
    if (n) out.push(n);
  }
  return out;
}

/** The name with all parenthesised chunks removed. */
const withoutParens = (raw) => normalise(String(raw).replace(/\([^)]*\)/g, " "));

/**
 * Resolve a raw lab marker name to a canonical marker.
 *
 * @returns {{ id, label, panel, canonical:boolean }|null}
 *   null when the name isn't a marker at all (blank, or a bare "Serum" heading).
 *   `canonical:false` means it wasn't in the registry — it keeps its own series
 *   under the "other" panel rather than being dropped or force-merged.
 */
export function resolveMarker(rawName) {
  const full = normalise(rawName);
  if (!full) return null;

  // Nothing but specimen/method words ("Serum", "by CLIA") — not a marker.
  const denoised = denoise(rawName);
  if (!denoised) return null;

  // Exact alias first, space-insensitive only as a fallback.
  const lookup = (key) =>
    key ? ALIAS_INDEX.get(key) || TIGHT_INDEX.get(tight(key)) : undefined;

  // Ordered most-specific to least. Exact aliases are tried BEFORE any noise
  // stripping, which is what keeps "high sensitivity CRP" resolving to hs-CRP
  // instead of being denoised down into plain CRP.
  let id =
    // 1. whole name
    lookup(full) ||
    // 2. parenthesised abbreviation — the usual lab convention
    parentheticals(rawName).reduce((hit, abbr) => hit || lookup(abbr), undefined) ||
    // 3. name minus the parenthetical
    lookup(withoutParens(rawName)) ||
    // 4. noise words removed: "TSH Ultrasensitive", "TSH, Serum" -> "tsh"
    lookup(denoised) ||
    // 5. both
    lookup(denoise(String(rawName).replace(/\([^)]*\)/g, " ")));

  if (id) {
    const m = BY_ID.get(id);
    return { id: m.id, label: m.label, panel: m.panel, canonical: true };
  }

  // Unknown marker: keep it, but key on the denoised name so variants of the
  // same unknown ("Foo Ultrasensitive", "Foo, Serum", "Foo (XYZ)") still group.
  const key = denoise(String(rawName).replace(/\([^)]*\)/g, " ")) || denoised;
  return {
    id: `other:${key}`,
    label: String(rawName).trim(),
    panel: "other",
    canonical: false,
  };
}

/** Panel metadata for a panel id, falling back to "other". */
export const panelOf = (panelId) => PANELS[panelId] || PANELS.other;

// ─── VALUE PARSING ───────────────────────────────────────────────────────────
// Lab values arrive as display strings ("5.6 %", "120 mg/dL", "<0.01"). These
// live here rather than in biomarkerCorrelation so the trends page can use them
// without importing the food database.

/** "5.6 %" -> 5.6 ; "<0.01" -> 0.01 ; null when there is no number at all. */
export function parseNumeric(value) {
  if (value === null || value === undefined) return null;
  const m = String(value).match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/** "5.6 %" -> "%" ; "120 mg/dL" -> "mg/dL" ; "" when there is no unit. */
export function extractUnit(value) {
  if (!value) return "";
  const m = String(value).match(/-?\d+(?:\.\d+)?\s*(.*)$/);
  return m ? m[1].trim() : "";
}
