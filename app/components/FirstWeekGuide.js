"use client";

/**
 * FirstWeekGuide — a 3-step checklist on Today for an account's first 7 days.
 * 11 of 19 users only ever logged on one day, so the empty first screen gets
 * clear next steps instead. Steps tick off from REAL state:
 *   1. Set your goal        → profile has weight (onboarding done)
 *   2. Log your first meal  → anything logged, ever
 *   3. Meal reminders on    → push subscription active
 * Hidden once all are done, after day 7, or when dismissed.
 */

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useLocalStorageValue } from "../hooks/useLocalStorageValue";

const DISMISS = "nt_first_week_dismissed";

function Step({ done, title, hint, action }) {
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
      <span
        aria-hidden="true"
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          background: done ? "var(--accent)" : "transparent",
          border: done ? "none" : "2px solid var(--border)",
          color: "var(--on-accent)",
        }}
      >
        {done && <Check size={14} strokeWidth={3} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: done ? 400 : 500, color: done ? "var(--text-muted)" : "var(--text)", textDecoration: done ? "line-through" : "none" }}>
          {title}
          <span className="sr-only">{done ? " — done" : ""}</span>
        </span>
        {!done && hint && <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{hint}</span>}
      </span>
      {!done && action}
    </li>
  );
}

export default function FirstWeekGuide({ accountCreatedAt, todayKey, hasGoal, hasLogged, notifications, onLogFirst, onSetGoal }) {
  const [dismissedFlag, setDismissedFlag] = useLocalStorageValue(DISMISS);
  const dismissed = dismissedFlag === undefined || dismissedFlag === "1";
  const [notifError, setNotifError] = useState("");

  // Whole days since sign-up, from date strings (pure — no clock read in render).
  const ageDays =
    accountCreatedAt && todayKey
      ? Math.floor((Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${String(accountCreatedAt).slice(0, 10)}T00:00:00Z`)) / 86400000)
      : 99;
  const remindersOn = !!notifications?.isSubscribed;
  const doneCount = [hasGoal, hasLogged, remindersOn].filter(Boolean).length;
  if (dismissed || ageDays > 6 || doneCount === 3) return null;

  const dismiss = () => setDismissedFlag("1");

  const turnOnReminders = async () => {
    setNotifError("");
    const res = await notifications.subscribe();
    if (res && res.ok === false && res.error) setNotifError(res.error);
  };

  const smallBtn = {
    height: 34,
    padding: "0 14px",
    border: "none",
    borderRadius: 10,
    background: "var(--accent)",
    color: "var(--on-accent)",
    font: "inherit",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  };

  return (
    <section aria-label="Your first week" style={{ margin: "0 20px", padding: 18, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Your first week</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{doneCount} of 3 done</span>
          <button onClick={dismiss} aria-label="Hide first-week guide" style={{ width: 28, height: 28, border: "none", background: "none", color: "var(--text-faint)", display: "grid", placeItems: "center", cursor: "pointer", marginRight: -6 }}>
            <X size={15} />
          </button>
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 99, background: "var(--track)", marginTop: 12 }}>
        <div style={{ width: `${(doneCount / 3) * 100}%`, height: "100%", borderRadius: 99, background: "var(--accent)" }} />
      </div>
      <ol style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
        <Step done={hasGoal} title="Set your goal" hint="Two minutes: body stats and what you're aiming for" action={<button onClick={onSetGoal} style={smallBtn}>Set</button>} />
        <Step done={hasLogged} title="Log your first meal" hint="Snap a photo — it takes about 10 seconds" action={<button onClick={onLogFirst} style={smallBtn}>Log</button>} />
        <Step
          done={remindersOn}
          title="Turn on meal reminders"
          hint={notifError || "A nudge at lunch and dinner, only if you haven't logged"}
          action={notifications?.isSupported ? <button onClick={turnOnReminders} disabled={notifications.loading} style={smallBtn}>Turn on</button> : null}
        />
      </ol>
    </section>
  );
}
