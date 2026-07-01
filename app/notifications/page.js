"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Bell, BellOff, BellRing, Plus, Trash2,
  CheckCircle2, XCircle, Loader2, Send, Pencil, X, Check,
} from "lucide-react";
import { supabase } from "../supabase";
import { useNotifications } from "../hooks/useNotifications";

// ── Day helpers ───────────────────────────────────────────────────────────────
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"]; // index 0 = Monday (1)
const ALL_DAYS   = [1, 2, 3, 4, 5, 6, 7];
const WEEKDAYS   = [1, 2, 3, 4, 5];

// ── Preset reminder templates ────────────────────────────────────────────────
const PRESETS = [
  {
    type:     "food_log",
    emoji:    "🍽️",
    title:    "Food Log Reminder",
    body:     "Time to log your meals! Stay on track with your nutrition goals.",
    default_time: "20:00",
    days:     ALL_DAYS,
    desc:     "Daily reminder to log what you've eaten",
  },
  {
    type:     "water",
    emoji:    "💧",
    title:    "Water Reminder",
    body:     "Stay hydrated! Have you had enough water today?",
    default_time: "12:00",
    days:     WEEKDAYS,
    desc:     "Midday hydration check-in",
  },
  {
    type:     "streak",
    emoji:    "🔥",
    title:    "Streak Guard",
    body:     "Don't break your streak! Log today's meals before midnight.",
    default_time: "21:00",
    days:     ALL_DAYS,
    desc:     "Evening alert to protect your logging streak",
  },
  {
    type:     "weekly",
    emoji:    "📊",
    title:    "Weekly Report",
    body:     "Your weekly nutrition summary is ready. Check your Dashboard!",
    default_time: "09:00",
    days:     [1], // Monday only
    desc:     "Monday morning weekly nutrition summary",
  },
];

// ── Blank form state ──────────────────────────────────────────────────────────
const blankForm = () => ({
  title:     "",
  body:      "",
  time_hhmm: "08:00",
  days:      ALL_DAYS,
});

// ── Day selector component ────────────────────────────────────────────────────
function DaySelector({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {DAY_LABELS.map((label, i) => {
        const dayNum  = i + 1;
        const active  = value.includes(dayNum);
        return (
          <button
            key={dayNum}
            type="button"
            onClick={() =>
              onChange(
                active ? value.filter((d) => d !== dayNum) : [...value, dayNum].sort()
              )
            }
            style={{
              width: 32, height: 32, borderRadius: "50%", border: "none",
              cursor: "pointer", fontSize: "0.7rem", fontWeight: 700,
              background: active ? "#6366f1" : "#27272a",
              color:      active ? "#fff"    : "#666",
              transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const router = useRouter();
  const { permission, isSubscribed, isSupported, loading: subLoading, subscribe, unsubscribe, sendTest } = useNotifications();

  const [session,       setSession]       = useState(null);
  const [reminders,     setReminders]     = useState([]);
  const [pageLoading,   setPageLoading]   = useState(true);
  const [statusMsg,     setStatusMsg]     = useState(null); // { text, ok }
  const [addingCustom,  setAddingCustom]  = useState(false);
  const [editingId,     setEditingId]     = useState(null);
  const [form,          setForm]          = useState(blankForm());
  const [testLoading,   setTestLoading]   = useState(false);

  // ── Session + load reminders ────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) { router.push("/"); return; }
      setSession(s);
      loadReminders(s);
    });
  }, []);

  const loadReminders = useCallback(async (s) => {
    setPageLoading(true);
    const res = await fetch(
      `/api/notifications/reminders?userId=${s.user.id}&accessToken=${s.access_token}`
    );
    const json = await res.json();
    setReminders(json.reminders || []);
    setPageLoading(false);
  }, []);

  const flash = (text, ok = true) => {
    setStatusMsg({ text, ok });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  // ── Toggle subscription ─────────────────────────────────────────────────
  const handleToggleSubscription = async () => {
    if (isSubscribed) {
      await unsubscribe();
      flash("Notifications disabled on this device.", false);
    } else {
      const result = await subscribe();
      if (result.ok) flash("Notifications enabled!");
      else if (result.reason === "denied") flash("Permission denied. Enable notifications in your browser settings.", false);
      else flash(result.error || "Failed to subscribe.", false);
    }
  };

  // ── Test notification ───────────────────────────────────────────────────
  const handleTest = async () => {
    setTestLoading(true);
    const result = await sendTest();
    setTestLoading(false);
    if (result.ok) flash("Test notification sent! Check your notification tray.");
    else flash(result.error || "Test failed.", false);
  };

  // ── Get preset reminder if it exists ────────────────────────────────────
  const getPresetReminder = (type) => reminders.find((r) => r.type === type);

  // ── Toggle a preset reminder on/off ─────────────────────────────────────
  const togglePreset = async (preset) => {
    if (!session) return;
    const existing = getPresetReminder(preset.type);

    if (existing) {
      // Toggle active state
      const updated = { ...existing, active: !existing.active };
      const res = await fetch("/api/notifications/reminders", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId: session.user.id, accessToken: session.access_token, reminder: updated }),
      });
      const json = await res.json();
      if (json.reminder) setReminders((prev) => prev.map((r) => r.id === json.reminder.id ? json.reminder : r));
    } else {
      // Create it
      const res = await fetch("/api/notifications/reminders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          userId:      session.user.id,
          accessToken: session.access_token,
          reminder:    {
            type:      preset.type,
            title:     preset.title,
            body:      preset.body,
            time_hhmm: preset.default_time,
            days:      preset.days,
          },
        }),
      });
      const json = await res.json();
      if (json.reminder) setReminders((prev) => [...prev, json.reminder]);
    }
  };

  // ── Update a preset's time ───────────────────────────────────────────────
  const updatePresetTime = async (existing, newTime) => {
    if (!session) return;
    const res = await fetch("/api/notifications/reminders", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        userId:      session.user.id,
        accessToken: session.access_token,
        reminder:    { ...existing, time_hhmm: newTime },
      }),
    });
    const json = await res.json();
    if (json.reminder) setReminders((prev) => prev.map((r) => r.id === json.reminder.id ? json.reminder : r));
  };

  // ── Add custom reminder ─────────────────────────────────────────────────
  const handleAddCustom = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) { flash("Title and message are required.", false); return; }
    if (!form.days.length) { flash("Select at least one day.", false); return; }

    const res = await fetch("/api/notifications/reminders", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        userId:      session.user.id,
        accessToken: session.access_token,
        reminder:    { type: "custom", ...form },
      }),
    });
    const json = await res.json();
    if (json.reminder) {
      setReminders((prev) => [...prev, json.reminder]);
      setForm(blankForm());
      setAddingCustom(false);
      flash("Reminder added!");
    } else {
      flash(json.error || "Failed to add reminder.", false);
    }
  };

  // ── Edit inline save ─────────────────────────────────────────────────────
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/notifications/reminders", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        userId:      session.user.id,
        accessToken: session.access_token,
        reminder:    { id: editingId, ...form },
      }),
    });
    const json = await res.json();
    if (json.reminder) {
      setReminders((prev) => prev.map((r) => r.id === json.reminder.id ? json.reminder : r));
      setEditingId(null);
      setForm(blankForm());
      flash("Reminder updated!");
    } else {
      flash(json.error || "Failed to update.", false);
    }
  };

  // ── Delete reminder ──────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    await fetch("/api/notifications/reminders", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId: session.user.id, accessToken: session.access_token, id }),
    });
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const customReminders = reminders.filter((r) => r.type === "custom");

  // ── Derived permission status ────────────────────────────────────────────
  const permDenied  = permission === "denied";
  const permGranted = permission === "granted";

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="app-wrapper" style={{ maxWidth: 600, margin: "0 auto", paddingBottom: 100 }}>
      <style jsx>{`
        .card { background: #18181b; border: 1px solid #27272a; border-radius: 16px; }
        .toggle {
          position: relative; width: 46px; height: 26px; border-radius: 13px;
          border: none; cursor: pointer; transition: background 0.2s;
          flex-shrink: 0;
        }
        .toggle-thumb {
          position: absolute; top: 3px;
          width: 20px; height: 20px; border-radius: 50%;
          background: #fff; transition: left 0.2s;
        }
        .reminder-card {
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 10px;
        }
        .form-card {
          background: #18181b; border: 1px solid #6366f1;
          border-radius: 14px; padding: 18px; margin-bottom: 10px;
        }
        input[type="text"], textarea, input[type="time"] {
          background: #27272a; border: 1px solid #3f3f46;
          color: #fff; border-radius: 8px; padding: 10px 12px;
          font-size: 0.9rem; width: 100%; box-sizing: border-box; outline: none;
        }
        input[type="text"]:focus, textarea:focus, input[type="time"]:focus {
          border-color: #6366f1;
        }
        textarea { resize: vertical; min-height: 64px; font-family: inherit; }
        .day-chip {
          display: inline-flex; align-items: center;
          padding: 2px 7px; border-radius: 99px;
          font-size: 0.65rem; font-weight: 700;
        }
        .btn-primary {
          background: #6366f1; color: #fff; border: none;
          border-radius: 10px; padding: 10px 18px;
          cursor: pointer; font-size: 0.88rem; font-weight: 600;
        }
        .btn-ghost {
          background: transparent; border: 1px solid #3f3f46;
          color: #aaa; border-radius: 10px; padding: 10px 18px;
          cursor: pointer; font-size: 0.88rem;
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, width: "fit-content", padding: "4px 0" }}
        >
          <ArrowLeft size={18} /> Back
        </button>
        <h1 style={{ fontSize: "1.7rem", fontWeight: 800, margin: 0 }}>
          <span style={{ marginRight: 8 }}>🔔</span>Reminders
        </h1>
        <p style={{ color: "#666", margin: 0, fontSize: "0.88rem" }}>
          Get push notifications on any device where you install the app.
        </p>
      </div>

      {/* ── Status flash ───────────────────────────────────────────────── */}
      {statusMsg && (
        <div style={{
          position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, background: statusMsg.ok ? "#166534" : "#7f1d1d",
          border: `1px solid ${statusMsg.ok ? "#22c55e" : "#ef4444"}`,
          color: "#fff", padding: "10px 20px", borderRadius: 12,
          fontSize: "0.88rem", fontWeight: 500, whiteSpace: "nowrap",
          boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
        }}>
          {statusMsg.ok ? <CheckCircle2 size={14} style={{ marginRight: 6, verticalAlign: "middle" }} /> : <XCircle size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />}
          {statusMsg.text}
        </div>
      )}

      {/* ── Push permission card ────────────────────────────────────────── */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ background: isSubscribed ? "rgba(99,102,241,0.15)" : "#27272a", padding: 10, borderRadius: 12 }}>
              {isSubscribed ? <BellRing size={22} color="#818cf8" /> : <BellOff size={22} color="#666" />}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}>
                {isSubscribed ? "Notifications On" : "Notifications Off"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#666", marginTop: 2 }}>
                {!isSupported
                  ? "Not supported — install as PWA first"
                  : permDenied
                  ? "Blocked in browser. Change in site settings."
                  : isSubscribed
                  ? "This device will receive reminders"
                  : "Enable to receive reminders on this device"}
              </div>
            </div>
          </div>

          {isSupported && !permDenied && (
            <button
              className="toggle"
              onClick={handleToggleSubscription}
              disabled={subLoading}
              style={{ background: isSubscribed ? "#6366f1" : "#3f3f46" }}
              aria-label="Toggle notifications"
            >
              {subLoading
                ? <span style={{ position: "absolute", top: 3, left: isSubscribed ? 23 : 3 }}><Loader2 size={20} className="spin" style={{ animation: "spin 1s linear infinite" }} /></span>
                : <span className="toggle-thumb" style={{ left: isSubscribed ? 23 : 3 }} />}
            </button>
          )}
        </div>

        {isSubscribed && (
          <button
            onClick={handleTest}
            disabled={testLoading}
            style={{ marginTop: 14, width: "100%", background: "#27272a", border: "1px solid #3f3f46", color: "#aaa", borderRadius: 10, padding: "9px 0", cursor: "pointer", fontSize: "0.83rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            {testLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
            Send Test Notification
          </button>
        )}
      </div>

      {/* ── Preset reminders ───────────────────────────────────────────── */}
      <div style={{ fontSize: "0.72rem", color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: 600 }}>
        Built-in Reminders
      </div>

      {PRESETS.map((preset) => {
        const existing = getPresetReminder(preset.type);
        const isOn     = existing?.active ?? false;

        return (
          <div key={preset.type} className="reminder-card">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1 }}>
                <span style={{ fontSize: 22 }}>{preset.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#fff" }}>{preset.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "#666", marginTop: 2 }}>{preset.desc}</div>

                  {isOn && existing && (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <input
                        type="time"
                        value={existing.time_hhmm}
                        onChange={(e) => updatePresetTime(existing, e.target.value)}
                        style={{ width: 120, padding: "5px 10px", fontSize: "0.85rem", background: "#27272a", border: "1px solid #3f3f46", color: "#fff", borderRadius: 8 }}
                      />
                      <div style={{ display: "flex", gap: 4 }}>
                        {DAY_LABELS.map((lbl, i) => {
                          const d = i + 1;
                          const active = existing.days?.includes(d);
                          return (
                            <span key={d} className="day-chip" style={{ background: active ? "rgba(99,102,241,0.2)" : "transparent", color: active ? "#818cf8" : "#555", border: `1px solid ${active ? "#4f46e5" : "#333"}` }}>
                              {lbl}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                className="toggle"
                onClick={() => togglePreset(preset)}
                style={{ background: isOn ? "#6366f1" : "#3f3f46", marginTop: 2 }}
                aria-label={`Toggle ${preset.title}`}
              >
                <span className="toggle-thumb" style={{ left: isOn ? 23 : 3 }} />
              </button>
            </div>
          </div>
        );
      })}

      {/* ── Custom reminders ───────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 12 }}>
        <div style={{ fontSize: "0.72rem", color: "#666", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
          Custom Reminders
        </div>
        {!addingCustom && (
          <button
            onClick={() => { setAddingCustom(true); setForm(blankForm()); setEditingId(null); }}
            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid #4f46e5", color: "#818cf8", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 4 }}
          >
            <Plus size={14} /> Add Reminder
          </button>
        )}
      </div>

      {/* Add / Edit form */}
      {(addingCustom || editingId) && (
        <form className="form-card" onSubmit={editingId ? handleSaveEdit : handleAddCustom}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontWeight: 700, color: "#fff", fontSize: "0.9rem" }}>
              {editingId ? "Edit Reminder" : "New Reminder"}
            </span>
            <button type="button" onClick={() => { setAddingCustom(false); setEditingId(null); setForm(blankForm()); }} style={{ background: "none", border: "none", color: "#666", cursor: "pointer" }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="text"
              placeholder="Title (e.g. Take Vitamins)"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={100}
              required
            />
            <textarea
              placeholder="Message (e.g. Time for your morning supplement stack)"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              maxLength={200}
              required
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "0.72rem", color: "#888", marginBottom: 6 }}>TIME</div>
                <input
                  type="time"
                  value={form.time_hhmm}
                  onChange={(e) => setForm((f) => ({ ...f, time_hhmm: e.target.value }))}
                  style={{ width: 130 }}
                  required
                />
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", color: "#888", marginBottom: 6 }}>REPEAT ON</div>
                <DaySelector value={form.days} onChange={(d) => setForm((f) => ({ ...f, days: d }))} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn-ghost" onClick={() => { setAddingCustom(false); setEditingId(null); setForm(blankForm()); }}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Check size={14} /> {editingId ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </form>
      )}

      {pageLoading ? (
        <div style={{ textAlign: "center", color: "#555", padding: 24 }}>
          <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : customReminders.length === 0 && !addingCustom ? (
        <div style={{ textAlign: "center", color: "#555", padding: 24, fontSize: "0.85rem" }}>
          No custom reminders yet. Tap <b>+ Add Reminder</b> to create one.
        </div>
      ) : (
        customReminders.map((r) =>
          editingId === r.id ? null : (
            <div key={r.id} className="reminder-card" style={{ opacity: r.active ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff", marginBottom: 2 }}>{r.title}</div>
                  <div style={{ fontSize: "0.78rem", color: "#888", marginBottom: 8 }}>{r.body}</div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.75rem", color: "#6366f1", fontWeight: 600 }}>{r.time_hhmm}</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {DAY_LABELS.map((lbl, i) => {
                        const d = i + 1;
                        const active = (r.days || ALL_DAYS).includes(d);
                        return (
                          <span key={d} className="day-chip" style={{ background: active ? "rgba(99,102,241,0.15)" : "transparent", color: active ? "#818cf8" : "#444", border: `1px solid ${active ? "#4f46e5" : "#2a2a2a"}` }}>
                            {lbl}
                          </span>
                        );
                      })}
                    </div>
                    {!r.active && <span style={{ fontSize: "0.68rem", color: "#666", background: "#27272a", padding: "1px 7px", borderRadius: 4 }}>Paused</span>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => {
                      setEditingId(r.id);
                      setAddingCustom(false);
                      setForm({ title: r.title, body: r.body, time_hhmm: r.time_hhmm, days: r.days || ALL_DAYS });
                    }}
                    style={{ background: "#27272a", border: "none", color: "#aaa", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    style={{ background: "rgba(239,68,68,0.1)", border: "none", color: "#ef4444", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          )
        )
      )}

      {/* ── Setup guide ────────────────────────────────────────────────── */}
      {!isSupported && (
        <div style={{ marginTop: 24, background: "#18181b", border: "1px solid #27272a", borderRadius: 14, padding: 18 }}>
          <div style={{ fontWeight: 700, color: "#fff", marginBottom: 8 }}>📲 Install the App for Notifications</div>
          <div style={{ fontSize: "0.83rem", color: "#888", lineHeight: 1.6 }}>
            Push notifications require installing NutriTrack as a PWA:
            <br />• <b>Android Chrome:</b> Menu → &ldquo;Add to Home Screen&rdquo;
            <br />• <b>iOS Safari:</b> Share → &ldquo;Add to Home Screen&rdquo;
            <br />• <b>Desktop Chrome/Edge:</b> Install icon in the address bar
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
