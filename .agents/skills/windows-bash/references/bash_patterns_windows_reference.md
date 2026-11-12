# Bash on Windows - Extended Reference

Examples for `~/.agents/rules/bash_patterns_windows.md`. Not auto-loaded: read when debugging Git Bash and Node path issues.

## Why paths break

Git Bash maps `/tmp` and `/dev/stdin` to drive-rooted folders that do not exist, and Node sees the Windows form.

- **Works**: `$TEMP/file.json`, or `$(mktemp)` converted with `cygpath -m`
- **Fails**: `/tmp/...`, `/dev/stdin`, raw `$(mktemp)` passed to `node`

## Preferred: jq, no temp file

```bash
gh api repos/owner/repo/pulls/123/comments | jq -r '.[] | select(.path == "<PROJECT_ROOT>/file.cs") | .body'
gh api ... | jq '[.[] | select(.status == "open" and .draft == false)] | length'
gh api ... | jq '.[] | {author: .user.login, url: .html_url, text: .body}'
```

## Node needed (complex logic)

```bash
TMPFILE=$(mktemp); gh api ... > "$TMPFILE"
node -e "const d=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log(d[0].body)" "$(cygpath -m "$TMPFILE")"
rm "$TMPFILE"
```

For anything longer, put the logic in a script (`node ~/.agents/scripts/<name>.mjs <args>`).
