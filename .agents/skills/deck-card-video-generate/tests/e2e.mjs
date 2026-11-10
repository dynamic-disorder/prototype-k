/**
 * End-to-end smoke test from the two card images in tests/resources/for_demo,
 * with two narration segments covering the 15 s.
 *
 * Requires ffmpeg/ffprobe and network access to the Edge TTS service.
 * Run manually from the skill folder: node tests/e2e.mjs
 */
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunDir } from '../lib/run-dir.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoDir = [
  path.join(root, 'tests', 'resources', 'for_demo'),
  path.join(root, 'tests', 'resources', 'test_decks_demo'),
  path.join(root, 'tests', 'test_decks_demo'),
].find((dir) => fs.existsSync(path.join(dir, 'Shakespeare-Playing-Cards.webp')));
if (!demoDir) throw new Error('card fixture folder not found');
const runDir = process.env.TEST_RUN_DIR ? path.resolve(process.env.TEST_RUN_DIR) : createRunDir(root);
fs.mkdirSync(runDir, { recursive: true });
const task = fs.mkdtempSync(path.join(os.tmpdir(), 'video-e2e-'));
const outDir = path.join(task, 'video');
const framesDir = path.join(task, 'frames');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(framesDir, { recursive: true });

const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
const ffprobe = process.env.FFPROBE ?? 'ffprobe';

function run(command, args) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><title>Demo</title><h1>Demo</h1>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

try {
  const config = {
    baseUrl: `http://127.0.0.1:${port}`,
    outDir: 'video',
    viewport: { width: 1600, height: 900 },
    fps: 30,
    targetSeconds: 15,
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
    {
      name: 's1',
      start: 0,
      slot: 7.5,
      text: 'Two card decks side by side: Shakespeare and Writers Genius, each a gallery of portraits.',
    },
    {
      name: 's2',
      start: 7.5,
      slot: 7.5,
      text: "Shakespeare's deck sets the playwright in red and gold; Writers Genius shows portraits.",
    },
  ];

  fs.writeFileSync(path.join(task, 'video.config.json'), JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(task, 'segments.json'), JSON.stringify(segments, null, 2));
  fs.writeFileSync(path.join(outDir, 'timing.json'), JSON.stringify({ t0Offset: 0, timing: [] }, null, 2));

  const recordSource = fs
    .readFileSync(path.join(root, 'scripts', 'record.mjs'), 'utf8')
    .replace(/(\/\/\s*-{3,}\s*BEATS\b)/, '$1\nawait at(0.5, "first paint", async () => {});');
  fs.writeFileSync(path.join(task, 'record.mjs'), recordSource);

  const shakespeare = path.join(demoDir, 'Shakespeare-Playing-Cards.webp');
  const writers = path.join(demoDir, 'Genius-Writers-Genius-Playing-Cards.webp');
  const slides =
    '[0:v]scale=620:620,setsar=1,fps=30,trim=duration=5,setpts=PTS-STARTPTS[a];' +
    '[1:v]scale=620:620,setsar=1,fps=30,trim=duration=5,setpts=PTS-STARTPTS[b];' +
    '[a][b]hstack=inputs=2,pad=1600:900:(ow-iw)/2:(oh-ih)/2:color=0xf5f3ee[v0];' +
    '[2:v]scale=760:760,setsar=1,fps=30,trim=duration=5,setpts=PTS-STARTPTS,pad=1600:900:(ow-iw)/2:(oh-ih)/2:color=0xf5f3ee[v1];' +
    '[3:v]scale=760:760,setsar=1,fps=30,trim=duration=5,setpts=PTS-STARTPTS,pad=1600:900:(ow-iw)/2:(oh-ih)/2:color=0xf5f3ee[v2];' +
    '[v0][v1][v2]concat=n=3:v=1:a=0,format=yuv420p[v]';

  run(ffmpeg, [
    '-y',
    '-v',
    'error',
    '-loop',
    '1',
    '-t',
    '15',
    '-i',
    shakespeare,
    '-loop',
    '1',
    '-t',
    '15',
    '-i',
    writers,
    '-loop',
    '1',
    '-t',
    '15',
    '-i',
    shakespeare,
    '-loop',
    '1',
    '-t',
    '15',
    '-i',
    writers,
    '-filter_complex',
    slides,
    '-map',
    '[v]',
    '-c:v',
    'libvpx',
    '-b:v',
    '500k',
    '-deadline',
    'realtime',
    '-cpu-used',
    '8',
    '-t',
    '15',
    path.join(outDir, 'raw.webm'),
  ]);

  await new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      ['scripts/check_inputs.mjs', task],
      { cwd: root },
      (error, stdout, stderr) => {
        process.stdout.write(stdout);
        process.stderr.write(stderr);
        if (error) reject(new Error(`check_inputs failed: ${error.message}`));
        else resolve();
      },
    );
    child.on('error', reject);
  });

  run(process.execPath, ['scripts/narrate.mjs', task]);
  run(process.execPath, ['scripts/compose.mjs', task, '--name', 'video-demo-15s']);

  const demo = path.join(outDir, 'video-demo-15s.mp4');
  const duration = Number(
    execFileSync(
      ffprobe,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        demo,
      ],
      { encoding: 'utf8' },
    ).trim(),
  );
  if (!(Math.abs(duration - config.targetSeconds) <= 0.2)) {
    throw new Error(`duration ${duration}s drifted from ${config.targetSeconds}s`);
  }

  const ass = fs.readFileSync(path.join(outDir, 'captions.ass'), 'utf8');
  const cues = (ass.match(/^Dialogue:/gm) ?? []).length;
  if (cues !== segments.length) {
    throw new Error(`expected ${segments.length} caption cues, found ${cues}`);
  }

  const meta = JSON.parse(fs.readFileSync(path.join(outDir, 'narration', 'meta.json'), 'utf8'));
  if (meta.length !== segments.length) {
    throw new Error(`expected ${segments.length} narration segments, found ${meta.length}`);
  }
  const total = meta.reduce((sum, seg) => sum + seg.duration, 0);
  if (!(total > config.targetSeconds * 0.8)) {
    throw new Error(`narration covers only ${total.toFixed(2)}s of ${config.targetSeconds}s`);
  }

  const frames = [];
  for (const second of [2, 7, 12]) {
    const file = path.join(framesDir, `frame-${second}.png`);
    run(ffmpeg, ['-y', '-v', 'error', '-ss', String(second), '-i', demo, '-frames:v', '1', file]);
    const bytes = fs.readFileSync(file);
    if (bytes.length < 5000) throw new Error(`frame at ${second}s looks blank`);
    frames.push({ second, file, hash: createHash('sha256').update(bytes).digest('hex') });
  }
  if (new Set(frames.map((frame) => frame.hash)).size !== frames.length) {
    throw new Error('the three slide frames are not distinct');
  }

  console.log(
    `e2e ok: ${duration.toFixed(2)}s output, ${meta.length} segments, ${total.toFixed(2)}s narration, ${cues} cues, ${frames.length} distinct frames`,
  );

  const resultsDir = path.join(runDir, 'video-demo-15s');
  fs.mkdirSync(resultsDir, { recursive: true });
  const copies = [
    [demo, `${path.basename(resultsDir)}.mp4`],
    [path.join(outDir, 'captions.ass'), 'captions.ass'],
    [path.join(outDir, 'narration', 'meta.json'), 'meta.json'],
    [path.join(outDir, 'timing.json'), 'timing.json'],
    [path.join(task, 'video.config.json'), 'video.config.json'],
    [path.join(task, 'segments.json'), 'segments.json'],
    [path.join(task, 'record.mjs'), 'record.mjs'],
  ];
  for (const file of fs.readdirSync(demoDir)) {
    if (file.endsWith('.webp')) copies.push([path.join(demoDir, file), file]);
  }
  for (const frame of frames) copies.push([frame.file, path.basename(frame.file)]);
  for (const seg of meta) {
    copies.push([path.join(outDir, 'narration', `${seg.name}.srt`), `${seg.name}.srt`]);
  }
  for (const [source, name] of copies) fs.copyFileSync(source, path.join(resultsDir, name));
} finally {
  server.close();
  if (process.env.KEEP === '1') console.log(`kept ${task}`);
  else fs.rmSync(task, { recursive: true, force: true });
}
