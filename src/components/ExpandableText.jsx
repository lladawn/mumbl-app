"use client";

import { useState } from "react";

const DEFAULT_LIMIT = 620;

export default function ExpandableText({ text, className = "", limit = DEFAULT_LIMIT }) {
  const [expanded, setExpanded] = useState(false);
  const content = String(text || "");
  const needsClamp = content.length > limit;
  const visibleText = !needsClamp || expanded ? content : `${content.slice(0, limit).trimEnd()}...`;

  return (
    <div className={`expandable-read ${expanded ? "expanded" : ""} ${className}`}>
      <p>{visibleText}</p>
      {needsClamp && (
        <button className="read-more-button" type="button" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "show less" : "show more"}
        </button>
      )}
    </div>
  );
}
