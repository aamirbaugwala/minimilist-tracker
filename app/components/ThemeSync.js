"use client";

/** Keeps <html data-theme> in step with the Appearance setting and, on
 *  "System", with the phone's light/dark switch. Renders nothing. */

import { useEffect } from "react";
import { useLocalStorageValue } from "../hooks/useLocalStorageValue";
import { THEME_KEY, applyTheme } from "../lib/theme";

export default function ThemeSync() {
  const [pref] = useLocalStorageValue(THEME_KEY);
  useEffect(() => {
    if (pref === undefined) return; // not read yet (server / first render)
    applyTheme(pref);
    if (pref === "light" || pref === "dark") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme("system");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [pref]);
  return null;
}
