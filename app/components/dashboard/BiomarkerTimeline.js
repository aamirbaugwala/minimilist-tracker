"use client";

/**
 * Nutrition ↔ Biomarkers
 *
 * For each blood test, shows what was actually eaten in the window before the
 * draw, so consecutive tests can be read against how eating changed.
 *
 * Self-fetching on purpose: most users have no medical reports, and the log
 * history needed here goes back far further than the dashboard's 30-day load.
 * Bailing out early when there are no reports keeps that cost off everyone else.
 */

import { useEffect, useState } from "react";
import {
  HeartPulse,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Info,
} from "lucide-react";
import { supabase } from "../../supabase";
import { fetchLogsPaginated } from "../../lib/fetchLogs";
import {
  WINDOW_OPTIONS,
  aggregateDailyTotals,
  buildCorrelations,
  reportDateOf,
  NUTRITION_FIELDS,
  summarise,
} from "../../lib/biomarkerCorrelation";

const STATUS_COLOR = { high: "#ef4444", low: "#f59e0b", normal: "#22c55e" };
const CARD = {
  background: "#18181b",
  border: "1px solid #27272a",
  borderRadius: 16,
  padding: 24,
};

const fmt = (n, decimals) =>
  n === null || n === undefined
    ? "—"
    : Number(n).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

const prettyDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });

export default function BiomarkerTimeline() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [dailyTotals, setDailyTotals] = useState(new Map());
  const [windowDays, setWindowDays] = useState(60);
  const [selectedKey, setSelectedKey] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const { data: reportRows, error: reportErr } = await supabase
          .from("medical_reports")
          .select("*")
          .eq("user_id", session.user.id);
        if (reportErr) throw reportErr;
        if (cancelled) return;

        const withDates = (reportRows || []).filter((r) => reportDateOf(r));
        setReports(withDates);

        // No reports => skip the expensive log fetch entirely.
        if (withDates.length === 0) return;

        const earliest = withDates
          .map(reportDateOf)
          .sort((a, b) => a.localeCompare(b))[0];
        const start = new Date(earliest + "T00:00:00Z");
        start.setUTCDate(start.getUTCDate() - Math.max(...WINDOW_OPTIONS));

        const logs = await fetchLogsPaginated({
          userIds: [session.user.id],
          from: start.toISOString().slice(0, 10),
        });
        if (cancelled) return;

        setDailyTotals(aggregateDailyTotals(logs));
      } catch (e) {
        if (!cancelled) setError(e.message || "Could not load biomarker data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const series = buildCorrelations(reports, dailyTotals, windowDays);
  const selected = series.find((s) => s.key === selectedKey) ?? series[0];
  const insight = selected ? summarise(selected) : null;

  // Earliest day with any food logged — used to explain tests that predate tracking.
  const earliestLog = dailyTotals.size
    ? [...dailyTotals.keys()].sort()[0]
    : null;

  /** Why is there nothing to compare for the selected marker? */
  const emptyReason = () => {
    if (!selected.points.some((p) => p.nutrition)) {
      if (!earliestLog) {
        return "No food logs yet, so there's nothing to line these results up against.";
      }
      if (selected.latest && selected.latest.date < earliestLog) {
        const many = selected.points.length > 1;
        return `Your food logs start ${prettyDate(earliestLog)} — ${many ? "these tests predate" : "this test predates"} them, so there's nothing to compare. A report dated after you started logging will fill this in.`;
      }
      return "No days were logged in the windows before these tests.";
    }
    if (selected.points.length < 2) {
      return "One test so far — upload another report to compare windows.";
    }
    return "Only one of these tests has logged days behind it, so there's no before/after yet.";
  };

  // ── Shells ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 10 }}>
        <Loader2 size={16} className="animate-spin" color="#8b5cf6" />
        <span style={{ color: "#71717a", fontSize: "0.85rem" }}>
          Linking blood work to your nutrition…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 10 }}>
        <AlertCircle size={16} color="#ef4444" />
        <span style={{ color: "#71717a", fontSize: "0.85rem" }}>{error}</span>
      </div>
    );
  }

  if (reports.length === 0 || series.length === 0) {
    return (
      <div style={{ ...CARD, textAlign: "center" }}>
        <HeartPulse size={26} color="#3f3f46" style={{ marginBottom: 10 }} />
        <div style={{ fontWeight: 700, color: "#52525b", fontSize: "0.9rem" }}>
          Nutrition ↔ Biomarkers
        </div>
        <div style={{ fontSize: "0.8rem", color: "#3f3f46", marginTop: 6 }}>
          {reports.length === 0
            ? "Upload a blood report to see how your eating lines up with your lab results."
            : "No numeric markers to trend yet — results like “Negative” can’t be charted."}
        </div>
      </div>
    );
  }

  return (
    <div style={CARD}>
      {/* Header + window picker */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HeartPulse size={18} color="#ec4899" />
          <span style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>
            Nutrition ↔ Biomarkers
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {WINDOW_OPTIONS.map((w) => (
            <button
              key={w}
              onClick={() => setWindowDays(w)}
              style={{
                padding: "4px 11px",
                borderRadius: 8,
                border: "1px solid " + (windowDays === w ? "#ec4899" : "#27272a"),
                background: windowDays === w ? "rgba(236,72,153,0.15)" : "transparent",
                color: windowDays === w ? "#ec4899" : "#52525b",
                fontSize: "0.72rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: "0.75rem", color: "#52525b", marginBottom: 16 }}>
        What you ate in the {windowDays} days before each test
      </div>

      {/* Marker chips — abnormal first */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 6,
          marginBottom: 16,
        }}
      >
        {series.map((s) => {
          const active = s.key === selected.key;
          const color = STATUS_COLOR[s.latest?.status] || "#71717a";
          return (
            <button
              key={s.key}
              onClick={() => setSelectedKey(s.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                padding: "6px 12px",
                borderRadius: 20,
                border: "1px solid " + (active ? color : "#27272a"),
                background: active ? color + "1f" : "#111116",
                color: active ? "#fff" : "#71717a",
                fontSize: "0.78rem",
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              {s.displayName}
            </button>
          );
        })}
      </div>

      {/* Test points */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 8,
          marginBottom: 16,
        }}
      >
        {selected.points.map((p) => {
          const color = STATUS_COLOR[p.status] || "#71717a";
          return (
            <div
              key={p.date}
              style={{
                flexShrink: 0,
                minWidth: 104,
                background: "#111116",
                border: "1px solid " + color + "44",
                borderRadius: 12,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: "0.65rem", color: "#52525b" }}>
                {prettyDate(p.date)}
              </div>
              <div
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 800,
                  color,
                  lineHeight: 1.2,
                }}
              >
                {p.value}
              </div>
              <div style={{ fontSize: "0.62rem", color: "#3f3f46" }}>
                {p.nutrition
                  ? `${p.nutrition.daysLogged}/${windowDays} d logged`
                  : "no logs before"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Before/after nutrition comparison */}
      {selected.previous && selected.latest?.nutrition && selected.previous?.nutrition ? (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.78rem",
              minWidth: 340,
            }}
          >
            <thead>
              <tr style={{ color: "#52525b", textAlign: "right" }}>
                <th style={{ textAlign: "left", fontWeight: 600, paddingBottom: 6 }}>
                  Daily avg
                </th>
                <th style={{ fontWeight: 600, paddingBottom: 6 }}>
                  before {prettyDate(selected.previous.date)}
                </th>
                <th style={{ fontWeight: 600, paddingBottom: 6 }}>
                  before {prettyDate(selected.latest.date)}
                </th>
                <th style={{ fontWeight: 600, paddingBottom: 6 }}>change</th>
              </tr>
            </thead>
            <tbody>
              {NUTRITION_FIELDS.map((f) => {
                const before = selected.previous.nutrition[f.key];
                const after = selected.latest.nutrition[f.key];
                const diff = after - before;
                const sign = diff > 0 ? "+" : "";
                return (
                  <tr key={f.key} style={{ borderTop: "1px solid #1f1f23" }}>
                    <td style={{ padding: "7px 0", color: f.color, fontWeight: 600 }}>
                      {f.label}
                    </td>
                    <td style={{ textAlign: "right", color: "#71717a" }}>
                      {fmt(before, f.decimals)}
                      {f.unit}
                    </td>
                    <td style={{ textAlign: "right", color: "#e4e4e7", fontWeight: 600 }}>
                      {fmt(after, f.decimals)}
                      {f.unit}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color: Math.abs(diff) < 0.05 ? "#3f3f46" : f.color,
                      }}
                    >
                      {Math.abs(diff) < 0.05 ? "—" : `${sign}${fmt(diff, f.decimals)}${f.unit}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          style={{
            fontSize: "0.8rem",
            color: "#52525b",
            lineHeight: 1.55,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid #27272a",
            borderRadius: 10,
            padding: "11px 13px",
          }}
        >
          {emptyReason()}
        </div>
      )}

      {/* Insight */}
      {insight && (
        <div
          style={{
            marginTop: 16,
            background:
              insight.improving === true
                ? "rgba(34,197,94,0.07)"
                : insight.improving === false
                  ? "rgba(239,68,68,0.07)"
                  : "rgba(255,255,255,0.03)",
            border:
              "1px solid " +
              (insight.improving === true
                ? "rgba(34,197,94,0.25)"
                : insight.improving === false
                  ? "rgba(239,68,68,0.25)"
                  : "#27272a"),
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            {insight.improving === true ? (
              <TrendingDown size={14} color="#22c55e" />
            ) : insight.improving === false ? (
              <TrendingUp size={14} color="#ef4444" />
            ) : (
              <Info size={14} color="#71717a" />
            )}
            <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#e4e4e7" }}>
              {insight.headline}
              {insight.improving === true && " — toward normal"}
              {insight.improving === false && " — away from normal"}
            </span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "#a1a1aa", lineHeight: 1.55 }}>
            {insight.shifts.length > 0 ? (
              <>
                Over the same stretch,{" "}
                {insight.shifts.map((s, i) => (
                  <span key={s.key}>
                    {i > 0 && " and "}
                    <strong style={{ color: s.color }}>
                      {s.label.toLowerCase()} {s.change > 0 ? "rose" : "fell"}{" "}
                      {fmt(Math.abs(s.change), s.decimals)}
                      {s.unit}/day
                    </strong>
                  </span>
                ))}
                .
              </>
            ) : (
              "Your average intake barely moved between these two windows."
            )}
          </div>
          {!insight.reliable && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
                fontSize: "0.72rem",
                color: "#f59e0b",
              }}
            >
              <AlertCircle size={12} />
              Thin data — too few days logged for these averages to be dependable.
            </div>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          fontSize: "0.68rem",
          color: "#3f3f46",
          lineHeight: 1.5,
        }}
      >
        Shows association, not cause. Many things move lab results, and only the
        days you logged are counted here. Discuss changes with your doctor.
      </div>
    </div>
  );
}
