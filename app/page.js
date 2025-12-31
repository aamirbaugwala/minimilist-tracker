"use client";

import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { X, Loader2, ChevronDown } from "lucide-react";
import { FOOD_CATEGORIES } from "./food-data"; // Import data

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  });

  // Load data
  useEffect(() => {
    const saved = localStorage.getItem("daily_logs");
    if (saved) {
      const parsedLogs = JSON.parse(saved);
      setLogs(parsedLogs);
      calculateTotals(parsedLogs);
    }
  }, []);

  const calculateTotals = (currentLogs) => {
    const newTotals = currentLogs.reduce(
      (acc, item) => ({
        calories: acc.calories + (Number(item.calories) || 0),
        protein: acc.protein + (Number(item.protein) || 0),
        carbs: acc.carbs + (Number(item.carbs) || 0),
        fats: acc.fats + (Number(item.fats) || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
    setTotals(newTotals);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({ query: input }),
      });
      let data = await res.json();

      if (data.error) {
        alert("Food not found! Try picking from the list.");
        setLoading(false);
        return;
      }

      // Parse quantity from input (e.g. '3 roti')
      let qty = 1;
      const match = input.trim().match(/^(\d+)\s+/);
      if (match) {
        qty = parseInt(match[1], 10);
      }
      if (qty > 1) {
        data = {
          ...data,
          calories: data.calories * qty,
          protein: data.protein * qty,
          carbs: data.carbs * qty,
          fats: data.fats * qty,
          name: `${qty} ${data.name}`,
        };
      }

      const updatedLogs = [data, ...logs];
      setLogs(updatedLogs);
      calculateTotals(updatedLogs);
      localStorage.setItem("daily_logs", JSON.stringify(updatedLogs));
      setInput("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    const updatedLogs = logs.filter((item) => item.id !== id);
    setLogs(updatedLogs);
    calculateTotals(updatedLogs);
    localStorage.setItem("daily_logs", JSON.stringify(updatedLogs));
  };

  // Quantity state for dropdown
  const [dropdownQty, setDropdownQty] = useState(1);
  // Helper to pre-fill input from dropdown with quantity
  const handleSelectChange = (e) => {
    if (e.target.value) {
      setInput(`${dropdownQty} ${e.target.value}`);
      setDropdownQty(1); // Reset to 1 after selection
    }
  };

  // Chart Data
  const data = [
    { name: "Protein", value: totals.protein, color: "#3b82f6" },
    { name: "Carbs", value: totals.carbs, color: "#22c55e" },
    { name: "Fats", value: totals.fats, color: "#f59e0b" },
  ];
  const isEmpty = totals.calories === 0;

  return (
    <main className="container">
      <header>
        <h1>Daily Intake</h1>
        <h2>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </h2>
      </header>

      {/* Stats Dashboard */}
      <section className="stats-grid">
        <div
          className="card"
          style={{ gridColumn: "span 2", padding: "1.5rem" }}
        >
          <div style={{ width: "100%", height: "160px", position: "relative" }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={isEmpty ? [{ value: 1 }] : data}
                  innerRadius={60}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {isEmpty ? (
                    <Cell fill="#333" />
                  ) : (
                    data.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))
                  )}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
              }}
            >
              <div
                style={{ fontSize: "2rem", fontWeight: "800", lineHeight: "1" }}
              >
                {totals.calories}
              </div>
              <div
                style={{ fontSize: "0.8rem", color: "#666", marginTop: "4px" }}
              >
                kcal
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <span className="macro-label" style={{ color: "#3b82f6" }}>
            Protein
          </span>
          <span className="macro-value">{totals.protein}g</span>
        </div>
        <div className="card">
          <span className="macro-label" style={{ color: "#22c55e" }}>
            Carbs
          </span>
          <span className="macro-value">{totals.carbs}g</span>
        </div>
        <div className="card">
          <span className="macro-label" style={{ color: "#f59e0b" }}>
            Fats
          </span>
          <span className="macro-value">{totals.fats}g</span>
        </div>
        <div className="card">
          <span className="macro-label">Items</span>
          <span className="macro-value">{logs.length}</span>
        </div>
      </section>

      {/* NEW: Smart Categorized Dropdown with Quantity */}
      <div style={{ marginBottom: "2rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <div style={{ flex: "0 0 70px" }}>
          <input
            type="number"
            min={1}
            value={dropdownQty}
            onChange={e => setDropdownQty(Math.max(1, Number(e.target.value)))}
            style={{
              width: "100%",
              padding: "0.7rem 0.5rem",
              backgroundColor: "#171717",
              border: "1px solid #333",
              color: "#ededed",
              borderRadius: "12px",
              fontSize: "0.9rem",
              textAlign: "center",
            }}
            aria-label="Quantity"
          />
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              right: "1rem",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "#666",
            }}
          >
            <ChevronDown size={16} />
          </div>
          <select
            onChange={handleSelectChange}
            style={{
              width: "100%",
              padding: "1rem",
              backgroundColor: "#171717",
              border: "1px solid #333",
              color: "#ededed",
              borderRadius: "12px",
              appearance: "none", // Hides default arrow to use custom icon
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Browse food list...
            </option>
            {Object.entries(FOOD_CATEGORIES).map(([category, items]) => (
              <optgroup
                key={category}
                label={category}
                style={{ color: "#a1a1a1", fontStyle: "normal" }}
              >
                {Object.keys(items).map((food) => (
                  <option key={food} value={food} style={{ color: "#ededed" }}>
                    {food.charAt(0).toUpperCase() + food.slice(1)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Input Area */}
      <form onSubmit={handleAdd} className="input-group">
        <input
          type="text"
          placeholder="Type e.g. '2 eggs' or pick below..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          autoFocus
        />
        <button type="submit" className="add-btn" disabled={loading || !input}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : "Add"}
        </button>
      </form>

      {/* Log History */}
      <div className="food-list">
        {logs.map((item) => (
          <div key={item.id} className="food-item">
            <div className="food-info">
              <h3>{item.name}</h3>
              <p>
                {item.calories} kcal <span style={{ margin: "0 4px" }}>•</span>
                <span style={{ color: "#3b82f6" }}>P: {item.protein}</span>{" "}
                <span style={{ color: "#22c55e" }}>C: {item.carbs}</span>{" "}
                <span style={{ color: "#f59e0b" }}>F: {item.fats}</span>
              </p>
            </div>
            <button
              onClick={() => handleDelete(item.id)}
              className="delete-btn"
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
