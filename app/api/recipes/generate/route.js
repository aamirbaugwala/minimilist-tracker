/**
 * SUPABASE TABLE — run this SQL once in Supabase SQL editor:
 *
 * create table recipes (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references auth.users not null,
 *   name text not null,
 *   description text,
 *   ingredients jsonb not null,   -- [{ name, qty, unit, calories, protein, carbs, fats, fiber }]
 *   steps text[] not null,
 *   servings int not null default 1,
 *   per_serving jsonb not null,   -- { calories, protein, carbs, fats, fiber }
 *   total_macros jsonb not null,
 *   tags text[],                  -- ["high-protein", "vegetarian", etc.]
 *   source text default 'ai',     -- 'ai' | 'manual'
 *   created_at timestamptz default now()
 * );
 * alter table recipes enable row level security;
 * create policy "Users manage own recipes" on recipes
 *   using (auth.uid() = user_id) with check (auth.uid() = user_id);
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    const body = await req.json();
    const { prompt, userId, accessToken, servings = 1 } = body;

    if (!userId || !accessToken)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3)
      return NextResponse.json({ error: "Please describe the recipe you want." }, { status: 400 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const systemPrompt = `You are a professional nutritionist and chef specializing in Indian cuisine.
The user will describe a recipe they want. You must:
1. Generate a complete, realistic recipe.
2. Calculate accurate nutritional macros for EACH ingredient and totals per serving.
3. Return ONLY a valid JSON object — no markdown, no explanation, no code fences.

JSON schema (follow exactly):
{
  "name": "Recipe name",
  "description": "1-2 sentence description",
  "servings": ${servings},
  "ingredients": [
    {
      "name": "ingredient name",
      "qty": 100,
      "unit": "g",
      "calories": 120,
      "protein": 5.2,
      "carbs": 20.1,
      "fats": 2.3,
      "fiber": 1.1
    }
  ],
  "steps": [
    "Step 1: ...",
    "Step 2: ..."
  ],
  "per_serving": {
    "calories": 450,
    "protein": 28,
    "carbs": 40,
    "fats": 12,
    "fiber": 6
  },
  "total_macros": {
    "calories": 900,
    "protein": 56,
    "carbs": 80,
    "fats": 24,
    "fiber": 12
  },
  "tags": ["high-protein", "vegetarian"]
}

Allowed tags: high-protein, low-carb, vegetarian, vegan, dairy-free, gluten-free, high-fiber, low-fat, bulking, cutting.`;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `Recipe request: ${prompt.trim()}` },
    ]);

    const raw = result.response.text().trim();

    // Strip markdown code fences if model wraps in them anyway
    const jsonStr = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let recipe;
    try {
      recipe = JSON.parse(jsonStr);
    } catch {
      console.error("Gemini returned non-JSON:", raw);
      return NextResponse.json({ error: "AI returned an invalid recipe format. Please try rephrasing." }, { status: 500 });
    }

    // Validate required fields
    if (!recipe.name || !Array.isArray(recipe.ingredients) || !Array.isArray(recipe.steps) || !recipe.per_serving) {
      return NextResponse.json({ error: "AI returned an incomplete recipe. Please try again." }, { status: 500 });
    }

    // Return the generated recipe — the client decides whether to save it
    return NextResponse.json({ recipe: { ...recipe, source: "ai" }, saved: false });
  } catch (error) {
    console.error("Recipe generation error:", error);
    return NextResponse.json({ error: "Failed to generate recipe: " + error.message }, { status: 500 });
  }
}
