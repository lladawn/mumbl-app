"use client";

import { useEffect } from "react";

export default function Toast({ message, onDone }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return <div className="toast">{message}</div>;
}
