/**
 * app/lib/socialScoring.js
 *
 * Single source of truth for social leaderboard / all-time faceoff scoring.
 *
 * This logic previously existed twice, verbatim, inside social/page.js — once in
 * fetchSocialData() and once in refreshFaceoff() (~70 lines each), which meant
 * any fix had to be made in both places or the two would silently drift.
 *
 * ─── The frozen-faceoff bug ──────────────────────────────────────────────────
 * The old history query was:
 *
 *     .order("date", { ascending: true }).limit(50000)
 *
 * with a comment claiming the high limit "bypasses Supabase's 1000-row default".
 * It does not. `.limit()` cannot exceed PostgREST's server-side `max-rows` cap
 * (1000 by default in Supabase) — the server clamps it. Combined with the
 * ASCENDING date sort, that means once the two users accumulated more than
 * max-rows log entries, the query permanently returned only the OLDEST 1000
 * rows. Newly logged days sat past the cutoff and could never enter the window,
 * so the faceoff totals froze and no amount of refreshing changed them.
 *
 * fetchAllLogs() pages through with .range() until a short page comes back, so
 * it returns every row regardless of the server cap.
 */

import { FLATTENED_DB } from "../food-data";
import { fetchLogsPaginated } from "./fetchLogs";

/** Every food_log row for the given users, paged past PostgREST's max-rows cap. */
export const fetchAllLogs = (userIds) => fetchLogsPaginated({ userIds });

/**
 * Score a single day's logs for one user against their targets.
 * Max 135 (100 base + 35 bonuses), floored at 0. Math is unchanged from the
 * original inline implementations so existing scores stay comparable.
 */
export function calcDayScore(userLogs, targets) {
  if (!userLogs.length) return 0;

  const s = userLogs.reduce(
    (acc, item) => {
      let fib = item.fiber || 0;
      if (!fib && item.name !== "Water") {
        const dbItem = FLATTENED_DB[item.name?.toLowerCase()];
        if (dbItem?.fiber) fib = Math.round(dbItem.fiber * item.qty);
      }
      return {
        cals: acc.cals + (item.calories || 0),
        p: acc.p + (item.protein || 0),
        c: acc.c + (item.carbs || 0),
        f: acc.f + (item.fats || 0),
        fib: acc.fib + fib,
        water: item.name === "Water" ? acc.water + item.qty * 0.25 : acc.water,
      };
    },
    { cals: 0, p: 0, c: 0, f: 0, fib: 0, water: 0 },
  );

  const pct = (v, t) => (t > 0 ? Math.min(100, (v / t) * 100) : 0);
  const baseScore = Math.round(
    (pct(s.cals, targets.cals) +
      pct(s.p, targets.p) +
      pct(s.c, targets.c) +
      pct(s.f, targets.f) +
      pct(s.fib, targets.fib) +
      pct(s.water, targets.water)) /
      6,
  );

  let bonus = 0;
  if (s.p >= targets.p * 0.9) bonus += 15;
  if (s.fib >= targets.fib * 0.9) bonus += 10;
  if (s.water >= targets.water * 0.9) bonus += 10;

  let penalty = 0;
  if (s.cals > targets.cals)
    penalty += Math.floor(((s.cals - targets.cals) / targets.cals) * 10) * 5;
  if (s.f > targets.f)
    penalty += Math.floor(((s.f - targets.f) / targets.f) * 10) * 5;
  if (s.c > targets.c)
    penalty += Math.floor(((s.c - targets.c) / targets.c) * 10) * 3;

  return Math.max(0, baseScore + bonus - penalty);
}

/**
 * Compute the all-time head-to-head record between exactly two users.
 * Returns null when fewer than two users are supplied.
 *
 * @param {Array} top2 - two user objects, each { id, targets }
 */
export async function computeFaceoff(top2) {
  if (!top2 || top2.length < 2) return null;

  const logs = await fetchAllLogs(top2.map((u) => u.id));

  // Bucket by date once. The original filtered the full array per date, which is
  // O(days × logs) — fine at 1000 rows, but this now walks the complete history.
  const byDate = new Map();
  for (const log of logs) {
    const bucket = byDate.get(log.date);
    if (bucket) bucket.push(log);
    else byDate.set(log.date, [log]);
  }

  const wins = { [top2[0].id]: 0, [top2[1].id]: 0 };
  const lifetimePoints = { [top2[0].id]: 0, [top2[1].id]: 0 };
  const loggedDays = { [top2[0].id]: 0, [top2[1].id]: 0 };

  for (const dayLogs of byDate.values()) {
    const dayScores = top2.map((user) => ({
      id: user.id,
      score: calcDayScore(
        dayLogs.filter((l) => l.user_id === user.id),
        user.targets,
      ),
    }));

    // Tally the day's win only if somebody actually logged.
    if (dayScores.some((d) => d.score > 0)) {
      if (dayScores[0].score > dayScores[1].score) wins[dayScores[0].id]++;
      else if (dayScores[1].score > dayScores[0].score) wins[dayScores[1].id]++;
    }

    // Accumulate lifetime points only for users who logged that day.
    dayScores.forEach(({ id, score }) => {
      if (dayLogs.some((l) => l.user_id === id)) {
        lifetimePoints[id] += score;
        loggedDays[id]++;
      }
    });
  }

  return {
    u1: top2[0].id,
    u2: top2[1].id,
    wins,
    lifetimePoints,
    loggedDays,
    totalDays: byDate.size,
  };
}
