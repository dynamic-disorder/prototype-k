#!/usr/bin/env node
// lens-append.mjs <section-number> "<one-line bullet text>"
// Appends one bullet to the end of a numbered section of reference/code_review_living_lens.md.
// Used by the final "Learn" stage of the git-code-review skill. Guards: one line only,
// duplicate check, size cap, timestamped backup (last 10 kept).
// LENS_FILE overrides the target (for tests). LENS_MAX_LINES overrides the cap (default 220).
// Exit codes: 0 ok, 1 error, 2 usage, 3 duplicate, 4 cap reached (ask the user to consolidate first).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { DEFAULT_MAX_LINES, appendBullet } from './lens-append-lib.mjs';

// Git Bash hands over POSIX-style paths (/c/..., /tmp/...) that Node cannot resolve on Windows.
const toNodePath = (p) => {
  if (process.platform !== 'win32' || !p.startsWith('/')) return p;
  try {
    return execFileSync('cygpath', ['-m', p], { encoding: 'utf8' }).trim();
  } catch {
    return p;
  }
};
const forwardSlashes = (p) => p.replaceAll('\\', '/');

const lens = forwardSlashes(toNodePath(process.env.LENS_FILE ?? `${homedir()}/.agents/reference/code_review_living_lens.md`));
const max = process.env.LENS_MAX_LINES === undefined ? DEFAULT_MAX_LINES : Number(process.env.LENS_MAX_LINES);
const [sec = '', text = ''] = process.argv.slice(2);

const deps = {
  exists: existsSync,
  readFile: (p) => readFileSync(p, 'utf8'),
  mkdirp: (p) => mkdirSync(p, { recursive: true }),
  copyFile: copyFileSync,
  listBackups: (dir) => readdirSync(dir).map((name) => ({ name, mtimeMs: statSync(`${dir}/${name}`).mtimeMs })),
  removeFile: (p) => rmSync(p, { force: true }),
  // Write beside the target and rename, so a crash never leaves a half-written lens.
  replaceFile: (p, content) => {
    const tmp = `${p}.tmp`;
    writeFileSync(tmp, content, 'utf8');
    renameSync(tmp, p);
  },
  now: () => new Date(),
};

const { code, stdout, stderr } = appendBullet({ lens, sec, text, max }, deps);
process.stdout.write(stdout);
process.stderr.write(stderr);
process.exitCode = code;
