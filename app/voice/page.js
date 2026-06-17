"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import { ArrowLeft } from "lucide-react";

// States
// IDLE      → tap orb → RECORDING
// RECORDING → tap orb → THINKING  (send transcript to AI)
// THINKING  → AI streaming → SPEAKING
// SPEAKING  → TTS finishes or tap → IDLE
const S = { IDLE: "idle", RECORDING: "recording", THINKING: "thinking", SPEAKING: "speaking" };

// ── ANIMATED ORB ──────────────────────────────────────────────────────────────
function VoiceOrb({ stateRef, audioLevelRef, size }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const DPR    = window.devicePixelRatio || 1;
    const PX     = Math.round(size * DPR);
    canvas.width  = PX;
    canvas.height = PX;

    const ctx    = canvas.getContext("2d");
    const W = PX, H = PX, cx = W / 2, cy = H / 2;
    const BASE_R = Math.min(W, H) * 0.30;

    // recording reuses the "listening" look (red, spiky)
    const PALETTE = {
      idle:      { core: "#4f46e5", mid: "#1e1b4b", glow: "#6366f1" },
      recording: { core: "#dc2626", mid: "#3b0000", glow: "#ef4444" },
      thinking:  { core: "#d97706", mid: "#451a03", glow: "#f59e0b" },
      speaking:  { core: "#16a34a", mid: "#052e16", glow: "#22c55e" },
    };

    let startTime = null;
    const draw = (ts) => {
      if (!startTime) startTime = ts;
      const t     = (ts - startTime) / 1000;
      const state = stateRef.current      || "idle";
      const level = audioLevelRef.current || 0;
      const pal   = PALETTE[state]         || PALETTE.idle;

      ctx.clearRect(0, 0, W, H);

      // Glow halos
      for (let i = 3; i >= 1; i--) {
        const ringR = BASE_R * (1 + i * 0.55);
        const alpha = Math.round((0.10 / i) * 255).toString(16).padStart(2, "0");
        const g     = ctx.createRadialGradient(cx, cy, BASE_R * 0.2, cx, cy, ringR);
        g.addColorStop(0, pal.glow + "00");
        g.addColorStop(1, pal.glow + alpha);
        ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
      }

      // Organic blob
      const N = 100, pts = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        let r = BASE_R;
        if (state === "idle") {
          r += Math.sin(t * 1.2 + a * 2) * BASE_R * 0.05 + Math.sin(t * 0.7) * BASE_R * 0.06;
        } else if (state === "recording") {
          const amp = Math.max(level * 2.5, 0.35);
          r += Math.sin(a * 5 + t * 5)   * BASE_R * 0.24 * amp
             + Math.sin(a * 8 - t * 3.5) * BASE_R * 0.12 * amp
             + Math.sin(t * 3)            * BASE_R * 0.04;
        } else if (state === "thinking") {
          r += Math.sin(a * 4 + t * 6) * BASE_R * 0.11 + Math.sin(a * 9 - t * 5) * BASE_R * 0.06;
        } else if (state === "speaking") {
          r += Math.sin(a * 3 + t * 8) * BASE_R * 0.20 + Math.cos(a * 6 - t * 6) * BASE_R * 0.10;
        }
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      ctx.beginPath();
      ctx.moveTo((pts[0].x + pts[N - 1].x) / 2, (pts[0].y + pts[N - 1].y) / 2);
      for (let i = 0; i < N; i++) {
        const p0 = pts[i], p1 = pts[(i + 1) % N];
        ctx.quadraticCurveTo(p0.x, p0.y, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
      }
      ctx.closePath();

      const fill = ctx.createRadialGradient(cx - BASE_R * 0.22, cy - BASE_R * 0.28, 0, cx, cy, BASE_R * 1.1);
      fill.addColorStop(0,   pal.core + "ff");
      fill.addColorStop(0.5, pal.core + "dd");
      fill.addColorStop(1,   pal.mid  + "cc");
      ctx.shadowBlur = 50; ctx.shadowColor = pal.glow;
      ctx.fillStyle = fill; ctx.fill(); ctx.shadowBlur = 0;

      const shine = ctx.createRadialGradient(cx - BASE_R * 0.30, cy - BASE_R * 0.32, 0, cx - BASE_R * 0.12, cy - BASE_R * 0.12, BASE_R * 0.60);
      shine.addColorStop(0, "rgba(255,255,255,0.32)"); shine.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = shine; ctx.fill();

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvasRef} style={{ display: "block", width: size, height: size, pointerEvents: "none", touchAction: "none" }} />;
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function VoicePage() {
  const router = useRouter();

  const [voiceState,  setVoiceState]  = useState(S.IDLE);
  const [error,       setError]       = useState("");
  const [orbSize,     setOrbSize]     = useState(240);
  const [debugOpen,   setDebugOpen]   = useState(false);
  const [debugLogs,   setDebugLogs]   = useState([]);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const voiceStateRef    = useRef(S.IDLE);
  const orbStateRef      = useRef(S.IDLE);
  const sessionRef       = useRef(null);
  const speechUnlockedRef = useRef(false);
  const audioPlaybackRef = useRef(null);
  const audioUrlRef      = useRef("");

  const addDebugLog = useCallback((message) => {
    const now = new Date();
    const stamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    setDebugLogs((prev) => {
      const next = [...prev, `${stamp} ${message}`];
      return next.length > 80 ? next.slice(next.length - 80) : next;
    });
  }, []);

  const unlockSpeech = useCallback(() => {
    if (speechUnlockedRef.current || !("speechSynthesis" in window)) return;
    try {
      const synth = window.speechSynthesis;
      const warmup = new SpeechSynthesisUtterance(" ");
      warmup.volume = 0;
      warmup.rate = 1;
      warmup.pitch = 1;
      synth.cancel();
      synth.speak(warmup);
      synth.cancel();
      speechUnlockedRef.current = true;
      addDebugLog("TTS unlocked by user gesture");
    } catch (e) {
      addDebugLog(`TTS unlock failed: ${e?.message || "unknown"}`);
    }
  }, [addDebugLog]);

  // MediaRecorder (all platforms)
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const micStreamRef     = useRef(null); // kept alive for session

  // Audio level visualisation
  const audioCtxRef      = useRef(null);
  const animFrameRef     = useRef(null);
  const orbLevelRef      = useRef(0);

  // Sync React state + orb ref atomically
  const setVS = useCallback((s) => {
    voiceStateRef.current = s;
    orbStateRef.current   = s;
    setVoiceState(s);
  }, []);

  // ── Responsive orb ────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => setOrbSize(Math.round(Math.min(Math.min(window.innerWidth, window.innerHeight) * 0.50, 250)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) { router.replace("/"); return; }
      sessionRef.current = s;
    });
  }, [router]);

  // ── Debug diagnostics (important for iOS/PWA) ─────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") setDebugOpen(true);

    const logRuntime = () => {
      const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone;
      const voicesCount = window.speechSynthesis?.getVoices?.().length ?? 0;
      addDebugLog(`Runtime: secure=${window.isSecureContext} standalone=${Boolean(standalone)} media=${Boolean(navigator.mediaDevices?.getUserMedia)} speech=${Boolean(window.speechSynthesis)} voices=${voicesCount}`);
      addDebugLog(`UA: ${navigator.userAgent}`);
    };

    logRuntime();
    document.addEventListener("visibilitychange", logRuntime);
    return () => document.removeEventListener("visibilitychange", logRuntime);
  }, [addDebugLog]);

  // ── Audio level monitor ───────────────────────────────────────────────────
  const startAudioMonitor = useCallback((stream) => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC(); audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        orbLevelRef.current  = buf.reduce((a, b) => a + b, 0) / buf.length / 128;
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      addDebugLog("Audio monitor failed to start");
    }
  }, [addDebugLog]);

  const stopAudioMonitor = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    try { audioCtxRef.current?.close(); } catch {}
    orbLevelRef.current = 0;
  }, []);

  // ── Release mic stream ────────────────────────────────────────────────────
  const stopMic = useCallback(() => {
    stopAudioMonitor();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
  }, [stopAudioMonitor]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    try {
      audioPlaybackRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    } catch {}
    stopMic();
    window.speechSynthesis?.cancel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Server TTS playback (cross-device fallback) ──────────────────────────
  const speakViaServerAudio = useCallback(async (text) => {
    try {
      addDebugLog(`Server TTS request started (${text.length} chars)`);
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceName: "Kore" }),
      });

      const payload = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(payload?.detail || payload?.error || `HTTP ${r.status}`);
      }

      const audioBase64 = payload?.audioBase64;
      const mimeType = payload?.mimeType || "audio/wav";
      if (!audioBase64) throw new Error("No audio payload returned");

      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const blob = new Blob([bytes], { type: mimeType });
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const objectUrl = URL.createObjectURL(blob);
      audioUrlRef.current = objectUrl;

      let audio = audioPlaybackRef.current;
      if (!audio) {
        audio = new Audio();
        audio.preload = "auto";
        audio.playsInline = true;
        audioPlaybackRef.current = audio;
      }

      audio.src = objectUrl;
      audio.volume = 1;
      setVS(S.SPEAKING);
      addDebugLog(`Server TTS audio ready (${mimeType}, ${blob.size} bytes)`);

      await audio.play();
      addDebugLog("Server TTS playback started");

      await new Promise((resolve, reject) => {
        const onEnd = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error("audio playback error"));
        };
        const cleanup = () => {
          audio.onended = null;
          audio.onerror = null;
        };
        audio.onended = onEnd;
        audio.onerror = onError;
      });

      addDebugLog("Server TTS playback ended");
      setError("");
      setVS(S.IDLE);
      return true;
    } catch (e) {
      addDebugLog(`Server TTS failed: ${e?.message || "unknown"}`);
      return false;
    }
  }, [addDebugLog, setVS]);

  // ── TTS: speak AI response, then return to IDLE ───────────────────────────
  const speakResponse = useCallback(async (fullText) => {
    if (!fullText.trim()) {
      addDebugLog("Skipping TTS: empty text");
      setVS(S.IDLE);
      return;
    }

    // Strip markdown so TTS reads cleanly.
    const clean = fullText
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/[•\-]\s/g, "")
      .replace(/#{1,6}\s/g, "")
      .trim();

    // Prefer server-generated audio for consistent playback across devices.
    const serverSpoken = await speakViaServerAudio(clean);
    if (serverSpoken) return;

    if (!("speechSynthesis" in window)) {
      addDebugLog("Skipping browser TTS: speechSynthesis unavailable and server TTS failed");
      setError("Voice output unavailable right now. Please retry when network is stable.");
      setVS(S.IDLE);
      return;
    }

    const sentences = clean.match(/[^.!?\n]+[.!?\n]*/g) || [clean];
    const synth = window.speechSynthesis;
    synth.cancel();
    synth.resume();
    addDebugLog(`TTS start requested (${fullText.length} chars)`);

    // Try to get voices; wait up to 1s if they're loading (Brave workaround).
    const voices = await new Promise((resolve) => {
      const existing = synth.getVoices();
      if (existing.length) {
        console.log("[voice] Voices already loaded:", existing.length);
        addDebugLog(`Voices already loaded: ${existing.length}`);
        return resolve(existing);
      }
      
      let resolved = false;
      // iOS may take longer to load voices - increase timeout to 2s
      const timeoutId = setTimeout(() => {
        resolved = true;
        const voicesFinal = synth.getVoices();
        console.log("[voice] Timeout reached. Voices available:", voicesFinal.length);
        addDebugLog(`Voice load timeout. Voices available: ${voicesFinal.length}`);
        resolve(voicesFinal);
      }, 2000);
      
      synth.onvoiceschanged = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          const voicesLoaded = synth.getVoices();
          console.log("[voice] onvoiceschanged fired. Voices available:", voicesLoaded.length);
          addDebugLog(`onvoiceschanged fired. Voices available: ${voicesLoaded.length}`);
          if (voicesLoaded.length > 0) {
            voicesLoaded.forEach((v, i) => console.log(`  [${i}] ${v.name} (${v.lang})`));
          }
          resolve(voicesLoaded);
        }
      };
    });

    // If no voices available (iOS/Brave limitation), show helpful error
    if (!voices.length) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isBrave = /Brave/.test(navigator.userAgent);
      
      console.error("[voice] No voices found! User agent:", navigator.userAgent.slice(0, 100));
      addDebugLog("No voices found from getVoices(). Using browser default voice fallback.");
      
      if (isIOS) {
        setError("iOS issue: No voices loaded. Try: 1) Reload the app, 2) Check volume isn't muted, 3) Reinstall PWA. Voice may work in Safari app instead.");
      } else if (isBrave) {
        setError("Brave disabled TTS. Try Firefox or Chrome for voice chat.");
      } else {
        setError("TTS unavailable. Check browser voice settings or try a different browser.");
      }
    }

    const preferredVoice = voices.length > 0
      ? (voices.find((voice) => /en(-|_)?(IN|US|GB)?/i.test(voice.lang) && !/google translate/i.test(voice.name))
         || voices.find((voice) => /female|google|microsoft|samantha|alex|zira|david/i.test(voice.name))
         || voices[0])
      : null;

    console.log("[voice] Selected voice:", preferredVoice?.name, "(" + preferredVoice?.lang + ")");
    addDebugLog(`Selected voice: ${preferredVoice?.name || "default"} (${preferredVoice?.lang || "n/a"})`);
    setVS(S.SPEAKING);

    let idx = 0;
    const speakNext = () => {
      if (idx >= sentences.length) {
        setVS(S.IDLE);
        setError(""); // clear any voice warning once done
        return;
      }

      const s = sentences[idx].trim();
      idx++;
      if (!s) { speakNext(); return; }

      const utt = new SpeechSynthesisUtterance(s);
      utt.rate = 1.02;
      utt.pitch = 1.0;
      utt.volume = 1.0;
      if (preferredVoice) {
        utt.voice = preferredVoice;
        utt.lang = preferredVoice.lang || "en-US";
      } else {
        // No voice selection; browser will use default (or fail).
        utt.lang = "en-US";
      }

      let started = false;
      utt.onstart = () => { started = true; setVS(S.SPEAKING); };
      utt.onend   = speakNext;
      utt.onerror = (event) => {
        console.error("[voice] TTS error:", event.error);
        addDebugLog(`TTS error: ${event.error || "unknown"}`);
        if (!started) {
          setError("Text-to-speech failed. Try Firefox or Chrome. Brave requires explicit voice configuration.");
        }
        setVS(S.IDLE);
      };

      synth.speak(utt);
    };

    speakNext();
  }, [setVS, addDebugLog, speakViaServerAudio]);

  // ── Call agent API (streaming), then speak full response ─────────────────
  const sendToAgent = useCallback(async (text) => {
    if (!text?.trim() || !sessionRef.current) return;
    setVS(S.THINKING);
    addDebugLog(`Sending transcript to /api/agent (${text.length} chars)`);

    let fullResponse = "";
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          userId: sessionRef.current.user.id,
          accessToken: sessionRef.current.access_token,
          voiceMode: true,
        }),
      });
      if (!res.ok) throw new Error("api error");
      addDebugLog(`Agent response stream opened: HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuf += decoder.decode(value, { stream: true });
        const lines = sseBuf.split("\n\n"); sseBuf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "chunk") {
              fullResponse += ev.text;
            }
          } catch {}
        }
      }
    } catch {
      addDebugLog("Agent call failed");
      fullResponse = fullResponse || "Sorry, I couldn't reach the server. Please try again.";
    }

    addDebugLog(`Agent reply ready (${fullResponse.length} chars)`);
    await speakResponse(fullResponse);
  }, [setVS, speakResponse, addDebugLog]);

  // ── Acquire mic (shared setup) ────────────────────────────────────────────
  const acquireMic = useCallback(async () => {
    if (micStreamRef.current) return true;

    if (!window.isSecureContext) {
      setError("Microphone requires HTTPS. Open the app on a secure origin (https://) or localhost in development.");
      addDebugLog("Mic blocked: insecure context");
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone API unavailable in this browser. Please open the app in Safari or Chrome with microphone support enabled.");
      addDebugLog("Mic blocked: getUserMedia unavailable");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      startAudioMonitor(stream);
      addDebugLog("Mic acquired successfully");
      return true;
    } catch (e) {
      addDebugLog(`Mic acquire failed: ${e.name || "Error"} ${e.message || ""}`);
      setError(
        e.name === "NotAllowedError"
          ? "Microphone access denied. On iOS: Settings → Safari → Microphone → Allow."
          : "Could not access microphone: " + (e.message || e.name || "unknown error")
      );
      return false;
    }
  }, [startAudioMonitor, addDebugLog]);

  // ── Record audio for later transcription ──────────────────────────────────
  const startRecording = useCallback(async () => {
    if (typeof MediaRecorder === "undefined") {
      setError("Voice recording not supported in this browser. Please use a modern browser with MediaRecorder support.");
      addDebugLog("MediaRecorder unsupported");
      return false;
    }

    const ok = await acquireMic();
    if (!ok) return false;

    const MIME_PREFS = ["audio/mp4", "audio/webm", "audio/ogg"];
    const mimeType   = MIME_PREFS.find((t) => {
      try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
    }) || "";

    let recorder;
    try {
      recorder = new MediaRecorder(micStreamRef.current, mimeType ? { mimeType } : {});
      addDebugLog(`Recorder started with mimeType=${mimeType || "default"}`);
    } catch {
      recorder = new MediaRecorder(micStreamRef.current);
      addDebugLog("Recorder started with browser default mimeType");
    }

    audioChunksRef.current   = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    mediaRecorderRef.current = recorder;
    recorder.start();
    return true;
  }, [acquireMic, addDebugLog]);

  // ── Stop recording + transcribe audio ────────────────────────────────────
  const stopRecordingAndGetText = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return null;

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        const usedMime = recorder.mimeType || "audio/mp4";
        const blob     = new Blob(audioChunksRef.current, { type: usedMime });
        addDebugLog(`Recording stopped. blob=${blob.size} bytes mime=${usedMime}`);
        if (blob.size < 500) { resolve(null); return; }

        const base64 = await new Promise((res) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result.split(",")[1]);
          fr.readAsDataURL(blob);
        });

        try {
          const r    = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: base64, mimeType: usedMime }),
          });
          const data = await r.json();
          addDebugLog(`Transcribe API: HTTP ${r.status}, textLen=${(data.text || "").length}`);
          resolve((data.text || "").trim() || null);
        } catch {
          addDebugLog("Transcribe request failed");
          resolve(null);
        }
      };
      recorder.stop();
    });
  }, [addDebugLog]);

  // ── Orb tap handler ───────────────────────────────────────────────────────
  const handleOrbTap = useCallback(async () => {
    unlockSpeech();
    const s = voiceStateRef.current;

    if (s === S.IDLE) {
      setError("");
      setVS(S.RECORDING);

      const ok = await startRecording();

      if (!ok) setVS(S.IDLE);

    } else if (s === S.RECORDING) {
      setVS(S.THINKING);
      const text = await stopRecordingAndGetText();

      if (!text) {
        addDebugLog("No transcript returned from recording");
        setError("Nothing was captured. Tap the orb, speak, then tap again to send.");
        setVS(S.IDLE);
        return;
      }
      addDebugLog(`Transcript captured (${text.length} chars)`);
      await sendToAgent(text);

    } else if (s === S.SPEAKING) {
      window.speechSynthesis?.cancel();
      setVS(S.IDLE);
    }
    // THINKING: ignore tap
  }, [setVS, startRecording, stopRecordingAndGetText, sendToAgent, unlockSpeech, addDebugLog]);

  // ── End session button ────────────────────────────────────────────────────
  const endSession = useCallback(() => {
    try { mediaRecorderRef.current?.stop(); } catch {}
    try {
      audioPlaybackRef.current?.pause();
      if (audioPlaybackRef.current) audioPlaybackRef.current.currentTime = 0;
    } catch {}
    window.speechSynthesis?.cancel();
    stopMic();
    setVS(S.IDLE);
    addDebugLog("Session ended manually");
  }, [setVS, stopMic, addDebugLog]);

  const runTtsDebug = useCallback(() => {
    unlockSpeech();
    speakResponse("This is a voice output test from your nutrition coach.");
  }, [unlockSpeech, speakResponse]);

  // ── Display helpers ───────────────────────────────────────────────────────
  const orbLabel = {
    idle:      "TAP TO\nSTART",
    recording: "TAP TO\nSEND",
    thinking:  "",
    speaking:  "TAP TO\nSTOP",
  }[voiceState] ?? "";

  const statusText = {
    idle:      "Tap the orb to start recording",
    recording: "Recording… tap orb to send",
    thinking:  "Thinking…",
    speaking:  "Speaking… tap orb to stop",
  }[voiceState];

  const statusColor = {
    idle: "#444", recording: "#ef4444", thinking: "#f59e0b", speaking: "#22c55e",
  }[voiceState];

  const dotPulse  = voiceState !== S.IDLE;
  const statusBadge = { idle: "Ready", recording: "Recording", thinking: "Thinking", speaking: "Speaking" }[voiceState];

  return (
    <div style={{
      height: "100dvh",
      background: "radial-gradient(ellipse at 50% 55%, #0e0e1f 0%, #060609 100%)",
      color: "#fff", display: "flex", flexDirection: "column",
      fontFamily: "system-ui, -apple-system, sans-serif",
      WebkitUserSelect: "none", userSelect: "none",
      WebkitTapHighlightColor: "transparent",
    }}>

      {/* HEADER */}
      <div style={{ padding: "max(env(safe-area-inset-top,0px),14px) 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <button onPointerDown={() => { endSession(); router.back(); }} style={{
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#aaa",
          cursor: "pointer", padding: "8px 14px", borderRadius: 20, display: "flex", alignItems: "center", gap: 7, fontSize: "0.8rem", touchAction: "manipulation",
        }}>
          <ArrowLeft size={15} /> Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 16px", background: "rgba(255,255,255,0.04)", border: `1px solid ${statusColor}44`, borderRadius: 20, fontSize: "0.78rem", color: statusColor, transition: "all 0.3s", minWidth: 100, justifyContent: "center" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, flexShrink: 0, boxShadow: dotPulse ? `0 0 8px ${statusColor}` : "none", animation: dotPulse ? "vp-pulse 1.2s ease-in-out infinite" : "none" }} />
          {statusBadge}
        </div>

        <div style={{ width: 68 }} />
      </div>

      {/* CENTER CONTENT */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 18px max(env(safe-area-inset-bottom,0px),22px)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, width: "100%", maxWidth: 420 }}>
          {/* STATUS LINE */}
          <div style={{
            textAlign: "center", fontSize: "0.82rem", color: statusColor,
            padding: "5px 24px", minHeight: 34, transition: "color 0.3s", flexShrink: 0,
            fontStyle: "normal", lineHeight: 1.4,
          }}>
            {statusText}
          </div>

        <div
          onPointerDown={voiceState === S.THINKING ? undefined : handleOrbTap}
          role="button"
          aria-label={orbLabel}
          style={{
            position: "relative",
            cursor: voiceState === S.THINKING ? "default" : "pointer",
            borderRadius: "50%",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
            userSelect: "none",
            opacity: voiceState === S.THINKING ? 0.82 : 1,
            transition: "opacity 0.2s",
          }}
        >
          <VoiceOrb key={orbSize} stateRef={orbStateRef} audioLevelRef={orbLevelRef} size={orbSize} />

          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            {voiceState === S.THINKING
              ? <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid transparent", borderTopColor: "#f59e0b", animation: "vp-spin 0.9s linear infinite" }} />
              : orbLabel
                ? <span style={{ fontSize: "0.60rem", fontWeight: 800, color: "rgba(255,255,255,0.85)", letterSpacing: "0.10em", textShadow: "0 0 14px rgba(0,0,0,0.95)", textAlign: "center", lineHeight: 1.5, whiteSpace: "pre" }}>{orbLabel}</span>
                : null}
          </div>
        </div>

        {error && (
          <div style={{ fontSize: "0.78rem", color: "#ef4444", background: "#1f0505", border: "1px solid #3f1010", padding: "10px 18px", borderRadius: 12, maxWidth: 300, textAlign: "center", lineHeight: 1.5, margin: "0 16px" }}>
            {error}
          </div>
        )}

        {voiceState !== S.IDLE && (
          <button onPointerDown={endSession} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "#555", cursor: "pointer", padding: "9px 22px", borderRadius: 22, fontSize: "0.78rem", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
            End conversation
          </button>
        )}

        </div>
      </div>

      <button
        onPointerDown={() => setDebugOpen((v) => !v)}
        style={{
          position: "fixed",
          right: 14,
          bottom: "max(14px, env(safe-area-inset-bottom,0px))",
          zIndex: 70,
          background: "#b91c1c",
          color: "#fff",
          border: "1px solid #ef4444",
          borderRadius: 999,
          padding: "8px 12px",
          fontSize: "0.75rem",
          fontWeight: 800,
          letterSpacing: "0.04em",
          boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        DEBUG
      </button>

      {debugOpen && (
        <div style={{
          position: "fixed",
          left: 12,
          right: 12,
          bottom: "max(58px, calc(env(safe-area-inset-bottom,0px) + 48px))",
          maxHeight: "40dvh",
          background: "rgba(8,10,20,0.96)",
          border: "1px solid rgba(239,68,68,0.65)",
          borderRadius: 12,
          zIndex: 80,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderBottom: "1px solid rgba(239,68,68,0.30)" }}>
            <strong style={{ fontSize: "0.76rem", letterSpacing: "0.05em", color: "#fca5a5" }}>VOICE DEBUG</strong>
            <div style={{ display: "flex", gap: 8 }}>
              <button onPointerDown={runTtsDebug} style={{ background: "rgba(255,255,255,0.08)", color: "#f1f5f9", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, padding: "5px 8px", fontSize: "0.72rem" }}>Test TTS</button>
              <button onPointerDown={() => setDebugLogs([])} style={{ background: "rgba(255,255,255,0.08)", color: "#f1f5f9", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, padding: "5px 8px", fontSize: "0.72rem" }}>Clear</button>
            </div>
          </div>
          <div style={{ overflowY: "auto", padding: "10px 12px 14px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: "0.69rem", color: "#e2e8f0", lineHeight: 1.5 }}>
            {debugLogs.length ? debugLogs.map((line, idx) => <div key={idx}>{line}</div>) : <div style={{ color: "#94a3b8" }}>No logs yet. Tap orb once to start diagnostics.</div>}
          </div>
        </div>
      )}

      <style>{`
        @keyframes vp-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.2)} }
        @keyframes vp-dots  { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
        @keyframes vp-spin  { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
