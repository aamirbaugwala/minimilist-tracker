/**
 * Presentation helpers for medical reports (Direction A). Pure — no React.
 *
 * Tones use design tokens: high → danger, low / borderline → warn,
 * normal → accent. "To watch" means anything not normal.
 */

import { resolveMarker, PANELS } from "./biomarkers";

export const STATUS = {
  high: { label: "High", color: "var(--danger)", soft: "var(--danger-soft)" },
  low: { label: "Low", color: "var(--warn)", soft: "var(--warn-soft)" },
  borderline: { label: "Borderline", color: "var(--warn)", soft: "var(--warn-soft)" },
  normal: { label: "Normal", color: "var(--accent-text)", soft: "var(--accent-soft)" },
};
export const statusOf = (s) => STATUS[s] || STATUS.normal;

export const SHORT_PANEL = {
  metabolic: "Sugar",
  lipid: "Lipid profile",
  liver: "Liver",
  kidney: "Kidney",
  electrolyte: "Electrolytes",
  thyroid: "Thyroid",
  blood: "Blood count",
  iron: "Iron",
  vitamin: "Vitamins",
  inflammation: "Heart & inflammation",
  other: "Other",
};

/** ISO date the report is about (collection date, else upload date). */
export const reportDay = (r) => String(r.report_date || r.created_at || "").slice(0, 10);

export const fmtDay = (iso, opts = { day: "numeric", month: "short", year: "numeric" }) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", opts) : "";

export const watchCount = (r) => (r.flags || []).filter((f) => f.status && f.status !== "normal").length;

/**
 * A human title from the panels the report actually covers, e.g.
 * "Lipid profile + Blood count". Falls back to the file name.
 */
export function reportTitle(r) {
  const counts = new Map();
  for (const f of r.flags || []) {
    const panel = resolveMarker(f.marker)?.panel;
    if (panel && panel !== "other") counts.set(panel, (counts.get(panel) || 0) + 1);
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (PANELS[a[0]]?.order ?? 99) - (PANELS[b[0]]?.order ?? 99))
    .map(([p]) => SHORT_PANEL[p]);
  if (top.length === 0) return String(r.file_name || "Report").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
  if (top.length >= 4 && (r.flags || []).length >= 15) return "Full body checkup";
  if (top.length <= 2) return top.join(" + ");
  return `${top.slice(0, 2).join(", ")} + ${top.length - 2} more`;
}

/** Flags with the ones to watch first (high, low, borderline, then normal). */
export function sortedFlags(r) {
  const rank = { high: 0, low: 1, borderline: 2, normal: 3 };
  return [...(r.flags || [])].sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3));
}

/** Short food name for a chip: "oats, salmon, methi (fenugreek)" → first clause. */
export const chipName = (food) => {
  const s = String(food || "").trim();
  return s.length > 28 ? `${s.slice(0, 26).replace(/[ ,]+$/, "")}…` : s;
};
