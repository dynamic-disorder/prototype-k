#!/usr/bin/env node
// Resolves a branch name / PR URL / ticket into a base branch, head branch, PR number,
// ticket and filtered diff file list. Used by the git-code-review skill.
// Usage: node resolve-review-target.mjs "<target> [free-text instructions]"
// Env in: REPO, TICKET_PR_URL, TICKET_BRANCH. Exit: 0 ok, 1 error, 2 UNRECOGNIZED_TARGET.
// Runner only: args, git/gh/node processes, output, exit code. Logic lives in resolve-review-target-lib.mjs.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveReviewTarget } from './resolve-review-target-lib.mjs';

const MAX_BUFFER = 256 * 1024 * 1024;
const RESOLVE_FEEDBACK = fileURLToPath(new URL('../git-code-review-resolve-feedbacks/resolve-feedback.mjs', import.meta.url));

function run(file, args, stderr) {
  const r = spawnSync(file, args, { encoding: 'utf8', maxBuffer: MAX_BUFFER, stdio: ['ignore', 'pipe', stderr] });
  return { status: r.status ?? 127, stdout: r.stdout ?? '' };
}

// gh goes through bash so a `gh` shell script on PATH (a test fake) resolves like gh.exe does.
const deps = {
  git: (args, { stderr }) => run('git', args, stderr),
  gh: (args, { stderr }) => run('bash', ['-c', 'exec gh "$@"', 'gh', ...args], stderr),
  openThreads: (owner, repo, prNumber) =>
    run('node', [RESOLVE_FEEDBACK, 'fetch', owner, repo, prNumber], 'ignore').stdout,
};

const env = {
  REPO: process.env.REPO ?? '',
  TICKET_PR_URL: process.env.TICKET_PR_URL ?? '',
  TICKET_BRANCH: process.env.TICKET_BRANCH ?? '',
};

try {
  const { stdout, stderr, code } = resolveReviewTarget(process.argv[2] ?? '', env, deps);
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  process.exitCode = code;
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
