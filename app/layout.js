import "./globals.css";
import BottomNav from "./components/BottomNav";

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
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
