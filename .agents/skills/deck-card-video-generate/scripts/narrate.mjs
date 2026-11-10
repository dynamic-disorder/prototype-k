#!/usr/bin/env node
/** Narrate: one TTS take per segment, placed at absolute starts. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { takeSeconds } from "../lib/args.mjs";
import { resolveTarget } from "../lib/plan.mjs";
import { srtFromMetadata } from "../lib/srt.mjs";
import { isMain } from "../lib/cli.mjs";
import {
  lastSpeechEnd,
  needsSynthesis,
  overrunMessage,
  speechSlack,
  speechTotal,
} from "../lib/narrate.mjs";

async function main() {
  const parsed = takeSeconds(process.argv.slice(2));
  if (parsed.error) {
    console.error(parsed.error);
    process.exit(1);
  }
  const force = parsed.rest.includes("--force");
  const taskDir = path.resolve(parsed.rest.find((arg) => !arg.startsWith("--")) ?? ".");

  const config = JSON.parse(fs.readFileSync(path.join(taskDir, "video.config.json"), "utf8"));
  const segments = JSON.parse(fs.readFileSync(path.join(taskDir, "segments.json"), "utf8"));
  let target;
  try {
    ({ target } = resolveTarget(config, parsed.seconds));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const outDir = path.resolve(taskDir, config.outDir);
  const narrationDir = path.join(outDir, "narration");
  const ffprobe = config.ffprobe ?? "ffprobe";

  fs.mkdirSync(narrationDir, { recursive: true });

  function duration(file) {
    const output = execFileSync(
      ffprobe,
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file],
      { encoding: "utf8" },
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
    for (const segment of segments) {
      const mp3 = path.join(narrationDir, `${segment.name}.mp3`);
      const srt = path.join(narrationDir, `${segment.name}.srt`);

      if (needsSynthesis({ force, hasAudio: fs.existsSync(mp3), hasCaptions: fs.existsSync(srt) })) {
        const temp = path.join(narrationDir, `.tmp-${segment.name}`);
        fs.rmSync(temp, { recursive: true, force: true });
        fs.mkdirSync(temp, { recursive: true });
        const result = await tts.toFile(temp, segment.text, { rate: config.rate, pitch: config.pitch });
        if (!result.metadataFilePath) {
          throw new Error(`no sentence boundaries returned for ${segment.name}`);
        }
        fs.copyFileSync(result.audioFilePath, mp3);
        const metadata = JSON.parse(fs.readFileSync(result.metadataFilePath, "utf8"));
        fs.writeFileSync(srt, srtFromMetadata(metadata), "utf8");
        fs.rmSync(temp, { recursive: true, force: true });
      }

      const speech = duration(mp3);
      const { slack, warning } = speechSlack(segment, speech);
      if (warning) console.warn(warning);
      meta.push({ ...segment, duration: Number(speech.toFixed(3)) });
      console.log(
        `${segment.name.padEnd(12)} start=${segment.start.toFixed(1).padStart(6)} slot=${segment.slot
          .toFixed(1)
          .padStart(6)} speech=${speech.toFixed(2).padStart(6)} slack=${slack.toFixed(2).padStart(6)}`,
      );
    }
  } finally {
    tts.close();
  }

  const last = lastSpeechEnd(meta);
  const overrun = overrunMessage(last, target);
  if (overrun) {
    console.error(overrun);
    process.exit(1);
  }

  fs.writeFileSync(path.join(narrationDir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
  console.log(`total speech ${speechTotal(meta).toFixed(2)}s, last end ${last.toFixed(2)}s of ${target}`);
}

if (isMain(import.meta.url)) await main();
