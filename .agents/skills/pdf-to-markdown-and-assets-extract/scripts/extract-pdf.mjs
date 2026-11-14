#!/usr/bin/env node
/**
 * Extract one PDF, or a folder of them, to page-marked Markdown.
 *
 *     node scripts/extract-pdf.mjs <pdf or folder> [output dir] [options]
 *
 * Options:
 *     --name <basename>      document name; defaults to the PDF's file name
 *     --dpi <n>              page render resolution, default 150
 *     --no-raster            skip page renders, and the figure, equation and
 *                            table crops that need them
 *     --table-format <f>     ascii (default), csv or pipe
 *
 * The output folder defaults to `extracted/` beside the PDF. A render is
 * optional: with no renderer the run records the skip and still writes the
 * text. A renderer that fails, or that renders a page count other than the
 * document's, is an error rather than a skip.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { invokedDirectly } from "../lib/invoked.mjs";
import {
  equationBoxes,
  figureBoxes,
  listPages,
  tableBoxes,
  writeExtraction,
} from "../lib/pdf-extract.mjs";
import { rasterise, toolLabel } from "./rasterise.mjs";
import { cropEquations, cropFigures, cropTables } from "./run-steps.mjs";

const USAGE =
  "usage: extract-pdf.mjs <pdf or folder> [output dir] [--name <basename>] [--dpi <n>] " +
  "[--no-raster] [--table-format ascii|csv|pipe]";

const TABLE_FORMATS = ["ascii", "csv", "pipe"];

/**
 * @param {string[]} argv arguments after the script name
 * @returns {{ input: string, out: string | null, name: string | null, dpi: number,
 *   raster: boolean, tableFormat: string }}
 */
export function parseArgs(argv) {
  const options = { input: null, out: null, name: null, dpi: 150, raster: true, tableFormat: "ascii" };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} needs a value`);
      return argv[index];
    };

    if (arg === "--name") options.name = value();
    else if (arg === "--dpi") options.dpi = Number(value());
    else if (arg === "--no-raster") options.raster = false;
    else if (arg === "--table-format") options.tableFormat = value();
    else if (arg.startsWith("--")) throw new Error(`unknown option: ${arg}`);
    else if (options.input === null) options.input = arg;
    else if (options.out === null) options.out = arg;
    else throw new Error(`unexpected argument: ${arg}`);
  }

  if (!options.input) throw new Error("no input path");
  if (!TABLE_FORMATS.includes(options.tableFormat)) {
    throw new Error(`unknown table format: ${options.tableFormat}`);
  }
  if (!Number.isFinite(options.dpi) || options.dpi <= 0) throw new Error(`invalid dpi: ${options.dpi}`);
  return options;
}

/**
 * Every PDF under a folder, in path order, or the file itself.
 * @param {string} input
 * @returns {string[]}
 */
export function findPdfs(input) {
  if (statSync(input).isFile()) {
    return path.extname(input).toLowerCase() === ".pdf" ? [input] : [];
  }

  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && path.extname(child).toLowerCase() === ".pdf") found.push(child);
    }
  };
  walk(input);
  return found.sort();
}

/** Write one document's manifest beside its assets. */
function writeManifest(assetsDir, label, name, entries) {
  writeFileSync(
    path.join(assetsDir, `${label}.json`),
    `${JSON.stringify({ name, [label]: entries }, null, 2)}\n`,
  );
}

/**
 * Render, crop and write one document.
 * @returns {{ name: string, pages: number, figures: number, equations: number,
 *   tables: number, raster: object | null }}
 */
export function extractOne(pdf, { out, name, dpi = 150, raster = true, tableFormat = "ascii" } = {}) {
  const docName = name ?? path.basename(pdf, path.extname(pdf));
  const outDir = out ?? path.join(path.dirname(pdf), "extracted");
  mkdirSync(outDir, { recursive: true });

  const data = readFileSync(pdf);
  const pageCount = listPages(data).length;
  const assetsDir = path.join(outDir, `${docName}.assets`);

  let outcome = null;
  if (raster) {
    mkdirSync(assetsDir, { recursive: true });
    outcome = rasterise({ pdf, outDir: assetsDir, dpi });
    writeFileSync(
      path.join(assetsDir, "raster.json"),
      `${JSON.stringify(
        {
          name: docName,
          ...outcome,
          // Names, not paths: the manifest is committed with the document.
          pages: outcome.pages.map((page) => path.basename(page)),
        },
        null,
        2,
      )}\n`,
    );
    if (outcome.status === "rendered" && outcome.pages.length !== pageCount) {
      throw new Error(`rendered ${outcome.pages.length} page(s) for a ${pageCount}-page document`);
    }
  }

  const counts = { figures: 0, equations: 0, tables: 0 };
  if (outcome?.status === "rendered") {
    const jobs = [
      { label: "figures", boxes: figureBoxes(data), crop: cropFigures },
      { label: "equations", boxes: equationBoxes(data), crop: cropEquations },
      { label: "tables", boxes: tableBoxes(data), crop: cropTables },
    ];

    for (const job of jobs) {
      const { cropped, failures } = job.crop({ assetsDir, boxes: job.boxes });
      if (failures.length > 0) throw new Error(`${job.label}: ${failures[0].reason}`);
      if (cropped.length > 0) writeManifest(assetsDir, job.label, docName, cropped);
      counts[job.label] = cropped.length;
    }
  }

  const previousFormat = process.env.PDF_TABLE_FORMAT;
  process.env.PDF_TABLE_FORMAT = tableFormat;
  try {
    writeExtraction(data, outDir, docName);
  } finally {
    if (previousFormat === undefined) delete process.env.PDF_TABLE_FORMAT;
    else process.env.PDF_TABLE_FORMAT = previousFormat;
  }

  return { name: docName, pages: pageCount, ...counts, raster: outcome };
}

/** One line per document: what it holds and whether the pages were rendered. */
function report(result, dpi) {
  const raster = result.raster
    ? result.raster.status === "rendered"
      ? `${result.raster.pages.length} page(s) via ${toolLabel(result.raster)} at ${dpi} dpi`
      : `skipped (${result.raster.reason})`
    : "skipped (--no-raster)";
  return (
    `${result.name}: ${result.pages} page(s), ${result.figures} figure(s), ` +
    `${result.equations} equation(s), ${result.tables} table(s), raster: ${raster}`
  );
}

/**
 * @param {string[]} argv arguments after the script name
 * @returns {number} exit code
 */
export function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return 0;
  }

  let options;
  let pdfs;
  try {
    options = parseArgs(argv);
    if (!existsSync(options.input)) throw new Error(`no such path: ${options.input}`);
    pdfs = findPdfs(options.input);
  } catch (error) {
    console.error(`ERROR: ${error.message}; extraction not started.`);
    return 2;
  }

  if (pdfs.length === 0) {
    console.error("ERROR: the path names no PDF; extraction not started.");
    return 1;
  }

  let status = 0;
  for (const pdf of pdfs) {
    // One document keeps the caller's name; a folder names each one after itself.
    const name = pdfs.length === 1 ? options.name : null;
    try {
      const result = extractOne(pdf, {
        out: options.out,
        name,
        dpi: options.dpi,
        raster: options.raster,
        tableFormat: options.tableFormat,
      });
      console.log(report(result, options.dpi));
    } catch (error) {
      console.error(`${path.basename(pdf)}: ${error.message}`);
      status = 1;
    }
  }

  return status;
}

if (invokedDirectly(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
