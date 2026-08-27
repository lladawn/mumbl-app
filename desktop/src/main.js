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

let config = null; // { endpoint, slug, name, enabled, shareAll, allowlist, muted, hasToken }
let catalog = []; // default classification table
let pairTimer = null; // interval id while a pairing is in flight

// How long to wait for the human to click Authorize before giving up. Long
// enough to find the browser tab and sign in if the session lapsed.
const PAIR_TIMEOUT_MS = 3 * 60 * 1000;
const PAIR_POLL_MS = 2000;

// ---- boot -----------------------------------------------------------------

async function boot() {
  catalog = await invoke("get_catalog");
  config = await invoke("get_config");

  renderAll();
  await refreshReceipt();
  wire();

  // The Rust core emits a receipt every time an event leaves the machine.
  await listen("receipt", (e) => {
    paintReceipt(e.payload);
    // A delivery that starts or stops failing changes what the notice should
    // say, and the receipt is the moment we learn it.
    renderHealth();
  });

  $("health-action").addEventListener("click", async () => {
    const action = $("health-action");
    action.disabled = true;
    action.textContent = "checking\u2026";
    await invoke("retry_token");
    // The Rust side re-reads off the main thread and emits config-changed when
    // it lands, so the view corrects itself; this is just so the button doesn't
    // sit looking dead if the read is slow behind an OS prompt.
    setTimeout(renderHealth, 1200);
  });
  await listen("config-changed", async () => {
    config = await invoke("get_config");
    renderAll();
  });
}

function renderAll() {
  renderView();
  renderDock();
  renderFields();
  renderShareAll();
  renderAllowlist();
  renderToggle();
  renderHealth();
}

// ---- "nothing is being shared" -------------------------------------------

// Sharing can fail at three separate points, and every one of them used to fail
// SILENTLY: the helper kept running, the log filled up, and the office just
// looked empty. Whichever is true, say it here, in the order the user can act on.
//
// The keychain case is the one worth the most care. A dismissed launch prompt
// silences the helper for the entire run, and the only cure used to be quitting
// and reopening — which nobody would think to do, because nothing told them
// anything was wrong. So that state gets its own button.
async function renderHealth() {
  const box = $("health");
  if (!box) return;
  let health;
  try {
    health = await invoke("get_sharing_health");
  } catch {
    box.hidden = true;
    return;
  }

  const title = $("health-title");
  const body = $("health-body");
  const action = $("health-action");
  action.hidden = true;
  action.disabled = false;

  // "Still checking" is not a problem, and neither is a machine that has simply
  // never connected — that one already has a whole view of its own.
  // Whatever we conclude below, the header pill must agree with it.
  const wasStuck = sharingStuck;
  sharingStuck =
    health.enabled &&
    (health.tokenState === "blocked" || !!health.deliveryError);
  if (sharingStuck !== wasStuck) renderToggle();

  if (health.tokenState === "loading" || health.tokenState === "missing") {
    box.hidden = true;
    return;
  }

  if (!health.enabled) {
    title.textContent = "Sharing is paused";
    body.textContent = "Nothing is leaving this Mac until you resume it.";
    box.hidden = false;
    return;
  }

  if (health.tokenState === "blocked") {
    title.textContent = "Can\u2019t reach your token";
    body.textContent =
      "macOS didn\u2019t let mumbl read its keychain item, so nothing is being " +
      "shared. Your office is fine \u2014 this Mac just can\u2019t sign its " +
      "messages. Answering the keychain prompt with Always Allow stops it " +
      "coming back.";
    action.textContent = "Try the keychain again";
    action.hidden = false;
    box.hidden = false;
    return;
  }

  if (health.deliveryError) {
    title.textContent = "Can\u2019t reach your office";
    body.textContent =
      `Events are being dropped \u2014 ${health.endpoint} isn\u2019t answering. ` +
      "Nothing is lost that was already sent; new activity just isn\u2019t arriving.";
    box.hidden = false;
    return;
  }

  box.hidden = true;
}

// ---- render ---------------------------------------------------------------

// The single most important decision this UI makes: a machine that has no token
// sees ONE button, and nothing else. Everything operational is hidden until
// there is actually an office to talk about.
function renderView() {
  const connected = !!config.hasToken;
  // "We can't READ your token" is not "you have never connected". Showing the
  // empty-desk pitch here would tell someone to connect an office they may
  // already have — the notice above says the true thing and offers the retry,
  // so let it carry this state alone rather than contradict it.
  const blocked = config.tokenState === "blocked";
  $("view-connect").hidden = connected || blocked;
  $("view-live").hidden = !connected;
  $("toggle").hidden = !connected;
  $("foot").textContent = connected
    ? `${config.name || "this Mac"} · install ${config.installId?.slice(0, 8) || "—"}`
    : "nothing is being shared yet";
}

// The Dock icon is the escape hatch when the menubar icon can't be found, so
// its state has to be visible and reversible rather than a hidden default.
function renderDock() {
  setChecked($("show-dock"), config.showInDock !== false);
}

// Advanced only — the main flow never asks for these.
function renderFields() {
  $("endpoint").value = config.endpoint || "";
  $("name").value = config.name || "";
  $("token").value = "";
  $("token").placeholder = config.hasToken ? "•••••• (in keychain)" : "paste a token instead";
}

// `enabled` means "the user has not paused it", which is NOT the same as
// "things are arriving". Saying "live" while every event is being dropped is
// the same silent lie the notice below exists to end, so the pill defers to
// whatever renderHealth last found.
let sharingStuck = false;

function renderToggle() {
  const btn = $("toggle");
  const on = config.enabled;
  btn.classList.toggle("paused", !on || sharingStuck);
  $("toggle-label").textContent = !on ? "paused" : sharingStuck ? "stuck" : "live";
  btn.title = on ? "Pause sharing" : "Resume sharing";
}

// Sync a checkbox's checked state. WKWebView with a custom (appearance:none)
// checkbox can fail to recalc the `:checked` style when only the .checked
// PROPERTY is set programmatically before first paint; driving an explicit
// class we style directly keeps it honest.
function setChecked(el, on) {
  el.checked = on;
  el.classList.toggle("is-checked", on);
  if (!el.dataset.checkSync) {
    el.dataset.checkSync = "1";
    el.addEventListener("change", () => el.classList.toggle("is-checked", el.checked));
  }
}

function renderShareAll() {
  const shareAll = config.shareAll !== false; // default ON
  setChecked($("share-all"), shareAll);
  $("share-all-help").textContent = shareAll
    ? "Everything you use shows up — untick an app below to hide it."
    : "Only the apps you tick below are shared.";
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
    const box = document.createElement("span");
    box.className = "box";
    const text = document.createElement("span");
    text.textContent = app.label;
    const cat = document.createElement("span");
    cat.className = "cat";
    cat.textContent = app.category;
    label.append(box, text, cat);

    item.append(cb, label);
    host.append(item);
  }
  $("app-count").textContent = `${catalog.length} known`;
}

function paintReceipt(receipt) {
  const host = $("receipt");
  if (!receipt || !receipt.tool) {
    host.innerHTML = `<em class="muted">Nothing sent yet.</em>`;
    return;
  }
  const when = new Date(receipt.occurredAt).toLocaleTimeString();
  const ok = receipt.delivered ? "sent" : "not delivered";
  host.innerHTML =
    `<span class="pill">${escapeHtml(receipt.category)}</span>` +
    `<b>${escapeHtml(receipt.tool)}</b>` +
    `<span class="muted">${escapeHtml(receipt.status)} · ${when} · ${ok}</span>`;
}

async function refreshReceipt() {
  paintReceipt(await invoke("get_last_receipt"));
}

// ---- pairing --------------------------------------------------------------

function pairStatus(text, isError) {
  const el = $("pair-status");
  el.textContent = text;
  el.classList.toggle("pair-status-err", !!isError);
}

function stopPairing() {
  if (pairTimer) clearInterval(pairTimer);
  pairTimer = null;
  $("pairing").hidden = true;
  $("connect").disabled = false;
  $("connect").textContent = "Connect my office";
}

// The pairing service isn't deployed yet. Say so plainly and put the fallback
// one click away rather than leaving the user staring at a spinner.
async function pairUnavailable(detail) {
  stopPairing();
  $("pairing").hidden = false;
  $("pair-cancel").hidden = true;
  $("pair-code").textContent = "· · · ·";
  const needs = await invoke("pair_required_backend").catch(() => "");
  pairStatus(
    `One-click connect isn’t live yet — paste a token under Advanced instead. (needs ${needs})`,
    true
  );
  $("advanced").open = true;
  $("token").focus();
  console.warn("pairing unavailable:", detail);
}

async function startPairing() {
  const btn = $("connect");
  btn.disabled = true;
  btn.textContent = "Opening browser…";
  $("pair-cancel").hidden = false;
  $("pairing").hidden = false;
  pairStatus("Waiting for you to authorize in the browser…");

  let code;
  try {
    const started = await invoke("pair_begin");
    code = started.code;
    $("pair-code").textContent = code;
  } catch (err) {
    await pairUnavailable(err);
    return;
  }

  const deadline = Date.now() + PAIR_TIMEOUT_MS;
  pairTimer = setInterval(async () => {
    if (Date.now() > deadline) {
      stopPairing();
      $("pairing").hidden = false;
      pairStatus("That took a while — hit Connect to try again.", true);
      return;
    }
    let res;
    try {
      res = await invoke("pair_poll", { code });
    } catch (err) {
      await pairUnavailable(err);
      return;
    }
    if (res.state === "authorized") {
      stopPairing();
      // config-changed from the Rust side already refreshed us into the live
      // view; this is just the confirmation beat.
      config = await invoke("get_config");
      renderAll();
    } else if (res.state === "expired") {
      stopPairing();
      $("pairing").hidden = false;
      pairStatus("That code expired — hit Connect for a fresh one.", true);
    } else if (res.state === "unavailable") {
      await pairUnavailable(res.detail);
    }
    // "pending" → keep waiting
  }, PAIR_POLL_MS);
}

// ---- actions --------------------------------------------------------------

function wire() {
  $("toggle").addEventListener("click", async () => {
    config = await invoke("set_enabled", { enabled: !config.enabled });
    renderToggle();
  });

  $("connect").addEventListener("click", startPairing);
  $("pair-cancel").addEventListener("click", () => {
    stopPairing();
    pairStatus("");
  });

  $("show-dock").addEventListener("change", async (e) => {
    config = await invoke("set_show_in_dock", { show: e.target.checked });
    renderDock();
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
      config = await invoke("save_config", {
        patch: {
          endpoint: $("endpoint").value.trim() || null,
          slug: null,
          name: $("name").value.trim() || null,
          // empty token means "leave the stored one untouched"
          token: $("token").value.trim() || null,
        },
      });
      renderAll();
      status.className = "save-status ok show";
      status.textContent = "Saved ✓";
      setTimeout(() => status.classList.remove("show"), 1800);
    } catch (err) {
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
  document.body.innerHTML = `<pre style="padding:16px;color:#8a352b">${escapeHtml(e)}</pre>`;
});
