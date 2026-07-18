"use client";
import {
  Calendar,
  Droplets,
  BarChart2,
} from "lucide-react";
import {
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
const TrendCharts = ({
  calendarData,
  metrics,
  selectedDate,
  trendMetric,
  setTrendMetric,
  trendRange,
  setTrendRange,
  visibleTrendData,
  getTrendColor,
  getCurrentTarget,
  handleDateSelect,
}) => (
          <div className="chart-grid-container">
            <div
              className="chart-card trend-card-span"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                border: "1px solid #27272a",
                borderRadius: 16,
                background: "#18181b",
                minHeight: 350,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <BarChart2 size={18} color={getTrendColor()} /> History Trends
                </h3>
                <div style={{ display: "flex", gap: 10 }}>
                  <select
                    value={trendMetric}
                    onChange={(e) => setTrendMetric(e.target.value)}
                    style={{
                      background: "#000",
                      color: "#fff",
                      border: "1px solid #333",
                      padding: "6px 12px",
                      borderRadius: 8,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    <option value="calories">Calories</option>
                    <option value="weight">Weight</option>
                    <option value="protein">Protein</option>
                    <option value="carbs">Carbs</option>
                    <option value="fats">Fats</option>
                    <option value="fiber">Fiber</option>
                  </select>

                  <div
                    style={{
                      display: "flex",
                      background: "#000",
                      borderRadius: 8,
                      border: "1px solid #333",
                      padding: 2,
                    }}
                  >
                    <button
                      onClick={() => setTrendRange(7)}
                      style={{
                        padding: "4px 12px",
                        fontSize: "0.8rem",
                        background: trendRange === 7 ? "#333" : "transparent",
                        color: trendRange === 7 ? "#fff" : "#666",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontWeight: trendRange === 7 ? 600 : 400,
                      }}
                    >
                      7D
                    </button>
                    <button
                      onClick={() => setTrendRange(30)}
                      style={{
                        padding: "4px 12px",
                        fontSize: "0.8rem",
                        background: trendRange === 30 ? "#333" : "transparent",
                        color: trendRange === 30 ? "#fff" : "#666",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontWeight: trendRange === 30 ? 600 : 400,
                      }}
                    >
                      30D
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, width: "100%", minHeight: 250 }}>
                <ResponsiveContainer>
                  <LineChart data={visibleTrendData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#333"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#666"
                      tick={{ fill: "#666", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#666"
                      tick={{ fill: "#666", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      domain={
                        trendMetric === "weight"
                          ? ["auto", "auto"]
                          : [0, "auto"]
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#000",
                        border: "1px solid #333",
                        borderRadius: 8,
                        color: "#fff",
                      }}
                      itemStyle={{ color: getTrendColor() }}
                      formatter={(value) => [
                        `${value}${
                          trendMetric === "calories"
                            ? " kcal"
                            : trendMetric === "weight"
                              ? " kg"
                              : "g"
                        }`,
                        trendMetric.charAt(0).toUpperCase() +
                          trendMetric.slice(1),
                      ]}
                      labelStyle={{ color: "#888" }}
                    />
                    {getCurrentTarget() && (
                      <ReferenceLine
                        y={getCurrentTarget()}
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                        label={{
                          position: "top",
                          value: "Goal",
                          fill: "#ef4444",
                          fontSize: 12,
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey={trendMetric}
                      stroke={getTrendColor()}
                      strokeWidth={3}
                      connectNulls={true}
                      dot={{
                        r: 4,
                        fill: "#18181b",
                        stroke: getTrendColor(),
                        strokeWidth: 2,
                      }}
                      activeDot={{ r: 6, fill: getTrendColor() }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div
              className="chart-card"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                border: "1px solid #27272a",
                borderRadius: 16,
                background: "#18181b",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  marginBottom: 15,
                  display: "flex",
                  gap: 8,
                }}
              >
                <Calendar size={18} color="#22c55e" /> 30-Day Consistency
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 6,
                  flex: 1,
                }}
              >
                {calendarData.map((day, i) => (
                  <div
                    key={i}
                    onClick={() => handleDateSelect(day.date)}
                    style={{
                      aspectRatio: "1/1",
                      background: day.color,
                      borderRadius: 4,
                      cursor: "pointer",
                      opacity: day.date === selectedDate ? 1 : 0.4,
                      border:
                        day.date === selectedDate
                          ? "2px solid white"
                          : "1px solid transparent",
                      transition: "all 0.2s",
                    }}
                    title={`${day.date}: ${day.cals} kcal`}
                  ></div>
                ))}
              </div>
            </div>

            <div
              className="chart-card"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                border: "1px solid #27272a",
                borderRadius: 16,
                background: "#18181b",
              }}
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
                    fontSize: "1.1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontWeight: 700,
                  }}
                >
                  <Droplets size={20} color="#3b82f6" /> Hydration
                </h3>
                <span
                  style={{
                    fontSize: "0.9rem",
                    color: "#3b82f6",
                    background: "rgba(59, 130, 246, 0.1)",
                    padding: "4px 8px",
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                >
                  {Math.round(
                    (metrics.water.current / metrics.water.target) * 100,
                  ) || 0}
                  %
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 4,
                  marginBottom: 16,
                }}
              >
                <span
                  style={{ fontSize: "2.5rem", fontWeight: 800, color: "#fff" }}
                >
                  {metrics.water.current}L
                </span>
                <span style={{ fontSize: "1.2rem", color: "#666" }}>
                  / {metrics.water.target}L
                </span>
              </div>
              <div
                style={{
                  background: "#27272a",
                  height: 16,
                  borderRadius: 8,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      (metrics.water.current / metrics.water.target) * 100,
                    )}%`,
                    height: "100%",
                    background: "#3b82f6",
                    transition: "width 1s ease",
                  }}
                ></div>
              </div>
            </div>
          </div>
);
export default TrendCharts;
