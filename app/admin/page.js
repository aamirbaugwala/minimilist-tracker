"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Database,
  Search,
  ChevronLeft,
  LayoutDashboard,
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

      // 1. Fetch Logs
      const { data: logs, error: logError } = await supabase
        .from("food_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (logError) {
        alert("Error: " + logError.message);
        setLoading(false);
        return;
      }

      // 2. Fetch Emails (Secure RPC)
      const { data: users } = await supabase.rpc("get_user_emails");

      const map = {};
      if (users) users.forEach((u) => (map[u.id] = u.email));
      setEmailMap(map);

      setAllLogs(logs);
      processGlobalStats(logs, map);
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
          totalCals: 0,
        };
      }
      uniqueUsers[log.user_id].logCount += 1;
      uniqueUsers[log.user_id].totalCals += log.calories || 0;

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

  const getSelectedUserLogs = () => {
    if (!selectedUserId) return [];
    return allLogs.filter((l) => l.user_id === selectedUserId);
  };

  const filteredUsers = userList.filter(
    (u) =>
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      u.userId.includes(searchQuery)
  );

  const selectedEmail = emailMap[selectedUserId] || selectedUserId;

  return (
    <div
      className="app-wrapper"
      style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: 80 }}
    >
      <style jsx>{`
        /* RESPONSIVE LAYOUT LOGIC */
        .admin-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 24px;
          align-items: start;
        }

        .user-list-panel {
          display: flex;
          flex-direction: column;
        }
        .detail-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* MOBILE OVERRIDES */
        @media (max-width: 768px) {
          .admin-grid {
            display: flex;
            flex-direction: column;
          }
          /* Hide list if user is selected (show details instead) */
          .user-list-panel {
            display: ${selectedUserId ? "none" : "flex"};
            width: 100%;
          }
          /* Hide details if no user selected */
          .detail-panel {
            display: ${selectedUserId ? "flex" : "none"};
            width: 100%;
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

          {/* Quick Stats Badge */}
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
        <section
          className="chart-card user-list-panel"
          style={{ padding: 0, overflow: "hidden", maxHeight: "80vh" }}
        >
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

          <div style={{ overflowY: "auto", flex: 1, minHeight: 300 }}>
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

        {/* --- RIGHT COLUMN: DETAILS --- */}
        <div className="detail-panel">
          {/* Mobile "Back" Button (Only visible when a user is selected on mobile) */}
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
                padding: 0,
                fontSize: "1rem",
                cursor: "pointer",
                marginBottom: -10,
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
              <p>Select a user to view details.</p>
            </div>
          )}

          {selectedUserId && (
            <>
              {/* User Summary Card */}
              <div className="chart-card" style={{ padding: 20 }}>
                <h2
                  style={{
                    fontSize: "1.1rem",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    wordBreak: "break-all",
                  }}
                >
                  <Database size={16} color="#6366f1" />
                  <span style={{ color: "#fff" }}>{selectedEmail}</span>
                </h2>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      background: "#27272a",
                      padding: 12,
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#aaa",
                        textTransform: "uppercase",
                      }}
                    >
                      Lifetime Cals
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>
                      {getSelectedUserLogs()
                        .reduce((a, b) => a + (b.calories || 0), 0)
                        .toLocaleString()}
                    </div>
                  </div>
                  <div
                    style={{
                      background: "#27272a",
                      padding: 12,
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#aaa",
                        textTransform: "uppercase",
                      }}
                    >
                      Avg Protein
                    </div>
                    <div
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 800,
                        color: "#3b82f6",
                      }}
                    >
                      {Math.round(
                        getSelectedUserLogs().reduce(
                          (a, b) => a + (b.protein || 0),
                          0
                        ) / getSelectedUserLogs().length || 0
                      )}
                      g
                    </div>
                  </div>
                </div>
              </div>

              {/* Log History */}
              <div
                className="chart-card"
                style={{ padding: 0, overflow: "hidden", flex: 1 }}
              >
                <div
                  style={{
                    padding: 16,
                    borderBottom: "1px solid #333",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                  }}
                >
                  Log History
                </div>
                <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                  {getSelectedUserLogs().map((log, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "14px 16px",
                        borderBottom: "1px solid #27272a",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.95rem", color: "#fff" }}>
                          {log.qty}x {log.name}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#666" }}>
                          {log.date}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                          {log.calories}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#aaa" }}>
                          <span style={{ color: COLORS.pro }}>
                            P:{log.protein}
                          </span>{" "}
                          <span style={{ color: COLORS.carb }}>
                            C:{log.carbs}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
