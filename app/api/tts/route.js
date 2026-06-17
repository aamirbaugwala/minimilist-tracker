import { NextResponse } from "next/server";

const MAX_TEXT_CHARS = 1600;

export async function POST(req) {
  try {
    // 1. Safe body parsing
    const body = await req.json().catch(() => ({}));
    const rawText = typeof body?.text === "string" ? body.text : "";

    // Normalize spacing and enforce character limit
    const text = rawText.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // FIX: Must be a Google Cloud Platform API Key, NOT a Gemini/AI Studio key
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GOOGLE_CLOUD_API_KEY is missing" }, { status: 500 });
    }

    const endpoint = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      input: { text },
      voice: {
        languageCode: "en-IN",
        name: "en-IN-Neural2-B", 
      },
      audioConfig: {
        audioEncoding: "MP3", 
        pitch: 0,
        speakingRate: 1,
      },
    };

    const ttsResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // 2. Safe error payload tracking
    let ttsData;
    try {
      ttsData = await ttsResponse.json();
    } catch {
      ttsData = null;
    }

    if (!ttsResponse.ok) {
      console.error("[tts] Google Cloud TTS error status:", ttsResponse.status, ttsData);
      return NextResponse.json({
        error: "Google Cloud TTS failed",
        detail: ttsData?.error?.message || `HTTP ${ttsResponse.status}`,
      }, { status: 502 });
    }

    const audioBase64 = ttsData?.audioContent;
    if (!audioBase64) {
      console.error("[tts] Missing audioContent in response", ttsData);
      return NextResponse.json({
        error: "No audio returned from TTS",
      }, { status: 502 });
    }

    // 3. Return payload to frontend
    return NextResponse.json({
      audioBase64,
      mimeType: "audio/mpeg",
      voiceName: "en-IN-Neural2-B",
    });

  } catch (err) {
    console.error("[tts] route error", err?.message || err);
    return NextResponse.json({
      error: "TTS route failed",
      detail: err?.message || "unknown error",
    }, { status: 500 });
  }
}
