//! The focus → event state machine.
//!
//! Turns the raw OS focus stream into normalized, debounced activity events and
//! ships them. Runs entirely on a tokio task; the platform layer just feeds it
//! `FocusChange`es over a channel.
//!
//! Rules (from the architecture spike §2 "Battery / perf posture"):
//!   - 20s DEBOUNCE: a focus must be held ≥ 20s before it emits. Alt-tab noise
//!     never leaves the machine and request volume stays well under the
//!     server's 300/min per-space limit.
//!   - COALESCE heartbeat: while the same tool stays focused, re-emit at most
//!     once per ~60s so the office stays "lit" without spamming.
//!   - OPT-IN + KNOWN ONLY: an app is emitted only if it's on the user's
//!     allowlist AND in the classification table. Unknown/unticked → dropped.
//!   - PAUSED / UNCONFIGURED → nothing leaves the machine at all.

use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;
use tokio::time::{self, Instant};

use crate::catalog::classify;
use crate::config::{self, ConfigState};
use crate::network;
use crate::platform::FocusChange;

const DEBOUNCE: Duration = Duration::from_secs(20);
const HEARTBEAT: Duration = Duration::from_secs(60);

/// A normalized, shape-only activity event (before it's wrapped in the ingest
/// envelope). All fields are SHAPE — nothing here is content.
#[derive(Clone, Debug, Serialize)]
pub struct ActivityEvent {
    pub tool: String,
    pub category: String,
    pub object: String,
    pub status: String,
    #[serde(rename = "occurredAt")]
    pub occurred_at: String,
}

/// The "what am I sharing right now" receipt surfaced to the UI.
#[derive(Clone, Debug, Serialize)]
pub struct Receipt {
    pub tool: String,
    pub category: String,
    pub status: String,
    #[serde(rename = "occurredAt")]
    pub occurred_at: String,
    /// Whether the POST was accepted (true) or dropped/failed (false).
    pub delivered: bool,
}

/// Holds the last receipt so the UI can render it on open (not just on live event).
#[derive(Default)]
pub struct LastReceipt(pub std::sync::Mutex<Option<Receipt>>);

/// Sender the platform layer pushes focus changes into.
pub type FocusSender = mpsc::UnboundedSender<FocusChange>;

/// Spawn the watcher task and return a sender the platform hook feeds.
pub fn spawn(app: AppHandle) -> FocusSender {
    let (tx, rx) = mpsc::unbounded_channel::<FocusChange>();
    tauri::async_runtime::spawn(run(app, rx));
    tx
}

async fn run(app: AppHandle, mut rx: mpsc::UnboundedReceiver<FocusChange>) {
    // The candidate app we're waiting to see held for DEBOUNCE.
    let mut pending: Option<PendingFocus> = None;
    // The app we've most recently emitted for (for coalescing heartbeats).
    let mut current_tool: Option<String> = None;
    let mut next_heartbeat: Option<Instant> = None;

    // Poll a short tick so we can act on the debounce/heartbeat timers even
    // while no new focus change arrives.
    let mut tick = time::interval(Duration::from_secs(1));

    loop {
        tokio::select! {
            maybe = rx.recv() => {
                match maybe {
                    Some(change) => {
                        // A new frontmost app resets the debounce clock. If it's
                        // the same tool we're already emitting, keep the current
                        // heartbeat cadence (no reset).
                        let mapped = resolve(&app, &change.bundle_id);
                        match mapped {
                            Some(event) => {
                                let same = current_tool.as_deref() == Some(event.tool.as_str());
                                if same {
                                    // still on the same tool; nothing to debounce
                                    pending = None;
                                } else {
                                    pending = Some(PendingFocus {
                                        event,
                                        fire_at: Instant::now() + DEBOUNCE,
                                    });
                                }
                            }
                            None => {
                                // switched to an unknown / unticked app — stop
                                // heartbeating the old one (it's no longer front).
                                pending = None;
                                current_tool = None;
                                next_heartbeat = None;
                            }
                        }
                    }
                    None => break, // channel closed
                }
            }
            _ = tick.tick() => {
                let now = Instant::now();

                // Debounce elapsed → promote pending to current and emit.
                if let Some(p) = pending.take() {
                    if now >= p.fire_at {
                        let event = p.event.now();
                        deliver_and_report(&app, &event).await;
                        current_tool = Some(event.tool.clone());
                        next_heartbeat = Some(now + HEARTBEAT);
                    } else {
                        pending = Some(p); // not yet
                    }
                }

                // Heartbeat coalescing → keep the office lit for the held tool.
                if let (Some(tool), Some(hb)) = (current_tool.clone(), next_heartbeat) {
                    if now >= hb {
                        // Re-resolve to honor a config change (e.g. app just
                        // got un-ticked → stop emitting).
                        if let Some(bundle) = current_bundle_for_tool(&app, &tool) {
                            if let Some(event) = resolve(&app, &bundle) {
                                let event = event.now();
                                deliver_and_report(&app, &event).await;
                                next_heartbeat = Some(now + HEARTBEAT);
                            } else {
                                current_tool = None;
                                next_heartbeat = None;
                            }
                        } else {
                            // no reverse lookup available; just re-emit the tool
                            next_heartbeat = Some(now + HEARTBEAT);
                        }
                    }
                }
            }
        }
    }
}

struct PendingFocus {
    event: ActivityEvent,
    fire_at: Instant,
}

impl ActivityEvent {
    /// Stamp `occurred_at` at send time.
    fn now(&self) -> ActivityEvent {
        let mut e = self.clone();
        e.occurred_at = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        e
    }
}

/// Classify + gate a bundle id into an emittable event, or None if it should be
/// dropped (unknown app, or known-but-not-allowlisted).
fn resolve(app: &AppHandle, bundle_id: &str) -> Option<ActivityEvent> {
    let config = app.state::<ConfigState>().snapshot();
    if !config.enabled {
        return None;
    }
    // opt-in gate: must be explicitly ticked
    if !config.allowlist.get(bundle_id).copied().unwrap_or(false) {
        return None;
    }
    let mapping = classify(bundle_id)?;
    Some(ActivityEvent {
        tool: mapping.tool.to_string(),
        category: mapping.category.to_string(),
        object: mapping.object.to_string(),
        // A held foreground app is, by definition, active work.
        status: "working".to_string(),
        occurred_at: String::new(), // stamped at send
    })
}

/// Reverse lookup: which bundle id maps to a tool (for heartbeat re-resolution).
/// Cheap linear scan over the small catalog.
fn current_bundle_for_tool(_app: &AppHandle, tool: &str) -> Option<String> {
    crate::catalog::DEFAULT_CATALOG
        .iter()
        .find(|m| m.tool == tool)
        .map(|m| m.bundle_id.to_string())
}

async fn deliver_and_report(app: &AppHandle, event: &ActivityEvent) {
    let config = app.state::<ConfigState>().snapshot();
    let token = match config::read_token(app) {
        Some(t) if !t.is_empty() => t,
        _ => {
            log::warn!("no ingest token set — dropping event");
            return;
        }
    };
    let name = config
        .name
        .clone()
        .unwrap_or_else(|| "Desktop".to_string());

    // never block forever; a failed POST is dropped, not queued.
    let delivered = network::deliver(
        &config.endpoint,
        &token,
        &config.install_id,
        &name,
        event,
    )
    .await
    .unwrap_or_else(|e| {
        log::warn!("ingest POST failed (dropped): {e}");
        false
    });

    let receipt = Receipt {
        tool: event.tool.clone(),
        category: event.category.clone(),
        status: event.status.clone(),
        occurred_at: event.occurred_at.clone(),
        delivered,
    };

    // stash + surface the live receipt to the UI
    if let Some(state) = app.try_state::<LastReceipt>() {
        *state.0.lock().unwrap() = Some(receipt.clone());
    }
    let _ = app.emit("receipt", receipt);
}
