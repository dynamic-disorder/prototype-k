import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  composeMp4Args,
  composeWavArgs,
  durationWithinTolerance,
  measuredDuration,
  narrationInputs,
  timingMismatch,
} from '../lib/compose.mjs';

const config = {
  viewport: { width: 1600, height: 900 },
  fps: 30,
  preset: 'medium',
  crf: 20,
  audioBitrate: '192k',
};

test('narration inputs follow segment order', () => {
  const inputs = narrationInputs(
    [
      { name: 's1' },
      { name: 's2' },
    ],
    '/task/video',
  );

  assert.deepEqual(inputs, [
    '-i',
    path.join('/task/video', 'narration', 's1.mp3'),
    '-i',
    path.join('/task/video', 'narration', 's2.mp3'),
  ]);
});

test('a matching capture length is not a mismatch', () => {
  assert.equal(timingMismatch({ targetSeconds: 30 }, 30), null);
  assert.equal(timingMismatch({ targetSeconds: 30.0005 }, 30), null);
});

test('a different capture length reports both numbers and the fix', () => {
  const message = timingMismatch({ targetSeconds: 20 }, 30);

  assert.match(message, /recorded for 20 s/);
  assert.match(message, /composes 30 s/);
  assert.match(message, /--seconds 30/);
  assert.match(message, /--seconds 20/);
});

test('a legacy timing file without targetSeconds never mismatches', () => {
  assert.equal(timingMismatch({ t0Offset: 0.4 }, 30), null);
});

test('the wav mix passes the filter, the map and the sample rate', () => {
  const args = composeWavArgs({
    inputs: ['-i', 'a.mp3'],
    filter: 'amix=inputs=1',
    outFile: '/task/video/narration.wav',
  });

  assert.deepEqual(args.slice(0, 4), ['-y', '-v', 'error', '-i']);
  assert.ok(args.includes('-filter_complex'));
  assert.ok(args.includes('amix=inputs=1'));
  assert.deepEqual(args.slice(args.indexOf('-map'), args.indexOf('-map') + 2), ['-map', '[a]']);
  assert.ok(args.includes('pcm_s16le'));
  assert.deepEqual(args.slice(-3), ['-ar', '48000', '/task/video/narration.wav']);
});

test('the mp4 encode burns captions, trims the target and streams', () => {
  const args = composeMp4Args({
    timing: { t0Offset: 0.25 },
    config,
    target: 30,
    outputName: 'demo',
  });

  assert.deepEqual(args.slice(args.indexOf('-ss'), args.indexOf('-ss') + 2), ['-ss', '0.250']);
  assert.deepEqual(args.slice(args.indexOf('-t'), args.indexOf('-t') + 2), ['-t', '30']);
  assert.ok(args.some((arg) => arg.includes('ass=captions.ass')), 'caption burn-in filter present');
  assert.ok(args.includes('libx264'));
  assert.ok(args.includes('+faststart'));
  assert.equal(args.at(-1), 'demo.mp4');
  assert.equal(args[args.indexOf('-crf') + 1], '20');
  assert.equal(args[args.indexOf('-preset') + 1], 'medium');
});

test('duration tolerance is 0.2 s and rejects NaN', () => {
  assert.equal(durationWithinTolerance(30.1, 30), true);
  assert.equal(durationWithinTolerance(29.8, 30), true);
  assert.equal(durationWithinTolerance(30.3, 30), false);
  assert.equal(durationWithinTolerance(Number.NaN, 30), false);
});

test('ffprobe output yields a duration or NaN', () => {
  assert.equal(measuredDuration('duration=30.012\nsize=123'), 30.012);
  assert.ok(Number.isNaN(measuredDuration('size=123')));
});
