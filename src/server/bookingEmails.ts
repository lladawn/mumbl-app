/**
 * What lands in two inboxes when a call is booked or called off.
 *
 * Both sides get the same facts in their own timezone — the single most common
 * booking-tool failure is telling someone a time without saying whose clock it
 * is on. Voice is a person confirming a call, not a SaaS notification.
 */

import { buildIcs } from "./ics";
import { sendEmail, type SendEmailResult } from "./email";

export type BookingParticipants = {
  host: {
    display_name: string;
    office_name: string;
    receptionist_name: string;
    timezone: string;
    notify_email: string;
  };
  invitee: { name: string; email: string; note?: string; timezone?: string };
};

export type BookingDetails = BookingParticipants & {
  bookingId: string;
  title: string;
  locationNote: string;
  startMs: number;
  endMs: number;
  cancelUrl: string;
};

export function formatInstant(ms: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
}

export async function sendBookingConfirmation(details: BookingDetails): Promise<{
  invitee: SendEmailResult;
  host: SendEmailResult;
}> {
  const inviteeZone = details.invitee.timezone || details.host.timezone;
  const ics = buildIcs({
    uid: `booking-${details.bookingId}@mumbl.wtf`,
    startMs: details.startMs,
    endMs: details.endMs,
    summary: `${details.title} — ${details.invitee.name} & ${details.host.display_name}`,
    description: `${details.locationNote}\n\nNeed to call it off: ${details.cancelUrl}`,
    location: details.locationNote,
    organizer: { name: details.host.display_name, email: details.host.notify_email },
    attendee: { name: details.invitee.name, email: details.invitee.email },
  });

  const attachments = [{ filename: "invite.ics", content: ics }];

  const [invitee, host] = await Promise.all([
    sendEmail({
      to: details.invitee.email,
      replyTo: details.host.notify_email,
      subject: `Booked: ${details.title} with ${details.host.display_name}`,
      text: [
        `Hi ${details.invitee.name},`,
        ``,
        `You're on the books at ${details.host.office_name}.`,
        ``,
        `  ${details.title}`,
        `  ${formatInstant(details.startMs, inviteeZone)}  (your time)`,
        `  ${formatInstant(details.startMs, details.host.timezone)}  (${details.host.display_name}'s time)`,
        `  ${details.locationNote}`,
        ``,
        `The invite is attached. If something changes, you can cancel here:`,
        `${details.cancelUrl}`,
        ``,
        `— ${details.host.receptionist_name}, front desk at ${details.host.office_name}`,
      ].join("\n"),
      attachments,
    }),
    sendEmail({
      to: details.host.notify_email,
      replyTo: details.invitee.email,
      subject: `New booking: ${details.invitee.name} — ${formatInstant(details.startMs, details.host.timezone)}`,
      text: [
        `${details.invitee.name} booked ${details.title}.`,
        ``,
        `  ${formatInstant(details.startMs, details.host.timezone)}  (your time)`,
        `  ${formatInstant(details.startMs, inviteeZone)}  (theirs — ${inviteeZone})`,
        `  ${details.invitee.email}`,
        ...(details.invitee.note ? [``, `  "${details.invitee.note}"`] : []),
        ``,
        `Cancel link: ${details.cancelUrl}`,
      ].join("\n"),
      attachments,
    }),
  ]);

  return { invitee, host };
}

export async function sendBookingCancellation(
  details: BookingDetails & { cancelledBy: "invitee" | "host" },
): Promise<{ invitee: SendEmailResult; host: SendEmailResult }> {
  const inviteeZone = details.invitee.timezone || details.host.timezone;
  const ics = buildIcs({
    uid: `booking-${details.bookingId}@mumbl.wtf`,
    startMs: details.startMs,
    endMs: details.endMs,
    summary: `${details.title} — ${details.invitee.name} & ${details.host.display_name}`,
    description: `Cancelled.`,
    location: details.locationNote,
    organizer: { name: details.host.display_name, email: details.host.notify_email },
    attendee: { name: details.invitee.name, email: details.invitee.email },
    sequence: 1,
    cancelled: true,
  });

  const attachments = [
    { filename: "invite.ics", content: ics, contentType: "text/calendar; method=CANCEL" },
  ];

  const [invitee, host] = await Promise.all([
    sendEmail({
      to: details.invitee.email,
      subject: `Cancelled: ${details.title} with ${details.host.display_name}`,
      text: [
        `Hi ${details.invitee.name},`,
        ``,
        `That call is off the books:`,
        `  ${formatInstant(details.startMs, inviteeZone)}`,
        ``,
        `The slot is free again if you want another time.`,
        ``,
        `— ${details.host.receptionist_name}, front desk at ${details.host.office_name}`,
      ].join("\n"),
      attachments,
    }),
    sendEmail({
      to: details.host.notify_email,
      subject: `Cancelled: ${details.invitee.name} — ${formatInstant(details.startMs, details.host.timezone)}`,
      text: [
        `${details.invitee.name} (${details.invitee.email}) cancelled ${details.title}.`,
        ``,
        `  ${formatInstant(details.startMs, details.host.timezone)}`,
        ``,
        `The slot is open again.`,
      ].join("\n"),
      attachments,
    }),
  ]);

  return { invitee, host };
}
