"use client";
import { computeDayScore } from "../../lib/dashboardMetrics";
const DailyScoreCard = ({ metrics, calendarData, selectedDate, scoreExpanded, setScoreExpanded }) => {
            const score = computeDayScore(metrics, calendarData, selectedDate);
            const s = score || { total: 0, grade: "—", gradeColor: "#444", pillars: [] };
            const R = 44;
            const circ = 2 * Math.PI * R;
            const dash = score ? (s.total / 100) * circ : 0;
            const isToday = selectedDate === new Date().toISOString().slice(0, 10);

            return (
              <div
                onClick={() => setScoreExpanded((v) => !v)}
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${s.gradeColor}44`,
                  borderRadius: 20,
                  padding: "20px 24px",
                  marginBottom: 24,
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                  transition: "border-color 0.3s",
                }}
              >
                <div style={{
                  position: "absolute", top: 0, left: 0, width: "100%", height: 3,
                  background: metrics.statusColor,
                }} />

                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ position: "relative", flexShrink: 0, width: 100, height: 100 }}>
                    <svg width="100" height="100" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="50" cy="50" r={R} fill="none" stroke="#27272a" strokeWidth="10" />
                      <circle cx="50" cy="50" r={R} fill="none"
                        stroke={s.gradeColor} strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={`${dash} ${circ}`}
                        style={{ transition: "stroke-dasharray 1s ease" }}
                      />
                    </svg>
                    <div style={{
                      position: "absolute", inset: 0,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: "1.8rem", fontWeight: 900, color: s.gradeColor, lineHeight: 1 }}>
                        {s.grade}
                      </span>
                      <span style={{ fontSize: "0.65rem", color: "#555", fontWeight: 600 }}>{s.total}/100</span>
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.72rem", color: "#555", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 4 }}>
                      Daily Score · {isToday ? "Today" : selectedDate}
                    </div>
                    <div style={{ fontSize: "1.9rem", fontWeight: 800, color: metrics.statusColor, lineHeight: 1, marginBottom: 6 }}>
                      {metrics.status}
                    </div>
                    <div style={{ fontSize: "0.95rem", color: "#ccc" }}>
                      {metrics.eaten} <span style={{ color: "#555" }}>/ {metrics.target} kcal</span>
                    </div>
                  </div>

                  <div style={{ color: "#444", fontSize: "1.2rem", flexShrink: 0, transition: "transform 0.3s", transform: scoreExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                    ▾
                  </div>
                </div>

                {scoreExpanded && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #222" }}>
                    <div style={{ fontSize: "0.72rem", color: "#555", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 12 }}>
                      Score Breakdown
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      {s.pillars.map((p) => (
                        <div key={p.label}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.82rem" }}>
                            <span style={{ color: "#ccc", fontWeight: 600 }}>{p.label}</span>
                            <span style={{ color: p.color, fontWeight: 700 }}>{p.pts}/{p.max} pts</span>
                          </div>
                          <div style={{ background: "#27272a", height: 6, borderRadius: 3, overflow: "hidden" }}>
                            <div style={{
                              height: "100%",
                              width: `${(p.pts / p.max) * 100}%`,
                              background: p.color,
                              borderRadius: 3,
                              transition: "width 0.8s ease",
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12, fontSize: "0.75rem", color: "#444", textAlign: "right" }}>
                      S ≥90 · A ≥75 · B ≥55 · C ≥35 · D &lt;35
                    </div>
                  </div>
                )}
              </div>
            );
};
export default DailyScoreCard;
