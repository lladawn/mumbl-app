/**
 * Transactional email transport.
 *
 * Raw fetch against Resend, mirroring how insights.js talks to Anthropic — a
 * new service, but no new npm dependency, which keeps the "use the existing
 * stack" rule intact.
 *
 * Nothing here throws into a caller's happy path: a booking that is confirmed
 * in the database is confirmed even if the notification bounces. Losing the
 * slot because an email failed would be strictly worse than a missing email.
 */

import { getServerEnv } from "./env";

export type EmailAttachment = {
  filename: string;
  /** raw utf8 content; encoded for the API here */
  content: string;
  contentType?: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
};

export type SendEmailResult = { sent: boolean; reason?: string };

export function isEmailConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.resendApiKey && env.bookingFromEmail);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const env = getServerEnv();
  if (!isEmailConfigured()) {
    return { sent: false, reason: "email is not configured (RESEND_API_KEY / MUMBL_BOOKING_FROM)" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.resendApiKey}`,
      },
      body: JSON.stringify({
        from: env.bookingFromEmail,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        reply_to: input.replyTo,
        attachments: (input.attachments || []).map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.from(attachment.content, "utf8").toString("base64"),
          content_type: attachment.contentType || "text/calendar; method=REQUEST",
        })),
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return { sent: false, reason: payload?.message || `resend returned ${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "email request failed" };
  }
}

export function isLikelyEmail(value: string): boolean {
  // deliberately loose: the delivery attempt is the real validator, this only
  // catches obvious typos before a slot is held
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}
