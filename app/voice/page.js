"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import { defaultMeal } from "../lib/mealPeriod";
import Lottie from "lottie-react";
import { ArrowLeft } from "lucide-react";

// States
// IDLE      → tap orb → RECORDING
// RECORDING → tap orb → THINKING  (send transcript to AI)
// THINKING  → AI streaming → SPEAKING
// SPEAKING  → TTS finishes or tap → IDLE
const S = { IDLE: "idle", RECORDING: "recording", THINKING: "thinking", SPEAKING: "speaking" };

// ── NUTRICOACH — Lottie character ────────────────────────────────────────────
// Plays a Lottie animation you drop into /public/lottie:
//   coach.json        → idle / listening / thinking loop (required)
//   coach-talk.json   → optional talking loop, used while speaking
// Until a file exists it shows a soft "AI presence" orb. A colour-shifting aura
// + thinking dots signal state on top of whichever character is loaded.
function CoachAvatar({ state, size = 240 }) {
  const [idle, setIdle] = useState(null);
  const [talk, setTalk] = useState(null);

  useEffect(() => {
    let on = true;
    const grab = (url, set) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (on && d) set(d); })
        .catch(() => {});
    grab("/lottie/coach.json", setIdle);
    grab("/lottie/coach-talk.json", setTalk);
    return () => { on = false; };
  }, []);

  const data = state === "speaking" && talk ? talk : idle;

  return (
    <div className={`ca ca-${state}`} style={{ width: size, height: size }}>
      <span className="ca-aura" />
      <div className="ca-stage">
        {data ? (
          <Lottie animationData={data} loop autoplay style={{ width: "100%", height: "100%" }} />
        ) : (
          <span className="ca-orb" />
        )}
      </div>
      <span className="ca-dots"><i /><i /><i /></span>

      <style>{`
        .ca { position: relative; display: grid; place-items: center; --c: #6366f1; }
        .ca-idle { --c: #6366f1; } .ca-recording { --c: #ef4444; }
        .ca-thinking { --c: #f59e0b; } .ca-speaking { --c: #22c55e; }

        .ca-aura {
          position: absolute; inset: -4%; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--c) 42%, transparent), transparent 62%);
          filter: blur(4px); animation: ca-aura 3.4s ease-in-out infinite;
        }
        .ca-recording .ca-aura { animation-duration: 1.3s; } .ca-speaking .ca-aura { animation-duration: 1.8s; }
        @keyframes ca-aura { 0%,100% { transform: scale(.9); opacity: .6 } 50% { transform: scale(1.06); opacity: 1 } }

        .ca-stage { position: relative; width: 100%; height: 100%; display: grid; place-items: center; }

        .ca-orb {
          width: 64%; height: 64%; border-radius: 50%;
          background: radial-gradient(circle at 38% 32%, color-mix(in srgb, var(--c) 85%, #fff), var(--c) 55%, #0b0b16 100%);
          box-shadow: 0 18px 44px -10px var(--c), inset 0 -10px 26px rgba(0,0,0,.35), inset 0 8px 18px rgba(255,255,255,.25);
          animation: ca-orb 3.6s ease-in-out infinite;
        }
        @keyframes ca-orb { 0%,100% { transform: translateY(0) scale(1) } 50% { transform: translateY(-4px) scale(1.03) } }

        .ca-dots { position: absolute; top: 4%; right: 10%; display: flex; gap: 5px; opacity: 0; transition: opacity .2s; pointer-events: none; }
        .ca-dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--c); }
        .ca-thinking .ca-dots { opacity: 1; }
        .ca-thinking .ca-dots i { animation: ca-td 1.1s ease-in-out infinite; }
        .ca-thinking .ca-dots i:nth-child(2) { animation-delay: .15s; }
        .ca-thinking .ca-dots i:nth-child(3) { animation-delay: .3s; }
        @keyframes ca-td { 0%,100% { transform: translateY(0); opacity: .5 } 50% { transform: translateY(-5px); opacity: 1 } }

        @media (prefers-reduced-motion: reduce) { .ca * { animation: none !important; } }
      `}</style>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function VoicePage() {
  const router = useRouter();

  const [voiceState,  setVoiceState]  = useState(S.IDLE);
  const [error,       setError]       = useState("");
  const [orbSize,     setOrbSize]     = useState(240);
  const [debugOpen,   setDebugOpen]   = useState(false);
  const [debugLogs,   setDebugLogs]   = useState([]);
  const [messages,    setMessages]    = useState([]); // { role: "user"|"coach", text }
  const scrollRef = useRef(null);

  const pushMessage = useCallback(
    (role, text) => setMessages((prev) => [...prev.slice(-12), { role, text }]),
    [],
  );
  // Update the last coach bubble in place (for streaming the agent reply).
  const streamCoach = useCallback(
    (text) => setMessages((prev) => {
      const next = [...prev];
      if (next.length && next[next.length - 1].role === "coach") next[next.length - 1] = { role: "coach", text };
      else next.push({ role: "coach", text });
      return next;
    }),
    [],
  );
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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
    const update = () => setOrbSize(Math.round(Math.min(Math.min(window.innerWidth, window.innerHeight) * 0.44, 190)));
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
  // SPEED: use the browser's LOCAL speech first — it starts talking in <100ms.
  // The server (Gemini) voice sounds nicer but needs 1–3s to generate + download
  // the whole clip, so it's only a fallback for browsers with no local voices.
  const speakResponse = useCallback(async (fullText) => {
    if (!fullText.trim()) {
      addDebugLog("Skipping TTS: empty text");
      setVS(S.IDLE);
      return;
    }
    // Strip markdown so it reads cleanly.
    const clean = fullText
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/[•\-]\s/g, "")
      .replace(/#{1,6}\s/g, "")
      .trim();

    // ── 1) Browser speech — instant ──────────────────────────────────────────
    const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
    if (synth) {
      synth.cancel();
      synth.resume();
      let voices = synth.getVoices();
      if (!voices.length) {
        // First use: give voices a brief moment (don't block long — 700ms max).
        voices = await new Promise((resolve) => {
          let done = false;
          const to = setTimeout(() => { if (!done) { done = true; resolve(synth.getVoices()); } }, 700);
          synth.onvoiceschanged = () => { if (!done) { done = true; clearTimeout(to); resolve(synth.getVoices()); } };
        });
      }
      if (voices.length) {
        const preferredVoice =
          voices.find((v) => /en(-|_)?(IN|US|GB)?/i.test(v.lang) && !/google translate/i.test(v.name)) ||
          voices.find((v) => /female|google|microsoft|samantha|alex|zira|david/i.test(v.name)) ||
          voices[0];
        addDebugLog(`Browser TTS (instant): ${preferredVoice?.name || "default"}`);
        setVS(S.SPEAKING);
        const sentences = clean.match(/[^.!?\n]+[.!?\n]*/g) || [clean];
        let idx = 0;
        const speakNext = () => {
          if (idx >= sentences.length) { setVS(S.IDLE); setError(""); return; }
          const s = sentences[idx].trim(); idx++;
          if (!s) return speakNext();
          const utt = new SpeechSynthesisUtterance(s);
          utt.rate = 1.06; utt.pitch = 1.0; utt.volume = 1.0;
          if (preferredVoice) { utt.voice = preferredVoice; utt.lang = preferredVoice.lang || "en-US"; }
          else utt.lang = "en-US";
          utt.onend = speakNext;
          utt.onerror = () => { setVS(S.IDLE); };
          synth.speak(utt);
        };
        speakNext();
        return;
      }
    }

    // ── 2) Fallback: server (Gemini) audio — only when no local voices exist ──
    addDebugLog("No local voices — using server TTS fallback");
    const ok = await speakViaServerAudio(clean);
    if (!ok) {
      setError("Voice output unavailable right now. Please try again.");
      setVS(S.IDLE);
    }
  }, [setVS, addDebugLog, speakViaServerAudio]);

  // ── Route the transcript ──────────────────────────────────────────────────
  // Food logging → deterministic pipeline (/api/voice-log): accurate quantities
  // ("5 almonds" = 5, not 50), no double-logging. Questions → streaming agent
  // below (real data + spoken answer). Falls through to the agent on any error.
  const sendToAgent = useCallback(async (text) => {
    if (!text?.trim() || !sessionRef.current) return;
    setVS(S.THINKING);
    addDebugLog(`Transcript: "${text}" (${text.length} chars)`);
    pushMessage("user", text);

    try {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      addDebugLog("Checking /api/voice-log (is this a log request?)");
      const vlRes = await fetch("/api/voice-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: text,
          userId: sessionRef.current.user.id,
          accessToken: sessionRef.current.access_token,
          meal: defaultMeal(),
          date: localDate,
        }),
      });
      const vl = await vlRes.json().catch(() => ({}));
      addDebugLog(`voice-log: intent=${vl.intent} logged=${(vl.logged || []).length} unmatched=${(vl.unmatched || []).length}`);
      if (vl.intent === "log" || vl.intent === "none") {
        const reply = vl.spokenReply || "Okay.";
        addDebugLog(`voice-log reply ready (${reply.length} chars)`);
        pushMessage("coach", reply);
        await speakResponse(reply);
        return;
      }
      addDebugLog("Not a log request → routing to /api/agent");
    } catch (e) {
      addDebugLog(`voice-log error, falling back to agent: ${e?.message || "unknown"}`);
    }

    // ── Question path: streaming agent ──────────────────────────────────────
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
              streamCoach(fullResponse);
            }
          } catch {}
        }
      }
    } catch {
      addDebugLog("Agent call failed");
      fullResponse = fullResponse || "Sorry, I couldn't reach the server. Please try again.";
    }

    addDebugLog(`Agent reply ready (${fullResponse.length} chars)`);
    streamCoach(fullResponse);
    await speakResponse(fullResponse);
  }, [setVS, speakResponse, addDebugLog, pushMessage, streamCoach]);

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
        setError("Nothing was captured. Tap the Coach, speak, then tap again to send.");
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
    idle:      "Tap the coach and tell me what you ate",
    recording: "Listening… tap the coach to send",
    thinking:  "Working on it…",
    speaking:  "Speaking… tap the coach to stop",
  }[voiceState];

  const statusColor = {
    idle: "#7c8bff", recording: "#ef4444", thinking: "#f59e0b", speaking: "#22c55e",
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
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "2px 16px max(env(safe-area-inset-bottom,0px),14px)" }}>

        {/* Coach + status — pinned at the top of the content area */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            onPointerDown={voiceState === S.THINKING ? undefined : handleOrbTap}
            role="button"
            aria-label={orbLabel}
            style={{
              position: "relative",
              cursor: voiceState === S.THINKING ? "default" : "pointer",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              userSelect: "none",
              opacity: voiceState === S.THINKING ? 0.9 : 1,
              transition: "opacity 0.2s",
            }}
          >
            <CoachAvatar state={voiceState} size={orbSize} />
          </div>
          <div style={{ textAlign: "center", fontSize: "0.82rem", color: statusColor, minHeight: 20, transition: "color 0.3s", lineHeight: 1.4 }}>
            {statusText}
          </div>
        </div>

        {/* Conversation — scrollable, so users see what was heard + the reply */}
        <div
          ref={scrollRef}
          style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "12px 2px 4px", width: "100%", maxWidth: 480, margin: "0 auto" }}
        >
          {messages.length === 0 && !error && (
            <div style={{ margin: "auto", textAlign: "center", color: "#5b5b6b", fontSize: "0.85rem", lineHeight: 1.7, maxWidth: 300 }}>
              Tap the coach and say what you ate —<br />
              <span style={{ color: "#8b8ba3" }}>“I had two rotis and a bowl of dal”</span><br />
              or ask <span style={{ color: "#8b8ba3" }}>“how many calories do I have left?”</span>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "84%", padding: "10px 14px", borderRadius: 16, fontSize: "0.9rem", lineHeight: 1.5,
                borderBottomRightRadius: m.role === "user" ? 5 : 16,
                borderBottomLeftRadius: m.role === "user" ? 16 : 5,
                background: m.role === "user" ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.055)",
                border: `1px solid ${m.role === "user" ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.10)"}`,
                color: "#e9e9f2",
              }}>
                {m.role === "coach" && (
                  <span style={{ display: "block", fontSize: "0.56rem", fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: statusColor, marginBottom: 3, opacity: 0.9 }}>
                    NutriCoach
                  </span>
                )}
                {m.text || (voiceState === S.THINKING && m.role === "coach" ? "…" : "")}
              </div>
            </div>
          ))}
          {error && (
            <div style={{ margin: "4px auto 0", fontSize: "0.78rem", color: "#ef4444", background: "#1f0505", border: "1px solid #3f1010", padding: "10px 16px", borderRadius: 12, maxWidth: 320, textAlign: "center", lineHeight: 1.5 }}>
              {error}
            </div>
          )}
        </div>

        {/* End conversation — pinned at the bottom, never overlaps the coach */}
        {voiceState !== S.IDLE && (
          <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: 8 }}>
            <button onPointerDown={endSession} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "#888", cursor: "pointer", padding: "9px 22px", borderRadius: 22, fontSize: "0.78rem", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
              End conversation
            </button>
          </div>
        )}
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
