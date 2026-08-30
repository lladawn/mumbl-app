# Homepage + sitewide metadata — copy pass

_Copy only, 2026-08-30. Author: Phyllis. For Stanley's homepage rebuild (`src/components/AgentLandingView.jsx`) and `app/layout.jsx` metadata — no code here._
_The problem: the front door (`AgentLandingView.jsx`) and every social/search share (`app/layout.jsx` metadata) still sell the retired pitch — "your AI agents in a tiny pixel office." The product moved: it's your own workday as a world — apps become stations, Figma an easel, Spotify a turntable, ping pong in the rec room. Agents are real and stay, but as a supporting beat, not the headline. Human's word for this page: **futuristic**._

---

## 1. Sitewide metadata (`app/layout.jsx`) — this is the line that travels

This matters more than any on-page copy: it's what shows up in every social share, every search result, every link unfurl, regardless of what the page itself says.

**Title** (41 chars, budget ~60):
```
mumbl — your workday, rendered as a world
```
"Rendered" over "shown" or "turned into" on purpose — it's a real-time-engine word, does the futuristic lift on its own, and it's literally accurate (it is rendered, as pixel art, in a browser).

**Description** (149 chars, budget ~155):
```
Your apps become a pixel world you can walk around — Figma is an easel, Spotify a turntable, a call lights up the meeting room. Agents get desks too.
```
Leads with apps/world (the current, true pitch), stays concrete (three real objects, not adjectives), and agents land as the last clause — present, true, clearly not the point.

**Keywords** (drop the agent-observability stack — `agent observability`, `mcp`, `spatial workspace` all read as the old enterprise-tool pitch; keep `claude code` since agents are still real):
```
mumbl, pixel office, office sim, workday visualization, day recap,
wrapped for work, shareable pixel art, macOS menubar app, ai agents, claude code
```
`ai agents` and `claude code` are deliberately placed second-to-last and last — present for anyone searching that, not leading the list.

Use the same title/description for `openGraph.title`, `twitter.title`, and the OG image alt text — right now those three plus `metadata.title.default` all separately hardcode the old line; all four need to move together or the old pitch survives in whichever one gets missed.

---

## 2. Homepage hero line

**Pick: `your workday, rendered as a world.`**

Same line as the metadata title, and that's deliberate — the title is what gets clicked on, the hero is what confirms the click was right. They should match word-for-word or the visitor feels a bait-and-switch in the first second.

### Alternates
| Line | Angle |
|---|---|
| `step into your own workday.` | more direct invitation, less "world"-forward |
| `your day has a place now.` | quieter, present-tense-truth register, matches the recap voice doc |
| `watch your workday become a world.` | verb-first, more motion, slightly longer |

### Should one line serve both this page and `/office`?

No — argued deliberately, not a default. `your apps just got bodies.` is narrow and personal on purpose: it's the payoff line for someone who already knows the concept and is looking at their *own* stack. The homepage has a wider job — it has to also make room for teammates and agents existing in the same world, which "your apps just got bodies" quietly excludes (bodies, plural, reads as *your* apps, not *people*). `your workday, rendered as a world` covers both without naming either, which is exactly the breadth the front door needs. They're siblings, not duplicates — both follow the same shape (**your ⟨thing⟩ + becomes/renders as ⟨something alive⟩**), so moving from homepage → `/office` will feel like the same voice getting more specific, not a second pitch.

---

## 3. Section labels (1–3 words)

| Label | For |
|---|---|
| `your world` | hero eyebrow (replaces "office sim energy meets real work") |
| `how it feels` | the work-loop / how-it-works section |
| `the room` | reused deliberately from the `/office` doc — same word, same idea, both pages describe literally the same room |
| `agents, too` | the demoted agent beat — see §4 |
| `get in` | waitlist/CTA eyebrow — also reused from `/office` on purpose, one invite-door voice sitewide |

---

## 4. The supporting agent line

Keeps the real, true mechanic — ask for help, a collaborator walks in and takes a desk — present without letting it lead:

**`ask, and a collaborator walks in and takes a desk.`**

This is close to the existing beat copy on purpose (`"ask, and a collaborator arrives"` / the work-loop caption) — it doesn't need a rewrite, it needs a demotion: one line, one beat among several, not the eyebrow or the H1. If Stanley keeps the three-beat layout, this is beat two of three, not beat one — "agents you can see" and "your team and your agents in one place" (the other two existing beats) can stay as-is; they're already scoped as supporting detail, not the pitch.

---

## 5. What was deliberately left out

No new claim about what agents do beyond what's already shipped (they're scripted in the public demo today — the existing hero note "the interface is real, the agents are scripted" stays true and stays). No "AI-powered" or "intelligent" language anywhere — the futuristic feeling comes from the render/world/place vocabulary, not from AI buzzwords, which is a cheaper and less honest way to get the same feeling. Did not reuse "shape, not content" or "the shape" anywhere — that framing is retired (per god's note on the last card: app identity, not just shape, leaves the machine).

---

## 6. Recommendation

**Metadata title/description above — ship these first, independent of anything else.** They're the highest-leverage fix in this whole card: every existing share link and search result is actively working against the current product right now, and fixing four hardcoded strings (`title.default`, `openGraph.title`, `twitter.title`, description) is a five-minute change with the biggest reach of anything in either of my two docs so far.

**Hero: `your workday, rendered as a world.`** Matching it to the metadata title is the actual reasoning, more than the line itself — a visitor who clicks a search result or a shared link expecting one sentence and lands on a different one loses a beat of trust before they've read anything else. Keeping title and hero identical means the click is always correct.

**Keep `/office`'s hero (`your apps just got bodies.`) as its own, separate line** — argued in §2. Don't let one line try to do both jobs.
