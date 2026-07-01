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

  const SW_SCOPE = "/";
  const SW_SCRIPT = "/sw.js";

  const listServiceWorkerRegistrations = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      return [];
    }

    return navigator.serviceWorker.getRegistrations().catch(() => []);
  }, []);

  const findServiceWorkerRegistration = useCallback(async () => {
    const regs = await listServiceWorkerRegistrations();
    if (!regs.length) return null;

    const rootScope = new URL(SW_SCOPE, window.location.origin).href;
    return (
      regs.find((reg) => reg.scope === rootScope) ||
      regs.find((reg) => reg.active || reg.waiting || reg.installing) ||
      regs[0] ||
      null
    );
  }, [listServiceWorkerRegistrations]);

  /**
   * Ensure a service worker registration exists and becomes active.
   * This is the safer path for iPhone PWA installs where ready() can lag.
   */
  const ensureServiceWorkerRegistration = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service worker not supported on this browser");
    }

    let reg = await findServiceWorkerRegistration();

    if (!reg) {
      reg = await navigator.serviceWorker.register(SW_SCRIPT, { scope: SW_SCOPE });
    }

    try {
      await reg.update();
    } catch {
      // Non-fatal: we can still wait on the current registration.
    }

    if (reg.active) return reg;

    return new Promise((resolve, reject) => {
      let done = false;
      const MAX_MS = 45000;
      const POLL_MS = 700;
      const started = Date.now();

      const finishIfActive = () => {
        if (done) return;
        if (reg.active) {
          done = true;
          resolve(reg);
          return;
        }
        if (Date.now() - started >= MAX_MS) {
          done = true;
          reject(new Error(
            "The app is still finishing setup. Close it completely, reopen from the Home Screen, wait a few seconds, then try again."
          ));
          return;
        }
        setTimeout(async () => {
          try {
            await reg.update();
          } catch {
            // ignore update errors and keep polling
          }
          finishIfActive();
        }, POLL_MS);
      };

      const watch = (worker) => {
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "activated") {
            finishIfActive();
          }
        });
      };

      watch(reg.installing);
      watch(reg.waiting);
      finishIfActive();
    });
  }, [findServiceWorkerRegistration]);

  const checkSubscription = useCallback(async () => {
    try {
      const reg = await findServiceWorkerRegistration();
      if (!reg) { setIsSubscribed(false); return; }
      const sub = await reg.pushManager?.getSubscription?.();
      setIsSubscribed(!!sub);
    } catch {
      setIsSubscribed(false);
    }
  }, [findServiceWorkerRegistration]);

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

      try {
        const reg = await ensureServiceWorkerRegistration();

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }

        const subJson = sub?.toJSON?.();
        if (!subJson?.endpoint || !subJson?.keys?.p256dh || !subJson?.keys?.auth) {
          throw new Error("Push subscription did not return valid keys. Reopen app and try again.");
        }

        const res = await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: session.user.id,
            accessToken: session.access_token,
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
      } catch (swErr) {
        return { ok: false, error: swErr.message };
      }
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
        const reg = await findServiceWorkerRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
          endpoint = sub.endpoint;
          try {
            await sub.unsubscribe();
          } catch {
            // Even if browser unsubscribe fails, still clean the DB record.
          }
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
