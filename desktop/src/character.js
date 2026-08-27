// The character that lives in the menubar strip.
//
// It reacts to ONE thing — the tool you just switched to — and only at the
// moment you switch. Between transitions it is completely motionless. That is
// not a limitation of this build; it is the design. Peripheral motion beside
// someone who is concentrating is not charming, and a companion that moves all
// day gets muted within a week.
//
// Scope of this first build: the resting figure plus a SINGLE vignette (coding,
// the standing kiosk). Every other tool rests as the plain figure. The nine
// vignettes in public/office/office-scene.js are the eventual vocabulary; the
// point of shipping one is to find out whether an 11-pixel figure beside the
// notch reads as company or as lint.

const { listen } = window.__TAURI__.event;

const body = document.getElementById("body");
const prop = document.getElementById("prop");

// Colour per category, lifted from the office palette. NOT used at rest — the
// resting figure is a monochrome silhouette so it sits among the other menubar
// glyphs without shouting. This table is what an EARNED moment paints with, so
// that colour arriving means something happened rather than meaning the app is
// running.
const EARNED_COLOUR = {
  coding: "#9bd8b4",
  design: "#f4b3a6",
  music: "#cfbbf0",
  call: "#94cdee",
  writing: "#f3ce79",
  browsing: "#f29c8d",
  review: "#cfbbf0",
  focus: "#5fcbbc",
};

// The one vignette that has art in this build.
const HAS_VIGNETTE = new Set(["coding"]);

// Exposed so the later rare-moment work has an obvious seam to hook, and so a
// reader can see that colour is a deliberate, separate state.
// NB: this file is a CLASSIC script, not a module — `export` here would be a
// SyntaxError that silently kills the whole file, so the seam goes on `window`.
window.paintEarned = function (category) {
  const me = document.getElementById("me");
  me.style.setProperty("--earned", EARNED_COLOUR[category] || "#cfbbf0");
  me.classList.add("earned");
};

let current = null;

function render(shape) {
  const category = shape && shape.category ? shape.category : null;
  // Same category => nothing happened. Re-running the transition on every focus
  // event would turn "reacts to transitions" back into "moves constantly".
  if (category === current) return;
  current = category;

  // Rest stays monochrome: the figure keeps its silhouette and only the prop
  // changes. `EARNED_COLOUR` is deliberately not applied here.
  body.style.removeProperty("background");

  if (category && HAS_VIGNETTE.has(category)) {
    prop.classList.add("up");
  } else {
    prop.classList.remove("up");
  }
}

// Emitted by the Rust watcher the instant the frontmost app changes — local
// only, no token, no network, and gated by the same pause/mute rules as sending.
listen("focus-shape", (e) => render(e.payload));
