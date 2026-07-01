/**
 * Reminders CRUD
 * GET    /api/notifications/reminders?userId=&accessToken=
 * POST   /api/notifications/reminders   — create
 * PUT    /api/notifications/reminders   — update (id required in body)
 * DELETE /api/notifications/reminders   — delete (id required in body)
 *
 * Supabase table (run once):
 *
 *   create table reminders (
 *     id             uuid primary key default gen_random_uuid(),
 *     user_id        uuid references auth.users not null,
 *     type           text not null default 'custom',
 *     title          text not null,
 *     body           text not null,
 *     time_hhmm      text not null,        -- "08:00", "20:30" etc.
 *     days           int[] default '{1,2,3,4,5,6,7}', -- 1=Mon … 7=Sun
 *     active         boolean default true,
 *     last_sent_date date,
 *     created_at     timestamptz default now()
 *   );
 *   alter table reminders enable row level security;
 *   create policy "Users manage own reminders" on reminders
 *     using (auth.uid() = user_id) with check (auth.uid() = user_id);
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VALID_TYPES = ["food_log", "water", "streak", "weekly", "custom"];

function getUserDb(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}

function validateHHMM(s) {
  return /^\d{2}:\d{2}$/.test(s);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId      = searchParams.get("userId");
  const accessToken = searchParams.get("accessToken");
  if (!userId || !accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getUserDb(accessToken);
  const { data, error } = await db
    .from("reminders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminders: data });
}

export async function POST(req) {
  try {
    const { userId, accessToken, reminder } = await req.json();
    if (!userId || !accessToken || !reminder) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (!reminder.title?.trim() || !reminder.body?.trim()) {
      return NextResponse.json({ error: "Title and body required" }, { status: 400 });
    }
    if (!validateHHMM(reminder.time_hhmm)) {
      return NextResponse.json({ error: "Invalid time format (use HH:MM)" }, { status: 400 });
    }

    const db = getUserDb(accessToken);
    const { data, error } = await db
      .from("reminders")
      .insert({
        user_id:   userId,
        type:      VALID_TYPES.includes(reminder.type) ? reminder.type : "custom",
        title:     reminder.title.trim().slice(0, 100),
        body:      reminder.body.trim().slice(0, 200),
        time_hhmm: reminder.time_hhmm,
        days:      Array.isArray(reminder.days) ? reminder.days.filter((d) => d >= 1 && d <= 7) : [1,2,3,4,5,6,7],
        active:    true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reminder: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const { userId, accessToken, reminder } = await req.json();
    if (!userId || !accessToken || !reminder?.id) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const updates = {};
    if (reminder.title     !== undefined) updates.title     = reminder.title.trim().slice(0, 100);
    if (reminder.body      !== undefined) updates.body      = reminder.body.trim().slice(0, 200);
    if (reminder.time_hhmm !== undefined) {
      if (!validateHHMM(reminder.time_hhmm)) {
        return NextResponse.json({ error: "Invalid time format" }, { status: 400 });
      }
      updates.time_hhmm = reminder.time_hhmm;
    }
    if (reminder.days   !== undefined) updates.days   = reminder.days.filter((d) => d >= 1 && d <= 7);
    if (reminder.active !== undefined) updates.active = Boolean(reminder.active);

    const db = getUserDb(accessToken);
    const { data, error } = await db
      .from("reminders")
      .update(updates)
      .eq("id", reminder.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reminder: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { userId, accessToken, id } = await req.json();
    if (!userId || !accessToken || !id) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const db = getUserDb(accessToken);
    const { error } = await db
      .from("reminders")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
