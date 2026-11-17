"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordPath } from "../lib/navHistory";

/** Mounted once in the root layout; feeds every route change to navHistory. */
export default function NavTracker() {
  const pathname = usePathname();
  useEffect(() => {
    recordPath(pathname);
  }, [pathname]);
  return null;
}
