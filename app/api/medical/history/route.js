import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseForUser(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const accessToken = req.headers.get("authorization")?.replace("Bearer ", "");
    const userId = searchParams.get("userId");

    if (!userId || !accessToken)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getSupabaseForUser(accessToken);
    // Select "*" so this keeps working whether or not the vault migration
    // (file_path/file_size columns) has been applied yet — if the columns are
    // absent the fields are simply undefined and the vault gracefully hides.
    const { data, error } = await db
      .from("medical_reports")
      .select("*")
      .eq("user_id", userId)
      .order("report_date", { ascending: false, nullsFirst: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const reports = data || [];
    // Attach short-lived signed URLs so the vault can open/download originals.
    const paths = reports.filter((r) => r.file_path).map((r) => r.file_path);
    if (paths.length) {
      const { data: signed } = await db.storage
        .from("medical-reports")
        .createSignedUrls(paths, 60 * 60); // 1 hour
      const urlByPath = {};
      (signed || []).forEach((s) => {
        if (s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl;
      });
      for (const r of reports) {
        if (r.file_path && urlByPath[r.file_path]) r.file_url = urlByPath[r.file_path];
      }
    }

    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const accessToken = req.headers.get("authorization")?.replace("Bearer ", "");
    const userId = searchParams.get("userId");
    const id = searchParams.get("id");

    if (!userId || !accessToken)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!id)
      return NextResponse.json({ error: "Report ID required" }, { status: 400 });

    const db = getSupabaseForUser(accessToken);
    const { error } = await db
      .from("medical_reports")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Best-effort: remove the stored PDF too (naming convention is <uid>/<id>.pdf).
    try {
      await db.storage.from("medical-reports").remove([`${userId}/${id}.pdf`]);
    } catch { /* ignore — row is already gone */ }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
