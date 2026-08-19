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
//!   - SHARE-ALL (default, opt-OUT): every frontmost app is emitted except ones
//!     the user muted. Catalogued apps use their mapping; unknown apps get a
//!     fixed GENERIC shape (`other`/`focus`) — SHAPE ONLY, no app name leaves.
//!   - OPT-IN mode (share_all == false): an app is emitted only if it's on the
//!     user's allowlist AND in the classification table. Else dropped.
//!   - PAUSED (enabled == false) → nothing leaves the machine at all.

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
    /// Station name for this app ("VS Code"). Shipped label, never the raw app
    /// name of an uncatalogued app — see catalog::GENERIC_LABEL.
    pub label: String,
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
    log::info!("focus watcher starting");
    tauri::async_runtime::spawn(run(app, rx));
    tx
}

async fn run(app: AppHandle, mut rx: mpsc::UnboundedReceiver<FocusChange>) {
    // The candidate app we're waiting to see held for DEBOUNCE.
    let mut pending: Option<PendingFocus> = None;
    // The app we've most recently emitted for (for coalescing heartbeats). We
    // keep its BUNDLE ID, not just its tool: the heartbeat re-resolves from the
    // bundle id, which works for catalogued and uncatalogued apps alike.
    let mut current: Option<CurrentFocus> = None;
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
                                let same = current.as_ref().map(|c| c.tool.as_str())
                                    == Some(event.tool.as_str());
                                if same {
                                    // still on the same tool; nothing to debounce
                                    pending = None;
                                } else {
                                    pending = Some(PendingFocus {
                                        bundle_id: change.bundle_id.clone(),
                                        event,
                                        fire_at: Instant::now() + DEBOUNCE,
                                    });
                                }
                            }
                            None => {
                                // switched to an unknown / unticked app — stop
                                // heartbeating the old one (it's no longer front).
                                pending = None;
                                current = None;
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
                        current = Some(CurrentFocus {
                            bundle_id: p.bundle_id.clone(),
                            tool: event.tool.clone(),
                        });
                        next_heartbeat = Some(now + HEARTBEAT);
                    } else {
                        pending = Some(p); // not yet
                    }
                }

                // Heartbeat coalescing → keep the office lit for the held app.
                //
                // This re-resolves from the BUNDLE ID we recorded when the app
                // became current. The previous version looked the bundle id back
                // up FROM THE TOOL by scanning the catalog, which silently broke
                // share-all: an uncatalogued app emits the generic tool `other`,
                // no catalog row has that tool, so the lookup failed and the
                // branch reset the timer WITHOUT emitting. An unknown app the
                // user sat in went stale after STALE_MS and its station walked
                // out of the office while they were still working in it.
                if let (Some(cur), Some(hb)) = (current.clone(), next_heartbeat) {
                    if now >= hb {
                        // Re-resolving (rather than replaying the old event) is
                        // what honours a config change — muting the app or
                        // pausing sharing makes this return None and stops it.
                        if let Some(event) = resolve(&app, &cur.bundle_id) {
                            let event = event.now();
                            deliver_and_report(&app, &event).await;
                            next_heartbeat = Some(now + HEARTBEAT);
                        } else {
                            current = None;
                            next_heartbeat = None;
                        }
                    }
                }
            }
        }
    }
}

struct PendingFocus {
    /// Kept so the heartbeat can re-resolve this exact app later.
    bundle_id: String,
    event: ActivityEvent,
    fire_at: Instant,
}

/// The app we are currently heartbeating for.
#[derive(Clone)]
struct CurrentFocus {
    bundle_id: String,
    tool: String,
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
/// dropped.
///
/// Two postures (see config.rs):
///   - share_all == true  (default, opt-OUT): emit for EVERY frontmost app
///     EXCEPT ones the user muted. Catalogued apps use their mapping; unknown
///     apps get a fixed GENERIC shape (`other`/`focus`) so they still light up
///     the office — SHAPE ONLY, the raw app name never leaves.
///   - share_all == false (opt-IN): only apps ticked in the allowlist AND in
///     the catalog are emitted; everything else is dropped (classic posture).
fn resolve(app: &AppHandle, bundle_id: &str) -> Option<ActivityEvent> {
    let config = app.state::<ConfigState>().snapshot();
    if !config.enabled {
        return None;
    }

    let mapping = if config.share_all {
        // opt-out gate: dropped only if the user explicitly muted this app.
        if config.muted.get(bundle_id).copied().unwrap_or(false) {
            return None;
        }
        // catalogued → real shape; unknown → fixed generic shape.
        match classify(bundle_id) {
            Some(m) => m.to_classification(),
            None => crate::catalog::generic_classification(),
        }
    } else {
        // opt-in gate: must be explicitly ticked AND known.
        if !config.allowlist.get(bundle_id).copied().unwrap_or(false) {
            return None;
        }
        classify(bundle_id)?.to_classification()
    };

    Some(ActivityEvent {
        tool: mapping.tool,
        label: mapping.label,
        category: mapping.category,
        object: mapping.object,
        // A held foreground app is, by definition, active work.
        status: "working".to_string(),
        occurred_at: String::new(), // stamped at send
    })
}


async fn deliver_and_report(app: &AppHandle, event: &ActivityEvent) {
    let config = app.state::<ConfigState>().snapshot();
    // Cached in memory — deliberately NOT a keychain read. Reading here fired
    // an OS password prompt on every heartbeat; see config::ConfigState::token.
    let token = match config::token(app) {
        Some(t) if !t.is_empty() => t,
        _ => {
            log::warn!("no ingest token set — dropping event");
            return;
        }
    };
    // The station's NAME is the app ("Figma"); the user's configured name rides
    // along as the role so we still know whose machine a station belongs to.
    let owner = config
        .name
        .clone()
        .unwrap_or_else(|| "Desktop".to_string());

    // never block forever; a failed POST is dropped, not queued.
    let delivered = network::deliver(
        &config.endpoint,
        &token,
        &config.install_id,
        &owner,
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
