"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FLATTENED_DB } from "../food-data";
import { calculateTargets } from "../lib/nutrition";
import { AlertCircle } from "lucide-react";
import { supabase } from "../supabase";
import { COLORS } from "../components/dashboard/ui";
import ResearchModal from "../components/dashboard/ResearchModal";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import DailyScoreCard from "../components/dashboard/DailyScoreCard";
import AiBriefingCard from "../components/dashboard/AiBriefingCard";
import GoalPaceCard from "../components/dashboard/GoalPaceCard";
import TrendCharts from "../components/dashboard/TrendCharts";
import MacroBreakdown from "../components/dashboard/MacroBreakdown";
import BiomarkerTimeline from "../components/dashboard/BiomarkerTimeline";
import ChatDrawer from "../components/dashboard/ChatDrawer";

export default function UserDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const [metrics, setMetrics] = useState({
    eaten: 0,
    target: 0,
    status: "Loading...",
    statusColor: "#666",
    macros: { p: 0, c: 0, f: 0, fib: 0 },
    targets: { p: 0, c: 0, f: 0, fib: 0 },
    water: { current: 0, target: 0 },
  });

  const [calendarData, setCalendarData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [trendMetric, setTrendMetric] = useState("calories");
  const [trendRange, setTrendRange] = useState(7);
  const [allLogs, setAllLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [showResearch, setShowResearch] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingTools, setBriefingTools] = useState([]);
  const [scoreExpanded, setScoreExpanded] = useState(false);
  
  // Chat drawer state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const fetchBriefing = async (session) => {
    setBriefingLoading(true);
    setBriefing("");
    setBriefingTools([]);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Updated prompt: conversational, smooth paragraph, no lists.
          message:
            "You are my personal expert nutritionist. Give me a brief, conversational 2-3 sentence daily briefing based on today's data. Acknowledge a win, gently point out a gap, and suggest a specific, realistic food action for my next meal. Do not use lists, bullet points, or strict formatting—write it as a natural, encouraging paragraph. Use bold text to highlight key numbers or specific food items.",
          userId: session.user.id,
          accessToken: session.access_token,
          skipHistory: true,  // one-shot widget — must not pollute agent page history
        }),
      });

      if (!res.ok) throw new Error("Stream failed");

      setBriefingLoading(false); 
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "tool") {
              setBriefingTools((prev) => [...prev, event.name]);
            } else if (event.type === "chunk") {
              accumulatedText += event.text;
              setBriefing(accumulatedText);
            }
          } catch {}
        }
      }
    } catch {
      setBriefing("Failed to load briefing. Please try again.");
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
    const nextHistory = [...chatMessages, userMsg];
    
    setChatInput("");
    setChatLoading(true);

    setChatMessages([
      ...nextHistory,
      { role: "model", content: "", toolsUsed: [], streaming: true },
    ]);

    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          userId: session.user.id,
          accessToken: session.access_token,
          skipHistory: true,  // dashboard inline chat — uses its own in-memory state, must not write to chat_sessions
          history: nextHistory.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        throw new Error("Stream failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "tool") {
              setChatMessages((prev) => {
                const arr = [...prev];
                const last = { ...arr[arr.length - 1] };
                last.toolsUsed = [...(last.toolsUsed || []), event.name];
                arr[arr.length - 1] = last;
                return arr;
              });
            } else if (event.type === "chunk") {
              setChatMessages((prev) => {
                const arr = [...prev];
                const last = { ...arr[arr.length - 1] };
                last.content = (last.content || "") + event.text;
                arr[arr.length - 1] = last;
                return arr;
              });
            } else if (event.type === "done") {
              setChatMessages((prev) => {
                const arr = [...prev];
                const last = { ...arr[arr.length - 1] };
                last.streaming = false;
                arr[arr.length - 1] = last;
                return arr;
              });
            }
          } catch {
            // malformed SSE skip
          }
        }
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch {
      setChatMessages((prev) => {
        const arr = [...prev];
        arr[arr.length - 1] = { role: "model", content: "Connection error. Try again.", streaming: false };
        return arr;
      });
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

    const { data: weightData } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("user_id", session.user.id)
      .gte("date", startStr)
      .order("date", { ascending: true });

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
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const currentTargets = calculateTargets(prof);

    const getTargetsForDate = (dateStr) => {
      if (!goalHistory || goalHistory.length === 0) return currentTargets;
      let activeSnapshot = null;
      for (const snap of goalHistory) {
        if (snap.effective_from <= dateStr) activeSnapshot = snap;
        else break;
      }
      if (!activeSnapshot) return currentTargets;
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
        weight: null,
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

    weightLogsData.forEach((w) => {
      if (calendarMap[w.date]) calendarMap[w.date].weight = Number(w.weight);
    });

    const calData = Object.keys(calendarMap)
      .sort()
      .map((date) => {
        const day = calendarMap[date];
        const targets = getTargetsForDate(date);
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
        weight: calendarMap[date].weight,
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
        return profile?.target_weight || null;
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
      {/* Chart-grid, scrollbar and keyframe styles live in globals.css.
          They cannot be a <style jsx> block here: styled-jsx is component-scoped,
          and this page's chart/chat markup now lives in components/dashboard/*. */}

      <ResearchModal
        showResearch={showResearch}
        setShowResearch={setShowResearch}
      />

      <DashboardHeader
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        setShowResearch={setShowResearch}
      />

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
          <DailyScoreCard
            metrics={metrics}
            calendarData={calendarData}
            selectedDate={selectedDate}
            scoreExpanded={scoreExpanded}
            setScoreExpanded={setScoreExpanded}
          />

          <AiBriefingCard
            briefing={briefing}
            briefingLoading={briefingLoading}
            briefingTools={briefingTools}
            fetchBriefing={fetchBriefing}
          />

          {/* ROW 2: ANALYSIS & TRENDS */}
          <GoalPaceCard profile={profile} trendData={trendData} />

          <div style={{ marginBottom: 20 }}>
            <BiomarkerTimeline />
          </div>

          <TrendCharts
            calendarData={calendarData}
            metrics={metrics}
            selectedDate={selectedDate}
            trendMetric={trendMetric}
            setTrendMetric={setTrendMetric}
            trendRange={trendRange}
            setTrendRange={setTrendRange}
            visibleTrendData={visibleTrendData}
            getTrendColor={getTrendColor}
            getCurrentTarget={getCurrentTarget}
            handleDateSelect={handleDateSelect}
          />

          <MacroBreakdown
            metrics={metrics}
            selectedDate={selectedDate}
            selectedLogs={selectedLogs}
          />
        </>
      )}

      <ChatDrawer
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        chatMessages={chatMessages}
        chatInput={chatInput}
        setChatInput={setChatInput}
        chatLoading={chatLoading}
        sendChatMessage={sendChatMessage}
        chatEndRef={chatEndRef}
      />
    </div>
  );
}
