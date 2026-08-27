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
pub mod pairing;
#[doc(hidden)]
pub mod platform;
#[doc(hidden)]
pub mod watcher;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, Rect, WebviewWindow,
};

use std::sync::Mutex;
use std::time::{Duration, Instant};

use config::{Config, ConfigPatch, ConfigView};

/// Guards the popover against dismissing itself the moment it opens.
///
/// Clicking a status item hands focus back to whatever app was in front, so the
/// window reliably gets `Focused(false)` a beat after `show()` — which closed
/// the popover instantly, over and over, every time the user clicked the icon.
/// A blur only counts once the window has ACTUALLY held focus, and never inside
/// a short grace period after opening.
#[derive(Default)]
struct PopoverGuard {
    shown_at: Mutex<Option<Instant>>,
    focused_once: Mutex<bool>,
}

/// How long after opening to ignore a blur outright.
const OPEN_GRACE: Duration = Duration::from_millis(600);
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

/// Kick off web pairing: mint a code, open the browser at the authorize page.
/// Returns the code so the UI can show it (and so `pair_poll` can be driven).
#[tauri::command]
fn pair_begin(app: AppHandle) -> Result<serde_json::Value, String> {
    let config = config::view(&app).config;
    let origin = pairing::origin_for(&config.endpoint);
    let code = pairing::new_code();
    let name = config
        .name
        .clone()
        .unwrap_or_else(config::default_display_name);
    let url = pairing::authorize_url(&origin, &code, &name);
    log::info!("pairing started: opening {origin}/pair for {name:?}");
    pairing::open_in_browser(&url)?;
    Ok(serde_json::json!({ "code": code, "url": url, "origin": origin }))
}

/// One poll of the claim endpoint. The frontend owns the retry cadence so it can
/// show a countdown and let the user cancel; the Rust side stays stateless.
#[tauri::command]
async fn pair_poll(app: AppHandle, code: String) -> Result<serde_json::Value, String> {
    let config = config::view(&app).config;
    let origin = pairing::origin_for(&config.endpoint);
    let result = pairing::claim(&origin, &code).await;

    // On success persist immediately — the token goes to the keychain via the
    // same path a manual Save uses, so there is one storage rule, not two.
    if let pairing::ClaimResult::Authorized { token, slug, endpoint } = &result {
        config::apply_patch(
            &app,
            config::ConfigPatch {
                endpoint: endpoint.clone(),
                slug: slug.clone(),
                name: None,
                token: Some(token.clone()),
            },
        )?;
        let _ = app.emit("config-changed", ());
        log::info!("pairing complete — token stored, office connected");
    }
    serde_json::to_value(result).map_err(|e| e.to_string())
}

/// What the backend still owes us, surfaced in the UI when pairing is stubbed.
#[tauri::command]
fn pair_required_backend() -> &'static str {
    pairing::REQUIRED_BACKEND
}

#[tauri::command]
fn set_show_in_dock(app: AppHandle, show: bool) -> Result<Config, String> {
    let config = config::set_show_in_dock(&app, show)?;
    #[cfg(target_os = "macos")]
    apply_dock_policy(&app, show);
    let _ = app.emit("config-changed", ());
    Ok(config)
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
        .manage(PopoverGuard::default())
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

            // Dock icon or not. A menubar-only (`Accessory`) app is the intended
            // posture, but a menubar icon that cannot be found leaves the user
            // with no way in at all — which has happened repeatedly on a
            // notched MacBook with a full bar. So the Dock icon is ON by
            // default and the user can switch it off from the popover.
            #[cfg(target_os = "macos")]
            apply_dock_policy(&handle, config::view(&handle).config.show_in_dock);

            // Closing the Settings window should HIDE it (not destroy it), so
            // the tray "Settings…" item can reliably re-show it and closing the
            // window never quits the app.
            if let Some(win) = app.get_webview_window("main") {
                let win_for_events = win.clone();
                win.on_window_event(move |event| match event {
                    // Closing hides rather than destroys, so the tray can always
                    // bring the popover back and closing never quits the app.
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = win_for_events.hide();
                    }
                    // A popover dismisses itself the moment you click away —
                    // that is the whole difference between a popover and a
                    // window, and it is why this is not just a resized window.
                    tauri::WindowEvent::Focused(true) => {
                        if let Some(g) = win_for_events.app_handle().try_state::<PopoverGuard>() {
                            *g.focused_once.lock().unwrap() = true;
                        }
                    }
                    tauri::WindowEvent::Focused(false) => {
                        let app = win_for_events.app_handle();
                        let Some(guard) = app.try_state::<PopoverGuard>() else { return };
                        let opened_just_now = guard
                            .shown_at
                            .lock()
                            .unwrap()
                            .map(|t| t.elapsed() < OPEN_GRACE)
                            .unwrap_or(false);
                        let held_focus = *guard.focused_once.lock().unwrap();
                        // Losing focus before we ever had it (or within the grace
                        // window) is the status-item click handing focus back, not
                        // the user clicking away.
                        if opened_just_now || !held_focus {
                            log::info!("ignoring blur right after open (status-item focus hand-back)");
                            return;
                        }
                        let _ = win_for_events.hide();
                        log::info!("popover auto-hidden (user clicked away)");
                    }
                    _ => {}
                });

                // First run has nothing to click yet and the menubar icon can be
                // hidden under the notch on a crowded bar, so open the popover
                // once on launch — anchored under the tray icon like any other
                // open, not floating in the middle of the screen.
                let handle_for_launch = handle.clone();
                std::thread::spawn(move || {
                    // The tray needs a beat to acquire its menubar slot before
                    // rect() reports a real frame to anchor against.
                    std::thread::sleep(std::time::Duration::from_millis(400));
                    let _ = handle_for_launch.clone().run_on_main_thread(move || {
                        show_popover(&handle_for_launch, None);
                        log::info!("popover opened on launch (anchored under the tray icon)");
                    });
                });
            } else {
                log::error!("main webview window not found at setup — popover unavailable");
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
            set_show_in_dock,
            pair_begin,
            pair_poll,
            pair_required_backend,
        ])
        .build(tauri::generate_context!())
        .expect("error while building mumbl helper")
        .run(|app, event| match event {
            // Closing the popover must not quit a background helper.
            tauri::RunEvent::ExitRequested { api, .. } => api.prevent_exit(),
            // Clicking the Dock tile (or picking the app in Cmd-Tab) is the
            // fallback way in when the menubar icon cannot be found, so it has
            // to actually reopen the popover.
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } => {
                log::info!("reopened from the Dock — showing the popover");
                show_popover(app, None);
            }
            _ => {}
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
            "open" => show_popover(app, None),
            "toggle" => toggle_sharing(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Click fires for BOTH press and release; acting on Up only stops a
            // single click from toggling the popover twice.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                toggle_popover(tray.app_handle(), Some(rect));
            }
        })
        .build(app)?;
    log::info!("tray built (menubar icon installed)");
    if let Some(report) = platform::menubar_report() {
        log::info!("{report}");
    }
    Ok(())
}

/// Park the window directly under the menubar icon, dropdown-style.
///
/// `rect` is the tray item's own frame, handed to us by the click event (and
/// available from `TrayIcon::rect()` when we open the popover without a click).
/// Everything is done in PHYSICAL pixels: the tray rect and the window position
/// are both physical, so converting through logical coordinates would only
/// introduce a rounding error on a Retina display.
fn position_popover(win: &WebviewWindow, rect: Option<Rect>) {
    let scale = win.scale_factor().unwrap_or(1.0);
    let Ok(size) = win.outer_size() else { return };

    let Some(rect) = rect else {
        // No tray frame (icon missing, or opened from the Dock). Keeping the
        // last position risks parking it off-screen — the very failure mode
        // this whole change exists to prevent — so fall back to the top-right
        // of the current display, under the menubar.
        if let Ok(Some(monitor)) = win.current_monitor() {
            let mon = monitor.position();
            let mon_size = monitor.size();
            let x = (mon.x + mon_size.width as i32) - size.width as i32 - (EDGE_MARGIN * scale) as i32;
            let y = mon.y + (MENUBAR_FALLBACK_Y * scale) as i32;
            let _ = win.set_position(PhysicalPosition::new(x, y));
            log::info!("popover placed top-right at {x},{y} (no tray frame available)");
        }
        return;
    };
    let tray = rect.position.to_physical::<f64>(scale);
    let tray_size = rect.size.to_physical::<f64>(scale);

    // Centre the popover on the icon, then nudge it below the menubar.
    let mut x = tray.x + tray_size.width / 2.0 - size.width as f64 / 2.0;
    let y = tray.y + tray_size.height + GAP_BELOW_MENUBAR;

    // Keep it fully on screen — an icon near the right edge would otherwise
    // push half the popover off the display.
    if let Ok(Some(monitor)) = win.current_monitor() {
        let mon = monitor.position();
        let mon_size = monitor.size();
        let min_x = mon.x as f64 + EDGE_MARGIN;
        let max_x = (mon.x + mon_size.width as i32) as f64 - size.width as f64 - EDGE_MARGIN;
        if max_x > min_x {
            x = x.clamp(min_x, max_x);
        }
    }

    let (x, y) = (x.round() as i32, y.round() as i32);
    // Logged HERE, not after show(): reading outer_position() back straight
    // after set_position() races the move and reports the window's previous
    // (centred default) spot, which reads as a bug when nothing is wrong.
    log::info!(
        "popover anchored to tray icon at {x},{y} physical ({}x{})",
        size.width, size.height
    );
    let _ = win.set_position(PhysicalPosition::new(x, y));
}

/// Gap between the bottom of the menubar and the top of the popover.
const GAP_BELOW_MENUBAR: f64 = 6.0;
/// Keep this much clear of the screen edge when the tray icon sits near it.
const EDGE_MARGIN: f64 = 8.0;
/// Logical y for the no-tray-frame fallback: just below a standard menubar.
const MENUBAR_FALLBACK_Y: f64 = 26.0;

fn show_popover(app: &AppHandle, rect: Option<Rect>) {
    let Some(win) = app.get_webview_window("main") else { return };
    // Fall back to asking the tray for its own frame — this is the path taken
    // when the popover is opened from the menu or on launch rather than a click.
    let rect = rect.or_else(|| app.tray_by_id("mumbl-tray").and_then(|t| t.rect().ok().flatten()));
    if let Some(guard) = app.try_state::<PopoverGuard>() {
        *guard.shown_at.lock().unwrap() = Some(Instant::now());
        *guard.focused_once.lock().unwrap() = false;
    }
    position_popover(&win, rect);
    let _ = win.show();
    let _ = win.set_focus();
    if rect.is_none() {
        log::warn!("popover shown WITHOUT a tray rect — falling back to its last position");
    }
}

fn hide_popover(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
}

/// Clicking the menubar icon opens the popover, clicking again dismisses it —
/// the behaviour every other menubar app has.
fn toggle_popover(app: &AppHandle, rect: Option<Rect>) {
    let Some(win) = app.get_webview_window("main") else { return };
    if win.is_visible().unwrap_or(false) {
        hide_popover(app);
    } else {
        show_popover(app, rect);
    }
}

/// Show or hide the Dock tile. `Regular` also puts the app in Cmd-Tab, which is
/// the other place people look when a menubar icon has gone missing.
#[cfg(target_os = "macos")]
fn apply_dock_policy(app: &AppHandle, show_in_dock: bool) {
    use tauri::ActivationPolicy;
    let policy = if show_in_dock {
        ActivationPolicy::Regular
    } else {
        ActivationPolicy::Accessory
    };
    let _ = app.set_activation_policy(policy);
    log::info!(
        "dock icon {} — the app is reachable from {}",
        if show_in_dock { "ON" } else { "OFF" },
        if show_in_dock { "the Dock, Cmd-Tab and the menubar" } else { "the menubar only" }
    );
}

fn toggle_sharing(app: &AppHandle) {
    let current = config::view(app).config.enabled;
    if let Ok(config) = config::set_enabled(app, !current) {
        let _ = app.emit("config-changed", ());
        log::info!("sharing {}", if config.enabled { "resumed" } else { "paused" });
    }
}
