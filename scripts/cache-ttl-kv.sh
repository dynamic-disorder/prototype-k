#!/bin/bash
# Disk cache with TTL for skills that fetch the same external data repeatedly.
# Usage:
#   cache-ttl-kv.sh get <key>                     - print cached value, exit 1 on miss/expired
#   cache-ttl-kv.sh set <key> <ttl_seconds> <val> - store value; val may be passed as stdin if omitted
#   cache-ttl-kv.sh del <key>                     - delete entry
#   cache-ttl-kv.sh clear                         - wipe all entries
# Internal to ~/.agents skills - not a general-purpose script; no external stability guaranteed.

CACHE_DIR="$HOME/.agents/cache"
mkdir -p "$CACHE_DIR"

# Convert to Windows-compatible path for Node.js (C:/... format)
CACHE_DIR_NODE=$(cygpath -m "$CACHE_DIR" 2>/dev/null || echo "$CACHE_DIR")

_key_file() { echo "$CACHE_DIR/$1.json"; }
_key_file_node() { echo "$CACHE_DIR_NODE/$1.json"; }

# Keys flow into file paths and (for get) get read back into a `node -e`
# source string built from the key file's path - restrict to a safe charset
# up front so nothing key-derived can break out of that context.
_validate_key() {
  case "$1" in
    ''|*[!A-Za-z0-9._-]*)
      echo "cache-ttl-kv.sh: invalid key: '$1'" >&2
      exit 1
      ;;
  esac
}

case "$1" in
  get)
    _validate_key "$2"
    FILE=$(_key_file "$2")
    FILE_NODE=$(_key_file_node "$2")
    [ -f "$FILE" ] || exit 1
    EXPIRES=$(node -e "
      const [file] = process.argv.slice(1);
      try{process.stdout.write(String(JSON.parse(require('fs').readFileSync(file))?.expires||0))}catch(e){process.stdout.write('0')}
    " "$FILE_NODE" 2>/dev/null)
    NOW=$(date +%s)
    [ "$NOW" -lt "${EXPIRES:-0}" ] || exit 1
    node -e "
      const [file] = process.argv.slice(1);
      try{process.stdout.write(JSON.parse(require('fs').readFileSync(file))?.value||'')}catch(e){}
    " "$FILE_NODE" 2>/dev/null
    ;;
  set)
    KEY="$2"; TTL="$3"; VAL="$4"
    _validate_key "$KEY"
    [ -z "$VAL" ] && VAL=$(cat)
    EXPIRES=$(( $(date +%s) + TTL ))
    node -e "
      const [file, expires, value] = process.argv.slice(1);
      require('fs').writeFileSync(file, JSON.stringify({expires: Number(expires), value}));
    " "$CACHE_DIR_NODE/$KEY.json" "$EXPIRES" "$VAL" 2>/dev/null
    ;;
  del)
    _validate_key "$2"
    rm -f "$(_key_file "$2")"
    ;;
  clear)
    rm -f "$CACHE_DIR"/*.json
    ;;
  *)
    echo "Usage: cache-ttl-kv.sh get|set|del|clear ..." >&2
    exit 1
    ;;
esac
