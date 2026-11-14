#!/usr/bin/env node
/**
 * Extract one PDF, or a folder of them, to page-marked Markdown.
 *
 *     node scripts/extract-pdf.mjs <pdf or folder> [output dir] [options]
 *
 * Options:
 *     --name <basename>      document name; defaults to the PDF's file name.
 *                            It also becomes the folder and file prefix, made
 *                            portable (see lib/folder-name.mjs)
 *     --dpi <n>              page render resolution, default 150
 *     --no-raster            skip page renders, and the figure, equation and
 *                            table crops that need them
 *     --move-source          after a successful extraction, move the source PDF
 *                            and its prefix-matched non-PDF companions into the
 *                            document's folder. Ask the user before using it
 *     --table-format <f>     ascii (default), csv or pipe
 *
 * Each document gets a folder of its own beside the PDF, named after the
 * portable document name: `docs/phonebot-2610.08737v1/` holding
 * `phonebot-2610.08737v1.md`, its sidecar, its summary and its `.assets/`.
 * Passing the optional output directory overrides that layout and writes
 * every document straight into the one folder. A render is optional: with no
 * renderer the run records the skip and still writes the text. A renderer that
 * fails, or that renders a page count other than the document's, is an error
 * rather than a skip.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { folderNameFor } from "../lib/folder-name.mjs";
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
  "[--no-raster] [--move-source] [--table-format ascii|csv|pipe]";

const TABLE_FORMATS = ["ascii", "csv", "pipe"];

/**
 * @param {string[]} argv arguments after the script name
 * @returns {{ input: string, out: string | null, name: string | null, dpi: number,
 *   raster: boolean, tableFormat: string }}
 */
export function parseArgs(argv) {
  const options = {
    input: null,
    out: null,
    name: null,
    dpi: 150,
    raster: true,
    moveSource: false,
    tableFormat: "ascii",
  };

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
    else if (arg === "--move-source") options.moveSource = true;
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

/**
 * The one name a document's folder and every file in it carry.
 *
 * A caller-supplied `--name` is the id; otherwise the PDF's basename is. It is
 * made portable so the same tree survives on Windows, Linux and macOS.
 *
 * @param {string} pdf
 * @param {string | null} [requested]
 * @returns {string}
 */
export function documentName(pdf, requested = null) {
  return folderNameFor(requested ?? path.basename(pdf, path.extname(pdf)));
}

/**
 * Sibling files that belong to one PDF, in a stable order.
 *
 * A companion is a regular file in the PDF's own folder whose name starts with
 * the PDF's stem and continues with a non-alphanumeric character, so
 * `paper - abstract.txt` and `paper.notes.md` belong to `paper.pdf` while
 * `paper2.txt` and `paper-v2.pdf` do not. Another PDF is never a companion:
 * it is a document in its own right, and swallowing it would leave the next
 * extraction with no input.
 *
 * @param {string} pdf
 * @returns {string[]} absolute or input-relative companion paths
 */
export function companionFiles(pdf) {
  const folder = path.dirname(pdf);
  const base = path.basename(pdf);
  const stem = path.basename(pdf, path.extname(pdf));
  if (stem === "") return [];

  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => {
      if (name === base) return false;
      if (path.extname(name).toLowerCase() === ".pdf") return false;
      if (!name.startsWith(stem)) return false;
      const rest = name.slice(stem.length);
      return rest.length > 0 && !/[A-Za-z0-9]/.test(rest[0]);
    })
    .sort()
    .map((name) => path.join(folder, name));
}

/**
 * Move a source PDF and its companions into the document's folder.
 *
 * The extraction has already finished when this runs, so a failed move never
 * costs the Markdown. Every destination is checked before anything moves, so
 * an existing file is refused rather than overwritten; a cross-device move
 * (Windows drive letters, a mounted volume) falls back to copy and delete. The
 * companions move first and the PDF last, so a failure leaves the input that
 * the next run needs.
 *
 * @param {string} pdf
 * @param {string} outDir
 * @returns {string[]} the file names moved
 */
export function moveSourceFiles(pdf, outDir) {
  const destinationDir = path.resolve(outDir);
  const files = [pdf, ...companionFiles(pdf)].filter(
    (file) => path.resolve(path.dirname(file)) !== destinationDir,
  );
  if (files.length === 0) return [];

  for (const file of files) {
    if (existsSync(path.join(outDir, path.basename(file)))) {
      throw new Error(
        `refusing to overwrite ${path.basename(file)} in ${outDir}; move it aside and rerun`,
      );
    }
  }

  const ordered = [...files.filter((file) => file !== pdf), pdf];
  const moved = [];
  for (const file of ordered) {
    const destination = path.join(outDir, path.basename(file));
    try {
      renameSync(file, destination);
    } catch (error) {
      if (error.code !== "EXDEV") throw error;
      copyFileSync(file, destination);
      rmSync(file);
    }
    moved.push(path.basename(file));
  }
  return moved;
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
 *   tables: number, raster: object | null, moved: string[] }}
 */
export function extractOne(
  pdf,
  { out, name, dpi = 150, raster = true, moveSource = false, tableFormat = "ascii" } = {},
) {
  const docName = documentName(pdf, name);
  // One folder per document; an explicit output directory overrides the layout.
  const outDir = out ?? path.join(path.dirname(pdf), docName);
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

  // The move runs last: the Markdown is safe even when it fails, and the PDF
  // stays where a failed run can find it again.
  const moved = moveSource ? moveSourceFiles(pdf, outDir) : [];

  return { name: docName, pages: pageCount, ...counts, raster: outcome, moved };
}

/** One line per document: what it holds and whether the pages were rendered. */
function report(result, dpi) {
  const raster = result.raster
    ? result.raster.status === "rendered"
      ? `${result.raster.pages.length} page(s) via ${toolLabel(result.raster)} at ${dpi} dpi`
      : `skipped (${result.raster.reason})`
    : "skipped (--no-raster)";
  const source =
    result.moved.length > 0 ? `, source: ${result.moved.length} file(s) moved in` : "";
  return (
    `${result.name}: ${result.pages} page(s), ${result.figures} figure(s), ` +
    `${result.equations} equation(s), ${result.tables} table(s), raster: ${raster}${source}`
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

  // A folder run writes one folder per document. Two names that differ only in
  // case or punctuation would share it, and the second would overwrite the
  // first, so refuse before anything is written.
  if (options.out === null && pdfs.length > 1) {
    const claimed = new Map();
    for (const pdf of pdfs) {
      const name = documentName(pdf);
      const first = claimed.get(name);
      if (first !== undefined) {
        console.error(
          `ERROR: "${path.basename(first)}" and "${path.basename(pdf)}" both map to ` +
            `the folder "${name}"; rename one or extract them one at a time.`,
        );
        return 1;
      }
      claimed.set(name, pdf);
    }
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
        moveSource: options.moveSource,
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
