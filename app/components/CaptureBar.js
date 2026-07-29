"use client";

/**
 * CaptureBar — the three fast ways to log, surfaced as home-screen heroes.
 *   📸 Snap  — camera → AI reads the plate (routes to the AI coach photo flow)
 *   🎤 Say   — voice → agent → auto-logged (your existing /voice pipeline)
 *   🔍 Search— the classic search, one tap away
 *
 * Snap and Say aren't new AI — they surface pipelines the app already has but
 * that were buried on separate screens.
 */

import { useRef } from "react";
import { Camera, Mic, Search } from "lucide-react";

export default function CaptureBar({ onSnap, onVoice, onSearch }) {
  const fileRef = useRef(null);

  return (
    <section style={{ padding: "12px 20px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 8 }}>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            border: "none",
            fontFamily: "inherit",
            cursor: "pointer",
            borderRadius: 16,
            padding: "13px 8px",
            color: "#fff",
            fontWeight: 700,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            background: "linear-gradient(135deg,#7c3aed,#4338ca)",
            boxShadow: "0 8px 22px -10px rgba(124,58,237,0.7)",
          }}
        >
          <Camera size={19} />
          <span style={{ fontSize: "0.72rem" }}>Snap plate</span>
          <span style={{ fontSize: "0.54rem", color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
            AI reads it
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onSnap?.(file);
              e.target.value = "";
            }}
          />
        </button>

        <button
          onClick={onVoice}
          style={ghost}
        >
          <Mic size={18} color="#a1a1aa" />
          <span style={{ fontSize: "0.72rem" }}>Say it</span>
        </button>

        <button onClick={onSearch} style={ghost}>
          <Search size={18} color="#a1a1aa" />
          <span style={{ fontSize: "0.72rem" }}>Search</span>
        </button>
      </div>
    </section>
  );
}

const ghost = {
  border: "1px solid #2a2f3a",
  background: "#14171f",
  fontFamily: "inherit",
  cursor: "pointer",
  borderRadius: 16,
  padding: "13px 8px",
  color: "#fff",
  fontWeight: 700,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center", // vertically center — Snap tile is taller (2 lines)
  gap: 6,
};
