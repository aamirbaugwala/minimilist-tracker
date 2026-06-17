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

  // ── Refs ──────────────────────────────────────────────────────────────────
  const voiceStateRef    = useRef(S.IDLE);
  const orbStateRef      = useRef(S.IDLE);
  const sessionRef       = useRef(null);

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
    } catch {}
  }, []);

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
    stopMic();
    window.speechSynthesis?.cancel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── TTS: speak AI response, then return to IDLE ───────────────────────────
  const speakResponse = useCallback(async (fullText) => {
    if (!("speechSynthesis" in window) || !fullText.trim()) {
      setVS(S.IDLE);
      return;
    }

    // Strip markdown so TTS reads cleanly.
    const clean = fullText
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/[•\-]\s/g, "")
      .replace(/#{1,6}\s/g, "")
      .trim();

    const sentences = clean.match(/[^.!?\n]+[.!?\n]*/g) || [clean];
    const synth = window.speechSynthesis;
    synth.cancel();
    synth.resume();

    // Try to get voices; wait up to 1s if they're loading (Brave workaround).
    const voices = await new Promise((resolve) => {
      const existing = synth.getVoices();
      if (existing.length) return resolve(existing);
      
      let resolved = false;
      const timeoutId = setTimeout(() => {
        resolved = true;
        resolve(synth.getVoices()); // return whatever we have (possibly empty)
      }, 1000);
      
      synth.onvoiceschanged = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve(synth.getVoices());
        }
      };
    });

    // If no voices available (Brave / PWA limitation), warn and try anyway.
    if (!voices.length) {
      console.warn("[voice] No system voices available. TTS may not work. Browser: " + navigator.userAgent.slice(0, 80));
      setError("No speech voices found. On Brave, enable Microphone & Audio in settings.");
    }

    const preferredVoice = voices.length > 0
      ? (voices.find((voice) => /en(-|_)?(IN|US|GB)?/i.test(voice.lang) && !/google translate/i.test(voice.name))
         || voices.find((voice) => /female|google|microsoft|samantha|alex|zira|david/i.test(voice.name))
         || voices[0])
      : null;

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
        if (!started) {
          setError("Text-to-speech failed. Try Firefox or Chrome. Brave requires explicit voice configuration.");
        }
        setVS(S.IDLE);
      };

      synth.speak(utt);
    };

    speakNext();
  }, [setVS]);

  // ── Call agent API (streaming), then speak full response ─────────────────
  const sendToAgent = useCallback(async (text) => {
    if (!text?.trim() || !sessionRef.current) return;
    setVS(S.THINKING);

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
      fullResponse = fullResponse || "Sorry, I couldn't reach the server. Please try again.";
    }

    await speakResponse(fullResponse);
  }, [setVS, speakResponse]);

  // ── Acquire mic (shared setup) ────────────────────────────────────────────
  const acquireMic = useCallback(async () => {
    if (micStreamRef.current) return true;

    if (!window.isSecureContext) {
      setError("Microphone requires HTTPS. Open the app on a secure origin (https://) or localhost in development.");
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone API unavailable in this browser. Please open the app in Safari or Chrome with microphone support enabled.");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      startAudioMonitor(stream);
      return true;
    } catch (e) {
      setError(
        e.name === "NotAllowedError"
          ? "Microphone access denied. On iOS: Settings → Safari → Microphone → Allow."
          : "Could not access microphone: " + (e.message || e.name || "unknown error")
      );
      return false;
    }
  }, [startAudioMonitor]);

  // ── Record audio for later transcription ──────────────────────────────────
  const startRecording = useCallback(async () => {
    if (typeof MediaRecorder === "undefined") {
      setError("Voice recording not supported in this browser. Please use a modern browser with MediaRecorder support.");
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
    } catch {
      recorder = new MediaRecorder(micStreamRef.current);
    }

    audioChunksRef.current   = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    mediaRecorderRef.current = recorder;
    recorder.start();
    return true;
  }, [acquireMic]);

  // ── Stop recording + transcribe audio ────────────────────────────────────
  const stopRecordingAndGetText = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return null;

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        const usedMime = recorder.mimeType || "audio/mp4";
        const blob     = new Blob(audioChunksRef.current, { type: usedMime });
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
          resolve((data.text || "").trim() || null);
        } catch {
          resolve(null);
        }
      };
      recorder.stop();
    });
  }, []);

  // ── Orb tap handler ───────────────────────────────────────────────────────
  const handleOrbTap = useCallback(async () => {
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
        setError("Nothing was captured. Tap the orb, speak, then tap again to send.");
        setVS(S.IDLE);
        return;
      }
      await sendToAgent(text);

    } else if (s === S.SPEAKING) {
      window.speechSynthesis?.cancel();
      setVS(S.IDLE);
    }
    // THINKING: ignore tap
  }, [setVS, startRecording, stopRecordingAndGetText, sendToAgent]);

  // ── End session button ────────────────────────────────────────────────────
  const endSession = useCallback(() => {
    try { mediaRecorderRef.current?.stop(); } catch {}
    window.speechSynthesis?.cancel();
    stopMic();
    setVS(S.IDLE);
  }, [setVS, stopMic]);

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

      <div style={{ flex: 1 }} />

      {/* STATUS LINE */}
      <div style={{
        textAlign: "center", fontSize: "0.82rem", color: statusColor,
        padding: "5px 24px", minHeight: 34, transition: "color 0.3s", flexShrink: 0,
        fontStyle: "normal", lineHeight: 1.4,
      }}>
        {statusText}
      </div>

      {/* ORB */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingBottom: "max(env(safe-area-inset-bottom,0px),28px)", paddingTop: 4 }}>
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

      <style>{`
        @keyframes vp-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.2)} }
        @keyframes vp-dots  { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
        @keyframes vp-spin  { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
