"use client";

import { Flame, Users } from "lucide-react";
import { Avatar } from "./ui";

  const PODIUM_CONFIG = [
    { rank: 2, idx: 1, height: 80, color: "#94a3b8", gradient: "linear-gradient(to top,#1e293b,#334155)", borderTop: "#64748b", glow: false },
    { rank: 1, idx: 0, height: 110, color: "#f59e0b", gradient: "linear-gradient(to top,#78350f,#b45309)", borderTop: "#f59e0b", glow: true },
    { rank: 3, idx: 2, height: 60, color: "#a855f7", gradient: "linear-gradient(to top,#4c1d95,#6b21a8)", borderTop: "#a855f7", glow: false },
  ];

const Podium = ({ top3, handleViewLogs }) => (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8, marginBottom: 28, marginTop: 4 }}>
      {PODIUM_CONFIG.map(({ rank, idx, height, color, gradient, borderTop, glow }) => {
        const f = top3[idx];
        if (!f) return <div key={rank} style={{ width: "30%" }} />;
        const isFirst = rank === 1;
        return (
          <div
            key={rank}
            onClick={() => handleViewLogs(f)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", width: isFirst ? "35%" : "30%", cursor: "pointer" }}
          >
            {isFirst && <Flame size={20} color="#f59e0b" style={{ marginBottom: 5 }} className="animate-bounce" />}
            <Avatar name={f.name} size={isFirst ? 46 : 36} color={color} fontSize={isFirst ? "1.1rem" : "0.9rem"} />
            <div style={{
              marginTop: 6, marginBottom: 7,
              fontWeight: isFirst ? 800 : 700,
              fontSize: isFirst ? "0.88rem" : "0.75rem",
              color, textAlign: "center",
              maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {f.name.replace(" (You)", "")}
            </div>
            <div style={{
              width: "100%", height,
              background: gradient,
              borderRadius: "10px 10px 0 0",
              borderTop: `3px solid ${borderTop}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: glow ? "0 0 20px rgba(245,158,11,0.18)" : "none",
            }}>
              <span style={{ fontSize: isFirst ? "2rem" : "1.4rem" }}>
                {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
              </span>
            </div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 3 }}>
              <span style={{ fontWeight: 800, fontSize: isFirst ? "1.05rem" : "0.9rem", color }}>{f.score}</span>
              <span style={{ fontSize: "0.62rem", color: "#777" }}>pts</span>
            </div>
            <div style={{ fontSize: "0.62rem", color: "#888", marginTop: 1 }}>{f.statusLabel}</div>
          </div>
        );
      })}
    </div>
  );

const SquadBanner = ({ squadStats, friends, historicalStats, openFaceoff }) => {
    if (!squadStats || friends.length < 2) return null;
    const tP = Math.max(squadStats.targetP, 1);
    const tW = Math.max(squadStats.targetWater, 1);
    const pPct = Math.min(100, (squadStats.p / tP) * 100);
    const wPct = Math.min(100, (squadStats.water / tW) * 100);
    return (
      <div style={{
        background: "linear-gradient(135deg,#1e1b4b,#312e81)",
        border: "1px solid #4338ca", borderRadius: 18, padding: "14px 16px", marginBottom: 18,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Users size={15} color="#a5b4fc" />
            <span style={{ fontWeight: 700, color: "#e0e7ff", fontSize: "0.85rem" }}>Squad Today</span>
          </div>
          {historicalStats && (
            <button
              onClick={openFaceoff}
              style={{ background: "rgba(99,102,241,0.25)", border: "1px solid #6366f155", color: "#a5b4fc", borderRadius: 8, padding: "3px 10px", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}
            >
              All-Time Faceoff ⚔️
            </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Protein", value: Math.round(squadStats.p), max: Math.round(tP), unit: "g", color: "#fbbf24", pct: pPct },
            { label: "Hydration", value: +squadStats.water.toFixed(1), max: +tW.toFixed(1), unit: "L", color: "#60a5fa", pct: wPct },
          ].map(({ label, value, max, unit, color, pct }) => (
            <div key={label} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: "0.72rem", color: "#c7d2fe" }}>{label}</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color }}>{Math.round(pct)}%</span>
              </div>
              <div style={{ height: 5, background: "#1e293b", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.8s ease" }} />
              </div>
              <div style={{ marginTop: 4, fontSize: "0.62rem", color: "#3a4a6a", textAlign: "right" }}>
                {value} / {max}{unit}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

export { Podium, SquadBanner };
