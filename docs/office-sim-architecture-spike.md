# Office-Sim Architecture Spike — v1

_Design spike, 2026-08-18. Owner: architecture-spike. This is a design doc + scaffolding sketches, **not** production wiring. No app source, migrations, or config were changed by this doc._

Reference ground truth: `hive/plans/mumbl-office-sim-plan.md` (prior discovery inventory) and `docs/agent-presence-stage-1.md` (existing feed contract). This doc extends both; it does not re-derive them.

---

## 0. The pitch in one paragraph (for the non-engineer)

mumbl becomes a **live, shareable pixel office of everything you're actively doing across your tools.** A tiny menubar app on your laptop notices which app you're focused on (Figma, VS Code, a call) — the *shape* of the work, never the content — and every tool you connect (Claude Code, GitHub, Spotify) sends the same kind of "I'm doing X right now" ping. Those pings land in one place, and a pixel office **self-assembles** out of them: a coding desk appears because you're coding, a record player spins because Spotify's playing, a meeting room lights up because you're on a call. No two people's offices look alike. One click makes a public snapshot card you can post to Twitter — it shows the *vibe* of your day (which rooms are lit, how busy it is), never a single word of what you actually typed. That last part — capturing shape, not content — is the whole ballgame and is enforced at every layer below.

**Why it's possible:** the spine already exists. There's a built, walkable multi-agent pixel office (`public/demo/index.html`), a generic one-endpoint ingest pipeline with encryption + HMAC auth (`app/api/agents/ingest`), an append-only event log ordered by real event time, and a proven server-rendered pixel share-card generator (`app/opengraph-image.jsx`). v1 is mostly *wiring existing parts together* plus one new native helper and two thin adapters.

---

## 1. System architecture

```
  CAPTURE SOURCES                    INGEST                 STORE                 RENDER                 SHARE
  (many, opt-in)                  (one endpoint)          (one model)         (one scene)           (one card)

┌──────────────────────┐
│ Desktop helper (NEW) │  active-app / window / focus  ┐
│  Tauri menubar app   │  → normalized activity event  │
└──────────────────────┘                               │
┌──────────────────────┐                               │   ┌────────────────────────┐
│ Claude Code hooks    │  hook_event → status/task     ├──▶│ POST /api/activity/    │
│  scripts/mumbl-      │  (EXISTS, retargeted)         │   │      ingest  (NEW,     │
│  report.mjs          │                               │   │  generalizes agents/   │
└──────────────────────┘                               │   │  ingest)               │
┌──────────────────────┐                               │   │                        │
│ GitHub webhook       │  push/PR/review → activity    ┘   │  • Bearer HMAC auth    │
│  (NEW adapter route) │                                   │    (reuse hashToken)   │
└──────────────────────┘                                   │  • dispatch by source  │
                                                           │  • encrypt content     │
                                                           │  • plaintext SHAPE     │
                                                           └───────────┬────────────┘
                                                                       │
                                                     ┌─────────────────▼──────────────────┐
                                                     │  Supabase (reuse agent_presence)    │
                                                     │  spaces │ activity_actors │         │
                                                     │  activity_events (occurred_at)      │
                                                     │  shape fields plaintext,            │
                                                     │  content fields encrypted_payload   │
                                                     └─────────────────┬───────────────────┘
                                                                       │
                     ┌─────────────────────────────────────────────────┼───────────────────────────┐
                     │ (owner/authed view)                              │ (public redacted view)    │
        ┌────────────▼─────────────┐                       ┌────────────▼──────────────┐            │
        │ GET /api/office/[handle] │  full shape + decrypt │ GET public snapshot        │            │
        │      /state (NEW)        │  (owner only)         │  (shape-only, redacted)    │            │
        └────────────┬─────────────┘                       └────────────┬──────────────┘            │
                     │                                                  │                           │
        ┌────────────▼─────────────┐                       ┌────────────▼──────────────┐  ┌─────────▼─────────┐
        │ <LiveOffice/> React +    │  applyState() reconcile│ /office/[handle] page      │  │ opengraph-image   │
        │  public/office/*.js      │  poll every ~4s        │  (public, redacted scene)  │  │  .jsx snapshot     │
        │  (extract from /demo)    │                        └────────────────────────────┘  │  (reuse pattern)   │
        └──────────────────────────┘                                                        └───────────────────┘
```

### Component list — existing vs new

| Pipeline part | File | Status |
|---|---|---|
| Capture: Claude Code hooks | `scripts/mumbl-report.mjs` | **EXISTS** — retarget event shape (§7) |
| Capture: desktop helper | `desktop/` (new repo dir or sibling repo) | **NEW** (§2) |
| Capture: GitHub adapter | `app/api/activity/github/route.js` | **NEW** thin adapter (§7) |
| Ingest endpoint | `app/api/activity/ingest/route.js` | **NEW** — generalizes `app/api/agents/ingest/route.js` (keep old as alias) |
| Ingest server logic | `src/server/activityPresence.js` | **NEW** — generalizes `src/server/agentPresence.js` |
| Auth (HMAC bearer) | `src/server/hash.js` `hashToken`, `resolveSpaceByIngestToken` | **EXISTS** — reuse verbatim |
| Encryption (content) | `src/server/encryption.js` `encryptContentFields` | **EXISTS** — reuse verbatim |
| Event ordering | `resolveOccurredAt` in agentPresence.js | **EXISTS** — reuse |
| Schema | `supabase/migrations/0007_activity.sql` | **NEW** — extends 0004/0005 (§3) |
| Read API (owner) | `app/api/office/[handle]/state/route.js` | **NEW** (§4) |
| Read logic + decrypt | `readOfficeState` in `src/server/activityPresence.js` | **NEW** |
| Scene engine (extracted) | `public/office/office-scene.js` | **NEW** — extract from `public/demo/index.html` |
| React embed | `src/components/office/LiveOffice.tsx` | **NEW** — mirror `src/components/cal/OfficeScene.tsx` |
| Route | `app/office/[handle]/page.tsx` | **NEW** |
| Share card | `app/office/[handle]/opengraph-image.jsx` | **NEW** — reuse `app/opengraph-image.jsx` pattern |

The Slack product (`app/api/slack`, `app/slack`) is untouched and unrelated.

---

## 2. Desktop helper app

### What it is
A **menubar (tray) app** that runs quietly on the user's laptop, watches which app is in the foreground, and POSTs normalized "shape-of-work" events to the ingest endpoint. It is the primary source because it's the only one with *all-apps* coverage — everything else is an adapter onto the same pipe.

### Stack recommendation: **Tauri (Rust core + tiny web UI)**

| Option | Bundle | Native APIs for focus tracking | Solo-dev cost | Verdict |
|---|---|---|---|---|
| **Tauri v2** | ~3–10 MB | Rust FFI to macOS `NSWorkspace`/AXUIElement; Windows via crates | Web UI you already know (React/vanilla), Rust only for the ~100 lines of OS polling | **PICK** |
| Electron | ~150 MB | Node native modules (`active-win`) — easy | Huge bundle, RAM-heavy for a thing that idles in the tray all day | No — perf posture is wrong for an always-on menubar |
| Swift menubar | ~1 MB, best native fidelity | First-class `NSWorkspace.didActivateApplicationNotification` | macOS-only; second codebase for Windows later; least reusable with the web team | No for v1 (revisit if macOS-only + max polish) |

**Rationale:** the settings/allowlist UI is trivial web UI (reuse existing design tokens), the only native surface is a small polling loop, and the always-on posture makes Electron's footprint unacceptable. Tauri gives near-Swift footprint with a web UI the solo dev already maintains. `active-win` (the ecosystem's window-title library) has Rust equivalents; on macOS the clean signal is `NSWorkspace.didActivateApplicationNotification` (fires on app switch) plus optional Accessibility (`AXUIElement`) for window title. **v1 uses only the app-switch signal (no Accessibility permission needed);** window title is a later, opt-in upgrade.

### What it watches — the SHAPE, never content
- **Active application** — bundle id / process name (e.g. `com.figma.Desktop`, `Code`, `zoom.us`). This is the primary signal.
- **Focus / switch events** — app A → app B transitions, so dwell time per app is derivable.
- **Window title** (OPT-IN, later) — only to disambiguate a browser tab domain (e.g. `github.com`), **never the full title/URL/content**. Off by default; requires Accessibility permission.

Never captured: keystrokes, clipboard, screen pixels, file contents, message bodies, URLs beyond bare domain (and only if title-mode is explicitly enabled).

### Raw OS signal → normalized activity event
The helper holds a small **classification table** (app bundle id → category + office-object hint). Everything unknown maps to a generic `focus`/`working` category — it never leaks the raw app name unless that app is on the allowlist AND matched to a known mapping.

```
NSWorkspace fires: didActivate  com.figma.Desktop
        │
        ▼  classify(bundleId) →  { tool: "figma", category: "design", object: "design-table" }
        │  (unknown bundle → { tool: "other", category: "focus", object: null } — or dropped)
        ▼  debounce: only emit if focus held ≥ 20s (kills alt-tab noise, saves battery/rate limit)
        ▼  POST /api/activity/ingest
```

### Event JSON shape it POSTs
Identical envelope to the existing ingest contract (so it's the same pipeline), with a `source: "desktop"` discriminator:

```jsonc
{
  "actor":  { "id": "desktop:<install_uuid>", "name": "Disha's Mac", "role": "You", "source": "desktop" },
  "source": "desktop",
  "tool":   "figma",            // SHAPE — plaintext, safe to render/share
  "category": "design",         // SHAPE — one of a fixed vocabulary (§3)
  "object": "design-table",     // SHAPE — office-object hint (may be null; renderer can re-map)
  "status": "working",          // SHAPE — idle|working|blocked|done (existing vocab)
  "occurredAt": "2026-08-18T14:03:00.000Z",
  "detail": "Figma · design"    // CONTENT slot — encrypted at rest; NEVER in public view
}
```
`tool`/`category`/`object`/`status` are the shareable shape. `detail` is the only free-text field and is encrypted exactly like `agent_events.detail` is today.

### Opt-in / allowlist UX
- **Default posture: nothing is shared.** On install the helper shows an allowlist picker; the user ticks the apps/categories they want represented (e.g. "share when I'm in Figma, VS Code, Zoom"; "never share Messages, Mail, Banking").
- A menubar toggle: **Pause sharing** (one click, goes dark immediately) and **What am I sharing right now?** (shows the exact last event that left the machine — a live receipt).
- Categories, not raw apps, are the default granularity: the user opts into "design tools" rather than enumerating every app. Unknown apps are **dropped**, not sent as "other," unless the user opts into a generic "focus time" bucket.

### Auth to the ingest endpoint (reuse the HMAC pattern)
Reuse the space **ingest-token** flow verbatim: the user pastes their space ingest token into the helper once (same token `scripts/mumbl-report.mjs` uses via `MUMBL_INGEST_TOKEN`). The helper sends `Authorization: Bearer <token>`; the server hashes it with `hashToken` (HMAC-SHA256, `src/server/hash.js`) and matches `agent_spaces.ingest_token_hash` via `resolveSpaceByIngestToken`. **No new auth mechanism.** Token stored in the OS keychain (Tauri's secure store), never on disk in plaintext.

### Battery / perf posture
- Event-driven, not polled: subscribe to `NSWorkspace` activation notifications (zero CPU while idle) rather than polling `active-win` on a timer.
- **20s debounce** before emitting — a focus must be held to count, which both denoises and caps request volume well under the existing per-space rate limit (300/min).
- Coalesce: if the same tool stays focused, send at most one heartbeat per ~60s (keeps the office "lit" without spamming).
- No background work while the machine is asleep/locked; respect Low Power Mode by widening the heartbeat interval.
- Bounded network calls with abort timeout, mirroring `mumbl-report.mjs`'s "never block, always exit 0" discipline.

---

## 3. Unified activity model + ingest

### Decision: **extend the existing `agent_presence` model, renamed conceptually to "activity"** — do not build a parallel system.
The existing `agents`/`agent_events` tables are already exactly "an actor's current state" + "an append-only event log with `occurred_at` ordering + encrypted content." A Claude Code agent, a desktop focus, and a GitHub push are all the same shape: *an actor is doing a category of thing right now.* Introducing a second model would fork the ingest endpoint, the encryption path, and the read path for no gain.

Concretely: keep `agent_spaces` as the tenant/`space`. Add **shape columns** to the actor and event tables (or, cleaner, a light migration that adds `tool`/`category`/`object` and generalizes `role`). Existing Claude Code rows keep working (`source='claude-code'`).

### Schema (migration `0007_activity.sql`, extends 0004/0005)

```sql
-- Actors: "who/what is present and what are they doing now" (renders the office).
-- Generalizes `agents`. New SHAPE columns are plaintext (safe to render + share).
alter table agents
  add column if not exists tool     text,                 -- SHAPE  e.g. 'figma','github','claude-code'
  add column if not exists category text,                 -- SHAPE  fixed vocab (see below)
  add column if not exists object   text;                 -- SHAPE  office-object hint, nullable
-- existing: external_id, name, role, status, source, encrypted_payload(current_task), last_seen_at

-- Events: append-only activity log, ordered by occurred_at (0005).
alter table agent_events
  add column if not exists tool     text,                 -- SHAPE
  add column if not exists category text,                 -- SHAPE
  add column if not exists object   text;                 -- SHAPE
-- existing: kind, status, occurred_at, encrypted_payload(detail)

-- Fixed category vocabulary (enforced in app layer, not a DB enum, so adding one
-- category is a code change not a migration):
--   coding | design | writing | call | music | review | browsing | focus | agent
```

**Encrypted vs plaintext split (the privacy contract, at the schema level):**

| Field | Storage | In owner view | In public/share view |
|---|---|---|---|
| `tool`, `category`, `object`, `status` | plaintext columns | yes | **yes** (this IS the shareable shape) |
| `name`, `role` | plaintext | yes | display-name only, opt-in |
| `current_task` / event `detail` | `encrypted_payload` (AES-256-GCM, `encryptContentFields`) | yes (decrypt, owner only) | **NEVER** — not decrypted for public view |
| `occurred_at` | plaintext | ordering | coarsened to "active/idle recently" |

This is the same boundary `docs/agent-presence-stage-1.md` already draws (task/detail encrypted, everything else plaintext) — we're just formalizing that the plaintext side is deliberately the *renderable, shareable shape.*

### Ingest dispatch by source/adapter
The single endpoint `POST /api/activity/ingest` (generalizes `app/api/agents/ingest/route.js`) keeps the same structure: bearer → `resolveSpaceByIngestToken` → validate → rate-limit → write. The only addition is a **normalize-by-source** step before writing:

```
POST /api/activity/ingest
  → bearer HMAC → space                          (unchanged)
  → const norm = ADAPTERS[body.source](body)     (NEW: per-source normalizer)
       ADAPTERS = {
         "claude-code": passthrough,             // already emits status/task
         "desktop":     mapDesktop,              // tool/category/object → row
         "github":      mapGithub,               // event type → category/object
       }
  → recordActivityState(supabase, norm)          (generalized recordAgentState:
                                                   also writes tool/category/object)
```
Adapters are pure functions (`src/server/activityAdapters.js`, NEW) that map a source's raw body to the canonical `{actor, tool, category, object, status, detail, occurredAt}`. A new feed = a new pure function, never a new endpoint. This preserves the doc-stated "one write path only" invariant.

Backward-compat: keep `app/api/agents/ingest` as a thin alias that calls the same handler with `source` defaulted from `agent.source`, so `mumbl-report.mjs` and any deployed hooks keep working unchanged.

---

## 4. Office renderer + personalization mapping

### DB state → scene (the adapter)
The read API returns a `state` snapshot; a client-side adapter turns rows into scene objects and `applyState()` reconciles the live scene (add/move/remove) rather than rebuilding. This is exactly the plan's Phase-1 shape — reuse `makePerson`, `seatAgent`, `buildTerminal`, proximity/panel from `public/demo/index.html` verbatim; the only change is *where the data comes from* (injected state instead of the `SEED` const).

```
GET /api/office/[handle]/state
  → { actors: [ { external_id, name, role, status, tool, category, object,
                  current_task(decrypted, owner-only), last_seen_at,
                  events: [ {kind, status, category, detail(decrypted), occurred_at} ] } ],
      objects: [ derived office objects with counts ],  // §4 mapping
      generatedAt }

client adapter:
  actors  → seatAgent(status→pill, current_task→panel, events→log, external_id→stable desk)
  objects → self-assembling furniture (a design-table exists iff something emits category 'design')
```
Order events by `occurred_at` (never `created_at`) — this is already the server-side rule in `resolveOccurredAt` + the 0005 index. Stale actors (old `last_seen_at`, e.g. > 5 min) "walk out" (reuse the demo's leave path); desks are assigned by a stable hash of `external_id` so an actor keeps its seat across polls/reconnects.

### Tool → office-object mapping
The office **self-assembles**: an object exists in the room *iff* at least one actor is currently emitting the category that maps to it. Empty categories render nothing — this is what makes every office different.

| Tool / signal | `category` | Office object (self-assembles when present) | Renders via |
|---|---|---|---|
| Claude Code agent | `agent` | **Seated agent** at a bullpen desk, status pill + activity log | existing `seatAgent` (verbatim) |
| VS Code / editor (desktop) | `coding` | **Coding desk** — lit monitor, keyboard clatter idle-anim | new furniture sprite (procedural, like desks) |
| GitHub push/PR/review | `review`/`coding` | **Coding desk** with a "PR" ticket / **review corner** | webhook feed → same desk object |
| Figma / design tool | `design` | **Design table** — big flat table, mood-board wall | new furniture sprite |
| Zoom / Meet / call | `call` | **Meeting room** lights up + "on a call" door state | reuse `ZONES` 'meeting room' cell |
| Spotify / music | `music` | **Record player** in the lounge, spinning while playing | new furniture sprite in `ZONES` 'lounge' |
| Browser (opt-in) | `browsing` | **Reading nook / couch** | reuse 'lounge' |
| Anything opted-in but unmapped | `focus` | **Generic desk**, dim | fallback |

The `object` field in the event is a *hint*; the renderer owns final placement (so a tool can be re-skinned without a migration). Self-assembly rule lives in the client adapter: `objects = distinct(categories currently active) → furniture`, placed into the existing `ZONES` grid. New furniture is procedural canvas (same technique as `makePerson`/desks) so there is **no asset pipeline** — consistent with the current engine's strength (and its ceiling; see §9).

### Extraction (per the plan)
Move the `Room` scene, `makePerson`, `seatAgent`, `buildTerminal`, `ZONES`, `DESKS`, proximity/panel out of `public/demo/index.html` into `public/office/office-scene.js` exposing a `boot()` controller (mirror `window.MumblCalOffice.boot` from `public/cal/office-scene.js`), plus `applyState(state)`. `<LiveOffice/>` (`src/components/office/LiveOffice.tsx`) loads Phaser + the scene exactly like `OfficeScene.tsx` does (`loadScript`, reduced-motion fallback, destroy on unmount) and drives `applyState` from the poll. `/demo` keeps its static `SEED` — the extraction is additive, not a rewrite of the demo.

---

## 5. Shareable card / social surface

### Surfaces
1. **Public page** `app/office/[handle]/page.tsx` — a redacted live (or last-snapshot) office. Renders the same scene with a **redacted state feed** (shape only): pills show `working`/`design`/`on a call`, furniture self-assembles, but **no task strings, no event detail, no window titles** — those are never decrypted for this path.
2. **OG snapshot image** `app/office/[handle]/opengraph-image.jsx` — reuse the `app/opengraph-image.jsx` pattern verbatim (Satori, positioned divs, same palette `C`, same `personRects`/`Station`). Instead of the three hard-coded `looks`, it reads the redacted state and lays out however many stations/objects are currently lit, with a headline like "3 desks working · design table busy · 1 on a call." This is the postable artifact.
3. **(Later) short loop** — a few-second GIF/MP4 of the office; defer past v1 (image is enough to be postable).

### Privacy redaction model (public view)
A dedicated **`redactForPublic(state)`** function (server-side, `src/server/activityPresence.js`) is the single gate for anything public:
- **Shape only:** pass `tool`, `category`, `object`, `status`, coarse counts, and a coarse recency bucket (`active` / `recently` / `idle`).
- **Strip:** `current_task`, event `detail`, exact `occurred_at`, `external_id`, window titles — these are never even *fetched decrypted* for the public path (the read query for public omits `encrypted_payload` entirely via `withoutEncryptedPayload`, which already exists in `encryption.js`).
- **Per-source opt-in:** the public view only includes sources/categories the owner marked public (a `share_categories` allowlist on the space or a per-actor flag). Desktop "focus" time is off-by-default in public even if on privately.
- **Handle, not slug/token:** public URL is a vanity `[handle]`, decoupled from the ingest token and the owner read path.

### Why it's postable (the viral loop)
- **It's a self-portrait of your day that you didn't have to write** — "look how busy/varied my office got" is inherently show-off-able, like a Spotify Wrapped that's live.
- **Every office is unique** (self-assembly) → the card is a fingerprint, not a template → curiosity ("why does theirs have a record player and a design table?").
- **Safe to post** precisely because it's shape-only — no accidental leak of a repo name or a client, which is what makes people comfortable sharing work-context at all.
- The card carries `mumbl.wtf/office/[handle]` → the viewer wants their own office → install loop closes on the desktop helper.

---

## 6. Realtime

### Recommendation for v1: **poll the owner read endpoint (~4s) — do NOT open RLS yet.**

| | Poll | Supabase Realtime + RLS |
|---|---|---|
| RLS posture | stays closed (service-role read only) — matches 0004's deliberate "no policies" stance | requires opening scoped read policies (a security decision `docs/agent-presence-stage-1.md` says to make *deliberately*, not for convenience) |
| Decryption | happens server-side in the read route (owner only) — the browser never gets keys or ciphertext | client subscribes to raw rows → either the browser can't decrypt (useless) or you'd have to expose decrypted data through a broadcast layer (leaky) |
| Effort | S — one `setInterval` + `applyState` | M — migration 0007b policies + client sub + auth plumbing |
| Cost | a few req/space/min, trivially within limits given the 20s+ debounce upstream | fewer requests but more infra + a security surface |

**Rationale:** the encryption boundary is the killer — decryption must stay server-side (owner-scoped), so the browser can never read rows directly anyway; Realtime would only stream *shape*, and for shape a 4s poll is indistinguishable to the eye in a pixel office. Poll keeps RLS closed (honoring 0004's design), keeps the decrypt boundary clean, and is S-sized. Revisit Realtime only if/when we want sub-second multi-viewer sync (post-v1). This matches the plan's lean.

---

## 7. First 3 feeds for v1

Chosen: **Claude Code hooks (exists)**, **Desktop helper (the primary source)**, and **GitHub webhook** as the one more high-signal easy adapter.

| Feed | What it emits | Office object | Effort |
|---|---|---|---|
| **1. Claude Code hooks** (`scripts/mumbl-report.mjs`) | `hook_event → status` (working/blocked/done) + a tool/task line; already live. Retarget: set `source:"claude-code"`, `category:"agent"`. | **Seated agent** with status pill + live activity log (the proven demo experience) | **S** — already emits; add `category` field, point at `/api/activity/ingest` |
| **2. Desktop helper** (Tauri, §2) | active-app focus → `{tool, category, object}` (design/coding/call/music/focus) | Self-assembling furniture: design table, coding desk, meeting room, record player | **L** — the one genuinely new build (native app + signing) |
| **3. GitHub webhook** (`app/api/activity/github/route.js`) | repo webhook: `push`→coding, `pull_request`→review, `review`→review. Maps event type → category; repo/branch go in the **encrypted** `detail`, never public. | **Coding desk** ticket / **review corner** | **S/M** — one webhook route, verify GitHub HMAC signature, map ~3 event types; no user install needed |

**Why GitHub over Spotify for the third:** GitHub is the highest-signal "real work" feed, needs zero desktop install (server-to-server webhook), proves the *adapter* pattern (a totally different source shape flowing through the same pipe), and its content (repo/branch) exercises the encrypt-vs-shape split meaningfully. Spotify is a great *fourth* (fun, easy OAuth, the record player) but adds an OAuth dance and is lower-signal for "what work am I doing." Slack is explicitly out of scope for this pivot's feeds.

---

## 8. Phased build plan (dependency-ordered)

**Phase 1 (M) — One real tool rendered live + a shareable snapshot.**
Smallest thing that proves the spine. Uses the feed that *already emits* (Claude Code) so no native app is on the critical path.
- Deliverables: (a) live office at `/office/[handle]` rendering real Claude Code agents at desks with real status/task/log; (b) an OG snapshot card of that office.
- Key files: `supabase/migrations/0007_activity.sql` (add shape cols) · `src/server/activityPresence.js` (`readOfficeState` + decrypt + `redactForPublic`) · `app/api/office/[handle]/state/route.js` (owner read) · `public/office/office-scene.js` (extract `Room`+`applyState` from `public/demo/index.html`) · `src/components/office/LiveOffice.tsx` (mirror `OfficeScene.tsx`) · `app/office/[handle]/page.tsx` · `app/office/[handle]/opengraph-image.jsx` (reuse `app/opengraph-image.jsx`).
- Size: **M.**

**Phase 2 (S) — Poll realtime + stale handling.**
- Deliverable: office updates live without reload; stale actors walk out; stable desks.
- Key files: `LiveOffice.tsx` (poll `+ applyState`), `office-scene.js` (reconcile add/move/remove, stable `external_id→desk` hash).
- Size: **S.** (Realtime/RLS explicitly deferred per §6.)

**Phase 3 (L) — Desktop helper MVP → self-assembling furniture.**
- Deliverable: Tauri menubar app that shares active-app category; office grows a design table / coding desk / meeting room / record player from real focus.
- Key files: new `desktop/` (Tauri) · `src/server/activityAdapters.js` (`mapDesktop`) · new procedural furniture in `office-scene.js` · category→object self-assembly in the client adapter.
- Size: **L** (native app + allowlist UX + keychain token).

**Phase 4 (S/M) — GitHub adapter + shareable public loop.**
- Deliverable: GitHub webhook feed lands as coding/review objects; public `/office/[handle]` fully redacted + share card wired to a "Share to X" button.
- Key files: `app/api/activity/github/route.js` (verify sig, `mapGithub`) · `activityAdapters.js` · public redaction wired end-to-end · share button in the office UI.
- Size: **S/M.**

**Phase 5 (S) — Polish / breadth.** Stable per-actor avatars keyed on `external_id` (reuse `PALETTES`/trait system), zone-per-category seating, Spotify as an easy 4th feed, "what am I sharing" receipt polish. Deferred: Realtime, multiplayer/other-humans, video loop card.

---

## 9. Risks / open decisions (need a human/god call)

1. **Code-signing & notarization (desktop app).** Shipping a macOS menubar app that requests app-switch (and later Accessibility) permission requires an Apple Developer account ($99/yr), signing, and notarization or users hit Gatekeeper; Windows wants an Authenticode cert too. **Decision needed:** budget + who owns the signing identity. This is the single biggest non-code blocker for Phase 3.
2. **Accessibility permission for window titles.** v1 avoids it (app-switch only). Enabling domain-level disambiguation later means prompting for Accessibility — a scary permission. **Decision:** ship v1 without it; treat title-mode as a distinct opt-in later, or never.
3. **Privacy / consent model for the public card.** Default-private is decided; open question is the *granularity* of the public allowlist (per-category vs per-source vs per-tool) and whether a coarse recency bucket is coarse enough to be non-tracking. **Decision:** confirm the `redactForPublic` contract in §5 is acceptable before anything goes public.
4. **RLS posture.** §6 recommends keeping RLS closed (poll). Confirm we're comfortable staying service-role-read for v1; opening read policies is a deliberate security change (per 0004) if/when Realtime is wanted.
5. **Breadth strategy — desktop classification table ownership.** The app→category map is the product's "coverage." Who curates it, and do we ship the MCP breadth play (from stage-1 doc) as a 5th feed path? **Decision:** scope the initial mapping list.
6. **Asset ceiling.** Everything is procedural canvas (no pipeline — a strength). Self-assembling furniture multiplies the sprite count; at some point richness needs a tilemap/spritesheet. **Decision:** accept procedural ceiling for v1, flag the spritesheet migration as a known future cost.
7. **Handle namespace + multi-tenancy.** Public `[handle]` vs internal space `slug`/ingest token needs a clean mapping (one space = one office = one handle?). Minor but must be decided before public URLs ship in Phase 4.

---

## Appendix — key TS/schema sketch (illustrative, not to be committed as source)

```ts
// canonical activity event (envelope shared by every source)
interface ActivityEvent {
  actor: { id: string; name: string; role: string; source: string };
  source: "claude-code" | "desktop" | "github";
  tool: string;                 // SHAPE, plaintext
  category: "coding"|"design"|"writing"|"call"|"music"|"review"|"browsing"|"focus"|"agent";
  object?: string | null;       // SHAPE hint, plaintext
  status: "idle"|"working"|"blocked"|"done";
  occurredAt: string;           // ISO; ordered by occurred_at (0005)
  detail?: string;              // CONTENT — encrypted at rest, never public
}

// public read is shape-only — detail/current_task never decrypted here
interface PublicOfficeState {
  objects: { category: string; object: string; count: number }[];
  actors:  { status: string; category: string; recency: "active"|"recently"|"idle" }[];
  generatedAt: string;
}
```
