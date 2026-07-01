/**
 * POST  /api/notifications/subscribe  — save a push subscription for the user
 * DELETE /api/notifications/subscribe  — remove a push subscription
 *
 * Supabase table (run once):
 *
 *   create table push_subscriptions (
 *     id         uuid primary key default gen_random_uuid(),
 *     user_id    uuid references auth.users not null,
 *     endpoint   text not null,
 *     p256dh     text not null,
 *     auth_key   text not null,
 *     created_at timestamptz default now(),
 *     unique(endpoint)
 *   );
 *   alter table push_subscriptions enable row level security;
 *   create policy "Users manage own subscriptions" on push_subscriptions
 *     using (auth.uid() = user_id) with check (auth.uid() = user_id);
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getUserDb(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}

export async function POST(req) {
  try {
    const { userId, accessToken, subscription } = await req.json();

    if (!userId || !accessToken || !subscription?.endpoint || !subscription?.keys?.p256dh) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getUserDb(accessToken);
    const { error } = await db.from("push_subscriptions").upsert(
      {
        user_id:  userId,
        endpoint: subscription.endpoint,
        p256dh:   subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
      },
      { onConflict: "endpoint" }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { userId, accessToken, endpoint } = await req.json();
    if (!userId || !accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getUserDb(accessToken);
    let q = db.from("push_subscriptions").delete().eq("user_id", userId);
    if (endpoint) q = q.eq("endpoint", endpoint);

    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
