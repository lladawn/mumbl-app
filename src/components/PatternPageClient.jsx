"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchPatterns, sendPatternFeedback, testGeneratePatternInsight } from "../lib/api";
import Toast from "./Toast";

export default function PatternPageClient() {
  const [patterns, setPatterns] = useState([]);
  const [status, setStatus] = useState("loading");
  const [toast, setToast] = useState("");
  const [mutatingId, setMutatingId] = useState("");
  const [testToolsEnabled, setTestToolsEnabled] = useState(false);
  const [isTestingInsight, setIsTestingInsight] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadPatterns() {
      try {
        const result = await fetchPatterns();
        if (!mounted) return;
        setPatterns(result.patterns || []);
        setTestToolsEnabled(result.testToolsEnabled === true);
        setStatus("ready");
      } catch (error) {
        if (!mounted) return;
        setStatus("error");
        setToast(error.message || "couldn't load private patterns yet.");
      }
    }
    loadPatterns();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleFeedback(pattern, confirmed) {
    setMutatingId(pattern.id);
    try {
      await sendPatternFeedback({ patternId: pattern.id, confirmed });
      setPatterns((current) =>
        confirmed
          ? current.map((item) => (item.id === pattern.id ? { ...item, user_confirmed: true, user_dismissed: null } : item))
          : current.filter((item) => item.id !== pattern.id),
      );
      setToast(confirmed ? "pattern saved as something true." : "pattern dismissed.");
    } catch (error) {
      setToast(error.message || "couldn't update that pattern.");
    } finally {
      setMutatingId("");
    }
  }

  async function handleTestGenerate() {
    if (isTestingInsight) return;
    setIsTestingInsight(true);
    try {
      const result = await testGeneratePatternInsight();
      const refreshed = await fetchPatterns();
      setPatterns(refreshed.patterns || []);
      setTestToolsEnabled(refreshed.testToolsEnabled === true);
      setStatus("ready");
      setToast(result.pattern ? "test insight generated." : result.message || "no insight generated yet.");
    } catch (error) {
      setToast(error.message || "couldn't generate a test insight.");
    } finally {
      setIsTestingInsight(false);
    }
  }

  return (
    <main className="pattern-page">
      <section className="pattern-hero">
        <div>
          <p className="eyebrow">private patterns</p>
          <h1>what your dump keeps circling</h1>
          <p>Only you can see these. They come from your logged-in private dumps and never get posted to a room.</p>
        </div>
        <div className="pattern-hero-actions">
          {testToolsEnabled && (
            <button className="ghost-button" type="button" onClick={handleTestGenerate} disabled={isTestingInsight}>
              {isTestingInsight ? "generating..." : "test insight"}
            </button>
          )}
          <Link className="ghost-button button-link" href="/dump/map">
            working map
          </Link>
          <Link className="solid-button button-link" href="/dump">
            open dump
          </Link>
        </div>
      </section>

      <section className="pattern-list-page">
        {status === "loading" && <div className="empty-state">loading private patterns...</div>}
        {status === "error" && <div className="empty-state">patterns are not available yet.</div>}
        {status === "ready" && !patterns.length && (
          <div className="empty-state">no private pattern yet. keep dumping; the first read appears after enough logged-in signal.</div>
        )}
        {patterns.map((pattern) => {
          const isMutating = mutatingId === pattern.id;
          return (
            <article className={`pattern-review-card ${pattern.user_confirmed ? "confirmed" : ""}`} key={pattern.id}>
              <div>
                <span>{formatDateRange(pattern.period_start, pattern.period_end)}</span>
                <h2>{pattern.summary}</h2>
                <p>{pattern.question}</p>
              </div>
              <div className="pattern-review-actions">
                <button className="solid-button" type="button" onClick={() => handleFeedback(pattern, true)} disabled={isMutating}>
                  feels true
                </button>
                <button className="ghost-button" type="button" onClick={() => handleFeedback(pattern, false)} disabled={isMutating}>
                  not this
                </button>
              </div>
            </article>
          );
        })}
      </section>
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </main>
  );
}

function formatDateRange(start, end) {
  if (!start && !end) return "private insight";
  const formatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
  if (!start || !end || start === end) return formatter.format(new Date(end || start));
  return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
}
