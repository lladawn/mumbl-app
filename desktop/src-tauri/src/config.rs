//! Local, persisted configuration + secret handling.
//!
//! Non-secret config (endpoint, slug, name, enabled flag, per-app allowlist,
//! install id) lives in a tauri-plugin-store JSON file in the app data dir.
//! The ingest token is a SECRET and is kept in the OS keychain (via `keyring`),
//! never written to that JSON — the store only remembers *whether* a token is
//! set, so the UI can show "stored" without ever reading it back to disk.

use std::collections::BTreeMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Wry};
use tauri_plugin_store::{Store, StoreExt};

const STORE_FILE: &str = "mumbl-helper.json";
const KEYRING_SERVICE: &str = "wtf.mumbl.helper";
const KEYRING_ACCOUNT: &str = "ingest-token";

pub const DEFAULT_ENDPOINT: &str = "https://mumbl.wtf/api/agents/ingest";

fn default_true() -> bool {
    true
}

/// Non-secret config, serialized to the plugin-store JSON.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Config {
    pub endpoint: String,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    /// Global sharing switch. Defaults to ON (opt-out posture). Missing in an
    /// older stored config → treated as the new default (true).
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Stable per-install id, used in the actor id (`desktop:<install_id>`).
    #[serde(rename = "installId")]
    pub install_id: String,
    /// Sharing mode. `true` (default) = SHARE ALL apps, opt OUT specific ones
    /// via `muted`. `false` = classic opt-IN, only apps ticked in `allowlist`.
    /// Missing in an older stored config → treated as the new default (true).
    #[serde(rename = "shareAll", default = "default_true")]
    pub share_all: bool,
    /// Opt-IN map (used when `share_all` is false): bundle_id -> allowed.
    /// Absent/false == dropped.
    #[serde(default)]
    pub allowlist: BTreeMap<String, bool>,
    /// Also show a Dock icon, so the app is reachable when the menubar icon
    /// cannot be found.
    ///
    /// DEFAULTS TO FALSE, and the reason is not taste — it is that a Dock icon
    /// costs the popover its ability to appear over a fullscreen app.
    ///
    /// A Dock icon means `ActivationPolicy::Regular`, and a Regular app CANNOT
    /// draw over another app's fullscreen Space no matter what window level or
    /// collection behaviour it asks for. Measured directly, same window, same
    /// level 101, same CanJoinAllSpaces|FullScreenAuxiliary, only the policy
    /// changed:
    ///     regular   -> never appears on screen at all
    ///     accessory -> appears at stack index 0, over the fullscreen app
    ///
    /// This briefly defaulted to true as a workaround for a menubar icon the
    /// user could not find. That workaround silently broke the more important
    /// behaviour, so the default goes back to the correct posture for a menubar
    /// app and the escape hatch stays available with its cost spelled out.
    #[serde(rename = "showInDock", default)]
    pub show_in_dock: bool,
    /// One-shot marker for the `show_in_dock` default correction below. Not a
    /// user setting — it exists so the correction runs exactly once and never
    /// overrides a choice the user makes afterwards.
    #[serde(rename = "dockDefaultCorrected", default)]
    pub dock_default_corrected: bool,
    /// Opt-OUT set (used when `share_all` is true): bundle_id -> muted.
    /// A bundle id mapped to `true` here is hidden even though share-all is on.
    #[serde(default)]
    pub muted: BTreeMap<String, bool>,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            endpoint: DEFAULT_ENDPOINT.to_string(),
            slug: None,
            name: None,
            // default posture: SHARE ALL (opt-out). Sharing is ON by default;
            // every detected app is shared as shape unless the user mutes it.
            enabled: true,
            install_id: uuid::Uuid::new_v4().to_string(),
            share_all: true,
            show_in_dock: false,
            dock_default_corrected: true,
            allowlist: BTreeMap::new(),
            muted: BTreeMap::new(),
        }
    }
}

/// What we hand the UI — Config plus a `hasToken` boolean (never the token).
#[derive(Clone, Debug, Serialize)]
pub struct ConfigView {
    #[serde(flatten)]
    pub config: Config,
    #[serde(rename = "hasToken")]
    pub has_token: bool,
    /// Why sharing is or isn't possible. `has_token` alone cannot say whether
    /// the answer is "connect" or "try again".
    #[serde(rename = "tokenState")]
    pub token_state: TokenState,
    /// The OS's own words, shown only in Advanced — useful in a bug report,
    /// meaningless to most people.
    #[serde(rename = "tokenDetail", skip_serializing_if = "Option::is_none")]
    pub token_detail: Option<String>,
}

/// Partial update from the UI. `token: Some("")` is treated as "leave as-is"
/// upstream; `token: Some(non-empty)` writes the keychain.
#[derive(Debug, Deserialize)]
pub struct ConfigPatch {
    pub endpoint: Option<String>,
    pub slug: Option<String>,
    pub name: Option<String>,
    pub token: Option<String>,
}

/// In-memory cache guarded by a mutex; the store is the source of truth on disk.
pub struct ConfigState {
    inner: Mutex<Config>,
    /// The ingest token, read from the keychain ONCE per run and held here.
    ///
    /// Why this exists: every keychain read is an authorization decision by the
    /// OS, and a dev/unsigned build has no stable code identity for the item's
    /// ACL to trust, so macOS re-prompts for the login-keychain password on
    /// EVERY read. The send path used to read on every event plus the 60s
    /// heartbeat, which turned into a password prompt every minute or two. The
    /// hot path must never touch the keychain — it reads this instead.
    ///
    /// `loaded` distinguishes "not read yet" from "read, and there is no token".
    /// Without it a machine with no token would re-read the keychain on every
    /// send, which is exactly the prompt storm this cache exists to stop.
    token: Mutex<TokenCache>,
}

#[derive(Default)]
struct TokenCache {
    loaded: bool,
    value: Option<String>,
    /// WHY the value is None, which is not the same question as whether it is.
    ///
    /// This used to collapse into a bare `Option`, and that collapse is exactly
    /// why the app could sit there sharing nothing and say nothing: "you have
    /// never connected" and "the OS refused to let me read your token" both
    /// arrived as None, so neither could be reported. They need completely
    /// different words and completely different buttons.
    blocked: Option<String>,
}

/// Why the helper is or is not sharing, in the words the UI needs.
#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum TokenState {
    /// The keychain read is in flight — usually an OS prompt on screen.
    Loading,
    /// We have a token.
    Present,
    /// No token has ever been stored. The answer is to connect.
    Missing,
    /// A token may well exist; the OS would not let us read it. The answer is
    /// to retry, not to reconnect.
    Blocked,
}

impl ConfigState {
    pub fn snapshot(&self) -> Config {
        self.inner.lock().unwrap().clone()
    }
}

fn store(app: &AppHandle) -> Result<std::sync::Arc<Store<Wry>>, String> {
    app.store(STORE_FILE).map_err(|e| e.to_string())
}

fn load_from_store(app: &AppHandle) -> Config {
    let Ok(store) = store(app) else {
        return Config::default();
    };
    match store.get("config") {
        Some(v) => serde_json::from_value(v).unwrap_or_default(),
        None => Config::default(),
    }
}

fn persist(app: &AppHandle, config: &Config) -> Result<(), String> {
    let store = store(app)?;
    store.set(
        "config",
        serde_json::to_value(config).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())
}

/// Initialize config state during setup. Ensures an install id exists and is
/// persisted so the actor id is stable across launches.
pub fn init(app: &AppHandle) -> Result<(), String> {
    let mut config = load_from_store(app);
    if config.install_id.is_empty() {
        config.install_id = uuid::Uuid::new_v4().to_string();
    }
    // ONE-SHOT CORRECTION. `show_in_dock` briefly shipped defaulting to TRUE and
    // that value is now sitting in users' config files — including for people
    // who never chose it. It is not a harmless preference: a Dock icon means
    // ActivationPolicy::Regular, and a Regular app cannot draw over another
    // app's fullscreen Space, so the popover silently stopped floating over
    // everything. Clear it once, then never touch it again, so anyone who
    // genuinely wants the Dock icon can switch it on and have it stick.
    if !config.dock_default_corrected {
        if config.show_in_dock {
            log::info!(
                "correcting the show_in_dock default to OFF (it blocked the popover from \
appearing over fullscreen apps); turn it back on from Advanced if you want the Dock icon"
            );
        }
        config.show_in_dock = false;
        config.dock_default_corrected = true;
    }

    // Derive the display name instead of asking for it. Only ever filled when
    // blank, so a name the user set by hand is never overwritten.
    if config.name.as_deref().unwrap_or("").trim().is_empty() {
        let derived = default_display_name();
        log::info!("display name auto-filled from this Mac: {derived:?}");
        config.name = Some(derived);
    }
    persist(app, &config)?;

    app.manage(ConfigState {
        inner: Mutex::new(config),
        token: Mutex::new(TokenCache::default()),
    });

    // Read the keychain OFF THE STARTUP PATH. It used to happen right here, and
    // because an unsigned build triggers an OS authorization prompt, the whole
    // app — tray, popover and character — sat frozen behind a modal dialog until
    // somebody clicked it. The character is supposed to be the one thing that
    // works with no token, no space and no network; blocking its launch on a
    // credential it never uses was exactly backwards.
    //
    // Still eager, just not blocking: the prompt appears at launch (where
    // "Always Allow" makes sense) while the UI comes up immediately. `token()`
    // takes the same lock, so a send that lands mid-read waits for this one read
    // rather than starting a second and prompting twice.
    let handle = app.clone();
    std::thread::spawn(move || {
        let Some(state) = handle.try_state::<ConfigState>() else { return };
        let mut cache = state.token.lock().unwrap();
        if cache.loaded {
            return;
        }
        let read = read_token_from_keychain();
        cache.value = read.value;
        cache.blocked = read.blocked;
        cache.loaded = true;
        let found = cache.value.is_some();
        log::info!(
            "ingest token {} — cached for this run, keychain not read again",
            if found { "loaded from keychain" } else { "not set in keychain" }
        );
        drop(cache);
        // The UI rendered "not connected" while the read was in flight; correct it.
        if found {
            let _ = handle.emit("config-changed", ());
        }
    });
    Ok(())
}

pub fn view(app: &AppHandle) -> ConfigView {
    let config = app.state::<ConfigState>().snapshot();
    let (token_state, token_detail) = token_state_now(app);
    ConfigView {
        has_token: token_state == TokenState::Present,
        token_state,
        token_detail,
        config,
    }
}

/// The UI's view of the token, without ever blocking on the keychain.
///
/// Same `try_lock` discipline as `has_token_now`: if the startup read is in
/// flight (an OS prompt is on screen) this reports `Loading` and returns
/// immediately rather than freezing the popover behind a modal.
fn token_state_now(app: &AppHandle) -> (TokenState, Option<String>) {
    let Some(handle) = app.try_state::<ConfigState>() else {
        return (TokenState::Loading, None);
    };
    let state = handle.inner();
    match state.token.try_lock() {
        Ok(cache) if !cache.loaded => (TokenState::Loading, None),
        Ok(cache) => {
            if cache.value.as_deref().map(|t| !t.is_empty()).unwrap_or(false) {
                (TokenState::Present, None)
            } else if let Some(detail) = cache.blocked.clone() {
                (TokenState::Blocked, Some(detail))
            } else {
                (TokenState::Missing, None)
            }
        }
        // Read in flight — the lock is held by it.
        Err(_) => (TokenState::Loading, None),
    }
}

/// Read the keychain again, without relaunching the app.
///
/// The whole reason this exists: the keychain prompt appears once at launch, and
/// if it is dismissed the helper spends the ENTIRE run unable to send anything.
/// Before this, the only cure was quitting and reopening the app — which is not
/// a thing anyone would guess to do, because nothing told them there was a
/// problem. Runs off the main thread so the prompt cannot freeze the popover.
pub fn retry_token_read(app: &AppHandle) {
    let handle = app.clone();
    std::thread::spawn(move || {
        let Some(state) = handle.try_state::<ConfigState>() else { return };
        {
            let mut cache = state.token.lock().unwrap();
            let read = read_token_from_keychain();
            cache.value = read.value;
            cache.blocked = read.blocked;
            cache.loaded = true;
            log::info!(
                "keychain re-read on request: {}",
                if cache.value.is_some() { "token found" }
                else if cache.blocked.is_some() { "still blocked" }
                else { "no token stored" }
            );
        }
        let _ = handle.emit("config-changed", ());
    });
}

/// Non-blocking "is a token set?" for the UI.
///
/// Deliberately `try_lock`: if the startup keychain read is still in flight
/// (i.e. the OS prompt is on screen) this reports `false` and returns
/// immediately rather than freezing the popover behind a modal dialog. The read
/// emits `config-changed` when it lands, so the UI corrects itself a moment
/// later. A momentarily wrong "not connected" beats a hung window.
fn has_token_now(app: &AppHandle) -> bool {
    let Some(state) = app.try_state::<ConfigState>() else { return false };
    let found = match state.token.try_lock() {
        Ok(cache) => cache.value.as_deref().map(|t| !t.is_empty()).unwrap_or(false),
        Err(_) => false,
    };
    found
}

pub fn apply_patch(app: &AppHandle, patch: ConfigPatch) -> Result<ConfigView, String> {
    {
        let state = app.state::<ConfigState>();
        let mut config = state.inner.lock().unwrap();
        if let Some(e) = patch.endpoint {
            if !e.is_empty() {
                config.endpoint = e;
            }
        }
        config.slug = patch.slug.filter(|s| !s.is_empty()).or(config.slug.clone());
        config.name = patch.name.filter(|s| !s.is_empty()).or(config.name.clone());
        persist(app, &config)?;
    }
    // token: only a non-empty value writes the keychain; empty means untouched.
    if let Some(token) = patch.token {
        if !token.is_empty() {
            write_token(app, &token)?;
        }
    }
    Ok(view(app))
}

pub fn set_enabled(app: &AppHandle, enabled: bool) -> Result<Config, String> {
    let state = app.state::<ConfigState>();
    let mut config = state.inner.lock().unwrap();
    config.enabled = enabled;
    persist(app, &config)?;
    Ok(config.clone())
}

pub fn set_allow(app: &AppHandle, bundle_id: String, allowed: bool) -> Result<Config, String> {
    let state = app.state::<ConfigState>();
    let mut config = state.inner.lock().unwrap();
    config.allowlist.insert(bundle_id, allowed);
    persist(app, &config)?;
    Ok(config.clone())
}

/// Toggle the share-all (opt-out) vs opt-in posture.
pub fn set_share_all(app: &AppHandle, share_all: bool) -> Result<Config, String> {
    let state = app.state::<ConfigState>();
    let mut config = state.inner.lock().unwrap();
    config.share_all = share_all;
    persist(app, &config)?;
    Ok(config.clone())
}

/// Show or hide the Dock icon.
pub fn set_show_in_dock(app: &AppHandle, show: bool) -> Result<Config, String> {
    let state = app.state::<ConfigState>();
    let mut config = state.inner.lock().unwrap();
    config.show_in_dock = show;
    persist(app, &config)?;
    Ok(config.clone())
}

/// Mute (opt out) or unmute a specific app while share-all is on.
/// `muted == true` hides the app; `false` shares it again.
pub fn set_muted(app: &AppHandle, bundle_id: String, muted: bool) -> Result<Config, String> {
    let state = app.state::<ConfigState>();
    let mut config = state.inner.lock().unwrap();
    config.muted.insert(bundle_id, muted);
    persist(app, &config)?;
    Ok(config.clone())
}

/// The name this machine should show up as in the office, derived from macOS
/// rather than asked for. `scutil --get ComputerName` returns the friendly name
/// the user already chose in System Settings ("Disha's MacBook Pro"), which is
/// exactly the label they'd have typed. Falls back to the network hostname and
/// finally to a generic, so this never blocks setup.
pub fn default_display_name() -> String {
    #[cfg(target_os = "macos")]
    {
        if let Ok(out) = std::process::Command::new("/usr/sbin/scutil")
            .arg("--get")
            .arg("ComputerName")
            .output()
        {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !name.is_empty() {
                return name;
            }
        }
        if let Ok(out) = std::process::Command::new("/bin/hostname").arg("-s").output() {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !name.is_empty() {
                return name;
            }
        }
    }
    "My Mac".to_string()
}

// ---- keychain -------------------------------------------------------------

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|e| e.to_string())
}

/// Persist the token to the keychain AND refresh the in-memory cache, so the
/// send path picks up a freshly-saved token without ever reading back.
pub fn write_token(app: &AppHandle, token: &str) -> Result<(), String> {
    entry()?.set_password(token).map_err(|e| e.to_string())?;
    if let Some(state) = app.try_state::<ConfigState>() {
        let mut cache = state.token.lock().unwrap();
        cache.value = Some(token.to_string());
        cache.loaded = true;
    }
    log::info!("ingest token saved to keychain and cached");
    Ok(())
}

/// The ingest token for this run — served from memory.
///
/// THE HOT PATH CALLS THIS. It must not hit the keychain: see `ConfigState::token`
/// for why (unsigned build → no trusted ACL identity → a password prompt on every
/// single read). `init` seeds the cache at launch; this only falls back to the
/// keychain if the cache is still empty, which happens when no token was set at
/// launch and one has since been written by something other than `write_token`.
/// A successful lazy read is memoized, so that fallback can fire at most once
/// with a token present.
pub fn token(app: &AppHandle) -> Option<String> {
    let state = app.try_state::<ConfigState>()?;
    // Blocks only if the startup read is still in flight, which is the point:
    // waiting on that one read is how we avoid starting a second one.
    let mut cache = state.token.lock().unwrap();
    if !cache.loaded {
        let read = read_token_from_keychain();
        cache.value = read.value;
        cache.blocked = read.blocked;
        cache.loaded = true;
    }
    cache.value.clone()
}

/// The ONLY place that talks to the keychain for a read. Everything else goes
/// through `token()`.
struct TokenRead {
    value: Option<String>,
    /// Set when the keychain could not be READ, as opposed to being empty.
    blocked: Option<String>,
}

fn read_token_from_keychain() -> TokenRead {
    // Every keychain read is an OS authorization decision and, on an unsigned
    // build, a potential password prompt. Counting them makes "the hot path
    // never reads" an observable fact in the log rather than a claim.
    static READS: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let n = READS.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
    log::info!("keychain read #{n} (service={KEYRING_SERVICE} account={KEYRING_ACCOUNT})");

    match entry() {
        Ok(e) => match e.get_password() {
            Ok(t) => TokenRead { value: Some(t), blocked: None },
            // Genuinely nothing stored — this machine has never connected.
            Err(keyring::Error::NoEntry) => TokenRead { value: None, blocked: None },
            // Refused, dismissed, or otherwise unreadable. A token may exist; we
            // just cannot see it. Reported as BLOCKED so the UI offers a retry
            // instead of telling the user to connect an office they already have.
            Err(e) => {
                log::warn!("keychain read failed: {e} — helper will share NOTHING until this is answered");
                TokenRead { value: None, blocked: Some(e.to_string()) }
            }
        },
        Err(e) => {
            log::warn!("keychain entry unavailable: {e} — helper will share NOTHING");
            TokenRead { value: None, blocked: Some(e.to_string()) }
        }
    }
}
