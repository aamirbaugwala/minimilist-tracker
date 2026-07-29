"use client";

import { useState } from "react";
import {
  Search,
  Plus,
  X,
  Loader2,
  Trash2,
  Pencil,
  Sparkles,
  Globe,
  PlusCircle,
  ChevronDown,
  Check,
} from "lucide-react";
import { FOOD_CATEGORIES } from "../food-data";
import { MEALS } from "../lib/mealPeriod";

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

export default function FoodLogger({
  query,
  setQuery,
  qty,
  setQty,
  selectedMeal,
  setSelectedMeal,
  activeCategory,
  setActiveCategory,
  aiMealPlan,
  setAiMealPlan,
  aiMealPlanLoading,
  fetchAiMealPlan,
  COMBINED_DB,
  getDisplayItems,
  savedMeals,
  openMealBuilder,
  loadMeal,
  deleteMeal,
  addFood,
  saveCustomFoodToDb,
  manualFood,
  setManualFood,
  setIsManualEntryOpen,
}) {
  const [mealOpen, setMealOpen] = useState(false);
  const activeMeal = MEALS.find((m) => m.label === selectedMeal) || MEALS[0];

  return (
      <section className="command-center">
        {/* Section label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={14} color="#555" />
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#555",
                textTransform: "uppercase",
                letterSpacing: 1.2,
              }}
            >
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
                  padding: "3px 9px",
                  borderRadius: 8,
                  border: "none",
                  background: qty === v ? "#3b82f6" : "#1e1e26",
                  color: qty === v ? "#fff" : "#555",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {v}×
              </button>
            ))}
          </div>
        </div>

        {/* Meal picker — compact, sticky pill. Defaults to the time-appropriate
            meal but stays on whatever you last chose (so batch-logging a whole
            day at night works: pick Breakfast, log, switch to Lunch, …). */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: "0.72rem", color: "#52525b", fontWeight: 600, flexShrink: 0 }}>
            Logging to
          </span>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMealOpen((o) => !o)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 10px 6px 11px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#fff",
                border: "1px solid rgba(59,130,246,0.4)",
                background: "rgba(59,130,246,0.12)",
                transition: "background 0.15s",
              }}
            >
              <span style={{ fontSize: "0.95rem", lineHeight: 1 }}>{activeMeal.icon}</span>
              {activeMeal.label}
              <ChevronDown
                size={14}
                color="#93b4f7"
                style={{
                  transform: mealOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s",
                }}
              />
            </button>

            {mealOpen && (
              <>
                {/* click-away backdrop */}
                <div
                  onClick={() => setMealOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 30 }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    zIndex: 31,
                    minWidth: 168,
                    background: "#17171d",
                    border: "1px solid #2a2a33",
                    borderRadius: 14,
                    padding: 5,
                    boxShadow: "0 18px 44px -14px rgba(0,0,0,0.85)",
                    animation: "nt-pop 0.14s ease both",
                  }}
                >
                  {MEALS.map((m) => {
                    const isActive = selectedMeal === m.label;
                    return (
                      <button
                        key={m.label}
                        onClick={() => {
                          setSelectedMeal(m.label);
                          setMealOpen(false);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 10px",
                          borderRadius: 10,
                          cursor: "pointer",
                          border: "none",
                          background: isActive ? "rgba(59,130,246,0.14)" : "transparent",
                          color: isActive ? "#fff" : "#c4c4cc",
                          fontSize: "0.85rem",
                          fontWeight: isActive ? 700 : 500,
                          textAlign: "left",
                        }}
                      >
                        <span style={{ fontSize: "1rem", lineHeight: 1 }}>{m.icon}</span>
                        <span style={{ flex: 1 }}>{m.label}</span>
                        {isActive && <Check size={15} color="#3b82f6" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Search row — the qty stepper used to live here and duplicated the
            0.5/1/2/3× presets above; dropped it so the search bar owns the row. */}
        <div className="input-row" style={{ display: "flex", gap: 8 }}>
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
                style={{
                  background: "none",
                  border: "none",
                  color: "#555",
                  cursor: "pointer",
                  padding: "0 8px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setManualFood({ ...manualFood, name: query });
              setIsManualEntryOpen(true);
            }}
            style={{
              background: "#111116",
              border: "1px solid #27272a",
              color: "#3b82f6",
              borderRadius: 12,
              padding: "0 12px",
              display: "flex",
              alignItems: "center",
              gap: 5,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.8rem",
              flexShrink: 0,
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
                  id: "Smart",
                  label: "Smart Recs",
                  icon: "✨",
                  color: "#8b5cf6",
                  activeBg: "rgba(139,92,246,0.2)",
                  activeBorder: "#8b5cf6",
                  onClick: () => {
                    setActiveCategory("Smart");
                    if (!aiMealPlan && !aiMealPlanLoading) fetchAiMealPlan();
                  },
                },
                { id: "Recent", label: "Recent", icon: "🕐", color: "#fff" },
                { id: "Meals", label: "Meals", icon: "🍱", color: "#fff" },
              ].map(
                ({
                  id,
                  label,
                  icon,
                  color,
                  activeBg,
                  activeBorder,
                  onClick,
                }) => {
                  const isActive = activeCategory === id;
                  return (
                    <button
                      key={id}
                      className={`suggestion-chip ${isActive ? "active" : ""}`}
                      onClick={onClick || (() => setActiveCategory(id))}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        border: isActive
                          ? `1px solid ${activeBorder || "#3b82f6"}`
                          : "1px solid #1e1e26",
                        background: isActive
                          ? activeBg || "rgba(59,130,246,0.15)"
                          : "#111116",
                        color: isActive ? color : "#555",
                        fontWeight: isActive ? 700 : 500,
                        fontSize: "0.8rem",
                        padding: "6px 12px",
                        borderRadius: 20,
                        transition: "all 0.15s",
                        flexShrink: 0,
                      }}
                    >
                      <span>{icon}</span> {label}
                    </button>
                  );
                },
              )}
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
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      border: isActive
                        ? "1px solid #3b82f6"
                        : "1px solid #1e1e26",
                      background: isActive
                        ? "rgba(59,130,246,0.12)"
                        : "#111116",
                      color: isActive ? "#fff" : "#555",
                      fontWeight: isActive ? 700 : 500,
                      fontSize: "0.8rem",
                      padding: "6px 12px",
                      borderRadius: 20,
                      transition: "all 0.15s",
                      flexShrink: 0,
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
                query ||
                activeCategory === "Meals" ||
                activeCategory === "Smart"
                  ? "1fr"
                  : "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            {activeCategory === "Smart" && !query ? (
              <div style={{ padding: "4px 0" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.8rem",
                      color: "#8b5cf6",
                      fontWeight: 700,
                    }}
                  >
                    <Sparkles size={13} color="#8b5cf6" />
                    NutriCoach · AI Meal Plan
                  </div>
                  <button
                    onClick={() => {
                      setAiMealPlan(null);
                      fetchAiMealPlan();
                    }}
                    disabled={aiMealPlanLoading}
                    style={{
                      background: "transparent",
                      border: "1px solid #27272a",
                      color: "#666",
                      cursor: aiMealPlanLoading ? "wait" : "pointer",
                      padding: "3px 10px",
                      borderRadius: 8,
                      fontSize: "0.72rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {aiMealPlanLoading ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Sparkles size={11} />
                    )}
                    {aiMealPlanLoading ? "Thinking…" : "Regenerate"}
                  </button>
                </div>

                {aiMealPlanLoading && !aiMealPlan && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "14px 0",
                      color: "#666",
                      fontSize: "0.85rem",
                    }}
                  >
                    <Loader2
                      size={16}
                      className="animate-spin"
                      color="#8b5cf6"
                    />
                    <span>Agent is building your personalized meal plan…</span>
                  </div>
                )}

                {aiMealPlan &&
                  (() => {
                    const planText = aiMealPlan.text.toLowerCase();
                    const matched = Object.keys(COMBINED_DB)
                      .filter((k) => planText.includes(k))
                      .sort((a, b) => b.length - a.length)
                      .slice(0, 8);
                    return (
                      <>
                        <div
                          style={{
                            background: "rgba(139,92,246,0.06)",
                            border: "1px solid rgba(139,92,246,0.25)",
                            borderRadius: 12,
                            padding: "14px 16px",
                            fontSize: "0.88rem",
                            color: "#ddd",
                            lineHeight: 1.7,
                            whiteSpace: "pre-wrap",
                            marginBottom: matched.length > 0 ? 12 : 0,
                          }}
                        >
                          {aiMealPlan.text}
                        </div>
                        {matched.length > 0 && (
                          <div>
                            <div
                              style={{
                                fontSize: "0.72rem",
                                color: "#666",
                                marginBottom: 8,
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <Sparkles size={11} color="#8b5cf6" /> Found in
                              your DB — tap to log:
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                              }}
                            >
                              {matched.map((key) => {
                                const item = COMBINED_DB[key];
                                return (
                                  <button
                                    key={key}
                                    onClick={() => addFood(key)}
                                    className="suggestion-chip"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      width: "100%",
                                      border: "1px solid rgba(139,92,246,0.4)",
                                      background: "rgba(139,92,246,0.08)",
                                      padding: "10px 14px",
                                      borderRadius: 10,
                                      cursor: "pointer",
                                      textAlign: "left",
                                      height: "auto",
                                      whiteSpace: "normal",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                      }}
                                    >
                                      <Sparkles size={11} color="#8b5cf6" />
                                      <span
                                        style={{
                                          fontWeight: 600,
                                          color: "#fff",
                                          fontSize: "0.85rem",
                                          textTransform: "capitalize",
                                        }}
                                      >
                                        {key}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 8,
                                        alignItems: "center",
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: 6,
                                          fontSize: "0.7rem",
                                        }}
                                      >
                                        <span style={{ color: "#a78bfa" }}>
                                          {item.calories} kcal
                                        </span>
                                        <span style={{ color: "#3b82f6" }}>
                                          P:{item.protein}g
                                        </span>
                                      </div>
                                      <div
                                        style={{
                                          background: "#8b5cf6",
                                          color: "#fff",
                                          borderRadius: 6,
                                          padding: "2px 8px",
                                          fontSize: "0.7rem",
                                          fontWeight: 700,
                                        }}
                                      >
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
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#555",
                              marginTop: 6,
                            }}
                          >
                            💡 None of the suggested foods are in your DB yet.
                            Search for them above or add via Custom.
                          </div>
                        )}
                      </>
                    );
                  })()}

                {!aiMealPlanLoading && !aiMealPlan && (
                  <div
                    style={{
                      color: "#555",
                      fontSize: "0.85rem",
                      padding: "10px 0",
                    }}
                  >
                    Tap <strong style={{ color: "#8b5cf6" }}>Smart Recs</strong>{" "}
                    to generate your AI meal plan.
                  </div>
                )}
              </div>
            ) : activeCategory === "Meals" && !query ? (
              <>
                <button
                  className="suggestion-chip"
                  style={{
                    border: "1px dashed #333",
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
                        borderLeft: "1px solid #333",
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
              /* ── Regular food chips — now with calorie badge ───── */
              getDisplayItems().map((item) => {
                const foodName = typeof item === "string" ? item : item.name;
                const cals =
                  typeof item === "object" && item.calories !== undefined
                    ? item.calories
                    : null;
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
                  typeof item === "object" && item.fiber !== undefined
                    ? item.fiber
                    : null;

                const isMeal = activeCategory === "Meals" && !query;
                const isSmart = item.isSmart === true;
                const isWeb = item.isWeb === true;
                const isNoRes = item.id === "no-res";
                const displayLabel = isMeal || isSmart ? item.name : foodName;
                const isListView = !!query || isMeal || isSmart || isWeb;

                return (
                  <button
                    key={item.id || displayLabel}
                    className="suggestion-chip"
                    onClick={() => {
                      if (isNoRes) {
                        setIsManualEntryOpen(true);
                        return;
                      }
                      if (isMeal) loadMeal(item);
                      else if (isSmart) loadMeal(item);
                      else if (isWeb) {
                        const webItemData = {
                          name: displayLabel,
                          calories: item.calories,
                          protein: item.protein,
                          carbs: item.carbs,
                          fats: item.fats,
                          fiber: item.fiber,
                        };
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
                      border: isSmart
                        ? "1px solid #8b5cf6"
                        : isWeb
                          ? "1px dashed #3b82f6"
                          : "1px solid #1e1e26",
                      background: isSmart
                        ? "rgba(139,92,246,0.1)"
                        : "linear-gradient(180deg, #15151b, #0f0f13)",
                      borderRadius: 14,
                      transition: "border-color 0.15s",
                    }}
                  >
                    {/* Left: name + macro row */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          textTransform: "capitalize",
                        }}
                      >
                        {isSmart && <Sparkles size={11} color="#8b5cf6" />}
                        {isWeb && !isNoRes && (
                          <Globe size={11} color="#3b82f6" />
                        )}
                        {displayLabel.charAt(0).toUpperCase() +
                          displayLabel.slice(1)}
                      </span>
                      {p !== null && !isMeal && !isNoRes && (
                        <div
                          style={{
                            fontSize: "0.62rem",
                            marginTop: 3,
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ color: "#3b82f6" }}>P:{p}g</span>
                          <span style={{ color: "#f59e0b" }}>C:{c}g</span>
                          <span style={{ color: "#ef4444" }}>F:{f}g</span>
                          <span style={{ color: "#22c55e" }}>Fib:{fib}g</span>
                        </div>
                      )}
                      {isWeb && !isNoRes && (
                        <span
                          style={{
                            fontSize: "0.6rem",
                            color: "#555",
                            marginTop: 2,
                            display: "block",
                          }}
                        >
                          Web estimate · will be saved
                        </span>
                      )}
                    </div>

                    {/* Right: calorie badge — warm "energy" accent, number-first */}
                    {cals !== null && !isNoRes && !isMeal && (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "baseline",
                          gap: 2,
                          background:
                            "linear-gradient(135deg, rgba(245,158,11,0.16), rgba(239,68,68,0.12))",
                          border: "1px solid rgba(245,158,11,0.28)",
                          borderRadius: 9,
                          padding: "3px 9px",
                          flexShrink: 0,
                          color: "#f7c56b",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ fontSize: "0.82rem", fontWeight: 800 }}>{cals}</span>
                        <span style={{ fontSize: "0.56rem", fontWeight: 700, opacity: 0.8 }}>
                          kcal
                        </span>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>
  );
}
