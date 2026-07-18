"use client";

import { Utensils, Loader2, Edit3, Trash2 } from "lucide-react";
import { calculateTargets } from "../lib/nutrition";

// ── Meal period helper ──────────────────────────────────────────────────────
// Returns { label, icon, order } from a created_at ISO string or "now"
function getMealPeriod(createdAt) {
  const h = createdAt ? new Date(createdAt).getHours() : new Date().getHours();
  if (h >= 5 && h < 11) return { label: "Breakfast", icon: "☀️", order: 0 };
  if (h >= 11 && h < 15) return { label: "Lunch", icon: "🌤️", order: 1 };
  if (h >= 15 && h < 18) return { label: "Snacks", icon: "🍵", order: 2 };
  if (h >= 18 && h < 22) return { label: "Dinner", icon: "🌙", order: 3 };
  return { label: "Late Night", icon: "🌑", order: 4 };
}

export default function Timeline({
  logs,
  loading,
  totals,
  userProfile,
  hasUnsavedChanges,
  openEditModal,
  deleteLog,
}) {
  return (
      <section className="timeline" style={{ padding: "0 20px 100px" }}>
        {/* Section header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
            marginTop: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Utensils size={15} color="#555" />
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#555",
                textTransform: "uppercase",
                letterSpacing: 1.2,
              }}
            >
              Today&apos;s Log
            </span>
            {logs.length > 0 && (
              <span
                style={{
                  background: "#1e1e26",
                  border: "1px solid #27272a",
                  color: "#666",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 8,
                }}
              >
                {logs.length}
              </span>
            )}
          </div>
          {hasUnsavedChanges && (
            <span
              style={{
                background: "rgba(245,158,11,0.1)",
                border: "1px solid rgba(245,158,11,0.25)",
                color: "#f59e0b",
                fontSize: "0.7rem",
                fontWeight: 700,
                padding: "2px 10px",
                borderRadius: 10,
              }}
            >
              Unsaved
            </span>
          )}
        </div>

        {/* Calorie budget bar */}
        {logs.length > 0 &&
          (() => {
            const calTarget = calculateTargets(userProfile).cals || 2000;
            const barPct = Math.min(
              100,
              Math.round((totals.calories / calTarget) * 100),
            );
            const isOver = totals.calories > calTarget;
            const barColor = isOver
              ? "linear-gradient(90deg,#ef4444,#f97316)"
              : barPct > 85
                ? "linear-gradient(90deg,#f59e0b,#eab308)"
                : "linear-gradient(90deg,#3b82f6,#22c55e)";
            return (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    height: 5,
                    borderRadius: 99,
                    background: "#1e1e26",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 99,
                      width: `${barPct}%`,
                      background: barColor,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 4,
                    fontSize: "0.65rem",
                    color: "#444",
                  }}
                >
                  <span>0</span>
                  <span style={{ color: isOver ? "#ef4444" : "#555" }}>
                    {totals.calories} / {calTarget} kcal
                  </span>
                </div>
              </div>
            );
          })()}

        {loading ? (
          <div style={{ textAlign: "center", padding: 20, color: "#666" }}>
            <Loader2 className="animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: "center", color: "#444", padding: 40 }}>
            <Utensils size={36} style={{ opacity: 0.15, marginBottom: 10 }} />
            <div style={{ fontSize: "0.9rem" }}>No food logged yet.</div>
            <div style={{ fontSize: "0.78rem", color: "#333", marginTop: 4 }}>
              Tap a food above to start tracking
            </div>
          </div>
        ) : (
          (() => {
            /* Group logs by meal period */
            const groups = {};
            logs.forEach((log) => {
              const period = getMealPeriod(log.created_at);
              if (!groups[period.label])
                groups[period.label] = { ...period, items: [] };
              groups[period.label].items.push(log);
            });
            const sortedGroups = Object.values(groups).sort(
              (a, b) => a.order - b.order,
            );

            return sortedGroups.map((group) => (
              <div key={group.label} style={{ marginBottom: 20 }}>
                {/* Meal period header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginBottom: 8,
                    paddingBottom: 6,
                    borderBottom: "1px solid #18181b",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>{group.icon}</span>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: "#444",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {group.label}
                  </span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: "#333",
                      marginLeft: "auto",
                    }}
                  >
                    {group.items.reduce((s, l) => s + (l.calories || 0), 0)}{" "}
                    kcal
                  </span>
                </div>

                {/* Log rows */}
                {group.items.map((log) => {
                  const pct =
                    totals.calories > 0
                      ? Math.round((log.calories / totals.calories) * 100)
                      : 0;
                  const isWater = log.name === "Water";
                  return (
                    <div
                      key={log.id}
                      style={{
                        background: isWater
                          ? "rgba(59,130,246,0.07)"
                          : "#111116",
                        border: isWater
                          ? "1px solid rgba(59,130,246,0.2)"
                          : "1px solid #1e1e26",
                        borderRadius: 14,
                        padding: "10px 12px",
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      {/* Qty badge */}
                      <div
                        style={{
                          background: isWater
                            ? "rgba(59,130,246,0.2)"
                            : "#1e1e26",
                          color: isWater ? "#3b82f6" : "#666",
                          borderRadius: 8,
                          padding: "4px 8px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          minWidth: 34,
                          textAlign: "center",
                          flexShrink: 0,
                        }}
                      >
                        {log.qty}×
                      </div>

                      {/* Name + macros */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "#e4e4e7",
                            textTransform: "capitalize",
                            fontSize: "0.9rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {log.name}
                        </div>
                        {!isWater && (
                          <div
                            style={{
                              display: "flex",
                              gap: 5,
                              marginTop: 4,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.65rem",
                                background: "rgba(59,130,246,0.12)",
                                color: "#3b82f6",
                                padding: "1px 5px",
                                borderRadius: 4,
                                fontWeight: 600,
                              }}
                            >
                              P {log.protein}g
                            </span>
                            <span
                              style={{
                                fontSize: "0.65rem",
                                background: "rgba(245,158,11,0.12)",
                                color: "#f59e0b",
                                padding: "1px 5px",
                                borderRadius: 4,
                                fontWeight: 600,
                              }}
                            >
                              C {log.carbs}g
                            </span>
                            <span
                              style={{
                                fontSize: "0.65rem",
                                background: "rgba(239,68,68,0.12)",
                                color: "#ef4444",
                                padding: "1px 5px",
                                borderRadius: 4,
                                fontWeight: 600,
                              }}
                            >
                              F {log.fats}g
                            </span>
                            {log.fiber > 0 && (
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  background: "rgba(16,185,129,0.12)",
                                  color: "#10b981",
                                  padding: "1px 5px",
                                  borderRadius: 4,
                                  fontWeight: 600,
                                }}
                              >
                                Fib {log.fiber}g
                              </span>
                            )}
                          </div>
                        )}
                        {isWater && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              color: "#3b82f6",
                              fontWeight: 600,
                            }}
                          >
                            {log.qty * 0.25}L
                          </span>
                        )}
                      </div>

                      {/* Calorie + % badge */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "0.95rem",
                            color: isWater ? "#3b82f6" : "#fff",
                          }}
                        >
                          {log.calories}
                        </div>
                        {!isWater && pct > 0 && (
                          <div
                            style={{
                              fontSize: "0.62rem",
                              color: "#aaa",
                              fontWeight: 700,
                              background: "rgba(255,255,255,0.07)",
                              borderRadius: 5,
                              padding: "1px 5px",
                              marginTop: 2,
                            }}
                          >
                            {pct}%
                          </div>
                        )}
                      </div>

                      {/* Actions — compact icon group */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                          flexShrink: 0,
                        }}
                      >
                        <button
                          onClick={() => openEditModal(log)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#444",
                            cursor: "pointer",
                            padding: 5,
                            borderRadius: 6,
                          }}
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => deleteLog(log.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#333",
                            cursor: "pointer",
                            padding: 5,
                            borderRadius: 6,
                          }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ));
          })()
        )}
      </section>
  );
}
