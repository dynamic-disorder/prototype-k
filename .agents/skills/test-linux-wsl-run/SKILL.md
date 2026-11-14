---
name: test-linux-wsl-run
description: >-
  Run tests or a CI-like command on Linux through WSL from Git Bash, to check what Windows hides (CI runs on Ubuntu). Decides first if the change is trivial and then skips WSL. Use when: "test on Linux", "run it in WSL", "will this pass in CI on Ubuntu", "simulate the GitHub runner", or a change depends on paths, case-sensitive names, line endings, file modes, shell features (mapfile, find -print0) or the Python/Node version. Not for: a pure-logic change that CI will run anyway, docs-only changes, a one-line syntax fix.
---

# test-linux-wsl-run

WSL (Ubuntu) on this machine simulates the Linux CI runner. It is close, not equal: check the versions against the workflow before you say "passes on Linux".

## 1. Is it trivial? Decide before you start

Skip WSL and say "trivial, WSL skipped" when all hold: the change has no OS-dependent behaviour, the tests already pass on Windows, and CI will run them on the pull request anyway.
Use WSL when any holds: the workflow or a shell script changed; paths, case, line endings or file modes matter; the code shells out; the tests were never run on Linux; the user asks for it.

## 2. Pre-flight (about 15 s)

```bash
bash ~/.agents/skills/test-linux-wsl-run/test-linux-wsl-run.sh
```

It prints the distro, `python3`, `venv`, `node`, the repo path inside WSL and the network state. Compare `python3` and `node` with the workflow (`actions/setup-python`, `<PROJECT_ROOT>/web/.nvmrc`) and name every difference in the report.

## 3. Run

- Run from the repo in `/mnt/c/...`: reads are fast. Keep the venv or `node_modules` in the WSL home (`~/<name>-venv`), not on `/mnt/c`.
- Call the tools by path (`~/<name>-venv/bin/python -B -m pytest -q -p no:cacheprovider ...`). Do not rely on `activate`: each `wsl.exe -e bash -c` is a new shell.
- The system Linux binary is `python3`, there is no `python` (the venv has both). `-B` and `-p no:cacheprovider` keep the run from leaving files in the repo.
- Use the same file collection as the workflow (copy its `find`/`mapfile` line), not a broader one.
- Commands over 300 s move to the background and a pipe into `tail` shows nothing until the end. Read the output file when notified.

## 4. Known traps on this machine

- **No network in WSL:** DNS fails (`/etc/resolv.conf` has only `8.8.8.8` and `1.1.1.1`), so `pip` and `npm` hang with no output. Do not change `/etc/resolv.conf` or `/etc/wsl.conf` without asking. Instead download in Git Bash and install offline:
  ```bash
  python -m pip download --dest <wheels> --only-binary=:all: --platform manylinux2014_x86_64 --python-version <WSL minor, e.g. 3.12> --implementation cp <pkg>==<version>
  ~/<name>-venv/bin/python -m pip install --no-index --find-links <wheels> <pkg>==<version>
  ```
  Pure-Python wheels only. A package that builds native code needs another route: ask the user.
- **`git` on `/mnt/c` is very slow** (`git status` took about 5 minutes). Run all git commands in Git Bash, never in WSL.
- **No `node` in WSL.** Node tests cannot run there until it is installed offline. Ask before `sudo apt install` or any change to the distro.
- `wsl.exe -l -v` prints UTF-16: pipe through `tr -d '\0'`. `wsl.exe -e` also prints `your 131072x1 screen size is bogus`: harmless.

## 5. Report

One short block: distro and versions (WSL against CI), the command, the counts, and what you could not check (Node, a different Python minor, a different distro). Write "passes on Linux in WSL (Python 3.12), CI uses 3.11", never plain "passes on Linux".

To hand the steps to a person, write them as numbered baby steps with the command and the expected output per step, and test them once yourself first.
