//! mumbl office-sim desktop helper — Tauri v2 menubar app.
//!
//! Watches which app is frontmost (the SHAPE of work: bundle id → category),
//! never content, and relays normalized shape-only activity events to the mumbl
//! ingest endpoint so the user's pixel office self-assembles from whatever tools
//! they're actively using.
//!
//! PRIVACY POSTURE (v1):
//!   Observes    : which application is frontmost (bundle id), and app→app
//!                 focus-switch timing. Nothing else.
//!   Never sees  : keystrokes, clipboard, screen pixels, file contents, message
//!                 bodies, window titles, URLs. No Accessibility permission is
//!                 requested or used.
//!   Leaves box  : only the classified SHAPE (tool/category/object/status) of
//!                 the frontmost app, plus a shape-only `detail` line. Default
//!                 posture is share-ALL / opt-OUT: every app is shared as shape
//!                 unless the user mutes it (unknown apps → a generic `focus`
//!                 shape, still no app name). Switchable to opt-IN (allowlist).

// NOTE: these modules are exposed `#[doc(hidden)] pub` (rather than private)
// solely so the throwaway preflight harness in `examples/preflight.rs` can
// drive the real detection/classification/POST path against a live ingest
// endpoint. They are NOT a stable public API of the shipping app — nothing in
// the tray/webview build depends on this visibility. Safe to narrow back to
// `mod` if the harness is deleted.
#[doc(hidden)]
pub mod catalog;
mod config;
#[doc(hidden)]
pub mod network;
#[doc(hidden)]
pub mod platform;
#[doc(hidden)]
pub mod watcher;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

use config::{Config, ConfigPatch, ConfigView};
use watcher::{LastReceipt, Receipt};

// ---- IPC commands ---------------------------------------------------------

#[tauri::command]
fn get_catalog() -> Vec<serde_json::Value> {
    catalog::DEFAULT_CATALOG
        .iter()
        .map(|m| serde_json::to_value(m).unwrap())
        .collect()
}

#[tauri::command]
fn get_config(app: AppHandle) -> ConfigView {
    config::view(&app)
}

#[tauri::command]
fn save_config(app: AppHandle, patch: ConfigPatch) -> Result<ConfigView, String> {
    let view = config::apply_patch(&app, patch)?;
    let _ = app.emit("config-changed", ());
    Ok(view)
}

#[tauri::command]
fn set_enabled(app: AppHandle, enabled: bool) -> Result<Config, String> {
    let config = config::set_enabled(&app, enabled)?;
    let _ = app.emit("config-changed", ());
    Ok(config)
}

#[tauri::command]
fn set_allow(app: AppHandle, bundle_id: String, allowed: bool) -> Result<Config, String> {
    config::set_allow(&app, bundle_id, allowed)
}

#[tauri::command]
fn set_share_all(app: AppHandle, share_all: bool) -> Result<Config, String> {
    let config = config::set_share_all(&app, share_all)?;
    let _ = app.emit("config-changed", ());
    Ok(config)
}

#[tauri::command]
fn set_muted(app: AppHandle, bundle_id: String, muted: bool) -> Result<Config, String> {
    config::set_muted(&app, bundle_id, muted)
}

#[tauri::command]
fn get_last_receipt(app: AppHandle) -> Option<Receipt> {
    app.state::<LastReceipt>().0.lock().unwrap().clone()
}

// ---- app ------------------------------------------------------------------

pub fn run() {
    tauri::Builder::default()
        // Install a logger first so `log::info!`/errors surface in the
        // `tauri dev` console (silent-failure was masking tray/watcher issues).
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(LastReceipt::default())
        .setup(|app| {
            let handle = app.handle().clone();
            config::init(&handle)?;

            build_tray(&handle)?;

            // Wire the platform focus watcher into the debounce/emit state
            // machine. The watcher task holds the sender; the platform hook
            // feeds it FocusChanges.
            let tx = watcher::spawn(handle.clone());
            platform::start_focus_watcher(move |change| {
                let _ = tx.send(change);
            });

            // Menubar `Accessory` app: no dock icon. We still surface the
            // Settings window on launch (below) so the user never has to hunt
            // for a menubar tray icon that may be hidden under the notch.
            #[cfg(target_os = "macos")]
            {
                use tauri::ActivationPolicy;
                app.set_activation_policy(ActivationPolicy::Accessory);
            }

            // Closing the Settings window should HIDE it (not destroy it), so
            // the tray "Settings…" item can reliably re-show it and closing the
            // window never quits the app.
            if let Some(win) = app.get_webview_window("main") {
                let win_for_close = win.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_for_close.hide();
                        log::info!("settings window close intercepted — hidden, not destroyed");
                    }
                });

                // Show + focus the Settings window on launch so the config UI
                // appears immediately (the window is `visible:false` in
                // tauri.conf.json). No tray-hunting required.
                let _ = win.show();
                let _ = win.set_focus();
                log::info!("settings window shown on launch");
            } else {
                log::error!("main webview window not found at setup — settings UI unavailable");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_catalog,
            get_config,
            save_config,
            set_enabled,
            set_allow,
            set_share_all,
            set_muted,
            get_last_receipt,
        ])
        .build(tauri::generate_context!())
        .expect("error while building mumbl helper")
        .run(|_app, event| {
            // Keep running when the settings window is closed — it's a tray app.
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Settings…", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "toggle", "Pause / resume sharing", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit mumbl helper", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &pause, &sep, &quit])?;

    // Embed the icon at compile time (no runtime unwrap / panic risk). Log its
    // dimensions at boot so we can confirm it's not degenerate (e.g. 0x0).
    // NOTE: the menubar icon may be hidden under the notch on crowded bars —
    // the Settings window (shown on launch) is the primary entry point, so a
    // hidden tray icon is non-blocking.
    let icon = tauri::include_image!("icons/icon.png");
    log::info!(
        "tray icon embedded ({}x{})",
        icon.width(),
        icon.height()
    );

    let _tray = TrayIconBuilder::with_id("mumbl-tray")
        // Render the icon as a macOS template image so it inverts correctly for
        // light/dark menubars.
        .icon(icon)
        .icon_as_template(true)
        .tooltip("mumbl office helper")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_settings(app),
            "toggle" => toggle_sharing(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                show_settings(tray.app_handle());
            }
        })
        .build(app)?;
    log::info!("tray built (menubar icon installed)");
    if let Some(report) = platform::menubar_report() {
        log::info!("{report}");
    }
    Ok(())
}

fn show_settings(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

fn toggle_sharing(app: &AppHandle) {
    let current = config::view(app).config.enabled;
    if let Ok(config) = config::set_enabled(app, !current) {
        let _ = app.emit("config-changed", ());
        log::info!("sharing {}", if config.enabled { "resumed" } else { "paused" });
    }
}
