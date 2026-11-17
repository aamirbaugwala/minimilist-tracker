"use client";

import { Loader2, RefreshCw } from "lucide-react";
import Sheet from "../Sheet";
import { Avatar } from "./ui";

function Split({ label, a, b, fmt = (n) => n }) {
  const total = a + b || 1;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
        <span style={{ color: "var(--text)" }}>{fmt(a)}</span>
        <span>{label}</span>
        <span style={{ color: "var(--text)" }}>{fmt(b)}</span>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", background: "var(--track)", gap: 2 }}>
        <div style={{ width: `${(a / total) * 100}%`, background: "var(--accent)" }} />
        <div style={{ width: `${(b / total) * 100}%`, background: "var(--text-muted)" }} />
      </div>
    </div>
  );
}

export default function FaceoffModal({ showSquadModal, setShowSquadModal, historicalStats: h, friends, refreshFaceoff, faceoffLoading }) {
  if (!showSquadModal || !h || friends.length < 2) return null;
  const u1 = friends.find((f) => f.id === h.u1);
  const u2 = friends.find((f) => f.id === h.u2);
  if (!u1 || !u2) return null;
  const name = (u) => (u.isMe ? "You" : u.name);
  const w1 = h.wins[u1.id] || 0;
  const w2 = h.wins[u2.id] || 0;
  const lp1 = h.lifetimePoints?.[u1.id] ?? 0;
  const lp2 = h.lifetimePoints?.[u2.id] ?? 0;
  const d1 = h.loggedDays?.[u1.id] ?? 0;
  const d2 = h.loggedDays?.[u2.id] ?? 0;
  const avg1 = d1 ? Math.round(lp1 / d1) : 0;
  const avg2 = d2 ? Math.round(lp2 / d2) : 0;
  const leader = lp1 > lp2 ? u1 : lp2 > lp1 ? u2 : null;

  return (
    <Sheet
      title="All-time head-to-head"
      subtitle={h.totalDays ? `Across ${h.totalDays} tracked days` : "Your top two"}
      onClose={() => setShowSquadModal(false)}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12, textAlign: "center" }}>
          {[{ u: u1, avg: avg1, days: d1 }, null, { u: u2, avg: avg2, days: d2 }].map((x, i) =>
            x ? (
              <div key={x.u.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <Avatar name={x.u.name} size={48} me={x.u.isMe} />
                <div style={{ fontSize: 15, fontWeight: 600 }}>{name(x.u)}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{x.avg} avg · {x.days} days</div>
              </div>
            ) : (
              <div key={i} style={{ fontSize: 13, color: "var(--text-faint)" }}>vs</div>
            ),
          )}
        </div>
        <Split label="Daily wins" a={w1} b={w2} />
        <Split label="Lifetime points" a={lp1} b={lp2} fmt={(n) => n.toLocaleString("en-IN")} />
        <div style={{ padding: 14, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center", fontSize: 15 }}>
          {leader ? `${name(leader)} ${leader.isMe ? "lead" : "leads"} on lifetime points` : w1 !== w2 ? `${name(w1 > w2 ? u1 : u2)} ${w1 > w2 ? (u1.isMe ? "have" : "has") : u2.isMe ? "have" : "has"} more daily wins` : "Dead even so far"}
        </div>
        <button onClick={refreshFaceoff} disabled={faceoffLoading} style={{ alignSelf: "center", display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 8, color: "var(--accent-text)", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>
          {faceoffLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Update with latest logs
        </button>
      </div>
    </Sheet>
  );
}
