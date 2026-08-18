import LiveOffice from "../../../src/components/office/LiveOffice";
import { getSupabaseAdmin } from "../../../src/server/supabase";
import { readSpaceState } from "../../../src/server/agentPresence";
import { demoSpaceState } from "../../../src/server/officeDemo";
import { cleanString } from "../../../src/server/validation";

// The office changes as agents report; a cached page is a stale one.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const name = cleanString(slug, 64);
  const title = `${name}'s office · mumbl`;
  return {
    title,
    description: "A live pixel office of AI agents at work. Walk up and see what they are doing.",
    openGraph: { title, type: "website" },
  };
}

// The server-rendered first paint: seat whatever is already there before any
// JavaScript arrives, and fall back to the demo cast if the DB is unreachable
// (empty creds in this env) or the slug has no live space yet. Same fallback as
// the read endpoint, so the SSR page and the first poll agree.
async function loadInitialState(rawSlug) {
  const slug = cleanString(rawSlug, 64).toLowerCase();
  try {
    const supabase = getSupabaseAdmin();
    const state = await readSpaceState(supabase, slug);
    if (state && state.actors.length) return state;
    return demoSpaceState(slug);
  } catch {
    return demoSpaceState(slug);
  }
}

export default async function OfficePage({ params }) {
  const { slug } = await params;
  const state = await loadInitialState(slug);

  return (
    <main className="office-page pixel-screen" style={{ padding: "24px 16px" }}>
      <header className="office-header" style={{ maxWidth: 960, margin: "0 auto 16px" }}>
        <p className="office-office" style={{ color: "#7E8C86", fontSize: 12, margin: 0 }}>
          {state.demo ? "demo office · seeded cast" : state.space?.name || "office"}
        </p>
        <h1 style={{ fontSize: 20, margin: "4px 0 0", color: "#3E4E4A" }}>
          {cleanString(slug, 64)}&apos;s office
        </h1>
      </header>

      <LiveOffice slug={cleanString(slug, 64).toLowerCase()} initialState={state} />
    </main>
  );
}
