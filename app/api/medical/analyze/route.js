/**
 * SUPABASE TABLE — run this SQL once in Supabase SQL editor:
 *
 * create table medical_reports (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references auth.users not null,
 *   file_name text not null,
 *   analysis text not null,           -- full AI analysis text
 *   include_foods jsonb default '[]', -- [{ food, reason }]
 *   exclude_foods jsonb default '[]', -- [{ food, reason }]
 *   flags jsonb default '[]',         -- [{ marker, value, status, note }]
 *   created_at timestamptz default now()
 * );
 * alter table medical_reports enable row level security;
 * create policy "Users manage own reports" on medical_reports
 *   using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 * IMPORTANT — file size:
 * Gemini inline base64 supports up to ~20MB PDFs. For production,
 * use Gemini File API (upload first, then reference by URI) for larger files.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseForUser(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}

// Max PDF size: 10MB (base64 encoded ~13.3MB, well within Gemini's 20MB inline limit)
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file");
    const userId = formData.get("userId");
    const accessToken = formData.get("accessToken");

    if (!userId || !accessToken)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!file || !(file instanceof Blob))
      return NextResponse.json({ error: "No PDF file provided." }, { status: 400 });
    if (file.type !== "application/pdf")
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
    if (file.size > MAX_FILE_BYTES)
      return NextResponse.json({ error: "PDF too large. Maximum size is 10MB." }, { status: 400 });

    // Convert file to base64 for Gemini inline data
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    const db = getSupabaseForUser(accessToken);
    const genAI = new GoogleGenerativeAI(apiKey);
    // gemini-3-flash-preview supports PDF inline natively
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const systemPrompt = `You are a clinical dietitian and medical nutrition expert.
You have been given a patient's medical report (blood test, lipid panel, thyroid, HbA1c, etc.).

Analyse the report carefully and return ONLY a valid JSON object — no markdown, no code fences, no explanation.

JSON schema (follow exactly):
{
  "summary": "2-3 sentence plain-English summary of key findings",
  "flags": [
    {
      "marker": "e.g. HbA1c",
      "value": "e.g. 7.2%",
      "status": "high | low | normal | borderline",
      "note": "Brief clinical significance"
    }
  ],
  "include_foods": [
    {
      "food": "e.g. oats, salmon, methi (fenugreek)",
      "reason": "Why this food helps based on the report findings"
    }
  ],
  "exclude_foods": [
    {
      "food": "e.g. refined sugar, white rice",
      "reason": "Why to avoid based on the report findings"
    }
  ],
  "analysis": "Detailed 200-300 word dietary analysis referencing specific values found in the report. Be specific — mention actual numbers. Include meal timing advice if relevant.",
  "disclaimer": "This analysis is for informational purposes only and does not replace advice from a qualified physician or registered dietitian."
}

Rules:
- Only flag markers that are actually present in the document.
- If a value is within normal range, still include it in flags with status "normal".
- include_foods and exclude_foods must be grounded in the actual findings — not generic advice.
- Prefer common Indian foods where applicable.
- If the document is NOT a medical report, return: { "error": "This does not appear to be a medical report." }`;

    const result = await model.generateContent([
      { text: systemPrompt },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64Data,
        },
      },
    ]);

    const raw = result.response.text().trim();
    const jsonStr = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Gemini returned non-JSON for medical report:", raw);
      return NextResponse.json(
        { error: "AI could not parse the report. Please ensure the PDF is a readable medical document." },
        { status: 500 }
      );
    }

    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Save analysis to Supabase
    const { data: saved, error: dbError } = await db
      .from("medical_reports")
      .insert({
        user_id: userId,
        file_name: file.name || "report.pdf",
        analysis: parsed.analysis || "",
        include_foods: parsed.include_foods || [],
        exclude_foods: parsed.exclude_foods || [],
        flags: parsed.flags || [],
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB error saving report:", dbError);
      // Still return the analysis — don't lose the work
      return NextResponse.json({
        report: { ...parsed, id: null, file_name: file.name, created_at: new Date().toISOString() },
        saved: false,
        warning: "Analysis complete but could not be saved to history.",
      });
    }

    return NextResponse.json({
      report: { ...parsed, ...saved },
      saved: true,
    });
  } catch (error) {
    console.error("Medical analysis error:", error);
    return NextResponse.json({ error: "Analysis failed: " + error.message }, { status: 500 });
  }
}
