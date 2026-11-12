# Portable agent configuration

**TL;DR** — This tree is one machine's agent configuration, ready to copy into an empty machine's
`~/.agents`. It is generated from one checkout, never edited here.

| | |
| :--- | :--- |
| **Need** | A second machine needs the same rules, skills and gates as the first, without cloning the checkout that owns them. |
| **Why** | Two hand-maintained copies drift; this one is regenerated from the single source, so a rule learned once is the rule both machines run. |
| **What** | The rules as one `AGENTS.md`, the skills, the build and git gates, the publication scanner, the shared libraries, the settings file and a project seed. |
| **Proof** | `MANIFEST.json` lists every file with its sha256, so a copy can be checked against what the exporter produced. |

## Install on a new machine

Copy this tree to the agents root, keeping the directory name `agents` under `.agents`:

```bash
cp -R .agents-generic-<date> ~/.agents
```

On Windows, copy the folder to `%USERPROFILE%\\.agents`.

Then wire the gates once:

```bash
git config --global core.hooksPath "$HOME/.agents/githooks"
git config --global --get core.hooksPath      # prints the path above
```

Every repository on the machine now runs the publication scan and the build gate on commit. Change
the hooks path back to nothing with `git config --global --unset core.hooksPath`.

## What it holds

| Path | Contents |
| :--- | :--- |
| `AGENTS.md` | The shared rules followed by the output-style block, the same two blocks the installers upsert |
| `settings.json` | Harness settings: the commit hook wiring and the permission list; no secrets |
| `skills/` | Each skill with its own scripts, tests and references |
| `hooks/` | The build gate, run by the commit hook and by harness tool-call hooks |
| `githooks/` | `pre-commit` (publication scan, then the build gate) and `pre-push` (forwards to a repository's own `git_tools/pre-push`) |
| `scripts/` | The publication scanner |
| `lib/` | The shared libraries the block installers use |
| `project-seed/` | The files a new repository starts from: `AGENTS.md`, `.editorconfig`, `Directory.Build.props`, `.gitattributes`, `.gitignore` |

## What it deliberately does not hold

- The checkout that generates it, its documentation, its project code and its scratch folders.
- Any credential, token, key or account-specific setting.
- The Windows credential helper, the environment lookups that read secret stores, the secret-scan
  allowlist and the placeholder map that names real identities. The exporter refuses them by name.
- The exporters themselves: `scripts/export-agents.mjs`, `scripts/lib/export-plan.mjs` and
  `scripts/install-global.mjs`, which links a checkout rather than a copy.

## Regenerate

Do not edit files here. From the checkout that owns the configuration:

```bash
node scripts/export-agents.mjs            # write dist/.agents-generic-<date>
node scripts/export-agents.mjs --check    # compare the newest export with the checkout
```
