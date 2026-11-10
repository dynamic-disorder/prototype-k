/**
 * Deck end-to-end test: record the six wireframes in tests/resources/for_video as a
 * 20 s narrated deck, then compose the captioned MP4.
 *
 * Run from the skill folder: node tests/deck-e2e.mjs
 * Needs ffmpeg/ffprobe, Playwright Chromium, and network access to the TTS service.
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createRunDir } from '../lib/run-dir.mjs';

const execFileAsync = promisify(execFile);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runDir = process.env.TEST_RUN_DIR ? path.resolve(process.env.TEST_RUN_DIR) : createRunDir(root);
fs.mkdirSync(runDir, { recursive: true });
const deckDir = [
  path.join(root, 'tests', 'resources', 'for_video'),
  path.join(root, 'tests', 'resources', 'test_decks'),
  path.join(root, 'tests', 'test_decks'),
].find((dir) => fs.existsSync(path.join(dir, 'deck.html')));
if (!deckDir) throw new Error('deck fixture folder not found');
const task = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-e2e-'));
const outDir = path.join(task, 'video');
const framesDir = path.join(task, 'frames');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(framesDir, { recursive: true });

const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
const ffprobe = process.env.FFPROBE ?? 'ffprobe';

async function run(command, args, options = {}) {
  console.log(`$ ${command} ${args.join(' ')}`);
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: root,
      maxBuffer: 20 * 1024 * 1024,
      ...options,
    });
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
};

const server = http.createServer((request, response) => {
  const requested = decodeURIComponent(new URL(request.url, 'http://local').pathname);
  const file = path.join(deckDir, requested === '/' ? 'deck.html' : requested);
  const relative = path.relative(deckDir, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    response.writeHead(403);
    response.end('forbidden');
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end('not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)] ?? 'application/octet-stream' });
    response.end(data);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const recordStart = '// ---------------------------------------------------------------- BEATS ----';
const recordEnd = '// ------------------------------------------------------------- END BEATS ----';
const beats = [
  'await at(3.5, "cards", () => page.evaluate(() => window.showSlide(1)));',
  'await at(7.0, "another list", () => page.evaluate(() => window.showSlide(2)));',
  'await at(10.0, "more cards", () => page.evaluate(() => window.showSlide(3)));',
  'await at(13.5, "still a list", () => page.evaluate(() => window.showSlide(4)));',
  'await at(16.5, "big card", () => page.evaluate(() => window.showSlide(5)));',
].join('\n');

const template = fs.readFileSync(path.join(root, 'scripts', 'record.mjs'), 'utf8');
const recordSource = `${template.slice(0, template.indexOf(recordStart) + recordStart.length)}\n${beats}\n${template.slice(
  template.indexOf(recordEnd),
)}`;

// Keep the executable record file inside the skill tree so its Playwright import
// resolves from this folder's node_modules, while the config lives in the task.
const recordDir = path.join(root, 'tests', '.deck-run');
fs.mkdirSync(recordDir, { recursive: true });
const recordFile = path.join(recordDir, 'record.mjs');
fs.writeFileSync(recordFile, recordSource, 'utf8');
fs.writeFileSync(path.join(task, 'record.mjs'), recordSource, 'utf8');

try {
  const config = {
    baseUrl: `http://127.0.0.1:${port}/deck.html`,
    outDir: 'video',
    viewport: { width: 1600, height: 900 },
    fps: 30,
    targetSeconds: 20,
    settleMs: 600,
    voice: 'en-GB-RyanNeural',
    rate: '-4%',
    pitch: '-2Hz',
    crf: 28,
    preset: 'ultrafast',
    audioBitrate: '96k',
    captions: { font: 'Segoe UI', size: 34, maxChars: 76 },
  };

  const segments = [
    { name: 's1', start: 0, slot: 6.67, text: 'A list stacks every item the same way: a box and a line.' },
    { name: 's2', start: 6.67, slot: 6.67, text: 'Cards keep the items, giving each a surface and room for detail.' },
    { name: 's3', start: 13.34, slot: 6.66, text: 'The big card is the destination: an image, a title, and clear actions.' },
  ];

  fs.writeFileSync(path.join(task, 'video.config.json'), JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(task, 'segments.json'), JSON.stringify(segments, null, 2));

  await run(process.execPath, ['scripts/check_inputs.mjs', task]);
  await run(process.execPath, [recordFile], { cwd: task });
  await run(process.execPath, ['scripts/narrate.mjs', task]);
  await run(process.execPath, ['scripts/compose.mjs', task, '--name', 'deck-demo-20s']);

  const demo = path.join(outDir, 'deck-demo-20s.mp4');
  const duration = Number(
    (
      await execFileAsync(
        ffprobe,
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', demo],
        { encoding: 'utf8' },
      )
    ).stdout.trim(),
  );
  if (!(Math.abs(duration - config.targetSeconds) <= 0.2)) {
    throw new Error(`duration ${duration}s drifted from ${config.targetSeconds}s`);
  }

  const captions = fs.readFileSync(path.join(outDir, 'captions.ass'), 'utf8');
  if ((captions.match(/^Dialogue:/gm) ?? []).length !== segments.length) {
    throw new Error('captions.ass does not hold one cue per segment');
  }

  const frames = [];
  for (const second of [2, 5, 8, 11, 14, 17]) {
    const file = path.join(framesDir, `frame-${second}.png`);
    await run(ffmpeg, ['-y', '-v', 'error', '-ss', String(second), '-i', demo, '-frames:v', '1', file]);
    const bytes = fs.readFileSync(file);
    if (bytes.length < 5000) throw new Error(`frame at ${second}s looks blank`);
    frames.push({ second, file, hash: createHash('sha256').update(bytes).digest('hex') });
  }
  for (const [a, b] of [[0, 1], [2, 3], [4, 5]]) {
    if (frames[a].hash === frames[b].hash) {
      throw new Error(`frames ${frames[a].second}s and ${frames[b].second}s are identical`);
    }
  }

  console.log(
    `deck e2e ok: ${duration.toFixed(2)}s output, ${segments.length} cues, ${frames.length} frames all distinct by pair`,
  );

  const resultsDir = path.join(runDir, 'deck-demo-20s');
  fs.mkdirSync(resultsDir, { recursive: true });
  const copies = [
    [demo, `${path.basename(resultsDir)}.mp4`],
    [path.join(outDir, 'captions.ass'), 'captions.ass'],
    [path.join(outDir, 'narration', 'meta.json'), 'meta.json'],
    [path.join(task, 'video.config.json'), 'video.config.json'],
    [path.join(task, 'segments.json'), 'segments.json'],
    [path.join(task, 'record.mjs'), 'record.mjs'],
    [path.join(deckDir, 'deck.html'), 'deck.html'],
  ];
  for (const file of fs.readdirSync(deckDir)) {
    if (file.endsWith('.webp')) copies.push([path.join(deckDir, file), file]);
  }
  for (const name of ['s1', 's2', 's3']) {
    copies.push([path.join(outDir, 'narration', `${name}.srt`), `${name}.srt`]);
    copies.push([path.join(outDir, 'narration', `${name}.mp3`), `${name}.mp3`]);
  }
  for (const frame of frames) copies.push([frame.file, path.basename(frame.file)]);
  for (const [source, name] of copies) fs.copyFileSync(source, path.join(resultsDir, name));
} finally {
  server.close();
  if (process.env.KEEP === '1') {
    console.log(`kept ${task}`);
  } else {
    fs.rmSync(task, { recursive: true, force: true });
    fs.rmSync(recordDir, { recursive: true, force: true });
  }
}
