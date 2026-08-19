# How to see the demo office live

## Quick start (30 seconds)

```bash
npm run dev
# open http://127.0.0.1:3000/office/demo
```

Wait ~3 seconds for the Phaser canvas to load ("opening the office…" disappears). You will see a walkable pixel office with 9 actors, each at a distinct activity station.

---

## What you should see at /office/demo

**There are no desks.** Each kind of work is a small **physical scene** ("the
studio") that the actor stands or sits *inside*, so the room reads as different
_kinds of doing_ happening in their own corners — a designer painting at an easel,
a DJ spinning a turntable, a reviewer in front of a detective corkboard — not nine
people parked behind identical monitors. Only **coding** keeps a screen: a compact
standing code kiosk in the corner.

| Actor    | Tool     | Category | Physical vignette (the actor is *in* it)                              |
|----------|----------|----------|----------------------------------------------------------------------|
| Marisol  | vscode   | coding   | **Code kiosk** — a standing pedestal with a dark IDE screen, code lines, blinking caret, scan line (the one screen station) |
| Riku     | terminal | coding   | **Server rack** — a tall rack of blinking machine units + cables, floor console, network blip; the actor stands tending it |
| Petra    | figma    | design   | **Artist's easel** — a standing easel with a bright canvas + palette on a stool, drop cloth with paint splashes; the actor paints |
| Theo     | zoom     | call     | **Huddle** — a round rug + presentation screen on a stand with participant camera tiles + ON AIR bar; the actor stands presenting |
| Yuki     | spotify  | music    | **DJ turntables** — twin spinning decks on a console + a tall speaker stack + VU strip + rising notes; the actor spins |
| Clem     | notion   | writing  | **Reading armchair** — a wing-back chair, gooseneck floor lamp, side table + book stack; the actor sits writing in a notebook |
| Soren    | chrome   | browsing | **Lounge perch** — a beanbag + pouffe + potted palm; the actor reclines with a tablet showing a web feed |
| Anya     | github   | review   | **Corkboard wall** — a detective pinboard of PR tickets with red string + ✓/✗ stamps + a spotlight; the actor stands inspecting |
| Felix    | other    | other    | **Zen corner** — a tatami mat, floor cushion, trickling stone fountain, tall plants; the actor sits cross-legged |

Each scene still shows the category badge glyph (VS, >_, Fi, Zm, Sp, N, Ch, PR, •)
above the actor. The scenes are the furniture — there is no shared desk anywhere.

## Controls

- **WASD** or arrow keys — move your player character
- **Walk up to a desk + press E** — open the side panel (name, role, task, event log)
- **Click an agent** — also opens the panel
- **T** — toggle the terminal overlay (scrolling event log for all actors)
- **"skip to the list"** button — dismiss the canvas, show the plain-text fallback

---

## Automated screenshot

Requires the dev server running at `127.0.0.1:3000` and Playwright installed:

```bash
npx playwright install chromium   # one-time
node scripts/screenshot-office-demo.mjs
# → outputs/office-screens/live-demo-office.png           (the studio)
# → outputs/office-screens/live-demo-office-stations.png  (walkable pan)
```

The script uses **headed Chromium** on macOS (no GPU flags needed), waits for the
Phaser canvas to initialize, seats the actors in their vignettes, then screenshots
the canvas at native 960×600. It then walks the player to prove the scene is a real
navigable room and takes a second framed shot. 0 console errors expected.

---

## /office/demo/recap — status

`/office/demo/recap` now returns **200** (a backend agent added the recap page). The
recap directory's `opengraph-image.jsx` also renders the shareable OG card at:

```
http://127.0.0.1:3000/office/demo/recap/opengraph-image
```

A browseable recap page (`page.jsx`) is owned by the backend agent and not yet created. When it exists, the URL will be `http://127.0.0.1:3000/office/demo/recap`.

---

## Production URLs (once deployed)

- Live office: `https://mumbl.so/office/demo`
- Recap OG card: `https://mumbl.so/office/demo/recap/opengraph-image`
