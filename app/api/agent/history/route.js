/**
 * GET  /api/agent/history  — load the last N messages for the current user
 * DELETE /api/agent/history — clear all chat history for the current user
 *
 * Supabase table (run once in SQL editor):
 *
 *   create table if not exists chat_sessions (
 *     id         uuid primary key default gen_random_uuid(),
 *     user_id    uuid references auth.users not null,
 *     role       text not null check (role in ('user', 'model')),
 *     content    text not null,
 *     tools_used text[] default '{}',
 *     created_at timestamptz default now()
 *   );
 *   alter table chat_sessions enable row level security;
 *   create policy "Users manage own chat" on chat_sessions
 *     using  (auth.uid() = user_id)
 *     with check (auth.uid() = user_id);
 *   create index chat_sessions_user_created on chat_sessions (user_id, created_at desc);
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseForUser(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}

// ── GET — fetch last 40 messages (for display on page load) ──────────────────
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId      = searchParams.get("userId");
  const accessToken = searchParams.get("accessToken");

  if (!userId || !accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseForUser(accessToken);

  // ── One-time cleanup: delete widget-sourced rows that were mistakenly saved
  // to chat_sessions before the skipHistory fix was deployed. These "user"
  // messages contain system-prompt text from the dashboard briefing, social
  // squad briefing, medical summary, and home meal plan widgets. They corrupt
  // the conversation context fed to Gemini and cause tool-calling prompts to
  // fail. Running this on every page-open is cheap because after the first
  // pass there is nothing left to delete.
  await db
    .from("chat_sessions")
    .delete()
    .eq("user_id", userId)
    .eq("role", "user")
    .or(
      "content.ilike.You are my personal expert nutritionist%," +
      "content.ilike.You are a competitive squad nutrition coach%," +
      "content.ilike.You are a clinical dietitian%," +
      "content.ilike.Build me a meal plan for the rest of the day based on my macro gap. Be specific%"
    );
  // Note: the orphaned model responses left behind are trimmed at query-time
  // by the firstUserIdx logic in the agent route — no extra delete needed.

  const { data, error } = await db
    .from("chat_sessions")
    .select("id, role, content, tools_used, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    console.error("[chat history] fetch error:", error.message);
    return NextResponse.json({ error: "Could not load history." }, { status: 500 });
  }

  // Return in chronological order (oldest first) for display
  return NextResponse.json({ messages: (data || []).reverse() });
}

// ── DELETE — wipe all chat history for the user ───────────────────────────────
export async function DELETE(req) {
  const { userId, accessToken } = await req.json();

  if (!userId || !accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseForUser(accessToken);

  const { error } = await db
    .from("chat_sessions")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("[chat history] delete error:", error.message);
    return NextResponse.json({ error: "Could not clear history." }, { status: 500 });
  }

  return NextResponse.json({ cleared: true });
}
