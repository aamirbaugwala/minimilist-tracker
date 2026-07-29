"use client";

/**
 * RewardLayer — the dopamine. Floating "+kcal / +XP" bursts on every log, an
 * Undo toast (Phase 0 auto-save means there's no Save button to reassure the
 * user, so the toast does it), and a quest-complete celebration with confetti.
 *
 * All decorative motion respects prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";

const RM = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function Confetti({ fire }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!fire || RM()) return;
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    cv.width = window.innerWidth;
    cv.height = window.innerHeight;
    const colors = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6"];
    const ox = cv.width / 2;
    const oy = cv.height * 0.32;
    const parts = Array.from({ length: 90 }, (_, i) => {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 7;
      return {
        x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3,
        g: 0.18 + Math.random() * 0.12, s: 4 + Math.random() * 5,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        c: colors[i % colors.length], life: 60 + Math.random() * 30,
      };
    });
    let raf;
    const tick = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      let alive = false;
      for (const p of parts) {
        if (p.life <= 0) continue;
        alive = true;
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life--;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, p.life / 40); ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 1.6); ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [fire]);

  return (
    <canvas
      ref={ref}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9998 }}
    />
  );
}

// One floating burst. A fallback timer guarantees cleanup even when the
// animation never runs (prefers-reduced-motion) — otherwise onAnimationEnd
// never fires and the floats array grows without bound.
function Float({ f, onDone }) {
  const reduced = RM();
  useEffect(() => {
    const t = setTimeout(() => onDone(f.id), reduced ? 700 : 1100);
    return () => clearTimeout(t);
  }, [f.id, onDone, reduced]);

  return (
    <div
      onAnimationEnd={() => onDone(f.id)}
      style={{
        position: "absolute",
        left: f.dx,
        whiteSpace: "nowrap",
        fontWeight: 900,
        fontSize: "1.05rem",
        color: f.color,
        textShadow: "0 2px 10px rgba(0,0,0,0.6)",
        fontVariantNumeric: "tabular-nums",
        animation: reduced ? "none" : "nt-float 1s cubic-bezier(.2,.7,.3,1) both",
      }}
    >
      {f.text}
    </div>
  );
}

export default function RewardLayer({ floats, onFloatDone, toast, onUndo, celebration, onCelebrationDone }) {
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(onCelebrationDone, 1900);
    return () => clearTimeout(t);
  }, [celebration, onCelebrationDone]);

  return (
    <>
      {/* Floating +kcal / +XP — anchored under the header near the ring */}
      <div style={{ position: "fixed", top: 128, left: "50%", transform: "translateX(-50%)", pointerEvents: "none", zIndex: 9997 }}>
        {floats.map((f) => (
          <Float key={f.id} f={f} onDone={onFloatDone} />
        ))}
      </div>

      {/* Undo toast */}
      <div
        aria-hidden={!toast}
        role="status"
        style={{
          position: "fixed",
          left: 16, right: 16, bottom: "calc(84px + env(safe-area-inset-bottom, 0px))",
          maxWidth: 460, margin: "0 auto", zIndex: 9996,
          background: "#17171f", border: "1px solid #27272a", borderRadius: 15,
          padding: "11px 14px", display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 16px 40px -12px rgba(0,0,0,0.8)",
          // Fully hide when idle: the slide alone doesn't clear the bottom nav
          // (it sits ~84px up), so fade + drop out and disable pointer events.
          transform: toast ? "none" : "translateY(220%)",
          opacity: toast ? 1 : 0,
          transition: "transform .35s cubic-bezier(.2,.9,.3,1), opacity .3s ease",
          pointerEvents: toast ? "auto" : "none",
        }}
      >
        <span style={{ fontSize: "1.1rem" }}>✅</span>
        <span style={{ flex: 1, fontSize: "0.82rem", color: "#a1a1aa" }}>
          Logged <b style={{ color: "#fff" }}>{toast?.name}</b> · saved
        </span>
        <button
          onClick={onUndo}
          style={{ background: "none", border: "none", color: "#3b82f6", fontWeight: 800, fontFamily: "inherit", fontSize: "0.82rem", cursor: "pointer" }}
        >
          Undo
        </button>
      </div>

      {/* Quest-complete / level-up celebration */}
      {celebration && (
        <>
          <Confetti fire={celebration.id} />
          <div
            style={{
              position: "fixed", top: "38%", left: "50%", transform: "translate(-50%,-50%)",
              zIndex: 9999, textAlign: "center", pointerEvents: "none",
              background: "linear-gradient(160deg,#1a1622,#241b2e)",
              border: "1px solid rgba(245,158,11,0.4)", borderRadius: 22,
              padding: "22px 28px", boxShadow: "0 24px 60px -16px rgba(0,0,0,0.85)",
              animation: RM() ? "none" : "nt-badge 1.9s cubic-bezier(.2,.9,.3,1) both",
            }}
          >
            <div style={{ fontSize: "2.6rem" }}>{celebration.icon}</div>
            <div style={{ fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#f59e0b", fontWeight: 800, marginTop: 6 }}>
              {celebration.kind === "level" ? "Level up" : "Quest complete"}
            </div>
            <div style={{ fontWeight: 800, fontSize: "1rem", marginTop: 2, color: "#fff" }}>{celebration.title}</div>
          </div>
        </>
      )}

      <style>{`
        @keyframes nt-float { 0%{opacity:0;transform:translateY(0) scale(.7)} 25%{opacity:1;transform:translateY(-14px) scale(1.05)} 100%{opacity:0;transform:translateY(-64px) scale(1)} }
        @keyframes nt-badge { 0%{opacity:0;transform:translate(-50%,-50%) scale(.4)} 12%{opacity:1;transform:translate(-50%,-50%) scale(1.08)} 20%{transform:translate(-50%,-50%) scale(1)} 82%{opacity:1;transform:translate(-50%,-50%) scale(1)} 100%{opacity:0;transform:translate(-50%,-50%) scale(.9)} }
      `}</style>
    </>
  );
}
