# mumbl voice standard — direct, not vague

_2026-08-30. Author: Phyllis. Standard + audit, doc only — nothing here is shipped. See §3 for the explicit no-code boundary on the Slack-page rewrites._
_Human's instruction, verbatim: "be direct in language across all the products. no AI writings full of vagueness. it has to be what you get, or something exciting them."_

---

## 1. The standard (operational, not aspirational)

**Rule: name the concrete thing that happens, not what we believe about it.** "What you get," never "what we believe."

**The test — run every headline, eyebrow, and CTA through this:** if the line could appear on another company's site with the product name swapped in, and still make sense, it's vague. Cut it or replace it.
- Fails: "give your team a place to think out loud." (works for a journal, a wiki, a Slack channel, a therapist's business card)
- Passes: "open Figma and an easel appears." (true for exactly one product)

**No abstraction where a specific exists.** Not "your work, visualised" — the actual object. Not "a place to think out loud" — the actual command, the actual screen, the actual thing that shows up.

**Cut on sight, no exceptions without a specific reason:** seamlessly, effortlessly, powerful, intelligent, leverage, optimize, insights, actionable, empower, unlock, elevate, revolutionize, cutting-edge, "AI-powered," "next-level," any sentence that starts with "imagine a world where."

**Directness is not license to overclaim.** A concrete line is still a claim, and it still has to be true. If a vague line turns out to be vague *because the underlying truth is thin* — there's no crisp mechanic to point to — that's a product finding, not a copy fix, and it gets flagged separately (see §2.5), not papered over with a more confident-sounding sentence.

---

## 2. Audit: `src/components/HomeView.jsx` (the Slack page, also served at `/slack`)

Checked first whether each vague line was hiding thin truth. It isn't — in every case below, the concrete proof already exists elsewhere on the same page (the `demoRoomPosts` examples, the `memoryLayers` cards) and just never got promoted into the headline sitting above it. That's the actual pattern in this file: the summary lines are vague, the material one level down is already good.

### 2.1 — the hero headline
**Before:** `"save the why behind your team's work — one line from Slack."`
**After:** `"/mumbl in Slack — private the moment you type it, a team read if you publish it."`
Names the actual command and the actual two states a thought can be in, instead of the abstract "why." This headline also drives `app/slack/page.jsx`'s `openGraph.title` / `twitter.title` (`"mumbl for slack — save the why behind your team's work"`) — same fix needed in both places or the page and its own share links disagree.

### 2.2 — the human-layer section header
**Before:** `"the human layer of work starts with the context people already have."`
**After:** `"not just what shipped. why it shipped that way."`
The three cards directly under this header already say the concrete version (`"the reason behind the PR"`, `"the judgment behind the work"`) — the header just needs to stop being more abstract than its own children.

### 2.3 — the bottom CTA headline
**Before:** `"give your team a place to think out loud."`
**After:** `"the reasoning that usually dies in a DM. one /mumbl line saves it instead."`
Passes the swap test — "a DM" and "/mumbl" are specific to this product and this exact failure mode, not a generic promise.

### 2.4 — the footer tagline
**Before:** `"team memory that is actually human."`
**After:** `"the why behind the PR, not just the diff."`
Shortest fix of the four and the clearest case: "PR" and "diff" are real objects an engineer has open right now; "actually human" is a claim every competitor also makes about itself.

### 2.5 — found while auditing, flagged separately: a live accuracy issue, not a swagger issue
`HomeView.jsx` line 271 (the "also: mumbl office" card) still reads:
`"...and a pixel office assembles itself from the shape of your real day. One click makes a shareable card. Shape, not content: never a window title, URL, or keystroke."`
This is the retired "shape, not content" framing from the last card — app *identity* (Figma, VS Code) also leaves the machine and is visible to anyone with the link, "shape" understates that. `app/office/page.jsx` was already corrected for this (Stanley's in-flight rebuild labels the section "what leaves" instead); this second occurrence, on the Slack/home page's office teaser card, was missed. Proposed replacement, same honest posture as the /office fix:
**After:** `"...and a pixel office assembles itself from which apps you're in — Figma, VS Code, a Zoom call. Never what's inside them: no titles, no URLs, no keystrokes."`
This isn't a vagueness fix, it's a correctness one — flagging it because it's a live claim on the current production homepage, not a hypothetical.

---

## 3. `app/slack/page.jsx`

No copy of its own beyond the metadata block, which mirrors §2.1's headline (`openGraph.title` / `twitter.title` both read `"mumbl for slack — save the why behind your team's work"`). Same before/after as §2.1 applies here; listing it separately only because it's a second file that needs the same edit, not a second finding.

**Nothing in §2 or §3 is authorized to ship.** These are proposed replacement lines only — god's instruction was explicit that the Slack product pages have their own users and their own claims, and need a look before anything changes there. Treat this section as a menu, not a diff.

---

## 4. `/office` page

Already covered by the accepted `docs/office-swag-copy.md`, and Stanley's in-flight rebuild (`app/office/page.jsx`, in progress as of this writing) is already using it — including catching and fixing the same "shape, not content" issue found in §2.5, independently, on its own copy. No new findings here; worth a second pass once that rebuild lands, since it's mid-flight right now rather than final.

---

## 5. Standing picks (unchanged from the homepage card, restated for one place to look)

From `docs/homepage-copy.md`, still the recommendation:
- Sitewide metadata title: `"mumbl — your workday, rendered as a world"`
- Homepage hero: `"your workday, rendered as a world."` (matches the metadata title on purpose)
- `/office` hero (its own, not shared with the homepage): `"your apps just got bodies."`
