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
const URL = "http://127.0.0.1:3000/office/demo";

const FORCE_HEADLESS = process.argv.includes("--headless");
const CANVAS_TIMEOUT = 18000; // ms to wait for Phaser canvas to appear
const RENDER_SETTLE = 3500;   // ms after canvas appears to let WebGL render

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

  // Give the WebGL scene extra time to draw set-pieces
  await page.waitForTimeout(RENDER_SETTLE);
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
