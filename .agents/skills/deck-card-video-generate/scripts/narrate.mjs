#!/usr/bin/env node
/** Narrate: one TTS take per segment, placed at absolute starts. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { srtFromMetadata } from '../lib/srt.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const taskDir = path.resolve(args.find((arg) => !arg.startsWith('--')) ?? '.');

const config = JSON.parse(fs.readFileSync(path.join(taskDir, 'video.config.json'), 'utf8'));
const segments = JSON.parse(fs.readFileSync(path.join(taskDir, 'segments.json'), 'utf8'));
const outDir = path.resolve(taskDir, config.outDir);
const narrationDir = path.join(outDir, 'narration');
const ffprobe = config.ffprobe ?? 'ffprobe';

fs.mkdirSync(narrationDir, { recursive: true });

function duration(file) {
  const output = execFileSync(
    ffprobe,
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file],
    { encoding: 'utf8' },
  );
  return Number(output.trim());
}

const tts = new MsEdgeTTS();
await tts.setMetadata(config.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
  sentenceBoundaryEnabled: true,
  wordBoundaryEnabled: false,
});

const meta = [];
try {
  for (const seg of segments) {
    const mp3 = path.join(narrationDir, `${seg.name}.mp3`);
    const srt = path.join(narrationDir, `${seg.name}.srt`);

    if (force || !fs.existsSync(mp3) || !fs.existsSync(srt)) {
      const temp = path.join(narrationDir, `.tmp-${seg.name}`);
      fs.rmSync(temp, { recursive: true, force: true });
      fs.mkdirSync(temp, { recursive: true });
      const result = await tts.toFile(temp, seg.text, { rate: config.rate, pitch: config.pitch });
      if (!result.metadataFilePath) {
        throw new Error(`no sentence boundaries returned for ${seg.name}`);
      }
      fs.copyFileSync(result.audioFilePath, mp3);
      const metadata = JSON.parse(fs.readFileSync(result.metadataFilePath, 'utf8'));
      fs.writeFileSync(srt, srtFromMetadata(metadata), 'utf8');
      fs.rmSync(temp, { recursive: true, force: true });
    }

    const speech = duration(mp3);
    const slack = seg.slot - speech;
    if (slack < 0.8) {
      console.warn(
        `WARNING ${seg.name}: speech ${speech.toFixed(2)}s, slack ${slack.toFixed(2)}s — shorten the text or widen the slot`,
      );
    }
    meta.push({ ...seg, duration: Number(speech.toFixed(3)) });
    console.log(
      `${seg.name.padEnd(12)} start=${seg.start.toFixed(1).padStart(6)} slot=${seg.slot
        .toFixed(1)
        .padStart(6)} speech=${speech.toFixed(2).padStart(6)} slack=${slack.toFixed(2).padStart(6)}`,
    );
  }
} finally {
  tts.close();
}

const last = Math.max(...meta.map((seg) => seg.start + seg.duration));
if (last > config.targetSeconds) {
  console.error(
    `last speech ends at ${last.toFixed(2)}s, past targetSeconds ${config.targetSeconds} — re-plan the slots`,
  );
  process.exit(1);
}

fs.writeFileSync(path.join(narrationDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
const total = meta.reduce((sum, seg) => sum + seg.duration, 0);
console.log(`total speech ${total.toFixed(2)}s, last end ${last.toFixed(2)}s of ${config.targetSeconds}`);
