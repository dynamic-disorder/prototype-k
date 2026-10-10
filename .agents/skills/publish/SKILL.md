---
name: publish
description: Publish supported apps as self-contained Windows bundles for end-user distribution.
disable-model-invocation: true
---

# Publish self-contained bundles

Run the wrapper from the repo root:

```bash
node publish-selfcontained.mjs                          # every supported app
node publish-selfcontained.mjs AddEntryApp              # one app
node publish-selfcontained.mjs AddEntryApp,OllamaTranslatorApp
node publish-selfcontained.mjs AddEntryApp --no-trim
```

It is dependency-free Node, so it runs on Linux and Windows alike, and cross-publishing
`win-x64` from Linux works because it only drives `dotnet publish`. Defaults are
`--runtime win-x64` and `--configuration Release`.

Supported app names: `AddEntryApp`, `OllamaTranslatorApp`, `TextFileSplitterApp`,
`TextToSpeechApp`. Output lands in `publish/<App>/<runtime>/<configuration>/`, which is
git-ignored.

## Trimming caveat

`PublishTrimmed` is on by default. These apps use reflection-based JSON, so trimming emits
`IL2026`/`IL2090` warnings and can break a bundle at runtime. Verify a bundle on Windows before
shipping, or pass `--no-trim` when unsure.

If a self-contained bundle is too large to distribute, ship a framework-dependent build and
install the runtime on the target machine instead — see the `install-net10-runtime` skill.
