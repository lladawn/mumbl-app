# AGENTS.md

Guidance for Codex and other coding agents working in this repository.

## First, Read The Local Context

Before making code changes, read the relevant project guidance:

1. `README.md` for app shape, commands, and current capabilities.
2. `docs/mumbl-product-context.md` for the product promise and voice.
3. `docs/mumbl-extension-01.md` for newer product decisions. If it conflicts with the original product context, the extension wins.
4. `docs/backend-plan.md` before changing API routes, Supabase schema, privacy behavior, posts, reactions, or heartbeats.
5. `docs/environments.md` and `docs/release-checklist.md` before touching deployments, environment variables, migrations, or release flow.
6. `docs/scaling.md` before changing cron, heartbeat jobs, rate limits, room reads, or queue-like behavior.

## Product Principles To Preserve

Mumbl is anonymous-first. Treat that as an architectural constraint, not just copy.

- No signup for v1.
- Users opt into identity; they do not opt out of it.
- Do not track members, visitors, joins, lurkers, or room opens.
- The feed is the signal of whether a space is alive.
- Reaction counts are allowed because they measure resonance, not surveillance.
- Heartbeats are for the team, not management.
- Do not create a creator-only analytics dashboard or manager view.
- Public spaces are opt-in and aggregate-only. Never expose individual public posts on `/explore`.
- Keep the voice human, warm, and engineer-native. Avoid HR, survey, wellness, or generic SaaS language.

When deciding whether to add a feature, ask whether it makes Mumbl feel more like a living team space where friendships can form. If it makes the app feel like a feedback tool, surveillance product, or corporate dashboard, it is probably wrong.

## Engineering Standards

Work like a senior engineer:

- Inspect existing patterns before adding new ones.
- Use TypeScript for new code going forward. When touching existing JavaScript files, opportunistically migrate them to TypeScript only when it is low-risk, keeps the change scoped, and does not break existing behavior. Prefer explicit local types for API payloads, server responses, and component props as files are migrated.
- Keep changes tightly scoped to the request.
- Prefer simple modules and explicit data flow over clever abstractions.
- Add abstractions only when they remove real duplication or match an existing local pattern.
- Preserve server-side enforcement for privacy, permissions, rate limits, and token hashing.
- Keep secrets server-only. `SUPABASE_SERVICE_ROLE_KEY`, `MUMBL_TOKEN_HASH_SECRET`, and `CRON_SECRET` must never be exposed to client code.
- Use route handlers for privileged writes. Do not introduce broad client-side Supabase writes.
- Avoid unrelated refactors, formatting churn, or metadata changes.
- Do not revert user changes unless explicitly asked.

## Stack And Commands

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

- Run `npm run build` for meaningful code changes.
- For UI changes, open the app locally and verify the affected flow in a browser.
- For heartbeat changes, use `npm run heartbeat:test` when practical.
- If tests or builds cannot run because environment variables are missing, say that clearly.

## Backend And Data Rules

Follow `docs/backend-plan.md` unless it has been intentionally superseded.

- Spaces are link-access rooms.
- Posts should never store session tokens.
- Anonymous posts must not store display names.
- Reaction dedupe should use a server-side hash of the browser session token.
- Creator-only actions should use creator tokens stored locally and verified server-side.
- Heartbeat generation should receive anonymised post data only, such as `{ type, content, reaction_count }`.
- Break-glass moderation data must not be queried by normal product views.
- Keep database constraints aligned with product promises wherever possible.

When changing migrations or schema-related code, verify the environment first. Never push migrations if there is doubt about which Supabase project is linked.

## Environment And Release Safety

Branch and environment lanes:

- `main` means production.
- `dev` means shared staging / preview.
- Feature branches should be short-lived and merge into `dev`.
- Local `.env.local` should point to local or staging, never production.
- Production credentials belong only in production-scoped deployment settings or `.env.production.local` for intentional release checks.

Before `db:push`, confirm the linked Supabase project with `npm run db:status`.

## Free-Tier Bias

Mumbl is currently designed and operated against free-tier services where practical, including Vercel Hobby.

- Prefer solutions that fit Vercel Hobby and Supabase free-tier constraints.
- Do not add frequent cron jobs, background workers, queues, paid add-ons, or managed realtime requirements unless the user explicitly approves the cost or tier change.
- If a stronger implementation needs a paid tier, document it as a future improvement instead of silently building around it.
- Keep cleanup and maintenance jobs compatible with the existing daily/weekly cron posture unless product risk clearly requires otherwise.
- Record free-tier compromises and upgrade paths in `docs/free-tier-compromises.md`.

## Frontend And UX Rules

Build the usable product surface, not a marketing shell.

- Match the existing visual system and plain CSS approach.
- When adding a new element to an existing page, design it as part of that page's current theme, rhythm, and hierarchy. Think like a designer-builder: notice spacing, density, typography, color, interaction states, and the job the page is already doing before introducing a new control, panel, badge, or section.
- Design every feature for both desktop and mobile from the start. Decide where the workflow lives at wide widths and at narrow widths, verify controls remain discoverable and reachable in both, and avoid making a desktop sidebar the only access point for a core action on mobile.
- For new product concepts, teach through in-context affordances: clear labels, one-line job-to-be-done copy, useful empty states, and progressive disclosure near the action. Do not add broad Product/Features nav or explanatory pages unless discovery cannot be solved inside the actual workflow.
- Keep workflows direct and low-friction.
- Do not add explanatory in-app text about how features work unless the user needs it to proceed.
- Avoid dashboard-like analytics UI unless it is explicitly aggregate and product-approved.
- Use copy that sounds like a trusted engineer, not HR software.
- Keep responsive layouts stable. Text should not overflow buttons, cards, tabs, or sidebars.
- For local frontend changes, verify desktop and mobile-sized layouts when practical.

## Documentation Expectations

Update docs when behavior, setup, release process, privacy guarantees, or product meaning changes.

Good documentation is short, concrete, and close to the decision it explains. Do not add broad process docs for tiny implementation details.

## Git Hygiene

- Check worktree status before and after changes.
- Do not discard unrelated changes.
- Do not run destructive git commands unless explicitly requested.
- If asked to branch, use the `codex/` prefix unless the user asks for another name.
- Prefer non-interactive git commands.
