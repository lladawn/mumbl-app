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
use tauri::{AppHandle, Manager, Wry};
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
    /// `None` means "not loaded yet"; the load is lazy-once (see `token`), and
    /// `write_token` refreshes it so a Save takes effect without a re-read.
    token: Mutex<Option<String>>,
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
    persist(app, &config)?;

    // The ONE keychain read of this run. Doing it here means any OS
    // authorization prompt happens at launch (where "Always Allow" makes
    // sense to the user), never mid-session on a heartbeat.
    let token = read_token_from_keychain();
    log::info!(
        "ingest token {} — cached for this run, keychain not read again",
        if token.is_some() { "loaded from keychain" } else { "not set in keychain" }
    );

    app.manage(ConfigState {
        inner: Mutex::new(config),
        token: Mutex::new(token),
    });
    Ok(())
}

pub fn view(app: &AppHandle) -> ConfigView {
    let config = app.state::<ConfigState>().snapshot();
    ConfigView {
        has_token: token(app).map(|t| !t.is_empty()).unwrap_or(false),
        config,
    }
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

/// Mute (opt out) or unmute a specific app while share-all is on.
/// `muted == true` hides the app; `false` shares it again.
pub fn set_muted(app: &AppHandle, bundle_id: String, muted: bool) -> Result<Config, String> {
    let state = app.state::<ConfigState>();
    let mut config = state.inner.lock().unwrap();
    config.muted.insert(bundle_id, muted);
    persist(app, &config)?;
    Ok(config.clone())
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
        *state.token.lock().unwrap() = Some(token.to_string());
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
    {
        let cached = state.token.lock().unwrap();
        if cached.is_some() {
            return cached.clone();
        }
    }
    // Cache empty: nothing was in the keychain at launch. Re-checking is cheap
    // and cannot prompt while the item does not exist; the moment one does
    // exist we memoize it and never read again.
    let fresh = read_token_from_keychain();
    if fresh.is_some() {
        log::info!("ingest token loaded from keychain (cached for this run)");
        *state.token.lock().unwrap() = fresh.clone();
    }
    fresh
}

/// The ONLY place that talks to the keychain for a read. Everything else goes
/// through `token()`.
fn read_token_from_keychain() -> Option<String> {
    // Every keychain read is an OS authorization decision and, on an unsigned
    // build, a potential password prompt. Counting them makes "the hot path
    // never reads" an observable fact in the log rather than a claim.
    static READS: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let n = READS.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
    log::info!("keychain read #{n} (service={KEYRING_SERVICE} account={KEYRING_ACCOUNT})");

    match entry() {
        Ok(e) => match e.get_password() {
            Ok(t) => Some(t),
            Err(keyring::Error::NoEntry) => None,
            Err(e) => {
                log::warn!("keychain read failed: {e}");
                None
            }
        },
        Err(e) => {
            log::warn!("keychain entry unavailable: {e}");
            None
        }
    }
}
