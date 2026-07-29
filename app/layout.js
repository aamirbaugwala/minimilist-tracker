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
  // Draw under the notch/home-indicator so env(safe-area-inset-*) is non-zero
  // in standalone PWA mode — the bottom nav and Undo toast rely on it.
  viewportFit: "cover",
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
