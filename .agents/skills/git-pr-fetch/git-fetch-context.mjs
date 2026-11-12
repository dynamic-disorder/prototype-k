#!/usr/bin/env node
// Fetch git/GitHub context from a PR URL, branch name, or commit.
// Usage: node git-fetch-context.mjs <PR_URL|BRANCH|COMMIT>
// Runner only: args, git/gh processes, output, exit code. Logic lives in git-fetch-context-lib.mjs.

import { spawnSync } from 'node:child_process';
import { runFetchContext } from './git-fetch-context-lib.mjs';

const MAX_BUFFER = 256 * 1024 * 1024;
const stdioFor = (stderr) => ['ignore', 'pipe', stderr === 'merge' ? 'pipe' : stderr];

function run(file, args, stderr) {
  const r = spawnSync(file, args, { encoding: 'utf8', maxBuffer: MAX_BUFFER, stdio: stdioFor(stderr) });
  const stdout = (r.stdout ?? '') + (stderr === 'merge' ? (r.stderr ?? '') : '');
  return { status: r.status ?? 127, stdout };
}

// gh goes through bash so a `gh` shell script on PATH (a test fake) resolves like gh.exe does.
const deps = {
  git: (args, { stderr }) => run('git', args, stderr),
  gh: (args, { stderr }) => run('bash', ['-c', 'exec gh "$@"', 'gh', ...args], stderr),
  ghAvailable: () => spawnSync('bash', ['-c', 'command -v gh'], { stdio: 'ignore' }).status === 0,
};

try {
  const { stdout, code } = runFetchContext(process.argv[2] ?? '', process.argv[1], deps);
  process.stdout.write(stdout);
  process.exitCode = code;
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
