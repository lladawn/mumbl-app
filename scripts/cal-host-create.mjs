#!/usr/bin/env node
/**
 * Create a booking desk: a host, a default call type, and Mon-Fri availability.
 *
 * Admin operation like scripts/agent-space-create.mjs — it writes with the
 * service role, so it stays a local script rather than an API route until there
 * is a real onboarding flow.
 *
 *   node scripts/cal-host-create.mjs \
 *     --slug disha --name "Disha Agarwalla" --office "DUSK & DAWN" \
 *     --email you@example.com --tz Asia/Kolkata \
 *     [--receptionist Ada] [--duration 30] [--hours 10-18] [--env .env.local]
 */

import { readFileSync } from "node:fs";
import { createHmac, randomBytes } from "node:crypto";

const args = parseArgs(process.argv.slice(2));

if (!args.slug || !args.name || !args.email) {
  console.error("Usage: node scripts/cal-host-create.mjs --slug <slug> --name <name> --email <notify email> [--office <office>] [--tz <IANA zone>] [--receptionist <name>] [--duration 30] [--hours 10-18] [--env .env.local]");
  process.exit(1);
}

const envFile = args.env || ".env.local";
const env = readEnv(envFile);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const hashSecret = env.MUMBL_TOKEN_HASH_SECRET;

for (const [key, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  MUMBL_TOKEN_HASH_SECRET: hashSecret,
})) {
  if (!value) {
    console.error(`Missing ${key} in ${envFile}`);
    process.exit(1);
  }
}

const slug = String(args.slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
const timezone = args.tz || "Asia/Kolkata";

try {
  new Intl.DateTimeFormat("en-US", { timeZone: timezone });
} catch {
  console.error(`"${timezone}" is not an IANA timezone (try Asia/Kolkata, Europe/London, America/New_York)`);
  process.exit(1);
}

const [startHour, endHour] = String(args.hours || "10-18").split("-").map(Number);
if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= startHour) {
  console.error(`--hours must look like 10-18`);
  process.exit(1);
}

// shown once, like the agent ingest token
const manageToken = randomBytes(32).toString("base64url");
// must match hashToken() in src/server/hash.js — duplicated because that file
// imports extensionless paths plain Node ESM cannot resolve
const manageTokenHash = createHmac("sha256", hashSecret).update(manageToken).digest("hex");

const host = await insert("booking_hosts", {
  slug,
  display_name: args.name,
  office_name: args.office || args.name,
  receptionist_name: args.receptionist || "Ada",
  timezone,
  notify_email: args.email,
  manage_token_hash: manageTokenHash,
  look: {},
});

const eventType = await insert("booking_event_types", {
  host_id: host.id,
  slug: "intro",
  title: args.title || `Call with ${args.name}`,
  duration_minutes: Number(args.duration) || 30,
  location_note: args.location || "I'll send a meeting link with the invite",
});

// Monday to Friday, weekday 1..5 (0 = Sunday, matching Date#getUTCDay)
const rules = [1, 2, 3, 4, 5].map((weekday) => ({
  host_id: host.id,
  weekday,
  start_minute: startHour * 60,
  end_minute: endHour * 60,
}));
await insert("booking_rules", rules);

const appUrl = env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";

console.log("");
console.log(`  desk      ${host.slug}  (${host.id})`);
console.log(`  office    ${host.office_name}, front desk: ${host.receptionist_name}`);
console.log(`  call      ${eventType.title} — ${eventType.duration_minutes} min`);
console.log(`  hours     Mon-Fri ${pad(startHour)}:00-${pad(endHour)}:00 ${timezone}`);
console.log(`  notify    ${host.notify_email}`);
console.log("");
console.log(`  Booking link:  ${appUrl}/cal/${host.slug}`);
console.log("");
console.log("  Manage token — shown once, store it now:");
console.log("");
console.log(`  export MUMBL_CAL_MANAGE_TOKEN=${manageToken}`);
console.log("");

async function insert(table, payload) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  if (!response.ok) {
    console.error(`Failed inserting into ${table} (${response.status}):`, body?.message || body);
    process.exit(1);
  }

  return Array.isArray(body) ? body[0] : body;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

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
