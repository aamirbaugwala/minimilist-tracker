/**
 * mealPlanner — builds realistic plates for the meals left today. Pure, no I/O
 * (used by Coach's generate_meal_plan tool; unit-tested).
 *
 * What makes it better than "one food closest to the calorie number":
 *   • Plans the meals actually left (the current meal onward, skipping meals
 *     already logged), splitting calories sensibly between them.
 *   • Builds plates the way people eat in India: a main + roti/rice + a side
 *     at lunch and dinner, a main + fruit/dairy at breakfast, 1–2 items as a
 *     snack. Desserts, sweets and fast food are left out of plans.
 *   • Prefers foods the user really logs (and logs at that meal).
 *   • Chases the protein gap, skips foods the user's blood-report tags flag
 *     ("watch") and favours the ones marked as helping.
 *   • Says why, so Coach can explain the plan in plain words.
 * Diet pattern / allergies / report "avoid" lists are filtered BEFORE this
 * (lib/dietFilter), so every candidate here is already allowed.
 */

export const MEAL_ORDER = ["Breakfast", "Lunch", "Snacks", "Dinner"];
const SPLIT = { Breakfast: 0.25, Lunch: 0.35, Snacks: 0.12, Dinner: 0.28 };
const NEVER = new Set(["Bakery & Desserts", "Sweets (Indian)", "Fast Food & Sandwiches", "Ramazan Specials"]);

// Plain staples only — "zunka bhakri" or "paratha (aloo)" are dishes, not a base.
const BASE_RE = /^(roti \(|chapati|phulka|naan \(plain|paratha \(plain|rice \((white|brown)|jeera rice)/;
const ONE_POT_RE = /\b(biryani|pulao|khichdi|fried rice|noodles|thali|pav bhaji|dosa|idli|uttapam|poha|upma)\b/;
const DRINK_HEAVY_RE = /\b(shake|smoothie|lassi|falooda|cold coffee|frappe|soda|cola|juice)\b/;

/**
 * Which meals to plan: from the current meal onward, minus meals already
 * logged today. If everything is logged but calories remain, a snack.
 */
export function mealsLeft({ currentMeal, loggedMeals = [], requested }) {
  const start = Math.max(0, MEAL_ORDER.indexOf(currentMeal));
  const logged = new Set(loggedMeals);
  let list = MEAL_ORDER.slice(start).filter((m) => !logged.has(m));
  if (!list.length) list = ["Snacks"];
  const n = Number(requested);
  if (n >= 1) list = list.slice(0, Math.min(n, list.length));
  return list;
}

/** Calorie target per meal, proportional to the usual split. */
export function splitCalories(meals, calories) {
  const total = meals.reduce((s, m) => s + SPLIT[m], 0) || 1;
  return Object.fromEntries(meals.map((m) => [m, Math.round((calories * SPLIT[m]) / total)]));
}

function role(name, category) {
  if (NEVER.has(category)) return null;
  if (category === "Beverages") return DRINK_HEAVY_RE.test(name) ? null : "drink";
  if (BASE_RE.test(name)) return "base";
  if (ONE_POT_RE.test(name) || category === "Rice & Biryani") return "onepot";
  if (category === "Indian Curries & Main (Veg)" || category === "Meat & Seafood" || category === "Indian Chinese") return "main";
  if (category === "Indian Snacks & Breakfast") return "breakfast";
  if (category === "Vegetables") return "veg";
  if (category === "Fruits") return "fruit";
  if (category === "Dairy & Eggs") return "dairy";
  if (category === "Dry Fruits & Nuts") return "nuts";
  if (category === "Gym & Supplements") return "protein";
  if (category === "Breads") return "bread";
  return "other";
}

// Which roles can lead a plate, and which can join it, per meal.
const PLATE = {
  Breakfast: { lead: ["breakfast", "dairy", "protein", "onepot"], sides: ["fruit", "dairy", "nuts", "drink"] },
  Lunch: { lead: ["main", "onepot"], base: true, sides: ["veg", "dairy"] },
  Dinner: { lead: ["main", "onepot"], base: true, sides: ["veg", "dairy"] },
  // (Dairy & Eggs as a lunch/dinner side means curd/raita/buttermilk; eggs can't sneak in as a "side".)
  Snacks: { lead: ["fruit", "nuts", "dairy", "protein", "breakfast"], sides: ["fruit", "drink"] },
};

const QTYS = [0.5, 1, 1.5, 2, 3];

/**
 * @param o.candidates   [[name, item, category]] — already diet/allergy filtered
 * @param o.remaining    { calories, protein, fiber }
 * @param o.meals        ["Lunch", "Dinner", …]
 * @param o.history      { [name]: { count, meals: { Lunch: n, … } } } last ~30 days
 * @param o.tagFor       (name, item) → { kind: "watch" | "helps", text } | null
 * @returns { plan: [{ meal, target, items:[…], totals, why:[…] }], gapAfter }
 */
export function planMeals({ candidates, remaining, meals, history = {}, tagFor = () => null }) {
  const targets = splitCalories(meals, remaining.calories);
  const proteinPerKcal = remaining.calories > 0 ? (remaining.protein || 0) / remaining.calories : 0;

  // Annotate once.
  const pool = [];
  for (const [name, item, category] of candidates) {
    if (!item || !(item.calories > 0)) continue;
    const r = role(name, category);
    if (!r) continue;
    const tag = tagFor(name, item);
    if (tag?.kind === "watch") continue; // flagged by their own health data
    pool.push({ name, item, role: r, tag, h: history[name] || null });
  }

  const used = new Set();
  const fitQty = (c, budget, max = 2) => {
    let pick = QTYS[0];
    for (const q of QTYS) if (q <= max && c.item.calories * q <= budget * 1.1) pick = q;
    return pick;
  };
  // Balanced score: fill the meal's share, help protein/fibre (capped so one
  // nutrient can't produce an 8-egg-white snack), strongly prefer what the
  // user actually eats, nudge toward foods their health data says help.
  const score = (c, meal, budget, maxQty) => {
    const kcal = c.item.calories * fitQty(c, budget, maxQty);
    let s = Math.min(1, kcal / Math.max(1, budget)) * 30;
    // A big protein gap (more than ~5 g per 100 kcal left) gets real weight.
    s += Math.min((c.item.protein || 0) / c.item.calories, 0.12) * (proteinPerKcal > 0.05 ? 260 : 150);
    s += Math.min((c.item.fiber || 0) / c.item.calories, 0.05) * 160;
    if (c.h) s += Math.log2(1 + c.h.count) * 8 + (c.h.meals?.[meal] ? 12 : 0);
    if (c.tag?.kind === "helps") s += 8;
    return s;
  };
  // Supplements only for people who already log them; uncategorised custom
  // foods can lead a breakfast/snack only if the user has logged them.
  const eligible = (c, roles, meal, lead) =>
    (roles.includes(c.role) && (c.role !== "protein" || c.h) && !(!lead && (meal === "Lunch" || meal === "Dinner") && c.role === "dairy" && /\begg/.test(c.name))) ||
    (lead && c.role === "other" && c.h && (meal === "Breakfast" || meal === "Snacks"));
  const best = (roles, meal, budget, { lead = false, maxQty = 2 } = {}) =>
    pool
      .filter((c) => eligible(c, roles, meal, lead) && !used.has(c.name) && c.item.calories * QTYS[0] <= budget * 1.1)
      .map((c) => ({ c, s: score(c, meal, budget, maxQty) }))
      .sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name))[0]?.c || null;
  const line = (c, qty) => ({
    food: c.name,
    qty,
    calories: Math.round(c.item.calories * qty),
    protein: Math.round((c.item.protein || 0) * qty * 10) / 10,
    carbs: Math.round((c.item.carbs || 0) * qty * 10) / 10,
    fats: Math.round((c.item.fats || 0) * qty * 10) / 10,
    fiber: Math.round((c.item.fiber || 0) * qty * 10) / 10,
  });

  const plan = [];
  for (const meal of meals) {
    const target = targets[meal];
    const shape = PLATE[meal];
    const items = [];
    const why = [];
    let left = target;

    // Mains are portioned so a base still fits; one-pot dishes fill the plate.
    const hasBase = shape.base;
    const leadBudget = hasBase ? target * 0.55 : meal === "Snacks" ? target : target * 0.7;
    let lead = best(shape.lead, meal, leadBudget, { lead: true, maxQty: meal === "Snacks" ? 1.5 : 2 });
    if (lead?.role === "onepot" && hasBase) {
      // A one-pot dish is the whole plate: re-pick with the full budget.
      lead = best(shape.lead, meal, target, { lead: true, maxQty: 2 }) || lead;
    }
    if (!lead) continue;
    used.add(lead.name);
    const fullPlate = lead.role === "onepot" && hasBase; // biryani at lunch is the plate; poha at breakfast isn't
    const lq = fitQty(lead, fullPlate ? target * 0.85 : leadBudget, meal === "Snacks" ? 1.5 : 2);
    items.push(line(lead, lq));
    left -= lead.item.calories * lq;
    if (lead.h?.count) why.push(`${lead.name.split(" (")[0]} is something you often have${lead.h.meals?.[meal] ? ` at ${meal.toLowerCase()}` : ""}`);
    if (lead.tag?.kind === "helps") why.push(lead.tag.text);

    if (hasBase && !fullPlate && left > 60) {
      const base = best(["base"], meal, left * 0.8, { maxQty: 3 });
      if (base) {
        used.add(base.name);
        const bq = fitQty(base, left * 0.8, 3);
        items.push(line(base, bq));
        left -= base.item.calories * bq;
      }
    }
    if (left > 60) {
      const side = best(shape.sides, meal, left, { maxQty: 1.5 });
      if (side) {
        used.add(side.name);
        const sq = fitQty(side, left, 1.5);
        items.push(line(side, sq));
        left -= side.item.calories * sq;
        if (side.tag?.kind === "helps" && !why.includes(side.tag.text)) why.push(side.tag.text);
      }
    }

    const totals = items.reduce(
      (t, i) => ({ calories: t.calories + i.calories, protein: Math.round((t.protein + i.protein) * 10) / 10, fiber: Math.round((t.fiber + i.fiber) * 10) / 10 }),
      { calories: 0, protein: 0, fiber: 0 },
    );
    plan.push({ meal, target, items, totals, why });
  }

  const planned = plan.reduce((t, m) => ({ calories: t.calories + m.totals.calories, protein: t.protein + m.totals.protein }), { calories: 0, protein: 0 });
  return {
    plan,
    gapAfter: {
      calories: Math.round((remaining.calories || 0) - planned.calories),
      protein: Math.round(((remaining.protein || 0) - planned.protein) * 10) / 10,
    },
  };
}
