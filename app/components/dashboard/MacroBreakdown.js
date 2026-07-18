"use client";
import {
  Calendar,
} from "lucide-react";
import { COLORS } from "./ui";
import { FLATTENED_DB } from "@/app/food-data";
const MacroBreakdown = ({ metrics, selectedDate, selectedLogs }) => (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              marginBottom: 20,
            }}
          >
            <div
              className="chart-card"
              style={{
                padding: 24,
                flex: "1 1 300px",
                display: "flex",
                flexDirection: "column",
                border: "1px solid #27272a",
                borderRadius: 16,
                background: "#18181b",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 24,
                }}
              >
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                  Macro Targets
                </h3>
                <span style={{ fontSize: "0.7rem", color: "#555" }}>
                  {selectedDate}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {[
                  { label: "Protein", key: "p", target: metrics.targets.p, color: COLORS.pro, emoji: "💪" },
                  { label: "Carbs",   key: "c", target: metrics.targets.c, color: COLORS.carb, emoji: "🌾" },
                  { label: "Fats",    key: "f", target: metrics.targets.f, color: COLORS.fat,  emoji: "🥑" },
                  { label: "Fiber",   key: "fib", target: metrics.targets.fib, color: COLORS.fib, emoji: "🥦" },
                ].map(({ label, key, target, color, emoji }) => {
                  const eaten = metrics.macros[key] || 0;
                  const pct = target > 0 ? Math.min(eaten / target, 1.2) : 0;
                  const over = eaten > target;
                  const ringColor = over ? "#ef4444" : color;
                  const R = 42;
                  const circ = 2 * Math.PI * R;
                  const dash = Math.min(pct, 1) * circ;
                  return (
                    <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <div style={{ position: "relative", width: 100, height: 100 }}>
                        <svg width="100" height="100" style={{ transform: "rotate(-90deg)" }}>
                          <circle cx="50" cy="50" r={R} fill="none" stroke="#27272a" strokeWidth="10" />
                          <circle
                            cx="50" cy="50" r={R}
                            fill="none"
                            stroke={ringColor}
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={`${dash} ${circ}`}
                            style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.3s ease" }}
                          />
                        </svg>
                        <div style={{
                          position: "absolute", inset: 0,
                          display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          <span style={{ fontSize: "1.1rem", fontWeight: 800, color: over ? "#ef4444" : "#fff", lineHeight: 1 }}>
                            {eaten}
                          </span>
                          <span style={{ fontSize: "0.65rem", color: "#555", lineHeight: 1 }}>/{target}g</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: over ? "#ef4444" : "#ccc" }}>
                          {emoji} {label}
                        </div>
                        <div style={{
                          fontSize: "0.7rem",
                          color: over ? "#ef4444" : pct >= 0.9 ? "#22c55e" : "#555",
                          fontWeight: 600,
                          marginTop: 2,
                        }}>
                          {over ? `+${Math.round(eaten - target)}g over` : `${Math.round(pct * 100)}%`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #222" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "baseline" }}>
                  <span style={{ fontSize: "0.85rem", color: "#888", fontWeight: 600 }}>🔥 Calories</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: metrics.eaten > metrics.target ? "#ef4444" : "#fff" }}>
                    {metrics.eaten} <span style={{ color: "#555", fontWeight: 400 }}>/ {metrics.target} kcal</span>
                  </span>
                </div>
                <div style={{ background: "#27272a", height: 10, borderRadius: 5, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, (metrics.eaten / metrics.target) * 100)}%`,
                    background: metrics.eaten > metrics.target
                      ? "#ef4444"
                      : metrics.eaten / metrics.target > 0.9
                        ? "#22c55e"
                        : COLORS.cals,
                    borderRadius: 5,
                    transition: "width 0.8s ease",
                  }} />
                </div>
              </div>
            </div>

            <div
              className="chart-card"
              style={{
                padding: 24,
                flex: "2 1 400px",
                height: 500,
                display: "flex",
                flexDirection: "column",
                border: "1px solid #27272a",
                borderRadius: 16,
                background: "#18181b",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 15,
                }}
              >
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Calendar size={18} color="#888" /> Intake for {selectedDate}
                </h3>
              </div>
              {!selectedDate || selectedLogs.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#666",
                    fontStyle: "italic",
                  }}
                >
                  No logs found.
                </div>
              ) : (
                <>
                  <div
                    className="custom-scrollbar"
                    style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}
                  >
                    {selectedLogs.map((log) => {
                      return (
                        <div
                          key={log.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "14px 10px",
                            borderBottom: "1px solid #222",
                            background: "transparent",
                            borderLeft: "3px solid transparent",
                            borderRadius: 4,
                            marginBottom: 4,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                color: "#fff",
                                textTransform: "capitalize",
                                fontSize: "1rem",
                              }}
                            >
                              {log.qty}x {log.name}{" "}
                              {log.name === "Water" && (
                                <span
                                  style={{
                                    fontSize: "0.8rem",
                                    color: "#3b82f6",
                                  }}
                                >
                                  {" "}
                                  ({log.qty * 0.25}L)
                                </span>
                              )}
                            </div>
                            {log.name !== "Water" && (
                              <div
                                style={{
                                  fontSize: "0.8rem",
                                  color: "#888",
                                  marginTop: 4,
                                }}
                              >
                                <span style={{ color: COLORS.pro }}>
                                  P: {log.protein}
                                </span>{" "}
                                •{" "}
                                <span style={{ color: COLORS.carb }}>
                                  C: {log.carbs}
                                </span>{" "}
                                •{" "}
                                <span
                                  style={{
                                    color: COLORS.fat,
                                    fontWeight: "400",
                                  }}
                                >
                                  F: {log.fats}
                                </span>{" "}
                                •{" "}
                                <span style={{ color: COLORS.fib }}>
                                  Fib:{" "}
                                  {log.fiber ||
                                    (FLATTENED_DB[log.name.toLowerCase()]?.fiber
                                      ? Math.round(
                                          FLATTENED_DB[log.name.toLowerCase()]
                                            .fiber * log.qty,
                                        )
                                      : 0)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              fontWeight: 700,
                              color: "#ddd",
                              fontSize: "1rem",
                            }}
                          >
                            {log.calories} kcal
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div
                    style={{
                      marginTop: 15,
                      paddingTop: 15,
                      borderTop: "2px solid #333",
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 800,
                      color: "#fff",
                      fontSize: "1.1rem",
                      flexShrink: 0,
                    }}
                  >
                    <span>Daily Total</span>
                    <span>
                      {Math.round(selectedLogs.reduce(
                        (sum, item) => sum + (item.calories || 0),
                        0,
                      ))}{" "}
                      kcal
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
);
export default MacroBreakdown;
