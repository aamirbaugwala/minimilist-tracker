"use client";

/**
 * Medical reports (Direction A) — one screen:
 *   Add a blood report (choose PDFs → Analyse) and, below, Your reports.
 * Each report opens a detail sheet (ReportDetail). The old AI-summary modal is
 * gone: Coach is the single AI entry point ("Ask Coach about this report").
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import PageHeader, { headerActionStyle } from "../components/PageHeader";
import ReportDetail from "../components/medical/ReportDetail";
import { primaryBtn, secondaryBtn } from "../components/Sheet";
import { reportTitle, reportDay, fmtDay, watchCount } from "../lib/medicalUi";
import { compressImage } from "../lib/image";
import { Activity, AlertTriangle, Camera, ChevronRight, FileText, Image as ImageIcon, Loader2, Plus, X } from "lucide-react";

export default function MedicalPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [files, setFiles] = useState([]); // [{ file, id }]
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ done: 0, total: 0 });
  const [uploadError, setUploadError] = useState("");

  const [reports, setReports] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [openId, setOpenId] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

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
  // PDFs are one report each; photos are the pages of ONE report, read together.
  const addFiles = (incoming) => {
    setUploadError("");
    const valid = [];
    const errors = [];
    for (const f of Array.from(incoming)) {
      const isPdf = f.type === "application/pdf";
      const isImage = f.type.startsWith("image/");
      if (!isPdf && !isImage) { errors.push(`${f.name}: use a PDF or a photo`); continue; }
      if (isPdf && f.size > 10 * 1024 * 1024) { errors.push(`${f.name}: larger than 10 MB`); continue; }
      if (isImage && f.size > 25 * 1024 * 1024) { errors.push(`${f.name}: photo too large`); continue; }
      valid.push({ file: f, kind: isPdf ? "pdf" : "photo", id: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}` });
    }
    // Computed here, not inside a setFiles updater: an updater runs later, so
    // an error pushed from it would never reach setUploadError below.
    const seen = new Set(files.map((x) => `${x.file.name}-${x.file.size}`));
    const merged = [...files, ...valid.filter((v) => !seen.has(`${v.file.name}-${v.file.size}`))];
    if (merged.length > 5) errors.push("Up to 5 files at a time");
    setFiles(merged.slice(0, 5));
    if (errors.length) setUploadError(errors.join(" · "));
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
    const pdfs = files.filter((f) => f.kind === "pdf");
    const photos = files.filter((f) => f.kind === "photo");
    // Each PDF is a job; all photos together are one more job.
    const jobs = [...pdfs.map((f) => ({ label: f.file.name, items: [f] })), ...(photos.length ? [{ label: "Photos", items: photos }] : [])];
    setAnalyzeProgress({ done: 0, total: jobs.length });

    const newReports = [];
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      try {
        const formData = new FormData();
        for (const [n, { file, kind }] of job.items.entries()) {
          if (kind === "pdf") formData.append("file", file);
          else {
            // Sharp enough for lab values, small enough to upload quickly.
            const img = await compressImage(file, { maxDim: 2000, quality: 0.85 });
            const bin = Uint8Array.from(atob(img.base64), (c) => c.charCodeAt(0));
            formData.append("file", new Blob([bin], { type: "image/jpeg" }), `page-${n + 1}.jpg`);
          }
        }
        formData.append("userId", session.user.id);
        formData.append("accessToken", session.access_token);

        const res = await fetch("/api/medical/analyze", { method: "POST", body: formData });
        const data = await res.json();

        if (data.error) {
          setUploadError((prev) => (prev ? `${prev} · ${job.label}: ${data.error}` : `${job.label}: ${data.error}`));
        } else {
          newReports.push(data.report);
          setReports((prev) => [data.report, ...prev]);
        }
      } catch (err) {
        const msg = err?.message?.includes("image") ? err.message : "no connection";
        setUploadError((prev) => (prev ? `${prev} · ${job.label}: ${msg}` : `${job.label}: ${msg}`));
      }
      setAnalyzeProgress({ done: i + 1, total: jobs.length });
    }

    setFiles([]);
    setAnalyzing(false);
    // One new report → open it straight away; several → they're at the top of the list.
    if (newReports.length === 1 && newReports[0]?.id) setOpenId(newReports[0].id);
  };

  // ── DELETE ─────────────────────────────────────────────────────────────────
  const deleteReport = async (id) => {
    if (!confirm("Delete this report? Its food advice and trend history go with it.")) return;
    const res = await fetch(`/api/medical/history?id=${id}&userId=${session.user.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      setOpenId(null);
      setReports((prev) => prev.filter((r) => r.id !== id));
    }
  };

  if (pageLoading) {
    return (
      <div style={{ height: "100dvh", display: "grid", placeItems: "center", background: "var(--bg)" }}>
        <Loader2 size={24} color="var(--text-muted)" className="animate-spin" />
      </div>
    );
  }

  const open = reports.find((r) => r.id === openId);
  const mb = (n) => (n / 1024 / 1024 >= 1 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "var(--text)", maxWidth: 640, margin: "0 auto", paddingBottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}>
      <PageHeader
        back="/me"
        title="Medical reports"
        subtitle="Blood work → food advice"
        actions={
          reports.length > 0 && (
            <button onClick={() => router.push("/medical/trends")} style={headerActionStyle}>
              <Activity size={14} /> Trends
            </button>
          )
        }
      />

      <div style={{ padding: "8px 20px 0", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* ── ADD A REPORT ── */}
        <section
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{ padding: 20, borderRadius: 20, background: "var(--surface)", border: dragOver ? "1.5px dashed var(--accent)" : "1px solid var(--border)" }}
        >
          <input ref={fileInputRef} type="file" accept="application/pdf,image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <div style={{ fontSize: 17, fontWeight: 600 }}>Add a blood report</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>PDF or photos · up to 5 files</div>

          {files.length > 0 && (
            <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {files.map((f) => { const { file, id } = f; return (
                <li key={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, background: "var(--bg)", border: "1px solid var(--border)" }}>
                  {f.kind === "photo" ? <ImageIcon size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} /> : <FileText size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                  <span style={{ fontSize: 13, color: "var(--text-faint)", flexShrink: 0 }}>{mb(file.size)}</span>
                  {!analyzing && (
                    <button onClick={() => removeFile(id)} aria-label={`Remove ${file.name}`} style={{ background: "none", border: "none", padding: 4, color: "var(--text-muted)", cursor: "pointer", display: "grid" }}>
                      <X size={16} />
                    </button>
                  )}
                </li>
              ); })}
            </ul>
          )}
          {files.filter((f) => f.kind === "photo").length > 1 && !analyzing && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10 }}>Photos are read together as the pages of one report, in this order.</div>
          )}

          {analyzing ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <Loader2 size={16} className="animate-spin" color="var(--accent-text)" />
                {analyzeProgress.total > 1 ? `Reading report ${Math.min(analyzeProgress.done + 1, analyzeProgress.total)} of ${analyzeProgress.total}…` : "Reading your report…"}
              </div>
              <div style={{ height: 4, borderRadius: 99, background: "var(--track)", marginTop: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, background: "var(--accent)", width: `${analyzeProgress.total ? Math.max(8, (analyzeProgress.done / analyzeProgress.total) * 100) : 0}%`, transition: "width 0.4s" }} />
              </div>
              <div style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 8 }}>About 20 seconds per report. You can leave this screen open.</div>
            </div>
          ) : files.length > 0 ? (
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => (files.some((f) => f.kind === "photo") ? cameraInputRef : fileInputRef).current?.click()} disabled={files.length >= 5} style={{ ...secondaryBtn, display: "flex", alignItems: "center", gap: 6, opacity: files.length >= 5 ? 0.5 : 1 }}>
                <Plus size={16} /> {files.some((f) => f.kind === "photo") ? "Page" : "More"}
              </button>
              <button onClick={analyzeReports} style={{ ...primaryBtn, flex: 1 }}>
                {(() => {
                  const n = files.filter((f) => f.kind === "pdf").length + (files.some((f) => f.kind === "photo") ? 1 : 0);
                  return n > 1 ? `Analyse ${n} reports` : "Analyse report";
                })()}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => fileInputRef.current?.click()} style={{ ...primaryBtn, flex: 1, whiteSpace: "nowrap", padding: "0 12px" }}>
                Choose files
              </button>
              <button onClick={() => cameraInputRef.current?.click()} aria-label="Take a photo of a report" style={{ ...secondaryBtn, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap", padding: "0 12px" }}>
                <Camera size={17} /> Camera
              </button>
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 10 }}>Private to you. Originals are kept in your report vault.</div>

          {uploadError && (
            <div role="alert" style={{ display: "flex", gap: 8, marginTop: 12, padding: 12, borderRadius: 12, background: "var(--danger-soft)", color: "var(--danger)", fontSize: 13, lineHeight: 1.45 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {uploadError}
            </div>
          )}
        </section>

        {/* ── YOUR REPORTS ── */}
        <section>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>Your reports</div>
          {histLoading && reports.length === 0 ? (
            <div style={{ padding: 24, display: "grid", placeItems: "center" }}>
              <Loader2 size={20} className="animate-spin" color="var(--text-muted)" />
            </div>
          ) : reports.length === 0 ? (
            <p style={{ margin: 0, padding: 20, borderRadius: 16, border: "1px dashed var(--border)", fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)" }}>
              No reports yet. Add a recent blood test and your targets and food suggestions will adjust to it — for example, less saturated fat if LDL is high.
            </p>
          ) : (
            <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)" }}>
              {reports.map((r, i) => {
                const w = watchCount(r);
                return (
                  <button
                    key={r.id}
                    onClick={() => setOpenId(r.id)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "none", borderTop: i ? "1px solid var(--border)" : "none", background: "transparent", color: "var(--text)", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reportTitle(r)}</span>
                      <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{fmtDay(reportDay(r))}</span>
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, padding: "4px 10px", borderRadius: 99, flexShrink: 0, background: w ? "var(--warn-soft)" : "var(--accent-soft)", color: w ? "var(--warn)" : "var(--accent-text)" }}>
                      {w ? `${w} to watch` : "All normal"}
                    </span>
                    <ChevronRight size={18} color="var(--text-faint)" style={{ flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--text-faint)" }}>
          Report reading is automated and can make mistakes. It isn’t a diagnosis — check anything worrying with your doctor.
        </p>
      </div>

      {open && <ReportDetail report={open} onClose={() => setOpenId(null)} onDelete={deleteReport} />}
    </div>
  );
}
