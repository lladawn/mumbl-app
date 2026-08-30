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
pub mod config;
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

/// Which window is the popover right now.
///
/// It is not always the one from tauri.conf.json: reaching a fullscreen Space
/// requires building a NEW window (see `rebuild_popover`), and `destroy()` frees
/// a label asynchronously — reusing "main" immediately fails with "a webview
/// with label `main` already exists". So each rebuild takes a fresh label and
/// this is where the current one lives.
struct PopoverLabel(Mutex<String>);

impl Default for PopoverLabel {
    fn default() -> Self {
        Self(Mutex::new("main".to_string()))
    }
}

/// The popover window, whatever it is currently called.
fn popover_window(app: &AppHandle) -> Option<WebviewWindow> {
    let label = app.try_state::<PopoverLabel>()?.0.lock().unwrap().clone();
    app.get_webview_window(&label)
}

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
///
/// Measured, not guessed: the observed focus hand-backs after a status-item
/// click landed 1-2s after show(), so 600ms was still letting the popover
/// dismiss itself. Anything the user does deliberately takes longer than this.
const OPEN_GRACE: Duration = Duration::from_millis(2000);
use watcher::{DeliveryError, LastReceipt, Receipt};

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

/// Shut the helper down. The ONE place that ends the process.
///
/// Both the tray menu and the popover's footer control come through here, so
/// there is a single shutdown path rather than two that can drift apart.
///
/// Quitting is NOT disconnecting: the office, the pairing and the stored token
/// are all untouched, and reopening the app resumes exactly where it left off.
/// Revoking a device's access is a different act that lives in the web UI (see
/// pairing::REQUIRED_BACKEND), and the two must never be worded as if they were
/// the same thing.
fn quit_helper(app: &AppHandle) {
    log::info!("quitting on request — nothing is disconnected, the token stays put");
    app.exit(0);
}

/// Quit from the popover. Same path as the tray menu's Quit.
#[tauri::command]
fn quit_app(app: AppHandle) {
    quit_helper(&app);
}

/// Is this endpoint a development server on this machine?
///
/// Host-based, not a substring match on the whole URL: a path or query that
/// merely contains "localhost" is not a local endpoint, and a real deployment
/// should never be misreported as one.
fn is_local_endpoint(endpoint: &str) -> bool {
    let host = endpoint
        .split("://")
        .nth(1)
        .unwrap_or(endpoint)
        .split(['/', '?', '#'])
        .next()
        .unwrap_or("")
        .rsplit('@')
        .next()
        .unwrap_or("");
    // An IPv6 literal is bracketed and full of colons, so the port has to come
    // off the brackets, not off the first colon.
    let host = match host.strip_prefix('[') {
        Some(rest) => rest.split(']').next().unwrap_or(""),
        None => host.split(':').next().unwrap_or(""),
    };
    matches!(host, "localhost" | "127.0.0.1" | "::1" | "0.0.0.0") || host.ends_with(".local")
}

/// Why the helper is not sharing right now, in one shape the UI can render.
///
/// Sharing can fail at three separate points and, before this, ALL THREE were
/// silent: paused, no readable token, and a POST that never lands. The office
/// just looked empty. Whichever is true, this says so.
#[tauri::command]
fn get_sharing_health(app: AppHandle) -> SharingHealth {
    let view = config::view(&app);
    let delivery_error = app
        .try_state::<DeliveryError>()
        .and_then(|s| s.0.lock().unwrap().clone());
    SharingHealth {
        local_endpoint: is_local_endpoint(&view.config.endpoint),
        enabled: view.config.enabled,
        token_state: view.token_state,
        token_detail: view.token_detail,
        endpoint: view.config.endpoint,
        delivery_error,
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SharingHealth {
    /// Pointed at a dev server on this machine rather than at mumbl.
    ///
    /// Worth saying out loud even when delivery is fine: a local endpoint only
    /// answers while `npm run dev` is running, so the office goes quiet the
    /// moment that stops — with nothing obviously broken to look at.
    local_endpoint: bool,
    enabled: bool,
    token_state: config::TokenState,
    token_detail: Option<String>,
    endpoint: String,
    delivery_error: Option<String>,
}

/// Read the keychain again without relaunching — the cure for a dismissed
/// launch prompt, which otherwise silences the helper for the whole run.
#[tauri::command]
fn retry_token(app: AppHandle) {
    log::info!("keychain re-read requested from the popover");
    config::retry_token_read(&app);
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
        .manage(DeliveryError::default())
        .manage(PopoverGuard::default())
        .manage(PopoverLabel::default())
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

            // Dock icon or not — and this is load-bearing, not cosmetic. A Dock
            // icon means ActivationPolicy::Regular, and a Regular app cannot
            // draw over another app's fullscreen Space at ANY window level. So
            // the default is Accessory (menubar-only), which is both the
            // intended posture and the only one where the popover actually
            // floats over everything.
            #[cfg(target_os = "macos")]
            apply_dock_policy(&handle, handle.state::<config::ConfigState>().snapshot().show_in_dock);

            // Closing the Settings window should HIDE it (not destroy it), so
            // the tray "Settings…" item can reliably re-show it and closing the
            // window never quits the app.
            if let Some(win) = app.get_webview_window("main") {
                wire_popover(&win);
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

            // ---- the character ------------------------------------------------
            // A second, tiny, transparent window parked in the menubar strip just
            // right of the notch — the one band of screen a window never covers.
            //
            // It has NO CLICK TARGET (set_ignore_cursor_events): every click goes
            // straight through to whatever is underneath. You cannot be
            // interrupted by something you cannot interact with, and that is the
            // whole calm constraint in one call.
            if let Some(ch) = app.get_webview_window("character") {
                let _ = ch.set_ignore_cursor_events(true);
                let _ = ch.set_visible_on_all_workspaces(true);
                #[cfg(target_os = "macos")]
                if let Ok(ns) = ch.ns_window() {
                    platform::float_above_everything(ns);
                }
                place_character(&ch);
                // Only appear if the bar is actually there. Showing
                // unconditionally raced the watcher, which had already hidden it
                // for a fullscreen app a moment earlier — the character would
                // pop back up and then stay up, because the watcher only acts on
                // a CHANGE and the state had not changed again.
                if platform::menubar_visible() {
                    let _ = ch.show();
                    log::info!("character shown in the menubar strip");
                } else {
                    log::info!("character staying hidden — a fullscreen app has the menubar");
                }
            } else {
                log::warn!("character window not found at setup");
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
            retry_token,
            quit_app,
            get_sharing_health,
            set_show_in_dock,
            pair_begin,
            pair_poll,
            pair_required_backend,
        ])
        .build(tauri::generate_context!())
        .expect("error while building mumbl helper")
        .run(|app, event| match event {
            // Closing the popover must not quit a background helper -- but a
            // DELIBERATE quit must still work.
            //
            // `code` is the difference and it is load-bearing: None means the
            // exit came from user interaction (the last window closed), Some(_)
            // means someone called app.exit() on purpose. Preventing BOTH, which
            // is what this used to do, silently disabled Quit -- the tray menu
            // item has never actually quit the app. Nothing surfaced it because
            // prevent_exit fails quietly: the menu closes, the app stays, and it
            // looks like the click simply missed.
            tauri::RunEvent::ExitRequested { code, api, .. } => {
                if code.is_none() {
                    api.prevent_exit();
                }
            }
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
            "quit" => quit_helper(app),
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

/// Everything a popover window needs to behave like a popover, applied fresh
/// each time one is created. Extracted because the window is REBUILT when it
/// cannot reach the user's current Space (see `rebuild_popover`), and a rebuilt
/// window with no event wiring would never dismiss itself.
fn wire_popover(win: &WebviewWindow) {
    // Raise it above every other app, fullscreen ones included.
    #[cfg(target_os = "macos")]
    if let Ok(ns) = win.ns_window() {
        platform::float_above_everything(ns);
    }
    // Follow the user across Spaces rather than staying pinned to the one the
    // popover happened to be created on.
    let _ = win.set_visible_on_all_workspaces(true);

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
}

/// Destroy the popover window and build an identical one.
///
/// THIS IS THE FIX FOR "the popover does not appear over fullscreen apps", and
/// it is not the fix anyone would guess. A window Tauri creates from
/// tauri.conf.json is pinned to the Space it was born on, PERMANENTLY. No
/// property changes that: measured on the live window, level 25/101/1000,
/// six collection-behaviour combinations, style-mask changes, dropping the
/// window delegate, re-ordering across run-loop turns, and swapping the window's
/// class to NSPanel ALL leave `isOnActiveSpace` false while a fullscreen app is
/// frontmost. In the same process, at the same instant, a window created
/// *while that Space is active* joins it immediately — a plain NSWindow and a
/// freshly built Tauri window both do.
///
/// So the only thing that works is to build a new window. The webview reloads,
/// which is why this is done ONLY when the window could not reach the user —
/// never on an ordinary open.
fn rebuild_popover(app: &AppHandle) -> Option<WebviewWindow> {
    if let Some(old) = popover_window(app) {
        let _ = old.destroy();
    }
    // A fresh label every time: `destroy()` releases the old one asynchronously,
    // so reusing it in the same breath fails outright.
    static NEXT: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(1);
    let label = format!(
        "popover-{}",
        NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    );
    let built = tauri::WebviewWindowBuilder::new(
        app,
        &label,
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("mumbl office helper")
    .inner_size(360.0, 470.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .shadow(true)
    .skip_taskbar(true)
    .visible(false)
    .build();
    match built {
        Ok(win) => {
            if let Some(state) = app.try_state::<PopoverLabel>() {
                *state.0.lock().unwrap() = label;
            }
            wire_popover(&win);
            Some(win)
        }
        Err(e) => {
            log::error!("could not rebuild the popover window: {e}");
            None
        }
    }
}

/// Gap between the bottom of the menubar and the top of the popover.
const GAP_BELOW_MENUBAR: f64 = 6.0;
/// Keep this much clear of the screen edge when the tray icon sits near it.
const EDGE_MARGIN: f64 = 8.0;
/// Logical y for the no-tray-frame fallback: just below a standard menubar.
const MENUBAR_FALLBACK_Y: f64 = 26.0;

fn show_popover(app: &AppHandle, rect: Option<Rect>) {
    let Some(win) = popover_window(app).or_else(|| rebuild_popover(app)) else {
        log::error!("no popover window and none could be built");
        return;
    };
    // Fall back to asking the tray for its own frame — this is the path taken
    // when the popover is opened from the menu or on launch rather than a click.
    let rect = rect.or_else(|| app.tray_by_id("mumbl-tray").and_then(|t| t.rect().ok().flatten()));
    if let Some(guard) = app.try_state::<PopoverGuard>() {
        *guard.shown_at.lock().unwrap() = Some(Instant::now());
        *guard.focused_once.lock().unwrap() = false;
    }

    present_popover(&win, rect);

    // Did it actually land where the user is looking? A popover summoned while a
    // fullscreen app is frontmost lands on the Space the window was BORN on,
    // which is not the one in front of the user — see `rebuild_popover` for why
    // no property fixes that. Rebuilding is the only thing that does, so do it
    // here and only here: on the open that would otherwise have shown nothing.
    #[cfg(target_os = "macos")]
    {
        let reachable = win
            .ns_window()
            .map(|ns| platform::window_on_active_space(ns))
            .unwrap_or(true);
        if !reachable {
            log::info!("popover landed on another Space — rebuilding it on this one");
            if let Some(fresh) = rebuild_popover(app) {
                present_popover(&fresh, rect);
                if let Ok(ns) = fresh.ns_window() {
                    log::info!("popover rebuilt — {}", platform::window_state(ns));
                }
            }
        } else if let Ok(ns) = win.ns_window() {
            log::info!("popover presented — {}", platform::window_state(ns));
        }
    }

    if rect.is_none() {
        log::warn!("popover shown WITHOUT a tray rect — falling back to its last position");
    }
}

/// Position, show, focus, and force forward — the sequence every open uses.
///
/// Order matters. Setting level/collection-behaviour BEFORE `show()` was the
/// original bug: it made the window eligible to sit over a fullscreen app, then
/// `show()`/`set_focus()` ordered it front THROUGH APP ACTIVATION, and an
/// Accessory app cannot activate over another app's fullscreen Space. The log
/// said "raised to 101" the whole time, because a level is not a guarantee of
/// being on screen. `present_above_everything` runs last and calls
/// `orderFrontRegardless`, which bypasses activation entirely.
fn present_popover(win: &WebviewWindow, rect: Option<Rect>) {
    position_popover(win, rect);
    let _ = win.show();
    let _ = win.set_focus();
    #[cfg(target_os = "macos")]
    if let Ok(ns) = win.ns_window() {
        platform::present_above_everything(ns);
    }
}

/// Park the character in the menubar strip, just right of the notch.
fn place_character(win: &WebviewWindow) {
    let scale = win.scale_factor().unwrap_or(1.0);
    let Some((strip_x, strip_h)) = platform::menubar_strip_origin() else { return };
    let Ok(size) = win.outer_size() else { return };

    // Sit inside the bar, vertically centred in it.
    let x = ((strip_x + CHARACTER_INSET) * scale).round() as i32;
    let y = (((strip_h * scale) - size.height as f64) / 2.0).max(0.0).round() as i32;
    let _ = win.set_position(PhysicalPosition::new(x, y));
    log::info!("character parked at {x},{y} physical (strip starts at x={strip_x} logical)");
}

/// Gap between the notch edge and the character.
const CHARACTER_INSET: f64 = 4.0;

fn hide_popover(app: &AppHandle) {
    if let Some(win) = popover_window(app) {
        let _ = win.hide();
        // Log every hide, not just the auto-hide. A popover that vanishes with
        // nothing in the log is indistinguishable from one that never appeared,
        // and that ambiguity cost real time chasing this bug.
        log::info!("popover hidden");
    }
}

/// Clicking the menubar icon opens the popover, clicking again dismisses it —
/// the behaviour every other menubar app has.
fn toggle_popover(app: &AppHandle, rect: Option<Rect>) {
    let Some(win) = popover_window(app) else {
        show_popover(app, rect);
        return;
    };
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
    if show_in_dock {
        log::warn!(
            "dock icon ON (policy=Regular) — reachable from the Dock and Cmd-Tab, but the \
popover can NO LONGER appear over fullscreen apps; a Regular app cannot draw over \
another app's fullscreen Space"
        );
    } else {
        log::info!("dock icon OFF (policy=Accessory) — popover can float over fullscreen apps");
    }
}

fn toggle_sharing(app: &AppHandle) {
    let current = app.state::<config::ConfigState>().snapshot().enabled;
    if let Ok(config) = config::set_enabled(app, !current) {
        let _ = app.emit("config-changed", ());
        log::info!("sharing {}", if config.enabled { "resumed" } else { "paused" });
    }
}

#[cfg(test)]
mod tests {
    use super::is_local_endpoint;

    #[test]
    fn local_hosts_are_recognised() {
        for url in [
            "http://127.0.0.1:3000/api/agents/ingest",
            "http://localhost:3000/api/agents/ingest",
            "https://localhost/api/agents/ingest",
            "http://[::1]:3000/api/agents/ingest",
            "http://0.0.0.0:8080/api/agents/ingest",
            "http://dishas-mac.local:3000/api/agents/ingest",
        ] {
            assert!(is_local_endpoint(url), "expected local: {url}");
        }
    }

    #[test]
    fn real_deployments_are_not_local() {
        for url in [
            "https://mumbl.wtf/api/agents/ingest",
            "https://staging.mumbl.wtf/api/agents/ingest",
        ] {
            assert!(!is_local_endpoint(url), "expected remote: {url}");
        }
    }

    /// The reason this is host-based rather than a substring match: a hosted
    /// deployment whose PATH mentions localhost is not a local endpoint, and
    /// telling someone to start a dev server they don't run would be worse than
    /// saying nothing.
    #[test]
    fn localhost_elsewhere_in_the_url_does_not_count() {
        assert!(!is_local_endpoint("https://mumbl.wtf/localhost/ingest"));
        assert!(!is_local_endpoint("https://mumbl.wtf/api/ingest?from=localhost"));
        assert!(!is_local_endpoint("https://not-localhost.example.com/api/ingest"));
    }
}
