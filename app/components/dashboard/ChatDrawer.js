"use client";
import {
  X,
  Bot,
  Loader2,
} from "lucide-react";
import { RenderMessage, ToolBadges } from "./ui";
const ChatDrawer = ({
  chatOpen,
  setChatOpen,
  chatMessages,
  chatInput,
  setChatInput,
  chatLoading,
  sendChatMessage,
  chatEndRef,
}) => {
  if (!chatOpen) return null;
  return (
        <div style={{
          position: "fixed",
          bottom: 74,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(480px, calc(100vw - 24px))",
          height: 420,
          background: "#111113",
          border: "1px solid #2a2a2e",
          borderRadius: 20,
          boxShadow: "0 -4px 40px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          zIndex: 200,
          overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #222",
            background: "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                borderRadius: 8, padding: 6, display: "flex",
              }}>
                <Bot size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>NutriCoach</div>
                <div style={{ fontSize: "0.65rem", color: "#555" }}>Live · uses your real data</div>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{
            flex: 1, overflowY: "auto", padding: "12px 14px",
            display: "flex", flexDirection: "column", gap: 10,
          }}
            className="custom-scrollbar"
          >
            {chatMessages.length === 0 && (
              <div style={{ textAlign: "center", marginTop: 40 }}>
                <div style={{ fontSize: "1.8rem", marginBottom: 10 }}>🤖</div>
                <div style={{ color: "#444", fontSize: "0.85rem" }}>Ask me anything about your nutrition</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 14 }}>
                  {["What should I eat now?", "How's my protein?", "Am I on track today?"].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setChatInput(q); }}
                      style={{
                        background: "#1f1f22", border: "1px solid #333",
                        color: "#aaa", fontSize: "0.75rem", padding: "6px 10px",
                        borderRadius: 12, cursor: "pointer",
                      }}
                    >{q}</button>
                  ))}
                </div>
              </div>
            )}
            
            {chatMessages.map((msg, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "82%",
                  background: msg.role === "user"
                    ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                    : "#1f1f22",
                  border: msg.role === "user" ? "none" : "1px solid #2a2a2e",
                  color: "#fff",
                  padding: "9px 13px",
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  fontSize: "0.85rem",
                  lineHeight: 1.55,
                  wordBreak: "break-word",
                }}>
                  {msg.role !== "user" && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <ToolBadges tools={msg.toolsUsed} />
                  )}
                  {msg.role === "user" ? (
                    <span>{msg.content}</span>
                  ) : msg.streaming && !msg.content ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#666", fontSize: "0.85rem" }}>
                      <Loader2 size={14} className="animate-spin" color="#3b82f6" />
                      <span>{msg.toolsUsed?.length > 0 ? "Processing…" : "Thinking…"}</span>
                    </div>
                  ) : (
                    <RenderMessage text={msg.content} streaming={msg.streaming} />
                  )}
                </div>
              </div>
            ))}
            {chatLoading && !chatMessages.some(m => m.streaming) && (
               <div style={{ display: "flex", gap: 5, padding: "4px 0" }}>
                 {[0, 0.15, 0.3].map((delay, i) => (
                   <div key={i} style={{
                     width: 7, height: 7, borderRadius: "50%", background: "#3b82f6",
                     animation: `pulse 1s ease-in-out ${delay}s infinite`,
                   }} />
                 ))}
               </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{
            display: "flex", gap: 8, padding: "10px 12px",
            borderTop: "1px solid #222", flexShrink: 0, background: "#111113",
          }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
              placeholder="Ask NutriCoach..."
              style={{
                flex: 1, background: "#1f1f22", border: "1px solid #2a2a2e",
                borderRadius: 12, padding: "10px 14px", color: "#fff",
                fontSize: "0.875rem", outline: "none",
              }}
            />
            <button
              onClick={sendChatMessage}
              disabled={chatLoading || !chatInput.trim()}
              style={{
                background: chatLoading || !chatInput.trim()
                  ? "#1f1f22"
                  : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                border: "1px solid #333", borderRadius: 12,
                padding: "10px 16px", color: chatLoading || !chatInput.trim() ? "#444" : "#fff",
                cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                fontWeight: 700, fontSize: "0.85rem", transition: "all 0.2s",
              }}
            >
              {chatLoading ? <Loader2 size={16} className="animate-spin" /> : "Send"}
            </button>
          </div>
        </div>
  );
};
export default ChatDrawer;
