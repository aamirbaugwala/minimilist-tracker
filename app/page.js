"use client";

import React, { useState, useEffect, memo, useMemo } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Search,
  Plus,
  Minus,
  X,
  LayoutDashboard,
  LogOut,
  Loader2,
  Flame,
  Droplets,
  Trash2,
  Save,
  Pencil,
  Target,
  Calculator,
  Users,
  Shield,
  KeyRound,
  Settings,
  Zap,
  Award,
  Battery,
  Utensils,
  Sparkles,
  Globe,
} from "lucide-react";
import { FOOD_CATEGORIES, FLATTENED_DB } from "./food-data";
import { supabase } from "./supabase";

// --- MEMOIZED STATS ---
const StatsBoard = memo(({ totals, userProfile, onAddWater }) => {
  // 1. Get Calorie Target
  let targetCals = 2000;
  if (userProfile.target_calories) {
    targetCals = Number(userProfile.target_calories);
  } else {
    // Default fallback
    const weight = Number(userProfile.weight) || 70;
    const height = Number(userProfile.height) || 170;
    const age = Number(userProfile.age) || 30;

    let bmr = 10 * weight + 6.25 * height - 5 * age;
    bmr += userProfile.gender === "male" ? 5 : -161;
    const multipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
    };
    let tdee = bmr * (multipliers[userProfile.activity] || 1.2);

    targetCals = Math.round(tdee);
    if (userProfile.goal === "lose") targetCals -= 500;
    else if (userProfile.goal === "gain") targetCals += 300;
  }

  // 2. Calculate Exact Macro Targets
  const weight = Number(userProfile?.weight) || 70;
  const goal = userProfile?.goal || "maintain";

  let targetP, targetF, targetC;

  if (goal === "lose") {
    targetP = Math.round(weight * 2.2);
    targetF = Math.round((targetCals * 0.3) / 9);
  } else if (goal === "gain") {
    targetP = Math.round(weight * 1.8);
    targetF = Math.round((targetCals * 0.25) / 9);
  } else {
    targetP = Math.round(weight * 1.6);
    targetF = Math.round((targetCals * 0.3) / 9);
  }

  const usedCals = targetP * 4 + targetF * 9;
  targetC = Math.round(Math.max(0, targetCals - usedCals) / 4);
  const targetFib = Math.round((targetCals / 1000) * 14);

  let targetWater = Math.round(weight * 0.035 * 10) / 10;
  if (
    userProfile?.activity === "active" ||
    userProfile?.activity === "moderate"
  )
    targetWater += 0.5;

  const pct = (val, target) => Math.min(100, Math.round((val / target) * 100));

  return (
    <section style={{ marginBottom: 20 }}>
      {/* MAIN NUTRITION CARD */}
      <div
        style={{
          background: "#1f1f22",
          borderRadius: 24,
          padding: 20,
          border: "1px solid #333",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              position: "relative",
              width: 110,
              height: 110,
              flexShrink: 0,
            }}
          >
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={[
                    { value: totals.calories },
                    { value: Math.max(0, targetCals - totals.calories) },
                  ]}
                  innerRadius={42}
                  outerRadius={52}
                  dataKey="value"
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell
                    fill={totals.calories > targetCals ? "#ef4444" : "#3b82f6"}
                  />
                  <Cell fill="#27272a" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
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
                style={{ fontSize: "1.4rem", fontWeight: 800, lineHeight: 1 }}
              >
                {totals.calories}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#888", marginTop: 4 }}>
                / {targetCals} kcal
              </div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontWeight: 600, color: "#ddd" }}>Protein</span>
                <span style={{ color: "#888" }}>
                  <span style={{ color: "#3b82f6" }}>{totals.protein}</span> /{" "}
                  {targetP}g
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: "#27272a",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct(totals.protein, targetP)}%`,
                    background: "#3b82f6",
                    height: "100%",
                    borderRadius: 10,
                    transition: "width 0.5s",
                  }}
                />
              </div>
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontWeight: 600, color: "#ddd" }}>Carbs</span>
                <span style={{ color: "#888" }}>
                  <span style={{ color: "#FFC107" }}>{totals.carbs}</span> /{" "}
                  {targetC}g
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: "#27272a",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct(totals.carbs, targetC)}%`,
                    background: "#FFC107",
                    height: "100%",
                    borderRadius: 10,
                    transition: "width 0.5s",
                  }}
                />
              </div>
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontWeight: 600, color: "#ddd" }}>Fiber</span>
                <span style={{ color: "#888" }}>
                  <span style={{ color: "#22c55e" }}>{totals.fiber}</span> /{" "}
                  {targetFib}g
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: "#27272a",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct(totals.fiber, targetFib)}%`,
                    background: "#22c55e",
                    height: "100%",
                    borderRadius: 10,
                    transition: "width 0.5s",
                  }}
                />
              </div>
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontWeight: 600, color: "#ddd" }}>Fats</span>
                <span style={{ color: "#888" }}>
                  <span style={{ color: "#ef4444" }}>{totals.fats}</span> /{" "}
                  {targetF}g
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: "#27272a",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct(totals.fats, targetF)}%`,
                    background: "#ef4444",
                    height: "100%",
                    borderRadius: 10,
                    transition: "width 0.5s",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WATER CARD */}
      <div
        onClick={onAddWater}
        style={{
          position: "relative",
          background: "#1f1f22",
          borderRadius: 20,
          padding: "16px 20px",
          border: "1px solid #333",
          overflow: "hidden",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${Math.min(
              100,
              ((totals.water * 0.25) / targetWater) * 100
            )}%`,
            background: "rgba(59, 130, 246, 0.15)",
            transition: "0.3s",
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
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                background: "rgba(59, 130, 246, 0.2)",
                padding: 10,
                borderRadius: 12,
              }}
            >
              <Droplets size={22} color="#3b82f6" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#fff" }}>
                Water Intake
              </div>
              <div style={{ fontSize: "0.8rem", color: "#888" }}>
                <span style={{ color: "#3b82f6", fontWeight: 600 }}>
                  {totals.water * 0.25}L
                </span>{" "}
                / {targetWater}L
              </div>
            </div>
          </div>
          <div
            style={{
              background: "#333",
              borderRadius: "50%",
              padding: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={18} color="#fff" />
          </div>
        </div>
      </div>
    </section>
  );
});
StatsBoard.displayName = "StatsBoard";

export default function Home() {
  const [session, setSession] = useState(null);
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
  const [authLoading, setAuthLoading] = useState(false);

  // --- NEW: WEB SEARCH STATE ---
  const [webResults, setWebResults] = useState([]);
  const [isWebSearching, setIsWebSearching] = useState(false);

  // --- FEATURE 1: SMART RECOMMENDATIONS LOGIC (REWRITTEN) ---
  const generateSmartMeals = () => {
    // 1. Calculate Targets & Remaining
    let targetCals = 2000;
    let targetP, targetF, targetC;

    if (userProfile.target_calories) {
      targetCals = Number(userProfile.target_calories);
    } else {
      const w = Number(userProfile.weight) || 70;
      const h = Number(userProfile.height) || 170;
      const a = Number(userProfile.age) || 30;
      let bmr = 10 * w + 6.25 * h - 5 * a;
      bmr += userProfile.gender === "male" ? 5 : -161;
      let tdee = bmr * 1.2;
      targetCals = Math.round(tdee);
      if (userProfile.goal === "lose") targetCals -= 500;
      else if (userProfile.goal === "gain") targetCals += 300;
    }

    const w = Number(userProfile.weight) || 70;
    const goal = userProfile.goal || "maintain";
    if (goal === "lose") {
      targetP = Math.round(w * 2.2);
      targetF = Math.round((targetCals * 0.3) / 9);
    } else if (goal === "gain") {
      targetP = Math.round(w * 1.8);
      targetF = Math.round((targetCals * 0.25) / 9);
    } else {
      targetP = Math.round(w * 1.6);
      targetF = Math.round((targetCals * 0.3) / 9);
    }
    const usedCals = targetP * 4 + targetF * 9;
    targetC = Math.round(Math.max(0, targetCals - usedCals) / 4);

    // REAL Remaining values
    const remainingCals = targetCals - totals.calories;
    const remainingPro = Math.max(0, targetP - totals.protein);
    const remainingFat = Math.max(0, targetF - totals.fats);
    const remainingCarb = Math.max(0, targetC - totals.carbs);

    // Hard Stop if basically full
    if (remainingCals < 50) return [];

    const candidates = [];
    if (FLATTENED_DB) {
      Object.entries(FLATTENED_DB).forEach(([key, item]) => {
        // Must fit in remaining calories (with slight buffer)
        if (item.calories <= remainingCals * 1.1) {
          let score = 0;

          // SCORING ALGORITHM:
          // 1. Boost if it provides protein we need
          if (remainingPro > 5) {
            if (item.protein > 15) score += 20; // High protein
            else if (item.protein > 5) score += 5;
          }

          // 2. Penalize fat if we are out of budget
          if (remainingFat < 5) {
            if (item.fats > 10) score -= 100; // Kill high fat items
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
      const smallSnacks = Object.entries(FLATTENED_DB)
        .filter(([_, val]) => val.calories <= remainingCals)
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
    [totals, userProfile]
  );

  // --- FEATURE 2: ACTUAL WEB SEARCH (OpenFoodFacts) ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!query || query.length < 3) {
        setWebResults([]);
        return;
      }

      const localKeys = Object.keys(FLATTENED_DB).filter((k) =>
        k.includes(query.toLowerCase())
      );

      if (localKeys.length === 0) {
        setIsWebSearching(true);
        try {
          const response = await fetch(
            `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=5`
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
  }, [query]);

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
        let dbItem = FLATTENED_DB[log.name.toLowerCase()];
        if (!dbItem) {
          const key = Object.keys(FLATTENED_DB).find((k) =>
            k.includes(log.name.toLowerCase())
          );
          if (key) dbItem = FLATTENED_DB[key];
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchData();
        fetchUserData();
        calculateStreak();
        const hasSeen = localStorage.getItem("hasSeenWelcome");
        if (!hasSeen) {
          setShowWelcome(true);
        }
      } else {
        setLoading(false);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchData();
        fetchUserData();
        calculateStreak();
      } else {
        setLogs([]);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

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
      updated_at: new Date(),
    });
    if (error) alert("Error saving goal");
    else {
      alert("Profile updated!");
      setIsSettingGoal(false);
    }
  };

  const handleUpdatePassword = async () => {
    let msg = "";
    if (newPassword) {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) return alert(error.message);
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
          { onConflict: "user_id" }
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

  const handleLocalAdd = (itemsToAdd) => {
    setHasUnsavedChanges(true);
    setLogs((currentLogs) => {
      let updatedLogs = [...currentLogs];
      itemsToAdd.forEach((newItem) => {
        const foodName = newItem.name;
        const quantity = Number(newItem.qty);
        // Default to provided macros (for web results)
        let baseData = {
          calories: newItem.calories || 0,
          protein: newItem.protein || 0,
          carbs: newItem.carbs || 0,
          fats: newItem.fats || 0,
          fiber: newItem.fiber || 0,
        };

        // If local DB lookup needed
        if (
          foodName !== "Water" &&
          baseData.calories === 0 &&
          !newItem.isWeb
        ) {
          let dbData = FLATTENED_DB[foodName.toLowerCase()];
          if (!dbData) {
            const key = Object.keys(FLATTENED_DB).find((k) =>
              k.includes(foodName.toLowerCase())
            );
            if (key) dbData = FLATTENED_DB[key];
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
      const cleanLogs = logs.map(({ id, created_at, ...rest }) => ({
        ...rest,
        user_id: session.user.id,
        date: todayKey,
      }));
      if (cleanLogs.length > 0)
        await supabase.from("food_logs").insert(cleanLogs);
      setHasUnsavedChanges(false);
      await fetchData(true);
    } catch (err) {
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
          i.name === foodName ? { ...i, qty: i.qty + 1 } : i
        )
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
            : m
        )
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
      { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, water: 0 }
    );
    setTotals(t);
  }, [logs]);

  const getDisplayItems = () => {
    const hydrate = (keys) =>
      keys.map((key) => {
        const item =
          FLATTENED_DB[key.toLowerCase()] ||
          FLATTENED_DB[
            Object.keys(FLATTENED_DB).find((k) => k.includes(key.toLowerCase()))
          ];
        return item ? { name: key, ...item } : { name: key };
      });

    // 1. SEARCH LOGIC (LOCAL + WEB)
    if (query) {
      const keys = Object.keys(FLATTENED_DB).filter((k) =>
        k.includes(query.toLowerCase())
      );
      const results = hydrate(keys);

      // If local is empty, try showing web results
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

    // 2. SMART RECOMMENDATIONS
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
      ? Object.keys(FLATTENED_DB).filter((k) =>
          k.includes(mealBuilderQuery.toLowerCase())
        )
      : recents;

  const handleSendCode = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert(error.message);
    else setIsCodeSent(true);
    setAuthLoading(false);
  };
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    if (error) {
      alert("Invalid code.");
    } else {
      setShowPasswordSetup(true);
    }
    setAuthLoading(false);
  };
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) alert(error.message);
    setAuthLoading(false);
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsCodeSent(false);
    setOtp("");
    setEmail("");
    setPassword("");
  };

  if (!session)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          padding: 20,
        }}
      >
        <div style={{ width: "100%", maxWidth: 350, textAlign: "center" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: 16 }}>
            NutriTrack.
          </h1>
          <div
            style={{
              background: "var(--surface)",
              padding: 24,
              borderRadius: 16,
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 20,
                marginBottom: 20,
                borderBottom: "1px solid #333",
                paddingBottom: 10,
              }}
            >
              <button
                onClick={() => setUsePasswordLogin(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: !usePasswordLogin ? "#fff" : "#666",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                OTP
              </button>
              <button
                onClick={() => setUsePasswordLogin(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: usePasswordLogin ? "#fff" : "#666",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Password
              </button>
            </div>
            {usePasswordLogin ? (
              <form onSubmit={handlePasswordLogin}>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #333",
                    background: "#000",
                    color: "white",
                    marginBottom: 12,
                  }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #333",
                    background: "#000",
                    color: "white",
                    marginBottom: 12,
                  }}
                />
                <button
                  disabled={authLoading}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 8,
                    border: "none",
                    background: "var(--brand)",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {authLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>
            ) : !isCodeSent ? (
              <form onSubmit={handleSendCode}>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #333",
                    background: "#000",
                    color: "white",
                    marginBottom: 12,
                  }}
                />
                <button
                  disabled={authLoading}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 8,
                    border: "none",
                    background: "var(--brand)",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {authLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Get Code"
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode}>
                <input
                  type="text"
                  placeholder="12345678"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  maxLength={10}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #333",
                    background: "#000",
                    color: "white",
                    marginBottom: 12,
                    letterSpacing: 4,
                    textAlign: "center",
                    fontSize: "1.2rem",
                  }}
                />
                <button
                  disabled={authLoading}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 8,
                    border: "none",
                    background: "var(--brand)",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {authLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Verify"
                  )}
                </button>
              </form>
            )}
          </div>
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
                <p
                  style={{ color: "#aaa", lineHeight: 1.6, marginBottom: 30 }}
                >
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
                <p
                  style={{ color: "#aaa", lineHeight: 1.6, marginBottom: 30 }}
                >
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
                <p
                  style={{ color: "#aaa", lineHeight: 1.6, marginBottom: 30 }}
                >
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

      {/* HEADER */}
      <header
        className="header-row"
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #222",
          width: "100%",
        }}
      >
        <div>
          {username && (
            <div
              style={{
                fontSize: "0.85rem",
                color: "#a1a1aa",
                marginBottom: -4,
                fontWeight: 500,
              }}
            >
              Welcome back, <span style={{ color: "#fff" }}>{username}</span>
            </div>
          )}

          <h1 className="brand-title">NutriTrack.</h1>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div className="date-badge">Today</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.8rem",
                color: streak > 0 ? "#f59e0b" : "#333",
                fontWeight: 700,
              }}
            >
              <Flame size={14} fill={streak > 0 ? "#f59e0b" : "none"} />{" "}
              {streak} Day Streak
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="menu-btn"
            onClick={() => {
              setIsSettingGoal(true);
              setSettingsTab("profile");
            }}
            style={{ color: "#3b82f6" }}
          >
            <Target size={20} />
          </button>
          <button
            className="menu-btn"
            onClick={() => {
              setIsSettingGoal(true);
              setSettingsTab("security");
            }}
            style={{ color: "#888" }}
          >
            <Settings size={20} />
          </button>
          <Link href="/dashboard">
            <button className="menu-btn" style={{ color: "var(--brand)" }}>
              <LayoutDashboard size={20} />
            </button>
          </Link>
          <Link href="/social">
            <button className="menu-btn" style={{ color: "#8b5cf6" }}>
              <Users size={20} />
            </button>
          </Link>
          <button className="menu-btn" onClick={handleLogout}>
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <StatsBoard
        totals={totals}
        onAddWater={() => addFood("Water")}
        userProfile={userProfile}
      />

      <section className="command-center">
        <div className="input-row">
          <div className="qty-wrapper">
            <button
              className="qty-btn"
              onClick={() => setQty(Math.max(1, qty - 1))}
            >
              <Minus size={14} />
            </button>
            <div className="qty-val">{qty}</div>
            <button className="qty-btn" onClick={() => setQty(qty + 1)}>
              <Plus size={14} />
            </button>
          </div>
          <div className="search-container">
            <Search className="search-icon" size={16} />
            <input
              className="search-input"
              placeholder="Add food..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="suggestions-box">
          {!query && (
            <div className="category-scroll-row">
              {/* --- NEW SMART RECS CATEGORY --- */}
              <button
                className={`suggestion-chip ${
                  activeCategory === "Smart" ? "active" : ""
                }`}
                onClick={() => setActiveCategory("Smart")}
                style={{
                  border:
                    activeCategory === "Smart"
                      ? "1px solid #8b5cf6"
                      : "1px solid #333",
                  color: activeCategory === "Smart" ? "#fff" : "#8b5cf6",
                  background:
                    activeCategory === "Smart"
                      ? "rgba(139, 92, 246, 0.2)"
                      : "transparent",
                }}
              >
                <Sparkles size={12} style={{ marginRight: 6 }} /> Smart Recs
              </button>

              <button
                className={`suggestion-chip ${
                  activeCategory === "Recent" ? "active" : ""
                }`}
                onClick={() => setActiveCategory("Recent")}
              >
                Recent
              </button>
              <button
                className={`suggestion-chip ${
                  activeCategory === "Meals" ? "active" : ""
                }`}
                onClick={() => setActiveCategory("Meals")}
              >
                Meals
              </button>
              {Object.keys(FOOD_CATEGORIES).map((cat) => (
                <button
                  key={cat}
                  className={`suggestion-chip ${
                    activeCategory === cat ? "active" : ""
                  }`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
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
            {activeCategory === "Meals" && !query ? (
              <>
                <button
                  className="suggestion-chip"
                  style={{
                    border: "1px dashed #666",
                    color: "#aaa",
                    textAlign: "center",
                  }}
                  onClick={() => openMealBuilder()}
                >
                  <Plus
                    size={14}
                    style={{ display: "inline", marginRight: 4 }}
                  />{" "}
                  Build Meal
                </button>
                {savedMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className="suggestion-chip"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      paddingRight: 6,
                      whiteSpace: "normal",
                      height: "auto",
                      minHeight: 44,
                      textAlign: "left",
                    }}
                  >
                    <span onClick={() => loadMeal(meal)} style={{ flex: 1 }}>
                      {meal.name}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        color: "#666",
                        borderLeft: "1px solid #444",
                        paddingLeft: 8,
                        cursor: "pointer",
                      }}
                    >
                      <span
                        onClick={() => openMealBuilder(meal)}
                        style={{ cursor: "pointer" }}
                      >
                        <Pencil size={12} />
                      </span>
                      <span
                        onClick={() => deleteMeal(meal.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <Trash2 size={12} />
                      </span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              getDisplayItems().map((item) => {
                const foodName = typeof item === "string" ? item : item.name;
                const p =
                  typeof item === "object" && item.protein !== undefined
                    ? item.protein
                    : null;
                const c =
                  typeof item === "object" && item.carbs !== undefined
                    ? item.carbs
                    : null;
                const f =
                  typeof item === "object" && item.fats !== undefined
                    ? item.fats
                    : null;
                const fib =
                  typeof item === "object" && item.fats !== undefined
                    ? item.fiber
                    : null;

                const isMeal = activeCategory === "Meals" && !query;
                const isSmart = item.isSmart === true;
                const isWeb = item.isWeb === true;
                const displayLabel = isMeal || isSmart ? item.name : foodName;

                return (
                  <button
                    key={item.id || displayLabel}
                    className="suggestion-chip"
                    onClick={() => {
                      if (isMeal) loadMeal(item);
                      else if (isSmart) loadMeal(item);
                      else if (isWeb)
                        addFood(displayLabel, null, {
                          // Pass explicit macros for web results
                          calories: item.calories,
                          protein: item.protein,
                          carbs: item.carbs,
                          fats: item.fats,
                          fiber: item.fiber,
                        });
                      else addFood(displayLabel);
                    }}
                    style={{
                      whiteSpace: "normal",
                      height: "auto",
                      minHeight: 44,
                      wordBreak: "break-word",
                      textAlign: "center",
                      padding: "8px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      // Highlight Smart/Web items
                      border: isSmart
                        ? "1px solid #8b5cf6"
                        : isWeb
                        ? "1px dashed #3b82f6"
                        : "none",
                      background: isSmart
                        ? "rgba(139, 92, 246, 0.1)"
                        : "var(--surface)",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {isSmart && <Sparkles size={12} color="#8b5cf6" />}
                      {isWeb && <Globe size={12} color="#3b82f6" />}
                      {displayLabel.charAt(0).toUpperCase() +
                        displayLabel.slice(1)}
                    </span>

                    {/* SHOW MACROS IF AVAILABLE */}
                    {p !== null && !isMeal && (
                      <div
                        style={{
                          fontSize: "0.65rem",
                          marginTop: 4,
                          display: "flex",
                          gap: 6,
                          opacity: 0.9,
                        }}
                      >
                        <span style={{ color: "#3b82f6" }}>P:{p}</span>
                        <span style={{ color: "#f59e0b" }}>C:{c}</span>
                        <span style={{ color: "#ef4444" }}>F:{f}</span>
                        {/* Only show fiber if space permits or relevant */}
                        
                          <span style={{ color: "#10b981" }}>Fib:{fib}</span>
                        
                      </div>
                    )}
                    {isWeb && (
                      <span
                        style={{
                          fontSize: "0.6rem",
                          color: "#666",
                          marginTop: 2,
                        }}
                      >
                        Web Search Estimate
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="timeline" style={{ paddingBottom: 80 }}>
        <div className="timeline-label">
          Today&apos;s Logs{" "}
          {hasUnsavedChanges && (
            <span
              style={{ color: "#f59e0b", fontSize: "0.8rem", marginLeft: 8 }}
            >
              (Unsaved)
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 20, color: "#666" }}>
            <Loader2 className="animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "var(--text-tertiary)",
              padding: 40,
            }}
          >
            <Utensils size={40} style={{ opacity: 0.2, marginBottom: 10 }} />
            <div style={{ fontSize: "0.9rem" }}>No food logged yet.</div>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              style={{
                background:
                  log.name === "Water" ? "rgba(59, 130, 246, 0.1)" : "#18181b",
                border:
                  log.name === "Water"
                    ? "1px solid rgba(59, 130, 246, 0.3)"
                    : "1px solid #27272a",
                borderRadius: 16,
                padding: 12,
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  background: log.name === "Water" ? "#3b82f6" : "#27272a",
                  color: log.name === "Water" ? "#fff" : "#888",
                  borderRadius: 10,
                  padding: "6px 10px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  minWidth: 40,
                  textAlign: "center",
                }}
              >
                {log.qty}x
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 600,
                    color: "#fff",
                    textTransform: "capitalize",
                    fontSize: "1rem",
                  }}
                >
                  {log.name}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {log.name === "Water" ? (
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "#3b82f6",
                        fontWeight: 600,
                      }}
                    >
                      {log.qty * 0.25} Liters
                    </span>
                  ) : (
                    <>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          background: "rgba(59, 130, 246, 0.15)",
                          color: "#3b82f6",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        P: {log.protein}g
                      </div>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          background: "rgba(16, 185, 129, 0.15)",
                          color: "#FFC107",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        C: {log.carbs}g
                      </div>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          background: "rgba(245, 158, 11, 0.15)",
                          color: "#ef4444",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        F: {log.fats}g
                      </div>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          background: "rgba(34, 197, 94, 0.15)",
                          color: "#10b981",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        Fib: {log.fiber}g
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: log.name === "Water" ? "#3b82f6" : "#fff",
                  }}
                >
                  {log.calories}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "#666",
                    marginBottom: 4,
                  }}
                >
                  kcal
                </div>
              </div>

              <button
                onClick={() => deleteLog(log.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ef4444",
                  opacity: 0.6,
                  cursor: "pointer",
                  padding: 8,
                }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </section>

      {hasUnsavedChanges && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: 0,
            width: "100%",
            padding: "0 20px",
            zIndex: 100,
          }}
        >
          <button
            onClick={saveChanges}
            disabled={isSaving}
            style={{
              width: "100%",
              maxWidth: 500,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: isSaving ? "#444" : "#22c55e",
              color: "white",
              padding: 16,
              borderRadius: 16,
              border: "none",
              fontWeight: 700,
              fontSize: "1.1rem",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
              cursor: "pointer",
            }}
          >
            {isSaving ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Save size={20} />
            )}
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}