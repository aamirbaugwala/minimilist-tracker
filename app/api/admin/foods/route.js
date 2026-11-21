import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCatalog, customRowToFood, dbRowToFood, defaultPortion, portionMacros } from "../../../lib/foodModel";
import { loadSeedFoods } from "../../../lib/foodCatalog";
import { matchOne, normalize, similarFoods } from "../../../lib/foodSearch";

/**
 * /api/admin/foods — the food catalog's admin tools (docs/food-database-design.md).
 * Admin only (is_admin(), asked as the caller). Writes use the service role.
 *
 *   GET  ?view=status | foods | review | promote | gaps
 *   POST { action: "seed" }                    load/refresh built-ins from app/data/foods-seed.json
 *        { action: "migrate", apply: bool }    custom_foods → private foods (auto-merge obvious dupes)
 *        { action: "save", food }              create/update a built-in food (+ portions)
 *        { action: "merge", foodId, targetId } merge a user's food into another food
 *        { action: "keep", foodId }            mark a user's food as reviewed, keep it
 *        { action: "promote", foodId }         copy a user's food into the built-in list
 *
 * Only counts and food names are returned — never who logged what.
 */

const PAGE = 1000;
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

async function isAdmin(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const asUser = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await asUser.rpc("is_admin");
  return !error && data === true;
}

async function all(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return rows;
  }
}

const groupBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) (m.get(r[key]) || m.set(r[key], []).get(r[key])).push(r);
  return m;
};

async function builtinCatalog(db) {
  const rows = await all(() => db.from("foods").select("*").is("owner_id", null).eq("status", "active").order("id"));
  const portions = await all(() => db.from("food_portions").select("*").order("id"));
  const by = groupBy(portions, "food_id");
  return { rows, catalog: buildCatalog(rows.map((r) => dbRowToFood(r, by.get(r.id) || []))) };
}

async function replacePortions(db, foodId, portions) {
  await db.from("food_portions").delete().eq("food_id", foodId);
  const rows = (portions || []).map((p, i) => ({ food_id: foodId, label: p.label, amount: Number(p.amount) || 0, is_default: !!p.is_default, legacy_key: p.legacy_key || null, sort: i }));
  if (rows.length) {
    const { error } = await db.from("food_portions").insert(rows);
    if (error) throw new Error(error.message);
  }
}

/** Point a user's logs at a food: by old names, or from another food id. */
async function relinkLogs(db, { ownerId, names = [], fromFoodId, toFoodId }) {
  if (fromFoodId) {
    const { error } = await db.from("food_logs").update({ food_id: toFoodId }).eq("food_id", fromFoodId);
    if (error) throw new Error(error.message);
  }
  const keys = [...new Set(names.map((n) => String(n).toLowerCase()).filter(Boolean))];
  for (let i = 0; i < keys.length; i += 50) {
    let q = db.from("food_logs").update({ food_id: toFoodId }).is("food_id", null).in("name", keys.slice(i, i + 50));
    if (ownerId) q = q.eq("user_id", ownerId);
    const { error } = await q;
    if (error) throw new Error(error.message);
  }
}

const kcalPerUnit = (food) => {
  const dp = defaultPortion(food);
  return food.basis === "serving" ? portionMacros(food, dp).calories : Number(food.kcal) || 0;
};
/** Same food, roughly the same energy (±15%) — safe to merge automatically. */
function sameEnergy(userFood, builtin) {
  if (userFood.basis === "serving") {
    let a = kcalPerUnit(userFood);
    let b = portionMacros(builtin, defaultPortion(builtin)).calories;
    // "3 boiled eggs" vs "Boiled egg (1 pc)": compare one piece with one piece.
    if (userFood.pieces > 1) {
      const onePc = builtin.portions.find((p) => p.label === "1 pc");
      const dp = defaultPortion(builtin);
      const dpCount = Number((dp.label.match(/^(\d+) pcs?$/) || [])[1]) || 0;
      if (onePc) b = portionMacros(builtin, onePc).calories;
      else if (dpCount) b = b / dpCount;
      else return false;
      a = a / userFood.pieces;
    }
    return b > 0 && Math.abs(a - b) / b <= 0.15;
  }
  const a = Number(userFood.kcal) || 0;
  const b = Number(builtin.kcal) || 0;
  return b > 0 && Math.abs(a - b) / b <= 0.15;
}
const sameName = (userFood, builtin) => {
  const n = normalize(userFood.name);
  return n === normalize(builtin.name) || (builtin.aliases || []).some((a) => normalize(a) === n);
};

// ── views ───────────────────────────────────────────────────────────────────
async function status(db) {
  const head = (t, build) => build(db.from(t).select("id", { count: "exact", head: true }));
  const { error: tErr } = await db.from("foods").select("id").limit(1);
  const tableReady = !tErr;
  const out = { tableReady, seedVersion: null };
  try {
    const mod = await import("../../../data/foods-seed.json");
    out.seedVersion = (mod.default || mod).version;
    out.seedCount = (mod.default || mod).foods.length;
  } catch {
    /* ignore */
  }
  const [{ count: customRows }, { count: logs }] = await Promise.all([head("custom_foods", (q) => q), head("food_logs", (q) => q.neq("name", "Water"))]);
  out.customRows = customRows || 0;
  out.logs = logs || 0;
  if (!tableReady) return out;
  const [{ count: builtins }, { count: userFoods }, { count: merged }, { count: linked }] = await Promise.all([
    head("foods", (q) => q.is("owner_id", null).eq("status", "active")),
    head("foods", (q) => q.not("owner_id", "is", null).eq("status", "active")),
    head("foods", (q) => q.eq("status", "merged")),
    head("food_logs", (q) => q.not("food_id", "is", null)),
  ]);
  Object.assign(out, { builtins: builtins || 0, userFoods: userFoods || 0, merged: merged || 0, linkedLogs: linked || 0 });
  return out;
}

async function listFoods(db, q) {
  const { catalog } = await builtinCatalog(db);
  const foods = q ? similarFoods(catalog, q, { limit: 60, minScore: 20 }).map((r) => r.food) : catalog.foods.slice().sort((a, b) => a.name.localeCompare(b.name));
  return { categories: catalog.categories, foods };
}

async function review(db) {
  const { catalog } = await builtinCatalog(db);
  const mine = await all(() => db.from("foods").select("*").not("owner_id", "is", null).eq("status", "active").is("review_state", null).order("id"));
  const portions = mine.length ? await all(() => db.from("food_portions").select("*").in("food_id", mine.map((m) => m.id).slice(0, 1000)).order("id")) : [];
  const by = groupBy(portions, "food_id");
  const items = [];
  for (const row of mine) {
    const food = dbRowToFood(row, by.get(row.id) || []);
    const close = similarFoods(catalog, food.name, { limit: 1, minScore: 70 })[0];
    const hit = matchOne(catalog, food.name) || (close && { food: close.food });
    if (!hit) continue;
    const dp = defaultPortion(food);
    const tp = defaultPortion(hit.food);
    items.push({
      id: food.id,
      name: food.name,
      portion: dp.label,
      kcal: portionMacros(food, dp).calories,
      target: { id: hit.food.id, name: hit.food.name, portion: tp.label, kcal: portionMacros(hit.food, tp).calories },
    });
  }
  return { items };
}

async function promote(db) {
  const { catalog } = await builtinCatalog(db);
  const mine = await all(() => db.from("foods").select("id, name, basis, kcal, owner_id").not("owner_id", "is", null).eq("status", "active").order("id"));
  const groups = new Map();
  for (const f of mine) {
    if (matchOne(catalog, f.name)) continue; // already covered by a built-in
    const k = normalize(f.name);
    const g = groups.get(k) || { name: f.name, ids: [], owners: new Set() };
    g.ids.push(f.id);
    g.owners.add(f.owner_id);
    groups.set(k, g);
  }
  const list = [...groups.values()];
  // log counts per food id (counts only)
  const ids = list.flatMap((g) => g.ids);
  const counts = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const rows = await all(() => db.from("food_logs").select("food_id").in("food_id", ids.slice(i, i + 200)).order("id"));
    rows.forEach((r) => counts.set(r.food_id, (counts.get(r.food_id) || 0) + 1));
  }
  return {
    items: list
      .map((g) => ({ name: g.name, foodId: g.ids[0], users: g.owners.size, logs: g.ids.reduce((s, id) => s + (counts.get(id) || 0), 0) }))
      .sort((a, b) => b.users - a.users || b.logs - a.logs)
      .slice(0, 60),
  };
}

async function gaps(db) {
  let catalog;
  try {
    catalog = (await builtinCatalog(db)).catalog;
    if (!catalog.foods.length) throw new Error("empty");
  } catch {
    catalog = buildCatalog(await loadSeedFoods());
  }
  const rows = await all(() => db.from("food_logs").select("name, qty, calories, protein, carbs, fats, fiber, food_id").is("food_id", null).neq("name", "Water").order("id"));
  const g = new Map();
  for (const r of rows) {
    const k = String(r.name || "").toLowerCase().trim();
    if (!k || catalog.lookup.has(k) || matchOne(catalog, k)) continue;
    const x = g.get(k) || { name: k, logs: 0, kcal: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 };
    const q = Number(r.qty) || 1;
    x.logs++;
    x.kcal += (Number(r.calories) || 0) / q;
    x.protein += (Number(r.protein) || 0) / q;
    x.carbs += (Number(r.carbs) || 0) / q;
    x.fats += (Number(r.fats) || 0) / q;
    x.fiber += (Number(r.fiber) || 0) / q;
    g.set(k, x);
  }
  const items = [...g.values()]
    .filter((x) => x.logs >= 2)
    .map((x) => ({ name: x.name, logs: x.logs, per: { calories: Math.round(x.kcal / x.logs), protein: r1(x.protein / x.logs), carbs: r1(x.carbs / x.logs), fats: r1(x.fats / x.logs), fiber: r1(x.fiber / x.logs) } }))
    .sort((a, b) => b.logs - a.logs)
    .slice(0, 60);
  return { items };
}

// ── actions ─────────────────────────────────────────────────────────────────
async function seed(db, { force = false } = {}) {
  const mod = await import("../../../data/foods-seed.json");
  const { foods, version } = mod.default || mod;
  const existing = await all(() => db.from("foods").select("id, slug, verified").is("owner_id", null).order("id"));
  const bySlug = new Map(existing.map((e) => [e.slug, e]));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const f of foods) {
    const prev = bySlug.get(f.slug);
    if (prev?.verified && !force) {
      skipped++; // edited by an admin — keep their version
      continue;
    }
    const row = { slug: f.slug, name: f.name, family: f.family, category: f.category, aliases: f.aliases || [], basis: f.basis, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber, owner_id: null, source: "builtin", status: "active", legacy_keys: f.legacy_keys || [] };
    let id = prev?.id;
    if (id) {
      const { error } = await db.from("foods").update(row).eq("id", id);
      if (error) throw new Error(`${f.slug}: ${error.message}`);
      updated++;
    } else {
      const { data, error } = await db.from("foods").insert(row).select("id").single();
      if (error) throw new Error(`${f.slug}: ${error.message}`);
      id = data.id;
      created++;
    }
    await replacePortions(db, id, f.portions);
  }
  // Link existing logs that use a built-in name (old or new style) to the food.
  const { catalog } = await builtinCatalog(db);
  const byFood = new Map();
  for (const [key, { food }] of catalog.lookup) (byFood.get(food.id) || byFood.set(food.id, []).get(food.id)).push(key);
  for (const [foodId, keys] of byFood) await relinkLogs(db, { names: keys, toFoodId: foodId });
  return { version, created, updated, skipped };
}

async function migrate(db, { apply = false } = {}) {
  const { catalog } = await builtinCatalog(db);
  if (!catalog.foods.length) throw new Error("Load the built-in foods first.");
  const customs = await all(() => db.from("custom_foods").select("*").order("created_at"));
  const done = await all(() => db.from("foods").select("owner_id, name, legacy_keys").not("owner_id", "is", null).order("id"));
  const migrated = new Set(done.flatMap((d) => [d.name, ...(d.legacy_keys || [])].map((k) => `${d.owner_id}|${String(k).toLowerCase()}`)));

  const plan = { autoMerge: [], clusters: [], review: [], keep: 0, already: 0 };
  // Group each user's rows by the food they describe (same words, any portion).
  const groups = new Map();
  for (const row of customs) {
    const raw = String(row.name || "").toLowerCase().trim();
    if (!raw) continue;
    if (migrated.has(`${row.user_id}|${raw}`)) {
      plan.already++;
      continue;
    }
    const food = customRowToFood(row);
    const k = `${row.user_id}|${normalize(food.name)}`;
    (groups.get(k) || groups.set(k, []).get(k)).push({ row, food, raw });
  }

  const ops = [];
  for (const members of groups.values()) {
    const [primary, ...rest] = members;
    const hit = matchOne(catalog, primary.food.name);
    if (hit && sameName(primary.food, hit.food) && sameEnergy(primary.food, hit.food)) {
      plan.autoMerge.push({ name: primary.food.name, into: hit.food.name, rows: members.length });
      ops.push({ kind: "merge", owner: primary.row.user_id, members, target: hit.food });
      continue;
    }
    if (rest.length) plan.clusters.push({ names: members.map((m) => m.raw), into: primary.food.name });
    if (hit) plan.review.push({ name: primary.food.name, candidate: hit.food.name });
    else plan.keep++;
    ops.push({ kind: "keep", owner: primary.row.user_id, members });
  }
  if (!apply) return { plan: { ...plan, autoMerge: plan.autoMerge.slice(0, 80), clusters: plan.clusters.slice(0, 80), review: plan.review.slice(0, 80), counts: { autoMerge: plan.autoMerge.length, clusters: plan.clusters.length, review: plan.review.length, keep: plan.keep, already: plan.already, rows: customs.length } } };

  let createdFoods = 0;
  for (const op of ops) {
    const owner = op.owner;
    const names = op.members.map((m) => m.raw);
    if (op.kind === "merge") {
      // A merged stub keeps the user's old names resolving to the built-in.
      const { error } = await db.from("foods").insert({ name: op.members[0].food.name, owner_id: owner, source: "user", basis: op.members[0].food.basis, kcal: op.members[0].food.kcal, protein: op.members[0].food.protein, carbs: op.members[0].food.carbs, fat: op.members[0].food.fat, fiber: op.members[0].food.fiber, status: "merged", merged_into: op.target.id, legacy_keys: names });
      if (error) throw new Error(error.message);
      await relinkLogs(db, { ownerId: owner, names, toFoodId: op.target.id });
      continue;
    }
    // Keep: one food per group; other spellings/weights become its portions or old names.
    const p = op.members[0].food;
    const portions = [...p.portions];
    for (const m of op.members.slice(1)) {
      if (m.food.basis === p.basis && p.basis !== "serving") {
        for (const pt of m.food.portions) if (!portions.some((x) => x.label === pt.label)) portions.push({ ...pt, is_default: false });
      }
    }
    const { data, error } = await db.from("foods").insert({ name: p.name, owner_id: owner, source: "user", basis: p.basis, kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat, fiber: p.fiber, status: "active", legacy_keys: names }).select("id").single();
    if (error) throw new Error(error.message);
    await replacePortions(db, data.id, portions);
    await relinkLogs(db, { ownerId: owner, names, toFoodId: data.id });
    createdFoods++;
  }
  return { applied: true, createdFoods, merged: plan.autoMerge.length, review: plan.review.length };
}

async function saveFood(db, food) {
  const row = {
    name: String(food.name || "").trim(),
    family: food.family || null,
    category: food.category || null,
    aliases: (food.aliases || []).map((a) => String(a).trim()).filter(Boolean),
    basis: food.basis === "ml" ? "ml" : "g",
    kcal: Number(food.kcal) || 0, protein: Number(food.protein) || 0, carbs: Number(food.carbs) || 0, fat: Number(food.fat) || 0, fiber: Number(food.fiber) || 0,
    status: food.status === "hidden" ? "hidden" : "active",
    verified: true,
    owner_id: null,
    source: "builtin",
  };
  if (!row.name) throw new Error("Name is required.");
  const portions = (food.portions || []).filter((p) => p.label && Number(p.amount) > 0);
  if (!portions.length) throw new Error("Add at least one portion.");
  if (!portions.some((p) => p.is_default)) portions[0].is_default = true;
  let id = food.id && !String(food.id).startsWith("seed:") ? food.id : null;
  if (id) {
    const { error } = await db.from("foods").update(row).eq("id", id).is("owner_id", null);
    if (error) throw new Error(error.message);
  } else {
    const base = row.name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    let slug = base;
    for (let i = 2; ; i++) {
      const { data } = await db.from("foods").select("id").eq("slug", slug).maybeSingle();
      if (!data) break;
      slug = `${base}-${i}`;
    }
    const { data, error } = await db.from("foods").insert({ ...row, slug }).select("id").single();
    if (error) throw new Error(error.message);
    id = data.id;
  }
  await replacePortions(db, id, portions);
  return { id };
}

async function mergeFood(db, { foodId, targetId }) {
  const { data: f } = await db.from("foods").select("*").eq("id", foodId).maybeSingle();
  if (!f?.owner_id) throw new Error("Only a user's food can be merged.");
  const { error } = await db.from("foods").update({ status: "merged", merged_into: targetId }).eq("id", foodId);
  if (error) throw new Error(error.message);
  await relinkLogs(db, { fromFoodId: foodId, toFoodId: targetId });
  return { ok: true };
}

async function promoteFood(db, { foodId }) {
  const { data: f } = await db.from("foods").select("*").eq("id", foodId).maybeSingle();
  if (!f?.owner_id) throw new Error("Only a user's food can be promoted.");
  const { data: portions } = await db.from("food_portions").select("*").eq("food_id", foodId).order("sort");
  if (f.basis === "serving") throw new Error("This food has no weight (per serving only). Add it from Foods with a gram weight instead.");
  const { id } = await saveFood(db, { name: f.name, category: null, aliases: f.aliases || [], basis: f.basis, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber, portions: (portions || []).map((p) => ({ label: p.label, amount: p.amount, is_default: p.is_default })) });
  // Every user's copy of this food now points at the new built-in.
  const { data: copies } = await db.from("foods").select("id, name").not("owner_id", "is", null).eq("status", "active");
  const n = normalize(f.name);
  for (const c of (copies || []).filter((c) => normalize(c.name) === n)) {
    await db.from("foods").update({ status: "merged", merged_into: id, review_state: "promoted" }).eq("id", c.id);
    await relinkLogs(db, { fromFoodId: c.id, toFoodId: id });
  }
  return { ok: true, id };
}

export async function GET(req) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const db = admin();
  if (!db) return NextResponse.json({ error: "Server isn't configured (service role key)." }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") || "status";
  try {
    if (view === "status") return NextResponse.json(await status(db));
    if (view === "foods") return NextResponse.json(await listFoods(db, searchParams.get("q") || ""));
    if (view === "review") return NextResponse.json(await review(db));
    if (view === "promote") return NextResponse.json(await promote(db));
    if (view === "gaps") return NextResponse.json(await gaps(db));
    return NextResponse.json({ error: "Unknown view." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const db = admin();
  if (!db) return NextResponse.json({ error: "Server isn't configured (service role key)." }, { status: 500 });
  let body = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  try {
    if (body.action === "seed") return NextResponse.json(await seed(db, { force: !!body.force }));
    if (body.action === "migrate") return NextResponse.json(await migrate(db, { apply: !!body.apply }));
    if (body.action === "save") return NextResponse.json(await saveFood(db, body.food || {}));
    if (body.action === "merge") return NextResponse.json(await mergeFood(db, body));
    if (body.action === "keep") {
      const { error } = await db.from("foods").update({ review_state: "kept" }).eq("id", body.foodId).not("owner_id", "is", null);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "promote") return NextResponse.json(await promoteFood(db, body));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const maxDuration = 300; // seeding and migration touch many rows
