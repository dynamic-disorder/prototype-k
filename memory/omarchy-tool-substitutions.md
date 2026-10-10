# Omarchy (Arch) Linux — missing tools and what to use instead

Stable environment reference for this dev box. Several tools assumed by habit or by repo scripts
are **not installed**; the alternatives below are the ones actually verified to work here.

## Missing → working alternative

| Need | Missing here | Verified alternative |
| :--- | :--- | :--- |
| Arithmetic in shell (summing counts) | `bc`, `dc`, `calc` | `awk '{s+=$1} END{print s}'`, or shell `$(( ))` |
| Disassemble / inspect a .NET assembly's IL, types, member accessibility | `ildasm`, `ikdasm`, `monodis`, `ilspycmd` | Write a small tool on `System.Reflection.Metadata` + `PEReader` (see `local_user_files/ildump/`); `strings` for a rough check; the package `.xml` doc files list the public API |
| Parse PE/CLR metadata from Python | `dnfile`, `pefile` | `System.Reflection.Metadata` in C# instead |
| Run the repo's PowerShell scripts | `pwsh`, `powershell` (absent from `PATH`) | **No longer a blocker.** The `.ps1` tools were ported to Node (`publish-selfcontained.mjs`, `ai-context-token-estimate.mjs`) and `build-translations.ps1` was dropped; only `install-net10-runtime.ps1` remains PowerShell (it runs on end-user Windows). If you want pwsh here, install it **without root**: `dotnet tool install PowerShell --tool-path local_user_files/dotnet-tools`, then use `local_user_files/dotnet-tools/pwsh` (verified: 7.6.6). Point `XDG_CACHE_HOME`, `XDG_DATA_HOME` and `XDG_CONFIG_HOME` at a writable directory first — `$HOME` is read-only under the agent sandbox, and pwsh exits with `Read-only file system: /home/<user>/.cache/powershell` otherwise |
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
`go-yq`. For PowerShell you do **not** need the AUR: install it as a local .NET tool
(`dotnet tool install PowerShell --tool-path <dir>`). `ilspycmd` / `dotnet-format` install via
`dotnet tool install -g`.

## Related

- `../local_dev/scripts/build-all-linux.sh` is the cross-platform build entry point (bash, works here).
- Node is a first-class tool here: `../publish-selfcontained.mjs` and
  `../local_dev/scripts/ai-context-token-estimate.mjs` are dependency-free Node ESM, written when
  `pwsh` was absent and still the better default — no install step, and the same code runs on Linux
  and Windows. Prefer Node over PowerShell for new cross-platform scripts.
- Remaining PowerShell is deliberate: `../install-net10-runtime.ps1` runs on end-user Windows
  machines. See `../local_dev/git-ignored-local-files.md`.
