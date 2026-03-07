/**
 * app/lib/nutrition.js
 *
 * Single source of truth for all nutrition target calculations.
 * Used by: page.js (StatsBoard + generateSmartMeals),
 *           dashboard/page.js, social/page.js, api/agent/route.js
 *
 * ─── Goal model ──────────────────────────────────────────────────────────────
 * Goals are no longer a hardcoded string enum. Instead, two independent axes
 * stored in user_profiles drive all calculations:
 *
 *   calorie_adjustment  integer  default 0
 *     — kcal delta applied on top of calculated TDEE.
 *     — Negative = deficit (fat loss), positive = surplus (muscle gain), 0 = TDEE.
 *     — Common values: -700 (aggressive cut), -500, -250, 0, +200, +400 (bulk).
 *     — Ignored when target_calories is set manually.
 *
 *   protein_priority  text  default 'balanced'
 *     — 'preserve'  → 2.0 g/kg  (muscle preservation in a deep deficit)
 *     — 'balanced'  → 1.8 g/kg  (standard, suitable for most goals)
 *     — 'maximize'  → 2.4 g/kg  (maximum muscle synthesis, recomp, aggressive bulk)
 *
 *   goal  text  (display label only — kept for backward compat & goal_history)
 *     — Presets write this alongside calorie_adjustment + protein_priority.
 *     — calculateTargets() does NOT read goal for math — only the two axes above.
 *
 * ─── Fiber ───────────────────────────────────────────────────────────────────
 *   Fiber target scales with calories (14g per 1000 kcal, per DRI guidelines).
 *   Higher protein-priority goals get a +3g bonus (high-protein diets need more
 *   fiber to maintain gut motility).
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

// Protein g per kg bodyweight by priority
const PROTEIN_MULTIPLIERS = {
  preserve: 2.0,
  balanced: 1.8,
  maximize: 2.4,
};

// Fat % of total calories by protein priority
// Higher protein → lower fat % to leave room for carbs
const FAT_PCT = {
  preserve: 0.32,  // Higher fat aids satiety in aggressive deficits
  balanced: 0.28,
  maximize: 0.24,  // Lower fat leaves more carbs to fuel training
};

// Fiber bonus g on top of base (14g/1000kcal) for high-protein diets
const FIBER_BONUS = {
  preserve: 3,
  balanced: 0,
  maximize: 3,
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
 *   {
 *     weight, height, age, gender, activity,
 *     calorie_adjustment,   // new — kcal delta from TDEE (default 0)
 *     protein_priority,     // new — 'preserve' | 'balanced' | 'maximize' (default 'balanced')
 *     target_calories,      // optional manual override — skips TDEE calc if set
 *     goal,                 // display label only, not used for math
 *   }
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

  const weight   = Number(profile.weight);
  const height   = Number(profile.height) || 170;
  const age      = Number(profile.age)    || 30;
  const adj      = Number(profile.calorie_adjustment) || 0;
  const priority = profile.protein_priority || "balanced";

  // ── 1. Calorie target ──────────────────────────────────────────────────────
  let targetCals;
  if (profile.target_calories) {
    // Manual override takes precedence — user knows exactly what they want
    targetCals = Number(profile.target_calories);
  } else {
    let bmr = 10 * weight + 6.25 * height - 5 * age;
    bmr += profile.gender === "male" ? 5 : -161;
    const tdee = bmr * (ACTIVITY_MULTIPLIERS[profile.activity] || 1.2);
    targetCals = Math.round(tdee + adj);
  }

  // Guard against absurd values
  targetCals = Math.max(800, Math.min(6000, targetCals));

  // ── 2. Macro targets ───────────────────────────────────────────────────────
  const proteinMultiplier = PROTEIN_MULTIPLIERS[priority] ?? 1.8;
  const fatPct            = FAT_PCT[priority]            ?? 0.28;

  const targetP = Math.round(weight * proteinMultiplier);
  const targetF = Math.round((targetCals * fatPct) / 9);

  // Carbs fill the remaining calories after protein + fat are accounted for
  // Floor at 50g to prevent div-by-zero in food scoring formulas
  const usedCals = targetP * 4 + targetF * 9;
  const targetC  = Math.round(Math.max(50, targetCals - usedCals) / 4);

  // ── 3. Fiber target ────────────────────────────────────────────────────────
  // Base: 14g per 1000 kcal (DRI guideline)
  // Bonus: +3g for preserve/maximize priority (high protein → need more fiber)
  const baseFib  = Math.round((targetCals / 1000) * 14);
  const targetFib = baseFib + (FIBER_BONUS[priority] ?? 0);

  // ── 4. Water target ────────────────────────────────────────────────────────
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

/**
 * GOAL_PRESETS
 * Exported so page.js and the agent can use the same preset definitions.
 * Each preset writes calorie_adjustment + protein_priority (the real axes)
 * and a display `goal` label for goal_history / UI display.
 */
export const GOAL_PRESETS = [
  {
    id: "lose",
    label: "Lose Fat",
    desc: "−500 kcal deficit · High protein",
    color: "#ef4444",
    calorie_adjustment: -500,
    protein_priority: "preserve",
  },
  {
    id: "gain",
    label: "Build Muscle",
    desc: "+300 kcal surplus · Moderate protein",
    color: "#3b82f6",
    calorie_adjustment: 300,
    protein_priority: "balanced",
  },
  {
    id: "maintain",
    label: "Maintain",
    desc: "TDEE · Balanced macros",
    color: "#22c55e",
    calorie_adjustment: 0,
    protein_priority: "balanced",
  },
  {
    id: "recomp",
    label: "Recomposition",
    desc: "TDEE · Max protein · Lose fat + build muscle",
    color: "#a855f7",
    calorie_adjustment: 0,
    protein_priority: "maximize",
  },
];
