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

  const calculateTargets = (prof) => {
    if (!prof || !prof.weight)
      return { cals: 2000, p: 150, c: 200, f: 65, fib: 28, water: 3 };

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

    return {
      cals: targetCals,
      p: targetP,
      c: targetC,
      f: targetF,
      fib: targetFib,
      water: waterTarget,
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

    setFriends(friendList.sort((a, b) => b.score - a.score));
    setRequests(requestList);
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
              style={{ fontSize: "1.5rem", fontWeight: 800, color: "#e9d5ff" }}
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
            <div style={{ lineHeight: 1.6, color: "#ccc", fontSize: "0.9rem" }}>
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

      {selectedFriend && (
        <div className="modal-overlay">
          <div
            className="modal-content"
            style={{
              width: "90%",
              maxWidth: 450,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                {selectedFriend.name}'s Meals
              </h3>
              <button
                onClick={closeLogs}
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

            {/* --- 1. TOTAL SCORE DISPLAY --- */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#888",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Total Score
              </div>
              <div
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 800,
                  color: selectedFriend.barColor,
                }}
              >
                {selectedFriend.score}{" "}
                <span style={{ fontSize: "1rem", color: "#666" }}>/ 135</span>
              </div>
            </div>

            {/* --- 2. INTAKE vs GOAL GRID --- */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  background: "rgba(59, 130, 246, 0.1)",
                  padding: "10px 4px",
                  borderRadius: 8,
                  textAlign: "center",
                  border: "1px solid rgba(59, 130, 246, 0.2)",
                }}
              >
                <div
                  style={{ fontSize: "0.7rem", color: "#888", marginBottom: 4 }}
                >
                  Protein
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  <span style={{ color: "#3b82f6" }}>
                    {selectedFriend.stats.p}
                  </span>
                  /{selectedFriend.targets.p}g
                </div>
              </div>
              <div
                style={{
                  background: "rgba(168, 85, 247, 0.1)",
                  padding: "10px 4px",
                  borderRadius: 8,
                  textAlign: "center",
                  border: "1px solid rgba(168, 85, 247, 0.2)",
                }}
              >
                <div
                  style={{ fontSize: "0.7rem", color: "#888", marginBottom: 4 }}
                >
                  Fiber
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  <span style={{ color: "#a855f7" }}>
                    {selectedFriend.stats.fib}
                  </span>
                  /{selectedFriend.targets.fib}g
                </div>
              </div>
              <div
                style={{
                  background: "rgba(59, 130, 246, 0.1)",
                  padding: "10px 4px",
                  borderRadius: 8,
                  textAlign: "center",
                  border: "1px solid rgba(59, 130, 246, 0.2)",
                }}
              >
                <div
                  style={{ fontSize: "0.7rem", color: "#888", marginBottom: 4 }}
                >
                  Water
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  <span style={{ color: "#3b82f6" }}>
                    {selectedFriend.stats.water}
                  </span>
                  /{selectedFriend.targets.water}L
                </div>
              </div>
            </div>

            {/* --- 3. DETAILED BREAKDOWN --- */}
            <div
              style={{
                background: "#18181b",
                padding: 16,
                borderRadius: 12,
                marginBottom: 20,
                border: "1px solid #333",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span style={{ color: "#888", fontSize: "0.9rem" }}>
                  Base Consistency
                </span>
                <span style={{ color: "#fff", fontWeight: 700 }}>
                  {selectedFriend.breakdown.base}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span style={{ color: "#888", fontSize: "0.9rem" }}>
                  Bonuses
                </span>
                <span style={{ color: "#22c55e", fontWeight: 700 }}>
                  +{selectedFriend.breakdown.bonus}
                </span>
              </div>
              {/* Detailed Bonuses */}
              {selectedFriend.stats.p >= selectedFriend.targets.p * 0.9 && (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#22c55e",
                    paddingLeft: 10,
                    marginBottom: 2,
                  }}
                >
                  • Protein Hit (+15)
                </div>
              )}
              {selectedFriend.stats.fib >= selectedFriend.targets.fib * 0.9 && (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#22c55e",
                    paddingLeft: 10,
                    marginBottom: 2,
                  }}
                >
                  • Fiber Hit (+10)
                </div>
              )}
              {selectedFriend.stats.water >=
                selectedFriend.targets.water * 0.9 && (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#22c55e",
                    paddingLeft: 10,
                    marginBottom: 6,
                  }}
                >
                  • Water Hit (+10)
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop: "1px solid #333",
                  paddingTop: 6,
                  marginTop: 4,
                }}
              >
                <span style={{ color: "#888", fontSize: "0.9rem" }}>
                  Penalties
                </span>
                <span style={{ color: "#ef4444", fontWeight: 700 }}>
                  -{selectedFriend.breakdown.penalty}
                </span>
              </div>
              {/* Detailed Penalties */}
              {selectedFriend.stats.cals > selectedFriend.targets.cals && (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#ef4444",
                    paddingLeft: 10,
                    marginBottom: 2,
                  }}
                >
                  • Calorie Overkill (-
                  {Math.floor(
                    ((selectedFriend.stats.cals - selectedFriend.targets.cals) /
                      selectedFriend.targets.cals) *
                      10,
                  ) * 5}
                  )
                </div>
              )}
              {selectedFriend.stats.f > selectedFriend.targets.f && (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#ef4444",
                    paddingLeft: 10,
                    marginBottom: 2,
                  }}
                >
                  • Fat Overkill (-
                  {Math.floor(
                    ((selectedFriend.stats.f - selectedFriend.targets.f) /
                      selectedFriend.targets.f) *
                      10,
                  ) * 5}
                  )
                </div>
              )}
              {selectedFriend.stats.c > selectedFriend.targets.c && (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#ef4444",
                    paddingLeft: 10,
                  }}
                >
                  • Carb Overkill (-
                  {Math.floor(
                    ((selectedFriend.stats.c - selectedFriend.targets.c) /
                      selectedFriend.targets.c) *
                      10,
                  ) * 3}
                  )
                </div>
              )}
            </div>

            {logsLoading ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: 150,
                }}
              >
                <Loader2 className="animate-spin" color="#666" />
              </div>
            ) : friendLogs.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 40,
                  color: "#666",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Utensils size={40} style={{ opacity: 0.3 }} />
                <p>No food logged today.</p>
              </div>
            ) : (
              <div style={{ overflowY: "auto", paddingRight: 5 }}>
                {friendLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      background: "#1f1f22",
                      padding: "12px",
                      borderRadius: 12,
                      marginBottom: 10,
                      border:
                        log.name === "Water"
                          ? "1px solid #1e3a8a"
                          : "1px solid #333",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.95rem",
                          textTransform: "capitalize",
                          color: "#fff",
                        }}
                      >
                        {log.qty}x {log.name}
                      </div>
                      {log.name !== "Water" && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#888",
                            marginTop: 4,
                            display: "flex",
                            gap: 8,
                          }}
                        >
                          <span style={{ color: "#3b82f6" }}>
                            P: {log.protein}
                          </span>
                          <span style={{ color: "#10b981" }}>
                            C: {log.carbs}
                          </span>
                          <span style={{ color: "#f59e0b" }}>
                            F: {log.fats}
                          </span>
                          <span style={{ color: "#a855f7" }}>
                            Fib: {log.fiber || 0}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: log.name === "Water" ? "#3b82f6" : "#fff",
                        }}
                      >
                        {log.name === "Water"
                          ? `${log.qty * 0.25}L`
                          : log.calories}
                      </div>
                      {log.name !== "Water" && (
                        <div style={{ fontSize: "0.7rem", color: "#666" }}>
                          kcal
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "#1f1f22",
              border: "1px solid #333",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 10,
              borderRadius: 10,
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: 0 }}>
            Social Hub
          </h1>
        </div>

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
    </div>
  );
}
