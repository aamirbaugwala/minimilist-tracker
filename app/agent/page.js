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
  MicOff,
  UtensilsCrossed,
  BarChart2,
} from "lucide-react";

// ─── TOOL BADGE METADATA ──────────────────────────────────────────────────────
const TOOL_META = {
  get_todays_logs:      { label: "Read Today's Logs",    icon: Utensils,       color: "#3b82f6" },
  get_logs_for_days:    { label: "Fetching History",      icon: TrendingUp,     color: "#8b5cf6" },
  get_macro_gap:        { label: "Calculating Gap",       icon: Zap,            color: "#f59e0b" },
  search_food_database: { label: "Searching Foods",       icon: Database,       color: "#10b981" },
  get_weight_trend:     { label: "Reading Weight Data",   icon: Scale,          color: "#ec4899" },
  get_user_profile:     { label: "Loading Your Profile",  icon: User,           color: "#6366f1" },
  log_food_item:        { label: "Logging Food",          icon: PenLine,        color: "#f97316" },
  get_streak:           { label: "Checking Streak",       icon: Flame,          color: "#ef4444" },
  update_goal:          { label: "Updating Your Goal",    icon: Target,         color: "#22c55e" },
  generate_meal_plan:   { label: "Building Meal Plan",    icon: UtensilsCrossed, color: "#06b6d4" },
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
function RenderMessage({ text }) {
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
    </div>
  );
}

// ─── TOOL ACTIVITY BADGE ──────────────────────────────────────────────────────
function ToolBadges({ tools }) {
  if (!tools || tools.length === 0) return null;
  const unique = [...new Set(tools)];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      {unique.map((tool) => {
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
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  // ── Weekly report state ────────────────────────────────────────────────────
  const [weeklyReport, setWeeklyReport] = useState(null); // { insight, score, weekStart }
  const [reportLoading, setReportLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const STORAGE_KEY = "nutricoach_history";

  // ── COPY MESSAGE ───────────────────────────────────────────────────────────
  const copyMessage = (text, index) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  // ── VOICE INPUT ────────────────────────────────────────────────────────────
  const toggleVoice = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("Voice input is not supported in this browser. Try Chrome.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
      setIsListening(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // ── WEEKLY REPORT ──────────────────────────────────────────────────────────
  const fetchWeeklyReport = async () => {
    if (!session || reportLoading) return;
    setReportLoading(true);
    setError("");
    try {
      const res = await fetch("/api/weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          accessToken: session.access_token,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Could not generate weekly report.");
        return;
      }
      setWeeklyReport(data);
    } catch {
      setError("Network error generating weekly report.");
    } finally {
      setReportLoading(false);
    }
  };

  // ── AUTH + LOAD HISTORY ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/");
        return;
      }
      setSession(session);

      // Load chat history from localStorage (keyed to user)
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY}_${session.user.id}`);
        if (stored) setMessages(JSON.parse(stored));
      } catch {}

      setPageLoading(false);
    });
  }, [router]);

  // ── AUTO-SCROLL ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── PERSIST HISTORY ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || messages.length === 0) return;
    try {
      // Only store last 40 messages to stay within localStorage limits
      const toStore = messages.slice(-40);
      localStorage.setItem(
        `${STORAGE_KEY}_${session.user.id}`,
        JSON.stringify(toStore)
      );
    } catch {}
  }, [messages, session]);

  const clearHistory = () => {
    if (!confirm("Clear all conversation history?")) return;
    setMessages([]);
    if (session) localStorage.removeItem(`${STORAGE_KEY}_${session.user.id}`);
  };

  // ── SEND MESSAGE ───────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput("");
    setError("");

    const userMsg = { role: "user", content: userText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    // Build history in the format the API expects
    // Exclude the last user message (it's the current one being sent)
    const historyForAPI = updatedMessages.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: historyForAPI,
          userId: session.user.id,
          accessToken: session.access_token,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Something went wrong. Please try again.");
        // Remove the user message on failure
        setMessages(messages);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content: data.reply,
          toolsUsed: data.toolsUsed || [],
        },
      ]);
    } catch {
      setError("Network error. Please check your connection.");
      setMessages(messages);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

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

        {/* Right side actions: Weekly Report + Clear */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={fetchWeeklyReport}
            disabled={reportLoading}
            title="Generate weekly AI insight"
            style={{
              background: weeklyReport ? "#1a2a1a" : "transparent",
              border: `1px solid ${weeklyReport ? "#22c55e" : "#333"}`,
              color: weeklyReport ? "#22c55e" : "#666",
              cursor: reportLoading ? "wait" : "pointer",
              padding: "6px 10px",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: "0.78rem",
            }}
          >
            {reportLoading ? <Loader2 size={13} className="animate-spin" /> : <BarChart2 size={13} />}
            Weekly
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
                    <span>{msg.content}</span>
                  ) : (
                    <RenderMessage text={msg.content} />
                  )}

                  {/* Copy button for AI messages */}
                  {!isUser && (
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

        {/* Typing indicator */}
        {loading && (
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
        <div
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
            placeholder="Ask your coach anything…"
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
          {/* Voice input button */}
          <button
            onClick={toggleVoice}
            title={isListening ? "Stop listening" : "Voice input"}
            style={{
              background: isListening ? "#ef444420" : "transparent",
              border: `1px solid ${isListening ? "#ef4444" : "#333"}`,
              color: isListening ? "#ef4444" : "#555",
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
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            style={{
              background: input.trim() && !loading
                ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                : "#27272a",
              border: "none",
              color: input.trim() && !loading ? "#fff" : "#444",
              cursor: input.trim() && !loading ? "pointer" : "not-allowed",
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
            Agent reads your live data · Powered by Gemini Function Calling
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
