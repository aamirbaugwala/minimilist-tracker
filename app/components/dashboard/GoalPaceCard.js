"use client";
import { computeGoalPace } from "../../lib/dashboardMetrics";
const GoalPaceCard = ({ profile, trendData }) => {
            const pace = computeGoalPace(trendData, profile);
            if (!pace) return null;

            const isGood = pace.onTrack;
            const accentColor = pace.direction === "reached"
              ? "#22c55e"
              : isGood ? "#3b82f6" : "#f59e0b";

            const startWeight = profile?.weight || pace.latestWeight;
            const targetW = profile?.target_weight;
            let progressPct = 0;
            if (targetW && startWeight && startWeight !== targetW) {
              const totalDelta = Math.abs(startWeight - targetW);
              const doneDelta = Math.abs(pace.latestWeight - targetW);
              progressPct = Math.min(100, Math.max(0, Math.round((1 - doneDelta / totalDelta) * 100)));
            }

            return (
              <div style={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 20,
                padding: "20px 24px",
                marginBottom: 24,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 16,
                alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>
                    🎯 Goal Pace
                  </div>

                  {pace.weeksToGoal !== null ? (
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>
                        ~{pace.weeksToGoal}
                      </span>
                      <span style={{ fontSize: "1rem", color: "#888", marginLeft: 6 }}>weeks to goal weight</span>
                      <div style={{ fontSize: "0.8rem", color: "#555", marginTop: 2 }}>
                        {pace.latestWeight} kg → {pace.targetWeight} kg
                        {pace.weeklyRateKg !== null && (
                          <span style={{ marginLeft: 8, color: pace.onTrack ? "#3b82f6" : "#f59e0b" }}>
                            ({pace.weeklyRateKg > 0 ? "+" : ""}{pace.weeklyRateKg.toFixed(2)} kg/wk actual)
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: "0 0 10px", fontSize: "0.9rem", color: "#ccc" }}>{pace.message}</p>
                  )}

                  {targetW && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#555", marginBottom: 4 }}>
                        <span>Start: {profile?.weight} kg</span>
                        <span style={{ color: accentColor, fontWeight: 700 }}>{progressPct}% there</span>
                        <span>Goal: {targetW} kg</span>
                      </div>
                      <div style={{ background: "#27272a", height: 8, borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${progressPct}%`,
                          background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)`,
                          borderRadius: 4,
                          transition: "width 1s ease",
                        }} />
                      </div>
                    </div>
                  )}
                </div>

                <div style={{
                  textAlign: "center",
                  background: pace.dailyDeficit > 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                  border: `1px solid ${pace.dailyDeficit > 0 ? "#22c55e33" : "#ef444433"}`,
                  borderRadius: 14,
                  padding: "12px 18px",
                  minWidth: 90,
                }}>
                  <div style={{ fontSize: "1.3rem", fontWeight: 800, color: pace.dailyDeficit > 0 ? "#22c55e" : "#ef4444" }}>
                    {pace.dailyDeficit > 0 ? "-" : "+"}{Math.abs(pace.dailyDeficit)}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#555", fontWeight: 600 }}>kcal/day avg</div>
                  <div style={{ fontSize: "0.7rem", color: "#444", marginTop: 2 }}>
                    {pace.dailyDeficit > 0 ? "deficit" : "surplus"}
                  </div>
                </div>
              </div>
            );
};
export default GoalPaceCard;
