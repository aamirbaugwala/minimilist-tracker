/**
 * Smart reminder rules — pure, no I/O (used by /api/notifications/cron).
 *
 * Habit reminders only fire when they help:
 *   food_log  two meal nudges a day: lunch at 1:45 pm and dinner at the
 *             reminder's own time — each skipped once that meal is logged.
 *             Tapping opens Today's food sheet on that meal (/?log=Lunch).
 *   water     skipped once the user has had half their daily water goal.
 *   streak    skipped if anything is logged today.
 *   weekly    Monday review, always sent.
 * Quiet hours: habit reminders never fire 10 pm – 7 am; a stored time inside
 * that window is moved to the nearest edge (9:45 pm / 7:00 am).
 * Custom reminders (vitamins, medicines…) are sent exactly as the user set
 * them — no conditions, no quiet hours.
 */

export const HABIT_TYPES = ["food_log", "water", "streak", "weekly"];
export const LUNCH_SLOT = "13:45";
export const EARLIEST = 7 * 60; // 07:00
export const LATEST = 21 * 60 + 45; // 21:45 — last habit send before quiet hours

export function toMinutes(hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** The time a reminder actually fires, after quiet hours. */
export function effectiveMinutes(type, hhmm) {
  const t = toMinutes(hhmm);
  if (t === null) return null;
  if (!HABIT_TYPES.includes(type)) return t;
  return Math.min(Math.max(t, EARLIEST), LATEST);
}

export const DINNER_DEFAULT = "20:45";
export const DINNER_EARLIEST = 17 * 60;

/** The dinner nudge time for a food_log row. Rows saved before meal nudges
 *  existed may hold a daytime time (e.g. 14:00) — that can't be a dinner
 *  check, so fall back to 8:45 pm. */
export function dinnerMinutes(hhmm) {
  const t = effectiveMinutes("food_log", hhmm || DINNER_DEFAULT);
  return t === null || t < DINNER_EARLIEST ? toMinutes(DINNER_DEFAULT) : t;
}

/**
 * The send slots for one reminder row.
 *  - `final` slots record last_sent_date (one per day);
 *  - the lunch slot doesn't, so the dinner slot can still fire later. A
 *    repeat send of the same slot replaces itself on the phone (same tag).
 */
export function slotsFor(reminder) {
  if (reminder.type === "food_log") {
    return [
      { key: "lunch", minutes: toMinutes(LUNCH_SLOT), meal: "Lunch", final: false },
      { key: "dinner", minutes: dinnerMinutes(reminder.time_hhmm), meal: "Dinner", final: true },
    ];
  }
  return [{ key: "main", minutes: effectiveMinutes(reminder.type, reminder.time_hhmm), final: true }];
}

/** Is `slotMinutes` due at `nowMinutes` within a cron window of `windowMinutes`? */
export const isDue = (slotMinutes, nowMinutes, windowMinutes) =>
  slotMinutes !== null && nowMinutes - slotMinutes >= 0 && nowMinutes - slotMinutes < Math.max(1, windowMinutes);

const isFood = (l) => (l.name || "").toLowerCase() !== "water";

/** IST hour of a timestamp (the app's users and cron run on IST). */
const istHour = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 5.5 * 3600 * 1000).getUTCHours();
};

// Logs saved before the meal column existed have no meal: fall back to time.
const MEAL_HOURS = { Lunch: [11, 16], Dinner: [18, 24] };
export function mealLogged(logs, meal) {
  const [from, to] = MEAL_HOURS[meal] || [0, 24];
  return (logs || []).some((l) => {
    if (!isFood(l)) return false;
    if (l.meal) return l.meal === meal;
    const h = istHour(l.created_at);
    return h !== null && h >= from && h < to;
  });
}

const fmtL = (n) => (Math.round(n * 10) / 10).toString();

/**
 * Decide whether to send a slot, and with what content.
 * @param ctx { logs: today's food_logs rows for the user, waterGoal: litres }
 * @returns { send: false, reason } | { send: true, title, body, url, tag }
 */
export function decide(reminder, slot, ctx = {}) {
  const logs = ctx.logs || [];
  const tag = `reminder-${reminder.id}-${slot.key}`;

  switch (reminder.type) {
    case "food_log": {
      if (mealLogged(logs, slot.meal)) return { send: false, reason: `${slot.meal} already logged` };
      return {
        send: true,
        title: `${slot.meal} isn’t logged yet`,
        body: "Snap your plate — it takes about 10 seconds.",
        url: `/?log=${slot.meal}`,
        tag,
        // Notification buttons (Android/desktop; iOS shows the body only).
        actions: [
          { action: "snap", title: "Snap it", url: `/?snap=${slot.meal}` },
          { action: "repeat", title: "Same as yesterday", url: `/?repeat=${slot.meal}` },
        ],
      };
    }
    case "water": {
      const goal = ctx.waterGoal || 3;
      const litres = logs.filter((l) => !isFood(l)).reduce((s, l) => s + (Number(l.qty) || 0), 0) * 0.25; // qty = glasses
      if (litres >= goal / 2) return { send: false, reason: "water past half the goal" };
      return { send: true, title: "Water check-in", body: `${fmtL(litres)} of ${fmtL(goal)} L so far. A glass now?`, url: "/", tag };
    }
    case "streak": {
      if (logs.some(isFood)) return { send: false, reason: "already logged today" };
      return { send: true, title: "Keep your streak", body: "Nothing logged yet today — one meal keeps it going.", url: "/", tag };
    }
    case "weekly":
      return { send: true, title: reminder.title || "Your week in review", body: reminder.body || "See how last week went.", url: "/dashboard", tag };
    default:
      return { send: true, title: reminder.title, body: reminder.body, url: "/", tag };
  }
}
