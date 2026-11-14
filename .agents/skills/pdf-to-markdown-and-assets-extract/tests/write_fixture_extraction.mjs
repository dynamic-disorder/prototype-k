#!/usr/bin/env node
/**
 * Write a fixture's extraction to a directory for inspection.
 *
 * Usage (from the skill folder):
 *     node tests/write_fixture_extraction.mjs <output dir> [fixture name]
 *
 * The fixture name defaults to the embedded-image one; every other name must
 * exist as tests/resources/<name>.pdf. Node port of the Python writer.
 */
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { FIXTURE_NAME, resourcePath, writeExtraction } from "../lib/pdf-extract.mjs";

/**
 * @param {string[]} argv
 * @returns {number} exit code
 */
function main(argv) {
  if (argv.length < 1) {
    console.error("usage: write_fixture_extraction.mjs <output dir> [fixture name]");
    return 1;
  }

  const outDir = path.resolve(argv[0]);
  const name = argv[1] ?? FIXTURE_NAME;
  mkdirSync(outDir, { recursive: true });

  const { md, meta, summary, imagePath } = writeExtraction(
    readFileSync(resourcePath(name)),
    outDir,
    name,
  );
  for (const written of [md, meta, summary, imagePath].filter(Boolean)) {
    console.log(`wrote ${written}`);
  }
  return 0;
}

const argv = process.argv.slice(2);
process.exit(main(argv));
