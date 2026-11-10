# Deck card video

## Executive summary

Record one narrated, captioned MP4 from a running web app or a card deck. Capture is scripted, narration is synthesized at absolute times, captions are burned in, and the duration is verified.

## Problem / Why / What / Verification

| | |
|---|---|
| **Problem** | Hand-recorded demos drift: audio and screen slide apart, captions are added late, and one failed take redoes everything. |
| **Why** | A scripted run is repeatable; a preflight guard refuses bad inputs before the expensive encode. |
| **What** | One 15–300 s MP4 from a task folder with `video.config.json`, `segments.json` and an edited `record.mjs`. Four steps: beat sheet, record, narrate, compose. |
| **Verification** | Duration within 0.2 s of `targetSeconds`; one cue per SRT sentence; silence gaps counted; frames checked at every beat. |

## Import for AI

Copy the whole folder, not only `SKILL.md`. Keep `SKILL.md` at the folder root.

### Global skill

Windows PowerShell:

```powershell
Copy-Item -Recurse "<path-to-this-folder>" "$env:USERPROFILE\.dsh\skills\deck-card-video-generate"
Set-Location "$env:USERPROFILE\.dsh\skills\deck-card-video-generate"
npm install
npx playwright install chromium
```

Linux or macOS:

```bash
cp -R "<path-to-this-folder>" ~/.dsh/skills/deck-card-video-generate
cd ~/.dsh/skills/deck-card-video-generate
npm install
npx playwright install chromium
```

### Project skill

```powershell
Copy-Item -Recurse "<path-to-this-folder>" "<project>\.agent\skills\deck-card-video-generate"
Set-Location "<project>\.agent\skills\deck-card-video-generate"
npm install
npx playwright install chromium
```

A project copy takes precedence over the global copy. Start a new session after copying so the skill is discovered.

### Rules for the AI

- Copy the folder, not individual files.
- Install dependencies in the copy that will run; do not reuse another copy's `node_modules`.
- Keep task data outside the skill folder.
- Never commit `node_modules/` or `test-results/`.

## Git

This folder ships a `.gitignore` with:

```gitignore
node_modules/
test-results/
```

If the skill is merged into a larger repository, add those two lines to the repository root `.gitignore` as well. Test runs and installed packages must not be committed. `node_modules/` appears because `npm install` creates it; it is not part of the skill source.

## Tests

Each run writes a timestamped folder under `test-results/`.

- `npm test` — unit suite; writes `unit.txt` and `run.json`.
- `npm run e2e` — the 15 s card demo and the 20 s deck take; the video demo uses the two card images in `tests/resources/for_demo` with two narration segments, and writes `deck-e2e.txt`, `video-e2e.txt`, `deck-demo-20s/` and `video-demo-15s/`.
- `node tests/e2e.mjs` or `node tests/deck-e2e.mjs` alone — that take in its own timestamped folder.

Timestamp format: `YYYY-MM-DD_HH-mm.sss` (local time). The requested `hh:MM.sss` uses `:` between hours and minutes; it is replaced with `-` because Windows forbids `:` in file names.

## Files

- `SKILL.md` — the workflow the agent follows.
- `README.md` — this import and test guide.
- `scripts/record.mjs` — Playwright capture; copied into the task folder.
- `scripts/check_inputs.mjs` — preflight guard.
- `scripts/narrate.mjs` — Edge TTS and SRT per segment.
- `scripts/compose.mjs` — captions, audio mix, MP4; `--name` sets the output basename.
- `lib/` — planning, captions, ffmpeg and name helpers.
- `tests/` — unit and two e2e suites.
- `references/` — pitfalls and insert-card guidance.
- `video.config.template.json` — copy to `video.config.json`.
