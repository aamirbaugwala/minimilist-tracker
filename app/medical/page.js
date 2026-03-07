"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import {
  ArrowLeft,
  Upload,
  Loader2,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Salad,
  Ban,
  Activity,
  Info,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  high:       { bg: "#ef444415", color: "#ef4444", border: "#ef444430", icon: ChevronUp,   label: "High" },
  low:        { bg: "#3b82f615", color: "#3b82f6", border: "#3b82f630", icon: ChevronDown, label: "Low" },
  borderline: { bg: "#f59e0b15", color: "#f59e0b", border: "#f59e0b30", icon: AlertTriangle, label: "Borderline" },
  normal:     { bg: "#10b98115", color: "#10b981", border: "#10b98130", icon: CheckCircle, label: "Normal" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.normal;
  const Icon = s.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      <Icon size={10} /> {s.label}
    </span>
  );
}

// ─── REPORT CARD ──────────────────────────────────────────────────────────────
function ReportCard({ report, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const hasFlags = report.flags?.length > 0;
  const abnormal = report.flags?.filter((f) => f.status !== "normal").length || 0;

  return (
    <div style={{
      background: "var(--surface)", borderRadius: 16,
      border: `1px solid ${abnormal > 0 ? "#f59e0b30" : "var(--border)"}`,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div
        style={{ padding: "14px 16px", cursor: "pointer" }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <FileText size={14} color="#6366f1" />
              <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{report.file_name}</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#52525b", display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} />
              {new Date(report.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {abnormal > 0 && (
              <span style={{
                fontSize: "0.7rem", fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b30",
              }}>{abnormal} abnormal</span>
            )}
            <span style={{ fontSize: "0.75rem", color: "#52525b" }}>{expanded ? "▲" : "▼"}</span>
          </div>
        </div>

        {/* Summary always visible */}
        {report.summary && (
          <div style={{
            marginTop: 10, padding: "8px 12px", borderRadius: 10,
            background: "var(--surface-highlight)", fontSize: "0.8rem",
            color: "#a1a1aa", lineHeight: 1.6,
          }}>
            {report.summary}
          </div>
        )}
      </div>

      {/* Expandable */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Flags / Markers */}
          {hasFlags && (
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Activity size={13} color="#6366f1" /> Blood Markers
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {report.flags.map((flag, i) => (
                  <div key={i} style={{
                    padding: "9px 12px", borderRadius: 10,
                    background: "var(--surface-highlight)",
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{flag.marker}
                        <span style={{ fontWeight: 400, color: "#71717a", marginLeft: 8 }}>{flag.value}</span>
                      </div>
                      {flag.note && <div style={{ fontSize: "0.75rem", color: "#71717a", marginTop: 2 }}>{flag.note}</div>}
                    </div>
                    <StatusBadge status={flag.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trends across reports */}
          {report.trends?.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, color: "#8b5cf6" }}>
                <TrendingUp size={13} /> Trends vs Previous Reports
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {report.trends.map((t, i) => {
                  const isImproving = t.direction === "improving";
                  const isWorsening = t.direction === "worsening";
                  const TrendIcon = isImproving ? TrendingUp : isWorsening ? TrendingDown : Minus;
                  const trendColor = isImproving ? "#10b981" : isWorsening ? "#ef4444" : "#71717a";
                  const trendBg = isImproving ? "#10b98112" : isWorsening ? "#ef444412" : "#27272a";
                  return (
                    <div key={i} style={{
                      padding: "10px 12px", borderRadius: 10,
                      background: trendBg, border: `1px solid ${trendColor}25`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: "0.82rem" }}>{t.marker}</span>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontSize: "0.7rem", fontWeight: 700, color: trendColor,
                          padding: "2px 8px", borderRadius: 20,
                          background: `${trendColor}18`, border: `1px solid ${trendColor}30`,
                        }}>
                          <TrendIcon size={10} />
                          {t.direction.charAt(0).toUpperCase() + t.direction.slice(1)}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#71717a" }}>
                        {t.previous} → <span style={{ color: "#e4e4e7", fontWeight: 600 }}>{t.current}</span>
                      </div>
                      {t.note && <div style={{ fontSize: "0.74rem", color: "#a1a1aa", marginTop: 4 }}>{t.note}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Include foods */}
          {report.include_foods?.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, color: "#10b981" }}>
                <Salad size={13} /> Include in Diet
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {report.include_foods.map((item, i) => (
                  <div key={i} style={{ padding: "8px 12px", borderRadius: 10, background: "#10b98110", border: "1px solid #10b98120" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#10b981" }}>✅ {item.food}</div>
                    <div style={{ fontSize: "0.75rem", color: "#6ee7b7", marginTop: 2 }}>{item.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exclude foods */}
          {report.exclude_foods?.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, color: "#ef4444" }}>
                <Ban size={13} /> Avoid / Limit
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {report.exclude_foods.map((item, i) => (
                  <div key={i} style={{ padding: "8px 12px", borderRadius: 10, background: "#ef444410", border: "1px solid #ef444420" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#ef4444" }}>🚫 {item.food}</div>
                    <div style={{ fontSize: "0.75rem", color: "#fca5a5", marginTop: 2 }}>{item.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full analysis */}
          {report.analysis && (
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <ShieldCheck size={13} color="#6366f1" /> Full Analysis
              </div>
              <div style={{ fontSize: "0.8rem", color: "#a1a1aa", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {report.analysis}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          {report.disclaimer && (
            <div style={{
              padding: "8px 12px", borderRadius: 10, background: "#27272a",
              fontSize: "0.72rem", color: "#52525b", lineHeight: 1.5,
            }}>
              ⚠️ {report.disclaimer}
            </div>
          )}

          {/* Delete */}
          <button
            onClick={() => onDelete(report.id)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "9px", borderRadius: 10, border: "1px solid #ef444430",
              background: "#ef444410", color: "#ef4444", cursor: "pointer", fontSize: "0.8rem",
            }}
          >
            <Trash2 size={13} /> Delete Report
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function MedicalPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Upload state
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [latestReport, setLatestReport] = useState(null);

  // History
  const [reports, setReports] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [tab, setTab] = useState("upload");

  const fileInputRef = useRef(null);

  // ── AUTH ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/"); return; }
      setSession(session);
      setPageLoading(false);
      fetchHistory(session);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ── FETCH HISTORY ─────────────────────────────────────────────────────────
  const fetchHistory = async (sess = session) => {
    if (!sess) return;
    setHistLoading(true);
    try {
      const res = await fetch(`/api/medical/history?userId=${sess.user.id}`, {
        headers: { Authorization: `Bearer ${sess.access_token}` },
      });
      const data = await res.json();
      if (data.reports) setReports(data.reports);
    } catch { /* silent */ }
    setHistLoading(false);
  };

  // ── FILE HANDLING ─────────────────────────────────────────────────────────
  const handleFileSelect = (selected) => {
    setUploadError("");
    setLatestReport(null);
    if (!selected) return;
    if (selected.type !== "application/pdf") {
      setUploadError("Only PDF files are supported.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setUploadError("File too large. Maximum 10MB.");
      return;
    }
    setFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  };

  // ── ANALYSE ───────────────────────────────────────────────────────────────
  const analyzeReport = async () => {
    if (!file || analyzing) return;
    setAnalyzing(true);
    setUploadError("");
    setLatestReport(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", session.user.id);
      formData.append("accessToken", session.access_token);

      const res = await fetch("/api/medical/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setUploadError(data.error || "Analysis failed. Please try again.");
        return;
      }

      setLatestReport(data.report);
      setReports((prev) => [data.report, ...prev]);
      setFile(null);
      if (data.warning) setUploadError(`⚠️ ${data.warning}`);
    } catch {
      setUploadError("Network error. Please check your connection.");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── DELETE ─────────────────────────────────────────────────────────────────
  const deleteReport = async (id) => {
    if (!confirm("Delete this report?")) return;
    const res = await fetch(`/api/medical/history?id=${id}&userId=${session.user.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== id));
      if (latestReport?.id === id) setLatestReport(null);
    }
  };

  if (pageLoading) {
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
          onClick={() => router.push("/")}
          style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", padding: 4 }}
        >
          <ArrowLeft size={20} />
        </button>
        <ShieldCheck size={20} color="#10b981" />
        <div>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>Medical Reports</div>
          <div style={{ fontSize: "0.7rem", color: "#52525b" }}>AI analysis · Dietary recommendations</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, background: "var(--surface)", padding: 4, borderRadius: 10 }}>
          {["upload", "history"].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "5px 12px", borderRadius: 7, border: "none",
              background: tab === t ? "#10b981" : "transparent",
              color: tab === t ? "#fff" : "#71717a",
              fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
              textTransform: "capitalize",
            }}>{t === "history" ? `📋 ${reports.length}` : "⬆️ Upload"}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>

        {tab === "upload" && (
          <>
            {/* ── DROP ZONE ── */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "#10b981" : file ? "#6366f1" : "#27272a"}`,
                borderRadius: 16, padding: "32px 20px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                textAlign: "center", cursor: file ? "default" : "pointer",
                background: dragOver ? "#10b98108" : file ? "#6366f108" : "transparent",
                transition: "all 0.2s",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              />
              {file ? (
                <>
                  <FileText size={36} color="#6366f1" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{file.name}</div>
                    <div style={{ fontSize: "0.78rem", color: "#71717a", marginTop: 4 }}>
                      {(file.size / 1024).toFixed(0)} KB · PDF
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    style={{ fontSize: "0.75rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}
                  >
                    <XCircle size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <Upload size={36} color="#52525b" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Drop your medical report here</div>
                    <div style={{ fontSize: "0.8rem", color: "#52525b", marginTop: 4 }}>
                      PDF only · Max 10MB · Blood tests, lipid panels, HbA1c, thyroid, etc.
                    </div>
                  </div>
                  <span style={{
                    padding: "6px 16px", borderRadius: 20,
                    background: "var(--surface)", border: "1px solid var(--border)",
                    fontSize: "0.8rem", color: "#a1a1aa",
                  }}>Browse files</span>
                </>
              )}
            </div>

            {/* ── ANALYSE BUTTON ── */}
            {file && (
              <button
                onClick={analyzeReport}
                disabled={analyzing}
                style={{
                  width: "100%", padding: "14px", borderRadius: 12, border: "none",
                  background: analyzing ? "#27272a" : "#10b981",
                  color: analyzing ? "#52525b" : "#fff",
                  fontWeight: 700, fontSize: "0.95rem", cursor: analyzing ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {analyzing ? (
                  <><Loader2 size={16} className="animate-spin" /> Analysing report…</>
                ) : (
                  <><ShieldCheck size={16} /> Analyse with AI</>
                )}
              </button>
            )}

            {/* Analysing progress info */}
            {analyzing && (
              <div style={{ textAlign: "center", padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: "0.82rem", color: "#71717a" }}>Reading your report and identifying dietary recommendations…</div>
                <div style={{ fontSize: "0.75rem", color: "#52525b" }}>This takes ~10-15 seconds</div>
              </div>
            )}

            {/* Error */}
            {uploadError && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "#ef444415", color: "#ef4444", fontSize: "0.82rem", border: "1px solid #ef444430", display: "flex", gap: 8 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                {uploadError}
              </div>
            )}

            {/* Latest result */}
            {latestReport && !analyzing && (
              <div>
                <div style={{ fontSize: "0.78rem", color: "#10b981", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                  <CheckCircle size={13} /> Analysis complete · Saved to history
                </div>
                <ReportCard report={latestReport} onDelete={deleteReport} />
              </div>
            )}
          </>
        )}

        {tab === "history" && (
          <>
            <div style={{ fontSize: "0.8rem", color: "#52525b", display: "flex", alignItems: "center", gap: 6 }}>
              <FileText size={13} />
              {reports.length === 0
                ? "No reports yet — upload your first medical report."
                : `${reports.length} report${reports.length > 1 ? "s" : ""} analysed`}
            </div>

            {histLoading && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <Loader2 size={24} color="#10b981" className="animate-spin" style={{ margin: "0 auto" }} />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reports.map((r) => (
                <ReportCard key={r.id} report={r} onDelete={deleteReport} />
              ))}
            </div>
          </>
        )}

        {/* ── DISCLAIMER FOOTER ── */}
        <div style={{
          marginTop: "auto", padding: "12px 14px", borderRadius: 12,
          background: "#f59e0b08", border: "1px solid #f59e0b20",
          display: "flex", gap: 8, fontSize: "0.73rem", color: "#78716c",
        }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          AI analysis is for informational purposes only. Always consult a qualified physician or registered dietitian before making dietary changes based on medical reports.
        </div>
      </div>
    </div>
  );
}
