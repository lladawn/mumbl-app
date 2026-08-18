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

/// Non-secret config, serialized to the plugin-store JSON.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Config {
    pub endpoint: String,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    pub enabled: bool,
    /// Stable per-install id, used in the actor id (`desktop:<install_id>`).
    #[serde(rename = "installId")]
    pub install_id: String,
    /// Opt-in map: bundle_id -> allowed. Absent/false == dropped.
    #[serde(default)]
    pub allowlist: BTreeMap<String, bool>,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            endpoint: DEFAULT_ENDPOINT.to_string(),
            slug: None,
            name: None,
            // default posture: sharing is OFF until the user configures + enables.
            enabled: false,
            install_id: uuid::Uuid::new_v4().to_string(),
            allowlist: BTreeMap::new(),
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
    app.manage(ConfigState { inner: Mutex::new(config) });
    Ok(())
}

pub fn view(app: &AppHandle) -> ConfigView {
    let config = app.state::<ConfigState>().snapshot();
    ConfigView {
        has_token: read_token(app).map(|t| !t.is_empty()).unwrap_or(false),
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
            write_token(&token)?;
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

// ---- keychain -------------------------------------------------------------

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|e| e.to_string())
}

pub fn write_token(token: &str) -> Result<(), String> {
    entry()?.set_password(token).map_err(|e| e.to_string())
}

pub fn read_token(_app: &AppHandle) -> Option<String> {
    match entry() {
        Ok(e) => match e.get_password() {
            Ok(t) => Some(t),
            Err(keyring::Error::NoEntry) => None,
            Err(_) => None,
        },
        Err(_) => None,
    }
}
