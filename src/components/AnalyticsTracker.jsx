"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPublicPageView, trackPublicScrollMilestones } from "../lib/analytics";

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackPublicPageView(pathname);
    return trackPublicScrollMilestones(pathname);
  }, [pathname]);

  return null;
}
