"use client";

import React, { useState, useEffect, memo, useMemo } from "react";
import {
  Search,
  Plus,
  Minus,
  X,
  Loader2,
  Flame,
  Droplets,
  Trash2,
  Save,
  Pencil,
  Target,
  Calculator,
  Shield,
  KeyRound,
  Settings,
  Zap,
  Award,
  Battery,
  Utensils,
  Sparkles,
  Globe,
  Edit3,
  PlusCircle,
  Scale,
} from "lucide-react";
import { FOOD_CATEGORIES, FLATTENED_DB } from "./food-data";
import { supabase } from "./supabase";
import { calculateTargets, capPct, GOAL_PRESETS } from "./lib/nutrition";
import { useAuth } from "./hooks/useAuth";

// ── Category icons map ──────────────────────────────────────────────────────
const CATEGORY_ICONS = {
  "Smart Recs": "✨",
  Recent: "🕐",
  Meals: "🍱",
  Proteins: "🥩",
  Dairy: "🥛",
  Grains: "🌾",
  Vegetables: "🥦",
  Fruits: "🍎",
  Snacks: "🍿",
  Beverages: "🧃",
  Fats: "🥑",
  Legumes: "🫘",
  Sweets: "🍬",
  Seafood: "🐟",
};

// ── Meal period helper ──────────────────────────────────────────────────────
// Returns { label, icon, order } from a created_at ISO string or "now"
function getMealPeriod(createdAt) {
  const h = createdAt ? new Date(createdAt).getHours() : new Date().getHours();
  if (h >= 5 && h < 11) return { label: "Breakfast", icon: "☀️", order: 0 };
  if (h >= 11 && h < 15) return { label: "Lunch",     icon: "🌤️", order: 1 };
  if (h >= 15 && h < 18) return { label: "Snacks",    icon: "🍵", order: 2 };
  if (h >= 18 && h < 22) return { label: "Dinner",    icon: "🌙", order: 3 };
  return { label: "Late Night", icon: "🌑", order: 4 };
}

// --- MEMOIZED STATS ---
const StatsBoard = memo(({ totals, userProfile, onAddWater }) => {
  const targets = calculateTargets(userProfile);
  const targetCals  = targets.cals;
  const targetP     = targets.p;
  const targetC     = targets.c;
  const targetF     = targets.f;
  const targetFib   = targets.fib;
  const targetWater = targets.water;
  const pct = capPct;

  // SVG ring for calories
  const R = 54;
  const circ = 2 * Math.PI * R;
  const calPct = Math.min(totals.calories / targetCals, 1);
  const calDash = calPct * circ;
  const isOver = totals.calories > targetCals;
  const ringColor = isOver ? "#ef4444" : totals.calories / targetCals > 0.9 ? "#22c55e" : "#3b82f6";
  const remaining = Math.max(0, targetCals - totals.calories);

  return (
    <section style={{ padding: "20px 20px 0" }}>
      {/* HERO CALORIE CARD */}
      <div style={{
        background: "linear-gradient(160deg, #111116, #18181e)",
        borderRadius: 24,
        padding: "24px 20px 20px",
        border: "1px solid #1e1e26",
        marginBottom: 12,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* subtle gradient orb */}
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 160, height: 160, borderRadius: "50%",
          background: `radial-gradient(circle, ${ringColor}18 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* SVG Calorie Ring */}
          <div style={{ position: "relative", width: 128, height: 128, flexShrink: 0 }}>
            <svg width="128" height="128" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="64" cy="64" r={R} fill="none" stroke="#1e1e26" strokeWidth="12" />
              <circle
                cx="64" cy="64" r={R} fill="none"
                stroke={ringColor} strokeWidth="12" strokeLinecap="round"
                strokeDasharray={`${calDash} ${circ}`}
                style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.3s ease" }}
              />
            </svg>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                {totals.calories}
              </div>
              <div style={{ fontSize: "0.62rem", color: "#555", fontWeight: 600, marginTop: 2 }}>
                / {targetCals} kcal
              </div>
            </div>
          </div>

          {/* Right info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.7rem", color: "#444", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 4 }}>
              Calories Today
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: ringColor, lineHeight: 1, marginBottom: 6 }}>
              {isOver ? "Over budget" : remaining === 0 ? "Goal hit! 🎉" : `${remaining} left`}
            </div>
            <div style={{ fontSize: "0.82rem", color: "#555" }}>
              {Math.round(calPct * 100)}% of daily target
            </div>

            {/* Calorie bar */}
            <div style={{ background: "#1e1e26", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 12 }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, calPct * 100)}%`,
                background: ringColor,
                borderRadius: 3,
                transition: "width 0.8s ease",
              }} />
            </div>
          </div>
        </div>

        {/* MACRO PILLS ROW */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 20 }}>
          {[
            { label: "Protein", val: totals.protein, target: targetP, color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
            { label: "Carbs",   val: totals.carbs,   target: targetC, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
            { label: "Fats",    val: totals.fats,    target: targetF, color: "#ef4444", bg: "rgba(239,68,68,0.1)"  },
            { label: "Fiber",   val: totals.fiber,   target: targetFib, color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
          ].map(({ label, val, target, color, bg }) => {
            const p = pct(val, target);
            return (
              <div key={label} style={{ background: bg, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: "1rem", fontWeight: 800, color, lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: "0.58rem", color: "#555", fontWeight: 600, marginTop: 2 }}>/ {target}g</div>
                <div style={{ background: "#1e1e26", height: 3, borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
                  <div style={{ height: "100%", width: `${p}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
                </div>
                <div style={{ fontSize: "0.6rem", color: "#444", marginTop: 3 }}>{label}</div>
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
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: 0,
          width: `${Math.min(100, ((totals.water * 0.25) / targetWater) * 100)}%`,
          background: "rgba(59,130,246,0.1)",
          transition: "0.5s ease",
        }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Droplets size={20} color="#3b82f6" />
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff" }}>Hydration</div>
              <div style={{ fontSize: "0.75rem", color: "#555" }}>
                <span style={{ color: "#3b82f6", fontWeight: 700 }}>{(totals.water * 0.25).toFixed(2)}L</span>
                {" "}/ {targetWater}L
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: "0.75rem", color: "#3b82f6", fontWeight: 700 }}>
              {Math.round(((totals.water * 0.25) / targetWater) * 100) || 0}%
            </div>
            <div style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8, padding: "4px 10px", fontSize: "0.78rem", color: "#3b82f6", fontWeight: 700 }}>
              + Glass
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
StatsBoard.displayName = "StatsBoard";

export default function Home() {
  const {
    session,
    authLoading,
    sendOtp,
    verifyOtp,
    signInWithPassword,
    updatePassword: authUpdatePassword,
  } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    fiber: 0,
    water: 0,
  });
  const [recents, setRecents] = useState([]);

  // UI State
  const [savedMeals, setSavedMeals] = useState([]);
  const [streak, setStreak] = useState(0);

  // Modals
  const [isCreatingMeal, setIsCreatingMeal] = useState(false);
  const [isSettingGoal, setIsSettingGoal] = useState(false);
  const [settingsTab, setSettingsTab] = useState("profile");
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState(1);

  // --- EDIT LOG STATE ---
  const [isEditingLog, setIsEditingLog] = useState(false);
  const [currentLogToEdit, setCurrentLogToEdit] = useState(null);
  const [editQty, setEditQty] = useState(1);

  // --- CUSTOM FOODS & MANUAL ENTRY STATE ---
  const [customFoods, setCustomFoods] = useState([]);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualFood, setManualFood] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    fiber: "",
  });

  // --- NEW: WEIGHT TRACKING STATE ---
  const [weightInput, setWeightInput] = useState("");
  const [isLoggingWeight, setIsLoggingWeight] = useState(false);

  // Data
  const [userProfile, setUserProfile] = useState({
    weight: "",
    height: "",
    age: "",
    gender: "male",
    activity: "sedentary",
    goal: "lose",
    target_calories: "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [username, setUsername] = useState("");
  const [mealBuilderItems, setMealBuilderItems] = useState([]);
  const [mealBuilderQuery, setMealBuilderQuery] = useState("");
  const [editingMealId, setEditingMealId] = useState(null);
  const [newMealName, setNewMealName] = useState("");

  // UI & Auth
  const [qty, setQty] = useState(1);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Recent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [usePasswordLogin, setUsePasswordLogin] = useState(false);
  // authLoading comes from useAuth hook above

  // --- WEB SEARCH STATE ---
  const [webResults, setWebResults] = useState([]);
  const [isWebSearching, setIsWebSearching] = useState(false);

  // --- MERGE LOCAL DB WITH CUSTOM DB ---
  const COMBINED_DB = useMemo(() => {
    const combined = { ...FLATTENED_DB };
    customFoods.forEach((cf) => {
      combined[cf.name.toLowerCase()] = cf;
    });
    return combined;
  }, [customFoods]);

  // --- AI MEAL PLAN STATE ---
  const [aiMealPlan, setAiMealPlan] = useState(null); // { text, toolsUsed }
  const [aiMealPlanLoading, setAiMealPlanLoading] = useState(false);

  const fetchAiMealPlan = async () => {
    if (!session || aiMealPlanLoading) return;
    setAiMealPlan(null);
    setAiMealPlanLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Build me a meal plan for the rest of the day based on my macro gap. Be specific with Indian food options and serving sizes. For every food you mention that is not already in the internal database, call save_food_to_database with your best estimated macros.",
          history: [],
          userId: session.user.id,
          accessToken: session.access_token,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAiMealPlan({ text: "⚠️ " + (data.error || "Could not generate plan. Try again."), toolsUsed: [] });
      } else {
        setAiMealPlan({ text: data.reply, toolsUsed: data.toolsUsed || [] });
        // Refresh custom foods so newly saved items appear as loggable chips
        const { data: freshCustom } = await supabase
          .from("custom_foods")
          .select("*")
          .eq("user_id", session.user.id);
        if (freshCustom) setCustomFoods(freshCustom);
      }
    } catch {
      setAiMealPlan({ text: "⚠️ Network error. Please try again.", toolsUsed: [] });
    } finally {
      setAiMealPlanLoading(false);
    }
  };

  // --- FEATURE 1: SMART RECOMMENDATIONS LOGIC (legacy, unused) ---
  const generateSmartMeals = () => {
    // Use centralised target calculation
    const t = calculateTargets(userProfile);
    const targetCals = t.cals;
    const targetP    = t.p;
    const targetF    = t.f;
    const targetC    = t.c;

    // REAL Remaining values
    const remainingCals = targetCals - totals.calories;
    const remainingPro = Math.max(0, targetP - totals.protein);
    const remainingFat = Math.max(0, targetF - totals.fats);
    const remainingCarb = Math.max(0, targetC - totals.carbs);

    // Hard Stop if basically full
    if (remainingCals < 50) return [];

    const candidates = [];
    if (COMBINED_DB) {
      Object.entries(COMBINED_DB).forEach(([key, item]) => {
        // Must fit in remaining calories (with slight buffer)
        if (item.calories <= remainingCals * 1.1) {
          let score = 0;

          // SCORING ALGORITHM:
          // 1. Boost if it provides protein we need
          if (remainingPro > 5) {
            if (item.protein > 15)
              score += 20; // High protein
            else if (item.protein > 5) score += 5;
          }

          // 2. Penalize fat if we are out of budget
          if (remainingFat < 5) {
            if (item.fats > 10)
              score -= 100; // Kill high fat items
            else if (item.fats > 5) score -= 50;
          }

          // 3. Boost carbs if we have plenty of room
          if (remainingCarb > 20 && item.carbs > 15) score += 5;

          // 4. Boost volume/fiber
          if (item.fiber > 3) score += 5;

          // 5. Penalize pure junk (Low Macro Density)
          if (item.calories > 200 && item.protein < 5 && item.fiber < 2)
            score -= 10;

          // Only keep good candidates
          if (score > -20) {
            candidates.push({ name: key, ...item, score });
          }
        }
      });
    }

    // Sort by Best Fit
    candidates.sort((a, b) => b.score - a.score);

    const recommendations = [];

    // STRATEGY A: Top 6 Single Items (Best for small gaps)
    candidates.slice(0, 6).forEach((item) => {
      recommendations.push({
        id: `smart-single-${item.name}-${Math.random()}`,
        name: item.name,
        type: "meal",
        items: [{ name: item.name, qty: 1 }],
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
        isSmart: true,
      });
    });

    // STRATEGY B: Combos (Only if enough calorie budget > 350)
    if (remainingCals > 350) {
      const proteins = candidates.filter((c) => c.protein > 10);
      const carbs = candidates.filter((c) => c.carbs > 15);

      for (let i = 0; i < 5; i++) {
        const p = proteins[Math.floor(Math.random() * proteins.length)];
        const c = carbs[Math.floor(Math.random() * carbs.length)];

        if (p && c && p.name !== c.name) {
          const combinedCals = p.calories + c.calories;
          const combinedFat = p.fats + c.fats;

          // Strict check for combos
          if (
            combinedCals <= remainingCals * 1.1 &&
            (remainingFat > 5 || combinedFat < 10)
          ) {
            recommendations.push({
              id: `smart-combo-${i}-${Math.random()}`,
              name: `${p.name} & ${c.name}`,
              type: "meal",
              items: [
                { name: p.name, qty: 1 },
                { name: c.name, qty: 1 },
              ],
              calories: combinedCals,
              protein: p.protein + c.protein,
              carbs: p.carbs + c.carbs,
              fats: combinedFat,
              isSmart: true,
            });
          }
        }
      }
    }

    // Fallback if empty (e.g. only 60 cals left) -> Find smallest items
    if (recommendations.length === 0) {
      const smallSnacks = Object.entries(COMBINED_DB)
        .filter(([, val]) => val.calories <= remainingCals)
        .sort((a, b) => b[1].calories - a[1].calories) // Biggest possible filler
        .slice(0, 3);

      smallSnacks.forEach(([key, val]) => {
        recommendations.push({
          id: `smart-fallback-${key}`,
          name: key,
          type: "meal",
          items: [{ name: key, qty: 1 }],
          ...val,
          isSmart: true,
        });
      });
    }

    return recommendations;
  };

  const smartRecommendations = useMemo(
    () => generateSmartMeals(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [totals, userProfile, COMBINED_DB],
  );

  // --- ACTUAL WEB SEARCH (OpenFoodFacts) ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!query || query.length < 3) {
        setWebResults([]);
        return;
      }

      // Check COMBINED_DB instead of FLATTENED_DB
      const localKeys = Object.keys(COMBINED_DB).filter((k) =>
        k.includes(query.toLowerCase()),
      );

      if (localKeys.length === 0) {
        setIsWebSearching(true);
        try {
          const response = await fetch(
            `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=5`,
          );
          const data = await response.json();

          if (data.products && data.products.length > 0) {
            const mappedResults = data.products.map((p) => ({
              id: `web-${p._id}`,
              name: p.product_name || query,
              isWeb: true,
              calories: Math.round(p.nutriments?.["energy-kcal_100g"] || 0),
              protein: Math.round(p.nutriments?.proteins_100g || 0),
              carbs: Math.round(p.nutriments?.carbohydrates_100g || 0),
              fats: Math.round(p.nutriments?.fat_100g || 0),
              fiber: Math.round(p.nutriments?.fiber_100g || 0),
            }));
            setWebResults(mappedResults);
          } else {
            setWebResults([]);
          }
        } catch (error) {
          console.error("Web search failed", error);
          setWebResults([]);
        } finally {
          setIsWebSearching(false);
        }
      } else {
        setWebResults([]);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [query, COMBINED_DB]);

  // --- INIT ---
  const fetchData = async (isBackground = false) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    if (!isBackground) setLoading(true);
    const todayKey = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("date", todayKey)
      .order("created_at", { ascending: false });
    if (!error) {
      const enrichedLogs = data.map((log) => {
        if (log.name === "Water") return { ...log, fiber: 0 };
        if (log.fiber && log.fiber > 0) return log;
        // Use COMBINED_DB
        let dbItem = COMBINED_DB[log.name.toLowerCase()];
        if (!dbItem) {
          const key = Object.keys(COMBINED_DB).find((k) =>
            k.includes(log.name.toLowerCase()),
          );
          if (key) dbItem = COMBINED_DB[key];
        }
        if (dbItem && dbItem.fiber) {
          return { ...log, fiber: Math.round(dbItem.fiber * log.qty) };
        }
        return { ...log, fiber: 0 };
      });
      setLogs(enrichedLogs);
      setHasUnsavedChanges(false);
    }

    const { data: history } = await supabase
      .from("food_logs")
      .select("name")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (history) {
      const uniqueRecents = [...new Set(history.map((h) => h.name))];
      setRecents(uniqueRecents);
    }

    if (!isBackground) setLoading(false);
  };

  const fetchUserData = async () => {
    const { data: meals } = await supabase.from("saved_meals").select("*");
    if (meals) setSavedMeals(meals);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();
      if (profile) setUserProfile(profile);
      if (profile.username) setUsername(profile.username);

      const { data: custom } = await supabase
        .from("custom_foods")
        .select("*")
      if (custom) setCustomFoods(custom);
    }
  };

  const calculateStreak = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("food_logs")
      .select("date")
      .eq("user_id", session.user.id)
      .order("date", { ascending: false });
    if (!data || data.length === 0) {
      setStreak(0);
      return;
    }

    const uniqueDates = [...new Set(data.map((item) => item.date))];
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);

    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
      setStreak(0);
      return;
    }
    let count = 1;
    let currentDate = new Date(uniqueDates[0]);
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i]);
      if (
        Math.ceil(Math.abs(currentDate - prevDate) / (1000 * 60 * 60 * 24)) ===
        1
      ) {
        count++;
        currentDate = prevDate;
      } else break;
    }
    setStreak(count);
  };

  // useAuth handles getSession + onAuthStateChange subscription internally.
  // React to session changes: fetch data when session arrives, clear when it goes.
  useEffect(() => {
    if (session) {
      fetchData();
      fetchUserData();
      calculateStreak();
      const hasSeen = localStorage.getItem("hasSeenWelcome");
      if (!hasSeen) setShowWelcome(true);
    } else {
      setLogs([]);
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const closeWelcome = () => {
    localStorage.setItem("hasSeenWelcome", "true");
    setShowWelcome(false);
  };

  const saveGoal = async () => {
    if (
      !userProfile.target_calories &&
      (!userProfile.weight || !userProfile.height)
    )
      return alert("Please fill info");
    const { error } = await supabase.from("user_profiles").upsert({
      user_id: session.user.id,
      ...userProfile,
      target_calories: userProfile.target_calories
        ? Number(userProfile.target_calories)
        : null,
      calorie_adjustment: Number(userProfile.calorie_adjustment ?? 0),
      protein_priority: userProfile.protein_priority || "balanced",
      updated_at: new Date(),
    });
    if (error) { alert("Error saving goal"); return; }

    // Snapshot the goal so past days retain their original targets
    await supabase.from("goal_history").insert({
      user_id: session.user.id,
      goal: userProfile.goal,
      activity: userProfile.activity,
      calorie_adjustment: Number(userProfile.calorie_adjustment ?? 0),
      protein_priority: userProfile.protein_priority || "balanced",
      target_calories: userProfile.target_calories
        ? Number(userProfile.target_calories)
        : null,
      effective_from: new Date().toISOString().slice(0, 10),
    });

    alert("Profile updated!");
    setIsSettingGoal(false);
  };

  const handleUpdatePassword = async () => {
    let msg = "";
    if (newPassword) {
      const result = await authUpdatePassword(newPassword);
      if (!result.ok) return alert(result.error);
      msg += "Password updated. ";
    }
    if (username) {
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: session.user.id,
            username: username,
            updated_at: new Date(),
          },
          { onConflict: "user_id" },
        );
      if (profileError) {
        console.error(profileError);
        return alert("Error saving username.");
      }
      setUserProfile((prev) => ({ ...prev, username }));
      msg += "Username saved.";
    }
    if (!newPassword && !username)
      return alert("Please enter a username or password.");
    alert(msg);
    setNewPassword("");
    setShowPasswordSetup(false);
  };

  // --- NEW: HANDLE LOG WEIGHT ---
  const handleLogWeight = async () => {
    if (!weightInput) return;
    setIsLoggingWeight(true);
    const today = new Date().toISOString().slice(0, 10);
    const numWeight = Number(weightInput);

    try {
      // 1. Upsert to weight_logs (for dashboard trends)
      await supabase.from("weight_logs").upsert(
        {
          user_id: session.user.id,
          date: today,
          weight: numWeight,
        },
        { onConflict: "user_id, date" },
      );

      // 2. Update main profile (updates targets immediately)
      await supabase
        .from("user_profiles")
        .update({ weight: numWeight })
        .eq("user_id", session.user.id);

      // 3. Update local state
      setUserProfile((prev) => ({ ...prev, weight: numWeight }));
      setWeightInput("");
    } catch (err) {
      console.error(err);
      alert("Failed to log weight");
    } finally {
      setIsLoggingWeight(false);
    }
  };

  const saveCustomFoodToDb = async (item) => {
    if (!session) return;
    const exists = customFoods.find(
      (cf) => cf.name.toLowerCase() === item.name.toLowerCase(),
    );
    if (exists) return;

    const newFood = {
      user_id: session.user.id,
      name: item.name,
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fats: Number(item.fats) || 0,
      fiber: Number(item.fiber) || 0,
    };

    const { data, error } = await supabase
      .from("custom_foods")
      .insert([newFood])
      .select();

    if (!error && data) {
      setCustomFoods((prev) => [...prev, data[0]]);
    }
  };

  const handleManualAddSubmit = (e) => {
    e.preventDefault();
    if (!manualFood.name || !manualFood.calories)
      return alert("Missing details!");

    const formattedFood = {
      ...manualFood,
      calories: Number(manualFood.calories),
      protein: Number(manualFood.protein) || 0,
      carbs: Number(manualFood.carbs) || 0,
      fats: Number(manualFood.fats) || 0,
      fiber: Number(manualFood.fiber) || 0,
    };

    saveCustomFoodToDb(formattedFood);
    addFood(formattedFood.name, qty, formattedFood);

    setManualFood({
      name: "",
      calories: "",
      protein: "",
      carbs: "",
      fats: "",
      fiber: "",
    });
    setIsManualEntryOpen(false);
    setQuery("");
  };

  const handleLocalAdd = (itemsToAdd) => {
    setHasUnsavedChanges(true);
    setLogs((currentLogs) => {
      let updatedLogs = [...currentLogs];
      itemsToAdd.forEach((newItem) => {
        const foodName = newItem.name;
        const quantity = Number(newItem.qty);
        let baseData = {
          calories: newItem.calories || 0,
          protein: newItem.protein || 0,
          carbs: newItem.carbs || 0,
          fats: newItem.fats || 0,
          fiber: newItem.fiber || 0,
        };

        if (foodName !== "Water" && baseData.calories === 0 && !newItem.isWeb) {
          let dbData = COMBINED_DB[foodName.toLowerCase()];
          if (!dbData) {
            const key = Object.keys(COMBINED_DB).find((k) =>
              k.includes(foodName.toLowerCase()),
            );
            if (key) dbData = COMBINED_DB[key];
          }
          if (dbData) baseData = dbData;
        }

        const existingIndex = updatedLogs.findIndex((l) => l.name === foodName);
        if (existingIndex !== -1) {
          const existingLog = updatedLogs[existingIndex];
          const newQty = Number(existingLog.qty) + quantity;
          updatedLogs[existingIndex] = {
            ...existingLog,
            qty: newQty,
            calories: Math.round(baseData.calories * newQty),
            protein: Math.round(baseData.protein * newQty),
            carbs: Math.round(baseData.carbs * newQty),
            fats: Math.round(baseData.fats * newQty),
            fiber: Math.round(baseData.fiber * newQty),
          };
        } else {
          updatedLogs = [
            {
              id: Math.random(),
              name: foodName,
              qty: quantity,
              calories: Math.round(baseData.calories * quantity),
              protein: Math.round(baseData.protein * quantity),
              carbs: Math.round(baseData.carbs * quantity),
              fats: Math.round(baseData.fats * quantity),
              fiber: Math.round(baseData.fiber * quantity),
              date: new Date().toISOString().slice(0, 10),
              user_id: session.user.id,
            },
            ...updatedLogs,
          ];
        }
      });
      return updatedLogs;
    });
  };

  const addFood = (foodName, overrideQty = null, explicitMacros = null) => {
    const item = {
      name: foodName,
      qty: overrideQty || qty,
      ...explicitMacros,
    };
    handleLocalAdd([item]);
    if (!overrideQty && foodName !== "Water") {
      setQty(1);
      setQuery("");
    }
  };
  const loadMeal = (meal) => {
    handleLocalAdd(meal.items);
  };
  const deleteLog = (id) => {
    setHasUnsavedChanges(true);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const openEditModal = (log) => {
    setCurrentLogToEdit(log);
    setEditQty(log.qty);
    setIsEditingLog(true);
  };

  const saveLogEdit = () => {
    if (!currentLogToEdit) return;
    const newQ = Number(editQty);

    if (newQ <= 0) {
      deleteLog(currentLogToEdit.id);
      setIsEditingLog(false);
      return;
    }

    const oldQ = currentLogToEdit.qty;
    const ratio = newQ / oldQ;

    setLogs((prevLogs) =>
      prevLogs.map((log) => {
        if (log.id === currentLogToEdit.id) {
          return {
            ...log,
            qty: newQ,
            calories: Math.round(log.calories * ratio),
            protein: Math.round(log.protein * ratio),
            carbs: Math.round(log.carbs * ratio),
            fats: Math.round(log.fats * ratio),
            fiber: Math.round((log.fiber || 0) * ratio),
          };
        }
        return log;
      }),
    );

    setHasUnsavedChanges(true);
    setIsEditingLog(false);
    setCurrentLogToEdit(null);
  };

  const saveChanges = async () => {
    if (!session) return;
    setIsSaving(true);
    const todayKey = new Date().toISOString().slice(0, 10);
    try {
      await supabase
        .from("food_logs")
        .delete()
        .eq("user_id", session.user.id)
        .eq("date", todayKey);
      const OMIT = new Set(["id", "created_at"]);
      const cleanLogs = logs.map((log) => ({
        ...Object.fromEntries(Object.entries(log).filter(([k]) => !OMIT.has(k))),
        user_id: session.user.id,
        date: todayKey,
      }));
      if (cleanLogs.length > 0)
        await supabase.from("food_logs").insert(cleanLogs);
      setHasUnsavedChanges(false);
      await fetchData(true);
    } catch {
      alert("Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const openMealBuilder = (mealToEdit = null) => {
    if (mealToEdit) {
      setEditingMealId(mealToEdit.id);
      setNewMealName(mealToEdit.name);
      setMealBuilderItems(mealToEdit.items);
    } else {
      setEditingMealId(null);
      setNewMealName("");
      setMealBuilderItems([]);
    }
    setIsCreatingMeal(true);
  };
  const addItemToBuilder = (foodName) => {
    const existing = mealBuilderItems.find((i) => i.name === foodName);
    if (existing)
      setMealBuilderItems(
        mealBuilderItems.map((i) =>
          i.name === foodName ? { ...i, qty: i.qty + 1 } : i,
        ),
      );
    else setMealBuilderItems([...mealBuilderItems, { name: foodName, qty: 1 }]);
  };
  const removeItemFromBuilder = (index) => {
    const newItems = [...mealBuilderItems];
    newItems.splice(index, 1);
    setMealBuilderItems(newItems);
  };
  const saveBuiltMeal = async () => {
    if (!newMealName || mealBuilderItems.length === 0)
      return alert("Invalid meal");
    if (editingMealId) {
      await supabase
        .from("saved_meals")
        .update({ name: newMealName, items: mealBuilderItems })
        .eq("id", editingMealId);
      setSavedMeals(
        savedMeals.map((m) =>
          m.id === editingMealId
            ? { ...m, name: newMealName, items: mealBuilderItems }
            : m,
        ),
      );
    } else {
      const { data } = await supabase
        .from("saved_meals")
        .insert([
          {
            name: newMealName,
            items: mealBuilderItems,
            user_id: session.user.id,
          },
        ])
        .select();
      if (data) setSavedMeals([...savedMeals, data[0]]);
    }
    setIsCreatingMeal(false);
  };
  const deleteMeal = async (id) => {
    if (!confirm("Delete?")) return;
    setSavedMeals(savedMeals.filter((m) => m.id !== id));
    await supabase.from("saved_meals").delete().eq("id", id);
  };

  useEffect(() => {
    const t = logs.reduce(
      (acc, item) => ({
        calories: acc.calories + (Number(item.calories) || 0),
        protein: acc.protein + (Number(item.protein) || 0),
        carbs: acc.carbs + (Number(item.carbs) || 0),
        fats: acc.fats + (Number(item.fats) || 0),
        fiber: acc.fiber + (Number(item.fiber) || 0),
        water: item.name === "Water" ? acc.water + item.qty : acc.water,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, water: 0 },
    );
    setTotals({
      calories: Math.round(t.calories),
      protein: Math.round(t.protein * 10) / 10,
      carbs: Math.round(t.carbs * 10) / 10,
      fats: Math.round(t.fats * 10) / 10,
      fiber: Math.round(t.fiber * 10) / 10,
      water: Math.round(t.water * 10) / 10,
    });
  }, [logs]);

  const getDisplayItems = () => {
    const hydrate = (keys) =>
      keys.map((key) => {
        const item =
          COMBINED_DB[key.toLowerCase()] ||
          COMBINED_DB[
            Object.keys(COMBINED_DB).find((k) => k.includes(key.toLowerCase()))
          ];
        return item ? { name: key, ...item } : { name: key };
      });

    if (query) {
      const keys = Object.keys(COMBINED_DB).filter((k) =>
        k.includes(query.toLowerCase()),
      );
      const results = hydrate(keys);

      if (results.length === 0) {
        if (isWebSearching) {
          return [{ id: "loading", name: "Searching Web...", isWeb: true }];
        }
        if (webResults.length > 0) {
          return webResults;
        }
        return [
          {
            id: "no-res",
            name: "No results. Try standardizing name.",
            isWeb: true,
          },
        ];
      }
      return results;
    }

    if (activeCategory === "Smart") {
      return smartRecommendations.length > 0
        ? smartRecommendations
        : [
            {
              id: "smart-empty",
              name: "Goal Met! Have some water.",
              type: "meal",
              items: [],
              isSmart: true,
            },
          ];
    }

    if (activeCategory === "Recent") {
      return hydrate(recents);
    }

    if (activeCategory === "Meals") {
      return savedMeals;
    }

    const catKeys = Object.keys(FOOD_CATEGORIES[activeCategory] || {});
    return hydrate(catKeys);
  };

  const getBuilderSuggestions = () =>
    mealBuilderQuery
      ? Object.keys(COMBINED_DB).filter((k) =>
          k.includes(mealBuilderQuery.toLowerCase()),
        )
      : recents;

  const handleSendCode = async (e) => {
    e.preventDefault();
    const result = await sendOtp(email);
    if (!result.ok) alert(result.error);
    else setIsCodeSent(true);
  };
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    const result = await verifyOtp(email, otp);
    if (!result.ok) alert("Invalid code.");
    else setShowPasswordSetup(true);
  };
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    const result = await signInWithPassword(email, password);
    if (!result.ok) alert(result.error);
  };

  if (!session)
    return (
      <div style={{ minHeight: "100vh", background: "#08080a", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
        <style>{`
          @keyframes floatUp { 0% { opacity: 0; transform: translateY(24px); } 100% { opacity: 1; transform: translateY(0); } }
          @keyframes glow { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
          .auth-input { width: 100%; padding: 14px 16px; border-radius: 12px; border: 1px solid #27272a; background: #111113; color: #fff; font-size: 1rem; outline: none; box-sizing: border-box; transition: border-color 0.2s; }
          .auth-input:focus { border-color: #3b82f6; }
          .auth-input::placeholder { color: #444; }
          .auth-btn-primary { width: 100%; padding: 15px; border-radius: 12px; border: none; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; font-size: 1rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s; }
          .auth-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
          .auth-btn-primary:not(:disabled):hover { opacity: 0.9; }
        `}</style>

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px 32px", textAlign: "center" }}>

          {/* Logo mark */}
          <div style={{ animation: "floatUp 0.6s ease both", marginBottom: 24 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 22,
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow: "0 0 40px rgba(59,130,246,0.3)",
            }}>
              <Flame size={34} color="#fff" fill="#fff" />
            </div>
            <h1 style={{ fontSize: "2.6rem", fontWeight: 900, margin: "0 0 8px", letterSpacing: "-1px", background: "linear-gradient(135deg, #fff 40%, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              NutriTrack
            </h1>
            <p style={{ color: "#555", fontSize: "1rem", margin: 0, fontWeight: 500 }}>
              AI-powered nutrition intelligence
            </p>
          </div>

          {/* Feature pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 40, animation: "floatUp 0.6s ease 0.1s both" }}>
            {[
              { icon: "🤖", label: "AI Coach" },
              { icon: "📊", label: "Trend Analytics" },
              { icon: "🎯", label: "Smart Goals" },
              { icon: "🔥", label: "Streak Tracking" },
            ].map((f) => (
              <div key={f.label} style={{
                background: "#111113", border: "1px solid #27272a",
                borderRadius: 20, padding: "6px 14px",
                fontSize: "0.78rem", color: "#888", fontWeight: 600,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {f.icon} {f.label}
              </div>
            ))}
          </div>

          {/* ── AUTH CARD ─────────────────────────────────────────── */}
          <div style={{
            width: "100%", maxWidth: 380,
            background: "#111113",
            border: "1px solid #1e1e22",
            borderRadius: 24,
            padding: 28,
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            animation: "floatUp 0.6s ease 0.2s both",
          }}>
            {/* Tab switcher */}
            <div style={{ display: "flex", background: "#0a0a0c", borderRadius: 12, padding: 4, marginBottom: 24 }}>
              {[
                { id: false, label: "✉️ Email OTP" },
                { id: true,  label: "🔑 Password" },
              ].map((t) => (
                <button
                  key={String(t.id)}
                  onClick={() => setUsePasswordLogin(t.id)}
                  style={{
                    flex: 1, padding: "9px 0", border: "none", borderRadius: 9,
                    background: usePasswordLogin === t.id ? "#1f1f24" : "transparent",
                    color: usePasswordLogin === t.id ? "#fff" : "#555",
                    fontWeight: usePasswordLogin === t.id ? 700 : 500,
                    fontSize: "0.82rem", cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: usePasswordLogin === t.id ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {usePasswordLogin ? (
              <form onSubmit={handlePasswordLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input className="auth-input" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input className="auth-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button className="auth-btn-primary" disabled={authLoading} style={{ marginTop: 4 }}>
                  {authLoading ? <Loader2 size={18} className="animate-spin" style={{ margin: "0 auto", display: "block" }} /> : "Sign In →"}
                </button>
              </form>
            ) : !isCodeSent ? (
              <form onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: "0.82rem", color: "#555", marginBottom: 4 }}>
                  Enter your email and we&apos;ll send a one-time code — no password needed.
                </div>
                <input className="auth-input" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <button className="auth-btn-primary" disabled={authLoading} style={{ marginTop: 4 }}>
                  {authLoading ? <Loader2 size={18} className="animate-spin" style={{ margin: "0 auto", display: "block" }} /> : "Send Code →"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ textAlign: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: "0.82rem", color: "#555" }}>Code sent to</div>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9rem" }}>{email}</div>
                </div>
                <input
                  className="auth-input"
                  type="text" placeholder="· · · · · · · ·"
                  value={otp} onChange={(e) => setOtp(e.target.value)}
                  required maxLength={10}
                  style={{ letterSpacing: 6, textAlign: "center", fontSize: "1.4rem", padding: "14px 16px" }}
                />
                <button className="auth-btn-primary" disabled={authLoading}>
                  {authLoading ? <Loader2 size={18} className="animate-spin" style={{ margin: "0 auto", display: "block" }} /> : "Verify & Enter →"}
                </button>
                <button type="button" onClick={() => setIsCodeSent(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "0.8rem" }}>
                  ← Use a different email
                </button>
              </form>
            )}
          </div>

          {/* Footer note */}
          <p style={{ color: "#333", fontSize: "0.72rem", marginTop: 24, animation: "floatUp 0.6s ease 0.3s both" }}>
            Science-backed · Mifflin-St Jeor · ISSN Protein Standards
          </p>
        </div>
      </div>
    );

  return (
    <div
      className="app-wrapper"
      style={{
        minHeight: "100vh",
        paddingBottom: 100,
        width: "100%",
        overflowX: "hidden",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* MANUAL ENTRY MODAL */}
      {isManualEntryOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div
            className="modal-content"
            style={{ maxWidth: 350, width: "90%", textAlign: "left" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <PlusCircle size={20} color="#3b82f6" /> Add Custom Food
              </h3>
              <button
                onClick={() => setIsManualEntryOpen(false)}
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

            <form onSubmit={handleManualAddSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    fontSize: "0.8rem",
                    color: "#888",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Food Name *
                </label>
                <input
                  required
                  placeholder="e.g. Grandma's Pasta"
                  value={manualFood.name}
                  onChange={(e) =>
                    setManualFood({ ...manualFood, name: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: 10,
                    background: "#000",
                    border: "1px solid #333",
                    color: "#fff",
                    borderRadius: 8,
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: "0.8rem",
                      color: "#888",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Calories *
                  </label>
                  <input
                    required
                    type="number"
                    placeholder="kcal"
                    value={manualFood.calories}
                    onChange={(e) =>
                      setManualFood({ ...manualFood, calories: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: 10,
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
                      fontSize: "0.8rem",
                      color: "#888",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Protein (g)
                  </label>
                  <input
                    type="number"
                    placeholder="g"
                    value={manualFood.protein}
                    onChange={(e) =>
                      setManualFood({ ...manualFood, protein: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: 10,
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
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: "0.8rem",
                      color: "#888",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Carbs (g)
                  </label>
                  <input
                    type="number"
                    placeholder="g"
                    value={manualFood.carbs}
                    onChange={(e) =>
                      setManualFood({ ...manualFood, carbs: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: 10,
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
                      fontSize: "0.8rem",
                      color: "#888",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Fats (g)
                  </label>
                  <input
                    type="number"
                    placeholder="g"
                    value={manualFood.fats}
                    onChange={(e) =>
                      setManualFood({ ...manualFood, fats: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: 10,
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
                      fontSize: "0.8rem",
                      color: "#888",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Fiber (g)
                  </label>
                  <input
                    type="number"
                    placeholder="g"
                    value={manualFood.fiber}
                    onChange={(e) =>
                      setManualFood({ ...manualFood, fiber: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: 10,
                      background: "#000",
                      border: "1px solid #333",
                      color: "#fff",
                      borderRadius: 8,
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: 12,
                  background: "var(--brand)",
                  border: "none",
                  color: "#fff",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save & Log
              </button>
            </form>
          </div>
        </div>
      )}

      {/* WELCOME MODAL */}
      {showWelcome && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: 350,
              width: "90%",
              textAlign: "center",
              border: "1px solid #333",
              background: "#18181b",
              padding: 30,
            }}
          >
            {welcomeStep === 1 && (
              <div className="animate-fadeIn">
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.1)",
                    padding: 20,
                    borderRadius: "50%",
                    width: 80,
                    height: 80,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                  }}
                >
                  <Battery size={40} color="#f59e0b" />
                </div>
                <h2 style={{ margin: "0 0 10px 0", fontSize: "1.6rem" }}>
                  Food is Fuel ⛽️
                </h2>
                <p style={{ color: "#aaa", lineHeight: 1.6, marginBottom: 30 }}>
                  Think of your body as a high-performance engine. Calories are
                  just the energy unit to keep it running.
                </p>
                <button
                  onClick={() => setWelcomeStep(2)}
                  style={{
                    width: "100%",
                    padding: 14,
                    background: "var(--brand)",
                    border: "none",
                    color: "#fff",
                    borderRadius: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            )}
            {welcomeStep === 2 && (
              <div className="animate-fadeIn">
                <div
                  style={{
                    background: "rgba(59, 130, 246, 0.1)",
                    padding: 20,
                    borderRadius: "50%",
                    width: 80,
                    height: 80,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                  }}
                >
                  <Zap size={40} color="#3b82f6" />
                </div>
                <h2 style={{ margin: "0 0 10px 0", fontSize: "1.6rem" }}>
                  Your Daily Budget 💳
                </h2>
                <p style={{ color: "#aaa", lineHeight: 1.6, marginBottom: 30 }}>
                  We gave you a specific <b>Calorie Target</b>. Spend it wisely
                  on Protein, Carbs, and Fats to win the day!
                </p>
                <button
                  onClick={() => setWelcomeStep(3)}
                  style={{
                    width: "100%",
                    padding: 14,
                    background: "var(--brand)",
                    border: "none",
                    color: "#fff",
                    borderRadius: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            )}
            {welcomeStep === 3 && (
              <div className="animate-fadeIn">
                <div
                  style={{
                    background: "rgba(34, 197, 94, 0.1)",
                    padding: 20,
                    borderRadius: "50%",
                    width: 80,
                    height: 80,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                  }}
                >
                  <Award size={40} color="#22c55e" />
                </div>
                <h2 style={{ margin: "0 0 10px 0", fontSize: "1.6rem" }}>
                  Your Mission 🎯
                </h2>
                <p style={{ color: "#aaa", lineHeight: 1.6, marginBottom: 30 }}>
                  Consistency is the only cheat code. Hit your numbers, log
                  everyday, and watch your body change.
                </p>
                <button
                  onClick={closeWelcome}
                  style={{
                    width: "100%",
                    padding: 14,
                    background: "#22c55e",
                    border: "none",
                    color: "#000",
                    borderRadius: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Let&apos;s Go!
                </button>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 8,
                marginTop: 20,
              }}
            >
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: s === welcomeStep ? "#fff" : "#333",
                    transition: "0.3s",
                  }}
                ></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD & USERNAME MODAL */}
      {showPasswordSetup && (
        <div className="modal-overlay">
          <div
            className="modal-content"
            style={{ maxWidth: 400, width: "90%", textAlign: "center" }}
          >
            <KeyRound size={40} color="#3b82f6" style={{ marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px 0" }}>Account Setup</h3>
            <p style={{ color: "#888", marginBottom: 20, fontSize: "0.9rem" }}>
              Set a username and password to secure your account.
            </p>

            <input
              type="text"
              placeholder="Username (e.g. GymRat99)"
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
              placeholder="New Password"
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
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowPasswordSetup(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  background: "transparent",
                  border: "1px solid #333",
                  borderRadius: 8,
                  color: "#888",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePassword}
                style={{
                  flex: 1,
                  padding: 12,
                  background: "var(--brand)",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT LOG MODAL (NEW) */}
      {isEditingLog && currentLogToEdit && (
        <div className="modal-overlay" style={{ alignItems: "center" }}>
          <div
            className="modal-content"
            style={{ maxWidth: 320, width: "88%", textAlign: "center", borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div style={{ fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Modify Quantity</div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "1rem", color: "#fff", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentLogToEdit.name}
            </h3>
            <div style={{ color: "#555", fontSize: "0.8rem", marginBottom: 24 }}>
              {currentLogToEdit.calories} kcal per serving
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 24,
                marginBottom: 28,
              }}
            >
              <button
                className="qty-btn"
                onClick={() => setEditQty(Math.max(0.5, editQty - 0.5))}
                style={{ width: 44, height: 44, borderRadius: 12, background: "#1a1a1f", border: "1px solid #2a2a30", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <Minus size={18} />
              </button>
              <div>
                <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "#fff", lineHeight: 1 }}>{editQty}</div>
                <div style={{ fontSize: "0.7rem", color: "#555", marginTop: 2 }}>
                  = {Math.round(currentLogToEdit.calories * editQty)} kcal
                </div>
              </div>
              <button
                className="qty-btn"
                onClick={() => setEditQty(editQty + 0.5)}
                style={{ width: 44, height: 44, borderRadius: 12, background: "#1a1a1f", border: "1px solid #2a2a30", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <Plus size={18} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setIsEditingLog(false)}
                style={{
                  flex: 1, padding: 13,
                  background: "transparent",
                  border: "1px solid #2a2a30",
                  borderRadius: 12, color: "#666",
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveLogEdit}
                style={{
                  flex: 1, padding: 13,
                  background: "var(--brand)",
                  border: "none",
                  borderRadius: 12, color: "#fff",
                  fontWeight: 700, cursor: "pointer",
                }}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingGoal && (
        <div
          className="modal-overlay"
          style={{ alignItems: "flex-end", paddingBottom: 62 }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsSettingGoal(false); }}
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
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#333" }} />
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
                  background: settingsTab === "profile" ? "#333" : "transparent",
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
                  background: settingsTab === "security" ? "#333" : "transparent",
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
            <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px 32px" }}>
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
                <div style={{ opacity: userProfile.target_calories ? 0.5 : 1 }}>
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
                              color: userProfile.gender === g ? "#fff" : "#666",
                              textTransform: "capitalize",
                              fontSize: "0.85rem",
                              cursor: "pointer",
                              fontWeight: userProfile.gender === g ? 600 : 400,
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
                      <option value="sedentary">Sedentary (Office Job)</option>
                      <option value="light">Light Exercise (1-3 days)</option>
                      <option value="moderate">Moderate Exercise (3-5 days)</option>
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
                            background: userProfile.goal === g.id ? g.color + "22" : "#000",
                            border: userProfile.goal === g.id ? `2px solid ${g.color}` : "1px solid #333",
                            borderRadius: 10,
                            color: userProfile.goal === g.id ? g.color : "#aaa",
                            textAlign: "left",
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{g.label}</div>
                          <div style={{ fontSize: "0.68rem", opacity: 0.75, marginTop: 2 }}>{g.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Fine-tune dials ─────────────────────────────────── */}
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "#888", marginBottom: 4, display: "block" }}>
                      Calorie Adjustment from TDEE
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="range"
                        min="-700" max="500" step="50"
                        value={userProfile.calorie_adjustment ?? 0}
                        onChange={(e) =>
                          setUserProfile({ ...userProfile, calorie_adjustment: Number(e.target.value), goal: "custom" })
                        }
                        style={{ flex: 1, accentColor: "var(--brand)" }}
                      />
                      <span style={{
                        minWidth: 56, textAlign: "right", fontWeight: 700, fontSize: "0.82rem",
                        color: (userProfile.calorie_adjustment ?? 0) < 0 ? "#ef4444" : (userProfile.calorie_adjustment ?? 0) > 0 ? "#3b82f6" : "#22c55e",
                      }}>
                        {(userProfile.calorie_adjustment ?? 0) > 0 ? "+" : ""}{userProfile.calorie_adjustment ?? 0} kcal
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "#555", marginTop: 2 }}>
                      <span>Aggressive cut</span><span>TDEE</span><span>Bulk</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.75rem", color: "#888", marginBottom: 6, display: "block" }}>
                      Protein Priority
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                      {[
                        { id: "preserve", label: "Preserve", sub: "2.0g/kg", tip: "Deep deficit — protect muscle" },
                        { id: "balanced", label: "Balanced", sub: "1.8g/kg", tip: "Standard for most goals" },
                        { id: "maximize", label: "Maximize", sub: "2.4g/kg", tip: "Recomp / aggressive build" },
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() =>
                            setUserProfile({ ...userProfile, protein_priority: p.id, goal: userProfile.goal === "custom" ? "custom" : userProfile.goal })
                          }
                          title={p.tip}
                          style={{
                            padding: "8px 6px",
                            background: userProfile.protein_priority === p.id ? "#6366f122" : "#000",
                            border: userProfile.protein_priority === p.id ? "2px solid #6366f1" : "1px solid #333",
                            borderRadius: 8,
                            color: userProfile.protein_priority === p.id ? "#6366f1" : "#aaa",
                            cursor: "pointer", textAlign: "center",
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: "0.78rem" }}>{p.label}</div>
                          <div style={{ fontSize: "0.65rem", opacity: 0.7, marginTop: 1 }}>{p.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Live target preview ─────────────────────────────── */}
                  {(() => {
                    const preview = calculateTargets(userProfile);
                    return (
                      <div style={{
                        background: "#0a0a0a", border: "1px solid #27272a",
                        borderRadius: 10, padding: "10px 14px",
                      }}>
                        <div style={{ fontSize: "0.7rem", color: "#52525b", marginBottom: 6, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          Target Preview
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, textAlign: "center" }}>
                          {[
                            { label: "Cals",    val: preview.cals,  unit: "",   color: "#f59e0b" },
                            { label: "Protein", val: preview.p,     unit: "g",  color: "#6366f1" },
                            { label: "Carbs",   val: preview.c,     unit: "g",  color: "#22c55e" },
                            { label: "Fat",     val: preview.f,     unit: "g",  color: "#f97316" },
                            { label: "Fiber",   val: preview.fib,   unit: "g",  color: "#8b5cf6" },
                          ].map((m) => (
                            <div key={m.label}>
                              <div style={{ fontWeight: 800, fontSize: "0.88rem", color: m.color }}>
                                {m.val}{m.unit}
                              </div>
                              <div style={{ fontSize: "0.6rem", color: "#52525b", marginTop: 1 }}>{m.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>
            )}
            </div>{/* end scrollable body */}

            {/* ── Pinned save button ───────────────────────────────── */}
            {settingsTab === "profile" && (
              <div style={{ padding: "12px 16px", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))", flexShrink: 0, borderTop: "1px solid var(--border)" }}>
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
          </div>{/* end bottom sheet */}
        </div>
      )}

      {/* MEAL BUILDER */}
      {isCreatingMeal && (
        <div className="modal-overlay">
          <div
            className="modal-content"
            style={{ maxWidth: 400, width: "90%" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0 }}>
                {editingMealId ? "Edit Meal" : "Build a Meal"}
              </h3>
              <button
                onClick={() => setIsCreatingMeal(false)}
                style={{ background: "none", border: "none", color: "#666" }}
              >
                <X size={20} />
              </button>
            </div>
            <input
              autoFocus
              placeholder="Meal Name"
              value={newMealName}
              onChange={(e) => setNewMealName(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 16,
                background: "#000",
                border: "1px solid #333",
                color: "#fff",
                borderRadius: 8,
              }}
            />
            <div
              style={{
                background: "#000",
                borderRadius: 8,
                border: "1px solid #333",
                padding: 10,
                marginBottom: 16,
                minHeight: 100,
                maxHeight: 150,
                overflowY: "auto",
              }}
            >
              {mealBuilderItems.length === 0 ? (
                <div
                  style={{
                    color: "#666",
                    textAlign: "center",
                    marginTop: 30,
                  }}
                >
                  Add items below
                </div>
              ) : (
                mealBuilderItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 0",
                      borderBottom: "1px solid #222",
                    }}
                  >
                    <span>
                      {item.qty}x {item.name}
                    </span>
                    <button
                      onClick={() => removeItemFromBuilder(idx)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#000",
                  border: "1px solid #333",
                  borderRadius: 8,
                  padding: "0 10px",
                }}
              >
                <Search size={14} color="#666" />
                <input
                  placeholder="Search food..."
                  value={mealBuilderQuery}
                  onChange={(e) => setMealBuilderQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    color: "#fff",
                    padding: 10,
                    outline: "none",
                  }}
                />
              </div>
              {mealBuilderQuery && (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    maxHeight: 100,
                    overflowY: "auto",
                  }}
                >
                  {getBuilderSuggestions().map((item) => (
                    <button
                      key={item}
                      onClick={() => addItemToBuilder(item)}
                      style={{
                        background: "#27272a",
                        border: "1px solid #333",
                        color: "#ddd",
                        padding: "4px 10px",
                        borderRadius: 20,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={saveBuiltMeal}
              style={{
                width: "100%",
                padding: 12,
                background: "var(--brand)",
                border: "none",
                color: "#fff",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Save size={16} style={{ display: "inline", marginRight: 6 }} />{" "}
              Save Meal
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header
        className="header-row"
        style={{
          padding: "14px 20px 12px",
          borderBottom: "1px solid #1a1a1e",
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(8,8,10,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxSizing: "border-box",
        }}
      >
        {/* Left: branding + greeting */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Flame size={20} color="#fff" fill="#fff" />
          </div>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
              {username ? `Hey, ${username} 👋` : "NutriTrack"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              <div className="date-badge" style={{ fontSize: "0.7rem" }}>Today</div>
              {streak > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  borderRadius: 10, padding: "1px 8px",
                  fontSize: "0.72rem", color: "#f59e0b", fontWeight: 700,
                }}>
                  <Flame size={11} fill="#f59e0b" color="#f59e0b" /> {streak}d
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => { setIsSettingGoal(true); setSettingsTab("profile"); }}
            style={{
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.25)",
              color: "#3b82f6",
              cursor: "pointer",
              padding: "8px 14px",
              borderRadius: 12,
              display: "flex", alignItems: "center", gap: 6,
              fontSize: "0.8rem", fontWeight: 700,
            }}
          >
            <Target size={15} /> Goal
          </button>
          <button
            onClick={() => { setIsSettingGoal(true); setSettingsTab("security"); }}
            style={{
              background: "#111113",
              border: "1px solid #27272a",
              color: "#666",
              cursor: "pointer",
              padding: 9,
              borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      <StatsBoard
        totals={totals}
        onAddWater={() => addFood("Water")}
        userProfile={userProfile}
      />

      {/* === WEIGHT TRACKER CARD === */}
      <section style={{ padding: "12px 20px 0" }}>
        <div style={{
          background: "#111116",
          borderRadius: 18,
          padding: "16px 18px",
          border: "1px solid #1e1e26",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}>
          <div style={{
            background: "rgba(236,72,153,0.12)",
            border: "1px solid rgba(236,72,153,0.2)",
            padding: 10, borderRadius: 12, flexShrink: 0,
          }}>
            <Scale size={20} color="#ec4899" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff" }}>Today&apos;s Weight</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ec4899" }}>
                {userProfile.weight || "--"} <span style={{ fontSize: "0.75rem", color: "#555", fontWeight: 600 }}>kg</span>
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number" step="0.1"
                placeholder="Log weight..."
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 10,
                  background: "#0a0a0c", border: "1px solid #27272a",
                  color: "#fff", outline: "none", fontSize: "0.9rem",
                }}
              />
              <button
                onClick={handleLogWeight}
                disabled={isLoggingWeight || !weightInput}
                style={{
                  padding: "8px 16px",
                  background: weightInput ? "linear-gradient(135deg, #ec4899, #8b5cf6)" : "#1e1e26",
                  color: weightInput ? "#fff" : "#444",
                  border: "none", borderRadius: 10,
                  fontWeight: 700, cursor: weightInput ? "pointer" : "not-allowed",
                  fontSize: "0.85rem", transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {isLoggingWeight ? <Loader2 size={14} className="animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="command-center">
        {/* Section label */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={14} color="#555" />
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 1.2 }}>
              Log Food
            </span>
          </div>
          {/* Qty quick-presets */}
          <div style={{ display: "flex", gap: 4 }}>
            {[0.5, 1, 2, 3].map((v) => (
              <button
                key={v}
                onClick={() => setQty(v)}
                style={{
                  padding: "3px 9px", borderRadius: 8, border: "none",
                  background: qty === v ? "#3b82f6" : "#1e1e26",
                  color: qty === v ? "#fff" : "#555",
                  fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >{v}×</button>
            ))}
          </div>
        </div>

        {/* Search row — qty stepper + input + custom */}
        <div className="input-row" style={{ display: "flex", gap: 8 }}>
          <div className="qty-wrapper" style={{ flexShrink: 0 }}>
            <button className="qty-btn" onClick={() => setQty(Math.max(0.5, qty - 0.5))}>
              <Minus size={14} />
            </button>
            <div className="qty-val">{qty}</div>
            <button className="qty-btn" onClick={() => setQty(qty + 0.5)}>
              <Plus size={14} />
            </button>
          </div>
          <div className="search-container" style={{ flex: 1 }}>
            <Search className="search-icon" size={16} />
            <input
              className="search-input"
              placeholder="Search food…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query.length > 0 && (
              <button
                onClick={() => setQuery("")}
                style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: "0 8px", display: "flex", alignItems: "center" }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => { setManualFood({ ...manualFood, name: query }); setIsManualEntryOpen(true); }}
            style={{
              background: "#111116", border: "1px solid #27272a", color: "#3b82f6",
              borderRadius: 12, padding: "0 12px",
              display: "flex", alignItems: "center", gap: 5,
              cursor: "pointer", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0,
            }}
          >
            <PlusCircle size={15} /> Custom
          </button>
        </div>

        <div className="suggestions-box">
          {/* ── Category tabs with emoji icons ───────────────────── */}
          {!query && (
            <div className="category-scroll-row" style={{ gap: 6 }}>
              {/* Smart Recs */}
              {[
                {
                  id: "Smart", label: "Smart Recs", icon: "✨",
                  color: "#8b5cf6", activeBg: "rgba(139,92,246,0.2)", activeBorder: "#8b5cf6",
                  onClick: () => { setActiveCategory("Smart"); if (!aiMealPlan && !aiMealPlanLoading) fetchAiMealPlan(); },
                },
                { id: "Recent", label: "Recent", icon: "🕐", color: "#fff" },
                { id: "Meals",  label: "Meals",  icon: "🍱", color: "#fff" },
              ].map(({ id, label, icon, color, activeBg, activeBorder, onClick }) => {
                const isActive = activeCategory === id;
                return (
                  <button
                    key={id}
                    className={`suggestion-chip ${isActive ? "active" : ""}`}
                    onClick={onClick || (() => setActiveCategory(id))}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      border: isActive ? `1px solid ${activeBorder || "#3b82f6"}` : "1px solid #1e1e26",
                      background: isActive ? (activeBg || "rgba(59,130,246,0.15)") : "#111116",
                      color: isActive ? color : "#555",
                      fontWeight: isActive ? 700 : 500,
                      fontSize: "0.8rem", padding: "6px 12px", borderRadius: 20,
                      transition: "all 0.15s", flexShrink: 0,
                    }}
                  >
                    <span>{icon}</span> {label}
                  </button>
                );
              })}
              {/* Dynamic food category tabs */}
              {Object.keys(FOOD_CATEGORIES).map((cat) => {
                const isActive = activeCategory === cat;
                const icon = CATEGORY_ICONS[cat] || "🍽️";
                return (
                  <button
                    key={cat}
                    className={`suggestion-chip ${isActive ? "active" : ""}`}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      border: isActive ? "1px solid #3b82f6" : "1px solid #1e1e26",
                      background: isActive ? "rgba(59,130,246,0.12)" : "#111116",
                      color: isActive ? "#fff" : "#555",
                      fontWeight: isActive ? 700 : 500,
                      fontSize: "0.8rem", padding: "6px 12px", borderRadius: 20,
                      transition: "all 0.15s", flexShrink: 0,
                    }}
                  >
                    <span>{icon}</span> {cat}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Food grid ─────────────────────────────────────────── */}
          <div
            className="food-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                query || activeCategory === "Meals" || activeCategory === "Smart"
                  ? "1fr"
                  : "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            {activeCategory === "Smart" && !query ? (
              <div style={{ padding: "4px 0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "#8b5cf6", fontWeight: 700 }}>
                    <Sparkles size={13} color="#8b5cf6" />
                    NutriCoach · AI Meal Plan
                  </div>
                  <button
                    onClick={() => { setAiMealPlan(null); fetchAiMealPlan(); }}
                    disabled={aiMealPlanLoading}
                    style={{
                      background: "transparent", border: "1px solid #27272a", color: "#666",
                      cursor: aiMealPlanLoading ? "wait" : "pointer",
                      padding: "3px 10px", borderRadius: 8, fontSize: "0.72rem",
                      display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    {aiMealPlanLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    {aiMealPlanLoading ? "Thinking…" : "Regenerate"}
                  </button>
                </div>

                {aiMealPlanLoading && !aiMealPlan && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0", color: "#666", fontSize: "0.85rem" }}>
                    <Loader2 size={16} className="animate-spin" color="#8b5cf6" />
                    <span>Agent is building your personalized meal plan…</span>
                  </div>
                )}

                {aiMealPlan && (() => {
                  const planText = aiMealPlan.text.toLowerCase();
                  const matched = Object.keys(COMBINED_DB)
                    .filter((k) => planText.includes(k))
                    .sort((a, b) => b.length - a.length)
                    .slice(0, 8);
                  return (
                    <>
                      <div style={{
                        background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.25)",
                        borderRadius: 12, padding: "14px 16px",
                        fontSize: "0.88rem", color: "#ddd", lineHeight: 1.7,
                        whiteSpace: "pre-wrap", marginBottom: matched.length > 0 ? 12 : 0,
                      }}>
                        {aiMealPlan.text}
                      </div>
                      {matched.length > 0 && (
                        <div>
                          <div style={{ fontSize: "0.72rem", color: "#666", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                            <Sparkles size={11} color="#8b5cf6" /> Found in your DB — tap to log:
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {matched.map((key) => {
                              const item = COMBINED_DB[key];
                              return (
                                <button
                                  key={key}
                                  onClick={() => addFood(key)}
                                  className="suggestion-chip"
                                  style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    width: "100%", border: "1px solid rgba(139,92,246,0.4)",
                                    background: "rgba(139,92,246,0.08)", padding: "10px 14px",
                                    borderRadius: 10, cursor: "pointer", textAlign: "left",
                                    height: "auto", whiteSpace: "normal",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <Sparkles size={11} color="#8b5cf6" />
                                    <span style={{ fontWeight: 600, color: "#fff", fontSize: "0.85rem", textTransform: "capitalize" }}>
                                      {key}
                                    </span>
                                  </div>
                                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <div style={{ display: "flex", gap: 6, fontSize: "0.7rem" }}>
                                      <span style={{ color: "#a78bfa" }}>{item.calories} kcal</span>
                                      <span style={{ color: "#3b82f6" }}>P:{item.protein}g</span>
                                    </div>
                                    <div style={{ background: "#8b5cf6", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: "0.7rem", fontWeight: 700 }}>
                                      + Log
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {matched.length === 0 && (
                        <div style={{ fontSize: "0.75rem", color: "#555", marginTop: 6 }}>
                          💡 None of the suggested foods are in your DB yet. Search for them above or add via Custom.
                        </div>
                      )}
                    </>
                  );
                })()}

                {!aiMealPlanLoading && !aiMealPlan && (
                  <div style={{ color: "#555", fontSize: "0.85rem", padding: "10px 0" }}>
                    Tap <strong style={{ color: "#8b5cf6" }}>Smart Recs</strong> to generate your AI meal plan.
                  </div>
                )}
              </div>

            ) : activeCategory === "Meals" && !query ? (
              <>
                <button
                  className="suggestion-chip"
                  style={{ border: "1px dashed #333", color: "#aaa", textAlign: "center" }}
                  onClick={() => openMealBuilder()}
                >
                  <Plus size={14} style={{ display: "inline", marginRight: 4 }} /> Build Meal
                </button>
                {savedMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className="suggestion-chip"
                    style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingRight: 6, whiteSpace: "normal", height: "auto", minHeight: 44, textAlign: "left" }}
                  >
                    <span onClick={() => loadMeal(meal)} style={{ flex: 1 }}>{meal.name}</span>
                    <div style={{ display: "flex", gap: 8, color: "#666", borderLeft: "1px solid #333", paddingLeft: 8, cursor: "pointer" }}>
                      <span onClick={() => openMealBuilder(meal)} style={{ cursor: "pointer" }}><Pencil size={12} /></span>
                      <span onClick={() => deleteMeal(meal.id)} style={{ cursor: "pointer" }}><Trash2 size={12} /></span>
                    </div>
                  </div>
                ))}
              </>

            ) : (
              /* ── Regular food chips — now with calorie badge ───── */
              getDisplayItems().map((item) => {
                const foodName = typeof item === "string" ? item : item.name;
                const cals = typeof item === "object" && item.calories !== undefined ? item.calories : null;
                const p    = typeof item === "object" && item.protein  !== undefined ? item.protein  : null;
                const c    = typeof item === "object" && item.carbs    !== undefined ? item.carbs    : null;
                const f    = typeof item === "object" && item.fats     !== undefined ? item.fats     : null;
                const fib  = typeof item === "object" && item.fiber    !== undefined ? item.fiber    : null;

                const isMeal  = activeCategory === "Meals" && !query;
                const isSmart = item.isSmart === true;
                const isWeb   = item.isWeb   === true;
                const isNoRes = item.id === "no-res";
                const displayLabel = isMeal || isSmart ? item.name : foodName;
                const isListView = !!query || isMeal || isSmart || isWeb;

                return (
                  <button
                    key={item.id || displayLabel}
                    className="suggestion-chip"
                    onClick={() => {
                      if (isNoRes) { setIsManualEntryOpen(true); return; }
                      if (isMeal) loadMeal(item);
                      else if (isSmart) loadMeal(item);
                      else if (isWeb) {
                        const webItemData = { name: displayLabel, calories: item.calories, protein: item.protein, carbs: item.carbs, fats: item.fats, fiber: item.fiber };
                        saveCustomFoodToDb(webItemData);
                        addFood(displayLabel, null, webItemData);
                      } else addFood(displayLabel);
                    }}
                    style={{
                      whiteSpace: "normal",
                      height: "auto",
                      minHeight: isListView ? 52 : 56,
                      wordBreak: "break-word",
                      textAlign: isListView ? "left" : "center",
                      padding: isListView ? "10px 14px" : "10px 6px",
                      display: "flex",
                      flexDirection: isListView ? "row" : "column",
                      alignItems: "center",
                      justifyContent: isListView ? "space-between" : "center",
                      gap: 8,
                      border: isSmart ? "1px solid #8b5cf6" : isWeb ? "1px dashed #3b82f6" : "1px solid #1e1e26",
                      background: isSmart ? "rgba(139,92,246,0.1)" : "#111116",
                      borderRadius: 12,
                      transition: "border-color 0.15s",
                    }}
                  >
                    {/* Left: name + macro row */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 5, textTransform: "capitalize" }}>
                        {isSmart && <Sparkles size={11} color="#8b5cf6" />}
                        {isWeb && !isNoRes && <Globe size={11} color="#3b82f6" />}
                        {displayLabel.charAt(0).toUpperCase() + displayLabel.slice(1)}
                      </span>
                      {p !== null && !isMeal && !isNoRes && (
                        <div style={{ fontSize: "0.62rem", marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ color: "#3b82f6" }}>P:{p}g</span>
                          <span style={{ color: "#f59e0b" }}>C:{c}g</span>
                          <span style={{ color: "#ef4444" }}>F:{f}g</span>
                          <span style={{ color: "#22c55e" }}>Fib:{fib}g</span>
                        </div>
                      )}
                      {isWeb && !isNoRes && (
                        <span style={{ fontSize: "0.6rem", color: "#555", marginTop: 2, display: "block" }}>
                          Web estimate · will be saved
                        </span>
                      )}
                    </div>

                    {/* Right: calorie badge */}
                    {cals !== null && !isNoRes && !isMeal && (
                      <div style={{
                        background: "rgba(255,255,255,0.05)", border: "1px solid #27272a",
                        borderRadius: 8, padding: "3px 8px", flexShrink: 0,
                        fontSize: "0.72rem", fontWeight: 700, color: "#aaa",
                        whiteSpace: "nowrap",
                      }}>
                        {cals} kcal
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="timeline" style={{ padding: "0 20px 100px" }}>

        {/* Section header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12, marginTop: 4,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Utensils size={15} color="#555" />
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 1.2 }}>
              Today&apos;s Log
            </span>
            {logs.length > 0 && (
              <span style={{
                background: "#1e1e26", border: "1px solid #27272a",
                color: "#666", fontSize: "0.65rem", fontWeight: 700,
                padding: "1px 7px", borderRadius: 8,
              }}>{logs.length}</span>
            )}
          </div>
          {hasUnsavedChanges && (
            <span style={{
              background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
              color: "#f59e0b", fontSize: "0.7rem", fontWeight: 700,
              padding: "2px 10px", borderRadius: 10,
            }}>
              Unsaved
            </span>
          )}
        </div>

        {/* Calorie budget bar */}
        {logs.length > 0 && (() => {
          const calTarget = calculateTargets(userProfile).cals || 2000;
          const barPct = Math.min(100, Math.round((totals.calories / calTarget) * 100));
          const isOver = totals.calories > calTarget;
          const barColor = isOver
            ? "linear-gradient(90deg,#ef4444,#f97316)"
            : barPct > 85
              ? "linear-gradient(90deg,#f59e0b,#eab308)"
              : "linear-gradient(90deg,#3b82f6,#22c55e)";
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ height: 5, borderRadius: 99, background: "#1e1e26", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 99,
                  width: `${barPct}%`,
                  background: barColor,
                  transition: "width 0.4s ease",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: "0.65rem", color: "#444" }}>
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
          <div style={{ textAlign: "center", color: "#444", padding: 40 }}>
            <Utensils size={36} style={{ opacity: 0.15, marginBottom: 10 }} />
            <div style={{ fontSize: "0.9rem" }}>No food logged yet.</div>
            <div style={{ fontSize: "0.78rem", color: "#333", marginTop: 4 }}>Tap a food above to start tracking</div>
          </div>
        ) : (() => {
          /* Group logs by meal period */
          const groups = {};
          logs.forEach((log) => {
            const period = getMealPeriod(log.created_at);
            if (!groups[period.label]) groups[period.label] = { ...period, items: [] };
            groups[period.label].items.push(log);
          });
          const sortedGroups = Object.values(groups).sort((a, b) => a.order - b.order);

          return sortedGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: 20 }}>
              {/* Meal period header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                marginBottom: 8, paddingBottom: 6,
                borderBottom: "1px solid #18181b",
              }}>
                <span style={{ fontSize: "1rem" }}>{group.icon}</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: 1 }}>
                  {group.label}
                </span>
                <span style={{ fontSize: "0.65rem", color: "#333", marginLeft: "auto" }}>
                  {group.items.reduce((s, l) => s + (l.calories || 0), 0)} kcal
                </span>
              </div>

              {/* Log rows */}
              {group.items.map((log) => {
                const pct = totals.calories > 0
                  ? Math.round((log.calories / totals.calories) * 100)
                  : 0;
                const isWater = log.name === "Water";
                return (
                  <div
                    key={log.id}
                    style={{
                      background: isWater ? "rgba(59,130,246,0.07)" : "#111116",
                      border: isWater ? "1px solid rgba(59,130,246,0.2)" : "1px solid #1e1e26",
                      borderRadius: 14,
                      padding: "10px 12px",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {/* Qty badge */}
                    <div style={{
                      background: isWater ? "rgba(59,130,246,0.2)" : "#1e1e26",
                      color: isWater ? "#3b82f6" : "#666",
                      borderRadius: 8, padding: "4px 8px",
                      fontSize: "0.75rem", fontWeight: 700,
                      minWidth: 34, textAlign: "center", flexShrink: 0,
                    }}>
                      {log.qty}×
                    </div>

                    {/* Name + macros */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, color: "#e4e4e7",
                        textTransform: "capitalize", fontSize: "0.9rem",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {log.name}
                      </div>
                      {!isWater && (
                        <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.65rem", background: "rgba(59,130,246,0.12)", color: "#3b82f6", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>
                            P {log.protein}g
                          </span>
                          <span style={{ fontSize: "0.65rem", background: "rgba(245,158,11,0.12)", color: "#f59e0b", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>
                            C {log.carbs}g
                          </span>
                          <span style={{ fontSize: "0.65rem", background: "rgba(239,68,68,0.12)", color: "#ef4444", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>
                            F {log.fats}g
                          </span>
                        </div>
                      )}
                      {isWater && (
                        <span style={{ fontSize: "0.72rem", color: "#3b82f6", fontWeight: 600 }}>
                          {log.qty * 0.25}L
                        </span>
                      )}
                    </div>

                    {/* Calorie + % badge */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: isWater ? "#3b82f6" : "#fff" }}>
                        {log.calories}
                      </div>
                      {!isWater && pct > 0 && (
                        <div style={{
                          fontSize: "0.62rem", color: "#aaa", fontWeight: 700,
                          background: "rgba(255,255,255,0.07)", borderRadius: 5, padding: "1px 5px", marginTop: 2,
                        }}>
                          {pct}%
                        </div>
                      )}
                    </div>

                    {/* Actions — compact icon group */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                      <button
                        onClick={() => openEditModal(log)}
                        style={{ background: "none", border: "none", color: "#444", cursor: "pointer", padding: 5, borderRadius: 6 }}
                        title="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => deleteLog(log.id)}
                        style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 5, borderRadius: 6 }}
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
        })()}
      </section>

      {/* Floating Save FAB */}
      {hasUnsavedChanges && (
        <div style={{ position: "fixed", bottom: 90, right: 20, zIndex: 100 }}>
          <button
            onClick={saveChanges}
            disabled={isSaving}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: isSaving ? "#444" : "linear-gradient(135deg,#22c55e,#16a34a)",
              color: "#fff", border: "none",
              padding: "12px 20px", borderRadius: 50,
              fontWeight: 700, fontSize: "0.9rem",
              boxShadow: "0 8px 24px rgba(34,197,94,0.4)",
              cursor: isSaving ? "wait" : "pointer",
              transition: "transform 0.15s, box-shadow 0.15s",
              animation: "fabBounce 0.4s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
