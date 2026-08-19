# How to see the demo office live

## Quick start (30 seconds)

```bash
npm run dev
# open http://127.0.0.1:3000/office/demo
```

Wait ~3 seconds for the Phaser canvas to load ("opening the office…" disappears). You will see a walkable pixel office with 9 actors, each at a distinct activity station.

---

## What you should see at /office/demo

The room is a loose **scatter of work booths** — not a grid of desks. Each booth
rides its own soft coloured mat (mint / sky / blush / lilac / oat) at a staggered
position, with the warm plank floor flowing between them, so the office reads as
"different kinds of work happening in their own corners" rather than a cubicle
farm. The demo cast exercises every set-piece added in commits d11e8ea, a9823cf, 44f6318:

| Actor    | Tool       | Category | Set-piece                                                        |
|----------|------------|----------|------------------------------------------------------------------|
| Marisol  | vscode     | coding   | IDE nook — dual monitor, terminal slab, code-green glow, blinking caret |
| Riku     | terminal   | coding   | Server rack — blinking LEDs, ops prompt slab, network blip       |
| Petra    | figma      | design   | Design studio — tilted easel/artboard, swatch tray, floating chip |
| Theo     | zoom       | call     | Meeting room — wall display with 6 camera tiles, ON AIR bar, speaker-hop |
| Yuki     | spotify    | music    | Turntable console — vinyl, chrome tonearm, VU bars, rising notes  |
| Clem     | notion     | writing  | Library nook — gooseneck lamp, open manuscript, book stack, coffee |
| Soren    | chrome     | browsing | Reading perch — laptop, article cards, scrolling feed            |
| Anya     | github     | review   | Inspection station — diff screen, corkboard of PR tickets, magnifier |
| Felix    | other      | other    | Quiet nook — plant, mug, soft breathing desk glow (heads-down)   |

Each desk shows the category badge glyph (VS, >_, Fi, Zm, Sp, N, Ch, PR, •) and the tool-specific screen painter.

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
# → outputs/office-screens/live-demo-office.png
```

The script uses **headed Chromium** on macOS (no GPU flags needed), waits for the Phaser canvas to initialize, then screenshots the canvas element at native 960×600. 0 console errors expected.

---

## /office/demo/recap — status

There is **no page at `/office/demo/recap`** (returns 404). The recap directory contains only `opengraph-image.jsx` (an OG card, not a browseable page). The OG image itself renders at:

```
http://127.0.0.1:3000/office/demo/recap/opengraph-image
```

A browseable recap page (`page.jsx`) is owned by the backend agent and not yet created. When it exists, the URL will be `http://127.0.0.1:3000/office/demo/recap`.

---

## Production URLs (once deployed)

- Live office: `https://mumbl.so/office/demo`
- Recap OG card: `https://mumbl.so/office/demo/recap/opengraph-image`
