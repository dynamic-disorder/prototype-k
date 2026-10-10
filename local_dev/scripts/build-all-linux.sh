#!/usr/bin/env bash
#
# Builds (and optionally tests) every .NET solution in this mono-repo on
# Linux/macOS, then reports a per-solution summary.
#
#   ./local_dev/scripts/build-all-linux.sh                 # Debug build, all solutions
#   ./local_dev/scripts/build-all-linux.sh -c Release      # Release build
#   ./local_dev/scripts/build-all-linux.sh --test          # build, then run tests
#   ./local_dev/scripts/build-all-linux.sh --test -c Release
#
# Notes
#  * Windows-only projects (WPF, net10.0-windows10.0.19041.0) still *compile*
#    here because Directory.Build.props sets EnableWindowsTargeting=true.
#    They remain unrunnable on Linux — that is expected, not a failure.
#  * Every project targets net10.0, so test assemblies need the .NET 10 runtime.
#    If only an older runtime were installed the script falls back to
#    DOTNET_ROLL_FORWARD=LatestMajor instead of failing, and says so.
#
set -uo pipefail

# Repository location and environment come from the shared resolver, so nothing here is
# hard-coded — see repo-env.sh.
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=repo-env.sh
. "$script_dir/repo-env.sh"
cd "$REPO_ROOT" || exit 1

dotnet_bin="${DOTNET:-dotnet}"

configuration="Debug"
run_tests=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--configuration)
      [[ $# -ge 2 ]] || { echo "error: $1 requires a value" >&2; exit 2; }
      configuration="$2"; shift 2 ;;
    --test) run_tests=true; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "error: unknown argument '$1'" >&2; exit 2 ;;
  esac
done

# Every project targets net10.0; running the test hosts needs the .NET 10 runtime.
if ! "$dotnet_bin" --list-runtimes 2>/dev/null | grep -q 'Microsoft\.NETCore\.App 10\.'; then
  export DOTNET_ROLL_FORWARD=LatestMajor
  echo "note: no .NET 10 runtime found — using DOTNET_ROLL_FORWARD=LatestMajor for test execution."
  echo
fi

mapfile -t solutions < <(find . -maxdepth 2 -name '*.sln' -not -path './local_user_files/*' | sort)
if [[ ${#solutions[@]} -eq 0 ]]; then
  echo "error: no .sln files found under $REPO_ROOT" >&2
  exit 1
fi

build_failures=()
test_failures=()
results=()

for sln in "${solutions[@]}"; do
  echo "════════ ${sln#./} (build, $configuration) ════════"
  if "$dotnet_bin" build "$sln" -c "$configuration" --nologo; then
    results+=("build  OK    ${sln#./}")
  else
    results+=("build  FAIL  ${sln#./}")
    build_failures+=("$sln")
    continue
  fi

  [[ "$run_tests" == true ]] || continue

  echo "──────── ${sln#./} (test) ────────"
  if "$dotnet_bin" test "$sln" -c "$configuration" --no-build --nologo; then
    results+=("test   OK    ${sln#./}")
  else
    results+=("test   FAIL  ${sln#./}")
    test_failures+=("$sln")
  fi
done

echo
echo "════════ summary ════════"
printf '%s\n' "${results[@]}"

if [[ ${#build_failures[@]} -gt 0 || ${#test_failures[@]} -gt 0 ]]; then
  echo
  [[ ${#build_failures[@]} -gt 0 ]] && echo "build failures: ${build_failures[*]}"
  [[ ${#test_failures[@]} -gt 0 ]] && echo "test failures:  ${test_failures[*]}"
  exit 1
fi

echo
echo "All solutions built successfully${run_tests:+ and passed tests}."
