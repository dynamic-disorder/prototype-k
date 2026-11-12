# repo-env-paths.sh

Finds the prototype-k repository root and the settings file that holds credentials. Every other `repo-env-*.sh` file depends on this one.

## What it's for

Skills and scripts need to know two things before they can do anything else:

- **Where is the repo root?**
- **Where is the settings file with my credentials?**

This file answers both, so no script has to hardcode a path or guess.

## Functions

### `get_repo_root`

Returns the absolute path to the prototype-k repo root. Tries each of the following, in order, until one succeeds:

1. **Git auto-detection** — if the current directory is inside a git repo, and that repo's root passes the marker check below, use it.
2. **Walk up from the current directory** — check each parent folder against the marker check, all the way up.
3. **`$PRODUCT_NAME_LOCAL` environment variable** — used only if steps 1–2 both fail, and only if it points to a real directory. This is an **optional override**, not a requirement.
4. **Interactive prompt** — if none of the above worked and the script is running in a terminal, ask the user for a path.
5. Otherwise, print a clear error and fail.

```bash
REPO_ROOT=$(get_repo_root) || exit 1
```

**The marker check** (`_is_repo_root`) confirms a folder is really the prototype-k root by checking that its git `origin` URL ends in `$REPO` (with or without `.git`; `$REPO.wiki` does not match).

> **Why not just check `AGENTS.md`?** The original version of this check looked for the word "prototype-k" inside root `AGENTS.md`. That word never actually appears there, so the check always failed silently — every call fell through to requiring `PRODUCT_NAME_LOCAL`, even though the repo itself was easy to find. The marker check above is what actually distinguishes an prototype-k checkout from any other repo.

### `get_repo_settings_file`

Returns the path to `<prototype-k-repo>/.agents/settings.local.json`, using `get_repo_root` internally.

```bash
SETTINGS_FILE=$(get_repo_settings_file) || exit 1
```

If the file doesn't exist yet, it fails with an error pointing to the personal-vs-team setup README.

> 💡 You usually won't call either function directly — the credential loaders below call them for you.

## Used by

- [repo-env-github.md](repo-env-github.md)
- [repo-env-db.md](repo-env-db.md)

### `get_repo_wiki_clone`

Returns the local `prototype-k.wiki` clone: `$PRODUCT_NAME_WIKI_CLONE` if set, else the folder next to `$PRODUCT_NAME_LOCAL`. Never prompts (safe in hooks); returns 1 when neither variable is set.

```bash
WIKI_CLONE=$(get_repo_wiki_clone) || exit 0
```
