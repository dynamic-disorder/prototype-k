# prototype-k

**TL;DR** — Umbrella repository: one project lives here (`CsvTranslations/`), the other four are
separate repositories cloned beside this one. This repository holds the cross-project picture, the
tooling templates every project was created from, and the complete pre-split history.

## Projects

| Project | Where the code is | What it is | Visibility |
| :--- | :--- | :--- | :--- |
| **CliUtils** | [dynamic-disorder/cliutils](https://github.com/dynamic-disorder/cliutils) | Console output utilities — coloured output, Spectre.Console wrappers, an in-memory logger. Packaged as `DynamicDisorder.CliUtils` | public |
| **CsvTranslations** | `CsvTranslations/` — **in this repository** | English–Finnish dictionary tooling — Ollama translation, cross-platform Piper TTS, CSV management | public |
| **FilenameTools** | [dynamic-disorder/filenametools](https://github.com/dynamic-disorder/filenametools) | Filename sanitization — invalid characters, Unicode normalization, batch CLI | public |
| **MediaRenamer** | [dynamic-disorder/mediarenamer](https://github.com/dynamic-disorder/mediarenamer) | WPF tool that renames media files from their EXIF metadata | public |
| **ai_offline** | [dynamic-disorder/ai-offline](https://github.com/dynamic-disorder/ai-offline) | Locally-hosted AI stack — Ollama, Open WebUI, proxy and harness compose setups, GPU tuning guides | **private** |

## Layout

The four separate projects are cloned **at the same directory level** as this repository, each with
its own `.gitignore`, README and instruction files. Nothing is nested and nothing is symlinked:

```text
My/
├── ai-offline/
├── cliutils/
├── filenametools/
├── mediarenamer/
└── prototype-k/          ← this repository, which also contains CsvTranslations/
```

Work in the repository that owns the code. Each project is worked on, verified and released on its
own, and there are no cross-repository relative paths: reference another project by repository name,
or by its package.

## Umbrella environment variable

`DYNAMIC_DISORDER_ROOT` names the directory that contains **every** clone — this repository and the four
projects beside it. It exists so tooling and humans can address a sibling repository without a
cross-repository relative path, which this project forbids.

It is not the same variable as `REPO_ROOT`, and the two do not replace each other:

| Variable | Scope | Where the value comes from |
| :--- | :--- | :--- |
| `REPO_ROOT` / `$RepoRoot` | one repository | Derived, per clone: `local_dev/scripts/repo-env.sh` / `repo-env.ps1` walk up from their own location |
| `DYNAMIC_DISORDER_ROOT` | one machine | Set by hand, once per machine, in user-global shell or environment config |

`DYNAMIC_DISORDER_ROOT` is never derived, on purpose: a standalone clone of any project has no umbrella parent
to walk up to, and deriving one would be exactly the `../` path the project bans. Nothing breaks when
it is unset — it is a convenience for tooling that wants to reach a sibling repository, and each
script that uses it should say what it does when the variable is missing.

The name is spelled with underscores, not hyphens: bash rejects a hyphenated variable name, and this one
has to work in Git Bash on Windows and in bash on Omarchy alike.

The value is machine-specific, so it is deliberately **not** written in this file. Which directory it
names on a given machine belongs in that machine's own notes, not in a public repository.

### Windows

Run in PowerShell, from any directory:

```powershell
[Environment]::SetEnvironmentVariable('DYNAMIC_DISORDER_ROOT', '<umbrella-root>', 'User')
```

`'User'` writes the user environment block, so the value survives a reboot and reaches every new
process. Terminals already open keep their old environment — open a new one.

Verify in a new terminal. Run in PowerShell:

```powershell
$env:DYNAMIC_DISORDER_ROOT
```

Run in cmd:

```cmd
echo %DYNAMIC_DISORDER_ROOT%
```

Run in Git Bash:

```bash
echo "$DYNAMIC_DISORDER_ROOT"
```

Git Bash inherits the value verbatim, so it reads back in Windows form. Use it as it is, or convert it
with `cygpath -u "$DYNAMIC_DISORDER_ROOT"` where a POSIX path is required.

To remove it, run in PowerShell:

```powershell
[Environment]::SetEnvironmentVariable('DYNAMIC_DISORDER_ROOT', $null, 'User')
```

### Omarchy Linux

Run in Bash, from your home directory — appends one line to the shell startup file used by interactive
shells:

```bash
printf "export DYNAMIC_DISORDER_ROOT='%s'\n" '<umbrella-root>' >> ~/.bashrc
```

Open a new terminal, or run `source ~/.bashrc` in the current one. Verify, run in Bash:

```bash
printenv DYNAMIC_DISORDER_ROOT
```

A GUI-launched process does not read `~/.bashrc`. If one needs the variable, put it in the systemd
user environment file instead, which is read at login. Run in Bash:

```bash
mkdir -p ~/.config/environment.d
printf 'DYNAMIC_DISORDER_ROOT=%s\n' '<umbrella-root>' > ~/.config/environment.d/umbrella.conf
```

That path needs a re-login to take effect and does nothing for terminals started before it. Set both
when a shell and a GUI application must agree.

To remove it, delete the `export` line from `~/.bashrc`, and remove the file if you created it. Run in
Bash:

```bash
rm -f ~/.config/environment.d/umbrella.conf
```

## What lives here

| Path | Purpose |
| :--- | :--- |
| `CsvTranslations/` | The one project that lives here — `CsvTranslations.sln`, twelve projects (seven source, five test), the dictionary `translations.csv` and its corpora |
| `local_dev/scripts/` | Template tooling: `build-all-linux.sh`, the `repo-env.*` / `repo_paths.py` environment resolvers, `sandbox-env.sh` cache redirection, the self-contained publisher, the AI-context token estimator, the VS Code cache cleaner |
| `local_dev/tools/` | `ildump` — a `System.Reflection.Metadata` assembly inspector |
| `local_dev/analyses/`, `local_dev/plans/` | The cross-platform build audit, the TTS analysis, and the consolidation/split plan |
| `local_dev/*.md` | Tooling index, harness documentation, the git-ignored-files reference |
| `.agents/skills/` | The ten agent skills used across the projects; each project repository carries the subset it needs |
| `output-style/` | The executive-first documentation style installed into every harness's user-global config — `documentation-style.md`, `managed-block.md`, and the `install.sh` installer (`--check` reports drift) |
| `.editorconfig`, `.gitattributes`, `Directory.Build.props` | The canonical formatting, line-ending and build-property templates the project repositories were created from |
| `.github/`, `.clinerules`, `.claudeignore`, `.claude/`, `.githooks/` | Instruction and build-gate configuration, kept as the template for new repositories |
| `local_user_files/` | Git-ignored scratch. Nothing durable belongs here |

Machine- and user-level notes — tools missing on this box, environment workarounds — deliberately do
not live in this repository: they belong to the machine, in user-global agent configuration.

## Working here

`CsvTranslations/` is worked on in place. From this directory, on Linux or macOS:

```bash
./local_dev/scripts/build-all-linux.sh --test      # builds and tests the solution
```

From `CsvTranslations/`, on any platform:

```bash
dotnet build CsvTranslations.sln
dotnet test  CsvTranslations.sln
```

The build script discovers solutions by glob; here that finds `CsvTranslations.sln` only. The four
separate projects verify in their own repositories.

## Instructions for agents

`CLAUDE.md` is the entry point for this repository: non-negotiables, the project table and the
cross-project pointers. `CsvTranslations/CLAUDE.md` covers the solution that lives here. Every other
project carries its own `CLAUDE.md` — clone it and read that one.

## History

The complete history lives here, including every commit that built the projects before the split —
each project repository starts from a single import commit. `CsvTranslations` was split out on
2026-10-15 and merged back here on 2026-10-16. How and why the split happened, with the decisions
behind it, is in
[`local_dev/plans/2026-10-15_consolidation-and-multi-repo-plan.md`](local_dev/plans/2026-10-15_consolidation-and-multi-repo-plan.md).

## License

MIT — see [`LICENSE`](LICENSE). Each project repository carries its own license file.
