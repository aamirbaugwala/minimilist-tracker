import "./globals.css";
import { Inter } from "next/font/google";
import BottomNav from "./components/BottomNav";
import Telemetry from "./components/Telemetry";
import SwCleanup from "./components/SwCleanup";
import NavTracker from "./components/NavTracker";
import ThemeSync from "./components/ThemeSync";
import { THEME_BOOT_SCRIPT } from "./lib/theme";

// Direction A typeface. Self-hosted by next/font at build time (no runtime
// request to Google); exposed as --font-inter for globals.css.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "NutriTrack",
  description: "Track calories, macros, and water scientifically.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NutriTrack",
  },
};

// ✅ Move themeColor and viewport settings here
export const viewport = {
  // --bg per theme; ThemeSync overrides when the user picks one explicitly.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7F5" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0F11" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // NOTE: intentionally NOT viewport-fit:cover. Cover makes iOS extend the page
  // under the status bar / home indicator, which breaks 100dvh math (empty gap
  // above the nav at rest, and the input jumping when the keyboard opens). The
  // default lets the browser keep content inside the safe area automatically —
  // simpler and stable. The env(safe-area-inset-*) paddings elsewhere are then
  // harmless no-ops (0).
};

export default function RootLayout({ children }) {
  return (
    // data-theme is set by the boot script before paint, so React's value differs.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <ThemeSync />
        <SwCleanup />
        <NavTracker />
        {children}
        <BottomNav />
        <Telemetry />
      </body>
    </html>
  );
}
