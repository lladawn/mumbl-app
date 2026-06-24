# Environments

Mumbl should run with separate Git branches and separate backend environments so local or staging work never mutates the live product by accident.

## Branch model

- `main` = production
- `dev` = shared staging / preview branch
- feature branches = short-lived work that merges into `dev`

Recommended flow:

1. branch from `dev`
2. open PR into `dev`
3. verify on preview / staging
4. merge `dev` into `main` when ready for production

## Vercel

Use Vercel's official branch and environment split:

- Production Branch: `main`
- Preview Deployments: `dev` and all feature branches
- Local Development: `.env.local` only

On Vercel:

1. set the project's Production Branch to `main`
2. keep production env vars scoped to `Production`
3. add staging values under `Preview`, ideally branch-scoped to `dev`
4. keep local values out of Vercel and in `.env.local`

If you are on Vercel Hobby, `dev` still runs as a Preview deployment. Use branch-specific Preview variables for `dev`.

## Supabase

Use separate Supabase environments:

- local development: local Supabase stack if you want full isolation
- staging: a separate Supabase project for `dev`
- production: a separate Supabase project for `main`

Do not point `.env.local` at the production Supabase project.

Recommended values:

- local `.env.local` -> local Supabase or staging Supabase
- Vercel Preview -> staging Supabase
- Vercel Production -> production Supabase

## CLI workflow

The repository no longer hardcodes a Supabase project ref and does not require duplicate ref env vars.

Link the CLI intentionally:

```bash
npm run db:link -- your-staging-project-ref
```

or

```bash
SUPABASE_PROJECT_REF=your-staging-project-ref npm run db:link
```

If you keep staging values in `.env.local` and optional production values in `.env.production.local`, you can use:

```bash
npm run db:link:staging
npm run db:link:prod
```

Then run:

```bash
npm run db:push
```

Before pushing production migrations, re-link to the production project on purpose.
The helper derives the project ref from `NEXT_PUBLIC_SUPABASE_URL`, so the URL is the source of truth.

## Environment variables

Use different values per environment:

- Development: local-only values in `.env.local`
- Preview / `dev`: staging Supabase URL, anon key, service role key, staging cron secret
- Production / `main`: production Supabase URL, anon key, service role key, production cron secret

Content encryption and pattern graph variables are also environment-specific:

- `MUMBL_CONTENT_ENCRYPTION_KEY`
- `MUMBL_ENABLE_PATTERN_GRAPH`
- `NEXT_PUBLIC_ENABLE_PATTERN_GRAPH`
- `OPENAI_API_KEY`
- `OPENAI_SIGNAL_MODEL`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_INSIGHT_MODEL`
- `MUMBL_PATTERN_GRAPH_FIRST_INSIGHT_AT`
- `MUMBL_PATTERN_GRAPH_INSIGHT_INTERVAL`
- `MUMBL_ENABLE_PATTERN_TEST_TOOLS`

`MUMBL_CONTENT_ENCRYPTION_KEY` is server-only and lane-specific. A row encrypted in one lane cannot be decrypted in another lane unless the key is intentionally shared, so production, staging, and local data should use separate keys.

Use `MUMBL_ENABLE_PATTERN_GRAPH=true` only in environments where the private pattern graph should run, and pair it with `NEXT_PUBLIC_ENABLE_PATTERN_GRAPH=true` only when the UI should link to the feature. Production can safely ship the code with both flags false or unset, which hides pattern links and disables pattern APIs, async processing, insight generation, and Slack pattern pointers. Use lower pattern thresholds and `MUMBL_ENABLE_PATTERN_TEST_TOOLS=true` only in local or staging. Production should keep test tools disabled and use the intended cadence unless product explicitly changes it.

Supabase Auth needs environment-specific redirect URLs in the Supabase dashboard. Add each lane's callback URL, such as `http://127.0.0.1:3000/auth/callback`, the Vercel Preview callback URL, and `https://mumbl.wtf/auth/callback`.

For Google login, enable the Google provider in Supabase Auth for each Supabase project and use environment-specific Google OAuth client credentials. The Google OAuth client must allow the Supabase callback URL shown in that project's Google provider settings.

Analytics should be opt-in per environment:

- local: disabled
- preview: optional
- production: enabled

See `docs/analytics.md` for the tracked event boundary, Umami setup, and the privacy rules that keep analytics aggregate rather than person-level.

Slack token encryption keys are lane-specific. If local ngrok and staging intentionally share one staging Supabase project, either use the same `MUMBL_SLACK_TOKEN_ENCRYPTION_KEY` in both or reinstall Slack through the environment that will send notifications. Otherwise a row encrypted by one lane cannot be decrypted by the other.

## Important rule

Treat `main` + Vercel Production + production Supabase as one lane.
Treat `dev` + Vercel Preview + staging Supabase as the other lane.
Never reuse production credentials in the `dev` lane.
