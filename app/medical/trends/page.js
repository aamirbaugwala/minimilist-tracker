"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabase";
import { ArrowLeft, Activity, Loader2, Info, Search, X } from "lucide-react";
import {
  buildMarkerSeries,
  groupByPanel,
  matchesFilter,
  matchesSearch,
  summarise,
  FILTERS,
} from "../../lib/markerSeries";
import PanelTabs from "../../components/medical/PanelTabs";
import MarkerCard from "../../components/medical/MarkerCard";

export default function MedicalTrendsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState("all");

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/");
        return;
      }
      try {
        const res = await fetch(`/api/medical/history?userId=${session.user.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (!cancelled && data.reports) setReports(data.reports);
      } catch {
        /* silent — empty state covers it */
      }
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const series = useMemo(() => buildMarkerSeries(reports), [reports]);
  const stats = useMemo(() => summarise(series, reports.length), [series, reports.length]);

  const groups = useMemo(() => {
    const visible = series.filter(
      (m) => matchesFilter(m, filter) && matchesSearch(m, search),
    );
    return groupByPanel(visible);
  }, [series, filter, search]);

  // Chips always show every panel that survived search/filter; the selected one
  // narrows the list below. Selecting a panel that then disappears (because the
  // search changed) silently falls back to "all".
  const shown = groups.filter((g) => panel === "all" || g.panel.id === panel);
  const effective = shown.length > 0 ? shown : groups;

  if (loading) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090b" }}>
        <Loader2 size={28} color="#6366f1" className="animate-spin" />
      </div>
    );
  }

  const visibleCount = groups.reduce((n, g) => n + g.markers.length, 0);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#09090b",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        maxWidth: 640,
        margin: "0 auto",
        // Clear the fixed bottom nav, plus the iOS home indicator.
        paddingBottom: "calc(90px + env(safe-area-inset-bottom, 0px))",
        // Horizontal scroll rows inside must never scroll the page itself.
        overflowX: "hidden",
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#09090bee",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
          padding: "13px 16px",
          display: "flex",
          alignItems: "center",
          gap: 11,
        }}
      >
        <button
          onClick={() => router.push("/medical")}
          style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", padding: 4 }}
        >
          <ArrowLeft size={20} />
        </button>
        <Activity size={19} color="#6366f1" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: "1rem" }}>Marker Trends</div>
          <div style={{ fontSize: "0.68rem", color: "#52525b" }}>
            {stats.markerCount} markers · {stats.reportCount} report
            {stats.reportCount !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* ── AT-A-GLANCE ── */}
        {stats.markerCount > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[
              { label: "Abnormal", value: stats.abnormalCount, color: "#f59e0b" },
              { label: "Improving", value: stats.improvingCount, color: "#10b981" },
              { label: "Worsening", value: stats.worseningCount, color: "#ef4444" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${s.value > 0 ? s.color + "30" : "var(--border)"}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: s.value > 0 ? s.color : "#3f3f46", lineHeight: 1.1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: "0.66rem", color: "#52525b", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.6 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── SEARCH ── */}
        {stats.markerCount > 0 && (
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={14} color="#3f3f46" style={{ position: "absolute", left: 12 }} />
            <input
              type="text"
              placeholder="Search marker (HbA1c, creatinine…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "11px 34px",
                borderRadius: 10,
                boxSizing: "border-box",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "#fff",
                // 16px exactly: iOS Safari auto-zooms the viewport when a focused
                // input is smaller, which is jarring inside an installed PWA.
                fontSize: 16,
                outline: "none",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ position: "absolute", right: 8, background: "none", border: "none", color: "#52525b", cursor: "pointer", padding: 4, display: "flex" }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* ── FILTERS ── */}
        {stats.markerCount > 0 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 20,
                  background: filter === f.key ? "#6366f1" : "var(--surface)",
                  color: filter === f.key ? "#fff" : "#71717a",
                  border: filter === f.key ? "1px solid #6366f1" : "1px solid var(--border)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* ── PANEL CHIPS ── */}
        {groups.length > 0 && (
          <PanelTabs
            groups={groups}
            selected={panel}
            onSelect={setPanel}
            totalMarkers={visibleCount}
            totalAbnormal={groups.reduce((n, g) => n + g.abnormalCount, 0)}
          />
        )}

        {/* ── CONTENT ── */}
        {stats.markerCount === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <Activity size={40} color="#27272a" />
            <div style={{ fontWeight: 700, color: "#52525b" }}>No markers yet</div>
            <div style={{ fontSize: "0.82rem", color: "#3f3f46" }}>
              Upload medical reports to start tracking your health markers over time.
            </div>
            <button
              onClick={() => router.push("/medical")}
              style={{ marginTop: 8, padding: "9px 20px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
            >
              Upload a Report
            </button>
          </div>
        ) : visibleCount === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#52525b", fontSize: "0.85rem" }}>
            No markers match {search ? `“${search}”` : "this filter"}.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {effective.map((group) => (
              <div key={group.panel.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Group label only when viewing everything — redundant once a
                    single panel is selected, since the chip already says it. */}
                {panel === "all" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      marginTop: 6,
                      paddingBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: group.panel.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                        color: group.panel.color,
                      }}
                    >
                      {group.panel.label}
                    </span>
                    <span style={{ fontSize: "0.68rem", color: "#3f3f46" }}>
                      {group.markers.length}
                    </span>
                    <div style={{ flex: 1, height: 1, background: "#1a1a1f" }} />
                  </div>
                )}

                {group.markers.map((marker) => (
                  <MarkerCard key={marker.id} marker={marker} />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── FOOTER ── */}
        {stats.markerCount > 0 && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "#f59e0b08",
              border: "1px solid #f59e0b20",
              display: "flex",
              gap: 8,
              fontSize: "0.71rem",
              color: "#78716c",
              lineHeight: 1.55,
            }}
          >
            <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
            Markers reported under different names by different labs are grouped
            together. Dates are the report’s own collection date. Informational
            only — consult your physician.
          </div>
        )}
      </div>
    </div>
  );
}
