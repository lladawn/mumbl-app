"use client";

import { useEffect, useState } from "react";
import { getRecentSlug } from "../lib/storage";

export function useRecentSlug(fallback = "") {
  const [recentSlug, setRecentSlug] = useState(fallback);

  useEffect(() => {
    setRecentSlug(getRecentSlug(fallback));
  }, [fallback]);

  return recentSlug;
}
