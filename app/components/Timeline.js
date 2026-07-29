"use client";

import { Utensils, Loader2, Edit3, Trash2 } from "lucide-react";
import { calculateTargets } from "../lib/nutrition";

import { defaultMeal, mealMeta } from "../lib/mealPeriod";

export default function Timeline({
  logs,
  loading,
  totals,
  userProfile,
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
          {/* Auto-saved (Phase 0): every log persists instantly — no Save button. */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: "#22c55e",
              fontSize: "0.66rem",
              fontWeight: 700,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
            Auto-saved
          </span>
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
          <div
            style={{
              textAlign: "center",
              padding: "30px 22px",
              border: "1px dashed #26262e",
              borderRadius: 16,
              background: "linear-gradient(180deg, #131318, #0e0e12)",
            }}
          >
            <div style={{ fontSize: "2rem", lineHeight: 1 }}>🍽️</div>
            <div
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "#d4d4d8",
                marginTop: 8,
              }}
            >
              Your day is empty
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "#71717a",
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              Pick a meal and tap a food above — it lands here, split into
              Breakfast, Lunch, Snacks &amp; Dinner.
            </div>
          </div>
        ) : (
          (() => {
            /* Group logs by the meal the user filed them under. Older logs
               (no meal stored) fall back to their time-of-day bucket. */
            const groups = {};
            logs.forEach((log) => {
              const label = log.meal || defaultMeal(log.created_at);
              if (!groups[label]) {
                const meta = mealMeta(label);
                groups[label] = { label, icon: meta.icon, order: meta.order, items: [] };
              }
              groups[label].items.push(log);
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
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      background: "#15151b",
                      border: "1px solid #26262e",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "1rem",
                      flexShrink: 0,
                    }}
                  >
                    {group.icon}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: "0.82rem",
                        fontWeight: 800,
                        color: "#e4e4e7",
                      }}
                    >
                      {group.label}
                    </span>
                    <span style={{ fontSize: "0.62rem", color: "#52525b" }}>
                      {group.items.length}{" "}
                      {group.items.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      color: "#f7c56b",
                      background:
                        "linear-gradient(135deg, rgba(245,158,11,0.14), rgba(239,68,68,0.1))",
                      border: "1px solid rgba(245,158,11,0.25)",
                      borderRadius: 8,
                      padding: "3px 9px",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {group.items.reduce((s, l) => s + (l.calories || 0), 0)} kcal
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
                          : "linear-gradient(180deg, #15151b, #0f0f13)",
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
