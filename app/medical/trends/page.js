"use client";

/**
 * Marker trends (Direction A) — every marker across all reports.
 * One chip row does both jobs the old screen split in two (status filters and
 * panel tabs): All · To watch · Improving · <panels present>. Search appears
 * only when there are enough markers to need it.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { supabase } from "../../supabase";
import PageHeader from "../../components/PageHeader";
import MarkerCard from "../../components/medical/MarkerCard";
import { buildMarkerSeries, groupByPanel, matchesFilter, matchesSearch, summarise } from "../../lib/markerSeries";
import { SHORT_PANEL, fmtDay, reportDay } from "../../lib/medicalUi";
import { sheetInput, primaryBtn } from "../../components/Sheet";

export default function MedicalTrendsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [chip, setChip] = useState("all");
  const [search, setSearch] = useState("");

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
  const allGroups = useMemo(() => groupByPanel(series), [series]);

  const chips = useMemo(
    () => [
      { id: "all", label: "All" },
      ...(stats.abnormalCount ? [{ id: "abnormal", label: "To watch" }] : []),
      ...(stats.improvingCount ? [{ id: "improving", label: "Improving" }] : []),
      ...allGroups.map((g) => ({ id: `panel:${g.panel.id}`, label: SHORT_PANEL[g.panel.id] || g.panel.label })),
    ],
    [stats, allGroups],
  );
  const active = chips.some((c) => c.id === chip) ? chip : "all";

  const groups = useMemo(() => {
    const status = active.startsWith("panel:") ? "all" : active;
    const panel = active.startsWith("panel:") ? active.slice(6) : null;
    const visible = series.filter((m) => matchesFilter(m, status) && matchesSearch(m, search) && (!panel || m.panel === panel));
    return groupByPanel(visible);
  }, [series, active, search]);
  const visibleCount = groups.reduce((n, g) => n + g.markers.length, 0);

  const days = reports.map(reportDay).filter(Boolean).sort();
  const span =
    days.length > 1
      ? `${fmtDay(days[0], { month: "short" })} – ${fmtDay(days[days.length - 1], { month: "short", year: "numeric" })}`
      : days[0]
        ? fmtDay(days[0])
        : "";

  if (loading) {
    return (
      <div style={{ height: "100dvh", display: "grid", placeItems: "center", background: "var(--bg)" }}>
        <Loader2 size={24} color="var(--text-muted)" className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "var(--text)", maxWidth: 640, margin: "0 auto", overflowX: "hidden", paddingBottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}>
      <PageHeader back="/dashboard" title="Marker trends" subtitle={stats.reportCount ? `${stats.reportCount} report${stats.reportCount === 1 ? "" : "s"} · ${span}` : undefined} />

      {stats.markerCount === 0 ? (
        <div style={{ margin: "24px 20px", padding: 24, borderRadius: 20, border: "1px dashed var(--border)", textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>No markers yet</div>
          <p style={{ margin: "8px 0 18px", fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)" }}>Add a blood report and each marker shows up here. With two or more reports you’ll see which way they’re moving.</p>
          <button onClick={() => router.push("/medical")} style={primaryBtn}>Add a report</button>
        </div>
      ) : (
        <div style={{ padding: "4px 20px 0", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13 }}>
            <span style={{ padding: "5px 10px", borderRadius: 99, background: "var(--surface)", border: "1px solid var(--border)" }}>{stats.markerCount} markers</span>
            {stats.abnormalCount > 0 && <span style={{ padding: "5px 10px", borderRadius: 99, background: "var(--warn-soft)", color: "var(--warn)", fontWeight: 600 }}>{stats.abnormalCount} to watch</span>}
            {stats.improvingCount > 0 && <span style={{ padding: "5px 10px", borderRadius: 99, background: "var(--accent-soft)", color: "var(--accent-text)", fontWeight: 600 }}>{stats.improvingCount} improving</span>}
            {stats.worseningCount > 0 && <span style={{ padding: "5px 10px", borderRadius: 99, background: "var(--danger-soft)", color: "var(--danger)", fontWeight: 600 }}>{stats.worseningCount} worse</span>}
          </div>

          {stats.markerCount > 12 && (
            <div style={{ position: "relative" }}>
              <Search size={16} color="var(--text-faint)" style={{ position: "absolute", left: 14, top: 16 }} />
              <input type="search" aria-label="Search markers" placeholder="Search a marker — HbA1c, LDL…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...sheetInput, paddingLeft: 40, paddingRight: 40, fontSize: 16 }} />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search" style={{ position: "absolute", right: 8, top: 10, background: "none", border: "none", padding: 4, color: "var(--text-muted)", cursor: "pointer", display: "grid" }}>
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          <div role="tablist" aria-label="Filter markers" className="chip-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -20px", padding: "0 20px" }}>
            {chips.map((c) => {
              const on = active === c.id;
              return (
                <button key={c.id} role="tab" aria-selected={on} onClick={() => setChip(c.id)} style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 99, border: on ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--text)" : "var(--text-muted)", fontFamily: "inherit", fontSize: 14, fontWeight: on ? 600 : 400, whiteSpace: "nowrap", cursor: "pointer" }}>
                  {c.label}
                </button>
              );
            })}
          </div>

          {visibleCount === 0 ? (
            <p style={{ margin: "24px 0", textAlign: "center", fontSize: 14, color: "var(--text-muted)" }}>No markers match {search ? `“${search}”` : "this filter"}.</p>
          ) : (
            groups.map((g) => (
              <section key={g.panel.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {!active.startsWith("panel:") && (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                    {SHORT_PANEL[g.panel.id] || g.panel.label} · {g.markers.length}
                  </div>
                )}
                {g.markers.map((m) => (
                  <MarkerCard key={m.id} marker={m} />
                ))}
              </section>
            ))
          )}

          <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--text-faint)" }}>
            The same test under different lab names is grouped together. Dates are each report’s collection date. Not a diagnosis.
          </p>
        </div>
      )}
    </div>
  );
}
