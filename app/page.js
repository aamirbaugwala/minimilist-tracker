"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link"; // <--- NEW IMPORT
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Search,
  Plus,
  Minus,
  X,
  Download,
  Upload,
  Save,
  FileJson,
  LayoutDashboard,
} from "lucide-react"; // <--- ADDED LayoutDashboard
import { FOOD_CATEGORIES, FLATTENED_DB } from "./food-data";

export default function Home() {
  // --- STATE ---
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

  // Persistence States
  const [showImportModal, setShowImportModal] = useState(true);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const fileInputRef = useRef(null);

  // --- INIT ---
  useEffect(() => {
    const hasData = localStorage.getItem("all_logs");
    if (!hasData) {
      setShowImportModal(true);
    } else {
      setShowImportModal(true);
    }
  }, []);

  // Recalculate totals whenever logs change
  useEffect(() => {
    calculateTotals(logs);
  }, [logs]);

  const calculateTotals = (data) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const todaysLogs = data.filter((item) => item.date === todayKey);

    const t = todaysLogs.reduce(
      (acc, item) => ({
        calories: acc.calories + (Number(item.calories) || 0),
        protein: acc.protein + (Number(item.protein) || 0),
        carbs: acc.carbs + (Number(item.carbs) || 0),
        fats: acc.fats + (Number(item.fats) || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
    setTotals(t);
  };

  // --- CORE ACTIONS ---
  const addFood = (foodName) => {
    let foodData = FLATTENED_DB[foodName.toLowerCase()];
    if (!foodData) {
      const key = Object.keys(FLATTENED_DB).find((k) =>
        k.includes(foodName.toLowerCase())
      );
      if (key) foodData = FLATTENED_DB[key];
      else return alert("Item not found.");
    }

    const newLog = {
      id: crypto.randomUUID(),
      name: foodName,
      qty: qty,
      calories: Math.round(foodData.calories * qty),
      protein: Math.round(foodData.protein * qty),
      carbs: Math.round(foodData.carbs * qty),
      fats: Math.round(foodData.fats * qty),
      date: new Date().toISOString().slice(0, 10),
      timestamp: Date.now(),
    };

    const newLogs = [newLog, ...logs];
    setLogs(newLogs);

    localStorage.setItem("all_logs", JSON.stringify(newLogs));

    const newRecents = [
      foodName,
      ...recents.filter((r) => r !== foodName),
    ].slice(0, 10);
    setRecents(newRecents);
    localStorage.setItem("recent_foods", JSON.stringify(newRecents));

    setQty(1);
    setQuery("");
    setUnsavedChanges(true);
  };

  const deleteLog = (id) => {
    const newLogs = logs.filter((l) => l.id !== id);
    setLogs(newLogs);
    localStorage.setItem("all_logs", JSON.stringify(newLogs));
    setUnsavedChanges(true);
  };

  // --- FILE HANDLING ---
  const handleDownload = () => {
    const dataStr = JSON.stringify(logs);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `nutritrack_backup_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setUnsavedChanges(false);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const importedData = JSON.parse(ev.target.result);
        if (!Array.isArray(importedData)) throw new Error("Invalid Format");

        setLogs(importedData);
        localStorage.setItem("all_logs", JSON.stringify(importedData));
        setShowImportModal(false);
      } catch (err) {
        alert("Could not load file. Ensure it is a valid backup.");
      }
    };
    reader.readAsText(file);
  };

  const getDisplayItems = () => {
    if (query)
      return Object.keys(FLATTENED_DB).filter((k) =>
        k.includes(query.toLowerCase())
      );
    if (activeCategory === "Recent") return recents;
    return Object.keys(FOOD_CATEGORIES[activeCategory] || {});
  };

  return (
    <div className="app-wrapper">
      {/* 1. IMPORT MODAL */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <FileJson size={48} color="var(--brand)" />
            </div>
            <h2 className="modal-title">Welcome Back!</h2>
            <p className="modal-desc">
              Would you like to import your previous data to continue where you
              left off?
            </p>
            <div className="modal-actions">
              <button
                className="btn-primary"
                onClick={() => fileInputRef.current.click()}
              >
                <Upload
                  size={18}
                  style={{ display: "inline", marginRight: 8 }}
                />
                Import Backup File
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  const cached = localStorage.getItem("all_logs");
                  if (cached) setLogs(JSON.parse(cached));
                  setShowImportModal(false);
                }}
              >
                No, Use Device Cache
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. AUTO-SAVE PROMPT */}
      {unsavedChanges && (
        <button className="save-prompt" onClick={handleDownload}>
          <Save size={20} />
          <span>Tap to Save Data</span>
        </button>
      )}

      <input
        type="file"
        ref={fileInputRef}
        hidden
        onChange={handleImport}
        accept=".json"
      />

      {/* --- HEADER --- */}
      <header className="header-row">
        <div>
          <h1 className="brand-title">NutriTrack.</h1>
          <div className="date-badge">Today</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* --- NEW DASHBOARD BUTTON --- */}
          <Link href="/dashboard">
            <button
              className="menu-btn"
              style={{ color: "var(--brand)" }}
              title="Go to Dashboard"
            >
              <LayoutDashboard size={20} />
            </button>
          </Link>
          {/* ---------------------------- */}
          <button
            className="menu-btn"
            onClick={() => fileInputRef.current.click()}
          >
            <Upload size={20} />
          </button>
          <button className="menu-btn" onClick={handleDownload}>
            <Download size={20} />
          </button>
        </div>
      </header>

      {/* --- BENTO STATS --- */}
      <section className="bento-grid">
        <div className="stat-card-main">
          <div className="cal-info">
            <h3>Today&apos;s Calories</h3>
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
        <div className="timeline-label">Today&apos;s Entries</div>
        {logs.filter((l) => l.date === new Date().toISOString().slice(0, 10))
          .length === 0 ? (
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
          logs
            .filter((l) => l.date === new Date().toISOString().slice(0, 10))
            .map((log) => (
              <div key={log.id} className="log-item">
                <div className="log-details">
                  <h4>
                    {log.qty}x{" "}
                    <span
                      style={{ color: "white", textTransform: "capitalize" }}
                    >
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
