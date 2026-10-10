---
name: csharp-build-verify
description: Build the affected .NET solution and recover from the build failures this repo actually hits.
---

# Build verification

Once `.cs`, `.csproj` or `.sln` files change, the affected solution must build before the work
counts as done.

There is one solution per major project: `FilenameTools/FilenameTools.sln`,
`CsvTranslations/CsvTranslations.sln` and `MediaRenamer/MediaRenamer.sln`. `CliUtils` has none of
its own — it compiles as a dependency of the projects that reference it. Build only what the
change touches, from the repo root:

```bash
dotnet build CsvTranslations/CsvTranslations.sln --no-incremental
```

`--no-incremental` matters: it stops a stale `obj/` from hiding errors. For everything at once,
`./local_dev/scripts/build-all-linux.sh --test` (`-c Release` for Release). `dotnet build`
restores on its own, so do not run `dotnet restore` first.

## Recovery

**Null-byte corruption** — `MSB5010`, or `CS1056 (Unexpected character '\0')`, means the file
contains a `\0`. Restore it from git rather than editing it:

```bash
git show HEAD:path/to/file.cs > path/to/file.cs
```

Confirm no `\0` remains, then rebuild. A corrupted file is never worth repairing by hand.

**`MSB4011`** — a project explicitly `<Import>`s `Directory.Build.props` or
`Directory.Build.targets`. The SDK already imports them; delete the `<Import>`. The only
exception is a legacy `<Project>` without `Sdk=`, which gets no automatic import.

**Missing types after a rename or move** — on Linux a wrong-case `ProjectReference`, `Include` or
`.sln` entry is *silently skipped* at restore and only fails later as a compile error. Match the
on-disk casing exactly.

Warnings do not block; errors do. Report every error with its file and line number.
