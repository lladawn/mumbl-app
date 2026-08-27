//! Non-macOS stub. Windows (via the Win32 foreground-window hook /
//! `GetForegroundWindow` + `EVENT_SYSTEM_FOREGROUND` WinEvent hook) and Linux
//! (X11 `_NET_ACTIVE_WINDOW` property changes / Wayland is compositor-specific)
//! backends slot in here later behind the same signature. Until then this is a
//! no-op: the app builds and runs, it just never emits focus events.

use super::FocusChange;

pub fn start_focus_watcher<F>(_on_change: F)
where
    F: Fn(FocusChange) + Send + Sync + 'static,
{
    log::warn!("focus watcher not implemented on this platform yet — no events will be emitted");
}

/// No notch to report off macOS.
pub fn menubar_report() -> Option<String> {
    None
}

/// Window levels / spaces are a macOS concept; nothing to do elsewhere.
pub fn float_above_everything(_ns_window: *mut std::ffi::c_void) {}

/// Menubar geometry is a macOS concept.
pub fn menubar_strip_origin() -> Option<(f64, f64)> { None }
