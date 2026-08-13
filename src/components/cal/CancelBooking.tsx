"use client";

import { useState } from "react";

/**
 * The invitee's side of a booking. Cancelling is a real, irreversible-ish
 * action, so it takes a deliberate second click rather than firing on the
 * first — someone opening this link from an email is usually just checking
 * when the call is.
 */
export default function CancelBooking({
  token,
  when,
  alreadyCancelled,
}: {
  token: string;
  when: string;
  alreadyCancelled: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [cancelled, setCancelled] = useState(alreadyCancelled);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch(`/api/cal/bookings/${encodeURIComponent(token)}/cancel`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "could not cancel that");
      setCancelled(true);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "could not cancel that");
    } finally {
      setBusy(false);
    }
  }

  if (cancelled) {
    return (
      <div className="cal-panel">
        <p className="cal-confirmed-time">Cancelled</p>
        <p className="cal-muted">The slot is free again. Nobody is expecting you at {when}.</p>
      </div>
    );
  }

  return (
    <div className="cal-panel">
      <p className="cal-confirmed-time">{when}</p>
      {confirming ? (
        <>
          <p className="cal-muted">Call it off? The slot goes back on the board.</p>
          <div className="cal-actions">
            <button type="button" className="px-button" onClick={cancel} disabled={busy}>
              {busy ? "cancelling…" : "yes, cancel it"}
            </button>
            <button type="button" className="text-link" onClick={() => setConfirming(false)}>
              keep it
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="text-link" onClick={() => setConfirming(true)}>
          cancel this booking
        </button>
      )}
      {problem ? <p className="cal-problem">{problem}</p> : null}
    </div>
  );
}
