#!/usr/bin/env node
/**
 * Report Claude Code state into a mumbl agent space.
 *
 * This runs inside Claude Code's hook path, so the rule that outranks
 * everything else: never block and never fail the session. Every error is
 * swallowed, the network call is bounded, and the exit code is always 0.
 *
 * Hooks are used rather than an MCP tool because they fire deterministically —
 * an MCP tool only reports when the model chooses to call it, which stops
 * happening during exactly the long tasks you most want to watch.
 *
 * Setup: see docs/agent-presence-stage-1.md
 *
 * Env:
 *   MUMBL_INGEST_TOKEN  required — the space's ingest token
 *   MUMBL_INGEST_URL    optional — defaults to production
 *   MUMBL_AGENT_NAME    optional — defaults to the working directory name
 */

const TIMEOUT_MS = 2000;
const URL_DEFAULT = "https://mumbl.wtf/api/agents/ingest";

// hook event -> what the world should show. Notification is the interesting
// one: Claude Code emits it when it is waiting on the human, which is exactly
// "blocked" — a state a terminal buries and a room can surface.
const EVENTS = {
  SessionStart: { status: "working", task: "session started" },
  UserPromptSubmit: { status: "working", task: "working on a request" },
  PreToolUse: { status: "working" },
  PostToolUse: { status: "working" },
  Notification: { status: "blocked" },
  Stop: { status: "done", task: "waiting for review" },
  SubagentStop: { status: "working", task: "subagent finished" },
  SessionEnd: { status: "idle", task: "session ended" },
};

main();

async function main() {
  try {
    await report();
  } catch {
    // never surface anything to the session
  }
  process.exit(0);
}

async function report() {
  const token = process.env.MUMBL_INGEST_TOKEN;
  if (!token) return;

  const payload = await readStdinJson();
  const event = payload.hook_event_name || "status";
  const mapped = EVENTS[event];
  if (!mapped) return;

  const cwd = payload.cwd || process.cwd();
  const project = basename(cwd);
  const sessionId = payload.session_id || "local";

  const task =
    mapped.task ||
    (payload.tool_name ? describeTool(payload.tool_name, payload.tool_input) : null) ||
    truncate(payload.message, 200) ||
    event;

  const body = {
    agent: {
      id: `claude-code:${sessionId}`,
      name: process.env.MUMBL_AGENT_NAME || project || "Claude Code",
      role: "Engineering",
      source: "claude-code",
    },
    status: mapped.status,
    task,
    kind: event,
    // stamped here, not server-side: hooks fire faster than the round-trip, so
    // insert order does not match the order things actually happened
    occurredAt: new Date().toISOString(),
    // the message on a Notification is the reason it is waiting, which is the
    // single most useful line in the whole feed
    detail: truncate(payload.message, 400) || task,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(process.env.MUMBL_INGEST_URL || URL_DEFAULT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function describeTool(tool, input) {
  const target =
    input?.file_path || input?.path || input?.pattern || input?.command || input?.url || "";
  const short = truncate(String(target).split("/").slice(-2).join("/"), 60);
  return short ? `${tool} · ${short}` : tool;
}

function readStdinJson() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve({});
    let raw = "";
    const done = setTimeout(() => resolve(parse(raw)), 500);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { raw += chunk; });
    process.stdin.on("end", () => { clearTimeout(done); resolve(parse(raw)); });
    process.stdin.on("error", () => { clearTimeout(done); resolve({}); });
  });
}

function parse(raw) {
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function truncate(value, max) {
  if (!value) return "";
  const str = String(value).replace(/\s+/g, " ").trim();
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function basename(p) {
  return String(p).replace(/\/+$/, "").split("/").pop() || "";
}
