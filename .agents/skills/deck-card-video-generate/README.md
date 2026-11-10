# deck-card-video-generate

## Executive summary

Record one narrated, captioned MP4 from a running web app or a card deck. Capture is scripted, narration is synthesized at absolute times, captions are burned in, and the duration is verified. Fully optimized for Node.js-based automated agent workflows and testability.

## Problem / Why / What / Verification

| | |
|---|---|
| **Problem** | Hand-recorded demos drift: audio and screen slide apart, captions are added late, and one failed take redoes everything. |
| **Why** | A scripted run is repeatable; a preflight guard refuses bad inputs before the expensive encode. |
| **What** | One 15–300 s MP4 from a task folder with `video.config.json`, `segments.json` and an edited `record.mjs`. The length is `--seconds <n>` or `targetSeconds`, and 120 s when neither is given. Four steps: beat sheet, record, narrate, compose. |
| **Verification** | Duration within 0.2 s of the requested length; one cue per SRT sentence; silence gaps counted; frames checked at every beat. |

## Import for AI

Copy the whole folder, not only `SKILL.md`. Keep `SKILL.md` at the folder root.

### Global skill

**Linux / macOS**

```bash
cp -R "<path-to-this-folder>" ~/.dsh/skills/deck-card-video-generate
cd ~/.dsh/skills/deck-card-video-generate
npm install
npx playwright install chromium
```

**Windows 10 and 11 — PowerShell**

```powershell
$dest = "$env:USERPROFILE\.dsh\skills\deck-card-video-generate"
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item -Path "<path-to-this-folder>\*" -Destination $dest -Recurse -Force
Set-Location $dest
npm install
npx playwright install chromium
```

**Windows 10 and 11 — Command Prompt**

```bat
set DEST=%USERPROFILE%\.dsh\skills\deck-card-video-generate
if not exist "%DEST%" mkdir "%DEST%"
xcopy "<path-to-this-folder>" "%DEST%" /E /I /H /Y
cd /d "%DEST%"
npm install
npx playwright install chromium
```

### Project skill

**Linux / macOS**

```bash
cp -R "<path-to-this-folder>" "<project>/.agent/skills/deck-card-video-generate"
cd "<project>/.agent/skills/deck-card-video-generate"
npm install
npx playwright install chromium
```

**Windows 10 and 11 — PowerShell**

```powershell
$dest = "<project>\.agent\skills\deck-card-video-generate"
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item -Path "<path-to-this-folder>\*" -Destination $dest -Recurse -Force
Set-Location $dest
npm install
npx playwright install chromium
```

**Windows 10 and 11 — Command Prompt**

```bat
set DEST=<project>\.agent\skills\deck-card-video-generate
if not exist "%DEST%" mkdir "%DEST%"
xcopy "<path-to-this-folder>" "%DEST%" /E /I /H /Y
cd /d "%DEST%"
npm install
npx playwright install chromium
```

A project copy takes precedence over the global copy. Start a new session after copying so the skill is discovered.

### Windows notes

- Run the blocks in PowerShell or Command Prompt as the user who will run the skill; both shells launch the same `npm` and `npx`.
- `ffmpeg.exe` and `ffprobe.exe` must be on `PATH`, or set `ffmpeg` and `ffprobe` to their full paths in `video.config.json`.
- Quote both folder paths when either contains a space; every block above already quotes them.
- Install in a shell started after the Node.js install, so `node` and `npm` resolve from `PATH`.
- `npm test` and `npm run e2e` are identical on Windows 10 and 11; run them from the copied skill folder in either shell.

A project copy takes precedence over the global copy. Start a new session after copying so the skill is discovered.

### Rules for the AI

- Copy the folder, not individual files.
- Install dependencies in the copy that will run; do not reuse another copy's `node_modules`.
- Keep task data outside the skill folder.
- Take the length from the request: `--seconds <n>` on each command, or `targetSeconds` in the config. With neither, the 120 s default applies; say so in the handoff.
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

Timestamp format: `YYYY-MM-DD_HH-mm.sss` (local time). The requested `hh:MM.sss` uses `:` between hours and minutes; it is replaced with `-` because Windows 10 and 11 forbid `:` in file names.

## Files

- `SKILL.md` — the agent protocol and workflow.
- `README.md` — this import and test guide.
- `scripts/record.mjs` — Playwright capture; copied into the task folder. Exports `parseTargetSeconds` and `recordDemo` (injectable browser, clock and beats) so the unit suite can drive it without a page.
- `scripts/check_inputs.mjs` — preflight guard.
- `scripts/narrate.mjs` — Edge TTS and SRT per segment.
- `scripts/compose.mjs` — captions, audio mix, MP4; `--name` sets the output basename and `--seconds` the length.
- `lib/` — planning, captions, ffmpeg and name helpers.
- `lib/compose.mjs`, `lib/narrate.mjs`, `lib/cli.mjs` — composition and narration planning (input lists, ffmpeg argument lists, timing guards, slack and overrun checks) plus CLI entry detection, so the scripts stay thin and their logic is unit-tested.
- `tests/` — unit suites for every `lib/` module (including `compose`, `narrate` and `cli`), a `record.mjs` suite driven by a fake browser plus one real short headless take (length guards, absolute beats, drift, missing video, navigation timeout and a throwing beat), and two e2e suites.
- `references/` — pitfalls and insert-card guidance.
- `video.config.template.json` — copy to `video.config.json`.