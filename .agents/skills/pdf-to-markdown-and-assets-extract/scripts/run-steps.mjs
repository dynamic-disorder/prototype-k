/**
 * The end-to-end steps, split from the CLI so they can be tested directly.
 *
 * Each step returns its own status and a per-fixture summary that lands in
 * `run.json`. A missing engine is a recorded skip; a failed engine or a count
 * that disagrees with `fixture-expectations.json` sets the status to 1.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { rasterise, toolLabel } from "./rasterise.mjs";
import { engineLabel, ocrImages, pageImagesIn } from "./ocr.mjs";
import { equationBoxes, figureBoxes, tableBoxes } from "../tests/embedded-pdf.mjs";
import { cropFigure } from "../tests/figures.mjs";

export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Local-time stamp: YYYY-MM-DD_HH-mm.sss, `-` instead of `:` for Windows. */
export function timestamp(now = new Date()) {
  const pad = (value, width = 2) => String(value).padStart(width, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}.${pad(now.getMilliseconds(), 3)}`
  );
}

/** Create the run folder, appending -1, -2… when the stamp already exists. */
export function createRunDir(root, now = new Date()) {
  const resultsDir = path.join(root, "test-results");
  mkdirSync(resultsDir, { recursive: true });

  const base = path.join(resultsDir, timestamp(now));
  let runDir = base;
  let suffix = 1;
  for (;;) {
    try {
      mkdirSync(runDir);
      return runDir;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      runDir = `${base}-${suffix}`;
      suffix += 1;
    }
  }
}

/** Read the test count from the reporter output, or null when absent. */
export function parseTestCount(output) {
  const match = /(?:ℹ|#)\s*tests\s+(\d+)/.exec(output) ?? /Ran (\d+) tests/.exec(output);
  return match ? Number(match[1]) : null;
}

/**
 * Find the render of one page in an assets folder.
 *
 * Renderers pad page numbers differently — `pdftoppm` writes `page-05.png`
 * where the Windows engine writes `page-5.png` — so match by number, never by
 * the literal file name.
 * @returns {string | null} absolute path, or null when no render exists
 */
export function findPageRender(assetsDir, pageNumber) {
  if (!existsSync(assetsDir)) return null;

  const exact = path.join(assetsDir, `page-${pageNumber}.png`);
  if (existsSync(exact)) return exact;

  const match = readdirSync(assetsDir)
    .filter((file) => /^page-\d+\.png$/i.test(file))
    .find((file) => Number(/(\d+)/.exec(file)?.[1] ?? -1) === pageNumber);

  return match ? path.join(assetsDir, match) : null;
}

/**
 * Crop every figure box from its page render.
 * @returns {{ cropped: object[], failures: { box: object, reason: string }[] }}
 */
export function cropFigures({ assetsDir, boxes }) {
  const cropped = [];
  const failures = [];

  boxes.forEach((box, index) => {
    const pageImage = findPageRender(assetsDir, box.page);
    if (!pageImage) {
      failures.push({ box, reason: `no render for page ${box.page}` });
      return;
    }

    const target = path.join(assetsDir, `figure-${index + 1}.png`);
    try {
      const written = cropFigure(pageImage, box, target);
      cropped.push({
        ...box,
        file: path.basename(target),
        width: written.width,
        height: written.height,
      });
    } catch (error) {
      failures.push({ box, reason: error.message });
    }
  });

  return { cropped, failures };
}

/** Check each written Markdown against the expected page count. */
export function verifyExtraction(runDir, fixtures) {
  let failed = 0;

  for (const [fixture, expected] of Object.entries(fixtures)) {
    const md = path.join(runDir, "extracted", fixture, `${fixture}.md`);
    if (!existsSync(md)) {
      console.error(`verify: missing ${md}`);
      failed = 1;
      continue;
    }

    const markers = (readFileSync(md, "utf8").match(/<!-- page: \d+ -->/g) ?? []).length;
    if (markers !== expected.pages) {
      console.error(`verify: ${fixture} has ${markers} page marker(s), expected ${expected.pages}`);
      failed = 1;
    } else {
      console.log(`verify: ${fixture} — ${markers} page marker(s) ok`);
    }
  }

  return failed;
}

/** Render each fixture's pages when a rasteriser is available. */
export function rasteriseFixtures(
  runDir,
  fixtures,
  { root = SKILL_ROOT, env = process.env, candidates } = {},
) {
  const raster = {};
  let rasterStatus = 0;

  for (const [fixture, expected] of Object.entries(fixtures)) {
    const assetsDir = path.join(runDir, "extracted", fixture, `${fixture}.assets`);
    try {
      const outcome = rasterise({
        pdf: path.join(root, "tests", "resources", `${fixture}.pdf`),
        outDir: assetsDir,
        env,
        candidates,
      });
      raster[fixture] = outcome.status;

      if (outcome.status !== "rendered") {
        console.log(`raster: ${fixture} — skipped (${outcome.reason})`);
        continue;
      }

      writeFileSync(
        path.join(assetsDir, "raster.json"),
        `${JSON.stringify({ fixture, ...outcome }, null, 2)}\n`,
        "utf8",
      );

      if (outcome.pages.length !== expected.pages) {
        console.error(
          `raster: ${fixture} rendered ${outcome.pages.length} page(s), expected ${expected.pages}`,
        );
        rasterStatus = 1;
        continue;
      }
      console.log(`raster: ${fixture} — ${outcome.pages.length} page(s) via ${toolLabel(outcome)}`);
    } catch (error) {
      raster[fixture] = `failed: ${error.message}`;
      rasterStatus = 1;
      console.error(`raster: ${fixture} failed — ${error.message}`);
    }
  }

  return { raster, rasterStatus };
}

/** Crop each page's vector figures out of its render, into the assets folder. */
export function cropFixtures(runDir, fixtures, raster, { root = SKILL_ROOT } = {}) {
  const summary = {};
  let figuresStatus = 0;

  for (const [fixture, expected] of Object.entries(fixtures)) {
    const assetsDir = path.join(runDir, "extracted", fixture, `${fixture}.assets`);

    if (raster[fixture] !== "rendered") {
      summary[fixture] = { status: "skipped", count: 0 };
      continue;
    }

    let boxes;
    try {
      boxes = figureBoxes(readFileSync(path.join(root, "tests", "resources", `${fixture}.pdf`)));
    } catch (error) {
      summary[fixture] = { status: "failed", count: 0 };
      figuresStatus = 1;
      console.error(`figures: ${fixture} boxes failed — ${error.message}`);
      continue;
    }

    const { cropped, failures } = cropFigures({ assetsDir, boxes });
    for (const failure of failures) {
      figuresStatus = 1;
      console.error(`figures: ${fixture} crop failed — ${failure.reason}`);
    }

    summary[fixture] = { status: "cropped", count: cropped.length };
    if (cropped.length > 0) {
      writeFileSync(
        path.join(assetsDir, "figures.json"),
        `${JSON.stringify({ fixture, figures: cropped }, null, 2)}\n`,
        "utf8",
      );
    }

    if (expected.figures !== undefined && cropped.length !== expected.figures) {
      console.error(`figures: ${fixture} cropped ${cropped.length}, expected ${expected.figures}`);
      figuresStatus = 1;
    }
    console.log(`figures: ${fixture} — ${cropped.length} cropped`);
  }

  return { figures: summary, figuresStatus };
}

/**
 * Crop every display equation out of its page render.
 *
 * The LaTeX is already in the Markdown; the crop is the evidence a reader can
 * check it against, so the two are written from the same list in the same order.
 * @returns {{ cropped: object[], failures: { box: object, reason: string }[] }}
 */
export function cropEquations({ assetsDir, boxes }) {
  const cropped = [];
  const failures = [];

  boxes.forEach((box, index) => {
    const pageImage = findPageRender(assetsDir, box.page);
    if (!pageImage) {
      failures.push({ box, reason: `no render for page ${box.page}` });
      return;
    }

    const target = path.join(assetsDir, `equation-${index + 1}.png`);
    try {
      const written = cropFigure(pageImage, box, target);
      cropped.push({
        number: index + 1,
        page: box.page,
        tag: box.tag,
        latex: box.latex,
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        file: path.basename(target),
        width: written.width,
        height: written.height,
      });
    } catch (error) {
      failures.push({ box, reason: error.message });
    }
  });

  return { cropped, failures };
}

/** Crop each page's display equations out of its render, into the assets folder. */
export function cropEquationFixtures(runDir, fixtures, raster, { root = SKILL_ROOT } = {}) {
  const summary = {};
  let equationsStatus = 0;

  for (const [fixture, expected] of Object.entries(fixtures)) {
    const assetsDir = path.join(runDir, "extracted", fixture, `${fixture}.assets`);

    if (raster[fixture] !== "rendered") {
      summary[fixture] = { status: "skipped", count: 0 };
      continue;
    }

    let boxes;
    try {
      boxes = equationBoxes(readFileSync(path.join(root, "tests", "resources", `${fixture}.pdf`)));
    } catch (error) {
      summary[fixture] = { status: "failed", count: 0 };
      equationsStatus = 1;
      console.error(`equations: ${fixture} boxes failed — ${error.message}`);
      continue;
    }

    const { cropped, failures } = cropEquations({ assetsDir, boxes });
    for (const failure of failures) {
      equationsStatus = 1;
      console.error(`equations: ${fixture} crop failed — ${failure.reason}`);
    }

    summary[fixture] = { status: "cropped", count: cropped.length };
    if (cropped.length > 0) {
      writeFileSync(
        path.join(assetsDir, "equations.json"),
        `${JSON.stringify({ fixture, equations: cropped }, null, 2)}\n`,
        "utf8",
      );
    }

    if (expected.equations !== undefined && cropped.length !== expected.equations) {
      console.error(
        `equations: ${fixture} cropped ${cropped.length}, expected ${expected.equations}`,
      );
      equationsStatus = 1;
    }
    console.log(`equations: ${fixture} — ${cropped.length} cropped`);
  }

  return { equations: summary, equationsStatus };
}

/**
 * Crop every table out of its page render.
 *
 * The facsimile in the Markdown is a reconstruction; the crop is the page it was
 * built from, so a reader can check a column the extraction could not prove.
 * @returns {{ cropped: object[], failures: { box: object, reason: string }[] }}
 */
export function cropTables({ assetsDir, boxes }) {
  const cropped = [];
  const failures = [];

  boxes.forEach((box, index) => {
    const pageImage = findPageRender(assetsDir, box.page);
    if (!pageImage) {
      failures.push({ box, reason: `no render for page ${box.page}` });
      return;
    }

    const target = path.join(assetsDir, `table-${index + 1}.png`);
    try {
      const written = cropFigure(pageImage, box, target);
      cropped.push({
        number: index + 1,
        page: box.page,
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        file: path.basename(target),
        width: written.width,
        height: written.height,
      });
    } catch (error) {
      failures.push({ box, reason: error.message });
    }
  });

  return { cropped, failures };
}

/** Crop each page's tables out of its render, into the assets folder. */
export function cropTableFixtures(runDir, fixtures, raster, { root = SKILL_ROOT } = {}) {
  const summary = {};
  let tablesStatus = 0;

  for (const [fixture, expected] of Object.entries(fixtures)) {
    const assetsDir = path.join(runDir, "extracted", fixture, `${fixture}.assets`);

    if (raster[fixture] !== "rendered") {
      summary[fixture] = { status: "skipped", count: 0 };
      continue;
    }

    let boxes;
    try {
      boxes = tableBoxes(readFileSync(path.join(root, "tests", "resources", `${fixture}.pdf`)));
    } catch (error) {
      summary[fixture] = { status: "failed", count: 0 };
      tablesStatus = 1;
      console.error(`tables: ${fixture} boxes failed — ${error.message}`);
      continue;
    }

    const { cropped, failures } = cropTables({ assetsDir, boxes });
    for (const failure of failures) {
      tablesStatus = 1;
      console.error(`tables: ${fixture} crop failed — ${failure.reason}`);
    }

    summary[fixture] = { status: "cropped", count: cropped.length };
    if (cropped.length > 0) {
      writeFileSync(
        path.join(assetsDir, "tables.json"),
        `${JSON.stringify({ fixture, tables: cropped }, null, 2)}\n`,
        "utf8",
      );
    }

    if (expected.tables !== undefined && cropped.length !== expected.tables) {
      console.error(`tables: ${fixture} cropped ${cropped.length}, expected ${expected.tables}`);
      tablesStatus = 1;
    }
    console.log(`tables: ${fixture} — ${cropped.length} cropped`);
  }

  return { tables: summary, tablesStatus };
}

/** Read rendered pages and cropped figures with an OCR engine when one is available. */export function ocrFixtures(runDir, fixtures, { env = process.env, candidates } = {}) {
  const ocr = {};
  let ocrStatus = 0;

  for (const fixture of Object.keys(fixtures)) {
    const assetsDir = path.join(runDir, "extracted", fixture, `${fixture}.assets`);
    const outDir = path.join(assetsDir, "ocr");
    // Equation crops are not read: their LaTeX is already the text, and OCR of a
    // formula is a guess the Markdown must not inherit.
    const images = [...pageImagesIn(assetsDir, "page"), ...pageImagesIn(assetsDir, "figure")];

    try {
      const outcome = ocrImages({ images, outDir, env, candidates });
      ocr[fixture] = outcome.status;

      if (outcome.status !== "extracted") {
        console.log(`ocr: ${fixture} — skipped (${outcome.reason})`);
        continue;
      }

      writeFileSync(
        path.join(outDir, "ocr.json"),
        `${JSON.stringify({ fixture, ...outcome }, null, 2)}\n`,
        "utf8",
      );

      const empty = outcome.pages.filter((page) => page.chars === 0);
      if (empty.length > 0) {
        console.error(`ocr: ${fixture} produced ${empty.length} empty page(s)`);
        ocrStatus = 1;
        continue;
      }
      console.log(`ocr: ${fixture} — ${outcome.pages.length} image(s) via ${engineLabel(outcome)}`);
    } catch (error) {
      ocr[fixture] = `failed: ${error.message}`;
      ocrStatus = 1;
      console.error(`ocr: ${fixture} failed — ${error.message}`);
    }
  }

  return { ocr, ocrStatus };
}

/** Run one command in the skill root, save its output, and echo it. */
export function runCommand(command, args, { root = SKILL_ROOT, runDir, logName }) {
  const started = new Date();
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  const output = (result.stdout ?? "") + (result.stderr ?? "");
  writeFileSync(path.join(runDir, logName), output, "utf8");
  process.stdout.write(output);
  return { status: result.status ?? 1, started };
}
