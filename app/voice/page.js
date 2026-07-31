"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import { defaultMeal } from "../lib/mealPeriod";
import { ArrowLeft } from "lucide-react";

// IDLE      → tap coach → RECORDING
// RECORDING → tap coach → THINKING (transcribe → voice-log / agent)
// THINKING  → reply ready → SPEAKING
// SPEAKING  → TTS finishes or tap → IDLE
const S = { IDLE: "idle", RECORDING: "recording", THINKING: "thinking", SPEAKING: "speaking" };

// ── AI COACH AVATAR ─────────────────────────────────────────────────────────
// A friendly face: eyes that blink, a mouth that "talks" (equalizer bars), and
// an aura whose colour tracks state. Bars react to the mic while listening and
// animate while speaking, so it reads as a coach actually talking to you.
function CoachAvatar({ state, size = 190 }) {
  const face = Math.round(size * 0.6);
  const eye = Math.max(9, Math.round(face * 0.11));
  const barW = Math.max(5, Math.round(face * 0.055));

  return (
    <div
      className={`coach is-${state}`}
      style={{ width: size, height: size, "--face": `${face}px`, "--eye": `${eye}px`, "--barW": `${barW}px` }}
    >
      <span className="aura a1" />
      <span className="aura a2" />
      <span className="aura a3" />
      <div className="face">
        <div className="eyes">
          <span className="eye" />
          <span className="eye" />
        </div>
        <div className="mouth">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="bar" style={{ "--i": i }} />
          ))}
        </div>
      </div>

      <style>{`
        .coach { position: relative; display: grid; place-items: center; touch-action: manipulation; }
        .coach .face {
          position: relative; width: var(--face); height: var(--face); border-radius: 50%;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: calc(var(--face) * 0.12);
          background: radial-gradient(circle at 38% 30%, #7c8bff, #4736b0 62%, #241a5e);
          box-shadow: 0 22px 60px -14px rgba(79,70,229,0.65), inset 0 -10px 26px rgba(0,0,0,0.38), inset 0 6px 18px rgba(255,255,255,0.18);
          transition: background .5s ease, box-shadow .5s ease;
        }
        .coach.is-recording .face { background: radial-gradient(circle at 38% 30%, #fb7fa0, #b41d48 62%, #6b0f2c); box-shadow: 0 22px 60px -14px rgba(244,63,94,0.6), inset 0 -10px 26px rgba(0,0,0,0.4), inset 0 6px 18px rgba(255,255,255,0.2); }
        .coach.is-thinking  .face { background: radial-gradient(circle at 38% 30%, #fcd34d, #b45309 62%, #7c3d06); box-shadow: 0 22px 60px -14px rgba(245,158,11,0.55), inset 0 -10px 26px rgba(0,0,0,0.4), inset 0 6px 18px rgba(255,255,255,0.2); }
        .coach.is-speaking  .face { background: radial-gradient(circle at 38% 30%, #5eead4, #0f766e 62%, #064e43); box-shadow: 0 22px 60px -14px rgba(16,185,129,0.55), inset 0 -10px 26px rgba(0,0,0,0.4), inset 0 6px 18px rgba(255,255,255,0.2); }

        .coach .eyes { display: flex; gap: calc(var(--face) * 0.2); }
        .coach .eye {
          width: var(--eye); height: var(--eye); border-radius: 50%;
          background: rgba(255,255,255,0.95); box-shadow: 0 0 10px rgba(255,255,255,0.55);
          animation: coach-blink 4.2s infinite; transform-origin: center;
        }
        .coach.is-thinking .eye { animation: coach-blink 4.2s infinite, coach-look 1.6s ease-in-out infinite; }

        .coach .mouth { display: flex; align-items: center; gap: calc(var(--barW) * 0.55); height: calc(var(--face) * 0.32); }
        .coach .bar {
          width: var(--barW); border-radius: 999px; background: rgba(255,255,255,0.92);
          height: calc(var(--barW) * 0.9); box-shadow: 0 0 8px rgba(255,255,255,0.35);
          transition: height .12s ease;
        }
        /* idle: gentle breathing */
        .coach.is-idle .bar { animation: coach-idle 3.2s ease-in-out infinite; animation-delay: calc(var(--i) * 0.12s); }
        /* speaking: lively talk */
        .coach.is-speaking .bar { animation: coach-talk .55s ease-in-out infinite; animation-delay: calc(var(--i) * 0.09s); }
        /* thinking: soft uniform pulse */
        .coach.is-thinking .bar { animation: coach-think 1s ease-in-out infinite; animation-delay: calc(var(--i) * 0.08s); }
        /* recording/listening: a lively bounce */
        .coach.is-recording .bar { animation: coach-listen .5s ease-in-out infinite; animation-delay: calc(var(--i) * 0.08s); }

        .coach .aura { position: absolute; border-radius: 50%; pointer-events: none; }
        .coach .aura.a1 { width: 76%; height: 76%; }
        .coach .aura.a2 { width: 92%; height: 92%; }
        .coach .aura.a3 { width: 108%; height: 108%; }
        .coach .aura { box-shadow: 0 0 0 1px rgba(124,139,255,0.16); animation: coach-aura 3.4s ease-in-out infinite; }
        .coach .aura.a2 { animation-delay: .5s; } .coach .aura.a3 { animation-delay: 1s; }
        .coach.is-recording .aura { box-shadow: 0 0 0 1px rgba(244,63,94,0.22); animation-duration: 1.5s; }
        .coach.is-speaking  .aura { box-shadow: 0 0 0 1px rgba(16,185,129,0.22); animation-duration: 2s; }
        .coach.is-thinking  .aura { box-shadow: 0 0 0 1px rgba(245,158,11,0.22); }

        @keyframes coach-blink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        @keyframes coach-look  { 0%,100% { transform: translateX(0); } 50% { transform: translateX(18%); } }
        @keyframes coach-idle  { 0%,100% { height: calc(var(--barW) * 0.9); } 50% { height: calc(var(--barW) * 1.6); } }
        @keyframes coach-talk  { 0%,100% { height: calc(var(--barW) * 0.8); } 50% { height: calc(var(--face) * 0.26); } }
        @keyframes coach-listen{ 0%,100% { height: calc(var(--barW) * 0.9); } 50% { height: calc(var(--face) * 0.22); } }
        @keyframes coach-think { 0%,100% { height: calc(var(--barW) * 0.8); opacity: .55; } 50% { height: calc(var(--barW) * 1.5); opacity: 1; } }
        @keyframes coach-aura  { 0%,100% { transform: scale(1); opacity: .5; } 50% { transform: scale(1.06); opacity: .9; } }

        @media (prefers-reduced-motion: reduce) {
          .coach .eye, .coach .bar, .coach .aura { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function VoicePage() {
  const router = useRouter();

  const [voiceState, setVoiceState] = useState(S.IDLE);
  const [error, setError] = useState("");
  const [avatarSize, setAvatarSize] = useState(190);
  const [messages, setMessages] = useState([]); // { role: "user"|"coach", text }
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  const voiceStateRef = useRef(S.IDLE);
  const avatarStateRef = useRef(S.IDLE);
  const sessionRef = useRef(null);
  const speechUnlockedRef = useRef(false);
  const audioPlaybackRef = useRef(null);
  const audioUrlRef = useRef("");
  const scrollRef = useRef(null);

  const addDebugLog = useCallback((message) => {
    const now = new Date();
    const stamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    setDebugLogs((prev) => {
      const next = [...prev, `${stamp} ${message}`];
      return next.length > 80 ? next.slice(next.length - 80) : next;
    });
  }, []);

  const pushMessage = useCallback((role, text) => {
    if (!text) return;
    setMessages((prev) => [...prev.slice(-8), { role, text }]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const unlockSpeech = useCallback(() => {
    if (speechUnlockedRef.current || !("speechSynthesis" in window)) return;
    try {
      const synth = window.speechSynthesis;
      const warmup = new SpeechSynthesisUtterance(" ");
      warmup.volume = 0;
      synth.cancel();
      synth.speak(warmup);
      synth.cancel();
      speechUnlockedRef.current = true;
      addDebugLog("TTS unlocked by user gesture");
    } catch (e) {
      addDebugLog(`TTS unlock failed: ${e?.message || "unknown"}`);
    }
  }, [addDebugLog]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const micStreamRef = useRef(null);

  const audioCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const levelRef = useRef(0);

  const setVS = useCallback((s) => {
    voiceStateRef.current = s;
    avatarStateRef.current = s;
    setVoiceState(s);
  }, []);

  useEffect(() => {
    const update = () => setAvatarSize(Math.round(Math.min(Math.min(window.innerWidth, window.innerHeight) * 0.42, 200)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) { router.replace("/"); return; }
      sessionRef.current = s;
    });
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") setDebugOpen(true);
    const logRuntime = () => {
      const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone;
      addDebugLog(`Runtime: secure=${window.isSecureContext} standalone=${Boolean(standalone)} media=${Boolean(navigator.mediaDevices?.getUserMedia)} speech=${Boolean(window.speechSynthesis)}`);
    };
    logRuntime();
  }, [addDebugLog]);

  // ── Audio level monitor (drives the coach's mouth while listening) ──────────
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
        levelRef.current = buf.reduce((a, b) => a + b, 0) / buf.length / 128;
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
    levelRef.current = 0;
  }, []);

  const stopMic = useCallback(() => {
    stopAudioMonitor();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
  }, [stopAudioMonitor]);

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

  // ── Server TTS playback ────────────────────────────────────────────────────
  const speakViaServerAudio = useCallback(async (text) => {
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceName: "Kore" }),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(payload?.detail || payload?.error || `HTTP ${r.status}`);
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
      if (!audio) { audio = new Audio(); audio.preload = "auto"; audio.playsInline = true; audioPlaybackRef.current = audio; }
      audio.src = objectUrl; audio.volume = 1;
      setVS(S.SPEAKING);
      await audio.play();
      await new Promise((resolve, reject) => {
        audio.onended = () => { audio.onended = null; audio.onerror = null; resolve(); };
        audio.onerror = () => { audio.onended = null; audio.onerror = null; reject(new Error("audio playback error")); };
      });
      setError(""); setVS(S.IDLE);
      return true;
    } catch (e) {
      addDebugLog(`Server TTS failed: ${e?.message || "unknown"}`);
      return false;
    }
  }, [addDebugLog, setVS]);

  const speakResponse = useCallback(async (fullText) => {
    if (!fullText.trim()) { setVS(S.IDLE); return; }
    const clean = fullText.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/[•\-]\s/g, "").replace(/#{1,6}\s/g, "").trim();

    const serverSpoken = await speakViaServerAudio(clean);
    if (serverSpoken) return;

    if (!("speechSynthesis" in window)) {
      setError("Voice output unavailable right now.");
      setVS(S.IDLE);
      return;
    }
    const sentences = clean.match(/[^.!?\n]+[.!?\n]*/g) || [clean];
    const synth = window.speechSynthesis; synth.cancel(); synth.resume();
    const voices = await new Promise((resolve) => {
      const existing = synth.getVoices();
      if (existing.length) return resolve(existing);
      const to = setTimeout(() => resolve(synth.getVoices()), 2000);
      synth.onvoiceschanged = () => { clearTimeout(to); resolve(synth.getVoices()); };
    });
    const preferredVoice = voices.length
      ? (voices.find((v) => /en(-|_)?(IN|US|GB)?/i.test(v.lang) && !/google translate/i.test(v.name)) || voices[0])
      : null;
    setVS(S.SPEAKING);
    let idx = 0;
    const speakNext = () => {
      if (idx >= sentences.length) { setVS(S.IDLE); setError(""); return; }
      const s = sentences[idx].trim(); idx++;
      if (!s) return speakNext();
      const utt = new SpeechSynthesisUtterance(s);
      utt.rate = 1.02; utt.pitch = 1.0; utt.volume = 1.0;
      if (preferredVoice) { utt.voice = preferredVoice; utt.lang = preferredVoice.lang || "en-US"; } else utt.lang = "en-US";
      utt.onend = speakNext;
      utt.onerror = () => { setVS(S.IDLE); };
      synth.speak(utt);
    };
    speakNext();
  }, [setVS, speakViaServerAudio]);

  // ── Send a food-related QUESTION to the full agent (streaming) ──────────────
  const askAgent = useCallback(async (text) => {
    let fullResponse = "";
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, userId: sessionRef.current.user.id, accessToken: sessionRef.current.access_token, voiceMode: true }),
      });
      if (!res.ok) throw new Error("api error");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuf += decoder.decode(value, { stream: true });
        const lines = sseBuf.split("\n\n"); sseBuf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try { const ev = JSON.parse(line.slice(6)); if (ev.type === "chunk") fullResponse += ev.text; } catch {}
        }
      }
    } catch {
      fullResponse = "Sorry, I couldn't reach the server. Please try again.";
    }
    return fullResponse || "Sorry, I didn't get that.";
  }, []);

  // ── Route a transcript: deterministic logging first, agent for questions ────
  const processTranscript = useCallback(async (text) => {
    pushMessage("user", text);
    setVS(S.THINKING);

    let reply = "";
    try {
      const res = await fetch("/api/voice-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: text,
          userId: sessionRef.current.user.id,
          accessToken: sessionRef.current.access_token,
          meal: defaultMeal(),
          date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      addDebugLog(`voice-log intent=${data.intent} logged=${(data.logged || []).length} unmatched=${(data.unmatched || []).length}`);

      if (data.intent === "question") {
        reply = await askAgent(text); // real answer needs live data + tools
      } else {
        reply = data.spokenReply || "Done.";
      }
    } catch (e) {
      addDebugLog(`voice-log failed: ${e?.message || "unknown"}`);
      reply = "Something went wrong. Please try again.";
    }

    pushMessage("coach", reply);
    await speakResponse(reply);
  }, [pushMessage, setVS, askAgent, speakResponse, addDebugLog]);

  // ── Mic ─────────────────────────────────────────────────────────────────────
  const acquireMic = useCallback(async () => {
    if (micStreamRef.current) return true;
    if (!window.isSecureContext) { setError("Microphone requires HTTPS."); return false; }
    if (!navigator.mediaDevices?.getUserMedia) { setError("Microphone unavailable in this browser."); return false; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      startAudioMonitor(stream);
      return true;
    } catch (e) {
      setError(e.name === "NotAllowedError" ? "Microphone access denied. Allow it in your browser settings." : "Could not access microphone: " + (e.message || e.name || "unknown"));
      return false;
    }
  }, [startAudioMonitor]);

  const startRecording = useCallback(async () => {
    // Record a clip, then transcribe it server-side (/api/transcribe). Works on
    // every browser — unlike webkitSpeechRecognition, which Brave aborts.
    if (typeof MediaRecorder === "undefined") { setError("Voice recording not supported in this browser."); return false; }
    const ok = await acquireMic();
    if (!ok) return false;
    const MIME_PREFS = ["audio/mp4", "audio/webm", "audio/ogg"];
    const mimeType = MIME_PREFS.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || "";
    let recorder;
    try { recorder = new MediaRecorder(micStreamRef.current, mimeType ? { mimeType } : {}); }
    catch { recorder = new MediaRecorder(micStreamRef.current); }
    audioChunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    mediaRecorderRef.current = recorder;
    recorder.start();
    return true;
  }, [acquireMic]);

  const stopRecordingAndGetText = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return null;
    return new Promise((resolve) => {
      recorder.onstop = async () => {
        const usedMime = recorder.mimeType || "audio/mp4";
        const blob = new Blob(audioChunksRef.current, { type: usedMime });
        if (blob.size < 500) { resolve(null); return; }
        const base64 = await new Promise((res) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result.split(",")[1]);
          fr.readAsDataURL(blob);
        });
        try {
          const r = await fetch("/api/transcribe", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: base64, mimeType: usedMime }),
          });
          const data = await r.json();
          resolve((data.text || "").trim() || null);
        } catch { resolve(null); }
      };
      recorder.stop();
    });
  }, []);

  const handleTap = useCallback(async () => {
    unlockSpeech();
    const s = voiceStateRef.current;
    if (s === S.IDLE) {
      setError("");
      setVS(S.RECORDING);
      const ok = await startRecording();
      if (!ok) setVS(S.IDLE);
    } else if (s === S.RECORDING) {
      // Stop the clip and transcribe it.
      setVS(S.THINKING);
      const text = await stopRecordingAndGetText();
      if (!text) {
        setError("I didn't catch that. Tap the coach, speak, then tap again.");
        setVS(S.IDLE);
        return;
      }
      await processTranscript(text);
    } else if (s === S.SPEAKING) {
      window.speechSynthesis?.cancel();
      try { audioPlaybackRef.current?.pause(); } catch {}
      setVS(S.IDLE);
    }
    // THINKING: ignore
  }, [setVS, startRecording, stopRecordingAndGetText, processTranscript, unlockSpeech]);

  const endSession = useCallback(() => {
    try { mediaRecorderRef.current?.stop(); } catch {}
    try { audioPlaybackRef.current?.pause(); if (audioPlaybackRef.current) audioPlaybackRef.current.currentTime = 0; } catch {}
    window.speechSynthesis?.cancel();
    stopMic();
    setVS(S.IDLE);
  }, [setVS, stopMic]);

  const runTtsDebug = useCallback(() => { unlockSpeech(); speakResponse("This is a voice test from your nutrition coach."); }, [unlockSpeech, speakResponse]);

  // ── Display helpers ─────────────────────────────────────────────────────────
  const statusText = {
    idle: messages.length ? "Tap the coach to keep talking" : "Tap the coach and tell me what you ate",
    recording: "Listening… speak, then pause (or tap)",
    thinking: "Working on it…",
    speaking: "Speaking… tap to stop",
  }[voiceState];

  const statusColor = { idle: "#7c8bff", recording: "#f43f5e", thinking: "#f59e0b", speaking: "#10b981" }[voiceState];
  const statusBadge = { idle: "Ready", recording: "Listening", thinking: "Thinking", speaking: "Speaking" }[voiceState];
  const dotPulse = voiceState !== S.IDLE;

  return (
    <div style={{
      height: "100dvh",
      background: "radial-gradient(ellipse at 50% 30%, #12122a 0%, #060609 60%)",
      color: "#fff", display: "flex", flexDirection: "column",
      fontFamily: "system-ui, -apple-system, sans-serif",
      WebkitUserSelect: "none", userSelect: "none", WebkitTapHighlightColor: "transparent",
    }}>
      {/* HEADER */}
      <div style={{ padding: "max(env(safe-area-inset-top,0px),14px) 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <button onPointerDown={() => { endSession(); router.back(); }} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#aaa", cursor: "pointer", padding: "8px 14px", borderRadius: 20, display: "flex", alignItems: "center", gap: 7, fontSize: "0.8rem", touchAction: "manipulation" }}>
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 16px", background: "rgba(255,255,255,0.04)", border: `1px solid ${statusColor}44`, borderRadius: 20, fontSize: "0.78rem", color: statusColor, transition: "all 0.3s", minWidth: 104, justifyContent: "center" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, boxShadow: dotPulse ? `0 0 8px ${statusColor}` : "none", animation: dotPulse ? "vp-pulse 1.2s ease-in-out infinite" : "none" }} />
          {statusBadge}
        </div>
        <div style={{ width: 68 }} />
      </div>

      {/* COACH + STATUS */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "6px 18px 4px" }}>
        <div
          onPointerDown={voiceState === S.THINKING ? undefined : handleTap}
          role="button"
          aria-label="Talk to your coach"
          style={{ cursor: voiceState === S.THINKING ? "default" : "pointer", opacity: voiceState === S.THINKING ? 0.9 : 1, transition: "opacity 0.2s" }}
        >
          <CoachAvatar state={voiceState} size={avatarSize} />
        </div>
        <div style={{ textAlign: "center", fontSize: "0.85rem", color: statusColor, minHeight: 22, transition: "color 0.3s" }}>
          {statusText}
        </div>
      </div>

      {/* CONVERSATION */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 16px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && !error && (
          <div style={{ margin: "auto", textAlign: "center", color: "#5b5b6b", fontSize: "0.85rem", lineHeight: 1.6, maxWidth: 280 }}>
            Say something like<br />
            <span style={{ color: "#8b8ba3" }}>“I had two rotis, dal and a bowl of rice”</span><br />
            or ask <span style={{ color: "#8b8ba3" }}>“how many calories do I have left?”</span>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "82%", padding: "10px 14px", borderRadius: 16, fontSize: "0.9rem", lineHeight: 1.5,
              borderBottomRightRadius: m.role === "user" ? 4 : 16, borderBottomLeftRadius: m.role === "user" ? 16 : 4,
              background: m.role === "user" ? "rgba(124,139,255,0.16)" : "rgba(16,185,129,0.12)",
              border: `1px solid ${m.role === "user" ? "rgba(124,139,255,0.3)" : "rgba(16,185,129,0.28)"}`,
              color: "#e8e8f0",
            }}>
              {m.role === "coach" && <span style={{ display: "block", fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#10b981", marginBottom: 3 }}>Coach</span>}
              {m.text}
            </div>
          </div>
        ))}
        {error && (
          <div style={{ margin: "6px auto 0", fontSize: "0.78rem", color: "#ef4444", background: "#1f0505", border: "1px solid #3f1010", padding: "10px 16px", borderRadius: 12, maxWidth: 320, textAlign: "center", lineHeight: 1.5 }}>
            {error}
          </div>
        )}
      </div>

      {/* CONTROLS */}
      {voiceState !== S.IDLE && (
        <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "0 18px max(env(safe-area-inset-bottom,0px),16px)" }}>
          <button onPointerDown={endSession} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "#777", cursor: "pointer", padding: "9px 22px", borderRadius: 22, fontSize: "0.78rem", touchAction: "manipulation" }}>
            End conversation
          </button>
        </div>
      )}

      {/* DEBUG */}
      <button onPointerDown={() => setDebugOpen((v) => !v)} style={{ position: "fixed", right: 14, bottom: "max(14px, env(safe-area-inset-bottom,0px))", zIndex: 70, background: "#b91c1c", color: "#fff", border: "1px solid #ef4444", borderRadius: 999, padding: "8px 12px", fontSize: "0.72rem", fontWeight: 800, touchAction: "manipulation" }}>
        DEBUG
      </button>
      {debugOpen && (
        <div style={{ position: "fixed", left: 12, right: 12, bottom: "max(58px, calc(env(safe-area-inset-bottom,0px) + 48px))", maxHeight: "40dvh", background: "rgba(8,10,20,0.96)", border: "1px solid rgba(239,68,68,0.65)", borderRadius: 12, zIndex: 80, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderBottom: "1px solid rgba(239,68,68,0.30)" }}>
            <strong style={{ fontSize: "0.76rem", color: "#fca5a5" }}>VOICE DEBUG</strong>
            <div style={{ display: "flex", gap: 8 }}>
              <button onPointerDown={runTtsDebug} style={{ background: "rgba(255,255,255,0.08)", color: "#f1f5f9", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, padding: "5px 8px", fontSize: "0.72rem" }}>Test TTS</button>
              <button onPointerDown={() => setDebugLogs([])} style={{ background: "rgba(255,255,255,0.08)", color: "#f1f5f9", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, padding: "5px 8px", fontSize: "0.72rem" }}>Clear</button>
            </div>
          </div>
          <div style={{ overflowY: "auto", padding: "10px 12px 14px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: "0.69rem", color: "#e2e8f0", lineHeight: 1.5 }}>
            {debugLogs.length ? debugLogs.map((line, idx) => <div key={idx}>{line}</div>) : <div style={{ color: "#94a3b8" }}>No logs yet.</div>}
          </div>
        </div>
      )}

      <style>{`@keyframes vp-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.2)} }`}</style>
    </div>
  );
}
