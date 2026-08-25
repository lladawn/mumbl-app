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
- **Raw app names.** Catalogued apps leave only their classified shape; apps not
  in the catalog leave only a fixed generic `focus` shape — never the app name
  or bundle id.

**No Accessibility permission is requested or required in v1.** The only signal used
is the public `NSWorkspace` app-activation notification, which needs no special
permission. (Enabling window-title / domain disambiguation later is a distinct,
scary opt-in — see the architecture spike §2 / risk #2.)

**Default posture: share all (opt-out), shape-only, ephemeral.** Sharing is ON by
default with **"Share all my apps"** enabled: every app you bring to the front is
shared as a **shape** (its category/object), not its name. Catalogued apps use
their mapping; apps not in the catalog show up as a neutral generic `focus` shape
— still no app name. Untick any individual app to **mute** (opt out) that one. You
can flip **"Share all my apps"** OFF to switch to classic **opt-in**: then only the
apps you tick, and only catalogued ones, are shared; everything else is dropped.

Once your ingest token is set, focused apps emit automatically. Events are
**ephemeral** — a failed POST is dropped, never queued; nothing is stored locally
beyond the last live receipt.

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

## The settings window at a glance

The window is ordered as a first-run path, top to bottom:

1. **Get your office running** — a 3-step guide that appears only until a token is
   saved (paste token → keep working → watch the receipt).
2. **Status & permissions** — an at-a-glance panel that states the honest headline
   (**no special macOS permissions needed** — no Accessibility / Screen Recording /
   Input Monitoring) and shows two live checks: token set? sharing on/paused?
3. **What’s leaving this machine** — the live receipt of the last shape-only event.
4. **Connection** — endpoint / slug / display name / ingest token.
5. **Apps** — the share-all master toggle + per-app allowlist.

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
3. **Apps** — **"Share all my apps"** is ON by default: every app is shared as a
   shape. Untick any app to mute (hide) it. Flip the master toggle OFF to switch
   to opt-in, where only ticked (and catalogued) apps are shared.
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
