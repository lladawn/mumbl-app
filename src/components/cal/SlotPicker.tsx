"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { idleAside, receptionistLine, type ReceptionistState } from "../../lib/cal/receptionist";

export type Slot = { start: string; end: string };

export type SlotPickerHost = {
  slug: string;
  displayName: string;
  officeName: string;
  receptionistName: string;
  timezone: string;
};

export type SlotPickerEventType = {
  slug: string;
  title: string;
  durationMinutes: number;
  locationNote: string;
};

type Step = "day" | "time" | "details" | "confirmed";

const WINDOW_DAYS = 21;

export default function SlotPicker({
  host,
  eventType,
  initialSlots,
  initialWindowEndIso,
  seed,
  onLine,
}: {
  host: SlotPickerHost;
  eventType: SlotPickerEventType;
  initialSlots: Slot[];
  initialWindowEndIso: string;
  seed: number;
  onLine?: (line: string) => void;
}) {
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [windowEndIso, setWindowEndIso] = useState(initialWindowEndIso);
  const [step, setStep] = useState<Step>("day");
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);
  const [result, setResult] = useState<{ cancelUrl: string; emailed: boolean; emailProblem?: string } | null>(null);

  // the visitor's own zone, so every time on screen is their wall clock
  const visitorZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || host.timezone,
    [host.timezone],
  );

  const days = useMemo(() => groupByDay(slots, visitorZone), [slots, visitorZone]);
  const daySlots = dayKey ? days.find((day) => day.key === dayKey)?.slots || [] : [];

  const state: ReceptionistState = taken
    ? "taken"
    : problem
      ? "error"
      : step === "confirmed"
        ? "confirmed"
        : busy
          ? "submitting"
          : step === "details"
            ? "details"
            : step === "time"
              ? "chooseTime"
              : days.length
                ? "chooseDay"
                : "empty";

  const line = receptionistLine(state, seed, {
    hostName: host.displayName,
    officeName: host.officeName,
    duration: eventType.durationMinutes,
    day: dayKey ? formatDayLabel(dayKey) : undefined,
    time: slot ? formatTime(slot.start, visitorZone) : undefined,
  });

  useEffect(() => {
    onLine?.(line);
  }, [line, onLine]);

  const loadMore = useCallback(async () => {
    setBusy(true);
    setProblem(null);
    try {
      const from = windowEndIso;
      const to = new Date(Date.parse(windowEndIso) + WINDOW_DAYS * 86_400_000).toISOString();
      const response = await fetch(
        `/api/cal/${host.slug}/slots?eventType=${encodeURIComponent(eventType.slug)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "could not load times");

      setSlots((current) => mergeSlots(current, data.slots || []));
      setWindowEndIso(to);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "could not load times");
    } finally {
      setBusy(false);
    }
  }, [eventType.slug, host.slug, windowEndIso]);

  const refreshSlots = useCallback(async () => {
    const response = await fetch(
      `/api/cal/${host.slug}/slots?eventType=${encodeURIComponent(eventType.slug)}&to=${encodeURIComponent(windowEndIso)}`,
      { cache: "no-store" },
    );
    const data = await response.json().catch(() => ({}));
    if (response.ok) setSlots(data.slots || []);
  }, [eventType.slug, host.slug, windowEndIso]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!slot || busy) return;

    setBusy(true);
    setProblem(null);
    setTaken(false);

    try {
      const response = await fetch(`/api/cal/${host.slug}/book`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventType: eventType.slug,
          start: slot.start,
          name,
          email,
          note,
          timezone: visitorZone,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 409) {
        // somebody else got there first — send them back to a truthful list
        setTaken(true);
        setSlot(null);
        setStep("time");
        await refreshSlots();
        return;
      }
      if (!response.ok) throw new Error(data?.error || "that did not go through");

      setResult({ cancelUrl: data.cancelUrl, emailed: data.emailed, emailProblem: data.emailProblem });
      setStep("confirmed");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "that did not go through");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cal-desk">
      <div className="cal-speech">
        <span className="cal-speech-who">{host.receptionistName}</span>
        <p className="cal-speech-line">{line}</p>
      </div>

      {step === "confirmed" && result ? (
        <div className="cal-panel">
          <p className="cal-confirmed-time">
            {slot ? formatFull(slot.start, visitorZone) : ""}
          </p>
          <p className="cal-muted">
            {eventType.title} · {eventType.durationMinutes} min · {eventType.locationNote}
          </p>
          <p className="cal-muted">
            {result.emailed
              ? `Invite sent to ${email}.`
              : `Booked — but the confirmation email did not go out${result.emailProblem ? ` (${result.emailProblem})` : ""}. Your slot is held; save the link below.`}
          </p>
          <a className="px-button cal-cancel-link" href={result.cancelUrl}>
            Manage or cancel this booking
          </a>
        </div>
      ) : null}

      {step === "day" ? (
        <div className="cal-panel">
          <p className="cal-meta">
            {eventType.title} · {eventType.durationMinutes} min · times in {visitorZone.replace(/_/g, " ")}
          </p>
          {days.length ? (
            <ul className="cal-options">
              {days.map((day) => (
                <li key={day.key}>
                  <button
                    type="button"
                    className="cal-option"
                    onClick={() => {
                      setDayKey(day.key);
                      setTaken(false);
                      setStep("time");
                    }}
                  >
                    <span>{formatDayLabel(day.key)}</span>
                    <span className="cal-option-hint">
                      {day.slots.length} {day.slots.length === 1 ? "time" : "times"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cal-muted">Nothing open in the next few weeks.</p>
          )}
          <button type="button" className="text-link" onClick={loadMore} disabled={busy}>
            {busy ? "looking…" : "look further out"}
          </button>
        </div>
      ) : null}

      {step === "time" ? (
        <div className="cal-panel">
          <button type="button" className="text-link cal-back" onClick={() => setStep("day")}>
            ← other days
          </button>
          <ul className="cal-options cal-options-grid">
            {daySlots.map((option) => (
              <li key={option.start}>
                <button
                  type="button"
                  className="cal-option"
                  onClick={() => {
                    setSlot(option);
                    setTaken(false);
                    setStep("details");
                  }}
                >
                  {formatTime(option.start, visitorZone)}
                </button>
              </li>
            ))}
          </ul>
          {daySlots.length === 0 ? <p className="cal-muted">That day filled up. Try another.</p> : null}
        </div>
      ) : null}

      {step === "details" && slot ? (
        <form className="cal-panel" onSubmit={submit}>
          <button type="button" className="text-link cal-back" onClick={() => setStep("time")}>
            ← other times
          </button>
          <p className="cal-meta">{formatFull(slot.start, visitorZone)}</p>

          <label className="cal-field">
            <span>Your name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
          </label>
          <label className="cal-field">
            <span>Email for the invite</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={160}
              required
            />
          </label>
          <label className="cal-field">
            <span>What's it about? (optional)</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} />
          </label>

          <button type="submit" className="px-button" disabled={busy}>
            {busy ? "booking…" : "book it"}
          </button>
        </form>
      ) : null}

      {problem ? <p className="cal-problem">{problem}</p> : null}

      {step !== "confirmed" ? (
        <p className="cal-aside">{idleAside(seed, days.length, { hostName: host.displayName })}</p>
      ) : null}
    </div>
  );
}

function groupByDay(slots: Slot[], timeZone: string) {
  const byDay = new Map<string, Slot[]>();

  for (const slot of slots) {
    const key = dayKeyOf(slot.start, timeZone);
    const existing = byDay.get(key);
    if (existing) existing.push(slot);
    else byDay.set(key, [slot]);
  }

  return [...byDay.entries()]
    .map(([key, daySlots]) => ({ key, slots: daySlots.sort((a, b) => a.start.localeCompare(b.start)) }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function mergeSlots(current: Slot[], incoming: Slot[]): Slot[] {
  const byStart = new Map(current.map((slot) => [slot.start, slot]));
  for (const slot of incoming) byStart.set(slot.start, slot);
  return [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
}

function dayKeyOf(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return parts;
}

function formatDayLabel(dayKey: string): string {
  // dayKey is already the visitor's local calendar day, so it is formatted as a
  // plain label in UTC — anchored at midday so no offset can slip it a day
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function formatFull(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(new Date(iso));
}
