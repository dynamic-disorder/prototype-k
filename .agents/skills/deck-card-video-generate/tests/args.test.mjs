import test from 'node:test';
import assert from 'node:assert/strict';
import { takeSeconds } from '../lib/args.mjs';

test('no --seconds leaves the rest of argv alone', () => {
  assert.deepEqual(takeSeconds(['task', '--force']), {
    seconds: undefined,
    error: null,
    rest: ['task', '--force'],
  });
});

test('--seconds is read as a number and removed from argv', () => {
  assert.deepEqual(takeSeconds(['task', '--seconds', '45', '--name', 'demo']), {
    seconds: 45,
    error: null,
    rest: ['task', '--name', 'demo'],
  });
});

test('a fractional length is kept as given', () => {
  assert.equal(takeSeconds(['--seconds', '17.5']).seconds, 17.5);
});

test('--seconds without a value is an error', () => {
  const result = takeSeconds(['task', '--seconds']);
  assert.match(result.error, /needs a length in seconds/);
  assert.equal(result.seconds, undefined);
});

test('--seconds followed by another flag is an error', () => {
  assert.match(takeSeconds(['--seconds', '--force']).error, /needs a length in seconds/);
});

test('a non-numeric --seconds is an error', () => {
  assert.match(takeSeconds(['--seconds', 'long']).error, /not a number: long/);
});
