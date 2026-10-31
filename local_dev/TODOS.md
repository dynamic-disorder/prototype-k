# TODOS — open verification and release follow-ups

Open items left by the `DynamicDisorder.CliUtils` 0.1.1 release. None blocks the current state of the
repository; each is a claim that is assumed rather than checked, or a known cosmetic defect.

| | |
| :--- | :--- |
| **Problem** | Two items are open: one published version that still leaks a CI path (0.1.0), one noisy workflow step. |
| **Value** | Item 1 (the Linux gate) closed 2026-10-31 with 280 of 280 tests passing, so `CLAUDE.md`'s figure is now measured rather than assumed. |
| **Change** | Item 1 closed 2026-10-31; items 2 and 3 re-verified the same day (evidence inline), both still open — item 2's release side is done, only the choice to unlist 0.1.0 remains. |
| **Verify** | Delete an entry only after the command beside it has been run and its output recorded here. |
| **Top risk** | Re-reading item 1 as open because the Windows run (253/280) is what comes to mind first. |

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

## 2. `0.1.0` is still listed, with a runner path inside — open, deferred

The published 0.1.0 carries one absolute path inside `lib/net10.0/CliUtils.dll`, pointing at the GitHub
Actions runner's own build directory. It reveals nothing about any person or machine beyond CI, but it
is the same class of defect that 0.1.1 fixes. 0.1.1 was scanned after download and has none.

A nuget.org version cannot be replaced once pushed. Unlisting removes it from search and from version
resolution but leaves it downloadable by exact version, so it is not a deletion.

Current choice: ship 0.1.1 and leave 0.1.0 listed for now — 0.1.1 removes the reason to rush an
unlist. That is a preference, **not** a decision against unlisting: 0.1.0 can still be unlisted at any
time, and unlisting is the only way to close this entry. Closing it means unlisting through the
package's own **Manage package** page (steps below) and recording the date here.

### Verified 2026-10-31 — measured, not assumed

Both published packages were downloaded from nuget.org and scanned with the same fixed strings the
publication gate uses. The leaking string in 0.1.0's `lib/net10.0/CliUtils.dll` is the GitHub Actions
runner's work directory, ending `…/work/cliutils/cliutils/obj/Release/net10.0/CliUtils.pdb`; 0.1.1 has
no absolute-path match. The full prefix is deliberately not reproduced here — the publication gate
blocks `/home/…` and `/mnt/…` strings, which is the same class of defect this entry is about.

Listing state, from `v3/registration5-gz-semver2/dynamicdisorder.cliutils/index.json`:

```
0.1.0  listed=True   published 2026-10-15
0.1.1  listed=True   published 2026-10-31
```

The search endpoint still returns both versions, so the choice above stands unchanged.

### Re-checked 2026-10-31 — 0.1.1 is the shipped version, 0.1.0 still listed

Both packages were downloaded from nuget.org again and byte-scanned; 0.1.1 was already live, so the
ship half of the choice needed no action. 0.1.1 went live 2026-10-31 08:50 UTC, the tag `v0.1.1`
exists, and `CsvTranslations/Directory.Packages.props` pins `0.1.1`.

- `0.1.1`, sha256 `c10ecfbf1368…` — its only surviving path token is the deterministic-path mapping
  `/_/obj/Release/net10.0/CliUtils.pdb`. No `/home/`, `/mnt/`, runner or work-directory string.
- `0.1.0`, sha256 `1ad6913260…` — still carries the absolute CI path, unchanged from the audit above.

So the release side of this entry is finished. What remains is one open choice — unlist 0.1.0, or keep
it listed. While it stays listed it is downloadable by exact version, and nothing more.

Operational notes for whoever closes this:

- **The account page counts package IDs, not versions.** `Published Packages 1 package / 112 downloads`
  with `Latest Version 0.1.1` describes the single `DynamicDisorder.CliUtils` ID; it does not say how
  many versions are listed. `Unlisted Packages 0 packages` is consistent with both versions listed,
  and it only fills once a version is actually unlisted — so it cannot confirm one version's state.
  Use the registration index above, or the 0.1.0 package page itself.
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

**Owner: you.** Unlisting is a few clicks on the 0.1.0 manage page; nothing else depends on it.

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
