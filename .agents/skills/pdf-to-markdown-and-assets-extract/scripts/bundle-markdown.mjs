#!/usr/bin/env node
/**
 * Bundle existing Markdown and its sibling assets into one folder per document.
 *
 *     node scripts/bundle-markdown.mjs <file.md or folder> [--name <id>] [--move] [--out <dir>]
 *
 * A scraped article arrives as `Article.md` beside `Article.Picture1.webp` and
 * friends, with the Markdown referencing those siblings by name. The corpus
 * wants the shape extraction produces: `article/article.md`, the images under
 * `article.assets/`, and every reference still resolving. This does that and
 * nothing else — it never edits the prose, never reads a PDF and never writes
 * an index.
 *
 * Options:
 *     --name <id>   document id; defaults to the Markdown file's basename, made
 *                   portable (lib/folder-name.mjs)
 *     --move        remove the original Markdown and its assets after a
 *                   successful write; off by default because it moves the
 *                   user's files
 *     --out <dir>   write every document into this one folder instead of one
 *                   folder per document beside the source
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { folderNameFor } from "../lib/folder-name.mjs";
import { invokedDirectly } from "../lib/invoked.mjs";

const USAGE =
  "usage: bundle-markdown.mjs <file.md or folder> [--name <id>] [--move] [--out <dir>]";

/** @returns {{ input: string, name: string | null, move: boolean, out: string | null }} */
export function parseArgs(argv) {
  const options = { input: null, name: null, move: false, out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} needs a value`);
      return argv[index];
    };
    if (arg === "--name") options.name = value();
    else if (arg === "--move") options.move = true;
    else if (arg === "--out") options.out = value();
    else if (arg.startsWith("--")) throw new Error(`unknown option: ${arg}`);
    else if (options.input === null) options.input = arg;
    else throw new Error(`unexpected argument: ${arg}`);
  }
  if (!options.input) throw new Error("no input path");
  return options;
}

/** Every Markdown file under a folder, in path order, or the file itself. */
export function findMarkdown(input) {
  if (statSync(input).isFile()) {
    return path.extname(input).toLowerCase() === ".md" ? [input] : [];
  }
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && path.extname(child).toLowerCase() === ".md") found.push(child);
    }
  };
  walk(input);
  return found.sort();
}

/**
 * Files that belong to one Markdown document.
 *
 * A companion is a regular file in the Markdown's own folder whose name starts
 * with the Markdown's stem and continues with a separator — `Article.Picture1.webp`
 * and `Article - notes.txt` belong to `Article.md`. Another Markdown or PDF is a
 * document in its own right and stays out.
 */
export function companionAssets(markdown) {
  const folder = path.dirname(markdown);
  const stem = path.basename(markdown, path.extname(markdown));
  if (stem === "") return [];
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => {
      if (name === path.basename(markdown)) return false;
      if (/\.(md|pdf)$/i.test(name)) return false;
      if (!name.startsWith(stem)) return false;
      const rest = name.slice(stem.length);
      return rest.length > 0 && !/[A-Za-z0-9]/.test(rest[0]);
    })
    .sort()
    .map((name) => path.join(folder, name));
}

/** The name an asset keeps inside `<id>.assets/`: the part after the stem. */
export function assetName(asset, markdown) {
  const stem = path.basename(markdown, path.extname(markdown));
  const base = path.basename(asset);
  return base.slice(stem.length).replace(/^[^A-Za-z0-9]+/, "");
}

/**
 * Point the Markdown's references at the new asset paths.
 * @returns {{ text: string, rewritten: number }}
 */
export function rewriteReferences(text, names, id) {
  let rewritten = 0;
  let out = text;
  for (const { from, to } of names) {
    const pattern = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    out = out.replace(pattern, (match) => {
      rewritten += 1;
      return to;
    });
  }
  return { text: out, rewritten };
}

/**
 * Bundle one Markdown document.
 * @returns {{ name: string, assets: number, rewritten: number, md: string }}
 */
export function bundleOne(markdown, { out = null, name = null, move = false } = {}) {
  const id = folderNameFor(name ?? path.basename(markdown, path.extname(markdown)));
  const folder = out ?? path.join(path.dirname(markdown), id);
  const mdPath = path.join(folder, `${id}.md`);
  if (existsSync(mdPath)) {
    throw new Error(`refusing to overwrite ${mdPath}; move it aside and rerun`);
  }

  const assets = companionAssets(markdown);
  const assetsDir = path.join(folder, `${id}.assets`);
  mkdirSync(assetsDir, { recursive: true });

  const original = readFileSync(markdown, "utf8");
  const names = assets.map((asset) => ({
    from: path.basename(asset),
    to: `${id}.assets/${assetName(asset, markdown)}`,
  }));
  const { text, rewritten } = rewriteReferences(original, names, id);
  writeFileSync(mdPath, text, "utf8");

  for (const asset of assets) {
    copyFileSync(asset, path.join(assetsDir, assetName(asset, markdown)));
  }

  const metadata = {
    docId: id,
    kind: "markdown",
    source: path.basename(markdown),
    assets: assets.length,
    referencesRewritten: rewritten,
  };
  writeFileSync(
    path.join(folder, `${id}.metadata.json`),
    `${JSON.stringify(metadata)}\n`,
    "utf8",
  );
  writeFileSync(
    path.join(folder, `${id}.extraction-summary.json`),
    `${JSON.stringify({ documents: [metadata] }, null, 2)}\n`,
    "utf8",
  );

  // The originals go last, so a failed copy never costs the only copy of an
  // article or an image.
  if (move) {
    for (const asset of assets) rmSync(asset);
    rmSync(markdown);
  }

  return { name: id, assets: assets.length, rewritten, md: mdPath };
}

/** @param {string[]} argv @returns {number} exit code */
export function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return 0;
  }

  let options;
  let documents;
  try {
    options = parseArgs(argv);
    if (!existsSync(options.input)) throw new Error(`no such path: ${options.input}`);
    documents = findMarkdown(options.input);
  } catch (error) {
    console.error(`ERROR: ${error.message}; bundling not started.`);
    return 2;
  }

  if (documents.length === 0) {
    console.error("ERROR: the path names no Markdown file; bundling not started.");
    return 1;
  }

  if (options.out === null && documents.length > 1) {
    const claimed = new Map();
    for (const markdown of documents) {
      const id = folderNameFor(path.basename(markdown, path.extname(markdown)));
      if (claimed.has(id)) {
        console.error(
          `ERROR: "${path.basename(claimed.get(id))}" and "${path.basename(markdown)}" both map to ` +
            `the folder "${id}"; rename one or bundle them one at a time.`,
        );
        return 1;
      }
      claimed.set(id, markdown);
    }
  }

  let status = 0;
  for (const markdown of documents) {
    const name = documents.length === 1 ? options.name : null;
    try {
      const result = bundleOne(markdown, { out: options.out, name, move: options.move });
      console.log(
        `${result.name}: ${result.assets} asset(s), ${result.rewritten} reference(s), ` +
          `${options.move ? "moved in place" : "copied"}`,
      );
    } catch (error) {
      console.error(`${path.basename(markdown)}: ${error.message}`);
      status = 1;
    }
  }
  return status;
}

if (invokedDirectly(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
