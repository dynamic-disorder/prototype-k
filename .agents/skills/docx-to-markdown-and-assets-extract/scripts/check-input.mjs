#!/usr/bin/env node
/**
 * Refuses a path that names no Word document, before anything is written.
 * Usage: node scripts/check-input.mjs <path>
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const EXTENSIONS = ['.docx', '.doc'];

/**
 * Lists the Word documents under a path.
 *
 * @param {string} path A file or a folder.
 * @returns {string[]} The document paths, in a stable order.
 */
export function findDocuments(path) {
  if (!existsSync(path)) {
    return [];
  }

  if (statSync(path).isFile()) {
    return EXTENSIONS.includes(extensionOf(path)) ? [path] : [];
  }

  const found = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) {
      found.push(...findDocuments(entryPath));
    } else if (EXTENSIONS.includes(extensionOf(entry.name))) {
      found.push(entryPath);
    }
  }

  return found.sort();
}

function extensionOf(path) {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot).toLowerCase();
}

if (process.argv[1]?.endsWith('check-input.mjs')) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: check-input.mjs <path>');
    process.exit(1);
  }

  const documents = findDocuments(path);
  if (documents.length === 0) {
    console.error(`ERROR: ${path} names no .docx or .doc; extraction not started.`);
    process.exit(1);
  }

  console.log(`input ok: ${documents.length} Word document(s)`);
}
