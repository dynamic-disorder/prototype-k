#!/usr/bin/env node
/**
 * Fail fast when an input path names no PDF.
 *
 * Usage:
 *     node scripts/check_input.mjs "<source input path>"
 *
 * Exit 0 when the path is a PDF or a folder containing PDFs; exit 1 otherwise.
 * Node port of scripts/check_input.py, kept behaviour-identical: same stdout,
 * same stderr text, same exit codes.
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { invokedDirectly } from "../lib/invoked.mjs";

const USAGE = "usage: check_input.mjs <source input path>";

function isFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function isDirectory(candidate) {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function hasPdfSuffix(candidate) {
  return path.extname(candidate).toLowerCase() === ".pdf";
}

/** Compare paths by their segments, the order Python's sorted(Path) uses. */
function compareBySegments(left, right) {
  const a = left.split(/[\\/]/).filter((part) => part !== "");
  const b = right.split(/[\\/]/).filter((part) => part !== "");
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] < b[index]) return -1;
    if (a[index] > b[index]) return 1;
  }
  return a.length - b.length;
}

/** Mirror Path.as_posix(): backslashes become slashes only on Windows. */
function asPosix(candidate) {
  return path.sep === "\\" ? candidate.replaceAll("\\", "/") : candidate;
}

/**
 * Return the PDFs named by input: the file itself, or every PDF under a folder.
 * @param {string} input
 * @returns {string[]}
 */
export function findPdfs(input) {
  if (isFile(input) && hasPdfSuffix(input)) return [input];
  if (!isDirectory(input)) return [];

  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(child);
      } else if (entry.isFile() && hasPdfSuffix(child)) {
        found.push(child);
      }
    }
  };
  walk(input);
  return found.sort(compareBySegments);
}

/**
 * Run the guard over the given arguments.
 * @param {string[]} argv arguments after the script name
 * @returns {number} exit code
 */
export function main(argv) {
  if (argv.length < 1) {
    console.error(USAGE);
    return 1;
  }

  const source = argv[0];
  const pdfs = findPdfs(source);
  if (pdfs.length === 0) {
    console.error(`ERROR: ${asPosix(source)} names no PDF; extraction not started.`);
    return 1;
  }

  console.log(`input ok: ${pdfs.length} PDF(s)`);
  return 0;
}

if (invokedDirectly(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
