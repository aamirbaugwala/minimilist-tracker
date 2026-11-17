"use client";

/**
 * Social (Direction A).
 *   Leaderboard: squad-today summary (avg protein / water across everyone),
 *                the head-to-head link, and a calm ranked list. Tap a person
 *                for their score breakdown and today's food.
 *   Friends:     requests waiting for you + invite by email.
 * Scores are computed per person against their own targets (rules sheet).
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2, RefreshCw, Swords, X } from "lucide-react";
import { FLATTENED_DB } from "../food-data";
import { calculateTargets, capPct } from "../lib/nutrition";
import { computeFaceoff } from "../lib/socialScoring";
import { supabase } from "../supabase";
import PageHeader, { SegmentedTabs, headerActionStyle } from "../components/PageHeader";
import { Avatar, statusFor } from "../components/social/ui";
import FaceoffModal from "../components/social/FaceoffModal";
import FriendModal from "../components/social/FriendModal";
import RulesModal from "../components/social/RulesModal";
import { sheetInput, primaryBtn } from "../components/Sheet";
import { dayKey } from "../lib/day";

export default function SocialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [addStatus, setAddStatus] = useState("");
  const [addError, setAddError] = useState("");

  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendLogs, setFriendLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showGlobalRules, setShowGlobalRules] = useState(false);
  const [, setSquadStats] = useState(null);
  const [historicalStats, setHistoricalStats] = useState(null);
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [faceoffLoading, setFaceoffLoading] = useState(false);

  const refreshFaceoff = async () => {
    if (faceoffLoading || friends.length < 2) return;
    setFaceoffLoading(true);
    try {
      setHistoricalStats(await computeFaceoff(friends.slice(0, 2)));
    } finally {
      setFaceoffLoading(false);
    }
  };

  // ── View a friend's logs ───────────────────────────────────────────────────
  const handleViewLogs = async (friend) => {
    setSelectedFriend(friend);
    setLogsLoading(true);
    const today = dayKey();
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
        .eq("user_id", uid).eq("date", dayKey());

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

      return {
        id: uid,
        name: profile?.username || profile?.email?.split("@")[0] || "User",
        stats, targets,
        score: finalScore,
        breakdown: { base: baseScore, bonus: bonusPoints, penalty: penaltyPoints },
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

    // All-time head-to-head between the top 2. computeFaceoff() pages through
    // the complete log history — see lib/socialScoring.js for why the previous
    // single .limit(50000) query silently froze these totals.
    if (top2.length === 2) {
      setHistoricalStats(await computeFaceoff(top2));
    }

    setLoading(false);
    setRefreshing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchSocialData(); }, [fetchSocialData]);

  const sendRequest = async () => {
    setAddStatus("loading");
    try {
      const { error } = await supabase.rpc("send_friend_request", { target_email: searchEmail });
      if (error) throw error;
      setAddStatus("success");
      setSearchEmail("");
      fetchSocialData();
    } catch (e) {
      setAddError(e.message || "");
      setAddStatus("error");
    }
  };

  const acceptRequest = async (id) => {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    fetchSocialData();
  };

  const removeFriend = async (id) => {
    if (!confirm("Remove this friend? You can add them again later.")) return;
    await supabase.from("friendships").delete().eq("id", id);
    fetchSocialData();
  };

  // Squad today: average share of protein and water goals across everyone.
  const avgPct = (key, tKey) =>
    friends.length ? Math.round(friends.reduce((n, f) => n + Math.min(100, ((f.stats[key] || 0) / (f.targets[tKey] || 1)) * 100), 0) / friends.length) : 0;
  const u1 = historicalStats && friends.find((f) => f.id === historicalStats.u1);
  const u2 = historicalStats && friends.find((f) => f.id === historicalStats.u2);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "var(--text)", maxWidth: 640, margin: "0 auto", paddingBottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}>
      <RulesModal showGlobalRules={showGlobalRules} setShowGlobalRules={setShowGlobalRules} />
      <FriendModal selectedFriend={selectedFriend} friendLogs={friendLogs} logsLoading={logsLoading} closeLogs={closeLogs} />
      <FaceoffModal showSquadModal={showSquadModal} setShowSquadModal={setShowSquadModal} historicalStats={historicalStats} friends={friends} refreshFaceoff={refreshFaceoff} faceoffLoading={faceoffLoading} />

      {/* Tab root: no back button */}
      <PageHeader
        title="Social"
        actions={
          <>
            <button onClick={() => setShowGlobalRules(true)} style={headerActionStyle}>How points work</button>
            <button onClick={() => fetchSocialData(true)} disabled={refreshing} style={{ ...headerActionStyle, padding: 8 }} aria-label="Refresh scores" title="Refresh scores">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
          </>
        }
      >
        <SegmentedTabs
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: "leaderboard", label: "Today" },
            { id: "add", label: requests.length ? `Friends · ${requests.length} new` : "Friends" },
          ]}
        />
      </PageHeader>

      <div style={{ padding: "8px 20px 0", display: "flex", flexDirection: "column", gap: 20 }}>
        {activeTab === "leaderboard" &&
          (loading ? (
            <div style={{ padding: 48, display: "grid", placeItems: "center" }}>
              <Loader2 size={22} className="animate-spin" color="var(--text-muted)" />
            </div>
          ) : (
            <>
              {friends.length > 1 && (
                <section style={{ padding: 18, borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Squad today · {friends.length} people</div>
                  {[
                    ["Protein", avgPct("p", "p"), "var(--protein)"],
                    ["Water", avgPct("water", "water"), "var(--water)"],
                  ].map(([l, pct, c]) => (
                    <div key={l}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                        <span>{l}</span>
                        <span style={{ fontWeight: 600 }}>{pct}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 99, background: "var(--track)", marginTop: 6, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: c, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  ))}
                  {u1 && u2 && (
                    <button onClick={() => { setShowSquadModal(true); refreshFaceoff(); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 14, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 14, textAlign: "left", cursor: "pointer" }}>
                      <Swords size={16} color="var(--accent-text)" />
                      <span style={{ flex: 1 }}>All-time: {u1.isMe ? "You" : u1.name} vs {u2.isMe ? "you" : u2.name}</span>
                      <ChevronRight size={16} color="var(--text-faint)" />
                    </button>
                  )}
                </section>
              )}

              <section>
                <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)" }}>
                  {friends.map((f, i) => {
                    const st = statusFor(f.score);
                    return (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid var(--border)" : "none", background: f.isMe ? "var(--accent-soft)" : "transparent", borderRadius: i === 0 ? "16px 16px 0 0" : i === friends.length - 1 ? "0 0 16px 16px" : 0 }}>
                        <button onClick={() => handleViewLogs(f)} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: 0, border: "none", background: "none", color: "var(--text)", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}>
                          <span style={{ width: 18, fontSize: 14, color: "var(--text-muted)", textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
                          <Avatar name={f.name} size={36} me={f.isMe} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.isMe ? "You" : f.name}</span>
                            <span style={{ display: "block", fontSize: 13, color: st.color, marginTop: 1 }}>{st.label}</span>
                          </span>
                          <span style={{ fontSize: 17, fontWeight: 600 }}>{f.score}</span>
                        </button>
                        {!f.isMe && (
                          <button onClick={() => removeFriend(f.relationshipId)} aria-label={`Remove ${f.name}`} style={{ background: "none", border: "none", padding: 4, color: "var(--text-faint)", cursor: "pointer", display: "grid" }}>
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {friends.length <= 1 && (
                  <div style={{ marginTop: 16, padding: 20, borderRadius: 16, border: "1px dashed var(--border)", textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>It’s more fun with friends</div>
                    <p style={{ margin: "6px 0 14px", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>Invite someone by email — you’ll each be scored against your own goals.</p>
                    <button onClick={() => setActiveTab("add")} style={primaryBtn}>Invite a friend</button>
                  </div>
                )}
              </section>
            </>
          ))}

        {activeTab === "add" && (
          <>
            {requests.length > 0 && (
              <section>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>Waiting for you</div>
                <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)" }}>
                  {requests.map((r, i) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                      <Avatar name={r.name} size={36} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                        <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)" }}>wants to be friends</span>
                      </span>
                      <button onClick={() => acceptRequest(r.id)} aria-label="Accept" style={{ width: 38, height: 38, borderRadius: 10, border: "none", background: "var(--accent)", color: "var(--on-accent)", display: "grid", placeItems: "center", cursor: "pointer" }}>
                        <Check size={17} />
                      </button>
                      <button onClick={() => removeFriend(r.id)} aria-label="Decline" style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", display: "grid", placeItems: "center", cursor: "pointer" }}>
                        <X size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section style={{ padding: 20, borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 17, fontWeight: 600 }}>Invite a friend</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>They need a NutriTrack account with this email.</div>
              <form onSubmit={(e) => { e.preventDefault(); if (searchEmail) sendRequest(); }} style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <input type="email" aria-label="Friend's email" placeholder="friend@example.com" value={searchEmail} onChange={(e) => { setSearchEmail(e.target.value); setAddStatus(""); }} style={{ ...sheetInput, flex: 1 }} />
                <button type="submit" disabled={addStatus === "loading" || !searchEmail} style={{ ...primaryBtn, height: 48, opacity: !searchEmail ? 0.5 : 1 }}>
                  {addStatus === "loading" ? <Loader2 size={16} className="animate-spin" /> : "Send"}
                </button>
              </form>
              {addStatus === "success" && <div role="status" style={{ marginTop: 10, fontSize: 14, color: "var(--accent-text)" }}>Request sent.</div>}
              {addStatus === "error" && <div role="alert" style={{ marginTop: 10, fontSize: 14, color: "var(--danger)" }}>{addError ? `Couldn’t send: ${addError}` : "No account with that email, or you’re already friends."}</div>}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
