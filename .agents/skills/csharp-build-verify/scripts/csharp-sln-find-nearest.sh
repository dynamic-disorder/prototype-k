#!/usr/bin/env bash
# csharp-sln-find-nearest.sh <changed-file>
# Prints the nearest .sln walking up from the file's folder; falls back to the first
# .sln under the current directory (bin/obj excluded). Prints nothing if none exists.
# Used by pre-commit-build-check.sh and pre-push-build-check.sh.

dir=$(dirname "${1:?Usage: csharp-sln-find-nearest.sh <changed-file>}")
while [ "$dir" != "." ] && [ "$dir" != "/" ]; do
  found=$(find "$dir" -maxdepth 1 -name "*.sln" 2>/dev/null | head -1)
  if [ -n "$found" ]; then
    echo "$found"
    exit 0
  fi
  dir=$(dirname "$dir")
done

find . -name "*.sln" -not -path "*/bin/*" -not -path "*/obj/*" 2>/dev/null | head -1
