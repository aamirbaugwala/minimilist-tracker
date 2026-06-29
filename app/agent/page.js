"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import {
  ArrowLeft,
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Trash2,
  Database,
  Zap,
  Scale,
  Utensils,
  TrendingUp,
  Droplets,
  Flame,
  PenLine,
  Copy,
  Check,
  Target,
  Mic,
  UtensilsCrossed,
  BarChart2,
  HeartPulse,
  SaveAll,
  Globe,
  ImageIcon,
  X,
} from "lucide-react";

// ─── TOOL BADGE METADATA ──────────────────────────────────────────────────────
const TOOL_META = {
  get_todays_logs:      { label: "Read Today's Logs",    icon: Utensils,        color: "#3b82f6" },
  get_logs_for_days:    { label: "Fetching History",     icon: TrendingUp,      color: "#8b5cf6" },
  get_macro_gap:        { label: "Calculating Gap",      icon: Zap,             color: "#f59e0b" },
  search_food_database: { label: "Searching Foods",      icon: Database,        color: "#10b981" },
  get_weight_trend:     { label: "Reading Weight Data",  icon: Scale,           color: "#ec4899" },
  get_user_profile:     { label: "Loading Your Profile", icon: User,            color: "#6366f1" },
  log_food_item:        { label: "Logging Food",         icon: PenLine,         color: "#f97316" },
  get_streak:           { label: "Checking Streak",      icon: Flame,           color: "#ef4444" },
  update_goal:          { label: "Updating Your Goal",   icon: Target,          color: "#22c55e" },
  generate_meal_plan:   { label: "Building Meal Plan",   icon: UtensilsCrossed, color: "#06b6d4" },
  get_medical_context:  { label: "Reading Medical Data", icon: HeartPulse,      color: "#f43f5e" },
  save_food_to_database:{ label: "Saving Food",          icon: SaveAll,         color: "#84cc16" },
  search_web:           { label: "Searching Web",        icon: Globe,           color: "#a78bfa" },
};

// ─── SUGGESTED STARTER PROMPTS ────────────────────────────────────────────────
const STARTERS = [
  { text: "What should I eat for dinner?",          icon: Utensils },
  { text: "Build me a meal plan for the rest of the day", icon: UtensilsCrossed },
  { text: "How am I doing this week?",               icon: TrendingUp },
  { text: "Am I losing weight?",                     icon: Scale },
  { text: "How much water have I had today?",        icon: Droplets },
  { text: "How many calories in chicken biryani?",   icon: Database },
  { text: "What's my logging streak?",               icon: Flame },
  { text: "Log 2 rotis for me",                      icon: PenLine },
  { text: "Change my goal to lose weight",           icon: Target },
  { text: "Give me a full weekly analysis",          icon: Sparkles },
];

// ─── MARKDOWN-LIKE RENDERER (bold, bullets) ───────────────────────────────────
function RenderMessage({ text, streaming }) {
  const lines = text.split("\n");
  return (
    <div style={{ lineHeight: 1.65 }}>
      {lines.map((line, i) => {
        // Bold: **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        // Bullet point
        if (line.trim().startsWith("* ") || line.trim().startsWith("- ")) {
          return (
            <div key={i} style={{ display: "flex", gap: 8, margin: "4px 0" }}>
              <span style={{ color: "#3b82f6", flexShrink: 0, marginTop: 2 }}>•</span>
              <span>{parts.slice(1)}</span>
            </div>
          );
        }

        // Emoji headers (lines starting with emoji)
        const emojiRegex = /^[\u{1F300}-\u{1FFFF}✅🛑📉💡🔥⚡]/u;
        if (emojiRegex.test(line.trim()) && line.trim().length > 2) {
          return (
            <div key={i} style={{ fontWeight: 700, marginTop: i > 0 ? 12 : 0, marginBottom: 4 }}>
              {parts}
            </div>
          );
        }

        if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;

        return <div key={i}>{parts}</div>;
      })}
      {/* Blinking block cursor shown while streaming */}
      {streaming && (
        <span
          style={{
            display: "inline-block",
            width: 2,
            height: "1em",
            background: "#3b82f6",
            marginLeft: 1,
            verticalAlign: "text-bottom",
            animation: "nutricoach-blink 1s step-end infinite",
          }}
        />
      )}
    </div>
  );
}

// ─── TOOL ACTIVITY BADGE ──────────────────────────────────────────────────────
function ToolBadges({ tools }) {
  if (!tools || tools.length === 0) return null;

  // Count how many times each tool was called (e.g. save_food_to_database x3)
  const counts = tools.reduce((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      {Object.entries(counts).map(([tool, count]) => {
        const meta = TOOL_META[tool];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <div
            key={tool}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: "0.7rem",
              color: meta.color,
              background: `${meta.color}18`,
              border: `1px solid ${meta.color}40`,
              padding: "3px 8px",
              borderRadius: 20,
              fontWeight: 600,
            }}
          >
            <Icon size={11} />
            {meta.label}
            {count > 1 && (
              <span style={{
                background: `${meta.color}33`,
                borderRadius: 10,
                padding: "0px 5px",
                fontSize: "0.65rem",
                fontWeight: 700,
              }}>
                ×{count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AgentPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]); // { role, content, toolsUsed? }
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);
  // ── Voice input state ──────────────────────────────────────────────────────
  const [, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  // ── Image attachment state ─────────────────────────────────────────────────
  const [selectedImage, setSelectedImage] = useState(null); // { base64, mimeType, preview }
  const imageInputRef = useRef(null);
  // ── TTS (voice output) state ───────────────────────────────────────────────
  const [, setSpeaking] = useState(false);
  // ── Voice conversation mode ────────────────────────────────────────────────
  const [, setIsVoiceMode] = useState(false);
  // Refs — always-current values safe to read inside async/event callbacks
  const isVoiceModeRef       = useRef(false);
  const loadingRef           = useRef(false);
  const ttsEnabledRef        = useRef(false);
  const ttsSentenceBufferRef = useRef(""); // accumulates partial text for streaming TTS
  const ttsQueueCountRef     = useRef(0);  // counts utterances still queued/playing
  // Always-current ref to sendMessage — prevents stale closure in voice callbacks
  const sendMessageRef       = useRef(null);
  // ── Weekly report state ────────────────────────────────────────────────────
  const [weeklyReport, setWeeklyReport] = useState(null); // { insight, score, weekStart }
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // ── COPY MESSAGE ───────────────────────────────────────────────────────────
  const copyMessage = (text, index) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  // ── IMAGE PICK ─────────────────────────────────────────────────────────────
  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Max 4 MB
    if (file.size > 4 * 1024 * 1024) {
      setError("Image must be under 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;               // "data:image/jpeg;base64,…"
      const [header, base64] = dataUrl.split(",");    // split off the header
      const mimeType = header.replace("data:", "").replace(";base64", "");
      setSelectedImage({ base64, mimeType, preview: dataUrl });
    };
    reader.readAsDataURL(file);
    // Reset the input so the same file can be picked again
    e.target.value = "";
  };

  // ── STREAMING TTS — queues utterances sentence-by-sentence as text arrives ─
  // Called repeatedly during streaming; Web Speech API queues them in order.
  const speakChunk = (text) => {
    if (!ttsEnabledRef.current || !("speechSynthesis" in window)) return;
    const cleaned = text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/[•\-]\s/g, "")
      .replace(/#{1,6}\s/g, "")
      .trim();
    if (!cleaned) return;

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = "en-IN";
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    ttsQueueCountRef.current += 1;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => {
      ttsQueueCountRef.current = Math.max(0, ttsQueueCountRef.current - 1);
      if (ttsQueueCountRef.current === 0) {
        setSpeaking(false);
        // Voice conversation loop: restart listening after all speech finishes
        if (isVoiceModeRef.current && !loadingRef.current) {
          setTimeout(() => startListeningForVoiceMode(), 700);
        }
      }
    };
    utterance.onerror = () => {
      ttsQueueCountRef.current = Math.max(0, ttsQueueCountRef.current - 1);
      if (ttsQueueCountRef.current === 0) setSpeaking(false);
    };
    window.speechSynthesis.speak(utterance);
  };

  // ── VOICE CONVERSATION LOOP ────────────────────────────────────────────────
  // Listens → auto-submits transcript → TTS plays response → listens again.
  // Uses refs so callbacks always see the latest state without stale closures.
  const startListeningForVoiceMode = () => {
    if (!isVoiceModeRef.current || loadingRef.current || ttsQueueCountRef.current > 0) return;
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("Voice input not supported in this browser. Try Chrome.");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    let gotResult = false;

    recognition.onresult = (event) => {
      gotResult = true;
      const transcript = event.results[0][0].transcript.trim();
      setIsListening(false);
      if (transcript) sendMessageRef.current?.(transcript);
    };

    recognition.onerror = (e) => {
      // "no-speech" is a normal timeout — don't show an error or flash the UI
      if (e.error !== "no-speech") {
        console.warn("Speech recognition error:", e.error);
        if (e.error === "not-allowed") {
          setError("Microphone access denied. Check browser permissions.");
          isVoiceModeRef.current = false;
          setIsVoiceMode(false);
          setIsListening(false);
        }
      }
      gotResult = true; // treat as "handled" so onend doesn't double-fire
      setIsListening(false);
    };

    recognition.onend = () => {
      // If we're restarting due to no-speech timeout, keep isListening=true
      // so the button label doesn't flicker between "Listening" and "Live"
      if (!gotResult && isVoiceModeRef.current && !loadingRef.current && ttsQueueCountRef.current === 0) {
        // Restart immediately — do NOT toggle isListening to avoid visual flicker
        setTimeout(() => startListeningForVoiceMode(), 300);
      } else if (gotResult) {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      console.warn("Could not start recognition:", e.message);
    }
  };

  // ── AUTH + LOAD HISTORY ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/");
        return;
      }
      setSession(session);

      // Load chat history from server (source of truth — not localStorage)
      try {
        const params = new URLSearchParams({
          userId:      session.user.id,
          accessToken: session.access_token,
        });
        const res = await fetch(`/api/agent/history?${params}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(data.messages.map((m) => ({
              role:      m.role,
              content:   m.content,
              toolsUsed: m.tools_used || [],
            })));
          }
        }
      } catch {
        // Non-critical — user just starts with empty chat
      }

      setPageLoading(false);
    });
  }, [router]);

  // ── AUTO-SCROLL ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── PERSIST HISTORY ────────────────────────────────────────────────────────
  // History is now saved server-side in Supabase by the API route.
  // localStorage is no longer used — this effect is intentionally removed.

  const clearHistory = async () => {
    if (!confirm("Clear all conversation history?")) return;
    try {
      await fetch("/api/agent/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId:      session.user.id,
          accessToken: session.access_token,
        }),
      });
    } catch {
      // Best-effort — clear UI regardless
    }
    setMessages([]);
  };

  // ── SEND MESSAGE ───────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    // Use loadingRef.current (not state) so voice callbacks always read the live value
    if ((!userText && !selectedImage) || loadingRef.current) return;
    const imageToSend = selectedImage;
    setInput("");
    setSelectedImage(null);
    setError("");

    // Add user bubble + empty model placeholder immediately
    setMessages((prev) => [
      ...prev,
      { role: "user",  content: userText, imagePreview: imageToSend?.preview || null },
      { role: "model", content: "", toolsUsed: [], streaming: true },
    ]);
    setLoading(true);
    loadingRef.current = true;
    // Reset TTS streaming state for this new message turn
    ttsSentenceBufferRef.current = "";
    ttsQueueCountRef.current = 0;
    window.speechSynthesis?.cancel();

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:     userText || "What food is in this image? Analyze the nutrition.",
          userId:      session.user.id,
          accessToken: session.access_token,
          imageBase64:  imageToSend?.base64  || null,
          imageMimeType: imageToSend?.mimeType || null,
        }),
      });

      // Validation / rate-limit errors come back as plain JSON (non-ok status)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Please try again.");
        setMessages((prev) => prev.slice(0, -2)); // remove both placeholder + user msg
        return;
      }

      // ── Read the SSE stream ──────────────────────────────────────────────
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";   // keep any incomplete trailing chunk

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "tool") {
              // Append tool badge to the streaming placeholder
              setMessages((prev) => {
                const arr  = [...prev];
                const last = { ...arr[arr.length - 1] };
                last.toolsUsed = [...(last.toolsUsed || []), event.name];
                arr[arr.length - 1] = last;
                return arr;
              });

            } else if (event.type === "chunk") {
              // Append text chunk — triggers re-render with updated content
              setMessages((prev) => {
                const arr  = [...prev];
                const last = { ...arr[arr.length - 1] };
                last.content = (last.content || "") + event.text;
                arr[arr.length - 1] = last;
                return arr;
              });

              // ── Streaming TTS: speak each sentence as it arrives ──────
              if (ttsEnabledRef.current) {
                ttsSentenceBufferRef.current += event.text;
                // Extract all complete sentences (end with . ! ? or newline)
                const sentenceRegex = /[^.!?\n]*[.!?\n]+/g;
                let match;
                let lastIdx = 0;
                while ((match = sentenceRegex.exec(ttsSentenceBufferRef.current)) !== null) {
                  const sentence = match[0].trim();
                  if (sentence.length > 3) speakChunk(sentence);
                  lastIdx = sentenceRegex.lastIndex;
                }
                // Keep remainder (incomplete sentence) in the buffer
                ttsSentenceBufferRef.current = ttsSentenceBufferRef.current.slice(lastIdx);
              }

            } else if (event.type === "done") {
              // Mark streaming finished — removes cursor, shows copy button
              setMessages((prev) => {
                const arr  = [...prev];
                const last = { ...arr[arr.length - 1] };
                last.streaming = false;
                arr[arr.length - 1] = last;
                return arr;
              });
              // Flush any sentence fragment still in the TTS buffer
              if (ttsEnabledRef.current && ttsSentenceBufferRef.current.trim()) {
                speakChunk(ttsSentenceBufferRef.current.trim());
                ttsSentenceBufferRef.current = "";
              }
              // Voice mode with TTS disabled: still restart listening after response
              if (isVoiceModeRef.current && !ttsEnabledRef.current) {
                setTimeout(() => startListeningForVoiceMode(), 500);
              }

            } else if (event.type === "error") {
              setError(event.message || "Something went wrong. Please try again.");
              setMessages((prev) => prev.slice(0, -2));
              return;
            }
          } catch {
            // Malformed SSE line — skip silently
          }
        }
      }

    } catch {
      setError("Network error. Please check your connection.");
      setMessages((prev) => prev.slice(0, -2));
    } finally {
      setLoading(false);
      loadingRef.current = false;
      // In voice mode, focus stays on voice — don't steal focus to textarea
      if (!isVoiceModeRef.current) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  };

  // Keep ref current on every render so voice recognition callbacks never use a stale closure
  sendMessageRef.current = sendMessage;

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090b", color: "#666" }}>
        <Loader2 size={28} className="animate-spin" />
      </div>
    );
  }

  const isEmpty = messages.length === 0;

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        height: "calc(100dvh - 62px)",
        display: "flex",
        flexDirection: "column",
        background: "#09090b",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: 720,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid #1f1f22",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          background: "#09090b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "#1f1f22",
              border: "1px solid #333",
              color: "#fff",
              cursor: "pointer",
              padding: 8,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
            }}
          >
            <ArrowLeft size={18} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bot size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1.2 }}>
                NutriCoach
              </div>
              <div style={{ fontSize: "0.72rem", color: "#22c55e", display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                AI Agent · Live Data Access
              </div>
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Full voice page link */}
          <button
            onClick={() => router.push("/voice")}
            title="Open full voice conversation mode"
            style={{
              background: "linear-gradient(135deg,#3b82f620,#8b5cf620)",
              border: "1px solid #8b5cf644",
              color: "#a78bfa",
              cursor: "pointer",
              padding: "6px 10px",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: "0.72rem",
              fontWeight: 600,
            }}
          >
            <Mic size={13} /> Voice
          </button>

          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              style={{
                background: "transparent",
                border: "1px solid #333",
                color: "#666",
                cursor: "pointer",
                padding: "6px 10px",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: "0.78rem",
              }}
            >
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── MESSAGES AREA ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Empty state */}
        {isEmpty && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "20px 0",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
                boxShadow: "0 0 40px rgba(59, 130, 246, 0.3)",
              }}
            >
              <Sparkles size={28} color="#fff" />
            </div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: 6 }}>
              NutriCoach
            </h2>
            <p style={{ color: "#666", fontSize: "0.9rem", maxWidth: 300, lineHeight: 1.5, marginBottom: 28 }}>
              Your AI nutrition agent. It reads your real logs, calculates your gaps, and gives you grounded advice — not guesses.
            </p>

            {/* Capability pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 28 }}>
              {Object.values(TOOL_META).map((meta) => {
                const Icon = meta.icon;
                return (
                  <div
                    key={meta.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: "0.72rem",
                      color: meta.color,
                      background: `${meta.color}15`,
                      border: `1px solid ${meta.color}35`,
                      padding: "4px 10px",
                      borderRadius: 20,
                    }}
                  >
                    <Icon size={11} />
                    {meta.label}
                  </div>
                );
              })}
            </div>

            {/* Starter prompts */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                width: "100%",
                maxWidth: 520,
              }}
            >
              {STARTERS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.text}
                    onClick={() => sendMessage(s.text)}
                    style={{
                      background: "#1f1f22",
                      border: "1px solid #2a2a2e",
                      color: "#ccc",
                      cursor: "pointer",
                      padding: "12px 14px",
                      borderRadius: 12,
                      textAlign: "left",
                      fontSize: "0.82rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      lineHeight: 1.3,
                      transition: "border-color 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2e")}
                  >
                    <Icon size={14} color="#3b82f6" style={{ flexShrink: 0 }} />
                    {s.text}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── WEEKLY REPORT CARD ── */}
        {weeklyReport && (
          <div
            style={{
              background: "linear-gradient(135deg, #0f2a0f, #1a3a1a)",
              border: "1px solid #22c55e44",
              borderRadius: 16,
              padding: "16px 18px",
              marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart2 size={16} color="#22c55e" />
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#22c55e" }}>
                  Weekly Insight · {weeklyReport.weekStart}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Adherence score ring */}
                <div style={{
                  background: weeklyReport.score >= 70 ? "#22c55e22" : weeklyReport.score >= 40 ? "#f59e0b22" : "#ef444422",
                  border: `1px solid ${weeklyReport.score >= 70 ? "#22c55e" : weeklyReport.score >= 40 ? "#f59e0b" : "#ef4444"}`,
                  color: weeklyReport.score >= 70 ? "#22c55e" : weeklyReport.score >= 40 ? "#f59e0b" : "#ef4444",
                  borderRadius: 20,
                  padding: "2px 10px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                }}>
                  {weeklyReport.score}/100
                </div>
                <button
                  onClick={() => setWeeklyReport(null)}
                  style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: 0 }}
                >
                  ✕
                </button>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#ccc", lineHeight: 1.6 }}>
              {weeklyReport.insight}
            </p>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
              }}
            >
              {/* Avatar row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 8,
                  flexDirection: isUser ? "row-reverse" : "row",
                  maxWidth: "88%",
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: isUser
                      ? "#27272a"
                      : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isUser ? (
                    <User size={14} color="#888" />
                  ) : (
                    <Bot size={14} color="#fff" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  style={{
                    background: isUser ? "#1d4ed8" : "#1f1f22",
                    color: "#fff",
                    padding: "12px 16px",
                    borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    fontSize: "0.9rem",
                    lineHeight: 1.55,
                    border: isUser ? "none" : "1px solid #2a2a2e",
                    maxWidth: "100%",
                    wordBreak: "break-word",
                  }}
                >
                  {/* Tool badges above AI message */}
                  {!isUser && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <ToolBadges tools={msg.toolsUsed} />
                  )}

                  {isUser ? (
                    <span>
                      {msg.imagePreview && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={msg.imagePreview}
                          alt="Attached"
                          style={{ display: "block", maxWidth: "100%", maxHeight: 200, borderRadius: 10, marginBottom: msg.content ? 8 : 0, objectFit: "cover" }}
                        />
                      )}
                      {msg.content}
                    </span>
                  ) : msg.streaming && !msg.content ? (
                    // Tool-calling phase: no text yet — show inline thinking state
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#666", fontSize: "0.85rem" }}>
                      <Loader2 size={14} className="animate-spin" color="#3b82f6" />
                      <span>{msg.toolsUsed?.length > 0 ? "Processing…" : "Thinking…"}</span>
                    </div>
                  ) : (
                    <RenderMessage text={msg.content} streaming={msg.streaming} />
                  )}

                  {/* Copy button — hidden while streaming */}
                  {!isUser && !msg.streaming && (
                    <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => copyMessage(msg.content, i)}
                        title="Copy response"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: copiedIndex === i ? "#22c55e" : "#555",
                          cursor: "pointer",
                          padding: "2px 4px",
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: "0.7rem",
                          transition: "color 0.2s",
                        }}
                      >
                        {copiedIndex === i ? <Check size={12} /> : <Copy size={12} />}
                        {copiedIndex === i ? "Copied" : "Copy"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator — only shown while loading but before the
            streaming placeholder has been added to messages */}
        {loading && !messages.some((m) => m.streaming) && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Bot size={14} color="#fff" />
            </div>
            <div
              style={{
                background: "#1f1f22",
                border: "1px solid #2a2a2e",
                padding: "12px 16px",
                borderRadius: "18px 18px 18px 4px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#666",
                fontSize: "0.85rem",
              }}
            >
              <Loader2 size={14} className="animate-spin" color="#3b82f6" />
              <span style={{ color: "#888" }}>Agent is working</span>
              <span style={{ animation: "pulse 1.5s infinite", color: "#3b82f6" }}>•••</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid #ef4444",
              color: "#ef4444",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: "0.85rem",
              textAlign: "center",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── INPUT BAR ── */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #1f1f22",
          background: "#09090b",
          flexShrink: 0,
        }}
      >
        {/* Image preview strip */}
        {selectedImage && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedImage.preview} alt="Preview" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", border: "1px solid #333" }} />
              <button
                onClick={() => setSelectedImage(null)}
                style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", border: "none", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
              >
                <X size={10} color="#fff" />
              </button>
            </div>
            <span style={{ fontSize: "0.72rem", color: "#666" }}>Image attached — ask me anything about it</span>
          </div>
        )}
        <div
          className="agent-input-bar"
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            background: "#1f1f22",
            border: "1px solid #333",
            borderRadius: 16,
            padding: "8px 8px 8px 16px",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder={selectedImage ? "Ask about this image…" : "Ask your coach anything…"}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#fff",
              fontSize: "0.95rem",
              resize: "none",
              lineHeight: 1.5,
              padding: 0,
              minHeight: 24,
              maxHeight: 120,
              fontFamily: "inherit",
            }}
          />
          {/* Hidden image file input */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImagePick}
            style={{ display: "none" }}
          />
          {/* Image attach button */}
          <button
            onClick={() => imageInputRef.current?.click()}
            title="Attach image"
            style={{
              background: selectedImage ? "#3b82f620" : "transparent",
              border: `1px solid ${selectedImage ? "#3b82f6" : "#333"}`,
              color: selectedImage ? "#3b82f6" : "#555",
              cursor: "pointer",
              padding: 9,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.2s",
            }}
          >
            <ImageIcon size={16} />
          </button>
          <button
            onClick={() => sendMessage()}
            disabled={(!input.trim() && !selectedImage) || loading}
            style={{
              background: (input.trim() || selectedImage) && !loading
                ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                : "#27272a",
              border: "none",
              color: (input.trim() || selectedImage) && !loading ? "#fff" : "#444",
              cursor: (input.trim() || selectedImage) && !loading ? "pointer" : "not-allowed",
              padding: 10,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.2s",
            }}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <div style={{ fontSize: "0.7rem", color: "#444" }}>
            Agent reads your live data · Image · Web Search · Voice · Powered by Gemini
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: input.length > 900 ? "#ef4444" : "#444",
              transition: "color 0.2s",
            }}
          >
            {input.length > 0 ? `${input.length}/1000` : ""}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        textarea::placeholder { color: #444; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      `}</style>
    </div>
  );
}
