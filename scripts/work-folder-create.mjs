#!/usr/bin/env node
// work-folder-create.mjs <descriptive-name-or-ticket-title> [TICKET-KEY]
// Prints the path of this task's work folder under local_user_files/
// (created if missing). Callers capture stdout: DIR=$(node ~/.agents/scripts/work-folder-create.mjs ...).
// Naming: no ticket -> <yyyy-mm-dd>_<slug>; with ticket -> an existing <KEY>* folder is reused,
// else <KEY>_<slug>, else the branch description, else the bare key.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { planWorkFolder, toPosixPath } from './work-folder-create-lib.mjs';

const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

const [title = '', key = ''] = process.argv.slice(2);

let repoRoot;
try {
  repoRoot = git(['rev-parse', '--show-toplevel']).replace(/\n+$/, '');
} catch {
  repoRoot = '';
}
if (!repoRoot) {
  // bash `pwd` yields an MSYS path (/tmp/..., /c/...); cygpath reproduces it, toPosixPath is the fallback.
  try {
    repoRoot = execFileSync('cygpath', ['-u', process.cwd()], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    repoRoot = toPosixPath(process.cwd());
  }
}

const baseDir = `${repoRoot}/local_user_files`;

const deps = {
  listDirNames: (k) => {
    try {
      return readdirSync(baseDir).filter((n) => n.includes(k) && statSync(join(baseDir, n)).isDirectory());
    } catch {
      return [];
    }
  },
  currentBranch: () => {
    try {
      return git(['branch', '--show-current']).split('\n')[0];
    } catch {
      return '';
    }
  },
};

const plan = planWorkFolder({ title, key, date: new Date() }, deps);
const folderPath = `${baseDir}/${plan.name}`;
if (!plan.existing) mkdirSync(folderPath, { recursive: true });
process.stdout.write(`${folderPath}\n`);
