#!/usr/bin/env node
/**
 * setup-gh-cli-check.js
 *
 * Verifies GitHub CLI (gh) is installed and authenticated.
 * Lists every command/skill/script that depends on it.
 * Run: node ~/.agents/scripts/setup-gh-cli-check.js
 */

const { execFileSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const WIKI_URL =
  'https://github.com/CompanyOrOrganizationName/product_name/wiki/Page-Title';

const DEPENDENT_FILES = [
  '~/.agents/skills/git-code-review/SKILL.md',
  '~/.agents/skills/git-code-review/resolve-review-target.mjs',
  '~/.agents/skills/git-fetch-context/SKILL.md',
  '~/.agents/skills/git-pr-fetch/SKILL.md',
  '~/.agents/skills/git-pr-fetch/fetch-pr.mjs',
  '~/.agents/skills/git-pr-description-write/SKILL.md',
  '~/.agents/skills/git-code-review-resolve-feedbacks/SKILL.md',
];

const HOME = process.env.HOME || process.env.USERPROFILE || '';

function expandHome(p) {
  return p.startsWith('~') ? path.join(HOME, p.slice(1)) : p;
}

function printSection(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

function checkGhInstalled() {
  try {
    const version = execFileSync('gh', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .split('\n')[0]
      .trim();
    return { ok: true, version };
  } catch (_) {
    return { ok: false };
  }
}

function checkGhAuth() {
  try {
    const out = execFileSync('gh', ['auth', 'status'], { stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim();
    const loggedInMatch = out.match(/Logged in to [^\s]+ account ([^\s]+)/);
    const user = loggedInMatch ? loggedInMatch[1] : 'unknown';
    return { ok: true, user, detail: out };
  } catch (err) {
    const stderr = (err.stderr || Buffer.alloc(0)).toString().trim();
    return { ok: false, detail: stderr };
  }
}

function listDependentFiles() {
  const results = [];
  for (const rel of DEPENDENT_FILES) {
    const abs = expandHome(rel);
    results.push({ path: rel, exists: fs.existsSync(abs) });
  }
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('\nGitHub CLI (gh) dependency check');
console.log('='.repeat(60));

// 1. Installation check
printSection('1. Installation');
const install = checkGhInstalled();
if (install.ok) {
  console.log(`  OK  ${install.version}`);
} else {
  console.log('  NOT FOUND  gh CLI is not installed or not on PATH.\n');
  console.log('  The following Claude Code skills will not work without it:');
  for (const f of DEPENDENT_FILES) {
    console.log(`    - ${f}`);
  }
  console.log(`\n  Install: https://cli.github.com/  (all platforms)`);
  console.log(`\n  Quick install options:`);
  console.log('    macOS (brew):      brew install gh');
  console.log('    Windows (winget):  winget install --id GitHub.cli');
  console.log('    Windows (scoop):   scoop install gh');
  console.log('    Windows (choco):   choco install gh');
  console.log('    Linux (apt):       sudo apt install gh');
  console.log('\n  Corporate Windows machine, winget/scoop/choco all blocked by Group Policy?');
  console.log('    Download the .msi installer directly from https://github.com/cli/cli/releases');
  console.log('    (e.g. gh_<version>_windows_amd64.msi), run it, then CLOSE and REOPEN the');
  console.log('    terminal/command prompt (and restart Claude Code) before retrying - confirmed');
  console.log('    working when both winget and choco were blocked on a Windows 11 machine.');
  console.log('    See: https://github.com/cli/cli/blob/trunk/docs/install_windows.md#community-unofficial');
  console.log(`\n  See also: ${WIKI_URL}\n`);
  process.exit(1);
}

// 2. Authentication check
printSection('2. Authentication');
const auth = checkGhAuth();
if (auth.ok) {
  console.log(`  OK  Authenticated as: ${auth.user}`);
} else {
  console.log('  NOT AUTHENTICATED  gh is installed but not logged in.\n');
  console.log('  Run: gh auth login');
  console.log(`\n  See: ${WIKI_URL}\n`);
  process.exit(1);
}

// 3. Dependent files
printSection('3. Dependent commands / skills / scripts');
const files = listDependentFiles();
for (const { path: p, exists } of files) {
  const status = exists ? 'OK  ' : 'MISSING';
  console.log(`  ${status}  ${p}`);
}
const missing = files.filter(f => !f.exists);
if (missing.length) {
  console.log(`\n  Warning: ${missing.length} file(s) listed above are missing.`);
  console.log('  They may not have been installed yet or were moved.');
}

// 4. Summary
printSection('4. Summary');
const allPresent = missing.length === 0;
if (allPresent) {
  console.log('  All checks passed. gh CLI is installed, authenticated,');
  console.log('  and all dependent skill files are present.\n');
} else {
  console.log('  gh CLI is installed and authenticated.');
  console.log(`  ${missing.length} skill file(s) are missing - see section 3.\n`);
}
