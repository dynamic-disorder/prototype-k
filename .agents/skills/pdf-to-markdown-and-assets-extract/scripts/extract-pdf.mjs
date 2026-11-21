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
 *     --no-reuse-raster      re-render every page even when an existing
 *                            raster.json names the same source hash and dpi
 *     --with-accessibility-assets
 *                            write <name>-accessibility.md with page headings,
 *                            inline captioned assets and descriptive file
 *                            names; this is the default
 *     --no-accessibility-assets
 *                            write only the default Markdown and assets
 *     --move-source          after a successful extraction, move the source PDF
 *                            and its prefix-matched non-PDF companions into the
 *                            document's folder. Ask the user before using it
 *     --table-format <f>     ascii (default), csv or pipe
 *     --drop-relative-urls            remove a line that is only a web address (and a
 *                            bare `URL:` label above it), recording the count;
 *                            off by default because it changes the text
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
import { createHash } from "node:crypto";
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

import { writeAccessibilityAssets } from "../lib/accessibility-assets.mjs";
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
  "[--no-raster] [--no-reuse-raster] [--with-accessibility-assets] " +
  "[--no-accessibility-assets] [--move-source] " +
  "[--drop-relative-urls] [--table-format ascii|csv|pipe]";

const TABLE_FORMATS = ["ascii", "csv", "pipe"];

/**
 * @param {string[]} argv arguments after the script name
 * @returns {{ input: string, out: string | null, name: string | null, dpi: number,
 *   raster: boolean, reuseRaster: boolean, accessibilityAssets: boolean,
 *   moveSource: boolean, dropRelativeUrls: boolean, tableFormat: string }}
 */
export function parseArgs(argv) {
  const options = {
    input: null,
    out: null,
    name: null,
    dpi: 150,
    raster: true,
    reuseRaster: true,
    accessibilityAssets: true,
    moveSource: false,
    dropRelativeUrls: false,
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
    else if (arg === "--no-reuse-raster") options.reuseRaster = false;
    else if (arg === "--with-accessibility-assets") options.accessibilityAssets = true;
    else if (arg === "--no-accessibility-assets") options.accessibilityAssets = false;
    else if (arg === "--move-source") options.moveSource = true;
    else if (arg === "--drop-relative-urls") options.dropRelativeUrls = true;
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
 * An existing complete render for the same source and dpi.
 *
 * Re-rendering every page is the expensive part of a refresh; a 431-page
 * document paid it twice in one session. The manifest names the source hash,
 * the dpi and every page file, so reuse is proved rather than assumed. A
 * missing file or a different hash/dpi returns null and the caller renders.
 *
 * @param {string} assetsDir
 * @param {{ sourceHash: string, dpi: number, pageCount: number }} expected
 * @returns {object | null}
 */
export function findReusableRaster(assetsDir, { sourceHash, dpi, pageCount }) {
  const manifestPath = path.join(assetsDir, "raster.json");
  if (!existsSync(manifestPath)) return null;

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return null;
  }
  if (manifest.sourceHash !== sourceHash) return null;
  if (Number(manifest.dpi) !== Number(dpi)) return null;

  const files = Array.isArray(manifest.pages) ? manifest.pages : [];
  if (files.length !== pageCount) return null;
  const pages = files.map((file) => path.join(assetsDir, path.basename(file)));
  if (!pages.every((file) => existsSync(file) && statSync(file).size > 0)) return null;

  return {
    status: "reused",
    tool: manifest.tool,
    source: manifest.source,
    ...(manifest.executable === undefined ? {} : { executable: manifest.executable }),
    ...(manifest.version === undefined ? {} : { version: manifest.version }),
    dpi: Number(manifest.dpi),
    pages,
  };
}

/**
 * Render, crop and write one document.
 * @returns {{ name: string, pages: number, figures: number, equations: number,
 *   tables: number, raster: object | null, moved: string[] }}
 */
export function extractOne(
  pdf,
  {
    out,
    name,
    dpi = 150,
    raster = true,
    reuseRaster = true,
    accessibilityAssets = true,
    moveSource = false,
    dropRelativeUrls = false,
    tableFormat = "ascii",
  } = {},
) {
  const docName = documentName(pdf, name);
  // One folder per document; an explicit output directory overrides the layout.
  const outDir = out ?? path.join(path.dirname(pdf), docName);
  mkdirSync(outDir, { recursive: true });

  const data = readFileSync(pdf);
  const pages = listPages(data);
  const pageCount = pages.length;
  const sourceHash = createHash("sha256").update(data).digest("hex");
  const assetsDir = path.join(outDir, `${docName}.assets`);

  let outcome = null;
  if (raster) {
    mkdirSync(assetsDir, { recursive: true });
    outcome = reuseRaster
      ? findReusableRaster(assetsDir, { sourceHash, dpi, pageCount })
      : null;
    if (!outcome) outcome = rasterise({ pdf, outDir: assetsDir, dpi });
    writeFileSync(
      path.join(assetsDir, "raster.json"),
      `${JSON.stringify(
        {
          name: docName,
          sourceHash,
          pageCount,
          ...outcome,
          // Names, not paths: the manifest is committed with the document.
          pages: outcome.pages.map((page) => path.basename(page)),
        },
        null,
        2,
      )}\n`,
    );
    if (
      (outcome.status === "rendered" || outcome.status === "reused") &&
      outcome.pages.length !== pageCount
    ) {
      throw new Error(
        `${outcome.status} ${outcome.pages.length} page(s) for a ${pageCount}-page document`,
      );
    }
  }

  const counts = { figures: 0, equations: 0, tables: 0 };
  if (outcome?.status === "rendered" || outcome?.status === "reused") {
    // The page parse is reused for equations and tables; figures still walk the
    // content streams for Form XObjects, which a page's text lines do not hold.
    const jobs = [
      { label: "figures", boxes: figureBoxes(data), crop: cropFigures },
      { label: "equations", boxes: equationBoxes(data, pages), crop: cropEquations },
      { label: "tables", boxes: tableBoxes(data, pages), crop: cropTables },
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
  let written;
  try {
    written = writeExtraction(data, outDir, docName, {
      dropRelativeUrls,
      pages,
      run: {
        raster: outcome
          ? {
              status: outcome.status,
              tool: outcome.tool,
              source: outcome.source,
              ...(outcome.version === undefined ? {} : { version: outcome.version }),
              ...(outcome.executable === undefined ? {} : { executable: outcome.executable }),
              dpi: outcome.dpi,
              pages: outcome.pages.length,
              reused: outcome.status === "reused",
            }
          : null,
      },
    });
  } finally {
    if (previousFormat === undefined) delete process.env.PDF_TABLE_FORMAT;
    else process.env.PDF_TABLE_FORMAT = previousFormat;
  }

  let accessibility = null;
  if (accessibilityAssets) {
    accessibility = writeAccessibilityAssets({
      outDir,
      name: docName,
      pages,
      targetMd: path.join(outDir, `${docName}.md`),
      targetAssets: assetsDir,
    });
    // Remove the old separate variant from the pre-merge layout.
    for (const stale of [
      path.join(outDir, `${docName}-accessibility.md`),
      path.join(outDir, `${docName}-accessibility.assets`),
    ]) {
      if (existsSync(stale)) rmSync(stale, { recursive: true, force: true });
    }
    const summaryPath = path.join(outDir, `${docName}.extraction-summary.json`);
    const metaPath = path.join(outDir, `${docName}.metadata.json`);
    const accessibilityInfo = {
      layout: "merged",
      md: path.basename(accessibility.md),
      assets: path.basename(accessibility.assetsDir),
      omittedTableCandidates: accessibility.omittedTableCandidates,
      warnings: accessibility.warnings,
    };
    for (const file of [summaryPath, metaPath]) {
      const value = JSON.parse(readFileSync(file, "utf8"));
      const document = file === summaryPath ? value.documents[0] : value;
      document.accessibility = accessibilityInfo;
      document.warnings = [...new Set([...(document.warnings ?? []), ...accessibility.warnings])];
      writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    }
  }

  // The move runs last: the Markdown is safe even when it fails, and the PDF
  // stays where a failed run can find it again.
  const moved = moveSource ? moveSourceFiles(pdf, outDir) : [];

  return {
    name: docName,
    pages: pageCount,
    ...counts,
    raster: outcome,
    accessibility,
    moved,
    warnings: [
      ...new Set([...written.document.warnings, ...(accessibility?.warnings ?? [])]),
    ],
  };
}

/** One line per document: what it holds and whether the pages were rendered. */
function report(result, dpi) {
  const raster = result.raster
    ? result.raster.status === "rendered"
      ? `${result.raster.pages.length} page(s) via ${toolLabel(result.raster)} at ${dpi} dpi`
      : result.raster.status === "reused"
        ? `${result.raster.pages.length} page(s) reused (${toolLabel(result.raster)} at ${dpi} dpi)`
        : `skipped (${result.raster.reason})`
    : "skipped (--no-raster)";
  const source =
    result.moved.length > 0 ? `, source: ${result.moved.length} file(s) moved in` : "";
  const warnings =
    (result.warnings?.length ?? 0) > 0 ? `, warnings: ${result.warnings.length}` : "";
  const omitted = result.accessibility?.omittedTableCandidates
    ? `, ${result.accessibility.omittedTableCandidates} table candidate(s) omitted`
    : "";
  const accessibility = result.accessibility ? `, accessibility: merged${omitted}` : "";
  return (
    `${result.name}: ${result.pages} page(s), ${result.figures} figure(s), ` +
    `${result.equations} equation(s), ${result.tables} table(s), raster: ${raster}${source}${warnings}${accessibility}`
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
        reuseRaster: options.reuseRaster,
        accessibilityAssets: options.accessibilityAssets,
        moveSource: options.moveSource,
        dropRelativeUrls: options.dropRelativeUrls,
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
