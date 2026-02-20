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
  Sparkles,
  Bot,
  Loader2,
  BarChart2,
  Scale, // <-- New icon added
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { supabase } from "../supabase";

const COLORS = {
  pro: "#3b82f6",
  carb: "#FFC107",
  fat: "#ef4444",
  fib: "#10b981",
  cals: "#a855f7",
  weight: "#ec4899", // Pink color for weight trends
};

const getSmartRemedy = (nutrient, historyLogs) => {
  const thresholds = { p: 15, fib: 5 };
  const minVal = thresholds[nutrient] || 0;
  const frequencyMap = {};
  historyLogs.forEach((log) => {
    if (log.name === "Water") return;
    let val = log[nutrient === "p" ? "protein" : "fiber"] || 0;
    if (!val && FLATTENED_DB[log.name.toLowerCase()]) {
      const dbItem = FLATTENED_DB[log.name.toLowerCase()];
      val = nutrient === "p" ? dbItem.protein : dbItem.fiber;
      val = val * log.qty;
    }
    if (val >= minVal) {
      if (!frequencyMap[log.name]) frequencyMap[log.name] = 0;
      frequencyMap[log.name] += 1;
    }
  });
  const topFoods = Object.entries(frequencyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
  if (topFoods.length > 0)
    return `Based on your history, try: ${topFoods.join(", ")}.`;
  return null;
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

  // TREND CHART STATE
  const [trendData, setTrendData] = useState([]);
  const [trendMetric, setTrendMetric] = useState("calories");
  const [trendRange, setTrendRange] = useState(7);

  // ANALYSIS DATA
  const [insights, setInsights] = useState([]);
  const [culpritIds, setCulpritIds] = useState(new Set());

  // INTERACTIVE
  const [allLogs, setAllLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedLogs, setSelectedLogs] = useState([]);

  // WEIGHT STATE
  const [weightLogs, setWeightLogs] = useState([]);
  const [weightInput, setWeightInput] = useState("");
  const [isLoggingWeight, setIsLoggingWeight] = useState(false);

  // MODALS
  const [showResearch, setShowResearch] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");

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

    // Fetch weight logs
    const { data: weightData } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("user_id", session.user.id)
      .gte("date", startStr)
      .order("date", { ascending: true });

    setProfile(profileData);
    setAllLogs(logData || []);
    setWeightLogs(weightData || []);

    const calculatedTargets = processCalendarData(
      profileData,
      logData || [],
      weightData || [],
    );
    handleDateSelect(today, logData || [], calculatedTargets);
    setLoading(false);
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogWeight = async () => {
    if (!weightInput) return;
    setIsLoggingWeight(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const today = new Date().toISOString().slice(0, 10);
    const numWeight = Number(weightInput);

    // Upsert to weight logs (requires unique user_id, date constraint)
    await supabase.from("weight_logs").upsert(
      {
        user_id: session.user.id,
        date: today,
        weight: numWeight,
      },
      { onConflict: "user_id, date" },
    );

    // Update main profile
    await supabase
      .from("user_profiles")
      .update({ weight: numWeight })
      .eq("user_id", session.user.id);

    setWeightInput("");
    setIsLoggingWeight(false);

    // Refresh to recalculate targets based on new weight
    init();
  };

  const handleAskAI = async () => {
    setShowAI(true);
    if (aiResponse) return;
    setAiLoading(true);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentLogs = allLogs.filter((l) => new Date(l.date) >= sevenDaysAgo);

    const recentWeightLogs = weightLogs.filter((l) => new Date(l.date) >= sevenDaysAgo);

    try {
      const res = await fetch("/api/ai-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: profile, logs: recentLogs, weightLogs: recentWeightLogs }),
      });
      const data = await res.json();
      setAiResponse(data.message);
    } catch (e) {
      console.error(e);
      setAiResponse(
        "I'm having trouble connecting to the nutrition database right now.",
      );
    } finally {
      setAiLoading(false);
    }
  };

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

  const generateInsights = (eaten, targets, macros, dailyLogs, historyLogs) => {
    const suggestions = [];
    const newCulprits = new Set();
    const calDiff = eaten - targets.targetCals;
    const proteinMissed = targets.targetMacros.p - macros.p;
    const fiberMissed = targets.targetMacros.fib - macros.fib;
    const fatDiff = macros.f - targets.targetMacros.f;
    const carbDiff = macros.c - targets.targetMacros.c;

    if (fatDiff > 5) {
      const culprit = dailyLogs.reduce(
        (prev, current) =>
          (prev.fats || 0) > (current.fats || 0) ? prev : current,
        { fats: 0, name: "Unknown" },
      );
      if (culprit.id) newCulprits.add(culprit.id);
      suggestions.push({
        type: "danger",
        title: "High Fat Alert",
        msg: `+${Math.round(fatDiff)}g over. Culprit: ${culprit.name}.`,
        fix: "Cut oils/dressings.",
      });
    }
    if (carbDiff > 20) {
      const culprit = dailyLogs.reduce(
        (prev, current) =>
          (prev.carbs || 0) > (current.carbs || 0) ? prev : current,
        { carbs: 0, name: "Unknown" },
      );
      if (culprit.id) newCulprits.add(culprit.id);
      suggestions.push({
        type: "warn",
        title: "Carb Limit Exceeded",
        msg: `+${Math.round(carbDiff)}g over. Culprit: ${culprit.name}.`,
      });
    }
    if (proteinMissed > 15) {
      const smartFix = getSmartRemedy("p", historyLogs);
      suggestions.push({
        type: "tip",
        title: "Low Protein",
        msg: `Need ${Math.round(proteinMissed)}g more.`,
        fix: smartFix || "Try Whey or Chicken.",
      });
    }
    if (fiberMissed > 10) {
      const smartFix = getSmartRemedy("fib", historyLogs);
      suggestions.push({
        type: "tip",
        title: "Low Fiber",
        msg: "Digestion needs support.",
        fix: smartFix || "Add apple or beans.",
      });
    }
    if (calDiff > 500 && suggestions.length === 0) {
      suggestions.push({
        type: "danger",
        title: "Overeating",
        msg: `+${Math.round(calDiff)} kcal over limit.`,
      });
    } else if (calDiff < -500) {
      suggestions.push({
        type: "warn",
        title: "Undereating",
        msg: "Calorie intake is too low.",
      });
    }
    if (suggestions.length === 0) {
      suggestions.push({
        type: "success",
        title: "Perfect Execution",
        msg: "Macros balanced!",
      });
    }
    return { suggestions, newCulprits };
  };

  const handleDateSelect = (dateStr, logsSource, preCalcTargets) => {
    const logsToFilter = logsSource || allLogs;
    const dailyLogs = logsToFilter.filter((l) => l.date === dateStr);
    setSelectedDate(dateStr);
    setSelectedLogs(dailyLogs);
    const eatenCals = dailyLogs.reduce(
      (sum, item) => sum + (item.calories || 0),
      0,
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
      { p: 0, c: 0, f: 0, fib: 0 },
    );
    const waterConsumed = dailyLogs
      .filter((i) => i.name === "Water")
      .reduce((acc, item) => acc + item.qty * 0.25, 0);
    const targets = preCalcTargets || calculateTargets(profile);
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
    const analysis = generateInsights(
      eatenCals,
      targets,
      macrosEaten,
      dailyLogs,
      logsToFilter,
    );
    setInsights(analysis.suggestions);
    setCulpritIds(analysis.newCulprits);
  };

  const processCalendarData = (prof, logs, weightLogsData = []) => {
    if (!prof) return;
    const targets = calculateTargets(prof);
    const calendarMap = {};

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      calendarMap[dateStr] = {
        cals: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
        fiber: 0,
        weight: null, // Default to null for connectNulls to work perfectly
        dateFormatted: d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      };
    }

    logs.forEach((l) => {
      if (calendarMap[l.date]) {
        let p = l.protein || 0;
        let c = l.carbs || 0;
        let f = l.fats || 0;
        let fib = l.fiber || 0;
        let cals = l.calories || 0;

        if (l.name !== "Water" && (!p || !c || !f)) {
          const dbItem = FLATTENED_DB[l.name.toLowerCase()];
          if (dbItem) {
            if (!p) p = Math.round(dbItem.protein * l.qty);
            if (!c) c = Math.round(dbItem.carbs * l.qty);
            if (!f) f = Math.round(dbItem.fats * l.qty);
            if (!fib && dbItem.fiber) fib = Math.round(dbItem.fiber * l.qty);
            if (!cals) cals = Math.round(dbItem.calories * l.qty);
          }
        }

        calendarMap[l.date].cals += cals;
        calendarMap[l.date].protein += p;
        calendarMap[l.date].carbs += c;
        calendarMap[l.date].fats += f;
        calendarMap[l.date].fiber += fib;
      }
    });

    // Populate weight data into map
    weightLogsData.forEach((w) => {
      if (calendarMap[w.date]) calendarMap[w.date].weight = Number(w.weight);
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

    const tData = Object.keys(calendarMap)
      .sort()
      .map((date) => ({
        date: calendarMap[date].dateFormatted,
        rawDate: date,
        calories: calendarMap[date].cals,
        protein: calendarMap[date].protein,
        carbs: calendarMap[date].carbs,
        fats: calendarMap[date].fats,
        fiber: calendarMap[date].fiber,
        weight: calendarMap[date].weight, // Pass weight to trend data
      }));
    setTrendData(tData);

    return targets;
  };

  const getCurrentTarget = () => {
    if (!metrics || !metrics.targets) return 0;
    switch (trendMetric) {
      case "protein":
        return metrics.targets.p;
      case "carbs":
        return metrics.targets.c;
      case "fats":
        return metrics.targets.f;
      case "fiber":
        return metrics.targets.fib;
      case "weight":
        return profile?.target_weight || null; // Return null if no target weight is set
      case "calories":
      default:
        return metrics.target;
    }
  };

  if (loading)
    return (
      <div style={{ padding: 20, color: "#666", textAlign: "center" }}>
        Loading analytics...
      </div>
    );

  const getTrendColor = () => {
    switch (trendMetric) {
      case "protein":
        return COLORS.pro;
      case "carbs":
        return COLORS.carb;
      case "fats":
        return COLORS.fat;
      case "fiber":
        return COLORS.fib;
      case "weight":
        return COLORS.weight;
      default:
        return COLORS.cals;
    }
  };

  const visibleTrendData = trendRange === 7 ? trendData.slice(-7) : trendData;

  return (
    <div
      className="app-wrapper"
      style={{ maxWidth: 1000, margin: "0 auto", padding: 20 }}
    >
      <style jsx>{`
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
        .chart-grid-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }
        .trend-card-span {
          grid-column: span 2;
        }
        @media (max-width: 768px) {
          .chart-grid-container {
            grid-template-columns: 1fr;
          }
          .trend-card-span {
            grid-column: span 1;
          }
        }
      `}</style>

      {/* AI COACH MODAL */}
      {showAI && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: "1.2rem",
                  background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                <Sparkles size={22} color="#8b5cf6" /> AI Coach
              </h3>
              <button
                onClick={() => setShowAI(false)}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "none",
                  color: "#888",
                  cursor: "pointer",
                  padding: 8,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body custom-scrollbar">
              {aiLoading ? (
                <div
                  style={{
                    padding: "40px 0",
                    textAlign: "center",
                    color: "#888",
                  }}
                >
                  <Loader2
                    className="animate-spin"
                    style={{ margin: "0 auto 15px", display: "block" }}
                    size={32}
                  />
                  <p>Analyzing your food history...</p>
                </div>
              ) : (
                <div style={{ whiteSpace: "pre-wrap" }}>{aiResponse}</div>
              )}
            </div>
            <div className="modal-footer">
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#666",
                  fontStyle: "italic",
                  textAlign: "center",
                }}
              >
                * AI advice is based on logs. Consult a doctor.
              </div>
            </div>
          </div>
        </div>
      )}

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

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleAskAI}
            style={{
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              padding: "8px 16px",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.9rem",
              fontWeight: 700,
              boxShadow: "0 4px 15px rgba(59, 130, 246, 0.3)",
            }}
          >
            <Bot size={18} /> Ask AI
          </button>

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

          {/* ROW 2: ANALYSIS & TRENDS */}
          <div className="chart-grid-container">
            {/* 1. SMART INSIGHTS CARD */}
            <div
              className="chart-card"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                border: "1px solid #333",
                borderRadius: 16,
                background: "#1f1f22",
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
                <Lightbulb size={18} color="#FFC107" /> Smart Analysis
              </h3>
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  maxHeight: 300,
                  overflowY: "auto",
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
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      {insight.type === "success" && (
                        <CheckCircle size={16} color="#22c55e" />
                      )}
                      {insight.type === "warn" && (
                        <AlertTriangle size={16} color="#f59e0b" />
                      )}
                      {insight.type === "danger" && (
                        <AlertCircle size={16} color="#ef4444" />
                      )}
                      {insight.type === "tip" && (
                        <TrendingUp size={16} color="#3b82f6" />
                      )}
                      <span
                        style={{
                          fontWeight: 700,
                          color: "#fff",
                          fontSize: "0.9rem",
                        }}
                      >
                        {insight.title}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: "0.85rem",
                        color: "#ccc",
                        margin: 0,
                        lineHeight: 1.3,
                      }}
                    >
                      {insight.msg}
                    </p>
                    {insight.fix && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: "0.8rem",
                          color: "#fff",
                          background: "rgba(255,255,255,0.05)",
                          padding: "4px 8px",
                          borderRadius: 6,
                          display: "inline-block",
                        }}
                      >
                        💡 {insight.fix}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. TREND CHART */}
            <div
              className="chart-card trend-card-span"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                border: "1px solid #333",
                borderRadius: 16,
                background: "#1f1f22",
                minHeight: 350,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                  flexWrap: "wrap",
                  gap: 10,
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
                  <BarChart2 size={18} color={getTrendColor()} /> History Trends
                </h3>
                <div style={{ display: "flex", gap: 10 }}>
                  <select
                    value={trendMetric}
                    onChange={(e) => setTrendMetric(e.target.value)}
                    style={{
                      background: "#000",
                      color: "#fff",
                      border: "1px solid #333",
                      padding: "6px 12px",
                      borderRadius: 8,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    <option value="calories">Calories</option>
                    <option value="weight">Weight</option>
                    <option value="protein">Protein</option>
                    <option value="carbs">Carbs</option>
                    <option value="fats">Fats</option>
                    <option value="fiber">Fiber</option>
                  </select>

                  <div
                    style={{
                      display: "flex",
                      background: "#000",
                      borderRadius: 8,
                      border: "1px solid #333",
                      padding: 2,
                    }}
                  >
                    <button
                      onClick={() => setTrendRange(7)}
                      style={{
                        padding: "4px 12px",
                        fontSize: "0.8rem",
                        background: trendRange === 7 ? "#333" : "transparent",
                        color: trendRange === 7 ? "#fff" : "#666",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontWeight: trendRange === 7 ? 600 : 400,
                      }}
                    >
                      7D
                    </button>
                    <button
                      onClick={() => setTrendRange(30)}
                      style={{
                        padding: "4px 12px",
                        fontSize: "0.8rem",
                        background: trendRange === 30 ? "#333" : "transparent",
                        color: trendRange === 30 ? "#fff" : "#666",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontWeight: trendRange === 30 ? 600 : 400,
                      }}
                    >
                      30D
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, width: "100%", minHeight: 250 }}>
                <ResponsiveContainer>
                  <LineChart data={visibleTrendData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#333"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#666"
                      tick={{ fill: "#666", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#666"
                      tick={{ fill: "#666", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      domain={
                        trendMetric === "weight"
                          ? ["auto", "auto"]
                          : [0, "auto"]
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#000",
                        border: "1px solid #333",
                        borderRadius: 8,
                        color: "#fff",
                      }}
                      itemStyle={{ color: getTrendColor() }}
                      formatter={(value) => [
                        `${value}${
                          trendMetric === "calories"
                            ? " kcal"
                            : trendMetric === "weight"
                              ? " kg"
                              : "g"
                        }`,
                        trendMetric.charAt(0).toUpperCase() +
                          trendMetric.slice(1),
                      ]}
                      labelStyle={{ color: "#888" }}
                    />
                    {getCurrentTarget() && (
                      <ReferenceLine
                        y={getCurrentTarget()}
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                        label={{
                          position: "top",
                          value: "Goal",
                          fill: "#ef4444",
                          fontSize: 12,
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey={trendMetric}
                      stroke={getTrendColor()}
                      strokeWidth={3}
                      connectNulls={true}
                      dot={{
                        r: 4,
                        fill: "#1f1f22",
                        stroke: getTrendColor(),
                        strokeWidth: 2,
                      }}
                      activeDot={{ r: 6, fill: getTrendColor() }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. CONSISTENCY */}
            <div
              className="chart-card"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                border: "1px solid #333",
                borderRadius: 16,
                background: "#1f1f22",
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
            </div>

            {/* 4. HYDRATION */}
            <div
              className="chart-card"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                border: "1px solid #333",
                borderRadius: 16,
                background: "#1f1f22",
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
                    (metrics.water.current / metrics.water.target) * 100,
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
                      (metrics.water.current / metrics.water.target) * 100,
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
                border: "1px solid #333",
                borderRadius: 16,
                background: "#1f1f22",
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

            {/* INTAKE LIST */}
            <div
              className="chart-card"
              style={{
                padding: 24,
                flex: "2 1 400px",
                height: 500,
                display: "flex",
                flexDirection: "column",
                border: "1px solid #333",
                borderRadius: 16,
                background: "#1f1f22",
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
                      const isCulprit = culpritIds.has(log.id);
                      return (
                        <div
                          key={log.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "14px 10px",
                            borderBottom: "1px solid #222",
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
                      {selectedLogs.reduce(
                        (sum, item) => sum + (item.calories || 0),
                        0,
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
