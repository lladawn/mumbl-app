//! THROWAWAY PROOF HARNESS — not part of the shipping app.
//!
//! Drives the REAL classify() + network::deliver() path for several distinct
//! frontmost apps under ONE install id, exactly as the watcher would as the
//! user tabs between them. Proves each app lands as its own actor row.
//!
//!   cargo run --example multiapp -- <endpoint> <token> <install-id> "Owner Name"
use mumbl_helper_lib::catalog::classify;
use mumbl_helper_lib::network;
use mumbl_helper_lib::watcher::ActivityEvent;

#[tokio::main]
async fn main() {
    let mut args = std::env::args().skip(1);
    let endpoint = args.next().expect("endpoint");
    let token = args.next().expect("token");
    let install_id = args.next().unwrap_or_else(|| "multiapp-harness".to_string());
    let owner = args.next().unwrap_or_else(|| "Disha's Mac".to_string());

    // A realistic tab-around: editor -> design -> call -> music.
    let bundles = [
        "com.microsoft.VSCode",
        "com.figma.Desktop",
        "us.zoom.xos",
        "com.spotify.client",
    ];

    for b in bundles {
        let m = classify(b).expect("bundle in catalog");
        let event = ActivityEvent {
            tool: m.tool.to_string(),
            label: m.label.to_string(),
            category: m.category.to_string(),
            object: m.object.to_string(),
            status: "working".to_string(),
            occurred_at: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        };
        let okr = network::deliver(&endpoint, &token, &install_id, &owner, &event).await;
        println!(
            "[send] {b} -> actor desktop:{install_id}:{} name={:?} => {:?}",
            event.tool, event.label, okr
        );
    }
}
