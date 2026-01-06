"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FLATTENED_DB } from "../food-data";
import {
  ArrowLeft,
  Calendar,
  AlertCircle,
  Info,
  BookOpen,
  X,
  Droplets,
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "../supabase";

const COLORS = {
  pro: "#3b82f6",
  carb: "#FFC107",
  fat: "#ef4444",
  fib: "#10b981",
};

// --- NEW: PERSONALIZATION ENGINE ---
const getSmartRemedy = (nutrient, historyLogs) => {
  // 1. Define what counts as a "Good Source" of the nutrient
  const thresholds = {
    p: 15, // Item must have >15g protein
    fib: 5, // Item must have >5g fiber
  };

  const minVal = thresholds[nutrient] || 0;

  // 2. Scan history to find items meeting this criteria
  const frequencyMap = {};

  historyLogs.forEach((log) => {
    // Skip water or empty logs
    if (log.name === "Water") return;

    // Resolve macro value (handle cases where it might be missing in log but in DB)
    let val = log[nutrient === "p" ? "protein" : "fiber"] || 0;
    if (!val && FLATTENED_DB[log.name.toLowerCase()]) {
      // Fallback to DB lookup if log doesn't have the number saved
      const dbItem = FLATTENED_DB[log.name.toLowerCase()];
      val = nutrient === "p" ? dbItem.protein : dbItem.fiber;
      val = val * log.qty;
    }

    if (val >= minVal) {
      if (!frequencyMap[log.name]) {
        frequencyMap[log.name] = 0;
      }
      frequencyMap[log.name] += 1;
    }
  });

  // 3. Sort by "Most Frequently Eaten"
  const topFoods = Object.entries(frequencyMap)
    .sort((a, b) => b[1] - a[1]) // Sort desc by count
    .slice(0, 3) // Take top 3
    .map(([name]) => name);

  // 4. Return personalized string or null (if they never ate good sources)
  if (topFoods.length > 0) {
    return `Based on your history, try: ${topFoods.join(", ")}.`;
  }
  return null; // Fallback to generic if no history found
};

export default function UserDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  // METRICS
  const [metrics, setMetrics] = useState({
    eaten: 0,
    target: 0,
    status: "Loading...",
    statusColor: "#666",
    macros: { p: 0, c: 0, f: 0, fib: 0 },
    targets: { p: 0, c: 0, f: 0, fib: 0 },
    water: { current: 0, target: 0 },
  });

  // CHART DATA
  const [macroData, setMacroData] = useState([]);
  const [calendarData, setCalendarData] = useState([]);

  // ANALYSIS DATA
  const [insights, setInsights] = useState([]);
  const [culpritIds, setCulpritIds] = useState(new Set());

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

      const calculatedTargets = processCalendarData(profileData, logData || []);

      // Pass the logData here to ensure it's available immediately
      handleDateSelect(today, logData || [], calculatedTargets);
      setLoading(false);
    };
    init();
  }, []);

  // --- 1. SCIENTIFIC TARGET CALCULATOR ---
  const calculateTargets = (prof) => {
    if (!prof || !prof.weight)
      return {
        targetCals: 2000,
        targetMacros: { p: 150, c: 200, f: 60 },
        waterTarget: 3,
      };

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

    const weight = Number(prof.weight);
    let targetP, targetF, targetC;

    if (prof.goal === "lose") {
      targetP = Math.round(weight * 2.2);
      targetF = Math.round((targetCals * 0.3) / 9);
    } else if (prof.goal === "gain") {
      targetP = Math.round(weight * 1.8);
      targetF = Math.round((targetCals * 0.25) / 9);
    } else {
      targetP = Math.round(weight * 1.6);
      targetF = Math.round((targetCals * 0.3) / 9);
    }

    const usedCals = targetP * 4 + targetF * 9;
    targetC = Math.round(Math.max(0, targetCals - usedCals) / 4);
    const targetFib = Math.round((targetCals / 1000) * 14);

    let waterTarget = Math.round(weight * 0.035 * 10) / 10;
    if (prof.activity === "active" || prof.activity === "moderate")
      waterTarget += 0.5;

    return {
      targetCals,
      targetMacros: { p: targetP, c: targetC, f: targetF, fib: targetFib },
      waterTarget,
    };
  };

  // --- 2. UPDATED: ANALYTICS WITH PERSONALIZATION ---
  const generateInsights = (eaten, targets, macros, dailyLogs, historyLogs) => {
    const suggestions = [];
    const newCulprits = new Set();

    const calDiff = eaten - targets.targetCals;
    const proteinMissed = targets.targetMacros.p - macros.p;
    const fiberMissed = targets.targetMacros.fib - macros.fib;
    const fatDiff = macros.f - targets.targetMacros.f;
    const carbDiff = macros.c - targets.targetMacros.c;

    // --- A. OVERFLOW DETECTORS ---

    if (fatDiff > 5) {
      const culprit = dailyLogs.reduce(
        (prev, current) =>
          (prev.fats || 0) > (current.fats || 0) ? prev : current,
        { fats: 0, name: "Unknown" }
      );
      if (culprit.id) newCulprits.add(culprit.id);
      suggestions.push({
        type: "danger",
        title: "High Fat Alert",
        msg: `You exceeded fats by ${Math.round(fatDiff)}g. Main cause: ${
          culprit.name
        } (${culprit.fats}g).`,
        fix: "Reduce oils/dressings for the rest of the day.",
      });
    }

    if (carbDiff > 20) {
      const culprit = dailyLogs.reduce(
        (prev, current) =>
          (prev.carbs || 0) > (current.carbs || 0) ? prev : current,
        { carbs: 0, name: "Unknown" }
      );
      if (culprit.id) newCulprits.add(culprit.id);
      suggestions.push({
        type: "warn",
        title: "Carb Limit Exceeded",
        msg: `Carbs are high (+${Math.round(carbDiff)}g). The ${
          culprit.name
        } contributed ${culprit.carbs}g.`,
      });
    }

    // --- B. GENERIC & PERSONALIZED INSIGHTS ---

    // 1. Protein Check
    if (proteinMissed > 15) {
      // ** PERSONALIZATION CALL **
      const smartFix = getSmartRemedy("p", historyLogs);

      suggestions.push({
        type: "tip",
        title: "Protein Fix Needed",
        msg: `You need ${Math.round(proteinMissed)}g more Protein.`,
        // Use smart fix if available, else fallback to generic
        fix:
          smartFix ||
          "Try: 1 Scoop Whey (25g), 150g Chicken (30g), or Greek Yogurt.",
      });
    }

    // 2. Fiber Check
    if (fiberMissed > 10) {
      // ** PERSONALIZATION CALL **
      const smartFix = getSmartRemedy("fib", historyLogs);

      suggestions.push({
        type: "tip",
        title: "Low Fiber",
        msg: "Digestion needs support.",
        fix: smartFix || "Add an apple (4g) or lentils (15g).",
      });
    }

    // 3. Calorie Balance
    if (calDiff > 500 && suggestions.length === 0) {
      const culprit = dailyLogs.reduce(
        (prev, current) =>
          (prev.calories || 0) > (current.calories || 0) ? prev : current,
        { calories: 0, name: "Unknown" }
      );
      if (culprit.id) newCulprits.add(culprit.id);

      suggestions.push({
        type: "danger",
        title: "Significant Overeating",
        msg: `+${Math.round(calDiff)} kcal over limit. Heaviest item: ${
          culprit.name
        } (${culprit.calories} kcal).`,
      });
    } else if (calDiff < -500) {
      suggestions.push({
        type: "warn",
        title: "Undereating",
        msg: "Calorie intake is too low. This can slow metabolism.",
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        type: "success",
        title: "Perfect Execution",
        msg: "Your macros and calories are perfectly balanced. Great job!",
      });
    }

    return { suggestions, newCulprits };
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
      (acc, item) => {
        let fib = item.fiber || 0;
        if (!fib && item.name !== "Water") {
          const dbItem = FLATTENED_DB[item.name.toLowerCase()];
          if (dbItem?.fiber) fib = Math.round(dbItem.fiber * item.qty);
        }
        return {
          p: acc.p + (item.protein || 0),
          c: acc.c + (item.carbs || 0),
          f: acc.f + (item.fats || 0),
          fib: acc.fib + fib,
        };
      },
      { p: 0, c: 0, f: 0, fib: 0 }
    );
    const waterConsumed = dailyLogs
      .filter((i) => i.name === "Water")
      .reduce((acc, item) => acc + item.qty * 0.25, 0);

    const targets = preCalcTargets || calculateTargets(profile);

    // Status Logic
    let status = "On Track";
    let statusColor = "#3b82f6";
    const diff = eatenCals - targets.targetCals;

    if (Math.abs(diff) < 200) {
      if (macrosEaten.p >= targets.targetMacros.p * 0.9) {
        status = "Perfect Zone";
        statusColor = "#22c55e";
      } else {
        status = "Low Protein";
        statusColor = "#f59e0b";
      }
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
      { name: "Fiber", value: macrosEaten.fib, color: COLORS.fib },
    ]);

    // --- Generate Insights (Pass full history now) ---
    // Note: We use logsToFilter (which is the full history passed in) instead of just allLogs state
    // because state might not be updated yet on initial load
    const analysis = generateInsights(
      eatenCals,
      targets,
      macrosEaten,
      dailyLogs,
      logsToFilter
    );
    setInsights(analysis.suggestions);
    setCulpritIds(analysis.newCulprits);
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
      <style jsx>{`
        /* Custom Scrollbar Logic */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #444;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #666;
        }
      `}</style>

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

          {/* ROW 2: SMART ANALYSIS GRID */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 20,
              marginBottom: 20,
            }}
          >
            {/* 3. CONSISTENCY */}
            <div
              className="chart-card"
              style={{ padding: 24, display: "flex", flexDirection: "column" }}
            >
              {/* ... (Existing Consistency Code) ... */}
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
            </div>

            {/* 1. SMART INSIGHTS CARD */}
            <div
              className="chart-card"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gridColumn: "span 2",
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
                <Lightbulb size={18} color="#FFC107" /> Smart Analysis &
                Remedies
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                  gap: 15,
                }}
              >
                {insights.map((insight, i) => (
                  <div
                    key={i}
                    style={{
                      background:
                        insight.type === "success"
                          ? "rgba(34, 197, 94, 0.1)"
                          : insight.type === "danger"
                          ? "rgba(239, 68, 68, 0.1)"
                          : "rgba(245, 158, 11, 0.1)",
                      border: `1px solid ${
                        insight.type === "success"
                          ? "#22c55e"
                          : insight.type === "danger"
                          ? "#ef4444"
                          : "#f59e0b"
                      }`,
                      padding: 15,
                      borderRadius: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      {insight.type === "success" && (
                        <CheckCircle size={20} color="#22c55e" />
                      )}
                      {insight.type === "warn" && (
                        <AlertTriangle size={20} color="#f59e0b" />
                      )}
                      {insight.type === "danger" && (
                        <AlertCircle size={20} color="#ef4444" />
                      )}
                      {insight.type === "tip" && (
                        <TrendingUp size={20} color="#3b82f6" />
                      )}
                      <span style={{ fontWeight: 700, color: "#fff" }}>
                        {insight.title}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: "0.9rem",
                        color: "#ccc",
                        margin: "0 0 8px 0",
                        lineHeight: 1.4,
                      }}
                    >
                      {insight.msg}
                    </p>
                    {insight.fix && (
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "#fff",
                          background: "rgba(255,255,255,0.05)",
                          padding: "6px 10px",
                          borderRadius: 6,
                          display: "inline-block",
                        }}
                      >
                        💡 <strong>Remedy:</strong> {insight.fix}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. HYDRATION */}
            <div
              className="chart-card"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              {/* ... (Existing Hydration Code) ... */}
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
                  ) || 0}
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
              {/* ... (Existing Macro Chart Code) ... */}
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
                  <PieChart key={JSON.stringify(macroData)}>
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
              {/* Macro stats list */}
              <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
                {/* ... (Existing Macro List Rows) ... */}
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
                    {" "}
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: COLORS.pro,
                      }}
                    ></div>{" "}
                    Protein{" "}
                  </span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                    {" "}
                    {Math.round(metrics.macros.p)}{" "}
                    <span style={{ color: "#666", fontWeight: 400 }}>
                      {" "}
                      / {metrics.targets.p}g{" "}
                    </span>{" "}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderTop: "1px solid #222",
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
                    {" "}
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: COLORS.fib,
                      }}
                    ></div>{" "}
                    Fiber{" "}
                  </span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                    {" "}
                    {Math.round(metrics.macros.fib)}{" "}
                    <span style={{ color: "#666", fontWeight: 400 }}>
                      {" "}
                      / {metrics.targets.fib}g{" "}
                    </span>{" "}
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
                    {" "}
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: COLORS.carb,
                      }}
                    ></div>{" "}
                    Carbs{" "}
                  </span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                    {" "}
                    {Math.round(metrics.macros.c)}{" "}
                    <span style={{ color: "#666", fontWeight: 400 }}>
                      {" "}
                      / {metrics.targets.c}g{" "}
                    </span>{" "}
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
                    {" "}
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: COLORS.fat,
                      }}
                    ></div>{" "}
                    Fats{" "}
                  </span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                    {" "}
                    {Math.round(metrics.macros.f)}{" "}
                    <span style={{ color: "#666", fontWeight: 400 }}>
                      {" "}
                      / {metrics.targets.f}g{" "}
                    </span>{" "}
                  </span>
                </div>
              </div>
            </div>

            {/* INTAKE LIST (WITH CULPRIT FINDER & SCROLLBAR) */}
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
                  {/* SCROLLABLE CONTAINER */}
                  <div
                    className="custom-scrollbar"
                    style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}
                  >
                    {selectedLogs.map((log) => {
                      const isCulprit = culpritIds.has(log.id);
                      return (
                        <div
                          key={log.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "14px 10px", // Added horizontal padding for highlight
                            borderBottom: "1px solid #222",
                            // --- CULPRIT HIGHLIGHTING ---
                            background: isCulprit
                              ? "rgba(239, 68, 68, 0.1)"
                              : "transparent",
                            borderLeft: isCulprit
                              ? "3px solid #ef4444"
                              : "3px solid transparent",
                            borderRadius: 4,
                            marginBottom: 4,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                color: isCulprit ? "#ef4444" : "#fff",
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
                                    fontWeight:
                                      isCulprit && log.fats > 10
                                        ? "800"
                                        : "400",
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
                                            .fiber * log.qty
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

                  {/* FIXED FOOTER */}
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
