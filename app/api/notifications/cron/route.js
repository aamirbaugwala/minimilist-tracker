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

let webPushConfigured = false;

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase service credentials are not configured");
  }
  return createClient(url, serviceKey);
}

function ensureWebPushConfigured() {
  if (webPushConfigured) return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_EMAIL) {
    throw new Error("VAPID keys are not configured");
  }
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  webPushConfigured = true;
}

function parseHHMMToMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value || "")) return null;
  const [h, m] = value.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

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
  try {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const xSecret = req.headers.get("x-cron-secret");
  const auth    = req.headers.get("authorization") || "";
  const bearer  = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const secret  = xSecret || bearer;

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminDb = getAdminDb();
  ensureWebPushConfigured();

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
  const nowMinutes = parseHHMMToMinutes(timeStr);
  const windowMinutes = Number(process.env.CRON_WINDOW_MINUTES || 15);

  // ── Fetch candidate reminders for today/dow and evaluate in a time window ─
  const { data: reminders, error: rErr } = await adminDb
    .from("reminders")
    .select("id, user_id, title, body, type, time_hhmm, last_sent_date")
    .eq("active", true)
    .contains("days", [dow])
    .or(`last_sent_date.is.null,last_sent_date.lt.${todayDate}`);

  if (rErr) {
    console.error("[cron] get_due_reminders:", rErr.message);
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }

  if (!reminders || reminders.length === 0 || nowMinutes === null) {
    return NextResponse.json({ sent: 0, time: timeStr, message: "No reminders due" });
  }

  const dueReminders = reminders.filter((reminder) => {
    const reminderMinutes = parseHHMMToMinutes(reminder.time_hhmm);
    if (reminderMinutes === null) return false;
    const diff = nowMinutes - reminderMinutes;
    return diff >= 0 && diff < Math.max(1, windowMinutes);
  });

  if (dueReminders.length === 0) {
    return NextResponse.json({ sent: 0, time: timeStr, message: "No reminders due in window" });
  }

  let sent   = 0;
  let failed = 0;

  for (const reminder of dueReminders) {
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
  return NextResponse.json({ sent, failed, time: timeStr, processed: dueReminders.length, scanned: reminders.length, windowMinutes });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Cron run failed" }, { status: 500 });
  }
}
