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

## 6. Open questions for the owner (the taste calls)

1. **Character model — confirm Hybrid (C)?** Specifically: do you want **recent-stack stand-ins** (ghosted "you were just here" presence, the breadth flex) or is that too busy / does it read as "phantom clones"? If you'd rather keep it strictly one-body-one-you, we ship **A** (this design degrades to A for free).
2. **Is "you" ever a costumed mascot, or always a neutral human?** The costume-per-category read (hoodie for coding, apron for design) is what makes the *body* legible out of zone. But it means "you" visibly change outfits as you switch tools. Cute and expressive — or do you want *you* to stay one consistent look and let only the **station/prop** carry the category? (This is the single biggest taste fork in §2.)
3. **Music as prop-only vs a body.** I've proposed music = spinning record player with **no person** (it's a vibe, not a worker, and it never eats a desk). Agree, or do you want a little DJ/listener body when Spotify's on?
4. **Distinctiveness ceiling — category-level is enough for v1?** Figma and Sketch both read as "design"; VS Code and a terminal both as "coding." Going per-*tool* means the spritesheet migration (§2). Confirm category-level distinctiveness is the v1 target (recommended) so we stay procedural.
5. **Palette discipline.** I reused the existing category accent colors (green/violet/pink/sky/amber/coral) so it stays on-brand with the current room. Any category whose color you'd change for stronger contrast on the card?

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
