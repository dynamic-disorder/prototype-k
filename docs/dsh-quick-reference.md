# DSH quick reference

**TL;DR** — The shell commands that run, inspect and repair the local DeepSeek Harness install, with
the failures this machine has actually produced and what each one means.

Written against `@deepseek-ai/dsh` 0.2.2-rc.1 and verified on 2026-11-15. Re-run a command before
trusting this page after an upgrade.

## Run

| Command | Effect |
| :--- | :--- |
| `dsh web` | Boot the `web` profile and open `http://127.0.0.1:3080` with an access token in the URL. |
| `dsh --profile <name>` | Boot any profile under `~/.dsh/profiles/`. `dsh <name>` is the short form. |
| `dsh web --port 8080 --no-open` | Another port, no browser. `--port 0` lets the OS pick a free port. |
| `dsh web --host 127.0.0.1` | Bind one concrete local interface address. |
| `dsh rescue --from-default-profile web` | Recreate the `rescue` profile from the shipped `web` template, then boot it. |
| `dsh --help`, `dsh web --help` | Launcher flags and app flags. |

The printed URL carries an access token. Treat it like a password: keep it out of issues and
screenshots.

## Inspect

| Command | Effect |
| :--- | :--- |
| `dsh --profile web --dump-config` | Print the composed tree: every bundle layer plus the profile's `cordis.patch.yml`, one `id`/`name` block per plugin. Nothing is mounted. Patch warnings go to stderr. The output is long; pipe it to `less` or filter for an id. |
| `dsh --profile web --dump-default-config` | The same tree without the user layer or `--patch` overlays. |
| `dsh --profile web --patch <file>` | Boot with one extra patch overlay (repeatable). |
| `dsh plugin --profile web why <package>` | Show which profile dependency pulls a package in. |
| `dsh plugin --profile web list --depth 0` | The profile's direct dependencies and its folder. |

There is no `dsh status` or `dsh doctor`: the first word after `dsh` is a profile name, so
`dsh status` means "boot a profile called status". Runtime health is in the web UI; the composed
configuration is `--dump-config`; boot failures write a full log under `~/.dsh/logs/`.

## Plugins

Dependencies live in `~/.dsh/profiles/<name>/package.json`; the plugin commands forward to pnpm in
that folder.

- Install: `dsh plugin --profile web add @deepseek-ai/<package>@<version>`. Pin the exact version;
  the `@deepseek-ai/*` packages are released together.
- Remove: `dsh plugin --profile web remove <package>`.
- Installing is not loading. A package loads only when `dsh.profile.bundles` lists it or a
  `cordis.patch.yml` entry inserts it by name.
- Peer dependencies are not installed automatically (`autoInstallPeers: false`). If a plugin
  declares a peer the host does not ship, add that peer to the profile as well.
- Edit the profile's `cordis.patch.yml`, not the generated `cordis.yml`.

## Troubleshooting

| Symptom | Meaning | Fix |
| :--- | :--- | :--- |
| `EADDRINUSE ... 127.0.0.1:3080` | Another `dsh web` owns the port. | Stop it, or start with `--port 8080`. |
| `dsh: profile "<word>" does not exist` | The first argument was read as a profile name. | Use a real profile; there is no `status` command. |
| `warning: N entry did not activate` plus `ERR_MODULE_NOT_FOUND` | A plugin imports a package that is not installed. | Read the `imported from` path in the error, then add that package to the same profile. |
| `Cannot find package X` while `X` is a symlink under `~/.dsh/profiles/node_modules` | The link's target no longer exists. | Install `X` into the profile; delete the dead link if it is stale. |
| `patch: entry "<id>" not found` on stderr | A user patch targets an id this profile's bundles do not contain. | The row is inert: remove it, or install the plugin it configures. |
| `no credential for provider route` / `MISSING_CREDENTIAL` | The provider's `apiKeyEnv` variable is neither exported nor stored. | Store it on the Models page, or export it before starting `dsh`. |

## Files

- `~/.dsh/profiles/<name>/package.json` — dependencies and `dsh.profile.bundles`.
- `~/.dsh/profiles/<name>/cordis.patch.yml` — the user patch layer, applied after the bundles.
- `~/.dsh/profiles/node_modules` — links into the dsh install, shared by every profile.
- `~/.dsh/logs/` — startup logs, with full diagnostics after a failed boot.
