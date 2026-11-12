import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXIT,
  appendBullet,
  applyLineEndings,
  backupsToDelete,
  dedupeKey,
  formatDate,
  formatStamp,
  insertBullet,
  isCrlf,
  validateArgs,
} from './lens-append-lib.mjs';

const NOW = new Date(2026, 10, 12, 9, 5, 7);
const LF = '# T\n\n## 1. One\n- a\n- b\n\n## 2. Two\n- c\n\n\n## 3. Three\n- d\n';
const LENS = 'C:/x/ref/lens.md';

// In-memory deps; `files` maps path to content, `log` records side effects in order.
const fakeDeps = (files, backups = []) => {
  const log = [];
  return {
    files,
    log,
    exists: (p) => p in files,
    readFile: (p) => files[p],
    mkdirp: (p) => log.push(`mkdir ${p}`),
    copyFile: (from, to) => {
      log.push(`copy ${to}`);
      files[to] = files[from];
    },
    listBackups: () => backups,
    removeFile: (p) => log.push(`rm ${p}`),
    replaceFile: (p, c) => {
      files[p] = c;
    },
    now: () => NOW,
  };
};
const run = (args, deps) => appendBullet({ lens: LENS, ...args }, deps);

test('formatDate and formatStamp use local time with zero padding', () => {
  // Given: 2026-11-12 09:05:07
  // When/Then: date and stamp
  assert.equal(formatDate(NOW), '2026-11-12');
  assert.equal(formatStamp(NOW), '20261112_090507');
});

for (const [sec, text] of [['', 'x'], ['abc', 'x'], ['1', ''], ['1a', 'x']]) {
  test(`validateArgs(${JSON.stringify(sec)}, ${JSON.stringify(text)}) is a usage error`, () => {
    // Given: a bad section or empty text
    // When/Then: usage exit code
    assert.equal(validateArgs(sec, text).code, EXIT.USAGE);
  });
}

test('validateArgs rejects a multi-line bullet', () => {
  // Given/When/Then: a newline in the text
  assert.deepEqual(validateArgs('1', 'a\nb'), { code: EXIT.USAGE, stderr: 'ERROR: bullet must be a single line.' });
});

test('dedupeKey takes the first 60 code points', () => {
  // Given: 70 astral characters
  // When/Then: 60 of them
  assert.equal(Array.from(dedupeKey('\u{1F600}'.repeat(70))).length, 60);
});

test('insertBullet appends after the last non-blank line of the section', () => {
  // Given: section 2 ends with two blank lines
  // When: a bullet is inserted
  const out = insertBullet(LF, '2', '- new');
  // Then: it follows "- c" and the blank lines stay after it
  assert.equal(out, '# T\n\n## 1. One\n- a\n- b\n\n## 2. Two\n- c\n- new\n\n\n## 3. Three\n- d\n');
});

test('insertBullet appends at the end of the last section', () => {
  // Given: section 3 is last
  // When/Then: the bullet goes to the end
  assert.equal(insertBullet(LF, '3', '- new'), `${LF}- new\n`);
});

test('insertBullet adds a final newline when the file had none', () => {
  // Given: no trailing newline
  // When/Then: records end with LF
  assert.equal(insertBullet('## 1. A\n- x', '1', '- n'), '## 1. A\n- x\n- n\n');
});

test('insertBullet follows the last of consecutive matching headers', () => {
  // Given: two headers for section 1 before section 2
  // When/Then: the second header is the start, so the bullet lands after "- y"
  assert.equal(insertBullet('## 1. A\n- x\n## 1. B\n- y\n## 2. C\n', '1', '- n'), '## 1. A\n- x\n## 1. B\n- y\n- n\n## 2. C\n');
});

test('insertBullet treats CRLF blank lines as blank', () => {
  // Given: a CRLF blank line before the next header
  // When/Then: the bullet lands before the blank line (original awk behaviour, CR dropped)
  assert.equal(insertBullet('## 1. A\r\n- x\r\n\r\n## 2. B\r\n', '1', '- n'), '## 1. A\n- x\n- n\n\n## 2. B\n');
});

test('isCrlf looks at the first line only', () => {
  // Given/When/Then
  assert.equal(isCrlf('a\r\nb\n'), true);
  assert.equal(isCrlf('a\nb\r\n'), false);
});

test('applyLineEndings converts to CRLF with a single carriage return per line', () => {
  // Given: mixed endings
  // When/Then: every line ends with exactly one CRLF
  assert.equal(applyLineEndings('a\r\r\nb\n\n', true), 'a\r\nb\r\n\r\n');
});

test('applyLineEndings strips one carriage return in LF mode', () => {
  // Given/When/Then
  assert.equal(applyLineEndings('a\r\nb\n', false), 'a\nb\n');
});

test('backupsToDelete keeps the newest ten and ignores unrelated files', () => {
  // Given: twelve backups plus a file of another lens
  const backups = Array.from({ length: 12 }, (_, i) => ({ name: `lens.2020010${i % 10}_00000${i}.md`, mtimeMs: i }));
  backups.push({ name: 'other.20200101_000000.md', mtimeMs: -1 });
  // When: pruning is computed
  const doomed = backupsToDelete(backups, 'lens');
  // Then: the two oldest lens backups
  assert.deepEqual(doomed, ['lens.20200101_000001.md', 'lens.20200100_000000.md']);
});

test('appendBullet fails with usage before touching files', () => {
  // Given: no section
  const deps = fakeDeps({ [LENS]: LF });
  // When/Then: exit 2 and no side effects
  const r = run({ sec: '', text: 'x' }, deps);
  assert.equal(r.code, EXIT.USAGE);
  assert.deepEqual(deps.log, []);
});

test('appendBullet reports a missing lens file', () => {
  // Given: no file
  // When/Then: exit 1 with the path
  const r = run({ sec: '1', text: 'x' }, fakeDeps({}));
  assert.deepEqual(r, { code: EXIT.ERROR, stdout: '', stderr: `ERROR: ${LENS} not found.\n` });
});

test('appendBullet reports a missing section with a list hint', () => {
  // Given: section 9 absent
  // When/Then: exit 1
  const r = run({ sec: '9', text: 'x' }, fakeDeps({ [LENS]: LF }));
  assert.equal(r.code, EXIT.ERROR);
  assert.equal(r.stderr, `ERROR: no section '## 9.' in ${LENS}. List sections with: grep -n '^## ' "${LENS}"\n`);
});

test('appendBullet rejects a duplicate bullet', () => {
  // Given: the bullet text already exists
  // When/Then: exit 3 and the file is unchanged
  const deps = fakeDeps({ [LENS]: LF });
  const r = run({ sec: '1', text: '- a' }, deps);
  assert.equal(r.code, EXIT.DUPLICATE);
  assert.equal(r.stderr, "DUPLICATE: a bullet starting with '- a' already exists. Skip it, or ask the user whether to merge.\n");
  assert.equal(deps.files[LENS], LF);
});

test('appendBullet stops at the line cap', () => {
  // Given: the file has 12 lines and the cap is 12
  const deps = fakeDeps({ [LENS]: LF });
  // When/Then: exit 4 with the counts
  const r = run({ sec: '1', text: 'new', max: 12 }, deps);
  assert.equal(r.code, EXIT.CAP);
  assert.equal(r.stderr, `CAP: ${LENS} has 12 lines (cap 12). Ask the user to consolidate it before adding more.\n`);
});

test('appendBullet writes a backup, the bullet with the date, and reports OK', () => {
  // Given: a valid request
  const deps = fakeDeps({ [LENS]: LF });
  // When: it runs
  const r = run({ sec: '1', text: 'new bullet' }, deps);
  // Then: backup first, bullet inserted, success message
  assert.equal(r.code, EXIT.OK);
  assert.equal(r.stdout, `OK: appended to section 1 of ${LENS} (backup in C:/x/ref/.backup)\n`);
  assert.deepEqual(deps.log, ['mkdir C:/x/ref/.backup', 'copy C:/x/ref/.backup/lens.20261112_090507.md']);
  assert.equal(deps.files['C:/x/ref/.backup/lens.20261112_090507.md'], LF);
  assert.equal(deps.files[LENS], '# T\n\n## 1. One\n- a\n- b\n- new bullet *(auto 2026-11-12)*\n\n## 2. Two\n- c\n\n\n## 3. Three\n- d\n');
});

test('appendBullet keeps CRLF line endings of the lens', () => {
  // Given: a CRLF lens
  const deps = fakeDeps({ [LENS]: '## 1. A\r\n- x\r\n' });
  // When/Then: every line still ends with CRLF
  run({ sec: '1', text: 'n' }, deps);
  assert.equal(deps.files[LENS], '## 1. A\r\n- x\r\n- n *(auto 2026-11-12)*\r\n');
});

test('appendBullet keeps backslashes in the text', () => {
  // Given: a path with backslashes
  const deps = fakeDeps({ [LENS]: '## 1. A\n' });
  // When/Then: it is written verbatim
  run({ sec: '1', text: '%REPO_ROOT%\\src' }, deps);
  assert.match(deps.files[LENS], /- %REPO_ROOT%\\src \*\(auto/);
});

test('appendBullet removes backups beyond the newest ten', () => {
  // Given: twelve existing backups
  const backups = Array.from({ length: 12 }, (_, i) => ({ name: `lens.old${i}.md`, mtimeMs: i }));
  const deps = fakeDeps({ [LENS]: LF }, backups);
  // When: a bullet is appended
  run({ sec: '1', text: 'new' }, deps);
  // Then: the two oldest are removed
  assert.deepEqual(deps.log.filter((l) => l.startsWith('rm ')), ['rm C:/x/ref/.backup/lens.old1.md', 'rm C:/x/ref/.backup/lens.old0.md']);
});
