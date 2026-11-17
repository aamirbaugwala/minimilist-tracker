/**
 * POST /api/voice-log
 *
 * Deterministic voice food-logging. The old flow sent the transcript to the
 * general agent, which had to fire log_food_item once per food inside a 5-round
 * tool loop — so it double-logged or logged nothing. Here the LLM does ONE job:
 * a single structured-JSON extraction of { intent, items[] }. Everything after
 * (matching, de-duping, inserting, phrasing) is plain code in lib/voiceLog.js.
 *
 * Returns:
 *   { intent: "log",      spokenReply, logged[], unmatched[], totals, meal }
 *   { intent: "question", }   → client should hand the transcript to /api/agent
 *   { intent: "none",     spokenReply }
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { FLATTENED_DB } from "../../food-data";
import { defaultMeal, MEALS } from "../../lib/mealPeriod";
import { buildLogRows, buildSpokenConfirmation } from "../../lib/voiceLog";
import { recordLlmUsage } from "../../lib/llmCost";
import { insertFoodLogs } from "../../lib/foodLogInsert";

function getSupabaseForUser(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  );
}

const MEAL_LABELS = MEALS.map((m) => m.label);

const EXTRACTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: { type: "STRING", enum: ["log", "question", "none"] },
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
    // Plain string (no enum): Gemini rejects an empty-string enum member, and
    // the server validates the value against MEAL_LABELS anyway.
    meal: { type: "STRING" },
  },
  required: ["intent", "items"],
};

const EXTRACTION_INSTRUCTIONS = `You convert a user's spoken sentence in a nutrition app into structured JSON. Return ONLY JSON matching the schema.

Classify intent:
- "log": the user is saying what they ate/drank, or asking to log/add food. List every DISTINCT food or drink.
- "question": the user is asking something (calories left, what should I eat, how am I doing, my weight, my streak, etc.). items must be [].
- "none": a greeting or something unrelated to food/nutrition. items must be [].

Rules for items (only when intent is "log"):
- One entry per distinct food/drink. Split "rice and dal" into two entries.
- quantity = number of servings/pieces, default 1. "two rotis" → 2. "half a bowl of rice" → 0.5. "a dozen almonds" → 12.
- name = a short, singular food name with NO counts or articles ("roti", "boiled egg", "banana", "masala dosa").
- unit = the spoken unit if any ("piece","bowl","glass","plate","cup","slice"), else "".
- NEVER invent a food the user did not clearly mention. If unsure, leave items empty and set intent to "question".

If the user names a meal (breakfast / lunch / snack / dinner), set meal to that (capitalised, "Snacks" for snack); otherwise meal = "".`;

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    const body = await req.json();
    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    const { userId, accessToken } = body;
    const mealHint = typeof body.meal === "string" ? body.meal : "";

    if (!userId || !accessToken)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!transcript)
      return NextResponse.json({ error: "Empty transcript." }, { status: 400 });
    if (transcript.length > 1000)
      return NextResponse.json({ error: "Transcript too long." }, { status: 400 });

    // ── 1. Structured extraction (single deterministic call) ──────────────────
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_SCHEMA,
      },
    });

    let parsed;
    let usage;
    try {
      const result = await model.generateContent(
        `${EXTRACTION_INSTRUCTIONS}\n\nTranscript: "${transcript}"`,
      );
      usage = result.response?.usageMetadata;
      parsed = JSON.parse(result.response.text());
    } catch (e) {
      console.error("[voice-log] extraction failed:", e?.message || e);
      return NextResponse.json(
        { intent: "none", spokenReply: "Sorry, I couldn't understand that. Could you say it again?" },
        { status: 200 },
      );
    }

    // Fire-and-forget cost tracking (awaited: serverless may freeze on return).
    await recordLlmUsage({ userId, route: "voice-log", usageMetadata: usage }).catch(() => {});

    const intent = parsed?.intent || "none";

    // Questions go to the full agent (client re-sends to /api/agent).
    if (intent === "question") {
      return NextResponse.json({ intent: "question" });
    }
    if (intent !== "log" || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      return NextResponse.json({
        intent: "none",
        spokenReply:
          "I can log your food or answer nutrition questions. Try saying what you ate — like “I had two eggs and a banana.”",
      });
    }

    // ── 2. Build the DB (internal + the user's custom foods) ──────────────────
    const db = getSupabaseForUser(accessToken);
    const combined = { ...FLATTENED_DB };
    try {
      const { data: custom } = await db
        .from("custom_foods")
        .select("name, calories, protein, carbs, fats, fiber")
        .eq("user_id", userId);
      (custom || []).forEach((c) => {
        if (c?.name) combined[c.name.toLowerCase()] = c;
      });
    } catch {
      /* custom foods are a bonus — internal DB still works */
    }

    // ── 3. Deterministic matching + rows ──────────────────────────────────────
    const now = new Date();
    const finalMeal =
      (MEAL_LABELS.includes(parsed.meal) && parsed.meal) ||
      (MEAL_LABELS.includes(mealHint) && mealHint) ||
      defaultMeal(now);

    // Prefer the client's LOCAL calendar day (sent by the voice page) so a log
    // made after local midnight but before UTC midnight lands on the right day.
    const clientDate = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
    const { rows, matched, unmatched } = buildLogRows(parsed.items, combined, {
      userId,
      meal: finalMeal,
      date: clientDate || now.toISOString().slice(0, 10),
      created_at: now.toISOString(),
    });

    // ── 4. Insert (resilient to the meal column not being migrated yet) ───────
    // Ids are assigned here so the client can offer an exact Undo.
    rows.forEach((r) => {
      r.id = crypto.randomUUID();
      r.source = "voice";
    });
    let logged = matched;
    if (rows.length) {
      const error = await insertFoodLogs(db, rows);
      if (error) {
        console.error("[voice-log] insert failed:", error.message);
        return NextResponse.json(
          { intent: "log", logged: [], unmatched, spokenReply: "I couldn't save that just now — please try again." },
          { status: 200 },
        );
      }
    } else {
      logged = [];
    }

    // ── 5. Deterministic confirmation ─────────────────────────────────────────
    const totals = matched.reduce(
      (s, m) => ({ calories: s.calories + (m.calories || 0), protein: Math.round((s.protein + (m.protein || 0)) * 10) / 10 }),
      { calories: 0, protein: 0 },
    );

    return NextResponse.json({
      intent: "log",
      meal: finalMeal,
      logged,
      ids: logged.length ? rows.map((r) => r.id) : [],
      unmatched,
      totals,
      spokenReply: buildSpokenConfirmation(matched, unmatched),
    });
  } catch (err) {
    console.error("[voice-log] error:", err?.message || err);
    return NextResponse.json({ error: "Voice logging failed." }, { status: 500 });
  }
}
