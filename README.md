# prototype-k

**TL;DR** — The one home of the agent configuration this machine installs: the skills, the shared rules,
the style block and the git gates, with the installers that put them in place and the bundle that carries
them to another machine. The five projects that were built here live in their own repositories now.

## What this repository is

| | |
| :--- | :--- |
| **Problem** | The configuration existed as copies in six repositories. Every rule edit had to be repeated, and a copy that drifted taught the old rule silently. |
| **Value** | One physical copy, installed by links, so a rule learned once reaches every repository on the machine — and a second machine gets the same bytes through the export. |
| **Verify** | `node scripts/install-global.mjs` exits 0 with every link in place; `node scripts/export-agents.mjs --check` reports no drift; a commit in any repository prints the gate's `PASS`. |

There is no application code here. What lives in this checkout:

| Path | Holds |
| :--- | :--- |
| `.agents/skills/` | The canonical agent skills — one copy, linked into `~/.agents/skills/<name>` |
| `.agents/hooks/`, `.githooks/` | The build gate and the two git gates |
| `global/`, `output-style/` | The shared rules and the style block, with the installers that upsert them into `~/.agents/AGENTS.md` |
| `scripts/` | `install-global.mjs` (links and `core.hooksPath`), `export-agents.mjs` (the portable bundle), `scan-publication-leaks.sh`, and the shared libraries |
| `export/` | The portable bundle's own inputs: `settings.json`, its `README.md`, the `project-seed/` templates |
| `.editorconfig`, `.gitattributes`, `Directory.Build.props`, `LICENSE` | The canonical templates a new project repository starts from |
| `docs/`, `local_dev/` | The public documentation tier, and the working notes: harness details, build audits, plan records |
| `local_user_files/` | Git-ignored scratch. Nothing durable belongs here |

## Install it on a machine

The configuration is installed by links, never by copying. Run in Bash, from this checkout:

```bash
node scripts/install-global.mjs --write   # skills, hooks, scripts, githooks, global core.hooksPath
node scripts/install-global.mjs           # check: every link and the hooks path
node global/install.mjs                   # the shared rules block
node output-style/install.mjs             # the style block
```

That done, every repository on the machine is gated on commit by the one checkout: the publication scan
runs first, then the build gate when C# is staged.

A machine that cannot see this checkout uses the portable bundle instead. Generate it here:

```bash
node scripts/export-agents.mjs --archive  # writes dist/.agents-generic-<date>/ and its .tar.gz
```

Copy that folder to ~/\.agents on the receiving machine and point git at its hooks. Run in Bash:

```bash
git config --global core.hooksPath "$HOME/.agents/githooks"
```

`export/README.md` carries the full install steps, what the bundle holds, and the files it refuses.

## Projects

None of these lives here. Each is a separate repository, cloned beside this one, with its own history,
ignore list and `AGENTS.md`.

| Project | Repository | What it is |
| :--- | :--- | :--- |
| **CliUtils** | [dynamic-disorder/cliutils](https://github.com/dynamic-disorder/cliutils) | Console output utilities — coloured output, Spectre.Console wrappers, an in-memory logger. Packaged as `DynamicDisorder.CliUtils` |
| **CsvTranslations** | [dynamic-disorder/csv-translations](https://github.com/dynamic-disorder/csv-translations) (**private**) | English–Finnish dictionary tooling — Ollama translation, cross-platform Piper TTS, CSV management |
| **FilenameTools** | [dynamic-disorder/filenametools](https://github.com/dynamic-disorder/filenametools) | Filename sanitization — invalid characters, Unicode normalization, batch CLI |
| **MediaRenamer** | [dynamic-disorder/mediarenamer](https://github.com/dynamic-disorder/mediarenamer) | WPF tool that renames media files from their EXIF metadata |
| **ai_offline** | [dynamic-disorder/ai-offline](https://github.com/dynamic-disorder/ai-offline) (**private**) | Locally-hosted AI stack — Ollama, Open WebUI, proxy and harness compose setups, GPU tuning guides |

## Umbrella environment variable

`DYNAMIC_DISORDER_ROOT` names the directory that contains every clone — this repository and the projects
beside it. It exists so tooling and humans can address a sibling repository without a cross-repository
relative path, which this project forbids.

It is not the same variable as `REPO_ROOT`, and the two do not replace each other:

| Variable | Scope | Where the value comes from |
| :--- | :--- | :--- |
| `REPO_ROOT` / `$RepoRoot` | one repository | Derived, per clone, by that repository's own `local_dev/scripts/repo-env.sh` / `repo-env.ps1` |
| `DYNAMIC_DISORDER_ROOT` | one machine | Set by hand, once per machine, in user-global shell or environment config |

`DYNAMIC_DISORDER_ROOT` is never derived, on purpose: a standalone clone of any project has no umbrella
parent to walk up to, and deriving one would be exactly the `../` path the project bans. Nothing breaks
when it is unset — it is a convenience for tooling that wants to reach a sibling repository, and each
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

## Instructions for agents

`AGENTS.md` is the entry point: the non-negotiables, what lives here, how the configuration reaches a
machine, and where to look next. Every project carries its own `AGENTS.md` — clone it and read that one.

## History

This is the original working tree. It built all five projects until the split of 2026-10-15, merged
`CsvTranslations` back on 2026-10-16, moved it out again on 2026-11-13, and became the single home of the
agent configuration the same day. The decisions behind the split are in
[`local_dev/plans/2026-10-15_consolidation-and-multi-repo-plan.md`](local_dev/plans/2026-10-15_consolidation-and-multi-repo-plan.md);
the merge, the export and the move are in
[`docs/plans/2026-11-11_umbrella-to-template-and-agents-export-plan.md`](docs/plans/2026-11-11_umbrella-to-template-and-agents-export-plan.md).

## License

MIT — see [`LICENSE`](LICENSE). Each project repository carries its own license file.
