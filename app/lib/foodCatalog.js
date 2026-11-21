/**
 * app/lib/foodCatalog.js — load the food catalog (browser and server).
 *
 *   Built-in foods: the `foods` table (owner_id null) when it exists and has
 *   been loaded; otherwise the bundled seed (app/data/foods-seed.json). In the
 *   browser the table copy is cached in localStorage against its latest
 *   updated_at, so search is instant and works offline.
 *
 *   Your foods: your rows in `foods` plus any old custom_foods rows not yet
 *   migrated, so nothing disappears before or during the migration.
 *
 * getCatalog(db, userId) → buildCatalog(builtins + mine)  (see foodModel.js)
 */

import { buildCatalog, customRowToFood, dbRowToFood, seedToFood } from "./foodModel";

const CACHE_KEY = "nt_food_catalog_v1";
const SERVER_TTL_MS = 5 * 60 * 1000;
let seedFoods = null;
let serverCache = { at: 0, foods: null };

export async function loadSeedFoods() {
  if (seedFoods) return seedFoods;
  const mod = await import("../data/foods-seed.json");
  seedFoods = (mod.default || mod).foods.map(seedToFood);
  return seedFoods;
}

const isMissingTable = (error) => !!error && (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache|Could not find the table/i.test(error.message || ""));

async function fetchAll(build, page = 1000) {
  const rows = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build().range(from, from + page - 1);
    if (error) return { rows, error };
    rows.push(...(data || []));
    if (!data || data.length < page) return { rows, error: null };
  }
}

const groupPortions = (portions) => {
  const by = new Map();
  for (const p of portions || []) (by.get(p.food_id) || by.set(p.food_id, []).get(p.food_id)).push(p);
  return by;
};

function readCache() {
  try {
    return typeof window !== "undefined" ? JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null") : null;
  } catch {
    return null;
  }
}
function writeCache(v) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(CACHE_KEY, JSON.stringify(v));
  } catch {
    /* storage full / blocked — just don't cache */
  }
}

/** Built-in foods: table (cached) or the bundled seed. */
export async function loadBuiltinFoods(db) {
  if (typeof window === "undefined" && serverCache.foods && Date.now() - serverCache.at < SERVER_TTL_MS) return serverCache.foods;
  try {
    const { data: latest, error } = await db.from("foods").select("updated_at").is("owner_id", null).order("updated_at", { ascending: false }).limit(1);
    if (error || !latest?.length) return await loadSeedFoods(); // not created / not loaded yet
    const version = latest[0].updated_at;
    const cached = readCache();
    if (cached?.version === version && cached.foods?.length) return cached.foods;
    const { rows, error: e1 } = await fetchAll(() => db.from("foods").select("*").is("owner_id", null).eq("status", "active").order("id"));
    if (e1 || !rows.length) return await loadSeedFoods();
    const { rows: portions } = await fetchAll(() => db.from("food_portions").select("*").order("id"));
    const by = groupPortions(portions);
    const foods = rows.map((r) => dbRowToFood(r, by.get(r.id) || []));
    writeCache({ version, foods });
    if (typeof window === "undefined") serverCache = { at: Date.now(), foods };
    return foods;
  } catch {
    return await loadSeedFoods();
  }
}

/** The user's own foods (new table + old custom_foods not yet migrated). */
export async function loadMyFoods(db, userId) {
  if (!userId) return [];
  const out = [];
  const known = new Set();
  try {
    const { data: rows, error } = await db.from("foods").select("*").eq("owner_id", userId).in("status", ["active", "merged"]);
    if (!error && rows?.length) {
      const ids = rows.map((r) => r.id);
      const { data: portions } = await db.from("food_portions").select("*").in("food_id", ids);
      const by = groupPortions(portions);
      for (const r of rows) {
        out.push(dbRowToFood(r, by.get(r.id) || []));
        known.add(String(r.name).toLowerCase());
        (r.legacy_keys || []).forEach((k) => known.add(String(k).toLowerCase()));
      }
    } else if (error && !isMissingTable(error)) {
      console.warn("[foods] couldn't load your foods:", error.message);
    }
  } catch {
    /* table missing — old custom foods below */
  }
  try {
    const { data: legacy } = await db.from("custom_foods").select("*").eq("user_id", userId);
    for (const row of legacy || []) if (row?.name && !known.has(row.name.toLowerCase().trim())) out.push(customRowToFood(row));
  } catch {
    /* custom foods are a bonus */
  }
  return out;
}

/** Built-ins + the user's foods, as a catalog. */
export async function getCatalog(db, userId) {
  const [builtins, mine] = await Promise.all([loadBuiltinFoods(db), loadMyFoods(db, userId)]);
  return buildCatalog([...builtins, ...mine]);
}

/** Does the new `foods` table exist on this database? */
export async function foodsTableReady(db) {
  const { error } = await db.from("foods").select("id").limit(1);
  return !error;
}

export const clearCatalogCache = () => {
  serverCache = { at: 0, foods: null };
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
};
