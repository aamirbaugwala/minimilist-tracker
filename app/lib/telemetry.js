/**
 * app/lib/telemetry.js — client-side identity + beacon helpers.
 *
 * Identity is deliberately cookie-free and first-party only. Nothing here is
 * shared with a third party and nothing tracks across sites; the ids exist
 * purely to connect one person's visits to each other.
 *
 *   visitor_id  localStorage    permanent   same person across visits
 *   session_id  sessionStorage  30 min idle one browsing session
 */

const VISITOR_KEY = "nt_visitor_id";
const SESSION_KEY = "nt_session_id";
const SESSION_TS_KEY = "nt_session_ts";
const UTM_KEY = "nt_session_utm";
const SESSION_IDLE_MS = 30 * 60 * 1000;

const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : // Pre-2021 Safari fallback; format only needs to satisfy the server's regex.
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

/** Storage can throw in private mode / when disabled — never let that break a page. */
const safeGet = (store, key) => {
  try {
    return window[store].getItem(key);
  } catch {
    return null;
  }
};
const safeSet = (store, key, value) => {
  try {
    window[store].setItem(key, value);
  } catch {
    /* ignore */
  }
};

export function getVisitorId() {
  let id = safeGet("localStorage", VISITOR_KEY);
  if (!id) {
    id = uuid();
    safeSet("localStorage", VISITOR_KEY, id);
  }
  return id;
}

/** Rolls over after 30 minutes of inactivity. Returns { id, isNew }. */
export function getSession() {
  const now = Date.now();
  const last = Number(safeGet("sessionStorage", SESSION_TS_KEY) || 0);
  let id = safeGet("sessionStorage", SESSION_KEY);
  let isNew = false;

  if (!id || !last || now - last > SESSION_IDLE_MS) {
    id = uuid();
    isNew = true;
    safeSet("sessionStorage", SESSION_KEY, id);
  }
  safeSet("sessionStorage", SESSION_TS_KEY, String(now));
  return { id, isNew };
}

/**
 * Referrer + UTM are captured ONCE per session and replayed on later pageviews.
 * document.referrer is empty after the first client-side navigation, so reading
 * it per-view would attribute every page after the landing page to "direct".
 */
function sessionAttribution(isNewSession) {
  if (!isNewSession) {
    try {
      return JSON.parse(safeGet("sessionStorage", UTM_KEY) || "null") || {};
    } catch {
      return {};
    }
  }

  const params = new URLSearchParams(window.location.search);
  const attribution = {
    referrer: document.referrer || null,
    utm: {
      source: params.get("utm_source"),
      medium: params.get("utm_medium"),
      campaign: params.get("utm_campaign"),
    },
  };
  safeSet("sessionStorage", UTM_KEY, JSON.stringify(attribution));
  return attribution;
}

/** Installed PWA vs ordinary browser tab — worth separating in the numbers. */
function displayMode() {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return "standalone";
    if (window.navigator.standalone) return "standalone"; // iOS Safari
  } catch {
    /* ignore */
  }
  return "browser";
}

const INTERNAL_KEY = "nt_internal";

/** Once an admin has been identified, stop sending beacons from this browser. */
const isInternal = () => safeGet("localStorage", INTERNAL_KEY) === "1";

/** Record a pageview. Fire-and-forget: never awaited, never throws. */
export function trackPageView(path) {
  if (typeof window === "undefined") return;
  // Admin browsing isn't traffic. Skipping here avoids writing rows that would
  // only be filtered out at query time anyway.
  if (isInternal()) return;
  try {
    const { id: sessionId, isNew } = getSession();
    const { referrer, utm } = sessionAttribution(isNew);

    const payload = JSON.stringify({
      visitorId: getVisitorId(),
      sessionId,
      path,
      referrer,
      utm,
      displayMode: displayMode(),
    });

    // sendBeacon survives the page being closed mid-request, which plain fetch
    // does not — important for exit pageviews.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* telemetry must never break the app */
  }
}

/**
 * Link this browser's anonymous history to a signed-in user. Runs once per user.
 * The response says whether that user is an admin; if so we remember it and stop
 * tracking this browser entirely.
 */
export function identify(accessToken) {
  if (typeof window === "undefined" || !accessToken) return;
  try {
    fetch("/api/track/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: getVisitorId(), accessToken }),
      keepalive: true,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.internal) safeSet("localStorage", INTERNAL_KEY, "1");
      })
      .catch(() => {});
  } catch {
    /* ignore */
  }
}
