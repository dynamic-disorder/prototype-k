---
name: deck-card-video-generate
description: Record a narrated, captioned MP4 of a web app or a deck of cards - scripted Playwright capture, Edge TTS narration at absolute times, burned-in captions, numeric sync checks. Use for demos, screencasts, product videos and 2-minute cuts (15 s to 5 min). Not for editing existing footage or human voiceover.
---

# deck-card-video-generate

A guard refuses a bad take before the expensive encode. Full step detail, expected outputs and error table: `references/full-contract.md`. Past failures: `references/pitfalls.md`. Card pages: `references/insert_cards.md`. Overview: `README.md`.

## Prerequisites (check once)

New machine: the user follows `required_install-deck-card-video-generate.txt`.

- `node -v` is 20+. In the skill folder run `npm install` (needs network once). `node_modules/` is generated and never exported, so every machine runs it.
  - Ignore the `msedge-tts` warning `install scripts blocked ... only-allow pnpm`: it only enforces a package manager.
- Browser: `record.mjs` uses Playwright's Chromium, else the installed Edge or Chrome. If Edge or Chrome exists, no download is needed. Otherwise run `npx playwright install chromium`. Behind a proxy it fails with `unable to get local issuer certificate`: set `NODE_EXTRA_CA_CERTS` to the proxy root certificate (`.pem`) and retry.
- `record.mjs` resolves `playwright` from `~/.agents/skills/deck-card-video-generate`, so the copy in the task folder needs no install. If the skill lives elsewhere, set `SKILL_DIR` to its folder.
- `ffmpeg -filters` lists `ass`, `ffmpeg -version` shows `enable-libass`, and `ffprobe` works. If not on `PATH`, set both paths in `video.config.json`.
- Edge TTS endpoint reachable (needs network).
- Never run with the template `video.config.json` unchanged: the guard refuses it.

## Steps

Set `SK` to the folder that holds this file (default `~/.agents/skills/deck-card-video-generate`). Use a task folder under `local_user_files` (git-ignored) when in a repo.

1. **Fix the length:** requested seconds, else 120. Pass the same `--seconds <n>` to every command, or set `targetSeconds` in `video.config.json`. Write `segments.json`: `[{ "name": "s1", "start": 0, "slot": 15, "text": "..." }]`.
2. **Guard:** `node $SK/scripts/check_inputs.mjs <task folder> [--seconds <n>]`. Exit 1 lists every problem. Do not record past a failure.
3. **Record:** copy `$SK/scripts/record.mjs` into the task folder and `$SK/video.config.template.json` to `video.config.json`. Replace the `BEATS` block with app actions, then `node record.mjs [--seconds <n>]`.
   - 16:9 viewport, `deviceScaleFactor: 1`, wait for `networkidle` and `document.fonts.ready` before `t0`.
   - Every beat is `await at(sec, "label", fn)`. Drift over 50 ms is printed. Use `mark()` to highlight. Clear a highlight only after its spoken line ends.
4. **Narrate:** `node $SK/scripts/narrate.mjs <task folder> [--seconds <n>]`. Keep `slack = slot - speech` at 0.8 s or more. After any text edit, re-run with `--force`.
5. **Compose:** `node $SK/scripts/compose.mjs <task folder> [--name <name>] [--seconds <n>]`.
6. **Verify with numbers:**
   ```bash
   ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,width,height,r_frame_rate -of default=noprint_wrappers=1 demo.mp4
   ffmpeg -hide_banner -i demo.mp4 -af silencedetect=noise=-45dB:d=1.2 -f null -
   ```
   Exit criteria: duration within 0.2 s of the length; one caption cue per sentence, none wider than `captions.maxChars`; every silence over 2 s is a deliberate pause. Hand off the numbers and the MP4 path. Keep the task folder until the cut is accepted.

## Common failures

- Beat drift over 50 ms: move the beat outside segment execution (`references/pitfalls.md`).
- `slack` below 0.8 s: shorten the text or widen the slot, then `--force`.
- Compose says recorded for X s, composing Y s: pass the matching `--seconds` or re-record.
- Caption text wrong: text was edited without `--force`.

## Verify the skill

`cd $SK && npm test`. `npm run e2e` runs a full capture.
