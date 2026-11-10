#!/usr/bin/env node
/** Run the unit suite and write its output into a timestamped run folder. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunDir } from '../lib/run-dir.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runDir = createRunDir(root);
const startedAt = new Date();
const started = Date.now();
const result = spawnSync(process.execPath, ['--test'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
fs.writeFileSync(path.join(runDir, 'unit.txt'), output, 'utf8');
process.stdout.write(output);

const status = result.status ?? 1;
fs.writeFileSync(
  path.join(runDir, 'run.json'),
  JSON.stringify(
    {
      kind: 'unit',
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - started,
      status,
    },
    null,
    2,
  ),
  'utf8',
);

if (status !== 0) process.exit(status);
