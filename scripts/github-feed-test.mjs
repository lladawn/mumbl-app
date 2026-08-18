/**
 * Unit tests for the GitHub webhook feed (office-sim §7).
 *
 * Covers the two pure, security-critical pieces without a server or DB:
 *   1. verifyGithubSignature — the X-Hub-Signature-256 HMAC gate.
 *   2. mapGithubEvent — event → normalized SHAPE, and the encrypt-vs-shape split
 *      (repo/branch/PR title are CONTENT and must NEVER appear in a shape field).
 *
 * Run: node scripts/github-feed-test.mjs
 *
 * The adapter is plain JS with only node:crypto + validation.cleanString deps, so
 * it's imported directly — no build step, no env.
 */
import { createHmac } from "node:crypto";
import {
  GITHUB_EVENTS,
  mapGithubEvent,
  verifyGithubSignature,
} from "../src/server/githubAdapter.js";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.error("  FAIL:", msg);
  }
}

function sign(body, secret) {
  return "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

// ---------- signature verification ----------
{
  const secret = "s3cr3t-webhook-key";
  const body = JSON.stringify({ hello: "world", n: 42 });
  const good = sign(body, secret);

  assert(verifyGithubSignature(body, good, secret) === true, "valid signature accepted");
  assert(verifyGithubSignature(body, good, "wrong-secret") === false, "wrong secret rejected");
  assert(verifyGithubSignature(body + " ", good, secret) === false, "tampered body rejected");
  assert(verifyGithubSignature(body, "sha256=deadbeef", secret) === false, "bad digest rejected");
  assert(verifyGithubSignature(body, "", secret) === false, "missing header rejected");
  assert(verifyGithubSignature(body, good, "") === false, "missing secret rejected");
  assert(verifyGithubSignature(body, "md5=" + "0".repeat(32), secret) === false, "non-sha256 prefix rejected");
  assert(
    verifyGithubSignature(body, good.toUpperCase().replace("SHA256", "sha256"), secret) === true,
    "uppercase hex digest accepted (case-insensitive)"
  );
}

// ---------- adapter: push → coding ----------
{
  const payload = {
    ref: "refs/heads/main",
    commits: [{ id: "a" }, { id: "b" }],
    repository: { full_name: "acme/secret-repo" },
    sender: { login: "octocat", name: "Octo Cat" },
  };
  const norm = mapGithubEvent("push", payload);
  assert(norm !== null, "push maps to a normalized event");
  assert(norm.tool === "github", "push tool=github");
  assert(norm.category === "coding", "push category=coding");
  assert(norm.object === "coding-desk", "push object=coding-desk");
  assert(norm.status === "working", "push status=working");
  assert(norm.actor.id === "github:octocat", "actor id keyed on login (stable seat)");
  assert(norm.actor.name === "Octo Cat", "actor name from sender.name");
  assert(norm.actor.source === "github", "actor source=github");

  // the encrypt-vs-shape split: repo + branch are CONTENT, only in detail
  const shapeBlob = [norm.tool, norm.category, norm.object, norm.status, norm.actor.id, norm.actor.role].join(" ");
  assert(!/secret-repo/.test(shapeBlob), "repo name NOT in any shape field");
  assert(!/main/.test(shapeBlob), "branch NOT in any shape field");
  assert(/secret-repo/.test(norm.detail), "repo name present in encrypted detail");
  assert(/main/.test(norm.detail), "branch present in encrypted detail");
  assert(/2 commits/.test(norm.detail), "commit count summarized in detail");
}

// ---------- adapter: pull_request_review → review ----------
{
  const payload = {
    action: "submitted",
    review: { state: "approved" },
    pull_request: { title: "Refactor billing engine" },
    repository: { full_name: "acme/billing" },
    sender: { login: "reviewer1" },
  };
  const norm = mapGithubEvent("pull_request_review", payload);
  assert(norm !== null, "review maps to a normalized event");
  assert(norm.category === "review", "review category=review");
  assert(norm.status === "working", "review status=working");
  const shapeBlob = [norm.tool, norm.category, norm.object, norm.status, norm.actor.id].join(" ");
  assert(!/billing/.test(shapeBlob), "PR title/repo NOT in shape fields");
  assert(!/Refactor/.test(shapeBlob), "PR title NOT in shape fields");
  assert(/Refactor billing engine/.test(norm.detail), "PR title present in encrypted detail");
  assert(norm.actor.name === "reviewer1", "actor name falls back to login when sender.name absent");
}

// ---------- adapter: merged PR → done ----------
{
  const payload = {
    action: "closed",
    pull_request: { title: "Ship it", merged: true },
    repository: { full_name: "acme/app" },
    sender: { login: "dev" },
  };
  const norm = mapGithubEvent("pull_request", payload);
  assert(norm.category === "coding", "PR category=coding");
  assert(norm.status === "done", "merged PR status=done");
  assert(/merged/.test(norm.detail), "merged verb in detail");
}

// ---------- adapter: issues → review ----------
{
  const norm = mapGithubEvent("issues", {
    action: "opened",
    issue: { title: "Login is broken" },
    repository: { full_name: "acme/app" },
    sender: { login: "reporter" },
  });
  assert(norm.category === "review", "issues category=review");
  assert(/Login is broken/.test(norm.detail), "issue title in encrypted detail");
  const shapeBlob = [norm.tool, norm.category, norm.object, norm.status].join(" ");
  assert(!/Login is broken/.test(shapeBlob), "issue title NOT in shape fields");
}

// ---------- adapter: ignored / malformed ----------
{
  assert(mapGithubEvent("star", { sender: { login: "x" } }) === null, "unrelated event ignored");
  assert(mapGithubEvent("ping", { zen: "hi" }) === null, "ping ignored");
  assert(mapGithubEvent("push", null) === null, "null payload ignored");
  assert(mapGithubEvent("push", { repository: {} }) === null, "missing sender.login ignored");
  assert(Array.isArray(GITHUB_EVENTS) && GITHUB_EVENTS.length === 4, "four event types handled");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
