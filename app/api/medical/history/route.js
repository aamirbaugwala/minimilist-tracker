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
    const { data, error } = await db
      .from("medical_reports")
      .select("id, file_name, analysis, include_foods, exclude_foods, flags, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reports: data || [] });
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
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
