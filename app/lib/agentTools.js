/**
 * app/lib/agentTools.js
 *
 * The NutriCoach agent's tool implementations, kept out of the route file so
 * they can be unit-tested with a fake Supabase client (Next route files may
 * only export HTTP handlers).
 *
 * `executeTool(name, args, userId, db, ctx)` — `ctx` is per-request state:
 *   { clientDay, mealHint, foodDb?, conditions?, mustAvoid? }
 * Lazily-loaded pieces (the food DB incl. custom foods, medical conditions) are
 * memoised on ctx so several tool calls in one request share one query.
 *
 * Fixes vs the original inline version (2026-11-15 audit):
 *  - log_food_item / search_food_database use the SAME precision-first matcher
 *    as voice logging (lib/voiceLog matchFood) over built-in + custom foods.
 *    Previously custom foods were invisible (so "save, then log" always failed)
 *    and loose substring matching logged the wrong food ("chicken" → schezwan
 *    chicken fried rice).
 *  - log_food_item stores the meal (tool arg, else the client's current meal).
 *  - Targets in get_macro_gap / generate_meal_plan include medical conditions,
 *    exactly like Home (renal protein cap, lipid fat cap, …).
 *  - generate_meal_plan filters out foods that break the user's diet pattern,
 *    allergies or report "avoid" list, and can use their custom foods.
 *  - get_streak mirrors Home's rule (today OR yesterday) and is no longer capped
 *    by a 60-ROW limit (~5 days at 11 logs/day).
 *  - update_goal keeps a manual calorie target / current axes unless the goal
 *    actually changes.
 *  - get_logs_for_days uses the user's local day, inclusive window.
 */

import { insertFoodLogs } from "./foodLogInsert";
import { FLATTENED_DB, FOOD_CATEGORIES } from "../food-data";
import { planMeals, mealsLeft } from "./mealPlanner";
import { foodTag, activeConditionIds } from "./foodTags";
import { calculateTargets } from "./nutrition";
import { deriveConditions, conditionsFromProfile, mergeConditions } from "./conditions";
import { matchFood, baseName, isWaterPhrase, waterGlasses } from "./voiceLog";
import { resolveQuantity } from "./foodUnits";
import { filterFoodsForProfile } from "./dietFilter";
import { cacheGet, cacheSet, cacheInvalidate } from "./agentCache";
import { computeStreak } from "./streak";

// food name → its built-in category (custom foods have none)
const CATEGORY_OF = Object.fromEntries(
  Object.entries(FOOD_CATEGORIES).flatMap(([cat, foods]) => Object.keys(foods).map((n) => [n.toLowerCase(), cat])),
);

export const MEAL_LABELS = ["Breakfast", "Lunch", "Snacks", "Dinner"];

// ── Day helpers (YYYY-MM-DD strings, calendar arithmetic in UTC) ────────────
export function shiftDay(dayStr, deltaDays) {
  const d = new Date(`${dayStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

// "2 rotis" / "2x roti" → "rotis"; the quantity travels in args.qty.
export const stripLeadingQty = (s) =>
  String(s || "").replace(/^\s*\d+(\.\d+)?\s*(x|×)?\s+/i, "").trim();

const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

/** Built-in foods + this user's custom foods (lower-cased names), once per request. */
export async function getFoodDb(ctx, db, userId) {
  if (ctx.foodDb) return ctx.foodDb;
  const combined = { ...FLATTENED_DB };
  try {
    const { data } = await db
      .from("custom_foods")
      .select("name, calories, protein, carbs, fats, fiber")
      .eq("user_id", userId);
    (data || []).forEach((c) => {
      if (c?.name) combined[c.name.toLowerCase()] = c;
    });
  } catch {
    /* custom foods are a bonus — built-ins still work */
  }
  ctx.foodDb = combined;
  return combined;
}

/** Medical conditions (reports + self-reported) and the latest "avoid" list. */
async function getMedical(ctx, db, userId, profile) {
  if (ctx.conditions) return ctx;
  let reports = [];
  try {
    const { data } = await db
      .from("medical_reports")
      .select("flags, report_date, created_at, exclude_foods")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    reports = data || [];
  } catch {
    /* no reports → no medical adjustments, same as Home */
  }
  ctx.conditions = mergeConditions(deriveConditions(reports), conditionsFromProfile(profile));
  ctx.mustAvoid = (reports[0]?.exclude_foods || []).map((f) => f?.food).filter(Boolean);
  return ctx;
}

const sumLogs = (logs) =>
  (logs || []).reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      protein: acc.protein + (l.protein || 0),
      carbs: acc.carbs + (l.carbs || 0),
      fats: acc.fats + (l.fats || 0),
      fiber: acc.fiber + (l.fiber || 0),
      water: l.name === "Water" ? acc.water + l.qty * 0.25 : acc.water,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, water: 0 },
  );

/** Did this tool call succeed? Used for observability (tools_used) and UI events. */
export function toolSucceeded(toolName, result) {
  if (!result || result.error) return false;
  if (toolName === "log_food_item") return result.logged === true;
  return true;
}

export async function executeTool(toolName, args, userId, db, ctx = {}) {
  // Prefer the client's logical day (4am-rollover local, see lib/day.js) so
  // agent-logged food lands on the day the user is actually having.
  const today = ctx.clientDay || new Date().toISOString().slice(0, 10);

  if (toolName === "get_todays_logs") {
    const { data } = await db.from("food_logs")
      .select("name, calories, protein, carbs, fats, fiber, qty")
      .eq("user_id", userId).eq("date", today).order("created_at", { ascending: true });
    if (!data || data.length === 0) return { result: "No food logs found for today yet." };
    const totals = sumLogs(data);
    return { logs: data.map((l) => ({ food: l.name, qty: l.qty, calories: l.calories, protein: l.protein, carbs: l.carbs, fats: l.fats, fiber: l.fiber || 0 })), totals };
  }

  if (toolName === "get_logs_for_days") {
    const days = Math.min(Math.max(Number(args.days) || 7, 1), 30);
    // Inclusive window of `days` local days ending today (was: server-UTC based
    // and one day too many).
    const start = shiftDay(today, -(days - 1));
    const { data } = await db.from("food_logs")
      .select("date, name, calories, protein, carbs, fats, fiber, qty")
      .eq("user_id", userId).gte("date", start).lte("date", today).order("date", { ascending: true });
    if (!data || data.length === 0) return { result: `No logs found for the past ${days} days.` };

    // ── Pre-aggregate server-side to minimise tokens sent to Gemini ──────────
    const byDay = {};
    const foodFreq = {};
    data.forEach((l) => {
      if (!byDay[l.date]) byDay[l.date] = { cal: 0, pro: 0, carb: 0, fat: 0, fib: 0, water: 0 };
      byDay[l.date].cal  += l.calories || 0;
      byDay[l.date].pro  += l.protein  || 0;
      byDay[l.date].carb += l.carbs    || 0;
      byDay[l.date].fat  += l.fats     || 0;
      byDay[l.date].fib  += l.fiber    || 0;
      if (l.name === "Water") byDay[l.date].water += l.qty * 0.25;
      if (l.name !== "Water") foodFreq[l.name] = (foodFreq[l.name] || 0) + 1;
    });
    Object.values(byDay).forEach((d) => {
      d.cal  = Math.round(d.cal);
      d.pro  = Math.round(d.pro);
      d.carb = Math.round(d.carb);
      d.fat  = Math.round(d.fat);
      d.fib  = Math.round(d.fib);
      d.water = Math.round(d.water * 10) / 10;
    });
    const topFoods = Object.entries(foodFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
    const loggedDays = Object.keys(byDay).length;
    const avgCal = Math.round(Object.values(byDay).reduce((s, d) => s + d.cal, 0) / loggedDays);
    const avgPro = Math.round(Object.values(byDay).reduce((s, d) => s + d.pro, 0) / loggedDays);
    return {
      daysAnalyzed: days,
      daysLogged: loggedDays,
      avgDailyCalories: avgCal,
      avgDailyProtein: `${avgPro}g`,
      topFoods,
      dailySummary: byDay,
    };
  }

  if (toolName === "get_macro_gap") {
    const [{ data: logs }, { data: profile }] = await Promise.all([
      db.from("food_logs").select("name, calories, protein, carbs, fats, fiber, qty").eq("user_id", userId).eq("date", today),
      db.from("user_profiles").select("*").eq("user_id", userId).single(),
    ]);
    if (!profile) return { result: "Profile not set. Cannot calculate targets." };
    await getMedical(ctx, db, userId, profile);
    // Same inputs as Home's StatsBoard, so Coach's numbers match the app.
    const t = calculateTargets(profile, ctx.conditions);
    const totals = sumLogs(logs);
    return {
      goal: profile.goal,
      targets: { calories: t.cals, protein: t.p, carbs: t.c, fats: t.f, fiber: t.fib, water: `${t.water}L` },
      consumed: totals,
      remaining: {
        calories: Math.max(0, t.cals - totals.calories),
        protein: `${Math.max(0, Math.round(t.p - totals.protein))}g`,
        carbs: `${Math.max(0, Math.round(t.c - totals.carbs))}g`,
        fats: `${Math.max(0, Math.round(t.f - totals.fats))}g`,
        fiber: `${Math.max(0, Math.round(t.fib - totals.fiber))}g`,
        water: `${Math.max(0, Math.round((t.water - totals.water) * 10) / 10)}L`,
      },
      medicalAdjustments: [
        ...(t.medical?.conflicts || []).map((c) => `${c.title}: ${c.detail}`),
        ...(t.medical?.adjustments || []).map((a) => `${a.title}: ${a.detail}`),
      ],
    };
  }

  if (toolName === "search_food_database") {
    const q = stripLeadingQty((args.query || "").toLowerCase().trim());
    if (!q) return { result: "No food name given." };
    const foodDb = await getFoodDb(ctx, db, userId);
    const match = matchFood(q, foodDb);
    if (!match) {
      return {
        found: false,
        result: `"${args.query}" is not in the food database or the user's custom foods. If you need it, call save_food_to_database with estimated macros.`,
      };
    }
    const item = foodDb[match];
    const exact = match === q || baseName(match).toLowerCase() === q;
    return {
      found: true,
      food: match,
      source: FLATTENED_DB[match] ? "built-in" : "custom",
      confidence: exact ? "exact" : "estimated",
      per_serving: {
        calories: item.calories,
        protein: `${item.protein}g`,
        carbs: `${item.carbs}g`,
        fats: `${item.fats}g`,
        fiber: `${item.fiber ?? 0}g`,
      },
    };
  }

  if (toolName === "generate_meal_plan") {
    const since = new Date(`${today}T00:00:00Z`);
    since.setUTCDate(since.getUTCDate() - 30);
    const [{ data: logs }, { data: profile }, { data: past }] = await Promise.all([
      db.from("food_logs").select("name, calories, protein, carbs, fats, fiber, qty, meal").eq("user_id", userId).eq("date", today),
      db.from("user_profiles").select("*").eq("user_id", userId).single(),
      db.from("food_logs").select("name, meal").eq("user_id", userId).gte("date", since.toISOString().slice(0, 10)).lt("date", today).limit(2000),
    ]);
    if (!profile) return { result: "Profile not set. Cannot generate a meal plan." };
    await getMedical(ctx, db, userId, profile);

    const t = calculateTargets(profile, ctx.conditions);
    const consumed = sumLogs(logs);
    const remaining = {
      calories: Math.max(0, t.cals - consumed.calories),
      protein: Math.max(0, t.p - consumed.protein),
      carbs: Math.max(0, t.c - consumed.carbs),
      fats: Math.max(0, t.f - consumed.fats),
      fiber: Math.max(0, t.fib - (consumed.fiber || 0)),
    };
    if (remaining.calories < 120) {
      return { result: `Only ${Math.round(remaining.calories)} kcal left today — no full meal needed. A small snack like a fruit or a cup of curd is enough if they're hungry.` };
    }

    const currentMeal = (MEAL_LABELS.includes(ctx.mealHint) && ctx.mealHint) || "Lunch";
    const meals = mealsLeft({
      currentMeal,
      loggedMeals: (logs || []).filter((l) => l.name !== "Water" && l.meal).map((l) => l.meal),
      requested: args.meals_remaining,
    });

    // What they actually eat (last 30 days), and at which meal.
    const history = {};
    for (const l of past || []) {
      const k = String(l.name || "").toLowerCase();
      if (!k || k === "water") continue;
      const h = (history[k] ||= { count: 0, meals: {} });
      h.count++;
      if (l.meal) h.meals[l.meal] = (h.meals[l.meal] || 0) + 1;
    }

    // Candidates: built-in + custom foods, minus diet pattern / allergies /
    // the latest report's "avoid" list.
    const foodDb = await getFoodDb(ctx, db, userId);
    const rules = { dietaryPattern: profile.dietary_pattern, allergies: profile.allergies || [], mustAvoid: ctx.mustAvoid || [] };
    const all = Object.entries(foodDb).filter(([name, item]) => name !== "water" && (item?.calories || 0) > 0);
    const allowed = filterFoodsForProfile(all, rules);
    const active = activeConditionIds(ctx.conditions);
    const { plan, gapAfter } = planMeals({
      candidates: allowed.map(([name, item]) => [name, item, CATEGORY_OF[name] || null]),
      remaining,
      meals,
      history,
      tagFor: (name, item) => foodTag(name, item, active),
    });

    return {
      remainingToday: { calories: Math.round(remaining.calories), protein: `${Math.round(remaining.protein)}g`, fiber: `${Math.round(remaining.fiber)}g` },
      mealsPlanned: meals,
      plan: plan.map((m) => ({
        meal: m.meal,
        targetCalories: m.target,
        items: m.items.map((i) => ({ food: i.food, qty: i.qty, calories: i.calories, protein: `${i.protein}g`, macros: { protein: i.protein, carbs: i.carbs, fats: i.fats, fiber: i.fiber } })),
        totals: { calories: m.totals.calories, protein: `${m.totals.protein}g`, fiber: `${m.totals.fiber}g` },
        why: m.why,
      })),
      afterPlan: { caloriesLeft: gapAfter.calories, proteinLeft: `${gapAfter.protein}g` },
      ...(gapAfter.protein > 15 && {
        proteinNote: `Even with this plan they'd be about ${Math.round(gapAfter.protein)} g short on protein. Suggest one easy add — a bowl of curd or a glass of milk, extra paneer or dal${(rules.dietaryPattern || "") === "veg" || (rules.dietaryPattern || "") === "vegan" || (rules.dietaryPattern || "") === "jain" ? "" : ", eggs"}, or a scoop of whey if they use it.`,
      }),
      rulesApplied: {
        dietaryPattern: rules.dietaryPattern || "none",
        allergies: rules.allergies,
        avoidFromReport: rules.mustAvoid,
        healthFlagsUsed: [...active],
      },
      howToPresent:
        "In the chat, the app shows this plan as cards with 'Log' buttons: reply with a 1–2 sentence summary and the single most useful tip — do not list the plan again. In a voice reply, say it briefly, one short line per meal. Don't add foods that aren't in the plan.",
    };
  }

  if (toolName === "get_weight_trend") {
    const days = Math.min(Math.max(Number(args.days) || 14, 1), 30);
    const start = new Date(); start.setDate(start.getDate() - days);
    const { data } = await db.from("weight_logs").select("date, weight")
      .eq("user_id", userId).gte("date", start.toISOString().slice(0, 10)).order("date", { ascending: true });
    if (!data || data.length === 0) return { result: "No weight logs found. Start logging your weight on the dashboard!" };
    const first = data[0].weight; const last = data[data.length - 1].weight;
    const change = Math.round((last - first) * 10) / 10;
    return { logs: data, summary: { startWeight: `${first}kg`, currentWeight: `${last}kg`, change: `${change > 0 ? "+" : ""}${change}kg over ${days} days`, trend: change < 0 ? "losing" : change > 0 ? "gaining" : "stable" } };
  }

  if (toolName === "get_user_profile") {
    const cached = cacheGet(userId, "get_user_profile");
    if (cached) return cached;

    const { data } = await db.from("user_profiles")
      .select("weight, height, age, gender, activity, goal, calorie_adjustment, protein_priority, target_calories, username, dietary_pattern, allergies, health_conditions")
      .eq("user_id", userId).single();
    if (!data) return { result: "No profile found." };

    const result = { profile: data };
    cacheSet(userId, "get_user_profile", result);
    return result;
  }

  // ── Log a food item to today's diary ──────────────────────────────────────
  if (toolName === "log_food_item") {
    const requested = stripLeadingQty((args.food_name || "").toLowerCase().trim());
    const qty = Math.max(0.1, Math.min(Number(args.qty) || 1, 20)); // clamp 0.1–20 servings
    if (!requested) return { logged: false, error: "No food name provided." };

    // Water is hydration, stored as a "Water" row counted in glasses (same as
    // the home tile and voice). Without this it was unmatched, then saved as a
    // custom food "water" that no water total ever counted.
    if (isWaterPhrase(requested)) {
      // "500 ml" / "1 litre" / "2 glasses" → 250 ml glasses, like voice.
      const glasses = Math.min(20, Math.max(1, Math.round(waterGlasses(Number(args.qty) || 1, args.unit, requested))));
      const meal =
        (MEAL_LABELS.includes(args.meal) && args.meal) ||
        (MEAL_LABELS.includes(ctx.mealHint) && ctx.mealHint) ||
        null;
      const row = {
        id: crypto.randomUUID(), source: "coach", user_id: userId, date: today,
        name: "Water", qty: glasses, calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0,
        ...(meal ? { meal } : {}),
      };
      const err = await insertFoodLogs(db, row);
      if (err) return { logged: false, error: `Failed to log: ${err.message}. Nothing was saved.` };
      return { logged: true, id: row.id, food: "Water", qty: glasses, meal, message: `✅ Logged ${glasses} glass${glasses === 1 ? "" : "es"} of water (250 ml each).` };
    }

    // Same matcher as voice logging: built-in + custom foods, plural-tolerant,
    // and it returns null rather than guess a wrong food.
    const foodDb = await getFoodDb(ctx, db, userId);
    const match = matchFood(requested, foodDb);
    if (!match) {
      return {
        logged: false,
        error:
          `"${args.food_name}" is not in the food database or the user's custom foods, so NOTHING was logged. ` +
          `Do not tell the user it was logged. Call save_food_to_database with estimated macros, ` +
          `then call log_food_item again with the saved name.`,
      };
    }

    const item = foodDb[match];
    const meal =
      (MEAL_LABELS.includes(args.meal) && args.meal) ||
      (MEAL_LABELS.includes(ctx.mealHint) && ctx.mealHint) ||
      null; // null → the app files it by time of day
    // With a unit, read the number in that unit exactly as voice does:
    // "5 almonds" (piece) → half a 10-almond serving; "100 g chicken" → 1 serving
    // of a 100 g entry. Without one, qty is servings.
    const { servings, qty: shownQty } = args.unit
      ? resolveQuantity({ quantity: args.qty, unit: args.unit, foodKey: match })
      : { servings: qty, qty };
    const sv = Math.max(0.05, Math.min(servings, 20));
    const logEntry = {
      id: crypto.randomUUID(), // returned so the Coach receipt can offer an exact Undo
      source: "coach",
      user_id: userId,
      date: today,
      name: match,
      qty: Math.round(shownQty * 100) / 100,
      calories: Math.round((item.calories || 0) * sv),
      protein: r1((item.protein || 0) * sv),
      carbs: r1((item.carbs || 0) * sv),
      fats: r1((item.fats || 0) * sv),
      fiber: r1((item.fiber || 0) * sv),
      ...(meal ? { meal } : {}),
    };

    const insertError = await insertFoodLogs(db, logEntry);
    if (insertError) return { logged: false, error: `Failed to log: ${insertError.message}. Nothing was saved.` };

    return {
      logged: true,
      id: logEntry.id,
      food: match,
      qty: logEntry.qty,
      meal,
      nutrients: {
        calories: logEntry.calories,
        protein: `${logEntry.protein}g`,
        carbs: `${logEntry.carbs}g`,
        fats: `${logEntry.fats}g`,
        fiber: `${logEntry.fiber}g`,
      },
      message: `✅ Logged ${logEntry.qty}${args.unit && /piece|pc/i.test(args.unit) ? "" : "x"} ${match} (${logEntry.calories} kcal)${meal ? ` to ${meal}` : ""}.`,
    };
  }

  if (toolName === "update_goal") {
    const PRESETS = {
      lose:     { calorie_adjustment: -500, protein_priority: "preserve" },
      gain:     { calorie_adjustment:  300, protein_priority: "balanced" },
      maintain: { calorie_adjustment:    0, protein_priority: "balanced" },
      recomp:   { calorie_adjustment:    0, protein_priority: "maximize" },
    };
    const VALID_ACTIVITIES = ["sedentary", "light", "moderate", "active"];
    const VALID_PRIORITIES = ["preserve", "balanced", "maximize"];

    const newGoal     = (args.goal || "custom").toLowerCase().trim();
    const newActivity = args.activity ? args.activity.toLowerCase().trim() : null;
    const explicitTarget = args.target_calories !== undefined && args.target_calories !== null && args.target_calories !== "";
    const newTargetCals = explicitTarget ? Number(args.target_calories) : null;

    // Start from what the user has now, so e.g. "set my activity to moderate"
    // (which still has to pass a goal) doesn't wipe their custom axes or their
    // manual calorie target.
    const { data: current } = await db
      .from("user_profiles")
      .select("goal, calorie_adjustment, protein_priority, target_calories")
      .eq("user_id", userId)
      .maybeSingle();
    const preset = PRESETS[newGoal] || null;
    const goalChanged = !current || newGoal !== current.goal;

    const newAdj = args.calorie_adjustment !== undefined
      ? Number(args.calorie_adjustment)
      : preset && goalChanged
        ? preset.calorie_adjustment
        : Number(current?.calorie_adjustment ?? preset?.calorie_adjustment ?? 0);
    const newPriority = args.protein_priority
      ? args.protein_priority
      : preset && goalChanged
        ? preset.protein_priority
        : current?.protein_priority || preset?.protein_priority || "balanced";

    // ── Validate ──────────────────────────────────────────────────────────
    if (newAdj < -700 || newAdj > 500) {
      return { error: `calorie_adjustment ${newAdj} is out of range (−700 to +500).` };
    }
    if (!VALID_PRIORITIES.includes(newPriority)) {
      return { error: `Invalid protein_priority "${newPriority}". Must be: preserve, balanced, maximize.` };
    }
    if (newActivity && !VALID_ACTIVITIES.includes(newActivity)) {
      return { error: `Invalid activity "${newActivity}". Must be: sedentary, light, moderate, active.` };
    }
    if (newTargetCals !== null && (newTargetCals < 800 || newTargetCals > 6000)) {
      return { error: `target_calories ${newTargetCals} is out of safe range (800–6000).` };
    }

    // Manual target: set when given; cleared when the goal/deficit changes (so
    // the new goal actually takes effect); otherwise left as it is.
    const clearTarget = !explicitTarget && (goalChanged || args.calorie_adjustment !== undefined);
    const effectiveTarget = explicitTarget ? newTargetCals : clearTarget ? null : current?.target_calories ?? null;

    const updatePayload = {
      goal: newGoal,
      calorie_adjustment: newAdj,
      protein_priority: newPriority,
      updated_at: new Date().toISOString(),
    };
    if (explicitTarget || clearTarget) updatePayload.target_calories = effectiveTarget;
    if (newActivity) updatePayload.activity = newActivity;

    const { error: updateError } = await db
      .from("user_profiles")
      .update(updatePayload)
      .eq("user_id", userId);
    if (updateError) return { error: `Failed to update goal: ${updateError.message}` };

    cacheInvalidate(userId, "get_user_profile");

    await db.from("goal_history").insert({
      user_id: userId,
      goal: newGoal,
      calorie_adjustment: newAdj,
      protein_priority: newPriority,
      activity: newActivity || undefined,
      target_calories: effectiveTarget,
      effective_from: today,
    });

    const PRIORITY_LABELS = {
      preserve: "2.0g/kg protein (muscle preservation)",
      balanced: "1.8g/kg protein (balanced)",
      maximize: "2.4g/kg protein (maximum muscle synthesis)",
    };
    const adjLabel = effectiveTarget
      ? `${effectiveTarget} kcal/day (manual)`
      : newAdj === 0 ? "TDEE (maintenance calories)"
      : newAdj > 0  ? `TDEE +${newAdj} kcal (surplus)`
      :                `TDEE ${newAdj} kcal (deficit)`;

    return {
      updated: true,
      goal: newGoal,
      calorie_adjustment: newAdj,
      protein_priority: newPriority,
      summary: { calories: adjLabel, protein: PRIORITY_LABELS[newPriority] },
      message: `✅ Goal updated. Calories: ${adjLabel}. Protein: ${PRIORITY_LABELS[newPriority]}.`,
    };
  }

  // ── Logging streak — same rule as Home (lives through "not logged yet today")
  if (toolName === "get_streak") {
    // Same 120-day window as Home's calculateStreak, so long streaks match.
    const windowStart = shiftDay(today, -120);
    const { data } = await db.from("food_logs")
      .select("date")
      .eq("user_id", userId)
      .gte("date", windowStart)
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(10000);

    const uniqueDates = [...new Set((data || []).map((l) => l.date))];
    // Same rule as Home (lib/streak.js): one forgiven rest day per week.
    const { streak, loggedToday, restDays, restLeftThisWeek } = computeStreak(uniqueDates, today);
    if (!streak) {
      return { streak: 0, message: "No active streak — log today's food to start one!", daysLoggedLast120: uniqueDates.length };
    }
    const emoji = streak >= 7 ? "🔥" : streak >= 3 ? "⚡" : "📅";
    return {
      streak,
      loggedToday,
      restDaysUsed: restDays,
      restDaysLeftThisWeek: restLeftThisWeek,
      message:
        `${emoji} ${streak}-day streak!` +
        (loggedToday ? "" : " Nothing logged yet today — log something to keep it going."),
      daysLoggedLast120: uniqueDates.length,
    };
  }

  // ── Save food to custom database ──────────────────────────────────────────
  if (toolName === "save_food_to_database") {
    const name = (args.name || "").toLowerCase().trim();
    if (!name) return { error: "No food name provided." };

    // Already known (built-in or custom) under this exact name? Point the model
    // at the existing entry instead of creating a near-duplicate.
    const foodDb = await getFoodDb(ctx, db, userId);
    const existingKey = foodDb[name]
      ? name
      : Object.keys(foodDb).find((k) => baseName(k).toLowerCase() === name);
    if (existingKey) {
      return {
        already_exists: true,
        food: existingKey,
        message: `"${existingKey}" already exists — use that exact name with log_food_item.`,
      };
    }

    const newFood = {
      user_id: userId,
      name,
      calories: Math.round(Number(args.calories) || 0),
      protein: r1(args.protein),
      carbs: r1(args.carbs),
      fats: r1(args.fats),
      fiber: r1(args.fiber),
    };

    const { error: insertError } = await db.from("custom_foods").insert([newFood]);
    if (insertError) return { error: `Failed to save food: ${insertError.message}` };

    // Make it visible to log_food_item / search later in this same request.
    foodDb[name] = newFood;

    return {
      saved: true,
      food: name,
      nutrients: {
        calories: newFood.calories,
        protein: `${newFood.protein}g`,
        carbs: `${newFood.carbs}g`,
        fats: `${newFood.fats}g`,
        fiber: `${newFood.fiber}g`,
      },
      message: `✅ "${name}" saved to the user's custom foods. To log it, call log_food_item with food_name "${name}".`,
    };
  }

  // ── Medical context from uploaded reports ────────────────────────────────
  if (toolName === "get_medical_context") {
    // The cache used to be trusted for 60 minutes, so a report uploaded mid-
    // conversation was invisible to Coach for up to an hour. Now a cheap
    // fingerprint (newest report id + count — no analysis text) is checked
    // first; any upload or deletion changes it and forces a rebuild.
    const { data: newest, count } = await db
      .from("medical_reports")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    const fingerprint = `${count ?? 0}:${newest?.[0]?.id ?? "none"}`;
    const cached = cacheGet(userId, "get_medical_context");
    if (cached && cached.fingerprint === fingerprint) return cached.result;

    const { data: reports, error } = await db
      .from("medical_reports")
      .select("file_name, created_at, flags, include_foods, exclude_foods, trends, analysis")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !reports || reports.length === 0) {
      return { result: "No medical reports found. The user has not uploaded any blood test or health reports yet." };
    }

    const summary = reports.map((r, i) => {
      const date = new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      const abnormal = (r.flags || []).filter((f) => f.status !== "normal");
      const normal   = (r.flags || []).filter((f) => f.status === "normal");
      return {
        report: i === 0 ? `Latest — ${r.file_name} (${date})` : `Report ${i + 1} — ${r.file_name} (${date})`,
        abnormalMarkers: abnormal.map((f) => `${f.marker}: ${f.value} [${f.status.toUpperCase()}] — ${f.note}`),
        normalMarkers:   normal.map((f)   => `${f.marker}: ${f.value}`),
        includeInDiet:   (r.include_foods || []).map((f) => `${f.food} — ${f.reason}`),
        avoidInDiet:     (r.exclude_foods || []).map((f) => `${f.food} — ${f.reason}`),
        trends:          (r.trends || []).map((t) => `${t.marker}: ${t.previous} → ${t.current} (${t.direction}) — ${t.note}`),
        analysisSummary: r.analysis?.slice(0, 400) || "",
      };
    });

    const latest = reports[0];
    const dietaryProfile = {
      mustInclude: (latest.include_foods || []).map((f) => f.food),
      mustAvoid:   (latest.exclude_foods || []).map((f) => f.food),
      criticalFlags: (latest.flags || [])
        .filter((f) => f.status === "high" || f.status === "low")
        .map((f) => `${f.marker} is ${f.status} (${f.value})`),
    };

    const medicalResult = {
      totalReports: reports.length,
      latestReportDate: new Date(reports[0].created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      dietaryProfile,
      allReports: summary,
      instruction: "Use this medical context to personalise all food suggestions. Prioritise including foods from mustInclude and strictly avoid foods in mustAvoid. Reference specific markers when explaining dietary advice.",
    };
    cacheSet(userId, "get_medical_context", { fingerprint, result: medicalResult });
    return medicalResult;
  }

  // ── Web search ────────────────────────────────────────────────────────────
  if (toolName === "search_web") {
    const query = (args.query || "").trim().slice(0, 400);
    if (!query) return { error: "No search query provided." };

    if (process.env.SERPER_API_KEY) {
      try {
        const res = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ q: query, num: 5, gl: "in" }),
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        const results = (data.organic || []).slice(0, 5).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet }));
        const answerBox = data.answerBox?.answer || data.answerBox?.snippet || null;
        return { query, source: "Google", answerBox, results };
      } catch (err) {
        console.warn("[search_web] Serper failed:", err.message);
      }
    }

    try {
      const ddUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
      const res = await fetch(ddUrl, { signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      const topics = (data.RelatedTopics || [])
        .slice(0, 5)
        .map((t) => (t.Text ? { title: t.Text.slice(0, 80), snippet: t.Text } : null))
        .filter(Boolean);
      return {
        query,
        source: "DuckDuckGo",
        answerBox: data.Answer || data.AbstractText || null,
        results: topics,
        note: "Limited results — add SERPER_API_KEY env var for full Google Search.",
      };
    } catch (err) {
      return { error: `Search failed: ${err.message}. Try rephrasing or use your training knowledge.` };
    }
  }

  return { error: `Unknown tool: ${toolName}` };
}
