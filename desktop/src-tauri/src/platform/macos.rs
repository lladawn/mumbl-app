//! macOS focus watcher.
//!
//! Event-driven: subscribes to `NSWorkspace.sharedWorkspace`'s
//! `didActivateApplicationNotification`, which fires exactly when the frontmost
//! application changes (app A → app B). Zero CPU while nothing switches — no
//! polling loop. We read ONLY `bundleIdentifier` off the activated app (the
//! SHAPE); we never touch AXUIElement / window titles, so NO Accessibility
//! permission is required in v1.
//!
//! The notification is delivered on the workspace's notification center, which
//! requires a live run loop. We spin a dedicated thread that installs the
//! observer and runs its own NSRunLoop, so the watcher is independent of the
//! Tauri/webview main loop.

use std::ptr::NonNull;
use std::sync::Arc;

use block2::RcBlock;
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2_app_kit::{NSRunningApplication, NSScreen, NSWorkspace};
use objc2_foundation::{ns_string, NSNotification, NSRunLoop, NSString};

use super::FocusChange;

pub fn start_focus_watcher<F>(on_change: F)
where
    F: Fn(FocusChange) + Send + Sync + 'static,
{
    let on_change = Arc::new(on_change);

    // The observer must live on a thread with a running run loop for the
    // NSWorkspace notification center to deliver activation notifications.
    std::thread::Builder::new()
        .name("mumbl-focus-watcher".into())
        .spawn(move || unsafe {
            // Emit the current frontmost app once at startup so a long-held
            // focus (already active before we launched) still counts.
            if let Some(app) = frontmost_bundle_id() {
                on_change(FocusChange { bundle_id: app });
            }

            let workspace = NSWorkspace::sharedWorkspace();
            let center = workspace.notificationCenter();

            let cb = on_change.clone();
            let block = RcBlock::new(move |notif: NonNull<NSNotification>| {
                let notif = notif.as_ref();
                if let Some(bundle_id) = bundle_id_from_notification(notif) {
                    cb(FocusChange { bundle_id });
                }
            });

            // addObserverForName:object:queue:usingBlock: — nil queue means the
            // block runs on the posting thread (this run loop's thread). We keep
            // the returned observer alive for the life of the thread.
            let _observer = center.addObserverForName_object_queue_usingBlock(
                Some(ns_string!("NSWorkspaceDidActivateApplicationNotification")),
                None,
                None,
                &block,
            );

            // Run this thread's run loop forever so notifications keep arriving.
            let run_loop = NSRunLoop::currentRunLoop();
            run_loop.run();

            // Keep the observer/block alive until the (never-returning) run loop
            // exits.
            drop(_observer);
        })
        .expect("spawn focus watcher thread");
}

/// True when this NSRunningApplication is US.
///
/// The helper shows and focuses its own Settings window on launch, so without
/// this it observes ITSELF as the frontmost app and posts a station for the
/// helper — an `other`/"Heads-down" desk in the user's office that represents no
/// work at all. Comparing PROCESS IDs rather than bundle ids is deliberate: a
/// dev build run straight from `target/debug` has no bundle identifier, so a
/// bundle-id comparison would silently fail to match in exactly the build we
/// develop against.
unsafe fn is_self(app: &NSRunningApplication) -> bool {
    app.processIdentifier() == std::process::id() as i32
}

/// Pull the activated app's bundle id out of the notification's userInfo.
/// The key is `NSWorkspaceApplicationKey`, whose value is an NSRunningApplication.
unsafe fn bundle_id_from_notification(notif: &NSNotification) -> Option<String> {
    let user_info = notif.userInfo()?;
    let key: &NSString = ns_string!("NSWorkspaceApplicationKey");
    let value: Retained<AnyObject> = user_info.objectForKey(key)?;
    // The value is an NSRunningApplication; reinterpret the retained pointer.
    let app: &NSRunningApplication = &*(Retained::as_ptr(&value) as *const NSRunningApplication);
    if is_self(app) {
        return None;
    }
    bundle_id_of(app)
}

/// Current frontmost app's bundle id (used once at startup).
unsafe fn frontmost_bundle_id() -> Option<String> {
    let workspace = NSWorkspace::sharedWorkspace();
    let app = workspace.frontmostApplication()?;
    if is_self(&app) {
        return None;
    }
    bundle_id_of(&app)
}

unsafe fn bundle_id_of(app: &NSRunningApplication) -> Option<String> {
    let bundle: Retained<NSString> = app.bundleIdentifier()?;
    Some(bundle.to_string())
}

/// Describe the menubar's usable geometry on the main display.
///
/// Why this exists: "the tray icon isn't showing" has recurred, and the icon
/// itself was healthy every time. On a notched MacBook the status-item strip is
/// split in two — `auxiliaryTopRightArea` is the only part that holds icons, and
/// macOS fills it RIGHT TO LEFT, so the newest item (us) lands hard against the
/// notch and is the first thing hidden when the bar fills up. Logging the real
/// numbers at boot makes that diagnosable from the log instead of by guesswork.
pub fn menubar_report() -> Option<String> {
    // NSScreen is main-thread-only; MainThreadMarker::new() returns None off it.
    let mtm = objc2_foundation::MainThreadMarker::new()?;
    let screen = NSScreen::mainScreen(mtm)?;
    // SAFETY: plain geometry reads on the main thread (guaranteed by `mtm`).
    let notch_inset = unsafe { screen.safeAreaInsets() }.top;
    if notch_inset <= 0.0 {
        return Some("menubar: no notch on the main display — the whole bar holds status icons".into());
    }
    // objc2-app-kit maps this as a plain CGRect (zero-rect when there is no
    // split bar), not an Option — the no-notch case already returned above.
    let right = unsafe { screen.auxiliaryTopRightArea() };
    Some(format!(
        "menubar: THIS DISPLAY HAS A NOTCH (safe-area top {notch_inset:.0}pt). \
Status icons only fit in x={:.0}..{:.0}; anything pushed left of {:.0} is hidden UNDER THE NOTCH. \
macOS fills that strip right-to-left and the newest item goes leftmost, so a crowded bar hides \
this one first — Cmd-drag it rightward to give it a stable slot.",
        right.origin.x,
        right.origin.x + right.size.width,
        right.origin.x,
    ))
}
