"use client";

/**
 * Today's header (Direction A): date, a time-of-day greeting, and the streak.
 * The streak shows this week Mon→Sun: solid = logged, dashed = rest day used,
 * empty = not logged / still to come. One rest day a week (lib/streak.js).
 */

import { Flame } from "lucide-react";

const greeting = (h) => (h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");

export default function TodayHeader({ name, streak, restLeftThisWeek, week, dayLabel }) {
  const hour = new Date().getHours();
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        padding: "calc(20px + env(safe-area-inset-top, 0px)) 20px 0",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{dayLabel}</div>
        <h1 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 600, letterSpacing: -0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {greeting(hour)}{name ? `, ${name}` : ""}
        </h1>
      </div>

      {streak > 0 && (
        <div
          aria-label={`${streak}-day streak, ${restLeftThisWeek} rest day${restLeftThisWeek === 1 ? "" : "s"} left this week`}
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 600 }}>
            <Flame size={15} color="var(--accent-text)" />
            {streak} {streak === 1 ? "day" : "days"}
          </span>
          <span aria-hidden="true" style={{ display: "flex", gap: 3 }}>
            {(week || []).map((d) => (
              <span
                key={d.day}
                style={{
                  width: 12,
                  height: 4,
                  borderRadius: 99,
                  boxSizing: "border-box",
                  background: d.state === "logged" ? "var(--accent)" : "var(--track)",
                  border: d.state === "rest" ? "1px dashed var(--accent-text)" : "none",
                  opacity: d.state === "future" ? 0.45 : 1,
                }}
              />
            ))}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {restLeftThisWeek > 0 ? `${restLeftThisWeek} rest day left` : "Rest day used"}
          </span>
        </div>
      )}
    </header>
  );
}
