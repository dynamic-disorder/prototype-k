import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEncodeFilter, buildNarrationFilter, parseFfprobeDuration } from '../lib/media.mjs';

test('narration filter delays each take at its absolute start', () => {
  const filter = buildNarrationFilter(
    [
      { name: 's1', start: 0 },
      { name: 's2', start: 15 },
    ],
    30,
  );
  assert.match(filter, /\[0:a\]aresample=48000,adelay=0:all=1\[a0\]/);
  assert.match(filter, /\[1:a\]aresample=48000,adelay=15000:all=1\[a1\]/);
  assert.match(filter, /amix=inputs=2:duration=longest:normalize=0/);
  assert.match(filter, /apad=whole_dur=30,atrim=0:30\[a\]/);
});

test('encode filter applies fps, scale and captions', () => {
  const filter = buildEncodeFilter({ fps: 30, width: 1600, height: 900 });
  assert.equal(filter, '[0:v]fps=30,scale=1600:900,ass=captions.ass[v]');
});

test('ffprobe duration is parsed', () => {
  assert.equal(parseFfprobeDuration('duration=30.012\nsize=123'), 30.012);
  assert.equal(parseFfprobeDuration('size=123'), null);
});
