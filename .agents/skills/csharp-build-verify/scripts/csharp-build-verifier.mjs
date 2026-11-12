#!/usr/bin/env node
// Thin runner for csharp-build-verifier: wires git, fs and dotnet into the pure lib.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { stripTrailingNewlines, verify } from './csharp-build-verifier-lib.mjs';

const git = (args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });
  } catch {
    return '';
  }
};

const listDir = (dir) => {
  try {
    return readdirSync(dir, { withFileTypes: true }).map((e) => ({ name: e.name, isDir: e.isDirectory() }));
  } catch {
    return null;
  }
};

// bash merges stderr into stdout in order, like `2>&1` in the original.
const build = (sln) => {
  const args = ['-c', 'dotnet build "$1" --no-incremental 2>&1', '_', sln];
  const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1024 * 1024 * 1024 };
  try {
    return { ok: true, output: stripTrailingNewlines(execFileSync('bash', args, opts)) };
  } catch (err) {
    return { ok: false, output: stripTrailingNewlines(String(err.stdout ?? '')) };
  }
};

const out = (line) => process.stdout.write(`${line}\n`);

process.exitCode = verify({ git, listDir, build, out });
