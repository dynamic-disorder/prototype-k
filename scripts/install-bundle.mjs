#!/usr/bin/env node
/**
 * Install or update a portable `.agents` bundle into a receiving machine's `~/.agents`.
 *
 * This file is shipped inside every bundle as `install.mjs`, next to `MANIFEST.json` and `lib/`.
 * It is idempotent: it records the files it owns in `~/.agents/.agents-state.json`, writes only the
 * added or changed ones, removes only files a previous run installed, and leaves everything else
 * alone. A second run with the same bundle reports `0 changed` and writes nothing.
 *
 * It never touches the Claude Code or DeepSeek harness directories, a credential file, a linked
 * checkout's `~/.agents`, a `settings.json` that already exists, or a skill folder whose `SKILL.md`
 * name is not ours.
 *
 * Usage (from the bundle folder):
 *   node install.mjs                       # check only; exit 1 when the target drifts
 *   node install.mjs --write               # apply the plan
 *   node install.mjs --agents-home <dir>   # install elsewhere (rehearsal)
 *   node install.mjs --help
 *
 * Exit codes: 0 up to date or applied, 1 drift or conflict, 2 refusal or unusable bundle.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applyBlock, validateBlockText } from './lib/managed-block.mjs';
import {
  STATE_FILE,
  dirsToPrune,
  isOwnedPath,
  normalizeBundlePath,
  parseState,
  planBundle,
  skillFolderFor,
  stateText,
} from './lib/install-bundle.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = (line) => process.stdout.write(`${line}\n`);
const fail = (line) => process.stderr.write(`install-bundle: ${line}\n`);

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  out(
    'Usage: node install.mjs [--check|--write] [--agents-home <dir>]\n' +
      '  (no option)  check only; exit 1 when the target drifts\n' +
      '  --write      install or update the owned files\n',
  );
  process.exit(0);
}
let mode = 'check';
let agentsHomeArg = null;
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--check') mode = 'check';
  else if (arg === '--write') mode = 'write';
  else if (arg === '--agents-home') {
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      fail('--agents-home needs a directory');
      process.exit(2);
    }
    agentsHomeArg = value;
    index += 1;
  } else {
    fail(`unknown option: ${arg}\nTry --help.`);
    process.exit(2);
  }
}

const agentsHome = path.resolve(
  agentsHomeArg ?? process.env.DSH_AGENTS_HOME ?? path.join(os.homedir(), '.agents'),
);

function readManifest() {
  const file = path.join(root, 'MANIFEST.json');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    fail(`no usable ${path.basename(file)} beside install.mjs — this is not a bundle`);
    process.exit(2);
  }
  const files = {};
  for (const [raw, hash] of Object.entries(data.files ?? {})) {
    const rel = normalizeBundlePath(raw);
    if (rel === null || typeof hash !== 'string') {
      fail(`manifest entry is not a safe bundle path: ${String(raw)}`);
      process.exit(2);
    }
    files[rel] = hash;
  }
  return files;
}

const files = readManifest();

// A corrupted download must fail here, before anything is written.
const corrupt = [];
for (const [rel, expected] of Object.entries(files)) {
  const absolute = path.join(root, ...rel.split('/'));
  let digest;
  try {
    digest = sha256(fs.readFileSync(absolute));
  } catch {
    corrupt.push(`${rel} (missing)`);
    continue;
  }
  if (digest !== expected) corrupt.push(rel);
}
if (corrupt.length > 0) {
  fail(`the bundle does not match MANIFEST.json: ${corrupt.length} file(s)`);
  for (const rel of corrupt.slice(0, 20)) out(`  corrupt ${rel}`);
  process.exit(2);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
const targetFor = (rel) => path.join(agentsHome, ...rel.split('/'));
const exists = (rel) => fs.existsSync(targetFor(rel));
const hash = (rel) => sha256(fs.readFileSync(targetFor(rel)));
function frontmatterName(rel) {
  try {
    const text = fs.readFileSync(targetFor(rel), 'utf8');
    const header = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    return header ? (header[1].match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? null) : null;
  } catch {
    return null;
  }
}

function isLink(absolute) {
  try {
    return fs.lstatSync(absolute).isSymbolicLink();
  } catch {
    return false;
  }
}

// A linked install and a copied bundle are two different models; mixing them breaks both.
const linked = ['githooks', 'hooks', 'scripts']
  .map((name) => path.join(agentsHome, name))
  .find(isLink);
const expectedSkills = [...new Set(Object.keys(files).map(skillFolderFor).filter(Boolean))];
const linkedSkill = expectedSkills
  .map((name) => path.join(agentsHome, 'skills', name))
  .find(isLink);
if (linked || linkedSkill) {
  fail(`${linked ?? linkedSkill} is a link, so this machine installs from a linked checkout.`);
  fail('Run that checkout\'s `node scripts/install-global.mjs --write` instead; a bundle would mix two models.');
  process.exit(2);
}

const stateFile = path.join(agentsHome, STATE_FILE);
let previous = {};
let previousText = '';
try {
  previousText = fs.readFileSync(stateFile, 'utf8');
  previous = parseState(previousText) ?? {};
} catch {
  previous = {};
}

const plan = planBundle({ files, previous, exists, hash, targetSkillName: frontmatterName });

function writeAtomic(absolute, buffer) {
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, buffer);
  fs.renameSync(temporary, absolute);
}

function applyFiles() {
  for (const rel of [...plan.add, ...plan.change]) {
    writeAtomic(targetFor(rel), fs.readFileSync(path.join(root, ...rel.split('/'))));
  }
  for (const rel of plan.remove) {
    fs.rmSync(targetFor(rel), { force: true });
  }
  for (const rel of dirsToPrune(plan.remove)) {
    const absolute = path.join(agentsHome, ...rel.split('/'));
    try {
      if (fs.readdirSync(absolute).length === 0) fs.rmdirSync(absolute);
    } catch {
      // Already gone or not empty; both are fine.
    }
  }
}

function mergeAgentsFile() {
  const target = path.join(agentsHome, 'AGENTS.md');
  const composed = path.join(root, 'AGENTS.md');
  const blocks = [
    ['shared-agent-notes', path.join(root, 'blocks', 'AGENTS.shared.md')],
    ['documentation-style', path.join(root, 'blocks', 'documentation-style.md')],
  ];
  if (!fs.existsSync(target)) {
    if (fs.existsSync(composed)) {
      if (mode === 'write') writeAtomic(target, fs.readFileSync(composed));
      return { status: mode === 'write' ? 'installed' : 'would install' };
    }
    return { status: 'absent from the bundle' };
  }
  const existing = fs.readFileSync(target, 'utf8');
  let text = existing;
  for (const [kind, source] of blocks) {
    if (!fs.existsSync(source)) continue;
    const block = fs.readFileSync(source, 'utf8');
    const errors = validateBlockText(block, kind);
    if (errors.length > 0) {
      fail(`refusing malformed ${kind} block in the bundle`);
      process.exit(2);
    }
    text = applyBlock(text, block, kind).text;
  }
  if (text === existing) return { status: 'up to date' };
  if (mode === 'write') writeAtomic(target, Buffer.from(text, 'utf8'));
  return { status: mode === 'write' ? 'merged' : 'stale' };
}

function installSettings() {
  const source = path.join(root, 'settings.json');
  const target = path.join(agentsHome, 'settings.json');
  if (!fs.existsSync(source)) return 'absent from the bundle';
  if (!fs.existsSync(target)) {
    if (mode === 'write') writeAtomic(target, fs.readFileSync(source));
    return mode === 'write' ? 'installed' : 'would install';
  }
  return sha256(fs.readFileSync(target)) === sha256(fs.readFileSync(source))
    ? 'up to date'
    : 'kept (differs)';
}

function hooksPathStatus() {
  const precommit = path.join(agentsHome, 'githooks', 'pre-commit');
  if (!fs.existsSync(precommit)) return { ok: false, status: 'missing githooks/pre-commit' };
  const want = path.join(agentsHome, 'githooks').split(path.sep).join('/');
  let current = '';
  try {
    current = execFileSync('git', ['config', '--global', '--get', 'core.hooksPath'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    current = '';
  }
  if (current === want) return { ok: true, status: want };
  if (current !== '') return { ok: true, status: `foreign, left alone: ${current}` };
  if (mode === 'write') {
    try {
      execFileSync('git', ['config', '--global', 'core.hooksPath', want], { stdio: 'ignore' });
      return { ok: true, status: `set ${want}` };
    } catch {
      return { ok: false, status: 'could not set core.hooksPath (is git on PATH?)' };
    }
  }
  return { ok: false, status: `would set ${want}` };
}

out(`bundle : ${root}`);
out(`agents : ${agentsHome}`);
out(`mode   : ${mode}\n`);
for (const [label, paths] of [
  ['add', plan.add],
  ['change', plan.change],
  ['remove', plan.remove],
  ['conflict', plan.conflicts],
]) {
  for (const rel of paths.slice(0, 12)) out(`  ${label.padEnd(8)} ${rel}`);
  if (paths.length > 12) out(`  ${label.padEnd(8)} ... and ${paths.length - 12} more`);
}
out(`  ${'unchanged'.padEnd(8)} ${plan.unchanged.length}`);

let agentsResult = { status: 'not run' };
let settingsResult = 'not run';
let hooks = { ok: false, status: 'not run' };
if (mode === 'write') {
  applyFiles();
  agentsResult = mergeAgentsFile();
  settingsResult = installSettings();
  hooks = hooksPathStatus();
  const nextFiles = {};
  for (const rel of [...plan.add, ...plan.change, ...plan.unchanged]) {
    if (isOwnedPath(rel)) nextFiles[rel] = files[rel];
  }
  const nextText = stateText(nextFiles);
  if (nextText !== previousText) writeAtomic(stateFile, Buffer.from(nextText, 'utf8'));
} else {
  agentsResult = mergeAgentsFile();
  settingsResult = installSettings();
  hooks = hooksPathStatus();
}

out(`\n  AGENTS.md  ${agentsResult.status}`);
out(`  settings   ${settingsResult}`);
out(`  hooksPath  ${hooks.status}`);

const drift = plan.add.length + plan.change.length + plan.remove.length;
if (plan.conflicts.length > 0) {
  out(`\n${plan.conflicts.length} conflict(s): a file whose name is ours but whose content is not. Left alone.`);
  process.exit(1);
}
if (mode === 'write') {
  if (!hooks.ok) {
    fail(`the gate is not wired: ${hooks.status}`);
    process.exit(1);
  }
  out('\nApplied. Re-run with --check: it must print `Up to date.`');
  process.exit(0);
}
if (drift > 0 || agentsResult.status === 'stale' || agentsResult.status === 'would install') {
  out('\nOut of date — run `node install.mjs --write`.');
  process.exit(1);
}
out('\nUp to date.');
process.exit(hooks.ok ? 0 : 1);
