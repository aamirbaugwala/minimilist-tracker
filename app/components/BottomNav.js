"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Lucide icons inlined as SVG to avoid a heavy import in the layout
const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const DashIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);
const SparkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.88 5.76a1 1 0 0 0 .95.69H21l-4.94 3.57a1 1 0 0 0-.36 1.12L17.56 21 12 17.27 6.44 21l1.86-6.86a1 1 0 0 0-.36-1.12L3 9.45h6.17a1 1 0 0 0 .95-.69Z" />
  </svg>
);
const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const ChefIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" /><line x1="6" y1="17" x2="18" y2="17" />
  </svg>
);
const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
  </svg>
);
const LogOutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showMore, setShowMore] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Listen for auth state — show nav only when logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Close the drawer whenever the route changes
  useEffect(() => {
    const timer = setTimeout(() => setShowMore(false), 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Hide when not authenticated
  if (!hasSession) return null;

  const moreRoutes = ["/recipes", "/medical"];
  const isMoreActive = moreRoutes.includes(pathname);

  const tabs = [
    { label: "Home",      icon: <HomeIcon />,  color: "#f59e0b", href: "/"          },
    { label: "Dashboard", icon: <DashIcon />,  color: "#6366f1", href: "/dashboard" },
    { label: "AI Coach",  icon: <SparkIcon />, color: "#8b5cf6", href: "/agent"     },
    { label: "Social",    icon: <UsersIcon />, color: "#3b82f6", href: "/social"    },
    { label: "More",      icon: <span style={{ fontSize: 22, lineHeight: 1 }}>⋯</span>, color: "#71717a", href: null },
  ];

  const moreItems = [
    { label: "Recipe Studio",   icon: <ChefIcon />,   color: "#f59e0b", href: "/recipes" },
    { label: "Medical Reports", icon: <ShieldIcon />, color: "#10b981", href: "/medical" },
  ];

  return (
    <>
      {/* ── BOTTOM TAB BAR ──────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 600, zIndex: 100,
        background: "rgba(9,9,11,0.92)", backdropFilter: "blur(16px)",
        borderTop: "1px solid #27272a",
        display: "flex", alignItems: "stretch",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        {tabs.map(({ label, icon, color, href }) => {
          const isMore = label === "More";
          const isActive = !isMore && href && pathname === href;
          const moreHighlight = isMore && (showMore || isMoreActive);
          const activeColor = isMore ? "#e879f9" : color; // purple for More

          return (
            <button
              key={label}
              onClick={() => {
                if (isMore) { setShowMore((v) => !v); return; }
                setShowMore(false);
                router.push(href);
              }}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 3, padding: "10px 4px",
                background: "transparent", border: "none", cursor: "pointer",
                color: (isActive || moreHighlight) ? activeColor : "#71717a",
                transition: "color 0.15s",
              }}
            >
              <span style={{ color: (isActive || moreHighlight) ? activeColor : "#71717a" }}>
                {icon}
              </span>
              <span style={{
                fontSize: "0.62rem", fontWeight: (isActive || moreHighlight) ? 700 : 500,
                letterSpacing: 0.2,
                color: (isActive || moreHighlight) ? activeColor : "#71717a",
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── MORE DRAWER ─────────────────────────────────────────────── */}
      {showMore && (
        <>
          {/* backdrop */}
          <div
            onClick={() => setShowMore(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 98,
              background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
            }}
          />
          <div style={{
            position: "fixed", bottom: 62, left: "50%", transform: "translateX(-50%)",
            width: "calc(100% - 32px)", maxWidth: 568, zIndex: 99,
            background: "#18181b", borderRadius: 20,
            border: "1px solid #27272a",
            padding: 12, display: "flex", flexDirection: "column", gap: 2,
          }}>
            <div style={{
              fontSize: "0.68rem", color: "#52525b", fontWeight: 700,
              letterSpacing: 1, textTransform: "uppercase",
              marginBottom: 4, paddingLeft: 4,
            }}>
              More
            </div>

            {moreItems.map(({ label, icon, color, href }) => (
              <Link key={label} href={href} onClick={() => setShowMore(false)}>
                <button style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "13px 14px", borderRadius: 12,
                  background: pathname === href ? "#27272a" : "transparent",
                  border: "none", cursor: "pointer",
                  color: pathname === href ? "#fff" : "#e4e4e7",
                  fontSize: "0.9rem", fontWeight: 600, textAlign: "left",
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#27272a"}
                  onMouseLeave={(e) => e.currentTarget.style.background = pathname === href ? "#27272a" : "transparent"}
                >
                  <span style={{ color }}>{icon}</span>
                  {label}
                </button>
              </Link>
            ))}

            <div style={{ height: 1, background: "#27272a", margin: "4px 0" }} />

            <button
              onClick={async () => {
                setShowMore(false);
                await supabase.auth.signOut();
                router.push("/");
              }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "13px 14px", borderRadius: 12,
                background: "transparent", border: "none", cursor: "pointer",
                color: "#ef4444", fontSize: "0.9rem", fontWeight: 600, textAlign: "left",
              }}
            >
              <LogOutIcon />
              Log Out
            </button>
          </div>
        </>
      )}
    </>
  );
}
