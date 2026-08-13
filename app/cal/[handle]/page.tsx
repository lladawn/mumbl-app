import { notFound } from "next/navigation";
import OfficeScene from "../../../src/components/cal/OfficeScene";
import { getSupabaseAdmin } from "../../../src/server/supabase";
import { loadEventType, loadHostBySlug } from "../../../src/server/bookingDesk";
import { listOpenSlots } from "../../../src/server/bookingSlots";
import { cleanString } from "../../../src/server/validation";
import { newSeed } from "../../../src/lib/cal/receptionist";

// availability changes as people book; a cached booking page is a lying one
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 21;

type PageParams = { params: Promise<{ handle: string }>; searchParams: Promise<Record<string, string>> };

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const desk = await loadDesk(handle).catch(() => null);
  if (!desk) return { title: "Booking desk — mumbl" };

  const title = `Book a call with ${desk.host.display_name} · ${desk.host.office_name}`;
  return {
    title,
    description: `${desk.eventType.title} — ${desk.eventType.duration_minutes} minutes. Walk into the office and pick a time.`,
    openGraph: { title, type: "website" },
  };
}

export default async function BookingDeskPage({ params, searchParams }: PageParams) {
  const { handle } = await params;
  const query = await searchParams;

  const desk = await loadDesk(handle);
  if (!desk) notFound();

  const { host, eventType, supabase } = desk;
  const fromMs = Date.now();
  const toMs = fromMs + WINDOW_DAYS * 86_400_000;

  // rendered on the server so the plain list is usable before any JavaScript
  // arrives — the fallback is the product, not a degraded mode
  const slots = await listOpenSlots({ supabase, host, eventType, fromMs, toMs });

  return (
    <main className="cal-page pixel-screen">
      <header className="cal-header">
        <p className="cal-office">{host.office_name}</p>
        <h1>Book {host.display_name}</h1>
      </header>

      <OfficeScene
        host={{
          slug: host.slug,
          displayName: host.display_name,
          officeName: host.office_name,
          receptionistName: host.receptionist_name,
          timezone: host.timezone,
        }}
        eventType={{
          slug: eventType.slug,
          title: eventType.title,
          durationMinutes: eventType.duration_minutes,
          locationNote: eventType.location_note,
        }}
        initialSlots={slots}
        initialWindowEndIso={new Date(toMs).toISOString()}
        seed={newSeed()}
        classic={query?.classic === "1"}
        receptionistLook={host.look && Object.keys(host.look).length ? host.look : undefined}
      />
    </main>
  );
}

async function loadDesk(rawHandle: string) {
  const supabase = getSupabaseAdmin();
  const host = await loadHostBySlug(supabase, cleanString(rawHandle, 64).toLowerCase());
  if (!host) return null;

  const eventType = await loadEventType(supabase, host.id);
  if (!eventType) return null;

  return { supabase, host, eventType };
}
