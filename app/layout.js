import "./globals.css";
import BottomNav from "./components/BottomNav";
import Telemetry from "./components/Telemetry";
import SwCleanup from "./components/SwCleanup";

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
  themeColor: "#000000",
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
    <html lang="en">
      <body>
        <SwCleanup />
        {children}
        <BottomNav />
        <Telemetry />
      </body>
    </html>
  );
}
