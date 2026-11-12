#!/usr/bin/env node
/**
 * Generate the portable agent bundle from this checkout.
 *
 * The bundle is the `.agents-generic-<date>` tree a portable machine copies into `~/.agents`:
 * the rules, the skills, the gates and the scripts this machine runs, and nothing that is only
 * useful to the checkout (the installers, this exporter, project code, credentials).
 *
 * Usage (from this repository):
 *   node scripts/export-agents.mjs                     # write dist/.agents-generic-<date>
 *   node scripts/export-agents.mjs --out <dir>         # write elsewhere
 *   node scripts/export-agents.mjs --check             # compare the newest export; never write
 *   node scripts/export-agents.mjs --check --out <dir> # compare one export
 *   node scripts/export-agents.mjs --archive           # also write the matching .tar.gz
 *
 * Exit codes: 0 ok, 1 refused file, leak or drift, 2 usage or environment error.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  BUNDLED_ROOTS,
  BUNDLE_PREFIX,
  MANIFEST_NAME,
  SCANNER_BUNDLE_PATH,
  STATIC_ENTRIES,
  bundleDirName,
  bundlePathFor,
  composeAgentsMd,
  expectedFiles,
  findLeaks,
  isExcluded,
  isRefused,
  manifestText,
  parseArgs,
} from './lib/export-plan.mjs';

const home = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`export-agents: ${error.message}\n`);
  process.exit(2);
}

if (options.help) {
  process.stdout.write(
    'Usage: node scripts/export-agents.mjs [--out <dir>] [--check] [--archive]\n' +
      '  (no option)  write dist/.agents-generic-<date>\n' +
      '  --out <dir>  write to that directory\n' +
      '  --check      compare a written export with a fresh plan; never write\n' +
      '  --archive    also write the matching .tar.gz\n',
  );
  process.exit(0);
}

function walk(root, relative, collector) {
  const absolute = path.join(home, root);
  if (!fs.existsSync(absolute)) return;
  const visit = (directory, rel) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const childRel = `${rel}/${entry.name}`;
      if (isExcluded(childRel)) continue;
      const childAbs = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(childAbs, childRel);
      else if (entry.isFile()) collector.push(childRel);
    }
  };
  visit(absolute, relative);
}

const homeFiles = [];
for (const root of BUNDLED_ROOTS) walk(root, root, homeFiles);

const entries = [];
const refused = [];
const seen = new Map();
function addEntry(entry) {
  const clash = seen.get(entry.bundle);
  if (clash) {
    process.stderr.write(
      `export-agents: two sources map to ${entry.bundle}: ${clash.source ?? clash.kind} and ${entry.source ?? entry.kind}\n`,
    );
    process.exit(2);
  }
  seen.set(entry.bundle, entry);
  entries.push(entry);
}

for (const relative of homeFiles) {
  const bundle = bundlePathFor(relative);
  if (!bundle) continue;
  if (isRefused(bundle)) {
    refused.push(bundle);
    continue;
  }
  addEntry({ bundle, kind: 'copy', source: relative });
}
for (const entry of STATIC_ENTRIES) addEntry(entry);

if (refused.length > 0) {
  process.stderr.write('export-agents: refusing to export:\n');
  for (const bundle of refused) process.stderr.write(`  ${bundle}\n`);
  process.exit(1);
}

const contents = new Map();
function contentFor(entry) {
  if (contents.has(entry.bundle)) return contents.get(entry.bundle);
  let buffer;
  if (entry.kind === 'compose') {
    const parts = entry.sources.map((source) => fs.readFileSync(path.join(home, source), 'utf8'));
    buffer = Buffer.from(composeAgentsMd(parts[0], parts[1]), 'utf8');
  } else {
    buffer = fs.readFileSync(path.join(home, entry.source));
  }
  contents.set(entry.bundle, buffer);
  return buffer;
}

function isBinary(buffer) {
  return buffer.subarray(0, 8192).includes(0);
}

const leaks = [];
for (const entry of entries) {
  if (entry.bundle === SCANNER_BUNDLE_PATH) continue;
  const buffer = contentFor(entry);
  if (isBinary(buffer)) continue;
  for (const finding of findLeaks(buffer.toString('utf8'))) {
    leaks.push({ bundle: entry.bundle, ...finding });
  }
}
if (leaks.length > 0) {
  process.stderr.write('export-agents: the bundle would carry machine identifiers:\n');
  for (const leak of leaks) {
    process.stderr.write(`  ${leak.bundle}:${leak.line} (${leak.rule})\n`);
  }
  process.exit(1);
}

const hashes = {};
for (const entry of entries) {
  hashes[entry.bundle] = crypto.createHash('sha256').update(contentFor(entry)).digest('hex');
}

function targetForCheck() {
  if (options.out) return path.resolve(options.out);
  const dist = path.join(home, 'dist');
  if (!fs.existsSync(dist)) return null;
  const names = fs
    .readdirSync(dist, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(BUNDLE_PREFIX))
    .map((entry) => entry.name)
    .sort();
  const newest = names[names.length - 1];
  return newest ? path.join(dist, newest) : null;
}

function listFiles(root, relative = '') {
  const found = [];
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const childRel = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...listFiles(root, childRel));
    else if (entry.isFile()) found.push(childRel);
  }
  return found;
}

if (options.mode === 'check') {
  const target = targetForCheck();
  if (!target || !fs.existsSync(target)) {
    process.stderr.write('export-agents: no export to check — run without --check first\n');
    process.exit(2);
  }

  const expected = expectedFiles(entries);
  const actual = listFiles(target).sort();
  const missing = expected.filter((file) => !actual.includes(file));
  const extra = actual.filter((file) => !expected.includes(file));
  const changed = [];
  for (const [file, hash] of Object.entries(hashes)) {
    const absolute = path.join(target, file);
    if (!fs.existsSync(absolute)) continue;
    const actualHash = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
    if (actualHash !== hash) changed.push(file);
  }

  const drift = missing.length + extra.length + changed.length;
  if (drift > 0) {
    process.stdout.write(`export-agents: ${target} drifts from the checkout\n`);
    for (const file of missing) process.stdout.write(`  missing  ${file}\n`);
    for (const file of extra) process.stdout.write(`  extra    ${file}\n`);
    for (const file of changed) process.stdout.write(`  changed  ${file}\n`);
    process.exit(1);
  }

  process.stdout.write(`export-agents: ${target} matches the checkout (${expected.length} files)\n`);
  process.exit(0);
}

const target = path.resolve(options.out ?? path.join(home, 'dist', bundleDirName()));
if (fs.existsSync(target)) {
  if (!fs.existsSync(path.join(target, MANIFEST_NAME))) {
    process.stderr.write(
      `export-agents: refusing to replace ${target} — no ${MANIFEST_NAME}, so it is not an export\n`,
    );
    process.exit(2);
  }
  process.stdout.write(`export-agents: replacing the previous export at ${target}\n`);
  fs.rmSync(target, { recursive: true, force: true });
}

for (const entry of entries) {
  const destination = path.join(target, entry.bundle);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, contentFor(entry));
  if (entry.bundle.endsWith('.sh') || /^githooks\/pre-/.test(entry.bundle)) {
    try {
      fs.chmodSync(destination, 0o755);
    } catch {
      // A filesystem without POSIX modes; the file is still run through `bash`.
    }
  }
}
fs.writeFileSync(path.join(target, MANIFEST_NAME), manifestText(hashes));

process.stdout.write(`export-agents: wrote ${entries.length} files to ${target}\n`);

if (options.archive) {
  const archive = `${target}.tar.gz`;
  execFileSync('tar', ['-czf', archive, '-C', path.dirname(target), path.basename(target)], {
    stdio: 'inherit',
  });
  process.stdout.write(`export-agents: wrote ${archive}\n`);
}

if (fs.existsSync(path.join(home, 'dist')) && !target.startsWith(path.join(home, 'dist'))) {
  process.stdout.write(`export-agents: note — ${target} is outside dist/\n`);
}
