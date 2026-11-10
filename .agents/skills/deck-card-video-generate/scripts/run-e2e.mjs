#!/usr/bin/env node
/** Run both e2e takes into one timestamped run folder. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunDir } from '../lib/run-dir.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runDir = createRunDir(root);
const jobs = [
  ['tests/deck-e2e.mjs', 'deck-e2e.txt'],
  ['tests/e2e.mjs', 'video-e2e.txt'],
];

for (const [script, log] of jobs) {
  const startedAt = new Date();
  const started = Date.now();
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, TEST_RUN_DIR: runDir },
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  fs.writeFileSync(path.join(runDir, log), output, 'utf8');
  process.stdout.write(output);
  fs.writeFileSync(
    path.join(runDir, log.replace(/\.txt$/, '.json')),
    JSON.stringify(
      {
        kind: path.basename(script, '.mjs'),
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - started,
        status: result.status ?? 1,
      },
      null,
      2,
    ),
    'utf8',
  );

  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

console.log(`run: ${runDir}`);
