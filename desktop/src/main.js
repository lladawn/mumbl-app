// This frontend is served RAW from `src/` (tauri.conf.json `frontendDist`) —
// there is no bundler and no import map, so a bare specifier like
// "@tauri-apps/api/core" cannot be resolved by the webview: the module throws
// `Failed to resolve module specifier` at load and NOTHING in this file runs
// (which silently killed every button, Save included). Use the globals that
// `withGlobalTauri: true` injects instead.
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const $ = (id) => document.getElementById(id);

// ---- state ----------------------------------------------------------------

let config = null; // { endpoint, slug, name, enabled, shareAll, allowlist:{id:bool}, muted:{id:bool}, hasToken }
let catalog = []; // default classification table [{bundleId, tool, category, object, label}]

// ---- boot -----------------------------------------------------------------

async function boot() {
  catalog = await invoke("get_catalog");
  config = await invoke("get_config");

  renderConfig();
  renderShareAll();
  renderAllowlist();
  renderToggle();
  renderStatus();
  await refreshReceipt();

  wire();

  // The Rust core emits a receipt every time an event leaves the machine.
  await listen("receipt", (e) => paintReceipt(e.payload));
  await listen("config-changed", async () => {
    config = await invoke("get_config");
    renderConfig();
    renderShareAll();
    renderAllowlist();
    renderToggle();
    renderStatus();
  });
}

// ---- render ---------------------------------------------------------------

function renderConfig() {
  $("endpoint").value = config.endpoint || "";
  $("slug").value = config.slug || "";
  $("name").value = config.name || "";
  $("token").value = "";
  $("token").placeholder = config.hasToken
    ? "•••••••• (stored in keychain)"
    : "paste your space ingest token";
  const cue = $("token-cue");
  if (cue) {
    if (config.hasToken) {
      cue.textContent = "token stored in keychain ✓";
      cue.classList.add("ok");
    } else {
      cue.textContent = "";
      cue.classList.remove("ok");
    }
  }
  $("foot").textContent = `install id ${config.installId?.slice(0, 8) || "—"}`;
}

// Sync a checkbox's checked state. WKWebView with a custom (appearance:none)
// checkbox can fail to recalc the `:checked` style when only the .checked
// PROPERTY is set programmatically before first paint; mirroring the ATTRIBUTE
// forces the pseudo-class to match. Set both.
function setChecked(el, on) {
  el.checked = on;
  el.toggleAttribute("checked", on);
  // WebKit doesn't reliably repaint the `:checked` style for a custom
  // (appearance:none) checkbox set programmatically before first paint, so we
  // also drive an explicit `is-checked` class we style directly. Keep it in
  // sync with real user toggles too.
  el.classList.toggle("is-checked", on);
  if (!el.dataset.checkSync) {
    el.dataset.checkSync = "1";
    el.addEventListener("change", () => el.classList.toggle("is-checked", el.checked));
  }
}

// The master "Share all my apps" toggle + its helper/privacy copy.
function renderShareAll() {
  const shareAll = config.shareAll !== false; // default ON
  setChecked($("share-all"), shareAll);
  $("share-all-help").textContent = shareAll
    ? "Everything you use shows up; untick individual apps below to hide them."
    : "Only the apps you tick below are shared. Nothing else leaves this machine.";
  $("privacy-copy").textContent = shareAll
    ? "All your apps are shared as shapes by default — untick any you want to keep private. Only the app category ever leaves, never titles or content."
    : "Only ticked apps are shared, as shapes. Only the app category ever leaves, never titles or content.";
  document.body.classList.toggle("opt-in", !shareAll);
}

// Status & permissions card + the first-run guide. Both are derived purely from
// the existing config (hasToken / enabled) — no new IPC needed. The permission
// line is static-true: the helper only reads the frontmost app via the public
// NSWorkspace notification, so there is genuinely nothing to grant.
function renderStatus() {
  const hasToken = !!config.hasToken;
  const enabled = !!config.enabled;

  const tokenLine = $("st-token");
  if (tokenLine) {
    setStatusLine(
      tokenLine,
      hasToken,
      hasToken
        ? "Ingest token set — securely stored in your macOS keychain."
        : "No ingest token yet — paste one below and Save to connect.",
      hasToken ? "good" : "todo"
    );
  }

  const sharingLine = $("st-sharing");
  if (sharingLine) {
    if (!hasToken) {
      setStatusLine(sharingLine, false, "Sharing starts once a token is set.", "idle");
    } else {
      setStatusLine(
        sharingLine,
        enabled,
        enabled
          ? "Sharing is on — focused apps light up your office."
          : "Sharing is paused — nothing is leaving this machine.",
        enabled ? "good" : "paused"
      );
    }
  }

  // First-run guide: only while there is no token.
  const guide = $("setup-guide");
  if (guide) guide.hidden = hasToken;
}

// Paint one status line: tick glyph + text + state class (good/todo/paused/idle).
function setStatusLine(el, on, text, state) {
  el.classList.remove("good", "todo", "paused", "idle");
  el.classList.add(state);
  const tick = el.querySelector(".tick");
  if (tick) tick.textContent = on ? "✓" : state === "paused" ? "⏸" : "•";
  const txt = el.querySelector(".st-text");
  if (txt) txt.textContent = text;
}

function renderToggle() {
  const btn = $("toggle");
  const dot = $("live-dot");
  if (config.enabled) {
    btn.textContent = "Pause sharing";
    btn.classList.remove("paused");
    dot.classList.add("on");
  } else {
    btn.textContent = "Resume sharing";
    btn.classList.add("paused");
    dot.classList.remove("on");
  }
}

function renderAllowlist() {
  const host = $("allowlist");
  host.innerHTML = "";
  const shareAll = config.shareAll !== false;
  const allow = config.allowlist || {};
  const muted = config.muted || {};
  for (const app of catalog) {
    const item = document.createElement("div");
    item.className = "item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = `al-${app.bundleId}`;
    if (shareAll) {
      // opt-OUT: ticked = shared (default). Unticking mutes the app.
      setChecked(cb, !muted[app.bundleId]);
      cb.addEventListener("change", () => setMuted(app.bundleId, !cb.checked));
    } else {
      // opt-IN: ticked = included. Default off.
      setChecked(cb, !!allow[app.bundleId]);
      cb.addEventListener("change", () => setAllow(app.bundleId, cb.checked));
    }
    const label = document.createElement("label");
    label.htmlFor = cb.id;
    label.innerHTML = `${escapeHtml(app.label)} <span class="cat">${escapeHtml(app.category)}</span>`;
    item.append(cb, label);
    host.append(item);
  }
}

function paintReceipt(receipt) {
  const host = $("receipt");
  if (!receipt || !receipt.tool) {
    host.innerHTML = `<em class="muted">Nothing sent yet.</em>`;
    return;
  }
  const when = new Date(receipt.occurredAt).toLocaleTimeString();
  const ok = receipt.delivered ? "sent" : "attempted (offline?)";
  host.innerHTML =
    `<span class="pill">${escapeHtml(receipt.category)}</span>` +
    `<b>${escapeHtml(receipt.tool)}</b>` +
    `<span class="muted"> · ${escapeHtml(receipt.status)} · ${when} · ${ok}</span>`;
}

async function refreshReceipt() {
  const last = await invoke("get_last_receipt");
  paintReceipt(last);
}

// ---- actions --------------------------------------------------------------

function wire() {
  $("toggle").addEventListener("click", async () => {
    config = await invoke("set_enabled", { enabled: !config.enabled });
    renderToggle();
  });

  $("share-all").addEventListener("change", async (e) => {
    config = await invoke("set_share_all", { shareAll: e.target.checked });
    renderShareAll();
    renderAllowlist();
  });

  $("save").addEventListener("click", async () => {
    const status = $("save-status");
    const btn = $("save");
    status.className = "save-status";
    status.textContent = "saving…";
    btn.disabled = true;
    try {
      // Await the async IPC result and reflect it into local state.
      config = await invoke("save_config", {
        patch: {
          endpoint: $("endpoint").value.trim() || null,
          slug: $("slug").value.trim() || null,
          name: $("name").value.trim() || null,
          // empty token means "leave the stored one untouched"
          token: $("token").value.trim() || null,
        },
      });
      renderConfig(); // repaints token cue → "token stored in keychain ✓"
      // Clear, transient green confirmation next to Save, then fade out.
      status.className = "save-status ok show";
      status.textContent = "Saved ✓";
      setTimeout(() => {
        status.classList.remove("show");
      }, 1800);
    } catch (err) {
      // On failure surface the error text (persists until next save).
      status.className = "save-status err show";
      status.textContent = String(err);
    } finally {
      btn.disabled = false;
    }
  });
}

async function setAllow(bundleId, on) {
  config = await invoke("set_allow", { bundleId, allowed: on });
}

async function setMuted(bundleId, muted) {
  config = await invoke("set_muted", { bundleId, muted });
}

// ---- utils ----------------------------------------------------------------

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

boot().catch((e) => {
  document.body.innerHTML = `<pre style="padding:16px;color:#b4675a">${escapeHtml(e)}</pre>`;
});
