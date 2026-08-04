"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import { defaultMeal } from "../lib/mealPeriod";
import { dayKey } from "../lib/day";
import Lottie from "lottie-react";
import { ArrowLeft, Mic, Square, Loader2 } from "lucide-react";

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
  const speakerRef       = useRef(null); // active streaming-TTS controller
  const playResolveRef   = useRef(null); // settles the in-flight playBlob on stop

  const addDebugLog = useCallback((message) => {
    const now = new Date();
    const stamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    setDebugLogs((prev) => {
      const next = [...prev, `${stamp} ${message}`];
      return next.length > 80 ? next.slice(next.length - 80) : next;
    });
  }, []);

  // Prime the <audio> element for LATER programmatic playback. iOS/Safari only
  // allow play() that originates from a user gesture, but our real TTS plays
  // after an async fetch — so we "unlock" the shared element here, inside the
  // tap, by playing a silent clip. Without this the coach streams text but is
  // silent (play() is blocked), which looks like "speaking flickers, no sound".
  const unlockSpeech = useCallback(() => {
    if (speechUnlockedRef.current) return;
    try {
      let audio = audioPlaybackRef.current;
      if (!audio) {
        audio = new Audio();
        audio.preload = "auto";
        audio.playsInline = true;
        audioPlaybackRef.current = audio;
      }
      // 44-byte silent WAV — plays instantly and unlocks the element.
      audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.then(() => { try { audio.pause(); audio.currentTime = 0; } catch {} }).catch(() => {});
      }
      speechUnlockedRef.current = true;
      addDebugLog("Audio playback unlocked by user gesture");
    } catch (e) {
      addDebugLog(`Audio unlock failed: ${e?.message || "unknown"}`);
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
    speakerRef.current?.stop();
    try {
      audioPlaybackRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    } catch {}
    stopMic();
    window.speechSynthesis?.cancel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Server TTS — the ONLY voice path (no unreliable device-voice fallback) ─
  // Fetch spoken audio for ONE chunk of text. Kept per-chunk so the first
  // sentence returns fast; callers pipeline several chunks for low latency.
  const fetchTtsAudio = useCallback(async (text) => {
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceName: "Kore" }),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok || !payload?.audioBase64) {
        addDebugLog(`Server TTS failed: ${payload?.detail || payload?.error || `HTTP ${r.status}`}`);
        return null;
      }
      const binary = atob(payload.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: payload.mimeType || "audio/wav" });
    } catch (e) {
      addDebugLog(`Server TTS error: ${e?.message || "unknown"}`);
      return null;
    }
  }, [addDebugLog]);

  // Play one audio blob to completion on the shared (gesture-primed) element.
  const playBlob = useCallback((blob) => new Promise((resolve) => {
    let audio = audioPlaybackRef.current;
    if (!audio) {
      audio = new Audio();
      audio.preload = "auto";
      audio.playsInline = true;
      audioPlaybackRef.current = audio;
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    audio.src = url;
    audio.volume = 1;
    const finish = () => { playResolveRef.current = null; resolve(); };
    playResolveRef.current = finish; // let stop() unblock this if interrupted
    audio.onended = finish;
    audio.onerror = finish;
    audio.play().catch((e) => {
      addDebugLog(`Audio play blocked: ${e?.message || "unknown"}`);
      finish();
    });
  }), [addDebugLog]);

  // A streaming speaker: push text as it becomes ready. Each chunk's audio is
  // generated IMMEDIATELY (overlapping the agent's own token streaming) but the
  // chunks PLAY strictly in order. This is the whole optimisation — time to the
  // first spoken word drops from (whole reply + one big clip) to (first short
  // sentence's TTS).
  const createSpeaker = useCallback(() => {
    const queue = [];        // Promise<Blob|null>[], in play order
    let producerDone = false;
    let running = false;
    let stopped = false;
    let anyPlayed = false;

    const pump = async () => {
      if (running) return;
      running = true;
      while (queue.length && !stopped) {
        const blob = await queue.shift();
        if (stopped) break;
        if (blob) { setVS(S.SPEAKING); anyPlayed = true; await playBlob(blob); }
      }
      running = false;
      if (producerDone && !queue.length && !stopped) {
        setError(anyPlayed ? "" : "Voice output unavailable right now. Please try again.");
        setVS(S.IDLE);
      }
    };

    return {
      push(text) {
        const t = (text || "")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/[•\-]\s/g, "")
          .replace(/#{1,6}\s/g, "")
          .trim();
        if (stopped || !t) return;
        queue.push(fetchTtsAudio(t)); // start generating this chunk NOW
        pump();
      },
      end() { producerDone = true; if (!running) pump(); },
      stop() {
        stopped = true;
        try { audioPlaybackRef.current?.pause(); } catch {}
        playResolveRef.current?.(); // unblock any in-flight playBlob so its pump exits
      },
    };
  }, [fetchTtsAudio, playBlob, setVS]);

  // ── Speak a complete block of text (server-only, sentence-pipelined) ──────
  // Splits into sentences so the first one starts generating/playing right away.
  const speakResponse = useCallback(async (fullText) => {
    if (!fullText?.trim()) {
      addDebugLog("Skipping TTS: empty text");
      setVS(S.IDLE);
      return;
    }
    speakerRef.current?.stop();
    const speaker = createSpeaker();
    speakerRef.current = speaker;
    const sentences = fullText.match(/[^.!?\n]+[.!?\n]*/g) || [fullText];
    sentences.forEach((s) => speaker.push(s));
    speaker.end();
  }, [createSpeaker, setVS, addDebugLog]);

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
      const localDate = dayKey(); // 4am-rollover local day (matches home/dashboard)
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

    // ── Question path: streaming agent + pipelined TTS ──────────────────────
    // Start a fresh streaming speaker and feed it COMPLETE sentences the moment
    // they arrive, so audio for sentence 1 generates while sentence 2 is still
    // being written by the model.
    addDebugLog(`Sending transcript to /api/agent (${text.length} chars)`);
    speakerRef.current?.stop();
    const speaker = createSpeaker();
    speakerRef.current = speaker;
    let fullResponse = "";
    let spokenUpto = 0;
    const flushSentences = (final) => {
      const pending = fullResponse.slice(spokenUpto);
      const re = /[^.!?\n]+[.!?\n]+/g;
      let m, consumed = 0;
      while ((m = re.exec(pending)) !== null) {
        speaker.push(m[0]);
        consumed = re.lastIndex;
      }
      spokenUpto += consumed;
      if (final && spokenUpto < fullResponse.length) {
        speaker.push(fullResponse.slice(spokenUpto)); // trailing bit with no terminator
        spokenUpto = fullResponse.length;
      }
    };
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          userId: sessionRef.current.user.id,
          accessToken: sessionRef.current.access_token,
          voiceMode: true,
          dayKey: dayKey(),
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
              flushSentences(false); // speak any newly-completed sentences
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
    flushSentences(true); // speak the remainder
    speaker.end();
  }, [setVS, createSpeaker, speakResponse, addDebugLog, pushMessage, streamCoach]);

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
      speakerRef.current?.stop();
      window.speechSynthesis?.cancel();
      setVS(S.IDLE);
    }
    // THINKING: ignore tap
  }, [setVS, startRecording, stopRecordingAndGetText, sendToAgent, unlockSpeech, addDebugLog]);

  // ── End session button ────────────────────────────────────────────────────
  const endSession = useCallback(() => {
    speakerRef.current?.stop();
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

  const statusBadge = { idle: "Ready", recording: "Recording", thinking: "Thinking", speaking: "Speaking" }[voiceState];
  const micLabel = { idle: "Tap to speak", recording: "Tap to send", thinking: "Working on it…", speaking: "Tap to stop" }[voiceState];

  return (
    <div className={`vx vx-${voiceState}`}>
      <div className="vx-bg" aria-hidden />

      {/* HEADER */}
      <header className="vx-header">
        <button className="vx-back" onPointerDown={() => { endSession(); router.back(); }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="vx-badge">
          <span className="vx-dot" /> {statusBadge}
        </div>
        <span style={{ width: 70 }} />
      </header>

      {/* STAGE — the coach on a glowing platform */}
      <div className="vx-stage">
        <span className="vx-halo" aria-hidden />
        <span className="vx-halo vx-halo2" aria-hidden />
        <button
          className="vx-coach"
          onPointerDown={voiceState === S.THINKING ? undefined : handleOrbTap}
          aria-label={orbLabel}
          style={{ cursor: voiceState === S.THINKING ? "default" : "pointer" }}
        >
          <CoachAvatar state={voiceState} size={orbSize} />
        </button>
        <span className="vx-platform" aria-hidden />
        <div className="vx-title">NutriCoach</div>
        <div className="vx-status">{statusText}</div>
      </div>

      {/* CONVERSATION */}
      <div className="vx-chat" ref={scrollRef}>
        {messages.length === 0 && !error && (
          <div className="vx-empty">
            Tell me what you ate, or ask about your day —<br />
            <b>“I had two rotis and a bowl of dal”</b><br />
            <b>“how many calories do I have left?”</b>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`vx-row ${m.role}`}>
            <div className={`vx-bubble ${m.role}`}>
              {m.role === "coach" && <span className="vx-who">NutriCoach</span>}
              {m.text || (voiceState === S.THINKING && m.role === "coach" ? "…" : "")}
            </div>
          </div>
        ))}
        {error && <div className="vx-error">{error}</div>}
      </div>

      {/* CONTROLS — primary mic button */}
      <div className="vx-controls">
        {voiceState !== S.IDLE && (
          <button className="vx-end" onPointerDown={endSession}>End</button>
        )}
        <button
          className="vx-mic"
          onPointerDown={voiceState === S.THINKING ? undefined : handleOrbTap}
          disabled={voiceState === S.THINKING}
          aria-label={micLabel}
        >
          <span className="vx-mic-ring" aria-hidden />
          {voiceState === S.THINKING
            ? <Loader2 className="vx-spin" size={26} />
            : voiceState === S.RECORDING || voiceState === S.SPEAKING
              ? <Square size={22} fill="currentColor" />
              : <Mic size={26} />}
        </button>
        <div className="vx-mic-label">{micLabel}</div>
      </div>

      {/* DEBUG (subtle) */}
      <button className="vx-debug-btn" onPointerDown={() => setDebugOpen((v) => !v)}>debug</button>
      {debugOpen && (
        <div className="vx-debug">
          <div className="vx-debug-head">
            <strong>VOICE DEBUG</strong>
            <div style={{ display: "flex", gap: 8 }}>
              <button onPointerDown={runTtsDebug}>Test TTS</button>
              <button onPointerDown={() => setDebugLogs([])}>Clear</button>
            </div>
          </div>
          <div className="vx-debug-body">
            {debugLogs.length ? debugLogs.map((line, idx) => <div key={idx}>{line}</div>) : <div style={{ color: "#94a3b8" }}>No logs yet. Tap the mic to start.</div>}
          </div>
        </div>
      )}

      <style>{`
        .vx { position: relative; height: 100dvh; overflow: hidden; display: flex; flex-direction: column; color: #fff;
          font-family: system-ui, -apple-system, sans-serif; -webkit-user-select: none; user-select: none;
          -webkit-tap-highlight-color: transparent; background: #05050b; --c: #6d7cff; }
        .vx-idle { --c: #6d7cff; } .vx-recording { --c: #fb5f7a; } .vx-thinking { --c: #f5a623; } .vx-speaking { --c: #22d3a5; }

        .vx-bg { position: absolute; inset: 0; pointer-events: none; transition: background .7s ease; background:
          radial-gradient(58% 42% at 50% 30%, color-mix(in srgb, var(--c) 24%, transparent), transparent 72%),
          radial-gradient(90% 60% at 50% 118%, color-mix(in srgb, var(--c) 13%, transparent), transparent 70%),
          #06060d; }

        .vx-header { position: relative; z-index: 3; display: flex; align-items: center; justify-content: space-between;
          padding: max(env(safe-area-inset-top,0px),14px) 18px 6px; flex-shrink: 0; }
        .vx-back { display: flex; align-items: center; gap: 7px; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10); color: #d2d2e4; padding: 8px 14px; border-radius: 20px;
          font-size: 0.82rem; cursor: pointer; transition: background .2s; }
        .vx-back:hover { background: rgba(255,255,255,0.11); }
        .vx-badge { display: flex; align-items: center; gap: 8px; padding: 7px 15px;
          background: color-mix(in srgb, var(--c) 13%, transparent); border: 1px solid color-mix(in srgb, var(--c) 42%, transparent);
          border-radius: 20px; font-size: 0.78rem; font-weight: 600; color: color-mix(in srgb, var(--c) 70%, #fff);
          min-width: 108px; justify-content: center; transition: all .4s; }
        .vx-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c); box-shadow: 0 0 10px var(--c); }
        .vx-idle .vx-dot { box-shadow: none; opacity: .65; }
        .vx:not(.vx-idle) .vx-dot { animation: vx-pulse 1.2s ease-in-out infinite; }

        .vx-stage { position: relative; z-index: 1; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; padding: 8px 16px 0; }
        .vx-halo { position: absolute; top: 4px; width: min(70vw, 300px); height: min(70vw, 300px); border-radius: 50%;
          background: radial-gradient(circle, color-mix(in srgb, var(--c) 26%, transparent), transparent 60%);
          filter: blur(12px); animation: vx-halo 4s ease-in-out infinite; }
        .vx-halo2 { width: min(48vw, 210px); height: min(48vw, 210px); animation-delay: .6s; opacity: .8; }
        .vx-recording .vx-halo { animation-duration: 1.5s; } .vx-speaking .vx-halo { animation-duration: 2.1s; }
        .vx-coach { position: relative; z-index: 1; background: none; border: none; padding: 0; touch-action: manipulation; }
        .vx-platform { margin-top: -8px; width: min(50vw, 220px); height: 24px; border-radius: 50%;
          background: radial-gradient(circle, color-mix(in srgb, var(--c) 42%, transparent), transparent 68%); filter: blur(6px); opacity: .85; }
        .vx-title { margin-top: 8px; font-size: 1.1rem; font-weight: 800; letter-spacing: -0.01em;
          background: linear-gradient(90deg, #ffffff, color-mix(in srgb, var(--c) 65%, #ffffff)); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .vx-status { margin-top: 3px; font-size: 0.85rem; min-height: 20px; text-align: center; transition: color .3s;
          color: color-mix(in srgb, var(--c) 55%, #c8c8dc); }

        .vx-chat { position: relative; z-index: 1; flex: 1; min-height: 0; overflow-y: auto; width: 100%; max-width: 560px;
          margin: 8px auto 0; padding: 8px 18px; display: flex; flex-direction: column; gap: 10px; }
        .vx-chat::-webkit-scrollbar { width: 5px; } .vx-chat::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
        .vx-empty { margin: auto; text-align: center; color: #56566b; font-size: 0.92rem; line-height: 1.9; max-width: 340px; }
        .vx-empty b { color: color-mix(in srgb, var(--c) 45%, #b7b7cc); font-weight: 600; }
        .vx-row { display: flex; }
        .vx-row.user { justify-content: flex-end; } .vx-row.coach { justify-content: flex-start; }
        .vx-bubble { max-width: 82%; padding: 11px 15px; border-radius: 18px; font-size: 0.92rem; line-height: 1.5; animation: vx-in .25s ease; }
        .vx-bubble.user { background: color-mix(in srgb, var(--c) 22%, transparent); border: 1px solid color-mix(in srgb, var(--c) 42%, transparent);
          border-bottom-right-radius: 6px; color: #f1f1f9; }
        .vx-bubble.coach { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.11); border-bottom-left-radius: 6px; color: #ececf6; }
        .vx-who { display: block; font-size: 0.55rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--c); margin-bottom: 3px; opacity: .95; }
        .vx-error { margin: 4px auto 0; font-size: 0.8rem; color: #fda4af; background: rgba(190,30,50,0.14);
          border: 1px solid rgba(244,63,94,0.32); padding: 10px 16px; border-radius: 12px; max-width: 340px; text-align: center; }

        .vx-controls { position: relative; z-index: 3; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 8px 16px max(env(safe-area-inset-bottom,0px),20px); }
        .vx-mic { position: relative; width: 70px; height: 70px; border-radius: 50%; border: none; cursor: pointer; display: grid; place-items: center; color: #fff;
          background: radial-gradient(circle at 40% 34%, color-mix(in srgb, var(--c) 92%, #fff), var(--c) 72%);
          box-shadow: 0 14px 36px -6px var(--c), inset 0 -4px 12px rgba(0,0,0,.28), inset 0 3px 10px rgba(255,255,255,.35);
          transition: transform .12s ease, box-shadow .3s; touch-action: manipulation; }
        .vx-mic:active { transform: scale(0.93); }
        .vx-mic:disabled { cursor: default; }
        .vx-mic-ring { position: absolute; inset: -9px; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--c) 55%, transparent); opacity: 0; }
        .vx-recording .vx-mic-ring, .vx-speaking .vx-mic-ring { opacity: 1; animation: vx-ring 1.3s ease-out infinite; }
        .vx-mic-label { font-size: 0.78rem; color: #8686a0; letter-spacing: .01em; }
        .vx-end { position: absolute; left: 18px; bottom: max(env(safe-area-inset-bottom,0px),20px);
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); color: #9a9ab0;
          padding: 9px 16px; border-radius: 20px; font-size: 0.76rem; cursor: pointer; }

        .vx-spin { animation: vx-spin 0.9s linear infinite; }

        .vx-debug-btn { position: fixed; right: 12px; bottom: max(12px, env(safe-area-inset-bottom,0px)); z-index: 70;
          background: rgba(255,255,255,0.05); color: #6b6b80; border: 1px solid rgba(255,255,255,0.08); border-radius: 999px;
          padding: 5px 11px; font-size: 0.66rem; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; }
        .vx-debug { position: fixed; left: 12px; right: 12px; bottom: max(46px, calc(env(safe-area-inset-bottom,0px) + 42px));
          max-height: 40dvh; background: rgba(8,10,20,0.97); border: 1px solid rgba(255,255,255,0.14); border-radius: 12px; z-index: 80;
          display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 18px 40px rgba(0,0,0,0.5); }
        .vx-debug-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.10); }
        .vx-debug-head strong { font-size: 0.72rem; letter-spacing: .06em; color: #cfcfe0; }
        .vx-debug-head button { background: rgba(255,255,255,0.08); color: #f1f5f9; border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 5px 8px; font-size: 0.72rem; cursor: pointer; }
        .vx-debug-body { overflow-y: auto; padding: 10px 12px 14px; font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; font-size: 0.69rem; color: #e2e8f0; line-height: 1.5; }

        @keyframes vx-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
        @keyframes vx-halo { 0%,100% { transform: scale(.94); opacity: .7 } 50% { transform: scale(1.06); opacity: 1 } }
        @keyframes vx-ring { 0% { transform: scale(1); opacity: .7 } 100% { transform: scale(1.55); opacity: 0 } }
        @keyframes vx-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes vx-spin { to { transform: rotate(360deg) } }
        @media (prefers-reduced-motion: reduce) { .vx *, .vx-bg { animation: none !important; } }
      `}</style>
    </div>
  );
}
