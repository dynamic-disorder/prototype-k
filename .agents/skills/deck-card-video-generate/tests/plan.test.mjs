import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TARGET,
  checkTarget,
  resolveTarget,
  validateConfig,
  validateSegments,
} from '../lib/plan.mjs';

const validConfig = () => ({
  baseUrl: 'http://127.0.0.1:3000',
  outDir: 'video',
  viewport: { width: 1600, height: 900 },
  fps: 30,
  targetSeconds: 30,
  settleMs: 600,
  voice: 'en-GB-RyanNeural',
  rate: '-4%',
  pitch: '-2Hz',
  crf: 20,
  preset: 'slow',
  audioBitrate: '160k',
  captions: { font: 'Segoe UI', size: 34, maxChars: 76 },
});

const validSegments = () => [
  { name: 's1', start: 0, slot: 15, text: 'First half.' },
  { name: 's2', start: 15, slot: 15, text: 'Second half.' },
];

test('a complete config passes and returns baseUrl and target', () => {
  const result = validateConfig(validConfig());
  assert.deepEqual(result.errors, []);
  assert.equal(result.baseUrl, 'http://127.0.0.1:3000');
  assert.equal(result.target, 30);
  assert.equal(result.source, 'config');
});

test('a config without targetSeconds falls back to the default', () => {
  const config = { ...validConfig() };
  delete config.targetSeconds;
  const result = validateConfig(config);
  assert.deepEqual(result.errors, []);
  assert.equal(result.target, DEFAULT_TARGET);
  assert.equal(result.source, 'default');
  assert.equal(resolveTarget(config).target, 120);
});

test('--seconds beats targetSeconds in the config', () => {
  const result = validateConfig(validConfig(), 45);
  assert.deepEqual(result.errors, []);
  assert.equal(result.target, 45);
  assert.equal(result.source, 'flag');
  assert.deepEqual(resolveTarget(validConfig(), 45), { target: 45, source: 'flag' });
});

test('an out-of-range --seconds is rejected', () => {
  const result = validateConfig(validConfig(), 10);
  assert.match(result.errors.join('\n'), /--seconds 10 is outside 15-300 s/);
  assert.equal(result.target, null);
});

test('resolveTarget throws on an out-of-range length', () => {
  assert.throws(() => resolveTarget(validConfig(), 600), /outside 15-300 s/);
  assert.throws(() => resolveTarget({ targetSeconds: 10 }), /outside 15-300 s/);
});

test('checkTarget names the source of the value', () => {
  assert.equal(checkTarget(30, '--seconds'), null);
  assert.match(checkTarget('30', '--seconds'), /--seconds must be a number/);
  assert.match(checkTarget(301, 'targetSeconds'), /targetSeconds 301 is outside 15-300 s/);
});

test('15 s is accepted', () => {
  const config = { ...validConfig(), targetSeconds: 15 };
  assert.deepEqual(validateConfig(config).errors, []);
});

test('target below 15 s is rejected', () => {
  const config = { ...validConfig(), targetSeconds: 10 };
  assert.match(validateConfig(config).errors.join('\n'), /outside 15-300 s/);
});

test('target above 300 s is rejected', () => {
  const config = { ...validConfig(), targetSeconds: 600 };
  assert.match(validateConfig(config).errors.join('\n'), /outside 15-300 s/);
});

test('a non-http baseUrl is rejected', () => {
  const config = { ...validConfig(), baseUrl: 'file:///tmp/app.html' };
  assert.match(validateConfig(config).errors.join('\n'), /not an http\(s\) URL/);
});

test('missing voice is rejected', () => {
  const config = { ...validConfig() };
  delete config.voice;
  assert.match(validateConfig(config).errors.join('\n'), /voice is missing/);
});

test('a complete segments file passes', () => {
  const result = validateSegments(validSegments(), 30);
  assert.deepEqual(result.errors, []);
});

test('slots that do not sum to the target are rejected', () => {
  const segments = [
    { name: 's1', start: 0, slot: 10, text: 'First.' },
    { name: 's2', start: 10, slot: 10, text: 'Second.' },
  ];
  assert.match(validateSegments(segments, 30).errors.join('\n'), /slots end at 20 s/);
});

test('slots are checked against the default when no length is given', () => {
  const config = { ...validConfig() };
  delete config.targetSeconds;
  const { target } = validateConfig(config);
  const errors = validateSegments(validSegments(), target).errors;
  assert.match(errors.join('\n'), /slots end at 30 s, target is 120 s/);
});

test('a start that skips the previous slot is rejected', () => {
  const segments = validSegments();
  segments[1].start = 20;
  assert.match(validateSegments(segments, 30).errors.join('\n'), /does not follow the previous slots/);
});

test('duplicate segment names are rejected', () => {
  const segments = validSegments();
  segments[1].name = 's1';
  assert.match(validateSegments(segments, 30).errors.join('\n'), /duplicated/);
});

test('empty segment text is rejected', () => {
  const segments = validSegments();
  segments[1].text = '   ';
  assert.match(validateSegments(segments, 30).errors.join('\n'), /text is missing or empty/);
});

test('an empty segments array is rejected', () => {
  assert.match(validateSegments([], 30).errors.join('\n'), /segments\.json is empty/);
});
