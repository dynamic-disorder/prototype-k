import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRunDir, timestamp } from '../lib/run-dir.mjs';

test('timestamp uses a Windows-safe format', () => {
  const value = timestamp(new Date(2026, 10, 9, 21, 5, 7, 7));
  assert.equal(value, '2026-11-09_21-05.007');
  assert.equal(value.includes(':'), false);
});

test('createRunDir creates unique folders under test-results', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-dir-'));
  try {
    const first = createRunDir(root);
    const second = createRunDir(root);
    assert.notEqual(first, second);
    assert.ok(fs.existsSync(first));
    assert.ok(fs.existsSync(second));
    assert.equal(path.basename(path.dirname(first)), 'test-results');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
