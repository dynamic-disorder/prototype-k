// Pure logic of lens-append.mjs: argument checks, section insertion, line endings, backup naming.
// File access and the clock come in through `deps` (see appendBullet), so tests can use fakes.

export const EXIT = { OK: 0, ERROR: 1, USAGE: 2, DUPLICATE: 3, CAP: 4 };
export const DEFAULT_MAX_LINES = 220;
export const KEEP_BACKUPS = 10;
const KEY_LENGTH = 60;

const pad = (n, width = 2) => String(n).padStart(width, '0');

export const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const formatStamp = (d) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

export const dirname = (path) => {
  const i = path.lastIndexOf('/');
  return i < 0 ? '.' : i === 0 ? '/' : path.slice(0, i);
};

export const basenameWithoutMd = (path) => path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');

export const validateArgs = (sec, text) => {
  if (!/^[0-9]+$/.test(sec) || text === '') {
    return { code: EXIT.USAGE, stderr: 'usage: lens-append.mjs <section-number> "<bullet text>"' };
  }
  if (text.includes('\n')) return { code: EXIT.USAGE, stderr: 'ERROR: bullet must be a single line.' };
  return null;
};

export const hasSection = (content, sec) => {
  const header = new RegExp(`^## ${sec}\\. `);
  return content.split('\n').some((line) => header.test(line));
};

export const dedupeKey = (text) => Array.from(text).slice(0, KEY_LENGTH).join('');

export const countNewlines = (content) => (content.match(/\n/g) ?? []).length;

export const isCrlf = (content) => content.split('\n', 1)[0].includes('\r');

export const buildBullet = (text, date) => `- ${text} *(auto ${formatDate(date)})*`;

export const splitRecords = (content) => {
  if (content === '') return [];
  const records = content.split('\n');
  if (records.at(-1) === '') records.pop();
  return records;
};

// Inserts the bullet after the last non-blank line of section `sec`; one trailing LF per record.
// The Windows awk of the original read CRLF records without the CR, so blank CRLF lines count as blank.
export const insertBullet = (content, sec, bullet) => {
  const lines = splitRecords(content).map((line) => line.replace(/\r$/, ''));
  const header = new RegExp(`^## ${sec}\\. `);
  let start = -1;
  let stop = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (header.test(lines[i])) start = i;
    else if (start >= 0 && lines[i].startsWith('## ')) {
      stop = i;
      break;
    }
  }
  let ins = stop - 1;
  while (ins > start && lines[ins] === '') ins--;
  const out = [...lines.slice(0, ins + 1), bullet, ...lines.slice(ins + 1)];
  return out.map((line) => `${line}\n`).join('');
};

// Keeps the file's own line-ending style (the lens may be CRLF on Windows).
export const applyLineEndings = (text, crlf) =>
  splitRecords(text)
    .map((line) => (crlf ? line.replace(/\r*$/, '\r') : line.replace(/\r$/, '')))
    .map((line) => `${line}\n`)
    .join('');

export const isBackupOf = (name, base) =>
  name.length >= base.length + 4 && name.startsWith(`${base}.`) && name.endsWith('.md');

// backups: [{ name, mtimeMs }]; returns names beyond the newest KEEP_BACKUPS.
export const backupsToDelete = (backups, base) =>
  backups
    .filter((b) => isBackupOf(b.name, base))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(KEEP_BACKUPS)
    .map((b) => b.name);

// deps: { readFile, exists, mkdirp, copyFile, listBackups(dir), removeFile, replaceFile, now }
// Returns { code, stdout, stderr }.
export const appendBullet = ({ lens, sec, text, max = DEFAULT_MAX_LINES }, deps) => {
  const invalid = validateArgs(sec, text);
  if (invalid) return { code: invalid.code, stdout: '', stderr: `${invalid.stderr}\n` };

  const fail = (code, stderr) => ({ code, stdout: '', stderr: `${stderr}\n` });
  if (!deps.exists(lens)) return fail(EXIT.ERROR, `ERROR: ${lens} not found.`);

  const content = deps.readFile(lens);
  if (!hasSection(content, sec)) {
    return fail(EXIT.ERROR, `ERROR: no section '## ${sec}.' in ${lens}. List sections with: grep -n '^## ' "${lens}"`);
  }

  const key = dedupeKey(text);
  if (content.includes(key)) {
    return fail(EXIT.DUPLICATE, `DUPLICATE: a bullet starting with '${key}' already exists. Skip it, or ask the user whether to merge.`);
  }

  const lines = countNewlines(content);
  if (lines >= max) {
    return fail(EXIT.CAP, `CAP: ${lens} has ${lines} lines (cap ${max}). Ask the user to consolidate it before adding more.`);
  }

  const now = deps.now();
  const backupDir = `${dirname(lens)}/.backup`;
  const base = basenameWithoutMd(lens);
  deps.mkdirp(backupDir);
  deps.copyFile(lens, `${backupDir}/${base}.${formatStamp(now)}.md`);
  for (const name of backupsToDelete(deps.listBackups(backupDir), base)) deps.removeFile(`${backupDir}/${name}`);

  const updated = applyLineEndings(insertBullet(content, sec, buildBullet(text, now)), isCrlf(content));
  deps.replaceFile(lens, updated);
  return { code: EXIT.OK, stdout: `OK: appended to section ${sec} of ${lens} (backup in ${backupDir})\n`, stderr: '' };
};
