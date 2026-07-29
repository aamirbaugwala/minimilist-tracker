/**
 * app/lib/gamification.js
 *
 * Pure game-loop logic — no React, no Supabase — so it's testable and shared.
 *
 * The point isn't to gamify for its own sake; it's to attach a small, healthy
 * reward to the act of logging so the habit forms. XP + levels give long-term
 * progression; daily quests give a "come back today" reason; both are derived
 * from data the app already has (today's logs + targets), so quests reset
 * naturally at midnight with no extra storage.
 */

// ── XP ───────────────────────────────────────────────────────────────────────

/** XP for a single logged item. Modest and legible — real meals beat coffee. */
export function xpForLog(item) {
  if (!item || item.name === "Water") return 2; // hydration still counts, a little
  let xp = 10;
  if ((item.protein || 0) >= 10) xp += 5; // protein-forward choices
  if ((item.fiber || 0) >= 3) xp += 5; // fibre-forward choices
  if ((item.calories || 0) >= 150) xp += 3; // an actual meal, not a nibble
  return xp;
}

const XP_PER_LEVEL = 500;

/** Level + progress within the level, from a lifetime XP total. Level starts at 1. */
export function levelFromXp(totalXp) {
  const xp = Math.max(0, Math.floor(totalXp || 0));
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const into = xp % XP_PER_LEVEL;
  return { level, into, needed: XP_PER_LEVEL, pct: Math.round((into / XP_PER_LEVEL) * 100) };
}

/** True when adding a POSITIVE `gain` crosses up into a new level. */
export function didLevelUp(prevXp, gain) {
  if (!(gain > 0)) return false; // losing XP (an undo) is never a level-up
  return levelFromXp((prevXp || 0) + gain).level > levelFromXp(prevXp).level;
}

// ── Quests (derived from today's totals + targets) ──────────────────────────

/**
 * @param {object} totals  today's running totals { calories, protein, fiber, water, ... }
 * @param {object} targets calculateTargets() output { p, fib, water, ... }
 * @param {number} mealCount number of non-water logs today
 * @returns {Array} [{ id, icon, title, current, max, unit, done }]
 */
export function computeQuests({ totals = {}, targets = {}, mealCount = 0 }) {
  const q = [
    {
      id: "meals",
      icon: "🍽",
      title: "Log 3 meals",
      current: Math.min(mealCount, 3),
      max: 3,
    },
    {
      id: "protein",
      icon: "💪",
      title: "Hit your protein goal",
      current: Math.min(Math.round(totals.protein || 0), Math.round(targets.p || 150)),
      max: Math.round(targets.p || 150),
      unit: "g",
    },
    {
      id: "rainbow",
      icon: "🌈",
      title: "Rainbow day — all 4 macros",
      current: ["protein", "carbs", "fats", "fiber"].filter((k) => (totals[k] || 0) > 0).length,
      max: 4,
    },
  ];
  return q.map((x) => ({ ...x, done: x.current >= x.max }));
}

/** Ids of quests currently complete — used to detect a *newly* completed one. */
export const completedQuestIds = (quests) =>
  new Set((quests || []).filter((q) => q.done).map((q) => q.id));
