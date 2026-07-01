/**
 * POST /api/notifications/test
 *
 * Sends a test push notification to the calling user's most recent device.
 * Used on the Notifications settings page to verify the full pipeline works.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

let webPushConfigured = false;

function getUserDb(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}

function ensureWebPushConfigured() {
  if (webPushConfigured) return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_EMAIL) {
    throw new Error("VAPID keys not configured on server");
  }
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  webPushConfigured = true;
}

export async function POST(req) {
  try {
    const { userId, accessToken } = await req.json();
    if (!userId || !accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "VAPID keys not configured on the server. Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_EMAIL to your environment variables." },
        { status: 500 }
      );
    }

    ensureWebPushConfigured();

    const db = getUserDb(accessToken);
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!subs || subs.length === 0) {
      return NextResponse.json(
        { error: "No push subscription found. Enable notifications first." },
        { status: 400 }
      );
    }

    const sub = subs[0];
    const payload = JSON.stringify({
      title: "🎉 NutriTrack Notifications Active!",
      body:  "Your reminders are set up and working. You'll receive alerts at the times you configure.",
      tag:   "test-notification",
      url:   "/notifications",
    });

    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
      payload,
      { TTL: 300 }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      return NextResponse.json(
        { error: "Subscription expired. Please disable and re-enable notifications." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
