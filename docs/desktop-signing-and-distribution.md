# Desktop helper: building, distributing, and (one day) signing

The mumbl helper ships **unsigned**, by decision — there is no Apple Developer
account. This document has two halves:

1. **[Today](#today-the-unsigned-build)** — how to build it, and the honest truth
   about what a person who downloads it actually experiences.
2. **[The day an account exists](#the-day-there-is-a-developer-account)** — the
   exact steps, and everything it unblocks.

The second half is written so nobody has to re-derive what was learned building
this. Several of these findings cost real time.

---

## Today: the unsigned build

### Building

```bash
cd desktop
./node_modules/.bin/tauri build
```

Artifacts land in `desktop/src-tauri/target/release/bundle/`:

| Target | Path | Use |
| --- | --- | --- |
| `app` | `macos/mumbl helper.app` | run locally, or zip it |
| `dmg` | `dmg/mumbl helper_<version>_aarch64.dmg` | what you hand someone |

`bundle.targets` is `["app", "dmg"]`. See
[Why a dmg even unsigned](#why-a-dmg-even-unsigned) for why the dmg is built now
rather than waiting for signing.

> **The trap that will bite you.** `frontendDist` assets (`desktop/src/*.html`,
> `*.js`, `*.css`) are **compiled into the binary**. Editing them and running
> `cargo build` does **not** re-embed them — the build script does not rerun on
> asset changes. Symptom: your change is simply not there, and you go hunting
> through caches. Fix: `touch src-tauri/tauri.conf.json` before building.
> `tauri build` does this correctly on its own; this bites on plain `cargo build`.

### Architecture

The build is for the host architecture only. On an Apple Silicon machine that is
`aarch64`, and the result **will not run on an Intel Mac**. For a build that runs
on both:

```bash
./node_modules/.bin/tauri build --target universal-apple-darwin
# requires: rustup target add x86_64-apple-darwin aarch64-apple-darwin
```

### `minimumSystemVersion` is 12.0, and it must stay ≥ 12.0

It used to say `10.15`, which was wrong in a way that crashes rather than
degrades. The menubar code calls `NSScreen.safeAreaInsets` and
`NSScreen.auxiliaryTopRightArea` (both **macOS 12.0+**) with no availability
guard, so on 10.15 or 11 those are unrecognised selectors and the app dies at
launch. If you ever lower this, add real availability checks first.

### The build ad-hoc signs itself, and that matters more than it sounds

`bundle.macOS.signingIdentity` is `"-"` (ad-hoc). Without it the artifact is
**worse than merely unsigned — it is broken**, and this was measured, not assumed.

On Apple Silicon the linker ad-hoc signs the *binary* automatically. But Tauri
then assembles that binary into a `.app` without re-signing the *bundle*, so the
signature does not seal the bundle's resources. Gatekeeper's verdict:

```
$ spctl --assess --type execute -vvv "mumbl helper.app"
mumbl helper.app: code has no resources but signature indicates they must be present
```

That is a **broken signature**, and it is what produces the *"is damaged and
can't be opened. You should move it to the Trash"* dialog — the message people
read as "this file is corrupt" and delete.

With `signingIdentity: "-"`, `codesign` seals the whole bundle and the verdict
becomes the ordinary one:

```
$ codesign -dvvv "mumbl helper.app"
CodeDirectory ... flags=0x10002(adhoc,runtime) hashes=1154+3
$ codesign --verify --strict "mumbl helper.app"
valid on disk / satisfies its Designated Requirement
$ spctl --assess --type execute -vvv "mumbl helper.app"
mumbl helper.app: rejected
```

`rejected` is the *normal* "not a Developer ID app" answer, and it is the one
that gives the user a recoverable **Open Anyway** path. Ad-hoc signing does not
make the app trusted — it makes it honestly untrusted instead of apparently
corrupt. It costs nothing and requires no account.

### What a recipient actually sees — and it is still bad

Be honest with people about this. An unsigned build is genuinely awkward to
install, and pretending otherwise just means they hit the wall with no warning.

When macOS downloads a file through a browser it attaches a
`com.apple.quarantine` attribute. A quarantined app with no Developer ID
signature is refused with *"mumbl helper" cannot be opened because the developer
cannot be verified.*

**On macOS 15 (Sequoia) and later, the old right-click → Open trick no longer
works for unsigned apps.** Apple removed that bypass. The current route is:

1. Double-click the app. It is refused.
2. **System Settings → Privacy & Security**, scroll to Security.
3. A line appears naming the blocked app: **Open Anyway**.
4. Authenticate, then confirm **Open Anyway** on the second dialog.

On macOS 14 and earlier, right-click → **Open** → **Open** still works.

The command-line escape hatch, for a technical recipient:

```bash
xattr -dr com.apple.quarantine "/Applications/mumbl helper.app"
```

Do not put that in user-facing copy without explaining what it does: it is
"disable the safety check for this app", and a person should only run it for
software they already trust.

### Why a dmg even unsigned

Judgement call, made deliberately:

- A dmg and a bare `.app` hit **exactly the same Gatekeeper wall**. The dmg does
  not make the experience worse.
- A `.app` cannot be handed over as-is anyway — it is a directory, so it gets
  zipped, and a zip round-trip is an extra step that also carries quarantine.
- The day signing exists, **the artifact does not change** — only a signing and
  notarization step is added. Building the dmg now means the distribution story
  is already the real one.

If the Gatekeeper wall drives people away badly enough, the answer is signing,
not switching back to a zip.

> **If the dmg step fails, delete `target/release/bundle` and build again.**
> A failed `bundle_dmg.sh` leaves a read-write `rw.*.dmg` behind in
> `bundle/macos/`, and every later run trips over it. Observed once here: the
> first dmg build failed, and a clean retry succeeded twice in a row. Deleting
> the bundle directory is the reliable reset.

### Verified, on this build

Done rather than assumed, because a release artifact is exactly where the
embedded-asset trap bites:

- `tauri build` produces both bundles from a clean `bundle/` directory.
- The dmg mounts with the expected drag-to-`/Applications` layout.
- The `.app` **copied out of the dmg to an unrelated directory launches and
  renders correctly** — pixel scene, Connect button, footer — so the frontend
  assets really are embedded, not being read from the dev tree.
- The log shows zero `ERROR` or panic lines on a first run.

### Anything broken here is worse on someone else's machine

Obvious once stated, easy to forget while developing: a defect you can work
around on your own Mac becomes unfixable for a recipient. The clearest example is
one we shipped — **Quit did not quit** (the run handler prevented every exit, not
just the window-close one; fixed in `e63a324`). On a dev machine that is a
shrug and a `pkill`. On someone else's machine it is a menubar app they cannot
get rid of except through Activity Monitor, and no reason to believe it is not
also mishandling everything else.

Treat "can a recipient install it, use it, and **get rid of it**" as part of the
release check, not as an afterthought.

### The keychain prompt is a symptom of being unsigned

An unsigned build has **no stable code identity**. Every rebuild is a different
application as far as macOS is concerned, so the login-keychain ACL's *Always
Allow* can never stick, and the helper prompts for the login password on **every
launch**. If nobody answers the prompt, the helper runs with no ingest token and
shares nothing.

That is not a bug to fix in the app — it is the direct consequence of no
signature, and it is fixed by signing. The app now *says* when it is in that
state (see `renderHealth` in `desktop/src/main.js`) rather than failing silently,
which is the best that can be done unsigned.

---

## The day there is a Developer Account

### 0. What this unblocks, in order

This is the reason to bother, and it is more than "no scary dialog":

| Unblocked | Why it needs signing |
| --- | --- |
| Keychain prompts stop | Stable code identity → *Always Allow* sticks |
| **Zero keychain prompts ever** | Data-protection keychain + access group needs the `keychain-access-groups` entitlement, which needs a Team ID |
| **Touch ID becomes possible at all** | Biometrics for keychain items require `SecAccessControl` on a *data-protection* item — impossible on the legacy keychain we use today |
| Auto-update | Updater packages must be signed |

### 1. Enrolment

Apple Developer Program, **$99/year**. Individual or Organization —
Organization requires a D-U-N-S number and takes longer. The **Team ID** (10
characters) appears in the membership page and is needed for the entitlement and
for notarization.

### 2. Certificate

You want **Developer ID Application** — *not* "Mac App Store", and *not*
"Apple Development" (which is for local testing only and will not pass
notarization).

Xcode → Settings → Accounts → Manage Certificates → **+** → Developer ID
Application. Then confirm it is present:

```bash
security find-identity -v -p codesigning
# "Developer ID Application: <Name> (<TEAMID>)"
```

### 3. Entitlements

Create `desktop/src-tauri/entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Hardened Runtime is REQUIRED for notarization. -->

  <!-- The whole point: scope the ingest token to this app, so the OS stops
       asking the user for permission to read our own secret. -->
  <key>keychain-access-groups</key>
  <array>
    <string>$(AppIdentifierPrefix)wtf.mumbl.helper</string>
  </array>
</dict>
</plist>
```

Add **only** what is genuinely needed. Every entitlement is something to justify,
and several (`allow-unsigned-executable-memory`, `disable-library-validation`)
weaken the hardened runtime — do not add them speculatively.

Note the helper needs **no** Accessibility or Screen Recording entitlement: it
reads only the frontmost app's bundle identifier via `NSWorkspace`, which is
deliberate and should stay that way.

### 4. Tauri config

```jsonc
"bundle": {
  "targets": ["app", "dmg"],
  "macOS": {
    "minimumSystemVersion": "12.0",
    "signingIdentity": "Developer ID Application: <Name> (<TEAMID>)",
    "hardenedRuntime": true,
    "entitlements": "entitlements.plist"
  }
}
```

`signingIdentity` can also come from the `APPLE_SIGNING_IDENTITY` environment
variable, which is the better move for CI so the identity is not committed.

### 5. Notarization

Notarization is a **separate step from signing**: Apple scans the signed build
and issues a ticket. Without it, a signed app still trips Gatekeeper on first
launch.

Credentials — use an **app-specific password** (appleid.apple.com → Sign-In and
Security → App-Specific Passwords), never the account password:

```bash
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="abcd-efgh-ijkl-mnop"   # app-specific
export APPLE_TEAM_ID="<TEAMID>"
./node_modules/.bin/tauri build
```

Tauri submits and staples automatically when those are set. Manually:

```bash
xcrun notarytool submit "mumbl helper_0.1.0_aarch64.dmg" \
  --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" --wait

xcrun stapler staple "mumbl helper_0.1.0_aarch64.dmg"
```

**Stapling matters.** It attaches the ticket to the artifact so first launch
works offline. Without it, a machine with no network cannot verify and shows the
warning anyway.

If it fails, the log is specific and worth reading properly:

```bash
xcrun notarytool log <submission-id> \
  --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID"
```

### 6. Verify — do not assume

```bash
# Signature is valid and sealed
codesign --verify --deep --strict --verbose=2 "mumbl helper.app"

# Hardened runtime on, right identity, right Team ID
codesign -dvvv "mumbl helper.app" 2>&1 | grep -E "Authority|flags|TeamIdentifier"
#   expect: flags=0x10000(runtime)

# Gatekeeper's own verdict — the one that matters
spctl --assess --type execute -vvv "mumbl helper.app"
#   expect: accepted, source=Notarized Developer ID

# Ticket is stapled
xcrun stapler validate "mumbl helper.app"
```

The real test: download the dmg **through a browser** on a machine that has never
seen the app, and open it. That exercises quarantine, which a local copy does not.

### 7. Then, and only then: the keychain migration

Currently the token is stored by `keyring` 3.6.3 with the `apple-native` backend,
which writes a **legacy `login.keychain-db` generic-password item** with a default
ACL. That is what produces the password prompt. `keyring` 3.6.3 has **no** support
for the data-protection keychain, access groups, or `kSecAttrAccessible` — so this
migration means dropping `keyring` for direct `SecItemAdd` / `SecItemCopyMatching`
via `security-framework`, which is already a transitive dependency.

Target state:

- `kSecUseDataProtectionKeychain: true`
- `kSecAttrAccessGroup` = our own group (needs the entitlement from step 3)
- `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` — never iCloud-synced, and
  unreadable before first unlock

Result: **zero prompts ever**, and the item is scoped by the OS so no other app
can read it. This is Apple's recommended shape for an app storing its own secret.

Migrate by reading the old item once, writing the new one, then deleting the old.
**Do not half-migrate** — two stores that disagree is worse than one that prompts.

#### Touch ID: use it for the right thing

Touch ID for keychain items requires `SecAccessControl` on a **data-protection**
item, so it is unavailable until the migration above. Once available, the split
that actually makes sense:

- **The app's own startup read → silent access-group read, no biometrics.** A
  background relay that starts at login or resumes after reboot would otherwise
  block forever waiting for a finger that is not there, and the office would stay
  dark.
- **Touch ID only for user-initiated sensitive actions** — reveal or copy the
  token, disconnect the office, change the ingest endpoint. That is where "prove
  it is you" buys security instead of friction.

(Unrelated aside, since it comes up: editing `/etc/pam.d/sudo` for `pam_tid` is
about `sudo`, not keychain items, and is a system file. It is not this.)

---

## The Mac App Store is not a route

Worth writing down so nobody spends a week on it.

1. The character window needs `macOSPrivateApi: true` for transparency. Private
   API use is grounds for App Store rejection. **This is the established
   blocker** — it is a hard requirement of a feature that already ships.
2. Additionally, the App Sandbox restricts what an app can learn about other
   running applications, which is the helper's entire input. *(Noted as a second
   reason; the private-API blocker above is the one actually verified here, and
   it is sufficient on its own.)*

mumbl ships direct. That decision predates and survives the signing question —
signing changes how well direct distribution works, not whether it is the route.
