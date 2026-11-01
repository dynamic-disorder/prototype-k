#!/usr/bin/env bash
# Installs the executive-first documentation style into every AI harness's user-global config.
#
# Idempotent and non-destructive: it upserts ONE managed block delimited by
#   <!-- BEGIN managed: documentation-style --> ... <!-- END managed: documentation-style -->
# into each target file. Everything outside those markers is left exactly as it was, so your
# existing global instructions are never overwritten. Re-running after editing
# managed-block.md updates the block in place.
#
# Usage:
#   ./install.sh                 # install into every detected harness
#   ./install.sh --dry-run       # show what would change
#   ./install.sh --check         # exit 1 if any target is missing or out of date
#
# Works on Arch/Omarchy, Ubuntu, macOS and anywhere bash runs. Uses $HOME only.

set -euo pipefail

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BLOCK="$HERE/managed-block.md"
BEGIN_MARK="<!-- BEGIN managed: documentation-style -->"
END_MARK="<!-- END managed: documentation-style -->"

DRY_RUN=0
CHECK_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY_RUN=1 ;;
    --check|-c)   CHECK_ONLY=1 ;;
    -h|--help)    sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'ERROR: unknown option: %s\nTry --help.\n' "$arg" >&2; exit 2 ;;
  esac
done

[[ -f "$BLOCK" ]] || { printf 'ERROR: missing %s\n' "$BLOCK" >&2; exit 2; }
BLOCK_TEXT="$(cat -- "$BLOCK")"

# --- target resolution -------------------------------------------------------------------
# Each harness reads its user-global instructions from a different path. Probe in order and
# take the first directory that already exists, so an established setup is detected rather
# than a parallel one created; fall back to the documented default when nothing exists yet.
first_existing_dir() { for d in "$@"; do [[ -d "$d" ]] && { printf '%s' "$d"; return 0; }; done; return 1; }

TARGETS=()

# 1. DeepSeek Harness — always $DSH_HOME/AGENTS.md, $DSH_HOME defaults to ~/.dsh.
DSH_HOME_DIR="${DSH_HOME:-$HOME/.dsh}"
mkdir -p -- "$DSH_HOME_DIR" 2>/dev/null || true
TARGETS+=("$DSH_HOME_DIR/AGENTS.md|dsh")

# 2. Claude Code — user-global memory file.
mkdir -p -- "$HOME/.claude" 2>/dev/null || true
TARGETS+=("$HOME/.claude/CLAUDE.md|claude-code")

# 3. Cline — global rules directory. Historically ~/Documents/Cline/Rules; some builds use
#    ~/Cline/Rules or ~/.cline/rules. Prefer whatever already exists, else the documented path.
if CLINE_DIR="$(first_existing_dir "$HOME/Documents/Cline/Rules" "$HOME/Cline/Rules" "$HOME/.cline/rules")"; then
  TARGETS+=("$CLINE_DIR/documentation-style.md|cline")
elif [[ "$CHECK_ONLY" -eq 0 && "$DRY_RUN" -eq 0 ]]; then
  mkdir -p -- "$HOME/Documents/Cline/Rules" 2>/dev/null \
    && TARGETS+=("$HOME/Documents/Cline/Rules/documentation-style.md|cline") \
    || printf 'NOTE: Cline rules directory not creatable; skipped.\n' >&2
fi

# 4. Continue — global rules.
if CONT_DIR="$(first_existing_dir "$HOME/.continue/rules" "$HOME/.continue")"; then
  TARGETS+=("$CONT_DIR/rules/documentation-style.md|continue")
fi

# --- upsert ------------------------------------------------------------------------------
upsert_file() {
  local target="$1" mode="$2"

  if [[ "$mode" == "append-only" ]]; then
    # Whole-file target (a rules directory): the file IS the block, no markers needed.
    # Compare via command substitution on both sides so a trailing newline cannot make an
    # identical file look stale — that bug reported every synced file as OUT OF DATE.
    local cur=""
    [[ -f "$target" ]] && cur="$(cat -- "$target")"
    if [[ -n "$cur" && "$cur" == "$BLOCK_TEXT" ]]; then
      printf '  up to date   %s\n' "$target"; return 0
    fi
    if [[ "$CHECK_ONLY" -eq 1 ]]; then printf '  OUT OF DATE  %s\n' "$target"; return 1; fi
    if [[ "$DRY_RUN" -eq 1 ]]; then printf '  would write  %s\n' "$target"; return 0; fi
    mkdir -p -- "$(dirname -- "$target")"
    printf '%s\n' "$BLOCK_TEXT" > "$target"
    printf '  wrote        %s\n' "$target"; return 0
  fi

  # Inline target (a shared instruction file): replace only the managed block.
  local existing="" updated="" added=0
  [[ -f "$target" ]] && existing="$(cat -- "$target")"

  if printf '%s' "$existing" | grep -qF -- "$BEGIN_MARK"; then
    # Replace between markers, keeping everything before and after. Done with head/cat/tail, not
    # awk: passing the block through `awk -v` makes gawk read its backslashes as escapes, so the
    # guidance line `%USERPROFILE%\…` was written as `%USERPROFILE%…`. That also made a correctly
    # written block read as stale here forever.
    local start end tmp
    start="$(grep -nF -- "$BEGIN_MARK" "$target" | head -1 | cut -d: -f1)"
    end="$(grep -nF -- "$END_MARK" "$target" | head -1 | cut -d: -f1)"
    tmp="$(mktemp)"
    {
      if [[ -n "$start" && "$start" -gt 1 ]]; then head -n "$((start - 1))" -- "$target"; fi
      cat -- "$BLOCK"
      if [[ -n "$end" ]]; then tail -n "+$((end + 1))" -- "$target" || true; fi
    } > "$tmp"
    updated="$(cat -- "$tmp")"
    rm -f -- "$tmp"
  else
    updated="$existing"
    added=1
  fi

  if [[ "$added" -eq 1 ]]; then
    if [[ -n "${updated//[$'\n\r\t ']/}" ]]; then
      updated="${updated%$'\n'}"$'\n\n'"$BLOCK_TEXT"
    else
      updated="$BLOCK_TEXT"
    fi
  fi

  if [[ "$updated" == "$existing" ]]; then
    printf '  up to date   %s\n' "$target"; return 0
  fi
  if [[ "$CHECK_ONLY" -eq 1 ]]; then printf '  OUT OF DATE  %s\n' "$target"; return 1; fi
  if [[ "$DRY_RUN" -eq 1 ]]; then printf '  would update %s\n' "$target"; return 0; fi

  mkdir -p -- "$(dirname -- "$target")"
  printf '%s\n' "$updated" > "$target"
  if [[ "$added" -eq 1 ]]; then
    printf '  installed    %s (block appended, existing content preserved)\n' "$target"
  else
    printf '  updated      %s\n' "$target"
  fi
  return 0
}

# --- The guardrail that ships with every install -------------------------------------------
# The credential file is deliberately not a target: it is never read, never merged, never copied.
# The rule travels with the installer so a new machine cannot learn it late.
guardrail_section() {
  cat <<'GUARDRAIL'
### Credentials: never read the credential file

Binding, learned on 2026-11-01 the hard way: a session that checked "can two machines share `$DSH_HOME`?"
opened the credentials document to judge the risk, and printed live API keys into the transcript.

- **Never read, cat, print, grep for values in, hash, or copy the credential file** — on Windows
  `%USERPROFILE%\.dsh\.credentials.yaml`, on Linux and macOS `~/.dsh/.credentials.yaml`. The rule covers any
  file holding a secret; these two are the ones that exist. `Test-Path` (existence only) is fine.
- **Why it matters more than it looks:** shell and file tools run as the same user, so nothing blocks the
  read; the harness only keeps the path out of the model's hands, and a model that goes looking finds it.
  A read costs a rotation at the provider, not just an apology.
- **Do the job another way.** To learn which providers exist, read the non-secret `settings.yaml`
  (`apiKeyEnv`, provider ids, model ids). To change a credential, tell the owner which one and let them run
  the harness's own credential command. Never echo a secret, not even a fragment, and never re-print a
  match while scanning for one — report match counts and file lists only.
- If it is already exposed: say so flat, name the file and every place the text landed (tool output,
  session log), and ask the owner to revoke and reissue the key. Do not leave it to be discovered.

### Your own notes are not the credential store

- This file may name where a credential lives and how to change it, and nothing else. Never paste a key, a
  token or a password into these notes, a doc, a commit or a chat message — not even one the owner pasted
  first.
GUARDRAIL
}

# --- run ---------------------------------------------------------------------------------
printf 'documentation-style installer\n'
printf '  source : %s\n' "$BLOCK"
printf '  home   : %s\n\n' "$HOME"

status=0
seen=""
for entry in "${TARGETS[@]}"; do
  target="${entry%%|*}"
  harness="${entry##*|}"
  [[ "$seen" == *"|$target|"* ]] && continue
  seen="$seen|$target|"
  printf '[%s]\n' "$harness"
  # Rules-directory harnesses take the file verbatim; instruction-file harnesses use markers.
  if [[ "$harness" == "cline" || "$harness" == "continue" ]]; then
    upsert_file "$target" append-only || status=1
  else
    upsert_file "$target" inline || status=1
  fi
  # The credential guardrail rides in the AGENTS.md target, appended once and only when missing.
  if [[ "$harness" == "dsh" && "$CHECK_ONLY" -eq 0 && "$DRY_RUN" -eq 0 ]]; then
    if ! grep -qF -- '### Credentials: never read the credential file' "$target"; then
      { printf '\n'; guardrail_section; } >> "$target"
      printf '  guardrail    %s\n' "$target"
    fi
  fi
done

printf '\n'
if [[ "$CHECK_ONLY" -eq 1 ]]; then
  if [[ "$status" -eq 0 ]]; then printf 'All targets up to date.\n'; else printf 'Some targets are stale — run ./install.sh\n'; fi
  exit "$status"
fi
if [[ "$DRY_RUN" -eq 1 ]]; then
  printf 'Dry run — nothing written.\n'
else
  printf 'Done. Restart each harness to pick up the change.\n'
  printf 'Verify: ./install.sh --check\n'
fi
