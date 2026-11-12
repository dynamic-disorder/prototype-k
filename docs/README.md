# Documentation

**TL;DR** — The public documentation tier for this repository. Two readers: someone deciding whether a
document applies to them, and a session that needs to know what is already written before writing more.

## The set

| Folder | Holds | Read when |
| :--- | :--- | :--- |
| [`agents/`](agents/README.md) | The four source specs for authoring an agent skill: `SKILL.md` structure, the skill `README.md` style, why skill logic is `.mjs`, and which work belongs in a script | Writing or revising a skill under `.agents/skills/` |
| [`plans/`](plans/README.md) | Dated plans for changing this repository's structure, with their decisions and verification | Before moving files or changing what this checkout is for |

A folder joins this table when it carries a `README.md` of its own; the row says who reads it rather than
restating its contents.

## What belongs here

Public text: no machine path, no account or host name, nothing that only one clone can resolve. Material that
exists for one machine or one investigation belongs in `local_dev/` (tracked working notes) or
`local_user_files/` (git-ignored scratch) instead.

## Documentation

Written here: this map. `AGENTS.md` at the repository root is the entry point and links back to it.
