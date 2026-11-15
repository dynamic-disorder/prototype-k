# export-agents-configuration

**TL;DR** — one command turns this checkout into a portable `.agents` bundle; a second command proves it
installs and gates on a machine without the checkout. Hand the folder and `INSTALL.md` to the receiving
agent, and a newer bundle updates the old install with only the delta.

| | |
| :--- | :--- |
| **Problem** | The skills, rules and gate evolve in one checkout, but a friend or a hackathon laptop has no checkout to link to. A hand copy drifts, and a manual checklist (a shared-drive TODO) is where updates get lost. |
| **Why** | The receiving machine must install and re-install the same configuration without a human diffing folders, and a corrupt download must fail before it writes into `~/.agents`. |
| **What** | A stable bundle path with a manifest, an idempotent installer, a paste-ready agent prompt, and an arrival verifier; plus a rehearsal that proves all of it in a throwaway home. Deliberately not here: importing a `.claude-generic` export, live state, credentials, harness wiring. |
| **Verification** | `export --check` matches the checkout; `verify-bundle` prints `Clean`; the rehearsal installs, re-installs with `Up to date.`, applies a one-file delta, keeps machine notes and a personal skill, refuses a linked install, and commits through the gate. |

## Import for AI

The bundle carries this skill; a machine that installs the bundle already has it. To add it to an existing
`~/.agents` without the rest:

```bash
mkdir -p ~/.agents/skills
cp -R <checkout>/.agents/skills/export-agents-configuration ~/.agents/skills/
test -f ~/.agents/skills/export-agents-configuration/SKILL.md
```

## Agent Execution Rules

- **Export from a clean tree.** The bundle must describe a committed state; uncommitted work never travels.
- **Never hand over a bundle with findings.** `verify-bundle` exits 1 means copy again, not install.
- **Never edit `dist/`.** It is generated and git-ignored; edit the checkout and re-export.
- **The installer owns its files.** Removal is limited to paths in `.agents-state.json`; a personal skill,
  machine notes and an existing `settings.json` stay.
- **A linked machine is not a bundle machine.** `install.mjs` refuses it; use `install-global.mjs` there.
- **No shared-drive TODO becomes the update channel.** The prompt and the state file are the channel.
- **Commit only on approval**, after the tests, `check-skills` and the rehearsal are green.

## Tests

```bash
node --test scripts/lib/install-bundle.test.mjs \
  .agents/skills/export-agents-configuration/scripts/verify-bundle.test.mjs
bash scripts/rehearse-bundle-install.sh
```

The unit suites are pure and fast. The rehearsal is the end-to-end proof: it builds a bundle, installs it
into a temporary `HOME`, asserts the second run is a no-op, changes one file and asserts a one-file
delta, and checks the gate with a real commit.

## Files Index

| Path | What it holds |
| :--- | :--- |
| `SKILL.md` | Trigger, contract, workflow, playbook and verification for this skill |
| `scripts/verify-bundle.mjs` | Read-only arrival check: manifest hashes, required files, skill frontmatter, hook mode |
| `scripts/verify-bundle.test.mjs` | Unit tests for the arrival check |
| `scripts/lib/install-bundle.mjs` | The install plan and state rules, pure and unit tested |
| `scripts/install-bundle.mjs` | The CLI shipped as a bundle's `install.mjs`; owns the writes |
| `export/INSTALL.md` | The prompt the receiving agent runs |
| `export/README.md` | The bundle's own readme: what it holds and how to install it |
| `scripts/rehearse-bundle-install.sh` | The temp-`HOME` proof of install, update, refusal and gate |
