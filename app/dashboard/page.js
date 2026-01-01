"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ArrowLeft, MousePointer2, RefreshCw, Loader2, Calendar } from "lucide-react";
import { supabase } from "../supabase"; // Import Supabase client

// --- COLORS ---
const COLORS = {
  pro: "#3b82f6",
  carb: "#10b981",
  fat: "#f59e0b",
  selected: "#6366f1",
  dim: "#3f3f46",
};

// --- CUSTOM TOOLTIP ---
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "#09090b",
          border: "1px solid #333",
          borderRadius: "12px",
          padding: "12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          pointerEvents: "none",
        }}
      >
        <p
          style={{
            color: "#fff",
            fontSize: "0.9rem",
            marginBottom: "6px",
            fontWeight: 600,
          }}
        >
          {label}
        </p>
        {payload.map((entry, index) => (
          <div
            key={index}
            style={{
              color: entry.color,
              fontSize: "0.85rem",
              display: "flex",
              gap: 8,
            }}
          >
            <span>{entry.name}:</span>
            <span style={{ fontWeight: 700 }}>{entry.value}</span>
          </div>
        ))}
        <div
          style={{
            marginTop: 8,
            fontSize: "0.7rem",
            color: "#666",
            fontStyle: "italic",
          }}
        >
          Tap bar for details
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const router = useRouter();
  const [allLogs, setAllLogs] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Interactive State
  const [timeRange, setTimeRange] = useState("week"); // 'week' | 'month'
  const [selectedDay, setSelectedDay] = useState(null);

  // Derived Metrics
  const [displayMetrics, setDisplayMetrics] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    label: "Loading...",
  });

  // 1. Load Data from Supabase
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      // Check Session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/"); // Redirect if not logged in
        return;
      }

      // Calculate date 30 days ago (max range needed)
      const d = new Date();
      d.setDate(d.getDate() - 30);
      const thirtyDaysAgo = d.toISOString().slice(0, 10);

      // Fetch from DB
      const { data, error } = await supabase
        .from("food_logs")
        .select("*")
        .gte("date", thirtyDaysAgo)
        .order("date", { ascending: true });

      if (error) {
        console.error("Error fetching logs:", error);
      } else {
        setAllLogs(data || []);
        processData(data || [], timeRange);
      }
      setLoading(false);
    };

    loadData();
  }, []);

  // Re-process when timeRange changes (using memory, not re-fetching)
  useEffect(() => {
    if (!loading) {
      processData(allLogs, timeRange);
    }
  }, [timeRange, loading]);

  // 2. Handle Selection Updates
  useEffect(() => {
    if (selectedDay) {
      // SHOW CLICKED DAY
      setDisplayMetrics({
        calories: selectedDay.Calories,
        protein: selectedDay.Protein,
        carbs: selectedDay.Carbs,
        fats: selectedDay.Fats,
        label: selectedDay.fullDate,
      });
    } else {
      // SHOW AVERAGES (Default)
      if (chartData.length === 0) {
        setDisplayMetrics({
          calories: 0,
          protein: 0,
          carbs: 0,
          fats: 0,
          label: "No Data",
        });
        return;
      }
      const avg = (key) =>
        Math.round(
          chartData.reduce((a, b) => a + b[key], 0) / chartData.length
        ) || 0;

      setDisplayMetrics({
        calories: avg("Calories"),
        protein: avg("Protein"),
        carbs: avg("Carbs"),
        fats: avg("Fats"),
        label: `Daily Average (${
          timeRange === "week" ? "Last 7 Days" : "Last 30 Days"
        })`,
      });
    }
  }, [selectedDay, chartData, timeRange]);

  const processData = (logs, range) => {
    const daysBack = range === "week" ? 7 : 30;
    const days = [...Array(daysBack)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (daysBack - 1 - i));
      return d.toISOString().slice(0, 10);
    });

    const processed = days.map((dateKey) => {
      const dayLogs = logs.filter((l) => l.date === dateKey);
      const dObj = new Date(dateKey);
      return {
        dateKey,
        day: dObj.toLocaleDateString("en-US", {
          weekday: "short",
          day: range === "month" ? "numeric" : undefined,
        }),
        fullDate: dObj.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        }),
        Calories: dayLogs.reduce((a, b) => a + (Number(b.calories) || 0), 0),
        Protein: dayLogs.reduce((a, b) => a + (Number(b.protein) || 0), 0),
        Carbs: dayLogs.reduce((a, b) => a + (Number(b.carbs) || 0), 0),
        Fats: dayLogs.reduce((a, b) => a + (Number(b.fats) || 0), 0),
      };
    });

    setChartData(processed);
    setSelectedDay(null);
  };

  const visibleLogs = selectedDay
    ? allLogs.filter((l) => l.date === selectedDay.dateKey)
    : [];

  const macroData = [
    { name: "Protein", value: displayMetrics.protein, color: COLORS.pro },
    { name: "Carbs", value: displayMetrics.carbs, color: COLORS.carb },
    { name: "Fats", value: displayMetrics.fats, color: COLORS.fat },
  ];

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          color: "#666",
        }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="app-wrapper" style={{ maxWidth: 800, margin: "0 auto" }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={() => router.back()}
            style={{
              background: "none",
              border: "none",
              color: "#aaa",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ArrowLeft size={18} /> Back
          </button>

          <div
            style={{
              background: "#27272a",
              padding: 4,
              borderRadius: 12,
              display: "flex",
              gap: 4,
            }}
          >
            <button
              onClick={() => setTimeRange("week")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: "0.85rem",
                background: timeRange === "week" ? "#09090b" : "transparent",
                color: timeRange === "week" ? "#fff" : "#aaa",
              }}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeRange("month")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: "0.85rem",
                background: timeRange === "month" ? "#09090b" : "transparent",
                color: timeRange === "month" ? "#fff" : "#aaa",
              }}
            >
              30 Days
            </button>
          </div>
        </div>

        <div>
          <h1
            style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-1px" }}
          >
            Insights
          </h1>
          <p style={{ color: "#666" }}>
            {selectedDay
              ? "Viewing details for a specific day."
              : "Tap any bar below to inspect that day."}
          </p>
        </div>
      </div>

      {/* MAIN CHART */}
      <section
        className="chart-card full-width"
        style={{
          padding: 20,
          marginBottom: 20,
          transition: "0.3s",
          border: selectedDay ? "1px solid #6366f1" : "1px solid #27272a",
        }}
      >
        <div className="chart-header">
          <div>
            <div
              className="chart-title"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <MousePointer2
                size={16}
                color={selectedDay ? "#6366f1" : "#666"}
              />
              {selectedDay ? "Viewing Single Day" : "Calorie Trend"}
            </div>
            <div
              style={{
                color: selectedDay ? "#fff" : "#666",
                fontSize: "0.9rem",
                marginTop: 4,
              }}
            >
              {displayMetrics.label}
            </div>
          </div>
          {selectedDay && (
            <button
              onClick={() => setSelectedDay(null)}
              style={{
                background: "#27272a",
                border: "none",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: 20,
                cursor: "pointer",
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <RefreshCw size={12} /> Reset to Avg
            </button>
          )}
        </div>

        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#27272a"
              />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#52525b", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#52525b", fontSize: 12 }}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
              />
              <Bar
                dataKey="Calories"
                radius={[4, 4, 4, 4]}
                cursor="pointer"
                onClick={(data) => setSelectedDay(data)}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      selectedDay && selectedDay.dateKey === entry.dateKey
                        ? COLORS.selected
                        : COLORS.dim
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* METRICS & LOGS */}
      <div className="dashboard-grid">
        {/* Macro Pie Chart */}
        <section className="chart-card">
          <div className="chart-title" style={{ marginBottom: 12 }}>
            Macro Split
          </div>
          <div style={{ width: "100%", height: 180, position: "relative" }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={macroData}
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {macroData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
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
                style={{ fontSize: "1.5rem", fontWeight: 800, lineHeight: 1 }}
              >
                {displayMetrics.protein}g
              </div>
              <div style={{ fontSize: "0.7rem", color: "#666" }}>Protein</div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 12,
              fontSize: "0.8rem",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ color: COLORS.pro, fontWeight: 700 }}>
                {displayMetrics.protein}g
              </div>
              <div style={{ color: "#555" }}>Protein</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: COLORS.carb, fontWeight: 700 }}>
                {displayMetrics.carbs}g
              </div>
              <div style={{ color: "#555" }}>Carb</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: COLORS.fat, fontWeight: 700 }}>
                {displayMetrics.fats}g
              </div>
              <div style={{ color: "#555" }}>Fat</div>
            </div>
          </div>
        </section>

        {/* Detailed Logs List */}
        <section
          className="chart-card"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <div className="chart-header" style={{ marginBottom: 10 }}>
            <div className="chart-title">
              {selectedDay ? "Eaten that day" : "Drill Down"}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              maxHeight: 240,
              paddingRight: 4,
            }}
          >
            {selectedDay ? (
              visibleLogs.length > 0 ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {visibleLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "10px",
                        background: "#27272a",
                        borderRadius: 8,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "0.9rem",
                            textTransform: "capitalize",
                            color: "#fff",
                          }}
                        >
                          {log.qty}x {log.name}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#aaa" }}>
                          <span style={{ color: COLORS.pro }}>
                            P:{log.protein}
                          </span>{" "}
                          •{" "}
                          <span style={{ color: COLORS.carb }}>
                            C:{log.carbs}
                          </span>{" "}
                          •{" "}
                          <span style={{ color: COLORS.fat }}>
                            F:{log.fats}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#fff",
                          fontSize: "0.9rem",
                        }}
                      >
                        {log.calories}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{ textAlign: "center", color: "#666", marginTop: 40 }}
                >
                  No logs found.
                </div>
              )
            ) : (
              <div
                style={{
                  textAlign: "center",
                  color: "#666",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  gap: 12,
                }}
              >
                <Calendar size={32} style={{ opacity: 0.5 }} />
                <p style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
                  Select a day on the graph to see your food list for that
                  specific date.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
