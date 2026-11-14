#!/usr/bin/env bash
# Pre-flight for running tests in WSL from Git Bash. One line per check, no side effects.
# Why: WSL on this kind of machine can lack DNS, python3-venv or node, and each gap shows up as a hang, not an error.
# Usage: bash ~/.agents/skills/test-linux-wsl-run/test-linux-wsl-run.sh
set -u

if ! command -v wsl.exe >/dev/null 2>&1; then
  echo "FAIL wsl.exe not found. Install WSL from an administrator PowerShell: wsl --install"
  exit 1
fi

# wsl.exe prints UTF-16 (NUL bytes) for its own commands and a harmless "screen size" warning for -e.
clean() { tr -d '\0' | grep -v 'screen size is bogus'; }
in_wsl() { wsl.exe -e bash -c "$1" 2>&1 | clean; }

echo "== distros =="
wsl.exe -l -v 2>&1 | clean

echo "== checks =="
echo "os:      $(in_wsl 'grep PRETTY_NAME /etc/os-release | cut -d= -f2')"
echo "python3: $(in_wsl 'python3 --version 2>&1 | head -1')"
echo "venv:    $(in_wsl 'python3 -c "import ensurepip" >/dev/null 2>&1 && echo ok || echo "MISSING - sudo apt install python3-venv"')"
echo "node:    $(in_wsl 'node --version 2>&1 | head -1')"
echo "repo:    $(in_wsl "wslpath -a '$(cygpath -w "$PWD")'")"

status=$(in_wsl 'curl -sS -m 10 -o /dev/null -w "%{http_code}" https://pypi.org/simple/ 2>&1 | tail -1')
if [ "$status" = "200" ]; then
  echo "network: ok (pypi.org answers 200)"
else
  echo "network: BLOCKED ($status) - pip and npm hang in WSL. Download wheels in Git Bash, install with --no-index (see SKILL.md)"
fi
