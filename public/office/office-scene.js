/**
 * The live office at /office/[slug].
 *
 * Extracted from public/demo/index.html. The room, the person factory, the
 * furniture, the proximity/panel and the terminal control-group are lifted
 * verbatim — the ONLY change is where the cast comes from: instead of a static
 * SEED const, boot() is handed nothing and the scene renders whatever
 * applyState() reconciles into it from the read endpoint (add / update / walk
 * out). Keeping the drawing identical is deliberate: the demo office and the
 * live office must read as the same place.
 *
 * Loaded as a plain script after public/demo/phaser.min.js (Phaser is vendored
 * in public/, so it can't be imported). React calls boot(), gets a small
 * controller back, and drives applyState() from a ~4s poll. The scene never
 * reaches into React; it only owns its own canvas + overlay DOM.
 */
(function () {
  const W = 1440, H = 960;          // world
  const VW = 960, VH = 600;         // viewport

  const C = {
    wood: 0xDDBA88, woodAlt: 0xD7B280, woodSeam: 0xC09B69,
    carpet: 0xD2DAF0, carpetAlt: 0xCAD3EC, carpetFleck: 0xE6EBFB, carpetEdge: 0xAEB9DE,
    oat: 0xEADFC6, oatAlt: 0xE4D8BC, oatFleck: 0xF5EEDE, oatEdge: 0xCFBE9E,
    tile: 0xF9F0E0, tileAlt: 0xF1E4CE, tileGrout: 0xE0CDB0,
    wall: 0xC7E9E5, wallDark: 0xA6D8D4, wallTrim: 0xFFF8EC,
    partition: 0xEFE2CA, partitionTop: 0xFBF3E2,
    glass: 0xDCF3FA,
    desk: 0xE3C094, deskTop: 0xF0D5A8, deskLeg: 0xCBA87C,
    monitor: 0x9FB3BE, screen: 0xBBDCF0,
    couch: 0xF4B3A6, couchDark: 0xE59E90, wood2: 0xEBCB9F,
    metal: 0xDCE7E8, metalDark: 0xB7C9CB,
    ochre: 0xEFC08A, cream: 0xFFF8EC, green: 0x9BD8B4, red: 0xF0A79E,
    leaf: 0x9BD3A8, leafLight: 0xC0E8C4,
    sky: 0xBEE7F7, sun: 0xFFEBBE, lilac: 0xCFBBF0, coral: 0xF4B3A6,
    sunflower: 0xF8DFA0, pink: 0xF9CBDA, ink: 0x5A6B66,
  };
  const CONFETTI = [0xF4B3A6, 0xF8DFA0, 0x9BD8B4, 0xBEE7F7, 0xCFBBF0, 0xF9CBDA];

  const ZONES = [
    { x: 245, y: 120, label: "meeting room" },
    { x: 1205, y: 120, label: "lounge" },
    { x: 720, y: 160, label: "agent bullpen" },
    { x: 245, y: 650, label: "café" },
    { x: 1205, y: 630, label: "rec room" },
    { x: 720, y: 838, label: "reception" },
  ];

  const DESKS = [
    { x: 520, y: 260 }, { x: 720, y: 260 }, { x: 920, y: 260 },
    { x: 520, y: 480 }, { x: 720, y: 480 }, { x: 920, y: 480 },
  ];
  const DOOR = { x: 720, y: 916 };

  // Whoever walks through the door next should look like someone you have not
  // met — cycled by a stable hash of external_id so an actor keeps its face.
  const PALETTES = [
    { hair: "#4A382C", skin: "#E3B48D", shirt: "#8FD6AE", pants: "#6E7E96", glow: "#CCF3DC",
      hairStyle: "long", outfit: "overalls", accessory: "none", accent: "#FFF8EC" },
    { hair: "#6B4426", skin: "#F0D2AC", shirt: "#C6B0EC", pants: "#7A7189", glow: "#E8DBFF",
      hairStyle: "hood", outfit: "hoodie", accessory: "none", accent: "#9E86C8", build: "broad" },
    { hair: "#3A322C", skin: "#B5835B", shirt: "#F6BCD1", pants: "#8A7358", glow: "#FFE3EC",
      hairStyle: "short", outfit: "apron", accessory: "scarf", accent: "#E38FAE", build: "slim" },
    { hair: "#2E2A26", skin: "#8A5F3C", shirt: "#F8DFA0", pants: "#5E6E86", glow: "#FFF1CC",
      hairStyle: "curly", outfit: "vest", accessory: "glasses", accent: "#D8A94E" },
    { hair: "#7A4A22", skin: "#F0D2AC", shirt: "#BEE7F7", pants: "#6E7E96", glow: "#DCF3FC",
      hairStyle: "bun", outfit: "stripes", accessory: "lanyard", accent: "#6E9FD8", build: "slim" },
    { hair: "#403830", skin: "#C89370", shirt: "#9BD8B4", pants: "#7A7189", glow: "#CCF3DC",
      hairStyle: "beanie", outfit: "collar", accessory: "headphones", accent: "#4FA88A", build: "broad" },
  ];
  const STATUS_COL = { working: 0xEFB472, blocked: 0xF09B90, done: 0x86CFA6, idle: 0xC7D2CE };
  const STATUS_INK = { working: "#9A6516", blocked: "#B0554C", done: "#2E7F5C", idle: "#6E7E79" };

  // category → office object: what a seated actor's desk reads as. The office
  // self-assembles from the SHAPE the ingest model carries (tool/category/object),
  // so a GitHub-sourced actor (category 'coding' from a push/PR, 'review' from a
  // review) reads as a coder at a coding desk. A small glyph tags the desk; the
  // furniture itself is reused (no asset pipeline). 'object' is a hint — the
  // renderer owns the final marker, so a source can be re-skinned without a
  // migration. Unknown/agent categories get no badge (the seated-agent look).
  const CATEGORY_BADGE = {
    coding: { glyph: "</>", bg: 0x2A3531, ink: "#9BD8B4" },
    review: { glyph: "PR", bg: 0x3A2E4A, ink: "#CFBBF0" },
    design: { glyph: "◑", bg: 0x4A2E3A, ink: "#F6BCD1" },
    call: { glyph: "☎", bg: 0x2E3A4A, ink: "#BEE7F7" },
    music: { glyph: "♪", bg: 0x2E4A3A, ink: "#9BD8B4" },
    writing: { glyph: "✎", bg: 0x4A3A2E, ink: "#F8DFA0" },
    browsing: { glyph: "⌂", bg: 0x2E3A42, ink: "#F4B3A6" },
    focus: { glyph: "•", bg: 0x33383A, ink: "#C7D2CE" },
    other: { glyph: "•", bg: 0x33383A, ink: "#C7D2CE" },
  };

  // --- Tool → visual vocabulary (docs/office-visual-design.md §2) ----------
  // Locked owner decisions: (1) Hybrid-C; (2) an actor's CORE identity stays
  // constant (hair/skin/build/outfit come from PALETTES/external_id) — the tool
  // is signalled by a LIGHT ACCESSORY change + accent + the desk's STATION PROP,
  // NOT a full outfit swap; (3) category-level, procedural, no spritesheet.
  //
  // So CATEGORY_LOOK only ever overrides `accessory` + `accent` — never outfit,
  // hair, skin, or build. The heavy lifting of "what tool is this" is carried by
  // stationProp() (the desk prop) + the badge glyph, both of which survive the
  // animation-free OG card. accent is the sprite's trim colour; screen tints the
  // monitor. Categories not listed fall through to the actor's plain look.
  const CATEGORY_LOOK = {
    coding:   { accessory: "headphones", accent: "#9BD8B4", screen: 0x1E262B },
    review:   { accessory: "glasses",    accent: "#CFBBF0", screen: 0x241E2E },
    design:   { accessory: "scarf",      accent: "#F6BCD1", screen: 0xF6BCD1 },
    call:     { accessory: "headphones", accent: "#BEE7F7", screen: 0xBEE7F7 },
    writing:  { accessory: "glasses",    accent: "#F8DFA0", screen: 0xF3E4B8 },
    browsing: { accessory: "none",       accent: "#F4B3A6", screen: 0xF4B3A6 },
    music:    { accessory: "headphones", accent: "#9BD8B4", screen: 0x2E4A3A },
    focus:    { accessory: "none",       accent: "#C7D2CE", screen: 0x9FB3BE },
    other:    { accessory: "none",       accent: "#C7D2CE", screen: 0x9FB3BE },
  };

  // Per-category STATION PROP painters. Each draws the signature desk object for
  // a category using the same procedural fillRect primitives as the rest of the
  // furniture (no assets). Signature: (scene, g, x, y, objs, desk) where g is a
  // graphics layer already at desk depth, (x,y) is the desk centre, and objs is
  // the list to push any animated Phaser objects into (so they can be destroyed
  // when the category changes). The STATIC shape carries the read; tweens only
  // reinforce it — the same shapes are mirrored as static divs on the OG card.
  const S = {
    codeGreen: 0x9BD8B4, codeDim: 0x4E7D66, screenDark: 0x1E262B,
    pink: 0xF6BCD1, pinkDk: 0xE29CBE, violet: 0xCFBBF0, sky: 0xBEE7F7,
    amber: 0xF8DFA0, coral: 0xF4B3A6, paper: 0xFFFBF0, ink: 0x59696E,
    wood: 0xCBA87C, vinyl: 0x2A2622, grey: 0xC7D2CE, metal: 0xB7C9CB,
  };
  const STATION_DRAW = {
    // CODING — dark IDE screen with green code lines + a small terminal caret.
    coding(scene, g, x, y, objs) {
      g.fillStyle(S.codeGreen, 0.9); g.fillRect(x - 19, y - 42, 18, 2);
      g.fillStyle(S.codeDim, 0.9); g.fillRect(x - 19, y - 38, 26, 2);
      g.fillStyle(S.codeGreen, 0.9); g.fillRect(x - 15, y - 34, 20, 2);
      g.fillStyle(S.codeDim, 0.9); g.fillRect(x - 19, y - 30, 14, 2);
      const caret = scene.add.rectangle(x + 8, y - 30, 3, 4, S.codeGreen).setDepth(y + 32);
      scene.tweens.add({ targets: caret, alpha: 0.1, duration: 620, yoyo: true, repeat: -1 });
      objs.push(caret);
    },
    // REVIEW — coding screen (diff green/red lines) + a pinned PR ticket w/ a ✓.
    review(scene, g, x, y, objs) {
      g.fillStyle(0x86CFA6, 0.9); g.fillRect(x - 19, y - 42, 22, 2);
      g.fillStyle(0xF09B90, 0.9); g.fillRect(x - 19, y - 38, 16, 2);
      g.fillStyle(0x86CFA6, 0.9); g.fillRect(x - 19, y - 34, 26, 2);
      // PR ticket on the desk
      g.fillStyle(S.paper, 1); g.fillRect(x + 30, y - 12, 16, 12);
      g.fillStyle(S.violet, 1); g.fillRect(x + 30, y - 12, 16, 3);
      g.fillStyle(0x2E7F5C, 1); g.fillRect(x + 33, y - 6, 3, 3); g.fillRect(x + 36, y - 8, 2, 5);
    },
    // DESIGN — mood-board wall (2x3 swatches) behind the desk + a stylus.
    design(scene, g, x, y, objs) {
      const board = scene.add.graphics().setDepth(y - 60);
      board.fillStyle(0xF3E9DA, 1); board.fillRect(x - 44, y - 92, 40, 28);
      board.fillStyle(0xCBA87C, 1); board.fillRect(x - 44, y - 92, 40, 2);
      const sw = [S.coral, S.amber, 0x9BD8B4, S.sky, S.violet, S.pink];
      let hue = null;
      sw.forEach((c, i) => {
        const cx = x - 41 + (i % 3) * 13, cy = y - 88 + Math.floor(i / 3) * 12;
        const r = scene.add.rectangle(cx + 5, cy + 4, 10, 8, c).setDepth(y - 59);
        if (i === 4) hue = r;
        objs.push(r);
      });
      objs.push(board);
      // stylus on the desk
      g.fillStyle(S.pinkDk, 1); g.fillRect(x + 30, y - 8, 12, 2); g.fillStyle(S.ink, 1); g.fillRect(x + 40, y - 8, 3, 2);
      if (hue) scene.tweens.add({ targets: hue, alpha: 0.45, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    },
    // CALL — speech bubble + a "● live" dot floating over the desk.
    call(scene, g, x, y, objs) {
      g.fillStyle(S.paper, 1); g.fillRect(x - 6, y - 64, 24, 14); g.fillRect(x - 2, y - 50, 5, 4);
      g.fillStyle(S.sky, 1); g.fillRect(x - 3, y - 60, 18, 2); g.fillRect(x - 3, y - 56, 12, 2);
      const dot = scene.add.rectangle(x + 20, y - 60, 5, 5, 0x86CFA6).setDepth(y + 32);
      scene.tweens.add({ targets: dot, alpha: 0.2, duration: 800, yoyo: true, repeat: -1 });
      objs.push(dot);
    },
    // MUSIC — record player on the desk: spinning vinyl + rising ♪ notes. This is
    // the "why does theirs have a record player" hook. Reads even with no body.
    music(scene, g, x, y, objs) {
      g.fillStyle(S.wood, 1); g.fillRect(x - 20, y - 14, 34, 18);
      g.fillStyle(S.vinyl, 1); g.fillEllipse(x - 3, y - 5, 22, 14);
      g.fillStyle(S.coral, 1); g.fillEllipse(x - 3, y - 5, 6, 4);
      g.fillStyle(0xF0E2C8, 1); g.fillRect(x - 4, y - 6, 2, 2);
      // tonearm
      g.fillStyle(S.metal, 1); g.fillRect(x + 8, y - 12, 2, 9);
      // spinning highlight
      const spin = scene.add.rectangle(x - 3, y - 9, 3, 3, 0x6E7E79).setDepth(y + 32);
      scene.tweens.add({ targets: spin, angle: 360, duration: 1400, repeat: -1, ease: "Linear",
        onUpdate: (tw) => { const a = spin.angle * Math.PI / 180; spin.setPosition(x - 3 + Math.cos(a) * 7, y - 5 + Math.sin(a) * 4); } });
      objs.push(spin);
      // rising notes
      [0, 1].forEach((i) => {
        const note = scene.add.text(x + 12 + i * 6, y - 10, "♪", { fontFamily: "monospace", fontSize: "10px", color: "#9BD8B4" }).setDepth(y + 33);
        scene.tweens.add({ targets: note, y: y - 30, alpha: 0, duration: 1800, delay: i * 600, repeat: -1, ease: "Sine.easeOut" });
        objs.push(note);
      });
    },
    // WRITING — warm desk lamp + a page with a line of ink "writing" across it.
    writing(scene, g, x, y, objs) {
      // lamp
      g.fillStyle(S.metal, 1); g.fillRect(x + 26, y - 6, 2, 8); g.fillRect(x + 20, y - 16, 12, 2);
      g.fillStyle(S.amber, 1); g.fillRect(x + 18, y - 16, 8, 5);
      const glow = scene.add.rectangle(x + 24, y - 4, 26, 12, S.amber, 0.18).setDepth(y - 58);
      objs.push(glow);
      // page
      g.fillStyle(S.paper, 1); g.fillRect(x - 20, y - 12, 18, 13);
      g.fillStyle(S.ink, 0.7); g.fillRect(x - 17, y - 8, 10, 1); g.fillRect(x - 17, y - 5, 12, 1);
      const inkline = scene.add.rectangle(x - 17, y - 2, 2, 1, S.ink).setOrigin(0, 0.5).setDepth(y + 32);
      scene.tweens.add({ targets: inkline, scaleX: 6, duration: 1500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      objs.push(inkline);
    },
    // BROWSING — a tablet propped on the desk with scrolling lines.
    browsing(scene, g, x, y, objs) {
      g.fillStyle(0x3A4348, 1); g.fillRect(x - 14, y - 16, 22, 15);
      g.fillStyle(S.coral, 1); g.fillRect(x - 12, y - 14, 18, 3);
      g.fillStyle(0xEFE7DA, 1); g.fillRect(x - 12, y - 10, 18, 8);
      const rows = [];
      for (let i = 0; i < 3; i++) { const r = scene.add.rectangle(x - 11, y - 8 + i * 3, 14, 1, S.ink, 0.6).setOrigin(0, 0.5).setDepth(y + 32); rows.push(r); objs.push(r); }
      scene.tweens.add({ targets: rows, y: "-=2", duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    },
    // FOCUS / OTHER — deliberately quiet: a dim desk, a coffee cup, no signature.
    focus(scene, g, x, y, objs) {
      g.fillStyle(S.paper, 1); g.fillRect(x + 30, y - 8, 7, 6); g.fillStyle(S.coral, 1); g.fillRect(x + 37, y - 7, 2, 3);
      const glow = scene.add.rectangle(x, y - 30, 40, 20, 0xBBDCF0, 0.12).setDepth(y + 30);
      scene.tweens.add({ targets: glow, alpha: 0.04, duration: 2400, yoyo: true, repeat: -1 });
      objs.push(glow);
    },
  };
  STATION_DRAW.other = STATION_DRAW.focus;

  // --- Per-APP (tool) identity (docs/office-visual-design.md §2a) ----------
  // Owner direction: the office should read as the SPECIFIC app, not a vague
  // category. The ingest `tool` field already carries the app id (from the
  // desktop helper's catalog.rs: 'vscode','figma','chrome','spotify','zoom',
  // 'slack','notion','terminal', …). We render tool-FIRST, then fall back to
  // category, then to the plain look. Procedural approximation only — brand
  // ACCENT COLOR + a recognizable glyph/screen + the category's station/prop.
  // Pixel-perfect logos would need the spritesheet migration (future cost).
  //
  // Each entry: { accent (sprite trim + badge ink), badge (short glyph),
  //   category (station/zone fallback), screen (monitor painter key in
  //   TOOL_SCREEN, or null to keep the category screen) }.
  const TOOL_LOOK = {
    // ---- coding ----
    vscode:   { accent: "#4FA5E0", badge: "VS", category: "coding", screen: "vscode" },
    cursor:   { accent: "#C7D2CE", badge: "Cu", category: "coding", screen: "vscode" },
    xcode:    { accent: "#4FA5E0", badge: "Xc", category: "coding", screen: "vscode" },
    intellij: { accent: "#F0A79E", badge: "IJ", category: "coding", screen: "vscode" },
    pycharm:  { accent: "#9BD8B4", badge: "Py", category: "coding", screen: "vscode" },
    zed:      { accent: "#6E9FD8", badge: "Ze", category: "coding", screen: "vscode" },
    sublime:  { accent: "#EFC08A", badge: "Su", category: "coding", screen: "vscode" },
    // ---- terminal (coding, but a black prompt screen) ----
    terminal: { accent: "#9BD8B4", badge: ">_", category: "coding", screen: "terminal" },
    iterm:    { accent: "#9BD8B4", badge: ">_", category: "coding", screen: "terminal" },
    ghostty:  { accent: "#CFBBF0", badge: ">_", category: "coding", screen: "terminal" },
    warp:     { accent: "#6E9FD8", badge: ">_", category: "coding", screen: "terminal" },
    // ---- design ----
    figma:      { accent: "#F0A79E", badge: "Fi", category: "design", screen: "figma" },
    sketch:     { accent: "#EFC08A", badge: "Sk", category: "design", screen: "figma" },
    photoshop:  { accent: "#6E9FD8", badge: "Ps", category: "design", screen: "figma" },
    illustrator:{ accent: "#EFB472", badge: "Ai", category: "design", screen: "figma" },
    // ---- call ----
    zoom:    { accent: "#6E9FD8", badge: "Zm", category: "call", screen: "zoom" },
    teams:   { accent: "#9E86C8", badge: "Te", category: "call", screen: "zoom" },
    discord: { accent: "#9E86C8", badge: "Dc", category: "call", screen: "zoom" },
    meet:    { accent: "#86CFA6", badge: "Mt", category: "call", screen: "zoom" },
    // ---- music ----
    spotify:      { accent: "#86CFA6", badge: "Sp", category: "music", screen: null },
    "apple-music":{ accent: "#F0A79E", badge: "AM", category: "music", screen: null },
    // ---- writing ----
    notion:   { accent: "#59696E", badge: "N", category: "writing", screen: "notion" },
    obsidian: { accent: "#9E86C8", badge: "Ob", category: "writing", screen: "notion" },
    notes:    { accent: "#F8DFA0", badge: "Nt", category: "writing", screen: "notion" },
    word:     { accent: "#6E9FD8", badge: "W", category: "writing", screen: "notion" },
    // ---- browsing ----
    chrome:  { accent: "#6E9FD8", badge: "Ch", category: "browsing", screen: "chrome" },
    safari:  { accent: "#6E9FD8", badge: "Sf", category: "browsing", screen: "chrome" },
    arc:     { accent: "#F6BCD1", badge: "Ac", category: "browsing", screen: "chrome" },
    firefox: { accent: "#EFB472", badge: "Fx", category: "browsing", screen: "chrome" },
    // ---- chat (maps to browsing zone per catalog.rs) ----
    slack:   { accent: "#9E86C8", badge: "#", category: "browsing", screen: "slack" },
    // ---- generic ----
    other:   { accent: "#C7D2CE", badge: "•", category: "focus", screen: null },
  };

  // Monitor-screen painters: draw an app-recognizable picture on the desk's
  // 46x26 screen (top-left at x-23, y-46). Static — carries the read on the OG
  // card too. Signature: (g, x, y).
  const TOOL_SCREEN = {
    vscode(g, x, y) { // dark IDE, blue accent bar + code lines
      g.fillStyle(0x1E262B, 1); g.fillRect(x - 23, y - 46, 46, 26);
      g.fillStyle(0x2C6F9E, 1); g.fillRect(x - 23, y - 46, 4, 26);
      g.fillStyle(0x4FA5E0, 0.9); g.fillRect(x - 16, y - 42, 18, 2);
      g.fillStyle(0x86CFA6, 0.85); g.fillRect(x - 16, y - 38, 12, 2);
      g.fillStyle(0xEFC08A, 0.85); g.fillRect(x - 12, y - 34, 16, 2);
      g.fillStyle(0x6E7E79, 0.8); g.fillRect(x - 16, y - 30, 20, 2);
    },
    terminal(g, x, y) { // black screen, green prompt
      g.fillStyle(0x11161A, 1); g.fillRect(x - 23, y - 46, 46, 26);
      g.fillStyle(0x9BD8B4, 1); g.fillRect(x - 19, y - 42, 3, 2); g.fillRect(x - 14, y - 42, 12, 2);
      g.fillStyle(0x86CFA6, 0.8); g.fillRect(x - 19, y - 37, 18, 2); g.fillRect(x - 19, y - 32, 10, 2);
      g.fillStyle(0x9BD8B4, 1); g.fillRect(x - 5, y - 32, 4, 2);
    },
    figma(g, x, y) { // light canvas + the 4-colour blocks
      g.fillStyle(0xF3ECE4, 1); g.fillRect(x - 23, y - 46, 46, 26);
      g.fillStyle(0xF0A79E, 1); g.fillRect(x - 16, y - 42, 8, 8);   // red
      g.fillStyle(0xEFB472, 1); g.fillRect(x - 6, y - 42, 8, 8);    // orange
      g.fillStyle(0x86CFA6, 1); g.fillRect(x - 16, y - 32, 8, 8);   // green
      g.fillStyle(0x6E9FD8, 1); g.fillRect(x - 6, y - 32, 8, 8);    // blue
      g.fillStyle(0x9E86C8, 1); g.fillRect(x + 4, y - 37, 8, 8);    // purple
    },
    zoom(g, x, y) { // blue call screen, camera tiles
      g.fillStyle(0x2C4A6E, 1); g.fillRect(x - 23, y - 46, 46, 26);
      g.fillStyle(0x8FB8E0, 1); g.fillRect(x - 19, y - 42, 18, 8); g.fillRect(x + 1, y - 42, 18, 8);
      g.fillStyle(0xBEE7F7, 1); g.fillRect(x - 19, y - 32, 18, 8); g.fillRect(x + 1, y - 32, 18, 8);
      g.fillStyle(0xFFFFFF, 0.9); g.fillRect(x - 12, y - 40, 4, 4); g.fillRect(x + 8, y - 40, 4, 4);
    },
    chrome(g, x, y) { // white page + the 4-colour ring
      g.fillStyle(0xFFFFFF, 1); g.fillRect(x - 23, y - 46, 46, 26);
      g.fillStyle(0xEDEDED, 1); g.fillRect(x - 23, y - 46, 46, 6);
      g.fillStyle(0xF0A79E, 1); g.fillRect(x - 5, y - 36, 6, 3);
      g.fillStyle(0x86CFA6, 1); g.fillRect(x - 8, y - 33, 4, 5);
      g.fillStyle(0xEFC08A, 1); g.fillRect(x + 1, y - 33, 4, 5);
      g.fillStyle(0x6E9FD8, 1); g.fillRect(x - 4, y - 34, 4, 4);
    },
    slack(g, x, y) { // aubergine sidebar + the # colours
      g.fillStyle(0x3F2A3F, 1); g.fillRect(x - 23, y - 46, 46, 26);
      g.fillStyle(0xF0A79E, 1); g.fillRect(x - 19, y - 42, 5, 5); g.fillStyle(0x86CFA6, 1); g.fillRect(x - 13, y - 42, 5, 5);
      g.fillStyle(0xEFC08A, 1); g.fillRect(x - 19, y - 36, 5, 5); g.fillStyle(0x6E9FD8, 1); g.fillRect(x - 13, y - 36, 5, 5);
      g.fillStyle(0xEADFC7, 0.9); g.fillRect(x - 5, y - 42, 8, 2); g.fillRect(x - 5, y - 38, 6, 2); g.fillRect(x - 5, y - 34, 8, 2);
    },
    notion(g, x, y) { // clean white doc, a mono 'N' + text lines
      g.fillStyle(0xF7F5F1, 1); g.fillRect(x - 23, y - 46, 46, 26);
      g.fillStyle(0x2A2622, 1); g.fillRect(x - 19, y - 42, 2, 8); g.fillRect(x - 13, y - 42, 2, 8); g.fillRect(x - 18, y - 41, 5, 2);
      g.fillStyle(0x9AA3A0, 0.9); g.fillRect(x - 6, y - 40, 16, 2); g.fillRect(x - 19, y - 34, 28, 2); g.fillRect(x - 19, y - 30, 20, 2);
    },
  };

  // Resolve an actor's app look: tool first, then category, then null (plain).
  function appLook(a) {
    const t = a && a.tool ? TOOL_LOOK[a.tool] : null;
    return t || null;
  }
  // ------------------------------------------------------------------------

  function px(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }

  // stable seat / face across polls — same id always lands the same spot
  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }

  function makePerson(scene, key, opts) {
    if (scene.textures.exists(key)) return;
    const w = 14, h = 20;
    const tex = scene.textures.createCanvas(key, w, h);
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, w, h);
    const {
      hair, skin, shirt, pants, glow,
      hairStyle = "short", outfit = "plain", accessory = "none",
      accent = "#FFF8EC", build = "regular",
    } = opts;
    const LINE = "#59696E", SHOE = "#8A7358";

    if (glow) { ctx.globalAlpha = 0.22; px(ctx, 1, 1, 12, 18, glow); ctx.globalAlpha = 1; }

    const tx = build === "slim" ? 4 : 3;
    const tw = build === "slim" ? 6 : build === "broad" ? 9 : 8;
    const legL = tx + 1, legR = tx + tw - (tw >= 8 ? 3 : 2);

    if (hairStyle === "hood") {
      px(ctx, 2, 1, 10, 8, shirt); px(ctx, 3, 2, 8, 2, hair);
    } else if (hairStyle === "curly") {
      px(ctx, 3, 0, 8, 5, hair);
      px(ctx, 2, 2, 1, 4, hair); px(ctx, 11, 2, 1, 4, hair);
      px(ctx, 4, 0, 2, 1, hair);
    } else if (hairStyle === "long") {
      px(ctx, 4, 1, 6, 3, hair); px(ctx, 3, 2, 8, 4, hair);
      px(ctx, 2, 3, 1, 9, hair); px(ctx, 11, 3, 1, 9, hair);
    } else if (hairStyle === "bun") {
      px(ctx, 5, 0, 4, 2, hair);
      px(ctx, 4, 1, 6, 3, hair); px(ctx, 3, 2, 8, 4, hair);
    } else if (hairStyle === "cap") {
      px(ctx, 4, 1, 6, 3, hair); px(ctx, 3, 2, 8, 4, hair);
      px(ctx, 3, 1, 8, 2, accent); px(ctx, 2, 3, 5, 1, accent); px(ctx, 3, 3, 8, 1, LINE);
    } else if (hairStyle === "beanie") {
      px(ctx, 3, 2, 8, 4, hair);
      px(ctx, 3, 1, 8, 3, accent); px(ctx, 3, 3, 8, 1, LINE); px(ctx, 6, 0, 2, 1, accent);
    } else {
      px(ctx, 4, 1, 6, 3, hair); px(ctx, 3, 2, 8, 4, hair);
    }

    px(ctx, 4, 4, 6, 4, skin);
    if (hairStyle === "short" || hairStyle === "long" || hairStyle === "bun") px(ctx, 4, 3, 6, 1, hair);
    px(ctx, 5, 6, 1, 1, LINE); px(ctx, 8, 6, 1, 1, LINE);

    px(ctx, tx, 8, tw, 7, shirt);
    px(ctx, tx - 1, 9, 1, 5, shirt); px(ctx, tx + tw, 9, 1, 5, shirt);
    px(ctx, tx - 1, 13, 1, 2, skin); px(ctx, tx + tw, 13, 1, 2, skin);

    if (outfit === "hoodie") {
      px(ctx, tx, 8, tw, 2, accent);
      px(ctx, 6, 10, 1, 2, accent); px(ctx, 8, 10, 1, 2, accent);
      px(ctx, tx + 1, 12, tw - 2, 2, LINE);
    } else if (outfit === "collar") {
      px(ctx, tx, 8, 2, 7, accent); px(ctx, tx + tw - 2, 8, 2, 7, accent);
      px(ctx, 6, 8, 2, 1, "#FFF8EC"); px(ctx, 6, 9, 2, 4, pants);
    } else if (outfit === "stripes") {
      for (let y = 9; y < 15; y += 2) px(ctx, tx, y, tw, 1, accent);
    } else if (outfit === "overalls") {
      px(ctx, tx + 1, 8, 1, 3, pants); px(ctx, tx + tw - 2, 8, 1, 3, pants);
      px(ctx, tx + 1, 10, tw - 2, 5, pants); px(ctx, tx + 3, 12, 2, 2, accent);
    } else if (outfit === "vest") {
      px(ctx, tx, 8, 2, 7, accent); px(ctx, tx + tw - 2, 8, 2, 7, accent);
      px(ctx, tx + 2, 8, tw - 4, 1, "#FFF8EC");
    } else if (outfit === "apron") {
      px(ctx, tx + 1, 9, tw - 2, 6, accent);
      px(ctx, tx + 2, 8, 1, 2, accent); px(ctx, tx + tw - 3, 8, 1, 2, accent);
    }

    px(ctx, legL, 15, 2, 4, pants); px(ctx, legR, 15, 2, 4, pants);
    px(ctx, legL - 1, 19, 3, 1, SHOE); px(ctx, legR, 19, 3, 1, SHOE);

    if (accessory === "glasses") {
      px(ctx, 4, 5, 6, 1, LINE); px(ctx, 3, 5, 1, 2, LINE); px(ctx, 10, 5, 1, 2, LINE);
    } else if (accessory === "headphones") {
      px(ctx, 3, 0, 8, 1, LINE); px(ctx, 2, 3, 2, 3, LINE); px(ctx, 10, 3, 2, 3, LINE);
      px(ctx, 2, 4, 1, 1, accent); px(ctx, 11, 4, 1, 1, accent);
    } else if (accessory === "scarf") {
      px(ctx, tx + 1, 7, tw - 2, 2, accent); px(ctx, tx + tw - 3, 9, 2, 3, accent);
    } else if (accessory === "earrings") {
      px(ctx, 3, 6, 1, 1, accent); px(ctx, 10, 6, 1, 1, accent);
    } else if (accessory === "lanyard") {
      px(ctx, 6, 8, 1, 4, LINE); px(ctx, 8, 8, 1, 4, LINE); px(ctx, 6, 11, 3, 3, accent);
    }
    tex.refresh();
  }

  function isTyping() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable;
  }

  function OfficeSceneFactory(ui) {
    return class Room extends Phaser.Scene {
      constructor() { super("room"); }

      create() {
        this.agents = [];          // seated actors, keyed by external_id
        this.byId = new Map();
        this.freeDesks = DESKS.slice();
        this.overflow = new Set();  // actors present but with no free desk → "+N more"
        this.overflowTag = null;
        this.solids = [];
        this.near = null;
        this.openAgent = null;

        this.buildOffice();

        makePerson(this, "player", {
          hair: "#3E3128", skin: "#D9A277", shirt: "#FFFDF4", pants: "#5E6E86", glow: null,
          hairStyle: "short", outfit: "collar", accessory: "none", accent: "#DCE7E8",
        });

        this.addCoworkers();

        this.player = this.physics.add.sprite(720, 620, "player").setScale(3);
        this.playerShadow = this.footShadow(720, 620);
        this.player.body.setSize(10, 8).setOffset(2, 12);
        this.physics.add.collider(this.player, this.solids);
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys("W,A,S,D,E");

        const cam = this.cameras.main;
        cam.setBounds(0, 0, W, H);
        cam.startFollow(this.player, true, 0.09, 0.09, 0, 120);
        cam.setDeadzone(220, 130);

        this.prompt = this.add.text(0, 0, "press  E  to talk", {
          fontFamily: "ui-monospace, Menlo, monospace", fontSize: "10px", color: "#8A4B12",
        }).setOrigin(0.5).setDepth(1300).setResolution(3).setAlpha(0);
        this.prompt.setStroke("#FFF6E4", 4);

        this.ready = true;
        if (this.pendingState) { this.applyState(this.pendingState); this.pendingState = null; }
      }

      // ---------- state reconcile: the one thing the live office adds ----------
      applyState(state) {
        if (!this.ready) { this.pendingState = state; return; }
        const actors = (state && state.actors) || [];
        const seen = new Set();

        actors.forEach((a) => {
          if (a.stale) return; // a stale actor has walked out; skip it
          seen.add(a.externalId);
          const existing = this.byId.get(a.externalId);
          if (existing) this.updateAgent(existing, a);
          else this.addAgent(a);
        });

        // anyone we were showing who is gone or stale walks out
        for (const [id, agent] of this.byId) {
          if (!seen.has(id)) this.removeAgent(agent);
        }
        // drop overflow ids that are no longer present, then, if seats freed up,
        // pull waiting actors in from the overflow list
        for (const id of Array.from(this.overflow)) if (!seen.has(id)) this.overflow.delete(id);
        if (this.freeDesks.length && this.overflow.size) {
          for (const a of actors) {
            if (!this.freeDesks.length) break;
            if (this.overflow.has(a.externalId) && !this.byId.has(a.externalId)) {
              this.overflow.delete(a.externalId);
              this.addAgent(a);
            }
          }
        }
        this.renderOverflowTag();

        this.buildTerminal();
        if (this.openAgent && this.byId.has(this.openAgent.externalId)) {
          this.renderPanel(this.byId.get(this.openAgent.externalId));
        }
      }

      lookFor(a) {
        // a demo actor carries its own look; a live actor gets a stable one.
        const base = a.look || PALETTES[hashString(a.externalId) % PALETTES.length];
        // Overlay ONLY the light signal (accessory + accent) — the actor's core
        // identity (hair/skin/build/outfit) is preserved, per the locked
        // decision. accent uses the SPECIFIC APP's brand colour first (tool),
        // then the category, so a VS Code coder trims blue and a Figma designer
        // trims red. The heavy "which app" read is carried by the screen + prop +
        // badge, not the body.
        const app = appLook(a);
        const cat = CATEGORY_LOOK[a.category];
        const accent = (app && app.accent) || (cat && cat.accent);
        const accessory = cat && cat.accessory;
        if (!accent && !accessory) return base;
        return { ...base, ...(accessory ? { accessory } : {}), ...(accent ? { accent } : {}) };
      }
      // The desk-monitor screen: a specific app paints a recognizable screen
      // (VS Code / Figma / Zoom / …); otherwise fall back to the category tint.
      paintScreen(g, a, x, y) {
        const app = appLook(a);
        if (app && app.screen && TOOL_SCREEN[app.screen]) { TOOL_SCREEN[app.screen](g, x, y); return true; }
        const c = CATEGORY_LOOK[(a && a.category) || ""];
        if (c && c.screen != null) { g.fillStyle(c.screen, 1); g.fillRect(x - 23, y - 46, 46, 26); return true; }
        return false;
      }

      deskFor(a) {
        // stable desk by id when free, else the next open station
        const idx = hashString(a.externalId) % DESKS.length;
        const preferred = DESKS[idx];
        const takenFree = this.freeDesks.findIndex((d) => d.x === preferred.x && d.y === preferred.y);
        if (takenFree >= 0) return this.freeDesks.splice(takenFree, 1)[0];
        return this.freeDesks.shift() || null;
      }

      addAgent(a) {
        const desk = this.deskFor(a);
        if (!desk) { this.overflow.add(a.externalId); return; } // seats full → counted, shown as "+N more"
        // tool + category are part of the texture key so an app change re-skins
        // the sprite accent (makePerson caches by key).
        const key = this.actorTexKey(a);
        makePerson(this, key, this.lookFor(a));
        const agent = this.seatAgent(a, key, desk);
        this.byId.set(a.externalId, agent);
      }

      updateAgent(agent, a) {
        agent.name = a.name;
        agent.role = a.role;
        agent.status = a.status;
        agent.currentTask = a.currentTask;
        agent.events = a.events || [];
        agent.object = a.object || null;
        const col = STATUS_COL[a.status] || STATUS_COL.idle;
        agent.pillBg.setStrokeStyle(2, col);
        agent.pillTx.setText((a.status || "").toUpperCase()).setColor(STATUS_INK[a.status] || STATUS_INK.idle);
        agent.nameTx.setText(a.name);
        // Re-skin the desk when the actor's APP or category changed (a coder who
        // switches from VS Code to a Zoom call, or a GitHub actor who moves from
        // a push to a PR review). The screen/prop/badge carry the specific-app
        // read; the body swaps only its accent + a light accessory.
        const toolChanged = (a.tool || null) !== agent.tool;
        const catChanged = (a.category || null) !== agent.category;
        agent.tool = a.tool || null;
        agent.category = a.category || null;
        if (toolChanged || catChanged) {
          const key = this.actorTexKey(a);
          makePerson(this, key, this.lookFor(a));
          if (agent.spr) agent.spr.setTexture(key);
          if (agent.desk) {
            this.setCategoryBadge(agent, agent.desk);
            this.setStationProp(agent, agent.desk);
          }
        }
      }

      actorTexKey(a) {
        return "actor-" + hashString(a.externalId) + "-" + (a.tool || "_") + "-" + (a.category || "none");
      }

      removeAgent(agent) {
        this.byId.delete(agent.externalId);
        const i = this.agents.indexOf(agent);
        if (i >= 0) this.agents.splice(i, 1);
        if (this.openAgent === agent) this.closePanel();
        if (this.near === agent) this.near = null;
        if (agent.desk) this.freeDesks.push(agent.desk);
        if (agent.badge) { agent.badge.bg.destroy(); agent.badge.tx.destroy(); agent.badge = null; }
        if (agent.station) { agent.station.forEach((o) => o && o.destroy()); agent.station = null; }
        [agent.pillBg, agent.pillTx, agent.nameTx, agent.spr, agent.shadow].forEach((o) => o && o.destroy());
      }

      // ---------- drawing helpers (verbatim) ----------
      layer(depth) { return this.add.graphics().setDepth(depth); }
      footShadow(x, y) { return this.add.ellipse(x, y + 28, 26, 10, 0x8A7B66, 0.2).setDepth(y + 29); }
      shadow(x, y, w, h) { this.shadowLayer.fillStyle(0x8A7B66, 0.15); this.shadowLayer.fillEllipse(x, y, w, h); }
      solid(x, y, w, h) {
        const s = this.add.rectangle(x, y, w, h, 0, 0);
        this.physics.add.existing(s, true);
        this.solids.push(s);
        return s;
      }

      plankFloor(g, x, y, w, h) {
        for (let yy = y; yy < y + h; yy += 26) {
          const row = Math.round((yy - y) / 26);
          for (let xx = x - (row % 2 ? 80 : 0); xx < x + w; xx += 168) {
            const px0 = Math.max(x, xx), px1 = Math.min(x + w, xx + 168);
            if (px1 <= px0) continue;
            g.fillStyle((row + Math.round(xx / 168)) % 2 ? C.wood : C.woodAlt, 1);
            g.fillRect(px0, yy, px1 - px0, Math.min(26, y + h - yy));
            g.fillStyle(C.woodSeam, 0.4);
            g.fillRect(px0, yy, 1, Math.min(26, y + h - yy));
          }
          g.fillStyle(C.woodSeam, 0.22); g.fillRect(x, yy, w, 1);
        }
      }

      carpetFloor(g, x, y, w, h, tone) {
        const t = tone === "oat"
          ? { base: C.oat, alt: C.oatAlt, fleck: C.oatFleck, edge: C.oatEdge }
          : { base: C.carpet, alt: C.carpetAlt, fleck: C.carpetFleck, edge: C.carpetEdge };
        g.fillStyle(t.base, 1); g.fillRect(x, y, w, h);
        for (let yy = y; yy < y + h; yy += 8) {
          for (let xx = x + ((yy / 8) % 2 ? 4 : 0); xx < x + w; xx += 8) {
            g.fillStyle((xx + yy) % 16 ? t.alt : t.fleck, 0.6);
            g.fillRect(xx, yy, 3, 3);
          }
        }
        this.zoneEdge(g, x, y, w, h, t.edge);
      }

      zoneEdge(g, x, y, w, h, col) {
        g.fillStyle(col, 0.8);
        g.fillRect(x, y, w, 3); g.fillRect(x, y + h - 3, w, 3);
        g.fillRect(x, y, 3, h); g.fillRect(x + w - 3, y, 3, h);
      }

      tileFloor(g, x, y, w, h) {
        for (let yy = y; yy < y + h; yy += 24) {
          for (let xx = x; xx < x + w; xx += 24) {
            g.fillStyle(((xx / 24) + (yy / 24)) % 2 ? C.tile : C.tileAlt, 1);
            g.fillRect(xx, yy, Math.min(24, x + w - xx), Math.min(24, y + h - yy));
          }
        }
        g.lineStyle(1, C.tileGrout, 0.5);
        for (let yy = y; yy <= y + h; yy += 24) g.lineBetween(x, yy, x + w, yy);
        for (let xx = x; xx <= x + w; xx += 24) g.lineBetween(xx, y, xx, y + h);
        this.zoneEdge(g, x, y, w, h, 0xD8C6A8);
      }

      rug(g, x, y, w, h, col, edge) {
        g.fillStyle(col, 0.85); g.fillRect(x, y, w, h);
        g.fillStyle(edge, 0.9);
        g.fillRect(x, y, w, 6); g.fillRect(x, y + h - 6, w, 6);
        g.fillRect(x, y, 6, h); g.fillRect(x + w - 6, y, 6, h);
        g.fillStyle(edge, 0.35);
        for (let xx = x + 18; xx < x + w - 18; xx += 26) g.fillRect(xx, y + 14, 10, h - 28);
      }

      plant(x, y) {
        const g = this.layer(y + 6);
        this.shadow(x, y + 8, 34, 14);
        g.fillStyle(0x6B4A2F, 1); g.fillRect(x - 11, y - 8, 22, 16);
        g.fillStyle(0x8A5E38, 1); g.fillRect(x - 11, y - 8, 22, 4);
        g.fillStyle(C.leaf, 1); g.fillRect(x - 15, y - 34, 30, 26); g.fillRect(x - 9, y - 44, 18, 12);
        g.fillStyle(C.leafLight, 1); g.fillRect(x - 12, y - 40, 6, 18); g.fillRect(x + 3, y - 30, 6, 14);
        this.solid(x, y - 2, 24, 18);
      }

      deskUnit(x, y, seat = 0) {
        const g = this.layer(y + 30);
        this.shadow(x, y + 26, 124, 26);
        g.fillStyle(C.deskLeg, 1); g.fillRect(x - 48, y + 22, 8, 8); g.fillRect(x + 40, y + 22, 8, 8);
        g.fillStyle(C.desk, 1); g.fillRect(x - 52, y - 6, 104, 30);
        g.fillStyle(C.deskTop, 1); g.fillRect(x - 52, y - 14, 104, 10);
        g.fillStyle(0xC08A52, 0.5); g.fillRect(x - 52, y - 14, 104, 2);
        g.fillStyle(C.metalDark, 1); g.fillRect(x - 3, y - 18, 6, 6);
        g.fillStyle(C.monitor, 1); g.fillRect(x - 27, y - 50, 54, 34);
        g.fillStyle([0xBBDCF0, 0x9BD8B4, 0xCFBBF0, 0xF8DFA0, 0xF4B3A6, 0xBEE7F7][seat % 6], 1);
        g.fillRect(x - 23, y - 46, 46, 26);
        g.fillStyle(0xFFFFFF, 0.75);
        g.fillRect(x - 19, y - 42, 22, 3); g.fillRect(x - 19, y - 36, 32, 3); g.fillRect(x - 19, y - 30, 16, 3);
        g.fillStyle(0x2A3531, 1); g.fillRect(x - 14, y - 12, 28, 7);
        g.fillStyle(C.cream, 1); g.fillRect(x + 22, y - 13, 8, 8);
        g.fillStyle(C.ochre, 1); g.fillRect(x + 29, y - 11, 3, 4);
        g.fillStyle(0xE8DCC4, 0.85); g.fillRect(x - 44, y - 12, 16, 10);
        this.deskProp(g, x - 38, y - 14, seat);
        g.fillStyle(0xBBDCF0, 0.18); g.fillEllipse(x, y - 6, 120, 30);
        const cg = this.layer(y + 44);
        cg.fillStyle(C.metalDark, 1); cg.fillRect(x - 16, y + 30, 32, 8);
        cg.fillStyle(C.metal, 1); cg.fillRect(x - 18, y + 36, 36, 14);
        this.solid(x, y + 4, 104, 44);
      }

      deskProp(g, x, y, seat) {
        switch (seat % 6) {
          case 0:
            g.fillStyle(0xF4B3A6, 1); g.fillRect(x, y - 4, 16, 4);
            g.fillStyle(0x9BD8B4, 1); g.fillRect(x + 1, y - 8, 14, 4);
            g.fillStyle(0xCFBBF0, 1); g.fillRect(x + 2, y - 11, 12, 3);
            break;
          case 1:
            g.fillStyle(0xD68B62, 1); g.fillRect(x + 3, y - 6, 10, 6);
            g.fillStyle(0x86D493, 1); g.fillRect(x + 6, y - 16, 4, 10);
            g.fillStyle(0x9BD3A8, 1); g.fillRect(x + 3, y - 13, 3, 4); g.fillRect(x + 10, y - 11, 3, 3);
            g.fillStyle(0xF9CBDA, 1); g.fillRect(x + 6, y - 18, 4, 2);
            break;
          case 2:
            g.fillStyle(0xCBA87C, 1); g.fillRect(x + 1, y - 13, 14, 13);
            g.fillStyle(0xFFF8EC, 1); g.fillRect(x + 3, y - 11, 10, 9);
            g.fillStyle(0xBEE7F7, 1); g.fillRect(x + 3, y - 11, 10, 4);
            g.fillStyle(0xF4B3A6, 1); g.fillRect(x + 5, y - 7, 3, 5);
            g.fillStyle(0xF8DFA0, 1); g.fillRect(x + 9, y - 7, 3, 5);
            break;
          case 3:
            g.fillStyle(0xB7C9CB, 1); g.fillRect(x + 6, y - 10, 2, 10);
            g.fillStyle(0xF4B3A6, 1); g.fillRect(x + 2, y - 15, 10, 5);
            g.fillStyle(0xFFF3C4, 0.8); g.fillRect(x + 4, y - 10, 6, 8);
            break;
          case 4:
            g.fillStyle(0xFFFFFF, 1); g.fillRect(x + 2, y - 5, 7, 5);
            g.fillStyle(0xCFBBF0, 1); g.fillRect(x + 3, y - 10, 7, 5);
            g.fillStyle(0x9BD8B4, 1); g.fillRect(x + 4, y - 14, 7, 4);
            break;
          default:
            g.fillStyle(0xF8DFA0, 1); g.fillRect(x + 3, y - 8, 9, 6);
            g.fillStyle(0xF8DFA0, 1); g.fillRect(x + 9, y - 12, 5, 5);
            g.fillStyle(0xF29C8D, 1); g.fillRect(x + 13, y - 10, 2, 2);
            g.fillStyle(0x59696E, 1); g.fillRect(x + 12, y - 11, 1, 1);
        }
      }

      cubicleDivider(x, y, h) {
        const g = this.layer(y + h / 2);
        g.fillStyle(C.partition, 1); g.fillRect(x - 8, y - h / 2, 16, h);
        g.fillStyle(C.partitionTop, 1); g.fillRect(x - 8, y - h / 2, 16, 4);
        g.fillStyle(0xFFFFFF, 0.16); g.fillRect(x - 5, y - h / 2 + 8, 10, h - 16);
        for (let i = 0; i < 3; i++) {
          g.fillStyle(CONFETTI[(x + i * 3) % CONFETTI.length], 0.95);
          g.fillRect(x - 5, y - h / 2 + 18 + i * 30, 9, 9);
        }
        g.fillStyle(0xA6BEB6, 0.3); g.fillRect(x + 8, y - h / 2 + 3, 5, h);
        this.solid(x, y, 16, h);
      }

      waterCooler(x, y) {
        const g = this.layer(y + 10);
        this.shadow(x, y + 10, 32, 12);
        g.fillStyle(0xDCEDEA, 1); g.fillRect(x - 12, y - 20, 24, 30);
        g.fillStyle(0xBEE7F7, 0.95); g.fillRect(x - 11, y - 48, 22, 28);
        g.fillStyle(0xE6F8FE, 1); g.fillRect(x - 11, y - 48, 22, 5);
        g.fillStyle(0x9FC7DE, 1); g.fillRect(x - 4, y - 8, 8, 4);
        this.solid(x, y - 6, 24, 34);
      }

      printer(x, y) {
        const g = this.layer(y + 12);
        this.shadow(x, y + 12, 56, 16);
        g.fillStyle(0xE4EDEC, 1); g.fillRect(x - 24, y - 26, 48, 38);
        g.fillStyle(0xC3D4D6, 1); g.fillRect(x - 24, y - 30, 48, 8);
        g.fillStyle(0xFFFFFF, 1); g.fillRect(x - 16, y - 34, 32, 6);
        const led = this.add.rectangle(x + 14, y - 16, 4, 4, C.green).setDepth(y + 13);
        this.tweens.add({ targets: led, alpha: 0.2, duration: 1200, yoyo: true, repeat: -1 });
        this.solid(x, y - 8, 48, 44);
      }

      meetingTable(x, y) {
        const g = this.layer(y + 40);
        this.shadow(x, y + 34, 274, 30);
        g.fillStyle(C.deskLeg, 1); g.fillRect(x - 20, y + 26, 40, 12);
        g.fillStyle(C.wood2, 1); g.fillRect(x - 128, y - 32, 256, 66);
        g.fillStyle(0xF3D6A6, 1); g.fillRect(x - 128, y - 32, 256, 10);
        g.fillStyle(0xCBA87C, 0.5); g.fillRect(x - 128, y + 28, 256, 6);
        [-88, -30, 32, 88].forEach((o, i) => {
          g.fillStyle(C.monitor, 1); g.fillRect(x + o - 14, y - 16, 28, 16);
          g.fillStyle([0xBBDCF0, 0x9BD8B4, 0xCFBBF0, 0xF8DFA0][i], 1); g.fillRect(x + o - 11, y - 13, 22, 10);
          g.fillStyle(0xFFFFFF, 0.9); g.fillRect(x + o - 8, y + 6, 16, 10);
          g.fillStyle(CONFETTI[i], 0.9); g.fillRect(x + o - 8, y + 6, 16, 3);
        });
        g.fillStyle(0xE8DCC4, 1); g.fillEllipse(x, y + 12, 34, 14);
        g.fillStyle(C.coral, 1); g.fillRect(x - 9, y + 6, 8, 8);
        g.fillStyle(C.sunflower, 1); g.fillRect(x + 1, y + 5, 8, 8);
        g.fillStyle(C.leafLight, 1); g.fillRect(x - 3, y + 2, 7, 7);
        this.solid(x, y, 256, 74);
        [-90, -30, 30, 90].forEach((o) => { this.chair(x + o, y - 52, true); this.chair(x + o, y + 62, false); });
      }

      chair(x, y, facingAway) {
        const g = this.layer(y + 16);
        this.shadow(x, y + 12, 34, 12);
        const seat = CONFETTI[(x + y) % CONFETTI.length];
        g.fillStyle(0xB6C6C4, 1); g.fillRect(x - 14, y - 4, 28, 16);
        g.fillStyle(seat, 1); g.fillRect(x - 12, y - 2, 24, 12);
        g.fillStyle(seat, 1);
        if (facingAway) g.fillRect(x - 15, y - 22, 30, 16); else g.fillRect(x - 15, y + 10, 30, 14);
        g.fillStyle(0xFFFFFF, 0.35);
        if (facingAway) g.fillRect(x - 15, y - 22, 30, 3); else g.fillRect(x - 15, y + 21, 30, 3);
        this.solid(x, y, 28, 26);
      }

      couch(x, y, w, col) {
        const g = this.layer(y + 22);
        this.shadow(x, y + 20, w + 14, 20);
        const body = col || C.couch;
        g.fillStyle(Phaser.Display.Color.IntegerToColor(body).darken(18).color, 1);
        g.fillRect(x - w / 2, y - 26, w, 44);
        g.fillStyle(body, 1); g.fillRect(x - w / 2 + 8, y - 10, w - 16, 28);
        g.fillStyle(0xFFFFFF, 0.16);
        for (let i = 0; i < 3; i++) g.fillRect(x - w / 2 + 12 + i * ((w - 24) / 3), y - 8, (w - 34) / 3, 22);
        g.fillStyle(C.sunflower, 1); g.fillRect(x - w / 2 + 14, y - 6, 16, 14);
        g.fillStyle(C.lilac, 1); g.fillRect(x + w / 2 - 32, y - 6, 16, 14);
        g.fillStyle(C.deskLeg, 1); g.fillRect(x - w / 2 + 4, y + 18, 8, 6); g.fillRect(x + w / 2 - 12, y + 18, 8, 6);
        this.solid(x, y - 2, w, 44);
      }

      coffeeTable(x, y) {
        const g = this.layer(y + 14);
        this.shadow(x, y + 14, 100, 18);
        g.fillStyle(C.deskLeg, 1); g.fillRect(x - 44, y - 12, 88, 26);
        g.fillStyle(C.wood2, 1); g.fillRect(x - 44, y - 16, 88, 8);
        g.fillStyle(0xFFFFFF, 0.95); g.fillRect(x - 26, y - 12, 20, 6);
        g.fillStyle(C.pink, 1); g.fillRect(x + 8, y - 20, 12, 6);
        g.fillStyle(C.leafLight, 1); g.fillRect(x + 12, y - 16, 4, 8);
        g.fillStyle(C.sky, 0.9); g.fillRect(x + 8, y - 12, 12, 6);
        this.solid(x, y - 2, 88, 30);
      }

      bookshelf(x, y) {
        const g = this.layer(y + 12);
        this.shadow(x, y + 12, 56, 16);
        g.fillStyle(C.deskLeg, 1); g.fillRect(x - 22, y - 74, 44, 86);
        const cols = [0xF4B3A6, 0xF8DFA0, 0x9BD8B4, 0xBEE7F7, 0xFFFFFF, 0xCFBBF0];
        for (let r = 0; r < 3; r++) {
          g.fillStyle(0xDBBB8E, 1); g.fillRect(x - 19, y - 70 + r * 27, 38, 24);
          for (let i = 0; i < 7; i++) {
            g.fillStyle(cols[(r * 3 + i) % cols.length], 1);
            g.fillRect(x - 18 + i * 5, y - 68 + r * 27 + (i % 3), 4, 20 - (i % 3));
          }
        }
        this.solid(x, y - 12, 44, 60);
      }

      counter(x, y, w, h) {
        const g = this.layer(y + h / 2);
        g.fillStyle(0xF6EEDD, 1); g.fillRect(x - w / 2, y - h / 2, w, h);
        g.fillStyle(0xD7E4E3, 1); g.fillRect(x - w / 2, y - h / 2, w, 8);
        g.fillStyle(0xEADFC7, 1);
        for (let yy = y - h / 2 + 14; yy < y + h / 2; yy += 34) g.fillRect(x - w / 2 + 4, yy, w - 8, 26);
        for (let yy = y - h / 2; yy < y + h / 2; yy += 14) {
          g.fillStyle(CONFETTI[Math.round(yy / 14) % CONFETTI.length], 0.8);
          g.fillRect(x - w / 2, yy + 2, 5, 10);
        }
        this.solid(x, y, w, h);
        return g;
      }

      coffeeMachine(x, y) {
        const g = this.layer(y + 10);
        g.fillStyle(C.coral, 1); g.fillRect(x - 14, y - 30, 28, 34);
        g.fillStyle(0xFFFFFF, 0.9); g.fillRect(x - 9, y - 26, 18, 8);
        g.fillStyle(0x9FB0AE, 1); g.fillRect(x - 8, y - 10, 16, 10);
        g.fillStyle(C.cream, 1); g.fillRect(x - 5, y - 4, 10, 6);
        const s = this.add.rectangle(x, y - 38, 3, 8, 0xFFFFFF, 0.6).setDepth(y + 11);
        this.tweens.add({ targets: s, y: y - 54, alpha: 0, duration: 1800, repeat: -1, ease: "Sine.easeOut" });
      }

      fridge(x, y) {
        const g = this.layer(y + 12);
        this.shadow(x, y + 12, 52, 16);
        g.fillStyle(0xEDF5F3, 1); g.fillRect(x - 20, y - 62, 40, 74);
        g.fillStyle(0xD7E4E3, 1); g.fillRect(x - 20, y - 26, 40, 3);
        g.fillStyle(0xC3D4D6, 1); g.fillRect(x + 10, y - 46, 4, 14); g.fillRect(x + 10, y - 18, 4, 14);
        g.fillStyle(C.sunflower, 1); g.fillRect(x - 15, y - 56, 12, 10);
        g.fillStyle(C.sky, 1); g.fillRect(x - 15, y - 44, 6, 6);
        g.fillStyle(C.coral, 1); g.fillRect(x - 6, y - 44, 6, 6);
        this.solid(x, y - 16, 40, 60);
      }

      roundTable(x, y) {
        const g = this.layer(y + 16);
        this.shadow(x, y + 14, 90, 22);
        g.fillStyle(C.deskLeg, 1); g.fillRect(x - 6, y, 12, 16);
        g.fillStyle(0xF3D6A6, 1); g.fillEllipse(x, y - 4, 78, 46);
        g.fillStyle(0xFCE9C8, 1); g.fillEllipse(x, y - 8, 78, 40);
        g.fillStyle(0xFFFFFF, 1); g.fillRect(x - 16, y - 16, 9, 9);
        g.fillStyle(C.leafLight, 1); g.fillRect(x + 6, y - 18, 5, 10);
        g.fillStyle(C.pink, 1); g.fillRect(x + 4, y - 24, 9, 7);
        this.solid(x, y - 4, 78, 46);
        [[-52, 0], [52, 0], [0, -34], [0, 34]].forEach(([dx, dy], i) => {
          const sg = this.layer(y + dy + 12);
          sg.fillStyle(CONFETTI[(i + Math.round(y / 40)) % CONFETTI.length], 1);
          sg.fillRect(x + dx - 10, y + dy - 6, 20, 14);
          sg.fillStyle(0xFFFFFF, 0.3); sg.fillRect(x + dx - 10, y + dy - 10, 20, 6);
        });
      }

      pingPong(x, y) {
        const g = this.layer(y + 30);
        this.shadow(x, y + 46, 196, 26);
        g.fillStyle(0x9CCFE4, 1); g.fillRect(x - 90, y - 46, 180, 92);
        g.fillStyle(0xB4DEEE, 1); g.fillRect(x - 86, y - 42, 172, 84);
        g.fillStyle(C.cream, 1);
        g.fillRect(x - 86, y - 2, 172, 3); g.fillRect(x - 86, y - 42, 172, 2); g.fillRect(x - 86, y + 40, 172, 2);
        g.fillStyle(C.cream, 0.9); g.fillRect(x - 2, y - 42, 4, 84);
        g.fillStyle(C.red, 1); g.fillRect(x + 40, y + 12, 14, 10);
        g.fillStyle(0x3A2617, 1); g.fillRect(x + 52, y + 15, 8, 4);
        this.solid(x, y, 180, 92);
        const ball = this.add.rectangle(x - 50, y - 20, 5, 5, 0xF0E2C8).setDepth(y + 31);
        this.tweens.add({ targets: ball, x: x + 50, y: y + 16, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }

      arcade(x, y) {
        const g = this.layer(y + 12);
        this.shadow(x, y + 12, 56, 16);
        g.fillStyle(0xC6ACE8, 1); g.fillRect(x - 22, y - 78, 44, 90);
        g.fillStyle(0x8A7FA6, 1); g.fillRect(x - 17, y - 72, 34, 28);
        g.fillStyle(0xA9B6EA, 1); g.fillRect(x - 14, y - 68, 28, 20);
        g.fillStyle(C.sunflower, 1); g.fillRect(x - 22, y - 40, 44, 14);
        g.fillStyle(C.red, 1); g.fillRect(x - 12, y - 37, 7, 7);
        g.fillStyle(C.sky, 1); g.fillRect(x + 3, y - 37, 7, 7);
        this.solid(x, y - 22, 44, 66);
        const p = this.add.rectangle(x - 6, y - 60, 5, 5, 0x9BE8D8).setDepth(y + 13);
        this.tweens.add({ targets: p, x: x + 8, duration: 700, yoyo: true, repeat: -1, ease: "Steps" });
      }

      serverRack(x, y) {
        const g = this.layer(y + 12);
        this.shadow(x, y + 12, 64, 18);
        g.fillStyle(0xC2D2D6, 1); g.fillRect(x - 26, y - 84, 52, 96);
        g.fillStyle(0xD5E1E3, 1); g.fillRect(x - 22, y - 80, 44, 88);
        for (let r = 0; r < 6; r++) {
          g.fillStyle(0xAABCC4, 1); g.fillRect(x - 19, y - 76 + r * 14, 38, 11);
          const led = this.add.rectangle(x + 12, y - 71 + r * 14, 4, 4, CONFETTI[r % CONFETTI.length]).setDepth(y + 13);
          this.tweens.add({ targets: led, alpha: 0.15, duration: 500 + r * 190, yoyo: true, repeat: -1 });
        }
        this.solid(x, y - 24, 52, 70);
      }

      whiteboard(x, y) {
        const g = this.layer(y);
        g.fillStyle(0xD7E4E3, 1); g.fillRect(x - 62, y - 44, 124, 52);
        g.fillStyle(0xFFFFFF, 1); g.fillRect(x - 58, y - 40, 116, 44);
        g.fillStyle(0xA5CDE4, 0.95);
        g.fillRect(x - 48, y - 32, 40, 3); g.fillRect(x - 48, y - 24, 62, 3); g.fillRect(x - 48, y - 16, 28, 3);
        g.fillStyle(C.coral, 0.95); g.fillRect(x + 12, y - 34, 30, 22);
        g.fillStyle(C.green, 0.95); g.fillRect(x - 48, y - 8, 34, 3);
        g.fillStyle(C.sunflower, 1); g.fillRect(x + 30, y + 4, 12, 3);
      }

      wallArt(x, y, kind) {
        const g = this.layer(-50);
        g.fillStyle(C.deskLeg, 1); g.fillRect(x - 30, y - 32, 60, 60);
        g.fillStyle(0xFDF6E6, 1); g.fillRect(x - 26, y - 28, 52, 52);
        if (kind === 0) {
          g.fillStyle(C.sun, 1); g.fillEllipse(x, y - 8, 30, 30);
          g.fillStyle(C.coral, 1); g.fillRect(x - 26, y + 4, 52, 20);
          g.fillStyle(C.lilac, 1); g.fillRect(x - 26, y + 14, 52, 10);
        } else if (kind === 1) {
          const b = [C.coral, C.sunflower, C.sky, C.green];
          b.forEach((c, i) => { g.fillStyle(c, 1); g.fillRect(x - 26 + (i % 2) * 26, y - 28 + Math.floor(i / 2) * 26, 26, 26); });
        } else {
          g.fillStyle(C.ink, 1);
          for (let i = 0; i < 6; i++) g.fillRect(x - 20 + i * 7, y - 16 + (i % 2 ? 0 : 14), 7, 4);
          g.fillStyle(C.pink, 1); g.fillRect(x - 6, y + 6, 14, 14);
        }
      }

      stringLights(x1, x2, y) {
        const g = this.layer(1150);
        g.lineStyle(2, 0xC3D4D6, 0.9);
        const seg = 40, n = Math.floor((x2 - x1) / seg);
        for (let i = 0; i < n; i++) {
          const ax = x1 + i * seg, bx = ax + seg;
          g.lineBetween(ax, y + (i % 2 ? 10 : 0), bx, y + (i % 2 ? 0 : 10));
          const bulb = this.add.rectangle(bx, y + (i % 2 ? 0 : 10) + 6, 7, 9, CONFETTI[i % CONFETTI.length]).setDepth(1151);
          this.tweens.add({ targets: bulb, alpha: 0.45, duration: 1400 + i * 130, yoyo: true, repeat: -1 });
        }
      }

      pendantLamp(x, y) {
        const g = this.layer(1160);
        g.lineStyle(2, 0xC3D4D6, 0.95); g.lineBetween(x, y - 60, x, y - 20);
        g.fillStyle(C.sunflower, 1); g.fillRect(x - 14, y - 22, 28, 12);
        g.fillStyle(0xFFF3C4, 1); g.fillRect(x - 10, y - 12, 20, 4);
        const glow = this.layer(-80);
        glow.fillStyle(C.sun, 0.18); glow.fillEllipse(x, y + 30, 130, 70);
      }

      receptionDesk(x, y) {
        const g = this.layer(y + 26);
        this.shadow(x, y + 26, 238, 26);
        g.fillStyle(C.deskLeg, 1); g.fillRect(x - 110, y - 18, 220, 44);
        g.fillStyle(C.wood2, 1); g.fillRect(x - 110, y - 26, 220, 12);
        g.fillStyle(0xF3C88E, 0.8); g.fillRect(x - 110, y - 26, 220, 3);
        [C.coral, C.sunflower, C.green, C.sky, C.lilac].forEach((c, i) => {
          g.fillStyle(c, 0.95); g.fillRect(x - 100 + i * 42, y - 6, 38, 8);
        });
        g.fillStyle(C.monitor, 1); g.fillRect(x - 26, y - 44, 52, 20);
        g.fillStyle(C.screen, 1); g.fillRect(x - 22, y - 41, 44, 14);
        g.fillStyle(C.leafLight, 1); g.fillRect(x + 74, y - 36, 14, 10);
        g.fillStyle(C.pink, 1); g.fillRect(x + 76, y - 44, 10, 8);
        g.fillStyle(0xFFFFFF, 0.95); g.fillRect(x - 92, y - 34, 22, 8);
        this.solid(x, y, 220, 52);
      }

      zoneLabel(x, y, text) {
        const t = this.add.text(x, y, text, {
          fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11px", color: "#2A3A36",
        }).setOrigin(0.5).setDepth(1101).setResolution(3);
        this.add.rectangle(x, y + 1, t.width + 24, 21, 0xFFF6E4, 0.92)
          .setStrokeStyle(2, 0xE0A458, 0.9).setDepth(1100);
      }

      buildOffice() {
        const g = this.layer(-100);
        const d = this.layer(-90);
        this.shadowLayer = this.layer(-70);

        this.plankFloor(g, 0, 96, W, H - 96);
        this.carpetFloor(g, 470, 130, 510, 520);
        this.carpetFloor(g, 1010, 96, W - 1010, 320, "oat");
        this.tileFloor(g, 24, 620, 406, 300);
        this.carpetFloor(g, 56, 96, 380, 300, "oat");

        this.rug(d, 1110, 196, 220, 150, 0xF6C7BC, 0xF8DFA0);
        this.rug(d, 600, 700, 240, 130, 0xBFE8DC, 0xD6C4F2);
        d.fillStyle(0xA8DEC2, 0.95); d.fillRect(DOOR.x - 44, 876, 88, 26);
        d.fillStyle(0xFFF6E4, 0.8); d.fillRect(DOOR.x - 38, 882, 76, 3);

        const w = this.layer(-60);
        w.fillStyle(C.wall, 1); w.fillRect(0, 0, W, 96);
        w.fillStyle(C.wallDark, 1); w.fillRect(0, 84, W, 12);
        w.fillStyle(C.wallTrim, 1);
        for (let x = 0; x < W; x += 8) w.fillRect(x, 78, 4, 6);

        [180, 470, 760, 1050, 1290].forEach((x) => {
          w.fillStyle(C.wallTrim, 1); w.fillRect(x, 14, 100, 58);
          w.fillStyle(C.sky, 1); w.fillRect(x + 4, 18, 92, 50);
          w.fillStyle(0xDCF3FC, 1); w.fillRect(x + 4, 18, 92, 16);
          w.fillStyle(0xFFFFFF, 0.85);
          w.fillRect(x + 12, 26, 26, 7); w.fillRect(x + 20, 22, 14, 5); w.fillRect(x + 58, 40, 22, 6);
          w.fillStyle(0xB6E4C0, 1); w.fillRect(x + 4, 58, 92, 10);
          w.fillStyle(C.wallTrim, 1); w.fillRect(x + 48, 14, 4, 58); w.fillRect(x, 42, 100, 4);
          d.fillStyle(0xFFF3C4, 0.3);
          d.fillPoints([{ x: x + 6, y: 96 }, { x: x + 94, y: 96 }, { x: x + 128, y: 230 }, { x: x - 28, y: 230 }], true);
        });

        [325, 615, 905, 1195].forEach((x, i) => this.wallArt(x, 44, i % 3));

        [[0, 96, 24, H - 96], [W - 24, 96, 24, H - 96], [0, 936, W, 24]].forEach(([x, y, ww, hh]) => {
          w.fillStyle(C.wallDark, 1); w.fillRect(x, y, ww, hh);
          w.fillStyle(C.wallTrim, 0.9); w.fillRect(x, y, ww, 3);
        });
        CONFETTI.forEach((c, i) => {
          for (let x = 24 + i * 60; x < W - 24; x += CONFETTI.length * 60) {
            w.fillStyle(c, 0.9); w.fillRect(x, 942, 52, 12);
          }
        });
        this.solid(W / 2, 48, W, 96);
        this.solid(12, H / 2, 24, H);
        this.solid(W - 12, H / 2, 24, H);
        this.solid(DOOR.x / 2 - 20, 948, DOOR.x - 40, 24);
        this.solid((DOOR.x + 40 + W) / 2, 948, W - DOOR.x - 40, 24);

        const dg = this.layer(940);
        dg.fillStyle(0x3A2617, 1); dg.fillRect(DOOR.x - 40, 930, 80, 30);
        dg.fillStyle(0x513520, 1); dg.fillRect(DOOR.x - 34, 934, 68, 26);
        dg.fillStyle(C.glass, 0.25); dg.fillRect(DOOR.x - 28, 938, 24, 16);
        dg.fillStyle(C.glass, 0.25); dg.fillRect(DOOR.x + 6, 938, 24, 16);
        dg.fillStyle(C.ochre, 1); dg.fillRect(DOOR.x - 3, 942, 6, 8);

        const mg = this.layer(400);
        const glassWall = (x, y, ww, hh) => {
          mg.fillStyle(C.partition, 1); mg.fillRect(x, y, ww, hh);
          mg.fillStyle(C.glass, 0.18); mg.fillRect(x + 3, y + 3, ww - 6, hh - 6);
          mg.fillStyle(C.glass, 0.3); mg.fillRect(x + 3, y + 3, ww - 6, 2);
        };
        glassWall(424, 96, 14, 220);
        glassWall(56, 386, 250, 14);
        this.solid(431, 206, 14, 220);
        this.solid(181, 393, 250, 14);
        this.whiteboard(200, 92);
        this.meetingTable(245, 245);
        this.pendantLamp(180, 200);
        this.pendantLamp(310, 200);
        this.plant(392, 140);

        this.couch(1210, 150, 190, C.coral);
        this.couch(1080, 300, 120, C.lilac);
        this.coffeeTable(1215, 250);
        this.bookshelf(1380, 190);
        this.plant(1040, 130);
        this.plant(1370, 372);
        this.arcade(1330, 660);

        DESKS.forEach((dd, i) => this.deskUnit(dd.x, dd.y, i));
        this.cubicleDivider(620, 268, 116);
        this.cubicleDivider(820, 268, 116);
        this.cubicleDivider(620, 488, 116);
        this.cubicleDivider(820, 488, 116);
        this.serverRack(950, 620);
        this.printer(506, 610);
        this.waterCooler(824, 378);
        this.plant(950, 170);

        this.counter(70, 760, 92, 250);
        this.coffeeMachine(84, 690);
        this.fridge(80, 900);
        this.roundTable(250, 720);
        this.roundTable(250, 858);
        this.plant(400, 660);

        this.pingPong(1160, 790);
        this.plant(1390, 880);

        this.receptionDesk(720, 720);
        this.plant(600, 880);
        this.plant(840, 880);

        this.stringLights(480, 970, 150);
        this.stringLights(40, 420, 650);

        ZONES.forEach((z) => this.zoneLabel(z.x, z.y, z.label));

        const v = this.add.graphics().setDepth(2000).setScrollFactor(0);
        v.fillStyle(0xBFA98A, 0.12);
        v.fillRect(0, 0, VW, 24); v.fillRect(0, VH - 24, VW, 24);
        v.fillRect(0, 0, 24, VH); v.fillRect(VW - 24, 0, 24, VH);
      }

      addCoworkers() {
        const looks = [
          { hair: "#6B4426", skin: "#F0D2AC", shirt: "#7FD8CC", pants: "#6E7E96", glow: null,
            hairStyle: "long", outfit: "apron", accessory: "none", accent: "#FFF8EC", build: "slim" },
          { hair: "#3A322C", skin: "#A0714B", shirt: "#F6BCD1", pants: "#7A7189", glow: null,
            hairStyle: "cap", outfit: "plain", accessory: "scarf", accent: "#E38FAE" },
        ];
        const routes = [
          [{ x: 300, y: 780 }, { x: 470, y: 700 }, { x: 470, y: 380 }, { x: 300, y: 470 }],
          [{ x: 1140, y: 420 }, { x: 1140, y: 620 }, { x: 1010, y: 760 }, { x: 1080, y: 420 }],
        ];
        looks.forEach((look, i) => {
          const key = "mate" + i;
          makePerson(this, key, look);
          const r = routes[i];
          const spr = this.add.sprite(r[0].x, r[0].y, key).setScale(3).setDepth(r[0].y + 30);
          const shadow = this.footShadow(r[0].x, r[0].y);
          const step = (n) => {
            const from = r[n % r.length], to = r[(n + 1) % r.length];
            spr.setFlipX(to.x < from.x);
            this.tweens.add({
              targets: spr, x: to.x, y: to.y,
              duration: Phaser.Math.Distance.BetweenPoints(from, to) * 14,
              ease: "Linear",
              onUpdate: () => { spr.setDepth(spr.y + 30); shadow.setPosition(spr.x, spr.y + 28).setDepth(spr.y + 29); },
              onComplete: () => this.time.delayedCall(900 + Math.random() * 1800, () => step(n + 1)),
            });
          };
          this.time.delayedCall(600 + i * 1400, () => step(0));
        });
      }

      seatAgent(data, texKey, desk) {
        const seatY = desk.y + 34;
        const startX = DOOR.x, startY = DOOR.y; // live actors walk in through the door

        const spr = this.add.sprite(startX, startY, texKey).setScale(3).setDepth(startY + 30).setInteractive({ useHandCursor: true });
        const shadow = this.footShadow(startX, startY);
        const status = data.status || "idle";

        const pillBg = this.add.rectangle(desk.x, seatY - 42, 74, 17, 0xFFF6E4, 0.95).setDepth(1200).setStrokeStyle(2, STATUS_COL[status] || STATUS_COL.idle);
        const pillTx = this.add.text(desk.x, seatY - 42, status.toUpperCase(), {
          fontFamily: "ui-monospace, Menlo, monospace", fontSize: "9px", color: STATUS_INK[status] || STATUS_INK.idle,
        }).setOrigin(0.5).setDepth(1201).setResolution(3);
        const nameTx = this.add.text(desk.x, seatY + 26, data.name, {
          fontFamily: "ui-monospace, Menlo, monospace", fontSize: "10px", color: "#22312E",
        }).setOrigin(0.5).setDepth(1201).setResolution(3);
        nameTx.setStroke("#FFF6E4", 4);

        [pillBg, pillTx, nameTx].forEach((o) => o.setAlpha(0));
        spr.setDepth(700);
        this.tweens.add({
          targets: spr, x: desk.x, y: seatY, duration: 1600, ease: "Sine.easeInOut",
          onUpdate: () => { spr.setDepth(spr.y + 30); shadow.setPosition(spr.x, spr.y + 28).setDepth(spr.y + 29); },
          onComplete: () => {
            spr.setDepth(seatY + 30);
            this.tweens.add({ targets: [pillBg, pillTx, nameTx], alpha: 1, duration: 300 });
            ui.toast(data.name + " is on it.");
            this.bob(spr);
          },
        });

        const agent = {
          externalId: data.externalId, name: data.name, role: data.role, status,
          category: data.category || null, tool: data.tool || null, object: data.object || null,
          currentTask: data.currentTask, events: data.events || [],
          spr, shadow, pillBg, pillTx, nameTx, desk, badge: null, station: null,
        };
        this.setCategoryBadge(agent, desk);
        this.setStationProp(agent, desk);
        spr.on("pointerdown", () => { this.openAgent === agent ? this.closePanel() : this.openPanel(agent); });
        this.agents.push(agent);
        return agent;
      }

      // The desk's office-object marker: a small glyph pinned to the corner of an
      // actor's desk that maps their SHAPE category to what the desk reads as (a
      // coding desk for GitHub coding/review, etc.). Reuses existing text/rect
      // primitives — no new sprites. Idempotent: recreated when category changes.
      setCategoryBadge(agent, desk) {
        if (agent.badge) { agent.badge.bg.destroy(); agent.badge.tx.destroy(); agent.badge = null; }
        // Badge shows the SPECIFIC APP glyph when the tool is known ('VS','Fi',
        // 'Zm','#',…), else falls back to the category glyph ('</>','◑',…). The
        // dark chip is chosen by the app's category so it stays legible.
        const app = appLook(agent);
        const cat = (app && app.category) || agent.category;
        const catSpec = CATEGORY_BADGE[cat];
        if (!app && !catSpec) return;
        const glyph = (app && app.badge) || (catSpec && catSpec.glyph);
        const ink = (app && app.accent) || (catSpec && catSpec.ink) || "#FFF6E4";
        const bgCol = (catSpec && catSpec.bg) != null ? catSpec.bg : 0x33383A;
        const bx = desk.x + 40, by = desk.y - 40;
        const bg = this.add.rectangle(bx, by, 26, 16, bgCol, 0.92).setDepth(1202).setStrokeStyle(1, 0xFFF6E4, 0.6);
        const tx = this.add.text(bx, by, glyph, {
          fontFamily: "ui-monospace, Menlo, monospace", fontSize: "9px", color: ink,
        }).setOrigin(0.5).setDepth(1203).setResolution(3);
        bg.setAlpha(0); tx.setAlpha(0);
        this.tweens.add({ targets: [bg, tx], alpha: 1, duration: 300 });
        agent.badge = { bg, tx };
      }

      // The STATION PROP: the signature object on an actor's desk that makes the
      // tool read at a glance — a dark IDE screen for coding, a mood-board for
      // design, a record player for music, etc. This carries the "which tool"
      // read together with the badge; the body only changes a light accessory
      // (locked decision #2). Built from the same procedural fillRect primitives
      // as the rest of the furniture — no asset pipeline (decision #3).
      //
      // Everything that defines the read is STATIC (shape + colour), so it
      // survives the animation-free OG share card; tweens are pure reinforcement.
      // Idempotent: destroyed + rebuilt when the category changes; cleaned up in
      // removeAgent. Returns a flat list of display objects stored on agent.station.
      setStationProp(agent, desk) {
        if (agent.station) { agent.station.forEach((o) => o && o.destroy()); agent.station = null; }
        // Station/zone falls back to the app's category when the tool is known
        // (so an uncatalogued app still lands somewhere sensible), then to the
        // raw category. No category at all → the plain seated look, no prop.
        const app = appLook(agent);
        const cat = (app && app.category) || agent.category;
        if (!cat && !app) return;
        const objs = [];
        const g = this.add.graphics().setDepth(desk.y + 31); // just above the desk top
        objs.push(g);
        const x = desk.x, y = desk.y;
        // Paint the desk monitor: the SPECIFIC APP's screen if known (VS Code,
        // Figma, Zoom, …), else the category tint. Static — reads on the card too.
        this.paintScreen(g, agent, x, y);
        (STATION_DRAW[cat] || STATION_DRAW.focus)(this, g, x, y, objs, desk);
        agent.station = objs;
      }

      // Overflow indicator: when more actors are present than the 6 desks can
      // seat, the extras are shown as a single "+N more" pill by reception rather
      // than dropped silently. They get seated automatically as desks free up.
      renderOverflowTag() {
        const n = this.overflow.size;
        if (!n) { if (this.overflowTag) { this.overflowTag.forEach((o) => o.destroy()); this.overflowTag = null; } return; }
        const label = "+" + n + " more in the lobby";
        if (this.overflowTag) { this.overflowTag[1].setText(label); return; }
        const bx = 900, by = 838;
        const bg = this.add.rectangle(bx, by, 168, 20, 0xFFF6E4, 0.95).setStrokeStyle(2, 0xE0A458, 0.9).setDepth(1200);
        const tx = this.add.text(bx, by, label, {
          fontFamily: "ui-monospace, Menlo, monospace", fontSize: "10px", color: "#8A4B12",
        }).setOrigin(0.5).setDepth(1201).setResolution(3);
        this.overflowTag = [bg, tx];
      }

      bob(spr) {
        this.tweens.add({
          targets: spr, y: spr.y - 2, duration: 900 + Math.random() * 500,
          yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: Math.random() * 600,
        });
      }

      // ---------- panel + terminal (driven through the ui bridge) ----------
      openPanel(a) { this.openAgent = a; ui.openPanel(a); }
      renderPanel(a) { if (this.openAgent) ui.openPanel(a); }
      closePanel() { this.openAgent = null; ui.closePanel(); }
      buildTerminal() { ui.buildTerminal(this.agents); }

      update() {
        const sp = 190, k = this.keys, c = this.cursors, b = this.player.body;
        let vx = 0, vy = 0;
        const typing = isTyping();
        if (!typing) {
          if (c.left.isDown || k.A.isDown) vx = -sp;
          if (c.right.isDown || k.D.isDown) vx = sp;
          if (c.up.isDown || k.W.isDown) vy = -sp;
          if (c.down.isDown || k.S.isDown) vy = sp;
        }
        if (vx && vy) { vx *= 0.707; vy *= 0.707; }
        b.setVelocity(vx, vy);
        if (vx < 0) this.player.setFlipX(true);
        if (vx > 0) this.player.setFlipX(false);
        this.player.setDepth(this.player.y + 30);
        this.playerShadow.setPosition(this.player.x, this.player.y + 28).setDepth(this.player.y + 29);

        let near = null, best = 130;
        this.agents.forEach((a) => {
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, a.spr.x, a.spr.y);
          if (dist < best) { best = dist; near = a; }
        });
        if (near !== this.near) {
          if (this.near && this.near.nameTx.active) this.near.nameTx.setColor("#22312E");
          if (near) near.nameTx.setColor("#B03A33");
          this.near = near;
        }
        if (near) {
          const showing = this.openAgent === near;
          this.prompt.setText(showing ? "press  E  to close" : "press  E  to talk")
            .setPosition(near.spr.x, near.spr.y - 62).setAlpha(1);
          if (!typing && Phaser.Input.Keyboard.JustDown(k.E)) { showing ? this.closePanel() : this.openPanel(near); }
        } else {
          this.prompt.setAlpha(0);
        }
      }
    };
  }

  // ---------- overlay DOM the scene owns (panel + terminal + toast) ----------
  function buildOverlay(parent) {
    parent.style.position = parent.style.position || "relative";

    const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };

    const panel = el("aside", "office-panel");
    panel.innerHTML =
      '<button class="office-panel-close" aria-label="Close panel">×</button>' +
      '<div class="office-panel-role"></div>' +
      '<h2 class="office-panel-name"></h2>' +
      '<div class="office-panel-status"></div>' +
      '<div class="office-panel-label">CURRENT TASK</div>' +
      '<div class="office-panel-task"></div>' +
      '<div class="office-panel-label">ACTIVITY</div>' +
      '<pre class="office-panel-log"></pre>';

    const terminal = el("div", "office-terminal");
    terminal.innerHTML =
      '<div class="office-term-inner"><div class="office-term-lines"></div></div>' +
      '<div class="office-term-hint">the same work, in a terminal &nbsp;·&nbsp; press <b>T</b> to go back</div>';

    const toggle = el("button", "office-view-toggle");
    toggle.type = "button";
    toggle.innerHTML = 'terminal view <b>[T]</b>';

    const toast = el("div", "office-toast");

    parent.appendChild(panel);
    parent.appendChild(terminal);
    parent.appendChild(toggle);
    parent.appendChild(toast);

    const q = (sel) => panel.querySelector(sel);
    const termLines = terminal.querySelector(".office-term-lines");
    let logTimer = null;
    let toastTimer = null;

    function toastMsg(msg) {
      toast.textContent = msg; toast.classList.add("on");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("on"), 2600);
    }

    function openPanel(a) {
      q(".office-panel-role").textContent = a.role || "";
      q(".office-panel-name").textContent = a.name || "";
      const s = q(".office-panel-status");
      s.textContent = a.status || "";
      s.style.background = { working: "#FBEBD2", blocked: "#FBE0DC", done: "#DFF2E7", idle: "#EAEFEC" }[a.status] || "#EAEFEC";
      s.style.color = { working: "#9A6516", blocked: "#B0554C", done: "#2E7F5C", idle: "#6E7E79" }[a.status] || "#6E7E79";
      q(".office-panel-task").textContent = a.currentTask || "—";

      const logEl = q(".office-panel-log");
      logEl.textContent = "";
      panel.classList.add("on");

      clearInterval(logTimer);
      const lines = (a.events || []).map((e) => "› " + (e.detail || ""));
      const full = lines.join("\n");
      let i = 0;
      logTimer = setInterval(() => {
        i += 2;
        logEl.textContent = full.slice(0, i);
        logEl.scrollTop = logEl.scrollHeight;
        if (i >= full.length) clearInterval(logTimer);
      }, 12);
    }

    function closePanel() { panel.classList.remove("on"); clearInterval(logTimer); }

    function buildTerminal(agents) {
      const rows = [];
      agents.forEach((a) => {
        rows.push('<span class="dim">[agent:' + (a.name || "").toLowerCase() + "]</span> " + (a.currentTask || ""));
        (a.events || []).forEach((e) => rows.push('<span class="dim">  ' + (e.detail || "") + "</span>"));
        rows.push("");
      });
      rows.push('<span class="amb">$ _</span>');
      termLines.innerHTML = rows.join("\n");
    }

    function toggleTerminal() {
      const on = terminal.classList.toggle("on");
      toggle.innerHTML = on ? 'workspace view <b>[T]</b>' : 'terminal view <b>[T]</b>';
    }

    const onClose = () => { closePanel(); if (bridge.onPanelClose) bridge.onPanelClose(); };
    q(".office-panel-close").onclick = onClose;
    terminal.querySelector(".office-term-hint").onclick = toggleTerminal;
    toggle.onclick = toggleTerminal;

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if ((e.key === "t" || e.key === "T") && !isTyping()) { e.preventDefault(); toggleTerminal(); }
    };
    window.addEventListener("keydown", onKey);

    const bridge = {
      openPanel, closePanel, buildTerminal, toast: toastMsg, onPanelClose: null,
      destroy() {
        window.removeEventListener("keydown", onKey);
        clearInterval(logTimer);
        clearTimeout(toastTimer);
        [panel, terminal, toggle, toast].forEach((n) => n.remove());
      },
    };
    return bridge;
  }

  window.MumblOffice = {
    boot: function boot(options) {
      const parent = options.parent;
      const ui = buildOverlay(parent);
      // closing via the DOM × should clear the scene's openAgent too
      let sceneRef = null;
      ui.onPanelClose = () => { if (sceneRef) sceneRef.openAgent = null; };

      const SceneClass = OfficeSceneFactory(ui);

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        width: VW, height: VH,
        pixelArt: true,
        roundPixels: true,
        backgroundColor: "#C7E9E5",
        physics: { default: "arcade", arcade: { gravity: { y: 0 } } },
        input: { touch: { capture: false } },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, parent, width: VW, height: VH },
        scene: [SceneClass],
      });

      let observer = null;
      if (window.ResizeObserver) {
        game.events.once(Phaser.Core.Events.READY, function () {
          observer = new ResizeObserver(function () { if (game.isBooted) game.scale.refresh(); });
          observer.observe(parent);
        });
      }

      return {
        applyState: function applyState(state) {
          const scene = game.scene.getScene("room");
          if (scene) { sceneRef = scene; scene.applyState(state); }
        },
        toggleTerminal: function toggleTerminal() {
          // exposed for a button, though T already works
        },
        destroy: function destroy() {
          if (observer) observer.disconnect();
          ui.destroy();
          game.destroy(true);
        },
      };
    },
  };
})();
