# TODOS — open verification and release follow-ups

Open items left by the `DynamicDisorder.CliUtils` 0.1.1 release. None blocks the current state of the
repository; each is a claim that is assumed rather than checked, or a known cosmetic defect.

| | |
| :--- | :--- |
| **Problem** | One item is open: a cosmetic double push in `publish.yml`. The leaking 0.1.0 is unlisted. |
| **Value** | Item 1 (the Linux gate) closed 2026-10-31 with 280 of 280 tests passing, so `CLAUDE.md`'s figure is now measured rather than assumed. |
| **Change** | Items 1 and 2 closed 2026-10-31 (evidence inline); item 3 re-verified the same day and still open. |
| **Verify** | Delete an entry only after the command beside it has been run and its output recorded here. |
| **Top risk** | Trusting the registration index minutes after a listing change — it caches, the package page does not. |

## 1. Run the Linux gate — closed 2026-10-31

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

None of that is the claim in `CLAUDE.md`, which is a Linux figure. The gate was run on Omarchy
(2026-10-31, .NET SDK 10.0.113), in Bash, from the repository root:

```bash
./local_dev/scripts/build-all-linux.sh --test
# Test summary: total: 280, failed: 0, succeeded: 280, skipped: 0, duration: 4.5s
# Build succeeded in 5.1s
```

`CLAUDE.md`'s claim holds after the 0.1.0 → 0.1.1 bump: the solution builds and all **280** tests pass
on Linux. The 27 Windows-host failures above (26 headless-console
`System.ConsolePal.get_WindowWidth()` IOExceptions, 1 Linux-only `aplay` candidate) do not reproduce
here. **Closed 2026-10-31.**

## 2. `0.1.0` unlisted 2026-10-31 — closed

The published 0.1.0 carries one absolute path inside `lib/net10.0/CliUtils.dll`, pointing at the GitHub
Actions runner's own build directory. It reveals nothing about any person or machine beyond CI, but it
is the same class of defect that 0.1.1 fixes. 0.1.1 was scanned after download and has none.

A nuget.org version cannot be replaced once pushed. Unlisting removes it from search and from version
resolution but leaves it downloadable by exact version, so it is not a deletion.

**Closed 2026-10-31.** The version was unlisted from the package's own manage page: `0.1.0` selected,
**List in search results** cleared, **Save**. This reverses the earlier preference to keep it listed —
0.1.1 had already shipped, so the unlist changed nothing else. The steps are kept below because they are
the only way to reverse it, too.

### Verified 2026-10-31 — measured, not assumed

Both published packages were downloaded from nuget.org and scanned with the same fixed strings the
publication gate uses. The leaking string in 0.1.0's `lib/net10.0/CliUtils.dll` is the GitHub Actions
runner's work directory, ending `…/work/cliutils/cliutils/obj/Release/net10.0/CliUtils.pdb`; 0.1.1 has
no absolute-path match. The full prefix is deliberately not reproduced here — the publication gate
blocks `/home/…` and `/mnt/…` strings, which is the same class of defect this entry is about.

Listing state, from `v3/registration5-gz-semver2/dynamicdisorder.cliutils/index.json`:

```
0.1.0  listed=False   published 2026-10-15   unlisted 2026-10-31
0.1.1  listed=True    published 2026-10-31
```

The registration endpoint caches. It kept answering `listed=True` for about two minutes after the public
package page had already dropped 0.1.0, so the page is the faster check; re-read the index after a few
minutes. `0.1.0`'s nupkg still answers HTTP 200 from the flat container — downloadable by exact version,
by design, which is exactly what unlisting is and deletion is not.

### Re-checked 2026-10-31 — 0.1.1 is the shipped version

Both packages were downloaded from nuget.org again and byte-scanned; 0.1.1 was already live, so the
ship half of the choice needed no action. 0.1.1 went live 2026-10-31 08:50 UTC, the tag `v0.1.1`
exists, and `CsvTranslations/Directory.Packages.props` pins `0.1.1`.

- `0.1.1`, sha256 `c10ecfbf1368…` — its only surviving path token is the deterministic-path mapping
  `/_/obj/Release/net10.0/CliUtils.pdb`. No `/home/`, `/mnt/`, runner or work-directory string.
- `0.1.0`, sha256 `1ad6913260…` — still carries the absolute CI path, unchanged from the audit above.

So the release side of this entry was finished before the unlist; the unlist finished the entry. Nothing
here is left to decide.

Operational notes — how it was unlisted, and how to reverse it:

- **The account page counts package IDs, not versions.** `Published Packages 1 package / 112 downloads`
  with `Latest Version 0.1.1` describes the single `DynamicDisorder.CliUtils` ID; it does not say how
  many versions are listed. It read `Unlisted Packages 0 packages` while both versions were listed,
  and that section only fills once a version is actually unlisted — so it cannot confirm one version's
  state. Use the registration index above, or the package page for the version in question.
- **Unlisting lives on the per-package manage page, not on the account page.** That is why the account
  page (`https://www.nuget.org/account/Packages`) shows no `Listing` section. nuget.org's own steps
  ([Deleting packages](https://learn.microsoft.com/en-us/nuget/nuget-org/policies/deleting-packages#unlisting-a-package)):
  **your account name** (top right) → **Manage packages** → **Published packages** → the
  **Manage package** icon on the `DynamicDisorder.CliUtils` row → expand **Listing** → select `0.1.0` →
  clear **List in search results** → **Save**. The page is also reachable directly at
  `https://www.nuget.org/packages/DynamicDisorder.CliUtils/0.1.0/Manage` (it redirects to sign-in when
  signed out). Verify after: signed out, `/packages/DynamicDisorder.CliUtils/` must no longer list
  0.1.0; an owner sees every version and its listing state.
- The same unlist is available headlessly, with an API key scoped to *Unlist* for this package:
  `dotnet nuget delete DynamicDisorder.CliUtils 0.1.0 --source https://api.nuget.org/v3/index.json --api-key <KEY> --non-interactive`
  (nuget.org treats `delete` as unlist — nothing is removed).
- No nuget.org API key is stored on the Omarchy machine: the environment, the user `NuGet.Config`
  (absent) and `local_user_files/nuget/env.sh` (cache paths only) were all checked.

**Owner: you.** Done 2026-10-31. The same manage page re-lists it if that is ever wanted.

## 3. `publish.yml` pushes the symbols package twice — open, cosmetic

`dotnet nuget push` already pushes the `.snupkg` sitting beside the `.nupkg`. The workflow then pushes
that same `.snupkg` explicitly, which always answers `Conflict`. `--skip-duplicate` keeps the step
green, so the release succeeds, but a genuine conflict on a future re-run would look identical.

Closing it means adding `--no-symbols` to the nupkg push in `publish.yml`, in the **cliutils**
repository, and confirming the next release logs two pushes instead of three.

### Verified 2026-10-31 — the redundant push is still there

`cliutils/.github/workflows/publish.yml`, step "Push the package and its symbols":

- pushes `artifacts/$PACKAGE.nupkg` — which already publishes the `.snupkg` sitting beside it;
- then pushes `artifacts/$PACKAGE.snupkg` again, which answers `Conflict`, silenced by `--skip-duplicate`.

The comment above that step already records the history ("the first release pushed the symbols twice
and logged a spurious conflict"), so the analysis is right but the second push remains. Closing it: add
`--no-symbols` to the nupkg push, keep the explicit snupkg push as the only symbols upload, and confirm
the next release logs two pushes instead of three.

**Owner: me, on request.** The release that prompted it is already complete.

---

Machine-level pending work — the `UMBRELLA_ROOT` variable on Omarchy and the build gate's execute bit
on an NTFS mount — deliberately lives outside this repository, in
`local_user_files/omarchy-mount-notes.md`.
