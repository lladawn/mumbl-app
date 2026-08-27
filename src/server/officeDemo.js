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
 * CAST — one actor per set-piece so /office/demo showcases every category:
 *   coding  → VS Code (IDE nook: dual monitors, terminal slab, code-green glow)
 *   terminal → Terminal (server rack: blinking LEDs, ops rack, green caret)
 *   design  → Figma   (design studio: easel, swatch tray, artboard)
 *   call    → Zoom    (meeting room: wall display, participant tiles, ON AIR)
 *   music   → Spotify (turntable console: vinyl, tonearm, VU bars, rising notes)
 *   writing → Notion  (library nook: gooseneck lamp, manuscript, book stack)
 *   browsing→ Chrome  (reading perch: laptop, article cards, scrolling feed)
 *   review  → GitHub  (inspection station: diff screen, corkboard, magnifier)
 *   focus   → other   (quiet nook: plant, mug, soft breathing glow)
 *
 * …plus an AMBIENT CAST, so the sample office reads as a place where people are
 * having a good time rather than a diorama of nine solitary workers. These are
 * not workers at stations; they are people in the room:
 *   break   → 6 people away from their desks (the renderer seats them at the
 *             ping-pong table, the café table, the sofa and the arcade)
 *   meeting → 2 people physically in the meeting room, talking to each other
 *
 * `break` and `meeting` are DEMO-ONLY categories. Nothing in the ingest path
 * emits them: a live office earns the same scenes from real signal instead —
 * idle/stale actors drift away from the desk, and two-or-more simultaneous
 * `call` actors get grouped at the meeting table. See the HONESTY RULE in
 * public/office/office-scene.js. The sample office is labelled SAMPLE and may
 * be richer; it must never be a template for asserting things about real people.
 */

export const DEMO_SLUG = "demo";

// occurredAt is computed relative to "now" at read time so the recency buckets
// (active / recently / idle) look alive rather than frozen in the past.
function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

export function demoSpaceState(slug = DEMO_SLUG) {
  const seed = [
    // ── coding: VS Code — IDE nook (dual monitor + terminal slab + code-green glow)
    {
      externalId: "demo:marisol",
      name: "Marisol",
      role: "Engineering",
      status: "working",
      source: "desktop",
      tool: "vscode",
      category: "coding",
      task: "Refactoring the auth token refresh flow",
      seenMinutes: 0,
      look: {
        hair: "#4A382C", skin: "#E3B48D", shirt: "#5FCBBC", pants: "#6E7E96", glow: "#C6F5EC",
        hairStyle: "curly", outfit: "hoodie", accessory: "headphones", accent: "#4FA5E0", build: "slim",
      },
      log: [
        "opened src/server/auth.js",
        "extracted refreshToken() → auth/refresh.js",
        "updated 9 call sites",
        "running test suite…",
        "42 passing, 0 failing ✓",
      ],
    },

    // ── terminal: Terminal — server rack (blinking LEDs, ops prompt, network blip)
    {
      externalId: "demo:riku",
      name: "Riku",
      role: "DevOps",
      status: "working",
      source: "desktop",
      tool: "terminal",
      category: "coding",
      task: "Watching the deploy pipeline roll out to prod",
      seenMinutes: 1,
      look: {
        hair: "#2E2A26", skin: "#8A5F3C", shirt: "#F8DFA0", pants: "#5E6E86", glow: "#FFF1CC",
        hairStyle: "cap", outfit: "vest", accessory: "none", accent: "#9BD8B4",
      },
      log: [
        "$ git push origin main",
        "CI build triggered → 3m12s",
        "health checks: 3/3 ✓",
        "watching pod rollout…",
        "2/3 replicas ready",
      ],
    },

    // ── design: Figma — design studio (easel, artboard, swatch tray, floating chip)
    {
      externalId: "demo:petra",
      name: "Petra",
      role: "Design",
      status: "working",
      source: "desktop",
      tool: "figma",
      category: "design",
      task: "Mocking up the new onboarding flow — three screens left",
      seenMinutes: 0,
      look: {
        hair: "#6B4426", skin: "#F0D2AC", shirt: "#F6BCD1", pants: "#7A7189", glow: "#FFE3EC",
        hairStyle: "bun", outfit: "apron", accessory: "scarf", accent: "#F0A79E", build: "slim",
      },
      log: [
        "opened onboarding.fig",
        "screen 1/5: welcome — done ✓",
        "screen 2/5: connect workspace — done ✓",
        "screen 3/5: first office — in progress",
        "dropped a comment on the invite card",
      ],
    },

    // ── call: Zoom — meeting room (wall display, camera tiles, ON AIR, speaker hop)
    {
      externalId: "demo:theo",
      name: "Theo",
      role: "Product",
      status: "working",
      source: "desktop",
      tool: "zoom",
      category: "call",
      task: "Sprint planning — estimating the Q3 roadmap with the team",
      seenMinutes: 0,
      look: {
        hair: "#403830", skin: "#C89370", shirt: "#94CDEE", pants: "#6E7E96", glow: "#D8EEFF",
        hairStyle: "short", outfit: "collar", accessory: "headphones", accent: "#6E9FD8", build: "broad",
      },
      log: [
        "joined sprint-planning call",
        "screensharing the Notion roadmap",
        "voting on auth overhaul: 3 pts",
        "voting on onboarding redesign: 5 pts",
        "next: API rate-limit milestone",
      ],
    },

    // ── music: Spotify — turntable console (vinyl, tonearm, VU bars, rising notes)
    {
      externalId: "demo:yuki",
      name: "Yuki",
      role: "Data",
      status: "working",
      source: "desktop",
      tool: "spotify",
      category: "music",
      task: "Running the weekly cohort analysis — Lo-fi on in the background",
      seenMinutes: 2,
      look: {
        hair: "#332C26", skin: "#A0714B", shirt: "#9BD8B4", pants: "#7A7189", glow: "#CCF3DC",
        hairStyle: "beanie", outfit: "stripes", accessory: "headphones", accent: "#86CFA6",
      },
      log: [
        "connected to warehouse",
        "query: signups_by_cohort → 4 200 rows",
        "D7 retention: 38% (prev 33%) ↑",
        "D30 retention: 19% — flagging",
        "drafting chart for the weekly digest",
      ],
    },

    // ── writing: Notion — library nook (lamp, manuscript, book stack, coffee, ink line)
    {
      externalId: "demo:clem",
      name: "Clem",
      role: "Content",
      status: "working",
      source: "desktop",
      tool: "notion",
      category: "writing",
      task: "Drafting the v2.2 changelog — 400 words, almost done",
      seenMinutes: 1,
      look: {
        hair: "#7A4A22", skin: "#F0D2AC", shirt: "#C6B0EC", pants: "#8A7358", glow: "#E8DBFF",
        hairStyle: "long", outfit: "overalls", accessory: "glasses", accent: "#59696E", build: "slim",
      },
      log: [
        "opened v2.2 changelog in Notion",
        "read 18 merged PRs",
        "grouped: Auth, Onboarding, Performance",
        "drafted 400 words — almost final",
        "flagged: breaking change in token API",
      ],
    },

    // ── browsing: Chrome — reading perch (laptop, article cards, scrolling feed)
    {
      externalId: "demo:soren",
      name: "Soren",
      role: "Marketing",
      status: "working",
      source: "desktop",
      tool: "chrome",
      category: "browsing",
      task: "Competitor research — reading pricing pages for the pitch deck",
      seenMinutes: 3,
      look: {
        hair: "#3A322C", skin: "#B5835B", shirt: "#F29C8D", pants: "#7A7189", glow: "#FFD2CA",
        hairStyle: "short", outfit: "collar", accessory: "none", accent: "#6E9FD8", build: "regular",
      },
      log: [
        "opened gather.town/pricing → 3 tiers",
        "opened whereby.com/pricing → per-seat",
        "opened kumospace.com/pricing → 403, cached copy",
        "building comparison table in a tab",
        "4 of 6 competitors done",
      ],
    },

    // ── review: GitHub — inspection station (diff screen, corkboard, magnifier)
    {
      externalId: "demo:anya",
      name: "Anya",
      role: "Engineering",
      status: "working",
      source: "desktop",
      tool: "github",
      category: "review",
      task: "Reviewing PR #214 — auth refresh refactor from Marisol",
      seenMinutes: 1,
      look: {
        hair: "#4A382C", skin: "#D9A277", shirt: "#CFBBF0", pants: "#6E7E96", glow: "#E8DBFF",
        hairStyle: "bun", outfit: "vest", accessory: "glasses", accent: "#CFBBF0",
      },
      log: [
        "opened PR #214: auth token refresh refactor",
        "read 7 changed files",
        "left 2 inline comments",
        "approved refreshToken() extraction ✓",
        "waiting on: test coverage for edge case",
      ],
    },

    // ── AMBIENT CAST ────────────────────────────────────────────────────
    // No tool, no task claim about work: these people are on a break, and the
    // status/category says exactly that. Their currentTask never names a
    // specific activity, because the renderer — not the seed — decides which
    // leisure seat each one takes, and the text must stay true wherever they land.
    {
      externalId: "demo:bo", name: "Bo", role: "Engineering",
      status: "idle", source: "desktop", tool: null, category: "break",
      task: "Away from the desk — back in a bit", seenMinutes: 2,
      look: {
        hair: "#2E2A26", skin: "#8A5F3C", shirt: "#F0A79E", pants: "#5E6E86", glow: null,
        hairStyle: "short", outfit: "plain", accessory: "none", accent: "#F0A79E", build: "broad",
      },
      log: ["closed the laptop", "stretched", "away from the desk"],
    },
    {
      externalId: "demo:nadia", name: "Nadia", role: "Design",
      status: "idle", source: "desktop", tool: null, category: "break",
      task: "Away from the desk — back in a bit", seenMinutes: 3,
      look: {
        hair: "#4A382C", skin: "#E3B48D", shirt: "#9BD8B4", pants: "#7A7189", glow: null,
        hairStyle: "curly", outfit: "stripes", accessory: "none", accent: "#9BD8B4", build: "slim",
      },
      log: ["saved the file", "away from the desk"],
    },
    {
      externalId: "demo:omar", name: "Omar", role: "Support",
      status: "idle", source: "desktop", tool: null, category: "break",
      task: "On a break", seenMinutes: 2,
      look: {
        hair: "#332C26", skin: "#A0714B", shirt: "#F8DFA0", pants: "#6E7E96", glow: null,
        hairStyle: "cap", outfit: "collar", accessory: "none", accent: "#F8DFA0",
      },
      log: ["cleared the queue", "on a break"],
    },
    {
      externalId: "demo:pia", name: "Pia", role: "Data",
      status: "idle", source: "desktop", tool: null, category: "break",
      task: "On a break", seenMinutes: 4,
      look: {
        hair: "#6B4426", skin: "#F0D2AC", shirt: "#C6B0EC", pants: "#8A7358", glow: null,
        hairStyle: "bun", outfit: "apron", accessory: "none", accent: "#C6B0EC", build: "slim",
      },
      log: ["query finished", "on a break"],
    },
    {
      externalId: "demo:hana", name: "Hana", role: "Marketing",
      status: "idle", source: "desktop", tool: null, category: "break",
      task: "Away from the desk", seenMinutes: 5,
      look: {
        hair: "#7A4A22", skin: "#F0D2AC", shirt: "#BEE7F7", pants: "#7A7189", glow: null,
        hairStyle: "long", outfit: "hoodie", accessory: "none", accent: "#BEE7F7",
      },
      log: ["scheduled the post", "away from the desk"],
    },
    {
      externalId: "demo:kwame", name: "Kwame", role: "Engineering",
      status: "idle", source: "desktop", tool: null, category: "break",
      task: "Away from the desk", seenMinutes: 3,
      look: {
        hair: "#2E2A26", skin: "#6E4526", shirt: "#7FD8CC", pants: "#5E6E86", glow: null,
        hairStyle: "beanie", outfit: "vest", accessory: "none", accent: "#7FD8CC",
      },
      log: ["pushed the branch", "away from the desk"],
    },

    // ── in the MEETING ROOM: two people talking to each other, in the room,
    // not two people on two separate laptops. No tool — being in a meeting is
    // not an app. (Theo stays at his own booth: he is on a REMOTE call, which
    // is a different thing, and his call vignette is one of the work set-pieces.)
    {
      externalId: "demo:ines", name: "Ines", role: "Engineering",
      status: "working", source: "desktop", tool: null, category: "meeting",
      task: "Design review with Gus — walking through the migration plan", seenMinutes: 0,
      look: {
        hair: "#3A322C", skin: "#B5835B", shirt: "#F6BCD1", pants: "#6E7E96", glow: null,
        hairStyle: "bun", outfit: "collar", accessory: "glasses", accent: "#F6BCD1", build: "slim",
      },
      log: [
        "booked the meeting room",
        "walked through the migration plan",
        "whiteboarded the cutover order",
        "open question: backfill window",
      ],
    },
    {
      externalId: "demo:gus", name: "Gus", role: "Product",
      status: "working", source: "desktop", tool: null, category: "meeting",
      task: "Design review with Ines — agreeing the cutover order", seenMinutes: 0,
      look: {
        hair: "#403830", skin: "#C89370", shirt: "#8FD6AE", pants: "#7A7189", glow: null,
        hairStyle: "short", outfit: "vest", accessory: "none", accent: "#8FD6AE", build: "broad",
      },
      log: [
        "joined the design review",
        "pushed back on the backfill window",
        "agreed: two-phase cutover",
        "action: Ines to write it up",
      ],
    },

    // ── focus: other — quiet nook (plant, mug, soft breathing glow)
    {
      externalId: "demo:felix",
      name: "Felix",
      role: "Engineering",
      status: "done",
      source: "desktop",
      tool: "other",
      category: "other",
      task: "Heads-down on the rate-limiter — no notifications until 3pm",
      seenMinutes: 4,
      look: {
        hair: "#332C26", skin: "#A0714B", shirt: "#EAD9C4", pants: "#5E6E86", glow: "#F5EEDE",
        hairStyle: "short", outfit: "plain", accessory: "none", accent: "#C7D2CE",
      },
      log: [
        "closed all tabs",
        "focus mode on",
        "reading RFC: sliding-window rate limiter",
        "wrote prototype — 80 lines",
        "done for today · handing off to Riku",
      ],
    },
  ];

  const actors = seed.map((a) => ({
    externalId: a.externalId,
    name: a.name,
    role: a.role,
    status: a.status,
    source: a.source,
    tool: a.tool,
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
    // the seeded cast was "just seen", so the office is live, not away
    offline: false,
    demo: true,
  };
}
