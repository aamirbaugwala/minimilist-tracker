import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { FLATTENED_DB } from "../../food-data";
import { calculateTargets } from "../../lib/nutrition";

// ─── RATE LIMITER (in-memory, per user, max 20 req/min) ──────────────────────
const rateLimitMap = new Map(); // userId → { count, resetAt }
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(userId) {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ─── INPUT SANITIZER ─────────────────────────────────────────────────────────
function sanitizeMessage(msg) {
  if (typeof msg !== "string") return "";
  // Strip HTML tags, trim, cap at 1000 chars
  return msg.replace(/<[^>]*>/g, "").trim().slice(0, 1000);
}

// ─── SUPABASE CLIENT (user JWT, respects RLS) ─────────────────────────────────
function getSupabaseForUser(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}

const tools = [
  {
    functionDeclarations: [
      {
        name: "get_todays_logs",
        description: "Fetches the user's food and water logs for today. Call this when the user asks about what they ate today, their current calorie/macro/water status, or whether they hit any target today.",
        parameters: { type: "OBJECT", properties: {}, required: [] },
      },
      {
        name: "get_logs_for_days",
        description: "Fetches the user's food logs for the last N days (1-30). Use this for trend analysis, weekly reviews, or when the user asks about patterns over time.",
        parameters: {
          type: "OBJECT",
          properties: { days: { type: "NUMBER", description: "Number of past days to fetch logs for. Min 1, max 30." } },
          required: ["days"],
        },
      },
      {
        name: "get_macro_gap",
        description: "Calculates how much protein, carbs, fats, fiber, and calories the user still needs to hit TODAY's targets. Returns remaining amounts. Call this when the user asks what they should eat next or if they are close to their goal.",
        parameters: { type: "OBJECT", properties: {}, required: [] },
      },
      {
        name: "search_food_database",
        description: "Searches the internal food database for a food item and returns its nutritional data per serving. Use this to answer 'how many calories in X?' or to find food options that fit the user's macro gap.",
        parameters: {
          type: "OBJECT",
          properties: { query: { type: "STRING", description: "The food item name to search for (e.g. 'chicken tikka', 'dal fry', 'banana')." } },
          required: ["query"],
        },
      },
      {
        name: "get_weight_trend",
        description: "Fetches the user's weight log history for the past N days. Use this when the user asks about their weight progress, whether they are losing/gaining weight, or for body composition trend analysis.",
        parameters: {
          type: "OBJECT",
          properties: { days: { type: "NUMBER", description: "Number of past days to fetch weight logs for." } },
          required: ["days"],
        },
      },
      {
        name: "get_user_profile",
        description: "Fetches the user's profile: weight, height, age, gender, activity level, and goal (lose/gain/maintain). Use this when you need to calculate targets or personalise advice.",
        parameters: { type: "OBJECT", properties: {}, required: [] },
      },
      {
        name: "log_food_item",
        description: "Logs a food item to the user's diary for today. Use this ONLY when the user explicitly asks to log or add a food (e.g. 'log 2 rotis', 'add chicken biryani to my diary'). Always confirm with the user what you logged.",
        parameters: {
          type: "OBJECT",
          properties: {
            food_name: { type: "STRING", description: "The exact name of the food item to log." },
            qty: { type: "NUMBER", description: "Number of servings to log (e.g. 1, 2, 0.5)." },
          },
          required: ["food_name", "qty"],
        },
      },
      {
        name: "get_streak",
        description: "Calculates how many consecutive days the user has logged food. Use this when the user asks about their streak, consistency, or habit tracking.",
        parameters: { type: "OBJECT", properties: {}, required: [] },
      },
      {
        name: "generate_meal_plan",
        description: "Generates a personalised meal plan for the rest of the day using the user's real macro gap and the food database. Call this when the user asks for a meal plan, meal suggestions, or what to eat for the rest of the day. Always call get_macro_gap first to know the remaining targets.",
        parameters: {
          type: "OBJECT",
          properties: {
            meals_remaining: {
              type: "NUMBER",
              description: "How many meals the user has left today (e.g. 1, 2, 3). Default to 2 if not specified.",
            },
          },
          required: [],
        },
      },
      {
        name: "update_goal",
        description: "Updates the user's fitness goal in their profile. Use this ONLY when the user explicitly says they want to change their goal. Always fetch the current profile first with get_user_profile, then confirm the change in your reply with the new targets. You can set a preset goal (which auto-fills calorie_adjustment and protein_priority), or set the two axes directly for precise custom goals.",
        parameters: {
          type: "OBJECT",
          properties: {
            goal: {
              type: "STRING",
              description: "Display label. Use a preset id ('lose', 'gain', 'maintain', 'recomp') OR 'custom' when setting exact values. Presets: lose=−500kcal+preserve protein, gain=+300kcal+balanced, maintain=0+balanced, recomp=0+maximize protein.",
            },
            calorie_adjustment: {
              type: "NUMBER",
              description: "kcal delta from TDEE. Range −700 to +500. Negative=deficit, 0=TDEE, positive=surplus. Use for nuanced requests like 'slight cut' (−250), 'gentle bulk' (+200). Presets auto-set this — only provide when overriding or going custom.",
            },
            protein_priority: {
              type: "STRING",
              description: "'preserve' (2.0g/kg — protect muscle in a deficit), 'balanced' (1.8g/kg — standard), 'maximize' (2.4g/kg — recomp or aggressive build). Presets auto-set this — only provide when going custom.",
            },
            activity: {
              type: "STRING",
              description: "New activity level: 'sedentary', 'light', 'moderate', or 'active'. Only include if user mentioned changing activity.",
            },
            target_calories: {
              type: "NUMBER",
              description: "Hard manual calorie ceiling. Overrides TDEE+adjustment entirely. Only set when user explicitly names a number ('set my calories to 1800').",
            },
          },
          required: ["goal"],
        },
      },
      {
        name: "save_food_to_database",
        description: "Saves a food item with its nutritional data to the user's custom food database so it can be logged later. Call this automatically for EVERY food item you mention in a meal plan that does NOT already exist in the internal food database. Provide your best estimated macros per serving based on standard nutritional knowledge.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", description: "The food name, lowercase (e.g. 'grilled paneer', 'oats with milk')." },
            calories: { type: "NUMBER", description: "Estimated calories per serving." },
            protein: { type: "NUMBER", description: "Estimated protein in grams per serving." },
            carbs: { type: "NUMBER", description: "Estimated carbohydrates in grams per serving." },
            fats: { type: "NUMBER", description: "Estimated fats in grams per serving." },
            fiber: { type: "NUMBER", description: "Estimated fiber in grams per serving." },
          },
          required: ["name", "calories", "protein", "carbs", "fats", "fiber"],
        },
      },
      {
        name: "get_medical_context",
        description: "Fetches the user's medical report history from their uploaded blood tests and health reports. Returns all reports with their flagged markers (e.g. high HbA1c, low Vitamin D), dietary recommendations (foods to include/avoid), and longitudinal trends across reports. Call this when: the user asks about their health conditions, blood work, or medical diet advice; you are generating a meal plan and want to personalise it to their medical profile; or the user mentions any health condition, marker, or medication.",
        parameters: { type: "OBJECT", properties: {}, required: [] },
      },
    ],
  },
];

async function executeTool(toolName, args, userId, db) {
  const today = new Date().toISOString().slice(0, 10);

  if (toolName === "get_todays_logs") {
    const { data } = await db.from("food_logs")
      .select("name, calories, protein, carbs, fats, fiber, qty")
      .eq("user_id", userId).eq("date", today).order("created_at", { ascending: true });
    if (!data || data.length === 0) return { result: "No food logs found for today yet." };
    const totals = data.reduce((acc, l) => ({
      calories: acc.calories + (l.calories || 0), protein: acc.protein + (l.protein || 0),
      carbs: acc.carbs + (l.carbs || 0), fats: acc.fats + (l.fats || 0),
      fiber: acc.fiber + (l.fiber || 0),
      water: l.name === "Water" ? acc.water + l.qty * 0.25 : acc.water,
    }), { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, water: 0 });
    return { logs: data.map((l) => ({ food: l.name, qty: l.qty, calories: l.calories, protein: l.protein, carbs: l.carbs, fats: l.fats, fiber: l.fiber || 0 })), totals };
  }

  if (toolName === "get_logs_for_days") {
    const days = Math.min(Math.max(Number(args.days) || 7, 1), 30);
    const start = new Date(); start.setDate(start.getDate() - days);
    const { data } = await db.from("food_logs")
      .select("date, name, calories, protein, carbs, fats, fiber, qty")
      .eq("user_id", userId).gte("date", start.toISOString().slice(0, 10)).order("date", { ascending: true });
    if (!data || data.length === 0) return { result: `No logs found for the past ${days} days.` };
    const byDay = {};
    data.forEach((l) => {
      if (!byDay[l.date]) byDay[l.date] = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, water: 0, items: [] };
      byDay[l.date].calories += l.calories || 0; byDay[l.date].protein += l.protein || 0;
      byDay[l.date].carbs += l.carbs || 0; byDay[l.date].fats += l.fats || 0; byDay[l.date].fiber += l.fiber || 0;
      if (l.name === "Water") byDay[l.date].water += l.qty * 0.25;
      byDay[l.date].items.push(l.name);
    });
    return { dailySummary: byDay, daysAnalyzed: days };
  }

  if (toolName === "get_macro_gap") {
    const [{ data: logs }, { data: profile }] = await Promise.all([
      db.from("food_logs").select("name, calories, protein, carbs, fats, fiber, qty").eq("user_id", userId).eq("date", today),
      db.from("user_profiles").select("*").eq("user_id", userId).single(),
    ]);
    if (!profile) return { result: "Profile not set. Cannot calculate targets." };
    const { cals: targetCals, p: targetP, c: targetC, f: targetF, fib: targetFib, water: targetWater } = calculateTargets(profile);
    const totals = (logs || []).reduce((acc, l) => ({
      calories: acc.calories + (l.calories || 0), protein: acc.protein + (l.protein || 0),
      carbs: acc.carbs + (l.carbs || 0), fats: acc.fats + (l.fats || 0), fiber: acc.fiber + (l.fiber || 0),
      water: l.name === "Water" ? acc.water + l.qty * 0.25 : acc.water,
    }), { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, water: 0 });
    return {
      goal: profile.goal,
      targets: { calories: targetCals, protein: targetP, carbs: targetC, fats: targetF, fiber: targetFib, water: `${targetWater}L` },
      consumed: totals,
      remaining: {
        calories: Math.max(0, targetCals - totals.calories),
        protein: `${Math.max(0, Math.round(targetP - totals.protein))}g`,
        carbs: `${Math.max(0, Math.round(targetC - totals.carbs))}g`,
        fats: `${Math.max(0, Math.round(targetF - totals.fats))}g`,
        fiber: `${Math.max(0, Math.round(targetFib - totals.fiber))}g`,
        water: `${Math.max(0, Math.round((targetWater - totals.water) * 10) / 10)}L`,
      },
    };
  }

  if (toolName === "search_food_database") {
    const q = (args.query || "").toLowerCase().trim();
    const keys = Object.keys(FLATTENED_DB).sort((a, b) => b.length - a.length);

    // Exact match first
    const exactMatch = keys.find((k) => k === q);
    // Partial match (query included in key or key included in query)
    const partialMatch = !exactMatch && keys.find((k) => k.includes(q) || q.includes(k));
    const match = exactMatch || partialMatch;

    if (!match) return { result: `"${args.query}" not found in the food database. Try a simpler name.` };
    const item = FLATTENED_DB[match];
    const confidence = exactMatch ? "exact" : "estimated"; // ← confidence signal
    return {
      food: match,
      confidence,
      per_serving: {
        calories: item.calories,
        protein: `${item.protein}g`,
        carbs: `${item.carbs}g`,
        fats: `${item.fats}g`,
        fiber: `${item.fiber}g`,
      },
    };
  }

  if (toolName === "generate_meal_plan") {
    // Step 1: fetch profile + today's logs to compute macro gap
    const [{ data: logs }, { data: profile }] = await Promise.all([
      db.from("food_logs").select("name, calories, protein, carbs, fats, fiber, qty").eq("user_id", userId).eq("date", today),
      db.from("user_profiles").select("*").eq("user_id", userId).single(),
    ]);
    if (!profile) return { result: "Profile not set. Cannot generate a meal plan." };

    // Compute targets via shared lib/nutrition
    const { cals: targetCals, p: targetP, c: targetC, f: targetF } = calculateTargets(profile);

    const consumed = (logs || []).reduce(
      (acc, l) => ({
        calories: acc.calories + (l.calories || 0),
        protein: acc.protein + (l.protein || 0),
        carbs: acc.carbs + (l.carbs || 0),
        fats: acc.fats + (l.fats || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );

    const remaining = {
      calories: Math.max(0, targetCals - consumed.calories),
      protein: Math.max(0, targetP - consumed.protein),
      carbs: Math.max(0, targetC - consumed.carbs),
      fats: Math.max(0, targetF - consumed.fats),
    };

    if (remaining.calories < 50) {
      return { result: "You've already hit your calorie target for today! Great job. No meal plan needed." };
    }

    const mealsLeft = Math.max(1, Math.min(Number(args.meals_remaining) || 2, 5));
    const calsPerMeal = Math.round(remaining.calories / mealsLeft);
    const proteinPerMeal = Math.round(remaining.protein / mealsLeft);

    // Step 2: Score every food in the DB and pick the best fit per meal slot
    const allFoods = Object.entries(FLATTENED_DB);
    // Score = how close calories + protein are to per-meal targets (lower = better)
    const scored = allFoods.map(([name, item]) => {
      const calDiff = Math.abs(item.calories - calsPerMeal);
      const proteinScore = item.protein >= proteinPerMeal * 0.3 ? 0 : 50; // reward protein-rich foods
      const score = calDiff + proteinScore;
      return { name, item, score };
    }).sort((a, b) => a.score - b.score);

    // Pick distinct foods for each meal slot (no repeats)
    const used = new Set();
    const meals = [];
    for (let slot = 0; slot < mealsLeft; slot++) {
      const pick = scored.find((f) => !used.has(f.name));
      if (!pick) break;
      used.add(pick.name);
      meals.push({
        meal: `Meal ${slot + 1}`,
        food: pick.name,
        qty: 1,
        calories: pick.item.calories,
        protein: `${pick.item.protein}g`,
        carbs: `${pick.item.carbs}g`,
        fats: `${pick.item.fats}g`,
      });
    }

    const totalPlanned = meals.reduce((s, m) => ({ cal: s.cal + m.calories, pro: s.pro + parseFloat(m.protein) }), { cal: 0, pro: 0 });

    return {
      goal: profile.goal,
      remainingToFill: remaining,
      mealsLeft,
      plan: meals,
      summary: {
        totalCaloriesPlanned: totalPlanned.cal,
        totalProteinPlanned: `${Math.round(totalPlanned.pro)}g`,
        calorieGapAfterPlan: Math.max(0, remaining.calories - totalPlanned.cal),
      },
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
    const { data } = await db.from("user_profiles")
      .select("weight, height, age, gender, activity, goal, calorie_adjustment, protein_priority, target_calories, username")
      .eq("user_id", userId).single();
    if (!data) return { result: "No profile found." };
    return { profile: data };
  }

  // ── NEW: Log a food item directly to the diary ─────────────────────────────
  if (toolName === "log_food_item") {
    const foodName = (args.food_name || "").toLowerCase().trim();
    const qty = Math.max(0.1, Math.min(Number(args.qty) || 1, 20)); // clamp 0.1–20 servings
    if (!foodName) return { error: "No food name provided." };

    // Look up the food in the database
    const keys = Object.keys(FLATTENED_DB).sort((a, b) => b.length - a.length);
    const match = keys.find((k) => k.includes(foodName) || foodName.includes(k));
    if (!match) return { error: `"${args.food_name}" not found in the food database. Ask the user to log it manually.` };

    const item = FLATTENED_DB[match];
    const scale = qty;
    const logEntry = {
      user_id: userId,
      date: today,
      name: match,
      qty,
      calories: Math.round((item.calories || 0) * scale),
      protein: Math.round((item.protein || 0) * scale * 10) / 10,
      carbs: Math.round((item.carbs || 0) * scale * 10) / 10,
      fats: Math.round((item.fats || 0) * scale * 10) / 10,
      fiber: Math.round((item.fiber || 0) * scale * 10) / 10,
    };

    const { error: insertError } = await db.from("food_logs").insert(logEntry);
    if (insertError) return { error: `Failed to log: ${insertError.message}` };

    return {
      logged: true,
      food: match,
      qty,
      nutrients: {
        calories: logEntry.calories,
        protein: `${logEntry.protein}g`,
        carbs: `${logEntry.carbs}g`,
        fats: `${logEntry.fats}g`,
        fiber: `${logEntry.fiber}g`,
      },
      message: `✅ Logged ${qty}x ${match} (${logEntry.calories} kcal) to today's diary.`,
    };
  }

  // ── Update goal (two-axis model) ──────────────────────────────────────────
  if (toolName === "update_goal") {
    // Preset definitions — mirror GOAL_PRESETS in nutrition.js
    const PRESETS = {
      lose:     { calorie_adjustment: -500, protein_priority: "preserve" },
      gain:     { calorie_adjustment:  300, protein_priority: "balanced" },
      maintain: { calorie_adjustment:    0, protein_priority: "balanced" },
      recomp:   { calorie_adjustment:    0, protein_priority: "maximize" },
    };
    const VALID_ACTIVITIES = ["sedentary", "light", "moderate", "active"];
    const VALID_PRIORITIES = ["preserve", "balanced", "maximize"];

    const newGoal    = (args.goal || "custom").toLowerCase().trim();
    const newActivity = args.activity ? args.activity.toLowerCase().trim() : null;
    const newTargetCals = args.target_calories ? Number(args.target_calories) : null;

    // If a preset, auto-fill axes (agent can still override with explicit args)
    const preset = PRESETS[newGoal] || null;
    const newAdj = args.calorie_adjustment !== undefined
      ? Number(args.calorie_adjustment)
      : (preset ? preset.calorie_adjustment : 0);
    const newPriority = args.protein_priority
      ? args.protein_priority
      : (preset ? preset.protein_priority : "balanced");

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

    // ── Build payload ─────────────────────────────────────────────────────
    const updatePayload = {
      goal: newGoal,
      calorie_adjustment: newAdj,
      protein_priority: newPriority,
      target_calories: newTargetCals, // null = auto-calculate
      updated_at: new Date().toISOString(),
    };
    if (newActivity) updatePayload.activity = newActivity;

    const { error: updateError } = await db
      .from("user_profiles")
      .update(updatePayload)
      .eq("user_id", userId);

    if (updateError) return { error: `Failed to update goal: ${updateError.message}` };

    // Snapshot for goal_history so past days retain their original targets
    await db.from("goal_history").insert({
      user_id: userId,
      goal: newGoal,
      calorie_adjustment: newAdj,
      protein_priority: newPriority,
      activity: newActivity || undefined,
      target_calories: newTargetCals,
      effective_from: today,
    });

    const PRIORITY_LABELS = {
      preserve: "2.0g/kg protein (muscle preservation)",
      balanced: "1.8g/kg protein (balanced)",
      maximize: "2.4g/kg protein (maximum muscle synthesis)",
    };

    const adjLabel = newTargetCals
      ? `${newTargetCals} kcal/day (manual)`
      : newAdj === 0 ? "TDEE (maintenance calories)"
      : newAdj > 0  ? `TDEE +${newAdj} kcal (surplus)`
      :                `TDEE ${newAdj} kcal (deficit)`;

    return {
      updated: true,
      goal: newGoal,
      calorie_adjustment: newAdj,
      protein_priority: newPriority,
      summary: {
        calories: adjLabel,
        protein: PRIORITY_LABELS[newPriority],
      },
      message: `✅ Goal updated. Calories: ${adjLabel}. Protein: ${PRIORITY_LABELS[newPriority]}.`,
    };
  }

  // ── NEW: Logging streak ────────────────────────────────────────────────────
  if (toolName === "get_streak") {
    const { data } = await db.from("food_logs")
      .select("date")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(60); // look back max 60 days

    if (!data || data.length === 0) return { streak: 0, message: "No logs yet. Start today to build your streak! 🔥" };

    // Get unique dates, sorted descending
    const uniqueDates = [...new Set(data.map((l) => l.date))].sort((a, b) => b.localeCompare(a));
    const todayStr = today;
    let streak = 0;
    let checkDate = new Date(todayStr);

    for (const dateStr of uniqueDates) {
      const expected = checkDate.toISOString().slice(0, 10);
      if (dateStr === expected) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    const emoji = streak >= 7 ? "🔥" : streak >= 3 ? "⚡" : "📅";
    return {
      streak,
      message: streak === 0
        ? "No active streak — log today's food to start one!"
        : `${emoji} ${streak}-day streak! You've logged food for ${streak} consecutive day${streak > 1 ? "s" : ""}.`,
      longestStreakInWindow: uniqueDates.length,
    };
  }

  // ── Save food to custom database ──────────────────────────────────────────
  if (toolName === "save_food_to_database") {
    const name = (args.name || "").toLowerCase().trim();
    if (!name) return { error: "No food name provided." };

    // Don't duplicate if it already exists in the built-in DB
    const builtInKeys = Object.keys(FLATTENED_DB);
    if (builtInKeys.some((k) => k.includes(name) || name.includes(k))) {
      return { already_exists: true, food: name, message: `"${name}" already exists in the food database.` };
    }

    // Check for existing custom entry (avoid duplicates)
    const { data: existing } = await db
      .from("custom_foods")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", name)
      .maybeSingle();

    if (existing) {
      return { already_exists: true, food: name, message: `"${name}" is already in your custom foods.` };
    }

    const newFood = {
      user_id: userId,
      name,
      calories: Math.round(Number(args.calories) || 0),
      protein: Math.round((Number(args.protein) || 0) * 10) / 10,
      carbs: Math.round((Number(args.carbs) || 0) * 10) / 10,
      fats: Math.round((Number(args.fats) || 0) * 10) / 10,
      fiber: Math.round((Number(args.fiber) || 0) * 10) / 10,
    };

    const { error: insertError } = await db.from("custom_foods").insert([newFood]);
    if (insertError) return { error: `Failed to save food: ${insertError.message}` };

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
      message: `✅ "${name}" saved to your custom food database and is now searchable.`,
    };
  }

  // ── Medical context from uploaded reports ────────────────────────────────
  if (toolName === "get_medical_context") {
    const { data: reports, error } = await db
      .from("medical_reports")
      .select("file_name, created_at, flags, include_foods, exclude_foods, trends, analysis")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !reports || reports.length === 0) {
      return { result: "No medical reports found. The user has not uploaded any blood test or health reports yet." };
    }

    // Build a structured summary across all reports
    const summary = reports.map((r, i) => {
      const date = new Date(r.created_at).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      });

      // Separate markers by status for quick scanning
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

    // Latest report's dietary rules — most actionable for meal planning
    const latest = reports[0];
    const dietaryProfile = {
      mustInclude: (latest.include_foods || []).map((f) => f.food),
      mustAvoid:   (latest.exclude_foods || []).map((f) => f.food),
      criticalFlags: (latest.flags || [])
        .filter((f) => f.status === "high" || f.status === "low")
        .map((f) => `${f.marker} is ${f.status} (${f.value})`),
    };

    return {
      totalReports: reports.length,
      latestReportDate: new Date(reports[0].created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      dietaryProfile,
      allReports: summary,
      instruction: "Use this medical context to personalise all food suggestions. Prioritise including foods from mustInclude and strictly avoid foods in mustAvoid. Reference specific markers when explaining dietary advice.",
    };
  }

  return { error: `Unknown tool: ${toolName}` };
}

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API Key missing" }, { status: 500 });

    const body = await req.json();
    const { history, userId, accessToken } = body;
    const message = sanitizeMessage(body.message);

    // ── Validation ─────────────────────────────────────────────────────────
    if (!userId || !accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!message) {
      return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
    }
    if (message.length > 1000) {
      return NextResponse.json({ error: "Message too long. Max 1000 characters." }, { status: 400 });
    }
    if (!Array.isArray(history)) {
      return NextResponse.json({ error: "Invalid history format." }, { status: 400 });
    }

    // ── Rate limit ──────────────────────────────────────────────────────────
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment before sending again." },
        { status: 429 }
      );
    }

    const db = getSupabaseForUser(accessToken);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      tools,
      systemInstruction: `You are NutriCoach, an elite AI nutrition agent built into the NutriTrack app.

You have live access to the user's real food logs, weight history, nutritional targets, and medical reports through tools.
ALWAYS call tools to get real data before giving advice — never guess or invent numbers.

Personality: Direct, motivating, science-backed. Use emojis sparingly. Keep responses under 150 words unless doing a full analysis. Always reference the user's ACTUAL data. Prefer Indian food suggestions (dal, roti, biryani, paneer, etc.) or user's food history.

Tool rules:
- "What should I eat?" → call get_macro_gap FIRST, then get_medical_context in PARALLEL, then generate_meal_plan
- "Give me a meal plan" / "Plan my meals" → call generate_meal_plan AND get_medical_context in PARALLEL (generate_meal_plan auto-fetches the macro gap)
- "How am I doing this week?" → get_logs_for_days with days=7
- "How many calories in X?" → search_food_database. If confidence is "estimated", say "approximately" and mention values may vary slightly.
- "Am I losing weight?" → get_weight_trend
- "Log X" or "Add X to my diary" → log_food_item (confirm what was logged)
- "What's my streak?" → get_streak
- "Change my goal to X" / "Switch to bulking" / "I want to lose weight" / "I want a slight cut" / "Set calories to N" / "I want to lose fat and build muscle" → ALWAYS call get_user_profile first, then call update_goal. For presets use goal='lose'/'gain'/'maintain'/'recomp'. For nuanced requests ('slight cut', 'aggressive deficit', 'gentle bulk') set goal='custom' with explicit calorie_adjustment and protein_priority values. Confirm the change and explain the new targets.
- User mentions any health condition, blood marker, symptom, or medication → call get_medical_context to check their report history before responding.
- User asks about their health, blood test, medical reports, diet restrictions, or what foods are good/bad for them → call get_medical_context.
- Call multiple tools in one turn when needed
- NEVER log food without the user explicitly asking you to
- NEVER change the goal without the user explicitly asking you to

Medical context rules (get_medical_context):
- When medical context is available, ALWAYS cross-reference meal plans and food suggestions against mustInclude and mustAvoid lists.
- If a food in the default meal plan conflicts with a medical restriction (e.g. high-sugar food for a diabetic), replace it with a compliant alternative.
- When explaining why you chose a food, mention the relevant marker (e.g. "oats are included because your HbA1c is elevated — they help with blood sugar control").
- If the user has critical flags (high/low markers), proactively mention the relevant dietary advice even if they didn't ask.

CRITICAL — save_food_to_database rule:
- Whenever you recommend or mention a specific food item in a meal plan or suggestion, you MUST call save_food_to_database for each food that is NOT already in the internal database.
- Use your nutritional knowledge to estimate accurate macros per serving.
- Call save_food_to_database in PARALLEL with your other tool calls — do not wait for a separate turn.
- This ensures the user can tap to log any food you suggest directly from the app.`,
    });

    const geminiHistory = history.slice(-20).map((msg) => ({
      role: msg.role === "model" ? "model" : "user",
      parts: [{ text: String(msg.content || "").slice(0, 2000) }],
    }));

    const chat = model.startChat({ history: geminiHistory });

    // ── Agentic loop (max 5 rounds to prevent runaway loops) ───────────────
    let response = await chat.sendMessage(message);
    let candidate = response.response;
    const toolCallLog = [];
    const MAX_TOOL_ROUNDS = 5;
    let rounds = 0;

    while (
      rounds < MAX_TOOL_ROUNDS &&
      candidate.functionCalls &&
      candidate.functionCalls()?.length > 0
    ) {
      const calls = candidate.functionCalls() ?? [];
      const toolResults = await Promise.all(
        calls.map(async (call) => {
          let result;
          try {
            result = await executeTool(call.name, call.args || {}, userId, db);
          } catch (toolErr) {
            result = { error: `Tool ${call.name} failed: ${toolErr.message}` };
          }
          toolCallLog.push({ tool: call.name });
          return { functionResponse: { name: call.name, response: result } };
        })
      );
      response = await chat.sendMessage(toolResults);
      candidate = response.response;
      rounds++;
    }

    const replyText = candidate.text();
    if (!replyText) {
      return NextResponse.json({ error: "Agent returned an empty response. Please try again." }, { status: 500 });
    }

    return NextResponse.json({
      reply: replyText,
      toolsUsed: toolCallLog.map((t) => t.tool),
    });

  } catch (error) {
    console.error("Agent Error:", error);
    return NextResponse.json({ error: "Agent failed: " + error.message }, { status: 500 });
  }
}
