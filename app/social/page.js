"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FLATTENED_DB } from "../food-data";
import {
  ArrowLeft,
  UserPlus,
  Check,
  X,
  Trophy,
  Flame,
  Zap,
  Search,
  Droplets,
  PieChart as PieIcon,
  Trash2,
  Utensils,
  Loader2,
  Leaf,
  Info,
  HelpCircle,
} from "lucide-react";
import { supabase } from "../supabase";

export default function SocialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [addStatus, setAddStatus] = useState("");
  const [cheered, setCheered] = useState({});

  // STATE FOR VIEWING LOGS & RULES
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendLogs, setFriendLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showGlobalRules, setShowGlobalRules] = useState(false);
  const [squadStats, setSquadStats] = useState(null);
  const [historicalStats, setHistoricalStats] = useState(null); // NEW: Historical comparison
  const [showSquadModal, setShowSquadModal] = useState(false); // NEW: Modal for squad info

  useEffect(() => {
    fetchSocialData();
  }, []);

  const handleViewLogs = async (friend) => {
    setSelectedFriend(friend);
    setLogsLoading(true);

    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", friend.id)
      .eq("date", today)
      .order("created_at", { ascending: false });

    const enhancedData = (data || []).map((log) => {
      if (!log.fiber && log.name !== "Water") {
        const dbItem = FLATTENED_DB[log.name.toLowerCase()];
        if (dbItem?.fiber) {
          return { ...log, fiber: Math.round(dbItem.fiber * log.qty) };
        }
      }
      return log;
    });

    setFriendLogs(enhancedData);
    setLogsLoading(false);
  };

  const closeLogs = () => {
    setSelectedFriend(null);
    setFriendLogs([]);
  };

  const HistoricalFaceoff = () => {
    if (!historicalStats || friends.length < 2) return null;
    const u1 = friends.find((f) => f.id === historicalStats.u1);
    const u2 = friends.find((f) => f.id === historicalStats.u2);
    if (!u1 || !u2) return null;

    const u1Wins = historicalStats.wins[u1.id];
    const u2Wins = historicalStats.wins[u2.id];
    const total = u1Wins + u2Wins || 1; // avoid div/0

    return (
      <div
        style={{
          marginBottom: 24,
          padding: 16,
          background: "#0f172a",
          borderRadius: 16,
          border: "1px solid #334155",
        }}
      >
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: "0.9rem",
            color: "#94a3b8",
            textAlign: "center",
          }}
        >
          ⚔️ Past 30 Days - Head to Head
        </h3>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: "bold",
                color: "#fff",
              }}
            >
              {u1.name.split(" ")[0]}
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "#64748b",
              }}
            >
              {u1Wins} wins
            </div>
          </div>
          <div style={{ fontSize: "1.5rem" }}>vs</div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: "bold",
                color: "#fff",
              }}
            >
              {u2.name.split(" ")[0]}
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "#64748b",
              }}
            >
              {u2Wins} wins
            </div>
          </div>
        </div>

        <div
          style={{
            height: 8,
            background: "#334155",
            borderRadius: 4,
            overflow: "hidden",
            display: "flex",
          }}
        >
          <div
            style={{
              width: `${(u1Wins / total) * 100}%`,
              background: "#3b82f6",
            }}
          />
          <div
            style={{
              width: `${(u2Wins / total) * 100}%`,
              background: "#ef4444",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 8,
            textAlign: "center",
            fontSize: "0.8rem",
            color: "#cbd5e1",
          }}
        >
          {u1Wins > u2Wins
            ? `${u1.name.split(" ")[0]} holds the crown! 👑`
            : u2Wins > u1Wins
            ? `${u2.name.split(" ")[0]} is dominating! 🔥`
            : "It's a dead heat! 🤝"}
        </div>
      </div>
    );
  };

  // NEW: Squad Goals Component (Modified for Modal)
  const SquadGoals = () => {
    if (!squadStats) return null;

    const totalProteinGoal = Math.max(squadStats.targetP, 1); // Ensure at least 1
    const totalWaterGoal = Math.max(squadStats.targetWater, 1);
    
    const pProgress = Number.isFinite(squadStats.p / totalProteinGoal) 
      ? Math.min(100, (squadStats.p / totalProteinGoal) * 100) 
      : 0;
      
    const wProgress = Number.isFinite(squadStats.water / totalWaterGoal) 
      ? Math.min(100, (squadStats.water / totalWaterGoal) * 100) 
      : 0;

    return (
      <div
        style={{
          background:
            "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
          padding: 20,
          borderRadius: 16,
          marginBottom: 24,
          boxShadow: "0 4px 20px rgba(49, 46, 129, 0.4)",
          border: "1px solid #4338ca",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 15,
          }}
        >
          <h3
            style={{
              margin: 0,
              color: "#e0e7ff",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Zap size={20} color="#fbbf24" fill="#fbbf24" /> Squad Goals
          </h3>
          <span
            style={{
              fontSize: "0.8rem",
              color: "#c7d2fe",
              background: "#4338ca",
              padding: "2px 8px",
              borderRadius: 12,
            }}
          >
            {squadStats.fighters} Fighters Active
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
          {/* Protein Goal */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Squad Protein</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#fbbf24' }}>
                {Math.round(pProgress)}%
              </span>
            </div>
            <div style={{ width: '100%', height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ 
                width: `${pProgress}%`, 
                height: '100%', 
                background: '#fbbf24',
                transition: 'width 1s ease'
              }} />
            </div>
            <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#94a3b8', textAlign: 'right' }}>
              {Math.round(squadStats.p)} / {totalProteinGoal}g
            </div>
          </div>

          {/* Water Goal */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Squad Hydration</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#60a5fa' }}>
                {Math.round(wProgress)}%
              </span>
            </div>
            <div style={{ width: '100%', height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ 
                width: `${wProgress}%`, 
                height: '100%', 
                background: '#60a5fa',
                transition: 'width 1s ease'
              }} />
            </div>
            <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#94a3b8', textAlign: 'right' }}>
              {squadStats.water.toFixed(1)} / {totalWaterGoal.toFixed(1)}L
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SquadDetailsModal = () => {
    if (!showSquadModal || !squadStats) return null;

    return (
      <div className="modal-overlay" style={{ zIndex: 9999 }}>
        <div className="modal-content" style={{ maxWidth: 500, background: '#1e293b', border: '1px solid #334155' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
             <h3 style={{ margin: 0, color: '#e0e7ff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={20} color="#fbbf24" fill="#fbbf24" /> Squad Stats
             </h3>
             <button 
               onClick={() => setShowSquadModal(false)}
               style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
             >
               <X size={24} />
             </button>
           </div>
           
           <div style={{ overflowY: 'auto', maxHeight: '70vh' }}>
             {/* Squad Goals Section */}
             <div style={{ marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#94a3b8' }}>Today&apos;s Progress</h4>
                <SquadGoals />
             </div>
             
             {/* Historical Faceoff Section */}
             {historicalStats && (
               <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#94a3b8' }}>History</h4>
                  <HistoricalFaceoff />
               </div>
             )}
           </div>
        </div>
      </div>
    );
  };

  const calculateTargets = (prof) => {
    if (!prof || !prof.weight)
      return {
        targetCals: 2000,
        targetMacros: { p: 150, c: 200, f: 65, fib: 28 }, // Matches dashboard structure
        p: 150, // Backwards compat
        c: 200,
        f: 65,
        fib: 28,
        water: 3,
        waterTarget: 3 // Matches dashboard structure
      };

    let targetCals = 2000;
    if (prof.target_calories) {
      targetCals = Number(prof.target_calories);
    } else {
      let bmr = 10 * prof.weight + 6.25 * prof.height - 5 * prof.age;
      bmr += prof.gender === "male" ? 5 : -161;
      const multipliers = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
      };
      let tdee = bmr * (multipliers[prof.activity] || 1.2);
      targetCals = Math.round(tdee);
      if (prof.goal === "lose") targetCals -= 500;
      else if (prof.goal === "gain") targetCals += 300;
    }

    const weight = Number(prof.weight);
    let targetP, targetF, targetC;

    if (prof.goal === "lose") {
      targetP = Math.round(weight * 2.2);
      targetF = Math.round((targetCals * 0.3) / 9);
    } else if (prof.goal === "gain") {
      targetP = Math.round(weight * 1.8);
      targetF = Math.round((targetCals * 0.25) / 9);
    } else {
      targetP = Math.round(weight * 1.6);
      targetF = Math.round((targetCals * 0.3) / 9);
    }

    const usedCals = targetP * 4 + targetF * 9;
    targetC = Math.round(Math.max(0, targetCals - usedCals) / 4);
    const targetFib = Math.round((targetCals / 1000) * 14);

    let waterTarget = Math.round(weight * 0.035 * 10) / 10;
    if (prof.activity === "active" || prof.activity === "moderate")
      waterTarget += 0.5;

    // Return structure matching Dashboard's calculateTargets AND local expectations
    return {
      cals: targetCals,
      p: targetP,
      c: targetC,
      f: targetF,
      fib: targetFib,
      water: waterTarget,
      
      // Dashboard compatibility
      targetCals,
      targetMacros: { p: targetP, c: targetC, f: targetF, fib: targetFib },
      waterTarget
    };
  };

  const fetchSocialData = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/");
      return;
    }
    const myId = session.user.id;

    const { data: links } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_id.eq.${myId},friend_id.eq.${myId}`);

    const getUserData = async (uid) => {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      const { data: logs } = await supabase
        .from("food_logs")
        .select("*")
        .eq("user_id", uid)
        .eq("date", new Date().toISOString().slice(0, 10));

      const stats = logs?.reduce(
        (acc, item) => {
          let currentFib = item.fiber || 0;
          if (!currentFib && item.name !== "Water") {
            const dbItem = FLATTENED_DB[item.name.toLowerCase()];
            if (dbItem?.fiber) {
              currentFib = Math.round(dbItem.fiber * item.qty);
            }
          }
          return {
            cals: acc.cals + (item.calories || 0),
            p: acc.p + (item.protein || 0),
            c: acc.c + (item.carbs || 0),
            f: acc.f + (item.fats || 0),
            fib: acc.fib + currentFib,
            water:
              item.name === "Water" ? acc.water + item.qty * 0.25 : acc.water,
          };
        },
        { cals: 0, p: 0, c: 0, f: 0, fib: 0, water: 0 },
      ) || { cals: 0, p: 0, c: 0, f: 0, fib: 0, water: 0 };

      const targets = calculateTargets(profile);

      // --- SCORING LOGIC ---
      const getCapPct = (val, target) =>
        Math.min(100, (val / target) * 100) || 0;

      const baseScore = Math.round(
        (getCapPct(stats.cals, targets.cals) +
          getCapPct(stats.p, targets.p) +
          getCapPct(stats.c, targets.c) +
          getCapPct(stats.f, targets.f) +
          getCapPct(stats.fib, targets.fib) +
          getCapPct(stats.water, targets.water)) /
          6,
      );

      let penaltyPoints = 0;

      // 1. Calorie Penalty: -5 pts for every 10% exceeded
      if (stats.cals > targets.cals) {
        const excessCalPct = (stats.cals - targets.cals) / targets.cals;
        penaltyPoints += Math.floor(excessCalPct * 10) * 5;
      }

      // 2. Fat Penalty: -5 pts for every 10% exceeded
      if (stats.f > targets.f) {
        const excessFatPct = (stats.f - targets.f) / targets.f;
        penaltyPoints += Math.floor(excessFatPct * 10) * 5;
      }

      // 3. Carb Penalty: -3 pts for every 10% exceeded
      if (stats.c > targets.c) {
        const excessCarbPct = (stats.c - targets.c) / targets.c;
        penaltyPoints += Math.floor(excessCarbPct * 10) * 3;
      }

      let bonusPoints = 0;
      if (stats.p >= targets.p * 0.9) bonusPoints += 15;
      if (stats.fib >= targets.fib * 0.9) bonusPoints += 10;
      if (stats.water >= targets.water * 0.9) bonusPoints += 10;

      const finalScore = Math.max(
        0,
        Math.round(baseScore + bonusPoints - penaltyPoints),
      );

      let statusLabel = "Sleeping 😴";
      let barColor = "#3b82f6";

      if (finalScore > 20) statusLabel = "Started 🏁";
      if (finalScore > 60) statusLabel = "Grinding 🏃";
      if (finalScore > 90) {
        statusLabel = "Crushing It 🔥";
        barColor = "#22c55e";
      }
      if (finalScore >= 120) {
        statusLabel = "God Mode 🏆";
        barColor = "#f59e0b";
      }

      // NEW: Return detailed progress for Squad Goals
      return {
        id: uid,
        name: profile?.username || profile?.email?.split("@")[0] || "User",
        stats,
        targets,
        score: finalScore,
        breakdown: {
          base: baseScore,
          bonus: bonusPoints,
          penalty: penaltyPoints,
        },
        statusLabel,
        barColor,
        isMe: uid === myId,
        // Calculate completion percentages for ticker
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
          const { data } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("user_id", otherUserId)
            .maybeSingle();
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

    // Sort by score to find top 2 for race/squad
    const sortedFriends = friendList.sort((a, b) => b.score - a.score);
    const top2 = sortedFriends.slice(0, 2);

    // NEW: Calculate Squad Stats for only top 2
    const totalSquadStats = top2.reduce((acc, curr) => {
      // FIX: Use the SAME robust calculation logic as dashboard
      
      const tP = curr.targets?.targetMacros?.p || 
                 (curr.targets?.p) || 
                 (curr.targets?.targetP) || 
                 150;

      const tW = curr.targets?.waterTarget || 
                 (curr.targets?.water) || 
                 3;
      
      return {
        cals: acc.cals + (Number(curr.stats?.cals) || 0),
        p: acc.p + (Number(curr.stats?.p) || 0),
        water: acc.water + (Number(curr.stats?.water) || 0),
        targetP: acc.targetP + Number(tP),
        targetWater: acc.targetWater + Number(tW),
        fighters: acc.fighters + 1
      };
    }, { cals: 0, p: 0, water: 0, targetP: 0, targetWater: 0, fighters: 0 });
    
    setSquadStats(totalSquadStats);
    setFriends(sortedFriends);
    setRequests(requestList);

    // NEW: Fetch Historical Data for top 2
    if (top2.length === 2) {
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i - 1); // Start from yesterday
        return d.toISOString().slice(0, 10);
      });

      const { data: historyLogs } = await supabase
        .from("food_logs")
        .select(
          "user_id, date, calories, protein, carbs, fats, fiber, name, qty",
        )
        .in("user_id", top2.map((u) => u.id))
        .in("date", last30Days);

      // Process history to find winner
      const wins = { [top2[0].id]: 0, [top2[1].id]: 0 };

      last30Days.forEach((date) => {
        const dayLogs = historyLogs?.filter((l) => l.date === date) || [];

        // Calculate daily scores for each user on this date
        const dayScores = top2.map((user) => {
          const userLogs = dayLogs.filter((l) => l.user_id === user.id);
          if (!userLogs.length) return { id: user.id, score: 0 };

          const stats = userLogs.reduce(
            (acc, item) => {
              // ... simplified stat calculation logic from main function ...
              return {
                cals: acc.cals + (item.calories || 0),
                // We only really need cals/protein/water for rough scoring if full scoring is complex
                // but let's try to match main logic loosely or just use cals adherence
                // however, if item.calories is null/undefined, this won't help
                p: acc.p + (item.protein || 0),
                c: acc.c + (item.carbs || 0),
                f: acc.f + (item.fats || 0),
              };
            },
            { cals: 0, p: 0, c: 0, f: 0 },
          );

          // Simplified scoring for history (just calorie adherence)
          const targetCals = user.targets.cals;
          const diff = Math.abs(stats.cals - targetCals);
          const score = Math.max(0, 100 - (diff / targetCals) * 100); // Simple adherence score
          return { id: user.id, score };
        });

        if (dayScores[0].score > dayScores[1].score) wins[dayScores[0].id]++;
        else if (dayScores[1].score > dayScores[0].score) wins[dayScores[1].id]++;
      });

      setHistoricalStats({
        u1: top2[0].id,
        u2: top2[1].id,
        wins,
      });
    }

    setLoading(false);
  };

  const handleInteract = (e, id, type) => {
    e.stopPropagation();
    setCheered((prev) => ({ ...prev, [id]: type }));
    setTimeout(() => setCheered((prev) => ({ ...prev, [id]: null })), 2000);
  };

  const sendRequest = async () => {
    setAddStatus("loading");
    try {
      const { error } = await supabase.rpc("send_friend_request", {
        target_email: searchEmail,
      });
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
    await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", id);
    fetchSocialData();
  };

  const removeFriend = async (id) => {
    if (!confirm("Are you sure you want to remove this friend?")) return;
    await supabase.from("friendships").delete().eq("id", id);
    fetchSocialData();
  };

  const Podium = ({ top3 }) => (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 10,
        marginBottom: 40,
        marginTop: 10,
      }}
    >
      {top3[1] && (
        <div
          onClick={() => handleViewLogs(top3[1])}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "30%",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              marginBottom: 8,
              fontWeight: 700,
              fontSize: "0.9rem",
              color: "#94a3b8",
              textAlign: "center",
            }}
          >
            {top3[1].name}
          </div>
          <div
            style={{
              width: "100%",
              height: 80,
              background: "linear-gradient(to top, #334155, #475569)",
              borderRadius: "12px 12px 0 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderTop: "4px solid #94a3b8",
            }}
          >
            <span
              style={{ fontSize: "1.5rem", fontWeight: 800, color: "#cbd5e1" }}
            >
              2
            </span>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: "0.9rem",
              fontWeight: "700",
              color: "#94a3b8",
            }}
          >
            {top3[1].score} pts
          </div>
        </div>
      )}
      {top3[0] && (
        <div
          onClick={() => handleViewLogs(top3[0])}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "35%",
            zIndex: 2,
            cursor: "pointer",
          }}
        >
          <Flame
            size={24}
            color="#f59e0b"
            style={{ marginBottom: 4 }}
            className="animate-bounce"
          />
          <div
            style={{
              marginBottom: 8,
              fontWeight: 800,
              fontSize: "1rem",
              color: "#f59e0b",
              textAlign: "center",
            }}
          >
            {top3[0].name}
          </div>
          <div
            style={{
              width: "100%",
              height: 110,
              background: "linear-gradient(to top, #78350f, #b45309)",
              borderRadius: "12px 12px 0 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderTop: "4px solid #f59e0b",
              boxShadow: "0 0 20px rgba(245, 158, 11, 0.2)",
            }}
          >
            <span
              style={{ fontSize: "2rem", fontWeight: 800, color: "#fcd34d" }}
            >
              1
            </span>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: "1.1rem",
              fontWeight: 800,
              color: "#f59e0b",
            }}
          >
            {top3[0].score} pts
          </div>
        </div>
      )}
      {top3[2] && (
        <div
          onClick={() => handleViewLogs(top3[2])}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "30%",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              marginBottom: 8,
              fontWeight: 700,
              fontSize: "0.9rem",
              color: "#a855f7",
              textAlign: "center",
            }}
          >
            {top3[2].name}
          </div>
          <div
            style={{
              width: "100%",
              height: 60,
              background: "linear-gradient(to top, #4c1d95, #6b21a8)",
              borderRadius: "12px 12px 0 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderTop: "4px solid #a855f7",
            }}
          >
            <span
              style={{ fontSize: "1.5rem", fontWeight: 800, color: "#e9d5e1" }}
            >
              3
            </span>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: "0.9rem",
              fontWeight: "700",
              color: "#a855f7",
            }}
          >
            {top3[2].score} pts
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="app-wrapper"
      style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}
    >
      {/* GLOBAL RULES MODAL */}
      {showGlobalRules && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: 400 }}>
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
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Trophy size={20} color="#f59e0b" /> Scoring System
              </h3>
              <button
                onClick={() => setShowGlobalRules(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#666",
                  cursor: "pointer",
                }}
              >
                <X size={24} />
              </button>
            </div>
            <div
              style={{
                lineHeight: 1.6,
                color: "#ccc",
                fontSize: "0.9rem",
                overflowY: "auto",
                maxHeight: "70vh",
              }}
            >
              <div
                style={{
                  marginBottom: 12,
                  paddingBottom: 12,
                  borderBottom: "1px solid #333",
                }}
              >
                <strong style={{ color: "#fff", fontSize: "1rem" }}>
                  Max Possible Score: 135
                </strong>
              </div>

              <div style={{ marginBottom: 12 }}>
                <strong style={{ color: "#fff" }}>
                  1. Base Score (Max 100)
                </strong>
                <div style={{ fontSize: "0.8rem", color: "#888" }}>
                  Average % of all your daily goals (capped at 100%).
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <strong style={{ color: "#22c55e" }}>
                  2. Bonuses (Max 35)
                </strong>
                <ul
                  style={{
                    margin: "4px 0",
                    paddingLeft: 20,
                    fontSize: "0.8rem",
                  }}
                >
                  <li>
                    <strong>+15 pts:</strong> Hit 90% of Protein goal
                  </li>
                  <li>
                    <strong>+10 pts:</strong> Hit 90% of Fiber goal
                  </li>
                  <li>
                    <strong>+10 pts:</strong> Hit 90% of Water goal
                  </li>
                </ul>
              </div>

              <div>
                <strong style={{ color: "#ef4444" }}>
                  3. Penalties (Unlimited)
                </strong>
                <ul
                  style={{
                    margin: "4px 0",
                    paddingLeft: 20,
                    fontSize: "0.8rem",
                  }}
                >
                  <li>
                    <strong>-5 pts:</strong> Per 10% over Calorie limit
                  </li>
                  <li>
                    <strong>-5 pts:</strong> Per 10% over Fat limit
                  </li>
                  <li>
                    <strong>-3 pts:</strong> Per 10% over Carb limit
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* SQUAD DETAILS MODAL */}
      {showSquadModal && <SquadDetailsModal />}

      {/* NEW: Race and Squad Goals Integrated Here - REMOVED, Replaced with Button */}
      {friends.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => setShowSquadModal(true)}
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
              border: 0,
              padding: '12px 24px',
              borderRadius: 24,
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
          >
            <Zap size={18} fill="#fbbf24" color="#fbbf24" /> View Squad Details & Faceoff
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 8,
            color: "#64748b",
          }}
        >
          <ArrowLeft size={24} />
        </button>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>
          Social Hub
        </h1>
        <div style={{ flex: 1 }} />
        {/* --- NEW POINTS SYSTEM BUTTON --- */}
        <button
          onClick={() => setShowGlobalRules(true)}
          style={{
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            padding: "8px 16px",
            borderRadius: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "0.85rem",
            fontWeight: 700,
            boxShadow: "0 4px 15px rgba(59, 130, 246, 0.3)",
            whiteSpace: "nowrap",
          }}
        >
          <HelpCircle size={16} /> Points System
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          padding: 4,
          background: "#1f1f22",
          borderRadius: 16,
          marginBottom: 30,
          border: "1px solid #333",
        }}
      >
        <button
          onClick={() => setActiveTab("leaderboard")}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: 12,
            background: activeTab === "leaderboard" ? "#333" : "transparent",
            color: activeTab === "leaderboard" ? "#fff" : "#888",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          Leaderboard
        </button>
        <button
          onClick={() => setActiveTab("add")}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: 12,
            background: activeTab === "add" ? "#333" : "transparent",
            color: activeTab === "add" ? "#fff" : "#888",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          Add Friends{" "}
          {requests.length > 0 && (
            <div
              style={{
                width: 8,
                height: 8,
                background: "#ef4444",
                borderRadius: "50%",
              }}
            ></div>
          )}
        </button>
      </div>

      {activeTab === "add" && (
        <div style={{ animation: "fadeIn 0.3s" }}>
          {requests.length > 0 ? (
            <div style={{ marginBottom: 30 }}>
              <h3
                style={{
                  fontSize: "0.8rem",
                  color: "#888",
                  marginBottom: 12,
                  fontWeight: 700,
                  letterSpacing: 1,
                }}
              >
                WAITING FOR YOU
              </h3>
              {requests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    background: "#1f1f22",
                    padding: "15px",
                    borderRadius: 16,
                    border: "1px solid #333",
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 10,
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "#3b82f6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "1.1rem",
                        flexShrink: 0,
                      }}
                    >
                      {req.name[0].toUpperCase()}
                    </div>
                    <div
                      style={{
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {req.name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#888" }}>
                        wants to connect
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => acceptRequest(req.id)}
                      style={{
                        background: "#22c55e",
                        border: "none",
                        padding: 10,
                        borderRadius: 10,
                        color: "#000",
                        cursor: "pointer",
                      }}
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={() => removeFriend(req.id)}
                      style={{
                        background: "#ef4444",
                        border: "none",
                        padding: 10,
                        borderRadius: 10,
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: "#666",
                border: "2px dashed #333",
                borderRadius: 20,
                marginBottom: 30,
              }}
            >
              No pending requests
            </div>
          )}

          <div
            style={{
              background: "#1f1f22",
              padding: 30,
              borderRadius: 24,
              border: "1px solid #333",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 15,
              }}
            >
              <div
                style={{ padding: 10, background: "#333", borderRadius: 10 }}
              >
                <UserPlus size={24} color="#3b82f6" />
              </div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>
                Find Friends
              </h2>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Search
                  size={18}
                  color="#666"
                  style={{ position: "absolute", left: 14, top: 14 }}
                />
                <input
                  placeholder="friend@email.com"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "14px 14px 14px 44px",
                    borderRadius: 12,
                    background: "#000",
                    border: "1px solid #333",
                    color: "#fff",
                    fontSize: "1rem",
                  }}
                />
              </div>
              <button
                onClick={sendRequest}
                disabled={addStatus === "loading"}
                style={{
                  padding: "0 24px",
                  background: "#3b82f6",
                  border: "none",
                  borderRadius: 12,
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {addStatus === "loading" ? "..." : "Send"}
              </button>
            </div>
            {addStatus === "success" && (
              <div
                style={{ color: "#22c55e", marginTop: 15, fontSize: "0.9rem" }}
              >
                ✨ Request Sent!
              </div>
            )}
            {addStatus === "error" && (
              <div
                style={{ color: "#ef4444", marginTop: 15, fontSize: "0.9rem" }}
              >
                User not found or already added.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "leaderboard" && (
        <div style={{ animation: "fadeIn 0.3s" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#666", marginTop: 40 }}>
              Loading scoreboard...
            </div>
          ) : friends.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", marginTop: 40 }}>
              No data found.
            </div>
          ) : (
            <>
              <Podium top3={friends.slice(0, 3)} />
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {friends.map((friend, i) => (
                  <div
                    key={friend.id}
                    onClick={() => handleViewLogs(friend)}
                    style={{
                      background: "#1f1f22",
                      padding: 16,
                      borderRadius: 16,
                      border: friend.isMe
                        ? "2px solid #3b82f6"
                        : "1px solid #333",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      position: "relative",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: "#666",
                        width: 20,
                        textAlign: "center",
                      }}
                    >
                      {i + 1}
                    </div>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "#333",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "1.1rem",
                        color: "#ccc",
                      }}
                    >
                      {friend.name[0].toUpperCase()}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: "1rem" }}>
                            {friend.name}
                          </span>
                          {!friend.isMe && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFriend(friend.relationshipId);
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#666",
                                cursor: "pointer",
                                padding: 4,
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            color: friend.barColor,
                          }}
                        >
                          {friend.score} pts
                        </div>
                      </div>

                      {/* SCORE BREAKDOWN MINI */}
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "#888",
                          display: "flex",
                          gap: 6,
                          marginBottom: 8,
                        }}
                      >
                        <span>Base: {friend.breakdown.base}</span>
                        <span style={{ color: "#22c55e" }}>
                          +{friend.breakdown.bonus}
                        </span>
                        <span style={{ color: "#ef4444" }}>
                          -{friend.breakdown.penalty}
                        </span>
                      </div>

                      <div
                        style={{
                          width: "100%",
                          height: 6,
                          background: "#333",
                          borderRadius: 3,
                          marginBottom: 8,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, (friend.score / 135) * 100)}%`, // Corrected Scale
                            height: "100%",
                            background: friend.barColor,
                            borderRadius: 3,
                            transition: "width 1s ease",
                          }}
                        ></div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          fontSize: "0.7rem",
                          color: "#888",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            color:
                              friend.stats.cals > friend.targets.cals
                                ? "#ef4444"
                                : "#888",
                          }}
                        >
                          <Flame size={12} color="#f59e0b" />
                          <span style={{ color: "#fff" }}>
                            {friend.stats.cals}
                          </span>
                          /{friend.targets.cals}
                        </span>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Zap size={12} color="#3b82f6" />
                          <span style={{ color: "#fff" }}>
                            {friend.stats.p}
                          </span>
                          /{friend.targets.p}g
                        </span>
                        {/* Highlights if over limit */}
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            color:
                              friend.stats.c > friend.targets.c
                                ? "#ef4444"
                                : "#888",
                          }}
                        >
                          <PieIcon size={12} color="#10b981" />
                          <span style={{ color: "#fff" }}>
                            {friend.stats.c}
                          </span>
                          /{friend.targets.c}g
                        </span>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            color:
                              friend.stats.f > friend.targets.f
                                ? "#ef4444"
                                : "#888",
                          }}
                        >
                          <PieIcon size={12} color="#ef4444" />
                          <span style={{ color: "#fff" }}>
                            {friend.stats.f}
                          </span>
                          /{friend.targets.f}g
                        </span>
                        {/* Water added for completeness */}
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Leaf size={12} color="#a855f7" />
                          <span style={{ color: "#fff" }}>
                            {friend.stats.fib}
                          </span>
                          /{friend.targets.fib}g
                        </span>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Droplets size={12} color="#f59e0b" />
                          <span style={{ color: "#fff" }}>
                            {friend.stats.water}
                          </span>
                          /{friend.targets.water}L
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) =>
                        handleInteract(
                          e,
                          friend.id,
                          friend.score === 0 ? "nudge" : "cheer",
                        )
                      }
                      style={{
                        background: "#333",
                        border: "none",
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.1s",
                        transform: cheered[friend.id]
                          ? "scale(1.1)"
                          : "scale(1)",
                      }}
                    >
                      {cheered[friend.id] === "cheer" ? (
                        "🔥"
                      ) : cheered[friend.id] === "nudge" ? (
                        "👋"
                      ) : friend.score === 0 ? (
                        <Zap size={18} color="#666" />
                      ) : (
                        <Trophy size={18} color="#f59e0b" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Render Squad Details Modal */}
      <SquadDetailsModal />
    </div>
  );
}
