#!/usr/bin/env node
// Gather the mechanical inputs a commit message needs: the diff to summarize,
// the ticket implied by the branch name, and the list of changed files.
// Pure data extraction - no message writing here.
import { spawnSync } from 'node:child_process';
import { fetchContext } from './git-commit-context-fetch-lib.mjs';

// latin1 keeps the diff byte-identical on the way through, whatever encoding the files use.
const git = (args, { quiet = false } = {}) => {
  const r = spawnSync('git', args, {
    encoding: 'latin1',
    stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'inherit'],
    maxBuffer: 1 << 30,
  });
  return { status: r.status ?? 1, stdout: r.stdout ?? '' };
};

const { lines, code } = fetchContext(git);
process.stdout.write(Buffer.from(lines.map((line) => `${line}\n`).join(''), 'latin1'));
process.exitCode = code;
