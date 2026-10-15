---
name: publish
description: Publish supported apps as self-contained Windows bundles for end-user distribution.
disable-model-invocation: true
---

# Publish self-contained bundles

Run the repository's wrapper:

```bash
node local_dev/scripts/publish-selfcontained.mjs                        # every supported app
node local_dev/scripts/publish-selfcontained.mjs <App>                  # one app
node local_dev/scripts/publish-selfcontained.mjs <App>,<OtherApp>       # several
node local_dev/scripts/publish-selfcontained.mjs <App> --no-trim
```

It is dependency-free Node, so it runs on Linux and Windows alike, and cross-publishing `win-x64`
from Linux works because it only drives `dotnet publish`. Defaults are `--runtime win-x64` and
`--configuration Release`.

The wrapper knows the app names it supports — run it with `--help` to list them. Output lands in
`publish/<App>/<runtime>/<configuration>/`, which the repository's `.gitignore` excludes.

## Trimming caveat

`PublishTrimmed` is on by default. Apps that use reflection-based JSON emit `IL2026`/`IL2090`
warnings under trimming and can break a bundle at runtime. Verify a bundle on Windows before
shipping, or pass `--no-trim` when unsure.

If a self-contained bundle is too large to distribute, ship a framework-dependent build and
install the runtime on the target machine instead — see the `install-net10-runtime` skill.
