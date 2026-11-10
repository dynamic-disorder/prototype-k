# Pitfalls

**Executive summary:** These are the failures that cost a re-cut. Read the heading for the risk; the arithmetic follows.

Failures seen on a real 120 s cut, with the arithmetic. Each one cost a re-record or a re-mix.

## 1. The recording starts before the page does

Playwright begins recording when the context is created, so the first frames are a blank or loading page. On the reference run the page became ready 1.93 s after recording began, so a 120 s beat sheet produced a 129.8 s file.

Measure it, do not estimate: `record.mjs` stamps `t0` after `networkidle` + `document.fonts.ready`, writes `t0Offset`, and `compose.mjs` trims with `-ss`. A hand-trimmed cut drifts by a few hundred ms and the first caption lands late.

## 2. A highlight must outlive the line that names it

The reference cut failed here. The placeholder card was marked at 47.8 s, the narration segment was placed at 51.0 s, and the unmark/scroll happened at 57.8 s. The last sentence, "The card says so.", ran 58.7–60.6 s — after both the unmark and the scroll to the top. On screen the sentence pointed at nothing.

Rules that prevent it:

- Derive the unmark from the SRT: `unmark_at = segment.start + srt_end_of_last_sentence + 0.2`.
- Derive the mark from the segment start, not from when the scroll settles.
- A segment is not finished until its last sentence is; never schedule the next beat inside it.

Check it from frames, not from intention: extract a frame 0.3 s before every unmark and confirm the mark is still visible under the subtitle.

## 3. Speech length is not mp3 length

Edge TTS writes trailing silence into the mp3: a take measuring 9.62 s spoke for 8.5 s. Two consequences:

- The last 1 s of a "full" slot is silence, so segments look tighter than they are.
- `slack = slot − mp3_duration` is conservative, which is fine for planning, but for trim decisions use `silencedetect`.

Keep at least 1 s of slack so a live re-read does not overflow. If the text is edited after recording, re-run `scripts/narrate.mjs --force`: the SRT changes and the old captions are now wrong.

## 4. Place audio absolutely, never concatenate

Concatenating takes forces each segment to start where the previous ended, so every slip propagates. `adelay` per input plus `amix=inputs=N:duration=longest:normalize=0` keeps each take at its planned second regardless of the others.

`normalize=0` matters: the default normalises each input by 1/N and the mix gets quiet. Apply `loudnorm=I=-16:TP=-1.5:LRA=11` once, at the end, after the mix — not per take.

## 5. Dead air is either designed or a defect

`silencedetect=noise=-45dB:d=1.2` on the reference cut found gaps of 1.9, 3.7, 4.8, 3.5, 4.3, 3.6 and 1.6 s. The 4.8 s one played over a highlighted card with no voice for nearly five seconds; it read as a stall, and moving that segment 3 s earlier fixed both the gap and the reference in invariant 2.

- 1.5–3 s between segments: a pause.
- 4 s+: a hang, unless the screen is visibly moving through a transition.
- The end hold is the exception: a static card under 4 s of silence is a deliberate outro.

Plan the gaps; do not discover them in the mix.

## 6. Captions come from the SRT, not from the script

The TTS returns sentence-level SRT with its own splits. Build one cue per SRT sentence, offset by the segment start, and never re-type the text: a retyped caption can disagree with the audio and nobody notices until a viewer mutes it. Wrap at 76 characters at 1600×900; the ASS style uses `BorderStyle 3` (opaque box) so captions stay readable over light and dark screens.

When two cues overlap after offsets, push the later start 20 ms past the previous end rather than dropping one.

## 7. One encode, always from the raw capture

Re-encoding `demo.mp4` costs a generation of quality and can desync audio. Re-run `compose.mjs` instead: it always starts from `raw.webm`, so a caption or timing change is free of compounding loss.

## 8. ffmpeg must have libass and the font must exist

`ffmpeg -filters` must list `ass`; a minimal build silently lacks subtitle burning. On Windows the "essentials" build works. The ASS style names `Segoe UI`; on a machine without it, libass falls back and the caption metrics change. Check one frame with text before trusting a whole render.

Use `ass=captions.ass` with `cwd` set to the output folder: an absolute Windows path inside a filter needs escaping (`C\:/...`) and is a common failure. `scale` then `ass` keeps caption size tied to the output resolution.

## 9. Odd sizes break the encoder

H.264 with `yuv420p` requires even width and height. 1600×900 and 1920×1080 are safe; 1601×901 is not.

## 10. Windows shell traps

- `npm` resolves to `npm.ps1`, which execution policy often blocks. Call `npm.cmd`.
- `npm install` in this skill's folder provides `msedge-tts`; without it, `narrate.mjs` fails on the first import.
- Long paths with spaces are fine in argv, but keep filter strings relative.

## 11. The draft is not the deliverable

A verified draft and a final file are different states. Name the file that was actually uploaded or attached, and note any difference between it and the working cut. On the reference run the form was completed before the final re-timed cut existed, so the repo copy and the submitted copy differ in one segment — a fact worth one line in the handover, not a silent assumption.
