//! Networking — POST the shape-only activity envelope to the mumbl ingest
//! endpoint, authenticated with the space ingest token (Bearer HMAC on the
//! server side).
//!
//! One ACTOR PER TOOL: the envelope's `agent.id` is `desktop:<install>:<tool>`,
//! so each actively-used app becomes its own station in the office rather than
//! all of them collapsing onto one rotating character.
//!
//! The envelope MUST match the existing contract (app/api/agents/ingest and
//! scripts/mumbl-report.mjs): an `agent` block + `status` + `kind` + `task` +
//! `occurredAt` + `detail`, plus the SHAPE fields `tool`/`category`/`object`.
//!
//! ONLY shape leaves the machine. `detail` is a short human line built from the
//! category/tool ("Figma · design") — never a window title, URL, or content.
//! It is encrypted at rest server-side (like every other `detail`).
//!
//! Failure posture mirrors mumbl-report.mjs: bounded timeout, never block,
//! never queue forever — a failed POST is dropped. The office is a live relay;
//! a missed heartbeat just means a slightly staler room, not lost history.

use std::time::Duration;

use serde::Serialize;

use crate::watcher::ActivityEvent;

const TIMEOUT: Duration = Duration::from_secs(4);

#[derive(Serialize)]
struct Agent {
    id: String,
    name: String,
    role: String,
    source: String,
}

#[derive(Serialize)]
struct Envelope {
    // The ingest contract (app/api/agents/ingest/route.js) reads `body.agent`
    // and 400s with "agent.id is required" if it is missing — it does NOT read
    // `actor`. Match the canonical envelope in scripts/mumbl-report.mjs.
    agent: Agent,
    source: String,
    status: String,
    // SHAPE — plaintext, safe to render/share.
    tool: String,
    category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    object: Option<String>,
    kind: String,
    #[serde(rename = "occurredAt")]
    occurred_at: String,
    // CONTENT slot — encrypted at rest, never public. Deliberately just the
    // shape restated; we never put a title/url/content here.
    detail: String,
}

/// POST one event. Returns Ok(true) if the server accepted it (2xx), Ok(false)
/// if it responded non-2xx, Err on transport failure. Callers treat any
/// non-true result as "dropped".
pub async fn deliver(
    endpoint: &str,
    token: &str,
    install_id: &str,
    display_name: &str,
    event: &ActivityEvent,
) -> Result<bool, String> {
    let object = if event.object.is_empty() {
        None
    } else {
        Some(event.object.clone())
    };

    let envelope = Envelope {
        agent: Agent {
            // IDENTITY IS PER TOOL, not per machine. recordAgentState upserts on
            // (space_id, external_id), so a single `desktop:<install_id>` id made
            // every app-switch overwrite ONE row — the office rendered one
            // character whose tool rotated instead of the user's live stack.
            // Suffixing the tool gives each actively-used app its own row, hence
            // its own station. Apps that go quiet age out on their own: the read
            // path marks an actor `stale` after 5min and applyState walks stale
            // actors out of the scene.
            id: format!("desktop:{install_id}:{}", event.tool),
            // Named for the app; the machine's configured name becomes the role
            // so a station still says whose it is.
            name: event.label.clone(),
            role: display_name.to_string(),
            source: "desktop".to_string(),
        },
        source: "desktop".to_string(),
        status: event.status.clone(),
        tool: event.tool.clone(),
        category: event.category.clone(),
        object,
        // A synthetic hook kind so the event log reads sensibly alongside
        // Claude Code's PreToolUse/Stop/etc.
        kind: "focus".to_string(),
        occurred_at: event.occurred_at.clone(),
        // shape restated, never content
        detail: format!("{} · {}", event.label, event.category),
    };

    let client = reqwest::Client::builder()
        .timeout(TIMEOUT)
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(endpoint)
        .bearer_auth(token)
        .json(&envelope)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(resp.status().is_success())
}
