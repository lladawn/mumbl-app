//! Bundle-id → category classification table.
//!
//! This is the whole "coverage" of the helper: a macOS app bundle id (or, as a
//! fallback, a process name) mapped to the SHAPE fields the office renders from
//! — `tool`, `category`, `object`. Categories are the fixed vocabulary the
//! server enforces (`ACTIVITY_CATEGORIES` in src/server/agentPresence.js):
//!   coding | design | writing | call | music | review | browsing | focus | agent
//!
//! An app not in this table is UNKNOWN. In share-all (opt-out) mode it still
//! lights up the office via a fixed GENERIC shape (`other`/`focus`) — the raw
//! app name / bundle id never leaves the machine. In opt-in mode an unknown app
//! is dropped. Either way the helper never leaks a raw app name.

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
/// dropped in the opt-in path, never sent).
pub fn classify(bundle_id: &str) -> Option<&'static AppMapping> {
    DEFAULT_CATALOG.iter().find(|a| a.bundle_id == bundle_id)
}

/// The owned, shape-only classification a resolver produces for a bundle id.
/// Same SHAPE vocabulary as `AppMapping`, but owned so it can carry a generic
/// fallback for apps NOT in the catalog.
#[derive(Clone, Debug)]
pub struct Classification {
    /// SHAPE — a coarse, generic tool token. For unknown apps this is the
    /// generic `"other"` — never the raw app name / bundle id.
    pub tool: String,
    /// The shipped, hard-coded display label for this tool ("VS Code", "Figma").
    /// This is the station's name in the office. PRIVACY: it is drawn from this
    /// compiled-in table and only ever exists for apps whose `tool` token
    /// already leaves, so it carries no information the shape didn't already —
    /// an UNKNOWN app gets the fixed GENERIC_LABEL, never its real name.
    pub label: String,
    /// SHAPE — one of the fixed category vocabulary.
    pub category: String,
    /// SHAPE — office-object hint.
    pub object: String,
}

/// Generic, shape-only classification for an app NOT in the catalog. Used only
/// in share-all (opt-out) mode so unknown apps still light up the office as a
/// neutral "focus" desk. Deliberately carries NO app-identifying data — the
/// bundle id never leaves; only this fixed generic shape does.
pub const GENERIC_TOOL: &str = "other";
pub const GENERIC_CATEGORY: &str = "focus";
pub const GENERIC_OBJECT: &str = "focus-desk";
/// Station name for an app NOT in the catalog. Fixed and generic on purpose —
/// the raw app name must never leave the machine.
pub const GENERIC_LABEL: &str = "Heads-down";

pub fn generic_classification() -> Classification {
    Classification {
        tool: GENERIC_TOOL.to_string(),
        label: GENERIC_LABEL.to_string(),
        category: GENERIC_CATEGORY.to_string(),
        object: GENERIC_OBJECT.to_string(),
    }
}

impl AppMapping {
    pub fn to_classification(&self) -> Classification {
        Classification {
            tool: self.tool.to_string(),
            label: self.label.to_string(),
            category: self.category.to_string(),
            object: self.object.to_string(),
        }
    }
}
