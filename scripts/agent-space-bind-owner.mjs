#!/usr/bin/env node
/**
 * Bind an existing agent space to a signed-in user, so /pair can find it.
 *
 *   node scripts/agent-space-bind-owner.mjs <slug> <auth-user-id> [envFile]
 *
 * WHY THIS EXISTS. agent_spaces.owner_user_id has existed since migration 0004
 * and nothing has ever written it: spaces are created by agent-space-create.mjs,
 * which does not set an owner. So every space that exists today is ownerless,
 * and /pair — which will only ever offer a user a space they OWN — finds
 * nothing and honestly says "no office yet".
 *
 * The tempting fix is to have /pair infer ownership (e.g. adopt an unowned
 * space whose slug matches the user's profile handle). That was built and then
 * removed: app/api/public-profiles POST lets any signed-in user claim an
 * arbitrary handle and checks uniqueness against public_profiles only, never
 * against agent_spaces.slug — so handle-squatting would hand a stranger a
 * working ingest token for someone else's office. Ownership has to be asserted
 * by someone who already has the service role, which is this script.
 *
 * Admin operation, same posture as agent-space-create.mjs: it writes with the
 * service role, so it stays a local script rather than an API route.
 *
 * SAFETY: only binds a space whose owner_user_id IS NULL. Re-pointing a space
 * that already has an owner is a different and much more dangerous operation,
 * and this deliberately will not do it — use --force only if you are certain.
 *
 * Find the user id in Supabase → Authentication → Users, or:
 *   select id, email from auth.users where email = '…';
 */

import { readFileSync } from "node:fs";

const args = process.argv.slice(2).filter((a) => a !== "--force");
const FORCE = process.argv.includes("--force");
const [slugArg, userIdArg, envFileArg] = args;

if (!slugArg || !userIdArg) {
  console.error("Usage: node scripts/agent-space-bind-owner.mjs <slug> <auth-user-id> [envFile] [--force]");
  process.exit(1);
}

const envFile = envFileArg || ".env.local";
const env = readEnv(envFile);
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

for (const [key, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: serviceKey })) {
  if (!value) {
    console.error(`Missing ${key} in ${envFile}`);
    process.exit(1);
  }
}

const slug = slugArg.toLowerCase();
const project = (supabaseUrl.match(/^https?:\/\/([a-z0-9-]+)\./i) || [])[1] || supabaseUrl;

const headers = {
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
  "content-type": "application/json",
  prefer: "return=representation",
};

// Read first, so the operator sees what they are about to change and against
// which project. Binding the wrong space is not something you notice later.
const existing = await getJson(
  `${supabaseUrl}/rest/v1/agent_spaces?slug=eq.${encodeURIComponent(slug)}&select=id,slug,name,owner_user_id`
);
if (!existing.length) {
  console.error(`No agent space with slug "${slug}" in project ${project}.`);
  process.exit(1);
}
const space = existing[0];

console.log("");
console.log(`  project  ${project}   (from ${envFile})`);
console.log(`  space    ${space.slug}  (${space.id})`);
console.log(`  owner    ${space.owner_user_id || "(none)"}  ->  ${userIdArg}`);
console.log("");

if (space.owner_user_id && space.owner_user_id !== userIdArg && !FORCE) {
  console.error("  This space already has a different owner. Re-pointing it would move");
  console.error("  someone else's office to a new account. Pass --force if that is genuinely");
  console.error("  what you intend.");
  process.exit(1);
}
if (space.owner_user_id === userIdArg) {
  console.log("  Already bound to that user. Nothing to do.");
  process.exit(0);
}

// The `owner_user_id=is.null` filter is the safety property, and it is part of
// the write rather than a check before it, so a concurrent bind cannot be
// clobbered by this one.
const filter = FORCE ? "" : "&owner_user_id=is.null";
const response = await fetch(
  `${supabaseUrl}/rest/v1/agent_spaces?slug=eq.${encodeURIComponent(slug)}${filter}`,
  { method: "PATCH", headers, body: JSON.stringify({ owner_user_id: userIdArg }) }
);
const payload = await response.json().catch(() => null);

if (!response.ok) {
  console.error(`Failed (${response.status}):`, payload?.message || payload);
  process.exit(1);
}
if (!Array.isArray(payload) || !payload.length) {
  console.error("  Nothing was updated — the space gained an owner between the read and the write.");
  process.exit(1);
}

console.log(`  ✓ ${slug} is now owned by ${userIdArg}`);
console.log("    That account will see it on /pair and can connect a device to it.");
console.log("");

async function getJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`Read failed (${res.status}):`, await res.text());
    process.exit(1);
  }
  return res.json();
}

function readEnv(path) {
  let file;
  try {
    file = readFileSync(path, "utf8");
  } catch {
    console.error(`Cannot read ${path}`);
    process.exit(1);
  }
  const out = {};
  for (const line of file.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}
