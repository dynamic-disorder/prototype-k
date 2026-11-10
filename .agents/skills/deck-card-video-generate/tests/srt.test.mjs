import test from 'node:test';
import assert from 'node:assert/strict';
import { cuesFromMetadata, srtFromMetadata, srtTimestamp, ticksToSeconds } from '../lib/srt.mjs';

test('ticksToSeconds divides by ten million', () => {
  assert.equal(ticksToSeconds(10_000_000), 1);
  assert.equal(ticksToSeconds(2_500_000), 0.25);
});

test('srtTimestamp formats correctly', () => {
  assert.equal(srtTimestamp(0), '00:00:00,000');
  assert.equal(srtTimestamp(3661.5), '01:01:01,500');
});

test('cuesFromMetadata reads sentence boundaries', () => {
  const metadata = {
    Metadata: [
      {
        Type: 'SentenceBoundary',
        Data: { Offset: 1_000_000, Duration: 10_000_000, text: { Text: 'First sentence.' } },
      },
      {
        Type: 'SentenceBoundary',
        Data: { Offset: 12_000_000, Duration: 5_000_000, text: { Text: 'Second sentence.' } },
      },
    ],
  };
  const cues = cuesFromMetadata(metadata);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 0.1);
  assert.equal(cues[0].end, 1.1);
  assert.equal(cues[1].text, 'Second sentence.');
});

test('srtFromMetadata writes numbered cues', () => {
  const metadata = {
    Metadata: [
      {
        Type: 'SentenceBoundary',
        Data: { Offset: 0, Duration: 10_000_000, text: { Text: 'Hello.' } },
      },
    ],
  };
  const srt = srtFromMetadata(metadata);
  assert.match(srt, /^1\n00:00:00,000 --> 00:00:01,000\nHello\.\n$/);
});
