/**
 * The one place that decides whether the `bash` on this machine can run the gate.
 *
 * A git hook names its interpreter in its first line, and a git build that resolves that name through
 * PATH runs the first `bash` it finds. On Windows the first one is the WSL launcher, which cannot open
 * a drive-letter path, so the hook never starts — GitHub Desktop ships such a git. The installers report
 * this; neither repairs it, because the repair is one elevated edit of the machine PATH.
 *
 * Both entry points read this module: `install-global.mjs` (the linked checkout) and `install-bundle.mjs`
 * (the portable bundle), so a machine cannot pass one check and fail the other.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * Where a git installation keeps its bash: `<root>/mingw64/libexec/git-core` -> `<root>/bin/bash.exe`.
 * Returned as a path, not a verdict; the caller decides whether that file exists.
 */
export function gitBashFromExecPath(execPath) {
  return path.resolve(execPath, '..', '..', '..', 'bin', 'bash.exe');
}

/** True when the path names the WSL launcher rather than a real bash. */
export function isWindowsLauncher(bashPath, windowsRoot) {
  const normalizedBash = bashPath.replace(/\\/g, '/').toLowerCase();
  const normalizedRoot = windowsRoot.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
  return (
    normalizedBash.startsWith(`${normalizedRoot}/system32/`) ||
    normalizedBash.includes('/windowsapps/')
  );
}

/** The first executable of the given names on a PATH string, or an empty string. */
export function firstOnPath(names, searchPath) {
  for (const dir of searchPath.split(path.delimiter)) {
    if (dir.trim() === '') continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return '';
}

/**
 * The interpreter check. On Windows it looks for `bash.exe` only: a `.cmd` earlier on PATH is bypassed
 * by a lookup that appends `.exe`, which is exactly the trap a shim falls into. Everywhere else the
 * interpreter answers for itself.
 */
export function checkBash({
  platform = process.platform,
  searchPath = process.env.PATH ?? '',
  systemRoot = process.env.SystemRoot ?? 'C:\\Windows',
} = {}) {
  if (platform === 'win32') {
    const found = firstOnPath(['bash.exe'], searchPath);
    if (found === '') return { status: 'missing', found };
    return { status: isWindowsLauncher(found, systemRoot) ? 'wsl' : 'ok', found };
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

/** The `bin` directory of the git that is on PATH, when it carries a bash; otherwise an empty string. */
export function gitBashDir() {
  if (process.platform !== 'win32') return '';
  try {
    const execPath = execFileSync('git', ['--exec-path'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const candidate = gitBashFromExecPath(execPath);
    return fs.existsSync(candidate) ? path.dirname(candidate) : '';
  } catch {
    return '';
  }
}

/**
 * The lines an installer prints when the check failed, or an empty string when it passed. `wanted` is
 * the directory that fixes a `wsl` result; the caller supplies it so both installers name the same one.
 */
export function describeBash(state, wanted = '') {
  if (state.status === 'ok') return '';
  if (state.status === 'wsl') {
    const target = wanted || "the directory holding Git's bash.exe";
    return (
      `bash resolves to ${state.found}\n` +
      '  That is the WSL launcher: it cannot open a drive-letter path, so a hook that names\n' +
      '  `bash` in its first line never starts. Git itself is unaffected unless its build\n' +
      '  resolves the interpreter through PATH, which GitHub Desktop ships.\n' +
      `  Put ${target} first on the machine PATH (README, "Install it on a machine"),\n` +
      '  start a new shell, then run this check again.'
    );
  }
  return (
    'bash not found on PATH — the gate cannot be run by hand.\n' +
    (process.platform === 'win32'
      ? "  Install Git for Windows; its `bin` directory must come first on the machine PATH."
      : '  Install bash: pacman -S bash (Arch), apt install bash (Debian), brew install bash (macOS).')
  );
}
