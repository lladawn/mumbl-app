# mumbl office helper (desktop)

A tiny **Tauri v2 menubar app** that is the primary "sees all your tools" capture
layer for the mumbl pixel office. It watches which application is frontmost — the
**shape** of your work — and relays normalized, shape-only activity events to your
mumbl space so the office self-assembles from whatever you're actively using.

It is built on the exact same ingest contract as the Claude Code hook
(`scripts/mumbl-report.mjs` → `app/api/agents/ingest`): the same `Bearer <token>`
HMAC auth and the same event envelope, with the SHAPE fields `tool`/`category`/`object`
added and `source: "desktop"`.

## What it observes vs never sees (the privacy statement)

**Observes (SHAPE only):**
- Which application is **frontmost** — its macOS bundle id (e.g. `com.figma.Desktop`).
- **Focus-switch timing** — app A → app B transitions, so dwell time is derivable.

That bundle id is classified locally into a fixed vocabulary (`tool` / `category` /
`object`), and only the classification leaves the machine.

**Never sees / never sends:**
- Keystrokes, clipboard, screen pixels.
- File contents, message bodies, document text.
- **Window titles or URLs** (not even the bare domain — that's a deliberately
  deferred, separate opt-in that would require Accessibility; v1 does not).
- Raw app names of anything you haven't opted in to.

**No Accessibility permission is requested or required in v1.** The only signal used
is the public `NSWorkspace` app-activation notification, which needs no special
permission. (Enabling window-title / domain disambiguation later is a distinct,
scary opt-in — see the architecture spike §2 / risk #2.)

**Default posture: share nothing.** Sharing starts OFF. Nothing leaves the machine
until you (1) enter your ingest token, (2) tick specific apps into the allowlist,
and (3) enable sharing. Unknown or unticked apps are **dropped**, never sent.

The `detail` field in the envelope is just the shape restated (`"Figma · design"`);
it is encrypted at rest server-side and never contains a title, URL, or content.

## How it works

```
NSWorkspace fires  didActivateApplication  com.figma.Desktop   (event-driven, 0 CPU idle)
   │
   ▼  classify(bundleId) → { tool:"figma", category:"design", object:"design-table" }
   │  (unknown / not-allowlisted → dropped)
   ▼  debounce: emit only if the focus is held ≥ 20s  (kills alt-tab noise)
   ▼  coalesce: at most one heartbeat / 60s while the same tool stays focused
   ▼  POST <endpoint>   Authorization: Bearer <ingest token>
```

- **Event-driven, zero idle CPU:** subscribes to the macOS app-activation
  notification on a dedicated run-loop thread — no polling.
- **20s debounce** before anything emits; a **60s heartbeat** keeps the office lit
  without spamming (well under the server's 300/min per-space rate limit).
- **Offline / failed POSTs are dropped**, never queued forever — bounded 4s timeout,
  mirroring the hook's "never block" discipline. A missed heartbeat just means a
  slightly staler room.
- **Token in the OS keychain** (via `keyring`), never written to disk in plaintext.
  Non-secret config (endpoint, allowlist, install id) lives in a small JSON store in
  the app-data dir.

## Platform support

macOS is implemented (`src-tauri/src/platform/macos.rs`). The platform layer is a
one-function contract (`start_focus_watcher`) so Windows (Win32 foreground WinEvent
hook) and Linux (`_NET_ACTIVE_WINDOW`) can slot in behind the same signature later;
until then non-macOS builds compile with a no-op stub (`fallback.rs`).

## Run it

Prerequisites: Rust 1.77+ (tested on 1.95), Node 18+, and the
[Tauri v2 system prerequisites](https://v2.tauri.app/start/prerequisites/) (on macOS
just Xcode Command Line Tools).

```bash
cd desktop
npm install
npm run tauri dev      # or: cargo tauri dev  (from desktop/src-tauri)
```

`cargo check` (the CI gate) runs from `desktop/src-tauri`:

```bash
cd desktop/src-tauri && cargo check
```

> This is a dev/unsigned build. Code-signing & notarization are a deliberately
> deferred, human-owned decision (architecture spike risk #1) — not done here.

## Configure it

1. The app launches into the menubar (tray). Click the tray icon → **Settings…**.
2. **Connection:**
   - **Ingest endpoint URL** — defaults to `https://mumbl.wtf/api/agents/ingest`
     (the same endpoint the Claude Code hook posts to). Point it at your own
     deployment if needed.
   - **Space slug** — optional, just for your own reference.
   - **Display name** — how you appear in the office (e.g. "Disha's Mac").
   - **Ingest token** — your space's ingest token (the same value
     `MUMBL_INGEST_TOKEN` uses). Stored in the keychain. Click **Save**.
3. **Allowlist** — tick the apps you want your office to reflect. Everything is
   opt-in; nothing is shared until you tick it.
4. Click **Pause sharing / Resume sharing** (tray menu or the header button) to
   toggle. The **"What am I sharing right now?"** panel shows a live receipt of the
   last event that left the machine.

## Layout

```
desktop/
  src/                     tiny web UI (settings + allowlist + live receipt)
    index.html  main.js  styles.css
  src-tauri/
    Cargo.toml  tauri.conf.json  build.rs
    capabilities/default.json    IPC-only permissions
    src/
      main.rs      entrypoint
      lib.rs       Tauri app: tray, IPC commands, wiring
      config.rs    persisted config + keychain token
      catalog.rs   bundle-id → category classification table (the allowlist)
      network.rs   the shape-only POST envelope (matches the ingest contract)
      watcher.rs   focus → debounce/heartbeat → emit state machine
      platform/    OS focus-change detection (macos.rs + fallback.rs stub)
```
