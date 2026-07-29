"use client";

import { useEffect } from "react";

/**
 * In development the PWA is disabled (next.config.js), but a service worker
 * registered by an earlier production build can linger in the browser and keep
 * serving STALE JavaScript — which shows up as "sometimes the old buggy code
 * runs, sometimes the new" (and the workbox bad-precaching-response 404s).
 * Unregister any leftover SW and drop its caches so dev always runs fresh code.
 * No-op in production, where the service worker is intentional.
 */
export default function SwCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }, []);
  return null;
}
