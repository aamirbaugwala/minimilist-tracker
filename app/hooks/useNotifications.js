"use client";
/**
 * app/hooks/useNotifications.js
 *
 * Manages browser push notification permission and subscription lifecycle.
 *
 * Usage:
 *   const { permission, isSubscribed, isSupported, loading, subscribe, unsubscribe, sendTest } = useNotifications();
 */

import { useState, useEffect } from "react";
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
  }, []);

  const checkSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      // Service worker not available (dev mode / SSR)
    }
  };

  // ── Enable notifications: request permission → subscribe → save to DB ──────
  const subscribe = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: "Not signed in" };

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return { ok: false, error: "VAPID key not configured (add NEXT_PUBLIC_VAPID_PUBLIC_KEY)" };

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return { ok: false, reason: "denied" };

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const res = await fetch("/api/notifications/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          userId:       session.user.id,
          accessToken:  session.access_token,
          subscription: sub.toJSON(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save subscription");
      }

      setIsSubscribed(true);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // ── Disable notifications: unsubscribe browser + remove from DB ──────────
  const unsubscribe = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/notifications/subscribe", {
          method:  "DELETE",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            userId:      session.user.id,
            accessToken: session.access_token,
            endpoint,
          }),
        });
      }
      setIsSubscribed(false);
    } finally {
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
