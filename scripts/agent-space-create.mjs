#!/usr/bin/env node
/**
 * Create an agent space and print its ingest token once.
 *
 * Admin operation, not a product surface — it writes with the service role, so
 * it stays a local script rather than an API route until there is a real
 * onboarding flow.
 *
 *   node scripts/agent-space-create.mjs <slug> [name] [envFile]
 */

import { readFileSync } from "node:fs";
import { createHmac, randomBytes } from "node:crypto";

const [, , slugArg, nameArg, envFileArg] = process.argv;

if (!slugArg) {
  console.error("Usage: node scripts/agent-space-create.mjs <slug> [name] [envFile]");
  process.exit(1);
}

const envFile = envFileArg || ".env.local";
const env = readEnv(envFile);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const hashSecret = env.MUMBL_TOKEN_HASH_SECRET;

for (const [key, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: serviceKey, MUMBL_TOKEN_HASH_SECRET: hashSecret })) {
  if (!value) {
    console.error(`Missing ${key} in ${envFile}`);
    process.exit(1);
  }
}

const slug = slugArg.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
const token = randomBytes(32).toString("base64url");

// Must match hashToken() in src/server/hash.js — that file is the source of
// truth; it is duplicated here because it imports extensionless paths that
// plain Node ESM cannot resolve.
const tokenHash = createHmac("sha256", hashSecret).update(token).digest("hex");

const response = await fetch(`${supabaseUrl}/rest/v1/agent_spaces`, {
  method: "POST",
  headers: {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
    prefer: "return=representation",
  },
  body: JSON.stringify({ slug, name: nameArg || slug, ingest_token_hash: tokenHash }),
});

const payload = await response.json();

if (!response.ok) {
  console.error(`Failed (${response.status}):`, payload?.message || payload);
  process.exit(1);
}

const created = Array.isArray(payload) ? payload[0] : payload;

console.log("");
console.log(`  space   ${created.slug}  (${created.id})`);
console.log(`  env     ${envFile}`);
console.log("");
console.log("  Ingest token — shown once, store it now:");
console.log("");
console.log(`  export MUMBL_INGEST_TOKEN=${token}`);
console.log("");

function readEnv(path) {
  let raw = "";
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.error(`Cannot read ${path}`);
    process.exit(1);
  }

  const out = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) out[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
