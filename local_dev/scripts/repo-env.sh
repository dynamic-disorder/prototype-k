#!/usr/bin/env bash
# Repository and environment locations, resolved at runtime — nothing machine-specific.
#
# The repository root is derived from this file's own location, so every script can work from any
# working directory on any machine instead of hard-coding an absolute path.
#
# Source it (recommended) and use the exported variables:
#
#   source local_dev/scripts/repo-env.sh
#   dotnet build "$REPO_ROOT/CsvTranslations/CsvTranslations.sln"
#   [ "$HAS_PWSH" = 1 ] || echo "pwsh is unavailable here"
#
# Or run it directly for a summary or machine-readable form:
#
#   ./local_dev/scripts/repo-env.sh
#   ./local_dev/scripts/repo-env.sh --json
#
# Deliberately does not call `set` — when sourced it must not change the caller's shell options.

# ---------------------------------------------------------------- repository
_repo_env_self="${BASH_SOURCE[0]}"
if command -v readlink >/dev/null 2>&1; then
  _repo_env_resolved="$(readlink -f -- "$_repo_env_self" 2>/dev/null || printf '%s' "$_repo_env_self")"
else
  _repo_env_resolved="$_repo_env_self"
fi
REPO_ROOT="$(cd -- "$(dirname -- "$_repo_env_resolved")/../.." && pwd)"
REPO_NAME="$(basename -- "$REPO_ROOT")"
unset _repo_env_self _repo_env_resolved

# --------------------------------------------------------------- environment
case "$(uname -s 2>/dev/null)" in
  Linux*)               HOST_OS=linux ;;
  Darwin*)              HOST_OS=macos ;;
  MINGW*|MSYS*|CYGWIN*) HOST_OS=windows ;;
  *)                    HOST_OS=unknown ;;
esac
if [ "$HOST_OS" = windows ]; then IS_WINDOWS=1; else IS_WINDOWS=0; fi

LOCAL_DEV="$REPO_ROOT/local_dev"
LOCAL_USER_FILES="$REPO_ROOT/local_user_files"

if command -v dotnet >/dev/null 2>&1; then
  DOTNET="$(command -v dotnet)"
else
  DOTNET=""
fi

_repo_env_has() { command -v "$1" >/dev/null 2>&1 && printf 1 || printf 0; }
HAS_NODE="$(_repo_env_has node)"
HAS_PWSH="$(_repo_env_has pwsh)"
HAS_PYTHON3="$(_repo_env_has python3)"
HAS_JQ="$(_repo_env_has jq)"
unset -f _repo_env_has

# -------------------------------------------------------- project locations
# Discovered, not listed: every solution in the repo, repo-relative.
SOLUTIONS=""
while IFS= read -r _repo_env_sln; do
  [ -n "$_repo_env_sln" ] || continue
  SOLUTIONS="${SOLUTIONS:+$SOLUTIONS }$_repo_env_sln"
done < <(
  cd "$REPO_ROOT" 2>/dev/null &&
    find . -maxdepth 2 -name '*.sln' -not -path './local_user_files/*' 2>/dev/null |
    sed 's|^\./||' | sort
)
unset _repo_env_sln

export REPO_ROOT REPO_NAME HOST_OS IS_WINDOWS LOCAL_DEV LOCAL_USER_FILES DOTNET \
       HAS_NODE HAS_PWSH HAS_PYTHON3 HAS_JQ SOLUTIONS

# --------------------------------------------------------------- direct use
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  _repo_env_bool() { if [ "$1" = 1 ]; then printf 'true'; else printf 'false'; fi; }

  if [ "${1:-}" = "--json" ]; then
    _repo_env_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }
    printf '{\n'
    printf '  "repoRoot": "%s",\n' "$(_repo_env_escape "$REPO_ROOT")"
    printf '  "repoName": "%s",\n' "$(_repo_env_escape "$REPO_NAME")"
    printf '  "hostOs": "%s",\n' "$HOST_OS"
    printf '  "isWindows": %s,\n' "$(_repo_env_bool "$IS_WINDOWS")"
    printf '  "localDev": "%s",\n' "$(_repo_env_escape "$LOCAL_DEV")"
    printf '  "localUserFiles": "%s",\n' "$(_repo_env_escape "$LOCAL_USER_FILES")"
    printf '  "dotnet": "%s",\n' "$(_repo_env_escape "$DOTNET")"
    printf '  "has": { "node": %s, "pwsh": %s, "python3": %s, "jq": %s },\n' \
      "$(_repo_env_bool "$HAS_NODE")" "$(_repo_env_bool "$HAS_PWSH")" \
      "$(_repo_env_bool "$HAS_PYTHON3")" "$(_repo_env_bool "$HAS_JQ")"
    printf '  "solutions": ['
    _repo_env_sep=""
    for _repo_env_sln in $SOLUTIONS; do
      printf '%s\n    "%s"' "$_repo_env_sep" "$(_repo_env_escape "$_repo_env_sln")"
      _repo_env_sep=,
    done
    printf '%s]\n}\n' "$([ -n "$SOLUTIONS" ] && printf '\n  ' || printf '')"
    unset _repo_env_escape _repo_env_sep _repo_env_sln
  else
    printf 'repository : %s\n' "$REPO_ROOT"
    printf 'name       : %s\n' "$REPO_NAME"
    printf 'host OS    : %s\n' "$HOST_OS"
    printf 'local_dev  : %s\n' "$LOCAL_DEV"
    printf 'scratch    : %s\n' "$LOCAL_USER_FILES"
    printf 'dotnet     : %s\n' "${DOTNET:-(not found)}"
    printf 'tools      : node=%s pwsh=%s python3=%s jq=%s\n' \
      "$HAS_NODE" "$HAS_PWSH" "$HAS_PYTHON3" "$HAS_JQ"
    printf 'solutions  :\n'
    for _repo_env_sln in $SOLUTIONS; do printf '  %s\n' "$_repo_env_sln"; done
    unset _repo_env_sln
  fi
  unset -f _repo_env_bool
fi
