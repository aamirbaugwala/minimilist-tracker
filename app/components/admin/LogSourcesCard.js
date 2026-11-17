"use client";

/**
 * Admin: how people log food (food_logs.source), last 30 days.
 * Schema + RPC: docs/log-source.sql
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../../supabase";

const LABEL = {
  sheet: "Food sheet",
  quick_add: "Quick add chips",
  nudge: "Coach nudge chip",
  water: "Water +",
  shortcut: "Home-screen shortcut",
  custom: "Custom food",
  snap: "Snap a plate",
  repeat: "Same as yesterday",
  barcode: "Barcode scan",
  coach: "Coach chat",
  voice: "Voice mode",
  recipe: "Recipe Studio",
  "before tracking": "Before tracking started",
};

export default function LogSourcesCard() {
  const [rows, setRows] = useState(null);
  const [problem, setProblem] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("get_log_sources", { days: 30 }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setProblem(/does not exist|Could not find the function/i.test(error.message || "") ? "missing" : error.message);
      else setRows(data || []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = (rows || []).reduce((n, r) => n + Number(r.logs || 0), 0);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>How people log food</span>
        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>last 30 days{total ? ` · ${total.toLocaleString()} logs` : ""}</span>
      </div>
      {problem === "missing" ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Not set up yet — run <code style={{ color: "var(--accent-text)" }}>docs/log-source.sql</code> in the Supabase SQL editor. New logs are tagged from then on.
        </p>
      ) : problem ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--danger)" }}>Couldn’t load: {problem}</p>
      ) : rows === null ? (
        <div style={{ display: "grid", placeItems: "center", padding: 12 }}>
          <Loader2 size={18} className="animate-spin" color="var(--text-muted)" />
        </div>
      ) : rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>No food logged in the last 30 days.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r) => {
            const pct = total ? Math.round((Number(r.logs) / total) * 100) : 0;
            return (
              <div key={r.source}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{LABEL[r.source] || r.source}</span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {Number(r.logs).toLocaleString()} · {r.users} {Number(r.users) === 1 ? "person" : "people"} · {pct}%
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: "var(--track)", marginTop: 5, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: r.source === "before tracking" ? "var(--text-faint)" : "var(--accent)" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
