# Scaling Notes

Target: support beta spikes up to 10,000 concurrent users across 1,000 spaces without making the product feel surveilled.

## Current hardening in repo

- Post creation is rate-limited per hashed session token with an atomic Postgres function.
- Reaction creation is rate-limited per hashed session token with an atomic Postgres function.
- Heartbeat generation is queued in `heartbeat_jobs` and processed in bounded batches.
- Daily prompts are stored in `prompts`, rotated once per UTC day, and reused on room reads.
- Room vibe uses aggregate reaction labels only, not people counts.
- Heartbeat cards render as shareable OG-style images at `/r/[slug]/heartbeat-card`.

## Supabase connection pooling

The app currently uses `@supabase/supabase-js`, which talks to Supabase over HTTPS APIs and does not open raw Postgres connections from Vercel functions. That means PgBouncer / Supabase Pooler is not directly used by these route handlers today.

Use Supabase Pooler for any future direct Postgres worker, queue runner, or reporting process that uses a Postgres connection string. In Supabase, use the Transaction pooler connection string for serverless workloads and keep the direct connection for migrations/admin work only.


For the current Vercel + Supabase-js app, the best practice is still to keep database writes behind route handlers and use Supabase's HTTPS APIs. Add a pooled Postgres connection string only when we introduce a direct SQL worker or external queue runner.

## 10k concurrent readiness checklist

- Keep Vercel app deploys serverless and stateless.
- Keep room reads paginated before public launch traffic grows.
- Move heartbeat workers to a dedicated worker if job volume grows beyond Vercel cron windows.
- Keep production migrations manual until the beta stabilizes.
- Monitor Supabase API latency, database size, and egress during public tests.


## Heartbeat queue testing

Run the local app first:

```bash
npm run app
```

Then trigger one heartbeat batch against the local server:

```bash
npm run heartbeat:test
```

The script reads `CRON_SECRET` from `.env.local` and posts to `/api/cron/heartbeats`. Pass a URL to test another deployment:

```bash
npm run heartbeat:test -- https://justmumbl.vercel.app
```
