"use client";

/**
 * One report, read top-down (Direction A):
 *   verdict (how many to watch + the AI summary)
 *   → what this means for your food (Eat more / Go easy on; tap a chip for why)
 *   → markers (to watch first, the rest behind "Show all")
 *   → changes since your last report
 *   → Ask Coach · original PDF · delete
 * The long free-text analysis is folded away under "Read the full analysis".
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Download, MessageCircle, Trash2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import Sheet, { secondaryBtn, dangerBtn } from "../Sheet";
import { statusOf, reportTitle, reportDay, fmtDay, sortedFlags, watchCount, chipName } from "../../lib/medicalUi";

const sectionTitle = { fontSize: 13, color: "var(--text-muted)", marginBottom: 10 };

function FoodChips({ label, items, tone }) {
  const [open, setOpen] = useState(null);
  if (!items?.length) return null;
  const sel = open != null ? items[open] : null;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: tone, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map((it, i) => (
          <button
            key={it.food + i}
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
            style={{ padding: "7px 12px", borderRadius: 99, border: open === i ? `1.5px solid ${tone}` : "1px solid var(--border)", background: open === i ? "var(--surface-highlight)" : "var(--surface)", color: "var(--text)", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}
          >
            {chipName(it.food)}
          </button>
        ))}
      </div>
      {sel && (
        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text)", fontWeight: 600 }}>{sel.food}.</strong> {sel.reason}
        </p>
      )}
    </div>
  );
}

function MarkerRow({ flag, first }) {
  const s = statusOf(flag.status);
  const watch = flag.status !== "normal";
  return (
    <div style={{ padding: "12px 16px", borderTop: first ? "none" : "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: watch ? 600 : 400 }}>{flag.marker}</span>
        <span style={{ fontSize: 14, whiteSpace: "nowrap" }}>
          {flag.value} · <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>
        </span>
      </div>
      {watch && flag.note && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.45 }}>{flag.note}</div>}
    </div>
  );
}

export default function ReportDetail({ report, onClose, onDelete }) {
  const [showAll, setShowAll] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const flags = sortedFlags(report);
  const watch = watchCount(report);
  const visible = showAll ? flags : flags.filter((f) => f.status !== "normal").concat(flags.filter((f) => f.status === "normal").slice(0, Math.max(0, 4 - watch)));
  const title = reportTitle(report);
  const ask = `About my ${title} report from ${fmtDay(reportDay(report))}: what should I change in my meals this week?`;

  return (
    <Sheet
      title={title}
      subtitle={`${fmtDay(reportDay(report))} · ${flags.length} marker${flags.length === 1 ? "" : "s"}`}
      onClose={onClose}
      tall
      footer={
        <Link href={`/agent?ask=${encodeURIComponent(ask)}`} style={{ flex: 1, height: 50, borderRadius: 14, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
          <MessageCircle size={18} /> Ask Coach about this report
        </Link>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <section style={{ padding: 16, borderRadius: 16, background: watch ? "var(--warn-soft)" : "var(--accent-soft)" }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: watch ? "var(--warn)" : "var(--accent-text)" }}>
            {watch ? `${watch} marker${watch === 1 ? "" : "s"} to watch` : "Everything in range"}
          </div>
          {report.summary && <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55 }}>{report.summary}</p>}
        </section>

        {(report.include_foods?.length > 0 || report.exclude_foods?.length > 0) && (
          <section>
            <div style={sectionTitle}>What this means for your food</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <FoodChips label="Eat more" items={report.include_foods} tone="var(--accent-text)" />
              <FoodChips label="Go easy on" items={report.exclude_foods} tone="var(--warn)" />
            </div>
          </section>
        )}

        {flags.length > 0 && (
          <section>
            <div style={sectionTitle}>Markers</div>
            <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)" }}>
              {visible.map((f, i) => (
                <MarkerRow key={`${f.marker}-${i}`} flag={f} first={i === 0} />
              ))}
            </div>
            {flags.length > visible.length && (
              <button onClick={() => setShowAll(true)} style={{ marginTop: 8, background: "none", border: "none", padding: 8, color: "var(--accent-text)", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>
                Show all {flags.length} markers
              </button>
            )}
          </section>
        )}

        {report.trends?.length > 0 && (
          <section>
            <div style={sectionTitle}>Since your last report</div>
            <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)" }}>
              {report.trends.map((t, i) => {
                const Icon = t.direction === "improving" ? TrendingUp : t.direction === "worsening" ? TrendingDown : Minus;
                const tone = t.direction === "improving" ? "var(--accent-text)" : t.direction === "worsening" ? "var(--danger)" : "var(--text-muted)";
                return (
                  <div key={t.marker + i} style={{ padding: "12px 16px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ flex: 1, fontSize: 15 }}>{t.marker}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: tone, textTransform: "capitalize" }}>
                        <Icon size={14} /> {t.direction}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                      {t.previous} → <span style={{ color: "var(--text)" }}>{t.current}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <Link href="/medical/trends" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, padding: 8, color: "var(--accent-text)", fontSize: 14, textDecoration: "none" }}>
              See all trends <ArrowUpRight size={14} />
            </Link>
          </section>
        )}

        {report.analysis && (
          <section>
            <button
              aria-expanded={showAnalysis}
              onClick={() => setShowAnalysis((v) => !v)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 14, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 15, cursor: "pointer" }}
            >
              Read the full analysis
              <ChevronDown size={18} color="var(--text-muted)" style={{ transform: showAnalysis ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            {showAnalysis && <p style={{ margin: "12px 4px 0", fontSize: 14, lineHeight: 1.65, color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>{report.analysis}</p>}
          </section>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          {report.file_url && (
            <a href={report.file_url} target="_blank" rel="noopener noreferrer" style={{ ...secondaryBtn, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", fontSize: 14 }}>
              <Download size={16} /> Original PDF
            </a>
          )}
          <button onClick={() => onDelete(report.id)} style={{ ...dangerBtn, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14 }}>
            <Trash2 size={16} /> Delete report
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--text-faint)", textAlign: "center" }}>
          Not a diagnosis. Talk to your doctor about any results that worry you.
        </p>
      </div>
    </Sheet>
  );
}
