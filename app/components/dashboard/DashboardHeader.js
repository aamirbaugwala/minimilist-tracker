"use client";
import {
  Info,
  Bot,
} from "lucide-react";
const DashboardHeader = ({ chatOpen, setChatOpen, setShowResearch }) => (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: 0 }}>
            Performance
          </h1>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setChatOpen((v) => !v)}
            style={{
              background: chatOpen
                ? "linear-gradient(135deg, #8b5cf6, #3b82f6)"
                : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              padding: "8px 16px",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.9rem",
              fontWeight: 700,
              boxShadow: "0 4px 15px rgba(59, 130, 246, 0.3)",
            }}
          >
            <Bot size={18} /> {chatOpen ? "Close" : "Ask AI"}
          </button>

          <button
            onClick={() => setShowResearch(true)}
            style={{
              background: "#1f1f22",
              border: "1px solid #333",
              color: "#3b82f6",
              cursor: "pointer",
              padding: "8px 16px",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            <Info size={18} /> Logic
          </button>
        </div>
      </div>
);
export default DashboardHeader;
