"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import { defaultMeal } from "../lib/mealPeriod";
import { dayKey } from "../lib/day";
import { Check, Mic, Square, Loader2 } from "lucide-react";
import { useSmartBack } from "../components/PageHeader";

// States
// IDLE      → tap orb → RECORDING
// RECORDING → tap orb → THINKING  (send transcript to AI)
// THINKING  → AI streaming → SPEAKING
// SPEAKING  → TTS finishes or tap → IDLE
const S = { IDLE: "idle", RECORDING: "recording", THINKING: "thinking", SPEAKING: "speaking" };

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function VoicePage() {
  const router = useRouter();
  // Fullscreen (no tab bar), so Back is the only exit: never leave the app.
  const goBack = useSmartBack("/");

  const [voiceState,  setVoiceState]  = useState(S.IDLE);
  const [error,       setError]       = useState("");
  const [debugOpen,   setDebugOpen]   = useState(false);
  const [debugLogs,   setDebugLogs]   = useState([]);
  const [messages,    setMessages]    = useState([]); // { role: "user"|"coach", text } | { role: "receipt", meal, items, calories, ids, undone }
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
        if (vl.intent === "log" && vl.logged?.length) {
          setMessages((prev) => [
            ...prev.slice(-12),
            { role: "receipt", meal: vl.meal, items: vl.logged, calories: vl.totals?.calories ?? 0, ids: vl.ids || [], undone: false },
          ]);
        }
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
          meal: defaultMeal(),
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

  // ── Undo a voice log (exact rows, by id) ──────────────────────────────────
  const undoReceipt = useCallback(async (index) => {
    const m = messages[index];
    if (!m?.ids?.length || !sessionRef.current) return;
    setMessages((prev) => prev.map((x, i) => (i === index ? { ...x, undone: true } : x)));
    const { error: delErr } = await supabase.from("food_logs").delete().in("id", m.ids).eq("user_id", sessionRef.current.user.id);
    if (delErr) {
      setMessages((prev) => prev.map((x, i) => (i === index ? { ...x, undone: false } : x)));
      setError("Couldn’t undo that — remove it from Today instead.");
    }
  }, [messages]);

  const ask = useCallback((text) => {
    unlockSpeech();
    if (voiceStateRef.current !== S.IDLE) return;
    setError("");
    sendToAgent(text);
  }, [sendToAgent, unlockSpeech]);

  // ── Display helpers ───────────────────────────────────────────────────────
  const statusBadge = { idle: "Ready", recording: "Listening", thinking: "Thinking", speaking: "Speaking" }[voiceState];
  const micLabel = { idle: "Tap to speak", recording: "Tap to send", thinking: "Working on it…", speaking: "Tap to stop" }[voiceState];
  const busy = voiceState !== S.IDLE;

  return (
    <div className={`vx vx-${voiceState}`}>
      <header className="vx-header">
        <button className="vx-done" onPointerDown={() => { endSession(); goBack(); }}>Done</button>
        <div className="vx-badge" role="status"><span className="vx-dot" /> {statusBadge}</div>
        <button className="vx-debug-btn" onPointerDown={() => setDebugOpen((v) => !v)} aria-label="Voice diagnostics">···</button>
      </header>

      <div className="vx-chat" ref={scrollRef}>
        {messages.length === 0 && !error && (
          <div className="vx-empty">
            <div className="vx-empty-title">Say what you ate, or ask about your day</div>
            <div>“I had two rotis and a bowl of dal for lunch”</div>
            <div>“How much protein is left today?”</div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "receipt" ? (
            <div key={i} className={`vx-receipt${m.undone ? " undone" : ""}`}>
              <div className="vx-receipt-head">
                <Check size={16} strokeWidth={2.6} />
                {m.undone ? `Removed from ${m.meal}` : `Logged to ${m.meal}`}
              </div>
              <div className="vx-receipt-items">{m.items.map((it) => `${it.name} × ${it.qty}`).join(" · ")}</div>
              <div className="vx-receipt-foot">
                <span>{Math.round(m.calories)} kcal{m.undone ? "" : " · saved"}</span>
                {!m.undone && m.ids?.length > 0 && <button onPointerDown={() => undoReceipt(i)}>Undo</button>}
              </div>
            </div>
          ) : (
            <div key={i} className={`vx-row ${m.role}`}>
              <div className={`vx-bubble ${m.role}`}>
                {m.role === "user" ? `“${m.text}”` : m.text || (voiceState === S.THINKING ? "…" : "")}
              </div>
            </div>
          ),
        )}
        {error && <div className="vx-error" role="alert">{error}</div>}
      </div>

      <div className="vx-controls">
        {!busy && (
          <div className="vx-suggest">
            {["How much is left today?", "Ideas for dinner?"].map((q) => (
              <button key={q} onPointerDown={() => ask(q)}>{q}</button>
            ))}
          </div>
        )}
        <div className="vx-mic-row">
          {busy && <button className="vx-end" onPointerDown={endSession}>End</button>}
          <button
            className="vx-mic"
            onPointerDown={voiceState === S.THINKING ? undefined : handleOrbTap}
            disabled={voiceState === S.THINKING}
            aria-label={micLabel}
          >
            <span className="vx-mic-ring" aria-hidden />
            {voiceState === S.THINKING
              ? <Loader2 className="vx-spin" size={28} />
              : voiceState === S.RECORDING || voiceState === S.SPEAKING
                ? <Square size={24} fill="currentColor" />
                : <Mic size={30} />}
          </button>
        </div>
        <div className="vx-mic-label">{micLabel}</div>
      </div>

      {debugOpen && (
        <div className="vx-debug">
          <div className="vx-debug-head">
            <strong>Voice diagnostics</strong>
            <div style={{ display: "flex", gap: 8 }}>
              <button onPointerDown={runTtsDebug}>Test voice</button>
              <button onPointerDown={() => setDebugLogs([])}>Clear</button>
            </div>
          </div>
          <div className="vx-debug-body">
            {debugLogs.length ? debugLogs.map((line, idx) => <div key={idx}>{line}</div>) : <div style={{ color: "var(--text-faint)" }}>No logs yet. Tap the mic to start.</div>}
          </div>
        </div>
      )}

      <style>{`
        .vx { --c: var(--accent); position: relative; height: 100dvh; overflow: hidden; display: flex; flex-direction: column;
          background: var(--bg); color: var(--text); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;
          max-width: 640px; margin: 0 auto; }
        .vx-recording { --c: var(--danger); } .vx-thinking { --c: var(--text-muted); }

        .vx-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0;
          padding: calc(12px + env(safe-area-inset-top, 0px)) 16px 8px; }
        .vx-done { background: none; border: none; color: var(--accent-text); font: inherit; font-size: 16px; font-weight: 600; padding: 8px 4px; cursor: pointer; min-width: 56px; text-align: left; }
        .vx-badge { display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 99px; background: var(--surface);
          border: 1px solid var(--border); font-size: 13px; color: var(--text-muted); }
        .vx-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
        .vx:not(.vx-idle) .vx-dot { animation: vx-pulse 1.2s ease-in-out infinite; }
        .vx-debug-btn { min-width: 56px; text-align: right; background: none; border: none; color: var(--text-faint); font-size: 18px; letter-spacing: 1px; padding: 8px 4px; cursor: pointer; }

        .vx-chat { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 20px; display: flex; flex-direction: column; gap: 14px; }
        .vx-empty { margin: auto 0; display: flex; flex-direction: column; gap: 10px; text-align: center; color: var(--text-muted); font-size: 15px; line-height: 1.5; }
        .vx-empty-title { font-size: 20px; font-weight: 600; color: var(--text); letter-spacing: -0.2px; margin-bottom: 6px; }
        .vx-row { display: flex; }
        .vx-row.user { justify-content: flex-end; }
        .vx-bubble { max-width: 86%; font-size: 16px; line-height: 1.5; animation: vx-in .2s ease; }
        .vx-bubble.user { padding: 10px 14px; border-radius: 18px 18px 6px 18px; background: var(--surface-highlight); color: var(--text); }
        .vx-bubble.coach { color: var(--text); padding: 2px 0; }
        .vx-receipt { padding: 14px 16px; border-radius: 16px; background: var(--surface); border: 1px solid var(--border); animation: vx-in .2s ease; }
        .vx-receipt-head { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--accent-text); }
        .vx-receipt.undone .vx-receipt-head { color: var(--text-muted); }
        .vx-receipt-items { margin-top: 6px; font-size: 15px; }
        .vx-receipt.undone .vx-receipt-items { text-decoration: line-through; color: var(--text-muted); }
        .vx-receipt-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; font-size: 13px; color: var(--text-muted); }
        .vx-receipt-foot button { background: none; border: none; color: var(--accent-text); font: inherit; font-size: 14px; font-weight: 600; padding: 4px 0 4px 12px; cursor: pointer; }
        .vx-error { font-size: 14px; color: var(--danger); background: var(--danger-soft); padding: 12px 14px; border-radius: 12px; }

        .vx-controls { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding: 8px 20px calc(20px + env(safe-area-inset-bottom, 0px)); }
        .vx-suggest { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
        .vx-suggest button { padding: 8px 14px; border-radius: 99px; border: 1px solid var(--border); background: transparent; color: var(--text-muted);
          font: inherit; font-size: 14px; cursor: pointer; }
        .vx-mic-row { position: relative; width: 100%; display: flex; justify-content: center; }
        .vx-mic { position: relative; width: 80px; height: 80px; border-radius: 50%; border: none; display: grid; place-items: center; cursor: pointer;
          background: var(--c); color: var(--on-accent); transition: transform .12s ease, background .25s; touch-action: manipulation; }
        .vx-recording .vx-mic { color: #fff; }
        .vx-thinking .vx-mic { background: var(--surface-highlight); color: var(--text-muted); cursor: default; }
        .vx-mic:active { transform: scale(0.94); }
        .vx-mic-ring { position: absolute; inset: -8px; border-radius: 50%; border: 2px solid var(--c); opacity: 0; }
        .vx-recording .vx-mic-ring, .vx-speaking .vx-mic-ring { animation: vx-ring 1.4s ease-out infinite; }
        .vx-mic-label { font-size: 14px; color: var(--text-muted); }
        .vx-end { position: absolute; left: 0; top: 50%; transform: translateY(-50%); background: none; border: 1px solid var(--border);
          color: var(--text-muted); padding: 10px 16px; border-radius: 99px; font: inherit; font-size: 14px; cursor: pointer; }
        .vx-spin { animation: vx-spin 0.9s linear infinite; }

        .vx-debug { position: fixed; left: 12px; right: 12px; top: calc(60px + env(safe-area-inset-top, 0px)); max-height: 40dvh; z-index: 80;
          background: var(--sheet); border: 1px solid var(--border); border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; }
        .vx-debug-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
        .vx-debug-head button { background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 5px 9px; font: inherit; font-size: 12px; cursor: pointer; }
        .vx-debug-body { overflow-y: auto; padding: 10px 12px 14px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; color: var(--text-muted); line-height: 1.5; -webkit-user-select: text; user-select: text; }

        @keyframes vx-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
        @keyframes vx-ring { 0% { transform: scale(1); opacity: .6 } 100% { transform: scale(1.45); opacity: 0 } }
        @keyframes vx-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes vx-spin { to { transform: rotate(360deg) } }
        @media (prefers-reduced-motion: reduce) { .vx * { animation: none !important; } }
      `}</style>
    </div>
  );
}
