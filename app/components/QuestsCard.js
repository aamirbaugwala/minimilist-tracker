"use client";

/**
 * QuestsCard — today's three daily quests, derived from the day's logs (see
 * lib/gamification.js). A "come back today" hook that resets at midnight.
 */

export default function QuestsCard({ quests }) {
  if (!quests?.length) return null;
  const left = quests.filter((q) => !q.done).length;

  return (
    <section style={{ padding: "18px 20px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 800,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: "#555",
          }}
        >
          🎮 Today&apos;s quests
        </span>
        <span style={{ fontSize: "0.66rem", color: "#3f3f46" }}>
          {left ? `${left} left` : "all done 🎉"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {quests.map((q) => {
          const pct = Math.min(100, (q.current / q.max) * 100);
          return (
            <div
              key={q.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                background: q.done
                  ? "rgba(34,197,94,0.06)"
                  : "linear-gradient(180deg, #15151b, #0f0f13)",
                border: `1px solid ${q.done ? "rgba(34,197,94,0.4)" : "#1e1e26"}`,
                borderRadius: 15,
                padding: "11px 13px",
                transition: "border-color .3s, background .3s",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: "#0a0a0c",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "1.05rem",
                  flexShrink: 0,
                }}
              >
                {q.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#e4e4e7" }}>{q.title}</div>
                <div style={{ height: 5, borderRadius: 99, background: "#1e1e26", overflow: "hidden", marginTop: 6 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      borderRadius: 99,
                      background: "linear-gradient(90deg,#3b82f6,#8b5cf6)",
                      transition: "width .6s cubic-bezier(.2,.8,.2,1)",
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  color: q.done ? "#22c55e" : "#555",
                  flexShrink: 0,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {q.done ? "✓ Done" : `${q.current}/${q.max}${q.unit || ""}`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
