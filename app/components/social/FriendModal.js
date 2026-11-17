"use client";

import { Loader2 } from "lucide-react";
import Sheet from "../Sheet";
import { Avatar, StatRow, statusFor } from "./ui";

export default function FriendModal({ selectedFriend: f, friendLogs, logsLoading, closeLogs }) {
  if (!f) return null;
  const st = statusFor(f.score);
  const foods = friendLogs.filter((l) => l.name !== "Water");
  const total = foods.reduce((s, l) => s + (l.calories || 0), 0);
  const hits = [
    f.achievements.proteinHit && "Protein goal",
    f.achievements.fiberHit && "Fibre goal",
    f.achievements.waterHit && "Water goal",
    f.achievements.perfectScore && "100+ points",
  ].filter(Boolean);

  return (
    <Sheet
      label={f.name}
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={f.name} size={40} me={f.isMe} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.isMe ? "You" : f.name}</span>
            <span style={{ display: "block", fontSize: 13, fontWeight: 400, color: st.color }}>{st.label}</span>
          </span>
        </span>
      }
      onClose={closeLogs}
      tall
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.5 }}>{f.score}</span>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
            points today · {f.breakdown.base}
            {f.breakdown.bonus > 0 && <span style={{ color: "var(--accent-text)" }}> +{f.breakdown.bonus}</span>}
            {f.breakdown.penalty > 0 && <span style={{ color: "var(--warn)" }}> −{f.breakdown.penalty}</span>}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <StatRow label="Calories" value={f.stats.cals} max={f.targets.cals} color={f.stats.cals > f.targets.cals ? "var(--warn)" : "var(--accent)"} />
          <StatRow label="Protein" value={f.stats.p} max={f.targets.p} unit=" g" color="var(--protein)" />
          <StatRow label="Carbs" value={f.stats.c} max={f.targets.c} unit=" g" color="var(--carbs)" />
          <StatRow label="Fat" value={f.stats.f} max={f.targets.f} unit=" g" color="var(--fats)" />
          <StatRow label="Fibre" value={f.stats.fib} max={f.targets.fib} unit=" g" color="var(--fiber)" />
          <StatRow label="Water" value={f.stats.water} max={f.targets.water} unit=" L" color="var(--water)" />
        </div>

        {hits.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {hits.map((h) => (
              <span key={h} style={{ padding: "5px 10px", borderRadius: 99, background: "var(--accent-soft)", color: "var(--accent-text)", fontSize: 13, fontWeight: 600 }}>{h}</span>
            ))}
          </div>
        )}

        <section>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
            Today’s food{total > 0 ? ` · ${Math.round(total)} kcal` : ""}
          </div>
          {logsLoading ? (
            <div style={{ padding: 20, display: "grid", placeItems: "center" }}>
              <Loader2 size={20} className="animate-spin" color="var(--text-muted)" />
            </div>
          ) : foods.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-faint)" }}>Nothing logged yet today.</p>
          ) : (
            <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)" }}>
              {foods.map((l, i) => (
                <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}{l.qty !== 1 ? ` × ${l.qty}` : ""}</span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                      P {Math.round(l.protein || 0)} · C {Math.round(l.carbs || 0)} · F {Math.round(l.fats || 0)}
                    </span>
                  </span>
                  <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{Math.round(l.calories || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Sheet>
  );
}
