"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";

/**
 * Bottom tab bar: Today · Insights · Coach · Social · Me.
 *
 * Every screen in the app belongs to exactly one tab (see `routes`), so the
 * right tab stays lit on nested screens. The most specific match wins:
 * /medical/trends is analysis (Insights) while /medical is your vault (Me).
 * The old "More" drawer is gone — Recipes live under Coach, and Medical,
 * Reminders and Log out live under Me.
 */

// Lucide icons inlined as SVG to avoid a heavy import in the layout
const svg = (children) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const TodayIcon = () => svg(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>);
const InsightsIcon = () => svg(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>);
const CoachIcon = () => svg(<path d="M12 3l1.88 5.76a1 1 0 0 0 .95.69H21l-4.94 3.57a1 1 0 0 0-.36 1.12L17.56 21 12 17.27 6.44 21l1.86-6.86a1 1 0 0 0-.36-1.12L3 9.45h6.17a1 1 0 0 0 .95-.69Z" />);
const SocialIcon = () => svg(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>);
const MeIcon = () => svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>);

const TABS = [
  { label: "Today",    icon: <TodayIcon />, href: "/",          routes: ["/"] },
  { label: "Insights", icon: <InsightsIcon />, href: "/dashboard", routes: ["/dashboard", "/medical/trends"] },
  { label: "Coach",    icon: <CoachIcon />, href: "/agent",     routes: ["/agent", "/recipes"] },
  { label: "Social",   icon: <SocialIcon />, href: "/social",    routes: ["/social"] },
  { label: "Me",       icon: <MeIcon />,    href: "/me",        routes: ["/me", "/medical", "/notifications"] },
];

// Screens that own the full viewport: /voice is fullscreen, /admin is a
// desktop-style portal with its own navigation.
const FULLSCREEN_ROUTES = ["/voice", "/admin"];

function matchLength(pathname, route) {
  if (pathname === route) return route.length;
  if (route !== "/" && pathname.startsWith(route + "/")) return route.length;
  return -1;
}

/** The tab whose most specific route matches the current path. */
function activeTabFor(pathname) {
  let best = null;
  let bestLen = -1;
  for (const tab of TABS) {
    for (const r of tab.routes) {
      const len = matchLength(pathname, r);
      if (len > bestLen) {
        best = tab;
        bestLen = len;
      }
    }
  }
  return best;
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  // Shared app-wide auth (a second Supabase client here would fight over the
  // stored session). Show the nav only when logged in.
  const { session } = useAuth();

  if (!session || FULLSCREEN_ROUTES.includes(pathname)) return null;

  const active = activeTabFor(pathname);

  return (
    <nav
      aria-label="Main"
      className="app-nav"
      style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 600, zIndex: 100,
        background: "var(--bg)",
        borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "stretch",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Desktop sidebar only (hidden on phones via CSS) */}
      <div className="app-nav-brand" aria-hidden="true">
        <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--accent)", color: "var(--on-accent)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 15 }}>N</span>
        NutriTrack
      </div>
      {TABS.map((tab) => {
        const isActive = active === tab;
        // Direction A: one accent for the active tab, quiet neutrals otherwise.
        const color = isActive ? "var(--accent-text)" : "var(--text-faint)";
        return (
          <button
            key={tab.label}
            className="app-nav-tab"
            aria-current={isActive ? "page" : undefined}
            onClick={() => {
              // Re-tapping the active tab from a nested screen returns to the
              // tab's root (e.g. Recipes → Coach), like native tab bars.
              if (pathname !== tab.href) router.push(tab.href);
            }}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 4, padding: "10px 4px 12px",
              background: "transparent", border: "none", cursor: "pointer",
              color, transition: "color 0.15s",
            }}
          >
            {tab.icon}
            <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 500 }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
