/**
 * app/lib/dashboardMetrics.js
 *
 * Pure metric helpers extracted from dashboard/page.js. No React, no Supabase —
 * just math, so they can be unit-tested and reused.
 */

// ─── GOAL PACE CALCULATOR ────────────────────────────────────────────────────
const computeGoalPace = (trendData, profile) => {
  if (!profile) return null;
  const targetWeight = profile.target_weight;
  const currentWeight = profile.weight;
  const goal = profile.goal;

  if (!currentWeight) return null;

  const weightPoints = trendData
    .filter((d) => d.weight !== null && d.weight !== undefined)
    .slice(-14);

  let weeklyRateKg = null;
  if (weightPoints.length >= 2) {
    const n = weightPoints.length;
    const xs = weightPoints.map((_, i) => i);
    const ys = weightPoints.map((d) => d.weight);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
    const sumXX = xs.reduce((a, x) => a + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    weeklyRateKg = slope * 7;
  }

  const last7 = trendData.filter((d) => d.calories > 0).slice(-7);
  const avgCalTarget = profile.target_calories || 2000;
  const avgEaten = last7.length
    ? last7.reduce((s, d) => s + d.calories, 0) / last7.length
    : avgCalTarget;
  const dailyDeficit = avgCalTarget - avgEaten;

  const latestWeight =
    weightPoints.length > 0
      ? weightPoints[weightPoints.length - 1].weight
      : currentWeight;

  const pace = {
    latestWeight,
    targetWeight,
    goal,
    weeklyRateKg,
    dailyDeficit: Math.round(dailyDeficit),
    weeksToGoal: null,
    direction: null,
    onTrack: false,
    message: null,
  };

  if (!targetWeight) {
    if (Math.abs(dailyDeficit) < 100) {
      pace.message = "You're in maintenance. Calories are balanced.";
      pace.onTrack = true;
    } else if (dailyDeficit > 0) {
      pace.message = `Avg deficit: ${Math.round(dailyDeficit)} kcal/day. Set a target weight to see your ETA.`;
    } else {
      pace.message = `Avg surplus: ${Math.round(Math.abs(dailyDeficit))} kcal/day. Set a target weight to see your ETA.`;
    }
    return pace;
  }

  const kgToGo = latestWeight - targetWeight;
  pace.direction = kgToGo > 0 ? "lose" : kgToGo < 0 ? "gain" : "reached";

  if (pace.direction === "reached") {
    pace.message = "🎯 Goal weight reached! Focus on maintenance.";
    pace.onTrack = true;
    return pace;
  }

  const effectiveWeeklyRate =
    weeklyRateKg !== null
      ? Math.abs(weeklyRateKg)
      : Math.abs(dailyDeficit * 7) / 7700;

  if (effectiveWeeklyRate < 0.05) {
    pace.message = "Weight is stable. Adjust calories to make progress.";
    pace.onTrack = false;
    return pace;
  }

  pace.weeksToGoal = Math.round(Math.abs(kgToGo) / effectiveWeeklyRate);

  const movingCorrectly =
    (pace.direction === "lose" && weeklyRateKg !== null && weeklyRateKg < 0) ||
    (pace.direction === "gain" && weeklyRateKg !== null && weeklyRateKg > 0) ||
    weeklyRateKg === null;

  pace.onTrack = movingCorrectly;

  return pace;
};

// ─── DAILY NUTRITION SCORE ────────────────────────────────────────────────────
const computeDayScore = (metrics, calendarData, selectedDate) => {
  const { eaten, target, macros, targets, water } = metrics;
  if (!target || target === 0) return null;

  const calRatio = eaten / target;
  const calPts = Math.max(0, Math.round(30 * (1 - Math.min(1, Math.abs(1 - calRatio) * 3))));

  const protRatio = targets.p > 0 ? macros.p / targets.p : 0;
  const protPts = Math.min(30, Math.round(30 * protRatio));

  const hydRatio = water.target > 0 ? water.current / water.target : 0;
  const hydPts = Math.min(20, Math.round(20 * hydRatio));

  const today = selectedDate || new Date().toISOString().slice(0, 10);
  const last7 = calendarData.filter((d) => d.date <= today).slice(-7);
  const loggedDays = last7.filter((d) => d.cals > 0).length;
  const consPts = Math.round((loggedDays / 7) * 20);

  const total = calPts + protPts + hydPts + consPts;

  return {
    total,
    pillars: [
      { label: "Calories", pts: calPts, max: 30, color: "#a855f7" },
      { label: "Protein",  pts: protPts, max: 30, color: "#3b82f6" },
      { label: "Hydration",pts: hydPts,  max: 20, color: "#06b6d4" },
      { label: "Streak",   pts: consPts, max: 20, color: "#22c55e" },
    ],
    grade:
      total >= 90 ? "S" :
      total >= 75 ? "A" :
      total >= 55 ? "B" :
      total >= 35 ? "C" : "D",
    gradeColor:
      total >= 90 ? "#22c55e" :
      total >= 75 ? "#3b82f6" :
      total >= 55 ? "#f59e0b" :
      total >= 35 ? "#f97316" : "#ef4444",
  };
};

export { computeGoalPace, computeDayScore };
