/**
 * GET  /api/recipes/list  — fetch all recipes for logged-in user
 * DELETE /api/recipes/list?id=<uuid> — delete a recipe
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

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const accessToken = req.headers.get("authorization")?.replace("Bearer ", "");
    const userId = searchParams.get("userId");

    if (!userId || !accessToken)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getSupabaseForUser(accessToken);
    const { data, error } = await db
      .from("recipes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ recipes: data || [] });
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
      return NextResponse.json({ error: "Recipe ID required" }, { status: 400 });

    const db = getSupabaseForUser(accessToken);
    const { error } = await db.from("recipes").delete().eq("id", id).eq("user_id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
