"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TrafficPanel from "../components/admin/TrafficPanel";
import {
  ArrowLeft,
  Users,
  Database,
  Search,
  ChevronLeft,
  Calendar,
  MessageSquare,
  FileText,
  ChefHat,
  Activity,
  LogIn,
  TrendingUp,
  Bell,
  Smartphone,
} from "lucide-react";
import { supabase } from "../supabase";

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = { pro: "#3b82f6", carb: "#10b981", fat: "#f59e0b" };

// Each event type: emoji, accent color, display label
const EVENT_CONFIG = {
  food:    { emoji: "🍽️", color: "#10b981", label: "Food Logged" },
  agent:   { emoji: "🤖", color: "#8b5cf6", label: "AI Agent Chat" },
  medical: { emoji: "🩺", color: "#ef4444", label: "Medical Report" },
  insight: { emoji: "📊", color: "#06b6d4", label: "Weekly AI Report" },
  recipe:  { emoji: "🥘", color: "#f97316", label: "Recipe Saved" },
  reminder: { emoji: "🔔", color: "#6366f1", label: "Reminder Created" },
  device:   { emoji: "📱", color: "#14b8a6", label: "Push Device Added" },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatRelativeTime(ts) {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / 86400000);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Raw data from Supabase
  const [allLogs,     setAllLogs]     = useState([]);
  const [allChats,    setAllChats]    = useState([]);
  const [allMedical,  setAllMedical]  = useState([]);
  const [allInsights, setAllInsights] = useState([]);
  const [allRecipes,  setAllRecipes]  = useState([]);
  const [allReminders, setAllReminders] = useState([]);
  const [allPushSubs,  setAllPushSubs]  = useState([]);

  // Derived
  const [userList,    setUserList]    = useState([]);
  const [globalStats, setGlobalStats] = useState({
    totalUsers: 0, totalLogs: 0, activeToday: 0,
    agentMsgsToday: 0, medicalTotal: 0, recipesTotal: 0,
    remindersTotal: 0, pushUsers: 0,
  });

  // UI
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [activeTab,      setActiveTab]      = useState("overview");

  const safeRpc = async (fn) => {
    const { data, error } = await supabase.rpc(fn);
    if (error) {
      console.warn(`[admin] RPC ${fn} unavailable:`, error.message);
      return [];
    }
    return data || [];
  };

  // ── Data fetch + stats processing ─────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/"); return; }

      // Gate the portal itself. Previously ANY signed-in user could open /admin
      // and read every other user's logs, chats and medical reports — the RPCs
      // were the only thing standing in the way. is_admin() is the same function
      // the traffic RPCs use, so there is one definition of "admin".
      // If it isn't installed yet, fall through rather than locking you out.
      const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
      if (!adminErr && isAdmin !== true) { router.push("/"); return; }

      const [
        logs,
        chats,
        medical,
        insights,
        recipes,
        users,
        reminders,
        pushSubs,
      ] = await Promise.all([
        safeRpc("get_admin_all_logs"),
        safeRpc("get_admin_chat_sessions"),
        safeRpc("get_admin_medical_reports"),
        safeRpc("get_admin_weekly_insights"),
        safeRpc("get_admin_recipes"),
        safeRpc("get_user_emails"),
        safeRpc("get_admin_reminders"),
        safeRpc("get_admin_push_subscriptions"),
      ]);

      const map = {};
      (users || []).forEach((u) => (map[u.id] = u.email));

      const safeChats     = chats     || [];
      const safeMedical   = medical   || [];
      const safeInsights  = insights  || [];
      const safeRecipes   = recipes   || [];
      const safeLogs      = logs      || [];
      const safeUsers     = users     || [];
      const safeReminders = reminders || [];
      const safePushSubs  = pushSubs  || [];

      setAllLogs(safeLogs);
      setAllChats(safeChats);
      setAllMedical(safeMedical);
      setAllInsights(safeInsights);
      setAllRecipes(safeRecipes);
      setAllReminders(safeReminders);
      setAllPushSubs(safePushSubs);

      // ── Build unified user stats map ──────────────────────────────────────
      const today = new Date().toISOString().slice(0, 10);
      const statsMap = {};

      safeUsers.forEach((u) => {
        statsMap[u.id] = {
          userId: u.id, email: u.email || "Unknown",
          lastLogin: u.last_sign_in_at || null, joined: u.created_at || null,
          foodLogs: 0, agentMessages: 0, medicalReports: 0, weeklyInsights: 0, recipes: 0,
          reminders: 0, pushDevices: 0,
          lastActive: u.last_sign_in_at?.slice(0, 10) || null,
        };
      });

      const touch = (userId, date, emailFallback) => {
        if (!statsMap[userId]) {
          statsMap[userId] = {
            userId,
            email: map[userId] || emailFallback || "Unknown",
            lastLogin: null,
            joined: null,
            foodLogs: 0,
            agentMessages: 0,
            medicalReports: 0,
            weeklyInsights: 0,
            recipes: 0,
            reminders: 0,
            pushDevices: 0,
            lastActive: date,
          };
        }
        if (!statsMap[userId].lastActive || date > statsMap[userId].lastActive) {
          statsMap[userId].lastActive = date;
        }
      };

      safeLogs.forEach((l) => { touch(l.user_id, l.date); statsMap[l.user_id].foodLogs++; });
      safeChats.filter((c) => c.role === "user").forEach((c) => {
        const d = c.created_at?.slice(0, 10) || today;
        touch(c.user_id, d);
        statsMap[c.user_id].agentMessages++;
      });
      safeMedical.forEach((m) => { const d = m.created_at?.slice(0, 10) || today; touch(m.user_id, d); statsMap[m.user_id].medicalReports++; });
      safeInsights.forEach((i) => { const d = i.created_at?.slice(0, 10) || today; touch(i.user_id, d); statsMap[i.user_id].weeklyInsights++; });
      safeRecipes.forEach((r) => { const d = r.created_at?.slice(0, 10) || today; touch(r.user_id, d); statsMap[r.user_id].recipes++; });
      safeReminders.forEach((r) => { const d = r.created_at?.slice(0, 10) || today; touch(r.user_id, d); statsMap[r.user_id].reminders++; });
      safePushSubs.forEach((p) => { const d = p.created_at?.slice(0, 10) || today; touch(p.user_id, d); statsMap[p.user_id].pushDevices++; });

      const userArray = Object.values(statsMap)
        .filter((u) => u.lastActive)
        .sort((a, b) => (b.lastActive || "").localeCompare(a.lastActive || ""));

      setUserList(userArray);
      setGlobalStats({
        totalUsers:     userArray.length,
        totalLogs:      safeLogs.length,
        activeToday:    new Set(safeLogs.filter((l) => l.date === today).map((l) => l.user_id)).size,
        agentMsgsToday: safeChats.filter((c) => c.role === "user" && c.created_at?.slice(0, 10) === today).length,
        medicalTotal:   safeMedical.length,
        recipesTotal:   safeRecipes.length,
        remindersTotal: safeReminders.length,
        pushUsers:      new Set(safePushSubs.map((p) => p.user_id)).size,
      });

      setLoading(false);
    };
    init();
  }, [router]);

  // ── Food logs grouped by day (for Food Logs tab) ──────────────────────────
  const getGroupedUserLogs = () => {
    if (!selectedUserId) return [];
    const grouped = allLogs
      .filter((l) => l.user_id === selectedUserId)
      .reduce((acc, log) => {
        if (!acc[log.date]) acc[log.date] = { date: log.date, logs: [], totals: { cals: 0, pro: 0, carb: 0, fat: 0 } };
        acc[log.date].logs.push(log);
        acc[log.date].totals.cals += log.calories || 0;
        acc[log.date].totals.pro  += log.protein  || 0;
        acc[log.date].totals.carb += log.carbs    || 0;
        acc[log.date].totals.fat  += log.fats     || 0;
        return acc;
      }, {});
    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  };

  // ── Build unified activity timeline for selected user ─────────────────────
  const getActivityFeed = () => {
    if (!selectedUserId) return [];
    const events = [];

    // Food logs → group per day
    const logsByDate = {};
    allLogs.filter((l) => l.user_id === selectedUserId).forEach((l) => {
      if (!logsByDate[l.date]) logsByDate[l.date] = { count: 0, cals: 0 };
      logsByDate[l.date].count++;
      logsByDate[l.date].cals += l.calories || 0;
    });
    Object.entries(logsByDate).forEach(([date, d]) => {
      events.push({ type: "food", ts: `${date}T12:00:00Z`, date, summary: `${d.count} entr${d.count === 1 ? "y" : "ies"} · ${d.cals} kcal` });
    });

    // Agent messages → group per day (user turns only)
    const chatsByDate = {};
    allChats
      .filter((c) => c.user_id === selectedUserId && c.role === "user")
      .forEach((c) => {
        const date = c.created_at?.slice(0, 10) || "unknown";
        if (!chatsByDate[date]) chatsByDate[date] = { count: 0, tools: new Set(), lastMsg: "" };
        chatsByDate[date].count++;
        chatsByDate[date].lastMsg = c.content?.slice(0, 70) || "";
        (c.tools_used || []).forEach((t) => chatsByDate[date].tools.add(t));
      });
    Object.entries(chatsByDate).forEach(([date, d]) => {
      const toolList = [...d.tools].join(", ");
      events.push({
        type: "agent", ts: `${date}T13:00:00Z`, date,
        summary: `${d.count} message${d.count > 1 ? "s" : ""} sent`,
        detail: `"${d.lastMsg}${d.lastMsg.length >= 70 ? "…" : ""}"`,
        extra: toolList ? `Tools: ${toolList}` : null,
      });
    });

    // Medical reports
    allMedical.filter((m) => m.user_id === selectedUserId).forEach((m) => {
      const date = m.created_at?.slice(0, 10) || "unknown";
      const abnormal = (m.flags || []).filter((f) => f.status !== "normal").length;
      events.push({
        type: "medical", ts: m.created_at || `${date}T12:00:00Z`, date,
        summary: m.file_name || "Report uploaded",
        detail: abnormal > 0 ? `${abnormal} abnormal marker${abnormal > 1 ? "s" : ""}` : `${(m.flags || []).length} markers — all normal`,
      });
    });

    // Weekly insights
    allInsights.filter((i) => i.user_id === selectedUserId).forEach((i) => {
      const date = i.created_at?.slice(0, 10) || "unknown";
      events.push({
        type: "insight", ts: i.created_at || `${date}T12:00:00Z`, date,
        summary: `Score: ${i.score != null ? `${i.score}/100` : "N/A"}`,
        detail: i.week_start ? `Week of ${i.week_start}` : null,
      });
    });

    // Saved recipes
    allRecipes.filter((r) => r.user_id === selectedUserId).forEach((r) => {
      const date = r.created_at?.slice(0, 10) || "unknown";
      events.push({
        type: "recipe", ts: r.created_at || `${date}T12:00:00Z`, date,
        summary: r.name || "Recipe saved",
        detail: (r.tags || []).length > 0 ? r.tags.join(" · ") : null,
      });
    });

    allReminders.filter((r) => r.user_id === selectedUserId).forEach((r) => {
      const date = r.created_at?.slice(0, 10) || "unknown";
      events.push({
        type: "reminder",
        ts: r.created_at || `${date}T12:00:00Z`,
        date,
        summary: `${r.title} (${r.time_hhmm})`,
        detail: `${(r.days || []).length} day${(r.days || []).length > 1 ? "s" : ""} · ${r.active ? "active" : "paused"}`,
      });
    });

    allPushSubs.filter((p) => p.user_id === selectedUserId).forEach((p) => {
      const date = p.created_at?.slice(0, 10) || "unknown";
      const endpointTail = (p.endpoint || "").slice(-24);
      events.push({
        type: "device",
        ts: p.created_at || `${date}T12:00:00Z`,
        date,
        summary: "Push device registered",
        detail: endpointTail ? `…${endpointTail}` : null,
      });
    });

    // Sort descending and group by date
    events.sort((a, b) => b.ts.localeCompare(a.ts));
    const byDate = {};
    events.forEach((e) => {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    });

    return Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, evts]) => ({ date, events: evts }));
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const filteredUsers  = userList.filter(
    (u) =>
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      u.userId.includes(searchQuery)
  );
  const selectedUser    = userList.find((u) => u.userId === selectedUserId);
  const groupedFoodData = getGroupedUserLogs();
  const activityFeed    = getActivityFeed();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="app-wrapper"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        // The bottom tab bar is hidden on this route, so the 80px it used to
        // reserve would just be dead space. Keep the iOS home-indicator inset.
        paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <style jsx>{`
        .admin-grid {
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: 20px;
          align-items: start;
          height: calc(100vh - 200px);
        }
        .user-list-panel {
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .detail-panel {
          height: 100%;
          overflow-y: auto;
          padding-right: 4px;
        }
        .tab-btn {
          padding: 7px 14px;
          border-radius: 8px;
          border: 1px solid #333;
          background: transparent;
          color: #888;
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 500;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .tab-btn.active {
          background: rgba(99, 102, 241, 0.15);
          border-color: #6366f1;
          color: #818cf8;
        }
        .stat-pill {
          background: #27272a;
          border-radius: 10px;
          padding: 8px 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #333;
        }
        .overview-stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
          gap: 10px;
        }
        .overview-stat {
          background: #18181b;
          border-radius: 10px;
          padding: 14px 10px;
          text-align: center;
          border: 1px solid #27272a;
        }
        .activity-row {
          display: flex;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #27272a;
        }
        .activity-row:last-child { border-bottom: none; }
        .evt-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 16px;
        }
        @media (max-width: 860px) {
          /* Flex column (not block) so the panels can be reordered below. */
          .admin-grid { display: flex; flex-direction: column; height: auto; }

          .user-list-panel {
            display: ${selectedUserId ? "none" : "flex"};
            width: 100%; height: auto; max-height: 80vh;
            order: ${selectedUserId ? 0 : 1};
          }

          /* Always rendered. This panel holds the site-wide traffic dashboard
             when no user is selected — it used to be display:none here, which
             hid traffic entirely on mobile. With nothing selected it is ordered
             ABOVE the user list, so traffic isn't buried under 27 scrollable
             user rows. */
          .detail-panel {
            display: block;
            width: 100%; height: auto;
            order: ${selectedUserId ? 1 : 0};
          }

          /* Desktop-only hint; on mobile the list is right there. */
          .desktop-only-msg { display: none !important; }
        }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, width: "fit-content" }}
        >
          <ArrowLeft size={18} /> Back to App
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>Admin Portal</h1>
            <p style={{ color: "#666", marginTop: 2 }}>Full user activity tracking</p>
          </div>

          {/* Global stats pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { icon: <Users size={13} color="#6366f1" />,       label: "Users",       value: globalStats.totalUsers,     color: "#fff"     },
              { icon: <Activity size={13} color="#22c55e" />,     label: "Active Today",value: globalStats.activeToday,    color: "#22c55e"  },
              { icon: <MessageSquare size={13} color="#8b5cf6" />,label: "Agent Today", value: globalStats.agentMsgsToday, color: "#8b5cf6"  },
              { icon: <FileText size={13} color="#ef4444" />,     label: "Reports",     value: globalStats.medicalTotal,   color: "#ef4444"  },
              { icon: <ChefHat size={13} color="#f97316" />,      label: "Recipes",     value: globalStats.recipesTotal,   color: "#f97316"  },
              { icon: <Bell size={13} color="#6366f1" />,         label: "Reminders",   value: globalStats.remindersTotal, color: "#6366f1"  },
              { icon: <Smartphone size={13} color="#14b8a6" />,   label: "Push Users",  value: globalStats.pushUsers,      color: "#14b8a6"  },
              { icon: <TrendingUp size={13} color="#06b6d4" />,   label: "Food Logs",   value: globalStats.totalLogs,      color: "#06b6d4"  },
            ].map((s) => (
              <div key={s.label} className="stat-pill">
                {s.icon}
                <div>
                  <div style={{ fontSize: "0.6rem", color: "#777", textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: s.color }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-grid">
        {/* ── LEFT: USER LIST ──────────────────────────────────────────────── */}
        <section className="chart-card user-list-panel" style={{ padding: 0 }}>
          <div style={{ padding: 12, borderBottom: "1px solid #333", background: "#27272a" }}>
            <div style={{ display: "flex", alignItems: "center", background: "#18181b", border: "1px solid #333", borderRadius: 8, padding: "8px 12px" }}>
              <Search size={14} color="#666" />
              <input
                placeholder="Search email or ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ background: "transparent", border: "none", color: "white", marginLeft: 8, width: "100%", outline: "none", fontSize: "16px" }}
              />
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", color: "#666" }}>Loading all activity data…</div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#666" }}>No users found.</div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.userId}
                  onClick={() => { setSelectedUserId(user.userId); setActiveTab("overview"); }}
                  style={{
                    padding: "13px 14px",
                    borderBottom: "1px solid #27272a",
                    cursor: "pointer",
                    background: selectedUserId === user.userId ? "rgba(99,102,241,0.1)" : "transparent",
                    borderLeft: selectedUserId === user.userId ? "3px solid #6366f1" : "3px solid transparent",
                  }}
                >
                  <div style={{ fontSize: "0.88rem", color: "#fff", fontWeight: 600, marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.email}
                  </div>

                  {/* Activity badges */}
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 5 }}>
                    {user.foodLogs       > 0 && <span style={{ fontSize: "0.68rem", background: "rgba(16,185,129,0.15)",  color: "#10b981", padding: "2px 6px", borderRadius: 4 }}>🍽️ {user.foodLogs}</span>}
                    {user.agentMessages  > 0 && <span style={{ fontSize: "0.68rem", background: "rgba(139,92,246,0.15)",  color: "#8b5cf6", padding: "2px 6px", borderRadius: 4 }}>🤖 {user.agentMessages}</span>}
                    {user.medicalReports > 0 && <span style={{ fontSize: "0.68rem", background: "rgba(239,68,68,0.15)",   color: "#ef4444", padding: "2px 6px", borderRadius: 4 }}>🩺 {user.medicalReports}</span>}
                    {user.weeklyInsights > 0 && <span style={{ fontSize: "0.68rem", background: "rgba(6,182,212,0.15)",   color: "#06b6d4", padding: "2px 6px", borderRadius: 4 }}>📊 {user.weeklyInsights}</span>}
                    {user.recipes        > 0 && <span style={{ fontSize: "0.68rem", background: "rgba(249,115,22,0.15)",  color: "#f97316", padding: "2px 6px", borderRadius: 4 }}>🥘 {user.recipes}</span>}
                    {user.reminders      > 0 && <span style={{ fontSize: "0.68rem", background: "rgba(99,102,241,0.15)",  color: "#818cf8", padding: "2px 6px", borderRadius: 4 }}>🔔 {user.reminders}</span>}
                    {user.pushDevices    > 0 && <span style={{ fontSize: "0.68rem", background: "rgba(20,184,166,0.15)",  color: "#14b8a6", padding: "2px 6px", borderRadius: 4 }}>📱 {user.pushDevices}</span>}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.7rem", color: "#555" }}>
                      {user.lastLogin ? <>
                        <LogIn size={10} style={{ marginRight: 3, verticalAlign: "middle" }} />
                        {formatRelativeTime(user.lastLogin)}
                      </> : "No login data"}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: user.lastActive === new Date().toISOString().slice(0, 10) ? "#22c55e" : "#555" }}>
                      {user.lastActive || "—"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── RIGHT: DETAIL PANEL ──────────────────────────────────────────── */}
        <div className="detail-panel">
          {selectedUserId && (
            <button
              onClick={() => setSelectedUserId(null)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#6366f1", padding: "10px 0", fontSize: "1rem", cursor: "pointer" }}
              className="mobile-back-btn"
            >
              <ChevronLeft size={20} /> Back to List
            </button>
          )}

          {!selectedUserId && (
            <>
              {/* Site-wide traffic lives here: every other panel on this page is
                  scoped to one signed-in user, so this is the only view that
                  covers anonymous visitors. */}
              <TrafficPanel />
              <div className="chart-card desktop-only-msg" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#666", padding: 18 }}>
                <Users size={20} style={{ opacity: 0.3 }} />
                <p style={{ margin: 0, fontSize: "0.85rem" }}>Select a user to view their full activity.</p>
              </div>
            </>
          )}

          {selectedUserId && selectedUser && (
            <>
              {/* User header + tabs */}
              <div className="chart-card" style={{ padding: 18, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ background: "rgba(99,102,241,0.2)", padding: 10, borderRadius: 50, color: "#6366f1", flexShrink: 0 }}>
                    <Database size={22} />
                  </div>
                  <div style={{ overflow: "hidden", flex: 1 }}>
                    <div style={{ fontSize: "0.68rem", color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Selected User</div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {selectedUser.email}
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.72rem", color: "#666" }}>
                        <span style={{ color: "#888" }}>Last login:</span>{" "}
                        <span style={{ color: "#ccc" }}>{formatRelativeTime(selectedUser.lastLogin)}</span>
                      </span>
                      {selectedUser.joined && (
                        <span style={{ fontSize: "0.72rem", color: "#666" }}>
                          <span style={{ color: "#888" }}>Joined:</span>{" "}
                          <span style={{ color: "#ccc" }}>{formatDate(selectedUser.joined)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["overview", "activity", "food"].map((tab) => (
                    <button key={tab} className={`tab-btn${activeTab === tab ? " active" : ""}`} onClick={() => setActiveTab(tab)}>
                      {tab === "overview" ? "Overview" : tab === "activity" ? "Activity Feed" : "Food Logs"}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── TAB: OVERVIEW ─────────────────────────────────────────── */}
              {activeTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                  {/* Stats grid */}
                  <div className="chart-card" style={{ padding: 18 }}>
                    <div style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Activity Breakdown</div>
                    <div className="overview-stat-grid">
                      {[
                        { label: "Food Logs",   value: selectedUser.foodLogs,       emoji: "🍽️", color: "#10b981" },
                        { label: "Agent Msgs",  value: selectedUser.agentMessages,  emoji: "🤖", color: "#8b5cf6" },
                        { label: "Reports",     value: selectedUser.medicalReports, emoji: "🩺", color: "#ef4444" },
                        { label: "Wkly AI",     value: selectedUser.weeklyInsights, emoji: "📊", color: "#06b6d4" },
                        { label: "Recipes",     value: selectedUser.recipes,        emoji: "🥘", color: "#f97316" },
                        { label: "Reminders",   value: selectedUser.reminders,      emoji: "🔔", color: "#6366f1" },
                        { label: "Push Devices",value: selectedUser.pushDevices,    emoji: "📱", color: "#14b8a6" },
                      ].map((s) => (
                        <div key={s.label} className="overview-stat">
                          <div style={{ fontSize: 22, marginBottom: 6 }}>{s.emoji}</div>
                          <div style={{ fontWeight: 800, fontSize: "1.5rem", color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: "0.66rem", color: "#777", textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent agent messages */}
                  {allChats.filter((c) => c.user_id === selectedUserId && c.role === "user").length > 0 && (
                    <div className="chart-card" style={{ padding: 18 }}>
                      <div style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Recent Agent Messages</div>
                      {allChats
                        .filter((c) => c.user_id === selectedUserId && c.role === "user")
                        .slice(0, 6)
                        .map((c, i, arr) => (
                          <div key={i} style={{ padding: "10px 0", borderBottom: i < arr.length - 1 ? "1px solid #27272a" : "none" }}>
                            <div style={{ fontSize: "0.83rem", color: "#ccc", marginBottom: 3 }}>
                              &ldquo;{c.content?.slice(0, 110)}{(c.content?.length || 0) > 110 ? "…" : ""}&rdquo;
                            </div>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <span style={{ fontSize: "0.68rem", color: "#555" }}>
                                {c.created_at ? new Date(c.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                              </span>
                              {(c.tools_used || []).length > 0 && (
                                <span style={{ fontSize: "0.65rem", color: "#8b5cf6", background: "rgba(139,92,246,0.1)", padding: "1px 6px", borderRadius: 4 }}>
                                  {c.tools_used.join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Medical reports */}
                  {allMedical.filter((m) => m.user_id === selectedUserId).length > 0 && (
                    <div className="chart-card" style={{ padding: 18 }}>
                      <div style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Medical Reports</div>
                      {allMedical.filter((m) => m.user_id === selectedUserId).map((m, i, arr) => {
                        const abnormal = (m.flags || []).filter((f) => f.status !== "normal").length;
                        return (
                          <div key={m.id || i} style={{ padding: "10px 0", borderBottom: i < arr.length - 1 ? "1px solid #27272a" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: "0.88rem", color: "#fff", fontWeight: 600 }}>🩺 {m.file_name}</div>
                              <div style={{ fontSize: "0.72rem", color: "#666", marginTop: 2 }}>
                                {(m.flags || []).length} markers · {formatDate(m.created_at)}
                              </div>
                            </div>
                            {abnormal > 0 && (
                              <span style={{ fontSize: "0.68rem", background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "2px 8px", borderRadius: 4 }}>
                                {abnormal} abnormal
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Saved recipes */}
                  {allRecipes.filter((r) => r.user_id === selectedUserId).length > 0 && (
                    <div className="chart-card" style={{ padding: 18 }}>
                      <div style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Saved Recipes</div>
                      {allRecipes.filter((r) => r.user_id === selectedUserId).map((r, i, arr) => (
                        <div key={r.id || i} style={{ padding: "10px 0", borderBottom: i < arr.length - 1 ? "1px solid #27272a" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: "0.88rem", color: "#fff", fontWeight: 600 }}>🥘 {r.name}</div>
                            {(r.tags || []).length > 0 && (
                              <div style={{ fontSize: "0.7rem", color: "#f97316", marginTop: 2 }}>{r.tags.join(" · ")}</div>
                            )}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "#555" }}>{formatDate(r.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Weekly insights */}
                  {allInsights.filter((i) => i.user_id === selectedUserId).length > 0 && (
                    <div className="chart-card" style={{ padding: 18 }}>
                      <div style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Weekly AI Reports</div>
                      {allInsights.filter((i) => i.user_id === selectedUserId).map((ins, i, arr) => (
                        <div key={ins.id || i} style={{ padding: "10px 0", borderBottom: i < arr.length - 1 ? "1px solid #27272a" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: "0.88rem", color: "#fff", fontWeight: 600 }}>📊 Week of {ins.week_start}</div>
                            <div style={{ fontSize: "0.72rem", color: "#666", marginTop: 2 }}>{formatDate(ins.created_at)}</div>
                          </div>
                          {ins.score != null && (
                            <span style={{ fontWeight: 700, fontSize: "1.1rem", color: ins.score >= 70 ? "#22c55e" : ins.score >= 40 ? "#f59e0b" : "#ef4444" }}>
                              {ins.score}/100
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {allReminders.filter((r) => r.user_id === selectedUserId).length > 0 && (
                    <div className="chart-card" style={{ padding: 18 }}>
                      <div style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Reminder Settings</div>
                      {allReminders.filter((r) => r.user_id === selectedUserId).map((r, i, arr) => (
                        <div key={r.id || i} style={{ padding: "10px 0", borderBottom: i < arr.length - 1 ? "1px solid #27272a" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: "0.88rem", color: "#fff", fontWeight: 600 }}>🔔 {r.title}</div>
                            <div style={{ fontSize: "0.72rem", color: "#666", marginTop: 2 }}>
                              {r.time_hhmm} · {(r.days || []).join(", ")} · {r.type}
                            </div>
                          </div>
                          <span style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: 4, background: r.active ? "rgba(34,197,94,0.15)" : "rgba(161,161,170,0.15)", color: r.active ? "#22c55e" : "#a1a1aa" }}>
                            {r.active ? "active" : "paused"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {allPushSubs.filter((p) => p.user_id === selectedUserId).length > 0 && (
                    <div className="chart-card" style={{ padding: 18 }}>
                      <div style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Registered Push Devices</div>
                      {allPushSubs.filter((p) => p.user_id === selectedUserId).map((p, i, arr) => (
                        <div key={p.id || i} style={{ padding: "10px 0", borderBottom: i < arr.length - 1 ? "1px solid #27272a" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                          <div style={{ fontSize: "0.82rem", color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "78%" }}>
                            📱 …{(p.endpoint || "").slice(-38)}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "#666" }}>{formatDate(p.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: ACTIVITY FEED ────────────────────────────────────── */}
              {activeTab === "activity" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {activityFeed.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#666", padding: 48 }}>No activity recorded yet.</div>
                  ) : (
                    activityFeed.map((dayGroup) => (
                      <div key={dayGroup.date} className="chart-card" style={{ padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #2a2a2a" }}>
                          <Calendar size={13} color="#666" />
                          <span style={{ fontWeight: 600, color: "#bbb", fontSize: "0.88rem" }}>{dayGroup.date}</span>
                          <span style={{ fontSize: "0.72rem", color: "#555" }}>· {dayGroup.events.length} event{dayGroup.events.length > 1 ? "s" : ""}</span>
                        </div>
                        {dayGroup.events.map((evt, i) => {
                          const cfg = EVENT_CONFIG[evt.type];
                          return (
                            <div key={i} className="activity-row">
                              <div className="evt-icon" style={{ background: `${cfg.color}18` }}>
                                {cfg.emoji}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "0.82rem", color: "#e5e5e5", fontWeight: 600 }}>{cfg.label}</div>
                                <div style={{ fontSize: "0.78rem", color: "#aaa", marginTop: 1 }}>{evt.summary}</div>
                                {evt.detail && <div style={{ fontSize: "0.72rem", color: "#666", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{evt.detail}</div>}
                                {evt.extra  && <div style={{ fontSize: "0.68rem", color: "#8b5cf6", marginTop: 2 }}>{evt.extra}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── TAB: FOOD LOGS ────────────────────────────────────────── */}
              {activeTab === "food" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {groupedFoodData.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#666", padding: 24 }}>No food logs for this user.</div>
                  ) : (
                    groupedFoodData.map((dayGroup) => (
                      <div key={dayGroup.date} className="chart-card" style={{ padding: 0, overflow: "hidden", border: "1px solid #333" }}>
                        <div style={{ background: "#202022", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Calendar size={15} color="#aaa" />
                            <span style={{ fontWeight: 600, color: "#fff", fontSize: "0.95rem" }}>{dayGroup.date}</span>
                          </div>
                          <span style={{ fontWeight: 800, color: "#fff", fontSize: "1rem" }}>{dayGroup.totals.cals} kcal</span>
                        </div>

                        <div style={{ height: 4, width: "100%", display: "flex" }}>
                          <div style={{ flex: dayGroup.totals.pro,  background: COLORS.pro  }}></div>
                          <div style={{ flex: dayGroup.totals.carb, background: COLORS.carb }}></div>
                          <div style={{ flex: dayGroup.totals.fat,  background: COLORS.fat  }}></div>
                        </div>

                        <div style={{ padding: "4px 0" }}>
                          {dayGroup.logs.map((log, i) => (
                            <div key={i} style={{ padding: "11px 16px", borderBottom: i === dayGroup.logs.length - 1 ? "none" : "1px solid #27272a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ fontSize: "0.9rem", color: "#e5e5e5" }}>
                                {log.qty}x <span style={{ textTransform: "capitalize" }}>{log.name}</span>
                              </div>
                              <div style={{ fontSize: "0.9rem", color: "#888", minWidth: 60, textAlign: "right" }}>{log.calories}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ background: "#18181b", padding: "8px 16px", display: "flex", gap: 12, justifyContent: "flex-end", fontSize: "0.8rem", borderTop: "1px solid #27272a" }}>
                          <span style={{ color: COLORS.pro  }}>{dayGroup.totals.pro}g P</span>
                          <span style={{ color: COLORS.carb }}>{dayGroup.totals.carb}g C</span>
                          <span style={{ color: COLORS.fat  }}>{dayGroup.totals.fat}g F</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
