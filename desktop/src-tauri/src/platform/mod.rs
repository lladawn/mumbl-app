//! Platform layer — detect frontmost-app focus changes.
//!
//! The contract is deliberately tiny so Windows/Linux can be added later:
//! a `start_focus_watcher(callback)` that fires the callback with a
//! `FocusChange { bundle_id }` every time the frontmost application changes.
//! macOS is event-driven (NSWorkspace activation notifications — zero CPU when
//! idle). Other platforms currently get a no-op stub so the app still builds
//! and runs (it simply never emits focus events until a backend is added).

/// The raw OS signal: a new app became frontmost. Only its bundle id (SHAPE),
/// never a window title or content.
#[derive(Clone, Debug)]
pub struct FocusChange {
    pub bundle_id: String,
}

#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "macos")]
pub use macos::start_focus_watcher;

#[cfg(not(target_os = "macos"))]
mod fallback;

#[cfg(not(target_os = "macos"))]
pub use fallback::start_focus_watcher;
