/**
 * app/lib/streak.js — the one streak rule, shared by Home and Coach.
 *
 * A streak counts consecutive LOGGED days, ending today (or yesterday — a day
 * that simply hasn't been logged yet doesn't break anything). Each calendar
 * week (Mon–Sun) allows ONE rest day: a single missed day inside the run is
 * forgiven instead of resetting the streak. Rest days don't add to the count.
 *
 * Pure and date-string based (YYYY-MM-DD) so it is testable and timezone-safe:
 * pass the user's local logical day as `today` (lib/day.js dayKey()).
 */

const shift = (day, delta) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

// Monday of the week containing `day` → a stable week id.
export const weekOf = (day) => {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return shift(day, -dow);
};

/**
 * @param {string[]} loggedDates  any order, duplicates OK (YYYY-MM-DD)
 * @param {string}   today        the user's logical today (YYYY-MM-DD)
 * @param {object}   opts         { restPerWeek = 1, maxDays = 400 }
 * @returns {{ streak:number, loggedToday:boolean, restDays:string[],
 *             restLeftThisWeek:number }}
 */
export function computeStreak(loggedDates, today, { restPerWeek = 1, maxDays = 400 } = {}) {
  const logged = new Set(loggedDates || []);
  const loggedToday = logged.has(today);
  const restUsed = new Map(); // weekId -> count
  const restDays = [];

  let streak = 0;
  // Today not logged yet is "pending", not a gap: start counting from yesterday.
  let cursor = loggedToday ? today : shift(today, -1);

  for (let i = 0; i < maxDays; i++) {
    if (logged.has(cursor)) {
      streak++;
    } else {
      const wk = weekOf(cursor);
      const used = restUsed.get(wk) || 0;
      // A rest day only bridges to an earlier logged day; never two misses in a row.
      const prev = shift(cursor, -1);
      if (used < restPerWeek && logged.has(prev)) {
        restUsed.set(wk, used + 1);
        restDays.push(cursor);
        cursor = prev;
        continue;
      }
      break;
    }
    cursor = shift(cursor, -1);
  }

  const thisWeek = weekOf(today);
  const restLeftThisWeek = Math.max(0, restPerWeek - (restUsed.get(thisWeek) || 0));
  return { streak, loggedToday, restDays, restLeftThisWeek };
}
