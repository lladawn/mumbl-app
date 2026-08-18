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
//!                 apps the user explicitly opted into, plus a shape-only
//!                 `detail` line. Default posture is share-NOTHING.

mod catalog;
mod config;
mod network;
mod platform;
mod watcher;

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
fn get_last_receipt(app: AppHandle) -> Option<Receipt> {
    app.state::<LastReceipt>().0.lock().unwrap().clone()
}

// ---- app ------------------------------------------------------------------

pub fn run() {
    tauri::Builder::default()
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

            // Menubar app: don't keep a dock icon / window on launch.
            #[cfg(target_os = "macos")]
            {
                use tauri::ActivationPolicy;
                app.set_activation_policy(ActivationPolicy::Accessory);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_catalog,
            get_config,
            save_config,
            set_enabled,
            set_allow,
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

    let _tray = TrayIconBuilder::with_id("mumbl-tray")
        .icon(app.default_window_icon().unwrap().clone())
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
