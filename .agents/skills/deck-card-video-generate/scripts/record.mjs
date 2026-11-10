// Scripted screen capture for a demo video.
//
// Copy this file into the task folder next to `video.config.json`, replace the
// BEATS block, then run `node record.mjs`. Output: raw/raw.webm + timing.json.
//
// Every beat is absolute (seconds from the first painted frame); the script
// records scheduled vs actual so drift is visible, not guessed.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const cfg = JSON.parse(fs.readFileSync("video.config.json", "utf8"));
const OUT = path.resolve(cfg.outDir);
const RAW = path.join(OUT, "raw");
fs.mkdirSync(RAW, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: cfg.viewport,
  deviceScaleFactor: 1,
  acceptDownloads: true,
  recordVideo: { dir: RAW, size: cfg.viewport },
});

const pageStart = Date.now();
const page = await context.newPage();
await page.goto(cfg.baseUrl, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(cfg.settleMs ?? 600);
const t0 = Date.now();
console.log(`t0 offset: ${((t0 - pageStart) / 1000).toFixed(2)} s (trimmed by compose.mjs)`);

const timing = [];

async function at(sec, label, fn) {
  const target = t0 + sec * 1000;
  const now = Date.now();
  if (target > now) await page.waitForTimeout(target - now);
  const actual = (Date.now() - t0) / 1000;
  if (Math.abs(actual - sec) > 0.05) {
    console.warn(`  drift ${label}: actual ${actual.toFixed(3)} vs ${sec.toFixed(3)}`);
  }
  timing.push({ scheduled: sec, actual, label });
  console.log(`[${sec.toFixed(1)} -> ${actual.toFixed(2)}] ${label}`);
  await fn();
}

// Highlight without touching the app's own styles; restore on unmark.
async function mark(locator, color = "#b45309") {
  const el = locator.first();
  await el.evaluate((node, c) => {
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
  await locator.first().evaluate((el, [off, sm]) => {
    const y = el.getBoundingClientRect().top + window.scrollY - off;
    window.scrollTo({ top: y, behavior: sm ? "smooth" : "instant" });
  }, [offset, smooth]);
}

// Pause instead of moving a synthetic cursor: highlights carry attention.
async function pause(ms = 350) {
  await page.waitForTimeout(ms);
}

// ---------------------------------------------------------------- BEATS ----
// Replace everything between BEATS markers. Keep the timestamps on the same
// grid as segments.json: a mark appears when its segment starts, and is
// cleared after that segment's last sentence has finished.
//
// await at(0.3, "home top", () => page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })));
// await at(7.0, "open detail", () => page.goto(cfg.baseUrl + "/detail", { waitUntil: "networkidle" }));
// const card = page.locator("article.result").first();
// await at(9.2, "scroll to card", () => scrollTo(card, 130));
// await at(12.0, "mark card", () => mark(card));
// await at(18.0, "clear card", () => unmark(card));
// ------------------------------------------------------------- END BEATS ----

await at(cfg.targetSeconds, "hold end", async () => {});
await page.waitForTimeout(600);

const video = page.video();
await context.close();
await browser.close();

if (!video) {
  throw new Error("no video stream: recordVideo was not configured");
}
fs.copyFileSync(await video.path(), path.join(OUT, "raw.webm"));
fs.writeFileSync(
  path.join(OUT, "timing.json"),
  JSON.stringify({ t0Offset: (t0 - pageStart) / 1000, timing }, null, 2),
);
console.log(`saved ${path.join(OUT, "raw.webm")} (${timing.length} beats)`);
