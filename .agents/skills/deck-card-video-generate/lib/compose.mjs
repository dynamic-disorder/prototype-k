/** Composition planning: inputs, ffmpeg argument lists, and the guards around them. */
import path from "node:path";
import { buildEncodeFilter, parseFfprobeDuration } from "./media.mjs";

/** ffmpeg inputs for every narration take, in segment order. */
export function narrationInputs(meta, outDir) {
  const inputs = [];
  for (const segment of meta) {
    inputs.push("-i", path.join(outDir, "narration", `${segment.name}.mp3`));
  }
  return inputs;
}

/**
 * The message for a capture/compose length mismatch, or null when they agree.
 * A timing file without `targetSeconds` is legacy and never a mismatch.
 */
export function timingMismatch(timing, target) {
  if (typeof timing.targetSeconds !== "number") return null;
  if (Math.abs(timing.targetSeconds - target) <= 0.001) return null;
  return (
    `the capture was recorded for ${timing.targetSeconds} s but this run composes ${target} s — ` +
    `re-record with --seconds ${target}, or compose with --seconds ${timing.targetSeconds}`
  );
}

/** ffmpeg arguments that mix the takes into `narration.wav`. */
export function composeWavArgs({ inputs, filter, outFile }) {
  return [
    "-y",
    "-v",
    "error",
    ...inputs,
    "-filter_complex",
    filter,
    "-map",
    "[a]",
    "-c:a",
    "pcm_s16le",
    "-ar",
    "48000",
    outFile,
  ];
}

/** ffmpeg arguments that burn captions and encode the final MP4. */
export function composeMp4Args({ timing, config, target, outputName }) {
  return [
    "-y",
    "-v",
    "error",
    "-ss",
    timing.t0Offset.toFixed(3),
    "-i",
    "raw.webm",
    "-i",
    "narration.wav",
    "-filter_complex",
    buildEncodeFilter({ fps: config.fps, width: config.viewport.width, height: config.viewport.height }),
    "-map",
    "[v]",
    "-map",
    "1:a",
    "-t",
    String(target),
    "-c:v",
    "libx264",
    "-preset",
    config.preset,
    "-crf",
    String(config.crf),
    "-pix_fmt",
    "yuv420p",
    "-profile:v",
    "high",
    "-level",
    "4.0",
    "-c:a",
    "aac",
    "-b:a",
    config.audioBitrate,
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    `${outputName}.mp4`,
  ];
}

/** True when the measured duration is within `tolerance` of the target. */
export function durationWithinTolerance(measured, target, tolerance = 0.2) {
  return Number.isFinite(measured) && Math.abs(measured - target) <= tolerance;
}

/** Parse ffprobe's `duration=…` line into a number, or NaN. */
export function measuredDuration(probeOutput) {
  const seconds = parseFfprobeDuration(probeOutput);
  return seconds === null ? Number.NaN : seconds;
}
