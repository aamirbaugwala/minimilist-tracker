"use client";

import {
  Flame,
  Loader2,
  Sparkles,
  Activity,
  Users,
  ChefHat,
  Target,
  Zap,
} from "lucide-react";

export default function AuthScreen({
  showAuth,
  setShowAuth,
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
  return (
      <div
        style={{
          minHeight: "100vh",
          background: "#08080a",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <style>{`
          @keyframes floatUp { 0% { opacity: 0; transform: translateY(24px); } 100% { opacity: 1; transform: translateY(0); } }
          @keyframes glow { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
          .auth-input { width: 100%; padding: 14px 16px; border-radius: 12px; border: 1px solid #27272a; background: #111113; color: #fff; font-size: 1rem; outline: none; box-sizing: border-box; transition: border-color 0.2s; }
          .auth-input:focus { border-color: #3b82f6; }
          .auth-input::placeholder { color: #444; }
          .auth-btn-primary { width: 100%; padding: 15px; border-radius: 12px; border: none; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; font-size: 1rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s; }
          .auth-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
          .auth-btn-primary:not(:disabled):hover { opacity: 0.9; }
          .feature-grid { 
    display: grid; 
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); 
    gap: 20px; 
    width: 100%; 
    padding: 0 16px; 
    box-sizing: border-box;
  }

  .feature-card { 
    background: #111113; 
    border: 1px solid #1e1e22; 
    border-radius: 20px; 
    padding: 24px; 
    display: flex; 
    flex-direction: column;
    transition: transform 0.2s;
  }

  /* Responsive Typography */
  h1 { font-size: clamp(2rem, 8vw, 4rem); }
  
  @media (max-width: 640px) {
    .feature-card { padding: 20px; }
    .hero-padding { padding: 40px 16px; }
    .landing-nav { padding: 14px 16px !important; }
    .auth-card { padding: 20px !important; border-radius: 16px !important; }
    .auth-wrap { padding: 16px !important; justify-content: flex-start !important; padding-top: 24px !important; }
    .auth-input { padding: 12px 14px; font-size: 0.95rem; }
    .auth-btn-primary { padding: 13px; font-size: 0.95rem; }
  }
        `}</style>

        {/* ── TOP NAV ─────────────────────────────────────────────────── */}
        <nav
          className="landing-nav"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 40px",
            borderBottom: "1px solid #1e1e22",
            background: "rgba(8,8,10,0.8)",
            backdropFilter: "blur(12px)",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontWeight: 800,
              fontSize: "1.2rem",
              letterSpacing: "-0.5px",
            }}
          >
            <Flame size={24} color="#3b82f6" fill="#3b82f6" /> NutriTrack
          </div>
          {!showAuth && (
            <button
              onClick={() => setShowAuth(true)}
              style={{
                background: "#fff",
                color: "#000",
                border: "none",
                padding: "10px 24px",
                borderRadius: 50,
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              Log In
            </button>
          )}
        </nav>

        {/* ── CONDITIONAL RENDER: LANDING VS AUTH ─────────────────────── */}
        {!showAuth ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              animation: "floatUp 0.6s ease both",
            }}
          >
            {/* Hero Section */}
            <div
              style={{
                maxWidth: 840,
                textAlign: "center",
                padding: "80px 24px 60px",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  background: "rgba(236,72,153,0.1)",
                  border: "1px solid rgba(236,72,153,0.3)",
                  color: "#ec4899",
                  padding: "6px 16px",
                  borderRadius: 50,
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  marginBottom: 24,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                }}
              >
                Clinical-Grade Nutrition Intelligence
              </div>
              <h1
                style={{
                  fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                  fontWeight: 900,
                  margin: "0 0 24px",
                  letterSpacing: "-1.5px",
                  lineHeight: 1.1,
                }}
              >
                Stop Guessing. <br />
                <span
                  style={{
                    background: "linear-gradient(135deg, #3b82f6, #ec4899)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Start Healing.
                </span>
              </h1>
              <p
                style={{
                  color: "#888",
                  fontSize: "1.15rem",
                  margin: "0 auto 40px",
                  maxWidth: 680,
                  lineHeight: 1.6,
                }}
              >
                NutriTrack merges your clinical blood work with real-time macro tracking. Talk to your AI coach, compete with friends, and let an agentic engine plan your meals—all in one immersive ecosystem.
              </p>
              <button
                onClick={() => setShowAuth(true)}
                style={{
                  background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                  color: "#fff",
                  border: "none",
                  padding: "18px 40px",
                  borderRadius: 50,
                  fontWeight: 800,
                  fontSize: "1.1rem",
                  cursor: "pointer",
                  boxShadow: "0 10px 30px rgba(59,130,246,0.3)",
                }}
              >
                Enter Platform →
              </button>
            </div>

            {/* Responsive Feature Grid */}
<div className="feature-grid" style={{ maxWidth: 1200, margin: "0 auto 80px" }}>
  
  {/* Card 1: Agentic Coach */}
  <div className="feature-card">
    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(139,92,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
      <Sparkles size={20} color="#8b5cf6" />
    </div>
    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 8px" }}>Conversational AI Coach</h3>
    <p style={{ color: "#666", fontSize: "0.9rem", lineHeight: 1.5, margin: 0 }}>Engage in hands-free, real-time voice conversations with an agent that understands your live data, goals, and unique health context.</p>
  </div>

  {/* Card 2: Biomarker Analysis */}
  <div className="feature-card">
    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(236,72,153,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
      <Activity size={20} color="#ec4899" />
    </div>
    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 8px" }}>Clinical Biomarkers</h3>
    <p style={{ color: "#666", fontSize: "0.9rem", lineHeight: 1.5, margin: 0 }}>Securely upload medical PDFs. Our extraction agent pulls your HbA1c, LDL, and vitamin levels to visualize trends alongside your daily logs.</p>
  </div>

  {/* Card 3: Social Competition */}
  <div className="feature-card">
    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
      <Users size={20} color="#f97316" />
    </div>
    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 8px" }}>Social Leaderboards</h3>
    <p style={{ color: "#666", fontSize: "0.9rem", lineHeight: 1.5, margin: 0 }}>Compete against friends to stay consistent. Track everyday goals, climb the ranks, and hold your squad accountable.</p>
  </div>

  {/* Card 4: Recipe Planning */}
  <div className="feature-card">
    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
      <ChefHat size={20} color="#10b981" />
    </div>
    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 8px" }}>Clinical Recipe Planner</h3>
    <p style={{ color: "#666", fontSize: "0.9rem", lineHeight: 1.5, margin: 0 }}>Get recipes dynamically adapted to your medical needs. Elevated cholesterol? Our agent adjusts meals to prioritize heart-healthy fiber.</p>
  </div>

  {/* Card 5: Analytics */}
  <div className="feature-card">
    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
      <Target size={20} color="#3b82f6" />
    </div>
    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 8px" }}>Immersive Analytics</h3>
    <p style={{ color: "#666", fontSize: "0.9rem", lineHeight: 1.5, margin: 0 }}>Dive deep with a 30-day dashboard that synthesizes your macro intake and medical progress into actionable insights.</p>
  </div>

  {/* Card 6: Dynamic Goals */}
  <div className="feature-card">
    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(167,139,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
      <Zap size={20} color="#a78bfa" />
    </div>
    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 8px" }}>Auto-Adjusting Targets</h3>
    <p style={{ color: "#666", fontSize: "0.9rem", lineHeight: 1.5, margin: 0 }}>Using ISSN standards, your goals evolve in real-time as you log weight and hit new performance milestones.</p>
  </div>

</div>
          </div>
        ) : (
          <div
            className="auth-wrap"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              width: "100%",
            }}
          >
            {/* Back Button */}
            <button
              onClick={() => setShowAuth(false)}
              style={{
                background: "none",
                border: "none",
                color: "#666",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 0 24px 0",
                alignSelf: "center",
              }}
            >
              ← Back to home
            </button>

            {/* ── EXISTING AUTH CARD ─────────────────────────────────────────── */}
            <div
              className="auth-card"
              style={{
                width: "100%",
                maxWidth: 380,
                background: "#111113",
                border: "1px solid #1e1e22",
                borderRadius: 24,
                padding: 28,
                boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
                animation: "floatUp 0.4s ease both",
                boxSizing: "border-box",
              }}
            >
              <h2
                style={{
                  textAlign: "center",
                  margin: "0 0 24px",
                  fontSize: "1.5rem",
                  fontWeight: 800,
                }}
              >
                Welcome Back
              </h2>

              {/* ── Google OAuth ──────────────────────────────────────────── */}
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={authLoading}
                style={{
                  width: "100%",
                  padding: 13,
                  borderRadius: 12,
                  border: "1px solid #27272a",
                  background: "#fff",
                  color: "#1f1f24",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  cursor: authLoading ? "not-allowed" : "pointer",
                  opacity: authLoading ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  transition: "opacity 0.2s",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
                  />
                </svg>
                Continue with Google
              </button>

              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#444",
                  textAlign: "center",
                  marginTop: 8,
                }}
              >
                Already have an account? Use the same email to keep your data.
              </div>

              {/* ── Divider ───────────────────────────────────────────────── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  margin: "18px 0",
                }}
              >
                <div style={{ flex: 1, height: 1, background: "#27272a" }} />
                <span
                  style={{ color: "#444", fontSize: "0.75rem", fontWeight: 600 }}
                >
                  or
                </span>
                <div style={{ flex: 1, height: 1, background: "#27272a" }} />
              </div>

              <div
                style={{
                  display: "flex",
                  background: "#0a0a0c",
                  borderRadius: 12,
                  padding: 4,
                  marginBottom: 24,
                }}
              >
                {[
                  { id: false, label: "✉️ Email OTP" },
                  { id: true, label: "🔑 Password" },
                ].map((t) => (
                  <button
                    key={String(t.id)}
                    onClick={() => setUsePasswordLogin(t.id)}
                    style={{
                      flex: 1,
                      padding: "9px 0",
                      border: "none",
                      borderRadius: 9,
                      background:
                        usePasswordLogin === t.id ? "#1f1f24" : "transparent",
                      color: usePasswordLogin === t.id ? "#fff" : "#555",
                      fontWeight: usePasswordLogin === t.id ? 700 : 500,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      boxShadow:
                        usePasswordLogin === t.id
                          ? "0 1px 4px rgba(0,0,0,0.4)"
                          : "none",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {usePasswordLogin ? (
                <form
                  onSubmit={handlePasswordLogin}
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <input
                    className="auth-input"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <input
                    className="auth-input"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    className="auth-btn-primary"
                    disabled={authLoading}
                    style={{ marginTop: 4 }}
                  >
                    {authLoading ? (
                      <Loader2
                        size={18}
                        className="animate-spin"
                        style={{ margin: "0 auto", display: "block" }}
                      />
                    ) : (
                      "Sign In →"
                    )}
                  </button>
                </form>
              ) : !isCodeSent ? (
                <form
                  onSubmit={handleSendCode}
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div
                    style={{
                      fontSize: "0.82rem",
                      color: "#555",
                      marginBottom: 4,
                    }}
                  >
                    Enter your email and we&apos;ll send a one-time code — no password needed.
                  </div>
                  <input
                    className="auth-input"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <button
                    className="auth-btn-primary"
                    disabled={authLoading}
                    style={{ marginTop: 4 }}
                  >
                    {authLoading ? (
                      <Loader2
                        size={18}
                        className="animate-spin"
                        style={{ margin: "0 auto", display: "block" }}
                      />
                    ) : (
                      "Send Code →"
                    )}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handleVerifyCode}
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div style={{ textAlign: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: "0.82rem", color: "#555" }}>
                      Code sent to
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#fff",
                        fontSize: "0.9rem",
                      }}
                    >
                      {email}
                    </div>
                  </div>
                  <input
                    className="auth-input"
                    type="text"
                    placeholder="· · · · · · · ·"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    maxLength={10}
                    style={{
                      letterSpacing: 6,
                      textAlign: "center",
                      fontSize: "1.4rem",
                      padding: "14px 16px",
                    }}
                  />
                  <button className="auth-btn-primary" disabled={authLoading}>
                    {authLoading ? (
                      <Loader2
                        size={18}
                        className="animate-spin"
                        style={{ margin: "0 auto", display: "block" }}
                      />
                    ) : (
                      "Verify & Enter →"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCodeSent(false)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#555",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    ← Use a different email
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
  );
}
