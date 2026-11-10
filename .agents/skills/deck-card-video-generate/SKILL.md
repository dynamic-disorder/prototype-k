---
name: deck-card-video-generate
description: Record a narrated, captioned video of a web app or a deck of cards — scripted Playwright capture, TTS narration at absolute times, burned-in captions, verified sync. Use for demos, screencasts, product videos, and 2-minute cuts.
---

# Deck card video

## Executive summary

Produce one narrated, captioned MP4 from a running web app or a card deck, with a fixed duration and sync checked at every mark. The pipeline is scripted and repeatable; a preflight guard stops a bad take before recording.

## Problem/Background

A hand-recorded demo drifts. Audio and screen slide apart, captions are added late, and one failed take means redoing the whole recording. A re-cut has no measured starting point.

## Why/Added value

- The same beats, narration and captions on every run.
- A bad input is refused before the expensive encode.
- The result is verified with numbers, not opinion.
- A caption or timing change costs only the compose step, not a new capture.

## What/Change

One 15–300 s MP4 from a task folder holding `video.config.json`, `segments.json` and an edited `record.mjs`. The workflow is four steps: beat sheet, record, narrate, compose. Out of scope: editing existing footage, live commentary, human voiceover.

## Verification/Realisation

- Duration within 0.2 s of `targetSeconds`.
- One caption cue per SRT sentence; no line wider than `captions.maxChars`.
- Silence gaps counted: 1.5–3 s is a pause, 4 s+ reads as a hang.
- A frame at every beat and unmark shows the mark while the line that names it plays.

## Top risk

The template defaults look valid. An unedited config records a static page; the input guard refuses it.

## When to use

- A demo or screencast of a local or reachable web app, 15 s to 5 min.
- A deck of card pages that must become a narrated, captioned video.
- UI states that must look identical on every take.
- A cut that must be readable with sound off — captions are part of the deliverable.

Not for editing existing footage, live commentary, or a human voiceover. For a human narrator, record their audio per segment and jump to step 4.

## Prerequisites

Check these first; a missing one fails a later step.

```powershell
node -v                                         # 20+
npm install                                     # in this skill's folder: msedge-tts and playwright
npx playwright install chromium                 # browser used by record.mjs
ffmpeg -filters | findstr " ass "               # must list ass
ffmpeg -version | findstr "enable-libass"
```

On Windows call `npm.cmd`, not `npm`, from PowerShell. Set `ffmpeg`/`ffprobe` in `video.config.json` when they are not on `PATH`.

`record.mjs` imports Playwright, so `playwright` must resolve from where it runs. Install it in the task folder, or run the file from a project that has it.

## Inputs and fail fast

The request must name the app and what to show. Four inputs must be real before a take.

| Input | Where |
|---|---|
| App URL | `baseUrl` in `video.config.json` |
| Length, 15–300 s | `targetSeconds` in `video.config.json` |
| Story beats | an active block between the `BEATS` markers in `record.mjs` |
| Narration | `segments.json`, at least one segment |

Run the guard from this skill's folder:

```powershell
node scripts/check_inputs.mjs <task folder>
```

It exits 1 and lists every problem: unreachable URL, target out of range, commented-only beats, missing segment fields. Fix and rerun; do not record past a failure.

A take on the template defaults — `http://127.0.0.1:3000`, 120 s, no beats — is exactly what the guard refuses.

## Workflow

### 1. Beat sheet

Decide the length first; every later number derives from it.

| Field | Meaning |
|---|---|
| `targetSeconds` | final duration; compose enforces it |
| segment `slot` | seconds reserved for that narration segment |
| segment `start` | sum of all previous slots |
| speech | measured TTS length; must be ≤ slot − 1 s |

One idea per segment and 2–3 sentences. At `-4%`, English runs about 2.2 words/s, so a 15 s slot holds ~30 words. Slots must sum to `targetSeconds`.

Write the text before recording, in `segments.json`:

```json
[
  { "name": "s1", "start": 0.0,  "slot": 15.0, "text": "What the viewer sees first…" },
  { "name": "s2", "start": 15.0, "slot": 18.0, "text": "The second idea, in two sentences." }
]
```

### 2. Record

Copy `scripts/record.mjs` into the task folder and `video.config.template.json` to `video.config.json`. Replace the `BEATS` block with this app's actions; keep the helpers.

Run the guard (above), then record from the task folder:

```powershell
node record.mjs
```

Rules that decide whether the take is usable:

- 16:9 viewport (`1600×900` or `1920×1080`), `deviceScaleFactor: 1`, browser zoom 100%.
- Wait for `networkidle` and `document.fonts.ready` before stamping `t0`.
- Every beat is absolute: `await at(sec, "label", fn)`. Drift over 50 ms is printed.
- Highlight with `mark()`; do not draw a synthetic cursor.
- Clear a highlight only after the spoken line that refers to it has ended. See `references/pitfalls.md`.

`t0Offset` is the head to trim: recording starts before the page is ready, so the capture is longer than the beat sheet.

### 3. Narrate

`segments.json` was written in step 1. Run from this skill's folder:

```powershell
node scripts/narrate.mjs <task folder>
```

The script prints `slack = slot − speech`. Below 0.8 s, shorten the text or widen the slot. Re-run with `--force` after editing any text.

### 4. Compose

Run from this skill's folder:

```powershell
node scripts/compose.mjs <task folder> [--name <name>]
```

It builds one cue per SRT sentence, places each take at its absolute start, mixes with `normalize=0`, applies `loudnorm` once, pads to `targetSeconds`, trims by `t0Offset`, burns captions with libass, and encodes H.264/AAC with `+faststart`.

`--name` sets the MP4 basename. It is sanitized to letters, digits, dot, dash and underscore, and defaults to `demo`.

### 5. Verify with numbers

The default file is `demo.mp4`; if you passed `--name`, use that file in these commands.

```powershell
ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,width,height,r_frame_rate -of default=noprint_wrappers=1 demo.mp4
ffmpeg -hide_banner -i demo.mp4 -af silencedetect=noise=-45dB:d=1.2 -f null -
ffmpeg -v error -ss 12.5 -i demo.mp4 -frames:v 1 check.jpg
```

- Duration within 0.2 s of `targetSeconds`.
- Every `silence_start` longer than ~2 s is a deliberate pause.
- A frame at every beat and unmark shows the mark while the line that names it plays.
- Captions sit in the bottom third, at most two lines, no line wider than `captions.maxChars`.

## Outputs

- `video/raw.webm` and `video/timing.json` — the capture and its trim offset.
- `video/narration/<name>.mp3` and `.srt`, plus `narration/meta.json`.
- `video/captions.ass`, `video/narration.wav`, `video/<name>.mp4` — the MP4 defaults to `demo.mp4`.

## Risks and invariants

Each one has cost a re-cut; `references/pitfalls.md` has the failure and the fix.

1. Trim by the measured `t0Offset`, never by eye.
2. A highlight outlives the line that references it.
3. Speech fits its slot with ≥1 s of slack.
4. Audio is placed absolutely (`adelay`), not concatenated.
5. Caption text comes from the TTS SRT, offset by the segment start.
6. Dead air is either a designed pause or a defect — count it.
7. Encode the video once, from the raw capture.
8. The deliverable is the final file, not the draft.

## Failure modes

| Symptom | Likely cause | Action |
|---|---|---|
| Guard exits 1 | missing or invalid input | fix the named field; do not record |
| Beat drift over 50 ms | slow load or a beat inside a segment | check `pitfalls.md`; move the beat |
| `slack` below 0.8 s | speech longer than the slot | shorten the text or widen the slot |
| Duration off by more than 0.2 s | trim or encode setting | check `t0Offset` and `targetSeconds` |
| Caption text wrong | text edited without `--force` | re-run narrate with `--force` |

## Handoff

Deliver the MP4 path and the verification numbers, not a process description. Keep the task folder until the cut is accepted; then delete it.

## Files

- `scripts/record.mjs` — Playwright capture, `at()`/`mark()`/`unmark()` helpers, `timing.json`.
- `scripts/check_inputs.mjs` — preflight: config keys, URL reachability, target range, segments, active beats.
- `scripts/narrate.mjs` — Edge TTS per segment, sentence-boundary SRT, duration probe, slack report, `meta.json`.
- `scripts/compose.mjs` — ASS captions, audio mix, burn-in, duration check.
- `lib/` — pure planning, caption and ffmpeg helpers, covered by the unit tests.
- `tests/` — unit tests; `node tests/e2e.mjs` records a 15 s card demo; `node tests/deck-e2e.mjs` records the six-slide deck fixture.
- `package.json` — dependencies plus the `test` and `e2e` scripts.
- `README.md` — import and test guide.
- `.gitignore` — ignores `node_modules/` and `test-results/`.
- `scripts/run-unit-tests.mjs`, `scripts/run-e2e.mjs` — timestamped run wrappers.
- `references/pitfalls.md` — failures seen in practice, with the arithmetic.
- `references/insert-cards.md` — static HTML cards (numbers, plans, evidence) recorded as pages.
- `video.config.template.json` — copy to `video.config.json`.

## Tests

Run `npm test` in this skill's folder; it writes `test-results/<timestamp>/unit.txt`. `npm run e2e` runs the 15 s card demo and the 20 s deck take into one timestamped run folder with logs and demos; the video demo uses the two card images in `tests/resources/for_demo` with two narration segments. Both need ffmpeg, Chromium and the TTS service.
