# Office Visual Design — making tools read as distinct characters / stations

_Design proposal, 2026-08-19. Owner: Pam (product/visual design). Branch `feat/office-sim`._
_This is a **decision doc + mockups**, not a build. One small, clearly-marked proof-of-concept ships alongside it (see §5, Phase 1) so the recommendation is tangible in the real engine._

Reference ground truth (read before this doc): `public/office/office-scene.js` (the live engine — `makePerson`, `seatAgent`, `CATEGORY_BADGE`, `ZONES`, `DESKS`, the floor/furniture helpers), `desktop/src-tauri/src/catalog.rs` (the category vocabulary the data actually emits), `docs/office-sim-architecture-spike.md` §4 (tool→object mapping), `app/office/[slug]/opengraph-image.jsx` (the shareable card), `docs/mumbl-mission.md` (voice).

---

## 0. The problem in one paragraph

Every seated actor today is a generic `makePerson` sprite (14×20 procedural pixel body) plus a tiny 26×16 corner badge (`CATEGORY_BADGE`: `</>`, `PR`, `◑`, `☎`, `♪`, `✎`). A coder, a designer, someone on a Zoom call, and someone playing Spotify all render as **the same person at the same desk** — only a 9px glyph tells them apart, and you have to walk up and squint to read it. The office is therefore not legible at a glance and not a "this is my stack" flex. We want **each tool/category to read as a visually distinct character-at-a-station** so a stranger parses the room in ~2 seconds and the owner wants to post it.

**Design constraints that are non-negotiable (from the engine + privacy posture):**
- Everything is **procedural canvas pixel art**. No image assets, no spritesheet today. New looks must be expressible as parameters to `makePerson` / new small draw functions, OR we explicitly propose a spritesheet and price it (see §2, "asset ceiling").
- Design only for the **fixed category vocabulary** the pipeline emits: `coding | design | call | music | writing | browsing | review | focus | agent` (+ `other`→`focus`). Not for individual apps — Figma and Sketch both arrive as `design`; VS Code and a terminal both arrive as `coding`.
- Must stay legible at **~42–60px on screen** (sprite is 14×20 at scale 3) **and** in the **Satori-rendered OG card** (positioned `<div>` rects, no canvas, no tweens — see `personRects`/`Station` in `opengraph-image.jsx`). Idle animations are canvas-only; the card must read from static shape/color/prop alone.
- The privacy contract holds: only SHAPE (`tool`/`category`/`object`/`status`) is renderable/shareable. Nothing here decrypts task strings.

---

## 1. Character model — 3 options + recommendation

The core taste question: **when I have five tools lit, is that five little people, or one me wearing five hats, or something in between?** This decides identity, the flex, and how teams scale.

### Option A — One "you" avatar that moves between tool ZONES

Your single avatar walks to the zone for whatever you're doing now; the zone (desk/table/booth) and your costume/prop change per category. The room has fixed stations; only you (and teammates) are people.

```
   ┌ CODING ────┐   ┌ DESIGN ─────┐   ┌ CALL ───────┐
   │  [|monitor|]│   │ ◲ mood-wall │   │  ☎  booth   │
   │   ___       │   │  ___        │   │             │
   │  ( •_• )  ← │   │ ( design )  │   │             │
   │  /coder/    │   │             │   │             │
   └─────────────┘   └─────────────┘   └─────────────┘
        ▲ you are here now (walked over from design)
```

- **Identity coherence:** highest. There is exactly one you. Costume change reads as "I switched contexts," which is literally true.
- **Breadth-of-stack flex:** weakest. At any instant the card shows one station lit — your day's *range* is invisible. You'd need a history strip to show "today I touched 5 tools," which the ephemeral posture (§ privacy, TTL 15 min) actively fights.
- **Team scaling:** clean — N humans = N avatars, each at their current zone.
- **IP risk:** none.
- **Engine cost:** low. Zones already exist (`ZONES`); costume is `outfit`/`accessory`/`accent` knobs on `makePerson`; movement is the existing tween.

### Option B — Each tool = its own distinct character/mascot at its station

Every category is personified as its own recurring character (a "Coder," a "Designer," a "DJ," a "Caller"…) permanently manning its station. You don't appear as a mover; the room *is* the cast.

```
  ┌ bullpen ──────────────────────────────────────────┐
  │  </>Coder     ◑Designer    ♪DJ       ☎Caller       │
  │  (goggles)    (beret)      (cans)    (headset)     │
  │  [|term|]     [◲board]     [◉vinyl]  [☎booth]      │
  └────────────────────────────────────────────────────┘
```

- **Identity coherence:** weakest — "which one is me?" Your presence is diffused across mascots; two teammates both coding collapse into one Coder or need dedup.
- **Breadth-of-stack flex:** strongest *for the room* — every lit tool is a distinct body, so a busy stack is visually loud and postable. But it's the *room's* flex, not *yours*.
- **Team scaling:** bad. Characters key on category, not person; you lose "who is doing what." Re-introducing people means B collapses toward C anyway.
- **IP risk:** real. Bespoke recurring mascots per tool drift toward brand-mascot territory (a Spotify-green DJ, a Figma-purple designer) — exactly the "avoid brand-mascot IP issues" trap. We'd have to keep them generic, which erodes the distinctiveness B is supposed to buy.
- **Engine cost:** high — N bespoke character designs, and the "self-assembly = office is a fingerprint" story from the spike weakens (rooms converge on the same cast).

### Option C — Hybrid (RECOMMENDED)

**You = one avatar at your current station.** Recently-used tools **leave a lit station with an idle presence** (a costumed "stand-in" / warm seat / running prop) so the room reflects your whole recent stack even though you're only in one place. **Teammates and AI agents are their own avatars** (keyed on `external_id`, stable seat/face — already how `seatAgent` + the `PALETTES` hash work).

```
  ┌ your recent stack (last ~15 min, TTL-bounded) ───────────────┐
  │                                                              │
  │  CODING          DESIGN          CALL           MUSIC        │
  │  [|▓monitor|]    [◲ mood-wall]   [☎ booth]      [◉ vinyl]    │
  │   ( •_• )         (·costume·)     (empty,        (·spinning· │
  │   YOU  ← here      warm/idle      lights on)      no body)   │
  │   working          recently                       playing    │
  │                                                              │
  │  ── teammates ───────────────────────────────────────────   │
  │  ( ˘◡˘ )Dave      ( •ᴗ• )Mai      [claude]agent-7           │
  │  coding           design          agent                      │
  └──────────────────────────────────────────────────────────────┘
```

Presence tiers per station:
- **Live-you** — full avatar, bob animation, active idle-anim on the prop. One at a time.
- **Recently-you** — station stays lit but dimmed; a **costumed stand-in at reduced alpha** (or just the prop running, no body) marks "you were just here." This is what shows breadth without lying about where you are.
- **Prop-only** — for ambient tools (music), the record player spins with **no body** at all. Music isn't a person; it's a vibe in the room.
- **Teammate/agent** — own avatar, own stable seat + face. Unchanged from today.

- **Identity coherence:** high. Exactly one live-you; stand-ins are visibly dimmer/ghosted so they never read as separate people.
- **Breadth-of-stack flex:** strong. The card shows *every station you touched recently*, lit — a genuine "here's my day / my stack" fingerprint, which is the whole shareable pitch (spike §5).
- **Team scaling:** clean — teammates and agents are already distinct avatars; C only adds the recent-stack layer on top of the existing cast model.
- **IP risk:** low — stations are generic furniture + costume, not per-brand mascots. Distinctiveness comes from *zone + prop + palette*, which reads as "a design corner" not "the Figma character."
- **Engine cost:** medium, and **incremental** — Phase 1 is literally today's engine with richer per-category desks; the recent-stack "stand-in" layer is a later, additive tier.

### Recommendation: **Option C (Hybrid).**

It's the only one that satisfies all four criteria at once: it keeps a coherent single "you" (A's strength), delivers the breadth-of-stack flex that makes the card postable (B's strength) without B's identity-diffusion or IP risk, and it drops straight onto the existing `seatAgent`/`external_id`/`PALETTES` machinery so teammates and Claude-Code agents keep working unchanged. It also honors the mission's soul — the office is *your day, with people in it*, not a mascot lineup. **A** is the graceful degradation if the recent-stack tier proves noisy (just don't render stand-ins → you're left with A). **B** is rejected: it fights identity and IP.

The rest of this doc designs the **visual vocabulary** that C needs — and every piece of it is equally usable under A, so choosing A later costs nothing already built.

---

## 1.5. SHIPPED (branch `feat/office-sim`) — per-app + per-category rendering

The full vocabulary below is now **live in the engine** (`public/office/office-scene.js`) and mirrored on the OG card (`app/office/[slug]/opengraph-image.jsx`), built to the locked owner decisions:

1. **Hybrid-C** cast model (teammates/agents already distinct avatars; recent-stack stand-ins deferred — see data note below).
2. **Core identity stays constant per actor** — hair/skin/build/outfit come from `PALETTES`/`external_id` and never change. The tool is signalled by a **light accessory + brand accent** on the body + the **desk station** (screen art + prop) + the **badge glyph**. No full outfit swaps.
3. **Render the SPECIFIC APP first** (owner direction, supersedes the earlier "category-level only" call). The ingest `tool` field already carries the app id (from `desktop/src-tauri/src/catalog.rs`), so resolution is **`tool → category → plain`**:
   - `TOOL_LOOK[tool]` gives the app's brand **accent** + a short **badge glyph** (`VS`, `Fi`, `Zm`, `#`, `>_`, `N`…) + its **screen painter** + a **category fallback** (station/zone).
   - `TOOL_SCREEN[key]` paints a **recognizable procedural monitor**: VS Code (dark IDE, blue sidebar, colored code lines), Terminal (black + green prompt), Figma (light canvas + 4-color blocks), Zoom (blue camera tiles), Chrome (white page + 4-color ring), Slack (aubergine sidebar + hash colors), Notion (clean doc + mono `N`).
   - Unknown/uncatalogued apps fall back to their **category** station; no tool and no category → today's plain seated look (no regression).

**Apps covered** (every `tool` id `catalog.rs` emits): `vscode, cursor, xcode, intellij, pycharm, zed, sublime, terminal, iterm, ghostty, warp` (coding); `figma, sketch, photoshop, illustrator` (design); `zoom, teams, discord, meet` (call); `spotify, apple-music` (music); `notion, obsidian, notes, word` (writing); `chrome, safari, arc, firefox` (browsing); `slack` (chat→browsing zone); `other` (generic focus).

**Procedural-approximation note (asset ceiling):** these are **recognizable-at-a-glance approximations** (brand color + a stylized glyph/screen), NOT pixel-perfect logos. Pixel-perfect per-app **logos** would require the spritesheet/tilemap migration flagged in §2 (a real future cost + an IP review per-logo). Procedural approximation is the v1 posture — it keeps the "no asset pipeline" strength and stays clear of trademark-lockup issues.

**Verified:** `npm run build` passes; the OG card was rendered to PNG with a mixed stack (VS Code · Figma · Zoom · Spotify) and each app reads distinctly (dark IDE vs 4-color canvas vs camera tiles vs green music screen), headline is the specific-app stack. The live Phaser canvas can't be screenshotted headlessly in this environment (needs a browser/WebGL); the OG card shares the exact same rect/color vocabulary, so its render is a faithful proxy for legibility.

**Recent-stack stand-ins — DEFERRED, and why (data need):** the Hybrid-C "dimmed stand-in at recently-used stations" tier needs to know *which tools you used in the last N minutes*. Under privacy posture #2, `agent_events` are **ephemeral (~15 min TTL)** and there is no durable recent-tool history — so today the engine can only light the **current** station per actor. To ship stand-ins we need a small **shape-only recent-tools signal** (e.g. the last k distinct `tool`s per actor within a short rolling window, plaintext, no content). This is a strict subset of the day-recap aggregate specced in §7 — build that first and stand-ins fall out of it. Not blocking the core per-app work.

---

## 2. Tool → visual vocabulary (the design system)

The distinctiveness budget has four legible-at-42px levers, in priority order:

1. **Zone / room** — *where* the station sits (biggest at-a-glance signal; it's readable even when the sprite is tiny). Grounded in existing `ZONES`.
2. **Station / furniture + signature prop** — *what furniture* self-assembles and the one silhouette-defining object on it.
3. **Character costume** — `outfit` + `accessory` + `accent` knobs on `makePerson`, tuned per category so the *body* carries a hint even out of zone.
4. **Color + badge + idle micro-anim** — the accent color, the corner glyph (keep `CATEGORY_BADGE`), and one small motion that says "this station is alive."

Rule: **zone + prop must carry the read alone** (they survive the OG card, where there's no animation and the body is small). Costume and anim are reinforcement, not load-bearing.

### The table

| Category | Zone / room | Station + signature prop | Character costume (`makePerson` knobs) | Accent color | Badge glyph | Idle micro-anim (canvas only) |
|---|---|---|---|---|---|---|
| **coding** | agent bullpen / desk grid (`DESKS`) | Coding desk — **dark IDE monitor** (existing `deskUnit` monitor, force dark screen `0x1E262B` + neon code lines) | `outfit:"hoodie"`, `accessory:"headphones"`, `accent` neon-green `#9BD8B4` | `#9BD8B4` (green) | `</>` | cursor blink on screen; occasional 1px "keyclatter" jitter of the hands row |
| **review** | edge of the bullpen ("review corner") | Same coding desk + a **PR ticket** prop (small paper w/ ✓/✗ stub) pinned to the divider | `outfit:"collar"`, `accessory:"glasses"`, `accent` violet `#CFBBF0` | `#CFBBF0` (violet) | `PR` | ticket flips ✓↔… (approve/comment) every few s |
| **design** | new **design nook** (reuse lounge-tone `oat` carpet cell) | **Design table** — wide flat table + **mood-board wall** (2×3 color swatches), stylus | `outfit:"apron"`, `accessory:"scarf"`, `accent` pink `#F6BCD1` | `#F6BCD1` (pink) | `◑` | one swatch on the mood-wall cycles hue slowly |
| **call** | meeting room (`ZONES[0]`) | Meeting table (`meetingTable`) already there; **speech-bubble/headset** prop + "on air" door light | `accessory:"headphones"` (as headset), `outfit:"plain"`, `accent` sky `#BEE7F7` | `#BEE7F7` (sky) | `☎` | small green "● live" dot pulses; bubble tail blinks |
| **music** | lounge / rec room (`ZONES[1]`/`[4]`) | **Record player** on the coffee table — **spinning vinyl** + 2–3 rising ♪ notes. *Prop-only, no body by default.* | (no body; if body present: `accessory:"headphones"`, `accent` green) | `#9BD8B4` (green) | `♪` | vinyl rotates; notes float up and fade (reuse the `coffeeMachine` steam tween pattern) |
| **writing** | café / quiet nook (`ZONES[3]`) | **Writing desk** — warm lamp (`pendantLamp`), **notebook/manuscript page** prop, coffee cup | `outfit:"vest"`, `accessory:"glasses"`, `accent` amber `#F8DFA0` | `#F8DFA0` (amber) | `✎` | a line "writes" across the page (progress bar of ink) |
| **browsing** | reading nook / couch (lounge) | **Couch + reading tablet** (existing `couch`); floating tab/bookmark prop | `outfit:"stripes"`, `accessory:"none"`, `accent` coral `#F4B3A6` | `#F4B3A6` (coral) | `⌂` (or `≡`) | tablet screen scrolls (row of dashes shifts) |
| **focus / other** | generic desk, dim (fallback) | Plain desk, **dim monitor**, no signature prop — deliberately quiet | `outfit:"plain"`, `accessory:"none"`, neutral `accent` | `#C7D2CE` (idle grey) | `•` or none | slow breathing dim of the desk glow |
| **agent** (Claude Code) | agent bullpen | Seated agent — **no badge**, terminal-green screen, status pill + live log (the proven look) | existing agent look (glow on) | `#9BD8B4` | none | existing bob; terminal caret blink |

Notes on grounding + what's genuinely new:

- **Costume knobs already exist.** `outfit` ∈ {plain, hoodie, collar, stripes, overalls, vest, apron}, `accessory` ∈ {none, glasses, headphones, scarf, earrings, lanyard}, plus `accent`/`build`. The whole "character per category" read for the **body** is achievable **today with zero new draw code** — it's a mapping from `category → makePerson opts`. That mapping is the cheapest, highest-leverage first move (see Phase 1).
- **Badges already exist** (`CATEGORY_BADGE`) for coding/review/design/call/music/writing. New glyphs needed: `browsing` (`⌂`/`≡`), `focus` (`•`). Trivial (one object literal entry each).
- **Genuinely new procedural furniture** (small draw functions in the style of `deskUnit`/`coffeeMachine`/`arcade`): **design table + mood-wall**, **record player** (highest-value, it's the "why does theirs have a record player" hook from the spike), **writing desk lamp+page**, and a **PR-ticket prop**. Each is ~15–40 lines of `fillRect`s + one tween, same technique as the existing props. **No asset pipeline.**
- **Screen re-tint is free.** `deskUnit` already picks a screen color by seat index; making it pick by *category* (dark IDE vs pink design canvas vs terminal-green) is a one-line change and buys a lot of at-a-glance distinctiveness on the monitor alone.

**Asset-ceiling call (flagged, per spike §9.6):** all of the above stays procedural and is the right v1 posture. The moment we want *tool-level* distinctiveness (VS Code vs Xcode both being `coding` but looking different) or richer isometric furniture, procedural `fillRect` count balloons. **Proposed trigger for a spritesheet migration:** when we add a 4th signature furniture piece *or* want per-tool (not per-category) art. Until then, procedural wins (matches the engine's strength; keeps every office a self-assembled fingerprint). Ballpark if we ever do it: one 256×256 furniture/prop sheet + a tiny atlas loader in `office-scene.js` — **M**, deferred.

### Costume swatch mockups (14×20, category-tuned)

```
 coding(hoodie+cans)  design(apron+scarf)  writing(vest+specs)   call(headset)
      ___                   ___                  ___                  ___
    /█████\  ← cans       /▓▓▓▓▓\             /·····\  specs        /█████\ headset
    ( •_• )              ( •_• )              (⌐•_•)               ( •o• )
    │hood │ green        │apron│ pink         │vest │ amber        │plain│ sky
    │ </> │              │ ◑   │              │ ✎   │              │ ☎  │
    /█  █\               /█  █\               /█  █\               /█  █\
```

(All four are the *same* `makePerson` body with different `outfit`/`accessory`/`accent` — no new body code.)

---

## 3. Legibility + the shareable card

### The 2-second read (live office)

A stranger's eye lands in this order, and each layer must resolve before the next:
1. **Zones** — the room is already spatially divided (bullpen / lounge / meeting / café / rec / reception). "Cluster of desks = work; couch = browsing; table w/ chairs = a call." This is legible **before any sprite loads**.
2. **Signature prop silhouette** — spinning vinyl, mood-wall, warm lamp, dark IDE screen. One glance per station: *what kind of work.*
3. **Costume + accent color** — confirms the read and gives each body personality even when two are near.
4. **Badge glyph** — the precise label, for when you're up close (unchanged role from today).

So the design is **redundant on purpose**: zone → prop → color → glyph, coarse-to-fine. Even if the tiniest layer (the 9px glyph) is unreadable at a distance, the zone+prop already told you the category.

### The OG card (`app/office/[slug]/opengraph-image.jsx`)

The card is **Satori/positioned-divs, no canvas, no animation** — so it must carry the whole read from **static shape, color, and prop** (exactly the redundancy above, minus the anim layer — which is why anim is never load-bearing).

Current card renders up to 4 identical `Station`s (a monitor + desk + `Person`) spread across one room band, differing only by `LOOKS[i]` cosmetic palette and status pill. **Proposed upgrade (Phase 4, when public ships):** drive each `Station` from the actor's **category**, not its index —
- pick the `Person` costume from the category→knobs map (§2), so the coder wears a hoodie+cans, the designer an apron;
- swap the **screen color** per category (dark IDE / pink canvas / terminal green) — a one-prop change that reads instantly at card scale;
- add the **signature prop** as a few extra positioned divs per station (vinyl disc, mood-wall swatches, lamp) — Satori-friendly, they're just colored rects;
- headline shifts from status-only ("3 desks · 2 working") to **stack-shaped**: `"coding · design · on a call · spinning records"` — the literal "this is my stack" flex.

```
  ┌ mumbl ─────────────────────  mumbl.wtf/office/disha ┐
  │  disha's office, right now.                          │
  │  coding · design · on a call · records spinning      │
  │  ┌──────────────────────────────────────────────┐   │
  │  │ [▓IDE▓]   [◲board]   [☎table]   [◉vinyl]      │   │
  │  │ (hoodie)  (apron)    (headset)   ·no body·    │   │
  │  │ WORKING   WORKING    LIVE        PLAYING      │   │
  │  └──────────────────────────────────────────────┘   │
  └──────────────────────────────────────────────────────┘
```

The card stays **shape-only** — costume/prop/color/status are all SHAPE; nothing decrypts a task string. The upgrade is purely "render the shape we already have, more distinctly."

---

## 4. Scale / overflow

The engine already has real seams here; the design has to respect them:

- **Desk capacity is 6** (`DESKS` = 6 fixed stations). `deskFor` hashes `external_id` to a preferred desk, falls back to next-free, and `addAgent` **silently drops** when full (`if (!desk) return;` — "overflow is a later phase" per the code comment). That's a today-limit the visual design should not pretend away.
- **Zone-per-category seating (recommended).** Instead of one flat desk pool, bind categories to zones: coding/review/agent → bullpen desks; design → design nook; call → meeting room; music/browsing → lounge; writing → café. This makes "many tools" spread across *rooms* (naturally legible) instead of crowding one desk row. It also matches spike §4's self-assembly ("a design table exists iff something emits `design`").
- **Overflow rules when a zone fills:**
  - *Recent-stack stand-ins (C)* are **dimmed and non-interactive**, and are the **first to be culled** when a live actor needs the seat — the live cast always wins the limited desks.
  - *Ambient prop-only stations* (music) cost **no seat** — a spinning record player doesn't consume desk capacity, so music never crowds people out.
  - *Beyond capacity*, prefer **stacking count on a station** ("×3" on the coding desk) over spawning bodies with nowhere to sit — legible and cheap. (New: a small count pill, reuses the status-pill primitive.)
  - The **card caps at 4 stations** already; keep that, but choose the 4 by **breadth** (one per distinct category, most-recent-first) rather than first-4-actors, so the card shows *range* not repetition.
- **Empty office** is already handled well (offline → lights-low, no phantom bodies) — keep it; the recent-stack tier must also respect TTL (a stand-in older than the event TTL walks out).

---

## 5. Phased build plan (dependency-ordered)

**Phase 1 (S) — Make 2–3 categories visibly distinct in the real engine, reusing what exists.** _← smallest change; a proof-of-concept slice ships with this doc._
- **What:** add a `CATEGORY_LOOK` map (category → `makePerson` costume knobs) and category-drive two things that are already parameterized: the **seated actor's costume** and the **desk screen color**. Coder = hoodie+cans+green dark-IDE screen; designer = apron+scarf+pink canvas screen; caller = headset+sky. Zero new furniture, zero asset pipeline — pure mapping onto existing knobs.
- **Files:** `public/office/office-scene.js` only — `lookFor()` (merge category costume), `deskUnit`/`seatAgent` (screen tint by category), and one new `CATEGORY_LOOK` const near `CATEGORY_BADGE`.
- **Proof-of-concept in this PR:** a minimal, clearly-commented `CATEGORY_LOOK` + costume merge for **coding/design/call**, guarded so unknown categories fall back to today's look (no regression). `npm run build` must still pass. See the marked block in `office-scene.js`.
- **Size: S.**

**Phase 2 (S/M) — Signature props + new furniture for the top 3 self-assembling stations.**
- **What:** procedural **record player** (music — the highest-delight hook), **design table + mood-wall** (design), **writing desk lamp+page** (writing). Each a `deskUnit`-style draw fn + one idle tween. Add `browsing`/`focus` badge glyphs.
- **Files:** `public/office/office-scene.js` (new draw fns + wire into self-assembly), badge entries in `CATEGORY_BADGE`.
- **Size: S/M** (bounded by number of props; each ~15–40 lines).

**Phase 3 (M) — Zone-per-category seating + overflow.**
- **What:** bind categories to zones; replace the flat `DESKS` pool with per-zone seat lists; implement count-stacking + prop-only (no-seat) stations for music; cull rules.
- **Files:** `public/office/office-scene.js` (`ZONES`/`DESKS` → per-zone seats, `deskFor`, `addAgent` overflow), possibly the client state adapter that feeds `applyState`.
- **Size: M.**

**Phase 4 (M) — Recent-stack "stand-in" tier (the Hybrid-C flex) + card upgrade.**
- **What:** render dimmed stand-ins / prop-only for recently-active-but-not-current categories (TTL-bounded); upgrade the OG card to drive costume/screen/prop/headline from **category** (§3).
- **Files:** `public/office/office-scene.js` (presence tiers, alpha/dim), `app/office/[slug]/opengraph-image.jsx` (category-driven `Station`/`Person`/headline).
- **Size: M.** (Depends on 1–3; the card half can be done independently once §3's mapping exists.)

**Phase 5 (S) — Polish.** Per-tool nuance within a category if wanted (needs the spritesheet call from §2), motion tuning, reduced-motion fallbacks for all new tweens, teammate/agent avatar variety.

**Dependency order:** 1 → 2 → 3 → 4 → 5. Phase 1 stands alone and de-risks the whole direction with the cheapest possible change.

---

## 7. Day Recap — "Wrapped for your workday" (PROTOTYPE shipped)

A second shareable: not "my office right now" but **"my whole day."** One postable card summarizing which **apps** you used and roughly **how long**, in the office aesthetic, reusing the per-app vocabulary (brand accent + glyph). The "Spotify Wrapped for your workday" flex.

**Prototype:** `app/office/[slug]/recap/opengraph-image.jsx` — a real OG-image route rendering against **representative mock data** (so we have an image to react to). Layout: left column = headline (`disha's day.`) + the day line (`Aug 18 · 6 tools · 9h35 focused`) + stat chips (`focused`, `tools used`) + a **MOST TIME IN** spotlight; right column = a per-app **time chart** (brand-colored bars, glyph chips, durations right-aligned). Verified by rendering to PNG.

```
  ┌ mumbl ───────────────────────────────────────────────────────┐
  │  disha's day.                 WHERE THE DAY WENT               │
  │  Aug 18 · 6 tools · 9h35      [VS] VS Code   ████████████ 4h20 │
  │  ┌─────────┐ ┌─────────┐      [Sp] Spotify   ████████▁▁▁  3h10 │
  │  │ 9h35    │ │ 6       │      [Fi] Figma     █████▁▁▁▁▁▁  2h05 │
  │  │ focused │ │ tools   │      [Zm] Zoom      ████▁▁▁▁▁▁▁  1h40 │
  │  └─────────┘ └─────────┘      [# ] Slack     ██▁▁▁▁▁▁▁▁▁   55m │
  │  [VS] MOST TIME IN            [N ] Notion    █▁▁▁▁▁▁▁▁▁▁   35m │
  │       VS Code · 4h20                                          │
  │  mumbl.wtf/office/disha/recap                                 │
  └───────────────────────────────────────────────────────────────┘
```

**SHAPE-ONLY:** app names + durations only — never a window title, repo, doc name, or any content. Same boundary as the live card. "focused" excludes ambient apps (music/other).

### Data spec — the minimal durable aggregate the real version needs

**Reality:** posture #2 makes `agent_events` **ephemeral (~15 min TTL)**, so there is **no durable day history today**. The recap must NOT resurrect a full event log (that would regress posture #2). Instead it needs a tiny **per-day, per-app AGGREGATE** — shape-only, no content, no per-event rows:

```sql
-- daily_app_totals: one row per (space actor, day, app). Shape-only rollup — the
-- SUM of focused seconds, never the events themselves. Respects posture #2: this
-- is an aggregate, not a log; it carries no titles/URLs/tasks, only the `tool`
-- shape token + a duration + a coarse day.
create table daily_app_totals (
  space_id     uuid    not null,           -- tenant (existing agent_spaces)
  external_id  text    not null,           -- actor (existing)
  day          date    not null,           -- civil day in the space's tz
  tool         text    not null,           -- SHAPE token (vscode/figma/… ; 'other' for uncatalogued)
  category     text,                        -- SHAPE fallback grouping
  seconds      integer not null default 0,  -- summed focused seconds that day
  updated_at   timestamptz not null default now(),
  primary key (space_id, external_id, day, tool)
);
```

**How it fills (no new capture, no heavy storage):** the ingest path already receives `tool` + `occurredAt` heartbeats (~60s coalesced, per the spike). On each write, **increment** `daily_app_totals.seconds` for `(actor, today, tool)` by the dwell since the last heartbeat (clamped to a sane cap so a backgrounded app can't inflate it). That's a single upsert-add per heartbeat — O(1), bounded rows (≤ ~#apps/day/actor), and it's an **aggregate**, so nothing content-bearing is retained. TTL/retention: keep ~30–90 days of these rollups (they're tiny), or fewer — a taste/privacy call.

**Wiring the prototype to real data later (drop-in):** the route already isolates the data shape in `recapMock()` → `mockToRecap()`. Real version: replace `recapMock()` with a read that `SELECT tool, category, sum(seconds) … FROM daily_app_totals WHERE external_id=? AND day=? GROUP BY tool` (owner-scoped, service-role, like the office read), pass it through the same `mockToRecap()` (which already derives top-app / focused / counts), and render unchanged. Public/redacted recap = the same, since the aggregate is already shape-only. A weekly/monthly "Wrapped" is the same query over a wider `day` range.

**Bonus:** this same `daily_app_totals` (or a short rolling-window variant) is exactly the **recent-tools signal** the Hybrid-C stand-ins need (§1.5) — build the aggregate once, get both the recap and the stand-ins.

---

## 6. Open questions for the owner (the taste calls)

_(Q2/Q4 are now resolved by locked owner decisions — recorded in §1.5. Remaining calls:)_

1. **Recent-stack stand-ins — build now or later?** Needs the `daily_app_totals` aggregate (§7) since `agent_events` are ephemeral. Build the aggregate first (it also powers the recap), then stand-ins are cheap. Confirm you want the ghosted "you were just here" presence at all, vs strictly one-body-one-you.
2. **Brand-color fidelity vs the room's soft palette.** The per-app accents lean toward real brand hues (VS Code blue, Figma red/orange, Spotify green) for recognizability, but the office palette is deliberately soft/pastel. Do you want the app accents pulled toward the pastel family (more cohesive room, slightly less "instantly Spotify"), or kept punchy for recognizability (current)?
3. **Procedural approximation ceiling — good enough?** The app screens/glyphs are recognizable approximations, not logos (logos = spritesheet migration + per-logo IP review). Confirm approximations are the v1 bar.
4. **Recap cadence + what counts as "focused."** The recap prototype defines "focused" as non-ambient app time (music/other excluded). Agree? And is the shareable a **daily** recap, a **weekly** "Wrapped," or both?
5. **Recap retention window.** `daily_app_totals` is tiny; how many days do we keep (30/90/forever)? A privacy call, not a technical one.

---

## Appendix — category → look mapping (illustrative; the Phase-1 slice implements coding/design/call)

```js
// category → makePerson costume knobs + desk screen tint. SHAPE-only; drives the
// "distinct character per tool" read using knobs makePerson already supports.
const CATEGORY_LOOK = {
  coding:   { outfit: "hoodie", accessory: "headphones", accent: "#9BD8B4", screen: 0x1E262B },
  review:   { outfit: "collar", accessory: "glasses",    accent: "#CFBBF0", screen: 0x1E262B },
  design:   { outfit: "apron",  accessory: "scarf",      accent: "#F6BCD1", screen: 0xF6BCD1 },
  call:     { outfit: "plain",  accessory: "headphones", accent: "#BEE7F7", screen: 0xBEE7F7 },
  writing:  { outfit: "vest",   accessory: "glasses",    accent: "#F8DFA0", screen: 0xF8DFA0 },
  browsing: { outfit: "stripes",accessory: "none",       accent: "#F4B3A6", screen: 0xF4B3A6 },
  music:    { outfit: "plain",  accessory: "headphones", accent: "#9BD8B4", screen: null }, // usually prop-only
  focus:    { outfit: "plain",  accessory: "none",       accent: "#C7D2CE", screen: 0x9FB3BE },
  // agent + unknown → fall back to today's look (no regression)
};
```

---

## v2 — artistic set pieces

_Direction, 2026-08-20. Branch `feat/office-sim`._

**The founder's brief:** the office must literally EMBODY the promise — "a coding
desk appears because you're coding, a record player spins because Spotify's on, a
meeting room lights up because you're on a call. Nobody designs it — it just shows
up, shaped like your actual day." v1 made each activity *legible* (right screen,
right badge, a small prop). v1 still reads as **a person parked at a generic desk
with a badge**. v2's job is to make each activity its own **SET PIECE** — furniture
with character, its own MOOD and LIGHTING, and MOTION that says "this corner is
alive" — so the room feels inhabited and no two activities look alike.

### The elevation model — from "prop on a desk" to "set piece"

Every v1 station had one small marker sitting on the desk. A v2 set piece adds
**four things on top of that marker**, all procedural, all Satori-mirrorable for
the static levers:

1. **A signature piece of FURNITURE** bigger than a desk-prop — the object that
   gives the station its silhouette (a turntable console, a lit meeting screen, a
   multi-monitor rig, an easel + swatch tray). This is the at-a-glance read.
2. **MOOD LIGHTING** — a colored ambient glow ellipse under/around the station in
   the activity's key color (warm amber for music, cool sky for a call, terminal
   green for code, blush pink for design). This is what makes a corner "light up."
3. **ATMOSPHERE PROPS** — the small storytelling details (drifting notes, a tiled
   grid of call faces, a blinking "on air" bar, floating color chips) that give the
   scene life beyond the hero object.
4. **LAYERED MOTION** — not one tween but two-to-three, staggered, so the station
   breathes: a spin + a rise + a pulse, a caret blink + a scanning line + a glow
   throb. Motion is canvas-only and never load-bearing (the OG card carries the
   read from furniture + lighting + props alone).

### AMBIENT STATE model — idle -> ALIVE

Each station has two states, driven purely by whether the person is currently on
that activity (the engine already re-skins on `tool`/`category` change — v2 rides
that, adds NO reconcile logic):

- **idle** — the furniture is present but *dormant*: dimmed mood glow (~30% of
  ALIVE), motion at rest or very slow (a still turntable, a dark call screen, a
  screensaver-dim code rig). Signals "this station exists in your day but you're
  not here right now." (Used today for the current station whose actor is present
  but `idle`; the full recently-used stand-in tier is still deferred per §1.5.)
- **ALIVE** — the person is on it: mood glow at full strength, all motion running
  (vinyl spinning, notes rising, call grid lit + "on air" pulsing, code caret
  blinking + scan line sweeping, design swatches cycling). This is the delight
  moment — the station visibly *wakes up* when the activity starts.

On the OG card there is no motion, so idle/ALIVE is expressed by glow opacity and
the presence of the "live" atmosphere props (lit call grid, spinning-frozen vinyl
with notes, glowing screens). The card always renders the ALIVE composition since
a lit card is the postable artifact.

### The four HERO set pieces (implemented this pass)

| Activity | Furniture (silhouette) | Mood + lighting | Atmosphere props | Motion (canvas) |
|---|---|---|---|---|
| **MUSIC** (Spotify / Apple Music) | **Turntable console** — wide wood-grain cabinet, raised platter, thick vinyl disc with grooves, chrome tonearm + counterweight, a small VU/level strip | Warm amber-green glow pooling under the console; the record is the light source of the corner | 3–4 ♪/♫ notes drifting up on staggered arcs and fading; a bouncing EQ level meter | Vinyl disc **rotates continuously**; a spinning groove-glint orbits the label; notes rise + fade on stagger; EQ bars bounce |
| **CALL** (Zoom / Meet / Teams) | **Lit meeting screen** — a large wall-mounted display on a stand, framed bezel, tiled into a 2×2/2×3 grid of **participant camera tiles** (each a head-and-shoulders silhouette on a colored fill) | Cool sky-blue "room lights up" wash — a bright glow behind the screen so the whole nook reads as an ON-AIR room | A red **"● ON AIR" bar** lit above the screen; a speaker-active ring that jumps between tiles | "On air" dot **pulses**; the active-speaker highlight **hops** tile→tile; one tile's camera "breathes" (alpha) |
| **CODING** (VS Code / terminal / Cursor / GitHub) | **Multi-monitor code rig** — a main dark IDE monitor PLUS a second angled monitor and a small terminal slab, on a riser; syntax-colored code lines + a terminal prompt | Terminal-green glow spilling off the screens onto the desk (the "code-lit nook") | A blinking cursor caret; a compile/status LED; a stack of colored code-line runs (keyword/string/comment palette) | Caret **blinks**; a highlight line **scans** down the code (like an active cursor line); the green glow **throbs** softly |
| **DESIGN** (Figma / Sketch / PS / AI) | **Drafting station** — a tilted **easel/artboard** on a stand showing a composition-in-progress, plus a **swatch tray** of color chips and a stylus | Soft blush-pink studio glow; the artboard is bright like a lightbox | Floating color chips above the tray; a crop/selection frame on the artboard; a stylus | The artboard's accent block **cycles hue**; a selection frame **pulses**; one floating chip **drifts** |

### The other activities (v2 direction, lighter touch this pass)

These keep their v1 stations but inherit the **mood-glow + idle/ALIVE** treatment
so the whole room is consistent; full set-piece furniture is a fast follow.

- **review** — the coding rig, tinted violet, with the PR ticket promoted to a
  small **corkboard** (ticket + ✓/✗ stamps); glow violet. Motion: ticket stamp
  flips approve/comment.
- **writing** — warm **library nook**: desk lamp as the key light (amber pool),
  an open manuscript page, a coffee cup, a small stack of books. Motion: a line of
  ink "writes" across the page; lamp glow flickers faintly.
- **browsing** — **reading perch**: a propped tablet/laptop with a scrolling feed
  and a floating bookmark/tab; coral glow. Motion: feed rows scroll.
- **terminal** — treated as a coding sub-look: same rig but the main screen is the
  black terminal (green prompt) and the second monitor is dimmed; glow green.
- **focus / other** — deliberately the *quiet* corner: a plain desk, a single soft
  blue desk glow that slowly breathes, a coffee cup. The absence of a set piece is
  itself the read ("heads-down, nothing flashy").

### Constraints honored

- Procedural pixel art only — every set piece is `fillRect`/`fillEllipse`/`text`
  primitives, no assets, drawn in `STATION_DRAW` (live) + `STATION_PROP_RECTS`
  (card).
- Core "you" identity is untouched — hair/skin/build/outfit still come from
  `PALETTES`/`external_id`; v2 only enriches the *furniture and lighting around*
  the person, plus the existing light accessory/accent signal.
- OG-card safety: every card prop helper stays a **plain function returning an
  array of nodes** spread into a parent's children (never a component returning a
  bare array), and props are drawn AFTER the desk so they sit above it.
- No reconcile / data-layer changes: v2 lives entirely in the two draw layers.

---

## v3 — remaining activities + cohesion

_Direction, 2026-08-20. Branch `feat/office-sim`. Part A of the follow-up pass._

v2 shipped the four HERO set pieces (music, call, coding, design). v3 does two
things: (1) gives every remaining activity the same full set-piece treatment so
NOTHING reads as "a person at a generic desk" anymore, and (2) ties all the
stations into ONE cohesive room — "an office for their day," not a row of
disconnected desks. Guiding rule from the founder: **sensible, not vague** — each
station reads *unmistakably* as that activity. All five keep the v2 idle->ALIVE
ambient model (dim glow + slow/at-rest motion when idle; full glow + full motion
when the person is on it) and are implemented in BOTH the live scene
(`STATION_DRAW`, animated) and the OG card (`STATION_PROP_RECTS`, static).

### The five new set pieces

| Activity | Furniture (silhouette) | Mood + lighting | Atmosphere props | Motion (canvas) |
|---|---|---|---|---|
| **WRITING** (Notion / docs / Obsidian) | A warm **library nook** — an open two-page manuscript on a book cover, a **gooseneck desk lamp**, a stack of books | Amber lamp pool as the key light | The lamp is the light source; a mug; the book stack's colored spines | A line of ink **"writes"** across the right page; lamp glow breathes |
| **BROWSING** (Chrome / Safari / Arc) | A **reading perch** — a propped **laptop** showing a browser (chrome bar + tabs + article cards w/ thumbnails), a laptop base deck | Coral glow band | A floating **bookmark tab**; a mug; the article feed | The feed rows **scroll** up-and-back; glow breathes |
| **REVIEW** (PRs / GitHub review) | An **inspection station** — a **diff screen** (green +/red − columns) + a **corkboard of PR tickets** with ✓/✗ approval stamps + a **magnifier** on the desk | Violet glow | Three pinned tickets, mixed approve/reject stamps; the magnifier lens | The top ticket's **stamp flips** approve↔comment; glow breathes |
| **TERMINAL** (iTerm / Ghostty / Warp) | A **server / ops station** — a **rack** of stacked units with blinking status LEDs + a black **prompt slab** running a log | Green ops glow | Per-unit LEDs in green/amber/red; the live prompt | LEDs **blink** at staggered rates; a green **caret** blinks; a network **blip** travels rack→slab |
| **FOCUS / OTHER** (heads-down) | The **quiet nook** — deliberately no gadgets: a small **potted plant** + a coffee **mug**; the calm IS the read | A single soft-blue desk glow that slowly **breathes** | Plant greenery; a rising steam wisp from the mug | Glow breathes very slowly; steam rises + fades |

**Terminal gets its own station without touching seating/zones.** The ingest
`tool` for a terminal still resolves to `category:"coding"` (so its zone, seat, and
screen tint are unchanged, no per-tool regression), but a new optional
`TOOL_LOOK.station` (`"terminal"`) overrides *only which STATION_DRAW painter*
runs — so a terminal reads as an ops rack instead of the code nook. `setStationProp`
picks `app.station || category`; the OG card mirrors this via `cardLook().station`
threaded into `<Station station=… />`. Purely a rendering choice; no reconcile
logic touched.

### Cohesion — one room, not a row of desks

The office now reads as a single shared space, achieved entirely on the OG card's
room band (the live Phaser room was already one contiguous space):

- **Shared back wall + continuous window ribbon** — four evenly-spaced windows run
  the whole length of the wall (instead of two clustered), reading as one long
  room rather than separate booths.
- **One continuous floor plane** — the carpet spans the full band with a single
  shared warm **rug** under all four desks tying them to the same floor.
- **Consistent light direction** — a soft **top-left light wash** over both the
  wall and the floor (a `linear-gradient` at ~115°), so every station is lit from
  the same source; the per-station glows sit on top of this shared key light.
- **Shared ceiling detail** — a string-lights line with colored bulbs runs across
  the whole room, a unifying overhead element.
- **Cohesive palette** — every set piece's mood glow is drawn from the same soft
  pastel family (amber/sky/green/coral/violet/pink) already in `C`, so distinct
  activities still feel like one designed space.
- **Even station spacing** — the four slots are spread on an even ~270px pitch and
  pulled in from the edges (`[130, 400, 670, 940]`), which also **fixes the v2
  slot-4 turntable clipping**: the music console (which extends widest of all the
  set pieces) now sits fully inside the room band in every slot.

### Constraints honored (unchanged from v2)

Procedural pixel art only; core "you" identity untouched; per-tool/category
stations not regressed (terminal keeps its coding zone/seat/screen); OG props stay
plain array-returning functions spread into children (Satori-safe), drawn after
the desk; no pipeline/reconcile/data-layer changes.

## v4 — the room has people in it, not nine solitary workers

_Direction, 2026-08-27. Branch `feat/office-sim`._

**The note that started it:** a demo should look like a place where people are
HAVING A GOOD TIME, not a diorama of nine people each parked alone in their own
work vignette. v2/v3 made every *activity* into a set piece. What they could not
express is the thing an office actually feels like — that people are **with each
other**. Nine one-actor scenes, however beautiful, is nine people ignoring each
other in the same room.

### The unit changes: from vignette to SOCIAL SET-PIECE

A `VIGNETTE` is a one-actor scene painted at whichever booth its actor was given.
A `SOCIAL` set-piece is the inverse:

| | VIGNETTE | SOCIAL |
|---|---|---|
| position | wherever the actor's booth is | **fixed** in the room (the ping-pong table is where the ping-pong table is) |
| occupants | exactly one | **1–4**, and it must read correctly at every count |
| lifetime | as long as the actor is there | painted on first occupant, torn down on last |
| motion | the activity breathing (a vinyl spins) | a **conversation** — the ball crosses and the far paddle answers it |

That last row is the whole design. Two sprites standing near a table is a
diorama. What makes it a scene is that the motion is *causal between the two
people*: the ball arrives and the receiving player lunges for it; one laugh puff
lands and the other answers 2.1s later; a gesture lands across the table.
`paint()` returns one pose per seat plus a `beat(seatIndex, kind)` the piece
calls to make whoever is in that seat react — and it is a **no-op on an empty
seat**, so the rally still animates while only one player has walked over.

### The five pieces

| Piece | Seats | Furniture | Mood | Atmosphere | Motion (layered) |
|---|---|---|---|---|---|
| **Ping pong** (rec room) | 2 | the existing table + a chalk scoreboard on a stand | warm amber pool over the table, breathing | paddles held at each end; a score that actually ticks when a rally ends | ball crosses in x, **arcs in y on a faster tween** so it bounces; the receiving paddle swings to meet it; that player **lunges** — three motions, one rhythm |
| **Café** (café) | 2 | round table + plate of pastries (croissant, iced danish, crumbs) | warm café light on the tiles | a cup per seat, steam offset so they don't pulse in lockstep | speech puffs **alternate** between the two, and the talker bounces |
| **Sofa** (lounge) | 1 | the coral couch, mug on the arm, book face-down | soft lounge warmth | phone in hand, its light on their face | the sprite is **tilted 10°** — the read is that everyone else in the room is bolt upright; screen light breathes |
| **Arcade** (rec room) | 1 | the existing cabinet + a stool pulled up, scuffed mat | the cabinet's own violet spill, pulsing | — | screen flicker across the player's face; joystick knocking side to side |
| **Meeting room** | 4 | the meeting table, a laptop at each place, coffee pot | cool even "room is lit" wash | the **whiteboard fills in** as they talk, then wipes | discussion puffs alternate across the table; each speaker gestures |

Two engine details this pass needed:

- **`pose.depth`.** Draw order is derived from `y`, but sitting *in* a couch means
  being drawn in front of it — and the `y` that would earn that depth is a `y`
  that puts you on the floor. A pose can now name its own depth. This is what
  makes the sofa sprawl work.
- **`pingPong()` lost its ambient ball.** A table rallying with nobody at it reads
  as a bug. The ball belongs to the set-piece now and arrives with the players.

### The live office — same taste, only real signal

The same placement engine drives `/office/[handle]`; the demo is just a state
that happens to contain break/meeting actors. `planPlacement()` runs once per
state (grouping is a whole-cast decision, so it cannot be made one actor at a
time inside `addAgent`) and is ordered by a stable hash, so nobody swaps seats
between polls.

1. **Two or more people on a call at the same time sit together.** One caller is
   someone on a call at their desk and keeps their own call vignette — grouping
   one person is not a meeting. Two or more is a meeting, so they go to one
   table **and their booths are released**: leaving the vignettes behind would
   put back exactly the row of identical call corners that grouping was meant to
   remove.
2. **Idle / not-seen-in-5-minutes actors leave their work vignette** and drift to
   the lounge, café or rec room. Two or more at once pair up (ping pong, then the
   café table); one on their own gets somewhere you can plausibly be alone, never
   half a rally. Their **vignette stays behind, dormant** — the day they had is
   still on the floor, they are just not sitting in it. That is precisely what
   "away from the desk" looks like.
3. **Active actors do not move.**

Recency buckets are the server's (`agentPresence.recencyBucket`: <90s active,
<5min recently, else idle), duplicated client-side so the room and the API never
disagree about who is around.

### HONESTY RULE

On a live office the room may only depict what the payload supports: `status`,
`category`, and how long ago we last heard from someone. "Away from the desk" is
a faithful rendering of *idle* — it is not a claim that a real person is playing
table tennis; it is the room admitting nobody is in that chair, and the leisure
seat is where an absent person is drawn. The renderer never asserts a specific
leisure activity as a fact about a real person.

`break` and `meeting` are **demo-only categories**. Nothing in the ingest path
emits them; the sample office is labelled SAMPLE and may be richer. The demo's
break actors carry no tool and their `currentTask` never names an activity
("Away from the desk — back in a bit"), because the *renderer* decides which
leisure seat each one takes and the text has to stay true wherever they land.

### Constraints honored

Procedural pixel art only, no asset pipeline; core "you" identity untouched; no
work set-piece deleted or regressed (all nine still render, and the lone-caller
case keeps the call vignette); no ingest/DB/recap changes; `window.MumblOffice.__room`
is a debug handle for the capture harness only and nothing in the app reads it.
