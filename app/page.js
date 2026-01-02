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
} from "lucide-react";
import { FOOD_CATEGORIES, FLATTENED_DB } from "./food-data";
import { supabase } from "./supabase";

// --- MEMOIZED STATS ---
const StatsBoard = memo(({ totals, onAddWater }) => {
  return (
    <section className="bento-grid">
      <div className="stat-card-main">
        <div className="cal-info">
          <h3>Calories</h3>
          <div className="big-number">{totals.calories}</div>
          <div className="unit">kcal</div>
        </div>
        <div style={{ width: 100, height: 100 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={
                  totals.calories === 0
                    ? [{ value: 1 }]
                    : [
                        { name: "P", value: totals.protein, color: "#3b82f6" },
                        { name: "C", value: totals.carbs, color: "#10b981" },
                        { name: "F", value: totals.fats, color: "#f59e0b" },
                      ]
                }
                innerRadius={34}
                outerRadius={45}
                dataKey="value"
                stroke="none"
                isAnimationActive={false}
              >
                {totals.calories === 0 ? (
                  <Cell fill="#27272a" />
                ) : (
                  [
                    { name: "P", value: totals.protein, color: "#3b82f6" },
                    { name: "C", value: totals.carbs, color: "#10b981" },
                    { name: "F", value: totals.fats, color: "#f59e0b" },
                  ].map((e, i) => <Cell key={i} fill={e.color} />)
                )}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="macro-card">
        <span
          className="macro-icon"
          style={{ background: "var(--protein)" }}
        ></span>
        <span className="macro-label">Pro</span>
        <span className="macro-val">{totals.protein}g</span>
      </div>
      <div className="macro-card">
        <span
          className="macro-icon"
          style={{ background: "var(--carbs)" }}
        ></span>
        <span className="macro-label">Carb</span>
        <span className="macro-val">{totals.carbs}g</span>
      </div>
      <div
        className="macro-card"
        onClick={onAddWater}
        style={{ cursor: "pointer", position: "relative", overflow: "hidden" }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: `${Math.min(100, totals.water * 8)}%`,
            background: "#3b82f6",
            opacity: 0.2,
            transition: "0.3s",
          }}
        ></div>
        <span className="macro-icon" style={{ background: "#3b82f6" }}>
          <Droplets size={12} color="#fff" />
        </span>
        <span className="macro-label">Water</span>
        <span className="macro-val">{totals.water * 0.25}L</span>
        <div style={{ position: "absolute", right: 4, top: 4, opacity: 0.5 }}>
          <Plus size={10} />
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

  // Features
  const [savedMeals, setSavedMeals] = useState([]);
  const [streak, setStreak] = useState(0);

  // Modals
  const [isCreatingMeal, setIsCreatingMeal] = useState(false);
  const [isSettingGoal, setIsSettingGoal] = useState(false);

  // Goal State
  const [userProfile, setUserProfile] = useState({
    weight: "",
    height: "",
    age: "",
    gender: "male",
    activity: "sedentary",
    goal: "lose",
    target_calories: "",
  });

  // Meal Builder State
  const [editingMealId, setEditingMealId] = useState(null);
  const [newMealName, setNewMealName] = useState("");
  const [mealBuilderItems, setMealBuilderItems] = useState([]);
  const [mealBuilderQuery, setMealBuilderQuery] = useState("");

  // UI & Auth
  const [qty, setQty] = useState(1);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Recent");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // --- INIT ---
  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    const todayKey = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("food_logs")
      .select("*")
      .eq("date", todayKey)
      .order("created_at", { ascending: false });
    if (!error) {
      setLogs(data);
      setHasUnsavedChanges(false);
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
    const { data } = await supabase
      .from("food_logs")
      .select("date")
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

  // --- MEAL BUILDER ---
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

  // --- CALCS ---
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
    if (error) alert("Invalid code.");
    setAuthLoading(false);
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsCodeSent(false);
    setOtp("");
    setEmail("");
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
            {!isCodeSent ? (
              <form onSubmit={handleSendCode}>
                <h2 style={{ fontSize: "1.2rem", marginBottom: 8 }}>Sign In</h2>
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
                <h2 style={{ fontSize: "1.2rem", marginBottom: 8 }}>
                  Enter Code
                </h2>
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

  // --- FIXED LAYOUT ---
  return (
    // FIX: Using width: 100% and overflowX: hidden prevents horizontal scrollbars
    <div
      className="app-wrapper"
      style={{
        minHeight: "100vh",
        paddingBottom: 100,
        width: "100%",
        overflowX: "hidden",
        position: "relative",
      }}
    >
      {/* GOAL MODAL */}
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
                <Target size={20} color="#f59e0b" /> My Goals
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
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
                  <Calculator size={16} color="#3b82f6" />{" "}
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
                  <input
                    type="number"
                    placeholder="Weight (kg)"
                    value={userProfile.weight}
                    onChange={(e) =>
                      setUserProfile({ ...userProfile, weight: e.target.value })
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
                  <input
                    type="number"
                    placeholder="Height (cm)"
                    value={userProfile.height}
                    onChange={(e) =>
                      setUserProfile({ ...userProfile, height: e.target.value })
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 2fr",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <input
                    type="number"
                    placeholder="Age"
                    value={userProfile.age}
                    onChange={(e) =>
                      setUserProfile({ ...userProfile, age: e.target.value })
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
                    }}
                  >
                    <option value="sedentary">Sedentary</option>
                    <option value="light">Light</option>
                    <option value="moderate">Moderate</option>
                    <option value="active">Active</option>
                  </select>
                </div>
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
                          userProfile.goal === g ? "none" : "1px solid #333",
                        borderRadius: 8,
                        color: "#fff",
                        textTransform: "capitalize",
                        fontSize: "0.85rem",
                      }}
                    >
                      {g}
                    </button>
                  ))}
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
          </div>
        </div>
      )}

      {/* MEAL MODAL */}
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
              }}
            >
              <Save size={16} style={{ display: "inline", marginRight: 6 }} />{" "}
              Save Meal
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="header-row">
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
            onClick={() => setIsSettingGoal(true)}
            style={{ color: "#3b82f6" }}
          >
            <Target size={20} />
          </button>
          <Link href="/dashboard">
            <button className="menu-btn" style={{ color: "var(--brand)" }}>
              <LayoutDashboard size={20} />
            </button>
          </Link>
          <button className="menu-btn" onClick={handleLogout}>
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <StatsBoard totals={totals} onAddWater={() => addFood("Water")} />

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
                  {cat.split(" ")[0]}
                </button>
              ))}
            </div>
          )}
          <div className="food-grid">
            {activeCategory === "Meals" && !query ? (
              <>
                <button
                  className="suggestion-chip"
                  style={{ border: "1px dashed #666", color: "#aaa" }}
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
                >
                  {(item.name || item).charAt(0).toUpperCase() +
                    (item.name || item).slice(1)}
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="timeline">
        <div className="timeline-label">
          Today's Entries{" "}
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
              padding: 20,
            }}
          >
            No items today
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="log-item">
              <div className="log-details">
                <h4>
                  {log.qty}x{" "}
                  <span style={{ color: "white", textTransform: "capitalize" }}>
                    {log.name}
                  </span>
                  {log.name === "Water" && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: "#3b82f6",
                        marginLeft: 6,
                      }}
                    >
                      (250ml)
                    </span>
                  )}
                </h4>
                <div>
                  <span>
                    <b>{log.calories}</b> kcal
                  </span>
                  {log.name !== "Water" && (
                    <span style={{ color: "var(--protein)" }}>
                      P:{log.protein}
                    </span>
                  )}
                </div>
              </div>
              <button
                className="delete-action"
                onClick={() => deleteLog(log.id)}
              >
                <X size={16} />
              </button>
            </div>
          ))
        )}
      </section>

      {/* SAVE BUTTON */}
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
