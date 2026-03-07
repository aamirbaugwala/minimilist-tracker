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
  Sparkles,
  X,
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
              {report.report_date
                ? new Date(report.report_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : new Date(report.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              {report.report_date && (
                <span style={{ marginLeft: 4, fontSize: "0.68rem", color: "#3f3f46", fontStyle: "italic" }}>
                  · report date
                </span>
              )}
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

  // Upload state — now supports multiple files
  const [files, setFiles] = useState([]); // [{ file, id }]
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ done: 0, total: 0 });
  const [uploadError, setUploadError] = useState("");
  const [latestReports, setLatestReports] = useState([]); // newly analysed

  // History
  const [reports, setReports] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [tab, setTab] = useState("upload");

  // Summary modal
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fileInputRef = useRef(null);

  // ── AUTH ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (!sess) { router.push("/"); return; }
      setSession(sess);
      setPageLoading(false);
      fetchHistory(sess);
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

  // ── FILE HANDLING (multiple) ───────────────────────────────────────────────
  const addFiles = (incoming) => {
    setUploadError("");
    const valid = [];
    const errors = [];
    for (const f of Array.from(incoming)) {
      if (f.type !== "application/pdf") { errors.push(`${f.name}: only PDFs supported`); continue; }
      if (f.size > 10 * 1024 * 1024) { errors.push(`${f.name}: too large (max 10MB)`); continue; }
      valid.push({ file: f, id: `${f.name}-${Date.now()}-${Math.random()}` });
    }
    if (errors.length) setUploadError(errors.join(" · "));
    setFiles((prev) => {
      // deduplicate by name
      const existingNames = new Set(prev.map((x) => x.file.name));
      return [...prev, ...valid.filter((v) => !existingNames.has(v.file.name))];
    });
  };

  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  // ── ANALYSE (sequential, one by one) ─────────────────────────────────────
  const analyzeReports = async () => {
    if (!files.length || analyzing) return;
    setAnalyzing(true);
    setUploadError("");
    setLatestReports([]);
    setAnalyzeProgress({ done: 0, total: files.length });

    const newReports = [];
    for (let i = 0; i < files.length; i++) {
      const { file } = files[i];
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("userId", session.user.id);
        formData.append("accessToken", session.access_token);

        const res = await fetch("/api/medical/analyze", { method: "POST", body: formData });
        const data = await res.json();

        if (data.error) {
          setUploadError((prev) => prev ? `${prev} · ${file.name}: ${data.error}` : `${file.name}: ${data.error}`);
        } else {
          newReports.push(data.report);
          setReports((prev) => [data.report, ...prev]);
        }
      } catch {
        setUploadError((prev) => prev ? `${prev} · ${file.name}: network error` : `${file.name}: network error`);
      }
      setAnalyzeProgress({ done: i + 1, total: files.length });
    }

    setLatestReports(newReports);
    setFiles([]);
    setAnalyzing(false);
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
      setLatestReports((prev) => prev.filter((r) => r.id !== id));
    }
  };

  // ── SUMMARY (AI summary of all history reports) ───────────────────────────
  const generateSummary = async () => {
    if (!reports.length) return;
    setSummaryOpen(true);
    setSummaryLoading(true);
    setSummaryText("");

    try {
      // Build a compact digest of all reports for the prompt
      const digest = reports.map((r, i) => {
        const dateLabel = r.report_date
          ? new Date(r.report_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        const abnormal = (r.flags || []).filter((f) => f.status !== "normal");
        return `Report ${i + 1} — ${r.file_name} (${dateLabel}):
Summary: ${r.summary || r.analysis?.slice(0, 200) || "N/A"}
Abnormal markers: ${abnormal.length ? abnormal.map((f) => `${f.marker} ${f.value} (${f.status})`).join(", ") : "None"}`;
      }).join("\n\n");

      const prompt = `You are a clinical dietitian. Below are ${reports.length} medical reports uploaded by a patient.

${digest}

Write a comprehensive longitudinal health summary in plain English (250-350 words). Structure it as:
1. **Overall Health Status** — general picture across all reports
2. **Key Concerns** — the most important abnormal markers and what they mean together
3. **Positive Findings** — what's improving or already normal
4. **Top Dietary Actions** — 3-5 specific, actionable diet changes based on the combined findings, with Indian food examples
5. **Follow-up Advice** — which markers need re-testing and when

Be specific — mention actual values. Prefer practical Indian food-based advice. End with a brief disclaimer.`;

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          userId: session.user.id,
          accessToken: session.access_token,
          history: [],
        }),
      });
      const data = await res.json();
      setSummaryText(data.reply || data.error || "Could not generate summary.");
    } catch {
      setSummaryText("Network error. Please try again.");
    }
    setSummaryLoading(false);
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
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={() => router.push("/medical/trends")}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: 8, border: "1px solid #6366f130",
              background: "#6366f115", color: "#818cf8",
              fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
            }}
          >
            <Activity size={12} /> Trends
          </button>
          <div style={{ display: "flex", gap: 4, background: "var(--surface)", padding: 4, borderRadius: 10 }}>
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
      </div>

      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>

        {tab === "upload" && (
          <>
            {/* ── DROP ZONE ── */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !files.length && fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "#10b981" : files.length ? "#6366f1" : "#27272a"}`,
                borderRadius: 16, padding: "28px 20px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                textAlign: "center", cursor: files.length ? "default" : "pointer",
                background: dragOver ? "#10b98108" : files.length ? "#6366f108" : "transparent",
                transition: "all 0.2s",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                style={{ display: "none" }}
                onChange={(e) => addFiles(e.target.files)}
              />
              {files.length === 0 ? (
                <>
                  <Upload size={36} color="#52525b" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Drop your medical reports here</div>
                    <div style={{ fontSize: "0.8rem", color: "#52525b", marginTop: 4 }}>
                      PDF only · Max 10MB each · Multiple files supported
                    </div>
                  </div>
                  <span style={{
                    padding: "6px 16px", borderRadius: 20,
                    background: "var(--surface)", border: "1px solid var(--border)",
                    fontSize: "0.8rem", color: "#a1a1aa",
                  }}>Browse files</span>
                </>
              ) : (
                <>
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                    {files.map(({ file, id }) => (
                      <div key={id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 12px", borderRadius: 10,
                        background: "var(--surface)", border: "1px solid #6366f130",
                        textAlign: "left",
                      }}>
                        <FileText size={15} color="#6366f1" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, overflow: "hidden" }}>
                          <div style={{ fontWeight: 600, fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
                          <div style={{ fontSize: "0.72rem", color: "#52525b" }}>{(file.size / 1024).toFixed(0)} KB</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(id); }}
                          style={{ background: "none", border: "none", color: "#52525b", cursor: "pointer", padding: 4 }}
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    style={{
                      fontSize: "0.78rem", color: "#818cf8", background: "none", border: "none",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <Upload size={12} /> Add more files
                  </button>
                </>
              )}
            </div>

            {/* ── ANALYSE BUTTON ── */}
            {files.length > 0 && !analyzing && (
              <button
                onClick={analyzeReports}
                style={{
                  width: "100%", padding: "14px", borderRadius: 12, border: "none",
                  background: "#10b981", color: "#fff",
                  fontWeight: 700, fontSize: "0.95rem", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <ShieldCheck size={16} />
                Analyse {files.length} Report{files.length > 1 ? "s" : ""} with AI
              </button>
            )}

            {/* Analysing progress */}
            {analyzing && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{
                  width: "100%", padding: "14px", borderRadius: 12, border: "none",
                  background: "#27272a", color: "#52525b",
                  fontWeight: 700, fontSize: "0.95rem",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  <Loader2 size={16} className="animate-spin" />
                  Analysing {analyzeProgress.done}/{analyzeProgress.total}…
                </div>
                {/* Progress bar */}
                <div style={{ height: 4, background: "#27272a", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", background: "#10b981", borderRadius: 10,
                    width: `${analyzeProgress.total ? (analyzeProgress.done / analyzeProgress.total) * 100 : 0}%`,
                    transition: "width 0.4s",
                  }} />
                </div>
                <div style={{ textAlign: "center", fontSize: "0.8rem", color: "#71717a" }}>
                  Reading reports and identifying dietary recommendations…
                </div>
              </div>
            )}

            {/* Error */}
            {uploadError && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "#ef444415", color: "#ef4444", fontSize: "0.82rem", border: "1px solid #ef444430", display: "flex", gap: 8 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                {uploadError}
              </div>
            )}

            {/* Latest results */}
            {latestReports.length > 0 && !analyzing && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: "0.78rem", color: "#10b981", display: "flex", alignItems: "center", gap: 5 }}>
                  <CheckCircle size={13} /> {latestReports.length} report{latestReports.length > 1 ? "s" : ""} analysed · Saved to history
                </div>
                {latestReports.map((r) => (
                  <ReportCard key={r.id || r.file_name} report={r} onDelete={deleteReport} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "history" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "0.8rem", color: "#52525b", display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={13} />
                {reports.length === 0
                  ? "No reports yet — upload your first medical report."
                  : `${reports.length} report${reports.length > 1 ? "s" : ""} analysed`}
              </div>
              {reports.length >= 1 && (
                <button
                  onClick={generateSummary}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                    color: "#fff", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer",
                    boxShadow: "0 4px 14px #6366f125",
                  }}
                >
                  <Sparkles size={13} /> AI Summary
                </button>
              )}
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

      {/* ── SUMMARY MODAL ── */}
      {summaryOpen && (
        <div
          className="modal-overlay"
          style={{ alignItems: "flex-end", paddingBottom: 62 }}
          onClick={(e) => { if (e.target === e.currentTarget) setSummaryOpen(false); }}
        >
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "20px 20px 0 0",
            width: "100%", maxWidth: 480,
            maxHeight: "80dvh",
            display: "flex", flexDirection: "column",
            boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
            margin: "0 auto",
          }}>
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#333" }} />
            </div>

            {/* Header */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "4px 20px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0,
            }}>
              <h3 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={16} color="#8b5cf6" /> Longitudinal Health Summary
              </h3>
              <button
                onClick={() => setSummaryOpen(false)}
                style={{ background: "none", border: "none", color: "#52525b", cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {summaryLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 0" }}>
                  <Loader2 size={28} color="#8b5cf6" className="animate-spin" />
                  <div style={{ fontSize: "0.82rem", color: "#71717a" }}>
                    Analysing {reports.length} reports for longitudinal patterns…
                  </div>
                </div>
              ) : (
                <div style={{
                  fontSize: "0.85rem", lineHeight: 1.75, color: "#d4d4d8",
                  whiteSpace: "pre-wrap",
                }}>
                  {summaryText}
                </div>
              )}
            </div>

            {/* Footer */}
            {!summaryLoading && summaryText && (
              <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
                <div style={{ fontSize: "0.72rem", color: "#52525b", display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <Info size={12} style={{ marginTop: 1, flexShrink: 0 }} />
                  AI-generated summary for informational purposes only. Not a substitute for professional medical advice.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
