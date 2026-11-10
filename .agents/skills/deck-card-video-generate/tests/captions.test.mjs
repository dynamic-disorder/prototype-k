import test from 'node:test';
import assert from 'node:assert/strict';
import { assTime, buildAss, buildCues, parseSrt, stampToSeconds, wrapText } from '../lib/captions.mjs';

test('stampToSeconds converts SRT timestamps', () => {
  assert.equal(stampToSeconds('00:00:02,500'), 2.5);
  assert.equal(stampToSeconds('01:02:03,004'), 3723.004);
});

test('assTime formats and rounds correctly', () => {
  assert.equal(assTime(0), '0:00:00.00');
  assert.equal(assTime(3661.5), '1:01:01.50');
  assert.equal(assTime(0.999), '0:00:01.00');
});

test('wrapText breaks at the width budget', () => {
  assert.equal(wrapText('one two three four', 7), 'one two\\Nthree\\Nfour');
  assert.equal(wrapText('  too   many   spaces  ', 80), 'too many spaces');
});

test('parseSrt reads every cue', () => {
  const srt = [
    '1',
    '00:00:00,100 --> 00:00:02,000',
    'Hello world.',
    '',
    '2',
    '00:00:02,500 --> 00:00:04,000',
    'Second cue.',
    '',
  ].join('\n');
  const cues = parseSrt(srt);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 0.1);
  assert.equal(cues[0].text, 'Hello world.');
  assert.equal(cues[1].start, 2.5);
});

test('buildCues offsets each segment and clamps the end to the target', () => {
  const meta = [
    { name: 's1', start: 0 },
    { name: 's2', start: 10 },
  ];
  const srtBySegment = {
    s1: '1\n00:00:00,100 --> 00:00:02,000\nFirst.\n',
    s2: '1\n00:00:00,100 --> 00:00:20,000\nSecond.\n',
  };
  const cues = buildCues(meta, srtBySegment, 30);
  assert.equal(cues[0].start, 0.1);
  assert.equal(cues[1].start, 10.1);
  assert.equal(cues[1].end, 30);
});

test('buildCues removes overlaps by shifting the later cue', () => {
  const meta = [{ name: 's1', start: 0 }];
  const srt = [
    '1',
    '00:00:00,000 --> 00:00:02,000',
    'A',
    '',
    '2',
    '00:00:01,500 --> 00:00:03,000',
    'B',
    '',
  ].join('\n');
  const cues = buildCues(meta, { s1: srt }, 30);
  assert.equal(cues[1].start, 2.02);
});

test('buildAss renders the style and dialogue lines', () => {
  const ass = buildAss({
    cues: [{ start: 0, end: 2, text: 'Hello world.' }],
    width: 1600,
    height: 900,
    captions: { font: 'Segoe UI', size: 34, maxChars: 76 },
  });
  assert.match(ass, /PlayResX: 1600/);
  assert.match(ass, /Style: Caption,Segoe UI,34,/);
  assert.match(ass, /Dialogue: 0,0:00:00\.00,0:00:02\.00,Caption,,0,0,0,,\{\\fad\(120,120\)\}Hello world\./);
});
