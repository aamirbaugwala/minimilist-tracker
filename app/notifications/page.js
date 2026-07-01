"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BellOff,
  BellRing,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { supabase } from "../supabase";
import { useNotifications } from "../hooks/useNotifications";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const WEEKDAYS = [1, 2, 3, 4, 5];

const PRESETS = [
  {
    type: "food_log",
    emoji: "🍽️",
    title: "Food Log Reminder",
    body: "Time to log your meals! Stay on track with your nutrition goals.",
    default_time: "20:00",
    days: ALL_DAYS,
    desc: "Daily reminder to log your meals",
  },
  {
    type: "water",
    emoji: "💧",
    title: "Water Reminder",
    body: "Stay hydrated! Have you had enough water today?",
    default_time: "12:00",
    days: WEEKDAYS,
    desc: "Midday hydration check-in",
  },
  {
    type: "streak",
    emoji: "🔥",
    title: "Streak Guard",
    body: "Don't break your streak! Log today's meals before midnight.",
    default_time: "21:00",
    days: ALL_DAYS,
    desc: "Evening streak protection",
  },
  {
    type: "weekly",
    emoji: "📊",
    title: "Weekly Report",
    body: "Your weekly nutrition summary is ready. Check your Dashboard!",
    default_time: "09:00",
    days: [1],
    desc: "Monday progress summary",
  },
];

const blankForm = () => ({
  title: "",
  body: "",
  time_hhmm: "08:00",
  days: ALL_DAYS,
});

export default function NotificationsPage() {
  const router = useRouter();
  const {
    permission,
    isSubscribed,
    isSupported,
    loading: subLoading,
    subscribe,
    unsubscribe,
    sendTest,
  } = useNotifications();

  const [session, setSession] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [testLoading, setTestLoading] = useState(false);

  const loadReminders = useCallback(async (s) => {
    setPageLoading(true);
    const res = await fetch(
      `/api/notifications/reminders?userId=${s.user.id}&accessToken=${s.access_token}`
    );
    const json = await res.json();
    setReminders(json.reminders || []);
    setPageLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) {
        router.push("/");
        return;
      }
      setSession(s);
      loadReminders(s);
    });
  }, [router, loadReminders]);

  const flash = (text, ok = true) => {
    setStatusMsg({ text, ok });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const handleToggleSubscription = async () => {
    if (isSubscribed) {
      const result = await unsubscribe();
      if (result?.ok) {
        flash("Notifications disabled on this device.", false);
      } else {
        flash(result?.error || "Could not disable notifications. Try again.", false);
      }
    } else {
      const result = await subscribe();
      if (result.ok) flash("Notifications enabled.");
      else if (result.reason === "denied") {
        flash("Permission denied. Enable notifications from browser settings.", false);
      } else {
        flash(result.error || "Failed to subscribe.", false);
      }
    }
  };

  const handleTest = async () => {
    setTestLoading(true);
    const result = await sendTest();
    setTestLoading(false);
    if (result.ok) flash("Test notification sent.");
    else flash(result.error || "Test failed.", false);
  };

  const getPresetReminder = (type) => reminders.find((r) => r.type === type);

  const togglePreset = async (preset) => {
    if (!session) return;
    const existing = getPresetReminder(preset.type);

    if (existing) {
      const updated = { ...existing, active: !existing.active };
      const res = await fetch("/api/notifications/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          accessToken: session.access_token,
          reminder: updated,
        }),
      });
      const json = await res.json();
      if (json.reminder) {
        setReminders((prev) => prev.map((r) => (r.id === json.reminder.id ? json.reminder : r)));
      }
    } else {
      const res = await fetch("/api/notifications/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          accessToken: session.access_token,
          reminder: {
            type: preset.type,
            title: preset.title,
            body: preset.body,
            time_hhmm: preset.default_time,
            days: preset.days,
          },
        }),
      });
      const json = await res.json();
      if (json.reminder) setReminders((prev) => [...prev, json.reminder]);
    }
  };

  const updatePresetTime = async (existing, newTime) => {
    if (!session) return;
    const res = await fetch("/api/notifications/reminders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session.user.id,
        accessToken: session.access_token,
        reminder: { ...existing, time_hhmm: newTime },
      }),
    });
    const json = await res.json();
    if (json.reminder) {
      setReminders((prev) => prev.map((r) => (r.id === json.reminder.id ? json.reminder : r)));
    }
  };

  const updatePresetDays = async (existing, dayNum) => {
    if (!session) return;
    const currentDays = Array.isArray(existing.days) ? existing.days : ALL_DAYS;
    const hasDay = currentDays.includes(dayNum);
    const nextDays = hasDay
      ? currentDays.filter((d) => d !== dayNum)
      : [...currentDays, dayNum].sort((a, b) => a - b);

    // Always keep at least one day selected.
    if (nextDays.length === 0) return;

    const res = await fetch("/api/notifications/reminders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session.user.id,
        accessToken: session.access_token,
        reminder: { ...existing, days: nextDays },
      }),
    });
    const json = await res.json();
    if (json.reminder) {
      setReminders((prev) => prev.map((r) => (r.id === json.reminder.id ? json.reminder : r)));
    }
  };

  const updateCustomDays = async (existing, dayNum) => {
    if (!session) return;
    const currentDays = Array.isArray(existing.days) ? existing.days : ALL_DAYS;
    const hasDay = currentDays.includes(dayNum);
    const nextDays = hasDay
      ? currentDays.filter((d) => d !== dayNum)
      : [...currentDays, dayNum].sort((a, b) => a - b);

    // Keep at least one day active.
    if (nextDays.length === 0) return;

    const res = await fetch("/api/notifications/reminders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session.user.id,
        accessToken: session.access_token,
        reminder: { ...existing, days: nextDays },
      }),
    });
    const json = await res.json();
    if (json.reminder) {
      setReminders((prev) => prev.map((r) => (r.id === json.reminder.id ? json.reminder : r)));
    }
  };

  const handleAddCustom = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      flash("Title and message are required.", false);
      return;
    }
    if (!form.days.length) {
      flash("Select at least one day.", false);
      return;
    }

    const res = await fetch("/api/notifications/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session.user.id,
        accessToken: session.access_token,
        reminder: { type: "custom", ...form },
      }),
    });
    const json = await res.json();

    if (json.reminder) {
      setReminders((prev) => [...prev, json.reminder]);
      setForm(blankForm());
      setAddingCustom(false);
      flash("Custom reminder added.");
    } else {
      flash(json.error || "Failed to add reminder.", false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/notifications/reminders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session.user.id,
        accessToken: session.access_token,
        reminder: { id: editingId, ...form },
      }),
    });
    const json = await res.json();
    if (json.reminder) {
      setReminders((prev) => prev.map((r) => (r.id === json.reminder.id ? json.reminder : r)));
      setEditingId(null);
      setForm(blankForm());
      flash("Reminder updated.");
    } else {
      flash(json.error || "Failed to update.", false);
    }
  };

  const handleDelete = async (id) => {
    await fetch("/api/notifications/reminders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id, accessToken: session.access_token, id }),
    });
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const customReminders = reminders.filter((r) => r.type === "custom");
  const permDenied = permission === "denied";

  return (
    <div className="app-wrapper notifications-root">
      <style jsx>{`
        .notifications-root {
          max-width: 760px;
          margin: 0 auto;
          padding: 10px 14px 110px;
        }
        .header {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 18px;
        }
        .back-btn {
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          width: fit-content;
          padding: 4px 0;
        }
        .title {
          font-size: clamp(1.4rem, 4vw, 1.9rem);
          font-weight: 800;
          margin: 0;
        }
        .subtitle {
          color: #71717a;
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.45;
        }
        .status-toast {
          position: fixed;
          top: 76px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 999;
          width: min(92vw, 560px);
          border-radius: 12px;
          padding: 10px 14px;
          color: #fff;
          font-size: 0.88rem;
          font-weight: 500;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .status-ok { background: #166534; border: 1px solid #22c55e; }
        .status-err { background: #7f1d1d; border: 1px solid #ef4444; }

        .flow-grid {
          display: grid;
          gap: 14px;
        }
        .panel {
          background: linear-gradient(180deg, #1a1a1f 0%, #16161a 100%);
          border: 1px solid #2a2a30;
          border-radius: 16px;
          padding: 16px;
        }
        .panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }
        .panel-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.96rem;
          color: #f4f4f5;
          font-weight: 700;
        }
        .step-chip {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(99, 102, 241, 0.2);
          color: #818cf8;
        }
        .panel-sub {
          font-size: 0.8rem;
          color: #71717a;
          margin: 0;
          line-height: 1.4;
        }

        .toggle {
          position: relative;
          width: 52px;
          height: 30px;
          border-radius: 999px;
          border: 1px solid #4b5563;
          background: #2f3340;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
          flex-shrink: 0;
          -webkit-appearance: none;
          appearance: none;
          padding: 0;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.35);
        }
        .toggle:hover {
          border-color: #6366f1;
        }
        .toggle:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.45), inset 0 1px 3px rgba(0, 0, 0, 0.35);
        }
        .toggle:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .toggle-thumb {
          position: absolute;
          top: 4px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fff;
          transition: left 0.2s, transform 0.2s;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        }
        .device-state {
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.82rem;
          color: #a1a1aa;
          flex-wrap: wrap;
        }
        .pill {
          background: #27272a;
          border: 1px solid #3f3f46;
          border-radius: 999px;
          padding: 2px 9px;
          font-size: 0.72rem;
        }
        .test-btn {
          margin-top: 10px;
          width: 100%;
          background: #22222a;
          border: 1px solid #3f3f46;
          color: #d4d4d8;
          border-radius: 10px;
          padding: 10px;
          cursor: pointer;
          font-size: 0.84rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .preset-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        .preset-card {
          background: #15151a;
          border: 1px solid #2a2a2f;
          border-radius: 12px;
          padding: 12px;
        }
        .preset-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .preset-title {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }
        .preset-name {
          color: #fafafa;
          font-weight: 700;
          font-size: 0.9rem;
          margin-bottom: 1px;
        }
        .preset-desc {
          color: #71717a;
          font-size: 0.75rem;
          line-height: 1.35;
        }
        .preset-config {
          margin-top: 10px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .time-input {
          width: 118px;
          background: #27272a;
          border: 1px solid #3f3f46;
          color: #fff;
          border-radius: 8px;
          padding: 5px 8px;
          font-size: 0.8rem;
        }
        .day-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          border: 1px solid #35353a;
          color: #666;
          font-size: 0.68rem;
          font-weight: 700;
        }
        .day-chip.active {
          color: #818cf8;
          border-color: #4f46e5;
          background: rgba(99, 102, 241, 0.18);
        }
        .day-chip-btn {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          border: 1px solid #35353a;
          background: transparent;
          color: #666;
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          touch-action: manipulation;
          -webkit-appearance: none;
          appearance: none;
          padding: 0;
          line-height: 1;
          flex-shrink: 0;
        }
        .day-chip-btn.active {
          color: #818cf8;
          border-color: #4f46e5;
          background: rgba(99, 102, 241, 0.18);
        }

        .section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
        }
        .section-title {
          color: #c7c7d1;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .add-btn {
          background: rgba(99, 102, 241, 0.18);
          border: 1px solid #4f46e5;
          color: #818cf8;
          border-radius: 8px;
          padding: 5px 10px;
          cursor: pointer;
          font-size: 0.78rem;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .form-card {
          background: #15151b;
          border: 1px solid #4f46e5;
          border-radius: 14px;
          padding: 14px;
          margin-bottom: 10px;
        }
        .form-grid {
          display: grid;
          gap: 10px;
        }
        .form-time-row {
          display: grid;
          gap: 8px;
          grid-template-columns: auto 1fr;
          align-items: center;
        }
        .form-time-row input[type="time"] {
          width: auto;
          min-width: 110px;
          max-width: 140px;
        }
        .form-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 5px;
        }
        input[type="text"], textarea, input[type="time"] {
          width: 100%;
          box-sizing: border-box;
          background: #27272a;
          border: 1px solid #3f3f46;
          color: #fff;
          border-radius: 9px;
          padding: 10px 11px;
          font-size: 0.88rem;
          outline: none;
        }
        textarea {
          min-height: 66px;
          resize: vertical;
          font-family: inherit;
        }
        input[type="text"]:focus,
        textarea:focus,
        input[type="time"]:focus {
          border-color: #6366f1;
        }
        .custom-day-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .form-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .btn-primary {
          background: #6366f1;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 9px 15px;
          cursor: pointer;
          font-size: 0.84rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .btn-ghost {
          background: transparent;
          border: 1px solid #3f3f46;
          color: #a1a1aa;
          border-radius: 10px;
          padding: 9px 15px;
          cursor: pointer;
          font-size: 0.84rem;
        }

        .custom-list {
          display: grid;
          gap: 9px;
        }
        .custom-card {
          background: #15151a;
          border: 1px solid #2a2a30;
          border-radius: 12px;
          padding: 12px;
        }
        .custom-title {
          color: #fff;
          font-weight: 700;
          font-size: 0.9rem;
          margin-bottom: 1px;
        }
        .custom-body {
          color: #a1a1aa;
          font-size: 0.77rem;
          margin-bottom: 8px;
          line-height: 1.4;
        }
        .custom-meta {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .custom-actions {
          display: flex;
          gap: 6px;
          margin-top: 8px;
          justify-content: flex-end;
        }
        .icon-btn {
          border: none;
          border-radius: 8px;
          padding: 6px 8px;
          cursor: pointer;
        }

        .empty {
          color: #71717a;
          text-align: center;
          padding: 18px;
          font-size: 0.84rem;
        }
        .setup-note {
          margin-top: 14px;
          background: #18181b;
          border: 1px solid #2a2a30;
          border-radius: 14px;
          padding: 14px;
          color: #9ca3af;
          font-size: 0.82rem;
          line-height: 1.55;
        }

        @media (min-width: 700px) {
          .preset-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .flow-grid { gap: 16px; }
          .panel { padding: 18px; }
        }
        @media (max-width: 460px) {
          .notifications-root { padding-left: 10px; padding-right: 10px; }
          .status-toast { top: 64px; font-size: 0.8rem; }
          .day-chip-btn { width: 28px; height: 28px; font-size: 0.66rem; }
          .custom-day-row { gap: 4px; }
          .form-actions { justify-content: stretch; }
          .form-actions button { flex: 1; }
        }
      `}</style>

      {statusMsg && (
        <div className={`status-toast ${statusMsg.ok ? "status-ok" : "status-err"}`}>
          {statusMsg.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {statusMsg.text}
        </div>
      )}

      <header className="header">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={18} /> Back
        </button>
        <h1 className="title">🔔 Reminders</h1>
        <p className="subtitle">
          Set once, get nudged automatically. Start with device notifications,
          then enable built-in habits or add your own custom reminders.
        </p>
      </header>

      <div className="flow-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">
                <span className="step-chip">1</span>
                Enable Notifications On This Device
              </div>
              <p className="panel-sub">
                Required before any reminder can alert you.
              </p>
            </div>
            {isSupported && !permDenied && (
              <button
                className="toggle"
                onClick={handleToggleSubscription}
                disabled={subLoading}
                style={{ background: isSubscribed ? "#6366f1" : "#3f3f46" }}
              >
                {subLoading ? (
                  <span style={{ position: "absolute", top: 5, left: isSubscribed ? 28 : 4 }}>
                    <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                  </span>
                ) : (
                  <span className="toggle-thumb" style={{ left: isSubscribed ? 28 : 4 }} />
                )}
              </button>
            )}
          </div>

          <div className="device-state">
            <span>{isSubscribed ? <BellRing size={16} color="#818cf8" /> : <BellOff size={16} color="#71717a" />}</span>
            <span>
              {!isSupported
                ? "Push not supported on this browser"
                : permDenied
                ? "Permission blocked in browser settings"
                : isSubscribed
                ? "Active on this device"
                : permission === "granted"
                ? "Permission granted, but this device is not subscribed"
                : "Disabled"}
            </span>
            <span className="pill">Permission: {permission}</span>
          </div>

          {permission === "granted" && !isSubscribed && (
            <p className="panel-sub" style={{ marginTop: 8 }}>
              If you are on iPhone, install to Home Screen and open the app from there before enabling notifications.
            </p>
          )}

          {isSubscribed && (
            <button className="test-btn" onClick={handleTest} disabled={testLoading}>
              {testLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
              Send Test Notification
            </button>
          )}
        </section>

        <section className="panel">
          <div className="panel-head" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="panel-title">
                <span className="step-chip">2</span>
                Built-in Habit Reminders
              </div>
              <p className="panel-sub">Tap toggle to enable. Adjust time only when enabled.</p>
            </div>
          </div>

          <div className="preset-grid">
            {PRESETS.map((preset) => {
              const existing = getPresetReminder(preset.type);
              const isOn = existing?.active ?? false;

              return (
                <div key={preset.type} className="preset-card">
                  <div className="preset-row">
                    <div className="preset-title">
                      <span style={{ fontSize: 20 }}>{preset.emoji}</span>
                      <div>
                        <div className="preset-name">{preset.title}</div>
                        <div className="preset-desc">{preset.desc}</div>
                      </div>
                    </div>

                    <button
                      className="toggle"
                      onClick={() => togglePreset(preset)}
                      style={{ background: isOn ? "#6366f1" : "#3f3f46" }}
                    >
                      <span className="toggle-thumb" style={{ left: isOn ? 28 : 4 }} />
                    </button>
                  </div>

                  {isOn && existing && (
                    <div className="preset-config">
                      <input
                        className="time-input"
                        type="time"
                        value={existing.time_hhmm}
                        onChange={(e) => updatePresetTime(existing, e.target.value)}
                      />

                      {DAY_LABELS.map((lbl, i) => {
                        const d = i + 1;
                        const active = (existing.days || []).includes(d);
                        return (
                          <button
                            key={d}
                            type="button"
                            className={`day-chip-btn${active ? " active" : ""}`}
                            onClick={() => updatePresetDays(existing, d)}
                            aria-label={`Toggle ${lbl} for ${preset.title}`}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <div className="panel-title">
                <span className="step-chip">3</span>
                Custom Reminders
              </div>
              <p className="panel-sub" style={{ marginTop: 4 }}>Create reminders for supplements, workouts, meds, or anything else.</p>
            </div>
            {!addingCustom && (
              <button
                className="add-btn"
                onClick={() => {
                  setAddingCustom(true);
                  setForm(blankForm());
                  setEditingId(null);
                }}
              >
                <Plus size={14} /> Add
              </button>
            )}
          </div>

          {(addingCustom || editingId) && (
            <form className="form-card" onSubmit={editingId ? handleSaveEdit : handleAddCustom}>
              <div className="section-head" style={{ marginBottom: 10 }}>
                <div className="section-title">{editingId ? "Edit Reminder" : "New Reminder"}</div>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ background: "transparent", color: "#71717a" }}
                  onClick={() => {
                    setAddingCustom(false);
                    setEditingId(null);
                    setForm(blankForm());
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="form-grid">
                <input
                  type="text"
                  placeholder="Title (e.g. Take Vitamins)"
                  value={form.title}
                  maxLength={100}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />

                <textarea
                  placeholder="Message (e.g. Time for your morning supplement stack)"
                  value={form.body}
                  maxLength={200}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  required
                />

                <div>
                  <div className="form-label">Time</div>
                  <input
                    type="time"
                    value={form.time_hhmm}
                    onChange={(e) => setForm((f) => ({ ...f, time_hhmm: e.target.value }))}
                    style={{ width: "auto", minWidth: 120 }}
                    required
                  />
                </div>
                <div>
                  <div className="form-label">Repeat on days</div>
                  <div className="custom-day-row">
                    {DAY_LABELS.map((lbl, i) => {
                      const d = i + 1;
                      const active = form.days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          className={`day-chip-btn${active ? " active" : ""}`}
                          onClick={() => {
                            const nextDays = active
                              ? form.days.filter((x) => x !== d)
                              : [...form.days, d].sort((a, b) => a - b);
                            if (nextDays.length) {
                              setForm((f) => ({ ...f, days: nextDays }));
                            }
                          }}
                          aria-label={`Toggle ${lbl}`}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setAddingCustom(false);
                      setEditingId(null);
                      setForm(blankForm());
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    <Check size={14} /> {editingId ? "Save" : "Add"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {pageLoading ? (
            <div className="empty">
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : customReminders.length === 0 && !addingCustom ? (
            <div className="empty">No custom reminders yet.</div>
          ) : (
            <div className="custom-list">
              {customReminders
                .filter((r) => editingId !== r.id)
                .map((r) => (
                  <div key={r.id} className="custom-card" style={{ opacity: r.active ? 1 : 0.6 }}>
                    <div className="custom-title">{r.title}</div>
                    <div className="custom-body">{r.body}</div>

                    <div className="custom-meta">
                      <span style={{ color: "#818cf8", fontWeight: 700, fontSize: "0.74rem" }}>{r.time_hhmm}</span>
                      {DAY_LABELS.map((lbl, i) => {
                        const d = i + 1;
                        const active = (r.days || ALL_DAYS).includes(d);
                        return (
                          <button
                            key={d}
                            type="button"
                            className={`day-chip-btn${active ? " active" : ""}`}
                            onClick={() => updateCustomDays(r, d)}
                            aria-label={`Toggle ${lbl} for ${r.title}`}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                      {!r.active && <span className="pill">Paused</span>}
                    </div>

                    <div className="custom-actions">
                      <button
                        className="icon-btn"
                        style={{ background: "#27272a", color: "#aaa" }}
                        onClick={() => {
                          setEditingId(r.id);
                          setAddingCustom(false);
                          setForm({
                            title: r.title,
                            body: r.body,
                            time_hhmm: r.time_hhmm,
                            days: r.days || ALL_DAYS,
                          });
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>

      {!isSupported && (
        <div className="setup-note">
          <div style={{ fontWeight: 700, color: "#f4f4f5", marginBottom: 6 }}>Install App For Push Notifications</div>
          • Android Chrome: Menu → Add to Home Screen<br />
          • iOS Safari: Share → Add to Home Screen<br />
          • Desktop Chrome/Edge: Install icon in address bar
        </div>
      )}
    </div>
  );
}
