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
const hookFile = path.join(hooksPath, 'pre-commit');
const hooksPathValue = hooksPath.split(path.sep).join('/');

// A hooks path is only useful when git can find a hook through it. A dangling link or a missing
// `.githooks` makes git skip the gate silently, and a hand-run `bash <path>` fails with
// "No such file or directory"; so the setting is written only when the file it names exists.
function applyHooksPath() {
  const current = gitConfigValue('core.hooksPath');
  if (mode === 'remove') {
    if (current === '') return { status: 'missing' };
    if (current !== hooksPathValue) return { status: 'foreign', current };
    execFileSync('git', ['config', '--global', '--unset', 'core.hooksPath'], { stdio: 'ignore' });
    return { status: 'removed' };
  }
  if (!fs.existsSync(hookFile)) return { status: 'incomplete', current };
  if (current === hooksPathValue) return { status: 'ok' };
  if (mode === 'check') return { status: current === '' ? 'missing' : 'stale', current };
  execFileSync('git', ['config', '--global', 'core.hooksPath', hooksPathValue], { stdio: 'ignore' });
  return { status: current === '' ? 'created' : 'updated', current };
}

// Bash resolution — a git hook names its interpreter in its first line, and a git build that resolves
// that name through PATH runs the first `bash` it finds. On Windows the first one is the WSL launcher,
// which cannot open a drive-letter path, so the hook never starts; GitHub Desktop ships such a git.
// A `.cmd` shim does not help: the lookup appends only `.exe`. The repair is Git's own `bin` directory
// first on the machine PATH — one elevated step this installer reports but never runs. On POSIX the
// check is the interpreter itself, so the two machines are held to the same guarantee.
function gitBashDir() {
  if (process.platform !== 'win32') return '';
  try {
    const execPath = execFileSync('git', ['--exec-path'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    // <root>/mingw64/libexec/git-core -> <root>/bin
    const bin = path.resolve(execPath, '..', '..', '..', 'bin');
    return fs.existsSync(path.join(bin, 'bash.exe')) ? bin : '';
  } catch {
    return '';
  }
}

function firstOnPath(names) {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (dir.trim() === '') continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return '';
}

function checkBash() {
  if (process.platform === 'win32') {
    // `.exe` only: a `bash.cmd` earlier on PATH is still bypassed by a lookup that appends `.exe`.
    const found = firstOnPath(['bash.exe']);
    if (found === '') return { status: 'missing', found };
    const windowsRoot = (process.env.SystemRoot ?? 'C:\\Windows').toLowerCase();
    const lower = found.toLowerCase();
    const launcher =
      lower.startsWith(path.join(windowsRoot, 'system32').toLowerCase()) ||
      lower.includes(`${path.sep}windowsapps${path.sep}`);
    return { status: launcher ? 'wsl' : 'ok', found };
  }
  try {
    const version = execFileSync('bash', ['-c', 'printf %s "$BASH_VERSION"'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return { status: version === '' ? 'missing' : 'ok', found: 'bash' };
  } catch {
    return { status: 'missing', found: '' };
  }
}

function reportBash(state) {
  if (state.status === 'ok') return;
  if (state.status === 'wsl') {
    const wanted = gitBashDir() || "the directory holding Git's bash.exe";
    process.stdout.write(
      `\nbash resolves to ${state.found}\n` +
        '  That is the WSL launcher: it cannot open a drive-letter path, so a hook that names\n' +
        '  `bash` in its first line never starts. Git itself is unaffected unless its build\n' +
        '  resolves the interpreter through PATH, which GitHub Desktop ships.\n' +
        `  Put ${wanted} first on the machine PATH (README, "Install it on a machine"),\n` +
        '  start a new shell, then re-run this check.\n',
    );
    return;
  }
  process.stdout.write(
    '\nbash not found on PATH — the gate cannot be run by hand.\n' +
      (process.platform === 'win32'
        ? "  Install Git for Windows; its `bin` directory must come first on the machine PATH.\n"
        : '  Install bash: pacman -S bash (Arch), apt install bash (Debian), brew install bash (macOS).\n'),
  );
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
  if (
    status === 'conflict' ||
    status === 'incomplete' ||
    (mode === 'check' && (status === 'missing' || status === 'stale'))
  ) {
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

// Removal leaves the interpreter alone: the machine had a bash before this installer existed.
const bashState = mode === 'remove' ? { status: 'ok', found: '' } : checkBash();
if (mode !== 'remove') {
  record(
    bashState.status === 'ok' ? 'ok' : `bash-${bashState.status}`,
    `bash = ${bashState.found || 'not found'}`,
  );
}

process.stdout.write(`source : ${root}\n`);
process.stdout.write(`agents : ${agentsHome}\n`);
process.stdout.write(`mode   : ${mode}\n\n`);
for (const [status, count] of Object.entries(counts)) process.stdout.write(`  ${status.padEnd(8)} ${count}\n`);

if (hooksPathState.current && hooksPathState.current !== hooksPathValue) {
  process.stdout.write(`\ncore.hooksPath was ${hooksPathState.current}\n`);
}

reportBash(bashState);

const bashOk = mode === 'remove' || bashState.status === 'ok';

if (problems.length > 0) {
  process.stdout.write('\n');
  for (const problem of problems) process.stdout.write(`${problem}\n`);
}

if ((counts.incomplete ?? 0) > 0) {
  process.stdout.write(
    `\ncore.hooksPath was not written: ${hookFile} does not exist.\n` +
      'The gate would be skipped on every commit. Repair the githooks link, then run this with --write.\n',
  );
  process.exit(1);
}

if (mode === 'check') {
  const failed = (counts.missing ?? 0) + (counts.stale ?? 0) + (counts.conflict ?? 0);
  if (failed > 0) {
    process.stdout.write('\nSome links or the hooks path are not in place — run with --write.\n');
    process.exit(1);
  }
  if (!bashOk) {
    process.stdout.write('\nLinks and the hooks path are in place; the bash check is not.\n');
    process.exit(1);
  }
  process.stdout.write('\nAll links and the machine-level hooks path are in place.\n');
}

// The Windows PATH step needs elevation, so --write stops short of claiming success rather than
// leaving a machine where the gate cannot be run by hand.
if (!bashOk) process.exit(1);
