/**
 * app/lib/conditions.js
 *
 * Derives dietary-relevant conditions from a user's blood work, so nutrition
 * targets can respond to their actual clinical picture instead of macros alone.
 *
 * ─── Design decisions ────────────────────────────────────────────────────────
 *
 * 1. WE TRUST THE LAB'S OWN status FLAG, not hardcoded numeric thresholds.
 *    Reference ranges differ by lab, method, age, sex and units (mg/dL vs
 *    mmol/L). medical_reports.flags already carries high/low/borderline/normal
 *    judged against the range printed on that report, which is far more
 *    reliable than us comparing a bare number to a constant.
 *
 * 2. THIS IS NOT DIAGNOSIS. A condition here means "a marker relevant to X was
 *    flagged on your report", never "you have X". All user-facing copy must
 *    stay at that level, and every condition carries the marker and date it
 *    came from so the claim is always traceable.
 *
 * 3. STALE RESULTS DO NOT DRIVE TARGETS. Blood work older than ENFORCE_MONTHS
 *    is returned as advisory only. Silently capping someone's protein because
 *    of a two-year-old creatinine reading would be wrong.
 */

import { buildMarkerSeries } from "./markerSeries";

/** Results older than this stop influencing targets and become advisory. */
export const ENFORCE_MONTHS = 12;

export const CONDITIONS = {
  glycemic: {
    id: "glycemic",
    label: "Blood sugar",
    color: "#f59e0b",
    // Shown to the user — deliberately observational, never diagnostic.
    note: "Markers linked to blood sugar control were flagged.",
  },
  lipid: {
    id: "lipid",
    label: "Cholesterol",
    color: "#ef4444",
    note: "Markers linked to blood lipids were flagged.",
  },
  renal: {
    id: "renal",
    label: "Kidney function",
    color: "#3b82f6",
    note: "Markers linked to kidney function were flagged.",
  },
  hepatic: {
    id: "hepatic",
    label: "Liver",
    color: "#a855f7",
    note: "Liver enzymes were flagged.",
  },
  purine: {
    id: "purine",
    label: "Uric acid",
    color: "#f97316",
    note: "Uric acid was flagged.",
  },
  anemia: {
    id: "anemia",
    label: "Iron / haemoglobin",
    color: "#ec4899",
    note: "Markers linked to anaemia were flagged.",
  },
  thyroid: {
    id: "thyroid",
    label: "Thyroid",
    color: "#14b8a6",
    note: "Thyroid markers were flagged.",
  },
};

/**
 * marker id -> condition, and which statuses count. Direction matters: kidney
 * concern is creatinine HIGH but eGFR LOW; anaemia is haemoglobin LOW.
 */
const RULES = [
  { marker: "hba1c", condition: "glycemic", when: ["high", "borderline"] },
  { marker: "glucose_fasting", condition: "glycemic", when: ["high", "borderline"] },
  { marker: "glucose_pp", condition: "glycemic", when: ["high", "borderline"] },
  { marker: "insulin", condition: "glycemic", when: ["high"] },

  { marker: "ldl", condition: "lipid", when: ["high", "borderline"] },
  { marker: "cholesterol_total", condition: "lipid", when: ["high", "borderline"] },
  { marker: "triglycerides", condition: "lipid", when: ["high", "borderline"] },
  { marker: "non_hdl", condition: "lipid", when: ["high", "borderline"] },

  { marker: "creatinine", condition: "renal", when: ["high"] },
  { marker: "egfr", condition: "renal", when: ["low"] },
  { marker: "urea", condition: "renal", when: ["high"] },
  { marker: "bun", condition: "renal", when: ["high"] },

  { marker: "alt", condition: "hepatic", when: ["high"] },
  { marker: "ast", condition: "hepatic", when: ["high"] },
  { marker: "ggt", condition: "hepatic", when: ["high"] },

  { marker: "uric_acid", condition: "purine", when: ["high"] },

  { marker: "hemoglobin", condition: "anemia", when: ["low"] },
  { marker: "ferritin", condition: "anemia", when: ["low"] },

  { marker: "tsh", condition: "thyroid", when: ["high", "low"] },
];

const monthsSince = (isoDate, now = new Date()) => {
  const then = new Date(isoDate + "T00:00:00Z");
  if (Number.isNaN(then.getTime())) return Infinity;
  return (now - then) / (1000 * 60 * 60 * 24 * 30.44);
};

/**
 * @param {Array} reports rows from medical_reports
 * @param {Date}  [now]   injectable for tests
 * @returns {Array} [{ id, label, color, note, enforced, evidence: [{marker,
 *   value, status, date, monthsAgo}] }] — most recent evidence first.
 *   `enforced` false means the newest supporting result is stale, so it should
 *   inform the user but not silently change their targets.
 */
export function deriveConditions(reports, now = new Date()) {
  const series = buildMarkerSeries(reports);
  const byMarker = new Map(series.map((s) => [s.id, s]));
  const found = new Map();

  for (const rule of RULES) {
    const marker = byMarker.get(rule.marker);
    const latest = marker?.latest;
    if (!latest || !rule.when.includes(latest.status)) continue;

    const monthsAgo = monthsSince(latest.date, now);
    const evidence = {
      marker: marker.label,
      value: latest.value,
      status: latest.status,
      date: latest.date,
      monthsAgo: Math.round(monthsAgo),
    };

    const existing = found.get(rule.condition);
    if (existing) {
      existing.evidence.push(evidence);
      existing.enforced = existing.enforced || monthsAgo <= ENFORCE_MONTHS;
    } else {
      found.set(rule.condition, {
        ...CONDITIONS[rule.condition],
        enforced: monthsAgo <= ENFORCE_MONTHS,
        evidence: [evidence],
      });
    }
  }

  return [...found.values()].map((c) => ({
    ...c,
    evidence: c.evidence.sort((a, b) => b.date.localeCompare(a.date)),
  }));
}

/** Ids of conditions recent enough to actually influence targets. */
export const enforcedIds = (conditions) =>
  (conditions || []).filter((c) => c.enforced).map((c) => c.id);

/** Convenience for UI copy: "Creatinine 1.4 mg/dL, 3 months ago". */
export function describeEvidence(condition) {
  const e = condition.evidence[0];
  if (!e) return "";
  const when =
    e.monthsAgo <= 0
      ? "this month"
      : e.monthsAgo === 1
        ? "1 month ago"
        : `${e.monthsAgo} months ago`;
  return `${e.marker} ${e.value} (${e.status}), ${when}`;
}
