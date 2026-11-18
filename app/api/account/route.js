import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * /api/account — the user's own data: download it, delete reports, delete everything.
 *
 *   GET                       → JSON export of every row the user owns
 *   DELETE { scope: "reports" } → all medical reports (rows + stored PDFs)
 *   DELETE { scope: "account" } → every row, every file, then the login itself
 *
 * The caller is identified from their access token (never from a userId in the
 * request). Deletes use the service-role client because most tables reference
 * auth.users with NO ACTION, so child rows must go first and the auth user can
 * only be removed with the admin API. page_views and llm_usage are kept but
 * anonymised automatically (their FK is ON DELETE SET NULL).
 */

// Tables keyed by user_id that belong to the user. Order matters for delete:
// children first, the profile last.
const USER_TABLES = [
  "food_logs",
  "saved_meals",
  "custom_foods",
  "weight_logs",
  "goal_history",
  "weekly_insights",
  "recipes",
  "medical_reports",
  "chat_sessions",
  "push_subscriptions",
  "reminders",
  "daily_activity",
  "activity_logs",
  "user_gamification",
  "rate_limits",
  "visitor_identities",
  "user_profiles",
];
// Bookkeeping that isn't the user's content — deleted, not exported.
const NOT_EXPORTED = new Set(["rate_limits", "visitor_identities", "push_subscriptions"]);
const BUCKET = "medical-reports";
const PAGE = 1000;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function callerId(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.getUser(token);
  return error ? null : data?.user || null;
}

/** Every stored file for this user: the user's folder plus any file_path on a report row. */
async function removeReportFiles(db, uid) {
  const paths = new Set();
  const { data: rows } = await db.from("medical_reports").select("file_path").eq("user_id", uid);
  (rows || []).forEach((r) => r.file_path && paths.add(r.file_path));
  for (let offset = 0; ; offset += 1000) {
    const { data: files, error } = await db.storage.from(BUCKET).list(uid, { limit: 1000, offset });
    if (error || !files?.length) break;
    files.forEach((f) => f.name && paths.add(`${uid}/${f.name}`));
    if (files.length < 1000) break;
  }
  if (!paths.size) return 0;
  const list = [...paths];
  for (let i = 0; i < list.length; i += 100) {
    const { error } = await db.storage.from(BUCKET).remove(list.slice(i, i + 100));
    if (error) throw new Error(`Couldn't delete stored report files: ${error.message}`);
  }
  return list.length;
}

async function deleteRows(db, table, uid) {
  const { error } = await db.from(table).delete().eq("user_id", uid);
  // A table that doesn't exist on this database (optional migration) is fine.
  if (error && !/does not exist|schema cache/i.test(error.message)) {
    throw new Error(`Couldn't delete ${table}: ${error.message}`);
  }
}

export async function GET(req) {
  const user = await callerId(req);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const db = admin();
  if (!db) return NextResponse.json({ error: "Export isn't configured on the server." }, { status: 500 });

  const out = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    note: "Original report PDFs aren't included here; open each report in Medical to download it.",
  };
  // Page through: Supabase returns at most 1,000 rows per request.
  // Stable order (by id) so pages don't overlap; tables without an id column
  // (user_profiles, user_gamification) have one row and fit in a single page.
  const all = async (build) => {
    const rows = [];
    let ordered = true;
    for (let from = 0; ; from += PAGE) {
      let { data, error } = await (ordered ? build().order("id") : build()).range(from, from + PAGE - 1);
      if (error && ordered && from === 0) {
        ordered = false;
        ({ data, error } = await build().range(from, from + PAGE - 1));
      }
      if (error) return rows.length ? rows : null;
      rows.push(...(data || []));
      if (!data || data.length < PAGE) return rows;
    }
  };
  for (const table of USER_TABLES) {
    if (NOT_EXPORTED.has(table)) continue;
    const rows = await all(() => db.from(table).select("*").eq("user_id", user.id));
    if (rows) out[table] = rows;
  }
  out.friendships = (await all(() => db.from("friendships").select("*").or(`user_id.eq.${user.id},friend_id.eq.${user.id}`))) || [];

  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="nutritrack-data-${out.exported_at.slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function DELETE(req) {
  const user = await callerId(req);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const db = admin();
  if (!db) return NextResponse.json({ error: "Delete isn't configured on the server." }, { status: 500 });

  let scope = "";
  try {
    ({ scope } = await req.json());
  } catch {
    /* no body */
  }
  if (scope !== "reports" && scope !== "account") {
    return NextResponse.json({ error: "Unknown delete scope." }, { status: 400 });
  }

  const uid = user.id;
  try {
    const files = await removeReportFiles(db, uid);
    if (scope === "reports") {
      await deleteRows(db, "medical_reports", uid);
      return NextResponse.json({ ok: true, scope, files });
    }

    const { error: fErr } = await db.from("friendships").delete().or(`user_id.eq.${uid},friend_id.eq.${uid}`);
    if (fErr) throw new Error(`Couldn't delete friendships: ${fErr.message}`);
    for (const table of USER_TABLES) await deleteRows(db, table, uid);

    const { error: authErr } = await db.auth.admin.deleteUser(uid);
    if (authErr) throw new Error(`Your data was deleted, but the login couldn't be removed: ${authErr.message}`);
    return NextResponse.json({ ok: true, scope, files });
  } catch (e) {
    console.error("[account] delete failed", scope, e?.message);
    return NextResponse.json({ error: e?.message || "Delete failed." }, { status: 500 });
  }
}
