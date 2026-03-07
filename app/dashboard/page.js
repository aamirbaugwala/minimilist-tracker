"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FLATTENED_DB } from "../food-data";
import { calculateTargets } from "../lib/nutrition";
import {
  Calendar,
  AlertCircle,
  Info,
  BookOpen,
  X,
  Droplets,
  Bot,
  BarChart2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import {
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

// ─── GOAL PACE CALCULATOR ────────────────────────────────────────────────────
// Uses last 14 days of weight logs + avg calorie deficit to predict goal date
const computeGoalPace = (trendData, profile) => {
  if (!profile) return null;
  const targetWeight = profile.target_weight;
  const currentWeight = profile.weight;
  const goal = profile.goal; // "fat_loss" | "muscle_gain" | "maintain"

  // Need at least current weight
  if (!currentWeight) return null;

  // Filter weight entries from trendData (last 14 days with real readings)
  const weightPoints = trendData
    .filter((d) => d.weight !== null && d.weight !== undefined)
    .slice(-14);

  // Compute weekly rate from linear regression if ≥2 points
  let weeklyRateKg = null;
  if (weightPoints.length >= 2) {
    const n = weightPoints.length;
    const xs = weightPoints.map((_, i) => i);
    const ys = weightPoints.map((d) => d.weight);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
    const sumXX = xs.reduce((a, x) => a + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX); // kg/day
    weeklyRateKg = slope * 7;
  }

  // Avg daily calorie deficit from last 7 days of trendData
  const last7 = trendData.filter((d) => d.calories > 0).slice(-7);
  const avgCalTarget = profile.target_calories || 2000;
  const avgEaten = last7.length
    ? last7.reduce((s, d) => s + d.calories, 0) / last7.length
    : avgCalTarget;
  const dailyDeficit = avgCalTarget - avgEaten; // positive = deficit, negative = surplus

  const latestWeight =
    weightPoints.length > 0
      ? weightPoints[weightPoints.length - 1].weight
      : currentWeight;

  // Build pace object
  const pace = {
    latestWeight,
    targetWeight,
    goal,
    weeklyRateKg,
    dailyDeficit: Math.round(dailyDeficit),
    weeksToGoal: null,
    direction: null,
    onTrack: false,
    message: null,
  };

  if (!targetWeight) {
    // No target weight set — show deficit/surplus summary only
    if (Math.abs(dailyDeficit) < 100) {
      pace.message = "You're in maintenance. Calories are balanced.";
      pace.onTrack = true;
    } else if (dailyDeficit > 0) {
      pace.message = `Avg deficit: ${Math.round(dailyDeficit)} kcal/day. Set a target weight to see your ETA.`;
    } else {
      pace.message = `Avg surplus: ${Math.round(Math.abs(dailyDeficit))} kcal/day. Set a target weight to see your ETA.`;
    }
    return pace;
  }

  const kgToGo = latestWeight - targetWeight; // positive = need to lose
  pace.direction = kgToGo > 0 ? "lose" : kgToGo < 0 ? "gain" : "reached";

  if (pace.direction === "reached") {
    pace.message = "🎯 Goal weight reached! Focus on maintenance.";
    pace.onTrack = true;
    return pace;
  }

  // Use actual weight trend rate if available, else estimate from deficit (7700 kcal ≈ 1 kg)
  const effectiveWeeklyRate =
    weeklyRateKg !== null
      ? Math.abs(weeklyRateKg)
      : Math.abs(dailyDeficit * 7) / 7700;

  if (effectiveWeeklyRate < 0.05) {
    pace.message = "Weight is stable. Adjust calories to make progress.";
    pace.onTrack = false;
    return pace;
  }

  pace.weeksToGoal = Math.round(Math.abs(kgToGo) / effectiveWeeklyRate);

  // Is the direction of change matching the goal?
  const movingCorrectly =
    (pace.direction === "lose" && weeklyRateKg !== null && weeklyRateKg < 0) ||
    (pace.direction === "gain" && weeklyRateKg !== null && weeklyRateKg > 0) ||
    weeklyRateKg === null;

  pace.onTrack = movingCorrectly;

  return pace;
};

// ─── DAILY NUTRITION SCORE ────────────────────────────────────────────────────
// 0-100 score from 4 pillars: calories (30pts), protein (30pts), hydration (20pts), consistency (20pts)
const computeDayScore = (metrics, calendarData, selectedDate) => {
  const { eaten, target, macros, targets, water } = metrics;
  if (!target || target === 0) return null;

  // 1. Calorie accuracy (30 pts) — full marks ±10%, linear drop off
  const calRatio = eaten / target;
  const calPts = Math.max(0, Math.round(30 * (1 - Math.min(1, Math.abs(1 - calRatio) * 3))));

  // 2. Protein hit (30 pts)
  const protRatio = targets.p > 0 ? macros.p / targets.p : 0;
  const protPts = Math.min(30, Math.round(30 * protRatio));

  // 3. Hydration (20 pts)
  const hydRatio = water.target > 0 ? water.current / water.target : 0;
  const hydPts = Math.min(20, Math.round(20 * hydRatio));

  // 4. Consistency — how many of the last 7 days had any calories logged (20 pts)
  const today = selectedDate || new Date().toISOString().slice(0, 10);
  const last7 = calendarData.filter((d) => d.date <= today).slice(-7);
  const loggedDays = last7.filter((d) => d.cals > 0).length;
  const consPts = Math.round((loggedDays / 7) * 20);

  const total = calPts + protPts + hydPts + consPts;

  return {
    total,
    pillars: [
      { label: "Calories", pts: calPts, max: 30, color: "#a855f7" },
      { label: "Protein",  pts: protPts, max: 30, color: "#3b82f6" },
      { label: "Hydration",pts: hydPts,  max: 20, color: "#06b6d4" },
      { label: "Streak",   pts: consPts, max: 20, color: "#22c55e" },
    ],
    grade:
      total >= 90 ? "S" :
      total >= 75 ? "A" :
      total >= 55 ? "B" :
      total >= 35 ? "C" : "D",
    gradeColor:
      total >= 90 ? "#22c55e" :
      total >= 75 ? "#3b82f6" :
      total >= 55 ? "#f59e0b" :
      total >= 35 ? "#f97316" : "#ef4444",
  };
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
  const [calendarData, setCalendarData] = useState([]);

  // TREND CHART STATE
  const [trendData, setTrendData] = useState([]);
  const [trendMetric, setTrendMetric] = useState("calories");
  const [trendRange, setTrendRange] = useState(7);

  // INTERACTIVE
  const [allLogs, setAllLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedLogs, setSelectedLogs] = useState([]);

  // MODALS
  const [showResearch, setShowResearch] = useState(false);

  // AI BRIEFING
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  // SCORE CARD
  const [scoreExpanded, setScoreExpanded] = useState(false);

  // INLINE CHAT DRAWER
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const fetchBriefing = async (session) => {
    setBriefingLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:
            "Give me a 3-line daily briefing: my biggest nutrition win today, my biggest gap, and one specific action I should take right now. Be direct and use my actual data.",
          userId: session.user.id,
          accessToken: session.access_token,
          history: [],
        }),
      });
      const data = await res.json();
      if (data.reply) setBriefing(data.reply);
    } catch {
      // silent fail — briefing is non-critical
    } finally {
      setBriefingLoading(false);
    }
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userMsg = { role: "user", content: text };
    const next = [...chatMessages, userMsg];
    setChatMessages(next);
    setChatInput("");
    setChatLoading(true);

    // Scroll to bottom
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          userId: session.user.id,
          accessToken: session.access_token,
          history: next.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || "Something went wrong.";
      setChatMessages((prev) => [...prev, { role: "model", content: reply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "model", content: "Connection error. Try again." }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

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

    // Fetch goal history — so each past day is judged against the goal active then
    const { data: goalHistory } = await supabase
      .from("goal_history")
      .select("goal, activity, target_calories, effective_from")
      .eq("user_id", session.user.id)
      .order("effective_from", { ascending: true });

    setProfile(profileData);
    setAllLogs(logData || []);

    const calculatedTargets = processCalendarData(
      profileData,
      logData || [],
      weightData || [],
      goalHistory || [],
    );
    handleDateSelect(today, logData || [], calculatedTargets);
    setLoading(false);
    // Fire briefing after main data is loaded — non-blocking
    fetchBriefing(session);
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // calculateTargets is imported from lib/nutrition — single source of truth

  const handleDateSelect = (dateStr, logsSource, preCalcTargets) => {
    const logsToFilter = logsSource || allLogs;
    const dailyLogs = logsToFilter.filter((l) => l.date === dateStr);
    setSelectedDate(dateStr);
    setSelectedLogs(dailyLogs);
    const eatenCals = Math.round(dailyLogs.reduce(
      (sum, item) => sum + (item.calories || 0),
      0,
    ));
    const rawMacros = dailyLogs.reduce(
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
    const macrosEaten = {
      p: Math.round(rawMacros.p * 10) / 10,
      c: Math.round(rawMacros.c * 10) / 10,
      f: Math.round(rawMacros.f * 10) / 10,
      fib: Math.round(rawMacros.fib * 10) / 10,
    };
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
  };

  const processCalendarData = (prof, logs, weightLogsData = [], goalHistory = []) => {
    if (!prof) return;
    // "Today's" targets — always from current profile
    const currentTargets = calculateTargets(prof);

    // Build a helper: given a date string, find which goal was active on that day
    // goalHistory is sorted ascending by effective_from
    const getTargetsForDate = (dateStr) => {
      if (!goalHistory || goalHistory.length === 0) return currentTargets;
      // Find the last goal snapshot whose effective_from <= dateStr
      let activeSnapshot = null;
      for (const snap of goalHistory) {
        if (snap.effective_from <= dateStr) activeSnapshot = snap;
        else break;
      }
      if (!activeSnapshot) return currentTargets;
      // Build a fake profile merging current profile body stats with snapshot goal
      const snapProfile = {
        ...prof,
        goal: activeSnapshot.goal,
        activity: activeSnapshot.activity || prof.activity,
        target_calories: activeSnapshot.target_calories,
      };
      return calculateTargets(snapProfile);
    };

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
        const targets = getTargetsForDate(date); // ← per-day targets
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

    return currentTargets;
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
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: 0 }}>
            Performance
          </h1>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setChatOpen((v) => !v)}
            style={{
              background: chatOpen
                ? "linear-gradient(135deg, #8b5cf6, #3b82f6)"
                : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
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
            <Bot size={18} /> {chatOpen ? "Close" : "Ask AI"}
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
          {/* ROW 1: DAILY SCORE CARD */}
          {(() => {
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
                {/* top accent line */}
                <div style={{
                  position: "absolute", top: 0, left: 0, width: "100%", height: 3,
                  background: metrics.statusColor,
                }} />

                {/* Main row */}
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  {/* Score ring */}
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

                  {/* Status text */}
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

                  {/* Expand chevron */}
                  <div style={{ color: "#444", fontSize: "1.2rem", flexShrink: 0, transition: "transform 0.3s", transform: scoreExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                    ▾
                  </div>
                </div>

                {/* Expandable pillar breakdown */}
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
          })()}

          {/* AI DAILY BRIEFING CARD */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))",
              border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: 20,
              padding: "18px 24px",
              marginBottom: 24,
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* glow accent */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)",
            }} />
            <div style={{
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              borderRadius: 12,
              padding: 10,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Sparkles size={20} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: 1.5 }}>
                  NutriCoach · Daily Briefing
                </span>
                <button
                  onClick={() => {
                    supabase.auth.getSession().then(({ data: { session } }) => {
                      if (session) fetchBriefing(session);
                    });
                  }}
                  style={{
                    background: "none", border: "none", color: "#555", cursor: "pointer",
                    padding: 4, display: "flex", alignItems: "center",
                  }}
                  title="Refresh briefing"
                >
                  <RefreshCw size={14} style={{ animation: briefingLoading ? "spin 1s linear infinite" : "none" }} />
                </button>
              </div>
              {briefingLoading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#555" }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%", background: "#3b82f6",
                    animation: "pulse 1s ease-in-out infinite",
                  }} />
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%", background: "#8b5cf6",
                    animation: "pulse 1s ease-in-out 0.2s infinite",
                  }} />
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%", background: "#ec4899",
                    animation: "pulse 1s ease-in-out 0.4s infinite",
                  }} />
                  <span style={{ fontSize: "0.85rem", color: "#555", marginLeft: 4 }}>Analysing your data...</span>
                </div>
              ) : briefing ? (
                <p style={{
                  margin: 0, fontSize: "0.9rem", color: "#ccc", lineHeight: 1.65,
                  whiteSpace: "pre-wrap",
                }}>
                  {briefing}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#555" }}>
                  Tap refresh to get your AI briefing.
                </p>
              )}
            </div>
          </div>

          {/* ROW 2: ANALYSIS & TRENDS */}
          {/* GOAL PACE INDICATOR */}
          {(() => {
            const pace = computeGoalPace(trendData, profile);
            if (!pace) return null;

            const isGood = pace.onTrack;
            const accentColor = pace.direction === "reached"
              ? "#22c55e"
              : isGood ? "#3b82f6" : "#f59e0b";

            // Progress toward goal weight
            const startWeight = profile?.weight || pace.latestWeight;
            const targetW = profile?.target_weight;
            let progressPct = 0;
            if (targetW && startWeight && startWeight !== targetW) {
              const totalDelta = Math.abs(startWeight - targetW);
              const doneDelta = Math.abs(pace.latestWeight - targetW);
              progressPct = Math.min(100, Math.max(0, Math.round((1 - doneDelta / totalDelta) * 100)));
            }

            return (
              <div style={{
                background: "#1f1f22",
                border: `1px solid ${accentColor}33`,
                borderRadius: 20,
                padding: "20px 24px",
                marginBottom: 24,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 16,
                alignItems: "center",
              }}>
                {/* Left side */}
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>
                    🎯 Goal Pace
                  </div>

                  {pace.weeksToGoal !== null ? (
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>
                        ~{pace.weeksToGoal}
                      </span>
                      <span style={{ fontSize: "1rem", color: "#888", marginLeft: 6 }}>weeks to goal weight</span>
                      <div style={{ fontSize: "0.8rem", color: "#555", marginTop: 2 }}>
                        {pace.latestWeight} kg → {pace.targetWeight} kg
                        {pace.weeklyRateKg !== null && (
                          <span style={{ marginLeft: 8, color: pace.onTrack ? "#3b82f6" : "#f59e0b" }}>
                            ({pace.weeklyRateKg > 0 ? "+" : ""}{pace.weeklyRateKg.toFixed(2)} kg/wk actual)
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: "0 0 10px", fontSize: "0.9rem", color: "#ccc" }}>{pace.message}</p>
                  )}

                  {/* Progress bar toward goal */}
                  {targetW && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#555", marginBottom: 4 }}>
                        <span>Start: {profile?.weight} kg</span>
                        <span style={{ color: accentColor, fontWeight: 700 }}>{progressPct}% there</span>
                        <span>Goal: {targetW} kg</span>
                      </div>
                      <div style={{ background: "#27272a", height: 8, borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${progressPct}%`,
                          background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)`,
                          borderRadius: 4,
                          transition: "width 1s ease",
                        }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side — deficit/surplus badge */}
                <div style={{
                  textAlign: "center",
                  background: pace.dailyDeficit > 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                  border: `1px solid ${pace.dailyDeficit > 0 ? "#22c55e33" : "#ef444433"}`,
                  borderRadius: 14,
                  padding: "12px 18px",
                  minWidth: 90,
                }}>
                  <div style={{ fontSize: "1.3rem", fontWeight: 800, color: pace.dailyDeficit > 0 ? "#22c55e" : "#ef4444" }}>
                    {pace.dailyDeficit > 0 ? "-" : "+"}{Math.abs(pace.dailyDeficit)}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#555", fontWeight: 600 }}>kcal/day avg</div>
                  <div style={{ fontSize: "0.7rem", color: "#444", marginTop: 2 }}>
                    {pace.dailyDeficit > 0 ? "deficit" : "surplus"}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="chart-grid-container">
            {/* TREND CHART */}
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
            {/* MACRO PROGRESS RINGS */}
            <div
              className="chart-card"
              style={{
                padding: 24,
                flex: "1 1 300px",
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

              {/* Rings grid */}
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
                  // SVG circle math
                  const R = 42;
                  const circ = 2 * Math.PI * R;
                  const dash = Math.min(pct, 1) * circ;
                  return (
                    <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <div style={{ position: "relative", width: 100, height: 100 }}>
                        <svg width="100" height="100" style={{ transform: "rotate(-90deg)" }}>
                          {/* Track */}
                          <circle cx="50" cy="50" r={R} fill="none" stroke="#27272a" strokeWidth="10" />
                          {/* Progress */}
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
                        {/* Centre text */}
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

              {/* Calorie bar at the bottom */}
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
        </>
      )}

      {/* ── INLINE CHAT DRAWER ─────────────────────────────────────────── */}
      {chatOpen && (
        <div style={{
          position: "fixed",
          bottom: 74, // above bottom nav
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(480px, calc(100vw - 24px))",
          height: 420,
          background: "#111113",
          border: "1px solid #2a2a2e",
          borderRadius: 20,
          boxShadow: "0 -4px 40px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          zIndex: 200,
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #222",
            background: "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                borderRadius: 8, padding: 6, display: "flex",
              }}>
                <Bot size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>NutriCoach</div>
                <div style={{ fontSize: "0.65rem", color: "#555" }}>Live · uses your real data</div>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "12px 14px",
            display: "flex", flexDirection: "column", gap: 10,
          }}
            className="custom-scrollbar"
          >
            {chatMessages.length === 0 && (
              <div style={{ textAlign: "center", marginTop: 40 }}>
                <div style={{ fontSize: "1.8rem", marginBottom: 10 }}>🤖</div>
                <div style={{ color: "#444", fontSize: "0.85rem" }}>Ask me anything about your nutrition</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 14 }}>
                  {["What should I eat now?", "How's my protein?", "Am I on track today?"].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setChatInput(q); }}
                      style={{
                        background: "#1f1f22", border: "1px solid #333",
                        color: "#aaa", fontSize: "0.75rem", padding: "6px 10px",
                        borderRadius: 12, cursor: "pointer",
                      }}
                    >{q}</button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "82%",
                  background: msg.role === "user"
                    ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                    : "#1f1f22",
                  border: msg.role === "user" ? "none" : "1px solid #2a2a2e",
                  color: "#fff",
                  padding: "9px 13px",
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  fontSize: "0.85rem",
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: "flex", gap: 5, padding: "4px 0" }}>
                {[0, 0.15, 0.3].map((delay, i) => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: "50%", background: "#3b82f6",
                    animation: `pulse 1s ease-in-out ${delay}s infinite`,
                  }} />
                ))}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{
            display: "flex", gap: 8, padding: "10px 12px",
            borderTop: "1px solid #222", flexShrink: 0, background: "#111113",
          }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
              placeholder="Ask NutriCoach..."
              style={{
                flex: 1, background: "#1f1f22", border: "1px solid #2a2a2e",
                borderRadius: 12, padding: "10px 14px", color: "#fff",
                fontSize: "0.875rem", outline: "none",
              }}
            />
            <button
              onClick={sendChatMessage}
              disabled={chatLoading || !chatInput.trim()}
              style={{
                background: chatLoading || !chatInput.trim()
                  ? "#1f1f22"
                  : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                border: "1px solid #333", borderRadius: 12,
                padding: "10px 16px", color: chatLoading || !chatInput.trim() ? "#444" : "#fff",
                cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                fontWeight: 700, fontSize: "0.85rem", transition: "all 0.2s",
              }}
            >
              {chatLoading ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
