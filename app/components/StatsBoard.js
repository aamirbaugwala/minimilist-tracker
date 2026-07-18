"use client";

import { memo } from "react";
import { Droplets } from "lucide-react";
import { calculateTargets, capPct } from "../lib/nutrition";

const StatsBoard = memo(({ totals, userProfile, onAddWater, conditions }) => {
  // Targets respect any enforced medical adjustments, so the rings on the home
  // screen match what Settings shows.
  const targets = calculateTargets(userProfile, conditions);
  const targetCals = targets.cals;
  const targetP = targets.p;
  const targetC = targets.c;
  const targetF = targets.f;
  const targetFib = targets.fib;
  const targetWater = targets.water;
  const pct = capPct;

  // SVG ring for calories
  const R = 54;
  const circ = 2 * Math.PI * R;
  const calPct = Math.min(totals.calories / targetCals, 1);
  const calDash = calPct * circ;
  const isOver = totals.calories > targetCals;
  const ringColor = isOver
    ? "#ef4444"
    : totals.calories / targetCals > 0.9
      ? "#22c55e"
      : "#3b82f6";
  const remaining = Math.max(0, targetCals - totals.calories);

  return (
    <section style={{ padding: "20px 20px 0" }}>
      {/* HERO CALORIE CARD */}
      <div
        style={{
          background: "linear-gradient(160deg, #111116, #18181e)",
          borderRadius: 24,
          padding: "24px 20px 20px",
          border: "1px solid #1e1e26",
          marginBottom: 12,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* subtle gradient orb */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${ringColor}18 0%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* SVG Calorie Ring */}
          <div
            style={{
              position: "relative",
              width: 128,
              height: 128,
              flexShrink: 0,
            }}
          >
            <svg
              width="128"
              height="128"
              style={{ transform: "rotate(-90deg)" }}
            >
              <circle
                cx="64"
                cy="64"
                r={R}
                fill="none"
                stroke="#1e1e26"
                strokeWidth="12"
              />
              <circle
                cx="64"
                cy="64"
                r={R}
                fill="none"
                stroke={ringColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${calDash} ${circ}`}
                style={{
                  transition: "stroke-dasharray 0.8s ease, stroke 0.3s ease",
                }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 900,
                  color: "#fff",
                  lineHeight: 1,
                }}
              >
                {totals.calories}
              </div>
              <div
                style={{
                  fontSize: "0.62rem",
                  color: "#555",
                  fontWeight: 600,
                  marginTop: 2,
                }}
              >
                / {targetCals} kcal
              </div>
            </div>
          </div>

          {/* Right info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.7rem",
                color: "#444",
                textTransform: "uppercase",
                letterSpacing: 1.5,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Calories Today
            </div>
            <div
              style={{
                fontSize: "1.6rem",
                fontWeight: 800,
                color: ringColor,
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {isOver
                ? "Over budget"
                : remaining === 0
                  ? "Goal hit! 🎉"
                  : `${remaining} left`}
            </div>
            <div style={{ fontSize: "0.82rem", color: "#555" }}>
              {Math.round(calPct * 100)}% of daily target
            </div>

            {/* Calorie bar */}
            <div
              style={{
                background: "#1e1e26",
                height: 6,
                borderRadius: 3,
                overflow: "hidden",
                marginTop: 12,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, calPct * 100)}%`,
                  background: ringColor,
                  borderRadius: 3,
                  transition: "width 0.8s ease",
                }}
              />
            </div>
          </div>
        </div>

        {/* MACRO PILLS ROW */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
            marginTop: 20,
          }}
        >
          {[
            {
              label: "Protein",
              val: totals.protein,
              target: targetP,
              color: "#3b82f6",
              bg: "rgba(59,130,246,0.1)",
            },
            {
              label: "Carbs",
              val: totals.carbs,
              target: targetC,
              color: "#f59e0b",
              bg: "rgba(245,158,11,0.1)",
            },
            {
              label: "Fats",
              val: totals.fats,
              target: targetF,
              color: "#ef4444",
              bg: "rgba(239,68,68,0.1)",
            },
            {
              label: "Fiber",
              val: totals.fiber,
              target: targetFib,
              color: "#22c55e",
              bg: "rgba(34,197,94,0.1)",
            },
          ].map(({ label, val, target, color, bg }) => {
            const p = pct(val, target);
            return (
              <div
                key={label}
                style={{
                  background: bg,
                  borderRadius: 12,
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 800,
                    color,
                    lineHeight: 1,
                  }}
                >
                  {val}
                </div>
                <div
                  style={{
                    fontSize: "0.58rem",
                    color: "#555",
                    fontWeight: 600,
                    marginTop: 2,
                  }}
                >
                  / {target}g
                </div>
                <div
                  style={{
                    background: "#1e1e26",
                    height: 3,
                    borderRadius: 2,
                    overflow: "hidden",
                    marginTop: 6,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${p}%`,
                      background: color,
                      borderRadius: 2,
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
                <div
                  style={{ fontSize: "0.6rem", color: "#444", marginTop: 3 }}
                >
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WATER CARD */}
      <div
        onClick={onAddWater}
        style={{
          position: "relative",
          background: "rgba(59,130,246,0.05)",
          borderRadius: 16,
          padding: "14px 18px",
          border: "1px solid rgba(59,130,246,0.15)",
          overflow: "hidden",
          cursor: "pointer",
          marginBottom: 0,
          transition: "border-color 0.2s",
        }}
      >
        {/* fill bar background */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${Math.min(100, ((totals.water * 0.25) / targetWater) * 100)}%`,
            background: "rgba(59,130,246,0.1)",
            transition: "0.5s ease",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Droplets size={20} color="#3b82f6" />
            <div>
              <div
                style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff" }}
              >
                Hydration
              </div>
              <div style={{ fontSize: "0.75rem", color: "#555" }}>
                <span style={{ color: "#3b82f6", fontWeight: 700 }}>
                  {(totals.water * 0.25).toFixed(2)}L
                </span>{" "}
                / {targetWater}L
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{ fontSize: "0.75rem", color: "#3b82f6", fontWeight: 700 }}
            >
              {Math.round(((totals.water * 0.25) / targetWater) * 100) || 0}%
            </div>
            <div
              style={{
                background: "rgba(59,130,246,0.15)",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: 8,
                padding: "4px 10px",
                fontSize: "0.78rem",
                color: "#3b82f6",
                fontWeight: 700,
              }}
            >
              + Glass
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
StatsBoard.displayName = "StatsBoard";

export default StatsBoard;
