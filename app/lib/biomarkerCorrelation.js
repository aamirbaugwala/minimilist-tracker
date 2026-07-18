/**
 * app/lib/biomarkerCorrelation.js
 *
 * Links blood-test results to the nutrition that preceded them.
 *
 * medical_reports.flags holds [{ marker, value, status, note }] and each report
 * is dated by report_date (falling back to created_at). For every test we look
 * back over a window of days *before* the draw and average what was actually
 * logged, so consecutive tests can be compared against how eating changed.
 *
 * ─── Honesty constraints baked in here ───────────────────────────────────────
 * 1. This is correlation, never causation. Nothing in here claims a nutrient
 *    caused a marker to move; the UI must say so too.
 * 2. Averages divide by DAYS ACTUALLY LOGGED, not by window length. Dividing by
 *    window length would silently understate intake for every unlogged day and
 *    make people look like they ate less than they did.
 * 3. Every window reports its coverage so thin data can be flagged rather than
 *    quietly presented as fact.
 */

import { FLATTENED_DB } from "../food-data";
// Marker identity lives in one place so the dashboard and the trends page agree
// on what counts as "the same marker".
import { resolveMarker, parseNumeric, extractUnit } from "./biomarkers";

// Re-exported so existing callers keep working after these moved to biomarkers.js
export { parseNumeric, extractUnit };

/** Windows offered in the UI, in days. */
export const WINDOW_OPTIONS = [30, 60, 90];

/** Minimum share of days logged before a window is considered trustworthy. */
export const MIN_COVERAGE = 0.4;

const EMPTY = () => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fats: 0,
  fiber: 0,
  water: 0,
});

/** Roll raw food_logs rows up into per-day totals: Map<"YYYY-MM-DD", totals>. */
export function aggregateDailyTotals(logs) {
  const byDate = new Map();

  for (const log of logs) {
    if (!log?.date) continue;
    let day = byDate.get(log.date);
    if (!day) {
      day = EMPTY();
      byDate.set(log.date, day);
    }

    day.calories += Number(log.calories) || 0;
    day.protein += Number(log.protein) || 0;
    day.carbs += Number(log.carbs) || 0;
    day.fats += Number(log.fats) || 0;

    // Backfill fiber from the food DB when the row didn't store it — same
    // approach the leaderboard and home timeline already use.
    let fiber = Number(log.fiber) || 0;
    if (!fiber && log.name !== "Water") {
      const dbItem = FLATTENED_DB[log.name?.toLowerCase()];
      if (dbItem?.fiber) fiber = dbItem.fiber * (Number(log.qty) || 1);
    }
    day.fiber += fiber;

    // One "Water" unit is a 250ml glass, matching the rest of the app.
    if (log.name === "Water") day.water += (Number(log.qty) || 0) * 0.25;
  }

  return byDate;
}

const shiftDate = (isoDate, deltaDays) => {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
};

/** ISO "YYYY-MM-DD" for a report's date field (report_date or created_at). */
export const reportDateOf = (report) =>
  String(report.report_date || report.created_at || "").slice(0, 10);

/**
 * Average daily nutrition across the `windowDays` days ENDING THE DAY BEFORE
 * `endDate`. The test day itself is excluded — a blood draw reflects what came
 * before it, not what was eaten after.
 *
 * Returns null when nothing at all was logged in the window.
 */
export function windowAverage(dailyTotals, endDate, windowDays) {
  const sum = EMPTY();
  let daysLogged = 0;

  for (let i = 1; i <= windowDays; i++) {
    const totals = dailyTotals.get(shiftDate(endDate, -i));
    if (!totals) continue;
    daysLogged++;
    for (const key of Object.keys(sum)) sum[key] += totals[key];
  }

  if (daysLogged === 0) return null;

  const avg = {};
  for (const key of Object.keys(sum)) avg[key] = sum[key] / daysLogged;

  return {
    ...avg,
    daysLogged,
    windowDays,
    coverage: daysLogged / windowDays,
    reliable: daysLogged / windowDays >= MIN_COVERAGE,
  };
}

/**
 * Build one series per marker, each point carrying the nutrition window that
 * preceded it. Only markers with a parseable number are included — text-only
 * results ("Negative", "Trace") can't be trended.
 *
 * @returns {Array} [{ key, displayName, unit, points[], latest, previous, delta }]
 *   sorted so markers that are currently abnormal surface first.
 */
export function buildCorrelations(reports, dailyTotals, windowDays) {
  const markers = new Map();

  for (const report of reports || []) {
    const date = reportDateOf(report);
    if (!date || !report.flags?.length) continue;

    for (const flag of report.flags) {
      // Canonical identity: "HbA1c" and "Glycosylated Hemoglobin (HbA1c)" are
      // one marker, so readings across labs land in a single series.
      const resolved = resolveMarker(flag.marker);
      if (!resolved) continue; // bare specimen heading / unnamed row

      const numericValue = parseNumeric(flag.value);
      if (numericValue === null) continue; // not trendable

      const key = resolved.id;
      if (!markers.has(key)) {
        markers.set(key, {
          key,
          // Registry label for known markers keeps naming consistent across
          // labs; unknown ones keep whatever the report called them.
          displayName: resolved.label,
          panel: resolved.panel,
          canonical: resolved.canonical,
          unit: extractUnit(flag.value),
          points: [],
        });
      }

      const marker = markers.get(key);
      if (!marker.unit) marker.unit = extractUnit(flag.value);

      marker.points.push({
        date,
        value: flag.value,
        numericValue,
        status: flag.status || "normal",
        note: flag.note || "",
        nutrition: windowAverage(dailyTotals, date, windowDays),
      });
    }
  }

  const series = [];
  for (const marker of markers.values()) {
    // Chronological, and collapse duplicate dates (same marker twice in a report)
    marker.points.sort((a, b) => a.date.localeCompare(b.date));
    marker.points = marker.points.filter(
      (p, i, arr) => i === 0 || p.date !== arr[i - 1].date,
    );

    const latest = marker.points[marker.points.length - 1] ?? null;
    const previous =
      marker.points.length >= 2 ? marker.points[marker.points.length - 2] : null;

    series.push({
      ...marker,
      latest,
      previous,
      delta:
        latest && previous ? latest.numericValue - previous.numericValue : null,
      // Did the marker move toward normal? null when we can't tell.
      improving: latest && previous ? movedTowardNormal(latest, previous) : null,
      // Both windows have logged nutrition, so a before/after comparison exists.
      comparable: !!(latest?.nutrition && previous?.nutrition),
      // At least one test has nutrition behind it.
      hasAnyNutrition: marker.points.some((p) => p.nutrition),
    });
  }

  // Markers the user can actually learn something from come first: a fully
  // comparable pair, then any nutrition at all, then abnormal, then history
  // depth, then alphabetical. Without this the default selection can land on a
  // marker whose only test predates every food log.
  return series.sort((a, b) => {
    if (a.comparable !== b.comparable) return a.comparable ? -1 : 1;
    if (a.hasAnyNutrition !== b.hasAnyNutrition) return a.hasAnyNutrition ? -1 : 1;
    const aAb = a.latest?.status !== "normal" ? 0 : 1;
    const bAb = b.latest?.status !== "normal" ? 0 : 1;
    if (aAb !== bAb) return aAb - bAb;
    if (b.points.length !== a.points.length) return b.points.length - a.points.length;
    return a.displayName.localeCompare(b.displayName);
  });
}

/**
 * Whether the latest reading moved toward the normal range.
 * Uses the PREVIOUS reading's status: if it was high, going down is better.
 * Returns null when the direction can't be inferred.
 */
function movedTowardNormal(latest, previous) {
  const diff = latest.numericValue - previous.numericValue;
  if (diff === 0) return null;
  if (previous.status === "high") return diff < 0;
  if (previous.status === "low") return diff > 0;
  // Previously normal: only call it worsening if it has now left range.
  if (latest.status === "high" || latest.status === "low") return false;
  return null;
}

/** Nutrition fields rendered in the comparison table, in display order. */
export const NUTRITION_FIELDS = [
  { key: "calories", label: "Calories", unit: "", decimals: 0, color: "#f59e0b" },
  { key: "protein", label: "Protein", unit: "g", decimals: 0, color: "#3b82f6" },
  { key: "carbs", label: "Carbs", unit: "g", decimals: 0, color: "#22c55e" },
  { key: "fats", label: "Fats", unit: "g", decimals: 0, color: "#ef4444" },
  { key: "fiber", label: "Fiber", unit: "g", decimals: 0, color: "#a855f7" },
  { key: "water", label: "Water", unit: "L", decimals: 1, color: "#60a5fa" },
];

/**
 * Plain-language summary of what changed between the two most recent tests.
 * Deliberately phrased as association ("alongside"), never causation.
 * Returns null when there isn't enough to compare.
 */
export function summarise(series) {
  const { latest, previous, delta, displayName, unit } = series;
  if (!latest || !previous || delta === null) return null;
  if (!latest.nutrition || !previous.nutrition) return null;

  const direction = delta > 0 ? "rose" : delta < 0 ? "fell" : "held steady";
  const magnitude = Math.abs(delta).toFixed(Math.abs(delta) < 1 ? 2 : 1);

  // Surface the nutrition fields that shifted most, proportionally.
  const shifts = NUTRITION_FIELDS.map((f) => {
    const before = previous.nutrition[f.key];
    const after = latest.nutrition[f.key];
    const change = after - before;
    const rel = before > 0 ? Math.abs(change) / before : 0;
    return { ...f, change, rel };
  })
    .filter((s) => s.rel >= 0.1 && Math.abs(s.change) > 0)
    .sort((a, b) => b.rel - a.rel)
    .slice(0, 2);

  return {
    headline:
      delta === 0
        ? `${displayName} held steady`
        : `${displayName} ${direction} ${magnitude}${unit ? " " + unit : ""}`,
    improving: series.improving,
    shifts,
    reliable: latest.nutrition.reliable && previous.nutrition.reliable,
  };
}
