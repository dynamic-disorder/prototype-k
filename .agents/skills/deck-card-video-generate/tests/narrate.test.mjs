import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lastSpeechEnd,
  needsSynthesis,
  overrunMessage,
  speechSlack,
  speechTotal,
} from '../lib/narrate.mjs';

test('a take is synthesised when missing, or when forced', () => {
  assert.equal(needsSynthesis({ force: false, hasAudio: true, hasCaptions: true }), false);
  assert.equal(needsSynthesis({ force: true, hasAudio: true, hasCaptions: true }), true);
  assert.equal(needsSynthesis({ force: false, hasAudio: false, hasCaptions: true }), true);
  assert.equal(needsSynthesis({ force: false, hasAudio: true, hasCaptions: false }), true);
});

test('slack above 0.8 s passes without a warning', () => {
  const { slack, warning } = speechSlack({ name: 's1', slot: 15 }, 12);

  assert.equal(slack, 3);
  assert.equal(warning, null);
});

test('slack below 0.8 s warns with the segment and both numbers', () => {
  const { slack, warning } = speechSlack({ name: 's2', slot: 15 }, 14.5);

  assert.ok(Math.abs(slack - 0.5) < 1e-9);
  assert.match(warning, /s2/);
  assert.match(warning, /speech 14\.50s/);
  assert.match(warning, /slack 0\.50s/);
  assert.match(warning, /shorten the text or widen the slot/);
});

test('speech totals and last end are computed across takes', () => {
  const meta = [
    { name: 's1', start: 0, duration: 10 },
    { name: 's2', start: 15, duration: 12.5 },
  ];

  assert.equal(speechTotal(meta), 22.5);
  assert.equal(lastSpeechEnd(meta), 27.5);
});

test('speech that fits reports nothing, overrun reports the gap', () => {
  assert.equal(overrunMessage(27.5, 30), null);
  assert.equal(overrunMessage(30, 30), null);

  const message = overrunMessage(31.25, 30);
  assert.match(message, /31\.25s/);
  assert.match(message, /30 s target/);
  assert.match(message, /re-plan the slots/);
});
