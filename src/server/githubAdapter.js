import { createHmac, timingSafeEqual } from "node:crypto";

// Local, dependency-free trim+cap (mirrors validation.cleanString). Kept inline
// so this adapter imports nothing but node:crypto — which lets the unit test run
// under plain `node` with no bundler/env, while the route still gets the same
// sanitisation recordAgentState expects.
function cleanString(value, maxLength = 420) {
  return String(value ?? "").trim().slice(0, maxLength);
}

/**
 * GitHub webhook feed — the third v1 source (see office-sim spike §7).
 *
 * This proves the multi-tool adapter pattern: a totally different source shape
 * (a server-to-server GitHub webhook, zero install) flows through the exact same
 * ingest model as Claude Code and the desktop helper. Everything here is a pure
 * function so the signature check and the event→shape mapping are unit-testable
 * without a running server or a DB.
 *
 * The privacy contract (posture #2 + the encrypt-vs-shape split) is honored the
 * same way every source honors it:
 *   - SHAPE (plaintext, safe to render + share): tool='github', a fixed-vocab
 *     `category` (coding / review), an `object` hint (coding-desk), and status.
 *   - CONTENT (encrypted at rest, NEVER public): repo name, branch, PR/issue
 *     titles — these only ride in `detail`, which recordAgentState routes through
 *     encryptContentFields. They never touch a shape column.
 */

// The GitHub events we translate. Anything else (star, fork, watch, ping, …) is
// intentionally ignored — an unrecognised event is a no-op, not an error.
export const GITHUB_EVENTS = ["push", "pull_request", "issues", "pull_request_review"];

/**
 * Verify GitHub's `X-Hub-Signature-256` header against the shared secret.
 *
 * GitHub signs the RAW request body with HMAC-SHA256 and sends
 * `sha256=<hexdigest>`. We recompute over the exact bytes we received and
 * compare in constant time. Reject on any mismatch, missing header, or missing
 * secret — an unverifiable webhook is dropped, never trusted.
 *
 * @param {string} rawBody  the exact request body text (must be pre-parse)
 * @param {string} signatureHeader  value of the X-Hub-Signature-256 header
 * @param {string} secret  GITHUB_WEBHOOK_SECRET
 */
export function verifyGithubSignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;
  const match = /^sha256=([0-9a-f]+)$/i.exec(String(signatureHeader).trim());
  if (!match) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = match[1].toLowerCase();

  // timingSafeEqual throws on length mismatch, so guard first — a wrong-length
  // signature is simply invalid.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// A GitHub push/comment shouldn't peg an actor as "working" forever; a
// merged/closed PR reads as "done". Everything else is momentary activity, so
// "working" is the honest default for a fresh event.
function statusForAction(action) {
  if (action === "closed" || action === "merged") return "done";
  return "working";
}

/**
 * Map a verified GitHub webhook (event name + parsed payload) to the canonical
 * normalized activity event the ingest path already understands:
 *
 *   { actor: {id,name,role,source}, tool, category, object, status,
 *     occurredAt, detail }
 *
 * SHAPE fields are plaintext and safe to render/share. `detail` is the ONLY
 * free-text field and is treated as CONTENT — recordAgentState encrypts it. Repo
 * name / branch / PR title live only in `detail`; they never leak into a shape
 * column or the public card.
 *
 * Returns null for events/actions we don't render (the caller ACKs 200 anyway,
 * so GitHub doesn't retry).
 */
export function mapGithubEvent(eventName, payload) {
  const event = cleanString(eventName, 40).toLowerCase();
  if (!GITHUB_EVENTS.includes(event) || !payload || typeof payload !== "object") {
    return null;
  }

  // The GitHub actor → a stable agent in the space. sender.login is present on
  // every event type; keying the external_id on it means the same human keeps
  // the same desk/face across pushes and PRs (stable-seat rule, §4).
  const login = cleanString(payload.sender?.login, 80);
  if (!login) return null;
  const displayName = cleanString(payload.sender?.name, 80) || login;

  // repo full_name is CONTENT — encrypted in `detail`, never a shape field.
  const repo = cleanString(payload.repository?.full_name, 120);

  let category;
  let object;
  let status;
  let detail;

  switch (event) {
    case "push": {
      // e.g. "refs/heads/main" → "main". Branch is CONTENT.
      const branch = cleanString(payload.ref, 200).replace(/^refs\/heads\//, "");
      const count = Array.isArray(payload.commits) ? payload.commits.length : 0;
      category = "coding";
      object = "coding-desk";
      status = "working";
      detail = joinDetail(
        repo && branch ? `pushed to ${repo}#${branch}` : "pushed commits",
        count ? `${count} commit${count === 1 ? "" : "s"}` : ""
      );
      break;
    }
    case "pull_request": {
      const action = cleanString(payload.action, 30).toLowerCase();
      const merged = action === "closed" && payload.pull_request?.merged === true;
      const title = cleanString(payload.pull_request?.title, 200); // CONTENT
      category = "coding";
      object = "coding-desk";
      status = statusForAction(merged ? "merged" : action);
      detail = joinDetail(
        `${merged ? "merged" : action || "updated"} PR${repo ? " in " + repo : ""}`,
        title
      );
      break;
    }
    case "pull_request_review": {
      // Reviewing someone else's PR — the review corner, not the coding desk.
      const state = cleanString(payload.review?.state, 30).toLowerCase();
      const title = cleanString(payload.pull_request?.title, 200); // CONTENT
      category = "review";
      object = "coding-desk";
      status = "working";
      detail = joinDetail(
        `reviewed a PR${state ? " (" + state + ")" : ""}${repo ? " in " + repo : ""}`,
        title
      );
      break;
    }
    case "issues": {
      const action = cleanString(payload.action, 30).toLowerCase();
      const title = cleanString(payload.issue?.title, 200); // CONTENT
      category = "review";
      object = "coding-desk";
      status = statusForAction(action);
      detail = joinDetail(
        `${action || "updated"} an issue${repo ? " in " + repo : ""}`,
        title
      );
      break;
    }
    default:
      return null;
  }

  return {
    actor: {
      id: `github:${login}`,
      name: displayName,
      role: "Engineering",
      source: "github",
    },
    tool: "github",
    category,
    object,
    status,
    // GitHub doesn't stamp a reliable per-event time in the header; the payload's
    // moment is "now" for our purposes. resolveOccurredAt guards clock skew.
    occurredAt: new Date().toISOString(),
    // CONTENT — encrypted at rest by recordAgentState, never in the public view.
    detail,
    kind: event,
  };
}

function joinDetail(head, tail) {
  return [head, tail].filter(Boolean).join(" · ").slice(0, 400);
}
