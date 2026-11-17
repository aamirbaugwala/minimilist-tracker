/**
 * app/lib/insights.js — the numbers behind Insights (pure, testable).
 *
 * `days` is one entry per logical day (oldest → newest, today last):
 *   { date, cals, protein, fiber, weight, targetCals, targetP, targetFib }
 * Today is always "in progress": it never counts toward averages or targets,
 * and nothing here grades an unfinished day.
 */

const ON_TARGET = 0.1; // within ±10% of the calorie target

export const isOnTarget = (d) => d.cals > 0 && Math.abs(d.cals - d.targetCals) <= d.targetCals * ON_TARGET;

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Last 7 days (6 finished + today). */
export function weekSummary(days, today) {
  const week = days.slice(-7);
  const done = week.filter((d) => d.date !== today && d.cals > 0);
  return {
    week,
    loggedDays: done.length,
    onTargetDays: done.filter(isOnTarget).length,
    avgCals: Math.round(avg(done.map((d) => d.cals))),
    avgProtein: Math.round(avg(done.map((d) => d.protein))),
    targetCals: week[week.length - 1]?.targetCals || 0,
    targetP: week[week.length - 1]?.targetP || 0,
  };
}

/** Latest weight and change over ~14 days, plus points for a sparkline. */
export function weightSummary(days) {
  const pts = days.filter((d) => d.weight != null).map((d) => ({ date: d.date, w: d.weight }));
  if (!pts.length) return null;
  const latest = pts[pts.length - 1];
  const cutoff = days[Math.max(0, days.length - 15)]?.date;
  const base = pts.find((p) => p.date >= cutoff) || pts[0];
  return { latest: latest.w, change: Math.round((latest.w - base.w) * 10) / 10, points: pts.slice(-14) };
}

const shift = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const mondayOf = (day) => {
  const d = new Date(`${day}T00:00:00Z`);
  return shift(day, -((d.getUTCDay() + 6) % 7));
};

/**
 * Monday review of LAST week (Mon–Sun). Deterministic wording — calm, specific,
 * never a grade. Returns null when there's nothing to review.
 */
export function weeklyReview(days, logs, today) {
  const start = shift(mondayOf(today), -7);
  const end = shift(start, 6);
  const prevStart = shift(start, -7);
  const inWeek = days.filter((d) => d.date >= start && d.date <= end);
  const logged = inWeek.filter((d) => d.cals > 0);
  if (!logged.length) return null;

  const prev = days.filter((d) => d.date >= prevStart && d.date < start && d.cals > 0);
  const onTarget = logged.filter(isOnTarget).length;
  const weights = inWeek.filter((d) => d.weight != null);
  const weightChange = weights.length >= 2 ? Math.round((weights[weights.length - 1].weight - weights[0].weight) * 10) / 10 : null;

  const avgP = avg(logged.map((d) => d.protein));
  const prevP = avg(prev.map((d) => d.protein));
  const targetP = logged[logged.length - 1].targetP;
  const avgFib = avg(logged.map((d) => d.fiber));
  const targetFib = logged[logged.length - 1].targetFib;
  const targetCals = logged[logged.length - 1].targetCals;

  // Meals: how consistently each was logged, and average kcal per meal.
  const weekLogs = (logs || []).filter((l) => l.date >= start && l.date <= end && l.name !== "Water");
  const mealDays = {};
  const mealKcal = {};
  weekLogs.forEach((l) => {
    const m = l.meal || "Other";
    (mealDays[m] ||= new Set()).add(l.date);
    mealKcal[m] = (mealKcal[m] || 0) + (Number(l.calories) || 0);
  });

  const worked = [];
  const steady = Object.entries(mealDays).find(([m, s]) => m !== "Other" && s.size === logged.length && logged.length >= 3);
  if (steady) worked.push(`${steady[0]} logged every day you tracked`);
  if (prev.length && prevP > 0 && avgP >= prevP * 1.05) worked.push(`Protein up ${Math.round((avgP / prevP - 1) * 100)}% on the week before`);
  if (onTarget >= 3) worked.push(`On target ${onTarget} ${onTarget === 1 ? "day" : "days"}`);

  let tryNext;
  const heaviest = Object.entries(mealKcal)
    .filter(([m]) => m !== "Other")
    .map(([m, k]) => [m, k / (mealDays[m]?.size || 1)])
    .sort((a, b) => b[1] - a[1])[0];
  if (heaviest && heaviest[0] === "Dinner" && heaviest[1] > targetCals * 0.4) {
    tryNext = `Dinners averaged ${Math.round(heaviest[1])} kcal. Moving about 200 kcal to lunch would make evenings easier on target.`;
  } else if (targetP && avgP < targetP * 0.8) {
    tryNext = `Protein averaged ${Math.round(avgP)} g of ${Math.round(targetP)} g. One protein-rich breakfast would close most of that gap.`;
  } else if (targetFib && avgFib < targetFib * 0.7) {
    tryNext = `Fibre averaged ${Math.round(avgFib)} g of ${Math.round(targetFib)} g. A fruit or a bowl of dal each day would help.`;
  } else {
    tryNext = "Same plan this week — it’s working.";
  }

  const headline =
    onTarget >= 5 ? "A steady week." : onTarget >= 3 ? "A good week." : logged.length < 3 ? "A quiet week — every logged day counts." : "A mixed week.";

  return { start, end, loggedDays: logged.length, onTarget, weightChange, worked: worked.slice(0, 2), tryNext, headline };
}
