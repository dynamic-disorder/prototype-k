#!/usr/bin/env node
/**
 * Extracts Word documents into page-marked Markdown with a sidecar and an assets folder, one folder per
 * document beside its source.
 * Usage: node scripts/extract-docx.mjs <file or folder> [--name <id>] [--output <dir>]
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { extractDocx } from '../lib/docx-extract.mjs';
import { findDocuments } from './check-input.mjs';

const VERSION = '1.0.0';
const args = process.argv.slice(2);
const path = args.find((argument) => !argument.startsWith('--'));
const option = (flag) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
};

if (!path) {
  console.error('usage: extract-docx.mjs <file or folder> [--name <id>] [--output <dir>]');
  process.exit(1);
}

const documents = findDocuments(path);
if (documents.length === 0) {
  console.error(`ERROR: ${path} names no .docx or .doc; extraction not started.`);
  process.exit(1);
}

const only = option('--name');
if (only && documents.length > 1) {
  console.error('ERROR: --name names one document, but the path holds several; extract them one at a time.');
  process.exit(1);
}

const output = option('--output');
const seen = new Map();
for (const document of documents) {
  const name = only ?? portableName(basename(document));
  if (seen.has(name)) {
    console.error(`ERROR: ${seen.get(name)} and ${document} both map to ${name}; rename one or pass --name.`);
    process.exit(1);
  }

  seen.set(name, document);
  extractOne(document, name);
}

function extractOne(document, name) {
  const source = resolve(document);
  const { buffer, converter } = load(source);
  const { markdown, stats, images } = extractDocx(buffer, name);
  const folder = output ? resolve(output) : join(dirname(source), name);
  mkdirSync(folder, { recursive: true });

  const markdownPath = join(folder, `${name}.md`);
  writeFileSync(markdownPath, markdown, 'utf8');

  if (images.length > 0) {
    const assets = join(folder, `${name}.assets`);
    mkdirSync(assets, { recursive: true });
    for (const image of images) {
      writeFileSync(join(assets, image.name), image.bytes);
    }
  }

  const summary = {
    extractor: 'docx-to-markdown-and-assets-extract',
    version: VERSION,
    document: basename(source),
    name,
    source_sha256: createHash('sha256').update(buffer).digest('hex'),
    converter,
    ...stats,
    markdown_characters: markdown.length,
  };

  writeFileSync(join(folder, `${name}.extraction-summary.json`), JSON.stringify(summary, null, 2) + '\n', 'utf8');
  writeFileSync(join(folder, `${name}.metadata.json`), JSON.stringify({
    id: name,
    source: basename(source),
    sections: stats.sections,
    headings: stats.headings,
    images: stats.images,
  }, null, 2) + '\n', 'utf8');

  console.log(`${name}: ${stats.sections} section(s), ${stats.headings} heading(s), ${stats.tables} table(s), ${stats.images} image(s)`);
}

function load(source) {
  if (source.toLowerCase().endsWith('.docx')) {
    return { buffer: readFileSync(source), converter: null };
  }

  const version = sofficeVersion();
  if (!version) {
    console.error(`ERROR: ${basename(source)} is a legacy .doc and no LibreOffice converter was found; install soffice or save the file as .docx.`);
    process.exit(1);
  }

  const temporary = mkdtempSync(join(tmpdir(), 'docx-extract-'));
  try {
    execFileSync('soffice', ['--headless', '--convert-to', 'docx', '--outdir', temporary, source], { stdio: 'ignore' });
    const converted = join(temporary, basename(source).replace(/\.doc$/i, '.docx'));
    return { buffer: readFileSync(converted), converter: `LibreOffice ${version}` };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function sofficeVersion() {
  try {
    return execFileSync('soffice', ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function portableName(value) {
  const cleaned = value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return cleaned || 'document';
}
