/**
 * POST /api/notifications/cron
 *
 * Called by a cron job every 15 minutes. Finds reminders whose time_hhmm
 * matches the current IST time and sends push notifications to all of that
 * user's registered devices.
 *
 * Trigger options:
 *   • Cloudflare Workers Cron Triggers (add to wrangler.toml)
 *   • External: cron-job.org, GitHub Actions, Supabase pg_cron
 *   • POST with header: x-cron-secret: <your CRON_SECRET env var>
 *
 * Required env vars:
 *   SUPABASE_SERVICE_KEY   — service role key (never expose to client)
 *   VAPID_PUBLIC_KEY       — from: npx web-push generate-vapid-keys
 *   VAPID_PRIVATE_KEY      — from: npx web-push generate-vapid-keys
 *   VAPID_EMAIL            — your email address
 *   CRON_SECRET            — any random string to authenticate the cron call
 *
 * Supabase RPC (run once):
 *   create or replace function get_due_reminders(current_hhmm text, current_dow int)
 *   returns table (id uuid, user_id uuid, title text, body text, type text, time_hhmm text)
 *   language sql security definer as $$
 *     select id, user_id, title, body, type, time_hhmm
 *     from reminders
 *     where active = true
 *       and time_hhmm = current_hhmm
 *       and current_dow = any(days)
 *       and (last_sent_date is null or last_sent_date < current_date);
 *   $$;
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Service-role client — bypasses RLS to read all users' reminders and subscriptions
const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// URL-type hints per reminder type, so the notification click lands on the right page
const TYPE_URLS = {
  food_log: "/",
  water:    "/",
  streak:   "/",
  weekly:   "/dashboard",
  custom:   "/",
};

export async function POST(req) {
  return runCron(req);
}

// Vercel Cron calls GET endpoints, so we support GET + Bearer auth too.
export async function GET(req) {
  return runCron(req);
}

async function runCron(req) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const xSecret = req.headers.get("x-cron-secret");
  const auth    = req.headers.get("authorization") || "";
  const bearer  = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const secret  = xSecret || bearer;

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  // ── Current time in IST (UTC+5:30) ────────────────────────────────────────
  const nowUtcMs  = Date.now() + 5.5 * 60 * 60 * 1000;
  const istNow    = new Date(nowUtcMs);
  const hh        = String(istNow.getUTCHours()).padStart(2, "0");
  const mm        = String(istNow.getUTCMinutes()).padStart(2, "0");
  const timeStr   = `${hh}:${mm}`;
  // 1=Mon … 7=Sun (matches how reminders.days are stored)
  const rawDow    = istNow.getUTCDay();
  const dow       = rawDow === 0 ? 7 : rawDow;
  const todayDate = istNow.toISOString().slice(0, 10);

  // ── Fetch due reminders ───────────────────────────────────────────────────
  const { data: reminders, error: rErr } = await adminDb.rpc("get_due_reminders", {
    current_hhmm: timeStr,
    current_dow:  dow,
  });

  if (rErr) {
    console.error("[cron] get_due_reminders:", rErr.message);
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }

  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ sent: 0, time: timeStr, message: "No reminders due" });
  }

  let sent   = 0;
  let failed = 0;

  for (const reminder of reminders) {
    // Fetch all push subscriptions for this user
    const { data: subs } = await adminDb
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key")
      .eq("user_id", reminder.user_id);

    if (!subs || subs.length === 0) continue;

    const payload = JSON.stringify({
      title: reminder.title,
      body:  reminder.body,
      tag:   `reminder-${reminder.id}`,
      url:   TYPE_URLS[reminder.type] || "/",
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload,
          { TTL: 86400 }
        );
        sent++;
      } catch (err) {
        console.error(`[cron] push failed (${sub.endpoint.slice(-20)}): ${err.statusCode || err.message}`);
        // Subscription expired or invalid — clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await adminDb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        failed++;
      }
    }

    // Mark sent today to prevent duplicate sends
    await adminDb
      .from("reminders")
      .update({ last_sent_date: todayDate })
      .eq("id", reminder.id);
  }

  console.log(JSON.stringify({ event: "cron_push", time: timeStr, sent, failed }));
  return NextResponse.json({ sent, failed, time: timeStr, processed: reminders.length });
}
