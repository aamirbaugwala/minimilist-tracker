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

  const getReadyRegistration = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service worker not supported on this browser");
    }

    const timeoutMs = 8000;
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Service worker not ready. Reopen the app and try again.")), timeoutMs);
    });

    return Promise.race([navigator.serviceWorker.ready, timeout]);
  }, []);

  const checkSubscription = useCallback(async () => {
    try {
      const reg = await getReadyRegistration();
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      // Service worker not available (dev mode / SSR)
    }
  }, [getReadyRegistration]);

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

      const reg = await getReadyRegistration();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

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
      await checkSubscription();
      setPermission(typeof Notification !== "undefined" ? Notification.permission : permission);
      setIsSubscribed(false);
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
