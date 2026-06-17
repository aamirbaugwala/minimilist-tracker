# Voice Audio Debug Guide (iOS / PWA)

## What changed

The voice page now uses two output paths:

1. Server TTS (preferred): Calls `/api/tts` and plays returned audio.
2. Browser TTS fallback: Uses `window.speechSynthesis` only if server TTS fails.

This improves reliability on iOS Chrome and PWAs where browser-native speech can be inconsistent.

## Required runtime conditions

- Use HTTPS in production.
- For local network testing on iPhone, use HTTPS tunnel/proxy (not plain `http://192.168.x.x`).
- `GEMINI_API_KEY` must be set for `/api/tts`.

## Quick test flow

1. Open `/voice?debug=1`.
2. Tap `DEBUG` and click `Test TTS`.
3. Confirm logs show:
   - `Server TTS request started`
   - `Server TTS audio ready`
   - `Server TTS playback started`

If server TTS fails, debug logs show the reason and browser TTS fallback is attempted.
