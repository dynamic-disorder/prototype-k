import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countBeats } from '../lib/beats.mjs';

const template = readFileSync(new URL('../scripts/record.mjs', import.meta.url), 'utf8');

test('template beats are comments and count 0', () => {
  const { count, found } = countBeats(template);
  assert.equal(found, true);
  assert.equal(count, 0);
});

test('an uncommented at call inside the markers counts', () => {
  const source = template.replace(
    /(\/\/\s*-{3,}\s*BEATS\b)/,
    '$1\nawait at(0.5, "first paint", async () => {});',
  );
  const { count, found } = countBeats(source);
  assert.equal(found, true);
  assert.equal(count, 1);
});

test('two uncommented at calls count twice', () => {
  const source = [
    '// ---------------------------------------------------------------- BEATS ----',
    'await at(1, "one", fn);',
    'await at(2, "two", fn);',
    '// ------------------------------------------------------------- END BEATS ----',
  ].join('\n');
  assert.equal(countBeats(source).count, 2);
});

test('commented at calls never count', () => {
  const source = [
    '// ---------------------------------------------------------------- BEATS ----',
    '// await at(1, "one", fn);',
    '//await at(2, "two", fn);',
    'await at(3, "three", fn);',
    '// ------------------------------------------------------------- END BEATS ----',
  ].join('\n');
  assert.equal(countBeats(source).count, 1);
});

test('missing markers are reported', () => {
  const { count, found } = countBeats('const x = 1;\n');
  assert.equal(found, false);
  assert.equal(count, 0);
});

test('a header comment mentioning BEATS does not open the block', () => {
  const source = [
    '// BEATS block, then run node record.mjs',
    'async function at(sec, label, fn) {}',
    '// ---------------------------------------------------------------- BEATS ----',
    '// ------------------------------------------------------------- END BEATS ----',
  ].join('\n');
  assert.equal(countBeats(source).count, 0);
});
