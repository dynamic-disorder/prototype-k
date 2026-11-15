# Install or update this agent configuration

**TL;DR** — give the receiving agent the block below, unchanged. It installs this folder into
`~/.agents`, proves the result, and updates only the delta on the next run.

## Give this to the agent

```text
You are installing an agent configuration on this machine. The bundle is the folder that contains
this file; work from that folder. Do not edit the bundle.

1. Run `node install.mjs --check`. Show me the add/change/remove counts and the paths, and the
   AGENTS.md, settings and hooksPath lines. Write nothing yet.
2. If it exits 2, stop and report the reason. Do not work around a refusal.
3. When I say go, run `node install.mjs --write`.
4. Run `node install.mjs --check` again. It must print `Up to date.` If it does not, stop and report
   the difference instead of retrying.
5. Prove the gate: make a throwaway git repository, stage one file, commit, and confirm the gate line
   (`PASS`, or `nothing staged` when the index is clean). Delete the throwaway repository afterwards.
6. Report what was added, changed and removed, the hooks path, and anything the installer left alone.

Rules: never edit `~/.agents/AGENTS.md` outside the `BEGIN managed` / `END managed` markers; never
touch `~/.claude`, `~/.dsh`, a credential file, or an existing `settings.json`; never force an install
over a `~/.agents` that is built from links. To update, point me at the newer bundle folder and repeat
the steps: only changed files move, and a second run changes nothing.
```

## What the installer does

- Copies `skills/`, `hooks/`, `scripts/`, `lib/` and `githooks/` into `~/.agents`, writing only files
  whose hash differs from the bundle's `MANIFEST.json`.
- Merges the two managed blocks into `~/.agents/AGENTS.md`, keeping machine notes and anything outside
  the markers.
- Installs `settings.json` only when none exists, then never overwrites it.
- Points the global `core.hooksPath` at `~/.agents/githooks` when it is unset, and leaves a foreign path
  alone with a warning.
- Records what it owns in `~/.agents/.agents-state.json`; a file is removed on a later run only if that
  state says this installer put it there.
- Refuses to run when `~/.agents` is a linked checkout (use that checkout's
  `node scripts/install-global.mjs --write` instead), or when the bundle does not match its manifest.

## Without Node

Copy this folder's contents into `~/.agents`, then point git at the gate:

```bash
mkdir -p ~/.agents
cp -R ./. ~/.agents/
git config --global core.hooksPath "$HOME/.agents/githooks"
test -f "$HOME/.agents/githooks/pre-commit"
```

That copy is not idempotent: the next update replaces the folder by hand. Prefer the installer.
