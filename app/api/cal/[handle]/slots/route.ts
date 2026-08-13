import { badRequest, notFound, ok, serverError } from "../../../../../src/server/http";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { loadEventType, loadHostBySlug } from "../../../../../src/server/bookingDesk";
import { listOpenSlots } from "../../../../../src/server/bookingSlots";
import { cleanString } from "../../../../../src/server/validation";

/**
 * Open slots for a booking link.
 *
 *   GET /api/cal/disha/slots?eventType=intro&from=<iso>&to=<iso>
 *
 * Everything comes back as UTC ISO. The browser renders it in the visitor's own
 * zone; the host's zone rides along so the page can show both.
 */
export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params;
    const supabase = getSupabaseAdmin();

    const host = await loadHostBySlug(supabase, cleanString(handle, 64).toLowerCase());
    if (!host) return notFound("no booking desk at that handle");

    const url = new URL(request.url);
    const eventType = await loadEventType(supabase, host.id, cleanString(url.searchParams.get("eventType"), 64) || undefined);
    if (!eventType) return notFound("no bookable call type");

    const fromMs = parseInstant(url.searchParams.get("from"), Date.now());
    const toMs = parseInstant(url.searchParams.get("to"), fromMs + 14 * 86_400_000);
    if (toMs <= fromMs) return badRequest("to must be after from");

    const slots = await listOpenSlots({ supabase, host, eventType, fromMs, toMs });

    return ok({
      host: { slug: host.slug, displayName: host.display_name, timezone: host.timezone },
      eventType: {
        slug: eventType.slug,
        title: eventType.title,
        durationMinutes: eventType.duration_minutes,
        locationNote: eventType.location_note,
      },
      slots,
    });
  } catch (error) {
    return serverError(error);
  }
}

function parseInstant(value: string | null, fallback: number): number {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}
