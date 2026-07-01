"use client";
/**
 * app/hooks/useNotifications.js
 *
 * Manages browser push notification permission and subscription lifecycle.
 *
 * Usage:
 *   const { permission, isSubscribed, isSupported, loading, subscribe, unsubscribe, sendTest } = useNotifications();
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

export function useNotifications() {
  const [permission,    setPermission]    = useState("default");
  const [isSubscribed,  setIsSubscribed]  = useState(false);
  const [isSupported,   setIsSupported]   = useState(false);
  const [loading,       setLoading]       = useState(false);

  const isStandaloneMode = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  }, []);

  const isIosDevice = useCallback(() => {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }, []);

  /**
   * Polls for an active service worker registration.
   * On iOS PWA, navigator.serviceWorker.ready can stall after a fresh install
   * because the SW transitions through "installing" → "waiting" → "activated".
   * We poll getRegistration() every 800ms (up to 25s) and race that against
   * navigator.serviceWorker.ready — whichever resolves first wins.
   */
  const getReadyRegistration = useCallback(() => {
    if (!("serviceWorker" in navigator)) {
      return Promise.reject(new Error("Service worker not supported on this browser"));
    }

    return new Promise((resolve, reject) => {
      let done = false;
      const MAX_MS = 25000;
      const POLL_MS = 800;
      const started = Date.now();

      // Path A: navigator.serviceWorker.ready (fast when SW already active)
      navigator.serviceWorker.ready
        .then((reg) => { if (!done) { done = true; resolve(reg); } })
        .catch(() => {}); // polling handles the failure

      // Path B: poll getRegistration so we catch it the moment it activates
      const poll = async () => {
        if (done) return;
        try {
          const reg = await navigator.serviceWorker.getRegistration("/");
          if (reg?.active) {
            done = true;
            resolve(reg);
            return;
          }
          // Nudge any waiting SW to skip the queue (already set in next-pwa config,
          // but belt-and-suspenders for fresh installs on iOS)
          const pending = reg?.waiting || reg?.installing;
          if (pending) pending.postMessage({ type: "SKIP_WAITING" });
        } catch { /* ignore individual poll errors */ }

        if (Date.now() - started >= MAX_MS) {
          done = true;
          reject(new Error(
            "App is still starting up. Close this app fully, reopen from Home Screen, wait 5 seconds, then try again."
          ));
          return;
        }
        setTimeout(poll, POLL_MS);
      };

      poll();
    });
  }, []);

  const checkSubscription = useCallback(async () => {
    try {
      // Use a shorter non-throwing version here so page load isn't delayed
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        navigator.serviceWorker.getRegistration("/").catch(() => null),
        new Promise(res => setTimeout(() => res(null), 3000)),
      ]);
      if (!reg) { setIsSubscribed(false); return; }
      const sub = await reg.pushManager?.getSubscription?.();
      setIsSubscribed(!!sub);
    } catch {
      setIsSubscribed(false);
    }
  }, []);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, [checkSubscription]);

  // ── Enable notifications: request permission → subscribe → save to DB ──────
  const subscribe = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: "Not signed in" };

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return { ok: false, error: "VAPID key not configured (add NEXT_PUBLIC_VAPID_PUBLIC_KEY)" };

    if (!window.isSecureContext) {
      return { ok: false, error: "Notifications require HTTPS secure context" };
    }

    if (isIosDevice() && !isStandaloneMode()) {
      return {
        ok: false,
        error: "On iPhone, install the app to Home Screen and open it from there before enabling notifications.",
      };
    }

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return { ok: false, reason: "denied" };

      let reg;
      try {
        reg = await getReadyRegistration();
      } catch (swErr) {
        return { ok: false, error: swErr.message };
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const subJson = sub?.toJSON?.();
      if (!subJson?.endpoint || !subJson?.keys?.p256dh || !subJson?.keys?.auth) {
        throw new Error("Push subscription did not return valid keys. Reopen app and try again.");
      }

      const res = await fetch("/api/notifications/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          userId:       session.user.id,
          accessToken:  session.access_token,
          subscription: subJson,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save subscription");
      }

      setIsSubscribed(true);
      await checkSubscription();
      return { ok: true };
    } catch (err) {
      setIsSubscribed(false);
      return { ok: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // ── Disable notifications: unsubscribe browser + remove from DB ──────────
  const unsubscribe = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: "Not signed in" };

    setLoading(true);
    try {
      let endpoint = null;

      try {
        const reg = await getReadyRegistration();
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          endpoint = sub.endpoint;
          await sub.unsubscribe();
        }
      } catch {
        // Continue with backend cleanup even if browser subscription lookup fails.
      }

      const res = await fetch("/api/notifications/subscribe", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          userId:      session.user.id,
          accessToken: session.access_token,
          endpoint,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to remove device subscription");
      }

      setIsSubscribed(false);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      // Force state to off immediately; don't call checkSubscription here
      // because the SW may be torn down and re-calling getReadyRegistration hangs.
      setIsSubscribed(false);
      if (typeof Notification !== "undefined") {
        setPermission(Notification.permission);
      }
      setLoading(false);
    }
  };

  // ── Fire a test push to the user's most recent subscription ──────────────
  const sendTest = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: "Not signed in" };

    const res = await fetch("/api/notifications/test", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        userId:      session.user.id,
        accessToken: session.access_token,
      }),
    });
    return res.json();
  };

  return { permission, isSubscribed, isSupported, loading, subscribe, unsubscribe, sendTest };
}
