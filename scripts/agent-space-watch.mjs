#!/usr/bin/env node
/**
 * Watch an agent space as text.
 *
 * Two jobs. It makes stage 1 testable at all — task strings are encrypted at
 * rest, so the Supabase table view shows ciphertext and nothing else.
 *
 * And it is the control group. This is the list the pixel world has to beat:
 * if glancing at a room does not tell you something faster than this does, the
 * spatial view is not earning its keep and stage 2 is not worth building.
 *
 *   node scripts/agent-space-watch.mjs <slug> [envFile]
 */

import { readFileSync } from "node:fs";
import { createDecipheriv, createHash } from "node:crypto";

const [, , slug, envFileArg] = process.argv;
if (!slug) {
  console.error("Usage: node scripts/agent-space-watch.mjs <slug> [envFile]");
  process.exit(1);
}

const envFile = envFileArg || ".env.local";
const env = readEnv(envFile);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const contentKey = createHash("sha256").update(env.MUMBL_CONTENT_ENCRYPTION_KEY || "").digest();

if (!url || !key || !env.MUMBL_CONTENT_ENCRYPTION_KEY) {
  console.error(`Missing Supabase or encryption env in ${envFile}`);
  process.exit(1);
}

const H = { apikey: key, authorization: `Bearer ${key}` };
const DIM = "\x1b[2m", RESET = "\x1b[0m", BOLD = "\x1b[1m";
const STATUS_COLOR = {
  working: "\x1b[33m", // amber
  blocked: "\x1b[31m", // red
  done: "\x1b[32m",    // green
  idle: "\x1b[90m",    // grey
};

const space = await getSpace();
if (!space) {
  console.error(`No agent space with slug "${slug}" in ${envFile}`);
  process.exit(1);
}

await tick();
setInterval(tick, 2000);

async function tick() {
  const [agents, events] = await Promise.all([
    get(`/rest/v1/agents?select=name,role,status,source,last_seen_at,encrypted_payload&space_id=eq.${space.id}&order=last_seen_at.desc`),
    // occurred_at, never created_at — hooks land out of order
    get(`/rest/v1/agent_events?select=kind,status,occurred_at,encrypted_payload,agents(name)&space_id=eq.${space.id}&order=occurred_at.desc&limit=12`),
  ]);

  const out = [];
  out.push(`${BOLD}${space.name}${RESET} ${DIM}· ${agents.length} collaborator${agents.length === 1 ? "" : "s"} · ${new Date().toLocaleTimeString()}${RESET}`);
  out.push("");

  if (!agents.length) {
    out.push(`${DIM}  nothing reporting yet${RESET}`);
  }

  for (const a of agents) {
    const color = STATUS_COLOR[a.status] || "";
    const task = decrypt(a.encrypted_payload?.current_task, "agents:current_task") || "—";
    out.push(
      `  ${color}${a.status.toUpperCase().padEnd(8)}${RESET} ${BOLD}${a.name}${RESET} ${DIM}${a.role} · ${ago(a.last_seen_at)}${RESET}`
    );
    out.push(`           ${task}`);
  }

  out.push("");
  out.push(`${DIM}  recent${RESET}`);
  for (const e of events.reverse()) {
    const detail = decrypt(e.encrypted_payload?.detail, "agent_events:detail") || "";
    const color = STATUS_COLOR[e.status] || "";
    out.push(
      `  ${DIM}${new Date(e.occurred_at).toLocaleTimeString()}${RESET} ${color}${(e.status || "").padEnd(8)}${RESET} ${DIM}${(e.agents?.name || "").padEnd(14)}${RESET} ${detail}`
    );
  }

  process.stdout.write("\x1b[2J\x1b[H" + out.join("\n") + "\n");
}

async function getSpace() {
  const rows = await get(`/rest/v1/agent_spaces?select=id,name,slug&slug=eq.${encodeURIComponent(slug)}`);
  return rows[0] || null;
}

async function get(path) {
  const res = await fetch(url + path, { headers: H });
  if (!res.ok) return [];
  return res.json();
}

// mirrors decryptContentValue() in src/server/encryption.js
function decrypt(payload, aad) {
  if (!payload || typeof payload !== "object") return "";
  try {
    const d = createDecipheriv("aes-256-gcm", contentKey, Buffer.from(payload.iv, "base64url"));
    d.setAAD(Buffer.from(aad, "utf8"));
    d.setAuthTag(Buffer.from(payload.tag, "base64url"));
    const text = Buffer.concat([d.update(Buffer.from(payload.ciphertext, "base64url")), d.final()]).toString("utf8");
    return payload.isNull ? "" : text;
  } catch {
    return "";
  }
}

function ago(iso) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
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
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
