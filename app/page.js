"use client";

import React, { useState, useEffect, memo } from "react";
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
  Utensils, // Added icon
} from "lucide-react";
import { FOOD_CATEGORIES, FLATTENED_DB } from "./food-data";
import { supabase } from "./supabase";

// --- MEMOIZED STATS ---
const StatsBoard = memo(({ totals, userProfile, onAddWater }) => {
  // 1. Get Calorie Target
  let targetCals = 2000;
  if (userProfile.target_calories) {
    targetCals = Number(prof.target_calories);
  } else {
    let bmr =
      10 * userProfile.weight + 6.25 * userProfile.height - 5 * userProfile.age;
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

  // 2. Calculate Exact Macro Targets (Matching Social Hub Logic)
  // Default to 70kg if weight is missing to prevent NaN
  const weight = Number(userProfile?.weight);
  const goal = userProfile?.goal;

  let targetP, targetF, targetC;

  if (goal === "lose") {
    targetP = Math.round(weight * 2.2); // High protein for fat loss
    targetF = Math.round((targetCals * 0.3) / 9); // 30% Fat
  } else if (goal === "gain") {
    targetP = Math.round(weight * 1.8); // Moderate protein for bulking
    targetF = Math.round((targetCals * 0.25) / 9); // 25% Fat
  } else {
    targetP = Math.round(weight * 1.6);
    targetF = Math.round((targetCals * 0.3) / 9);
  }

  const usedCals = targetP * 4 + targetF * 9;
  targetC = Math.round(Math.max(0, targetCals - usedCals) / 4);

  let targetWater = Math.round(weight * 0.035 * 10) / 10;
  if (
    userProfile?.activity === "active" ||
    userProfile?.activity === "moderate"
  )
    targetWater += 0.5;

  const pct = (val, target) => Math.min(100, Math.round((val / target) * 100));

  return (
    <section style={{ marginBottom: 20 }}>
      {/* 1. MAIN NUTRITION CARD */}
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
                  <span style={{ color: "#10b981" }}>{totals.carbs}</span> /{" "}
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
                    background: "#10b981",
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
                  <span style={{ color: "#f59e0b" }}>{totals.fats}</span> /{" "}
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
                    background: "#f59e0b",
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

      {/* 2. WATER CARD */}
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
  const [showWelcome, setShowWelcome] = useState(false); // NEW: Welcome Modal State
  const [welcomeStep, setWelcomeStep] = useState(1); // NEW: Welcome Step

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
      setLogs(data);
      setHasUnsavedChanges(false);
    }

    const { data: history } = await supabase
      .from("food_logs")
      .select("name")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(50);
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

  // --- WELCOME LOGIC ---
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

  // --- ACTIONS ---
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
    if (!newPassword) return alert("Enter a password");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) alert(error.message);
    else {
      alert("Password updated successfully!");
      setNewPassword("");
      setShowPasswordSetup(false);
    }
  };

  const handleLocalAdd = (itemsToAdd) => {
    setHasUnsavedChanges(true);
    setLogs((currentLogs) => {
      let updatedLogs = [...currentLogs];
      itemsToAdd.forEach((newItem) => {
        const foodName = newItem.name;
        const quantity = Number(newItem.qty);
        let baseData = { calories: 0, protein: 0, carbs: 0, fats: 0 };
        if (foodName !== "Water") {
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

  const addFood = (foodName, overrideQty = null) => {
    handleLocalAdd([{ name: foodName, qty: overrideQty || qty }]);
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
        water: item.name === "Water" ? acc.water + item.qty : acc.water,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0, water: 0 }
    );
    setTotals(t);
  }, [logs]);

  const getDisplayItems = () =>
    query
      ? Object.keys(FLATTENED_DB).filter((k) => k.includes(query.toLowerCase()))
      : activeCategory === "Recent"
      ? recents
      : activeCategory === "Meals"
      ? savedMeals
      : Object.keys(FOOD_CATEGORIES[activeCategory] || {});
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
      // SUCCESS: Show the Set Password Modal immediately
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
        {/* LOGIN COMPONENT */}
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
                <div
                  style={{ marginTop: 12, fontSize: "0.8rem", color: "#666" }}
                >
                  Forgot password? Use OTP to login & reset it.
                </div>
              </form>
            ) : // OTP LOGIN
            !isCodeSent ? (
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
                <div
                  style={{ marginTop: 12, fontSize: "0.8rem", color: "#666" }}
                >
                  New user? Just enter your email to start.
                </div>
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
                  Let's Go!
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

      {/* PASSWORD MODAL */}
      {showPasswordSetup && (
        <div className="modal-overlay">
          <div
            className="modal-content"
            style={{ maxWidth: 400, width: "90%", textAlign: "center" }}
          >
            <KeyRound size={40} color="#3b82f6" style={{ marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px 0" }}>Set a Password</h3>
            <p style={{ color: "#888", marginBottom: 20, fontSize: "0.9rem" }}>
              Create a password so you can login easier next time.
            </p>
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
                Skip
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
                Save Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingGoal && (
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
                marginBottom: 20,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.2rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Target size={20} color="#f59e0b" /> Settings
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
            <div
              style={{
                display: "flex",
                background: "#1f1f22",
                padding: 4,
                borderRadius: 8,
                marginBottom: 20,
              }}
            >
              <button
                onClick={() => setSettingsTab("profile")}
                style={{
                  flex: 1,
                  padding: 8,
                  background:
                    settingsTab === "profile" ? "#333" : "transparent",
                  border: "none",
                  color: "#fff",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Profile
              </button>
              <button
                onClick={() => setSettingsTab("security")}
                style={{
                  flex: 1,
                  padding: 8,
                  background:
                    settingsTab === "security" ? "#333" : "transparent",
                  border: "none",
                  color: "#fff",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Security
              </button>
            </div>
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
                  <h4 style={{ margin: "0 0 10px 0" }}>Update Password</h4>
                  <p
                    style={{
                      color: "#888",
                      fontSize: "0.85rem",
                      marginBottom: 15,
                    }}
                  >
                    Set or change your login password.
                  </p>
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
                    Update Password
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 20 }}
              >
                <div
                  style={{
                    background: "#1f1f22",
                    padding: 16,
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
                      marginBottom: 10,
                    }}
                  >
                    <Calculator size={16} color="#3b82f6" />
                    <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                      Auto-Calculate
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: "0.75rem",
                          color: "#888",
                          marginBottom: 4,
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
                          padding: 12,
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
                          fontSize: "0.75rem",
                          color: "#888",
                          marginBottom: 4,
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
                          padding: 12,
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
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: "0.75rem",
                          color: "#888",
                          marginBottom: 4,
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
                          padding: 12,
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
                          fontSize: "0.75rem",
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
                  <div style={{ marginBottom: 10 }}>
                    <label
                      style={{
                        fontSize: "0.75rem",
                        color: "#888",
                        marginBottom: 4,
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
                        padding: 12,
                        background: "#000",
                        border: "1px solid #333",
                        color: "#fff",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      <option value="sedentary">Sedentary (Office Job)</option>
                      <option value="light">Light Exercise (1-3 days)</option>
                      <option value="moderate">
                        Moderate Exercise (3-5 days)
                      </option>
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
                      Weekly Goal
                    </label>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 8,
                      }}
                    >
                      {["lose", "maintain", "gain"].map((g) => (
                        <button
                          key={g}
                          onClick={() =>
                            setUserProfile({ ...userProfile, goal: g })
                          }
                          style={{
                            padding: 12,
                            background:
                              userProfile.goal === g
                                ? g === "lose"
                                  ? "#ef4444"
                                  : g === "gain"
                                  ? "#3b82f6"
                                  : "#22c55e"
                                : "#000",
                            border:
                              userProfile.goal === g
                                ? "none"
                                : "1px solid #333",
                            borderRadius: 8,
                            color: "#fff",
                            textTransform: "capitalize",
                            fontSize: "0.85rem",
                            cursor: "pointer",
                          }}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
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
                  }}
                >
                  Save Profile
                </button>
              </div>
            )}
          </div>
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
                  style={{ color: "#666", textAlign: "center", marginTop: 30 }}
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
          padding: "16px 20px",
          borderBottom: "1px solid #222",
          width: "100%",
        }}
      >
        <div>
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
                query || activeCategory === "Meals" ? "1fr" : "repeat(3, 1fr)",
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
              getDisplayItems().map((item) => (
                <button
                  key={item.id || item}
                  className="suggestion-chip"
                  onClick={() => addFood(item.name || item)}
                  style={{
                    whiteSpace: "normal",
                    height: "auto",
                    minHeight: 44,
                    wordBreak: "break-word",
                    textAlign: query ? "left" : "center",
                    padding: query ? "12px 16px" : "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: query ? "flex-start" : "center",
                  }}
                >
                  {(item.name || item).charAt(0).toUpperCase() +
                    (item.name || item).slice(1)}
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      {/* --- REDESIGNED TIMELINE: MACRO CARDS --- */}
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
              {/* QTY BADGE */}
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

              {/* INFO */}
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

                {/* MACRO PILLS (OR WATER VOL) */}
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
                          color: "#10b981",
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
                          color: "#f59e0b",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        F: {log.fats}g
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* CALORIES & DELETE */}
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
                  style={{ fontSize: "0.7rem", color: "#666", marginBottom: 4 }}
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
