# Omarchy (Arch) Linux — missing tools and what to use instead

Stable environment reference for this dev box. Several tools assumed by habit or by repo scripts
are **not installed**; the alternatives below are the ones actually verified to work here.

## Missing → working alternative

| Need | Missing here | Verified alternative |
| :--- | :--- | :--- |
| Arithmetic in shell (summing counts) | `bc`, `dc`, `calc` | `awk '{s+=$1} END{print s}'`, or shell `$(( ))` |
| Disassemble / inspect a .NET assembly's IL, types, member accessibility | `ildasm`, `ikdasm`, `monodis`, `ilspycmd` | Write a small tool on `System.Reflection.Metadata` + `PEReader` (see `local_user_files/ildump/`); `strings` for a rough check; the package `.xml` doc files list the public API |
| Parse PE/CLR metadata from Python | `dnfile`, `pefile` | `System.Reflection.Metadata` in C# instead |
| Run the repo's PowerShell scripts | `pwsh`, `powershell` | **Mostly resolved by porting to Node.** `publish-selfcontained.mjs` and `ai-context-token-estimate.mjs` replaced their `.ps1` versions and run here, and the redundant `build-translations.ps1` was dropped. Only `install-net10-runtime.ps1` remains PowerShell (it runs on end-user Windows machines) |
| Split a diff/patch into hunks non-interactively | `filterdiff`, `interdiff`, `combinediff` (patchutils) | `git add -p` (interactive), or craft the patch and `git apply --cached`; edit files deliberately instead of splitting |
| Inspect CSV from the shell | `csvkit` (`csvcut`, `csvlook`), `xsv`, `mlr`, `qsv` | `python3` with the stdlib `csv` module (`import csv, io`) — handles quoting correctly |
| Query/edit XML | `xmlstarlet`, `yq` | `xmllint` (present) for validation/xpath; the edit tool for targeted edits |
| Inspect/extract archives | `7z` | `unzip` (present) — works on `.nupkg` |
| Validate/format shell scripts | `shellcheck`, `shfmt` | None installed; rely on `bash -n` and careful review |
| Line-ending conversion/checks | `dos2unix`, `unix2dos` | `grep -c $'\r'`, `od -An -tx1 \| head -c3`, `file` |
| Pretty git diffs | `delta` | Plain `git diff`, `git diff --stat` |
| Directory trees | `tree` | `find`, `ls -R`, glob tool |

## Present and worth using

`rg` (ripgrep), `fd`, `fzf`, `bat`, `eza`/`exa`, `jq`, `xmllint`, `sqlite3`, `zstd`,
`inotifywait`, `gh` (GitHub CLI — handles the push), `file`, `strings`, `unzip`, `curl`,
`python3`, `shellcheck`-free `bash -n`.

## Optional installs (package names *not* verified on this box)

Treat as a starting point, confirm before trusting: `bc`, `tree`, `7zip`, `dos2unix`,
`shellcheck`, `shfmt`, `xmlstarlet`, `csvkit`, `patchutils`, `git-delta`, and
`go-yq`. `pwsh` needs `powershell` from the AUR. `ilspycmd` / `dotnet-format` install via
`dotnet tool install -g`.

## Related

- `../local_dev/scripts/build-all-linux.sh` is the cross-platform build entry point (bash, works here).
- Node is a first-class tool here: `../publish-selfcontained.mjs` and
  `../local_dev/scripts/ai-context-token-estimate.mjs` are dependency-free Node ESM precisely
  because `pwsh` is unavailable. Prefer Node over PowerShell for new cross-platform scripts.
- Remaining PowerShell is deliberate: `../install-net10-runtime.ps1` runs on end-user Windows
  machines. See `../local_dev/git-ignored-local-files.md`.
