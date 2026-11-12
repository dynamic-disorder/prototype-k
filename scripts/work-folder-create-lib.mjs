const TRANSLITERATIONS = [
  ['ä', 'ae'], ['ö', 'oe'], ['ü', 'ue'],
  ['Ä', 'Ae'], ['Ö', 'Oe'], ['Ü', 'Ue'],
  ['ß', 'ss'],
];

const stripTrailingNewlines = (s) => s.replace(/\n+$/, '');

// Mirrors the sed/tr pipeline of the original: sed works per line, and each
// command substitution drops trailing newlines.
export function slugify(title) {
  const transliterated = TRANSLITERATIONS.reduce((s, [from, to]) => s.replaceAll(from, to), title);
  const lowered = stripTrailingNewlines(transliterated)
    .replace(/[A-Z]/g, (c) => c.toLowerCase())
    .replace(/[ _]/g, '-');
  const stripped = stripTrailingNewlines(lowered.replace(/[^a-z0-9\-\n]/g, ''));
  return stripTrailingNewlines(
    stripped
      .split('\n')
      .map((line) => line.replace(/-+/g, '-').replace(/^-+/, '').replace(/-+$/, ''))
      .join('\n'),
  );
}

const pad = (n) => String(n).padStart(2, '0');

export function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const codepointSort = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Same precedence as the original glob loop: exact key, KEY_*, KEY-*, legacy date_KEY-*.
export function findExistingFolder(key, dirNames) {
  const matchers = [
    (n) => n === key,
    (n) => n.startsWith(`${key}_`),
    (n) => n.startsWith(`${key}-`),
    (n) => /^\d{4}-\d{2}-\d{2}_/.test(n) && n.slice(11).startsWith(`${key}-`),
  ];
  const sorted = [...dirNames].sort(codepointSort);
  for (const matches of matchers) {
    const hit = sorted.find(matches);
    if (hit !== undefined) return hit;
  }
  return null;
}

// The key is used as a regular expression, like the sed -E pattern of the original.
export function branchDescription(key, branch) {
  try {
    const match = new RegExp(`^.*/?(${key}[_-].+)$`).exec(branch);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

export function planWorkFolder({ title, key, date }, deps) {
  const slug = slugify(title);
  if (!key) return { existing: false, name: `${formatLocalDate(date)}_${slug}` };

  const existing = findExistingFolder(key, deps.listDirNames(key));
  if (existing !== null) return { existing: true, name: existing };
  if (slug) return { existing: false, name: `${key}_${slug}` };
  return { existing: false, name: branchDescription(key, deps.currentBranch()) || key };
}

export function toPosixPath(winPath) {
  const drive = /^([A-Za-z]):[\\/]/.exec(winPath);
  const rest = drive ? winPath.slice(2) : winPath;
  const posix = rest.replaceAll('\\', '/');
  return drive ? `/${drive[1].toLowerCase()}${posix}` : posix;
}
