"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import { dayKey } from "../lib/day";
import { defaultMeal } from "../lib/mealPeriod";
import { compressImage } from "../lib/image";
import { Send, Loader2, Trash2, Copy, Check, Mic, ChefHat, ImageIcon, X, Undo2 } from "lucide-react";

// What the coach did, in plain words (shown as one quiet line under a reply).
const TOOL_WORDS = {
  get_todays_logs: "read today’s log",
  get_logs_for_days: "looked at past days",
  get_macro_gap: "worked out what’s left",
  search_food_database: "searched foods",
  get_weight_trend: "checked your weight",
  get_user_profile: "checked your goals",
  log_food_item: "logged food",
  get_streak: "checked your streak",
  update_goal: "updated your goal",
  generate_meal_plan: "built a meal plan",
  get_medical_context: "read your blood work",
  save_food_to_database: "saved a food",
  search_web: "searched the web",
};

const STARTERS = [
  "What should I eat for dinner?",
  "How was my week?",
  "How much protein is left today?",
  "Log 2 rotis and a bowl of dal",
  "Am I losing weight?",
];

// Light markdown: **bold**, bullets, blank lines.
function RenderMessage({ text, streaming }) {
  const lines = text.split("\n");
  return (
    <div style={{ lineHeight: 1.6 }}>
      {lines.map((line, i) => {
        const t = line.trim();
        const bullet = t.startsWith("* ") || t.startsWith("- ");
        const body = bullet ? t.slice(2) : line;
        const parts = body.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? <strong key={j} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong> : part,
        );
        if (bullet) {
          return (
            <div key={i} style={{ display: "flex", gap: 10, margin: "4px 0" }}>
              <span style={{ color: "var(--text-faint)", flexShrink: 0 }}>•</span>
              <span>{parts}</span>
            </div>
          );
        }
        if (t === "") return <div key={i} style={{ height: 8 }} />;
        return <div key={i}>{parts}</div>;
      })}
      {streaming && <span className="coach-caret" />}
    </div>
  );
}

function ToolLine({ tools }) {
  if (!tools?.length) return null;
  const words = [...new Set(tools.map((t) => TOOL_WORDS[t.replace(/:error$/, "")]).filter(Boolean))];
  if (!words.length) return null;
  const line = words.join(" · ");
  return <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 6 }}>{line.charAt(0).toUpperCase() + line.slice(1)}</div>;
}

// "Logged to Lunch" receipt with per-item and all-at-once Undo.
function Receipt({ items, onUndo }) {
  const live = items.filter((r) => !r.undone);
  const meals = [...new Set(items.map((r) => r.meal).filter(Boolean))];
  const kcal = live.reduce((n, r) => n + (Number(r.calories) || 0), 0);
  return (
    <div style={{ padding: "14px 16px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)", margin: "4px 0 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: live.length ? "var(--accent-text)" : "var(--text-muted)" }}>
        <Check size={16} strokeWidth={2.6} /> {live.length ? `Logged to ${meals.join(" & ") || "today"}` : "Removed"}
      </div>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((r) => (
          <div key={r.id || r.food} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: r.undone ? "var(--text-faint)" : "var(--text)", textDecoration: r.undone ? "line-through" : "none" }}>
            <span style={{ flex: 1, minWidth: 0, textTransform: "capitalize" }}>{r.food} × {r.qty}</span>
            <span style={{ color: "var(--text-muted)" }}>{Math.round(r.calories || 0)}</span>
            {!r.undone && r.id && (
              <button onClick={() => onUndo([r.id])} aria-label={`Undo ${r.food}`} style={{ background: "none", border: "none", padding: 4, color: "var(--text-faint)", cursor: "pointer", display: "grid" }}>
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      {live.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, fontSize: 13, color: "var(--text-muted)" }}>
          <span>{Math.round(kcal)} kcal · saved</span>
          {live.some((r) => r.id) && (
            <button onClick={() => onUndo(live.filter((r) => r.id).map((r) => r.id))} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 4, color: "var(--accent-text)", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              <Undo2 size={15} /> {live.length > 1 ? "Undo all" : "Undo"}
            </button>
          )}
        </div>
      )}
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
  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so the same file can be re-picked
    if (!file) return;
    // Guardrail + downscale: validates it's an image and shrinks big gallery
    // photos so the request stays fast and small.
    try {
      const { base64, mimeType, dataUrl } = await compressImage(file);
      setSelectedImage({ base64, mimeType, preview: dataUrl });
    } catch (err) {
      setError(err?.message || "Could not use that image.");
    }
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

      // ?ask=… (e.g. "Ask Coach about this report") pre-fills the box; the user
      // still reviews and sends it. Strip it so a refresh doesn't refill.
      const ask = new URLSearchParams(window.location.search).get("ask");
      if (ask) {
        setInput(ask.slice(0, 500));
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }

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
          dayKey:      dayKey(),
          meal:        defaultMeal(), // local meal; the server clock is UTC
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

            } else if (event.type === "logged") {
              // Receipt card on this reply, with the row id for Undo.
              setMessages((prev) => {
                const arr  = [...prev];
                const last = { ...arr[arr.length - 1] };
                last.receipts = [...(last.receipts || []), { id: event.id, food: event.food, qty: event.qty, meal: event.meal || defaultMeal(), calories: event.calories }];
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

  // ── UNDO a Coach log (exact rows by id) ───────────────────────────────────
  const undoLogs = async (msgIndex, ids) => {
    const mark = (undone) =>
      setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, receipts: m.receipts.map((r) => (ids.includes(r.id) ? { ...r, undone } : r)) } : m)));
    mark(true);
    const { error: delErr } = await supabase.from("food_logs").delete().in("id", ids).eq("user_id", session.user.id);
    if (delErr) {
      mark(false);
      setError("Couldn’t undo that — remove it from Today instead.");
    }
  };

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div style={{ height: "100dvh", display: "grid", placeItems: "center", background: "var(--bg)" }}>
        <Loader2 size={24} color="var(--text-muted)" className="animate-spin" />
      </div>
    );
  }

  const isEmpty = messages.length === 0;
  const canSend = (input.trim() || selectedImage) && !loading;
  const lastIsCoach = messages.length > 0 && messages[messages.length - 1].role === "model" && !loading;
  const tool = { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 99, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" };
  const chip = { padding: "8px 14px", borderRadius: 99, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontFamily: "inherit", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 };

  return (
    <div className="coach-root" style={{ height: "calc(100dvh - 64px - env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--text)", maxWidth: 720, margin: "0 auto", width: "100%" }}>
      {/* ── HEADER ── tab root: no back button */}
      <header style={{ padding: "calc(14px + env(safe-area-inset-top, 0px)) 20px 10px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: -0.4 }}>Coach</h1>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 2 }}>Reads your log, goals and blood work</div>
          </div>
          {messages.length > 0 && (
            <button onClick={clearHistory} aria-label="Clear conversation" title="Clear conversation" style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <div className="chip-scroll" style={{ display: "flex", gap: 8, marginTop: 14, overflowX: "auto" }}>
          <button onClick={() => router.push("/voice")} style={tool}><Mic size={15} color="var(--accent-text)" /> Voice</button>
          <button onClick={() => imageInputRef.current?.click()} style={tool}><ImageIcon size={15} color="var(--accent-text)" /> Photo</button>
          <button onClick={() => router.push("/recipes")} style={tool}><ChefHat size={15} color="var(--accent-text)" /> Recipes</button>
        </div>
      </header>

      {/* ── MESSAGES ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 12px", display: "flex", flexDirection: "column", gap: 18, borderTop: "1px solid var(--border)" }}>
        {isEmpty && (
          <div style={{ margin: "auto 0", padding: "24px 0" }}>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.2 }}>Ask about your day</div>
            <p style={{ margin: "6px 0 18px", fontSize: 15, lineHeight: 1.5, color: "var(--text-muted)" }}>
              Coach sees what you’ve logged, your targets and your blood reports — so answers are about you, not averages. It can log food for you too.
            </p>
            <div style={{ borderRadius: 16, border: "1px solid var(--border)" }}>
              {STARTERS.map((t, i) => (
                <button key={t} onClick={() => sendMessage(t)} style={{ width: "100%", padding: "13px 16px", border: "none", borderTop: i ? "1px solid var(--border)" : "none", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 15, textAlign: "left", cursor: "pointer" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          if (isUser) {
            return (
              <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: "18px 18px 6px 18px", background: "var(--surface-highlight)", fontSize: 15, lineHeight: 1.5, wordBreak: "break-word" }}>
                  {msg.imagePreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={msg.imagePreview} alt="Attached" style={{ display: "block", maxWidth: "100%", maxHeight: 200, borderRadius: 12, marginBottom: msg.content ? 8 : 0, objectFit: "cover" }} />
                  )}
                  {msg.content}
                </div>
              </div>
            );
          }
          return (
            <div key={i} style={{ maxWidth: "100%", fontSize: 15, wordBreak: "break-word" }}>
              <ToolLine tools={msg.toolsUsed} />
              {msg.receipts?.length > 0 && <Receipt items={msg.receipts} onUndo={(ids) => undoLogs(i, ids)} />}
              {msg.streaming && !msg.content ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 14 }}>
                  <Loader2 size={15} className="animate-spin" /> {msg.toolsUsed?.length ? "Working on it…" : "Thinking…"}
                </div>
              ) : (
                <RenderMessage text={msg.content} streaming={msg.streaming} />
              )}
              {!msg.streaming && msg.content && (
                <button onClick={() => copyMessage(msg.content, i)} style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", padding: "4px 0", color: copiedIndex === i ? "var(--accent-text)" : "var(--text-faint)", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
                  {copiedIndex === i ? <Check size={13} /> : <Copy size={13} />} {copiedIndex === i ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          );
        })}

        {loading && !messages.some((m) => m.streaming) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 14 }}>
            <Loader2 size={15} className="animate-spin" /> Thinking…
          </div>
        )}

        {error && (
          <div role="alert" style={{ padding: "12px 14px", borderRadius: 12, background: "var(--danger-soft)", color: "var(--danger)", fontSize: 14 }}>
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── INPUT ── */}
      <div style={{ padding: "8px 16px 12px", flexShrink: 0, background: "var(--bg)" }}>
        {lastIsCoach && !input && !selectedImage && (
          <div className="chip-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 10 }}>
            {["What should I eat next?", "How was my week?", "Explain my blood report"].map((t) => (
              <button key={t} onClick={() => sendMessage(t)} style={chip}>{t}</button>
            ))}
          </div>
        )}
        {selectedImage && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedImage.preview} alt="Attached photo" style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", border: "1px solid var(--border)" }} />
              <button onClick={() => setSelectedImage(null)} aria-label="Remove photo" style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: "var(--surface-highlight)", color: "var(--text)", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}>
                <X size={12} />
              </button>
            </div>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Photo attached — ask about it, or say “log this”</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: "6px 6px 6px 16px", borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder={selectedImage ? "Ask about this photo…" : "Ask or log a meal…"}
            aria-label="Message Coach"
            rows={1}
            maxLength={1000}
            style={{ flex: 1, alignSelf: "center", background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 16, resize: "none", lineHeight: 1.5, padding: "6px 0", minHeight: 24, maxHeight: 120, fontFamily: "inherit" }}
          />
          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImagePick} style={{ display: "none" }} />
          <button
            onClick={() => sendMessage()}
            disabled={!canSend}
            aria-label="Send"
            style={{ width: 40, height: 40, borderRadius: 12, border: "none", background: canSend ? "var(--accent)" : "var(--surface-highlight)", color: canSend ? "var(--on-accent)" : "var(--text-faint)", display: "grid", placeItems: "center", cursor: canSend ? "pointer" : "not-allowed", flexShrink: 0 }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>

      <style>{`
        .coach-caret { display: inline-block; width: 2px; height: 1em; background: var(--accent-text); margin-left: 2px; vertical-align: text-bottom; animation: coach-blink 1s step-end infinite; }
        @keyframes coach-blink { 50% { opacity: 0; } }
        textarea::placeholder { color: var(--text-faint); }
      `}</style>
    </div>
  );
}
