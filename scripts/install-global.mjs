#!/usr/bin/env node
/**
 * Install the canonical configuration into the shared user-global agents root.
 *
 * One physical copy lives in this repository; the installer points the shared root at it, so
 * nothing is duplicated and nothing drifts:
 *
 *   ~/.agents/skills/<name>  ->  <repo>/.agents/skills/<name>
 *   ~/.agents/hooks          ->  <repo>/.agents/hooks
 *   ~/.agents/scripts        ->  <repo>/scripts
 *   ~/.agents/githooks       ->  <repo>/.githooks
 *   core.hooksPath (global)  ->  <absolute ~/.agents/githooks>
 *
 * The last line is what makes the gate machine-level: every repository on the machine runs the
 * same pre-commit hook, and a repository keeps no hook file of its own.
 *
 * Directory links are junctions on Windows (no administrator right needed) and symlinks elsewhere.
 * A real directory at the destination is never replaced: the installer reports it as a conflict and
 * leaves it alone.
 *
 * Usage (from this repository):
 *   node scripts/install-global.mjs            # check only; exit 1 when anything is missing or stale
 *   node scripts/install-global.mjs --write    # create or refresh the links and the git setting
 *   node scripts/install-global.mjs --remove   # remove the links and the setting this installer owns
 *
 * Environment:
 *   DSH_AGENTS_HOME   overrides ~/.agents  (the shared agents root)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsSource = path.join(root, '.agents', 'skills');
const agentsHome = process.env.DSH_AGENTS_HOME ?? path.join(os.homedir(), '.agents');
const store = path.join(agentsHome, 'skills');
const args = new Set(process.argv.slice(2));
const mode = args.has('--write') ? 'write' : args.has('--remove') ? 'remove' : 'check';

if (args.has('--help') || args.has('-h')) {
  process.stdout.write(
    'Usage: node scripts/install-global.mjs [--write|--remove]\n' +
      '  (no option)  check the global links and the machine-level hooks path\n' +
      '  --write      create or refresh the links and set core.hooksPath\n' +
      '  --remove     remove the links and unset core.hooksPath when this installer owns it\n',
  );
  process.exit(0);
}

if (!fs.existsSync(skillsSource)) {
  console.error(`source not found: ${skillsSource}`);
  process.exit(2);
}

// The one-line directories: whole subdirectories linked into the shared root. `skills` is handled
// per skill below, so a project-only skill is never exposed machine-wide.
const directoryLinks = [
  ['hooks', path.join(root, '.agents', 'hooks')],
  ['scripts', path.join(root, 'scripts')],
  ['githooks', path.join(root, '.githooks')],
];

const linkType = process.platform === 'win32' ? 'junction' : 'dir';

function readLink(link) {
  const stat = fs.lstatSync(link);
  if (!stat.isSymbolicLink()) return null;
  return path.resolve(path.dirname(link), fs.readlinkSync(link));
}

function removeLink(link) {
  // A junction to a directory is a symbolic link to the lstat, but Windows refuses DeleteFileW on
  // it; RemoveDirectoryW (rmdirSync) is the call that works there. POSIX unlinks a directory
  // symlink with unlink().
  try {
    fs.unlinkSync(link);
  } catch {
    fs.rmdirSync(link);
  }
}

function inspect(link, target) {
  try {
    fs.lstatSync(link);
  } catch {
    return { status: 'missing' };
  }
  const current = readLink(link);
  if (current === null) return { status: 'conflict' };
  return { status: current === path.resolve(target) ? 'ok' : 'stale', current };
}

function install(link, target) {
  const state = inspect(link, target);

  if (mode === 'remove') {
    if (state.status === 'missing') return 'missing';
    if (state.status === 'conflict') return 'conflict';
    removeLink(link);
    return 'removed';
  }

  if (state.status === 'ok') return state.status;
  if (state.status === 'conflict') return state.status;
  if (mode === 'check') return state.status;

  fs.mkdirSync(path.dirname(link), { recursive: true });
  if (state.status === 'stale') removeLink(link);
  fs.symlinkSync(path.resolve(target), link, linkType);
  return state.status === 'stale' ? 'updated' : 'created';
}

// git accepts a Windows path, but the backslashes would be read as escapes in some config contexts;
// forward slashes are valid in every git config value and on every platform.
function gitConfigValue(key) {
  try {
    const out = execFileSync('git', ['config', '--global', '--get', key], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim();
  } catch {
    return '';
  }
}

const hooksPath = path.join(agentsHome, 'githooks');
const hooksPathValue = hooksPath.split(path.sep).join('/');

function applyHooksPath() {
  const current = gitConfigValue('core.hooksPath');
  if (mode === 'remove') {
    if (current === '') return { status: 'missing' };
    if (current !== hooksPathValue) return { status: 'foreign', current };
    execFileSync('git', ['config', '--global', '--unset', 'core.hooksPath'], { stdio: 'ignore' });
    return { status: 'removed' };
  }
  if (current === hooksPathValue) return { status: 'ok' };
  if (mode === 'check') return { status: current === '' ? 'missing' : 'stale', current };
  execFileSync('git', ['config', '--global', 'core.hooksPath', hooksPathValue], { stdio: 'ignore' });
  return { status: current === '' ? 'created' : 'updated', current };
}

const skills = fs
  .readdirSync(skillsSource, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsSource, entry.name, 'SKILL.md')))
  .map((entry) => entry.name)
  .sort();

if (skills.length === 0) {
  console.error(`no skills found under ${skillsSource}`);
  process.exit(2);
}

const counts = {};
const problems = [];
function record(status, subject) {
  counts[status] = (counts[status] ?? 0) + 1;
  if (status === 'conflict' || (mode === 'check' && (status === 'missing' || status === 'stale'))) {
    problems.push(`${status} ${subject}`);
  }
}

for (const name of skills) {
  const link = path.join(store, name);
  const target = path.join(skillsSource, name);
  record(install(link, target), link);
}

for (const [name, target] of directoryLinks) {
  const link = path.join(agentsHome, name);
  record(install(link, target), link);
}

const hooksPathState = applyHooksPath();
record(hooksPathState.status, `core.hooksPath = ${hooksPathValue}`);

process.stdout.write(`source : ${root}\n`);
process.stdout.write(`agents : ${agentsHome}\n`);
process.stdout.write(`mode   : ${mode}\n\n`);
for (const [status, count] of Object.entries(counts)) process.stdout.write(`  ${status.padEnd(8)} ${count}\n`);

if (hooksPathState.current && hooksPathState.current !== hooksPathValue) {
  process.stdout.write(`\ncore.hooksPath was ${hooksPathState.current}\n`);
}

if (problems.length > 0) {
  process.stdout.write('\n');
  for (const problem of problems) process.stdout.write(`${problem}\n`);
}

if (mode === 'check') {
  const failed = (counts.missing ?? 0) + (counts.stale ?? 0) + (counts.conflict ?? 0);
  if (failed > 0) {
    process.stdout.write('\nSome links or the hooks path are not in place — run with --write.\n');
    process.exit(1);
  }
  process.stdout.write('\nAll links and the machine-level hooks path are in place.\n');
}
