import test from 'node:test';
import assert from 'node:assert/strict';
import { isMain } from '../lib/cli.mjs';

test('a test file is the entry point while it runs', () => {
  assert.equal(isMain(import.meta.url), true);
});

test('another module URL is not the entry point', () => {
  assert.equal(isMain('file:///definitely/not/this-script.mjs'), false);
});
