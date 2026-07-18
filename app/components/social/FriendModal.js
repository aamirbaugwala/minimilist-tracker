"use client";

import { X, Loader2, Utensils } from "lucide-react";
import { Avatar, StatTile } from "./ui";

const FriendModal = ({ selectedFriend, friendLogs, logsLoading, closeLogs }) => {
    if (!selectedFriend) return null;
    const f = selectedFriend;
    const totalLogs = friendLogs.reduce((s, l) => s + (l.calories || 0), 0);
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxHeight: "82vh", display: "flex", flexDirection: "column", padding: "0 0 28px", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <Avatar name={f.name} size={40} color={f.barColor} fontSize="1rem" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
              <div style={{ fontSize: "0.72rem", color: f.barColor, fontWeight: 600 }}>{f.statusLabel}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontWeight: 900, fontSize: "1.5rem", color: f.barColor, lineHeight: 1 }}>{f.score}</div>
              <div style={{ fontSize: "0.6rem", color: "#333" }}>/ 135 pts</div>
            </div>
            <button onClick={closeLogs} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 4, flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ overflowY: "auto", flex: 1, padding: "14px 18px" }}>
            {/* Breakdown pills */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {[
                { label: "Base", val: f.breakdown.base, color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
                { label: "Bonus", val: `+${f.breakdown.bonus}`, color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
                { label: "Penalty", val: `-${f.breakdown.penalty}`, color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
              ].map(({ label, val, color, bg }) => (
                <div key={label} style={{ flex: 1, background: bg, border: `1px solid ${color}33`, borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.58rem", color: "#999", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
                  <div style={{ fontWeight: 800, fontSize: "1rem", color, marginTop: 2 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Macro tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
              <StatTile label="Protein" value={f.stats.p} max={f.targets.p} unit="g" color="#3b82f6" />
              <StatTile label="Carbs" value={f.stats.c} max={f.targets.c} unit="g" color="#f59e0b" />
              <StatTile label="Fats" value={f.stats.f} max={f.targets.f} unit="g" color="#ef4444" />
              <StatTile label="Fiber" value={f.stats.fib} max={f.targets.fib} unit="g" color="#a855f7" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 14 }}>
              <StatTile label="Calories" value={f.stats.cals} max={f.targets.cals} unit=" kcal" color="#f59e0b" />
              <StatTile label="Water" value={f.stats.water} max={f.targets.water} unit="L" color="#60a5fa" />
            </div>

            {/* Achievement badges */}
            {(f.achievements.proteinHit || f.achievements.waterHit || f.achievements.fiberHit || f.achievements.perfectScore) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
                {f.achievements.proteinHit && <span style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 7, padding: "2px 9px", fontSize: "0.7rem", fontWeight: 700 }}>💪 Protein Hit</span>}
                {f.achievements.waterHit && <span style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 7, padding: "2px 9px", fontSize: "0.7rem", fontWeight: 700 }}>💧 Hydrated</span>}
                {f.achievements.fiberHit && <span style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 7, padding: "2px 9px", fontSize: "0.7rem", fontWeight: 700 }}>🌿 Fiber Hit</span>}
                {f.achievements.perfectScore && <span style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 7, padding: "2px 9px", fontSize: "0.7rem", fontWeight: 700 }}>🏆 Perfect Day</span>}
              </div>
            )}

            {/* Food log */}
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#2a2a2a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Food Log {totalLogs > 0 && <span style={{ color: "#555", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>· {totalLogs} kcal</span>}
            </div>

            {logsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                <Loader2 className="animate-spin" color="#444" size={22} />
              </div>
            ) : friendLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "#333" }}>
                <Utensils size={28} style={{ opacity: 0.15, marginBottom: 8 }} />
                <div style={{ fontSize: "0.82rem" }}>Nothing logged today.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {friendLogs.map((log) => {
                  const isWater = log.name === "Water";
                  const pct = totalLogs > 0 ? Math.round((log.calories / totalLogs) * 100) : 0;
                  return (
                    <div key={log.id} style={{
                      background: isWater ? "rgba(59,130,246,0.06)" : "#111116",
                      border: isWater ? "1px solid rgba(59,130,246,0.18)" : "1px solid #1e1e26",
                      borderRadius: 10, padding: "9px 12px",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{ background: "#1e1e26", color: "#444", borderRadius: 6, padding: "2px 6px", fontSize: "0.68rem", fontWeight: 700, flexShrink: 0 }}>{log.qty}×</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", textTransform: "capitalize", color: "#e4e4e7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.name}</div>
                        {!isWater && (
                          <div style={{ display: "flex", gap: 5, marginTop: 3 }}>
                            <span style={{ fontSize: "0.6rem", background: "rgba(59,130,246,0.1)", color: "#3b82f6", padding: "1px 4px", borderRadius: 4, fontWeight: 600 }}>P {log.protein}g</span>
                            <span style={{ fontSize: "0.6rem", background: "rgba(245,158,11,0.1)", color: "#f59e0b", padding: "1px 4px", borderRadius: 4, fontWeight: 600 }}>C {log.carbs}g</span>
                            <span style={{ fontSize: "0.6rem", background: "rgba(239,68,68,0.1)", color: "#ef4444", padding: "1px 4px", borderRadius: 4, fontWeight: 600 }}>F {log.fats}g</span>
                            {log.fiber > 0 && (
                              <span style={{ fontSize: "0.6rem", background: "rgba(16,185,129,0.1)", color: "#10b981", padding: "1px 4px", borderRadius: 4, fontWeight: 600 }}>Fib {log.fiber}g</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.88rem", color: isWater ? "#60a5fa" : "#fff" }}>
                          {isWater ? `${log.qty * 0.25}L` : log.calories}
                        </div>
                        {!isWater && pct > 0 && (
                          <div style={{ fontSize: "0.58rem", color: "#aaa", background: "rgba(255,255,255,0.07)", borderRadius: 4, padding: "1px 3px", marginTop: 2 }}>{pct}%</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

export default FriendModal;
