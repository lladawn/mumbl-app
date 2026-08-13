/**
 * Minimal VCALENDAR builder — enough for "this lands in Apple Calendar and
 * Google Calendar as a real event you can cancel", not a general iCalendar
 * library. No dependency for ~60 lines of string building.
 */

export type IcsEvent = {
  uid: string;
  startMs: number;
  endMs: number;
  summary: string;
  description: string;
  location: string;
  organizer: { name: string; email: string };
  attendee: { name: string; email: string };
  /** bump on every re-send of the same UID so clients accept the update */
  sequence?: number;
  cancelled?: boolean;
};

export function buildIcs(event: IcsEvent): string {
  const method = event.cancelled ? "CANCEL" : "REQUEST";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//mumbl//booking desk//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsTime(Date.now())}`,
    `DTSTART:${icsTime(event.startMs)}`,
    `DTEND:${icsTime(event.endMs)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(event.location)}`,
    `ORGANIZER;CN=${escapeText(event.organizer.name)}:mailto:${event.organizer.email}`,
    `ATTENDEE;CN=${escapeText(event.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${event.attendee.email}`,
    `SEQUENCE:${event.sequence ?? 0}`,
    `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // RFC 5545 wants CRLF and lines folded at 75 octets
  return lines.flatMap(foldLine).join("\r\n") + "\r\n";
}

function icsTime(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value: string): string {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldLine(line: string): string[] {
  if (line.length <= 75) return [line];

  const out = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    out.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest.length) out.push(` ${rest}`);

  return out;
}
