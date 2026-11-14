#!/usr/bin/env node
/**
 * Run the Node test suite, render and crop every fixture, read the images with
 * an OCR engine, write the extraction, verify it, and record `run.json`.
 *
 * Usage (from the skill folder):
 *     node scripts/run_tests.mjs
 *
 * The steps live in `run-steps.mjs` so they can be tested without this CLI.
 * Exits non-zero when either step or a verification fails.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { invokedDirectly } from "../lib/invoked.mjs";

import {
  SKILL_ROOT,
  createRunDir,
  cropEquationFixtures,
  cropTableFixtures,
  cropFixtures,
  ocrFixtures,
  parseTestCount,
  rasteriseFixtures,
  runCommand,
  verifyExtraction,
} from "./run-steps.mjs";

const TEST_FILES = [
  "tests/check_input.test.mjs",
  "tests/extraction.test.mjs",
  "tests/math.test.mjs",
  "tests/raster.test.mjs",
  "tests/ocr.test.mjs",
  "tests/figures.test.mjs",
  "tests/run-steps.test.mjs",
  "tests/png.test.mjs",
  "tests/layout.test.mjs",
];

function main() {
  const runDir = createRunDir(SKILL_ROOT);
  const fixtures = JSON.parse(
    readFileSync(path.join(SKILL_ROOT, "tests", "fixture-expectations.json"), "utf8"),
  ).fixtures;

  const unit = runCommand(process.execPath, ["--test", ...TEST_FILES], {
    runDir,
    logName: "unit.txt",
  });

  // Render and crop first: the extraction references the images it finds.
  const { raster, rasterStatus } = rasteriseFixtures(runDir, fixtures);
  const { figures, figuresStatus } = cropFixtures(runDir, fixtures, raster);
  const { equations, equationsStatus } = cropEquationFixtures(runDir, fixtures, raster);
  const { tables, tablesStatus } = cropTableFixtures(runDir, fixtures, raster);
  const { ocr, ocrStatus } = ocrFixtures(runDir, fixtures);

  let extractionStatus = 0;
  for (const fixture of Object.keys(fixtures)) {
    const extraction = runCommand(
      process.execPath,
      ["tests/write_fixture_extraction.mjs", path.join(runDir, "extracted", fixture), fixture],
      { runDir, logName: `extraction-${fixture}.txt` },
    );
    if (extraction.status !== 0) extractionStatus = extraction.status;
  }

  const verifyStatus = verifyExtraction(runDir, fixtures);
  const status =
    unit.status ||
    extractionStatus ||
    rasterStatus ||
    figuresStatus ||
    equationsStatus ||
    tablesStatus ||
    ocrStatus ||
    verifyStatus;

  writeFileSync(
    path.join(runDir, "run.json"),
    `${JSON.stringify(
      {
        kind: "pdf-unit",
        startedAt: unit.started.toISOString(),
        tests: parseTestCount(readFileSync(path.join(runDir, "unit.txt"), "utf8")),
        unitStatus: unit.status,
        extractionStatus,
        rasterStatus,
        figuresStatus,
        equationsStatus,
        tablesStatus,
        ocrStatus,
        verifyStatus,
        raster,
        figures,
        equations,
        tables,
        ocr,
        status,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`run: ${runDir}`);
  process.exit(status);
}

if (invokedDirectly(import.meta.url)) {
  main();
}
