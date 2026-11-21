/**
 * POST /api/identify-meal
 *
 * Look at a meal PHOTO and return the foods it contains WITHOUT logging them —
 * the home screen shows the result so the user can confirm or correct before it
 * gets saved. Same deterministic matching as /api/voice-log (so quantities and
 * macros are consistent), just sourced from an image instead of a transcript.
 *
 * Body: { image (base64, no header), mimeType, userId, accessToken,
 *         correction?, meal?, date? }
 * Returns: { isFood: true, items: [{ name, qty, calories, protein, carbs, fats, fiber }],
 *            unmatched: string[], totals: { calories, protein } }
 *   or     { isFood: false }
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { FLATTENED_DB } from "../../food-data";
import { getCatalog } from "../../lib/foodCatalog";
import { defaultMeal, MEALS } from "../../lib/mealPeriod";
import { buildLogRows } from "../../lib/voiceLog";
import { recordLlmUsage } from "../../lib/llmCost";

function getSupabaseForUser(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  );
}

const MEAL_LABELS = MEALS.map((m) => m.label);

const SCHEMA = {
  type: "OBJECT",
  properties: {
    isFood: { type: "BOOLEAN" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          quantity: { type: "NUMBER" },
          unit: { type: "STRING" },
        },
        required: ["name", "quantity"],
      },
    },
  },
  required: ["isFood", "items"],
};

const INSTRUCTIONS = `You analyse a food photo for a nutrition app. Return ONLY JSON matching the schema.

- isFood: true only if the image actually shows food or drink. If it is a person, screenshot, document, or any non-food object, set isFood=false and items=[].
- items (only when isFood): one entry per DISTINCT food or drink you can see.
  • name = short, singular food name with NO counts or articles ("roti", "boiled egg", "dal", "banana", "masala dosa").
  • quantity = your best estimate of servings/pieces visible (default 1). Two rotis → 2. Half a bowl → 0.5.
  • unit = "piece", "bowl", "plate", "glass", "cup", or "slice" if obvious, else "".
- Estimate portions from what is visible. Prefer common Indian foods where applicable.
- Never invent foods that are not visible.`;

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    const body = await req.json();
    const image = typeof body.image === "string" ? body.image : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "image/jpeg";
    const correction = typeof body.correction === "string" ? body.correction.trim() : "";
    const { userId, accessToken } = body;

    if (!userId || !accessToken)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!image)
      return NextResponse.json({ error: "No image provided." }, { status: 400 });

    // ── 1. Vision extraction (deterministic) ──────────────────────────────────
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
      },
    });

    const prompt = correction
      ? `${INSTRUCTIONS}\n\nThe user is correcting your reading of this SAME photo. Apply their instruction and re-list the final foods: "${correction}"`
      : INSTRUCTIONS;

    let parsed;
    let usage;
    try {
      const result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType, data: image } },
      ]);
      usage = result.response?.usageMetadata;
      parsed = JSON.parse(result.response.text());
    } catch (e) {
      console.error("[identify-meal] extraction failed:", e?.message || e);
      return NextResponse.json(
        { error: "Couldn't read that photo. Please try another shot." },
        { status: 200 },
      );
    }

    await recordLlmUsage({ userId, route: "identify-meal", usageMetadata: usage }).catch(() => {});

    if (!parsed?.isFood || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      return NextResponse.json({ isFood: Boolean(parsed?.isFood), items: [], unmatched: [] });
    }

    // ── 2. Build the DB (internal + the user's custom foods) ──────────────────
    const db = getSupabaseForUser(accessToken);
    // Built-in foods + this user's own, with the shared matcher (lib/foodSearch).
    let combined;
    try {
      combined = (await getCatalog(db, userId)).db;
    } catch {
      combined = { ...FLATTENED_DB }; // catalog unavailable — old list still works
    }

    // ── 3. Deterministic matching + macros (NO insert) ────────────────────────
    const now = new Date();
    const finalMeal = (MEAL_LABELS.includes(body.meal) && body.meal) || defaultMeal(now);
    const clientDate =
      typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : now.toISOString().slice(0, 10);

    const { rows, matched, unmatched } = buildLogRows(parsed.items, combined, {
      userId,
      meal: finalMeal,
      date: clientDate,
      createdAt: now.toISOString(),
    });

    // Return display-ready items with FINAL macros (already qty-multiplied).
    const items = rows.map((r) => ({
      name: r.name,
      qty: r.qty,
      food_id: r.food_id,
      portion: r.portion,
      amount: r.amount,
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fats: r.fats,
      fiber: r.fiber,
    }));
    const totals = matched.reduce(
      (s, m) => ({ calories: s.calories + (m.calories || 0), protein: Math.round((s.protein + (m.protein || 0)) * 10) / 10 }),
      { calories: 0, protein: 0 },
    );

    return NextResponse.json({ isFood: true, items, unmatched, totals });
  } catch (err) {
    console.error("[identify-meal] error:", err?.message || err);
    return NextResponse.json({ error: "Meal identification failed." }, { status: 500 });
  }
}
