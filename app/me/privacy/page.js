"use client";

/**
 * Your data & privacy (Direction A).
 * Plain facts about what NutriTrack stores, who processes it and who can see
 * it — no promises beyond what the app does — plus the user's three controls:
 * download everything, delete medical reports, delete the account.
 * Deleting always offers the download first and needs "DELETE" typed.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Loader2, Trash2, UserX } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import PageHeader from "../../components/PageHeader";
import Sheet, { sheetInput, secondaryBtn } from "../../components/Sheet";

const FACTS = [
  {
    title: "What we store",
    lines: [
      "Your profile: age, height, weight, goal, health conditions, allergies and diet.",
      "What you log: food, water and weight, plus your saved meals, recipes and custom foods.",
      "Medical reports you upload: the original file and the values read from it.",
      "Coach conversations, reminders and notification settings.",
    ],
  },
  {
    title: "Who processes it",
    lines: [
      "Reports, meal photos, voice notes and Coach messages are sent to Google's Gemini AI to be read and answered.",
      "Barcode scans look the code up on Open Food Facts; only the barcode is sent.",
      "The app runs on Vercel, and your data and files are kept in a Supabase database.",
      "We record which pages are used, to improve the app.",
    ],
  },
  {
    title: "Who can see it",
    lines: [
      "You.",
      "Friends you accept see your daily score and today's food on the leaderboard. To score you against your own targets, their app also reads your profile (like weight and goal) but doesn't show it. They can't see your reports or Coach chats.",
      "Custom foods you create (name and nutrition only) appear in other people's food search.",
      "The people who run NutriTrack can technically access the database to keep the service working.",
    ],
  },
];

const btnRow = { width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", border: "none", background: "transparent", fontFamily: "inherit", textAlign: "left", cursor: "pointer" };

export default function PrivacyPage() {
  const router = useRouter();
  const { session, initializing, signOut } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [confirm, setConfirm] = useState(null); // "reports" | "account"
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initializing && !session) router.replace("/");
  }, [initializing, session, router]);

  const download = async () => {
    setError("");
    setDownloading(true);
    try {
      const res = await fetch("/api/account", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Download failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nutritrack-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setNote("Your data was downloaded.");
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="app-wrapper">
      <PageHeader back="/me" title="Your data & privacy" />

      <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40 }}>
        {FACTS.map((f) => (
          <section key={f.title}>
            <h2 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>{f.title}</h2>
            <ul style={{ margin: 0, padding: "14px 16px 14px 34px", borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column", gap: 8, fontSize: 14, lineHeight: 1.5 }}>
              {f.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        ))}

        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
          NutriTrack works alongside your doctor. It isn&apos;t a medical service and doesn&apos;t replace medical advice.
        </p>

        <section>
          <h2 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Your controls</h2>
          <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden" }}>
            <button className="me-row" style={{ ...btnRow, color: "var(--text)" }} onClick={download} disabled={downloading || !session}>
              {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 15 }}>Download my data</span>
                <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>Everything you&apos;ve logged, as one file</span>
              </span>
            </button>
            <button className="me-row" style={{ ...btnRow, color: "var(--danger)" }} onClick={() => setConfirm("reports")} disabled={!session}>
              <FileText size={18} />
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>Delete all medical reports</span>
            </button>
            <button className="me-row" style={{ ...btnRow, color: "var(--danger)" }} onClick={() => setConfirm("account")} disabled={!session}>
              <UserX size={18} />
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>Delete account and all data</span>
            </button>
          </div>
          {(note || error) && (
            <p role={error ? "alert" : "status"} style={{ margin: "10px 0 0", fontSize: 13, color: error ? "var(--danger)" : "var(--accent-text)" }}>
              {error || note}
            </p>
          )}
        </section>
      </div>

      {confirm && (
        <ConfirmDelete
          scope={confirm}
          token={session?.access_token}
          downloading={downloading}
          onDownload={download}
          onClose={() => setConfirm(null)}
          onDone={async (scope) => {
            setConfirm(null);
            if (scope === "account") {
              await signOut().catch(() => {});
              router.replace("/");
            } else {
              setError("");
              setNote("All medical reports were deleted.");
            }
          }}
        />
      )}
    </div>
  );
}

function ConfirmDelete({ scope, token, downloading, onDownload, onClose, onDone }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isAccount = scope === "account";
  const ready = typed.trim().toUpperCase() === "DELETE";

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scope }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Delete failed. Nothing was changed.");
      onDone(scope);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={isAccount ? "Delete your account?" : "Delete all medical reports?"}
      onClose={busy ? () => {} : onClose}
      footer={
        <button
          onClick={run}
          disabled={!ready || busy}
          style={{ width: "100%", height: 50, borderRadius: 14, border: "none", background: ready ? "var(--danger)" : "var(--surface-highlight)", color: ready ? "#fff" : "var(--text-faint)", fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: ready && !busy ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={17} />}
          {isAccount ? "Delete account" : "Delete reports"}
        </button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)" }}>
          {isAccount
            ? "This permanently deletes your profile, everything you've logged, your medical reports and their files, Coach chats, reminders and friends, then your login. It can't be undone."
            : "This permanently deletes every uploaded report, its file and the values read from it. Your targets will no longer use them. Your logs and account stay."}
        </p>
        <button onClick={onDownload} disabled={downloading || busy} style={{ ...secondaryBtn, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text)", fontFamily: "inherit", fontSize: 15, cursor: "pointer" }}>
          {downloading ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />} Download my data first
        </button>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
          Type DELETE to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} style={sheetInput} aria-label="Type DELETE to confirm" />
        </label>
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
