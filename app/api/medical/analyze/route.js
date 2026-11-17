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
 *   trends jsonb default '[]',        -- [{ marker, direction, previous, current, note }]
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
import { cacheInvalidate } from "../../../lib/agentCache";
import { recordLlmUsage } from "../../../lib/llmCost";
import { jpegsToPdf } from "../../../lib/jpegPdf";

function getSupabaseForUser(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}

// Max upload: 10MB in total (base64 ~13.3MB, within Gemini's 20MB inline limit)
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 5;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    // Parse multipart form data. Either ONE PDF, or 1–5 photos of the pages of
    // ONE report (the client compresses them to JPEG), read together in order.
    const formData = await req.formData();
    const files = formData.getAll("file").filter((f) => f instanceof Blob);
    const userId = formData.get("userId");
    const accessToken = formData.get("accessToken");

    if (!userId || !accessToken)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!files.length)
      return NextResponse.json({ error: "No report file provided." }, { status: 400 });

    const isPdf = files.length === 1 && files[0].type === "application/pdf";
    const isPhotos = files.every((f) => IMAGE_TYPES.includes(f.type));
    if (!isPdf && !isPhotos)
      return NextResponse.json({ error: "Send one PDF, or photos (JPEG/PNG) of the report’s pages." }, { status: 400 });
    if (isPhotos && files.length > MAX_PHOTOS)
      return NextResponse.json({ error: `Up to ${MAX_PHOTOS} photos per report.` }, { status: 400 });
    const totalBytes = files.reduce((n, f) => n + f.size, 0);
    if (totalBytes > MAX_FILE_BYTES)
      return NextResponse.json({ error: "Report too large. Maximum is 10 MB." }, { status: 400 });

    // Bytes + base64 for Gemini inline data, in page order.
    const pages = await Promise.all(
      files.map(async (f) => {
        const bytes = new Uint8Array(await f.arrayBuffer());
        return { mimeType: f.type, bytes, base64: Buffer.from(bytes).toString("base64") };
      }),
    );
    const fileName = isPdf
      ? files[0].name || "report.pdf"
      : `Photo report (${files.length} page${files.length === 1 ? "" : "s"})`;

    const db = getSupabaseForUser(accessToken);

    // ── Fetch ALL historical reports for longitudinal context ─────────────
    const { data: pastReports } = await db
      .from("medical_reports")
      .select("file_name, report_date, created_at, flags, analysis")
      .eq("user_id", userId)
      .order("report_date", { ascending: false, nullsFirst: false });

    const hasHistory = pastReports && pastReports.length > 0;

    const historicalContext = hasHistory
      ? `\n\nHISTORICAL REPORTS (most recent first — use these to identify trends):\n${
          pastReports.map((r, i) => {
            const dateLabel = r.report_date
              ? new Date(r.report_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
              : new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
            return `
Report ${i + 1} — ${r.file_name} (${dateLabel}):
Markers: ${JSON.stringify(r.flags)}
Summary: ${r.analysis?.slice(0, 300)}…`;
          }).join("\n")
        }`
      : "";

    const genAI = new GoogleGenerativeAI(apiKey);
    // gemini-3-flash-preview supports PDF inline natively
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const systemPrompt = `You are a clinical dietitian and medical nutrition expert.
You have been given a patient's medical report (blood test, lipid panel, thyroid, HbA1c, etc.).${historicalContext}

Analyse the report carefully and return ONLY a valid JSON object — no markdown, no code fences, no explanation.

JSON schema (follow exactly):
{
  "report_date": "ISO date string (YYYY-MM-DD) of the date the report was ISSUED or COLLECTED, as stated in the document itself. Look for fields like 'Report Date', 'Collection Date', 'Date of Test', 'Received Date', 'Sample Date'. If multiple dates exist, prefer the collection/sample date. If no date is found in the document, return null.",
  "summary": "2-3 sentence plain-English summary of key findings",
  "flags": [
    {
      "marker": "e.g. HbA1c",
      "value": "e.g. 7.2%",
      "status": "high | low | normal | borderline",
      "note": "Brief clinical significance"
    }
  ],
  "trends": [
    {
      "marker": "e.g. HbA1c",
      "direction": "improving | worsening | stable",
      "previous": "e.g. 7.2% (Jan 2026)",
      "current": "e.g. 6.8%",
      "note": "Brief interpretation of the change"
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
  "analysis": "Detailed 200-300 word dietary analysis referencing specific values found in the report. If historical data is available, explicitly comment on trajectory (improving/worsening). Be specific — mention actual numbers. Include meal timing advice if relevant.",
  "disclaimer": "This analysis is for informational purposes only and does not replace advice from a qualified physician or registered dietitian."
}

Rules:
- Only flag markers that are actually present in the document.
- If a value is within normal range, still include it in flags with status "normal".
- "trends" array: only populate if historical report data was provided above. Compare the same markers across reports. If no history exists, return "trends": [].
- include_foods and exclude_foods must be grounded in the actual findings — not generic advice.
- Prefer common Indian foods where applicable.
- CRITICAL: "report_date" must come from text inside the document, not today's date.
- If the document is NOT a medical report, return: { "error": "This does not appear to be a medical report." }`;

    const photoNote = isPhotos
      ? `\n\nThe report is given as ${pages.length} photo${pages.length === 1 ? "" : "s"} of its pages, in order. Treat them as ONE report. If a value is blurred or cut off, leave that marker out rather than guessing. If the photos are too unclear to read, return: { "error": "The photos are too blurry to read. Retake them in good light, flat and in focus." }`
      : "";

    const result = await model.generateContent([
      { text: systemPrompt + photoNote },
      ...pages.map((pg) => ({ inlineData: { mimeType: pg.mimeType, data: pg.base64 } })),
    ]);

    const raw = result.response.text().trim();
    // Persist what this call cost. Awaited: serverless can freeze as soon as
    // the response returns, which would drop a fire-and-forget insert.
    await recordLlmUsage({
      userId,
      route: "medical",
      usageMetadata: result.response?.usageMetadata,
    });
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
        { error: isPhotos ? "Couldn’t read the report from these photos. Retake them flat, in good light." : "Couldn’t read the report. Make sure the PDF is a readable medical document." },
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
        file_name: fileName,
        report_date: parsed.report_date || null,
        analysis: parsed.analysis || "",
        include_foods: parsed.include_foods || [],
        exclude_foods: parsed.exclude_foods || [],
        flags: parsed.flags || [],
        trends: parsed.trends || [],
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB error saving report:", dbError);
      // Still return the analysis — don't lose the work
      return NextResponse.json({
        report: { ...parsed, id: null, file_name: fileName, report_date: parsed.report_date || null, created_at: new Date().toISOString() },
        saved: false,
        warning: "Analysis complete but could not be saved to history.",
      });
    }

    // ── Store the ORIGINAL PDF in the private vault ─────────────────────────
    // Best-effort: the analysis is already persisted, so a storage hiccup must
    // not fail the request. Path is namespaced by user so RLS keeps it private.
    // Photos are stored as one PDF (JPEG pages embedded as-is) so "Original
    // PDF" works the same for both; non-JPEG photos are skipped (rare).
    let fileUrl = null;
    const storagePath = `${userId}/${saved.id}.pdf`;
    let pdfBytes = null;
    try {
      pdfBytes = isPdf ? pages[0].bytes : pages.every((pg) => pg.mimeType === "image/jpeg") ? jpegsToPdf(pages.map((pg) => pg.bytes)) : null;
    } catch (e) {
      console.error("Photo → PDF failed:", e.message);
    }
    try {
      if (!pdfBytes) throw new Error("no storable original");
      const { error: upErr } = await db.storage
        .from("medical-reports")
        .upload(storagePath, Buffer.from(pdfBytes), {
          contentType: "application/pdf",
          upsert: true,
        });
      if (upErr) {
        console.error("Vault upload failed:", upErr.message);
      } else {
        await db
          .from("medical_reports")
          .update({ file_path: storagePath, file_size: pdfBytes.length })
          .eq("id", saved.id);
        saved.file_path = storagePath;
        saved.file_size = pdfBytes.length;
        const { data: signed } = await db.storage
          .from("medical-reports")
          .createSignedUrl(storagePath, 60 * 60); // 1 hour
        fileUrl = signed?.signedUrl || null;
      }
    } catch (e) {
      console.error("Vault upload exception:", e.message);
    }

    // New report saved — bust the medical context cache so agent fetches fresh data
    cacheInvalidate(userId, "get_medical_context");

    return NextResponse.json({
      report: { ...parsed, ...saved, file_url: fileUrl },
      saved: true,
    });
  } catch (error) {
    console.error("Medical analysis error:", error);
    return NextResponse.json({ error: "Analysis failed: " + error.message }, { status: 500 });
  }
}
