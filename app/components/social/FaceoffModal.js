"use client";

import { Swords, RefreshCw, X, Loader2 } from "lucide-react";
import { Avatar } from "./ui";

const FaceoffModal = ({ showSquadModal, setShowSquadModal, historicalStats, friends, refreshFaceoff, faceoffLoading }) => {
    if (!showSquadModal || !historicalStats || friends.length < 2) return null;
    const u1 = friends.find((f) => f.id === historicalStats.u1);
    const u2 = friends.find((f) => f.id === historicalStats.u2);
    if (!u1 || !u2) return null;
    const w1 = historicalStats.wins[u1.id];
    const w2 = historicalStats.wins[u2.id];
    const lp1 = historicalStats.lifetimePoints?.[u1.id] ?? 0;
    const lp2 = historicalStats.lifetimePoints?.[u2.id] ?? 0;
    const ld1 = historicalStats.loggedDays?.[u1.id] ?? 0;
    const ld2 = historicalStats.loggedDays?.[u2.id] ?? 0;
    const avg1 = ld1 > 0 ? Math.round(lp1 / ld1) : 0;
    const avg2 = ld2 > 0 ? Math.round(lp2 / ld2) : 0;
    const totalW = w1 + w2 || 1;
    const totalLP = lp1 + lp2 || 1;
    const winLeader = w1 > w2 ? u1 : w2 > w1 ? u2 : null;
    const ptLeader  = lp1 > lp2 ? u1 : lp2 > lp1 ? u2 : null;
    const totalDays = historicalStats.totalDays ?? 0;

    return (
      <div className="modal-overlay" style={{ zIndex: 9999 }}>
        <div className="modal-content">
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, color: "#e0e7ff", fontSize: "1rem" }}>
              <Swords size={17} color="#f59e0b" /> All-Time Head-to-Head
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={refreshFaceoff}
                disabled={faceoffLoading}
                title="Refresh with latest data"
                style={{ background: "none", border: "none", color: faceoffLoading ? "#3b82f6" : "#555", cursor: faceoffLoading ? "wait" : "pointer", display: "flex", alignItems: "center", padding: 4 }}
              >
                <RefreshCw size={14} className={faceoffLoading ? "animate-spin" : ""} />
              </button>
              <button onClick={() => setShowSquadModal(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
          </div>
          {faceoffLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "5px 8px", background: "rgba(59,130,246,0.08)", borderRadius: 8 }}>
              <Loader2 size={11} className="animate-spin" color="#3b82f6" />
              <span style={{ fontSize: "0.68rem", color: "#3b82f6" }}>Fetching latest data…</span>
            </div>
          )}
          {totalDays > 0 && (
            <div style={{ fontSize: "0.68rem", color: "#333", marginBottom: 18 }}>
              Across <strong style={{ color: "#555" }}>{totalDays}</strong> tracked days
            </div>
          )}

          {/* Player cards */}
          <div style={{ display: "flex", alignItems: "stretch", justifyContent: "space-around", gap: 10, marginBottom: 20 }}>
            {[{ user: u1, wins: w1, pts: lp1, avg: avg1, days: ld1 }, { user: u2, wins: w2, pts: lp2, avg: avg2, days: ld2 }].map(({ user, wins, pts, avg, days }) => (
              <div key={user.id} style={{
                flex: 1, textAlign: "center",
                background: `linear-gradient(160deg, ${user.barColor}18, ${user.barColor}08)`,
                border: `1.5px solid ${user.barColor}55`,
                borderRadius: 16, padding: "16px 10px",
                boxShadow: `0 0 20px ${user.barColor}12`,
              }}>
                <Avatar name={user.name} size={50} color={user.barColor} />
                <div style={{ marginTop: 9, fontWeight: 800, color: "#fff", fontSize: "0.88rem" }}>
                  {user.name.replace(" (You)", "")}
                </div>
                <div style={{ fontSize: "0.62rem", color: `${user.barColor}aa`, marginTop: 3, fontWeight: 600 }}>
                  {days} days logged
                </div>

                {/* Wins */}
                <div style={{
                  marginTop: 12,
                  background: "rgba(0,0,0,0.25)",
                  borderRadius: 10, padding: "8px 6px",
                }}>
                  <div style={{ fontSize: "2.2rem", fontWeight: 900, color: user.barColor, lineHeight: 1 }}>{wins}</div>
                  <div style={{ fontSize: "0.62rem", color: "#888", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>daily wins</div>
                </div>

                {/* Avg daily score */}
                <div style={{
                  marginTop: 8,
                  background: `${user.barColor}22`,
                  border: `1px solid ${user.barColor}44`,
                  borderRadius: 10, padding: "9px 6px",
                }}>
                  <div style={{ lineHeight: 1 }}>
                    <span style={{ fontSize: "1.5rem", fontWeight: 900, color: user.barColor }}>{avg}</span>
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, color: `${user.barColor}88` }}>/135</span>
                  </div>
                  <div style={{ fontSize: "0.62rem", color: "#999", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>avg daily score</div>
                  <div style={{ fontSize: "0.65rem", color: `${user.barColor}bb`, marginTop: 4, fontWeight: 700 }}>
                    {pts.toLocaleString()} <span style={{ fontWeight: 400, color: "#555" }}>total pts</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Wins bar */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: "0.62rem", color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Daily wins</span>
              <span style={{ fontSize: "0.62rem", color: "#555" }}>{w1} vs {w2}</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, overflow: "hidden", display: "flex", background: "rgba(255,255,255,0.06)" }}>
              <div style={{ width: `${(w1 / totalW) * 100}%`, background: u1.barColor, transition: "width 0.8s ease", boxShadow: `0 0 8px ${u1.barColor}66` }} />
              <div style={{ width: `${(w2 / totalW) * 100}%`, background: u2.barColor, boxShadow: `0 0 8px ${u2.barColor}66` }} />
            </div>
          </div>

          {/* Lifetime points bar */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: "0.62rem", color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Lifetime points</span>
              <span style={{ fontSize: "0.62rem", color: "#555" }}>{lp1.toLocaleString()} vs {lp2.toLocaleString()}</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, overflow: "hidden", display: "flex", background: "rgba(255,255,255,0.06)" }}>
              <div style={{ width: `${(lp1 / totalLP) * 100}%`, background: u1.barColor, transition: "width 0.8s ease", boxShadow: `0 0 8px ${u1.barColor}66` }} />
              <div style={{ width: `${(lp2 / totalLP) * 100}%`, background: u2.barColor, boxShadow: `0 0 8px ${u2.barColor}66` }} />
            </div>
          </div>

          {/* Crown verdict */}
          <div style={{
            textAlign: "center", fontSize: "0.88rem", color: "#e4e4e7", fontWeight: 700,
            background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            {ptLeader
              ? `${ptLeader.name.replace(" (You)", "")} leads in lifetime points 👑`
              : winLeader
                ? `${winLeader.name.replace(" (You)", "")} holds the most wins 👑`
                : "Completely even — too close to call 🤝"}
          </div>
        </div>
      </div>
    );
  };

export default FaceoffModal;
