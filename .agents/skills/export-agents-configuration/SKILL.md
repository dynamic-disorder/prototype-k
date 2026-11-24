---
name: export-agents-configuration
description: Export this machine's agent configuration into one verified portable bundle for a friend, a hackathon laptop or a blank machine, with an installer and an agent prompt that installs and updates it idempotently. Use when: "give a friend the skills", "hackathon laptop", "portable agent configuration", "export the bundle", "hand over the configuration", "set up a new machine". Not for: importing a .claude-generic export (use import-cc-generic-configuration-and-adapt), or copying live state and credentials.
---

# export-agents-configuration

## Executive Summary

Turn the canonical checkout into one stable `.agents` bundle, prove it installs and gates without the
checkout, then hand it over with a prompt the receiving agent runs. A second run changes nothing; a newer
bundle changes only the delta.

## When to Use

- A friend, a hackathon laptop or a blank machine needs the skills, rules, style and commit gate.
- The configuration changed and a machine that runs a copied bundle needs the update.
- The import skill brought new skills in, and the portable bundle must carry them.

**Not for:** a machine that already installs from a linked checkout (use `install-global.mjs`), importing
a `.claude-generic` export, or exporting project code, machine notes or credentials.

## Prerequisites & Setup

| Requirement | Why | Check | If missing |
| :--- | :--- | :--- | :--- |
| Node.js 20+ | Exporter, installer and verifier | `node -v` prints `v20` or higher | Stop; nothing runs. |
| Canonical checkout | The only source of the bundle | `test -f scripts/export-agents.mjs` | Run from the checkout that owns the configuration. |
| Clean worktree | The bundle must describe a committed state | `git status --porcelain` prints nothing | Commit or stash; never export a half-finished tree. |
| Linux or Git Bash | The rehearsal and the hooks are POSIX | `bash --version`; `echo "$MSYSTEM"` prints `MINGW64` on Windows | Run the rehearsal in Git Bash; a WSL `bash` cannot read a drive path. |
| Receiving machine has Node | The installer is Node-first | `node -v` on that machine | Use the no-Node copy fallback in `INSTALL.md`; it is not idempotent. |

## Functional Requirements

**Inputs:** `--out <dir>` (default `dist/.agents-bundle`), `--archive` (also write
`dist/.agents-generic-<date>` and its `.tar.gz`), `--check` (`--out` to compare one copy),
`--agents-home <dir>` on the installer for a rehearsal.

**Outputs:** `dist/.agents-bundle/` with `MANIFEST.json`, `AGENTS.md`, `install.mjs`, `INSTALL.md`,
`blocks/`, `skills/`, `hooks/`, `scripts/`, `lib/`, `githooks/`, `settings.json`, `project-seed/`; and
optionally a dated archive. The receiving machine ends with `~/.agents` installed and
`~/.agents/.agents-state.json` recording what this installer owns.

**Refusals — never exported or installed**

| Item | Why |
| :--- | :--- |
| `claude_placeholder_values.txt`, credential readers, the secret-scan allowlist | Identity and secret material |
| `.credentials*`, `.claude.json`, `.env`, `*.key`, `*.pem`, `*.log` | Live state or secrets |
| `local_dev/`, `local_user_files/`, `node_modules/`, `dist/`, `test-results/`, `bin/`, `obj/` | Checkout-only or generated |
| A linked `~/.agents` | Two install models mixed; the installer exits 2 |
| A skill whose target `SKILL.md` names another folder | Someone else's skill; the installer reports a conflict |

### Requirement → check → failure

| Requirement | Check | Failure |
| :--- | :--- | :--- |
| Two exports give the same bytes at the same path | export twice, then `--check` | Fail; a changing path or hash is a defect |
| The bundle matches its manifest | `verify-bundle.mjs dist/.agents-bundle` | Fail; do not hand it over |
| No machine identifier or secret | exporter's leak scan exits 0 | Fail; fix the source file, never bypass |
| Install is idempotent | rehearsal: `--write`, `--check` twice, second says `Up to date.` | Fail |
| Machine notes survive | rehearsal seeds a note outside the markers, reinstalls, note remains | Fail |
| A personal skill survives | rehearsal seeds `skills/personal/`, reinstalls, folder remains | Fail |
| A linked install is refused | rehearsal exits 2 with the link named | Fail |
| The gate runs without the checkout | rehearsal commits in a scratch repo, gate line appears | Fail |
| The prompt ships in the bundle | `test -f dist/.agents-bundle/INSTALL.md` | Fail |
| Skills stay valid | `verify-bundle` names, descriptions, folder match | Fail |

**Escape hatch:** `--out <dir>` writes anywhere; `--agents-home <dir>` rehearses into a throwaway home.
**Tolerated losses:** a copied bundle does not update itself (a newer bundle is delivered); harness
wiring travels as `settings.json` only and is never installed over an existing one; project seeds are
reference, not installed; the gate is global, so a repository's own `core.hooksPath` wins.

## Execution Workflow

1. **Export.** From a clean checkout run `node scripts/export-agents.mjs`. It replaces
   `dist/.agents-bundle` in one swap, so a failure cannot leave a partial bundle.
2. **Verify.** Run `node .agents/skills/export-agents-configuration/scripts/verify-bundle.mjs dist/.agents-bundle`;
   it must print `Clean`. Never hand over a bundle with findings.
3. **Rehearse.** Run `bash scripts/rehearse-bundle-install.sh`. It proves install, idempotency, the
   update delta, note survival, the linked refusal and the gate, all in a throwaway home.
4. **Hand over.** Give the folder (or `dist/.agents-generic-<date>.tar.gz` from `--archive`) and
   `INSTALL.md`. The receiving agent runs the prompt; the human only says go.
5. **Update.** Re-export after the change, give the newer folder, repeat the prompt. To show what
   changed first: `node scripts/export-agents.mjs --check --out <their copy>` lists missing, extra and
   changed files.
6. **Record.** Note the bundle path and date in the reply. Do not write a shared-drive TODO: the
   installer's state file and the prompt are the update channel.
7. **Report.** Give the counts, the verify result and the rehearsal result; commit only after approval.

## Error-Handling Playbook

| Symptom / Exit | Root cause | Autonomous correction |
| :--- | :--- | :--- |
| `export-agents: refusing to export` | A refused file is in the source tree | Move it out of the bundle roots; never rename it to pass |
| `the bundle would carry machine identifiers` | A drive path, home path or account name in a text file | Rewrite the line as `%USERPROFILE%\…`, `~/…` or the root variable; rerun |
| `refusing to replace … no MANIFEST.json` | The target is not an export | Choose another `--out`; never delete a folder you did not generate |
| `verify-bundle` hash mismatch | Truncated download or a lost file | Re-copy the archive; never install a bundle with findings |
| `verify-bundle` name does not match folder | A renamed skill folder | Fix the folder or the frontmatter `name`, then re-export |
| Installer exits 2, names a link | The machine installs from a linked checkout | Run that checkout's `node scripts/install-global.mjs --write`; do not mix models |
| Installer exits 1, conflict | A target skill folder is someone else's | Rename that skill or remove it with its owner's approval; rerun |
| Second `--check` is not `Up to date.` | A file the installer owns was edited after install | Re-run `--write` to restore it, or remove the drifted path and its state entry |
| Gate line absent after install | `core.hooksPath` names a foreign path | Report it; change it only with the owner's approval |
| Rehearsal fails on `cp` or `tar` | A POSIX tool missing | Install the tool or run the rehearsal on Linux; never skip the proof |

## Verification & Outputs

Run from the checkout:

```bash
node scripts/export-agents.mjs
node scripts/export-agents.mjs --check
node .agents/skills/export-agents-configuration/scripts/verify-bundle.mjs dist/.agents-bundle
bash scripts/rehearse-bundle-install.sh
node --test scripts/lib/install-bundle.test.mjs \
  .agents/skills/export-agents-configuration/scripts/verify-bundle.test.mjs
node scripts/check-skills.mjs
```

Expected: the export prints `wrote <n> files` for the tree it found; `--check` prints
`matches the checkout`; `verify-bundle` prints `Clean`; the rehearsal prints `PASS` for every step and
exits 0; both test suites are green; `check-skills` reports 0 hard and 0 soft findings.
`find dist/.agents-bundle -name test-results -print` prints nothing at any depth, because a skill's run
output is generated, never configuration.

**Exit criteria:** the stable path carries the same bytes on a second export; the bundle is clean; the
rehearsal proves install, idempotency, delta, note survival, linked refusal and the gate; no credential,
machine identifier or live state in the bundle; no `node_modules/` or `test-results/` folder at any depth.

**Files:** `SKILL.md`, `README.md`, `scripts/verify-bundle.mjs` (the arrival check) and
`scripts/verify-bundle.test.mjs`. The export and install themselves are
`scripts/export-agents.mjs`, `scripts/lib/export-plan.mjs`, `scripts/install-bundle.mjs`,
`scripts/lib/install-bundle.mjs` and `export/INSTALL.md`, `export/README.md`.
