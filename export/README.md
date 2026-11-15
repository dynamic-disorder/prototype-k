# Portable agent configuration

**TL;DR** — This tree is one machine's agent configuration with its own installer, ready for an empty
machine's `~/.agents`. It is generated from one checkout, never edited here, and a second install changes
nothing.

| | |
| :--- | :--- |
| **Need** | A second machine needs the same rules, skills and gates as the first, without cloning the checkout that owns them, and must be able to take an update later without diffing folders by hand. |
| **Why** | Two hand-maintained copies drift; this one is regenerated from the single source and applied from its manifest, so a rule learned once is the rule both machines run. |
| **What** | The rules as one `AGENTS.md` plus the two managed blocks, the skills, the build and git gates, the publication scanner, the shared libraries, an installer, the agent prompt, the settings file and a project seed. |
| **Proof** | `MANIFEST.json` lists every file with its sha256; `install.mjs` refuses a bundle that does not match it, and `.agents-state.json` on the target records what the installer owns. |

## Install on a new machine

Give `INSTALL.md` to the machine's agent, or run it yourself from this folder:

```bash
node install.mjs --check    # plan only; exit 1 when the target drifts
node install.mjs --write    # add and change only what the manifest says
node install.mjs --check    # must print `Up to date.`
```

The installer copies `skills/`, `hooks/`, `scripts/`, `lib/` and `githooks/` into `~/.agents`, merges the
two blocks into `AGENTS.md` (your machine notes outside the markers stay), installs `settings.json` only
when none exists, and points `core.hooksPath` at `~/.agents/githooks` when it is unset. It refuses to run
over a `~/.agents` that is built from links: that machine updates from the checkout instead.

No Node on the target? Copy the contents and wire the gate by hand, accepting that the next update is a
manual replace:

```bash
mkdir -p ~/.agents
cp -R ./. ~/.agents/
git config --global core.hooksPath "$HOME/.agents/githooks"
test -f "$HOME/.agents/githooks/pre-commit"
```

On Windows the same three steps, with `%USERPROFILE%\.agents` as the target.

## Update an installed machine

Bring the newer folder and repeat the three commands. Only files whose hash changed are written, a file
the bundle dropped is removed when the state says this installer owns it, and a repeat run is a no-op. To
show what changed before installing:

```bash
node install.mjs --check
```

To rehearse anywhere without touching the real home: `node install.mjs --agents-home <dir> --write`.

## What it holds

| Path | Contents |
| :--- | :--- |
| `install.mjs` | The installer; idempotent, manifest-checked, owns only what it records |
| `INSTALL.md` | The prompt a receiving agent runs, and the no-Node fallback |
| `AGENTS.md` | The shared rules followed by the output-style block, the same two blocks the installers upsert |
| `blocks/` | The two block sources the installer merges into an existing `AGENTS.md` |
| `settings.json` | Harness settings: the commit hook wiring and the permission list; no secrets |
| `skills/` | Each skill with its own scripts, tests and references |
| `hooks/` | The build gate, run by the commit hook and by harness tool-call hooks |
| `githooks/` | `pre-commit` (publication scan, then the build gate) and `pre-push` (forwards to a repository's own `git_tools/pre-push`) |
| `scripts/` | The publication scanner |
| `lib/` | The shared libraries the installer and the block merge use |
| `project-seed/` | Reference only, never installed: the files a new repository starts from |

## What it deliberately does not hold

- The checkout that generates it, its documentation, its project code and its scratch folders.
- Any credential, token, key or account-specific setting.
- The Windows credential helper, the environment lookups that read secret stores, the secret-scan
  allowlist and the placeholder map that names real identities. The exporter refuses them by name.
- The checkout's own tooling: `scripts/export-agents.mjs`, `scripts/lib/export-plan.mjs`,
  `scripts/install-global.mjs` and the rehearsals. A linked machine uses those; a bundle machine uses
  `install.mjs`.
- Any write outside `~/.agents`: harness configuration, `~/.claude` and `~/.dsh` stay yours.

## Regenerate

Do not edit files here. From the checkout that owns the configuration:

```bash
node scripts/export-agents.mjs            # write the stable dist/.agents-bundle
node scripts/export-agents.mjs --check    # compare it with the checkout
node scripts/export-agents.mjs --archive  # also write a dated folder and .tar.gz
```

The stable path is the delivery: two exports from one checkout produce the same bytes there. The dated
archive is a snapshot for a hand-over, not a second source.
