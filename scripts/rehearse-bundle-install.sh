#!/usr/bin/env bash
# Prove a portable bundle installs, updates and gates without the checkout.
#
# Everything runs in a temporary HOME: the real ~/.agents and ~/.gitconfig are never touched.
# Usage: bash scripts/rehearse-bundle-install.sh
set -u

checkout="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
bundle="$tmp/bundle"
home="$tmp/home"
mkdir -p "$home"

pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'PASS %s\n' "$1"; }
no() { fail=$((fail + 1)); printf 'FAIL %s\n' "$1" >&2; }
require() { if [ "$1" -eq 0 ]; then ok "$2"; else no "$2"; fi; }

printf '== build ==\n'
node "$checkout/scripts/export-agents.mjs" --out "$bundle" >"$tmp/export.log" 2>&1
require $? "export writes a bundle"
node "$checkout/.agents/skills/export-agents-configuration/scripts/verify-bundle.mjs" "$bundle" >"$tmp/verify.log" 2>&1
require $? "the bundle matches its manifest"
grep -q '^Clean' "$tmp/verify.log"
require $? "verify-bundle says Clean"

printf '\n== install ==\n'
HOME="$home" node "$bundle/install.mjs" --agents-home "$home/.agents" --check >"$tmp/check1.log" 2>&1
code=$?
[ "$code" -eq 1 ]
require $? "a fresh machine reports drift (exit 1, got $code)"
HOME="$home" node "$bundle/install.mjs" --agents-home "$home/.agents" --write >"$tmp/write1.log" 2>&1
require $? "install applies"
HOME="$home" node "$bundle/install.mjs" --agents-home "$home/.agents" --check >"$tmp/check2.log" 2>&1
require $? "the second check exits 0"
grep -q 'Up to date\.' "$tmp/check2.log"
require $? "the second check says Up to date."
test -f "$home/.agents/githooks/pre-commit"
require $? "the gate hook is installed"
test -f "$home/.agents/.agents-state.json"
require $? "the state file records ownership"

printf '\n== idempotency ==\n'
snapshot() {
  (cd "$home/.agents" && find . -type f ! -name '.agents-state.json' -print0 | sort -z | xargs -0 sha256sum)
}
snapshot >"$tmp/before.sha"
HOME="$home" node "$bundle/install.mjs" --agents-home "$home/.agents" --write >"$tmp/write2.log" 2>&1
require $? "the second write succeeds"
snapshot >"$tmp/after.sha"
diff -q "$tmp/before.sha" "$tmp/after.sha" >/dev/null 2>&1
require $? "the second write changes no file"

printf '\n== machine notes and a personal skill survive ==\n'
printf '\n- rehearsal machine note\n' >>"$home/.agents/AGENTS.md"
mkdir -p "$home/.agents/skills/personal"
printf -- '---\nname: personal\ndescription: A skill the machine owner added.\n---\n' >"$home/.agents/skills/personal/SKILL.md"
HOME="$home" node "$bundle/install.mjs" --agents-home "$home/.agents" --write >"$tmp/write3.log" 2>&1
require $? "reinstall over a personalised home succeeds"
grep -q 'rehearsal machine note' "$home/.agents/AGENTS.md"
require $? "the machine note survives"
test -f "$home/.agents/skills/personal/SKILL.md"
require $? "the personal skill survives"

printf '\n== a newer bundle changes only the delta ==\n'
v2="$tmp/v2"
cp -R "$bundle" "$v2"
printf '\n# rehearsal v2\n' >>"$v2/hooks/pre-commit-build-check.sh"
dropped='scripts/setup-gh-cli-check.js'
rm -f "$v2/$dropped"
cat >"$tmp/rehash.mjs" <<'EOF'
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [dir, changed, dropped] = process.argv.slice(2);
const file = path.join(dir, 'MANIFEST.json');
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const absolute = path.join(dir, ...changed.split('/'));
manifest.files[changed] = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
if (dropped) delete manifest.files[dropped];
fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
EOF
node "$tmp/rehash.mjs" "$v2" 'hooks/pre-commit-build-check.sh' "$dropped"
HOME="$home" node "$v2/install.mjs" --agents-home "$home/.agents" --write >"$tmp/write4.log" 2>&1
require $? "the update applies"
grep -q 'rehearsal v2' "$home/.agents/hooks/pre-commit-build-check.sh"
require $? "the changed file is updated"
test ! -e "$home/.agents/$dropped"
require $? "the file dropped from the bundle is removed"
HOME="$home" node "$v2/install.mjs" --agents-home "$home/.agents" --check >"$tmp/check3.log" 2>&1
require $? "the updated machine is up to date"
grep -q 'Up to date\.' "$tmp/check3.log"
require $? "the updated check says Up to date."

printf '\n== a linked install is refused ==\n'
home2="$tmp/home2"
mkdir -p "$home2/.agents"
cat >"$tmp/link.mjs" <<'EOF'
import fs from 'node:fs';
import process from 'node:process';
const [target, link] = process.argv.slice(2);
fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
EOF
node "$tmp/link.mjs" "$bundle/githooks" "$home2/.agents/githooks"
HOME="$home2" node "$v2/install.mjs" --agents-home "$home2/.agents" --write >"$tmp/linked.log" 2>&1
code=$?
[ "$code" -eq 2 ]
require $? "a linked ~/.agents is refused (exit 2, got $code)"
test ! -f "$home2/.agents/AGENTS.md"
require $? "the refused install wrote nothing"

printf '\n== the gate runs without the checkout ==\n'
repo="$tmp/repo"
mkdir -p "$repo"
HOME="$home" git -C "$repo" init -q
printf 'rehearsal\n' >"$repo/a.txt"
HOME="$home" git -C "$repo" add a.txt
HOME="$home" git -C "$repo" -c user.email=rehearsal@example.com -c user.name=Rehearsal commit -m probe >"$tmp/commit.log" 2>&1
require $? "a commit succeeds through the installed gate"
grep -qE 'PASS|nothing staged' "$tmp/commit.log"
require $? "the gate printed its line"

printf '\n== result ==\n'
printf 'PASS %d  FAIL %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
