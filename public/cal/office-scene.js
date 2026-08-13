/**
 * The reception at /cal/[handle].
 *
 * Loaded as a plain script after public/demo/phaser.min.js, because Phaser is
 * vendored in public/ rather than installed, so it cannot be imported. React
 * calls boot() and gets a small controller back; the scene never reaches into
 * React, it only fires the callbacks it was handed.
 *
 * Sprite geometry is lifted from public/demo/index.html on purpose — the same
 * 14x20 person appears there, in AgentLandingView.jsx and in the OG image, and
 * a second slightly-different person would read as a bug.
 *
 * Movement is target-based, never tween-based: a tween fights the arcade body
 * and walks people through furniture. Set a target, let update() steer.
 */
(function () {
  const W = 960;
  const H = 600;

  const C = {
    floorA: 0x6b4a2f,
    floorB: 0x63432a,
    floorLine: 0x553920,
    wall: 0x245055,
    wallDark: 0x14312f,
    wallTrim: 0x2e6167,
    desk: 0x8a5e38,
    deskTop: 0xa5713f,
    monitor: 0x14201f,
    ochre: 0xe0a458,
    cream: 0xf0e2c8,
  };

  const DOOR = { x: 120, y: 130 };
  const COUNTER = { x: 480, y: 300, w: 260, h: 40 };
  const RECEPTIONIST = { x: 480, y: 244 };
  const DESK_MARK = { x: 480, y: 384 };
  const ARRIVE_RADIUS = 108;
  const SIDE_DESKS = [
    { x: 168, y: 466 },
    { x: 792, y: 466 },
  ];

  const AMBIENT_LOOKS = [
    { hair: "#3b2a1e", skin: "#d9a277", shirt: "#2f6b63", pants: "#2a2e33" },
    { hair: "#1e1b18", skin: "#8c5f3c", shirt: "#3e5f8a", pants: "#242830" },
  ];
  const VISITOR_LOOK = { hair: "#2b211a", skin: "#c98b5e", shirt: "#f0e2c8", pants: "#2a2e33" };
  const DEFAULT_RECEPTIONIST_LOOK = {
    hair: "#5a3418",
    skin: "#ebc49a",
    shirt: "#c8873f",
    pants: "#33302b",
    glow: "#f3c98b",
  };

  function px(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  }

  function makePerson(scene, key, opts) {
    if (scene.textures.exists(key)) return;

    const w = 14;
    const h = 20;
    const tex = scene.textures.createCanvas(key, w, h);
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, w, h);
    const hair = opts.hair;
    const skin = opts.skin;
    const shirt = opts.shirt;
    const pants = opts.pants;
    const glow = opts.glow;

    if (glow) {
      ctx.globalAlpha = 0.22;
      px(ctx, 1, 1, 12, 18, glow);
      ctx.globalAlpha = 1;
    }
    px(ctx, 4, 1, 6, 3, hair);
    px(ctx, 3, 2, 8, 4, hair);
    px(ctx, 4, 4, 6, 4, skin);
    px(ctx, 4, 3, 6, 1, hair);
    px(ctx, 5, 6, 1, 1, "#14201f");
    px(ctx, 8, 6, 1, 1, "#14201f");
    px(ctx, 3, 8, 8, 7, shirt);
    px(ctx, 2, 9, 1, 5, shirt);
    px(ctx, 11, 9, 1, 5, shirt);
    px(ctx, 2, 13, 1, 2, skin);
    px(ctx, 11, 13, 1, 2, skin);
    px(ctx, 4, 15, 2, 4, pants);
    px(ctx, 8, 15, 2, 4, pants);
    px(ctx, 3, 19, 3, 1, "#2a1d12");
    px(ctx, 8, 19, 3, 1, "#2a1d12");
    tex.refresh();
  }

  function isTyping() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable;
  }

  function OfficeSceneFactory(options) {
    return class Office extends Phaser.Scene {
      constructor() {
        super("office");
      }

      create() {
        this.arrived = false;
        this.target = null;
        this.path = [];
        this.solids = [];

        this.drawRoom();

        makePerson(this, "cal-visitor", VISITOR_LOOK);
        makePerson(this, "cal-receptionist", options.receptionistLook || DEFAULT_RECEPTIONIST_LOOK);
        AMBIENT_LOOKS.forEach((look, index) => makePerson(this, "cal-ambient" + index, look));

        this.receptionist = this.add
          .sprite(RECEPTIONIST.x, RECEPTIONIST.y, "cal-receptionist")
          .setScale(3)
          .setDepth(400 + RECEPTIONIST.y);
        this.bob(this.receptionist);

        this.add
          .text(RECEPTIONIST.x, RECEPTIONIST.y - 46, options.receptionistName || "Front desk", {
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: "11px",
            color: "#F0E2C8",
          })
          .setOrigin(0.5)
          .setDepth(700)
          .setResolution(3);

        SIDE_DESKS.forEach((desk, index) => {
          const staff = this.add
            .sprite(desk.x, desk.y + 34, "cal-ambient" + index)
            .setScale(3)
            .setDepth(400 + desk.y);
          this.bob(staff);
        });

        this.buildBubble();

        this.visitor = this.physics.add.sprite(DOOR.x, DOOR.y + 40, "cal-visitor").setScale(3).setDepth(500);
        this.visitor.body.setSize(10, 8).setOffset(2, 12);
        this.solids.forEach((solid) => this.physics.add.collider(this.visitor, solid));
        this.physics.world.setBounds(24, 104, W - 48, H - 128);
        this.visitor.body.setCollideWorldBounds(true);

        // auto-walk: touch nothing and the visit still happens. The whole page
        // is a chore someone came here to finish, not a game to learn.
        //
        // Two legs, not one: the straight line from the door to the mark cuts
        // through the counter, and a body that snags on it never "arrives", so
        // the receptionist would silently never speak. Walk down the near side
        // first, then across in front of the counter.
        this.walkTo([
          { x: DOOR.x + 20, y: DESK_MARK.y + 24 },
          { x: DESK_MARK.x, y: DESK_MARK.y },
        ]);

        // one control scheme for mouse and touch alike
        this.input.on("pointerdown", (pointer) => {
          this.walkTo([{ x: pointer.worldX, y: pointer.worldY }]);
        });

        // enableCapture = false. Phaser's default preventDefaults these keys on
        // window, which would eat "a", "s", "d" and "w" as someone types their
        // name into the form sitting next to the canvas.
        this.keys = this.input.keyboard
          ? this.input.keyboard.addKeys("W,A,S,D,UP,LEFT,DOWN,RIGHT", false)
          : null;

        if (options.portrait) {
          // Frame the reception rather than following the visitor. Following
          // centres a walking sprite and pushes the counter — the only part of
          // the room that means anything here — off the edge of a phone. This
          // zoom is the smallest that still fills the 660px-tall canvas with
          // the 600px-tall world, so nothing letterboxes.
          this.cameras.main.setBounds(0, 0, W, H);
          this.cameras.main.setZoom(1.1);
          this.cameras.main.centerOn(DESK_MARK.x, H / 2);
        }
      }

      drawRoom() {
        const g = this.add.graphics().setDepth(0);

        for (let y = 96; y < H; y += 24) {
          for (let x = 0; x < W; x += 48) {
            const off = ((y / 24) % 2) * 24;
            g.fillStyle((x / 48 + y / 24) % 2 ? C.floorA : C.floorB, 1);
            g.fillRect(x + off - 48, y, 48, 24);
          }
        }
        g.lineStyle(1, C.floorLine, 0.35);
        for (let y = 96; y < H; y += 24) g.lineBetween(0, y, W, y);

        g.fillStyle(C.wall, 1);
        g.fillRect(0, 0, W, 96);
        g.fillStyle(C.wallDark, 1);
        g.fillRect(0, 84, W, 12);
        g.fillStyle(C.wallTrim, 1);
        for (let x = 0; x < W; x += 8) g.fillRect(x, 78, 4, 6);

        [300, 540, 780].forEach((x) => {
          g.fillStyle(C.wallDark, 1);
          g.fillRect(x, 16, 96, 56);
          g.fillStyle(0xe8b979, 1);
          g.fillRect(x + 4, 20, 88, 48);
          g.fillStyle(0xf2d4a2, 1);
          g.fillRect(x + 4, 20, 88, 18);
          g.fillStyle(C.wallDark, 1);
          g.fillRect(x + 46, 16, 4, 56);
          g.fillRect(x, 42, 96, 4);
        });

        // door the visitor comes in through
        g.fillStyle(0x3a2617, 1);
        g.fillRect(DOOR.x - 26, 30, 52, 66);
        g.fillStyle(0x513520, 1);
        g.fillRect(DOOR.x - 21, 35, 42, 61);
        g.fillStyle(C.ochre, 1);
        g.fillRect(DOOR.x + 12, 66, 4, 4);

        this.plant(g, 884, 150);
        this.plant(g, 66, 470);

        // rug leading to the counter, so the eye goes where the feet do
        g.fillStyle(0x7a4a46, 0.42);
        g.fillEllipse(DESK_MARK.x, DESK_MARK.y + 40, 340, 130);

        // the counter
        g.fillStyle(C.desk, 1);
        g.fillRect(COUNTER.x - COUNTER.w / 2, COUNTER.y - 6, COUNTER.w, COUNTER.h);
        g.fillStyle(C.deskTop, 1);
        g.fillRect(COUNTER.x - COUNTER.w / 2 - 6, COUNTER.y - 16, COUNTER.w + 12, 12);
        g.fillStyle(C.monitor, 1);
        g.fillRect(COUNTER.x + 62, COUNTER.y - 44, 46, 30);
        g.fillStyle(0x2e4a46, 1);
        g.fillRect(COUNTER.x + 66, COUNTER.y - 40, 38, 22);
        g.fillStyle(0x9fd4c4, 0.13);
        g.fillEllipse(COUNTER.x + 84, COUNTER.y - 6, 110, 30);
        // the appointment book
        g.fillStyle(C.cream, 1);
        g.fillRect(COUNTER.x - 96, COUNTER.y - 12, 42, 26);
        g.fillStyle(0xc8873f, 1);
        g.fillRect(COUNTER.x - 96, COUNTER.y - 12, 42, 4);

        this.addSolid(COUNTER.x, COUNTER.y + 6, COUNTER.w + 12, 52);

        SIDE_DESKS.forEach((desk) => {
          g.fillStyle(C.desk, 1);
          g.fillRect(desk.x - 52, desk.y - 6, 104, 34);
          g.fillStyle(C.deskTop, 1);
          g.fillRect(desk.x - 52, desk.y - 14, 104, 10);
          g.fillStyle(C.monitor, 1);
          g.fillRect(desk.x - 26, desk.y - 48, 52, 34);
          g.fillStyle(0x2e4a46, 1);
          g.fillRect(desk.x - 22, desk.y - 44, 44, 26);
          g.fillStyle(0x9fd4c4, 0.13);
          g.fillEllipse(desk.x, desk.y - 4, 120, 34);
          this.addSolid(desk.x, desk.y + 2, 104, 46);
        });

        this.addSolid(W / 2, 60, W, 120);

        const vignette = this.add.graphics().setDepth(900);
        vignette.fillStyle(0x0a1614, 0.3);
        vignette.fillRect(0, 0, W, 26);
        vignette.fillRect(0, H - 26, W, 26);
        vignette.fillRect(0, 0, 26, H);
        vignette.fillRect(W - 26, 0, 26, H);
      }

      plant(g, x, y) {
        g.fillStyle(0x6b4a2f, 1);
        g.fillRect(x - 10, y + 8, 20, 14);
        g.fillStyle(0x3e6b4a, 1);
        g.fillRect(x - 14, y - 16, 28, 24);
        g.fillRect(x - 8, y - 24, 16, 10);
      }

      addSolid(x, y, w, h) {
        const solid = this.add.rectangle(x, y, w, h, 0, 0);
        this.physics.add.existing(solid, true);
        this.solids.push(solid);
      }

      buildBubble() {
        this.bubbleText = this.add
          .text(RECEPTIONIST.x, RECEPTIONIST.y - 96, "", {
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: "12px",
            color: "#F0E2C8",
            align: "center",
            wordWrap: { width: 300 },
          })
          .setOrigin(0.5, 1)
          .setDepth(801)
          .setResolution(3)
          .setVisible(false);

        this.bubbleBg = this.add
          .rectangle(RECEPTIONIST.x, RECEPTIONIST.y - 96, 10, 10, 0x070b0b, 0.9)
          .setOrigin(0.5, 1)
          .setStrokeStyle(1, 0xc8873f)
          .setDepth(800)
          .setVisible(false);
      }

      say(text) {
        if (!this.bubbleText) return;

        if (!text) {
          this.bubbleText.setVisible(false);
          this.bubbleBg.setVisible(false);
          return;
        }

        this.bubbleText.setText(text).setVisible(true);
        this.bubbleBg
          .setSize(this.bubbleText.width + 20, this.bubbleText.height + 16)
          .setPosition(RECEPTIONIST.x, this.bubbleText.y + 8)
          .setVisible(true);
      }

      walkTo(points) {
        const legs = points.slice();
        this.target = legs.shift() || null;
        this.path = legs;
      }

      bob(sprite) {
        this.tweens.add({
          targets: sprite,
          y: sprite.y - 2,
          duration: 900 + Math.random() * 500,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
          delay: Math.random() * 600,
        });
      }

      update() {
        const body = this.visitor.body;
        const speed = 190;
        let vx = 0;
        let vy = 0;

        // …and even uncaptured, the keys still read as held while someone types.
        // Nobody wants the sprite pacing the room because their name has a D in
        // it, so movement keys are off whenever a field has focus.
        const typing = isTyping();
        const k = typing ? null : this.keys;
        if (k) {
          if (k.A.isDown || k.LEFT.isDown) vx = -speed;
          if (k.D.isDown || k.RIGHT.isDown) vx = speed;
          if (k.W.isDown || k.UP.isDown) vy = -speed;
          if (k.S.isDown || k.DOWN.isDown) vy = speed;
        }

        if (vx || vy) {
          // keys win over a walk-to target the moment they are touched
          this.target = null;
          this.path = [];
          if (vx && vy) {
            vx *= 0.707;
            vy *= 0.707;
          }
        } else if (this.target) {
          const dx = this.target.x - this.visitor.x;
          const dy = this.target.y - this.visitor.y;
          const distance = Math.hypot(dx, dy);

          if (distance < 6) {
            this.target = this.path.shift() || null;
          } else {
            // already unit-scaled, so no diagonal correction needed
            vx = (dx / distance) * speed;
            vy = (dy / distance) * speed;
          }
        }

        body.setVelocity(vx, vy);
        if (vx < 0) this.visitor.setFlipX(true);
        if (vx > 0) this.visitor.setFlipX(false);
        this.visitor.setDepth(400 + this.visitor.y);

        const atDesk = Phaser.Math.Distance.Between(this.visitor.x, this.visitor.y, DESK_MARK.x, DESK_MARK.y) < ARRIVE_RADIUS;
        if (atDesk !== this.arrived) {
          this.arrived = atDesk;
          if (atDesk && options.onArrive) options.onArrive();
          if (!atDesk && options.onLeave) options.onLeave();
        }
      }
    };
  }

  window.MumblCalOffice = {
    boot: function boot(options) {
      const portrait = Boolean(options.portrait);
      const SceneClass = OfficeSceneFactory(options);

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: options.parent,
        width: portrait ? 520 : W,
        height: portrait ? 660 : H,
        pixelArt: true,
        roundPixels: true,
        backgroundColor: "#14312F",
        physics: { default: "arcade", arcade: { gravity: { y: 0 } } },
        // This canvas lives inside a page people have to scroll. Phaser's
        // defaults preventDefault touch and wheel events over it, which on a
        // phone traps the visitor above the booking form — the one thing they
        // came here to reach. Tap-to-move still works without the capture.
        input: {
          touch: { capture: false },
          mouse: { preventDefaultWheel: false, preventDefaultDown: false },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          parent: options.parent,
          width: portrait ? 520 : W,
          height: portrait ? 660 : H,
        },
        scene: [SceneClass],
      });

      // same reason as the demo: observe the stage box rather than trusting
      // window resize, and wait for boot or the scale manager has no canvas yet
      let observer = null;
      if (window.ResizeObserver) {
        game.events.once(Phaser.Core.Events.READY, function () {
          observer = new ResizeObserver(function () {
            if (game.isBooted) game.scale.refresh();
          });
          observer.observe(options.parent);
        });
      }

      return {
        say: function say(text) {
          const scene = game.scene.getScene("office");
          if (scene && scene.scene.isActive()) scene.say(text);
        },
        walkToDesk: function walkToDesk() {
          const scene = game.scene.getScene("office");
          if (scene && scene.scene.isActive()) scene.target = { x: DESK_MARK.x, y: DESK_MARK.y };
        },
        destroy: function destroy() {
          if (observer) observer.disconnect();
          game.destroy(true);
        },
      };
    },
  };
})();
