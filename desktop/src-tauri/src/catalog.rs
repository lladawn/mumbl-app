//! Bundle-id → category classification table.
//!
//! This is the whole "coverage" of the helper: a macOS app bundle id (or, as a
//! fallback, a process name) mapped to the SHAPE fields the office renders from
//! — `tool`, `category`, `object`. Categories are the fixed vocabulary the
//! server enforces (`ACTIVITY_CATEGORIES` in src/server/agentPresence.js):
//!   coding | design | writing | call | music | review | browsing | focus | agent
//!
//! An app not in this table is UNKNOWN and is dropped — the helper never leaks
//! a raw app name. Being *in* this table is not enough either: the user must
//! also opt the app into their allowlist (see config.rs). Opt-in only.

use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct AppMapping {
    #[serde(rename = "bundleId")]
    pub bundle_id: &'static str,
    /// Human label for the allowlist UI.
    pub label: &'static str,
    /// SHAPE — plaintext, safe to render/share.
    pub tool: &'static str,
    /// SHAPE — one of the fixed category vocabulary.
    pub category: &'static str,
    /// SHAPE — office-object hint (renderer owns final placement). May be empty.
    pub object: &'static str,
}

/// The shipped default allowlist candidates. Sensible, conservative, opt-in.
pub const DEFAULT_CATALOG: &[AppMapping] = &[
    // ---- coding ----
    m("com.microsoft.VSCode", "VS Code", "vscode", "coding", "coding-desk"),
    m("com.apple.dt.Xcode", "Xcode", "xcode", "coding", "coding-desk"),
    m("com.jetbrains.intellij", "IntelliJ IDEA", "intellij", "coding", "coding-desk"),
    m("com.jetbrains.pycharm", "PyCharm", "pycharm", "coding", "coding-desk"),
    m("com.todesktop.230313mzl4w4u92", "Cursor", "cursor", "coding", "coding-desk"),
    m("dev.zed.Zed", "Zed", "zed", "coding", "coding-desk"),
    m("com.sublimetext.4", "Sublime Text", "sublime", "coding", "coding-desk"),
    m("com.apple.Terminal", "Terminal", "terminal", "coding", "coding-desk"),
    m("com.googlecode.iterm2", "iTerm", "iterm", "coding", "coding-desk"),
    m("com.mitchellh.ghostty", "Ghostty", "ghostty", "coding", "coding-desk"),
    m("dev.warp.Warp-Stable", "Warp", "warp", "coding", "coding-desk"),
    // ---- design ----
    m("com.figma.Desktop", "Figma", "figma", "design", "design-table"),
    m("com.bohemiancoding.sketch3", "Sketch", "sketch", "design", "design-table"),
    m("com.adobe.Photoshop", "Photoshop", "photoshop", "design", "design-table"),
    m("com.adobe.illustrator", "Illustrator", "illustrator", "design", "design-table"),
    // ---- call / meeting ----
    m("us.zoom.xos", "Zoom", "zoom", "call", "meeting-room"),
    m("com.microsoft.teams2", "Microsoft Teams", "teams", "call", "meeting-room"),
    m("com.hnc.Discord", "Discord", "discord", "call", "meeting-room"),
    m("com.google.Chrome.app.meet", "Google Meet", "meet", "call", "meeting-room"),
    // ---- music ----
    m("com.spotify.client", "Spotify", "spotify", "music", "record-player"),
    m("com.apple.Music", "Apple Music", "apple-music", "music", "record-player"),
    // ---- chat -> browsing bucket's sibling; chat isn't a distinct category, map to focus's peer ----
    // Slack/chat: the office self-assembles a lounge from `browsing`; chat is
    // most naturally shown there in v1. (Kept out of `focus` so it reads as
    // "social/coordination" rather than heads-down.)
    m("com.tinyspeck.slackmacgap", "Slack", "slack", "browsing", "reading-nook"),
    // ---- design/writing ----
    m("md.obsidian", "Obsidian", "obsidian", "writing", "writing-desk"),
    m("com.apple.Notes", "Notes", "notes", "writing", "writing-desk"),
    m("notion.id", "Notion", "notion", "writing", "writing-desk"),
    m("com.microsoft.Word", "Word", "word", "writing", "writing-desk"),
    // ---- browsing ----
    m("com.apple.Safari", "Safari", "safari", "browsing", "reading-nook"),
    m("com.google.Chrome", "Chrome", "chrome", "browsing", "reading-nook"),
    m("company.thebrowser.Browser", "Arc", "arc", "browsing", "reading-nook"),
    m("org.mozilla.firefox", "Firefox", "firefox", "browsing", "reading-nook"),
];

const fn m(
    bundle_id: &'static str,
    label: &'static str,
    tool: &'static str,
    category: &'static str,
    object: &'static str,
) -> AppMapping {
    AppMapping { bundle_id, label, tool, category, object }
}

/// Look up a mapping by bundle id. Returns None for unknown apps (which are
/// dropped, never sent).
pub fn classify(bundle_id: &str) -> Option<&'static AppMapping> {
    DEFAULT_CATALOG.iter().find(|a| a.bundle_id == bundle_id)
}
