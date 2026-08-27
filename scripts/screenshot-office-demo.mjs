/**
 * Capture the live /office/demo walkable Phaser scene in a real browser.
 *
 * Usage:
 *   node scripts/screenshot-office-demo.mjs
 *
 * Requires:
 *   npm run dev (or npm start) running at 127.0.0.1:3000
 *   npx playwright install chromium  (one-time)
 *
 * Strategy:
 *   1. Try headed Chromium — works on macOS with a display (no GPU flags needed).
 *   2. If headed fails or --headless flag passed, try headless with SwiftShader WebGL.
 *   3. Wait for Phaser canvas to mount + a stable non-loading state.
 *   4. Screenshot the canvas element, fall back to full viewport if needed.
 *   5. Save to outputs/office-screens/live-demo-office.png
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "outputs", "office-screens");
const OUT_PATH = join(OUT_DIR, "live-demo-office.png");
// The room is a 1440×960 world behind a 960×600 camera that follows the
// player, so no single walk-around shot can show that the meeting room, café,
// lounge and rec room are all populated at once. This one pulls the camera
// back over the whole floor.
const WIDE_PATH = join(OUT_DIR, "office-life-demo.png");
const URL = "http://127.0.0.1:3000/office/demo";

const FORCE_HEADLESS = process.argv.includes("--headless");
const CANVAS_TIMEOUT = 18000; // ms to wait for Phaser canvas to appear
const RENDER_SETTLE = 6500;   // ms after canvas appears: actors walk in (~1.6s
                              // each) + station props paint, so give them time
                              // to sit at their booths before the shot.

const SWIFTSHADER_FLAGS = [
  "--use-gl=angle",
  "--use-angle=swiftshader-webgl",
  "--enable-unsafe-swiftshader",
  "--disable-gpu-sandbox",
  "--no-sandbox",
  "--disable-setuid-sandbox",
];

async function waitForCanvasAndRender(page, timeoutMs) {
  // Wait for canvas element to appear in the DOM
  await page.waitForSelector(".office-stage canvas", { timeout: timeoutMs });

  // Wait for the "opening the office…" loading text to disappear
  // (means Phaser has initialized and is running)
  try {
    await page.waitForFunction(
      () => !document.querySelector(".office-stage-loading"),
      { timeout: 8000 }
    );
  } catch {
    // Loading text may persist; proceed anyway — canvas may still have rendered
    console.log("  ⚠  loading text still present — proceeding anyway");
  }

  // Let the actors walk in and take their booths.
  await page.waitForTimeout(RENDER_SETTLE);

  // Walk the player UP into the booth cluster so the camera pans off reception
  // and frames the scattered work booths (the whole point of the shot). The
  // canvas is aria-hidden, so drive it via held ArrowUp keydowns on the body.
  try {
    const canvas = await page.$(".office-stage canvas");
    if (canvas) {
      await canvas.click({ position: { x: 480, y: 40 } }).catch(() => {});
    }
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(1400);
    await page.keyboard.up("ArrowUp");
    await page.waitForTimeout(1200); // let the camera settle + bob animations run
  } catch {
    // panning is best-effort; the booths are visible from reception anyway
  }
}

async function capture(headless) {
  const launchOpts = headless
    ? { headless: true, args: SWIFTSHADER_FLAGS }
    : { headless: false, args: ["--no-sandbox", "--start-maximized"] };

  console.log(`\nLaunching Chromium (headless=${headless})…`);
  const browser = await chromium.launch(launchOpts);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // Capture console errors so we can report them
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`PAGE ERROR: ${err.message}`));

  try {
    console.log(`  Loading ${URL} …`);
    await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });

    console.log("  Waiting for Phaser canvas…");
    await waitForCanvasAndRender(page, CANVAS_TIMEOUT);

    // Check canvas dimensions (WebGL renders into it)
    const canvasInfo = await page.evaluate(() => {
      const c = document.querySelector(".office-stage canvas");
      if (!c) return null;
      return { width: c.width, height: c.height, clientWidth: c.clientWidth, clientHeight: c.clientHeight };
    });
    console.log("  Canvas info:", canvasInfo);

    // Screenshot the canvas element specifically
    mkdirSync(OUT_DIR, { recursive: true });
    const canvasEl = await page.$(".office-stage canvas");
    if (canvasEl) {
      await canvasEl.screenshot({ path: OUT_PATH });
      console.log(`  ✓ Canvas screenshot → ${OUT_PATH}`);

      // Whole-floor shot: stop the camera following the player and zoom out far
      // enough that all four social set-pieces and all nine work vignettes are
      // in frame together. Uses the debug handle exposed by office-scene.js.
      try {
        const wide = await page.evaluate(() => {
          if (!window.MumblOffice || !window.MumblOffice.__room) return null;
          const room = window.MumblOffice.__room();
          if (!room) return null;
          const cam = room.cameras.main;
          cam.stopFollow(); cam.setZoom(0.62); cam.centerOn(720, 470);
          const social = {};
          for (const [k, st] of room.social) social[k] = st.occupants.filter(Boolean).map((o) => o.name);
          return { social, atBooth: room.agents.filter((a) => !a.spot).length };
        });
        if (wide) {
          await page.waitForTimeout(1800);
          await canvasEl.screenshot({ path: WIDE_PATH });
          console.log(`  ✓ Whole-floor screenshot → ${WIDE_PATH}`);
          console.log("    social set-pieces:", JSON.stringify(wide.social));
          console.log("    actors at their own booth:", wide.atBooth);
          await page.evaluate(() => {
            const room = window.MumblOffice.__room();
            const cam = room.cameras.main;
            cam.setZoom(1); cam.startFollow(room.player, true, 0.09, 0.09, 0, 120);
          });
          await page.waitForTimeout(600);
        } else {
          console.log("  ⚠  no __room handle — skipping the whole-floor shot");
        }
      } catch (e) {
        console.log("  ⚠  whole-floor shot failed:", e.message);
      }

      // Second shot: pan LEFT + DOWN to frame the front-row vignettes
      // (browsing perch / corkboard wall / zen corner) and prove the scene is
      // actually walkable, not a single static frame.
      try {
        await page.keyboard.down("ArrowDown");
        await page.waitForTimeout(700);
        await page.keyboard.up("ArrowDown");
        await page.keyboard.down("ArrowLeft");
        await page.waitForTimeout(900);
        await page.keyboard.up("ArrowLeft");
        await page.waitForTimeout(900);
        const stationsPath = OUT_PATH.replace(/\.png$/, "-stations.png");
        await canvasEl.screenshot({ path: stationsPath });
        console.log(`  ✓ Walkable pan screenshot → ${stationsPath}`);
      } catch {
        console.log("  ⚠  second pan shot skipped");
      }
    } else {
      // Fallback: full-page screenshot
      await page.screenshot({ path: OUT_PATH, fullPage: false });
      console.log(`  ⚠  Canvas not found — full viewport screenshot → ${OUT_PATH}`);
    }

    if (consoleErrors.length) {
      console.log(`  ⚠  ${consoleErrors.length} console error(s):`);
      consoleErrors.forEach((e) => console.log(`     ${e}`));
    } else {
      console.log("  ✓ 0 console errors");
    }

    await browser.close();
    return { ok: true, consoleErrors };
  } catch (err) {
    await browser.close();
    return { ok: false, error: err.message, consoleErrors };
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  // Try headed first (works on macOS with display), unless --headless forced
  if (!FORCE_HEADLESS) {
    const result = await capture(false);
    if (result.ok) {
      console.log("\n✓ Done. Screenshot saved to:", OUT_PATH);
      if (result.consoleErrors.length) {
        console.log("  Console errors during capture:", result.consoleErrors);
      }
      return;
    }
    console.log("  Headed failed:", result.error);
    console.log("  Falling back to headless + SwiftShader…");
  }

  // Headless with SwiftShader
  const result = await capture(true);
  if (result.ok) {
    console.log("\n✓ Done. Screenshot saved to:", OUT_PATH);
  } else {
    console.error("\n✗ Both headed and headless capture failed.");
    console.error("  Error:", result.error);
    console.error("\n  Manual steps to see the office:");
    console.error("  1. npm run dev");
    console.error("  2. Open http://127.0.0.1:3000/office/demo in your browser");
    console.error("  3. Wait ~3s for the Phaser canvas to load");
    console.error("  4. Use WASD to walk; walk up to a desk and press E to open the panel");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
