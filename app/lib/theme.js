/**
 * Appearance: "system" (default) | "dark" | "light", stored in localStorage.
 * The resolved theme is written to <html data-theme>, which globals.css keys
 * the light tokens off. An inline script in layout.js applies it before first
 * paint (no flash); components/ThemeSync keeps it current afterwards.
 */

export const THEME_KEY = "nt_theme";
export const THEME_BG = { dark: "#0E0F11", light: "#F7F7F5" };

export function resolveTheme(pref) {
  if (pref === "light" || pref === "dark") return pref;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

export function applyTheme(pref) {
  if (typeof document === "undefined") return;
  const theme = resolveTheme(pref);
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_BG[theme]));
}

/** Runs inline in <head> before paint — keep it tiny and dependency-free. */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}");var t=p==="light"||p==="dark"?p:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="dark";}})();`;
