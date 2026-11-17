"use client";

/**
 * CaptureBar (Direction A) — one primary action and two quick alternatives:
 *   [ + Add food ]  [📷 Snap a plate]  [🎤 Say it]
 * "Add food" opens the full logger sheet (search, recent, saved, browse).
 * Snap opens the camera/gallery (no `capture` attr → both choices on mobile).
 */

import { useRef } from "react";
import { Camera, Mic, Plus } from "lucide-react";

const square = {
  width: 52,
  height: 52,
  flexShrink: 0,
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};

export default function CaptureBar({ onSnap, onVoice, onSearch }) {
  const fileRef = useRef(null);

  return (
    <section aria-label="Log food" style={{ padding: "0 20px", display: "flex", gap: 8 }}>
      <button
        onClick={onSearch}
        style={{
          flex: 1,
          height: 52,
          border: "none",
          borderRadius: 14,
          background: "var(--accent)",
          color: "var(--on-accent)",
          font: "inherit",
          fontSize: 15,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          cursor: "pointer",
        }}
      >
        <Plus size={18} strokeWidth={2.4} /> Add food
      </button>

      <button aria-label="Snap a plate" title="Snap a plate" onClick={() => fileRef.current?.click()} style={square}>
        <Camera size={20} strokeWidth={1.8} />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSnap?.(file);
          e.target.value = "";
        }}
      />

      <button aria-label="Say what you ate" title="Say what you ate" onClick={onVoice} style={square}>
        <Mic size={20} strokeWidth={1.8} />
      </button>
    </section>
  );
}
