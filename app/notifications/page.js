"use client";

/**
 * Reminders (Direction A).
 *   This phone — on/off for push on this device, plus a test send.
 *   Habits     — the four built-in reminders: a switch each; when on, the time
 *                and days fold out under it.
 *   Yours      — custom reminders (vitamins, workouts…): switch to pause, tap
 *                to edit in a sheet, "New reminder" to add one.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, ChevronRight, Loader2, Plus } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Sheet, { sheetInput, sheetLabel, primaryBtn, secondaryBtn, dangerBtn } from "../components/Sheet";
import { supabase } from "../supabase";
import { effectiveMinutes, dinnerMinutes, toHHMM, LUNCH_SLOT } from "../lib/reminderRules";
import { useNotifications } from "../hooks/useNotifications";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const WEEKDAYS = [1, 2, 3, 4, 5];

const PRESETS = [
  { type: "food_log", label: "Log your meals", rule: "only if not logged", title: "Meal check-in", body: "Log your meal in a few taps.", default_time: "20:45", days: ALL_DAYS },
  { type: "water", label: "Water check-in", rule: "if under half your goal", title: "Water check-in", body: "Had a glass recently? Tap to log it.", default_time: "15:00", days: ALL_DAYS },
  { type: "streak", label: "Streak guard", rule: "if nothing logged today", title: "Keep your streak", body: "Nothing logged yet today — one meal keeps it going.", default_time: "21:30", days: ALL_DAYS },
  { type: "weekly", label: "Monday review", rule: "your week in 3 numbers", title: "Your week in review", body: "See how last week went — three numbers, one tip.", default_time: "09:00", days: [1] },
]

const blankForm = () => ({ title: "", body: "", time_hhmm: "08:00", days: ALL_DAYS });

const fmtTime = (hhmm = "08:00") => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
const fmtDays = (days) => {
  const d = [...(Array.isArray(days) && days.length ? days : ALL_DAYS)].sort((a, b) => a - b);
  if (d.length === 7) return "every day";
  if (d.join() === WEEKDAYS.join()) return "Mon – Fri";
  if (d.join() === "6,7") return "weekends";
  if (d.length === 6) return `every day but ${DAY_NAMES[ALL_DAYS.find((n) => !d.includes(n)) - 1]}`;
  return d.map((n) => DAY_NAMES[n - 1]).join(", ");
};

function Switch({ on, onChange, label, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      style={{ width: 48, height: 28, flexShrink: 0, borderRadius: 99, border: "none", padding: 3, background: on ? "var(--accent)" : "var(--track)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "background 0.2s" }}
    >
      <span style={{ display: "block", width: 22, height: 22, borderRadius: "50%", background: on ? "var(--on-accent)" : "var(--text-muted)", transform: on ? "translateX(20px)" : "none", transition: "transform 0.2s" }} />
    </button>
  );
}

function DayPicker({ days, onToggle }) {
  const set = Array.isArray(days) && days.length ? days : ALL_DAYS;
  return (
    <div role="group" aria-label="Days" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
      {DAY_LABELS.map((l, i) => {
        const on = set.includes(i + 1);
        return (
          <button key={i} type="button" aria-pressed={on} aria-label={DAY_NAMES[i]} onClick={() => onToggle(i + 1)} style={{ height: 38, borderRadius: 10, border: on ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--text)" : "var(--text-muted)", fontFamily: "inherit", fontSize: 13, fontWeight: on ? 600 : 400, cursor: "pointer" }}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

const card = { borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" };
const sectionTitle = { fontSize: 13, color: "var(--text-muted)", margin: "0 0 10px" };

export default function NotificationsPage() {
  const router = useRouter();
  const { permission, isSubscribed, isSupported, loading: subLoading, subscribe, unsubscribe, sendTest } = useNotifications();

  const [session, setSession] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [testLoading, setTestLoading] = useState(false);
  const [expandedPreset, setExpandedPreset] = useState(null);

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
        flash("Notifications are off for this phone.");
      } else {
        flash(result?.error || "Could not disable notifications. Try again.", false);
      }
    } else {
      const result = await subscribe();
      if (result.ok) flash("Notifications are on.");
      else if (result.reason === "denied") {
        flash("Notifications are blocked. Allow them in your browser’s site settings.", false);
      } else {
        flash(result.error || "Failed to subscribe.", false);
      }
    }
  };

  const handleTest = async () => {
    setTestLoading(true);
    const result = await sendTest();
    setTestLoading(false);
    if (result.ok) flash("Test sent — it should arrive in a few seconds.");
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

  const handleAddCustom = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      flash("Add a title and a message.", false);
      return;
    }
    if (!form.days.length) {
      flash("Pick at least one day.", false);
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
      flash("Reminder added.");
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

  const toggleCustom = async (r) => {
    if (!session) return;
    const res = await fetch("/api/notifications/reminders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id, accessToken: session.access_token, reminder: { ...r, active: !r.active } }),
    });
    const json = await res.json();
    if (json.reminder) setReminders((prev) => prev.map((x) => (x.id === json.reminder.id ? json.reminder : x)));
  };

  const openEditor = (r) => {
    if (r) {
      setEditingId(r.id);
      setForm({ title: r.title || "", body: r.body || "", time_hhmm: r.time_hhmm || "08:00", days: Array.isArray(r.days) && r.days.length ? r.days : ALL_DAYS });
    } else {
      setEditingId(null);
      setForm(blankForm());
      setAddingCustom(true);
    }
  };
  const closeEditor = () => {
    setEditingId(null);
    setAddingCustom(false);
    setForm(blankForm());
  };
  const toggleFormDay = (n) =>
    setForm((f) => {
      const next = f.days.includes(n) ? f.days.filter((d) => d !== n) : [...f.days, n].sort((a, b) => a - b);
      return next.length ? { ...f, days: next } : f;
    });

  const customReminders = reminders.filter((r) => r.type === "custom");
  const permDenied = permission === "denied";
  const editorOpen = addingCustom || editingId;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "var(--text)", maxWidth: 640, margin: "0 auto", paddingBottom: "calc(110px + env(safe-area-inset-bottom, 0px))" }}>
      <PageHeader back="/me" title="Reminders" subtitle="Only when they help · never 10 pm – 7 am" />

      <div style={{ padding: "8px 20px 0", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* ── THIS PHONE ── */}
        <section style={{ ...card, padding: 18 }}>
          {!isSupported ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 600 }}>This browser can’t show notifications</div>
              <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)" }}>
                Add NutriTrack to your home screen and open it from there. Android Chrome: menu → Add to Home screen. iPhone Safari: Share → Add to Home Screen.
              </p>
            </>
          ) : permDenied ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--warn)" }}>Notifications are blocked</div>
              <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)" }}>Allow notifications for this site in your browser settings, then come back here.</p>
            </>
          ) : isSubscribed ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <BellRing size={20} color="var(--accent-text)" style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 160, fontSize: 15, fontWeight: 600 }}>Notifications are on for this phone</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleTest} disabled={testLoading} style={{ ...secondaryBtn, height: 40, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  {testLoading ? <Loader2 size={15} className="animate-spin" /> : null} Send test
                </button>
                <button onClick={handleToggleSubscription} disabled={subLoading} style={{ ...secondaryBtn, height: 40, fontSize: 14, color: "var(--text-muted)" }}>Turn off</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Turn on reminders for this phone</div>
              <p style={{ margin: "6px 0 14px", fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)" }}>
                Your browser will ask once. On iPhone, open NutriTrack from the home screen first.
              </p>
              <button onClick={handleToggleSubscription} disabled={subLoading} style={{ ...primaryBtn, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {subLoading ? <Loader2 size={18} className="animate-spin" /> : "Turn on notifications"}
              </button>
            </>
          )}
        </section>

        {pageLoading ? (
          <div style={{ padding: 24, display: "grid", placeItems: "center" }}>
            <Loader2 size={20} className="animate-spin" color="var(--text-muted)" />
          </div>
        ) : (
          <>
            {/* ── HABITS ── */}
            <section>
              <h2 style={sectionTitle}>Habits</h2>
              <div style={card}>
                {PRESETS.map((preset, i) => {
                  const existing = getPresetReminder(preset.type);
                  const on = !!existing?.active;
                  return (
                    <div key={preset.type} style={{ padding: "14px 16px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          aria-expanded={on && expandedPreset === preset.type}
                          disabled={!on}
                          onClick={() => setExpandedPreset(expandedPreset === preset.type ? null : preset.type)}
                          style={{ flex: 1, minWidth: 0, padding: 0, border: "none", background: "none", color: "var(--text)", fontFamily: "inherit", textAlign: "left", cursor: on ? "pointer" : "default" }}
                        >
                          <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{preset.label}</span>
                          <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                            {preset.type === "food_log" && `${fmtTime(LUNCH_SLOT)} · `}
                            {fmtTime(toHHMM(preset.type === "food_log" ? dinnerMinutes(existing?.time_hhmm) : effectiveMinutes(preset.type, existing?.time_hhmm || preset.default_time)))}
                            {` · ${fmtDays(existing?.days || preset.days)}`} · {preset.rule}
                            {on && <span style={{ color: "var(--accent-text)" }}> · {expandedPreset === preset.type ? "Done" : "Change"}</span>}
                          </span>
                        </button>
                        <Switch on={on} onChange={() => togglePreset(preset)} label={preset.label} />
                      </div>
                      {on && existing && expandedPreset === preset.type && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                          <label style={{ ...sheetLabel, fontSize: 12 }}>
                            {preset.type === "food_log" ? "Dinner nudge (lunch nudge is at 1:45 pm)" : "Time"}
                            <input
                              type="time"
                              min={preset.type === "food_log" ? "17:00" : "07:00"}
                              max="21:45"
                              value={toHHMM(preset.type === "food_log" ? dinnerMinutes(existing.time_hhmm) : effectiveMinutes(preset.type, existing.time_hhmm || preset.default_time))}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (!v) return;
                                // Keep habits out of quiet hours (and the dinner nudge after lunch).
                                const floor = preset.type === "food_log" ? 17 * 60 : 7 * 60;
                                const [h, m] = v.split(":").map(Number);
                                updatePresetTime(existing, toHHMM(Math.min(Math.max(h * 60 + m, floor), 21 * 60 + 45)));
                              }}
                              style={{ ...sheetInput, height: 44, colorScheme: "dark" }}
                            />
                          </label>
                          <DayPicker days={existing.days} onToggle={(n) => updatePresetDays(existing, n)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {isSupported && !permDenied && !isSubscribed && reminders.some((r) => r.active) && (
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--warn)" }}>Turn on notifications above, or these won’t reach this phone.</p>
              )}
            </section>

            {/* ── YOURS ── */}
            <section>
              <h2 style={sectionTitle}>Your reminders</h2>
              <div style={card}>
                {customReminders.map((r, i) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                    <button onClick={() => openEditor(r)} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, padding: 0, border: "none", background: "none", color: "var(--text)", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: r.active ? 1 : 0.6 }}>{r.title}</span>
                        <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                          {fmtTime(r.time_hhmm)} · {fmtDays(r.days)}{r.active ? "" : " · paused"}
                        </span>
                      </span>
                      <ChevronRight size={16} color="var(--text-faint)" />
                    </button>
                    <Switch on={!!r.active} onChange={() => toggleCustom(r)} label={`${r.title} on`} />
                  </div>
                ))}
                <button onClick={() => openEditor(null)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", border: "none", borderTop: customReminders.length ? "1px solid var(--border)" : "none", background: "none", color: "var(--accent-text)", fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={18} /> New reminder
                </button>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-faint)" }}>
                {customReminders.length === 0 ? "For vitamins, a workout, medicines — anything with a time. " : ""}These arrive exactly when you set them.
              </p>
            </section>
          </>
        )}
      </div>

      {editorOpen && (
        <Sheet
          title={editingId ? "Edit reminder" : "New reminder"}
          onClose={closeEditor}
          footer={
            <>
              {editingId && (
                <button
                  onClick={async () => {
                    await handleDelete(editingId);
                    closeEditor();
                    flash("Reminder deleted.");
                  }}
                  style={dangerBtn}
                >
                  Delete
                </button>
              )}
              <button onClick={editingId ? handleSaveEdit : handleAddCustom} style={{ ...primaryBtn, flex: 1 }}>
                {editingId ? "Save" : "Add reminder"}
              </button>
            </>
          }
        >
          <form onSubmit={editingId ? handleSaveEdit : handleAddCustom} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={sheetLabel}>
              Title
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Take vitamin D" maxLength={60} style={sheetInput} />
            </label>
            <label style={sheetLabel}>
              Message
              <input value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="With breakfast, one tablet" maxLength={140} style={sheetInput} />
            </label>
            <label style={sheetLabel}>
              Time
              <input type="time" value={form.time_hhmm} onChange={(e) => e.target.value && setForm({ ...form, time_hhmm: e.target.value })} style={{ ...sheetInput, colorScheme: "dark" }} />
            </label>
            <div style={sheetLabel}>
              Days · {fmtDays(form.days)}
              <DayPicker days={form.days} onToggle={toggleFormDay} />
            </div>
            <button type="submit" hidden />
          </form>
        </Sheet>
      )}

      {statusMsg && (
        <div role="status" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(96px + env(safe-area-inset-bottom, 0px))", zIndex: 10050, width: "min(92vw, 520px)", boxSizing: "border-box", padding: "12px 16px", borderRadius: 14, background: "var(--surface-highlight)", border: "1px solid var(--border)", color: statusMsg.ok ? "var(--text)" : "var(--warn)", fontSize: 14, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
          {statusMsg.ok && <Check size={16} color="var(--accent-text)" />} {statusMsg.text}
        </div>
      )}
    </div>
  );
}
