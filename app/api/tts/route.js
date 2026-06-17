import { NextResponse } from "next/server";

const MAX_TEXT_CHARS = 1600;

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawText = typeof body?.text === "string" ? body.text : "";
    const voiceName = typeof body?.voiceName === "string" && body.voiceName.trim()
      ? body.voiceName.trim()
      : "Kore";

    const text = rawText.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing" }, { status: 500 });
    }

    const model = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    };

    const ttsResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const ttsData = await ttsResponse.json().catch(() => ({}));
    if (!ttsResponse.ok) {
      console.error("[tts] Gemini TTS error", ttsData?.error || ttsData);
      return NextResponse.json({
        error: "Gemini TTS failed",
        detail: ttsData?.error?.message || `HTTP ${ttsResponse.status}`,
      }, { status: 502 });
    }

    const parts = ttsData?.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find((p) => p?.inlineData?.data);
    const audioBase64 = audioPart?.inlineData?.data;
    const mimeType = audioPart?.inlineData?.mimeType || "audio/wav";

    if (!audioBase64) {
      console.error("[tts] Missing audio in Gemini response", ttsData);
      return NextResponse.json({
        error: "No audio returned from Gemini TTS",
      }, { status: 502 });
    }

    return NextResponse.json({
      audioBase64,
      mimeType,
      voiceName,
      model,
    });
  } catch (err) {
    console.error("[tts] route error", err?.message || err);
    return NextResponse.json({
      error: "TTS route failed",
      detail: err?.message || "unknown error",
    }, { status: 500 });
  }
}
