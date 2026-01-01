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
} from "lucide-react";
import { FOOD_CATEGORIES, FLATTENED_DB } from "./food-data";
import { supabase } from "./supabase"; // Import your client

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
  });
  const [recents, setRecents] = useState([]);

  // UI States
  const [qty, setQty] = useState(1);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Recent");
  const [email, setEmail] = useState(""); // For login
  const [authLoading, setAuthLoading] = useState(false);

  // --- INIT: CHECK AUTH & LOAD DATA ---
  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchData();
      else setLoading(false);
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchData();
      else {
        setLogs([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- DATABASE ACTIONS ---
  const fetchData = async () => {
    setLoading(true);
    const todayKey = new Date().toISOString().slice(0, 10);

    // Fetch TODAY's logs only
    const { data, error } = await supabase
      .from("food_logs")
      .select("*")
      .eq("date", todayKey)
      .order("created_at", { ascending: false });

    if (!error) setLogs(data);
    setLoading(false);
  };

  const addFood = async (foodName) => {
    if (!session) return alert("Please sign in to save data!");

    let foodData = FLATTENED_DB[foodName.toLowerCase()];
    if (!foodData) {
      const key = Object.keys(FLATTENED_DB).find((k) =>
        k.includes(foodName.toLowerCase())
      );
      if (key) foodData = FLATTENED_DB[key];
      else return alert("Item not found.");
    }

    const newLog = {
      name: foodName,
      qty: qty,
      calories: Math.round(foodData.calories * qty),
      protein: Math.round(foodData.protein * qty),
      carbs: Math.round(foodData.carbs * qty),
      fats: Math.round(foodData.fats * qty),
      date: new Date().toISOString().slice(0, 10),
      user_id: session.user.id,
    };

    // OPTIMISTIC UPDATE (Update UI immediately)
    const tempId = Math.random();
    setLogs([{ ...newLog, id: tempId }, ...logs]);

    // DB INSERT
    const { data, error } = await supabase
      .from("food_logs")
      .insert([newLog])
      .select();

    if (error) {
      alert("Error saving!");
      setLogs(logs); // Revert on error
    } else {
      // Replace temp ID with real DB ID
      setLogs([data[0], ...logs.filter((l) => l.id !== tempId)]);
    }

    // Save Recent locally (ok to keep local)
    const newRecents = [
      foodName,
      ...recents.filter((r) => r !== foodName),
    ].slice(0, 10);
    setRecents(newRecents);
    localStorage.setItem("recent_foods", JSON.stringify(newRecents));

    setQty(1);
    setQuery("");
  };

  const deleteLog = async (id) => {
    // Optimistic Delete
    const oldLogs = logs;
    setLogs(logs.filter((l) => l.id !== id));

    const { error } = await supabase.from("food_logs").delete().eq("id", id);
    if (error) {
      alert("Error deleting");
      setLogs(oldLogs);
    }
  };

  // --- AUTH ACTIONS ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert(error.message);
    else alert("Check your email for the login link!");
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- CALCS ---
  useEffect(() => {
    const t = logs.reduce(
      (acc, item) => ({
        calories: acc.calories + (Number(item.calories) || 0),
        protein: acc.protein + (Number(item.protein) || 0),
        carbs: acc.carbs + (Number(item.carbs) || 0),
        fats: acc.fats + (Number(item.fats) || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
    setTotals(t);
  }, [logs]);

  const getDisplayItems = () => {
    if (query)
      return Object.keys(FLATTENED_DB).filter((k) =>
        k.includes(query.toLowerCase())
      );
    if (activeCategory === "Recent") return recents;
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
            <h2 style={{ fontSize: "1.2rem", marginBottom: 8 }}>Sign In</h2>
            <p style={{ color: "#888", marginBottom: 20, fontSize: "0.9rem" }}>
              Enter your email to get a magic link. No passwords needed.
            </p>
            <form onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                {authLoading ? "Sending..." : "Send Magic Link"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <header className="header-row">
        <div>
          <h1 className="brand-title">NutriTrack.</h1>
          <div className="date-badge">Today</div>
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

      {/* --- BENTO STATS --- */}
      <section className="bento-grid">
        {/* Same Chart Code as before... */}
        <div className="stat-card-main">
          <div className="cal-info">
            <h3>Today's Calories</h3>
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
          <span className="macro-label">Protein</span>
          <span className="macro-val">{totals.protein}g</span>
        </div>
        <div className="macro-card">
          <span
            className="macro-icon"
            style={{ background: "var(--carbs)" }}
          ></span>
          <span className="macro-label">Carbs</span>
          <span className="macro-val">{totals.carbs}g</span>
        </div>
        <div className="macro-card">
          <span
            className="macro-icon"
            style={{ background: "var(--fats)" }}
          ></span>
          <span className="macro-label">Fats</span>
          <span className="macro-val">{totals.fats}g</span>
        </div>
      </section>

      {/* --- COMMAND CENTER --- */}
      <section className="command-center">
        {/* Same Command Center Code as before... */}
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
            {getDisplayItems().map((item) => (
              <button
                key={item}
                className="suggestion-chip"
                onClick={() => addFood(item)}
              >
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* --- LOG --- */}
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
                </h4>
                <div>
                  <span>
                    <b>{log.calories}</b> kcal
                  </span>
                  <span style={{ color: "var(--protein)" }}>
                    P:{log.protein}
                  </span>
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
