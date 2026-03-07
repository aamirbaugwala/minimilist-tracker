"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabase";
import {
  ArrowLeft,
  Activity,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from "lucide-react";

// ─── STATUS COLOURS ───────────────────────────────────────────────────────────
const STATUS_COLOR = {
  high:       { color: "#ef4444", bg: "#ef444418", dot: "#ef4444" },
  low:        { color: "#3b82f6", bg: "#3b82f618", dot: "#3b82f6" },
  borderline: { color: "#f59e0b", bg: "#f59e0b18", dot: "#f59e0b" },
  normal:     { color: "#10b981", bg: "#10b98118", dot: "#10b981" },
};

function statusDot(status) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.normal;
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: c.dot, flexShrink: 0,
    }} />
  );
}

// ─── SPARKLINE (SVG mini chart) ───────────────────────────────────────────────
function Sparkline({ points, color = "#6366f1" }) {
  if (!points || points.length < 2) return null;
  const vals = points.map((p) => p.numericValue).filter((v) => v !== null);
  if (vals.length < 2) return null;

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 80, H = 28, PAD = 3;

  const coords = points
    .filter((p) => p.numericValue !== null)
    .map((p, i, arr) => {
      const x = PAD + (i / Math.max(arr.length - 1, 1)) * (W - PAD * 2);
      const y = PAD + (1 - (p.numericValue - min) / range) * (H - PAD * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <polyline
        points={coords}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points
        .filter((p) => p.numericValue !== null)
        .map((p, i, arr) => {
          const x = PAD + (i / Math.max(arr.length - 1, 1)) * (W - PAD * 2);
          const y = PAD + (1 - (p.numericValue - min) / range) * (H - PAD * 2);
          return (
            <circle
              key={i}
              cx={x} cy={y} r={2.2}
              fill={color}
              stroke="#09090b" strokeWidth={1}
            />
          );
        })}
    </svg>
  );
}

// ─── MARKER TIMELINE CARD ─────────────────────────────────────────────────────
function MarkerCard({ markerName, entries }) {
  const [expanded, setExpanded] = useState(false);

  // entries: [{ date, value, numericValue, status, unit, note }] sorted oldest→newest
  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest = sorted[sorted.length - 1];
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

  // Direction arrow
  let TrendIcon = Minus, trendColor = "#71717a";
  if (prev && latest.numericValue !== null && prev.numericValue !== null) {
    if (latest.numericValue > prev.numericValue) { TrendIcon = TrendingUp; trendColor = latest.status === "high" ? "#ef4444" : "#10b981"; }
    else if (latest.numericValue < prev.numericValue) { TrendIcon = TrendingDown; trendColor = latest.status === "low" ? "#ef4444" : "#10b981"; }
  }

  const sc = STATUS_COLOR[latest.status] || STATUS_COLOR.normal;

  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${latest.status !== "normal" ? `${sc.dot}35` : "var(--border)"}`,
      borderRadius: 14, overflow: "hidden",
    }}>
      {/* Header row */}
      <div
        style={{ padding: "12px 14px", cursor: "pointer" }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {statusDot(latest.status)}
          <span style={{ fontWeight: 700, fontSize: "0.9rem", flex: 1 }}>{markerName}</span>
          <Sparkline points={sorted} color={sc.dot} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, minWidth: 70 }}>
            <span style={{
              fontWeight: 700, fontSize: "0.88rem",
              color: sc.color,
              background: sc.bg,
              padding: "2px 8px", borderRadius: 20,
            }}>{latest.value}</span>
            <span style={{ fontSize: "0.67rem", color: "#52525b" }}>
              {new Date(latest.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          <TrendIcon size={14} color={trendColor} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: "0.72rem", color: "#52525b" }}>{expanded ? "▲" : "▼"}</span>
        </div>
        {entries.length > 1 && !expanded && (
          <div style={{ fontSize: "0.72rem", color: "#52525b", marginTop: 5, paddingLeft: 18 }}>
            {entries.length} readings · {new Date(sorted[0].date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })} – {new Date(sorted[sorted.length - 1].date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
          </div>
        )}
      </div>

      {/* Timeline */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 0 }}>
          {sorted.map((entry, i) => {
            const esc = STATUS_COLOR[entry.status] || STATUS_COLOR.normal;
            const isLast = i === sorted.length - 1;
            return (
              <div key={i} style={{ display: "flex", gap: 10, position: "relative" }}>
                {/* Timeline line */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%", flexShrink: 0, marginTop: 4,
                    background: esc.dot,
                    boxShadow: isLast ? `0 0 0 3px ${esc.dot}30` : "none",
                  }} />
                  {!isLast && (
                    <div style={{ width: 2, flex: 1, background: "#27272a", minHeight: 16 }} />
                  )}
                </div>
                <div style={{ flex: 1, paddingBottom: isLast ? 0 : 14 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                    <span style={{
                      fontWeight: 700, fontSize: "0.85rem",
                      color: esc.color,
                    }}>{entry.value}</span>
                    <span style={{ fontSize: "0.7rem", color: "#52525b" }}>
                      {new Date(entry.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  {entry.note && (
                    <div style={{ fontSize: "0.73rem", color: "#71717a", marginTop: 2 }}>{entry.note}</div>
                  )}
                  <span style={{
                    display: "inline-block", marginTop: 3,
                    fontSize: "0.65rem", fontWeight: 700,
                    padding: "1px 7px", borderRadius: 20,
                    background: esc.bg, color: esc.color,
                    border: `1px solid ${esc.dot}30`,
                    textTransform: "capitalize",
                  }}>{entry.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function parseNumeric(valueStr) {
  if (!valueStr) return null;
  const m = String(valueStr).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

/**
 * Build a map: markerName → [{ date, value, numericValue, status, unit, note }]
 * from all reports (each with flags[] and a display date)
 */
function buildMarkerMap(reports) {
  const map = {}; // markerName (lowercased key) → { displayName, entries[] }

  for (const report of reports) {
    const date = report.report_date || report.created_at;
    if (!report.flags?.length) continue;

    for (const flag of report.flags) {
      const key = flag.marker?.toLowerCase().trim();
      if (!key) continue;

      if (!map[key]) map[key] = { displayName: flag.marker, entries: [] };

      map[key].entries.push({
        date,
        value: flag.value || "—",
        numericValue: parseNumeric(flag.value),
        status: flag.status || "normal",
        note: flag.note || "",
      });
    }
  }

  return map;
}

// ─── FILTER TABS ──────────────────────────────────────────────────────────────
const FILTER_TABS = [
  { key: "all",       label: "All" },
  { key: "abnormal",  label: "Abnormal" },
  { key: "improving", label: "Improving" },
  { key: "worsening", label: "Worsening" },
];

function markerMatchesFilter(entries, filter) {
  if (filter === "all") return true;
  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest = sorted[sorted.length - 1];
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

  if (filter === "abnormal") return latest.status !== "normal";

  if (!prev || latest.numericValue === null || prev.numericValue === null) return false;
  const diff = latest.numericValue - prev.numericValue;

  if (filter === "improving") {
    if (latest.status === "high") return diff < 0;
    if (latest.status === "low")  return diff > 0;
    return false; // if normal already, not "improving" in terms of trend concern
  }
  if (filter === "worsening") {
    if (latest.status === "high") return diff > 0;
    if (latest.status === "low")  return diff < 0;
    return false;
  }
  return true;
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function MedicalTrendsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [markerMap, setMarkerMap] = useState({});
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [reportCount, setReportCount] = useState(0);

  const loadData = async (sess) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/medical/history?userId=${sess.user.id}`, {
        headers: { Authorization: `Bearer ${sess.access_token}` },
      });
      const data = await res.json();
      if (data.reports) {
        setReportCount(data.reports.length);
        setMarkerMap(buildMarkerMap(data.reports));
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (!sess) { router.push("/"); return; }
      loadData(sess);
    });
  }, [router]);

  // Filter + search
  const allMarkerKeys = Object.keys(markerMap);
  const filteredKeys = allMarkerKeys.filter((key) => {
    const { displayName, entries } = markerMap[key];
    if (search && !displayName.toLowerCase().includes(search.toLowerCase())) return false;
    return markerMatchesFilter(entries, filter);
  });

  // Sort: abnormal first, then by most recent date desc
  filteredKeys.sort((a, b) => {
    const la = markerMap[a].entries;
    const lb = markerMap[b].entries;
    const latestA = la.sort((x, y) => new Date(y.date) - new Date(x.date))[0];
    const latestB = lb.sort((x, y) => new Date(y.date) - new Date(x.date))[0];
    // abnormal first
    const aAbn = latestA.status !== "normal" ? 0 : 1;
    const bAbn = latestB.status !== "normal" ? 0 : 1;
    if (aAbn !== bAbn) return aAbn - bAbn;
    return new Date(latestB.date) - new Date(latestA.date);
  });

  const abnormalCount = allMarkerKeys.filter(
    (k) => markerMap[k].entries.some((e) => e.status !== "normal")
  ).length;

  if (loading) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090b" }}>
        <Loader2 size={28} color="#6366f1" className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100dvh", background: "#09090b", color: "#fff",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex", flexDirection: "column",
      maxWidth: 600, margin: "0 auto",
      paddingBottom: 80,
    }}>
      {/* ── HEADER ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#09090bdd", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={() => router.push("/medical")}
          style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", padding: 4 }}
        >
          <ArrowLeft size={20} />
        </button>
        <Activity size={20} color="#6366f1" />
        <div>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>Marker Trends</div>
          <div style={{ fontSize: "0.7rem", color: "#52525b" }}>
            {allMarkerKeys.length} markers · {reportCount} report{reportCount !== 1 ? "s" : ""}
            {abnormalCount > 0 && ` · ${abnormalCount} abnormal`}
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── SEARCH ── */}
        <input
          type="text"
          placeholder="Search marker (e.g. HbA1c, Haemoglobin…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 10, boxSizing: "border-box",
            background: "var(--surface)", border: "1px solid var(--border)",
            color: "#fff", fontSize: "0.85rem", outline: "none",
          }}
        />

        {/* ── FILTER TABS ── */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {FILTER_TABS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "5px 14px", borderRadius: 20, border: "none",
                background: filter === f.key ? "#6366f1" : "var(--surface)",
                color: filter === f.key ? "#fff" : "#71717a",
                fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                flexShrink: 0,
                border: filter === f.key ? "none" : "1px solid var(--border)",
              }}
            >{f.label}</button>
          ))}
        </div>

        {/* ── EMPTY STATE ── */}
        {allMarkerKeys.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <Activity size={40} color="#27272a" />
            <div style={{ fontWeight: 700, color: "#52525b" }}>No markers yet</div>
            <div style={{ fontSize: "0.82rem", color: "#3f3f46" }}>Upload medical reports to start tracking your health markers over time.</div>
            <button
              onClick={() => router.push("/medical")}
              style={{
                marginTop: 8, padding: "9px 20px", borderRadius: 10, border: "none",
                background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
              }}
            >Upload a Report</button>
          </div>
        ) : filteredKeys.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#52525b", fontSize: "0.85rem" }}>
            No markers match this filter.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredKeys.map((key) => (
              <MarkerCard
                key={key}
                markerName={markerMap[key].displayName}
                entries={markerMap[key].entries}
              />
            ))}
          </div>
        )}

        {/* ── FOOTER NOTE ── */}
        {allMarkerKeys.length > 0 && (
          <div style={{
            padding: "10px 14px", borderRadius: 12,
            background: "#f59e0b08", border: "1px solid #f59e0b20",
            display: "flex", gap: 8, fontSize: "0.72rem", color: "#78716c",
          }}>
            <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            Dates shown are from the report itself (collection/sample date). For informational purposes only — consult your physician.
          </div>
        )}
      </div>
    </div>
  );
}
