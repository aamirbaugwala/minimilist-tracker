"use client";
import {
  User,
  Database,
  Zap,
  Scale,
  Utensils,
  TrendingUp,
  Flame,
  PenLine,
  Target,
  UtensilsCrossed,
  HeartPulse,
  SaveAll,
} from "lucide-react";
const COLORS = {
  pro: "#3b82f6",
  carb: "#FFC107",
  fat: "#ef4444",
  fib: "#10b981",
  cals: "#a855f7",
  weight: "#ec4899",
};

// ─── TOOL BADGE METADATA ──────────────────────────────────────────────────────
const TOOL_META = {
  get_todays_logs:      { label: "Read Today's Logs",    icon: Utensils,       color: "#3b82f6" },
  get_logs_for_days:    { label: "Fetching History",      icon: TrendingUp,     color: "#8b5cf6" },
  get_macro_gap:        { label: "Calculating Gap",       icon: Zap,            color: "#f59e0b" },
  search_food_database: { label: "Searching Foods",       icon: Database,       color: "#10b981" },
  get_weight_trend:     { label: "Reading Weight Data",   icon: Scale,          color: "#ec4899" },
  get_user_profile:     { label: "Loading Your Profile",  icon: User,           color: "#6366f1" },
  log_food_item:        { label: "Logging Food",          icon: PenLine,        color: "#f97316" },
  get_streak:           { label: "Checking Streak",       icon: Flame,          color: "#ef4444" },
  update_goal:          { label: "Updating Your Goal",   icon: Target,          color: "#22c55e" },
  generate_meal_plan:   { label: "Building Meal Plan",   icon: UtensilsCrossed, color: "#06b6d4" },
  get_medical_context:  { label: "Reading Medical Data", icon: HeartPulse,      color: "#f43f5e" },
  save_food_to_database:{ label: "Saving Food",          icon: SaveAll,         color: "#84cc16" },
};

// ─── CLEAN, ELEGANT MARKDOWN RENDERER ─────────────────────────────────────────
function RenderMessage({ text, streaming }) {
  if (!text) return null;
  const lines = text.split("\n");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {lines.map((line, i) => {
        if (line.trim() === "") return null;

        // Standard line parsing (Bold & Bullets)
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j} style={{ color: "#fff", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        if (line.trim().startsWith("* ") || line.trim().startsWith("- ")) {
          return (
            <div key={i} style={{ display: "flex", gap: 8, margin: "2px 0", color: "#d4d4d8", fontSize: "0.95rem" }}>
              <span style={{ color: "#3b82f6", flexShrink: 0 }}>•</span>
              <span>{parts.slice(1)}</span>
            </div>
          );
        }

        return (
          <div key={i} style={{ color: "#d4d4d8", fontSize: "1rem", lineHeight: 1.65 }}>
            {parts}
          </div>
        );
      })}
      
      {streaming && (
         <span
           style={{
             display: "inline-block",
             width: 6,
             height: 16,
             background: "#3b82f6",
             borderRadius: 2,
             animation: "nutricoach-blink 1s step-end infinite",
             marginTop: 4
           }}
         />
      )}
    </div>
  );
}

// ─── TOOL ACTIVITY BADGE ──────────────────────────────────────────────────────
function ToolBadges({ tools }) {
  if (!tools || tools.length === 0) return null;

  const counts = tools.reduce((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      {Object.entries(counts).map(([tool, count]) => {
        const meta = TOOL_META[tool];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <div
            key={tool}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: "0.7rem",
              color: meta.color,
              background: `${meta.color}18`,
              border: `1px solid ${meta.color}40`,
              padding: "3px 8px",
              borderRadius: 20,
              fontWeight: 600,
            }}
          >
            <Icon size={11} />
            {meta.label}
            {count > 1 && (
              <span style={{
                background: `${meta.color}33`,
                borderRadius: 10,
                padding: "0px 5px",
                fontSize: "0.65rem",
                fontWeight: 700,
              }}>
                ×{count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { COLORS, TOOL_META, RenderMessage, ToolBadges };
