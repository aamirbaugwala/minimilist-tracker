"use client";

/**
 * Login / landing (Direction A) — one screen: a short pitch with three
 * plain-language value points, then sign-in right below (side by side on
 * desktop). Google first; email code is the default, password is a link.
 * Same props as before; showAuth is no longer needed (no separate landing).
 */

import { Camera, MessageCircle, FileHeart, Loader2 } from "lucide-react";
import { sheetInput, primaryBtn } from "./Sheet";

const POINTS = [
  { Icon: Camera, title: "Snap, say or search", text: "Indian food first — roti, dal, poha, biryani" },
  { Icon: MessageCircle, title: "A coach that knows your day", text: "Ask what to eat next; it reads your log and goals" },
  { Icon: FileHeart, title: "Food advice from your blood work", text: "Upload a report; targets adjust safely" },
];

const linkBtn = { background: "none", border: "none", padding: 8, color: "var(--accent-text)", fontFamily: "inherit", fontSize: 14, fontWeight: 500, cursor: "pointer" };

function Submit({ loading, children }) {
  return (
    <button type="submit" disabled={loading} style={{ ...primaryBtn, width: "100%", opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {loading ? <Loader2 size={18} className="animate-spin" /> : children}
    </button>
  );
}

export default function AuthScreen({
  usePasswordLogin,
  setUsePasswordLogin,
  isCodeSent,
  setIsCodeSent,
  email,
  setEmail,
  password,
  setPassword,
  otp,
  setOtp,
  authLoading,
  signInWithGoogle,
  handlePasswordLogin,
  handleSendCode,
  handleVerifyCode,
}) {
  const emailInput = (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
      Email
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required style={sheetInput} />
    </label>
  );

  return (
    <main style={{ minHeight: "100dvh", background: "var(--bg)", color: "var(--text)" }}>
      <style>{`
        .auth-grid { max-width: 1040px; margin: 0 auto; box-sizing: border-box; padding: calc(32px + env(safe-area-inset-top, 0px)) 24px calc(32px + env(safe-area-inset-bottom, 0px)); display: grid; gap: 36px; }
        @media (min-width: 900px) { .auth-grid { grid-template-columns: 1.1fr 1fr; align-items: center; min-height: 100dvh; gap: 72px; padding-left: 48px; padding-right: 48px; } }
      `}</style>
      <div className="auth-grid">
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, background: "var(--accent)", color: "var(--on-accent)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 17 }}>N</span>
            <span style={{ fontSize: 17, fontWeight: 600 }}>NutriTrack</span>
          </div>
          <h1 style={{ margin: "36px 0 0", fontSize: "clamp(30px, 5vw, 44px)", fontWeight: 600, letterSpacing: -1, lineHeight: 1.12 }}>
            Eat well, without the guesswork.
          </h1>
          <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.55, color: "var(--text-muted)", maxWidth: 460 }}>
            Log a meal in seconds by photo, voice or search. Your coach and your blood reports keep the advice personal.
          </p>
          <ul style={{ listStyle: "none", margin: "28px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 18 }}>
            {POINTS.map(({ Icon, title, text }) => (
              <li key={title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span aria-hidden="true" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent-text)", display: "grid", placeItems: "center" }}>
                  <Icon size={19} />
                </span>
                <span>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{title}</span>
                  <span style={{ display: "block", fontSize: 14, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.45 }}>{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Sign in" style={{ padding: 24, borderRadius: 22, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 14 }}>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={authLoading}
            style={{ height: 50, borderRadius: 14, border: "1px solid var(--border)", background: "#FFFFFF", color: "#1F1F24", fontFamily: "inherit", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: authLoading ? "not-allowed" : "pointer", opacity: authLoading ? 0.6 : 1 }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
            </svg>
            Continue with Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--text-faint)" }}>
            <span style={{ flex: 1, height: 1, background: "var(--border)" }} /> or <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          {usePasswordLogin ? (
            <form onSubmit={handlePasswordLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {emailInput}
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
                Password
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required style={sheetInput} />
              </label>
              <Submit loading={authLoading}>Sign in</Submit>
              <button type="button" onClick={() => setUsePasswordLogin(false)} style={linkBtn}>Email me a code instead</button>
            </form>
          ) : !isCodeSent ? (
            <form onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {emailInput}
              <Submit loading={authLoading}>Email me a sign-in code</Submit>
              <button type="button" onClick={() => setUsePasswordLogin(true)} style={linkBtn}>Use a password instead</button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
                We sent a code to <strong style={{ color: "var(--text)", fontWeight: 600, overflowWrap: "anywhere" }}>{email}</strong>. It can take a minute — check spam too.
              </div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="Sign-in code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\s/g, ""))}
                placeholder="Code"
                maxLength={10}
                required
                autoFocus
                style={{ ...sheetInput, height: 56, textAlign: "center", fontSize: 22, letterSpacing: 6 }}
              />
              <Submit loading={authLoading}>Verify and continue</Submit>
              <button type="button" onClick={() => { setIsCodeSent(false); setOtp(""); }} style={linkBtn}>Use a different email</button>
            </form>
          )}

          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-faint)", textAlign: "center", lineHeight: 1.5 }}>
            Free. No card needed. Your health data stays private to you.
          </p>
        </section>
      </div>
    </main>
  );
}
