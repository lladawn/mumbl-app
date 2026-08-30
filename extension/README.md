# mumbl pixel world — SPIKE

**Status: spike, not a product.** Built to answer one question:

> Does a pixelified arbitrary website actually feel good, or does it just feel
> broken?

## The answer

**Mostly good, with one failure mode that is structural and one that is a bug I
already fixed.** The cheap version — a CSS re-skin — is enough. It is genuinely
charming on text and layout, and it does not need the expensive ideas (canvas
overlay, walkable room) to land.

Per site, on real sites, not a test page built to flatter it:

| Site | Verdict |
| --- | --- |
| **Wikipedia** (text-heavy) | **Good.** The best case. Legible, coherent, real charm. Contrast measurably *improved* (5 low-contrast text nodes → 1). |
| **GitHub** (app-like) | **Good, structurally.** Dense layout survives intact. |
| **Vercel** (already dark) | **Weakest.** A dark site half-converts: ground goes light, but elements carrying their own dark background stay, so a few controls end up dark-on-dark. Measured: 0 → 3 failing nodes. Localised, not systemic. |
| **Unsplash** (image-heavy) | **Was broken, now good** — see the image finding below. |
| **mumbl.wtf** (ours) | **Near no-op.** The site already *is* this look. Confirms the extension and the site are one aesthetic, and that our own page is worthless as a demo of it. |

## The finding that matters: leave photographs alone

The first version ran every image through an SVG posterise filter — the only
stylising that works cross-origin, since it never reads pixels back and so
cannot taint a canvas. On a photo gallery it was a **disaster**: six-step
banding crushed dark photographs into near-black rectangles. A wallpaper site
where you cannot see any wallpaper is not a vibe, it is a bug.

Removing that one rule took the image-heavy case from broken to good. The pixel
chrome around the images — hard borders, paper ground, mono type, gold controls
— carries the transformation on its own. **The frame does the work, not the
picture.**

## The structural limit: you cannot pixelate most images

Real pixelation means drawing an image small and blowing it back up, which means
reading it back off a canvas — and reading back a cross-origin image throws
`SecurityError`. Most images on most sites are cross-origin and served without
CORS headers.

Measured across the five sites: **23 of 138 images (17%)** could be truly
pixelated. GitHub was **0 of 14**.

No amount of CSS fixes this. The options are: accept that photos stay
un-pixelated (what this build does), proxy every image through a server we run
(cost, latency, and we become a party to everyone's browsing), or rewrite
requests via `declarativeNetRequest` to add CORS headers, which is both fragile
and a security smell. **Accepting it is the right answer**, and it is fine,
because of the finding above.

## Other things that break

- **Inline SVG icons.** Bordering them turned every icon on GitHub into a
  meaningless box. Fixed: icons are left untouched. Worth knowing that `svg` on
  a real site is almost always an icon, not a picture.
- **Buttons that are really layout.** Padding on `button` pushed Wikipedia's
  sidebar collapse toggles over their labels ("History" → "story"). Any
  re-skin that changes box metrics will do this somewhere.
- **Logos** posterise or flatten into mud. Wikipedia's wordmark is unreadable.

## Cost

Negligible. Re-applying the class and forcing a full reflow: **7–39 ms** across
the five sites. The image pass is the only real work and it is bounded by image
count.

## Reversibility

Clean. Everything is one class on `<html>` plus nodes we own. Removing the class
restores the page; images that were swapped keep their original `src` and
`srcset` in data attributes and are restored on toggle off. No page markup or
inline styles are edited.

## Verdict: product or demo?

**A product, but a small one — and not the one that was described.**

The pitch was "the transformation feeling follows you around". What actually
works is narrower and better: *a reading skin*. It is genuinely nice on articles,
docs and text-heavy pages, and it is the kind of thing someone leaves on. It is
not a walkable pixel world and should not be sold as one.

What I would not do: ship it as a novelty toggle for "any website". On a
photo-led or video-led site there is nothing for it to do that does not make the
page worse, and the honest version of the feature would exclude those pages
rather than pretend.

The economics support shipping it — Chrome is a one-time ~$5 fee against the
Mac helper's $99/year, and Firefox is free — but Chrome has a real review
process where direct Mac distribution had none, and `<all_urls>` plus `scripting`
is exactly the permission set reviewers scrutinise. That review is the actual
cost, not the fee.

## Running it

Unpacked, no account needed:

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick
   this directory.
2. Click the toolbar button to toggle the transform on the current tab.

**Spike affordance to remove before this ships:** `content.js` also applies on
load if the URL contains `#mumbl-px`. That exists because a headless browser
cannot click a toolbar button and this had to be captured across five sites.

## Harness notes, so nobody re-derives them

- **Extensions do not load in Playwright headless.** Measured: zero service
  workers, nothing injected. Headed works. Park the window offscreen
  (`--window-position=4000,4000`) — `page.screenshot` captures via the
  compositor, not the display, so it still works.
- **Navigating an open page to `url#hash` is a same-document navigation.** No
  reload, so a content script never re-runs. The "after" capture needs a fresh
  page carrying the hash from the first byte. This cost one entire failed run
  that reported `applied=false` on all five sites.
