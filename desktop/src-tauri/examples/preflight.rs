//! THROWAWAY PRE-FLIGHT HARNESS — not part of the shipping app.
//!
//! Proves the capture -> classify -> POST pipeline end-to-end against a LIVE
//! ingest endpoint, using the app's OWN real modules:
//!
//!   1. `platform::start_focus_watcher` — the real macOS NSWorkspace detection
//!      of the frontmost app's bundle id (SHAPE only).
//!   2. `catalog::classify` — the real bundle-id -> tool/category/object table.
//!   3. `network::deliver` — the real ingest envelope + POST.
//!
//! It deliberately does NOT touch the tray/webview/config-keychain layer; it
//! wires the same three real modules the running app wires, just driven by a
//! plain `main()` so it can run headlessly.
//!
//! Run:
//!   cargo run --example preflight -- \
//!     http://127.0.0.1:3000/api/agents/ingest  <token>  "Preflight Mac"
//!
//! Exits 0 if the POST was accepted (2xx), non-zero otherwise.

use std::sync::mpsc;
use std::time::Duration;

use mumbl_helper_lib::catalog::{self, classify};
use mumbl_helper_lib::network;
use mumbl_helper_lib::platform;
use mumbl_helper_lib::watcher::ActivityEvent;

#[tokio::main]
async fn main() {
    let mut args = std::env::args().skip(1);
    let endpoint = args
        .next()
        .unwrap_or_else(|| "http://127.0.0.1:3000/api/agents/ingest".to_string());
    let token = args.next().unwrap_or_default();
    let display_name = args.next().unwrap_or_else(|| "Preflight Mac".to_string());

    if token.is_empty() {
        eprintln!("usage: preflight <endpoint> <token> [display_name]");
        std::process::exit(2);
    }

    // ---- 1. REAL detection: capture the actual frontmost bundle id ----------
    // start_focus_watcher spins the real NSWorkspace observer thread and emits
    // the current frontmost app once at startup. We grab that first signal.
    let (tx, rx) = mpsc::channel::<String>();
    platform::start_focus_watcher(move |change| {
        // best-effort; ignore if the receiver already got its one value
        let _ = tx.send(change.bundle_id);
    });

    let detected = rx.recv_timeout(Duration::from_secs(3)).ok();
    match &detected {
        Some(b) => println!("[detect] real frontmost bundle id: {b}"),
        None => println!("[detect] no frontmost bundle id emitted within 3s"),
    }

    // ---- 2. REAL classification --------------------------------------------
    // Try to classify what we actually detected. If the frontmost app isn't in
    // the catalog (common in a headless/agent context), fall back to a known
    // catalog entry so the POST still exercises the real classify + envelope.
    // Either way we report exactly what happened.
    let (bundle_id, mapping) = match detected.as_deref().and_then(|b| classify(b).map(|m| (b, m)))
    {
        Some((b, m)) => {
            println!("[classify] detected app IS in catalog: {} -> {}/{}", b, m.tool, m.category);
            (b.to_string(), m)
        }
        None => {
            // Fallback: a definitely-known bundle id, classified by the REAL table.
            let fallback = "com.apple.Terminal";
            let m = classify(fallback).expect("terminal must be in catalog");
            println!(
                "[classify] detected app not in catalog (or none detected); \
                 using known fallback bundle {fallback} -> {}/{} to exercise the POST",
                m.tool, m.category
            );
            (fallback.to_string(), m)
        }
    };

    // Sanity: prove classify() rejects an unknown id (SHAPE gate).
    assert!(
        classify("com.example.definitely.unknown").is_none(),
        "classify must drop unknown apps"
    );
    println!("[classify] catalog has {} known apps", catalog::DEFAULT_CATALOG.len());

    // ---- 3. Build the REAL activity event + deliver via REAL network module -
    let event = ActivityEvent {
        tool: mapping.tool.to_string(),
        label: mapping.label.to_string(),
        category: mapping.category.to_string(),
        object: mapping.object.to_string(),
        status: "working".to_string(),
        occurred_at: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    };

    // Stable-ish install id so re-runs update the same actor row.
    let install_id = "preflight-harness";
    println!(
        "[deliver] POST {} as actor desktop:{} name={:?} tool={} category={} (bundle {})",
        endpoint, install_id, display_name, event.tool, event.category, bundle_id
    );

    match network::deliver(&endpoint, &token, install_id, &display_name, &event).await {
        Ok(true) => {
            println!("[deliver] OK: ingest accepted (2xx)");
            std::process::exit(0);
        }
        Ok(false) => {
            eprintln!("[deliver] REJECTED: ingest returned non-2xx");
            std::process::exit(1);
        }
        Err(e) => {
            eprintln!("[deliver] TRANSPORT ERROR: {e}");
            std::process::exit(1);
        }
    }
}
