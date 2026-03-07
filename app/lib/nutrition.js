/**
 * app/lib/nutrition.js
 *
 * Single source of truth for all nutrition target calculations.
 * Used by: page.js (StatsBoard + generateSmartMeals),
 *           dashboard/page.js, social/page.js, api/agent/route.js
 *
 * Returns a normalised object with BOTH flat keys (cals, p, c, f, fib, water)
 * AND the dashboard-style nested keys (targetCals, targetMacros, waterTarget)
 * so every consumer can use whichever shape it prefers — no migration needed.
 */

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const DEFAULTS = {
  cals: 2000,
  p: 150,
  c: 200,
  f: 65,
  fib: 28,
  water: 3,
};

/**
 * calculateTargets(profile)
 *
 * @param {object|null} profile  – row from user_profiles table
 *   { weight, height, age, gender, activity, goal, target_calories }
 *
 * @returns {{
 *   cals: number, p: number, c: number, f: number, fib: number, water: number,
 *   targetCals: number,
 *   targetMacros: { p: number, c: number, f: number, fib: number },
 *   waterTarget: number
 * }}
 */
export function calculateTargets(profile) {
  // ── Guard: no profile or missing weight means we can't calculate ──────────
  if (!profile || !profile.weight) {
    return {
      ...DEFAULTS,
      targetCals: DEFAULTS.cals,
      targetMacros: { p: DEFAULTS.p, c: DEFAULTS.c, f: DEFAULTS.f, fib: DEFAULTS.fib },
      waterTarget: DEFAULTS.water,
    };
  }

  const weight = Number(profile.weight);
  const height = Number(profile.height) || 170;
  const age    = Number(profile.age)    || 30;
  const goal   = profile.goal           || "maintain";

  // ── 1. Calorie target ──────────────────────────────────────────────────────
  let targetCals;
  if (profile.target_calories) {
    targetCals = Number(profile.target_calories);
  } else {
    let bmr = 10 * weight + 6.25 * height - 5 * age;
    bmr += profile.gender === "male" ? 5 : -161;
    const tdee = bmr * (ACTIVITY_MULTIPLIERS[profile.activity] || 1.2);
    targetCals = Math.round(tdee);
    if (goal === "lose") targetCals -= 500;
    else if (goal === "gain") targetCals += 300;
  }

  // Guard against absurd values
  targetCals = Math.max(800, Math.min(6000, targetCals));

  // ── 2. Macro targets ───────────────────────────────────────────────────────
  let targetP, targetF;

  if (goal === "lose") {
    targetP = Math.round(weight * 2.2);
    targetF = Math.round((targetCals * 0.3) / 9);
  } else if (goal === "gain") {
    targetP = Math.round(weight * 1.8);
    targetF = Math.round((targetCals * 0.25) / 9);
  } else {
    targetP = Math.round(weight * 1.6);
    targetF = Math.round((targetCals * 0.3) / 9);
  }

  const usedCals = targetP * 4 + targetF * 9;
  // Floor carbs at 50 g to prevent div-by-zero in scoring formulas
  const targetC   = Math.round(Math.max(50, targetCals - usedCals) / 4);
  const targetFib = Math.round((targetCals / 1000) * 14);

  // ── 3. Water target ────────────────────────────────────────────────────────
  let waterTarget = Math.round(weight * 0.035 * 10) / 10;
  if (profile.activity === "active" || profile.activity === "moderate") {
    waterTarget += 0.5;
  }

  // ── Return unified shape ───────────────────────────────────────────────────
  return {
    // Flat keys (used by social/page.js scoring + page.js StatsBoard)
    cals:  targetCals,
    p:     targetP,
    c:     targetC,
    f:     targetF,
    fib:   targetFib,
    water: waterTarget,

    // Dashboard-style nested keys (used by dashboard/page.js)
    targetCals,
    targetMacros: { p: targetP, c: targetC, f: targetF, fib: targetFib },
    waterTarget,
  };
}

/**
 * capPct(value, target)
 * Safely caps a percentage at 100, returning 0 when target is 0.
 * Replaces the ad-hoc `getCapPct` / `pct` helpers scattered across files.
 */
export function capPct(value, target) {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}
