# TODOS — open verification and release follow-ups

Open items left by the `DynamicDisorder.CliUtils` 0.1.1 release. None blocks the current state of the
repository; each is a claim that is assumed rather than checked, or a known cosmetic defect.

| | |
| :--- | :--- |
| **Problem** | Three items are open: one unverified test figure, one still-leaky published package, one noisy workflow step. |
| **Value** | Item 1 is the only one that leaves a documented fact unconfirmed — `CLAUDE.md` states 280 of 280 tests pass. |
| **Change** | Nothing has changed yet. This file records what is open and what closes it. |
| **Verify** | Delete an entry only after the command beside it has been run and its output recorded here. |
| **Top risk** | Treating item 1 as a formality because the Windows run looked finished. |

## 1. Run the Linux gate — open

`CLAUDE.md` states that `CsvTranslations` builds clean and passes **280 of 280** tests. That figure was
measured before `DynamicDisorder.CliUtils` moved from 0.1.0 to 0.1.1.

The bump was verified on Windows only: restore resolved `0.1.1` in every assets file, the solution
built with 0 warnings and 0 errors, and **253 of 280** tests passed. All 27 failures are properties of
the Windows host, not of the change:

- **26** are `System.IO.IOException : The handle is invalid` at
  `System.ConsolePal.get_WindowWidth()` in `TranslationTools.Tests` — the headless-console caveat
  already recorded in `CsvTranslations/CLAUDE.md`. That test project carries no CliUtils dependency.
- **1** is `ProcessWavPlaybackTests.FindPlayer_WhenOnlyALaterCandidateExists_ShouldUseThatOne`, which
  hard-codes the Linux candidate `aplay` and therefore cannot pass on Windows.

None of that is the claim in `CLAUDE.md`, which is a Linux figure. Close this by running the gate on a
Linux machine and recording the totals here. Run in Bash, from the repository root:

```bash
./local_dev/scripts/build-all-linux.sh --test
```

**Owner: you**, on Omarchy. Not runnable in WSL on this machine: no .NET SDK is installed there.

## 2. `0.1.0` is still listed, with a runner path inside — open, accepted

The published 0.1.0 carries one absolute path inside `lib/net10.0/CliUtils.dll`, pointing at the GitHub
Actions runner's own build directory. It reveals nothing about any person or machine beyond CI, but it
is the same class of defect that 0.1.1 fixes. 0.1.1 was scanned after download and has none.

A nuget.org version cannot be replaced once pushed. Unlisting removes it from search and from version
resolution but leaves it downloadable by exact version, so it is not a deletion.

Decision taken: ship 0.1.1 rather than unlist 0.1.0. Revisit only if that embedded path turns out to
matter. Closing it means unlisting through the nuget.org package page (**Manage package** → **Unlist**)
and recording the date here.

**Owner: you.** No action planned.

## 3. `publish.yml` pushes the symbols package twice — open, cosmetic

`dotnet nuget push` already pushes the `.snupkg` sitting beside the `.nupkg`. The workflow then pushes
that same `.snupkg` explicitly, which always answers `Conflict`. `--skip-duplicate` keeps the step
green, so the release succeeds, but a genuine conflict on a future re-run would look identical.

Closing it means adding `--no-symbols` to the nupkg push in `publish.yml`, in the **cliutils**
repository, and confirming the next release logs two pushes instead of three.

**Owner: me, on request.** The release that prompted it is already complete.

---

Machine-level pending work — the `UMBRELLA_ROOT` variable on Omarchy and the build gate's execute bit
on an NTFS mount — deliberately lives outside this repository, in
`local_user_files/omarchy-mount-notes.md`.
