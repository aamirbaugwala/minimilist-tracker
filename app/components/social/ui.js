"use client";

// Shared bits for the social screens (Direction A).

export function Avatar({ name, size = 40, me = false }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        background: me ? "var(--accent-soft)" : "var(--surface-highlight)",
        color: me ? "var(--accent-text)" : "var(--text)",
        fontWeight: 600,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {name?.replace(" (You)", "")?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

/** Label + value/target + thin bar. */
export function StatRow({ label, value, max, unit = "", color = "var(--accent)" }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span>
          {value}
          {unit} <span style={{ color: "var(--text-faint)" }}>/ {max}{unit}</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: "var(--track)", marginTop: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: color, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

/** Status words for a day score (no emoji; tone via tokens). */
export function statusFor(score) {
  if (score >= 120) return { label: "Top form", color: "var(--accent-text)" };
  if (score > 90) return { label: "Crushing it", color: "var(--accent-text)" };
  if (score > 60) return { label: "On track", color: "var(--text)" };
  if (score > 20) return { label: "Started", color: "var(--text-muted)" };
  return { label: "Not started", color: "var(--text-faint)" };
}
