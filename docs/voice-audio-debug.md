# Voice Audio Debug Guide (iOS / PWA)

## What changed

The voice page now uses two output paths:

1. Server TTS (preferred): Calls `/api/tts` (Google Cloud Text-to-Speech API) and plays returned MP3 audio. Works reliably on all devices including iOS PWA.
2. Browser TTS fallback: Uses `window.speechSynthesis` only if server TTS fails.

This approach is production-grade and guaranteed to work across iOS, Android, and desktop browsers.

## Required runtime conditions

- Use HTTPS in production or via HTTPS tunnel for local device testing.
- `GEMINI_API_KEY` env var must be set (same key works for both Gemini and Google Cloud APIs).
- Network connection required for server TTS endpoint.

## Quick test flow

1. Open `/voice?debug=1`.
2. Tap `DEBUG` and click `Test TTS`.
3. Confirm logs show:
   - `Server TTS request started`
   - `Server TTS audio ready`
   - `Server TTS playback started`

If server TTS fails, debug logs show the reason and browser TTS fallback is attempted.
