"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FLATTENED_DB } from "../food-data";
import { calculateTargets, capPct } from "../lib/nutrition";
import {
  UserPlus,
  Check,
  X,
  Trophy,
  Flame,
  Search,
  Trash2,
  Utensils,
  Loader2,
  HelpCircle,
  RefreshCw,
  ChevronLeft,
  Swords,
  Users,
  Bot,
  Zap,
  Scale,
  Database,
  TrendingUp,
  PenLine,
  Target,
  UtensilsCrossed,
  HeartPulse,
  SaveAll,
} from "lucide-react";
import { supabase } from "../supabase";

// ─── Avatar ───────────────────────────────────────────────────────────────────
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

// ─── Stat tile ────────────────────────────────────────────────────────────────
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

// ─── TOOL BADGE METADATA ──────────────────────────────────────────────────────
const TOOL_META = {
  get_todays_logs:      { label: "Read Today's Logs",    icon: Utensils,        color: "#3b82f6" },
  get_logs_for_days:    { label: "Fetching History",     icon: TrendingUp,      color: "#8b5cf6" },
  get_macro_gap:        { label: "Calculating Gap",      icon: Zap,             color: "#f59e0b" },
  search_food_database: { label: "Searching Foods",      icon: Database,        color: "#10b981" },
  get_weight_trend:     { label: "Reading Weight Data",  icon: Scale,           color: "#ec4899" },
  get_user_profile:     { label: "Loading Your Profile", icon: Users,           color: "#6366f1" },
  log_food_item:        { label: "Logging Food",         icon: PenLine,         color: "#f97316" },
  get_streak:           { label: "Checking Streak",      icon: Flame,           color: "#ef4444" },
  update_goal:          { label: "Updating Your Goal",   icon: Target,          color: "#22c55e" },
  generate_meal_plan:   { label: "Building Meal Plan",   icon: UtensilsCrossed, color: "#06b6d4" },
  get_medical_context:  { label: "Reading Medical Data", icon: HeartPulse,      color: "#f43f5e" },
  save_food_to_database:{ label: "Saving Food",          icon: SaveAll,         color: "#84cc16" },
};

// ─── TOOL BADGES ──────────────────────────────────────────────────────────────
function ToolBadges({ tools }) {
  if (!tools || tools.length === 0) return null;
  const counts = tools.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
      {Object.entries(counts).map(([tool, count]) => {
        const meta = TOOL_META[tool];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <div key={tool} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: "0.68rem", color: meta.color,
            background: `${meta.color}18`, border: `1px solid ${meta.color}40`,
            padding: "2px 7px", borderRadius: 20, fontWeight: 600,
          }}>
            <Icon size={10} />
            {meta.label}
            {count > 1 && (
              <span style={{ background: `${meta.color}33`, borderRadius: 10, padding: "0px 4px", fontSize: "0.6rem", fontWeight: 700 }}>
                ×{count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── INLINE MARKDOWN RENDERER ─────────────────────────────────────────────────
function RenderText({ text, streaming }) {
  if (!text) return null;
  return (
    <div style={{ lineHeight: 1.65 }}>
      {text.split("\n").map((line, i) => {
        if (line.trim() === "") return <div key={i} style={{ height: 6 }} />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={j} style={{ color: "#fff" }}>{p.slice(2, -2)}</strong>
            : p
        );
        return <div key={i} style={{ color: "#d4d4d8", fontSize: "0.9rem" }}>{parts}</div>;
      })}
      {streaming && (
        <span style={{
          display: "inline-block", width: 2, height: "1em",
          background: "#a5b4fc", marginLeft: 1, verticalAlign: "text-bottom",
          animation: "blink 1s step-end infinite",
        }} />
      )}
    </div>
  );
}

export default function SocialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [addStatus, setAddStatus] = useState("");
  const [cheered, setCheered] = useState({});

  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendLogs, setFriendLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showGlobalRules, setShowGlobalRules] = useState(false);
  const [squadStats, setSquadStats] = useState(null);
  const [historicalStats, setHistoricalStats] = useState(null);
  const [showSquadModal, setShowSquadModal] = useState(false);

  // ── AI Squad Coach state ──────────────────────────────────────────────────
  const [squadBriefing, setSquadBriefing] = useState(null);
  const [squadBriefingLoading, setSquadBriefingLoading] = useState(false);
  const [squadBriefingTools, setSquadBriefingTools] = useState([]);

  const fetchSquadBriefing = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || squadBriefingLoading) return;

    setSquadBriefingLoading(true);
    setSquadBriefing("");
    setSquadBriefingTools([]);

    // Build a rich prompt from the live friends data
    const squadSummary = friends.map((f, i) =>
      `${i + 1}. ${f.name.replace(" (You)", f.isMe ? " (me)" : "")}: score=${f.score}, ` +
      `cals=${f.stats.cals}/${f.targets.cals}, protein=${f.stats.p}/${f.targets.p}g, ` +
      `water=${f.stats.water}/${f.targets.water}L, status="${f.statusLabel}"`
    ).join("\n");

    const message =
      `You are a competitive squad nutrition coach. Here is my squad's live performance today:\n\n${squadSummary}\n\n` +
      `Give me a punchy 2-3 sentence squad analysis: who is winning and why, what is the squad's biggest collective gap right now, ` +
      `and one specific competitive challenge everyone can act on before end of day. ` +
      `Be energetic and motivating. Use bold for names and key numbers. No bullet points.`;

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          userId: session.user.id,
          accessToken: session.access_token,
          history: [],
        }),
      });

      if (!res.ok) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "tool") {
              setSquadBriefingTools((prev) => [...prev, event.name]);
            } else if (event.type === "chunk") {
              accumulated += event.text;
              setSquadBriefing(accumulated);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      setSquadBriefing("Could not load squad analysis. Try again.");
    } finally {
      setSquadBriefingLoading(false);
    }
  };

  // ── View a friend's logs ───────────────────────────────────────────────────
  const handleViewLogs = async (friend) => {
    setSelectedFriend(friend);
    setLogsLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("food_logs").select("*")
      .eq("user_id", friend.id).eq("date", today)
      .order("created_at", { ascending: false });
    const enhancedData = (data || []).map((log) => {
      if (!log.fiber && log.name !== "Water") {
        const dbItem = FLATTENED_DB[log.name.toLowerCase()];
        if (dbItem?.fiber) return { ...log, fiber: Math.round(dbItem.fiber * log.qty) };
      }
      return log;
    });
    setFriendLogs(enhancedData);
    setLogsLoading(false);
  };

  const closeLogs = () => { setSelectedFriend(null); setFriendLogs([]); };

  // ── Data fetch ────────────────────────────────────────────────────────────
  const fetchSocialData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/"); return; }
    const myId = session.user.id;

    const { data: links } = await supabase
      .from("friendships").select("*")
      .or(`user_id.eq.${myId},friend_id.eq.${myId}`);

    const getUserData = async (uid) => {
      const { data: profile } = await supabase
        .from("user_profiles").select("*").eq("user_id", uid).maybeSingle();
      const { data: logs } = await supabase
        .from("food_logs").select("*")
        .eq("user_id", uid).eq("date", new Date().toISOString().slice(0, 10));

      const rawStats = logs?.reduce((acc, item) => {
        let currentFib = item.fiber || 0;
        if (!currentFib && item.name !== "Water") {
          const dbItem = FLATTENED_DB[item.name.toLowerCase()];
          if (dbItem?.fiber) currentFib = Math.round(dbItem.fiber * item.qty);
        }
        return {
          cals: acc.cals + (item.calories || 0),
          p: acc.p + (item.protein || 0),
          c: acc.c + (item.carbs || 0),
          f: acc.f + (item.fats || 0),
          fib: acc.fib + currentFib,
          water: item.name === "Water" ? acc.water + item.qty * 0.25 : acc.water,
        };
      }, { cals: 0, p: 0, c: 0, f: 0, fib: 0, water: 0 }) || { cals: 0, p: 0, c: 0, f: 0, fib: 0, water: 0 };

      const stats = {
        cals: Math.round(rawStats.cals),
        p: Math.round(rawStats.p * 10) / 10,
        c: Math.round(rawStats.c * 10) / 10,
        f: Math.round(rawStats.f * 10) / 10,
        fib: Math.round(rawStats.fib * 10) / 10,
        water: Math.round(rawStats.water * 10) / 10,
      };

      const targets = calculateTargets(profile);
      const baseScore = Math.round(
        (capPct(stats.cals, targets.cals) + capPct(stats.p, targets.p) +
          capPct(stats.c, targets.c) + capPct(stats.f, targets.f) +
          capPct(stats.fib, targets.fib) + capPct(stats.water, targets.water)) / 6,
      );

      let penaltyPoints = 0;
      if (stats.cals > targets.cals) penaltyPoints += Math.floor(((stats.cals - targets.cals) / targets.cals) * 10) * 5;
      if (stats.f > targets.f) penaltyPoints += Math.floor(((stats.f - targets.f) / targets.f) * 10) * 5;
      if (stats.c > targets.c) penaltyPoints += Math.floor(((stats.c - targets.c) / targets.c) * 10) * 3;

      let bonusPoints = 0;
      if (stats.p >= targets.p * 0.9) bonusPoints += 15;
      if (stats.fib >= targets.fib * 0.9) bonusPoints += 10;
      if (stats.water >= targets.water * 0.9) bonusPoints += 10;

      const finalScore = Math.max(0, Math.round(baseScore + bonusPoints - penaltyPoints));

      let statusLabel = "Sleeping 😴";
      let barColor = "#555";
      if (finalScore > 20) { statusLabel = "Started 🏁"; barColor = "#3b82f6"; }
      if (finalScore > 60) { statusLabel = "Grinding 🏃"; barColor = "#8b5cf6"; }
      if (finalScore > 90) { statusLabel = "Crushing It 🔥"; barColor = "#22c55e"; }
      if (finalScore >= 120) { statusLabel = "God Mode 🏆"; barColor = "#f59e0b"; }

      return {
        id: uid,
        name: profile?.username || profile?.email?.split("@")[0] || "User",
        stats, targets,
        score: finalScore,
        breakdown: { base: baseScore, bonus: bonusPoints, penalty: penaltyPoints },
        statusLabel, barColor,
        isMe: uid === myId,
        achievements: {
          proteinHit: stats.p >= targets.p,
          waterHit: stats.water >= targets.water,
          fiberHit: stats.fib >= targets.fib,
          perfectScore: finalScore >= 100,
        },
      };
    };

    const friendList = [];
    const requestList = [];

    if (links) {
      for (const link of links) {
        const isSender = link.user_id === myId;
        const otherUserId = isSender ? link.friend_id : link.user_id;
        if (link.status === "pending" && !isSender) {
          const { data } = await supabase.from("user_profiles").select("*").eq("user_id", otherUserId).maybeSingle();
          requestList.push({ id: link.id, name: data?.email || "Unknown" });
        } else if (link.status === "accepted") {
          const friendData = await getUserData(otherUserId);
          friendData.relationshipId = link.id;
          friendList.push(friendData);
        }
      }
    }

    const myData = await getUserData(myId);
    myData.name += " (You)";
    friendList.push(myData);

    const sortedFriends = friendList.sort((a, b) => b.score - a.score);
    const top2 = sortedFriends.slice(0, 2);

    const totalSquadStats = top2.reduce((acc, curr) => {
      const tP = curr.targets?.p || 150;
      const tW = curr.targets?.water || 3;
      return {
        cals: acc.cals + (Number(curr.stats?.cals) || 0),
        p: acc.p + (Number(curr.stats?.p) || 0),
        water: acc.water + (Number(curr.stats?.water) || 0),
        targetP: acc.targetP + Number(tP),
        targetWater: acc.targetWater + Number(tW),
        fighters: acc.fighters + 1,
      };
    }, { cals: 0, p: 0, water: 0, targetP: 0, targetWater: 0, fighters: 0 });

    setSquadStats(totalSquadStats);
    setFriends(sortedFriends);
    setRequests(requestList);

    if (top2.length === 2) {
      // Fetch full all-time history — no date filter, high limit to bypass Supabase's 1000-row default
      const { data: historyLogs } = await supabase
        .from("food_logs")
        .select("user_id, date, calories, protein, carbs, fats, fiber, name, qty")
        .in("user_id", top2.map((u) => u.id))
        .order("date", { ascending: true })
        .limit(50000);

      // Group logs by date
      const dateSet = new Set((historyLogs || []).map((l) => l.date));
      const allDates = [...dateSet];

      const wins           = { [top2[0].id]: 0, [top2[1].id]: 0 };
      const lifetimePoints = { [top2[0].id]: 0, [top2[1].id]: 0 };
      const loggedDays     = { [top2[0].id]: 0, [top2[1].id]: 0 };

      // Full scoring formula — mirrors getUserData above (same bonuses/penalties, capped at 135)
      const calcDayScore = (userLogs, targets) => {
        if (!userLogs.length) return 0;
        const s = userLogs.reduce((acc, item) => {
          let fib = item.fiber || 0;
          if (!fib && item.name !== "Water") {
            const dbItem = FLATTENED_DB[item.name?.toLowerCase()];
            if (dbItem?.fiber) fib = Math.round(dbItem.fiber * item.qty);
          }
          return {
            cals:  acc.cals  + (item.calories || 0),
            p:     acc.p     + (item.protein  || 0),
            c:     acc.c     + (item.carbs    || 0),
            f:     acc.f     + (item.fats     || 0),
            fib:   acc.fib   + fib,
            water: item.name === "Water" ? acc.water + item.qty * 0.25 : acc.water,
          };
        }, { cals: 0, p: 0, c: 0, f: 0, fib: 0, water: 0 });

        const capPctLocal = (v, t) => t > 0 ? Math.min(100, (v / t) * 100) : 0;
        const baseScore = Math.round(
          (capPctLocal(s.cals, targets.cals) + capPctLocal(s.p, targets.p) +
           capPctLocal(s.c,    targets.c)    + capPctLocal(s.f, targets.f) +
           capPctLocal(s.fib,  targets.fib)  + capPctLocal(s.water, targets.water)) / 6
        );

        let bonus = 0;
        if (s.p     >= targets.p     * 0.9) bonus += 15;
        if (s.fib   >= targets.fib   * 0.9) bonus += 10;
        if (s.water >= targets.water * 0.9) bonus += 10;

        let penalty = 0;
        if (s.cals > targets.cals) penalty += Math.floor(((s.cals - targets.cals) / targets.cals) * 10) * 5;
        if (s.f    > targets.f)    penalty += Math.floor(((s.f    - targets.f)    / targets.f)    * 10) * 5;
        if (s.c    > targets.c)    penalty += Math.floor(((s.c    - targets.c)    / targets.c)    * 10) * 3;

        return Math.max(0, baseScore + bonus - penalty);
      };

      allDates.forEach((date) => {
        const dayLogs = historyLogs.filter((l) => l.date === date);
        const dayScores = top2.map((user) => ({
          id:    user.id,
          score: calcDayScore(dayLogs.filter((l) => l.user_id === user.id), user.targets),
        }));
        // Tally win (only if at least one user logged)
        const anyLogged = dayScores.some((d) => d.score > 0);
        if (anyLogged) {
          if (dayScores[0].score > dayScores[1].score) wins[dayScores[0].id]++;
          else if (dayScores[1].score > dayScores[0].score) wins[dayScores[1].id]++;
        }
        // Accumulate lifetime points (only add if user actually logged that day)
        dayScores.forEach(({ id, score }) => {
          const userLogged = dayLogs.some((l) => l.user_id === id);
          if (userLogged) {
            lifetimePoints[id] += score;
            loggedDays[id]++;
          }
        });
      });

      setHistoricalStats({ u1: top2[0].id, u2: top2[1].id, wins, lifetimePoints, loggedDays, totalDays: allDates.length });
    }

    setLoading(false);
    setRefreshing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchSocialData(); }, [fetchSocialData]);

  const handleInteract = (e, id, type) => {
    e.stopPropagation();
    setCheered((prev) => ({ ...prev, [id]: type }));
    setTimeout(() => setCheered((prev) => ({ ...prev, [id]: null })), 2000);
  };

  const sendRequest = async () => {
    setAddStatus("loading");
    try {
      const { error } = await supabase.rpc("send_friend_request", { target_email: searchEmail });
      if (error) throw error;
      setAddStatus("success");
      setSearchEmail("");
      fetchSocialData();
    } catch (e) {
      alert(e.message);
      setAddStatus("error");
    }
  };

  const acceptRequest = async (id) => {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    fetchSocialData();
  };

  const removeFriend = async (id) => {
    if (!confirm("Remove this friend?")) return;
    await supabase.from("friendships").delete().eq("id", id);
    fetchSocialData();
  };

  // ── Podium ────────────────────────────────────────────────────────────────
  const PODIUM_CONFIG = [
    { rank: 2, idx: 1, height: 80, color: "#94a3b8", gradient: "linear-gradient(to top,#1e293b,#334155)", borderTop: "#64748b", glow: false },
    { rank: 1, idx: 0, height: 110, color: "#f59e0b", gradient: "linear-gradient(to top,#78350f,#b45309)", borderTop: "#f59e0b", glow: true },
    { rank: 3, idx: 2, height: 60, color: "#a855f7", gradient: "linear-gradient(to top,#4c1d95,#6b21a8)", borderTop: "#a855f7", glow: false },
  ];

  const Podium = ({ top3 }) => (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8, marginBottom: 28, marginTop: 4 }}>
      {PODIUM_CONFIG.map(({ rank, idx, height, color, gradient, borderTop, glow }) => {
        const f = top3[idx];
        if (!f) return <div key={rank} style={{ width: "30%" }} />;
        const isFirst = rank === 1;
        return (
          <div
            key={rank}
            onClick={() => handleViewLogs(f)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", width: isFirst ? "35%" : "30%", cursor: "pointer" }}
          >
            {isFirst && <Flame size={20} color="#f59e0b" style={{ marginBottom: 5 }} className="animate-bounce" />}
            <Avatar name={f.name} size={isFirst ? 46 : 36} color={color} fontSize={isFirst ? "1.1rem" : "0.9rem"} />
            <div style={{
              marginTop: 6, marginBottom: 7,
              fontWeight: isFirst ? 800 : 700,
              fontSize: isFirst ? "0.88rem" : "0.75rem",
              color, textAlign: "center",
              maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {f.name.replace(" (You)", "")}
            </div>
            <div style={{
              width: "100%", height,
              background: gradient,
              borderRadius: "10px 10px 0 0",
              borderTop: `3px solid ${borderTop}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: glow ? "0 0 20px rgba(245,158,11,0.18)" : "none",
            }}>
              <span style={{ fontSize: isFirst ? "2rem" : "1.4rem" }}>
                {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
              </span>
            </div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 3 }}>
              <span style={{ fontWeight: 800, fontSize: isFirst ? "1.05rem" : "0.9rem", color }}>{f.score}</span>
              <span style={{ fontSize: "0.62rem", color: "#777" }}>pts</span>
            </div>
            <div style={{ fontSize: "0.62rem", color: "#888", marginTop: 1 }}>{f.statusLabel}</div>
          </div>
        );
      })}
    </div>
  );

  // ── Squad banner ──────────────────────────────────────────────────────────
  const SquadBanner = () => {
    if (!squadStats || friends.length < 2) return null;
    const tP = Math.max(squadStats.targetP, 1);
    const tW = Math.max(squadStats.targetWater, 1);
    const pPct = Math.min(100, (squadStats.p / tP) * 100);
    const wPct = Math.min(100, (squadStats.water / tW) * 100);
    return (
      <div style={{
        background: "linear-gradient(135deg,#1e1b4b,#312e81)",
        border: "1px solid #4338ca", borderRadius: 18, padding: "14px 16px", marginBottom: 18,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Users size={15} color="#a5b4fc" />
            <span style={{ fontWeight: 700, color: "#e0e7ff", fontSize: "0.85rem" }}>Squad Today</span>
          </div>
          {historicalStats && (
            <button
              onClick={() => setShowSquadModal(true)}
              style={{ background: "rgba(99,102,241,0.25)", border: "1px solid #6366f155", color: "#a5b4fc", borderRadius: 8, padding: "3px 10px", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}
            >
              All-Time Faceoff ⚔️
            </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Protein", value: Math.round(squadStats.p), max: Math.round(tP), unit: "g", color: "#fbbf24", pct: pPct },
            { label: "Hydration", value: +squadStats.water.toFixed(1), max: +tW.toFixed(1), unit: "L", color: "#60a5fa", pct: wPct },
          ].map(({ label, value, max, unit, color, pct }) => (
            <div key={label} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: "0.72rem", color: "#c7d2fe" }}>{label}</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color }}>{Math.round(pct)}%</span>
              </div>
              <div style={{ height: 5, background: "#1e293b", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.8s ease" }} />
              </div>
              <div style={{ marginTop: 4, fontSize: "0.62rem", color: "#3a4a6a", textAlign: "right" }}>
                {value} / {max}{unit}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── All-time faceoff modal ────────────────────────────────────────────────
  const FaceoffModal = () => {
    if (!showSquadModal || !historicalStats || friends.length < 2) return null;
    const u1 = friends.find((f) => f.id === historicalStats.u1);
    const u2 = friends.find((f) => f.id === historicalStats.u2);
    if (!u1 || !u2) return null;
    const w1 = historicalStats.wins[u1.id];
    const w2 = historicalStats.wins[u2.id];
    const lp1 = historicalStats.lifetimePoints?.[u1.id] ?? 0;
    const lp2 = historicalStats.lifetimePoints?.[u2.id] ?? 0;
    const ld1 = historicalStats.loggedDays?.[u1.id] ?? 0;
    const ld2 = historicalStats.loggedDays?.[u2.id] ?? 0;
    const avg1 = ld1 > 0 ? Math.round(lp1 / ld1) : 0;
    const avg2 = ld2 > 0 ? Math.round(lp2 / ld2) : 0;
    const totalW = w1 + w2 || 1;
    const totalLP = lp1 + lp2 || 1;
    const winLeader = w1 > w2 ? u1 : w2 > w1 ? u2 : null;
    const ptLeader  = lp1 > lp2 ? u1 : lp2 > lp1 ? u2 : null;
    const totalDays = historicalStats.totalDays ?? 0;

    return (
      <div className="modal-overlay" style={{ zIndex: 9999 }}>
        <div className="modal-content">
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, color: "#e0e7ff", fontSize: "1rem" }}>
              <Swords size={17} color="#f59e0b" /> All-Time Head-to-Head
            </h3>
            <button onClick={() => setShowSquadModal(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}>
              <X size={20} />
            </button>
          </div>
          {totalDays > 0 && (
            <div style={{ fontSize: "0.68rem", color: "#333", marginBottom: 18 }}>
              Across <strong style={{ color: "#555" }}>{totalDays}</strong> tracked days
            </div>
          )}

          {/* Player cards */}
          <div style={{ display: "flex", alignItems: "stretch", justifyContent: "space-around", gap: 10, marginBottom: 20 }}>
            {[{ user: u1, wins: w1, pts: lp1, avg: avg1, days: ld1 }, { user: u2, wins: w2, pts: lp2, avg: avg2, days: ld2 }].map(({ user, wins, pts, avg, days }) => (
              <div key={user.id} style={{
                flex: 1, textAlign: "center",
                background: `linear-gradient(160deg, ${user.barColor}18, ${user.barColor}08)`,
                border: `1.5px solid ${user.barColor}55`,
                borderRadius: 16, padding: "16px 10px",
                boxShadow: `0 0 20px ${user.barColor}12`,
              }}>
                <Avatar name={user.name} size={50} color={user.barColor} />
                <div style={{ marginTop: 9, fontWeight: 800, color: "#fff", fontSize: "0.88rem" }}>
                  {user.name.replace(" (You)", "")}
                </div>
                <div style={{ fontSize: "0.62rem", color: `${user.barColor}aa`, marginTop: 3, fontWeight: 600 }}>
                  {days} days logged
                </div>

                {/* Wins */}
                <div style={{
                  marginTop: 12,
                  background: "rgba(0,0,0,0.25)",
                  borderRadius: 10, padding: "8px 6px",
                }}>
                  <div style={{ fontSize: "2.2rem", fontWeight: 900, color: user.barColor, lineHeight: 1 }}>{wins}</div>
                  <div style={{ fontSize: "0.62rem", color: "#888", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>daily wins</div>
                </div>

                {/* Avg daily score */}
                <div style={{
                  marginTop: 8,
                  background: `${user.barColor}22`,
                  border: `1px solid ${user.barColor}44`,
                  borderRadius: 10, padding: "9px 6px",
                }}>
                  <div style={{ lineHeight: 1 }}>
                    <span style={{ fontSize: "1.5rem", fontWeight: 900, color: user.barColor }}>{avg}</span>
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, color: `${user.barColor}88` }}>/135</span>
                  </div>
                  <div style={{ fontSize: "0.62rem", color: "#999", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>avg daily score</div>
                  <div style={{ fontSize: "0.65rem", color: `${user.barColor}bb`, marginTop: 4, fontWeight: 700 }}>
                    {pts.toLocaleString()} <span style={{ fontWeight: 400, color: "#555" }}>total pts</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Wins bar */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: "0.62rem", color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Daily wins</span>
              <span style={{ fontSize: "0.62rem", color: "#555" }}>{w1} vs {w2}</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, overflow: "hidden", display: "flex", background: "rgba(255,255,255,0.06)" }}>
              <div style={{ width: `${(w1 / totalW) * 100}%`, background: u1.barColor, transition: "width 0.8s ease", boxShadow: `0 0 8px ${u1.barColor}66` }} />
              <div style={{ width: `${(w2 / totalW) * 100}%`, background: u2.barColor, boxShadow: `0 0 8px ${u2.barColor}66` }} />
            </div>
          </div>

          {/* Lifetime points bar */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: "0.62rem", color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Lifetime points</span>
              <span style={{ fontSize: "0.62rem", color: "#555" }}>{lp1.toLocaleString()} vs {lp2.toLocaleString()}</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, overflow: "hidden", display: "flex", background: "rgba(255,255,255,0.06)" }}>
              <div style={{ width: `${(lp1 / totalLP) * 100}%`, background: u1.barColor, transition: "width 0.8s ease", boxShadow: `0 0 8px ${u1.barColor}66` }} />
              <div style={{ width: `${(lp2 / totalLP) * 100}%`, background: u2.barColor, boxShadow: `0 0 8px ${u2.barColor}66` }} />
            </div>
          </div>

          {/* Crown verdict */}
          <div style={{
            textAlign: "center", fontSize: "0.88rem", color: "#e4e4e7", fontWeight: 700,
            background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            {ptLeader
              ? `${ptLeader.name.replace(" (You)", "")} leads in lifetime points 👑`
              : winLeader
                ? `${winLeader.name.replace(" (You)", "")} holds the most wins 👑`
                : "Completely even — too close to call 🤝"}
          </div>
        </div>
      </div>
    );
  };

  // ── Friend detail modal ───────────────────────────────────────────────────
  const FriendModal = () => {
    if (!selectedFriend) return null;
    const f = selectedFriend;
    const totalLogs = friendLogs.reduce((s, l) => s + (l.calories || 0), 0);
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxHeight: "82vh", display: "flex", flexDirection: "column", padding: "0 0 28px", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <Avatar name={f.name} size={40} color={f.barColor} fontSize="1rem" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
              <div style={{ fontSize: "0.72rem", color: f.barColor, fontWeight: 600 }}>{f.statusLabel}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontWeight: 900, fontSize: "1.5rem", color: f.barColor, lineHeight: 1 }}>{f.score}</div>
              <div style={{ fontSize: "0.6rem", color: "#333" }}>/ 135 pts</div>
            </div>
            <button onClick={closeLogs} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 4, flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ overflowY: "auto", flex: 1, padding: "14px 18px" }}>
            {/* Breakdown pills */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {[
                { label: "Base", val: f.breakdown.base, color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
                { label: "Bonus", val: `+${f.breakdown.bonus}`, color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
                { label: "Penalty", val: `-${f.breakdown.penalty}`, color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
              ].map(({ label, val, color, bg }) => (
                <div key={label} style={{ flex: 1, background: bg, border: `1px solid ${color}33`, borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.58rem", color: "#999", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
                  <div style={{ fontWeight: 800, fontSize: "1rem", color, marginTop: 2 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Macro tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
              <StatTile label="Protein" value={f.stats.p} max={f.targets.p} unit="g" color="#3b82f6" />
              <StatTile label="Carbs" value={f.stats.c} max={f.targets.c} unit="g" color="#f59e0b" />
              <StatTile label="Fats" value={f.stats.f} max={f.targets.f} unit="g" color="#ef4444" />
              <StatTile label="Fiber" value={f.stats.fib} max={f.targets.fib} unit="g" color="#a855f7" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 14 }}>
              <StatTile label="Calories" value={f.stats.cals} max={f.targets.cals} unit=" kcal" color="#f59e0b" />
              <StatTile label="Water" value={f.stats.water} max={f.targets.water} unit="L" color="#60a5fa" />
            </div>

            {/* Achievement badges */}
            {(f.achievements.proteinHit || f.achievements.waterHit || f.achievements.fiberHit || f.achievements.perfectScore) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
                {f.achievements.proteinHit && <span style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 7, padding: "2px 9px", fontSize: "0.7rem", fontWeight: 700 }}>💪 Protein Hit</span>}
                {f.achievements.waterHit && <span style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 7, padding: "2px 9px", fontSize: "0.7rem", fontWeight: 700 }}>💧 Hydrated</span>}
                {f.achievements.fiberHit && <span style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 7, padding: "2px 9px", fontSize: "0.7rem", fontWeight: 700 }}>🌿 Fiber Hit</span>}
                {f.achievements.perfectScore && <span style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 7, padding: "2px 9px", fontSize: "0.7rem", fontWeight: 700 }}>🏆 Perfect Day</span>}
              </div>
            )}

            {/* Food log */}
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#2a2a2a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Food Log {totalLogs > 0 && <span style={{ color: "#555", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>· {totalLogs} kcal</span>}
            </div>

            {logsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                <Loader2 className="animate-spin" color="#444" size={22} />
              </div>
            ) : friendLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "#333" }}>
                <Utensils size={28} style={{ opacity: 0.15, marginBottom: 8 }} />
                <div style={{ fontSize: "0.82rem" }}>Nothing logged today.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {friendLogs.map((log) => {
                  const isWater = log.name === "Water";
                  const pct = totalLogs > 0 ? Math.round((log.calories / totalLogs) * 100) : 0;
                  return (
                    <div key={log.id} style={{
                      background: isWater ? "rgba(59,130,246,0.06)" : "#111116",
                      border: isWater ? "1px solid rgba(59,130,246,0.18)" : "1px solid #1e1e26",
                      borderRadius: 10, padding: "9px 12px",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{ background: "#1e1e26", color: "#444", borderRadius: 6, padding: "2px 6px", fontSize: "0.68rem", fontWeight: 700, flexShrink: 0 }}>{log.qty}×</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", textTransform: "capitalize", color: "#e4e4e7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.name}</div>
                        {!isWater && (
                          <div style={{ display: "flex", gap: 5, marginTop: 3 }}>
                            <span style={{ fontSize: "0.6rem", background: "rgba(59,130,246,0.1)", color: "#3b82f6", padding: "1px 4px", borderRadius: 4, fontWeight: 600 }}>P {log.protein}g</span>
                            <span style={{ fontSize: "0.6rem", background: "rgba(245,158,11,0.1)", color: "#f59e0b", padding: "1px 4px", borderRadius: 4, fontWeight: 600 }}>C {log.carbs}g</span>
                            <span style={{ fontSize: "0.6rem", background: "rgba(239,68,68,0.1)", color: "#ef4444", padding: "1px 4px", borderRadius: 4, fontWeight: 600 }}>F {log.fats}g</span>
                            {log.fiber > 0 && (
                              <span style={{ fontSize: "0.6rem", background: "rgba(16,185,129,0.1)", color: "#10b981", padding: "1px 4px", borderRadius: 4, fontWeight: 600 }}>Fib {log.fiber}g</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.88rem", color: isWater ? "#60a5fa" : "#fff" }}>
                          {isWater ? `${log.qty * 0.25}L` : log.calories}
                        </div>
                        {!isWater && pct > 0 && (
                          <div style={{ fontSize: "0.58rem", color: "#aaa", background: "rgba(255,255,255,0.07)", borderRadius: 4, padding: "1px 3px", marginTop: 2 }}>{pct}%</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Scoring rules modal ───────────────────────────────────────────────────
  const RulesModal = () => !showGlobalRules ? null : (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 7, fontSize: "0.95rem" }}>
            <Trophy size={16} color="#f59e0b" /> Scoring System
          </h3>
          <button onClick={() => setShowGlobalRules(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: "0.65rem", color: "#888", marginBottom: 2 }}>Max Possible</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#f59e0b" }}>135 pts</div>
        </div>
        {[
          { label: "Base Score (max 100)", color: "#3b82f6", items: ["Average % across all 6 daily goals, each capped at 100%"] },
          { label: "Bonuses (+35 max)", color: "#22c55e", items: ["+15 pts — Hit 90%+ Protein", "+10 pts — Hit 90%+ Fiber", "+10 pts — Hit 90%+ Water"] },
          { label: "Penalties (unlimited)", color: "#ef4444", items: ["−5 per 10% over Calories", "−5 per 10% over Fats", "−3 per 10% over Carbs"] },
        ].map(({ label, color, items }) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color, fontSize: "0.78rem", marginBottom: 5 }}>{label}</div>
            {items.map((item) => (
              <div key={item} style={{ fontSize: "0.73rem", color: "#bbb", marginBottom: 2, paddingLeft: 8, borderLeft: `2px solid ${color}55` }}>{item}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="app-wrapper" style={{ paddingBottom: 80, gap: 0, padding: 0 }}>
      <RulesModal />
      <FriendModal />
      <FaceoffModal />

      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(8,8,10,0.92)", backdropFilter: "blur(14px)",
        borderBottom: "1px solid #111116", padding: "13px 16px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <button
          onClick={() => router.push("/")}
          style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", flexShrink: 0 }}
        >
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontWeight: 800, fontSize: "1rem", color: "#fff", flex: 1 }}>Social Hub</span>
        <button
          onClick={() => setShowGlobalRules(true)}
          style={{ background: "#111116", border: "1px solid #1e1e26", color: "#aaa", cursor: "pointer", padding: "5px 10px", borderRadius: 9, display: "flex", alignItems: "center", gap: 4, fontSize: "0.72rem", fontWeight: 700 }}
        >
          <HelpCircle size={12} /> Points
        </button>
        <button
          onClick={() => fetchSocialData(true)}
          disabled={refreshing}
          style={{ background: "#111116", border: "1px solid #1e1e26", color: "#aaa", cursor: "pointer", padding: 7, borderRadius: 9, display: "flex", alignItems: "center" }}
          title="Refresh scores"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      <div style={{ padding: "14px 16px 80px" }}>
        {/* ── Tab switcher ──────────────────────────────────────────────── */}
        <div style={{
          display: "flex", gap: 5, background: "#0a0a0d",
          border: "1px solid #111116", borderRadius: 12, padding: 4, marginBottom: 18,
        }}>
          {[
            { id: "leaderboard", label: "🏆  Leaderboard" },
            { id: "add", label: `👥  Friends${requests.length > 0 ? ` (${requests.length})` : ""}` },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              flex: 1, padding: "9px 6px", borderRadius: 9, border: "none",
              background: activeTab === id ? "#1a1a1f" : "transparent",
              color: activeTab === id ? "#fff" : "#333",
              fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
              transition: "all 0.15s",
              boxShadow: activeTab === id ? "0 1px 3px rgba(0,0,0,0.5)" : "none",
            }}>{label}</button>
          ))}
        </div>

        {/* ── Add Friends tab ───────────────────────────────────────────── */}
        {activeTab === "add" && (
          <div style={{ animation: "fadeIn 0.2s" }}>
            {requests.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#2a2a2a", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Waiting for you</div>
                {requests.map((req) => (
                  <div key={req.id} style={{
                    background: "#111116", border: "1px solid rgba(245,158,11,0.15)",
                    borderRadius: 12, padding: "11px 14px",
                    display: "flex", alignItems: "center", gap: 10, marginBottom: 7,
                  }}>
                    <Avatar name={req.name} size={38} color="#f59e0b" fontSize="0.9rem" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: "#e4e4e7", fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{req.name}</div>
                      <div style={{ fontSize: "0.68rem", color: "#444" }}>wants to connect</div>
                    </div>
                    <button onClick={() => acceptRequest(req.id)} style={{ background: "#22c55e", border: "none", padding: 8, borderRadius: 8, color: "#000", cursor: "pointer", display: "flex" }}>
                      <Check size={15} />
                    </button>
                    <button onClick={() => removeFriend(req.id)} style={{ background: "#1a1a1f", border: "1px solid #1e1e26", padding: 8, borderRadius: 8, color: "#555", cursor: "pointer", display: "flex" }}>
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {requests.length === 0 && (
              <div style={{ textAlign: "center", padding: "20px 0 16px", color: "#2a2a2a", fontSize: "0.82rem", border: "1px dashed #111116", borderRadius: 14, marginBottom: 18 }}>
                No pending requests
              </div>
            )}
            <div style={{ background: "#111116", border: "1px solid #1e1e26", borderRadius: 16, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 34, height: 34, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UserPlus size={16} color="#3b82f6" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9rem" }}>Find Friends</div>
                  <div style={{ fontSize: "0.68rem", color: "#333" }}>Invite by email</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <Search size={14} color="#2a2a2a" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    placeholder="friend@email.com"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendRequest()}
                    style={{ width: "100%", padding: "10px 11px 10px 34px", borderRadius: 9, background: "#0a0a0d", border: "1px solid #111116", color: "#fff", fontSize: "0.88rem" }}
                  />
                </div>
                <button
                  onClick={sendRequest}
                  disabled={addStatus === "loading" || !searchEmail}
                  style={{ padding: "0 16px", background: "#3b82f6", border: "none", borderRadius: 9, color: "#fff", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", opacity: !searchEmail ? 0.4 : 1 }}
                >
                  {addStatus === "loading" ? <Loader2 size={13} className="animate-spin" /> : "Send"}
                </button>
              </div>
              {addStatus === "success" && <div style={{ color: "#22c55e", marginTop: 9, fontSize: "0.78rem" }}>✨ Request sent!</div>}
              {addStatus === "error" && <div style={{ color: "#ef4444", marginTop: 9, fontSize: "0.78rem" }}>User not found or already added.</div>}
            </div>
          </div>
        )}

        {/* ── Leaderboard tab ───────────────────────────────────────────── */}
        {activeTab === "leaderboard" && (
          <div style={{ animation: "fadeIn 0.2s" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: "#333" }}>
                <Loader2 className="animate-spin" size={26} style={{ marginBottom: 10 }} />
                <div style={{ fontSize: "0.82rem" }}>Loading scoreboard…</div>
              </div>
            ) : friends.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#2a2a2a" }}>
                <Trophy size={36} style={{ opacity: 0.12, marginBottom: 10 }} />
                <div style={{ fontSize: "0.88rem", color: "#333" }}>No data yet</div>
                <div style={{ fontSize: "0.74rem", color: "#222", marginTop: 4 }}>Add friends to compete</div>
              </div>
            ) : (
              <>
                <SquadBanner />

                {/* ── AI SQUAD COACH CARD ── */}
                <div style={{
                  background: "linear-gradient(135deg,#0d1b2e,#1a1333)",
                  border: "1px solid #4338ca55",
                  borderRadius: 18,
                  padding: "16px 18px",
                  marginBottom: 18,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div style={{ background: "rgba(165,180,252,0.12)", padding: 8, borderRadius: 10 }}>
                        <Bot size={16} color="#a5b4fc" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#e0e7ff" }}>AI Squad Coach</div>
                        <div style={{ fontSize: "0.68rem", color: "#4338ca" }}>Live squad analysis</div>
                      </div>
                    </div>
                    <button
                      onClick={fetchSquadBriefing}
                      disabled={squadBriefingLoading || friends.length === 0}
                      style={{
                        background: squadBriefing ? "rgba(99,102,241,0.15)" : "linear-gradient(135deg,#4338ca,#6366f1)",
                        border: "1px solid #4338ca66",
                        color: squadBriefing ? "#a5b4fc" : "#fff",
                        borderRadius: 10,
                        padding: "6px 13px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: squadBriefingLoading || friends.length === 0 ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        opacity: friends.length === 0 ? 0.4 : 1,
                      }}
                    >
                      {squadBriefingLoading
                        ? <><Loader2 size={12} className="animate-spin" /> Analysing…</>
                        : squadBriefing
                          ? <><RefreshCw size={12} /> Refresh</>
                          : <><Zap size={12} /> Analyse Squad</>}
                    </button>
                  </div>

                  <div style={{ borderLeft: "2px solid #4338ca", paddingLeft: 14 }}>
                    {squadBriefingTools.length > 0 && !squadBriefingLoading && (
                      <ToolBadges tools={squadBriefingTools} />
                    )}
                    {squadBriefingLoading && !squadBriefing ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#555" }}>
                        {["#4338ca","#6366f1","#a5b4fc"].map((c, i) => (
                          <div key={c} style={{ width: 6, height: 6, borderRadius: "50%", background: c, animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }} />
                        ))}
                        <span style={{ fontSize: "0.82rem", color: "#555", marginLeft: 4 }}>Reading squad data…</span>
                      </div>
                    ) : squadBriefing ? (
                      <RenderText text={squadBriefing} streaming={squadBriefingLoading} />
                    ) : (
                      <p style={{ margin: 0, fontSize: "0.88rem", color: "#2a2a3a", lineHeight: 1.5 }}>
                        Tap <strong style={{ color: "#4338ca" }}>Analyse Squad</strong> to get a live AI breakdown of your squad&apos;s performance and a competitive challenge.
                      </p>
                    )}
                  </div>
                </div>

                <Podium top3={friends.slice(0, 3)} />

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {friends.map((friend, i) => {
                    const cheerState = cheered[friend.id];
                    return (
                      <div
                        key={friend.id}
                        onClick={() => handleViewLogs(friend)}
                        style={{
                          background: "#111116",
                          border: friend.isMe ? "1px solid rgba(59,130,246,0.35)" : "1px solid #1e1e26",
                          borderRadius: 14, padding: "12px 13px",
                          display: "flex", alignItems: "center", gap: 10,
                          cursor: "pointer",
                        }}
                      >
                        {/* Rank number */}
                        <div style={{
                          fontSize: "0.8rem", fontWeight: 800, width: 18, textAlign: "center", flexShrink: 0,
                          color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#a855f7" : "#555",
                        }}>{i + 1}</div>

                        <Avatar name={friend.name} size={38} color={friend.barColor} fontSize="0.95rem" />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Name row */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                              <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#e4e4e7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{friend.name}</span>
                              {friend.isMe && <span style={{ fontSize: "0.55rem", background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 4, padding: "1px 4px", flexShrink: 0 }}>you</span>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                              <span style={{ fontWeight: 800, fontSize: "1rem", color: friend.barColor }}>{friend.score}</span>
                              <span style={{ fontSize: "0.65rem", color: "#666", fontWeight: 500 }}>pts</span>
                              {!friend.isMe && (
                                <button onClick={(e) => { e.stopPropagation(); removeFriend(friend.relationshipId); }}
                                  style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 2, display: "flex" }}>
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Status + breakdown */}
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                            <span style={{ fontSize: "0.7rem", color: friend.barColor, fontWeight: 700 }}>{friend.statusLabel}</span>
                            <span style={{ fontSize: "0.62rem", color: "#444" }}>·</span>
                            <span style={{ fontSize: "0.65rem", color: "#777", fontWeight: 500 }}>
                              {friend.breakdown.base}
                              {friend.breakdown.bonus > 0 && <span style={{ color: "#4ade80" }}> +{friend.breakdown.bonus}</span>}
                              {friend.breakdown.penalty > 0 && <span style={{ color: "#f87171" }}> −{friend.breakdown.penalty}</span>}
                            </span>
                          </div>

                          {/* Score bar */}
                          <div style={{ height: 3, background: "#252528", borderRadius: 99, overflow: "hidden", marginBottom: 7 }}>
                            <div style={{ width: `${Math.min(100, (friend.score / 135) * 100)}%`, height: "100%", background: friend.barColor, borderRadius: 99, transition: "width 0.8s ease" }} />
                          </div>

                          {/* Key stats — calories / protein / water */}
                          <div style={{ display: "flex", gap: 10 }}>
                            {[
                              { icon: "🔥", val: friend.stats.cals, max: friend.targets.cals, unit: "", over: friend.stats.cals > friend.targets.cals },
                              { icon: "💪", val: friend.stats.p, max: friend.targets.p, unit: "g", over: false },
                              { icon: "💧", val: friend.stats.water, max: friend.targets.water, unit: "L", over: false },
                            ].map(({ icon, val, max, unit, over }) => (
                              <div key={icon} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: "0.68rem" }}>
                                <span>{icon}</span>
                                <span style={{ color: over ? "#f87171" : "#d4d4d8", fontWeight: 600 }}>{val}{unit}</span>
                                <span style={{ color: "#555" }}>/{max}{unit}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Cheer / nudge */}
                        <button
                          onClick={(e) => handleInteract(e, friend.id, friend.score === 0 ? "nudge" : "cheer")}
                          style={{
                            background: cheerState ? (cheerState === "cheer" ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.12)") : "#0f0f12",
                            border: cheerState ? `1px solid ${cheerState === "cheer" ? "#f59e0b44" : "#3b82f644"}` : "1px solid #111116",
                            width: 36, height: 36, borderRadius: 9,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", fontSize: "1rem",
                            transition: "all 0.15s",
                            transform: cheerState ? "scale(1.18)" : "scale(1)",
                            flexShrink: 0,
                          }}
                        >
                          {cheerState === "cheer" ? "🔥" : cheerState === "nudge" ? "👋" : friend.score === 0 ? "⚡" : "🏅"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
