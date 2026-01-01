"use client";

import { useState, useEffect } from "react";
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
  ArrowRight,
  KeyRound,
  Flame,
  Droplets,
  Trash2,
  Save,
} from "lucide-react";
import { FOOD_CATEGORIES, FLATTENED_DB } from "./food-data";
import { supabase } from "./supabase";

export default function Home() {
  // --- STATE ---
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);

  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    water: 0,
  });

  const [recents, setRecents] = useState([]);

  // FEATURES STATE
  const [savedMeals, setSavedMeals] = useState([]);
  const [streak, setStreak] = useState(0);

  // MEAL BUILDER STATE (New)
  const [isCreatingMeal, setIsCreatingMeal] = useState(false);
  const [newMealName, setNewMealName] = useState("");
  const [mealBuilderItems, setMealBuilderItems] = useState([]); // Holds items for the meal being created
  const [mealBuilderQuery, setMealBuilderQuery] = useState(""); // Search inside the modal
  // Meal Edit State
  const [isEditingMeal, setIsEditingMeal] = useState(false);
  const [editMealId, setEditMealId] = useState(null);
  const [editMealName, setEditMealName] = useState("");
  const [editMealItems, setEditMealItems] = useState([]);
  const [editMealQuery, setEditMealQuery] = useState("");

  // UI States
  const [qty, setQty] = useState(1);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Recent");

  // Auth States
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // --- DATABASE ACTIONS ---
  const fetchData = async () => {
    setLoading(true);
    const todayKey = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("food_logs")
      .select("*")
      .eq("date", todayKey)
      .order("created_at", { ascending: false });

    if (!error) setLogs(data);
    setLoading(false);
  };

  const fetchSavedMeals = async () => {
    const { data } = await supabase.from("saved_meals").select("*");
    if (data) setSavedMeals(data);
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
      const diffTime = Math.abs(currentDate - prevDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        count++;
        currentDate = prevDate;
      } else {
        break;
      }
    }
    setStreak(count);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchData();
        fetchSavedMeals();
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
        fetchSavedMeals();
        calculateStreak();
      } else {
        setLogs([]);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // --- LOGGING ACTIONS (With Aggregation) ---
  const addFood = async (foodName, overrideQty = null) => {
    if (!session) return alert("Please sign in to save data!");

    const quantity = overrideQty || qty;
    const todayKey = new Date().toISOString().slice(0, 10);

    // 1. Get Base Data
    let baseData = { calories: 0, protein: 0, carbs: 0, fats: 0 };
    if (foodName !== "Water") {
      let dbData = FLATTENED_DB[foodName.toLowerCase()];
      if (!dbData) {
        const key = Object.keys(FLATTENED_DB).find((k) =>
          k.includes(foodName.toLowerCase())
        );
        if (key) dbData = FLATTENED_DB[key];
        else return alert("Item not found.");
      }
      baseData = dbData;
    }

    // 2. CHECK FOR EXISTING LOG (Aggregation Logic)
    const existingLog = logs.find(
      (l) => l.name === foodName && l.date === todayKey
    );

    if (existingLog) {
      // UPDATE EXISTING
      const newQty = Number(existingLog.qty) + Number(quantity);

      const updatedFields = {
        qty: newQty,
        calories: Math.round(baseData.calories * newQty),
        protein: Math.round(baseData.protein * newQty),
        carbs: Math.round(baseData.carbs * newQty),
        fats: Math.round(baseData.fats * newQty),
      };

      // Optimistic UI Update
      const updatedLogs = logs.map((l) =>
        l.id === existingLog.id ? { ...l, ...updatedFields } : l
      );
      setLogs(updatedLogs);

      // DB Update
      await supabase
        .from("food_logs")
        .update(updatedFields)
        .eq("id", existingLog.id);
    } else {
      // INSERT NEW
      const newLog = {
        name: foodName,
        qty: quantity,
        calories: Math.round(baseData.calories * quantity),
        protein: Math.round(baseData.protein * quantity),
        carbs: Math.round(baseData.carbs * quantity),
        fats: Math.round(baseData.fats * quantity),
        date: todayKey,
        user_id: session.user.id,
      };

      const tempId = Math.random();
      setLogs([{ ...newLog, id: tempId }, ...logs]);

      const { data, error } = await supabase
        .from("food_logs")
        .insert([newLog])
        .select();

      if (error) {
        alert("Error saving!");
        setLogs(logs); // Revert
      } else {
        setLogs([data[0], ...logs.filter((l) => l.id !== tempId)]);
      }

      // Update Recents only on new inserts
      if (foodName !== "Water") {
        const newRecents = [
          foodName,
          ...recents.filter((r) => r !== foodName),
        ].slice(0, 10);
        setRecents(newRecents);
        localStorage.setItem("recent_foods", JSON.stringify(newRecents));
      }
    }

    if (!overrideQty) {
      setQty(1);
      setQuery("");
    }
  };

  const deleteLog = async (id) => {
    const oldLogs = logs;
    setLogs(logs.filter((l) => l.id !== id));
    const { error } = await supabase.from("food_logs").delete().eq("id", id);
    if (error) {
      alert("Error deleting");
      setLogs(oldLogs);
    }
  };

  // --- NEW MEAL BUILDER ACTIONS ---

  // Add item to the *Draft* meal (inside modal)
  const addItemToBuilder = (foodName) => {
    const existing = mealBuilderItems.find((i) => i.name === foodName);
    if (existing) {
      setMealBuilderItems(
        mealBuilderItems.map((i) =>
          i.name === foodName ? { ...i, qty: i.qty + 1 } : i
        )
      );
    } else {
      setMealBuilderItems([...mealBuilderItems, { name: foodName, qty: 1 }]);
    }
  };

  const removeItemFromBuilder = (index) => {
    const newItems = [...mealBuilderItems];
    newItems.splice(index, 1);
    setMealBuilderItems(newItems);
  };

  const saveBuiltMeal = async () => {
    if (!newMealName) return alert("Enter a name!");
    if (mealBuilderItems.length === 0)
      return alert("Add some food items first!");

    const { data, error } = await supabase
      .from("saved_meals")
      .insert([
        {
          name: newMealName,
          items: mealBuilderItems,
          user_id: session.user.id,
        },
      ])
      .select();

    if (!error) {
      setSavedMeals([...savedMeals, data[0]]);
      setIsCreatingMeal(false);
      setNewMealName("");
      setMealBuilderItems([]);
      setMealBuilderQuery("");
      setActiveCategory("Meals");
    } else {
      alert(error.message);
    }
  };

  const loadMeal = async (meal) => {
    // Add all items in parallel, then refetch logs for UI consistency
    await Promise.all(meal.items.map((item) => addFood(item.name, item.qty)));
    await fetchData();
  };

  const deleteMeal = async (id) => {
    setSavedMeals(savedMeals.filter((m) => m.id !== id));
    await supabase.from("saved_meals").delete().eq("id", id);
  };

  // --- EDIT MEAL FEATURE ---
  const openEditMeal = (meal) => {
    setEditMealId(meal.id);
    setEditMealName(meal.name);
    setEditMealItems([...meal.items]);
    setEditMealQuery("");
    setIsEditingMeal(true);
  };

  const addItemToEditMeal = (foodName) => {
    const existing = editMealItems.find((i) => i.name === foodName);
    if (existing) {
      setEditMealItems(
        editMealItems.map((i) =>
          i.name === foodName ? { ...i, qty: i.qty + 1 } : i
        )
      );
    } else {
      setEditMealItems([...editMealItems, { name: foodName, qty: 1 }]);
    }
  };

  const removeItemFromEditMeal = (index) => {
    const newItems = [...editMealItems];
    newItems.splice(index, 1);
    setEditMealItems(newItems);
  };

  const saveEditedMeal = async () => {
    if (!editMealName) return alert("Enter a name!");
    if (editMealItems.length === 0) return alert("Add some food items first!");
    const { data, error } = await supabase
      .from("saved_meals")
      .update({ name: editMealName, items: editMealItems })
      .eq("id", editMealId)
      .select();
    if (!error) {
      setSavedMeals(
        savedMeals.map((m) =>
          m.id === editMealId
            ? { ...m, name: editMealName, items: editMealItems }
            : m
        )
      );
      setIsEditingMeal(false);
      setEditMealId(null);
      setEditMealName("");
      setEditMealItems([]);
      setEditMealQuery("");
    } else {
      alert(error.message);
    }
  };

  const getEditMealSuggestions = () => {
    if (editMealQuery)
      return Object.keys(FLATTENED_DB).filter((k) =>
        k.includes(editMealQuery.toLowerCase())
      );
    return recents;
  };

  // --- AUTH ---
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

  // --- HELPER: Filter for Meal Builder ---
  const getBuilderSuggestions = () => {
    if (mealBuilderQuery)
      return Object.keys(FLATTENED_DB).filter((k) =>
        k.includes(mealBuilderQuery.toLowerCase())
      );
    return recents;
  };

  // --- CALCS ---
  useEffect(() => {
    const t = logs.reduce(
      (acc, item) => ({
        calories: acc.calories + (Number(item.calories) || 0),
        protein: acc.protein + (Number(item.protein) || 0),
        carbs: acc.carbs + (Number(item.carbs) || 0),
        fats: acc.fats + (Number(item.fats) || 0),
        water: item.name === "Water" ? acc.water + item.qty : acc.water, // Water accumulates by qty now
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0, water: 0 }
    );
    setTotals(t);
  }, [logs]);

  const getDisplayItems = () => {
    if (query)
      return Object.keys(FLATTENED_DB).filter((k) =>
        k.includes(query.toLowerCase())
      );
    if (activeCategory === "Recent") return recents;
    if (activeCategory === "Meals") return savedMeals;
    return Object.keys(FOOD_CATEGORIES[activeCategory] || {});
  };

  // --- RENDER ---
  if (!session) {
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
                <p
                  style={{
                    color: "#888",
                    marginBottom: 20,
                    fontSize: "0.9rem",
                  }}
                >
                  Enter your email to receive a login code.
                </p>
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {authLoading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      Get Code <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode}>
                <h2 style={{ fontSize: "1.2rem", marginBottom: 8 }}>
                  Enter Code
                </h2>
                <p
                  style={{
                    color: "#888",
                    marginBottom: 20,
                    fontSize: "0.9rem",
                  }}
                >
                  Check your email for the code.
                </p>
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {authLoading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      Verify <KeyRound size={18} />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCodeSent(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    marginTop: 16,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Wrong email? Go back
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {/* MEAL BUILDER MODAL (New Interface) */}
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
              <h3 style={{ margin: 0 }}>Build a Meal</h3>
              <button
                onClick={() => setIsCreatingMeal(false)}
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

            {/* Name Input */}
            <input
              autoFocus
              placeholder="Meal Name (e.g. Protein Breakfast)"
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

            {/* Meal Items List */}
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
                    fontSize: "0.85rem",
                    textAlign: "center",
                    marginTop: 30,
                  }}
                >
                  No items added yet.
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
                      fontSize: "0.9rem",
                    }}
                  >
                    <span>
                      {item.qty}x{" "}
                      <span style={{ textTransform: "capitalize" }}>
                        {item.name}
                      </span>
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

            {/* Search to Add */}
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
                  placeholder="Search food to add..."
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
              }}
            >
              <Save
                size={16}
                style={{
                  display: "inline",
                  marginRight: 6,
                  verticalAlign: "text-bottom",
                }}
              />{" "}
              Save Meal
            </button>
          </div>
        </div>
      )}

      {/* MEAL EDIT MODAL */}
      {isEditingMeal && (
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
              <h3 style={{ margin: 0 }}>Edit Meal</h3>
              <button
                onClick={() => setIsEditingMeal(false)}
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
            {/* Name Input */}
            <input
              autoFocus
              placeholder="Meal Name"
              value={editMealName}
              onChange={(e) => setEditMealName(e.target.value)}
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
            {/* Meal Items List */}
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
              {editMealItems.length === 0 ? (
                <div
                  style={{
                    color: "#666",
                    fontSize: "0.85rem",
                    textAlign: "center",
                    marginTop: 30,
                  }}
                >
                  No items added yet.
                </div>
              ) : (
                editMealItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 0",
                      borderBottom: "1px solid #222",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span>
                      {item.qty}x{" "}
                      <span style={{ textTransform: "capitalize" }}>
                        {item.name}
                      </span>
                    </span>
                    <button
                      onClick={() => removeItemFromEditMeal(idx)}
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
            {/* Search to Add */}
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
                  placeholder="Search food to add..."
                  value={editMealQuery}
                  onChange={(e) => setEditMealQuery(e.target.value)}
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
              {editMealQuery && (
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
                  {getEditMealSuggestions().map((item) => (
                    <button
                      key={item}
                      onClick={() => addItemToEditMeal(item)}
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
              onClick={saveEditedMeal}
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
              <Save
                size={16}
                style={{
                  display: "inline",
                  marginRight: 6,
                  verticalAlign: "text-bottom",
                }}
              />{" "}
              Save Changes
            </button>
          </div>
        </div>
      )}

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

      {/* STATS */}
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
                          {
                            name: "P",
                            value: totals.protein,
                            color: "#3b82f6",
                          },
                          { name: "C", value: totals.carbs, color: "#10b981" },
                          { name: "F", value: totals.fats, color: "#f59e0b" },
                        ]
                  }
                  innerRadius={34}
                  outerRadius={45}
                  dataKey="value"
                  stroke="none"
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
          onClick={() => addFood("Water")}
          style={{
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              height: `${Math.min(100, totals.water * 7)}%`,
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

      {/* INPUT */}
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
                  onClick={() => setIsCreatingMeal(true)}
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
                    <span onClick={() => loadMeal(meal)}>{meal.name}</span>
                    <span style={{ display: "flex", gap: 4 }}>
                      <span
                        onClick={() => openEditMeal(meal)}
                        style={{
                          color: "#3b82f6",
                          borderLeft: "1px solid #444",
                          paddingLeft: 6,
                          cursor: "pointer",
                        }}
                        title="Edit"
                      >
                        <Save size={12} />
                      </span>
                      <span
                        onClick={() => deleteMeal(meal.id)}
                        style={{
                          color: "#666",
                          borderLeft: "1px solid #444",
                          paddingLeft: 6,
                          cursor: "pointer",
                        }}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </span>
                    </span>
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

      {/* LOG LIST */}
      <section className="timeline">
        <div className="timeline-label">Today's Entries</div>
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
    </div>
  );
}
