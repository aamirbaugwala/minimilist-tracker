"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Layers } from "lucide-react";

export const STATUS_COLOR = {
  high: { color: "#ef4444", bg: "#ef444418", dot: "#ef4444", label: "High" },
  low: { color: "#3b82f6", bg: "#3b82f618", dot: "#3b82f6", label: "Low" },
  borderline: { color: "#f59e0b", bg: "#f59e0b18", dot: "#f59e0b", label: "Borderline" },
  normal: { color: "#10b981", bg: "#10b98118", dot: "#10b981", label: "Normal" },
};

const sc = (status) => STATUS_COLOR[status] || STATUS_COLOR.normal;

const fmtDate = (iso, opts) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", opts);

/** Mini SVG trend line. Needs ≥2 numeric points, so text-only markers get none. */
function Sparkline({ entries, color, width = 78, height = 26 }) {
  const pts = entries.filter((e) => e.numericValue !== null);
  if (pts.length < 2) return null;

  const vals = pts.map((p) => p.numericValue);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const PAD = 3;

  const xy = pts.map((p, i) => [
    PAD + (i / (pts.length - 1)) * (width - PAD * 2),
    PAD + (1 - (p.numericValue - min) / range) * (height - PAD * 2),
  ]);

  return (
    <svg width={width} height={height} style={{ flexShrink: 0, overflow: "visible" }}>
      <polyline
        points={xy.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {xy.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === xy.length - 1 ? 2.8 : 2}
          fill={color}
          stroke="#09090b"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

export default function MarkerCard({ marker }) {
  const [expanded, setExpanded] = useState(false);
  const { label, entries, latest, previous, trend, unit, aliases, canonical } = marker;
  if (!latest) return null;

  const s = sc(latest.status);
  const TrendIcon =
    trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;
  const trendColor =
    trend.improving === true ? "#10b981" : trend.improving === false ? "#ef4444" : "#52525b";

  // Only worth showing when two differently-worded rows were actually merged.
  const mergedFrom = aliases.filter((a) => a.toLowerCase() !== label.toLowerCase());
  const showMerged = canonical && aliases.length > 1;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${latest.status !== "normal" ? `${s.dot}35` : "var(--border)"}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* Two rows rather than one. Squeezing name + sparkline + value + trend +
          chevron onto a single line overflows on a phone, and this app is used
          mostly as a PWA. Two rows need no breakpoints and read fine at any
          width. The whole header is the tap target (min 44px, Apple HIG). */}
      <div
        style={{ padding: "11px 13px", cursor: "pointer", minHeight: 44 }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: s.dot,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontWeight: 700,
              fontSize: "0.88rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
          <span
            style={{
              flexShrink: 0,
              fontWeight: 700,
              fontSize: "0.82rem",
              color: s.color,
              background: s.bg,
              padding: "3px 9px",
              borderRadius: 20,
              whiteSpace: "nowrap",
            }}
          >
            {latest.value}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 6,
            paddingLeft: 17,
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: "0.67rem",
              color: "#52525b",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entries.length > 1
              ? `${entries.length} readings · ${fmtDate(entries[0].date, { month: "short", year: "2-digit" })} – ${fmtDate(latest.date, { month: "short", year: "2-digit" })}`
              : fmtDate(latest.date, { day: "numeric", month: "short", year: "numeric" })}
          </span>

          <Sparkline entries={entries} color={s.dot} />
          {previous && <TrendIcon size={14} color={trendColor} style={{ flexShrink: 0 }} />}
          <span style={{ fontSize: "0.7rem", color: "#3f3f46", flexShrink: 0 }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 14px" }}>
          {showMerged && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
                marginBottom: 12,
                padding: "7px 10px",
                borderRadius: 9,
                background: "#6366f10f",
                border: "1px solid #6366f125",
                fontSize: "0.7rem",
                color: "#818cf8",
                lineHeight: 1.5,
              }}
            >
              <Layers size={11} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                Merged across labs — also reported as{" "}
                {mergedFrom.map((a, i) => (
                  <span key={a}>
                    {i > 0 && ", "}
                    <em style={{ color: "#a5b4fc" }}>{a}</em>
                  </span>
                ))}
              </span>
            </div>
          )}

          {/* Newest first — most people look for the latest result */}
          {[...entries].reverse().map((entry, i, arr) => {
            const es = sc(entry.status);
            const isLast = i === arr.length - 1;
            return (
              <div key={entry.date} style={{ display: "flex", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14 }}>
                  <div
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: es.dot,
                      marginTop: 4,
                      flexShrink: 0,
                      boxShadow: i === 0 ? `0 0 0 3px ${es.dot}30` : "none",
                    }}
                  />
                  {!isLast && <div style={{ width: 2, flex: 1, background: "#27272a", minHeight: 14 }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: isLast ? 0 : 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem", color: es.color }}>
                      {entry.value}
                      {unit && !String(entry.value).includes(unit) && (
                        <span style={{ fontWeight: 400, color: "#52525b", fontSize: "0.7rem" }}> {unit}</span>
                      )}
                    </span>
                    <span style={{ fontSize: "0.68rem", color: "#52525b" }}>
                      {fmtDate(entry.date, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  {entry.note && (
                    <div style={{ fontSize: "0.72rem", color: "#71717a", marginTop: 2, lineHeight: 1.5 }}>
                      {entry.note}
                    </div>
                  )}
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 4,
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      padding: "1px 7px",
                      borderRadius: 20,
                      background: es.bg,
                      color: es.color,
                      border: `1px solid ${es.dot}30`,
                    }}
                  >
                    {es.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
