"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  AlertCircle,
  Info,
  BookOpen,
  Trophy,
  Flame,
  X,
  Beef,
  Droplets,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "../supabase";

const COLORS = { pro: "#3b82f6", carb: "#10b981", fat: "#f59e0b" };

export default function UserDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  // METRICS
  const [metrics, setMetrics] = useState({
    eaten: 0,
    target: 0,
    status: "Loading...",
    macros: { p: 0, c: 0, f: 0 },
    targets: { p: 0, c: 0, f: 0 },
    water: { current: 0, target: 0 },
  });

  // CHART DATA
  const [macroData, setMacroData] = useState([]);
  const [topCalFoods, setTopCalFoods] = useState([]);
  const [topProFoods, setTopProFoods] = useState([]);
  const [calendarData, setCalendarData] = useState([]);

  // INTERACTIVE
  const [allLogs, setAllLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [showResearch, setShowResearch] = useState(false);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      const startDay = new Date();
      startDay.setDate(startDay.getDate() - 30);
      const startStr = startDay.toISOString().slice(0, 10);

      const { data: logData } = await supabase
        .from("food_logs")
        .select("*")
        .eq("user_id", session.user.id)
        .gte("date", startStr)
        .order("created_at", { ascending: true });

      setProfile(profileData);
      setAllLogs(logData || []);

      // 1. Process Data
      const calculatedTargets = processCalendarData(profileData, logData || []);

      // 2. Select Today
      handleDateSelect(today, logData || [], calculatedTargets);
      setLoading(false);
    };
    init();
  }, []);

  // --- 1. STANDARDIZED TARGET CALCULATOR (MATCHING SOCIAL PAGE) ---
  const calculateTargets = (prof) => {
    if (!prof || !prof.weight)
      return {
        targetCals: 2000,
        targetMacros: { p: 150, c: 200, f: 60 },
        waterTarget: 3,
      };

    // 1. Calories
    let targetCals = 2000;
    if (prof.target_calories) {
      targetCals = Number(prof.target_calories);
    } else {
      let bmr = 10 * prof.weight + 6.25 * prof.height - 5 * prof.age;
      bmr += prof.gender === "male" ? 5 : -161;
      const multipliers = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
      };
      let tdee = bmr * (multipliers[prof.activity] || 1.2);

      targetCals = Math.round(tdee);
      if (prof.goal === "lose") targetCals -= 500;
      else if (prof.goal === "gain") targetCals += 300;
    }

    // 2. Macros
    const weight = Number(prof.weight);
    let targetP, targetF, targetC;

    if (prof.goal === "lose") {
      targetP = Math.round(weight * 2.2);
      targetF = Math.round((targetCals * 0.3) / 9);
    } else if (prof.goal === "gain") {
      targetP = Math.round(weight * 1.8);
      targetF = Math.round((targetCals * 0.25) / 9);
    } else {
      // Maintain
      targetP = Math.round(weight * 1.6);
      targetF = Math.round((targetCals * 0.3) / 9);
    }

    const usedCals = targetP * 4 + targetF * 9;
    targetC = Math.round(Math.max(0, targetCals - usedCals) / 4);

    // 3. Water Target
    let waterTarget = Math.round(weight * 0.035 * 10) / 10;
    if (prof.activity === "active" || prof.activity === "moderate")
      waterTarget += 0.5;

    return {
      targetCals,
      targetMacros: { p: targetP, c: targetC, f: targetF },
      waterTarget,
    };
  };

  const handleDateSelect = (dateStr, logsSource, preCalcTargets) => {
    const logsToFilter = logsSource || allLogs;
    const dailyLogs = logsToFilter.filter((l) => l.date === dateStr);

    setSelectedDate(dateStr);
    setSelectedLogs(dailyLogs);

    // Sums
    const eatenCals = dailyLogs.reduce(
      (sum, item) => sum + (item.calories || 0),
      0
    );
    const macrosEaten = dailyLogs.reduce(
      (acc, item) => ({
        p: acc.p + (item.protein || 0),
        c: acc.c + (item.carbs || 0),
        f: acc.f + (item.fats || 0),
      }),
      { p: 0, c: 0, f: 0 }
    );
    const waterConsumed = dailyLogs
      .filter((i) => i.name === "Water")
      .reduce((acc, item) => acc + item.qty * 0.25, 0);

    // Top Contributors
    const foodMap = {};
    dailyLogs.forEach((l) => {
      if (l.name !== "Water") {
        if (!foodMap[l.name])
          foodMap[l.name] = { name: l.name, cals: 0, protein: 0 };
        foodMap[l.name].cals += l.calories;
        foodMap[l.name].protein += l.protein;
      }
    });
    const foods = Object.values(foodMap);
    setTopCalFoods(foods.sort((a, b) => b.cals - a.cals).slice(0, 5));
    setTopProFoods(
      [...foods].sort((a, b) => b.protein - a.protein).slice(0, 5)
    );

    // Targets & Status
    const targets = preCalcTargets || calculateTargets(profile);
    let status = "On Track";
    let statusColor = "#22c55e";
    const diff = eatenCals - targets.targetCals;
    if (Math.abs(diff) < 200) {
      status = "Perfect Zone";
      statusColor = "#22c55e";
    } else if (diff < -500) {
      status = "Under Eating";
      statusColor = "#f59e0b";
    } else if (diff > 500) {
      status = "Over Eating";
      statusColor = "#ef4444";
    } else {
      status = diff > 0 ? "Slight Surplus" : "Slight Deficit";
      statusColor = "#3b82f6";
    }

    setMetrics({
      eaten: eatenCals,
      target: targets.targetCals,
      status,
      statusColor,
      macros: macrosEaten,
      targets: targets.targetMacros,
      water: { current: waterConsumed, target: targets.waterTarget },
    });

    setMacroData([
      { name: "Protein", value: macrosEaten.p, color: COLORS.pro },
      { name: "Carbs", value: macrosEaten.c, color: COLORS.carb },
      { name: "Fats", value: macrosEaten.f, color: COLORS.fat },
    ]);
  };

  const processCalendarData = (prof, logs) => {
    if (!prof) return;
    const targets = calculateTargets(prof);
    const calendarMap = {};

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      calendarMap[dateStr] = { cals: 0, protein: 0 };
    }

    logs.forEach((l) => {
      if (calendarMap[l.date]) {
        calendarMap[l.date].cals += l.calories || 0;
        calendarMap[l.date].protein += l.protein || 0;
      }
    });

    const calData = Object.keys(calendarMap)
      .sort()
      .map((date) => {
        const day = calendarMap[date];
        let color = "#27272a";
        if (day.cals > 0) {
          const calDiff = Math.abs(day.cals - targets.targetCals);
          if (calDiff < 300 && day.protein >= targets.targetMacros.p * 0.8)
            color = "#22c55e";
          else if (calDiff < 300) color = "#f59e0b";
          else color = "#ef4444";
        }
        return { date, color, cals: day.cals };
      });
    setCalendarData(calData);
    return targets;
  };

  if (loading)
    return (
      <div style={{ padding: 20, color: "#666", textAlign: "center" }}>
        Loading analytics...
      </div>
    );

  return (
    <div
      className="app-wrapper"
      style={{ maxWidth: 1000, margin: "0 auto", padding: 20 }}
    >
      {/* RESEARCH MODAL */}
      {showResearch && (
        <div className="modal-overlay">
          <div
            className="modal-content"
            style={{
              maxWidth: 500,
              background: "#18181b",
              border: "1px solid #333",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: "1.2rem",
                }}
              >
                <BookOpen size={22} color="#3b82f6" /> Nutritional Science
              </h3>
              <button
                onClick={() => setShowResearch(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#666",
                  cursor: "pointer",
                }}
              >
                <X />
              </button>
            </div>
            <div style={{ color: "#ccc", lineHeight: 1.7 }}>
              <p style={{ marginBottom: 20 }}>
                NutriTrack uses the <strong>Mifflin-St Jeor Equation</strong>,
                the current gold standard for calculating metabolic rate in
                clinical settings.
              </p>
              <div
                style={{
                  background: "#121214",
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 16,
                  border: "1px solid #222",
                }}
              >
                <h4
                  style={{
                    color: "#f59e0b",
                    marginBottom: 8,
                    fontSize: "0.95rem",
                  }}
                >
                  1. BMR (Basal Metabolic Rate)
                </h4>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    background: "#000",
                    padding: 10,
                    borderRadius: 6,
                    color: "#888",
                    marginBottom: 10,
                  }}
                >
                  Men: (10 × W) + (6.25 × H) - (5 × A) + 5<br />
                  Women: (10 × W) + (6.25 × H) - (5 × A) - 161
                </div>
                <p style={{ fontSize: "0.85rem", color: "#888" }}>
                  This calculates the energy your body burns just to exist at
                  rest.
                </p>
              </div>
              <div
                style={{
                  background: "#121214",
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 16,
                  border: "1px solid #222",
                }}
              >
                <h4
                  style={{
                    color: "#3b82f6",
                    marginBottom: 8,
                    fontSize: "0.95rem",
                  }}
                >
                  2. Protein Needs (ISSN)
                </h4>
                <p style={{ fontSize: "0.85rem", color: "#888" }}>
                  We prioritize protein based on <strong>Lean Body Mass</strong>{" "}
                  retention:
                </p>
                <ul
                  style={{
                    fontSize: "0.85rem",
                    color: "#888",
                    marginTop: 8,
                    paddingLeft: 20,
                  }}
                >
                  <li style={{ marginBottom: 4 }}>
                    <strong>Fat Loss:</strong> 2.2g / kg (Prevents muscle
                    catabolism)
                  </li>
                  <li style={{ marginBottom: 4 }}>
                    <strong>Maintenance:</strong> 1.6g / kg (Optimal synthesis)
                  </li>
                  <li>
                    <strong>Muscle Gain:</strong> 1.8g / kg (Support
                    hypertrophy)
                  </li>
                </ul>
              </div>
              <div
                style={{
                  background: "#121214",
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid #222",
                }}
              >
                <h4
                  style={{
                    color: "#10b981",
                    marginBottom: 8,
                    fontSize: "0.95rem",
                  }}
                >
                  3. Hydration (ACSM)
                </h4>
                <p style={{ fontSize: "0.85rem", color: "#888" }}>
                  <strong>Formula:</strong> Body Weight (kg) × 0.035 Liters.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "#1f1f22",
              border: "1px solid #333",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 10,
              borderRadius: 10,
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: 0 }}>
            Performance
          </h1>
        </div>
        <button
          onClick={() => setShowResearch(true)}
          style={{
            background: "#1f1f22",
            border: "1px solid #333",
            color: "#3b82f6",
            cursor: "pointer",
            padding: "8px 16px",
            borderRadius: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          <Info size={18} /> Logic
        </button>
      </div>

      {!profile ? (
        <div
          style={{
            background: "#27272a",
            padding: 30,
            borderRadius: 12,
            textAlign: "center",
            color: "#aaa",
          }}
        >
          <AlertCircle size={40} style={{ marginBottom: 10, opacity: 0.5 }} />
          <p>Please set your Weight & Goal on the main page.</p>
        </div>
      ) : (
        <>
          {/* ROW 1: STATUS CARD */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 20,
              padding: 30,
              marginBottom: 24,
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: 4,
                background: metrics.statusColor,
              }}
            ></div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: 2,
                fontWeight: 600,
              }}
            >
              Energy Balance (
              {selectedDate === new Date().toISOString().slice(0, 10)
                ? "Today"
                : selectedDate}
              )
            </div>
            <div
              style={{
                fontSize: "3rem",
                fontWeight: 800,
                color: metrics.statusColor,
                margin: "10px 0",
                lineHeight: 1,
              }}
            >
              {metrics.status}
            </div>
            <div style={{ color: "#ccc", fontSize: "1.1rem" }}>
              {metrics.eaten}{" "}
              <span style={{ color: "#666" }}>/ {metrics.target} kcal</span>
            </div>
          </div>

          {/* ROW 2: GRID */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 20,
              marginBottom: 20,
            }}
          >
            {/* HYDRATION */}
            <div
              className="chart-card"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  marginBottom: 15,
                  display: "flex",
                  gap: 8,
                }}
              >
                <Calendar size={18} color="#22c55e" /> 30-Day Consistency
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 6,
                  flex: 1,
                }}
              >
                {calendarData.map((day, i) => (
                  <div
                    key={i}
                    onClick={() => handleDateSelect(day.date)}
                    style={{
                      aspectRatio: "1/1",
                      background: day.color,
                      borderRadius: 4,
                      cursor: "pointer",
                      opacity: day.date === selectedDate ? 1 : 0.4,
                      border:
                        day.date === selectedDate
                          ? "2px solid white"
                          : "1px solid transparent",
                      transition: "all 0.2s",
                    }}
                    title={`${day.date}: ${day.cals} kcal`}
                  ></div>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 15,
                  paddingTop: 15,
                  borderTop: "1px solid #333",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "0.7rem",
                    color: "#ccc",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#22c55e",
                    }}
                  ></div>{" "}
                  Perfect
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "0.7rem",
                    color: "#ccc",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#f59e0b",
                    }}
                  ></div>{" "}
                  Good Cals
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "0.7rem",
                    color: "#ccc",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#ef4444",
                    }}
                  ></div>{" "}
                  UnderAte/OverAte
                </div>
              </div>
            </div>

            {/* 1. HYDRATION (ADDED BACK) */}
            <div
              className="chart-card"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                <h3
                  style={{
                    fontSize: "1.1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontWeight: 700,
                  }}
                >
                  <Droplets size={20} color="#3b82f6" /> Hydration
                </h3>
                <span
                  style={{
                    fontSize: "0.9rem",
                    color: "#3b82f6",
                    background: "rgba(59, 130, 246, 0.1)",
                    padding: "4px 8px",
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                >
                  {Math.round(
                    (metrics.water.current / metrics.water.target) * 100
                  )}
                  %
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 4,
                  marginBottom: 16,
                }}
              >
                <span
                  style={{ fontSize: "2.5rem", fontWeight: 800, color: "#fff" }}
                >
                  {metrics.water.current}L
                </span>
                <span style={{ fontSize: "1.2rem", color: "#666" }}>
                  / {metrics.water.target}L
                </span>
              </div>
              <div
                style={{
                  background: "#27272a",
                  height: 16,
                  borderRadius: 8,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      (metrics.water.current / metrics.water.target) * 100
                    )}%`,
                    height: "100%",
                    background: "#3b82f6",
                    transition: "width 1s ease",
                  }}
                ></div>
              </div>
            </div>

            {/* 3. PROTEIN CONTRIBUTORS */}
            <div className="chart-card" style={{ padding: 24 }}>
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  marginBottom: 15,
                  display: "flex",
                  gap: 8,
                }}
              >
                <Beef size={18} color="#3b82f6" /> Top Protein Sources
              </h3>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {topProFoods.length === 0 ? (
                  <div style={{ color: "#666", fontStyle: "italic" }}>
                    No logs for {selectedDate}
                  </div>
                ) : (
                  topProFoods.map((food, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: "0.9rem",
                            color: "#fff",
                            textTransform: "capitalize",
                          }}
                        >
                          {i + 1}. {food.name}
                        </div>
                        <div
                          style={{
                            width: "100%",
                            background: "#222",
                            height: 4,
                            borderRadius: 2,
                            marginTop: 4,
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(
                                100,
                                (food.protein / topProFoods[0].protein) * 100
                              )}%`,
                              background: "#3b82f6",
                              height: "100%",
                              borderRadius: 2,
                            }}
                          ></div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", marginLeft: 10 }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                          {food.protein}g
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* TOP CALORIES */}
            <div className="chart-card" style={{ padding: 24 }}>
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  marginBottom: 15,
                  display: "flex",
                  gap: 8,
                }}
              >
                <Trophy size={18} color="#ef4444" /> Top Calorie Sources
              </h3>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {topCalFoods.length === 0 ? (
                  <div style={{ color: "#666", fontStyle: "italic" }}>
                    No logs for {selectedDate}
                  </div>
                ) : (
                  topCalFoods.map((food, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: "0.9rem",
                            color: "#fff",
                            textTransform: "capitalize",
                          }}
                        >
                          {i + 1}. {food.name}
                        </div>
                        <div
                          style={{
                            width: "100%",
                            background: "#222",
                            height: 4,
                            borderRadius: 2,
                            marginTop: 4,
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(
                                100,
                                (food.cals / topCalFoods[0].cals) * 100
                              )}%`,
                              background: "#ef4444",
                              height: "100%",
                              borderRadius: 2,
                            }}
                          ></div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", marginLeft: 10 }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                          {food.cals}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "#666" }}>
                          kcal
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ROW 3: MACROS & INTAKE */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              marginBottom: 20,
            }}
          >
            {/* MACRO CHART */}
            <div
              className="chart-card"
              style={{
                padding: 24,
                flex: "1 1 300px",
                height: 500,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                  Macro Targets
                </h3>
                <span style={{ fontSize: "0.7rem", color: "#666" }}>
                  For {selectedDate}
                </span>
              </div>
              <div style={{ flex: 1, width: "100%", minHeight: 0 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={macroData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {macroData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#000",
                        border: "1px solid #333",
                        borderRadius: 8,
                      }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid #222",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.9rem",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: COLORS.pro,
                      }}
                    ></div>{" "}
                    Protein
                  </span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                    {Math.round(metrics.macros.p)}{" "}
                    <span style={{ color: "#666", fontWeight: 400 }}>
                      / {metrics.targets.p}g
                    </span>
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid #222",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.9rem",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: COLORS.carb,
                      }}
                    ></div>{" "}
                    Carbs
                  </span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                    {Math.round(metrics.macros.c)}{" "}
                    <span style={{ color: "#666", fontWeight: 400 }}>
                      / {metrics.targets.c}g
                    </span>
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.9rem",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: COLORS.fat,
                      }}
                    ></div>{" "}
                    Fats
                  </span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                    {Math.round(metrics.macros.f)}{" "}
                    <span style={{ color: "#666", fontWeight: 400 }}>
                      / {metrics.targets.f}g
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* INTAKE LIST */}
            <div
              className="chart-card"
              style={{
                padding: 24,
                flex: "2 1 400px",
                height: 500,
                display: "flex",
                flexDirection: "column",
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
                  <div style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}>
                    {selectedLogs.map((log) => (
                      <div
                        key={log.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "14px 0",
                          borderBottom: "1px solid #222",
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
                              <span style={{ color: COLORS.fat }}>
                                F: {log.fats}
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
                    ))}
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
                      {selectedLogs.reduce(
                        (sum, item) => sum + (item.calories || 0),
                        0
                      )}{" "}
                      kcal
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
