/**
 * A seeded demo office, so /office/[slug] renders before the DB is stood up.
 *
 * The env ships with empty Supabase secrets, and the whole point of phase 1 is
 * a visible source → renderer proof. When the read path can't reach the DB (no
 * creds, or an unknown slug in demo mode) the route falls back to this — the
 * same cast the static /demo page seeds, in the exact shape readSpaceState
 * returns, so the scene adapter can't tell the difference. Real data supersedes
 * it the moment a live space with that slug exists.
 *
 * The cast, statuses, tasks and per-agent look are lifted from the SEED const in
 * public/demo/index.html on purpose: the demo office and the live office should
 * read as the same place.
 */

export const DEMO_SLUG = "demo";

// occurredAt is computed relative to "now" at read time so the recency buckets
// (active / recently / idle) look alive rather than frozen in the past.
function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

export function demoSpaceState(slug = DEMO_SLUG) {
  const seed = [
    {
      externalId: "demo:scout",
      name: "Scout",
      role: "Research",
      status: "working",
      source: "claude-code",
      category: "agent",
      task: "Pulling pricing pages for 6 competitors",
      seenMinutes: 0,
      look: {
        hair: "#4A382C", skin: "#E3B48D", shirt: "#5FCBBC", pants: "#6E7E96", glow: "#C6F5EC",
        hairStyle: "curly", outfit: "stripes", accessory: "glasses", accent: "#FFF8EC", build: "slim",
      },
      log: [
        "fetch gather.town/pricing → ok (4 tiers)",
        "fetch sowork.com/pricing → ok",
        "fetch kumospace.com/pricing → 403, retrying",
        "retry via cache → ok",
        "normalising per-seat vs flat…",
        "4 of 6 complete",
      ],
    },
    {
      externalId: "demo:scribe",
      name: "Scribe",
      role: "Writing",
      status: "done",
      source: "claude-code",
      category: "agent",
      task: "Drafting the changelog for v2.1",
      seenMinutes: 1,
      look: {
        hair: "#6B4426", skin: "#F0D2AC", shirt: "#F3CE79", pants: "#8A7358", glow: "#FFF1CC",
        hairStyle: "bun", outfit: "collar", accessory: "earrings", accent: "#C7913F",
      },
      log: [
        "read 24 merged PRs since v2.0",
        "grouped into 5 themes",
        "drafted 340 words",
        "flagged 2 breaking changes",
        "done — waiting for your review",
      ],
    },
    {
      externalId: "demo:auditor",
      name: "Auditor",
      role: "Review",
      status: "blocked",
      source: "claude-code",
      category: "agent",
      task: "Weekly funnel check",
      seenMinutes: 2,
      look: {
        hair: "#3A322C", skin: "#C89370", shirt: "#F29C8D", pants: "#7A7189", glow: "#FFD2CA",
        hairStyle: "beanie", outfit: "vest", accessory: "lanyard", accent: "#CFBBF0", build: "broad",
      },
      log: [
        "connected to warehouse → ok",
        "query signups_daily → ok",
        "query activation_events → PERMISSION DENIED",
        "retried 3× — same",
        "BLOCKED: needs analytics dashboard access",
      ],
    },
    {
      externalId: "demo:builder",
      name: "Builder",
      role: "Engineering",
      status: "working",
      source: "claude-code",
      category: "agent",
      task: "Refactoring the auth module",
      seenMinutes: 0,
      look: {
        hair: "#332C26", skin: "#A0714B", shirt: "#94CDEE", pants: "#6E7E96", glow: "#D8EEFF",
        hairStyle: "cap", outfit: "hoodie", accessory: "headphones", accent: "#6E9FD8",
      },
      log: [
        "read src/auth/*.ts (7 files)",
        "extracted session logic → session.ts",
        "updated 12 call sites",
        "running test suite…",
        "38 passing, 2 failing — investigating",
      ],
    },
  ];

  const actors = seed.map((a) => ({
    externalId: a.externalId,
    name: a.name,
    role: a.role,
    status: a.status,
    source: a.source,
    tool: "claude-code",
    category: a.category,
    object: null,
    currentTask: a.task,
    lastSeenAt: minutesAgo(a.seenMinutes),
    stale: false,
    look: a.look,
    events: a.log.map((detail, i) => ({
      kind: "status",
      status: a.status,
      category: a.category,
      detail,
      occurredAt: minutesAgo(a.seenMinutes + (a.log.length - i)),
    })),
  }));

  return {
    space: { slug, name: "Demo office" },
    actors,
    generatedAt: new Date().toISOString(),
    demo: true,
  };
}
