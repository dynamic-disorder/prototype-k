import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeBaseName } from '../lib/names.mjs';

test('a normal case name is unchanged', () => {
  assert.equal(sanitizeBaseName('deck-demo-20s'), 'deck-demo-20s');
});

test('directory components are dropped', () => {
  assert.equal(sanitizeBaseName('../../evil'), 'evil');
  assert.equal(sanitizeBaseName('some/dir/name'), 'name');
});

test('parent-directory names fall back', () => {
  assert.equal(sanitizeBaseName('..'), 'demo');
  assert.equal(sanitizeBaseName('.'), 'demo');
});

test('spaces and unsafe characters become hyphens', () => {
  assert.equal(sanitizeBaseName('a b'), 'a-b');
  assert.equal(sanitizeBaseName('a:b?c'), 'a-b-c');
});

test('empty input falls back', () => {
  assert.equal(sanitizeBaseName(''), 'demo');
  assert.equal(sanitizeBaseName('   '), 'demo');
});

test('leading dots are removed', () => {
  assert.equal(sanitizeBaseName('.hidden'), 'hidden');
});

test('Windows device names are prefixed', () => {
  assert.equal(sanitizeBaseName('CON'), '_CON');
  assert.equal(sanitizeBaseName('con.mp4'), '_con.mp4');
});

test('a long name is capped at 80 characters', () => {
  assert.equal(sanitizeBaseName('x'.repeat(200)).length, 80);
});

test('trailing dots and hyphens are removed', () => {
  assert.equal(sanitizeBaseName('name...'), 'name');
  assert.equal(sanitizeBaseName('name---'), 'name');
});
