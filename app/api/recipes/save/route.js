import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseForUser(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { recipe, userId, accessToken } = body;

    if (!userId || !accessToken)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!recipe || !recipe.name)
      return NextResponse.json({ error: "No recipe data provided." }, { status: 400 });

    const db = getSupabaseForUser(accessToken);

    const { data: saved, error: dbError } = await db
      .from("recipes")
      .insert({
        user_id: userId,
        name: recipe.name,
        description: recipe.description || "",
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        servings: recipe.servings || 1,
        per_serving: recipe.per_serving,
        total_macros: recipe.total_macros,
        tags: recipe.tags || [],
        source: recipe.source || "ai",
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB error saving recipe:", dbError);
      return NextResponse.json({ error: "Could not save recipe: " + dbError.message }, { status: 500 });
    }

    return NextResponse.json({ recipe: saved, saved: true });
  } catch (error) {
    console.error("Save recipe error:", error);
    return NextResponse.json({ error: "Failed to save recipe: " + error.message }, { status: 500 });
  }
}
