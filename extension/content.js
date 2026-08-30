// mumbl pixel world — content script. SPIKE.
//
// One question this exists to answer: does a pixelified arbitrary website feel
// good, or does it just feel broken? So it does the CHEAP version first — a CSS
// re-skin plus a best-effort image pass — and is instrumented to report what it
// could and could not transform, because "it worked" and "it worked on the
// third of the images that allowed it" are different answers.
//
// Reversibility is a hard requirement, not a nicety: everything is one class on
// <html> plus a small set of nodes we own and can remove. We never edit the
// page's own markup or inline styles.

const ROOT_CLASS = "mumbl-px";
const STYLE_ID = "mumbl-px-style";
const FILTER_ID = "mumbl-px-filter";
const BADGE_CLASS = "mumbl-px-badge";

// How coarse the pixels are: the image is drawn into a buffer this many pixels
// wide and blown back up. Lower = chunkier. 64 reads as "pixel art"; below ~32
// most photographs stop being recognisable at all.
const PIXEL_WIDTH = 64;

let on = false;
const stats = { imgs: 0, pixelated: 0, tainted: 0, skipped: 0 };

function injectOnce() {
  if (document.getElementById(STYLE_ID)) return;

  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("pixel.css");
  document.documentElement.appendChild(link);

  // The font has to be declared from here, not from pixel.css, because the
  // woff2 lives in the extension and only chrome.runtime.getURL knows where.
  const font = document.createElement("style");
  font.id = STYLE_ID + "-font";
  font.textContent = `@font-face{font-family:"MumblPixel";src:url("${chrome.runtime.getURL(
    "fonts/PressStart2P-latin.woff2"
  )}") format("woff2");font-display:swap;}`;
  document.documentElement.appendChild(font);

  // Posterising via SVG works on cross-origin images because it is a render
  // effect — it never reads pixels back, so it cannot taint anything.
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.id = FILTER_ID;
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("style", "position:absolute;width:0;height:0");
  const filter = document.createElementNS(svgNS, "filter");
  filter.setAttribute("id", "mumbl-px-posterise");
  const transfer = document.createElementNS(svgNS, "feComponentTransfer");
  for (const ch of ["feFuncR", "feFuncG", "feFuncB"]) {
    const f = document.createElementNS(svgNS, ch);
    f.setAttribute("type", "discrete");
    // Six steps per channel: enough to flatten photographic gradients into
    // bands without collapsing everything to poster paint.
    f.setAttribute("tableValues", "0 0.2 0.4 0.6 0.8 1");
    transfer.appendChild(f);
  }
  filter.appendChild(transfer);
  svg.appendChild(filter);
  document.documentElement.appendChild(svg);
}

// Draw the image small and blow it back up. This is the only way to get real
// pixelation rather than a filter that merely looks retro — and it is exactly
// where arbitrary websites fight back, so the failures are counted.
function pixelateImage(img) {
  if (img.dataset.mumblPx) return;
  stats.imgs += 1;

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) {
    stats.skipped += 1;
    return;
  }

  const small = document.createElement("canvas");
  const scale = Math.min(1, PIXEL_WIDTH / w);
  small.width = Math.max(1, Math.round(w * scale));
  small.height = Math.max(1, Math.round(h * scale));
  const sctx = small.getContext("2d");
  sctx.imageSmoothingEnabled = true;

  try {
    sctx.drawImage(img, 0, 0, small.width, small.height);
    // THE MOMENT OF TRUTH: reading back from a canvas that has had a
    // cross-origin image drawn into it throws a SecurityError. Most images on
    // most real websites are cross-origin and served without CORS headers, so
    // this is expected to fail often — that failure rate is a finding, not a bug.
    const url = small.toDataURL();
    img.dataset.mumblPxSrc = img.getAttribute("src") || "";
    img.dataset.mumblPxSrcset = img.getAttribute("srcset") || "";
    img.removeAttribute("srcset");
    img.src = url;
    img.dataset.mumblPx = "done";
    stats.pixelated += 1;
  } catch {
    // Tainted canvas. The CSS posterise filter still applies, so the image is
    // stylised but not truly pixelated.
    img.dataset.mumblPx = "tainted";
    stats.tainted += 1;
  }
}

function restoreImage(img) {
  if (img.dataset.mumblPx === "done") {
    if (img.dataset.mumblPxSrc) img.src = img.dataset.mumblPxSrc;
    if (img.dataset.mumblPxSrcset) img.setAttribute("srcset", img.dataset.mumblPxSrcset);
  }
  delete img.dataset.mumblPx;
  delete img.dataset.mumblPxSrc;
  delete img.dataset.mumblPxSrcset;
}

function badge(text) {
  let el = document.querySelector("." + BADGE_CLASS);
  if (!el) {
    el = document.createElement("div");
    el.className = BADGE_CLASS;
    document.body.appendChild(el);
  }
  el.textContent = text;
}

function apply() {
  injectOnce();
  document.documentElement.classList.add(ROOT_CLASS);
  for (const img of document.images) pixelateImage(img);
  badge(
    `pixel world · ${stats.pixelated}/${stats.imgs} imgs` +
      (stats.tainted ? ` · ${stats.tainted} blocked` : "")
  );
  on = true;
}

function remove() {
  document.documentElement.classList.remove(ROOT_CLASS);
  for (const img of document.images) restoreImage(img);
  document.querySelector("." + BADGE_CLASS)?.remove();
  stats.imgs = stats.pixelated = stats.tainted = stats.skipped = 0;
  on = false;
}

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.type !== "mumbl-pixel-toggle") return;
  on ? remove() : apply();
  respond({ on, stats });
  return true;
});

// SPIKE AFFORDANCE, not a product feature: a headless browser cannot click the
// toolbar button, and this had to be screenshotted across five real sites.
// `#mumbl-px` in the URL applies the transform on load so before/after captures
// are deterministic. Remove this before any of it ships.
if (location.hash.includes("mumbl-px")) {
  if (document.readyState === "complete") apply();
  else window.addEventListener("load", apply, { once: true });
}
