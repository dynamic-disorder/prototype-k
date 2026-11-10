import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('an empty task folder fails the guard with every missing input named', () => {
  const task = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
  try {
    const result = spawnSync(process.execPath, ['scripts/check_inputs.mjs', task], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /video\.config\.json is missing/);
    assert.match(result.stderr, /segments\.json is missing/);
    assert.match(result.stderr, /record\.mjs is missing/);
  } finally {
    fs.rmSync(task, { recursive: true, force: true });
  }
});
