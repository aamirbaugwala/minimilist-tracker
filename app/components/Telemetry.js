"use client";

/**
 * Mounted once in the root layout. Records a pageview on every App Router
 * navigation, and links this browser's anonymous history to the user the first
 * time a session appears.
 *
 * Renders nothing and never blocks. Uses the shared Supabase client via
 * useAuth() rather than creating its own — a second GoTrueClient in one tab
 * fights over token refresh.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { trackPageView, identify } from "../lib/telemetry";

export default function Telemetry() {
  const pathname = usePathname();
  const { session } = useAuth();
  const identifiedFor = useRef(null);

  // One pageview per route change. Search params are deliberately excluded from
  // the dependency list: they carry UTM values that would otherwise fire a
  // duplicate view immediately after landing.
  useEffect(() => {
    if (pathname) trackPageView(pathname);
  }, [pathname]);

  // Stitch anonymous → identified once per signed-in user.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || identifiedFor.current === userId) return;
    identifiedFor.current = userId;
    identify(session.access_token);
  }, [session]);

  return null;
}
