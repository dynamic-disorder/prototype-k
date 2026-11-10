// Scripted screen capture for a demo video.
//
// Copy this file into the task folder next to `video.config.json`, replace the
// BEATS block, then run `node record.mjs`. Output: raw/raw.webm + timing.json.
//
// Every beat is absolute (seconds from the first painted frame); the script
// records scheduled vs actual so drift is visible, not guessed.
//
// The file stays self-contained on purpose: it is copied into task folders, so
// it imports nothing from `lib/`. Its planning helpers are exported so the unit
// suite can drive them with a fake browser.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Length: `--seconds` beats `targetSeconds`, which beats the 120 s default.
 * The 15-300 s range mirrors lib/plan.mjs, duplicated because this file cannot
 * import the shared validator.
 */
export function parseTargetSeconds(argv, config = {}) {
  const secondsIndex = argv.indexOf("--seconds");
  const rawSeconds = secondsIndex >= 0 ? argv[secondsIndex + 1] : undefined;
  const targetSeconds = rawSeconds === undefined ? config.targetSeconds ?? 120 : Number(rawSeconds);

  if (!(Number.isFinite(targetSeconds) && targetSeconds >= 15 && targetSeconds <= 300)) {
    throw new Error(
      `target length must be 15-300 s, got ${rawSeconds ?? config.targetSeconds ?? "(default)"}`,
    );
  }
  return targetSeconds;
}

// ---------------------------------------------------------------- BEATS ----
// Replace the body of `defaultScript` below. Keep the timestamps on the same
// grid as segments.json: a mark appears when its segment starts, and is cleared
// after that segment's last sentence has finished.
//
// await at(0.3, "home top", () => page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })));
// await at(7.0, "open detail", () => page.goto(config.baseUrl + "/detail", { waitUntil: "networkidle" }));
// const card = page.locator("article.result").first();
// await at(9.2, "scroll to card", () => scrollTo(card, 130));
// await at(12.0, "mark card", () => mark(card));
// await at(18.0, "clear card", () => unmark(card));
// ------------------------------------------------------------- END BEATS ----
export async function defaultScript() {}

/**
 * Record one take.
 *
 * @param {object} options
 * @param {object} options.config `video.config.json` contents
 * @param {number} options.targetSeconds length of the take
 * @param {string} [options.outDir] output folder; defaults to `config.outDir`
 * @param {object} [options.chromiumModule] Playwright's `chromium`, injectable for tests
 * @param {() => number} [options.now] clock, injectable for tests
 * @param {(script: object) => Promise<void>} [options.script] the BEATS block
 * @returns {Promise<{ timing: object[], t0Offset: number, targetSeconds: number, videoPath: string }>}
 */
export async function recordDemo({
  config,
  targetSeconds,
  outDir,
  chromiumModule = chromium,
  now = () => Date.now(),
  log = console.log,
  warn = console.warn,
  script = defaultScript,
}) {
  const out = path.resolve(outDir ?? config.outDir);
  const raw = path.join(out, "raw");
  fs.mkdirSync(raw, { recursive: true });

  const browser = await chromiumModule.launch();
  const pageStart = now();
  const timing = [];
  let context;
  let video;
  let t0 = pageStart;

  // Everything after launch sits inside the cleanup, so a failed navigation or
  // a throwing beat still closes the context and the browser.
  try {
    context = await browser.newContext({
      viewport: config.viewport,
      deviceScaleFactor: 1,
      acceptDownloads: true,
      recordVideo: { dir: raw, size: config.viewport },
    });

    const page = await context.newPage();
    await page.goto(config.baseUrl, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(config.settleMs ?? 600);
    t0 = now();
    log(`t0 offset: ${((t0 - pageStart) / 1000).toFixed(2)} s (trimmed by compose.mjs)`);

    async function at(sec, label, fn) {
      const target = t0 + sec * 1000;
      const current = now();
      if (target > current) await page.waitForTimeout(target - current);
      const actual = (now() - t0) / 1000;
      if (Math.abs(actual - sec) > 0.05) {
        warn(`  drift ${label}: actual ${actual.toFixed(3)} vs ${sec.toFixed(3)}`);
      }
      timing.push({ scheduled: sec, actual, label });
      log(`[${sec.toFixed(1)} -> ${actual.toFixed(2)}] ${label}`);
      await fn();
    }

    // Highlight without touching the app's own styles; restore on unmark.
    async function mark(locator, color = "#b45309") {
      const element = locator.first();
      await element.evaluate((node, c) => {
        node.dataset.markOutline = node.style.outline;
        node.dataset.markShadow = node.style.boxShadow;
        node.dataset.markOffset = node.style.outlineOffset;
        node.style.outline = `3px solid ${c}`;
        node.style.outlineOffset = "4px";
        node.style.boxShadow = "0 0 0 7px rgba(180,83,9,.10)";
      }, color);
    }

    async function unmark(locator) {
      await locator.first().evaluate((node) => {
        node.style.outline = node.dataset.markOutline || "";
        node.style.boxShadow = node.dataset.markShadow || "";
        node.style.outlineOffset = node.dataset.markOffset || "";
      });
    }

    async function scrollTo(locator, offset = 120, smooth = true) {
      await locator.first().evaluate(
        (element, [off, behaviour]) => {
          const y = element.getBoundingClientRect().top + window.scrollY - off;
          window.scrollTo({ top: y, behavior: behaviour ? "smooth" : "instant" });
        },
        [offset, smooth],
      );
    }

    // Pause instead of moving a synthetic cursor: highlights carry attention.
    async function pause(ms = 350) {
      await page.waitForTimeout(ms);
    }

    await script({ at, mark, unmark, scrollTo, pause, page, config, log, warn });
    await at(targetSeconds, "hold end", async () => {});
    await page.waitForTimeout(600);
    video = page.video();
  } finally {
    if (context) await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  if (!video) {
    throw new Error("no video stream: recordVideo was not configured");
  }

  const videoPath = path.join(out, "raw.webm");
  fs.copyFileSync(await video.path(), videoPath);
  const t0Offset = (t0 - pageStart) / 1000;
  fs.writeFileSync(
    path.join(out, "timing.json"),
    JSON.stringify({ t0Offset, targetSeconds, timing }, null, 2),
  );

  return { timing, t0Offset, targetSeconds, videoPath };
}

async function main() {
  const config = JSON.parse(fs.readFileSync("video.config.json", "utf8"));
  const targetSeconds = parseTargetSeconds(process.argv, config);
  const result = await recordDemo({ config, targetSeconds });
  console.log(`saved ${result.videoPath} (${result.timing.length} beats)`);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  await main();
}
