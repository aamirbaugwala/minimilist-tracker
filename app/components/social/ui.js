"use client";

// Shared presentational primitives for the social screens.

function Avatar({ name, size = 44, color = "#3b82f6", fontSize = "1.1rem" }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${color}44, ${color}22)`,
      border: `2px solid ${color}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize, color, flexShrink: 0,
    }}>
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function StatTile({ label, value, max, unit, color }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${color}33`,
      borderRadius: 12, padding: "10px 12px",
    }}>
      <div style={{ fontSize: "0.62rem", color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 7 }}>
        <span style={{ fontSize: "1rem", fontWeight: 800, color }}>{value}<span style={{ fontSize: "0.62rem", fontWeight: 400, color: "#888" }}>{unit}</span></span>
        <span style={{ fontSize: "0.62rem", color: "#555" }}>/ {max}{unit}</span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
      <div style={{ marginTop: 4, fontSize: "0.6rem", fontWeight: 700, color: pct >= 90 ? color : "#444", textAlign: "right" }}>
        {Math.round(pct)}%
      </div>
    </div>
  );
}

export { Avatar, StatTile };
