#!/usr/bin/env node
/** Compose: captions, mixed narration, burned-in MP4. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { takeSeconds } from "../lib/args.mjs";
import { buildAss, buildCues } from "../lib/captions.mjs";
import { buildNarrationFilter } from "../lib/media.mjs";
import { sanitizeBaseName } from "../lib/names.mjs";
import { resolveTarget } from "../lib/plan.mjs";
import { isMain } from "../lib/cli.mjs";
import {
  composeMp4Args,
  composeWavArgs,
  durationWithinTolerance,
  measuredDuration,
  narrationInputs,
  timingMismatch,
} from "../lib/compose.mjs";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  const parsed = takeSeconds(process.argv.slice(2));
  if (parsed.error) fail(parsed.error);

  const args = parsed.rest;
  const nameIndex = args.indexOf("--name");
  const requestedName = nameIndex >= 0 ? args[nameIndex + 1] : undefined;
  const taskArg = args.find(
    (arg, index) => !arg.startsWith("--") && (nameIndex < 0 || index !== nameIndex + 1),
  );
  const taskDir = path.resolve(taskArg ?? ".");

  const config = JSON.parse(fs.readFileSync(path.join(taskDir, "video.config.json"), "utf8"));
  let target;
  try {
    ({ target } = resolveTarget(config, parsed.seconds));
  } catch (error) {
    fail(error.message);
  }

  const outDir = path.resolve(taskDir, config.outDir);
  const ffmpeg = config.ffmpeg ?? "ffmpeg";
  const ffprobe = config.ffprobe ?? "ffprobe";
  const outputName = sanitizeBaseName(requestedName);
  const outputFile = path.join(outDir, `${outputName}.mp4`);
  if (requestedName && requestedName !== outputName) {
    console.log(`output name sanitized: ${requestedName} -> ${outputName}`);
  }

  const timing = JSON.parse(fs.readFileSync(path.join(outDir, "timing.json"), "utf8"));
  const meta = JSON.parse(fs.readFileSync(path.join(outDir, "narration", "meta.json"), "utf8"));

  const mismatch = timingMismatch(timing, target);
  if (mismatch) fail(mismatch);

  const srtBySegment = {};
  for (const segment of meta) {
    srtBySegment[segment.name] = fs.readFileSync(
      path.join(outDir, "narration", `${segment.name}.srt`),
      "utf8",
    );
  }

  const cues = buildCues(meta, srtBySegment, target);
  if (cues.length === 0) fail("no caption cues — check that narrate wrote .srt files");

  const ass = buildAss({
    cues,
    width: config.viewport.width,
    height: config.viewport.height,
    captions: config.captions,
  });
  fs.writeFileSync(path.join(outDir, "captions.ass"), ass, "utf8");
  console.log(`captions: ${cues.length} cues, last end ${cues[cues.length - 1].end.toFixed(2)}s`);

  execFileSync(
    ffmpeg,
    composeWavArgs({
      inputs: narrationInputs(meta, outDir),
      filter: buildNarrationFilter(meta, target),
      outFile: path.join(outDir, "narration.wav"),
    }),
    { stdio: "inherit" },
  );
  console.log("narration.wav built");

  execFileSync(ffmpeg, composeMp4Args({ timing, config, target, outputName }), {
    cwd: outDir,
    stdio: "inherit",
  });

  const probe = execFileSync(
    ffprobe,
    ["-v", "error", "-show_entries", "format=duration,size", "-of", "default=noprint_wrappers=1", outputFile],
    { encoding: "utf8" },
  );
  console.log(probe.trim());

  const measured = measuredDuration(probe);
  if (!Number.isFinite(measured)) fail("could not read the output duration");
  if (!durationWithinTolerance(measured, target)) {
    fail(`duration ${measured.toFixed(3)}s drifted from target ${target}s by more than 0.2 s`);
  }
}

if (isMain(import.meta.url)) main();
