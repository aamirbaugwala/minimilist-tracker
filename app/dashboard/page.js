"use client";

/**
 * Insights (Direction A).
 *
 *   Monday review (Mon/Tue, dismissible per week)
 *   The week — average, days within 10% of goal, 7 bars (today dashed,
 *              "in progress", never graded). Tap a bar for that day.
 *   Weight + protein tiles · Blood markers · "Ask Coach about this week"
 *   Details — the existing 30-day trend charts and macro breakdown.
 *
 * Fixes vs the old dashboard:
 *  - Targets include medical conditions (renal protein cap, lipid fat cap…),
 *    same as Today and Coach. They didn't before, so numbers disagreed.
 *  - Past-day targets use the goal snapshot's real axes (calorie_adjustment,
 *    protein_priority), not just its label.
 *  - No graded "D · Under eating" for an unfinished day; no AI briefing call on
 *    every visit and no second chat drawer — Coach is the one AI place.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Info, Sparkles, Loader2 } from "lucide-react";
import { FLATTENED_DB } from "../food-data";
import { supabase } from "../supabase";
import { calculateTargets } from "../lib/nutrition";
import { deriveConditions, conditionsFromProfile, mergeConditions } from "../lib/conditions";
import { dayKey, dayKeyDaysAgo } from "../lib/day";
import { weekSummary, weightSummary, weeklyReview, mondayOf } from "../lib/insights";
import { useLocalStorageValue } from "../hooks/useLocalStorageValue";
import { COLORS } from "../components/dashboard/ui";
import ResearchModal from "../components/dashboard/ResearchModal";
import TrendCharts from "../components/dashboard/TrendCharts";
import MacroBreakdown from "../components/dashboard/MacroBreakdown";
import { WeekCard, WeeklyReview, InsightTiles, MarkersCard } from "../components/insights/InsightsCards";

export default function Insights() {
  const router = useRouter();
  const today = dayKey();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [allLogs, setAllLogs] = useState([]);
  const [days, setDays] = useState([]); // [{ date, cals, protein, …, targetCals, targetP, targetFib }]
  const [latestReport, setLatestReport] = useState(null);
  const [conditions, setConditions] = useState([]);
  const [showResearch, setShowResearch] = useState(false);

  // Details section (existing charts)
  const [calendarData, setCalendarData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [trendMetric, setTrendMetric] = useState("calories");
  const [trendRange, setTrendRange] = useState(7);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [metrics, setMetrics] = useState({
    eaten: 0,
    target: 0,
    macros: { p: 0, c: 0, f: 0, fib: 0 },
    targets: { p: 0, c: 0, f: 0, fib: 0 },
    water: { current: 0, target: 0 },
  });

  const reviewKey = `nt_week_review_dismissed_${mondayOf(today)}`;
  const [reviewDismissed, setReviewDismissed] = useLocalStorageValue(reviewKey);

  const targetsFor = (prof, conds, goalHistory) => {
    const current = calculateTargets(prof, conds);
    return (dateStr) => {
      // Today is always the CURRENT profile: the newest goal_history snapshot
      // can lag behind (onboarding / settings edits don't always write one),
      // which made Insights show a different goal from Today.
      if (dateStr >= dayKey()) return current;
      let snap = null;
      for (const s of goalHistory || []) {
        if (s.effective_from <= dateStr) snap = s;
        else break;
      }
      if (!snap) return current;
      return calculateTargets(
        {
          ...prof,
          goal: snap.goal ?? prof.goal,
          activity: snap.activity || prof.activity,
          target_calories: snap.target_calories,
          calorie_adjustment: snap.calorie_adjustment ?? prof.calorie_adjustment,
          protein_priority: snap.protein_priority ?? prof.protein_priority,
        },
        conds,
      );
    };
  };

  const selectDate = (dateStr, logsSource, prof, conds) => {
    const p = prof || profile;
    const c = conds || conditions;
    const dailyLogs = (logsSource || allLogs).filter((l) => l.date === dateStr);
    setSelectedDate(dateStr);
    setSelectedLogs(dailyLogs);
    const macros = dailyLogs.reduce(
      (acc, item) => {
        let fib = item.fiber || 0;
        if (!fib && item.name && item.name !== "Water") {
          const db = FLATTENED_DB[item.name.toLowerCase()];
          if (db?.fiber) fib = Math.round(db.fiber * item.qty);
        }
        return { p: acc.p + (item.protein || 0), c: acc.c + (item.carbs || 0), f: acc.f + (item.fats || 0), fib: acc.fib + fib };
      },
      { p: 0, c: 0, f: 0, fib: 0 },
    );
    const t = calculateTargets(p, c);
    setMetrics({
      eaten: Math.round(dailyLogs.reduce((s, i) => s + (i.calories || 0), 0)),
      target: t.targetCals,
      macros: { p: Math.round(macros.p), c: Math.round(macros.c), f: Math.round(macros.f), fib: Math.round(macros.fib) },
      targets: t.targetMacros,
      water: { current: dailyLogs.filter((i) => i.name === "Water").reduce((a, i) => a + i.qty * 0.25, 0), target: t.waterTarget },
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          router.push("/");
          return;
        }
        const uid = session.user.id;
        const startStr = dayKeyDaysAgo(30);
        const [{ data: prof }, { data: logs }, { data: weights }, { data: goalHistory }, { data: reports }] = await Promise.all([
          supabase.from("user_profiles").select("*").eq("user_id", uid).maybeSingle(),
          supabase.from("food_logs").select("*").eq("user_id", uid).gte("date", startStr).order("created_at", { ascending: true }),
          supabase.from("weight_logs").select("date, weight").eq("user_id", uid).gte("date", startStr).order("date", { ascending: true }),
          supabase
            .from("goal_history")
            .select("goal, activity, target_calories, calorie_adjustment, protein_priority, effective_from")
            .eq("user_id", uid)
            .order("effective_from", { ascending: true }),
          supabase.from("medical_reports").select("flags, report_date, created_at, file_name").eq("user_id", uid).order("created_at", { ascending: false }),
        ]);
        if (cancelled) return;
        if (!prof) {
          setLoading(false);
          return;
        }

        const conds = mergeConditions(deriveConditions(reports || []), conditionsFromProfile(prof));
        const target = targetsFor(prof, conds, goalHistory || []);

        // One entry per logical day, oldest → today.
        const map = {};
        for (let i = 29; i >= 0; i--) {
          const date = dayKeyDaysAgo(i);
          map[date] = { date, cals: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, weight: null };
        }
        (logs || []).forEach((l) => {
          const d = map[l.date];
          if (!d) return;
          let { protein: p = 0, carbs: c = 0, fats: f = 0, fiber: fib = 0, calories: cals = 0 } = l;
          if (l.name && l.name !== "Water" && (!p || !c || !f)) {
            const db = FLATTENED_DB[l.name.toLowerCase()];
            if (db) {
              p ||= Math.round(db.protein * l.qty);
              c ||= Math.round(db.carbs * l.qty);
              f ||= Math.round(db.fats * l.qty);
              fib ||= Math.round((db.fiber || 0) * l.qty);
              cals ||= Math.round(db.calories * l.qty);
            }
          }
          d.cals += Number(cals) || 0;
          d.protein += Number(p) || 0;
          d.carbs += Number(c) || 0;
          d.fats += Number(f) || 0;
          d.fiber += Number(fib) || 0;
        });
        (weights || []).forEach((w) => {
          if (map[w.date]) map[w.date].weight = Number(w.weight);
        });

        const dayList = Object.values(map)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((d) => {
            const t = target(d.date);
            return { ...d, cals: Math.round(d.cals), targetCals: t.targetCals, targetP: t.targetMacros.p, targetFib: t.targetMacros.fib };
          });

        setProfile(prof);
        setConditions(conds);
        setAllLogs(logs || []);
        setDays(dayList);
        setLatestReport((reports || [])[0] || null);
        setCalendarData(
          dayList.map((d) => ({
            date: d.date,
            cals: d.cals,
            color: !d.cals ? "var(--track)" : Math.abs(d.cals - d.targetCals) <= d.targetCals * 0.1 ? "var(--accent)" : "var(--accent-muted)",
          })),
        );
        setTrendData(
          dayList.map((d) => ({
            date: new Date(`${d.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            rawDate: d.date,
            // Unlogged days are gaps, not zeros — a 0 would read as "ate nothing".
            calories: d.cals || null,
            protein: d.cals ? d.protein : null,
            carbs: d.cals ? d.carbs : null,
            fats: d.cals ? d.fats : null,
            fiber: d.cals ? d.fiber : null,
            weight: d.weight,
          })),
        );
        selectDate(dayKey(), logs || [], prof, conds);
      } catch (e) {
        console.error("Insights load failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => (days.length ? weekSummary(days, today) : null), [days, today]);
  const weight = useMemo(() => weightSummary(days), [days]);
  const review = useMemo(() => {
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 1 = Monday
    if (dow !== 1 && dow !== 2) return null; // Monday review shows Mon–Tue
    return weeklyReview(days, allLogs, today);
  }, [days, allLogs, today]);

  const getCurrentTarget = () => {
    switch (trendMetric) {
      case "protein": return metrics.targets.p;
      case "carbs": return metrics.targets.c;
      case "fats": return metrics.targets.f;
      case "fiber": return metrics.targets.fib;
      case "weight": return profile?.target_weight || null;
      default: return metrics.target;
    }
  };
  const getTrendColor = () =>
    ({ protein: COLORS.pro, carbs: COLORS.carb, fats: COLORS.fat, fiber: COLORS.fib, weight: COLORS.weight })[trendMetric] || COLORS.cals;

  if (loading) {
    return (
      <div style={{ minHeight: "60dvh", width: "100%", display: "grid", placeItems: "center", color: "var(--text-faint)" }}>
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 600,
        margin: "0 auto",
        boxSizing: "border-box",
        padding: "calc(24px + env(safe-area-inset-top, 0px)) 20px calc(110px + env(safe-area-inset-bottom, 0px))",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        color: "var(--text)",
      }}
    >
      <ResearchModal showResearch={showResearch} setShowResearch={setShowResearch} />

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: -0.4 }}>Insights</h1>
        <button
          onClick={() => setShowResearch(true)}
          aria-label="How your targets are calculated"
          title="How your targets are calculated"
          style={{ width: 38, height: 38, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", display: "grid", placeItems: "center", cursor: "pointer" }}
        >
          <Info size={18} />
        </button>
      </header>

      {!profile ? (
        <div style={{ padding: 20, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 15, lineHeight: 1.5 }}>
          Set your weight and goal first — then Insights can show how your week is going.{" "}
          <Link href="/" style={{ color: "var(--accent-text)", fontWeight: 600 }}>Go to Today</Link>
        </div>
      ) : (
        <>
          {review && reviewDismissed === null && <WeeklyReview review={review} onDismiss={() => setReviewDismissed("1")} />}

          {summary && <WeekCard summary={summary} today={today} selectedDate={selectedDate} onSelect={(d) => selectDate(d)} />}

          <InsightTiles
            weight={weight}
            profileWeight={profile.weight}
            avgProtein={summary?.avgProtein || 0}
            targetP={summary?.targetP || 0}
            hasLoggedDays={(summary?.loggedDays || 0) > 0}
          />

          <MarkersCard report={latestReport} />

          <Link
            href="/agent"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 14, border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}
          >
            <Sparkles size={17} color="var(--accent-text)" /> Ask Coach about this week
          </Link>

          <h2 style={{ margin: "12px 0 -6px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
            Details
          </h2>
          <TrendCharts
            calendarData={calendarData}
            metrics={metrics}
            selectedDate={selectedDate}
            trendMetric={trendMetric}
            setTrendMetric={setTrendMetric}
            trendRange={trendRange}
            setTrendRange={setTrendRange}
            visibleTrendData={trendRange === 7 ? trendData.slice(-7) : trendData}
            getTrendColor={getTrendColor}
            getCurrentTarget={getCurrentTarget}
            handleDateSelect={(d) => selectDate(d)}
          />
          <MacroBreakdown metrics={metrics} selectedDate={selectedDate} selectedLogs={selectedLogs} />
        </>
      )}
    </div>
  );
}
