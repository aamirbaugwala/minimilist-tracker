/**
 * app/lib/fetchLogs.js
 *
 * Generic paginated food_logs reader.
 *
 * Why pagination: `.limit(n)` cannot exceed PostgREST's server-side `max-rows`
 * (1000 by default in Supabase) — the server clamps it. A query that asks for
 * 50000 rows still gets 1000, and combined with an ascending sort that silently
 * returns only the OLDEST rows, so recent data disappears. Paging with
 * `.range()` until a short page comes back returns everything regardless.
 *
 * Ordering is (date, id): `.range()` needs a deterministic total order, and
 * `date` alone has many ties, which could duplicate or drop rows across page
 * boundaries.
 */

import { supabase } from "../supabase";

const PAGE_SIZE = 1000;
const MAX_PAGES = 100; // hard stop at 100k rows — guards against an infinite loop

const DEFAULT_COLUMNS =
  "user_id, date, calories, protein, carbs, fats, fiber, name, qty";

/**
 * @param {object}   opts
 * @param {string[]} opts.userIds  - users to fetch for (required)
 * @param {string}   [opts.from]   - inclusive start date, "YYYY-MM-DD"
 * @param {string}   [opts.to]     - inclusive end date, "YYYY-MM-DD"
 * @param {string}   [opts.columns]
 */
export async function fetchLogsPaginated({ userIds, from, to, columns }) {
  if (!userIds?.length) return [];
  const all = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    let q = supabase
      .from("food_logs")
      .select(columns || DEFAULT_COLUMNS)
      .in("user_id", userIds);

    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);

    const offset = page * PAGE_SIZE;
    const { data, error } = await q
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < PAGE_SIZE) break; // short page => last one
  }

  return all;
}
