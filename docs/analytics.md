# Analytics

Mumbl uses opt-in Umami analytics for early product learning. Analytics must stay aggregate and privacy-safe: the product should help us understand whether people find and try Mumbl, not make hesitation, lurking, or anonymous room behavior observable.

## What We Track

- Public page views for `/`, `/create`, and `/explore`.
- Coarse public-page scroll milestones at 50% and 90%.
- Major public CTAs such as waitlist anchors, demo entry, create-room entry, email, Twitter, and Calendly links.
- Explicit conversion outcomes: waitlist submitted or failed, space created or failed.
- Explicit room actions that already change product state: share copied, first-post prompt dismissed, post created, reaction toggled, side quest card actions, and public-space setting saved.
- Sanitized campaign context on explicit conversion-style events only: `utm_source`, `utm_medium`, `utm_campaign`, and external referrer origin.

## What We Do Not Track

- Room opens, visitors, members, joins, lurkers, presence, tab views, reads, or load-older pagination.
- Room slug, room name, post content, display name, email, session token, creator token, side quest message text, or any user-entered private text.
- Draft starts, typing, field focus, compose abandonment, scroll replay, click maps, session replay, or per-person journeys.
- IP-derived, user-agent-derived, or fingerprint-style identifiers.

Room URLs are masked as `/r/[space]` before any event is sent. Non-public paths are collapsed to `/app` unless they match the room mask.

## Environment Setup

Analytics is off unless both the feature flag and website id are present:

```bash
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_UMAMI_SRC=https://your-umami.example/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=your-website-id
```

Recommended environment posture:

- local: disabled
- preview: optional
- production: enabled

The Umami script is loaded with auto tracking disabled. Page views and events are sent through `src/lib/analytics.js` so the privacy filters stay centralized.

## Early Learning Dashboard

Use Umami to watch aggregate questions, not people:

- Are people reaching the landing page from useful sources?
- Which public CTAs are getting clicked?
- Do visitors try the demo before joining the waitlist or creating a room?
- Which create-page vibes are selected before successful space creation?
- Are explicit room actions happening after creation: share copied, first post, reactions?

Do not build dashboards that answer who opened a room, how many people lurked, what someone almost typed, or whether a specific space had silent visitors. For Mumbl, posts and reactions are the signal of a living room.
