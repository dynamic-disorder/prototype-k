---
name: deck-card-video-generate
description: Record a narrated, captioned video of a web app or a deck of cards — scripted Playwright capture, TTS narration at absolute times, burned-in captions, verified sync. Use for demos, screencasts, product videos, and 2-minute cuts.
---

# deck-card-video-generate

## Executive Summary

Produce one narrated, captioned MP4 from a running web app or a card deck, with a fixed duration and sync checked at every mark. A hand-recorded demo drifts — audio and screen slide apart, captions arrive late, a failed take forces a full redo — so the pipeline is scripted and repeatable, and a preflight guard refuses a bad take before the expensive encode.

## When to Use

- A demo or screencast of a local or reachable web app, 15 s to 5 min.
- A deck of card pages that must become a narrated, captioned video.
- UI states that must look identical on every take.
- A cut that must be readable with sound off — captions are part of the deliverable.

**Not for** editing existing footage, live commentary, or a human voiceover. For a human narrator, record their audio per segment and start at step 4.

**Anti-pattern:** running with the template `video.config.json` unchanged. The defaults look valid, record a static page, and only the finished video shows it — the guard refuses the take instead.

## Prerequisites & Setup

Check every row before the first take; a missing required item fails a later step with a worse message.

| Requirement | Why it is needed | Check | If it is missing |
| :--- | :--- | :--- | :--- |
| **Node.js 20 or newer** | Runs the guard, recorder, narrator and composer. | `node -v` prints `v20` or higher | Stop; nothing runs. |
| **`playwright` and `msedge-tts` packages** | Capture and narration; installed in this skill's folder. | `npm install` completes, then `node -e "import('playwright')"` resolves | Stop; `record.mjs` or `narrate.mjs` cannot load. |
| **Chromium for Playwright** | The browser `record.mjs` drives. | `npx playwright install chromium` completes | Stop; recording fails on launch. Needs network once. |
| **FFmpeg with libass** | Burns captions and encodes the MP4. | `ffmpeg -filters` lists `ass` and `ffmpeg -version` shows `enable-libass` | Stop; captions cannot be burned, so the deliverable is impossible. |
| **ffprobe** | Measures duration during verification. | `ffprobe -version` prints a version | Stop verification; the duration claim has no number behind it. |
| **Reachable Edge TTS endpoint** | Synthesises narration. | `node scripts/narrate.mjs <task folder>` returns audio rather than a network error | Stop narration; capture and compose cannot produce a narrated cut. |
| **`ffmpeg`/`ffprobe` on `PATH`, or configured** | A Windows zip build ships neither on `PATH`. | Run the commands above, or set both paths in `video.config.json` | The scripts fail at the first encode; set the config paths instead of editing scripts. |

```bash
node -v                                         # 20+
npm install                                     # in this skill's folder: msedge-tts and playwright
npx playwright install chromium                 # browser used by record.mjs
ffmpeg -filters                                 # the list must include ass
ffmpeg -version                                 # the configuration must include enable-libass
```

Every command runs unchanged in PowerShell, Command Prompt and POSIX shells; none uses shell-specific syntax. `record.mjs` imports Playwright, so `playwright` must resolve from where it runs.

## Functional Requirements

One 15–300 s MP4, 120 s when no length is requested, from a task folder holding `video.config.json`, `segments.json` and an edited `record.mjs`.

| Requirement | Check | Failure looks like |
| :--- | :--- | :--- |
| **Duration** | `ffprobe` reports within 0.2 s of the requested length | A cut that ends mid-line or runs long |
| **Absolute beat timing** | Every beat lands at its absolute second; drift over 50 ms is printed | Drift that appears only in the finished video |
| **Narration fits its slot** | `slack = slot − speech` stays at 0.8 s or more | Speech cut off, or a long dead pause |
| **Caption coverage** | One SRT cue per sentence, burned in with libass, at most two lines, no line wider than `captions.maxChars` | Deliverable unreadable with sound off |
| **Sync** | A frame at every beat and mark shows the mark while the line naming it plays | Caption and picture disagree |
| **Pauses** | Silence gaps of 1.5–3 s are deliberate pauses; 4 s or more reads as a hang | A dead take nobody measured |
| **Playable output** | H.264/AAC, 16:9 at the requested viewport, `+faststart` | A file that stalls when streamed |

**Escape hatch:** pass `--seconds <n>` with the same value to every command, or set `targetSeconds` once in `video.config.json`. Re-narrate with `--force` after editing any text.

**Tolerated losses:** the pipeline writes a fresh cut. It does not edit existing footage, re-cut a finished MP4, or add a live or human voiceover.

## Execution Workflow

### Step 1: Initialize Inputs and Beat Sheet
Fix the length first; every later number derives from it. If the request names a length, use it; if not, use the 120 s default. Pass the same `--seconds` to every command, or write the number once as `targetSeconds` in `video.config.json`.

Write `segments.json`:
```json
[
  { "name": "s1", "start": 0.0,  "slot": 15.0, "text": "What the viewer sees first…" },
  { "name": "s2", "start": 15.0, "slot": 18.0, "text": "The second idea, in two sentences." }
]
```

### Step 2: Preflight Guard
Run the guard from this skill's folder:
```bash
node scripts/check_inputs.mjs <task folder> [--seconds <n>]
```
It exits 1 and lists every problem: unreachable URL, length out of range, commented-only beats, missing segment fields. Fix and rerun; do not record past a failure.

### Step 3: Record
Copy `scripts/record.mjs` into the task folder and `video.config.template.json` to `video.config.json`. Replace the `BEATS` block with app actions. Record:
```bash
node record.mjs [--seconds <n>]
```

Rules for a usable take:
- 16:9 viewport (`1600×900` or `1920×1080`), `deviceScaleFactor: 1`, browser zoom 100%.
- Wait for `networkidle` and `document.fonts.ready` before stamping `t0`.
- Every beat is absolute: `await at(sec, "label", fn)`. Drift over 50 ms is printed.
- Highlight with `mark()`; do not draw a synthetic cursor.
- Clear a highlight only after the spoken line that references it has ended.

### Step 4: Narrate
Run from this skill's folder:
```bash
node scripts/narrate.mjs <task folder> [--seconds <n>]
```
The script prints `slack = slot − speech`. Below 0.8 s, shorten the text or widen the slot. Re-run with `--force` after editing any text.

### Step 5: Compose
Run from this skill's folder:
```bash
node scripts/compose.mjs <task folder> [--name <name>] [--seconds <n>]
```
It builds one cue per SRT sentence, places each take at its absolute start, mixes with `normalize=0`, applies `loudnorm` once, pads to the length, trims by `t0Offset`, burns captions with libass, and encodes H.264/AAC with `+faststart`.

### Step 6: Verify with Numbers
```bash
ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,width,height,r_frame_rate -of default=noprint_wrappers=1 demo.mp4
ffmpeg -hide_banner -i demo.mp4 -af silencedetect=noise=-45dB:d=1.2 -f null -
ffmpeg -v error -ss 12.5 -i demo.mp4 -frames:v 1 check.jpg
```
- Duration within 0.2 s of the length.
- Every `silence_start` longer than ~2 s is a deliberate pause.
- Captions sit in the bottom third, at most two lines, no line wider than `captions.maxChars`.

## Error-Handling Playbook

| Symptom / Error | Root Cause | Autonomous Correction Action |
|---|---|---|
| Guard exits 1 | missing or invalid input | inspect stderr, fix named field in config/segments, re-run guard. |
| Beat drift over 50 ms | slow load or a beat inside a segment | check `references/pitfalls.md`; move the beat outside segment execution. |
| `slack` below 0.8 s | speech longer than the slot | shorten the text in `segments.json` or widen slot, re-run with `--force`. |
| Duration off by more than 0.2 s | trim or encode setting | check `t0Offset` and length parameters. |
| Compose refuses: recorded for X s, composing Y s | `--seconds` differs from take | re-record at new length or pass matching recorded length parameter. |
| Caption text wrong | text edited without `--force` | re-run `narrate.mjs` with `--force`. |

## Verification & Outputs

**Expected outputs** in the task folder:

| Path | Holds |
| :--- | :--- |
| `video/raw.webm`, `video/timing.json` | Capture, trim offset and recorded length |
| `video/narration/<name>.mp3`, `.srt`, `narration/meta.json` | Per-segment speech and subtitle source |
| `video/captions.ass`, `video/narration.wav`, `video/<name>.mp4` | Burned captions, mixed audio, final cut — `demo.mp4` by default |

**Exit criteria:** duration within 0.2 s of the length; one caption cue per sentence, none wider than `captions.maxChars`; every measured silence over 2 s intentional; the hand-off carries the numbers, not a description. Deliver the MP4 path, keep the task folder until the cut is accepted, then delete it.

## Reference files

- [`references/pitfalls.md`](references/pitfalls.md) — every failure this skill has already met, with the
  correction that worked.
- [`references/insert_cards.md`](references/insert_cards.md) — how to write a static HTML card for a point
  the app does not show: one 16:9 page, one beat, readable type.
