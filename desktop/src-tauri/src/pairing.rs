//! Web-based device pairing — the "Connect my office" button.
//!
//! The old onboarding asked for four things (endpoint URL, space slug, display
//! name, ingest token) before the app could do anything. Three of them we can
//! derive, and the fourth is a secret nobody should be copy-pasting out of a web
//! page. So the whole flow collapses to: open mumbl.wtf in the browser the user
//! is ALREADY logged into, let them click authorize, and pull the token back.
//!
//! SHAPE OF THE FLOW (short-code polling, deliberately not a `mumbl://` deep
//! link): the app mints a random pairing code, opens
//! `<origin>/pair?code=…&name=…`, then polls a claim endpoint until the browser
//! side authorizes it. Polling needs no URL-scheme registration, no extra
//! plugin, and no inbound listener on the user's machine — and if the user
//! closes the tab, the flow just times out instead of leaving a dangling
//! handler. The code is single-use and short-lived server-side.
//!
//! THE TOKEN THIS RETURNS MUST BE DEVICE-SCOPED, INGEST-ONLY AND REVOCABLE —
//! see `REQUIRED_BACKEND`. Pairing is the moment that scope gets decided, and
//! it is the reason pairing is worth building at all rather than just asking
//! the user to paste something: a pasted token is whatever the user could copy,
//! which today is the whole space.
//!
//! BACKEND IS NOT LIVE YET. Nothing under app/api/agents/pair exists, so
//! `claim` treats 404/405 as the documented "not deployed" state and reports it
//! as `Unavailable` rather than an error — the UI then points the user at the
//! Advanced disclosure to paste a token by hand. See `REQUIRED_BACKEND` for the
//! exact contract the server side has to honour.

use std::time::Duration;

use serde::{Deserialize, Serialize};

/// What the server side still needs, verbatim, so it can be built to match.
///
/// 1. `GET /pair?code=<code>&name=<display-name>` — a PAGE, not an API. The
///    user is already signed in; it shows "Connect <name> to <space>?" and an
///    Authorize button. On authorize it mints a token (see the HARD REQUIREMENT
///    below) and binds it to `code`.
///
/// 2. `POST /api/agents/pair/claim` — body `{ "code": "<code>" }`. Responses:
///      200 `{ "token": "...", "slug": "...", "endpoint": "..." }` authorized
///      202 `{}`                                     still waiting on the human
///      404                                    unknown / expired / already used
///    `endpoint` is optional; the app falls back to its default origin.
///
/// Codes should be single-use and expire in ~10 minutes. The claim route must
/// NOT require the desktop app to be authenticated — possession of the freshly
/// minted code IS the proof, which is why the code has to be short-lived.
///
/// ── HARD REQUIREMENT: THE MINTED TOKEN MUST BE DEVICE-SCOPED, INGEST-ONLY AND
/// REVOCABLE. This is part of the contract, not an optimisation, and it has to
/// be built in from the start — retrofitting scope onto tokens already handed
/// out means reissuing every one of them.
///
///   DEVICE-SCOPED  one token per paired machine, never a shared space-wide
///                  credential. Today a user pastes a token that is valid for
///                  the whole space into a desktop app; that is a far broader
///                  credential than a single Mac needs in order to say "I am in
///                  Figma".
///   INGEST-ONLY    it may POST activity to exactly one space. It must not read
///                  the office, enumerate actors, or touch the account.
///   REVOCABLE      "Disconnect this Mac" in the web UI kills that one token
///                  and nothing else.
///
/// The point of all three together is blast radius: a leaked token means
/// "somebody can post fake activity for one Mac", and revoking it costs the
/// user one click and disturbs none of their other machines.
///
/// Practically, that means `claim` returns a token bound to the pairing code's
/// device identity, and the space's own ingest token is never what travels.
pub const REQUIRED_BACKEND: &str =
    "GET /pair?code&name  +  POST /api/agents/pair/claim (token MUST be device-scoped, ingest-only, revocable)";

const CLAIM_PATH: &str = "/api/agents/pair/claim";
const TIMEOUT: Duration = Duration::from_secs(8);

/// One poll's outcome. The UI drives entirely off this.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum ClaimResult {
    /// The human authorized us — here are the credentials.
    Authorized {
        token: String,
        slug: Option<String>,
        endpoint: Option<String>,
    },
    /// Code is valid, the human just hasn't clicked yet. Keep polling.
    Pending,
    /// Code unknown, expired, or already spent. Stop polling.
    Expired,
    /// The pairing service isn't deployed. Stop polling and offer Advanced.
    Unavailable { detail: String },
}

#[derive(Deserialize)]
struct ClaimBody {
    token: Option<String>,
    slug: Option<String>,
    endpoint: Option<String>,
}

/// Derive the site origin from the configured ingest endpoint, so a staging
/// build pairs against staging rather than always sending people to production.
pub fn origin_for(endpoint: &str) -> String {
    match endpoint.find("/api/") {
        Some(i) => endpoint[..i].to_string(),
        None => "https://mumbl.wtf".to_string(),
    }
}

/// A fresh single-use pairing code. Hyphenated so it survives being read aloud
/// or retyped if the browser hand-off ever has to happen manually.
pub fn new_code() -> String {
    let raw = uuid::Uuid::new_v4().simple().to_string().to_uppercase();
    // Ambiguous glyphs removed: no O/0 or I/1 confusion when read off a screen.
    let cleaned: String = raw
        .chars()
        .filter(|c| !matches!(c, 'O' | '0' | 'I' | '1'))
        .take(8)
        .collect();
    format!("{}-{}", &cleaned[..4], &cleaned[4..])
}

/// The browser URL that authorizes this code.
pub fn authorize_url(origin: &str, code: &str, display_name: &str) -> String {
    format!(
        "{origin}/pair?code={}&name={}",
        urlencode(code),
        urlencode(display_name)
    )
}

/// Ask the server whether `code` has been authorized yet.
pub async fn claim(origin: &str, code: &str) -> ClaimResult {
    let url = format!("{origin}{CLAIM_PATH}");
    let client = match reqwest::Client::builder().timeout(TIMEOUT).build() {
        Ok(c) => c,
        Err(e) => return ClaimResult::Unavailable { detail: e.to_string() },
    };

    let resp = match client
        .post(&url)
        .json(&serde_json::json!({ "code": code }))
        .send()
        .await
    {
        Ok(r) => r,
        // No network / DNS / TLS failure. Treated as "can't pair right now"
        // rather than "expired" so the user can retry without a new code.
        Err(e) => return ClaimResult::Unavailable { detail: e.to_string() },
    };

    let status = resp.status();
    if status.as_u16() == 202 {
        return ClaimResult::Pending;
    }
    if status.is_success() {
        return match resp.json::<ClaimBody>().await {
            Ok(b) => match b.token.filter(|t| !t.is_empty()) {
                Some(token) => ClaimResult::Authorized {
                    token,
                    slug: b.slug.filter(|s| !s.is_empty()),
                    endpoint: b.endpoint.filter(|s| !s.is_empty()),
                },
                // 200 with no token yet is the same as an explicit 202.
                None => ClaimResult::Pending,
            },
            Err(e) => ClaimResult::Unavailable { detail: e.to_string() },
        };
    }
    // 404/405 is the not-deployed-yet signal; the route genuinely does not
    // exist server-side today. Anything else 4xx means the code is spent.
    if matches!(status.as_u16(), 404 | 405 | 501) {
        return ClaimResult::Unavailable {
            detail: format!("pairing service not available yet ({status}) — needs {REQUIRED_BACKEND}"),
        };
    }
    if status.is_client_error() {
        return ClaimResult::Expired;
    }
    ClaimResult::Unavailable { detail: format!("server error {status}") }
}

/// Hand a URL to the user's default browser.
///
/// `open(1)` rather than a plugin: it is the macOS-native way, needs no extra
/// dependency or capability, and the URL we pass is one we built ourselves.
pub fn open_in_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = url;
        Err("opening a browser is only wired up on macOS".to_string())
    }
}

fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*b as char)
            }
            b' ' => out.push_str("%20"),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}
