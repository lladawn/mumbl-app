# AGENTS.md

Guidance for Codex and other coding agents working in this repository.

## Project Context Routing

Read the narrowest context that can safely answer the request.

- Start with `README.md` for app shape, commands, and current capabilities.
- Read `docs/mumbl-product-context.md` and `docs/mumbl-extension-01.md` before product, UX, copy, or feature decisions. If they conflict, the extension wins.
- Read `docs/backend-plan.md` before changing API routes, Supabase schema, privacy behavior, posts, reactions, side quests, or heartbeats.
- Read `docs/environments.md` and `docs/release-checklist.md` before touching deployments, environment variables, migrations, CI, release flow, or production/staging behavior.
- Read `docs/scaling.md` before changing cron, heartbeat jobs, rate limits, room reads, cleanup work, or queue-like behavior.
- Read `docs/free-tier-compromises.md` before adding work that may affect Vercel Hobby, Supabase free-tier usage, cron frequency, storage, realtime, or paid services.

## Non-Negotiable Product Constraints

Mumbl is anonymous-first. Treat that as an architectural constraint, not a copy preference.

- No signup for v1. Users opt into identity; they do not opt out of it.
- Do not track members, visitors, joins, lurkers, room opens, or presence.
- The feed is the signal of whether a space is alive.
- Reaction counts are allowed because they measure resonance, not surveillance.
- Heartbeats are for the team, not management.
- Do not create creator-only analytics dashboards, manager views, or workplace survey patterns.
- Public spaces are opt-in and aggregate-only. Never expose individual public posts on `/explore`.
- Keep the voice human, warm, and engineer-native. Avoid HR, survey, wellness, or generic SaaS language.

Push back on requests that would make Mumbl feel like a feedback tool, surveillance product, or corporate dashboard. A feature should make the app feel more like a living team space where friendships can form.

## Agent Operating Rules

### Before Coding

- Inspect existing patterns before adding new ones.
- Turn vague requests into concrete success criteria before implementing.
- State assumptions when the request is ambiguous and the assumption affects behavior.
- Ask before choosing between materially different product behaviors, privacy models, or cost profiles.
- Push back if a request conflicts with anonymity, free-tier limits, environment safety, or Mumbl's voice.

### Simplicity First

- Prefer the smallest change that preserves the product promise.
- Use the existing stack: Next.js App Router, React, plain CSS, Supabase, and local helper modules.
- Do not add speculative settings, abstractions, dashboards, dependencies, or future-proofing.
- Add an abstraction only when it removes real duplication or clearly matches an established local pattern.
- Use TypeScript for new code. When touching JavaScript, migrate to TypeScript only when low-risk and scoped.
- Prefer explicit local types for API payloads, server responses, and component props as files are migrated.

### Surgical Changes

- Every changed line should map to the user request, privacy enforcement, verification, or cleanup directly caused by the change.
- Avoid unrelated refactors, formatting churn, comment rewrites, metadata changes, or nearby-code polishing.
- Mention unrelated dead code or risks; do not clean them up unless asked.
- Do not revert user changes unless explicitly asked.

### Server-Side Enforcement

- Preserve server-side enforcement for privacy, permissions, rate limits, and token hashing.
- Keep secrets server-only. `SUPABASE_SERVICE_ROLE_KEY`, `MUMBL_TOKEN_HASH_SECRET`, `MUMBL_SIDE_QUEST_ENCRYPTION_KEY`, and `CRON_SECRET` must never be exposed to client code.
- Use route handlers for privileged writes. Do not introduce broad client-side Supabase writes.
- Posts should never store session tokens.
- Anonymous posts must not store display names.
- Reaction dedupe should use a server-side hash of the browser session token.
- Creator-only actions should use creator tokens stored locally and verified server-side.
- Heartbeat generation should receive anonymised post data only, such as `{ type, content, reaction_count }`.
- Break-glass moderation data must not be queried by normal product views.
- Keep database constraints aligned with product promises wherever possible.

## Frontend And UX Rules

Build the usable product surface, not a marketing shell.

- Match the existing visual system and plain CSS approach.
- Design additions as part of the current page rhythm: spacing, density, typography, color, hierarchy, and interaction states.
- Design for desktop and mobile from the start. Core actions must remain discoverable and reachable on narrow screens.
- Teach new concepts through in-context affordances: clear labels, one-line job-to-be-done copy, useful empty states, and progressive disclosure near the action.
- Keep workflows direct and low-friction.
- Do not add broad Product/Features nav or explanatory pages unless discovery cannot be solved inside the actual workflow.
- Avoid explanatory in-app text about how features work unless the user needs it to proceed.
- Avoid dashboard-like analytics UI unless it is explicitly aggregate and product-approved.
- Use copy that sounds like a trusted engineer, not HR software.
- Keep responsive layouts stable. Text should not overflow buttons, cards, tabs, or sidebars.

## Stack, Commands, And Completion

This app uses Next.js App Router, React, plain CSS, and Supabase.

Common commands:

```bash
npm run app
npm run build
npm run db:status
npm run heartbeat:test
```

Use `npm run app` for local development. The app serves on `http://127.0.0.1:3000/` by default.

Before calling work complete:

- For meaningful code changes, run `npm run build`.
- For bug fixes, reproduce or identify the failing path first, then fix, then verify.
- For UI changes, open the app locally and verify the affected flow at desktop and mobile-sized layouts when practical.
- For backend or privacy changes, verify server-side enforcement and run `npm run build`.
- For heartbeat changes, use `npm run heartbeat:test` when practical.
- If verification cannot run because environment variables or services are missing, say exactly what could not run and why.

## Environment, Release, And Cost Safety

- `main` means production.
- `dev` means shared staging / preview.
- Feature branches should be short-lived and merge into `dev`.
- Local `.env.local` should point to local or staging, never production.
- Production credentials belong only in production-scoped deployment settings or `.env.production.local` for intentional release checks.
- Before `db:push`, confirm the linked Supabase project with `npm run db:status`.
- Never push migrations if there is doubt about which Supabase project is linked.
- Prefer solutions that fit Vercel Hobby and Supabase free-tier constraints.
- Do not add frequent cron jobs, background workers, queues, paid add-ons, or managed realtime requirements unless the user explicitly approves the cost or tier change.
- If a stronger implementation needs a paid tier, document it as a future improvement instead of silently building around it.
- Keep cleanup and maintenance jobs compatible with the existing daily/weekly cron posture unless product risk clearly requires otherwise.
- Record free-tier compromises and upgrade paths in `docs/free-tier-compromises.md`.

## Documentation Expectations

Update docs when behavior, setup, release process, privacy guarantees, or product meaning changes.

Good documentation is short, concrete, and close to the decision it explains. Do not add broad process docs for tiny implementation details.

## Git Hygiene

- Check worktree status before and after changes.
- Do not discard unrelated changes.
- Do not run destructive git commands unless explicitly requested.
- If asked to branch, use the `codex/` prefix unless the user asks for another name.
- Prefer non-interactive git commands.
