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
    { x: 700, y: 128, label: "the studio" },
    { x: 245, y: 650, label: "café" },
    { x: 1205, y: 630, label: "rec room" },
    { x: 720, y: 838, label: "reception" },
  ];

  // SCATTERED WORK BOOTHS — not a desk farm. Instead of 3 tidy rows of identical
  // desks, the middle of the room is a loose scatter of little work nooks, each
  // with its own mat + booth, so the room reads as "different kinds of work
  // happening in their own corners" rather than a call-centre bullpen. The
  // positions are deliberately staggered (no shared x columns, no shared y rows)
  // and each carries a `tone` that tints its mat, so every booth feels distinct.
  // Seat count (9) still absorbs a typical 6-10 app stack before "+N more".
  // Booth spots live in the OPEN CENTRAL FLOOR (the perimeter is meeting room /
  // lounge / café / rec room / reception). Vignettes reach ~120px above the
  // anchor (easel / screen / corkboard), so no anchor sits above y≈280, and the
  // three rows are staggered left↔right so a tall prop never overlaps the actor
  // in the row behind it. Assigned so the WIDE scenes (easel, huddle, corkboard,
  // turntable, server rack) get the roomy spots and compact ones (kiosk,
  // reading chair, beanbag, cushion) tuck between them.
  const DESKS = [
    { x: 560, y: 300, tone: "mint"  }, // back row
    { x: 780, y: 288, tone: "sky"   },
    { x: 990, y: 300, tone: "blush" },
    { x: 520, y: 460, tone: "oat"   }, // middle row (offset)
    { x: 760, y: 452, tone: "lilac" },
    { x: 980, y: 462, tone: "sky"   },
    { x: 620, y: 610, tone: "blush" }, // front row (offset, above reception)
    { x: 850, y: 600, tone: "mint"  },
    { x: 1050, y: 600, tone: "oat"  },
  ];
  // mat tints keyed by booth tone — a soft rug pool under each nook
  const BOOTH_MAT = {
    mint:  { fill: 0xBFE8DC, edge: 0x8FCBB8 },
    sky:   { fill: 0xC4E4F2, edge: 0x9ECBE0 },
    blush: { fill: 0xF6C7BC, edge: 0xE2A79A },
    lilac: { fill: 0xD6C4F2, edge: 0xB49EDC },
    oat:   { fill: 0xEADFC6, edge: 0xCFBE9E },
  };
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
    // CODING — a code-lit NOOK, not just a screen. A second angled monitor + a
    // terminal slab flank the main IDE screen; terminal-green glow spills onto the
    // desk; the cursor blinks, a highlight line scans down the code, and the glow
    // throbs. (v2 set piece — docs §"v2 — artistic set pieces".)
    coding(scene, g, x, y, objs) {
      // terminal-green mood glow pooling off the screens onto the desk
      const glow = scene.add.ellipse(x, y - 8, 132, 40, 0x2E4A3A, 0.22).setDepth(y - 58);
      scene.tweens.add({ targets: glow, scaleX: 1.08, alpha: 0.34, duration: 1700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      objs.push(glow);
      // SECOND monitor, angled to the right of the main one — a slim IDE panel
      g.fillStyle(0x2A3237, 1); g.fillRect(x + 28, y - 44, 22, 24);         // bezel
      g.fillStyle(S.screenDark, 1); g.fillRect(x + 30, y - 42, 18, 20);     // screen
      g.fillStyle(S.codeGreen, 0.85); g.fillRect(x + 32, y - 39, 12, 2);
      g.fillStyle(S.codeDim, 0.85); g.fillRect(x + 32, y - 35, 14, 2);
      g.fillStyle(0xEFC08A, 0.8); g.fillRect(x + 32, y - 31, 8, 2);
      g.fillStyle(0x6E8896, 1); g.fillRect(x + 36, y - 20, 6, 4);           // its little stand
      // TERMINAL slab sitting on the desk to the left — a black prompt window
      g.fillStyle(0x0E1216, 1); g.fillRect(x - 48, y - 12, 22, 14);
      g.fillStyle(S.codeGreen, 1); g.fillRect(x - 45, y - 9, 2, 2); g.fillRect(x - 42, y - 9, 8, 2);
      g.fillStyle(0x86CFA6, 0.8); g.fillRect(x - 45, y - 5, 12, 2);
      // main-screen syntax code lines (over whatever paintScreen laid down)
      g.fillStyle(S.codeGreen, 0.9); g.fillRect(x - 19, y - 42, 18, 2);
      g.fillStyle(S.codeDim, 0.9); g.fillRect(x - 19, y - 38, 26, 2);
      g.fillStyle(0xEFC08A, 0.85); g.fillRect(x - 15, y - 34, 14, 2);       // a "string" line (amber)
      g.fillStyle(S.codeGreen, 0.9); g.fillRect(x - 15, y - 30, 20, 2);
      g.fillStyle(S.codeDim, 0.9); g.fillRect(x - 19, y - 26, 12, 2);
      // status LED on the desk (green = compiling ok)
      g.fillStyle(0x86CFA6, 1); g.fillRect(x + 20, y - 8, 3, 3);
      // blinking caret on the main screen
      const caret = scene.add.rectangle(x + 8, y - 26, 3, 4, S.codeGreen).setDepth(y + 32);
      scene.tweens.add({ targets: caret, alpha: 0.1, duration: 520, yoyo: true, repeat: -1 });
      objs.push(caret);
      // a highlight line that SCANS down the main screen (active cursor line feel)
      const scan = scene.add.rectangle(x - 4, y - 42, 40, 3, 0x9BD8B4, 0.16).setDepth(y + 31);
      scene.tweens.add({ targets: scan, y: y - 26, duration: 2200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      objs.push(scan);
    },
    // REVIEW — an INSPECTION station: a diff screen (green +/red − lines side by
    // side) + a corkboard of PR tickets with ✓/✗ approval stamps + a magnifier
    // resting on the desk, violet mood glow. The top ticket's stamp flips
    // approve↔comment. Reads unmistakably as "reviewing PRs." (v3 set piece.)
    review(scene, g, x, y, objs) {
      // violet mood glow
      const glow = scene.add.ellipse(x, y - 8, 120, 38, 0xCFBBF0, 0.2).setDepth(y - 58);
      scene.tweens.add({ targets: glow, alpha: 0.32, duration: 1900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      objs.push(glow);
      // diff screen: two columns, added (green) vs removed (red)
      g.fillStyle(0x86CFA6, 0.9); g.fillRect(x - 19, y - 42, 2, 2); g.fillRect(x - 16, y - 42, 18, 2); // + line
      g.fillStyle(0xF09B90, 0.9); g.fillRect(x - 19, y - 38, 2, 2); g.fillRect(x - 16, y - 38, 14, 2); // - line
      g.fillStyle(0x86CFA6, 0.9); g.fillRect(x - 19, y - 34, 2, 2); g.fillRect(x - 16, y - 34, 22, 2); // + line
      g.fillStyle(0x6E7E79, 0.7); g.fillRect(x - 19, y - 30, 16, 2);                                    // context
      // corkboard of PR tickets on the wall behind the desk
      const bx = x - 46, by = y - 90;
      g.fillStyle(0xC7A16A, 1); g.fillRect(bx - 2, by - 2, 40, 30);        // cork frame
      g.fillStyle(0xD8B681, 1); g.fillRect(bx, by, 36, 26);               // cork face
      // three pinned tickets
      [[2, 3, 0x2E7F5C], [14, 6, 0xB0554C], [24, 2, 0x2E7F5C]].forEach(([dx, dy, stampCol]) => {
        g.fillStyle(S.paper, 1); g.fillRect(bx + dx, by + dy, 10, 12);
        g.fillStyle(S.violet, 1); g.fillRect(bx + dx, by + dy, 10, 3);    // PR header strip
        g.fillStyle(stampCol, 1); g.fillRect(bx + dx + 3, by + dy + 6, 4, 4); // ✓/✗ stamp
      });
      // magnifier resting on the desk
      g.fillStyle(0x8A9EA8, 1); g.fillEllipse(x + 30, y - 8, 12, 12);
      g.fillStyle(0xEAF4F8, 0.8); g.fillEllipse(x + 30, y - 8, 8, 8);
      g.fillStyle(0x6E543A, 1); g.fillRect(x + 36, y - 3, 8, 3);
      // approval stamp on the top ticket flips approve ↔ comment
      const stamp = scene.add.rectangle(bx + 5, by + 9, 4, 4, 0x2E7F5C).setDepth(y + 32);
      scene.tweens.add({ targets: stamp, alpha: 0.25, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      objs.push(stamp);
    },
    // DESIGN — a drafting STUDIO: a tilted easel/artboard on a stand showing a
    // composition-in-progress (bright like a lightbox), a swatch tray of color
    // chips + a stylus, floating chips drifting up, a pulsing selection frame, and
    // a soft blush studio glow. The artboard's accent block cycles hue. (v2 set
    // piece.)
    design(scene, g, x, y, objs) {
      // soft blush studio glow
      const glow = scene.add.ellipse(x - 8, y - 30, 88, 54, 0xF6BCD1, 0.2).setDepth(y - 62);
      scene.tweens.add({ targets: glow, alpha: 0.32, duration: 2000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      objs.push(glow);
      // Easel / artboard on a stand, tilted, floating above the desk
      const ax = x - 44, ay = y - 92, aw = 44, ah = 34;
      g.fillStyle(0xCBA87C, 1); g.fillRect(ax + aw / 2 - 2, ay + ah, 4, 20);   // easel post
      g.fillStyle(0xB68F62, 1); g.fillRect(ax + 2, ay + ah + 14, aw - 4, 3);   // tray ledge
      g.fillStyle(0xE0CBA6, 1); g.fillRect(ax - 3, ay - 3, aw + 6, ah + 6);    // frame
      g.fillStyle(0xFBF7F0, 1); g.fillRect(ax, ay, aw, ah);                    // bright canvas (lightbox)
      // a composition-in-progress: a couple of shapes + a text-block hint
      const artboard = scene.add.rectangle(ax + 12, ay + 12, 16, 12, S.violet).setDepth(y - 60);
      objs.push(artboard);
      g.fillStyle(S.sky, 1); g.fillRect(ax + 26, ay + 6, 12, 8);
      g.fillStyle(S.coral, 1); g.fillEllipse(ax + 32, ay + 24, 12, 10);
      g.fillStyle(S.ink, 0.55); g.fillRect(ax + 6, ay + 26, 14, 2); g.fillRect(ax + 6, ay + 30, 10, 2);
      // pulsing crop/selection frame around the accent shape
      const sel = scene.add.rectangle(ax + 12, ay + 12, 20, 16).setStrokeStyle(1, 0xF6BCD1, 0.95).setDepth(y - 59);
      scene.tweens.add({ targets: sel, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
      objs.push(sel);
      // swatch TRAY of color chips on the desk + a stylus
      const chips = [S.coral, S.amber, 0x9BD8B4, S.sky, S.violet, S.pink];
      g.fillStyle(0xEADFC7, 1); g.fillRect(x - 22, y - 10, 40, 8);            // tray
      chips.forEach((c, i) => { g.fillStyle(c, 1); g.fillRect(x - 20 + i * 6, y - 8, 5, 4); });
      g.fillStyle(S.pinkDk, 1); g.fillRect(x + 22, y - 8, 12, 2); g.fillStyle(S.ink, 1); g.fillRect(x + 32, y - 8, 3, 2); // stylus
      // artboard accent block cycles hue (tint alpha as a cheap hue "cycle")
      scene.tweens.add({ targets: artboard, alpha: 0.5, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      // one floating color chip drifting up off the tray
      const chip = scene.add.rectangle(x + 6, y - 10, 5, 4, S.amber).setDepth(y + 33);
      scene.tweens.add({ targets: chip, y: y - 30, alpha: 0, duration: 2100, repeat: -1, ease: "Sine.easeOut" });
      objs.push(chip);
    },
    // CALL — the meeting room LIGHTS UP. A big wall display tiled with participant
    // camera faces glows over the desk, an "● ON AIR" bar burns above it, the
    // active-speaker highlight hops tile→tile, and a cool sky wash floods the nook.
    // (v2 set piece.)
    call(scene, g, x, y, objs) {
      // cool "room lights up" wash behind the screen
      const wash = scene.add.ellipse(x, y - 40, 96, 60, 0xBEE7F7, 0.28).setDepth(y - 60);
      scene.tweens.add({ targets: wash, alpha: 0.42, scaleY: 1.1, duration: 1500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      objs.push(wash);
      // wall-mounted display: dark room fill + framed bezel, floating above the desk
      const bx = x - 30, by = y - 78, bw = 60, bh = 40;
      g.fillStyle(0x24333F, 1); g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);   // bezel
      g.fillStyle(0x1B2732, 1); g.fillRect(bx, by, bw, bh);                   // screen room fill
      // 2x3 grid of participant camera tiles — each a head+shoulders silhouette
      const tileCols = [0x6E9FD8, 0x86CFA6, 0xF0A79E, 0xEFC08A, 0x9E86C8, 0xBEE7F7];
      const cells = [];
      for (let i = 0; i < 6; i++) {
        const cx = bx + 3 + (i % 3) * 19, cy = by + 3 + Math.floor(i / 3) * 18;
        g.fillStyle(tileCols[i], 0.85); g.fillRect(cx, cy, 17, 16);          // camera fill
        g.fillStyle(0x2E3A44, 0.9); g.fillRect(cx + 6, cy + 9, 5, 7);        // shoulders
        g.fillStyle(0x2E3A44, 0.9); g.fillRect(cx + 7, cy + 4, 3, 4);        // head
        cells.push({ cx: cx + 8, cy: cy + 8 });
      }
      // stand
      g.fillStyle(0x8A9EA8, 1); g.fillRect(x - 3, y - 38, 6, 8);
      // "● ON AIR" bar above the screen — red, lit
      g.fillStyle(0x7A2E2E, 1); g.fillRect(bx + 12, by - 8, 36, 7);
      g.fillStyle(0xF0A79E, 1); g.fillRect(bx + 15, by - 6, 3, 3);           // the dot
      g.fillStyle(0xFFE3DC, 0.9); g.fillRect(bx + 20, by - 6, 24, 3);        // "ON AIR" text bar
      // pulsing on-air dot
      const dot = scene.add.rectangle(bx + 16, by - 5, 4, 4, 0xF0605A).setDepth(y + 33);
      scene.tweens.add({ targets: dot, alpha: 0.25, duration: 650, yoyo: true, repeat: -1 });
      objs.push(dot);
      // active-speaker highlight ring that hops between tiles
      const ring = scene.add.rectangle(cells[0].cx, cells[0].cy, 19, 18).setStrokeStyle(2, 0xFFF6E4, 0.9).setDepth(y + 33);
      objs.push(ring);
      let hop = 0;
      const speaker = scene.time.addEvent({ delay: 1400, loop: true, callback: () => {
        hop = (hop + 1 + Math.floor(Math.random() * 2)) % cells.length;
        ring.setPosition(cells[hop].cx, cells[hop].cy);
      } });
      objs.push({ destroy: () => speaker.remove() });
    },
    // MUSIC — a full TURNTABLE CONSOLE, the "why does theirs have a record player"
    // hook. Wide wood-grain cabinet, raised platter, thick grooved vinyl SPINNING,
    // chrome tonearm + counterweight, a bouncing VU/EQ level strip, notes drifting
    // up, and a warm amber-green glow pooling under it. Reads even with no body.
    // (v2 set piece — the record is the light source of the corner.)
    music(scene, g, x, y, objs) {
      // warm mood glow pooling under the console (the corner "warms up")
      const glow = scene.add.ellipse(x - 3, y + 2, 84, 30, 0xF8DFA0, 0.22).setDepth(y - 58);
      scene.tweens.add({ targets: glow, alpha: 0.34, duration: 1900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      objs.push(glow);
      // Console cabinet — wider wood-grain body with a raised platter deck + feet
      g.fillStyle(0x8A6A46, 1); g.fillRect(x - 30, y - 4, 54, 8);     // base shadow
      g.fillStyle(0x9E7A52, 1); g.fillRect(x - 30, y - 18, 54, 22);   // rim
      g.fillStyle(S.wood, 1); g.fillRect(x - 28, y - 16, 50, 18);     // main chassis
      g.fillStyle(0xD4A86A, 1); g.fillRect(x - 28, y - 16, 50, 3);    // wood highlight
      g.fillStyle(0x6E543A, 0.5); g.fillRect(x - 28, y - 8, 50, 1);   // grain seam
      g.fillStyle(0x6E543A, 1); g.fillRect(x - 27, y + 2, 4, 3); g.fillRect(x + 17, y + 2, 4, 3); // feet
      // raised platter deck the vinyl sits on
      g.fillStyle(0x3A342E, 1); g.fillEllipse(x - 6, y - 6, 32, 20);
      // Vinyl disc — thickness via stacked ellipses + a couple of groove rings
      g.fillStyle(S.vinyl, 1); g.fillEllipse(x - 6, y - 7, 28, 18);
      g.fillStyle(0x211E1B, 1); g.fillEllipse(x - 6, y - 7, 24, 15);  // outer groove
      g.fillStyle(0x3A3430, 1); g.fillEllipse(x - 6, y - 7, 16, 10);  // inner groove
      g.fillStyle(S.coral, 1); g.fillEllipse(x - 6, y - 7, 8, 5);     // centre label
      g.fillStyle(0xFFECE0, 1); g.fillRect(x - 7, y - 8, 2, 2);       // spindle highlight
      // Tonearm with counterweight, angled to the vinyl
      g.fillStyle(0x9AA6A8, 1); g.fillRect(x + 14, y - 16, 3, 12);    // pivot post
      g.fillStyle(0x6E7276, 1); g.fillRect(x + 12, y - 18, 7, 3);     // counterweight
      g.fillStyle(S.metal, 1); g.fillRect(x + 4, y - 8, 12, 2);       // arm
      g.fillStyle(0x8A8A8A, 1); g.fillRect(x + 3, y - 9, 3, 3);       // cartridge head on the groove
      // VU / EQ level strip on the cabinet face — 4 bouncing bars
      const bars = [];
      for (let i = 0; i < 4; i++) {
        const bar = scene.add.rectangle(x - 26 + i * 5, y - 2, 3, 6, 0x9BD8B4).setOrigin(0.5, 1).setDepth(y + 32);
        bars.push(bar); objs.push(bar);
        scene.tweens.add({ targets: bar, scaleY: 0.3 + (i % 2) * 0.5, duration: 340 + i * 90, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: i * 80 });
      }
      // Spinning groove-glint that orbits the label (sells the rotation)
      const spin = scene.add.rectangle(x - 6, y - 12, 5, 2, 0x6E6A64).setDepth(y + 33);
      scene.tweens.add({ targets: spin, angle: 360, duration: 1500, repeat: -1, ease: "Linear",
        onUpdate: () => { const a = spin.angle * Math.PI / 180; spin.setPosition(x - 6 + Math.cos(a) * 10, y - 7 + Math.sin(a) * 6); } });
      objs.push(spin);
      // rising notes on staggered arcs — alternate ♪ / ♫, drift sideways as they climb
      ["♪", "♫", "♪", "♫"].forEach((ch, i) => {
        const nx = x + 16 + i * 4;
        const note = scene.add.text(nx, y - 6, ch, { fontFamily: "monospace", fontSize: "11px", color: i % 2 ? "#F8DFA0" : "#9BD8B4" }).setDepth(y + 34);
        scene.tweens.add({ targets: note, y: y - 38, x: nx + (i % 2 ? 6 : -6), alpha: 0, duration: 2200, delay: i * 480, repeat: -1, ease: "Sine.easeOut" });
        objs.push(note);
      });
    },
    // WRITING — a warm LIBRARY NOOK: a gooseneck desk lamp casting an amber pool,
    // an open manuscript page with ink "writing" line by line, a stack of books,
    // and a coffee cup. Cozy, unmistakably "writing/docs." (v3 set piece.)
    writing(scene, g, x, y, objs) {
      // amber lamp pool — the key light of this nook
      const glow = scene.add.ellipse(x - 6, y - 6, 78, 30, 0xF8DFA0, 0.22).setDepth(y - 58);
      scene.tweens.add({ targets: glow, alpha: 0.34, duration: 2100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      objs.push(glow);
      // gooseneck lamp
      g.fillStyle(S.metal, 1); g.fillRect(x + 28, y - 4, 3, 6);           // base
      g.fillStyle(S.metal, 1); g.fillRect(x + 29, y - 18, 2, 14);         // stem
      g.fillStyle(S.metal, 1); g.fillRect(x + 22, y - 20, 9, 2);          // neck
      g.fillStyle(S.amber, 1); g.fillRect(x + 18, y - 20, 8, 5);          // shade
      g.fillStyle(0xFFF3C4, 1); g.fillRect(x + 19, y - 16, 6, 2);         // bulb glow
      // open manuscript (two facing pages)
      g.fillStyle(0xE8DCC4, 1); g.fillRect(x - 24, y - 14, 34, 16);       // book cover
      g.fillStyle(S.paper, 1); g.fillRect(x - 22, y - 12, 15, 13); g.fillRect(x - 6, y - 12, 15, 13);
      g.fillStyle(0xC7A16A, 1); g.fillRect(x - 7, y - 12, 1, 13);         // spine
      g.fillStyle(S.ink, 0.6); g.fillRect(x - 20, y - 9, 10, 1); g.fillRect(x - 20, y - 6, 8, 1);
      g.fillStyle(S.ink, 0.6); g.fillRect(x - 4, y - 9, 10, 1);
      // stack of books to the left
      g.fillStyle(S.coral, 1); g.fillRect(x - 44, y - 4, 14, 3);
      g.fillStyle(S.sky, 1); g.fillRect(x - 43, y - 7, 13, 3);
      g.fillStyle(0x9BD8B4, 1); g.fillRect(x - 44, y - 10, 12, 3);
      // coffee cup
      g.fillStyle(S.paper, 1); g.fillRect(x + 12, y - 6, 7, 6); g.fillStyle(S.coral, 1); g.fillRect(x + 19, y - 5, 2, 3);
      // ink "writing" line advancing across the right page
      const inkline = scene.add.rectangle(x - 4, y - 3, 2, 1, S.ink).setOrigin(0, 0.5).setDepth(y + 32);
      scene.tweens.add({ targets: inkline, scaleX: 5, duration: 1500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      objs.push(inkline);
    },
    // BROWSING — a READING PERCH: a laptop/tablet propped up showing a scrolling
    // web feed (header bar + article cards) with a floating bookmark/tab and a
    // mug, coral glow. Unmistakably "reading the web." (v3 set piece.)
    browsing(scene, g, x, y, objs) {
      // coral glow
      const glow = scene.add.ellipse(x - 4, y - 8, 84, 30, 0xF4B3A6, 0.18).setDepth(y - 58);
      scene.tweens.add({ targets: glow, alpha: 0.3, duration: 2200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      objs.push(glow);
      // laptop: propped screen + a base/keyboard deck
      g.fillStyle(0x2E3438, 1); g.fillRect(x - 20, y - 24, 34, 22);       // screen frame
      g.fillStyle(0xF0E8DA, 1); g.fillRect(x - 18, y - 22, 30, 18);       // page bg
      g.fillStyle(S.coral, 1); g.fillRect(x - 18, y - 22, 30, 4);         // browser chrome bar
      g.fillStyle(0x6E9FD8, 0.9); g.fillRect(x - 16, y - 21, 4, 2);       // tab dots
      g.fillStyle(0x86CFA6, 0.9); g.fillRect(x - 11, y - 21, 4, 2);
      // article cards (thumbnail + lines)
      g.fillStyle(0xCBD8DA, 1); g.fillRect(x - 16, y - 16, 8, 6); g.fillRect(x - 16, y - 8, 8, 4);
      g.fillStyle(0x596E6E, 0.55); g.fillRect(x - 6, y - 16, 16, 2); g.fillRect(x - 6, y - 13, 12, 2); g.fillRect(x - 6, y - 8, 16, 2);
      g.fillStyle(0x9AA6A2, 1); g.fillRect(x - 22, y - 2, 38, 4);         // laptop base deck
      // floating bookmark tab
      g.fillStyle(S.amber, 1); g.fillRect(x + 16, y - 26, 6, 10); g.fillStyle(0xE4C878, 1); g.fillRect(x + 16, y - 18, 6, 3);
      // mug
      g.fillStyle(S.paper, 1); g.fillRect(x + 26, y - 6, 7, 6); g.fillStyle(S.sky, 1); g.fillRect(x + 33, y - 5, 2, 3);
      // scrolling feed rows
      const rows = [];
      for (let i = 0; i < 3; i++) {
        const r = scene.add.rectangle(x - 6, y - 16 + i * 4, 16, 2, S.ink, 0.5).setOrigin(0, 0.5).setDepth(y + 32);
        rows.push(r); objs.push(r);
      }
      scene.tweens.add({ targets: rows, y: "-=3", duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    },
    // TERMINAL → a SERVER / OPS station: a small rack of blinking status LEDs, a
    // black prompt slab with a running log + a live green caret, and a network
    // activity blip travelling along a cable. Reads as "ops / running servers."
    // (v3 set piece — its own look, distinct from the coding nook.)
    terminal(scene, g, x, y, objs) {
      // cool green ops glow
      const glow = scene.add.ellipse(x, y - 8, 120, 36, 0x2E4A3A, 0.2).setDepth(y - 58);
      scene.tweens.add({ targets: glow, alpha: 0.3, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      objs.push(glow);
      // server rack behind/right of the desk — stacked units with LEDs
      const rx = x + 24, ry = y - 60;
      g.fillStyle(0x3A4750, 1); g.fillRect(rx, ry, 26, 52);              // rack chassis
      g.fillStyle(0x2A343C, 1); g.fillRect(rx + 2, ry + 2, 22, 48);     // inner
      const leds = [];
      for (let i = 0; i < 4; i++) {
        g.fillStyle(0x4A5A62, 1); g.fillRect(rx + 4, ry + 4 + i * 12, 18, 9); // unit face
        g.fillStyle(0x6E7E79, 1); g.fillRect(rx + 7, ry + 6 + i * 12, 8, 2);  // vents
        const led = scene.add.rectangle(rx + 19, ry + 8 + i * 12, 3, 3, [0x86CFA6, 0xEFC08A, 0x86CFA6, 0xF09B90][i]).setDepth(y + 32);
        scene.tweens.add({ targets: led, alpha: 0.2, duration: 500 + i * 220, yoyo: true, repeat: -1 });
        leds.push(led); objs.push(led);
      }
      // black prompt slab on the desk with a running log
      g.fillStyle(0x0E1216, 1); g.fillRect(x - 30, y - 14, 40, 16);
      g.fillStyle(S.codeGreen, 1); g.fillRect(x - 27, y - 11, 2, 2); g.fillRect(x - 24, y - 11, 10, 2); // prompt
      g.fillStyle(0x86CFA6, 0.8); g.fillRect(x - 27, y - 7, 22, 2); g.fillRect(x - 27, y - 3, 14, 2);
      // live green caret
      const caret = scene.add.rectangle(x - 11, y - 3, 3, 3, S.codeGreen).setDepth(y + 33);
      scene.tweens.add({ targets: caret, alpha: 0.1, duration: 540, yoyo: true, repeat: -1 });
      objs.push(caret);
      // network activity blip travelling from rack to slab (a cable "packet")
      const blip = scene.add.rectangle(rx, y - 2, 3, 3, 0x9BD8B4).setDepth(y + 33);
      scene.tweens.add({ targets: blip, x: x - 8, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      objs.push(blip);
    },
    // FOCUS / OTHER — the deliberately QUIET nook: no gadgets, just a soft blue
    // desk glow that slowly breathes, a mug of coffee, and a small "do not
    // disturb" plant. The calm is the read — "heads-down." (v3 set piece.)
    focus(scene, g, x, y, objs) {
      // small potted plant — a bit of calm greenery
      g.fillStyle(0x8A5E38, 1); g.fillRect(x + 28, y - 8, 10, 8);        // pot
      g.fillStyle(0x6B4A2F, 1); g.fillRect(x + 28, y - 8, 10, 2);        // pot rim
      g.fillStyle(C.leaf, 1); g.fillRect(x + 29, y - 18, 8, 10); g.fillRect(x + 31, y - 22, 4, 5);
      g.fillStyle(C.leafLight, 1); g.fillRect(x + 30, y - 16, 2, 6);
      // coffee mug
      g.fillStyle(S.paper, 1); g.fillRect(x - 34, y - 8, 8, 7); g.fillStyle(S.sky, 1); g.fillRect(x - 26, y - 7, 2, 4);
      // soft breathing desk glow
      const glow = scene.add.ellipse(x, y - 24, 44, 22, 0xBBDCF0, 0.14).setDepth(y - 58);
      scene.tweens.add({ targets: glow, alpha: 0.05, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      objs.push(glow);
      // faint steam wisp rising from the mug
      const steam = scene.add.rectangle(x - 30, y - 10, 2, 4, 0xFFFFFF, 0.4).setDepth(y + 32);
      scene.tweens.add({ targets: steam, y: y - 24, alpha: 0, duration: 2400, repeat: -1, ease: "Sine.easeOut" });
      objs.push(steam);
    },
  };
  STATION_DRAW.other = STATION_DRAW.focus;

  // ═══════════════════════════════════════════════════════════════════════
  // VIGNETTES — the physical IDEA of each kind of work, not a desk.
  //
  // Founder direction: nobody should read as "a person parked behind a
  // monitor." Each category is a small PHYSICAL SCENE the actor acts *inside*:
  // a designer stands at an easel and paints, a caller presents at a huddle
  // screen, a DJ spins a turntable, a writer curls up in a reading armchair, a
  // reviewer pins tickets to a corkboard wall, an ops engineer tends a real
  // server rack, a browser reclines in a beanbag with a tablet, a focus person
  // sits cross-legged in a little zen corner. Only CODING keeps a screen — a
  // compact standing code kiosk in the corner, per the "coding only" note.
  //
  // Signature: draw(scene, x, y, objs) → returns { px, py, sit } where (px,py)
  // is where the ACTOR's feet go inside the scene, and `sit` lowers the sprite
  // a touch (chair / floor cushion). Everything is procedural fillRect/ellipse
  // (no assets). Static shapes carry the read; tweens only reinforce. `objs`
  // collects every created object so the whole scene is torn down together.
  // ═══════════════════════════════════════════════════════════════════════
  const V = {
    wood: 0xCBA87C, woodDk: 0x9E7A52, woodLt: 0xE0CBA6,
    metal: 0xB7C9CB, metalDk: 0x8A9EA8, chrome: 0xDCE7E8,
    paper: 0xFFFBF0, ink: 0x59696E, cork: 0xD8B681, corkDk: 0xC7A16A,
    green: 0x9BD8B4, greenDk: 0x4E7D66, amber: 0xF8DFA0, coral: 0xF4B3A6,
    violet: 0xCFBBF0, sky: 0xBEE7F7, pink: 0xF6BCD1, cushion: 0xE8A78E,
    screenDk: 0x1E262B, leaf: 0x9BD3A8, leafLt: 0xC0E8C4, water: 0xBEE7F7,
  };
  // small helper: a soft foot shadow rectangle-ellipse for props
  function propShadow(scene, x, y, w, h, objs) {
    const s = scene.add.ellipse(x, y, w, h, 0x8A7B66, 0.16).setDepth(y - 2);
    objs.push(s); return s;
  }

  const VIGNETTE = {
    // ── DESIGN: a standing ARTIST'S EASEL studio. A tall wooden easel holds a
    // bright canvas with a composition-in-progress; a palette + brushes rest on
    // a stool; paint splashes on a drop cloth; the actor stands at the canvas,
    // brush in hand. Reads as "someone is painting," not "someone at Figma."
    design(scene, x, y, objs) {
      propShadow(scene, x - 30, y + 30, 120, 30, objs);
      const g = scene.add.graphics(); objs.push(g);
      // drop cloth on the floor with paint splashes
      g.fillStyle(0xF0E9DA, 0.9); g.fillEllipse(x - 20, y + 26, 150, 54);
      [[x - 62, y + 20, V.coral], [x + 30, y + 34, V.sky], [x - 10, y + 40, V.amber], [x + 50, y + 14, V.violet]]
        .forEach(([sx, sy, c]) => { g.fillStyle(c, 0.7); g.fillEllipse(sx, sy, 14, 8); });
      // EASEL — two front legs + a back leg, tilted board
      const ex = x - 34, etop = y - 118;
      g.fillStyle(V.woodDk, 1);
      g.fillRect(ex - 20, etop + 10, 6, 150);            // left leg
      g.fillRect(ex + 40, etop + 10, 6, 150);            // right leg
      g.fillRect(ex + 8, etop + 40, 6, 130);             // back leg
      g.fillRect(ex - 22, y + 12, 70, 6);                // tray ledge
      // the canvas board (bright, like a lit artboard)
      const bw = 74, bh = 92, bx = ex - 14, by = etop + 4;
      g.fillStyle(V.wood, 1); g.fillRect(bx - 4, by - 4, bw + 8, bh + 8);   // frame
      g.fillStyle(0xFCF8F0, 1); g.fillRect(bx, by, bw, bh);                  // canvas
      // a composition in progress on the canvas
      g.fillStyle(V.violet, 1); g.fillRect(bx + 10, by + 12, 30, 22);
      g.fillStyle(V.sky, 1); g.fillRect(bx + 44, by + 8, 22, 18);
      g.fillStyle(V.coral, 1); g.fillEllipse(bx + 30, by + 58, 34, 26);
      g.fillStyle(V.amber, 1); g.fillRect(bx + 12, by + 70, 40, 8);
      g.fillStyle(V.ink, 0.4); g.fillRect(bx + 10, by + 84, 44, 3);
      // palette on a small stool beside the easel
      g.fillStyle(V.woodDk, 1); g.fillRect(x + 44, y + 6, 22, 20);          // stool
      g.fillStyle(V.woodLt, 1); g.fillRect(x + 42, y + 2, 26, 6);
      g.fillStyle(0xEAD9BE, 1); g.fillEllipse(x + 55, y - 4, 30, 16);        // palette
      [V.coral, V.amber, V.green, V.sky, V.violet].forEach((c, i) => {
        g.fillStyle(c, 1); g.fillEllipse(x + 46 + i * 5, y - 6, 5, 5); });
      // a selection frame pulsing on the canvas accent shape
      const sel = scene.add.rectangle(bx + 25, by + 23, 38, 30).setStrokeStyle(2, V.pink, 0.9).setDepth(by + bh);
      scene.tweens.add({ targets: sel, alpha: 0.3, duration: 1000, yoyo: true, repeat: -1 }); objs.push(sel);
      // a paint chip drifting up off the palette
      const chip = scene.add.rectangle(x + 55, y - 6, 5, 5, V.coral).setDepth(y + 40);
      scene.tweens.add({ targets: chip, y: y - 34, alpha: 0, duration: 2200, repeat: -1, ease: "Sine.easeOut" }); objs.push(chip);
      // actor stands to the RIGHT of the canvas, facing it (brush arm toward it)
      return { px: x + 24, py: y + 20, sit: false, flip: true };
    },

    // ── CALL: a HUDDLE / phone booth. A round rug, a big presentation screen on
    // a floor stand tiled with participant cameras, an "● ON AIR" bar, a couple
    // of tub chairs. The actor stands presenting beside the screen. Reads as "a
    // meeting is happening here," not "someone on a laptop."
    call(scene, x, y, objs) {
      const g = scene.add.graphics(); objs.push(g);
      // round huddle rug
      g.fillStyle(V.sky, 0.5); g.fillEllipse(x, y + 20, 200, 90);
      g.fillStyle(0x9ECBE0, 0.5); g.fillEllipse(x, y + 20, 200, 90);
      g.fillStyle(0xFFFFFF, 0.25); g.fillEllipse(x, y + 18, 150, 66);
      // cool "room lights up" wash
      const wash = scene.add.ellipse(x - 40, y - 40, 120, 90, V.sky, 0.22).setDepth(y - 70);
      scene.tweens.add({ targets: wash, alpha: 0.36, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); objs.push(wash);
      // presentation screen on a floor stand (left of centre so actor stands right)
      const sx = x - 44, sTop = y - 120, sw = 96, sh = 66;
      g.fillStyle(V.metalDk, 1); g.fillRect(sx + sw / 2 - 4, sTop + sh, 8, 118);  // stand pole
      g.fillStyle(V.metalDk, 1); g.fillRect(sx + sw / 2 - 24, y + 20, 48, 6);      // stand foot
      g.fillStyle(0x24333F, 1); g.fillRect(sx - 3, sTop - 3, sw + 6, sh + 6);      // bezel
      g.fillStyle(0x1B2732, 1); g.fillRect(sx, sTop, sw, sh);                       // screen
      // 2×3 participant camera tiles with head+shoulder silhouettes
      const tileCols = [0x6E9FD8, 0x86CFA6, 0xF0A79E, 0xEFC08A, 0x9E86C8, V.sky];
      const cells = [];
      for (let i = 0; i < 6; i++) {
        const cx = sx + 5 + (i % 3) * 30, cy = sTop + 5 + Math.floor(i / 3) * 30;
        g.fillStyle(tileCols[i], 0.85); g.fillRect(cx, cy, 27, 26);
        g.fillStyle(0x2E3A44, 0.9); g.fillRect(cx + 9, cy + 15, 9, 11); g.fillRect(cx + 11, cy + 6, 5, 6);
        cells.push({ cx: cx + 13, cy: cy + 13 });
      }
      // ON AIR bar
      g.fillStyle(0x7A2E2E, 1); g.fillRect(sx + 20, sTop - 12, 56, 10);
      g.fillStyle(0xFFE3DC, 0.9); g.fillRect(sx + 34, sTop - 9, 36, 4);
      const dot = scene.add.rectangle(sx + 27, sTop - 7, 5, 5, 0xF0605A).setDepth(sTop);
      scene.tweens.add({ targets: dot, alpha: 0.25, duration: 650, yoyo: true, repeat: -1 }); objs.push(dot);
      // active-speaker highlight hops tile → tile
      const ring = scene.add.rectangle(cells[0].cx, cells[0].cy, 29, 28).setStrokeStyle(2, 0xFFF6E4, 0.9).setDepth(sTop + 10);
      objs.push(ring);
      let hop = 0;
      const speaker = scene.time.addEvent({ delay: 1400, loop: true, callback: () => {
        hop = (hop + 1 + Math.floor(Math.random() * 2)) % cells.length; ring.setPosition(cells[hop].cx, cells[hop].cy); } });
      objs.push({ destroy: () => speaker.remove() });
      // a tub chair to the side (empty — the room seats more than one)
      g.fillStyle(V.coral, 1); g.fillRect(x + 40, y + 6, 28, 18); g.fillStyle(0xE59E90, 1); g.fillRect(x + 38, y - 6, 32, 14);
      // actor STANDS presenting, right of the screen
      return { px: x + 26, py: y + 14, sit: false, flip: true };
    },

    // ── MUSIC: a DJ TURNTABLE console on a stand + a tall speaker. Wide wood
    // cabinet, spinning vinyl, chrome tonearm, a VU strip, notes rising. The
    // actor stands at the decks. Reads as "someone is DJing / making the vibe."
    music(scene, x, y, objs) {
      propShadow(scene, x, y + 26, 130, 30, objs);
      const g = scene.add.graphics(); objs.push(g);
      // warm glow pooling under the decks
      const glow = scene.add.ellipse(x - 6, y + 2, 130, 46, V.amber, 0.22).setDepth(y - 70);
      scene.tweens.add({ targets: glow, alpha: 0.34, duration: 1900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); objs.push(glow);
      // DJ table legs + top (a real console the actor stands behind)
      g.fillStyle(V.woodDk, 1); g.fillRect(x - 56, y - 4, 6, 30); g.fillRect(x + 44, y - 4, 6, 30);
      g.fillStyle(V.wood, 1); g.fillRect(x - 60, y - 24, 110, 22);      // deck top
      g.fillStyle(0xD4A86A, 1); g.fillRect(x - 60, y - 24, 110, 3);
      // TWO turntables side by side
      [-30, 22].forEach((dx, k) => {
        g.fillStyle(0x3A342E, 1); g.fillEllipse(x + dx, y - 12, 34, 22);   // platter
        g.fillStyle(0x211E1B, 1); g.fillEllipse(x + dx, y - 12, 28, 18);
        g.fillStyle(0x3A3430, 1); g.fillEllipse(x + dx, y - 12, 16, 10);
        g.fillStyle(k ? V.sky : V.coral, 1); g.fillEllipse(x + dx, y - 12, 8, 5);  // label
        g.fillStyle(V.metal, 1); g.fillRect(x + dx + 14, y - 20, 3, 12);   // tonearm post
        g.fillStyle(V.metalDk, 1); g.fillRect(x + dx + 4, y - 12, 12, 2);  // arm
        const spin = scene.add.rectangle(x + dx, y - 16, 5, 2, 0x6E6A64).setDepth(y + 33);
        scene.tweens.add({ targets: spin, angle: 360, duration: 1500 + k * 200, repeat: -1, ease: "Linear",
          onUpdate: () => { const a = spin.angle * Math.PI / 180; spin.setPosition(x + dx + Math.cos(a) * 10, y - 12 + Math.sin(a) * 6); } });
        objs.push(spin);
      });
      // mixer VU strip in the middle
      const bars = [];
      for (let i = 0; i < 5; i++) {
        const bar = scene.add.rectangle(x - 6 + i * 4, y - 6, 3, 8, V.green).setOrigin(0.5, 1).setDepth(y + 32);
        bars.push(bar); objs.push(bar);
        scene.tweens.add({ targets: bar, scaleY: 0.3 + (i % 2) * 0.6, duration: 320 + i * 80, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: i * 70 });
      }
      // a tall speaker stack to the right
      g.fillStyle(0x2A2622, 1); g.fillRect(x + 60, y - 96, 30, 122);
      g.fillStyle(0x3A342E, 1); g.fillRect(x + 64, y - 92, 22, 40); g.fillRect(x + 64, y - 44, 22, 40);
      g.fillStyle(0x1A1714, 1); g.fillEllipse(x + 75, y - 72, 16, 16); g.fillEllipse(x + 75, y - 24, 16, 16);
      const pulse = scene.add.ellipse(x + 75, y - 48, 30, 30, V.amber, 0.14).setDepth(y - 40);
      scene.tweens.add({ targets: pulse, scaleX: 1.2, scaleY: 1.2, alpha: 0.02, duration: 700, repeat: -1, ease: "Sine.easeOut" }); objs.push(pulse);
      // rising notes
      ["♪", "♫", "♪"].forEach((ch, i) => {
        const nx = x - 20 + i * 20;
        const note = scene.add.text(nx, y - 20, ch, { fontFamily: "monospace", fontSize: "13px", color: i % 2 ? "#F8DFA0" : "#9BD8B4" }).setDepth(y + 34);
        scene.tweens.add({ targets: note, y: y - 58, x: nx + (i % 2 ? 8 : -8), alpha: 0, duration: 2200, delay: i * 480, repeat: -1, ease: "Sine.easeOut" }); objs.push(note);
      });
      // actor stands BEHIND the decks
      return { px: x, py: y - 34, sit: false };
    },

    // ── WRITING: a cozy READING NOOK. A wing-back armchair, a gooseneck floor
    // lamp casting an amber pool, a side table with a coffee, and a tall stack
    // of books. The actor SITS in the chair with an open notebook. Reads as
    // "someone curled up writing," not "someone at a word processor."
    writing(scene, x, y, objs) {
      propShadow(scene, x, y + 28, 120, 30, objs);
      const g = scene.add.graphics(); objs.push(g);
      // small round rug
      g.fillStyle(V.amber, 0.35); g.fillEllipse(x, y + 20, 170, 70);
      // amber lamp pool
      const glow = scene.add.ellipse(x + 6, y - 10, 110, 60, V.amber, 0.2).setDepth(y - 70);
      scene.tweens.add({ targets: glow, alpha: 0.32, duration: 2100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); objs.push(glow);
      // gooseneck floor lamp behind the chair (to the right)
      g.fillStyle(V.metalDk, 1); g.fillRect(x + 52, y + 4, 20, 5);        // base
      g.fillStyle(V.metal, 1); g.fillRect(x + 60, y - 92, 3, 96);         // pole
      g.fillStyle(V.metal, 1); g.fillRect(x + 44, y - 92, 20, 3);         // neck
      g.fillStyle(V.amber, 1); g.fillRect(x + 34, y - 96, 14, 10);        // shade
      g.fillStyle(0xFFF3C4, 1); g.fillRect(x + 36, y - 88, 10, 3);        // bulb
      // the ARMCHAIR (wing-back) — the actor will sit in it
      const chX = x - 6;
      g.fillStyle(0xB88A6A, 1); g.fillRect(chX - 34, y + 14, 68, 14);      // base/legs shadow
      g.fillStyle(V.cushion, 1); g.fillRect(chX - 36, y - 40, 72, 60);     // chair body
      g.fillStyle(0xD98F79, 1); g.fillRect(chX - 42, y - 44, 14, 60);      // left wing
      g.fillStyle(0xD98F79, 1); g.fillRect(chX + 30, y - 44, 14, 60);      // right wing
      g.fillStyle(0xF0BBA8, 1); g.fillRect(chX - 28, y - 30, 56, 40);      // seat cushion (lighter)
      g.fillStyle(0xFFFFFF, 0.18); g.fillRect(chX - 28, y - 30, 56, 4);
      // side table with coffee + book stack (left)
      g.fillStyle(V.woodDk, 1); g.fillRect(x - 74, y - 6, 26, 26);
      g.fillStyle(V.woodLt, 1); g.fillRect(x - 76, y - 10, 30, 6);
      g.fillStyle(V.paper, 1); g.fillRect(x - 70, y - 18, 9, 8); g.fillStyle(V.coral, 1); g.fillRect(x - 61, y - 16, 3, 4); // mug
      // tall stack of books beside the chair
      [V.coral, V.sky, V.green, V.violet, V.amber].forEach((c, i) => {
        g.fillStyle(c, 1); g.fillRect(x - 92 + (i % 2) * 2, y + 16 - i * 6, 24, 6); });
      const steam = scene.add.rectangle(x - 66, y - 20, 2, 5, 0xFFFFFF, 0.4).setDepth(y + 32);
      scene.tweens.add({ targets: steam, y: y - 36, alpha: 0, duration: 2400, repeat: -1, ease: "Sine.easeOut" }); objs.push(steam);
      // actor SITS in the chair, notebook glyph appears in front via badge/prop
      return { px: chX, py: y + 4, sit: true };
    },

    // ── BROWSING: a LOUNGE PERCH. A beanbag / lounge chair, a small pouffe, a
    // potted palm, and the actor reclining with a tablet showing a web feed.
    // Reads as "someone reading, feet up," not "someone at a browser."
    browsing(scene, x, y, objs) {
      propShadow(scene, x, y + 26, 120, 28, objs);
      const g = scene.add.graphics(); objs.push(g);
      g.fillStyle(V.coral, 0.28); g.fillEllipse(x, y + 18, 160, 66);       // rug
      const glow = scene.add.ellipse(x, y - 6, 100, 44, V.coral, 0.16).setDepth(y - 70);
      scene.tweens.add({ targets: glow, alpha: 0.28, duration: 2200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); objs.push(glow);
      // BEANBAG — a big rounded blob the actor sinks into
      g.fillStyle(0xE59E90, 1); g.fillEllipse(x, y + 6, 96, 60);
      g.fillStyle(V.coral, 1); g.fillEllipse(x, y - 2, 88, 50);
      g.fillStyle(0xFFFFFF, 0.16); g.fillEllipse(x - 10, y - 10, 40, 20);
      // a footstool / pouffe out front
      g.fillStyle(0xD6C4F2, 1); g.fillEllipse(x + 6, y + 40, 44, 20);
      // a potted palm to the right
      g.fillStyle(0x8A5E38, 1); g.fillRect(x + 58, y + 2, 18, 16);
      g.fillStyle(V.leaf, 1); g.fillRect(x + 60, y - 30, 14, 32); g.fillRect(x + 55, y - 26, 6, 10); g.fillRect(x + 74, y - 20, 6, 10);
      g.fillStyle(V.leafLt, 1); g.fillRect(x + 64, y - 26, 3, 18);
      // the TABLET the actor holds — propped, showing a web feed
      const tx = x - 4, ty = y - 30;
      g.fillStyle(0x2E3438, 1); g.fillRect(tx - 16, ty - 12, 34, 24);
      g.fillStyle(0xF0E8DA, 1); g.fillRect(tx - 14, ty - 10, 30, 20);
      g.fillStyle(V.coral, 1); g.fillRect(tx - 14, ty - 10, 30, 4);         // chrome bar
      g.fillStyle(0xCBD8DA, 1); g.fillRect(tx - 12, ty - 4, 8, 6);          // thumbnail
      g.fillStyle(V.ink, 0.5); g.fillRect(tx - 2, ty - 4, 14, 2); g.fillRect(tx - 2, ty - 1, 10, 2); g.fillRect(tx - 12, ty + 5, 26, 2);
      // scrolling feed rows
      const rows = [];
      for (let i = 0; i < 3; i++) { const r = scene.add.rectangle(tx + 2, ty - 4 + i * 4, 14, 2, V.ink, 0.5).setOrigin(0, 0.5).setDepth(y + 32); rows.push(r); objs.push(r); }
      scene.tweens.add({ targets: rows, y: "-=3", duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      // actor reclines low on the beanbag
      return { px: x - 2, py: y + 8, sit: true };
    },

    // ── REVIEW: an INSPECTION WALL. A big corkboard pinned with PR tickets and
    // red string connecting them (detective board), ✓/✗ approval stamps, a
    // standing spotlight, and the actor standing in front holding a clipboard.
    // Reads as "someone investigating / reviewing," not "someone at GitHub."
    review(scene, x, y, objs) {
      const g = scene.add.graphics(); objs.push(g);
      const glow = scene.add.ellipse(x, y - 40, 120, 80, V.violet, 0.16).setDepth(y - 70);
      scene.tweens.add({ targets: glow, alpha: 0.28, duration: 1900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); objs.push(glow);
      // a big CORKBOARD standing on the floor (a real wall of evidence)
      const bx = x - 58, bTop = y - 126, bw = 116, bh = 104;
      g.fillStyle(V.metalDk, 1); g.fillRect(bx + 6, y - 22, 8, 40); g.fillRect(bx + bw - 14, y - 22, 8, 40); // stand legs
      g.fillStyle(V.corkDk, 1); g.fillRect(bx - 4, bTop - 4, bw + 8, bh + 8);   // frame
      g.fillStyle(V.cork, 1); g.fillRect(bx, bTop, bw, bh);                      // cork face
      // pinned PR tickets in a scatter
      const tickets = [[10, 12, V.greenDk], [46, 8, 0xB0554C], [80, 16, V.greenDk], [24, 52, 0xB0554C], [66, 58, V.greenDk], [40, 34, V.greenDk]];
      const pins = [];
      tickets.forEach(([dx, dy, stamp]) => {
        g.fillStyle(V.paper, 1); g.fillRect(bx + dx, bTop + dy, 22, 26);
        g.fillStyle(V.violet, 1); g.fillRect(bx + dx, bTop + dy, 22, 6);          // PR header
        g.fillStyle(V.ink, 0.4); g.fillRect(bx + dx + 3, bTop + dy + 10, 16, 2); g.fillRect(bx + dx + 3, bTop + dy + 14, 12, 2);
        g.fillStyle(stamp, 1); g.fillRect(bx + dx + 7, bTop + dy + 18, 8, 6);      // ✓/✗ stamp
        pins.push([bx + dx + 11, bTop + dy]);
      });
      // red string connecting a few tickets (detective board)
      g.lineStyle(1.5, 0xC0554C, 0.7);
      g.lineBetween(pins[0][0], pins[0][1], pins[3][0], pins[3][1]);
      g.lineBetween(pins[1][0], pins[1][1], pins[4][0], pins[4][1]);
      g.lineBetween(pins[5][0], pins[5][1], pins[2][0], pins[2][1]);
      // pin heads
      pins.forEach(([px, py]) => { g.fillStyle(0xE24A3A, 1); g.fillCircle(px, py, 2); });
      // a standing spotlight aimed at the board
      g.fillStyle(V.metalDk, 1); g.fillRect(x + 54, y + 4, 16, 4); g.fillRect(x + 60, y - 40, 3, 44);
      g.fillStyle(V.amber, 1); g.fillRect(x + 52, y - 46, 14, 8);
      // one stamp flips approve ↔ comment
      const stamp = scene.add.rectangle(bx + 17, bTop + 30, 8, 6, V.greenDk).setDepth(bTop + bh);
      scene.tweens.add({ targets: stamp, alpha: 0.25, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); objs.push(stamp);
      // actor STANDS in front of the board (slightly right), clipboard implied
      return { px: x + 20, py: y + 12, sit: false, flip: true };
    },

    // ── TERMINAL / OPS: a real SERVER RACK the actor tends. A tall rack of
    // blinking machine units, cables, a floor console, a network blip along a
    // cable. The actor stands beside it. Reads as "someone running servers."
    terminal(scene, x, y, objs) {
      propShadow(scene, x - 30, y + 26, 90, 26, objs);
      const g = scene.add.graphics(); objs.push(g);
      const glow = scene.add.ellipse(x - 24, y - 30, 110, 90, 0x2E4A3A, 0.16).setDepth(y - 70);
      scene.tweens.add({ targets: glow, alpha: 0.26, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); objs.push(glow);
      // TALL server rack (to the left so actor stands right of it)
      const rx = x - 56, rTop = y - 128;
      g.fillStyle(0x3A4750, 1); g.fillRect(rx, rTop, 48, 150);
      g.fillStyle(0x2A343C, 1); g.fillRect(rx + 3, rTop + 3, 42, 144);
      const leds = [];
      for (let i = 0; i < 9; i++) {
        g.fillStyle(0x4A5A62, 1); g.fillRect(rx + 6, rTop + 6 + i * 16, 36, 12);   // unit face
        g.fillStyle(0x6E7E79, 1); g.fillRect(rx + 10, rTop + 9 + i * 16, 14, 3);   // vents
        const led = scene.add.rectangle(rx + 36, rTop + 12 + i * 16, 4, 4, [0x86CFA6, 0xEFC08A, 0x86CFA6, 0xF09B90, 0x86CFA6][i % 5]).setDepth(rTop + 150);
        scene.tweens.add({ targets: led, alpha: 0.2, duration: 500 + i * 160, yoyo: true, repeat: -1 });
        leds.push(led); objs.push(led);
      }
      // cables spilling out the side
      g.lineStyle(2, 0x59696E, 0.8);
      g.lineBetween(rx + 48, rTop + 40, rx + 70, rTop + 60);
      g.lineBetween(rx + 48, rTop + 60, rx + 66, rTop + 90);
      // a small floor console with a green prompt
      g.fillStyle(0x0E1216, 1); g.fillRect(x + 6, y - 20, 40, 24);
      g.fillStyle(V.green, 1); g.fillRect(x + 9, y - 16, 3, 2); g.fillRect(x + 14, y - 16, 12, 2);
      g.fillStyle(0x86CFA6, 0.8); g.fillRect(x + 9, y - 11, 26, 2); g.fillRect(x + 9, y - 6, 18, 2);
      const caret = scene.add.rectangle(x + 30, y - 6, 3, 3, V.green).setDepth(y + 33);
      scene.tweens.add({ targets: caret, alpha: 0.1, duration: 540, yoyo: true, repeat: -1 }); objs.push(caret);
      // network blip travelling up the rack
      const blip = scene.add.rectangle(rx + 24, y, 3, 3, V.green).setDepth(rTop + 151);
      scene.tweens.add({ targets: blip, y: rTop + 10, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); objs.push(blip);
      // actor stands to the right, tending the rack
      return { px: x + 30, py: y + 12, sit: false, flip: true };
    },

    // ── CODING: the ONE screen station — a compact standing CODE KIOSK in the
    // corner. A slim pedestal holds a dark IDE screen with code + a blinking
    // caret and a terminal-green glow; the actor stands at it. Kept per the
    // "coding only, at some corner" note — everything else is physical.
    coding(scene, x, y, objs) {
      propShadow(scene, x, y + 24, 80, 22, objs);
      const g = scene.add.graphics(); objs.push(g);
      const glow = scene.add.ellipse(x, y - 30, 96, 70, 0x2E4A3A, 0.2).setDepth(y - 70);
      scene.tweens.add({ targets: glow, scaleX: 1.06, alpha: 0.3, duration: 1700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); objs.push(glow);
      // pedestal / kiosk stand
      g.fillStyle(V.metalDk, 1); g.fillRect(x - 6, y - 40, 12, 60);
      g.fillStyle(V.metal, 1); g.fillRect(x - 22, y + 16, 44, 6);            // foot
      // the IDE screen (big, dark, code-lit)
      const sw = 88, sh = 60, sx = x - sw / 2, sTop = y - 108;
      g.fillStyle(0x2A3237, 1); g.fillRect(sx - 4, sTop - 4, sw + 8, sh + 8);
      g.fillStyle(V.screenDk, 1); g.fillRect(sx, sTop, sw, sh);
      g.fillStyle(0x2C6F9E, 1); g.fillRect(sx, sTop, 6, sh);                  // activity bar
      // code lines
      g.fillStyle(V.green, 0.9); g.fillRect(sx + 12, sTop + 8, 34, 3);
      g.fillStyle(V.greenDk, 0.9); g.fillRect(sx + 12, sTop + 15, 46, 3);
      g.fillStyle(0xEFC08A, 0.85); g.fillRect(sx + 20, sTop + 22, 28, 3);     // amber string
      g.fillStyle(V.green, 0.9); g.fillRect(sx + 20, sTop + 29, 38, 3);
      g.fillStyle(V.greenDk, 0.9); g.fillRect(sx + 12, sTop + 36, 24, 3);
      g.fillStyle(0x6E7E79, 0.8); g.fillRect(sx + 12, sTop + 43, 40, 3);
      const caret = scene.add.rectangle(sx + 40, sTop + 43, 3, 5, V.green).setDepth(sTop + sh);
      scene.tweens.add({ targets: caret, alpha: 0.1, duration: 520, yoyo: true, repeat: -1 }); objs.push(caret);
      const scan = scene.add.rectangle(sx + sw / 2, sTop + 10, sw - 8, 4, V.green, 0.14).setDepth(sTop + sh - 1);
      scene.tweens.add({ targets: scan, y: sTop + 48, duration: 2200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); objs.push(scan);
      // actor stands at the kiosk
      return { px: x, py: y + 14, sit: false };
    },

    // ── FOCUS / OTHER: a ZEN CORNER. A floor cushion on a tatami mat, a little
    // stone fountain trickling, tall calm plants, a soft breathing glow. The
    // actor SITS cross-legged. Reads as "heads-down / recharging," not a desk.
    focus(scene, x, y, objs) {
      const g = scene.add.graphics(); objs.push(g);
      // tatami mat
      g.fillStyle(0xE7DCC0, 0.85); g.fillRect(x - 60, y - 20, 120, 60);
      g.fillStyle(0xD8CBA8, 0.7); for (let i = -60; i < 60; i += 16) g.fillRect(x + i, y - 20, 2, 60);
      g.fillStyle(0xCFBE9E, 0.9); g.fillRect(x - 60, y - 20, 120, 3); g.fillRect(x - 60, y + 37, 120, 3);
      // breathing glow
      const glow = scene.add.ellipse(x, y - 6, 90, 60, V.sky, 0.14).setDepth(y - 70);
      scene.tweens.add({ targets: glow, alpha: 0.04, duration: 2800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); objs.push(glow);
      // floor cushion the actor sits on
      g.fillStyle(0xC6A7E0, 1); g.fillEllipse(x, y + 12, 56, 26);
      g.fillStyle(0xD6C4F2, 1); g.fillEllipse(x, y + 8, 48, 20);
      // little stone fountain to the left, trickling
      g.fillStyle(0x9AA6A8, 1); g.fillEllipse(x - 58, y + 6, 34, 18);
      g.fillStyle(0xB7C9CB, 1); g.fillEllipse(x - 58, y + 2, 24, 12);
      g.fillStyle(V.water, 1); g.fillEllipse(x - 58, y, 14, 7);
      const drip = scene.add.rectangle(x - 58, y - 6, 2, 5, V.water, 0.7).setDepth(y + 32);
      scene.tweens.add({ targets: drip, y: y + 2, alpha: 0.1, duration: 1200, repeat: -1, ease: "Sine.easeIn" }); objs.push(drip);
      // tall calm plants flanking
      g.fillStyle(0x8A5E38, 1); g.fillRect(x + 44, y + 2, 18, 18);
      g.fillStyle(V.leaf, 1); g.fillRect(x + 46, y - 40, 14, 44); g.fillRect(x + 40, y - 30, 6, 14); g.fillRect(x + 60, y - 24, 6, 12);
      g.fillStyle(V.leafLt, 1); g.fillRect(x + 50, y - 34, 3, 24);
      // a faint incense wisp
      const wisp = scene.add.rectangle(x + 30, y + 4, 2, 6, 0xFFFFFF, 0.35).setDepth(y + 32);
      scene.tweens.add({ targets: wisp, y: y - 20, alpha: 0, duration: 2600, repeat: -1, ease: "Sine.easeOut" }); objs.push(wisp);
      // actor SITS cross-legged on the cushion
      return { px: x, py: y + 6, sit: true };
    },
  };
  VIGNETTE.other = VIGNETTE.focus;

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
    // ---- terminal → a SERVER/OPS station (its own set piece), not the code nook.
    // `station` overrides the category's station painter so a terminal reads as an
    // ops rack, while `category:"coding"` keeps its zone/seating unchanged.
    terminal: { accent: "#9BD8B4", badge: ">_", category: "coding", screen: "terminal", station: "terminal" },
    iterm:    { accent: "#9BD8B4", badge: ">_", category: "coding", screen: "terminal", station: "terminal" },
    ghostty:  { accent: "#CFBBF0", badge: ">_", category: "coding", screen: "terminal", station: "terminal" },
    warp:     { accent: "#6E9FD8", badge: ">_", category: "coding", screen: "terminal", station: "terminal" },
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
    // 16×22 canvas for more room: extra 2px width gives shoulder flare,
    // extra 2px height gives a proper shoe row + breathing room at top.
    const w = 16, h = 22;
    const tex = scene.textures.createCanvas(key, w, h);
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, w, h);
    const {
      hair, skin, shirt, pants, glow,
      hairStyle = "short", outfit = "plain", accessory = "none",
      accent = "#FFF8EC", build = "regular",
    } = opts;
    const LINE = "#59696E", SHOE = "#6E5A44";
    // Derived skin shadow for depth (slightly darker than skin)
    const skinShadow = skin;  // we'll apply globalAlpha overlay trick instead

    if (glow) { ctx.globalAlpha = 0.20; px(ctx, 1, 2, 14, 20, glow); ctx.globalAlpha = 1; }

    // Body geometry: slim/regular/broad torso widths, centred in 16px canvas
    const tx = build === "slim" ? 4 : build === "broad" ? 2 : 3;
    const tw = build === "slim" ? 8 : build === "broad" ? 12 : 10;
    const shoulderW = tw + (build === "broad" ? 2 : 2);  // shoulder flare = 2px wider than torso
    const shoulderX = tx - 1;
    const legL = tx + 1, legR = tx + tw - 3;

    // ---- HAIR & HEAD ----
    // Head: 8 wide, centred. Softer silhouette with 1px corner cuts.
    // The face (skin) is 6 wide (rows 3-6), indented 1px each side.
    if (hairStyle === "hood") {
      // Hood covers most of head
      px(ctx, 3, 1, 10, 8, shirt); px(ctx, 4, 2, 8, 2, hair);
      px(ctx, 4, 1, 8, 3, hair);   // hood brim
    } else if (hairStyle === "curly") {
      // Curly cloud — wider, taller
      px(ctx, 4, 0, 8, 6, hair);
      px(ctx, 3, 1, 1, 4, hair); px(ctx, 12, 1, 1, 4, hair);  // side puffs
      px(ctx, 5, 0, 6, 1, hair);  // top puff
    } else if (hairStyle === "long") {
      // Long flow: top cap + side curtains
      px(ctx, 5, 1, 6, 3, hair); px(ctx, 4, 2, 8, 4, hair);
      px(ctx, 3, 3, 1, 10, hair); px(ctx, 12, 3, 1, 10, hair);  // long side strands
      px(ctx, 4, 12, 1, 4, hair); px(ctx, 11, 12, 1, 4, hair);  // tapered ends
    } else if (hairStyle === "bun") {
      px(ctx, 6, 0, 4, 2, hair);   // bun knot
      px(ctx, 5, 1, 6, 3, hair); px(ctx, 4, 2, 8, 4, hair);
    } else if (hairStyle === "cap") {
      px(ctx, 5, 1, 6, 3, hair); px(ctx, 4, 2, 8, 4, hair);
      px(ctx, 4, 1, 8, 2, accent); px(ctx, 3, 3, 5, 1, accent); px(ctx, 4, 3, 8, 1, LINE); // brim
    } else if (hairStyle === "beanie") {
      px(ctx, 4, 2, 8, 4, hair);
      px(ctx, 4, 1, 8, 3, accent); px(ctx, 4, 3, 8, 1, LINE); px(ctx, 7, 0, 2, 1, accent);
    } else {
      // short default
      px(ctx, 5, 1, 6, 3, hair); px(ctx, 4, 2, 8, 4, hair);
    }

    // ---- FACE ----
    // Face is 6 wide (x 5-10), 4 tall (y 4-7). Corner pixels trimmed for roundness.
    px(ctx, 5, 3, 6, 1, hair);  // hairline connector row
    px(ctx, 5, 4, 6, 4, skin);  // main face block
    // Rounded corners: overwrite face corners with transparency (no-op in canvas =
    // we just don't draw them, achieved by slightly narrowing at corners)
    // Right-side face shadow for depth
    ctx.globalAlpha = 0.18; px(ctx, 10, 4, 1, 4, "#3A2010"); ctx.globalAlpha = 1;
    // Eyes: 2px apart, with tiny highlight
    px(ctx, 6, 6, 1, 1, LINE); px(ctx, 9, 6, 1, 1, LINE);
    // Subtle mouth
    ctx.globalAlpha = 0.5; px(ctx, 7, 8, 2, 1, LINE); ctx.globalAlpha = 1;

    // Neck: 2px wide connecting face to torso
    px(ctx, 7, 8, 2, 1, skin);

    // ---- TORSO ----
    // Shoulders (1 row) wider than torso for shape
    px(ctx, shoulderX, 9, shoulderW, 1, shirt);
    // Main torso body (rows 10-14)
    px(ctx, tx, 10, tw, 5, shirt);
    // Arms: hang from shoulder row, 2px wide
    px(ctx, tx - 1, 10, 1, 5, shirt); px(ctx, tx + tw, 10, 1, 5, shirt);
    // Forearms (skin-coloured, shorter)
    px(ctx, tx - 1, 14, 1, 2, skin); px(ctx, tx + tw, 14, 1, 2, skin);
    // Right-side torso shadow for depth
    ctx.globalAlpha = 0.15; px(ctx, tx + tw - 1, 10, 1, 5, "#2A1810"); ctx.globalAlpha = 1;

    // ---- OUTFIT DETAILS ----
    if (outfit === "hoodie") {
      px(ctx, tx, 10, tw, 2, accent);        // hood collar band
      px(ctx, 7, 12, 1, 2, accent); px(ctx, 9, 12, 1, 2, accent);  // drawstrings
      px(ctx, tx + 1, 13, tw - 2, 2, LINE);  // front pocket seam
    } else if (outfit === "collar") {
      // Open collar: accent lapels + visible white undershirt + tie
      px(ctx, tx, 10, 2, 5, accent); px(ctx, tx + tw - 2, 10, 2, 5, accent);
      px(ctx, 7, 10, 2, 1, "#FFF8EC"); px(ctx, 7, 11, 2, 4, pants);  // tie
    } else if (outfit === "stripes") {
      for (let y = 11; y < 15; y += 2) px(ctx, tx, y, tw, 1, accent);
    } else if (outfit === "overalls") {
      px(ctx, tx + 1, 10, 1, 4, pants); px(ctx, tx + tw - 2, 10, 1, 4, pants);  // straps
      px(ctx, tx + 1, 12, tw - 2, 3, pants);  // bib body
      px(ctx, tx + 3, 13, 2, 2, accent);       // bib pocket
    } else if (outfit === "vest") {
      px(ctx, tx, 10, 2, 5, accent); px(ctx, tx + tw - 2, 10, 2, 5, accent);
      px(ctx, tx + 2, 10, tw - 4, 1, "#FFF8EC");  // vest neckline
    } else if (outfit === "apron") {
      px(ctx, tx + 1, 11, tw - 2, 4, accent);                // apron body
      px(ctx, tx + 2, 10, 1, 2, accent); px(ctx, tx + tw - 3, 10, 1, 2, accent);  // ties
    }

    // ---- LEGS ----
    px(ctx, legL, 16, 2, 4, pants); px(ctx, legR, 16, 2, 4, pants);
    // Shoes: 3px wide, 1px tall, slightly darker
    px(ctx, legL - 1, 20, 3, 1, SHOE); px(ctx, legR, 20, 3, 1, SHOE);
    // Shoe highlight
    ctx.globalAlpha = 0.3; px(ctx, legL, 20, 1, 1, "#B09A7A"); px(ctx, legR + 1, 20, 1, 1, "#B09A7A"); ctx.globalAlpha = 1;

    // ---- ACCESSORIES ----
    if (accessory === "glasses") {
      // Rounded frames: two 2-px circles connected by bridge
      px(ctx, 5, 5, 3, 2, LINE); px(ctx, 8, 5, 3, 2, LINE); px(ctx, 7, 5, 2, 1, LINE); // bridge
      px(ctx, 4, 5, 1, 2, LINE); px(ctx, 11, 5, 1, 2, LINE); // temples
      // Lens tint (very subtle)
      ctx.globalAlpha = 0.12; px(ctx, 5, 5, 3, 2, "#BEE7F7"); px(ctx, 8, 5, 3, 2, "#BEE7F7"); ctx.globalAlpha = 1;
    } else if (accessory === "headphones") {
      // Headband arc over top of head
      px(ctx, 4, 1, 8, 1, LINE);
      // Ear cups — 2×3 blocks on sides
      px(ctx, 3, 3, 2, 4, LINE); px(ctx, 11, 3, 2, 4, LINE);
      // Accent pads inside cups
      px(ctx, 3, 4, 1, 2, accent); px(ctx, 12, 4, 1, 2, accent);
    } else if (accessory === "scarf") {
      // Scarf loop around neck: 2 rows at neck/shoulder junction
      px(ctx, tx + 1, 8, tw - 2, 2, accent);
      px(ctx, tx + tw - 2, 10, 2, 3, accent);  // scarf tail drape
    } else if (accessory === "earrings") {
      px(ctx, 4, 7, 1, 1, accent); px(ctx, 11, 7, 1, 1, accent);  // dangling earrings
    } else if (accessory === "lanyard") {
      px(ctx, 7, 10, 1, 4, LINE); px(ctx, 9, 10, 1, 4, LINE);  // cord
      px(ctx, 7, 13, 3, 3, accent);  // ID card
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
        this.player.body.setSize(10, 8).setOffset(3, 14);
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
        // Desk legs with toe caps
        g.fillStyle(0xA87A50, 1); g.fillRect(x - 48, y + 22, 8, 8); g.fillRect(x + 40, y + 22, 8, 8);
        g.fillStyle(0x8A6038, 1); g.fillRect(x - 48, y + 28, 8, 2); g.fillRect(x + 40, y + 28, 8, 2);
        // Desk body: main + front face + top face (3 distinct shades = isometric feel)
        g.fillStyle(C.desk, 1); g.fillRect(x - 52, y - 6, 104, 30);           // front face
        g.fillStyle(C.deskTop, 1); g.fillRect(x - 52, y - 16, 104, 12);        // top face (lighter)
        g.fillStyle(0xC08A52, 0.6); g.fillRect(x - 52, y - 16, 104, 2);        // top edge highlight
        g.fillStyle(0xA07840, 0.3); g.fillRect(x + 50, y - 14, 2, 28);         // right side shadow
        // Cable management / back strip
        g.fillStyle(C.metalDark, 1); g.fillRect(x - 3, y - 20, 6, 6);
        // Monitor: outer bezel + inner screen
        g.fillStyle(0x8A9EA8, 1); g.fillRect(x - 29, y - 52, 58, 36);          // dark outer bezel
        g.fillStyle(C.monitor, 1); g.fillRect(x - 27, y - 50, 54, 32);         // monitor face
        g.fillStyle(0xD0E0EA, 0.6); g.fillRect(x - 27, y - 50, 54, 3);         // bezel top gloss
        // Screen content (default; overridden by paintScreen for live actors)
        g.fillStyle([0xBBDCF0, 0x9BD8B4, 0xCFBBF0, 0xF8DFA0, 0xF4B3A6, 0xBEE7F7][seat % 6], 1);
        g.fillRect(x - 23, y - 46, 46, 26);
        // Generic screen placeholder lines (overridden by STATION_DRAW for live actors)
        g.fillStyle(0xFFFFFF, 0.55);
        g.fillRect(x - 19, y - 42, 22, 3); g.fillRect(x - 19, y - 36, 32, 3); g.fillRect(x - 19, y - 30, 16, 3);
        // Monitor stand
        g.fillStyle(0x6E8896, 1); g.fillRect(x - 14, y - 14, 28, 2);           // stand arm
        g.fillStyle(0x7A9AA8, 1); g.fillRect(x - 16, y - 12, 32, 6);           // stand body
        // Desk surface items
        g.fillStyle(C.cream, 1); g.fillRect(x + 22, y - 13, 8, 8);            // note block
        g.fillStyle(C.ochre, 1); g.fillRect(x + 29, y - 11, 3, 4);            // pen
        g.fillStyle(0xE0D0B8, 0.85); g.fillRect(x - 44, y - 12, 16, 10);      // mouse pad
        this.deskProp(g, x - 38, y - 14, seat);
        // Subtle ambient glow under monitor
        g.fillStyle(0xBBDCF0, 0.13); g.fillEllipse(x, y - 6, 120, 28);
        // Chair backing/drawer unit
        const cg = this.layer(y + 44);
        cg.fillStyle(C.metalDark, 1); cg.fillRect(x - 16, y + 30, 32, 8);
        cg.fillStyle(C.metal, 1); cg.fillRect(x - 18, y + 36, 36, 14);
        cg.fillStyle(0xC8D8DA, 1); cg.fillRect(x - 16, y + 38, 32, 3);       // drawer seam
        this.solid(x, y + 4, 104, 44);
      }

      // A single scattered WORK BOOTH — a self-contained little nook, not a row
      // desk. Each booth gets: a soft coloured MAT pooled under it (so it reads
      // as its own space on the floor), a compact desk surface with a monitor,
      // and a low L-shaped back/side panel that frames the seat like a corner —
      // giving the "different kinds of work in their own corners" feel without
      // the cubicle-farm dividers. The station prop (STATION_DRAW) is drawn on
      // top per actor, so a booth becomes an IDE nook / turntable / easel / etc.
      boothUnit(x, y, seat, tone) {
        // ---- the mat under the booth (drawn low so everything sits on it)
        const mat = this.layer(y - 40);
        const t = BOOTH_MAT[tone] || BOOTH_MAT.oat;
        mat.fillStyle(t.fill, 0.7); this.roundRect(mat, x - 82, y - 34, 164, 118, 14);
        mat.fillStyle(t.edge, 0.55); this.roundRectStroke(mat, x - 82, y - 34, 164, 118, 14, 3);
        // a couple of soft flecks so the mat has texture
        mat.fillStyle(t.edge, 0.3);
        mat.fillRect(x - 60, y + 54, 8, 8); mat.fillRect(x + 44, y - 18, 8, 8);

        const g = this.layer(y + 30);
        this.shadow(x, y + 22, 110, 22);
        // ---- low L-shaped booth back panel framing the seat (a corner nook)
        const bp = this.layer(y - 8);
        bp.fillStyle(C.partition, 1);
        this.roundRect(bp, x - 62, y - 44, 124, 14, 6);      // back panel
        this.roundRect(bp, x - 62, y - 44, 12, 66, 6);        // left return
        bp.fillStyle(C.partitionTop, 1);
        bp.fillRect(x - 60, y - 44, 120, 3); bp.fillRect(x - 62, y - 44, 12, 3);
        bp.fillStyle(0xFFFFFF, 0.14); bp.fillRect(x - 58, y - 40, 116, 4);
        // a little personal pin on the back panel (varies by seat)
        bp.fillStyle(CONFETTI[seat % CONFETTI.length], 0.95); bp.fillRect(x + 40, y - 40, 10, 10);
        bp.fillStyle(CONFETTI[(seat + 2) % CONFETTI.length], 0.9); bp.fillRect(x - 54, y - 40, 8, 8);

        // ---- compact desk surface (smaller than the old row desk)
        g.fillStyle(0xA87A50, 1); g.fillRect(x - 40, y + 18, 7, 8); g.fillRect(x + 33, y + 18, 7, 8); // legs
        g.fillStyle(C.desk, 1); g.fillRect(x - 46, y - 6, 92, 26);        // front face
        g.fillStyle(C.deskTop, 1); g.fillRect(x - 46, y - 14, 92, 10);     // top face
        g.fillStyle(0xC08A52, 0.6); g.fillRect(x - 46, y - 14, 92, 2);     // top edge highlight
        g.fillStyle(0xA07840, 0.3); g.fillRect(x + 44, y - 12, 2, 24);     // right side shadow
        // ---- monitor (default screen; overridden by paintScreen/STATION_DRAW)
        g.fillStyle(0x8A9EA8, 1); g.fillRect(x - 29, y - 52, 58, 36);      // outer bezel
        g.fillStyle(C.monitor, 1); g.fillRect(x - 27, y - 50, 54, 32);     // face
        g.fillStyle(0xD0E0EA, 0.6); g.fillRect(x - 27, y - 50, 54, 3);     // gloss
        g.fillStyle([0xBBDCF0, 0x9BD8B4, 0xCFBBF0, 0xF8DFA0, 0xF4B3A6, 0xBEE7F7][seat % 6], 1);
        g.fillRect(x - 23, y - 46, 46, 26);
        g.fillStyle(0xFFFFFF, 0.55);
        g.fillRect(x - 19, y - 42, 22, 3); g.fillRect(x - 19, y - 36, 32, 3); g.fillRect(x - 19, y - 30, 16, 3);
        g.fillStyle(0x6E8896, 1); g.fillRect(x - 14, y - 16, 28, 2);        // stand arm
        g.fillStyle(0x7A9AA8, 1); g.fillRect(x - 16, y - 14, 32, 6);        // stand body
        // small desk items + mouse pad
        g.fillStyle(C.cream, 1); g.fillRect(x + 22, y - 13, 8, 8);
        g.fillStyle(C.ochre, 1); g.fillRect(x + 29, y - 11, 3, 4);
        g.fillStyle(0xE0D0B8, 0.85); g.fillRect(x - 40, y - 12, 15, 9);
        this.deskProp(g, x - 34, y - 14, seat);
        g.fillStyle(0xBBDCF0, 0.13); g.fillEllipse(x, y - 6, 108, 26);
        // ---- little swivel chair backing under the seat
        const cg = this.layer(y + 44);
        cg.fillStyle(C.metalDark, 1); cg.fillRect(x - 14, y + 30, 28, 8);
        cg.fillStyle(C.metal, 1); cg.fillRect(x - 16, y + 36, 32, 12);
        cg.fillStyle(0xC8D8DA, 1); cg.fillRect(x - 14, y + 38, 28, 3);
        this.solid(x, y + 2, 92, 40);
      }

      // rounded-rect helpers so booth mats/panels read as soft nooks, not boxes
      roundRect(g, x, y, w, h, r) {
        g.fillRect(x + r, y, w - 2 * r, h);
        g.fillRect(x, y + r, w, h - 2 * r);
        g.fillCircle(x + r, y + r, r); g.fillCircle(x + w - r, y + r, r);
        g.fillCircle(x + r, y + h - r, r); g.fillCircle(x + w - r, y + h - r, r);
      }
      roundRectStroke(g, x, y, w, h, r, t) {
        g.fillRect(x + r, y, w - 2 * r, t); g.fillRect(x + r, y + h - t, w - 2 * r, t);
        g.fillRect(x, y + r, t, h - 2 * r); g.fillRect(x + w - t, y + r, t, h - 2 * r);
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
        // No single big bullpen carpet any more — the scattered booths each ride
        // their own coloured mat, so the warm plank floor flows between them and
        // the room reads as separate work corners, not one uniform desk zone.
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

        // NO shared desks. Each actor's VIGNETTE (drawn in setStationProp when
        // they arrive) IS the furniture for their corner — an easel, a turntable,
        // a reading armchair, a corkboard wall, a server rack, a zen cushion, a
        // code kiosk — so the room reads as different KINDS of work physically
        // happening, not people parked at identical monitors. We only lay down a
        // faint soft mat per booth so an empty corner still reads as "a spot for
        // something," and scatter a few plants to break up the floor.
        DESKS.forEach((dd) => {
          const t = BOOTH_MAT[dd.tone] || BOOTH_MAT.oat;
          const m = this.layer(dd.y - 46);
          m.fillStyle(t.fill, 0.32); m.fillEllipse(dd.x, dd.y + 12, 176, 96);
        });
        this.plant(1150, 300);
        this.plant(430, 250);
        this.plant(1200, 470);

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
        const startX = DOOR.x, startY = DOOR.y; // live actors walk in through the door

        const spr = this.add.sprite(startX, startY, texKey).setScale(3).setDepth(startY + 30).setInteractive({ useHandCursor: true });
        const shadow = this.footShadow(startX, startY);
        const status = data.status || "idle";

        // Labels start at the booth centre; placeInScene re-anchors them to the
        // pose once the vignette is drawn. Hidden until the actor arrives.
        const pillBg = this.add.rectangle(desk.x, desk.y - 42, 74, 17, 0xFFF6E4, 0.95).setDepth(1200).setStrokeStyle(2, STATUS_COL[status] || STATUS_COL.idle);
        const pillTx = this.add.text(desk.x, desk.y - 42, status.toUpperCase(), {
          fontFamily: "ui-monospace, Menlo, monospace", fontSize: "9px", color: STATUS_INK[status] || STATUS_INK.idle,
        }).setOrigin(0.5).setDepth(1201).setResolution(3);
        const nameTx = this.add.text(desk.x, desk.y + 26, data.name, {
          fontFamily: "ui-monospace, Menlo, monospace", fontSize: "10px", color: "#22312E",
        }).setOrigin(0.5).setDepth(1201).setResolution(3);
        nameTx.setStroke("#FFF6E4", 4);
        [pillBg, pillTx, nameTx].forEach((o) => o.setAlpha(0));

        const agent = {
          externalId: data.externalId, name: data.name, role: data.role, status,
          category: data.category || null, tool: data.tool || null, object: data.object || null,
          currentTask: data.currentTask, events: data.events || [],
          spr, shadow, pillBg, pillTx, nameTx, desk, badge: null, station: null, pose: null, seated: false,
        };
        // Draw the vignette FIRST so we know where the actor stands/sits in it.
        this.setStationProp(agent, desk);
        this.setCategoryBadge(agent, desk);
        const pose = agent.pose || { px: desk.x, py: desk.y, sit: false };
        const destY = pose.sit ? pose.py + 8 : pose.py;

        spr.setDepth(700);
        this.tweens.add({
          targets: spr, x: pose.px, y: destY, duration: 1600, ease: "Sine.easeInOut",
          onUpdate: () => { spr.setDepth(spr.y + 30); shadow.setPosition(spr.x, spr.y + 28).setDepth(spr.y + 29); },
          onComplete: () => {
            agent.seated = true;
            this.placeInScene(agent);              // snap into the scene + move labels
            this.tweens.add({ targets: [pillBg, pillTx, nameTx], alpha: 1, duration: 300 });
            ui.toast(data.name + " is on it.");
            if (!pose.sit) this.bob(spr);          // standing actors bob; seated stay put
          },
        });

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
        // Draw the actor's VIGNETTE — a physical scene of their work — at the
        // booth spot, and record the pose (where the actor stands/sits inside
        // it). No desk is drawn: the scene IS the furniture. Terminal overrides
        // its vignette to the server rack; otherwise the category's scene runs.
        const app = appLook(agent);
        const cat = (app && app.category) || agent.category;
        const objs = [];
        const x = desk.x, y = desk.y;
        const key = (app && app.station) || cat;      // e.g. terminal → server rack
        const painter = VIGNETTE[key] || VIGNETTE.focus;
        const pose = painter(this, x, y, objs) || { px: x, py: y, sit: false };
        agent.station = objs;
        agent.pose = pose;
        // Re-place the actor inside its scene (in case the category changed).
        if (agent.spr && agent.seated) this.placeInScene(agent);
        return pose;
      }

      // Move a seated actor onto its vignette's pose anchor, facing the scene,
      // sitting a touch lower on a chair/cushion. Keeps labels above the head.
      placeInScene(agent) {
        const p = agent.pose || { px: agent.desk.x, py: agent.desk.y, sit: false };
        const py = p.sit ? p.py + 8 : p.py;
        agent.spr.setPosition(p.px, py).setDepth(py + 30);
        if (typeof p.flip === "boolean") agent.spr.setFlipX(p.flip);
        agent.spr.setScale(p.sit ? 2.7 : 3);
        if (agent.shadow) agent.shadow.setPosition(p.px, py + 28).setDepth(py + 29);
        const labelY = py - (p.sit ? 40 : 52);
        if (agent.pillBg) agent.pillBg.setPosition(p.px, labelY);
        if (agent.pillTx) agent.pillTx.setPosition(p.px, labelY);
        if (agent.nameTx) agent.nameTx.setPosition(p.px, py + 28);
        if (agent.badge) { agent.badge.bg.setPosition(p.px + 34, labelY + 4); agent.badge.tx.setPosition(p.px + 34, labelY + 4); }
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
