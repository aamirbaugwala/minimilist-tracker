"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  AlertCircle,
  Info,
  BookOpen,
  Droplets,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { supabase } from "../supabase";

const COLORS = { pro: "#3b82f6", carb: "#10b981", fat: "#f59e0b" };

export default function UserDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  // METRICS STATE (Drives the Top Card & Macro Text)
  const [metrics, setMetrics] = useState({
    eaten: 0,
    target: 0,
    status: "Loading...",
    macros: { p: 0, c: 0, f: 0 },
    targets: { p: 0, c: 0, f: 0 },
    water: { current: 0, target: 0 },
  });

  const [historyData, setHistoryData] = useState([]);
  const [macroData, setMacroData] = useState([]); // Drives the Pie Chart

  // INTERACTIVE STATE
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
      startDay.setDate(startDay.getDate() - 6);
      const startStr = startDay.toISOString().slice(0, 10);

      const { data: logData } = await supabase
        .from("food_logs")
        .select("*")
        .eq("user_id", session.user.id)
        .gte("date", startStr)
        .order("date", { ascending: true });

      setProfile(profileData);
      setAllLogs(logData || []);

      // Calculate Static Targets & History once
      processStaticData(profileData, logData || [], today);

      // Select Today by default (Triggers the Macro/List update)
      handleDateSelect(today, logData || [], profileData);
      setLoading(false);
    };
    init();
  }, []);

  // --- RE-CALCULATE EVERYTHING WHEN DATE IS SELECTED ---
  const handleDateSelect = (dateStr, logsSource, profSource) => {
    const prof = profSource || profile;
    if (!prof) return;

    const logsToFilter = logsSource || allLogs;
    const dailyLogs = logsToFilter.filter((l) => l.date === dateStr);

    // 1. Update List View
    setSelectedDate(dateStr);
    setSelectedLogs(dailyLogs);

    // 2. Calculate Daily Sums
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

    const waterItems = dailyLogs.filter((i) => i.name === "Water");
    const waterConsumed = waterItems.reduce(
      (acc, item) => acc + item.qty * 0.25,
      0
    );

    // 3. Get Targets (Recalculate or retrieve from state)
    const { targetCals, targetMacros, waterTarget } = calculateTargets(prof);

    // 4. Update Status Text
    let status = "On Track";
    let statusColor = "#22c55e";
    const diff = eatenCals - targetCals;

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

    // 5. UPDATE ALL VISUALS
    setMetrics({
      eaten: eatenCals,
      target: targetCals,
      status,
      statusColor,
      macros: macrosEaten,
      targets: targetMacros,
      water: { current: waterConsumed, target: waterTarget },
    });

    // Update Pie Chart Data
    setMacroData([
      { name: "Protein", value: macrosEaten.p, color: COLORS.pro },
      { name: "Carbs", value: macrosEaten.c, color: COLORS.carb },
      { name: "Fats", value: macrosEaten.f, color: COLORS.fat },
    ]);
  };

  const calculateTargets = (prof) => {
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
      if (prof.goal === "lose") targetCals = Math.round(tdee - 500);
      else if (prof.goal === "gain") targetCals = Math.round(tdee + 300);
      else targetCals = Math.round(tdee);
    }

    const weight = Number(prof.weight) || 70;
    let targetP, targetF, targetC;

    if (prof.goal === "lose") {
      targetP = Math.round(weight * 2.2);
      const fatCals = targetCals * 0.3;
      targetF = Math.round(fatCals / 9);
    } else if (prof.goal === "gain") {
      targetP = Math.round(weight * 1.8);
      const fatCals = targetCals * 0.25;
      targetF = Math.round(fatCals / 9);
    } else {
      targetP = Math.round(weight * 1.6);
      const fatCals = targetCals * 0.3;
      targetF = Math.round(fatCals / 9);
    }

    const usedCals = targetP * 4 + targetF * 9;
    const remainingCals = Math.max(0, targetCals - usedCals);
    targetC = Math.round(remainingCals / 4);

    let waterTarget = weight * 0.035;
    if (prof.activity === "active" || prof.activity === "moderate")
      waterTarget += 0.5;
    waterTarget = Math.round(waterTarget * 10) / 10;

    return {
      targetCals,
      targetMacros: { p: targetP, c: targetC, f: targetF },
      waterTarget,
    };
  };

  const processStaticData = (prof, logs, today) => {
    if (!prof) return;

    // Process History (This stays constant regardless of click)
    const historyMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      historyMap[dateStr] = { cals: 0, fullDate: dateStr };
    }
    logs.forEach((l) => {
      if (historyMap[l.date]) historyMap[l.date].cals += l.calories || 0;
    });

    const historyArray = Object.keys(historyMap)
      .sort()
      .map((date) => ({
        date: date.slice(5),
        fullDate: date,
        cals: historyMap[date].cals,
      }));
    setHistoryData(historyArray);
  };

  if (loading)
    return (
      <div style={{ padding: 20, color: "#666", textAlign: "center" }}>
        Loading stats...
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
              maxWidth: 600,
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#18181b",
              border: "1px solid #333",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
                borderBottom: "1px solid #333",
                paddingBottom: 15,
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
                <X size={22} />
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
            Performance Dashboard
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
          <Info size={18} /> How it works
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
          <p>
            Please set your Weight & Goal on the main page to unlock analytics.
          </p>
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

          {/* ROW 2: HYDRATION & HISTORY */}
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

            {/* HISTORY (FIXED AXIS) */}
            <div className="chart-card" style={{ padding: "24px 24px 10px 0" }}>
              <div
                style={{
                  paddingLeft: 24,
                  marginBottom: 15,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                  Weekly Trend
                </h3>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#666",
                    alignSelf: "center",
                  }}
                >
                  Tap bars to view day
                </span>
              </div>
              <div style={{ height: 200, width: "100%" }}>
                <ResponsiveContainer>
                  <BarChart
                    data={historyData}
                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#222"
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#666"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis
                      stroke="#666"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#000",
                        border: "1px solid #333",
                        borderRadius: 8,
                      }}
                      itemStyle={{ color: "#fff", fontSize: "0.8rem" }}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    />
                    <ReferenceLine
                      y={metrics.target}
                      stroke="#f59e0b"
                      strokeDasharray="3 3"
                      label={{
                        position: "top",
                        value: "Goal",
                        fill: "#f59e0b",
                        fontSize: 10,
                      }}
                    />
                    <Bar
                      dataKey="cals"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      barSize={24}
                      style={{ cursor: "pointer" }}
                      onClick={(data) => {
                        if (data && data.fullDate)
                          handleDateSelect(data.fullDate);
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ROW 3: MACROS & INTAKE */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
            {/* MACRO CHART */}
            <div
              className="chart-card"
              style={{
                padding: 24,
                flex: "1 1 300px",
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

              <div style={{ height: 180, width: "100%", marginBottom: 20 }}>
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

              <div style={{ display: "grid", gap: 12 }}>
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
                minHeight: 400,
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

              {!selectedDate ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#666",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div>Tap a bar in the chart to view details</div>
                </div>
              ) : selectedLogs.length === 0 ? (
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
                  No logs found for this day.
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 0 }}
                >
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
                          {log.qty}x {log.name}
                          {log.name === "Water" && (
                            <span
                              style={{ fontSize: "0.8rem", color: "#3b82f6" }}
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
                  <div
                    style={{
                      marginTop: 20,
                      paddingTop: 15,
                      borderTop: "2px solid #333",
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 800,
                      color: "#fff",
                      fontSize: "1.1rem",
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
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
