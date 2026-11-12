---
name: windows-bash
description: Bash on Windows through Git Bash - the substitutions and traps that silently break scripts there, python3 resolving to the Store alias, jq and JSON piping, cygpath for Node, and why execSync runs under cmd.exe. Use when a script must run on Windows, when a path works on Linux and fails there, or when a Node script shells out.
---

# windows-bash

Extended examples: `references/bash_patterns_windows_reference.md`.

- **Python:** `python`, never `python3` — on Windows `python3` resolves to the Microsoft Store alias and exits with code 49.
- **JSON:** use `jq`. Fall back to `node -e` reading a file. Never pipe to Node's stdin (`/dev/stdin` does not exist for it there) and never use `/tmp` (it becomes `C:\tmp`).
- **Paths for Node:** convert with `cygpath -m "$path"`. `$TEMP` carries backslashes and `$HOME` is a mounted-drive path; both break in Node.
- **`execSync` runs in `cmd.exe`,** which does not understand single-quoted strings or POSIX env-prefix syntax (`PGPASSWORD=... psql`) and fails with a misleading "cannot find the path" error. In any `.mjs`/`.js` script that shells out, use an explicit bash helper from the start:

  ```js
  import { execFileSync } from 'node:child_process';
  const bash = (cmd, opts = {}) => execFileSync('bash', ['-c', cmd], { encoding: 'utf8', ...opts });
  ```
