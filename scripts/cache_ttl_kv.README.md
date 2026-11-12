# cache-ttl-kv.sh

**Executive summary:** Disk cache with a TTL for skills that fetch the same external data repeatedly. Entries live in `~/.agents/cache/<key>.json`. Only `skills/git-pr-fetch/fetch-pr.mjs` uses it (900 s TTL per PR).

## Commands

- `cache-ttl-kv.sh get <key>` - print the cached value; exit 1 on miss or expiry
- `cache-ttl-kv.sh set <key> <ttl_seconds> <val>` - store a value; reads stdin if `<val>` is omitted
- `cache-ttl-kv.sh del <key>` - delete one entry
- `cache-ttl-kv.sh clear` - wipe all entries

## Rules

- Keys allow only `A-Za-z0-9._-`; anything else is rejected (keys end up in file paths and a `node -e` string).
- Internal helper, no stability guarantee outside `~/.agents` skills.
- Callers must tolerate a miss or failure (`|| true`); the cache is an optimisation, never a dependency.
