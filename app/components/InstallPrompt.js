"use client";

/**
 * InstallPrompt — "Add NutriTrack to your home screen".
 * Only 8 of 64 visitors used the installed app, and push reminders only reach
 * installed users (always so on iPhone). Shown after the first log, never in
 * the installed app, and snoozed for 14 days on "Not now".
 *
 * Chrome/Edge/Android fire `beforeinstallprompt`; we keep it and show the
 * native dialog on "Install". iOS has no such API → short manual steps.
 * All browser state is read through useSyncExternalStore (hydration-safe).
 */

import { useState, useSyncExternalStore } from "react";
import { Smartphone } from "lucide-react";
import { useLocalStorageValue } from "../hooks/useLocalStorageValue";

const SNOOZE_UNTIL = "nt_install_snoozed_until_day"; // YYYY-MM-DD

// ── The deferred native install prompt, captured as early as this module loads
let deferredPrompt = null;
const listeners = new Set();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep it for our own button
    deferredPrompt = e;
    listeners.forEach((fn) => fn());
  });
}
const subscribePrompt = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// ── Installed (standalone) display mode
const standaloneQuery = () => window.matchMedia?.("(display-mode: standalone)");
const subscribeStandalone = (fn) => {
  const mq = standaloneQuery();
  mq?.addEventListener?.("change", fn);
  return () => mq?.removeEventListener?.("change", fn);
};
const readStandalone = () => !!(standaloneQuery()?.matches || window.navigator.standalone === true);

const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function InstallPrompt({ hasLogged, todayKey }) {
  const [snoozedUntil, setSnoozedUntil] = useLocalStorageValue(SNOOZE_UNTIL);
  const standalone = useSyncExternalStore(subscribeStandalone, readStandalone, () => true);
  const canPrompt = useSyncExternalStore(subscribePrompt, () => !!deferredPrompt, () => false);
  const [showSteps, setShowSteps] = useState(false);
  const [installed, setInstalled] = useState(false);

  const snoozed = snoozedUntil === undefined || (snoozedUntil && todayKey && snoozedUntil > todayKey);
  if (standalone || installed || snoozed || !hasLogged) return null;

  const snooze = () => setSnoozedUntil(addDays(todayKey, 14));

  const install = async () => {
    if (deferredPrompt) {
      const evt = deferredPrompt;
      deferredPrompt = null;
      listeners.forEach((fn) => fn());
      evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === "accepted") setInstalled(true);
    } else {
      setShowSteps(true);
    }
  };

  return (
    <section aria-label="Install the app" style={{ margin: "0 20px", display: "flex", gap: 14, padding: 16, borderRadius: 18, border: "1px solid var(--border)" }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent-text)", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Smartphone size={22} strokeWidth={1.8} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Add NutriTrack to your home screen</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.45 }}>
          {showSteps
            ? isIos()
              ? "In Safari, tap the Share button, then “Add to Home Screen”."
              : "Open your browser menu (⋮), then “Install app” or “Add to Home screen”."
            : "Opens like an app, and meal reminders only work from the installed version."}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          {!showSteps && (
            <button onClick={install} style={{ padding: 0, border: "none", background: "none", color: "var(--accent-text)", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              {canPrompt ? "Install" : "Show me how"}
            </button>
          )}
          <button onClick={snooze} style={{ padding: 0, border: "none", background: "none", color: "var(--text-muted)", font: "inherit", fontSize: 14, cursor: "pointer" }}>
            Not now
          </button>
        </div>
      </div>
    </section>
  );
}
