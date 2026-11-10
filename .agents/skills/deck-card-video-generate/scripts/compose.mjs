#!/usr/bin/env node
/** Compose: captions, mixed narration, burned-in MP4. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildAss, buildCues } from '../lib/captions.mjs';
import { buildEncodeFilter, buildNarrationFilter, parseFfprobeDuration } from '../lib/media.mjs';
import { sanitizeBaseName } from '../lib/names.mjs';

const args = process.argv.slice(2);
const nameIndex = args.indexOf('--name');
const requestedName = nameIndex >= 0 ? args[nameIndex + 1] : undefined;
const taskArg = args.find(
  (arg, index) => !arg.startsWith('--') && (nameIndex < 0 || index !== nameIndex + 1),
);
const taskDir = path.resolve(taskArg ?? '.');

const config = JSON.parse(fs.readFileSync(path.join(taskDir, 'video.config.json'), 'utf8'));
const outDir = path.resolve(taskDir, config.outDir);
const ffmpeg = config.ffmpeg ?? 'ffmpeg';
const ffprobe = config.ffprobe ?? 'ffprobe';
const outputName = sanitizeBaseName(requestedName);
const outputFile = path.join(outDir, `${outputName}.mp4`);
if (requestedName && requestedName !== outputName) {
  console.log(`output name sanitized: ${requestedName} -> ${outputName}`);
}

const timing = JSON.parse(fs.readFileSync(path.join(outDir, 'timing.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(outDir, 'narration', 'meta.json'), 'utf8'));

const srtBySegment = {};
for (const seg of meta) {
  srtBySegment[seg.name] = fs.readFileSync(path.join(outDir, 'narration', `${seg.name}.srt`), 'utf8');
}

const cues = buildCues(meta, srtBySegment, config.targetSeconds);
if (cues.length === 0) {
  console.error('no caption cues — check that narrate wrote .srt files');
  process.exit(1);
}

const ass = buildAss({
  cues,
  width: config.viewport.width,
  height: config.viewport.height,
  captions: config.captions,
});
fs.writeFileSync(path.join(outDir, 'captions.ass'), ass, 'utf8');
console.log(`captions: ${cues.length} cues, last end ${cues[cues.length - 1].end.toFixed(2)}s`);

const inputs = [];
for (const seg of meta) {
  inputs.push('-i', path.join(outDir, 'narration', `${seg.name}.mp3`));
}
execFileSync(
  ffmpeg,
  [
    '-y',
    '-v',
    'error',
    ...inputs,
    '-filter_complex',
    buildNarrationFilter(meta, config.targetSeconds),
    '-map',
    '[a]',
    '-c:a',
    'pcm_s16le',
    '-ar',
    '48000',
    path.join(outDir, 'narration.wav'),
  ],
  { stdio: 'inherit' },
);
console.log('narration.wav built');

execFileSync(
  ffmpeg,
  [
    '-y',
    '-v',
    'error',
    '-ss',
    timing.t0Offset.toFixed(3),
    '-i',
    'raw.webm',
    '-i',
    'narration.wav',
    '-filter_complex',
    buildEncodeFilter({ fps: config.fps, width: config.viewport.width, height: config.viewport.height }),
    '-map',
    '[v]',
    '-map',
    '1:a',
    '-t',
    String(config.targetSeconds),
    '-c:v',
    'libx264',
    '-preset',
    config.preset,
    '-crf',
    String(config.crf),
    '-pix_fmt',
    'yuv420p',
    '-profile:v',
    'high',
    '-level',
    '4.0',
    '-c:a',
    'aac',
    '-b:a',
    config.audioBitrate,
    '-ar',
    '48000',
    '-movflags',
    '+faststart',
    `${outputName}.mp4`,
  ],
  { cwd: outDir, stdio: 'inherit' },
);

const probe = execFileSync(
  ffprobe,
  ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'default=noprint_wrappers=1', outputFile],
  { encoding: 'utf8' },
);
console.log(probe.trim());

const measured = parseFfprobeDuration(probe);
if (!Number.isFinite(measured)) {
  console.error('could not read the output duration');
  process.exit(1);
}
if (Math.abs(measured - config.targetSeconds) > 0.2) {
  console.error(`duration ${measured.toFixed(3)}s drifted from target ${config.targetSeconds}s by more than 0.2 s`);
  process.exit(1);
}
