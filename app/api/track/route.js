/**
 * POST /api/track — first-party page-view ingest.
 *
 * Schema lives in docs/telemetry.sql (run it once in the Supabase SQL editor).
 *
 * Why client-side beacons rather than middleware: next-pwa caches page HTML with
 * skipWaiting, so repeat visits and installed-PWA launches never reach the
 * server. Server-side logging would silently undercount exactly the engaged
 * users we most care about.
 *
 * Privacy: IP is read only to derive country and never stored. The referrer is
 * reduced to its host — full referrer URLs can carry query strings we don't want
 * in our database.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Simple crawlers never run JS, so the beacon already filters most of them.
// This catches the ones that do execute scripts.
const BOT_RE =
  /bot|crawler|spider|crawling|headless|phantom|puppeteer|playwright|lighthouse|pagespeed|gtmetrix|preview|scrap|curl|wget|python-requests|axios|monitor|uptime/i;

const clamp = (v, max) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

function deviceFrom(ua = "") {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod|windows phone/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Order matters — these user-agent strings are nested by design:
 * Edge contains "Chrome", Chrome contains "Safari", Opera contains both.
 * Testing generic names first would misattribute nearly everything.
 *
 * Note: Brave deliberately does NOT identify itself and reports as Chrome, so
 * Brave users land in the Chrome bucket. That's a limitation of any UA-based
 * detection, GA included.
 */
function browserFrom(ua = "") {
  if (/edg[ea]?\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/samsungbrowser/i.test(ua)) return "Samsung Internet";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}

function osFrom(ua = "") {
  if (/windows/i.test(ua)) return "Windows";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod|ios/i.test(ua)) return "iOS";
  if (/mac os|macintosh/i.test(ua)) return "macOS";
  if (/cros/i.test(ua)) return "ChromeOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

/** Vercel percent-encodes city names ("New%20Delhi"). */
function decodeHeader(value) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // malformed encoding — keep the raw value rather than dropping it
  }
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req) {
  // Telemetry must never break or slow a page. Every failure path below returns
  // 204 so a client beacon can't retry-storm us over our own bug.
  try {
    const body = await req.json().catch(() => null);
    if (!body) return new NextResponse(null, { status: 204 });

    const { visitorId, sessionId, path, referrer, utm, displayMode } = body;

    // Reject anything that isn't a well-formed id — these are the only two
    // client-supplied values that reach an indexed column.
    if (!UUID_RE.test(visitorId || "") || !UUID_RE.test(sessionId || "")) {
      return new NextResponse(null, { status: 204 });
    }
    if (typeof path !== "string" || !path.startsWith("/")) {
      return new NextResponse(null, { status: 204 });
    }

    const db = serviceClient();
    if (!db) {
      console.warn("[track] SUPABASE_SERVICE_ROLE_KEY not set — skipping");
      return new NextResponse(null, { status: 204 });
    }

    const ua = req.headers.get("user-agent") || "";

    // Referrer -> bare host. Ignore our own domain: internal navigation isn't a
    // referral, and counting it would drown out real acquisition sources.
    let referrerHost = null;
    if (referrer) {
      try {
        const host = new URL(referrer).hostname.replace(/^www\./, "");
        const self = (req.headers.get("host") || "").replace(/^www\./, "");
        if (host && host !== self) referrerHost = host.slice(0, 120);
      } catch {
        /* malformed referrer — drop it */
      }
    }

    await db.from("page_views").insert({
      visitor_id: visitorId,
      session_id: sessionId,
      path: path.slice(0, 300),
      referrer_host: referrerHost,
      utm_source: clamp(utm?.source, 120),
      utm_medium: clamp(utm?.medium, 120),
      utm_campaign: clamp(utm?.campaign, 120),
      device: deviceFrom(ua),
      browser: browserFrom(ua),
      os: osFrom(ua),
      display_mode: displayMode === "standalone" ? "standalone" : "browser",
      // Vercel injects these at the edge; all null when running locally.
      country: clamp(req.headers.get("x-vercel-ip-country"), 8),
      city: clamp(decodeHeader(req.headers.get("x-vercel-ip-city")), 120),
      region: clamp(req.headers.get("x-vercel-ip-country-region"), 60),
      // Flagged rather than dropped, so excluded traffic stays auditable.
      is_bot: BOT_RE.test(ua),
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[track] failed:", err?.message);
    return new NextResponse(null, { status: 204 });
  }
}
