"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPublicPageView } from "../lib/analytics";

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackPublicPageView(pathname);
  }, [pathname]);

  return null;
}
