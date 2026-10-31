#!/usr/bin/env bash
# Publication gate: keep machine-specific identifiers out of the public repository.
#
# Every commit is public text. A home or profile path, an account, user, owner or host name, an
# employer or ticket identifier — none of it may land in a file, a doc, a config, a path example or
# a commit message. This script is the mechanical check behind that rule; the rule itself is stated
# in global-style/documentation-style.md and injected into every harness by
# global-style/managed-block.md.
#
# Usage, from the repository root:
#   bash local_dev/scripts/scan-publication-leaks.sh            # staged changes (the pre-commit gate)
#   bash local_dev/scripts/scan-publication-leaks.sh --diff     # unstaged working tree
#   bash local_dev/scripts/scan-publication-leaks.sh --all      # every tracked file
#   bash local_dev/scripts/scan-publication-leaks.sh --help
#
# Two tiers, because the two classes differ in kind:
#   FAIL  An identity or mount leak — a profile path, a home directory, a mounted drive tree.
#         Always a defect: rewrite it as %USERPROFILE%\, ~/ or the root variable.
#   WARN  A drive-letter path. Sometimes a deliberate illustration ("C:\data\input.csv"). Review
#         it: an example is fine, a path that exists on one machine only is a leak.
#
# Exit codes: 0 = no FAIL hits, 1 = FAIL hits found, 2 = usage or environment error.
# WARN hits do not change the exit code; they are printed for review either way.
#
# This file is the one exemption: it necessarily contains the patterns it searches for, so every mode
# excludes it — `--all` skips it by name, and the staged/diff modes use a pathspec to leave it out of
# the stream. Keep the pattern list here and nowhere else — a hand-copied duplicate drifts, and an
# inline copy in a document matches its own prose.

set -u

readonly SELF='local_dev/scripts/scan-publication-leaks.sh'

# FAIL — identity and mount leaks. No legitimate illustration uses these forms.
#   [A-Za-z]:[\/]Users[\/]   a Windows profile directory
#   /<letter>/Users/         the same profile through an MSYS mount
#   /mnt/ + a drive or label  a mounted volume, e.g. a project root under /mnt:
#                             a single lowercase letter (the WSL drive form), or a
#                             component carrying a digit or hyphen, or one that is
#                             all uppercase (the volume-label forms)
#   /home/<name>             a POSIX home directory
#   (^|space|quote)/<letter>/<name>   a mounted drive tree, e.g. the Git Bash form of a project root
#   drive + a checkout directory name    a drive-rooted source tree, e.g. a Windows project root
# The anchored alternative keeps a URL from matching, since a URL has ":" before "//".
# A plain word component (lowercase, no digit, no hyphen) is deliberately NOT matched: it is the
# shape of an illustration, and flagging it would train the reader to ignore the gate.
read -r -d '' FAIL_PATTERN <<'PATTERN' || true
([A-Za-z]:[\\/]Users[\\/]|/[a-z]/Users/|/mnt/([a-z]/[A-Za-z]|[^/[:space:]]*([0-9]|-)|[A-Z]{2,})|/home/[a-z]|(^|[[:space:](["'])/[a-z]/[A-Za-z]|[A-Za-z]:[\\/](code|src|dev|repos|projects|GitHub)[\\/])
PATTERN
FAIL_PATTERN="${FAIL_PATTERN%$'\n'}"

# WARN — any drive-letter path. Review; illustration or leak. Backslash only on purpose: a forward
# slash after a letter is what "https://" looks like, so matching "/" would flag every URL.
read -r -d '' WARN_PATTERN <<'PATTERN' || true
([A-Za-z]:\\)
PATTERN
WARN_PATTERN="${WARN_PATTERN%$'\n'}"

usage() {
    cat <<'USAGE'
Publication gate — scan for machine-specific identifiers before committing.

  bash local_dev/scripts/scan-publication-leaks.sh            staged changes (default)
  bash local_dev/scripts/scan-publication-leaks.sh --diff     unstaged working tree
  bash local_dev/scripts/scan-publication-leaks.sh --all      every tracked file
  bash local_dev/scripts/scan-publication-leaks.sh --help

Exit 0 = no FAIL hits, 1 = FAIL hits found, 2 = usage or environment error.

What to write instead of a machine path:
  %USERPROFILE%\...                      on Windows
  ~/...                                  on Linux and macOS
  $REPO_ROOT / $RepoRoot / %REPO_ROOT%    the root variable, from local_dev/scripts/repo-env.sh
USAGE
}

mode='staged'
case "${1:-}" in
    --staged | '') mode='staged' ;;
    --diff) mode='diff' ;;
    --all) mode='all' ;;
    -h | --help) usage; exit 0 ;;
    *) echo "error: unknown argument: $1" >&2; usage >&2; exit 2 ;;
esac

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "error: not inside a git work tree" >&2
    exit 2
fi

count() { printf '%s\n' "$1" | grep -c . || true; }

fails=0
warns=0
scanned=0

report() {
    local label="$1" text="$2"
    [ -n "$text" ] || return 0
    printf '\n%s\n' "$label"
    printf '%s\n' "$text" | sed 's/^/  line /'
}

# scan_diff <label> — added lines of a diff stream on stdin.
scan_diff() {
    local label="$1" failed warned
    failed="$(grep -E '^\+' | grep -nE "$FAIL_PATTERN" || true)"
    warned="$(grep -E '^\+' | grep -nE "$WARN_PATTERN" || true)"
    report "$label FAIL — rewrite before committing:" "$failed"
    report "$label WARN — drive-letter path, review:" "$warned"
    fails=$((fails + $(count "$failed")))
    warns=$((warns + $(count "$warned")))
}

case "$mode" in
    staged)
        if git diff --cached --quiet 2>/dev/null; then
            echo 'nothing staged — pass --diff or --all to scan something else'
            exit 0
        fi
        scanned=$(git diff --cached --name-only -- . ":(exclude)$SELF" | grep -c . || true)
        scan_diff 'staged changes:' < <(git diff --cached -U0 -- . ":(exclude)$SELF")
        ;;
    diff)
        scanned=$(git diff --name-only -- . ":(exclude)$SELF" | grep -c . || true)
        scan_diff 'working tree (unstaged):' < <(git diff -U0 -- . ":(exclude)$SELF")
        ;;
    all)
        while IFS= read -r file; do
            [ "$file" = "$SELF" ] && continue
            scanned=$((scanned + 1))
            failed="$(grep -nE "$FAIL_PATTERN" -- "$file" 2>/dev/null || true)"
            warned="$(grep -nE "$WARN_PATTERN" -- "$file" 2>/dev/null || true)"
            if [ -n "$failed" ] || [ -n "$warned" ]; then
                printf '\n%s\n' "$file"
                [ -n "$failed" ] && printf '%s\n' "$failed" | sed 's/^/  FAIL line /'
                [ -n "$warned" ] && printf '%s\n' "$warned" | sed 's/^/  warn line /'
                fails=$((fails + $(count "$failed")))
                warns=$((warns + $(count "$warned")))
            fi
        done < <(git ls-files)
        ;;
esac

if [ "$fails" -gt 0 ]; then
    printf '\nFAIL: %s identity/mount leak(s), %s drive path(s) to review, %s item(s) scanned.\n' \
        "$fails" "$warns" "$scanned"
    printf 'Rewrite each FAIL line as %%USERPROFILE%%\\..., ~/..., or the root variable\n'
    printf '($REPO_ROOT, exported by local_dev/scripts/repo-env.sh). Do not commit.\n'
    exit 1
fi

printf 'PASS: 0 identity/mount leaks, %s drive path(s) to review, %s item(s) scanned.\n' "$warns" "$scanned"
exit 0
