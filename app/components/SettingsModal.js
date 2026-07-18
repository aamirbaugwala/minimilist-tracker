"use client";

import { Target, X, Shield, Calculator, AlertTriangle } from "lucide-react";
import { calculateTargets, GOAL_PRESETS } from "../lib/nutrition";

export default function SettingsModal({
  conditions = [],
  setIsSettingGoal,
  settingsTab,
  setSettingsTab,
  userProfile,
  setUserProfile,
  username,
  setUsername,
  newPassword,
  setNewPassword,
  handleUpdatePassword,
  saveGoal,
}) {
  return (
        <div
          className="modal-overlay"
          style={{ alignItems: "flex-end", paddingBottom: 62 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSettingGoal(false);
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 480,
              maxHeight: "calc(90dvh - 62px)",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
              margin: "0 auto",
            }}
          >
            {/* ── Drag handle ─────────────────────────────────────── */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "10px 0 4px",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  background: "#333",
                }}
              />
            </div>

            {/* ── Header ──────────────────────────────────────────── */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "4px 20px 12px",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Target size={18} color="#f59e0b" /> Settings
              </h3>
              <button
                onClick={() => setIsSettingGoal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#666",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* ── Tab switcher ────────────────────────────────────── */}
            <div
              style={{
                display: "flex",
                background: "#1f1f22",
                padding: 4,
                borderRadius: 8,
                margin: "12px 16px 0",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setSettingsTab("profile")}
                style={{
                  flex: 1,
                  padding: 8,
                  background:
                    settingsTab === "profile" ? "#333" : "transparent",
                  border: "none",
                  color: "#fff",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Profile
              </button>
              <button
                onClick={() => setSettingsTab("security")}
                style={{
                  flex: 1,
                  padding: 8,
                  background:
                    settingsTab === "security" ? "#333" : "transparent",
                  border: "none",
                  color: "#fff",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Security
              </button>
            </div>

            {/* ── Scrollable body ─────────────────────────────────── */}
            <div
              style={{ overflowY: "auto", flex: 1, padding: "12px 16px 32px" }}
            >
              {settingsTab === "security" ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 20 }}
                >
                  <div
                    style={{
                      background: "#1f1f22",
                      padding: 16,
                      borderRadius: 12,
                      border: "1px solid #333",
                      textAlign: "center",
                    }}
                  >
                    <Shield
                      size={32}
                      color="#3b82f6"
                      style={{ marginBottom: 10 }}
                    />
                    <h4 style={{ margin: "0 0 10px 0" }}>Account Details</h4>
                    <p
                      style={{
                        color: "#888",
                        fontSize: "0.85rem",
                        marginBottom: 15,
                      }}
                    >
                      Update your public username or login password.
                    </p>

                    <input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 12,
                        background: "#000",
                        border: "1px solid #444",
                        color: "#fff",
                        borderRadius: 8,
                        marginBottom: 10,
                      }}
                    />

                    <input
                      type="password"
                      placeholder="New Password (optional)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 12,
                        background: "#000",
                        border: "1px solid #444",
                        color: "#fff",
                        borderRadius: 8,
                        marginBottom: 10,
                      }}
                    />
                    <button
                      onClick={handleUpdatePassword}
                      style={{
                        width: "100%",
                        padding: 12,
                        background: "var(--brand)",
                        border: "none",
                        borderRadius: 8,
                        color: "#fff",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Update Account
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div
                    style={{
                      background: "#1f1f22",
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid #333",
                    }}
                  >
                    <label
                      style={{
                        fontSize: "0.85rem",
                        color: "#f59e0b",
                        fontWeight: 600,
                        marginBottom: 8,
                        display: "block",
                      }}
                    >
                      🎯 Manual Calorie Target
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 2200"
                      value={userProfile.target_calories || ""}
                      onChange={(e) =>
                        setUserProfile({
                          ...userProfile,
                          target_calories: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: 12,
                        background: "#000",
                        border: "1px solid #444",
                        color: "#fff",
                        borderRadius: 8,
                        fontSize: "1rem",
                        fontWeight: 600,
                      }}
                    />
                  </div>
                  <div
                    style={{ opacity: userProfile.target_calories ? 0.5 : 1 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 8,
                      }}
                    >
                      <Calculator size={14} color="#3b82f6" />
                      <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                        Auto-Calculate
                      </span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: "0.7rem",
                            color: "#888",
                            marginBottom: 3,
                            display: "block",
                          }}
                        >
                          Weight (kg)
                        </label>
                        <input
                          type="number"
                          value={userProfile.weight}
                          onChange={(e) =>
                            setUserProfile({
                              ...userProfile,
                              weight: e.target.value,
                            })
                          }
                          style={{
                            width: "100%",
                            padding: 8,
                            background: "#000",
                            border: "1px solid #333",
                            color: "#fff",
                            borderRadius: 8,
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: "0.7rem",
                            color: "#888",
                            marginBottom: 3,
                            display: "block",
                          }}
                        >
                          Height (cm)
                        </label>
                        <input
                          type="number"
                          value={userProfile.height}
                          onChange={(e) =>
                            setUserProfile({
                              ...userProfile,
                              height: e.target.value,
                            })
                          }
                          style={{
                            width: "100%",
                            padding: 8,
                            background: "#000",
                            border: "1px solid #333",
                            color: "#fff",
                            borderRadius: 8,
                          }}
                        />
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1.5fr",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: "0.7rem",
                            color: "#888",
                            marginBottom: 3,
                            display: "block",
                          }}
                        >
                          Age
                        </label>
                        <input
                          type="number"
                          value={userProfile.age}
                          onChange={(e) =>
                            setUserProfile({
                              ...userProfile,
                              age: e.target.value,
                            })
                          }
                          style={{
                            width: "100%",
                            padding: 8,
                            background: "#000",
                            border: "1px solid #333",
                            color: "#fff",
                            borderRadius: 8,
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: "0.7rem",
                            color: "#888",
                            marginBottom: 4,
                            display: "block",
                          }}
                        >
                          Gender
                        </label>
                        <div
                          style={{
                            display: "flex",
                            height: 42,
                            background: "#000",
                            borderRadius: 8,
                            border: "1px solid #333",
                            overflow: "hidden",
                          }}
                        >
                          {["male", "female"].map((g) => (
                            <button
                              key={g}
                              onClick={() =>
                                setUserProfile({ ...userProfile, gender: g })
                              }
                              style={{
                                flex: 1,
                                background:
                                  userProfile.gender === g
                                    ? "#333"
                                    : "transparent",
                                border: "none",
                                color:
                                  userProfile.gender === g ? "#fff" : "#666",
                                textTransform: "capitalize",
                                fontSize: "0.85rem",
                                cursor: "pointer",
                                fontWeight:
                                  userProfile.gender === g ? 600 : 400,
                              }}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <label
                        style={{
                          fontSize: "0.7rem",
                          color: "#888",
                          marginBottom: 3,
                          display: "block",
                        }}
                      >
                        Activity Level
                      </label>
                      <select
                        value={userProfile.activity}
                        onChange={(e) =>
                          setUserProfile({
                            ...userProfile,
                            activity: e.target.value,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: 8,
                          background: "#000",
                          border: "1px solid #333",
                          color: "#fff",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontSize: "0.82rem",
                        }}
                      >
                        <option value="sedentary">
                          Sedentary (Office Job)
                        </option>
                        <option value="light">Light Exercise (1-3 days)</option>
                        <option value="moderate">
                          Moderate Exercise (3-5 days)
                        </option>
                        <option value="active">Active (6-7 days)</option>
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "0.75rem",
                          color: "#888",
                          marginBottom: 4,
                          display: "block",
                        }}
                      >
                        Goal Preset
                      </label>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                        }}
                      >
                        {GOAL_PRESETS.map((g) => (
                          <button
                            key={g.id}
                            onClick={() =>
                              setUserProfile({
                                ...userProfile,
                                goal: g.id,
                                calorie_adjustment: g.calorie_adjustment,
                                protein_priority: g.protein_priority,
                              })
                            }
                            style={{
                              padding: "10px 12px",
                              background:
                                userProfile.goal === g.id
                                  ? g.color + "22"
                                  : "#000",
                              border:
                                userProfile.goal === g.id
                                  ? `2px solid ${g.color}`
                                  : "1px solid #333",
                              borderRadius: 10,
                              color:
                                userProfile.goal === g.id ? g.color : "#aaa",
                              textAlign: "left",
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            <div
                              style={{ fontWeight: 700, fontSize: "0.82rem" }}
                            >
                              {g.label}
                            </div>
                            <div
                              style={{
                                fontSize: "0.68rem",
                                opacity: 0.75,
                                marginTop: 2,
                              }}
                            >
                              {g.desc}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Medical conflicts & adjustments ──────────────────
                        Shown immediately under the goal picker, because this is
                        exactly where a goal can contradict the user's blood
                        work (e.g. muscle-gain protein with flagged kidney
                        markers). Wording stays observational — it cites the
                        marker and defers to their doctor, never diagnoses. */}
                    {(() => {
                      const { conflicts, adjustments } = calculateTargets(
                        userProfile,
                        conditions,
                      ).medical;
                      if (!conflicts.length && !adjustments.length) return null;

                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {conflicts.map((c) => (
                            <div
                              key={c.title}
                              style={{
                                background: "rgba(239,68,68,0.08)",
                                border: "1px solid rgba(239,68,68,0.3)",
                                borderRadius: 10,
                                padding: "10px 12px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  fontWeight: 700,
                                  fontSize: "0.8rem",
                                  color: "#ef4444",
                                  marginBottom: 3,
                                }}
                              >
                                <AlertTriangle size={13} /> {c.title}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "#a1a1aa", lineHeight: 1.55 }}>
                                {c.detail}
                              </div>
                            </div>
                          ))}

                          {adjustments.map((a) => (
                            <div
                              key={a.title}
                              style={{
                                background: "rgba(59,130,246,0.07)",
                                border: "1px solid rgba(59,130,246,0.25)",
                                borderRadius: 10,
                                padding: "9px 12px",
                                fontSize: "0.75rem",
                                color: "#93c5fd",
                                lineHeight: 1.5,
                              }}
                            >
                              <strong style={{ color: "#bfdbfe" }}>{a.title}.</strong>{" "}
                              {a.detail}
                            </div>
                          ))}

                          <div style={{ fontSize: "0.68rem", color: "#52525b", lineHeight: 1.5 }}>
                            Based on markers flagged on your uploaded reports. This
                            is not a diagnosis — your doctor&apos;s advice takes
                            precedence.
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Fine-tune dials ─────────────────────────────────── */}
                    <div>
                      <label
                        style={{
                          fontSize: "0.75rem",
                          color: "#888",
                          marginBottom: 4,
                          display: "block",
                        }}
                      >
                        Calorie Adjustment from TDEE
                      </label>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <input
                          type="range"
                          min="-700"
                          max="500"
                          step="50"
                          value={userProfile.calorie_adjustment ?? 0}
                          onChange={(e) =>
                            setUserProfile({
                              ...userProfile,
                              calorie_adjustment: Number(e.target.value),
                              goal: "custom",
                            })
                          }
                          style={{ flex: 1, accentColor: "var(--brand)" }}
                        />
                        <span
                          style={{
                            minWidth: 56,
                            textAlign: "right",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            color:
                              (userProfile.calorie_adjustment ?? 0) < 0
                                ? "#ef4444"
                                : (userProfile.calorie_adjustment ?? 0) > 0
                                  ? "#3b82f6"
                                  : "#22c55e",
                          }}
                        >
                          {(userProfile.calorie_adjustment ?? 0) > 0 ? "+" : ""}
                          {userProfile.calorie_adjustment ?? 0} kcal
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.65rem",
                          color: "#555",
                          marginTop: 2,
                        }}
                      >
                        <span>Aggressive cut</span>
                        <span>TDEE</span>
                        <span>Bulk</span>
                      </div>
                    </div>

                    <div>
                      <label
                        style={{
                          fontSize: "0.75rem",
                          color: "#888",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Protein Priority
                      </label>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: 6,
                        }}
                      >
                        {[
                          {
                            id: "preserve",
                            label: "Preserve",
                            sub: "2.0g/kg",
                            tip: "Deep deficit — protect muscle",
                          },
                          {
                            id: "balanced",
                            label: "Balanced",
                            sub: "1.8g/kg",
                            tip: "Standard for most goals",
                          },
                          {
                            id: "maximize",
                            label: "Maximize",
                            sub: "2.4g/kg",
                            tip: "Recomp / aggressive build",
                          },
                        ].map((p) => (
                          <button
                            key={p.id}
                            onClick={() =>
                              setUserProfile({
                                ...userProfile,
                                protein_priority: p.id,
                                goal:
                                  userProfile.goal === "custom"
                                    ? "custom"
                                    : userProfile.goal,
                              })
                            }
                            title={p.tip}
                            style={{
                              padding: "8px 6px",
                              background:
                                userProfile.protein_priority === p.id
                                  ? "#6366f122"
                                  : "#000",
                              border:
                                userProfile.protein_priority === p.id
                                  ? "2px solid #6366f1"
                                  : "1px solid #333",
                              borderRadius: 8,
                              color:
                                userProfile.protein_priority === p.id
                                  ? "#6366f1"
                                  : "#aaa",
                              cursor: "pointer",
                              textAlign: "center",
                            }}
                          >
                            <div
                              style={{ fontWeight: 700, fontSize: "0.78rem" }}
                            >
                              {p.label}
                            </div>
                            <div
                              style={{
                                fontSize: "0.65rem",
                                opacity: 0.7,
                                marginTop: 1,
                              }}
                            >
                              {p.sub}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Live target preview ─────────────────────────────── */}
                    {(() => {
                      const preview = calculateTargets(userProfile, conditions);
                      return (
                        <div
                          style={{
                            background: "#0a0a0a",
                            border: "1px solid #27272a",
                            borderRadius: 10,
                            padding: "10px 14px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.7rem",
                              color: "#52525b",
                              marginBottom: 6,
                              fontWeight: 600,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                            }}
                          >
                            Target Preview
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(5, 1fr)",
                              gap: 4,
                              textAlign: "center",
                            }}
                          >
                            {[
                              {
                                label: "Cals",
                                val: preview.cals,
                                unit: "",
                                color: "#f59e0b",
                              },
                              {
                                label: "Protein",
                                val: preview.p,
                                unit: "g",
                                color: "#6366f1",
                              },
                              {
                                label: "Carbs",
                                val: preview.c,
                                unit: "g",
                                color: "#22c55e",
                              },
                              {
                                label: "Fat",
                                val: preview.f,
                                unit: "g",
                                color: "#f97316",
                              },
                              {
                                label: "Fiber",
                                val: preview.fib,
                                unit: "g",
                                color: "#8b5cf6",
                              },
                            ].map((m) => (
                              <div key={m.label}>
                                <div
                                  style={{
                                    fontWeight: 800,
                                    fontSize: "0.88rem",
                                    color: m.color,
                                  }}
                                >
                                  {m.val}
                                  {m.unit}
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.6rem",
                                    color: "#52525b",
                                    marginTop: 1,
                                  }}
                                >
                                  {m.label}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
            {/* end scrollable body */}

            {/* ── Pinned save button ───────────────────────────────── */}
            {settingsTab === "profile" && (
              <div
                style={{
                  padding: "12px 16px",
                  paddingBottom:
                    "calc(24px + env(safe-area-inset-bottom, 0px))",
                  flexShrink: 0,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <button
                  onClick={saveGoal}
                  style={{
                    width: "100%",
                    padding: 14,
                    background: "var(--brand)",
                    border: "none",
                    color: "#fff",
                    borderRadius: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: "0.95rem",
                  }}
                >
                  Save Profile
                </button>
              </div>
            )}
          </div>
          {/* end bottom sheet */}
        </div>
  );
}
