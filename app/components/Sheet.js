"use client";

/**
 * Sheet — the one bottom-sheet pattern for every pop-up (Direction A):
 * dimmed backdrop, slide-up panel with a handle, title + close, scrollable
 * body and an optional sticky footer. Esc / backdrop tap close it.
 *
 * zIndex defaults to 10000 so sheets opened from the food logger (z 9000)
 * stack above it; pages pass a lower value when that doesn't matter.
 */

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export const sheetInput = {
  height: 48,
  padding: "0 14px",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: 15,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
export const sheetLabel = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--text-muted)" };
export const primaryBtn = {
  height: 50,
  padding: "0 22px",
  borderRadius: 14,
  border: "none",
  background: "var(--accent)",
  color: "var(--on-accent)",
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
export const secondaryBtn = {
  height: 50,
  padding: "0 18px",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: 15,
  cursor: "pointer",
};
export const dangerBtn = { ...secondaryBtn, border: "none", background: "var(--danger-soft)", color: "var(--danger)", fontWeight: 600 };

export default function Sheet({ title, subtitle, onClose, children, footer, zIndex = 10000, tall = false, label }) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      className="modal-overlay"
      style={{ zIndex, padding: 0, background: "var(--scrim)" }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label || (typeof title === "string" ? title : undefined)}
        style={{
          width: "100%",
          maxWidth: 600,
          maxHeight: "92dvh",
          height: tall ? "92dvh" : "auto",
          display: "flex",
          flexDirection: "column",
          background: "var(--sheet)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderBottom: "none",
          borderRadius: "22px 22px 0 0",
          animation: "sheetUp 0.28s cubic-bezier(0.32,0.72,0,1)",
          overflow: "hidden",
        }}
      >
        <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 99, background: "var(--track)", margin: "10px auto 0", flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "12px 20px 4px", flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            {subtitle && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{subtitle}</div>}
            <h2 style={{ margin: subtitle ? "4px 0 0" : 0, fontSize: 20, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", display: "grid", placeItems: "center", cursor: "pointer" }}
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div style={{ flex: tall ? 1 : "0 1 auto", minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "12px 20px 20px" }}>{children}</div>
        {footer && (
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "12px 20px calc(16px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid var(--border)", background: "var(--sheet)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
