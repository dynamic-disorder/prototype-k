# Linux Build Audit — Omarchy (Arch) host

**Date**: 2026-10-10
**Scope**: every .NET solution and project in the repository
**Trigger**: development moved from Windows 11 to Omarchy Linux; `FilenameSanitizerCli.csproj`
had already failed once on case-sensitive project references.

## Environment audited

| Item | Value |
| :--- | :---- |
| OS | Omarchy (Arch-based), `ID_LIKE=arch` |
| .NET SDK | 10.0.111 (`/usr/share/dotnet/sdk`) |
| .NET runtimes | `Microsoft.NETCore.App` **10.0.11 only** — no .NET 9 runtime |
| Workspace FS | `fuseblk` (NTFS mount) — **case-sensitive** for lookups in practice |
| Repo config | `git core.ignorecase = true` (inherited from Windows) |

The missing .NET 9 runtime matters: net9.0 assemblies **build** fine (reference packs
come from NuGet) but **cannot execute** without either the runtime or roll-forward.

## Result after fixes

| Solution | Debug | Release | Tests |
| :------- | :---- | :------ | :---- |
| `FilenameTools/FilenameTools.sln` | OK | OK (was broken) | 78/78 pass |
| `CsvTranslations/CsvTranslations.sln` | OK (was broken) | OK | 25/25 pass |
| `MediaRenamer/MediaRenamer.sln` | OK (was broken) | OK | no test projects |

Projects outside the solutions:

| Project | Build | Notes |
| :------ | :---- | :---- |
| `CsvTranslations/TextToSpeechApp.Tests` | OK (13 CA1707 warnings) | Windows-only target, cannot run here |
| `CsvTranslations/OllamaTranslatorApp.Tests` | **FAILS — 36 errors** | not in any `.sln`; stale against refactored API |
| `CsvTranslations/TranslationTools.Tests` | OK | contains **no test sources** at all |

Reproduce: `./local_dev/scripts/build-all-linux.sh --test` (solutions only).

## Root causes and fixes applied

### 1. Case-sensitive project references (build blocker)

`FilenameSanitizer.Tests.csproj` still pointed at `..\FileNameSanitizer\FilenameSanitizer.csproj`
(capital `N`) after the directory was renamed to `FilenameSanitizer/`. NuGet only logged
`Skipping project ... because it was not found` and restore "succeeded", so the failure
surfaced later as a missing assembly. The CLI reference had already been fixed; this
sibling was missed.

A full scan of all 21 `.csproj`/`.sln`/`.props` files (`ProjectReference` + file
`Include`s + `.sln` project entries) now reports **no case mismatches**.

### 2. Windows-targeted projects could not be restored (build blocker)

`NETSDK1100: To build a project targeting Windows on this operating system, set the
EnableWindowsTargeting property to true.` — this hit `TextToSpeechApp`
(`net9.0-windows10.0.19041.0`) and every MediaRenamer project (`net8.0-windows`, WPF).

Fixed by adding `EnableWindowsTargeting=true` to both `Directory.Build.props` files
(repo root and `CsvTranslations/`; the latter shadows the root one for that subtree).
It is a no-op on Windows. WPF and WinRT projects now **cross-compile** on Linux — they
still only *run* on Windows.

### 3. `-c Release` never built (build blocker, platform-independent)

`FilenameSanitizerCli.csproj` referenced `PackageReference FilenameSanitizer 1.0.0`
under `Condition="'$(Configuration)' == 'Release'"`. That id is not published, so
`dotnet build -c Release` failed with `NU1101` on every platform. Replaced with an
unconditional `ProjectReference`; the library still produces its `.nupkg`.

### 4. CLI crashed at exit on non-interactive stdin (runtime blocker)

`PrintCompletion` called `Console.ReadKey()` from the `finally` block. With redirected
stdin (scripts, CI, pipes) .NET throws
`InvalidOperationException: Cannot read keys when ... console input has been redirected`,
turning a completed operation into an unhandled crash with exit code 134. Now guarded by
`Console.IsInputRedirected`.

### 5. Documented pattern usage was a no-op (runtime bug)

The CLI help says patterns are semicolon-separated and `ParseArguments` joins with `;`,
but `IFilenameSanitizer.RenameFilesRemovingPatterns` documents and implements a
**new-line separated** list. `FilenameSanitizerCli <dir> 'prefix-;_old;.bak'` removed
nothing. Fixed in the CLI by converting `;` → `Environment.NewLine` before the call.

### 6. Cross-platform reserved-name handling (behaviour change)

`Sanitizer.IncludeUnderscoreForWindowsReservedNames` returned early unless
`Environment.OSVersion.Platform == Win32NT`, so `PRN.doc`/`COM1.txt` were left alone on
Linux while 5 unit tests expect `_PRN.doc`. The prefix is now applied on **every**
platform, matching the library's stated goal of producing names usable across
Windows/Linux/macOS.

### 7. Test fixture was Windows-only (test blocker)

`FilenameNormalizerTests` used `private const string TestFolder = @"C:\TestFolder"`.
On Linux `Path.Combine` + `Path.GetFileName` do not treat `\` as a separator, so mocked
paths never matched — 9 tests failed. Replaced with
`Path.Combine(Path.GetTempPath(), "FilenameSanitizerTests")`. The pattern literal in the
same file was CRLF-embedded, which broke `Split(Environment.NewLine)` on Linux; it is now
built with `string.Join(Environment.NewLine, ...)`.

### 8. Stale namespaces in `OllamaTranslatorApp.Tests`

`TestTranslationService.cs` referenced `OllamaTranslatorApi.ITranslationService` /
`.TranslationRequest` / `.TranslationResponse` from before the API moved to
`OllamaTranslatorApi.Core` and `OllamaTranslatorApi.Models`. Fixed (3 errors), but the
project still fails on 36 further errors — see below.

## Open issues (not fixed)

> **Status update (2026-10-10, later the same day):** issues **1, 3, 4, 5 and 6** below are
> now **resolved** — see *Resolution: .NET 10 migration* at the end of this document. Only
> issue 2 (pattern mode) remains open.

| # | Issue | Evidence |
| :- | :---- | :------- |
| 1 | `OllamaTranslatorApp.Tests` does not compile | 20× `TranslationRequest` has no `SourcePath`/`TargetPath` (API refactored to `TranslationRequest(Text, Prompt, Semantics)`), 14× `'Program' is inaccessible` (missing `InternalsVisibleTo("OllamaTranslatorApp.Tests")` in `OllamaTranslatorApp.csproj`), plus `CS1929`/`CS1503`. Needs a rewrite, not a patch. |
| 2 | Pattern mode silently skips normal filenames | `ShouldRenameFile` gates on `IsFilenameSanitized(originalName)`, true for any already-clean name. `prefix-test.txt` logs *"already sanitized"* instead of becoming `test.txt`; only files that also contain invalid characters get pattern-stripped. Repro: `dotnet run --project FilenameSanitizerCli -- <dir> 'prefix-;_old'`. |
| 3 | `TranslationTools.Tests` has no test sources | csproj only; `dotnet test` reports "No test is available". |
| 4 | No .NET 9 runtime installed | net9.0 test hosts abort with `framework 'Microsoft.NETCore.App' version '9.0.0' not found`. Fix: `sudo pacman -S dotnet-runtime-9.0` (in `extra/`) or `DOTNET_ROLL_FORWARD=LatestMajor`. |
| 5 | TFM inconsistency | `FilenameSanitizerCli` targets `net10.0`; the rest of the repo is `net9.0`. The CLI therefore needs the .NET 10 SDK. |
| 6 | Two test projects are outside `CsvTranslations.sln` | `OllamaTranslatorApp.Tests` and `TextToSpeechApp.Tests` are never built by `dotnet build`/`dotnet test` on the solution. Adding the TTS one would make `dotnet test` fail on Linux (Windows-only target). |

## Git: the case-only rename trap (resolved)

The library was tracked as `FileNameSanitizer/` (capital `N`) while the working tree had
`FilenameSanitizer/`. With `core.ignorecase=true`, git mapped the new lowercase paths onto
the old index entries and treated them as *the same file*, so a plain `git add -A` staged
the whole library as **deleted**:

```text
git add -A --dry-run  (ignorecase=true)   →   9 add, 21 remove   # library DELETED
git add -A --dry-run  (ignorecase=false)  →  30 add, 21 remove   # correct rename
```

Resolution: `core.ignorecase` is now **`false`** in this clone, so case-only renames stage
as renames. Apply the same fix to any future case-only rename:

```bash
git config core.ignorecase false
git add -A
git status          # expect "renamed:" entries, not 21 deletions
```

While it was `true`, edits inside `FilenameSanitizer/` (for example the reserved-name
change in `Sanitizer.cs`) were also invisible to `git diff`.

## Follow-up: `FileName` → `Filename` consistency rename

The repo mixed `FileName`/`Filename` casings (`FileNameTools/`, `FileNameNormalizer`,
`SanitizeFileName`, `IFileSystem.GetFileName`, `FinalFileName`, …) against the already
renamed `FilenameSanitizer/`, `IFilenameSanitizer`, `IsFilenameSanitized`. Everything of
ours now uses `Filename`:

| Kind | Before | After |
| :--- | :----- | :---- |
| Directory / solution | `FileNameTools/`, `FileNameTools.sln` | `FilenameTools/`, `FilenameTools.sln` |
| Files | `FileNameNormalizer.cs`, `FileNameNormalizerTests.cs` | `FilenameNormalizer.cs`, `FilenameNormalizerTests.cs` |
| Type / test class | `FileNameNormalizer`, `FileNameNormalizerTests` | `FilenameNormalizer`, `FilenameNormalizerTests` |
| Members | `SanitizeFileName`, `IsFilenameSanitized`*, `FinalFileName`, `BaseFileName`, `FileName`, `LogFileNameTemplate`, `IFileSystem.GetFileName*`, `GetInvalidFileNameChars` | `SanitizeFilename`, `FinalFileName`→`FinalFilename`, `BaseFilename`, `Filename`, `LogFilenameTemplate`, `GetFilename*`, `GetInvalidFilenameChars` |
| Locals / params | `fileName`, `sanitizedFileName`, `sourceFileName`, … | `filename`, `sanitizedFilename`, `sourceFilename`, … |
| Log artifact | `FileNameSanitizer.log.<ts>.txt` | `FilenameSanitizer.log.<ts>.txt` |

\* `IsFilenameSanitized` already used the correct casing.

Deliberately **not** renamed: framework APIs `Path.GetFileName`,
`Path.GetFileNameWithoutExtension`, `Path.GetInvalidFileNameChars`.

Total: ~192 literal `FileName` occurrences plus 78 camelCase `fileName*` identifiers across
31 + 10 files, 5 paths renamed, docs/indexes updated. All three solutions still build
(Debug + Release) and the test suites stay green (78 + 25).

### Trap found while renaming: tracked files under ignore rules are dropped

Three tracked files lived under the repo-wide `.claude/` ignore rule
(`.gitignore:23`) and were therefore **not** re-added at their new path by `git add -A` —
the commit would have silently deleted them:

```
FilenameTools/.claude/settings.json
FilenameTools/.claude/commands/build.md
FilenameTools/.claude/rules/filename-sanitization.md
```

They had to be carried over with `git add -f`. (`FilenameSanitizerCli/Properties/launchSettings.json`
is ignored by `.gitignore:20` too, but was never tracked, so nothing was lost.)

**Rule for next time**: when renaming a directory, diff `os.walk` of the new tree against
`git add -A --dry-run` and force-add anything that is tracked but ignored:

```bash
git add -A
git add -f <tracked-but-ignored paths>
```

## Follow-up: line endings normalised to LF everywhere

The repo was Windows-first: `core.autocrlf=true` plus `.gitattributes` forcing CRLF for
`*.cs`/`*.csproj`/`*.sln`/`*.props`/`*.targets`/`.gitignore`. Every commit therefore
printed a stream of "LF will be replaced by CRLF" / "CRLF will be replaced by LF"
warnings, and 14 files had ended up with **mixed** endings.

The warnings were harmless — every blob in the index was already LF (`i/lf`), so the
repository content never changed — but they were noise, and mixed endings inside one file
are a genuine defect.

New policy (Oct 2026):

- `.gitattributes` → `* text=auto eol=lf` (plus the existing `binary` rules for
  images/archives/`*.csv`).
- `git config core.autocrlf false`.
- The index needed no renormalisation (`git add --renormalize .` staged nothing — blobs
  were already LF); only the working tree had to be rewritten.

### Two traps when rewriting the working tree

1. **git skips files it thinks are up to date.** `git checkout-index -f -a` (and
   `git checkout -- .`) did *nothing*: the worktree stat data matched the index, so git
   never applied the new `eol=lf` conversion — files stayed CRLF while `git status`
   reported them clean. Deleting the files first forces the rewrite:

   ```bash
   git config core.autocrlf false
   git add .gitattributes
   git ls-files -z | xargs -0 rm -f      # safe only with a clean tree
   git checkout-index -f -a
   git add --renormalize .               # refreshes the stat cache
   ```

2. **A mass rewrite floods `git status` with phantom modifications.** After
   delete+restore, ~200 files showed as ` M` purely because their stat data was stale —
   `git diff` was empty and `git hash-object <file>` matched `git rev-parse :<file>`
   exactly. `git add --renormalize .` clears it.

Result: 236 tracked files `w/lf`, 0 CRLF, 0 mixed text files. The only remaining mixed
file is `CsvTranslations/translations.csv`, which `.gitattributes` deliberately marks
`binary` (`-text`), so git never converts it and the endings are irrelevant.

## Cross-platform checklist for future changes

- **Line endings are LF only** — never write CRLF, and keep `core.autocrlf=false`. Changing
  `.gitattributes`' eol rules requires forcing a worktree rewrite (see above); a plain
  `git checkout` will not do it.
- **Never** rely on case-insensitive paths — match the exact case of every directory and
  project file in `ProjectReference`/`Include`/`.sln` entries.
- Do not gate filesystem behaviour on `OperatingSystem.IsWindows()` unless the intent is
  explicitly "only touch this on Windows".
- Do not split strings on `Environment.NewLine` when the value may come from a source file
  or a CLI argument; use `\r\n|\n` or normalise first.
- Prefer `Path.Combine`/`Path.GetTempPath()` over literal `C:\...` paths in tests.
- Windows-only targets are fine, but must be cross-buildable (`EnableWindowsTargeting`).
- Guard `Console.ReadKey()` with `Console.IsInputRedirected` in any CLI.

## Resolution: .NET 10 migration (2026-10-10)

Every project moved to .NET 10 (latest stable; .NET 11 was still RC at the time). This closed
most of the open issues above.

| # | Was | Now |
| :- | :-- | :-- |
| 1 | `OllamaTranslatorApp.Tests` did not compile (36 errors) | Rewritten against the real API; **31/31 pass** |
| 3 | `TranslationTools.Tests` had no test sources | **81 real tests**, all pass |
| 4 | No .NET 9 runtime installed | N/A — everything targets `net10.0`, which *is* installed; no roll-forward needed |
| 5 | `FilenameSanitizerCli` was the only `net10.0` project | Repo is uniformly `net10.0` (`net10.0-windows` for MediaRenamer, `net10.0-windows10.0.19041.0` for the WinRT TTS app) |
| 6 | Two test projects outside `CsvTranslations.sln` | `OllamaTranslatorApp.Tests` **added** to the solution; `TextToSpeechApp.Tests` deliberately still out (see below) |

Target frameworks after the migration:

| Project(s) | TFM |
| :--------- | :-- |
| CliUtils, all CsvTranslations libs/apps, FilenameTools | `net10.0` |
| `MediaRenamer` (Models/Services/WpfApp) | `net10.0-windows` |
| `TextToSpeechCore` | `net10.0` |
| `TextToSpeechApp`, `TextToSpeechApp.Tests` | `net10.0-windows10.0.19041.0` |

Notable package work:

- **WinRT/Speech dependency migrated cleanly.** `net10.0-windows10.0.19041.0` still resolves
  the same `Microsoft.Windows.SDK.NET.Ref 10.0.19041.57` projection pack, so
  `Windows.Media.SpeechSynthesis` needed no code changes.
- **NAudio 2.2.1 → 3.1.0.** NAudio 3.x split the monolithic package per platform and
  `NAudio.WinMM` (which holds the playback class) only ships a Windows TFM, so the renamed
  `WaveOutEvent` → `WaveOut` API was adopted (`WaveOutEvent` survives only as `[Obsolete]`).
  PiperSharp 1.0.7 was verified member-by-member to still bind against NAudio 3.1.0.

  Rather than widen `TextToSpeechCore`'s target framework to match the package, playback was
  **refactored out**: the library owns an `IAudioPlayback` interface, and `TextToSpeechApp`
  (already Windows-targeted) supplies the NAudio `WaveOut` implementation
  (`NaudioWavPlayback`). `TextToSpeechCore` therefore stays `net10.0` and no longer references
  NAudio at all — verified by compiling a plain `net10.0` consumer against it. General lesson:
  when a dependency's *packaging* pushes a platform constraint into a library, prefer
  refactoring the seam over widening the target.

  The seam also made the core testable off Windows: `TextToSpeechCore.Tests` (`net10.0`, 25
  tests) substitutes `IAudioPlayback`, so the service's speak guards, voice listing, config and
  disposal are asserted without an audio device. The positive path (synthesized WAV reaching
  playback) still needs a provider, which `InitializeAsync` only creates after downloading the
  Piper engine and models.
- `PiperSharp` 1.0.7 also lifts transitive `SharpCompress` 0.36.0 → 0.50.1, clearing `NU1902`.
- `Spectre.Console(.Cli)` 0.49.1 → 0.57.2 required adding a `CancellationToken` parameter to
  `AsyncCommand<T>.ExecuteAsync` overrides.

Test projects now wired into `CsvTranslations.sln`: `TextToSpeechCore.Tests` (25),
`OllamaTranslatorApi.Tests` (27), `TranslationTools.Tests` (81),
`OllamaTranslatorApp.Tests` (31) = **164 tests**, plus `FilenameSanitizer.Tests` (78) =
**242** repo-wide, all green in Debug and Release.

### Why `TextToSpeechApp.Tests` stays out of the solution

It targets `net10.0-windows10.0.19041.0` with `RuntimeIdentifier=win-x64`. It *builds* on
Linux via `EnableWindowsTargeting`, but adding it to the solution would make
`dotnet test CsvTranslations.sln` try to **execute** a Windows-only assembly here, failing the
Linux gate. Build it explicitly by `.csproj` path instead.

### Trap found: reference assemblies hide `internal` members

Making a helper `internal` and relying on `InternalsVisibleTo` does **not** let a friend
assembly compile against it, because Roslyn's reference assembly (`obj/**/ref/*.dll`) keeps
public members of internal types but drops `internal` members. `ildump` showed
`Program` exposing only `public Main` in the ref assembly. The working repo pattern is an
`internal` type with **`public`** members (as `TtsSettings` does) — the containing type still
keeps them out of the real public surface.

### Fixed: `BatchTranslateAsync` reordered translated lines

`OllamaTranslator.BatchTranslateAsync` collected results from `Parallel.ForEachAsync` under a
lock, so **output line order was not preserved** relative to the input: multi-line text
translation could write translated lines in a different order than the source. It now indexes
the entries (`Parallel.ForAsync`) and writes each result into a pre-sized array, returning them
in input order. Regression tests drive translations to finish in reverse input order.

### Fixed: five `TranslationsParser` / `TranslationsFinder` defects

Found while writing the `TranslationTools.Tests` coverage, then fixed:

1. `SplitCsvLine` mishandled doubled quotes (`""`) — the lookahead bumped a separate counter that
   the `foreach` ignored, so an escaped-quote row collapsed into one field and lost its target.
2. Language values were read from `csvLines[index]` (the data row numbered like the *column*
   index), so the target language came from the third data row and a file with fewer than three
   data rows threw `IndexOutOfRangeException`. They now come from the first data row.
3. Rows with more columns than the header threw `IndexOutOfRangeException`; the loop is now
   bounded by the shorter of the two.
4. Hashtag columns were matched with `StartsWith("Hashtags")`, which the real header
   (`Context Categorization Hashtags`) never satisfies, and a bogus language was fabricated for
   them. Recognition is now a case-insensitive `Contains`, values are kept as
   `TextEntryType.Hashtags`, and `TextToSpeechApp` skips them when displaying and reciting.
5. A colon-style header using long column names threw `IndexOutOfRangeException` because
   `GetCleanHeaderLine` stripped the spaces that long-name detection depends on.
6. `TranslationsFinder.GetTranslationFilepathFromEnvironmentVariable` ignored its `json`
   parameter, so `settings.json` was never parsed — only the environment variable was read.
   The JSON `translation_filepath` property is now read first, with the environment variable as
   a fallback.

Validated against the repository's real dictionary: all 3077 data rows parse, languages resolve
to English/Finnish, and each row yields Source, Target and Hashtags entries.

