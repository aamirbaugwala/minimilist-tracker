/**
 * app/lib/markerSeries.js
 *
 * Turns raw medical_reports into per-marker timelines grouped by panel, for the
 * Marker Trends screen. Pure functions — no React, no network.
 *
 * Marker identity comes from lib/biomarkers.js, so a marker written "HbA1c" in
 * one report and "Glycosylated Hemoglobin (HbA1c)" in the next forms ONE series
 * instead of two one-reading stubs that can never show a trend.
 *
 * Unlike the dashboard's correlation view, non-numeric results are KEPT here.
 * "Negative" or "Trace" can't be plotted, but it's still a real result the user
 * should see listed; those markers simply render without a sparkline.
 */

import {
  resolveMarker,
  parseNumeric,
  extractUnit,
  PANEL_ORDER,
} from "./biomarkers";

/** ISO date for a report (collection date preferred over upload date). */
const dateOf = (report) =>
  String(report.report_date || report.created_at || "").slice(0, 10);

/**
 * Direction of travel between the two most recent readings.
 * `improving` is judged against the PREVIOUS reading's status: if it was high,
 * moving down is better. null when there's no way to tell.
 */
function trendOf(latest, previous) {
  if (!latest || !previous) return { direction: "flat", improving: null };
  if (latest.numericValue === null || previous.numericValue === null) {
    return { direction: "flat", improving: null };
  }

  const diff = latest.numericValue - previous.numericValue;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  if (diff === 0) return { direction, improving: null, diff };

  let improving = null;
  if (previous.status === "high") improving = diff < 0;
  else if (previous.status === "low") improving = diff > 0;
  else if (latest.status === "high" || latest.status === "low") improving = false;

  return { direction, improving, diff };
}

/**
 * @param {Array} reports rows from medical_reports
 * @returns {Array} one entry per canonical marker:
 *   { id, label, panel, canonical, unit, aliasesSeen[], entries[], latest,
 *     previous, trend }
 *   `entries` are oldest → newest with same-date duplicates collapsed.
 */
export function buildMarkerSeries(reports) {
  const map = new Map();

  for (const report of reports || []) {
    const date = dateOf(report);
    if (!date || !report.flags?.length) continue;

    for (const flag of report.flags) {
      const resolved = resolveMarker(flag.marker);
      if (!resolved) continue; // bare specimen heading / unnamed row

      const key = resolved.id;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          label: resolved.label,
          panel: resolved.panel,
          canonical: resolved.canonical,
          unit: extractUnit(flag.value),
          aliases: new Set(),
          entries: [],
        });
      }

      const marker = map.get(key);
      if (!marker.unit) marker.unit = extractUnit(flag.value);
      // Kept so the UI can show "also reported as …" — useful reassurance that
      // two differently-named rows were deliberately merged.
      if (flag.marker) marker.aliases.add(String(flag.marker).trim());

      marker.entries.push({
        date,
        value: flag.value ?? "—",
        numericValue: parseNumeric(flag.value),
        status: flag.status || "normal",
        note: flag.note || "",
      });
    }
  }

  const series = [];
  for (const marker of map.values()) {
    marker.entries.sort((a, b) => a.date.localeCompare(b.date));
    marker.entries = marker.entries.filter(
      (e, i, arr) => i === 0 || e.date !== arr[i - 1].date,
    );

    const latest = marker.entries[marker.entries.length - 1] ?? null;
    const previous =
      marker.entries.length >= 2 ? marker.entries[marker.entries.length - 2] : null;

    series.push({
      ...marker,
      aliases: [...marker.aliases],
      latest,
      previous,
      trend: trendOf(latest, previous),
    });
  }

  return series;
}

export const FILTERS = [
  { key: "all", label: "All" },
  { key: "abnormal", label: "Abnormal" },
  { key: "improving", label: "Improving" },
  { key: "worsening", label: "Worsening" },
];

export function matchesFilter(marker, filter) {
  if (filter === "all") return true;
  if (!marker.latest) return false;
  if (filter === "abnormal") return marker.latest.status !== "normal";
  if (filter === "improving") return marker.trend.improving === true;
  if (filter === "worsening") return marker.trend.improving === false;
  return true;
}

export function matchesSearch(marker, search) {
  if (!search) return true;
  const q = search.toLowerCase();
  // Search the canonical label AND every raw spelling seen, so looking up the
  // name printed on a report still finds the merged marker.
  return (
    marker.label.toLowerCase().includes(q) ||
    marker.aliases.some((a) => a.toLowerCase().includes(q))
  );
}

/** Abnormal first, then more history, then alphabetical. */
function sortMarkers(a, b) {
  const aAb = a.latest?.status !== "normal" ? 0 : 1;
  const bAb = b.latest?.status !== "normal" ? 0 : 1;
  if (aAb !== bAb) return aAb - bAb;
  if (b.entries.length !== a.entries.length) return b.entries.length - a.entries.length;
  return a.label.localeCompare(b.label);
}

/**
 * Bucket markers into clinical panels, in PANEL_ORDER, dropping empty panels.
 * @returns {Array} [{ panel, markers[], abnormalCount }]
 */
export function groupByPanel(series) {
  const byPanel = new Map();
  for (const marker of series) {
    const list = byPanel.get(marker.panel);
    if (list) list.push(marker);
    else byPanel.set(marker.panel, [marker]);
  }

  return PANEL_ORDER.filter((p) => byPanel.has(p.id)).map((panel) => {
    const markers = byPanel.get(panel.id).sort(sortMarkers);
    return {
      panel,
      markers,
      abnormalCount: markers.filter((m) => m.latest?.status !== "normal").length,
    };
  });
}

/** Headline counts for the page header. */
export function summarise(series, reportCount) {
  return {
    markerCount: series.length,
    reportCount,
    abnormalCount: series.filter((m) => m.latest?.status !== "normal").length,
    improvingCount: series.filter((m) => m.trend.improving === true).length,
    worseningCount: series.filter((m) => m.trend.improving === false).length,
  };
}
