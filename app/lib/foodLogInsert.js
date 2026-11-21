/**
 * insertFoodLogs(db, rows) → error | null
 *
 * The one way every path writes food_logs (Today, Coach, voice, recipes).
 * Optional columns added by later migrations (meal, source, food_id, portion,
 * amount) are dropped and
 * the insert retried if this database doesn't have them yet, so the app keeps
 * working before docs/*.sql has been run — it just records less.
 *
 * `source` says how a row was logged: sheet · quick_add · nudge · water ·
 * shortcut · custom · snap · repeat · barcode · coach · voice · recipe.
 */

// food_id / portion / amount come from docs/foods-schema.sql.
const OPTIONAL = ["source", "meal", "food_id", "portion", "amount"];
// Columns found missing in this process, so we don't pay a failed request on
// every save until the migration runs (resets on reload / server restart).
const knownMissing = new Set();

const strip = (batch, col) =>
  batch.map((r) => {
    const copy = { ...r };
    delete copy[col];
    return copy;
  });

export async function insertFoodLogs(db, rows) {
  let batch = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r }));
  knownMissing.forEach((c) => (batch = strip(batch, c)));
  for (let attempt = 0; attempt <= OPTIONAL.length; attempt++) {
    const { error } = await db.from("food_logs").insert(batch);
    if (!error) return null;
    const msg = error.message || "";
    // PostgREST: "Could not find the 'source' column of 'food_logs' in the schema cache" (PGRST204)
    const missing = OPTIONAL.find((c) => batch.some((r) => c in r) && (msg.includes(`'${c}'`) || (error.code === "PGRST204" && new RegExp(`\\b${c}\\b`).test(msg))));
    if (!missing) return error;
    knownMissing.add(missing);
    batch = strip(batch, missing);
  }
  return { message: "Could not save food log." };
}
