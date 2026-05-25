/**
 * rateLimit.js
 *
 * Production-safe rate limiter backed by Supabase.
 * Works correctly on Cloudflare Workers / serverless — no in-memory state.
 *
 * Strategy: sliding window per user.
 *   - Each row in `rate_limits` stores: user_id, count, window_start
 *   - On every request we check if the window is still active (< WINDOW_MS old).
 *   - If active  → increment count, deny if over LIMIT.
 *   - If expired → reset the window and allow.
 *
 * Table (run once in Supabase SQL editor):
 *   create table if not exists rate_limits (
 *     user_id      uuid primary key,
 *     count        integer not null default 1,
 *     window_start timestamptz not null default now()
 *   );
 *   alter table rate_limits enable row level security;
 *   create policy "service role only" on rate_limits using (false);
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ────────────────────────────────────────────────────────────────────
const RATE_LIMIT   = 20;          // max requests per window per user
const WINDOW_MS    = 60_000;      // 1 minute window (milliseconds)

// ── Service-role client (bypasses RLS so we can write rate_limits) ───────────
// IMPORTANT: SUPABASE_SERVICE_ROLE_KEY must be in your env — never expose client-side.
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    // Fallback: if service key not configured, fail open (allow request) but log loudly.
    console.error(
      "[rateLimit] SUPABASE_SERVICE_ROLE_KEY is not set. " +
      "Rate limiting is DISABLED. Set this env var immediately."
    );
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

/**
 * checkRateLimit(userId)
 *
 * Returns:
 *   { allowed: true,  remaining: N  }  — request is within limits
 *   { allowed: false, retryAfterMs: N } — request is rate-limited
 */
export async function checkRateLimit(userId) {
  const db = getServiceClient();

  // If service key not configured → fail open (allow) with a warning already logged above
  if (!db) return { allowed: true, remaining: RATE_LIMIT };

  const now = new Date();

  try {
    // Fetch the current window for this user
    const { data: row, error: fetchError } = await db
      .from("rate_limits")
      .select("count, window_start")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      // DB error → fail open so users aren't blocked by our own infra issues
      console.error("[rateLimit] fetch error:", fetchError.message);
      return { allowed: true, remaining: RATE_LIMIT };
    }

    // No row yet → first request ever from this user, create and allow
    if (!row) {
      await db.from("rate_limits").insert({
        user_id:      userId,
        count:        1,
        window_start: now.toISOString(),
      });
      return { allowed: true, remaining: RATE_LIMIT - 1 };
    }

    const windowAge = now.getTime() - new Date(row.window_start).getTime();

    // Window expired → reset
    if (windowAge > WINDOW_MS) {
      await db.from("rate_limits").upsert({
        user_id:      userId,
        count:        1,
        window_start: now.toISOString(),
      });
      return { allowed: true, remaining: RATE_LIMIT - 1 };
    }

    // Window still active
    if (row.count >= RATE_LIMIT) {
      const retryAfterMs = WINDOW_MS - windowAge;
      return { allowed: false, retryAfterMs: Math.ceil(retryAfterMs) };
    }

    // Increment count
    await db.from("rate_limits")
      .update({ count: row.count + 1 })
      .eq("user_id", userId);

    return { allowed: true, remaining: RATE_LIMIT - (row.count + 1) };

  } catch (err) {
    // Unexpected error → fail open
    console.error("[rateLimit] unexpected error:", err);
    return { allowed: true, remaining: RATE_LIMIT };
  }
}
