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
use objc2_app_kit::{
    NSPopUpMenuWindowLevel, NSRunningApplication, NSScreen, NSWindow,
    NSWindowCollectionBehavior, NSWorkspace,
};
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

/// Make the popover float above EVERYTHING, fullscreen apps included.
///
/// `alwaysOnTop` alone is not enough on macOS, and the reason is worth stating:
/// it raises the window's LEVEL, but a fullscreen app lives on its own SPACE,
/// and level says nothing about spaces. A normal always-on-top window simply
/// stays behind on the Space it was created in. Two separate things are needed:
///
///   - level `NSPopUpMenuWindowLevel` (101) puts it above ordinary windows AND
///     above the menubar (25), which is where a menubar popover belongs.
///   - collection behaviour `CanJoinAllSpaces` makes it follow the user to
///     whichever Space is active instead of being pinned to one,
///     `FullScreenAuxiliary` grants permission to sit over a fullscreen app at
///     all, and `Stationary` stops it sliding around during Space transitions.
///
/// SAFETY: `ns_window` hands back the real NSWindow this webview is hosted in;
/// we only set two of its properties, on the main thread.
pub fn float_above_everything(ns_window: *mut std::ffi::c_void) {
    if ns_window.is_null() {
        log::warn!("no NSWindow handle — popover cannot be raised over fullscreen apps");
        return;
    }
    unsafe {
        let window: &NSWindow = &*(ns_window as *const NSWindow);
        window.setLevel(NSPopUpMenuWindowLevel);
        window.setCollectionBehavior(
            NSWindowCollectionBehavior::CanJoinAllSpaces
                | NSWindowCollectionBehavior::FullScreenAuxiliary
                | NSWindowCollectionBehavior::Stationary,
        );
    }
    log::info!(
        "popover raised: level {} (above the menubar) + joins all spaces + allowed over fullscreen",
        NSPopUpMenuWindowLevel
    );
}

/// Logical x where the usable menubar strip begins, i.e. just right of the notch
/// (or the left edge on a notchless display), plus the strip's height. The
/// character parks here — the one band of screen a window never covers.
pub fn menubar_strip_origin() -> Option<(f64, f64)> {
    let mtm = objc2_foundation::MainThreadMarker::new()?;
    let screen = NSScreen::mainScreen(mtm)?;
    let inset = unsafe { screen.safeAreaInsets() }.top;
    if inset <= 0.0 {
        // No notch: the whole bar is usable, so start a little in from the left.
        return Some((12.0, 24.0));
    }
    let right = unsafe { screen.auxiliaryTopRightArea() };
    Some((right.origin.x, right.size.height))
}

/// Is the menubar on screen right now?
///
/// There is no AppKit property for this. `NSScreen.visibleFrame` keeps its
/// menubar inset even while a fullscreen app is hiding the bar, and
/// `NSMenu::menuBarHeight` is 0 unless the receiver IS the main menu — which an
/// Accessory app has none of. Both were measured and both lied.
///
/// So we ask the window server the same question a person would: is any status
/// item actually being drawn? Status items live at kCGStatusWindowLevel (25),
/// and when a fullscreen app takes the screen EVERY one of them drops off the
/// on-screen list together. Verified against Claude, Notion, Soma and ChatGPT
/// simultaneously, so this is a property of the bar and not of one app.
pub fn menubar_visible() -> bool {
    use core_foundation::base::{CFType, TCFType};
    use core_foundation::dictionary::CFDictionary;
    use core_foundation::number::CFNumber;
    use core_foundation::string::CFString;
    use core_graphics::window::{
        copy_window_info, kCGNullWindowID, kCGWindowLayer, kCGWindowListOptionOnScreenOnly,
    };

    const STATUS_ITEM_LEVEL: i64 = 25;

    let Some(list) = copy_window_info(kCGWindowListOptionOnScreenOnly, kCGNullWindowID) else {
        // Cannot tell — assume visible rather than hiding the character on a
        // guess. Failing towards "shown" is the recoverable direction.
        return true;
    };
    let key = unsafe { CFString::wrap_under_get_rule(kCGWindowLayer) };
    for item in list.iter() {
        let dict: CFDictionary<CFString, CFType> =
            unsafe { CFDictionary::wrap_under_get_rule(*item as *const _) };
        if let Some(v) = dict.find(&key) {
            if let Some(n) = v.downcast::<CFNumber>().and_then(|n| n.to_i64()) {
                if n == STATUS_ITEM_LEVEL {
                    return true;
                }
            }
        }
    }
    false
}

/// What the window server actually thinks of this window, right now.
///
/// Setting a level and a collection behaviour is not the same as the window
/// being drawn — the popover bug was invisible for exactly this reason: the
/// code logged "raised to 101" while the window sat off-screen. `isOnActiveSpace`
/// is the property that answers the real question ("can the user see it"), and
/// it is the one worth logging.
pub fn window_state(ns_window: *mut std::ffi::c_void) -> String {
    if ns_window.is_null() {
        return "no NSWindow handle".to_string();
    }
    unsafe {
        let window: &NSWindow = &*(ns_window as *const NSWindow);
        format!(
            "level={} behavior={} visible={} key={} onActiveSpace={} hidesOnDeactivate={} canHide={}",
            window.level(),
            window.collectionBehavior().0,
            window.isVisible(),
            window.isKeyWindow(),
            window.isOnActiveSpace(),
            window.hidesOnDeactivate(),
            window.canHide(),
        )
    }
}

/// Raise AND actually put the window on screen, in that order.
///
/// `float_above_everything` only sets properties. That is enough at setup time,
/// but not at the moment a hidden popover is summoned: `show()` +
/// `makeKeyAndOrderFront` run through the app's activation, and an Accessory app
/// cannot reliably activate over another app's fullscreen Space — the window
/// ends up correctly configured and still not drawn.
///
/// `orderFrontRegardless` is the one call that does not go through activation:
/// it orders the window front whether or not this app is (or can become) the
/// active app. Combined with level 101 + `CanJoinAllSpaces` + `FullScreenAuxiliary`
/// it is what actually gets a menubar popover onto a fullscreen Space.
///
/// Order matters: set the properties FIRST, order front SECOND. Ordering a
/// window front before it has permission to sit on a fullscreen Space just
/// strands it on the Space it was created on.
pub fn present_above_everything(ns_window: *mut std::ffi::c_void) {
    if ns_window.is_null() {
        log::warn!("no NSWindow handle — popover cannot be presented over fullscreen apps");
        return;
    }
    float_above_everything(ns_window);
    unsafe {
        let window: &NSWindow = &*(ns_window as *const NSWindow);
        // A window that hides on deactivate is ordered out the moment this app
        // stops being active — and an Accessory app summoned over another app's
        // fullscreen Space is never active. That failure is invisible from the
        // code's side: we set the level, log "raised", and the window server
        // quietly drops the window with no event of ours to log.
        window.setHidesOnDeactivate(false);
        // Likewise, Hide Others / Cmd-H must not take the popover with it.
        window.setCanHide(false);
        window.orderFrontRegardless();
    }
}

/// Is this window on the Space the user is actually looking at?
///
/// This is the ONLY property that answers "can the user see it". Level and
/// collection behaviour describe what the window is *allowed* to do; this one
/// says what the window server actually did.
pub fn window_on_active_space(ns_window: *mut std::ffi::c_void) -> bool {
    if ns_window.is_null() {
        return false;
    }
    unsafe {
        let window: &NSWindow = &*(ns_window as *const NSWindow);
        window.isOnActiveSpace()
    }
}
