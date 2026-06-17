import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const { audioBase64, mimeType } = await req.json();
    if (!audioBase64 || !mimeType) {
      return Response.json({ text: "" }, { status: 400 });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ text: "" }, { status: 500 });

    const genAI  = new GoogleGenerativeAI(apiKey);
    const model  = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    // Strip codec params — Gemini wants clean MIME e.g. "audio/mp4" not "audio/mp4;codecs=…"
    const cleanMime = mimeType.split(";")[0].trim();

    const result = await model.generateContent([
      { inlineData: { data: audioBase64, mimeType: cleanMime } },
      "Transcribe exactly what is spoken in this audio clip. Return ONLY the spoken words with no commentary or formatting. If nothing intelligible is spoken, return an empty string.",
    ]);
    const text = result.response.text().trim();
    return Response.json({ text });
  } catch (err) {
    console.error("[transcribe]", err?.message ?? err);
    return Response.json({ text: "" }, { status: 500 });
  }
}
