"use client";

/**
 * One marker across reports (Direction A).
 *   Name ........................ status (or "Improving"/"Worse" when it moved)
 *   Latest value + unit ......................................... sparkline
 *   "was X on <date>" / "steady across N reports" / single date
 * Tap to see every reading, newest first.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { statusOf, fmtDay } from "../../lib/medicalUi";

/** Mini trend line. Needs ≥2 numeric points, so text-only markers get none. */
function Sparkline({ entries, color, width = 84, height = 30 }) {
  const pts = entries.filter((e) => e.numericValue !== null);
  if (pts.length < 2) return null;
  const vals = pts.map((p) => p.numericValue);
  const min = Math.min(...vals);
  const range = Math.max(...vals) - min || 1;
  const PAD = 3;
  const xy = pts.map((p, i) => [PAD + (i / (pts.length - 1)) * (width - PAD * 2), PAD + (1 - (p.numericValue - min) / range) * (height - PAD * 2)]);
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ flexShrink: 0, overflow: "visible" }}>
      <polyline points={xy.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r={3} fill={color} />
    </svg>
  );
}

export default function MarkerCard({ marker }) {
  const [expanded, setExpanded] = useState(false);
  const { label, entries, latest, previous, trend, unit, aliases, canonical } = marker;
  if (!latest) return null;

  const s = statusOf(latest.status);
  const moved = previous && trend.improving !== null;
  const tag = moved ? (trend.improving ? "Improving" : "Worse") : s.label;
  const tagColor = moved ? (trend.improving ? "var(--accent-text)" : "var(--danger)") : s.color;
  const value = String(latest.value);
  const showUnit = unit && !value.includes(unit);
  const day = (iso) => fmtDay(iso, { day: "numeric", month: "short" });
  const context = previous
    ? trend.direction === "flat" && latest.status === previous.status
      ? `steady across ${entries.length} reports`
      : `was ${previous.value} on ${day(previous.date)}`
    : fmtDay(latest.date);
  const mergedFrom = canonical && aliases.length > 1 ? aliases.filter((a) => a.toLowerCase() !== label.toLowerCase()) : [];

  return (
    <div style={{ borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}>
      <button
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        style={{ width: "100%", padding: 16, border: "none", background: "transparent", color: "var(--text)", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: tagColor, flexShrink: 0 }}>{tag}</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>
              {value}
              {showUnit && <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}> {unit}</span>}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{context}</div>
          </div>
          <Sparkline entries={entries} color={s.color} />
          {entries.length > 1 && <ChevronDown size={16} color="var(--text-faint)" style={{ flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />}
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px 14px" }}>
          {mergedFrom.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 10, lineHeight: 1.5 }}>
              Also reported as {mergedFrom.join(", ")} — grouped as one marker.
            </div>
          )}
          {[...entries].reverse().map((e, i) => {
            const es = statusOf(e.status);
            return (
              <div key={e.date} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 14 }}>
                  <span style={{ flex: 1, color: "var(--text-muted)" }}>{fmtDay(e.date)}</span>
                  <span>{e.value}</span>
                  <span style={{ color: es.color, fontWeight: 600, minWidth: 74, textAlign: "right" }}>{es.label}</span>
                </div>
                {e.note && e.status !== "normal" && <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4, lineHeight: 1.45 }}>{e.note}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
