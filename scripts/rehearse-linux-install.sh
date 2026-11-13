#!/usr/bin/env bash
# Rehearse the Linux install path against a throwaway HOME, so the real ~/.agents is never touched.
#
# Usage, from this repository (WSL or any Linux box):
#   bash scripts/rehearse-linux-install.sh          # clean up the temporary home afterwards
#   bash scripts/rehearse-linux-install.sh --keep   # leave it on disk and print the path
#
# Every step runs with HOME redirected, including the global git config the installer writes, so the
# machine's own ~/.agents, ~/.gitconfig and hooks path stay as they were. Exit 1 when any check fails.

set -uo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
keep=0
[[ "${1:-}" == "--keep" ]] && keep=1

home="$(mktemp -d)"
failures=0

finish() {
  if [[ $keep -eq 1 ]]; then
    echo "kept:    $home"
  else
    rm -rf "$home"
    echo "cleaned: $home"
  fi
  if [[ $failures -gt 0 ]]; then
    echo "failed:  $failures check(s)"
    exit 1
  fi
  echo "result:  all checks passed"
}

trap finish EXIT

pass() { echo "  ok    $1"; }
fail() { echo "  FAIL  $1"; failures=$((failures + 1)); }

run() { # label, command...
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then pass "$label"; else fail "$label"; fi
}

echo "repo:  $repo_root"
echo "home:  $home (temporary)"
echo "node:  $(node -v 2>/dev/null || echo missing)   git: $(git --version 2>/dev/null | awk '{print $3}')"

export HOME="$home"
git config --global --add safe.directory "$repo_root" 2>/dev/null
cd "$repo_root" || exit 1

echo "install"
run "install-global --write" node scripts/install-global.mjs --write
run "install-global check" node scripts/install-global.mjs
run "shared block installed" node global/install.mjs
run "style block installed" node output-style/install.mjs
run "shared block current" node global/install.mjs --check
run "style block current" node output-style/install.mjs --check

echo "links"
skill_link="$(readlink -f "$home/.agents/skills/git-commit" 2>/dev/null || true)"
[[ "$skill_link" == "$repo_root/.agents/skills/git-commit" ]] \
  && pass "skill link resolves into the checkout" \
  || fail "skill link resolves into the checkout (got '$skill_link')"

githooks_link="$(readlink -f "$home/.agents/githooks" 2>/dev/null || true)"
[[ "$githooks_link" == "$repo_root/.githooks" ]] \
  && pass "githooks link resolves into the checkout" \
  || fail "githooks link resolves into the checkout (got '$githooks_link')"

hooks_path="$(git config --global --get core.hooksPath 2>/dev/null || true)"
[[ "$hooks_path" == "$home/.agents/githooks" ]] \
  && pass "hooksPath is the temporary home" \
  || fail "hooksPath is the temporary home (got '$hooks_path')"

linked="$(ls -1 "$home/.agents/skills" 2>/dev/null | wc -l | tr -d ' ')"
expected="$(ls -1 "$repo_root/.agents/skills" | wc -l | tr -d ' ')"
[[ "$linked" == "$expected" ]] \
  && pass "skills linked: $linked of $expected" \
  || fail "skills linked: $linked of $expected"

echo "gate"
run "pre-commit exits 0 with nothing staged" bash "$home/.agents/githooks/pre-commit"

echo "checker"
run "check-skills" node scripts/check-skills.mjs

echo "tests"
tests_out="$(node --test scripts/lib/*.test.mjs 2>&1)"
# A terminal prints "ℹ tests", a pipe prints TAP "# tests"; one parse covers both.
summary() { printf '%s\n' "$tests_out" | grep -E "^(ℹ $1|# $1)" | tail -1 | grep -oE '[0-9]+$'; }
total="$(summary tests)"
ok="$(summary pass)"
bad="$(summary fail)"
if [[ -n "$total" && "$ok" == "$total" && "$bad" == "0" ]]; then
  pass "library tests: $ok/$total"
else
  fail "library tests: ${ok:-?}/${total:-?}, ${bad:-?} failed"
fi
