/**
 * app/lib/day.js
 *
 * The app's "day" rolls over at 4am LOCAL time, not midnight. Two reasons:
 *   1. Late-night eating — a 1am snack should count toward the day you were
 *      awake for, so your evening logs don't vanish the instant the clock hits
 *      12:00.
 *   2. Consistency — home, dashboard, social, streaks and every logging path
 *      must agree on what "today" is. Previously home used local midnight while
 *      dashboard/social used UTC midnight, so they disagreed for hours.
 *
 * ALWAYS use dayKey() wherever a food_logs.date is written or read.
 */

export const DAY_ROLLOVER_HOUR = 4; // 4am → 4am

const pad = (n) => String(n).padStart(2, "0");

/**
 * The logical day (YYYY-MM-DD) for a moment. Anything before 4am local belongs
 * to the previous calendar date.
 *   9:00pm Aug 1 → "2026-08-01"
 *   1:00am Aug 2 → "2026-08-01"   (still "yesterday's" day)
 *   7:00am Aug 2 → "2026-08-02"
 */
export function dayKey(input) {
  const d = input ? new Date(input) : new Date();
  if (d.getHours() < DAY_ROLLOVER_HOUR) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The logical day N days before today (N=1 → "yesterday"). */
export function dayKeyDaysAgo(n) {
  const d = new Date();
  if (d.getHours() < DAY_ROLLOVER_HOUR) d.setDate(d.getDate() - 1); // anchor to logical today first
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
