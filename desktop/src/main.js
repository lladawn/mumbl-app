import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const $ = (id) => document.getElementById(id);

// ---- state ----------------------------------------------------------------

let config = null; // { endpoint, slug, name, enabled, allowlist: {bundleId:bool}, hasToken }
let catalog = []; // default classification table [{bundleId, tool, category, object, label}]

// ---- boot -----------------------------------------------------------------

async function boot() {
  catalog = await invoke("get_catalog");
  config = await invoke("get_config");

  renderConfig();
  renderAllowlist();
  renderToggle();
  await refreshReceipt();

  wire();

  // The Rust core emits a receipt every time an event leaves the machine.
  await listen("receipt", (e) => paintReceipt(e.payload));
  await listen("config-changed", async () => {
    config = await invoke("get_config");
    renderConfig();
    renderAllowlist();
    renderToggle();
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
  $("foot").textContent = `install id ${config.installId?.slice(0, 8) || "—"}`;
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
  const allow = config.allowlist || {};
  for (const app of catalog) {
    const item = document.createElement("div");
    item.className = "item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = `al-${app.bundleId}`;
    cb.checked = !!allow[app.bundleId];
    cb.addEventListener("change", () => setAllow(app.bundleId, cb.checked));
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

  $("save").addEventListener("click", async () => {
    const status = $("save-status");
    status.textContent = "saving…";
    try {
      config = await invoke("save_config", {
        patch: {
          endpoint: $("endpoint").value.trim() || null,
          slug: $("slug").value.trim() || null,
          name: $("name").value.trim() || null,
          // empty token means "leave the stored one untouched"
          token: $("token").value.trim() || null,
        },
      });
      renderConfig();
      status.textContent = "saved";
      setTimeout(() => (status.textContent = ""), 1500);
    } catch (err) {
      status.textContent = String(err);
    }
  });
}

async function setAllow(bundleId, on) {
  config = await invoke("set_allow", { bundleId, allowed: on });
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
