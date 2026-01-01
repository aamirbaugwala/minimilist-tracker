"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Database,
  Search,
  ChevronLeft,
  Calendar,
} from "lucide-react";
import { supabase } from "../supabase";

// --- COLORS ---
const COLORS = {
  pro: "#3b82f6",
  carb: "#10b981",
  fat: "#f59e0b",
};

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allLogs, setAllLogs] = useState([]);

  // Stats State
  const [userList, setUserList] = useState([]);
  const [globalStats, setGlobalStats] = useState({
    totalUsers: 0,
    totalLogs: 0,
    activeToday: 0,
  });
  const [emailMap, setEmailMap] = useState({});

  // Selection State
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const init = async () => {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }

      // 1. Fetch ALL Logs (Secure RPC)
      const { data: logs, error: logError } = await supabase.rpc(
        "get_admin_all_logs"
      );

      if (logError) {
        // Fallback for dev/testing if RPC isn't set up yet
        console.error("RPC Error:", logError);
        setLoading(false);
        return;
      }

      // 2. Fetch Emails
      const { data: users } = await supabase.rpc("get_user_emails");

      const map = {};
      if (users) users.forEach((u) => (map[u.id] = u.email));
      setEmailMap(map);

      setAllLogs(logs || []);
      processGlobalStats(logs || [], map);
      setLoading(false);
    };

    init();
  }, []);

  const processGlobalStats = (logs, map) => {
    const uniqueUsers = {};
    const today = new Date().toISOString().slice(0, 10);

    logs.forEach((log) => {
      if (!uniqueUsers[log.user_id]) {
        uniqueUsers[log.user_id] = {
          userId: log.user_id,
          email: map[log.user_id] || "Unknown",
          logCount: 0,
          lastActive: log.date,
        };
      }
      uniqueUsers[log.user_id].logCount += 1;

      if (log.date > uniqueUsers[log.user_id].lastActive) {
        uniqueUsers[log.user_id].lastActive = log.date;
      }
    });

    const userArray = Object.values(uniqueUsers).sort((a, b) =>
      b.lastActive.localeCompare(a.lastActive)
    );

    setUserList(userArray);
    setGlobalStats({
      totalUsers: userArray.length,
      totalLogs: logs.length,
      activeToday: new Set(
        logs.filter((l) => l.date === today).map((l) => l.user_id)
      ).size,
    });
  };

  const getGroupedUserLogs = () => {
    if (!selectedUserId) return [];

    const userLogs = allLogs.filter((l) => l.user_id === selectedUserId);

    const grouped = userLogs.reduce((acc, log) => {
      if (!acc[log.date]) {
        acc[log.date] = {
          date: log.date,
          logs: [],
          totals: { cals: 0, pro: 0, carb: 0, fat: 0 },
        };
      }
      acc[log.date].logs.push(log);
      acc[log.date].totals.cals += log.calories || 0;
      acc[log.date].totals.pro += log.protein || 0;
      acc[log.date].totals.carb += log.carbs || 0;
      acc[log.date].totals.fat += log.fats || 0;
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  };

  const filteredUsers = userList.filter(
    (u) =>
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      u.userId.includes(searchQuery)
  );

  const selectedEmail = emailMap[selectedUserId] || selectedUserId;
  const groupedData = getGroupedUserLogs();

  return (
    <div
      className="app-wrapper"
      style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 80 }}
    >
      <style jsx>{`
        /* --- DESKTOP LAYOUT --- */
        .admin-grid {
          display: grid;
          grid-template-columns: 350px 1fr; /* Fixed width sidebar, fluid details */
          gap: 24px;
          align-items: start;
          height: calc(100vh - 140px); /* Fill screen minus header */
        }

        .user-list-panel {
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden; /* Contains the scrollbar */
        }

        .detail-panel {
          height: 100%;
          overflow-y: auto; /* Independent scrolling for details */
          padding-right: 4px;
        }

        /* --- MOBILE LAYOUT --- */
        @media (max-width: 860px) {
          .admin-grid {
            display: block; /* Remove grid to stack items naturally */
            height: auto;
          }

          /* Logic: If user selected, Hide List. If no user, Hide Details. */
          .user-list-panel {
            display: ${selectedUserId ? "none" : "flex"};
            width: 100%;
            height: auto;
            max-height: 80vh;
          }

          .detail-panel {
            display: ${selectedUserId ? "block" : "none"};
            width: 100%;
            height: auto;
          }
        }
      `}</style>

      {/* HEADER */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            background: "none",
            border: "none",
            color: "#aaa",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            width: "fit-content",
          }}
        >
          <ArrowLeft size={18} /> Back to App
        </button>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>Admin Portal</h1>
            <p style={{ color: "#666" }}>
              {globalStats.totalUsers} users • {globalStats.totalLogs} logs
            </p>
          </div>
          <div
            style={{
              background: "#27272a",
              padding: "8px 16px",
              borderRadius: 12,
              display: "flex",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#aaa",
                  textTransform: "uppercase",
                }}
              >
                Active
              </div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  color: "#22c55e",
                }}
              >
                {globalStats.activeToday}
              </div>
            </div>
            <div style={{ width: 1, height: 24, background: "#444" }}></div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#aaa",
                  textTransform: "uppercase",
                }}
              >
                Users
              </div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                {globalStats.totalUsers}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-grid">
        {/* --- LEFT COLUMN: USER LIST --- */}
        <section className="chart-card user-list-panel" style={{ padding: 0 }}>
          {/* Search Bar */}
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid #333",
              background: "#27272a",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#18181b",
                border: "1px solid #333",
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              <Search size={14} color="#666" />
              <input
                placeholder="Search email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  marginLeft: 8,
                  width: "100%",
                  outline: "none",
                  fontSize: "16px",
                }}
              />
            </div>
          </div>

          {/* Scrollable List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: "center", color: "#666" }}>
                Loading data...
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.userId}
                  onClick={() => setSelectedUserId(user.userId)}
                  style={{
                    padding: "16px",
                    borderBottom: "1px solid #27272a",
                    cursor: "pointer",
                    background:
                      selectedUserId === user.userId
                        ? "rgba(99, 102, 241, 0.1)"
                        : "transparent",
                    borderLeft:
                      selectedUserId === user.userId
                        ? "3px solid #6366f1"
                        : "3px solid transparent",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.95rem",
                      color: "#fff",
                      fontWeight: 600,
                      marginBottom: 4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {user.email}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", color: "#666" }}>
                      Entries: <b style={{ color: "#ccc" }}>{user.logCount}</b>
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color:
                          user.lastActive ===
                          new Date().toISOString().slice(0, 10)
                            ? "#22c55e"
                            : "#666",
                      }}
                    >
                      {user.lastActive}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* --- RIGHT COLUMN: DETAILED VIEW --- */}
        <div className="detail-panel">
          {/* Mobile Back Button */}
          {selectedUserId && (
            <button
              onClick={() => setSelectedUserId(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: "none",
                color: "#6366f1",
                padding: "10px 0",
                fontSize: "1rem",
                cursor: "pointer",
              }}
              className="mobile-back-btn"
            >
              <ChevronLeft size={20} /> Back to List
            </button>
          )}

          {!selectedUserId && (
            <div
              className="chart-card desktop-only-msg"
              style={{
                height: 300,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 16,
                color: "#666",
              }}
            >
              <Users size={48} style={{ opacity: 0.2 }} />
              <p>Select a user to view detailed history.</p>
            </div>
          )}

          {selectedUserId && (
            <>
              {/* User Info Card */}
              <div
                className="chart-card"
                style={{ padding: 20, marginBottom: 20 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      background: "rgba(99, 102, 241, 0.2)",
                      padding: 10,
                      borderRadius: 50,
                      color: "#6366f1",
                    }}
                  >
                    <Database size={24} />
                  </div>
                  <div style={{ overflow: "hidden" }}>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#aaa",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      Selected User
                    </div>
                    <div
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        color: "#fff",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {selectedEmail}
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily Breakdown */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {groupedData.length === 0 ? (
                  <div
                    style={{ textAlign: "center", color: "#666", padding: 20 }}
                  >
                    No logs found for this user.
                  </div>
                ) : (
                  groupedData.map((dayGroup) => (
                    <div
                      key={dayGroup.date}
                      className="chart-card"
                      style={{
                        padding: 0,
                        overflow: "hidden",
                        border: "1px solid #333",
                      }}
                    >
                      {/* Summary Header */}
                      <div
                        style={{
                          background: "#202022",
                          padding: "12px 16px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderBottom: "1px solid #333",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Calendar size={16} color="#aaa" />
                          <span
                            style={{
                              fontWeight: 600,
                              color: "#fff",
                              fontSize: "0.95rem",
                            }}
                          >
                            {dayGroup.date}
                          </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span
                            style={{
                              fontWeight: 800,
                              color: "#fff",
                              fontSize: "1rem",
                            }}
                          >
                            {dayGroup.totals.cals} kcal
                          </span>
                        </div>
                      </div>

                      {/* Macro Bar (Visual) */}
                      <div
                        style={{ height: 4, width: "100%", display: "flex" }}
                      >
                        <div
                          style={{
                            flex: dayGroup.totals.pro,
                            background: COLORS.pro,
                          }}
                        ></div>
                        <div
                          style={{
                            flex: dayGroup.totals.carb,
                            background: COLORS.carb,
                          }}
                        ></div>
                        <div
                          style={{
                            flex: dayGroup.totals.fat,
                            background: COLORS.fat,
                          }}
                        ></div>
                      </div>

                      {/* Food Items */}
                      <div style={{ padding: "4px 0" }}>
                        {dayGroup.logs.map((log, i) => (
                          <div
                            key={i}
                            style={{
                              padding: "12px 16px",
                              borderBottom:
                                i === dayGroup.logs.length - 1
                                  ? "none"
                                  : "1px solid #27272a",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{ fontSize: "0.9rem", color: "#e5e5e5" }}
                            >
                              {log.qty}x{" "}
                              <span style={{ textTransform: "capitalize" }}>
                                {log.name}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: "0.9rem",
                                color: "#888",
                                textAlign: "right",
                                minWidth: 60,
                              }}
                            >
                              {log.calories}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Footer Totals */}
                      <div
                        style={{
                          background: "#18181b",
                          padding: "8px 16px",
                          display: "flex",
                          gap: 12,
                          justifyContent: "flex-end",
                          fontSize: "0.8rem",
                          color: "#aaa",
                          borderTop: "1px solid #27272a",
                        }}
                      >
                        <span style={{ color: COLORS.pro }}>
                          {dayGroup.totals.pro}g P
                        </span>
                        <span style={{ color: COLORS.carb }}>
                          {dayGroup.totals.carb}g C
                        </span>
                        <span style={{ color: COLORS.fat }}>
                          {dayGroup.totals.fat}g F
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
