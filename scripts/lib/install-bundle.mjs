/**
 * The portable bundle's install plan, as pure functions: which manifest paths the installer owns,
 * what an install would add, change, remove or must leave alone, and the state file's shape.
 *
 * "Bundle" is the `.agents-generic` tree carrying `install.mjs` and `MANIFEST.json`. "Home" is the
 * receiving machine's `~/.agents`. IO stays in `scripts/install-bundle.mjs` so every rule here is
 * testable without a filesystem.
 */

/** The state file the installer writes beside the installed files; it is how removal is safe. */
export const STATE_FILE = '.agents-state.json';

/** Bundle prefixes the installer owns. Everything else in the bundle is documentation or input. */
export const OWNED_PREFIXES = ['skills/', 'hooks/', 'scripts/', 'lib/', 'githooks/'];

/** @param {string} bundlePath a forward-slash path inside the bundle */
export function isOwnedPath(bundlePath) {
  return OWNED_PREFIXES.some((prefix) => bundlePath.startsWith(prefix));
}

/**
 * A manifest path as the bundle records it, or null when it could escape the root.
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeBundlePath(value) {
  if (typeof value !== 'string') return null;
  const posix = value.replace(/\\/g, '/').replace(/^\.\//, '');
  if (posix === '' || posix.startsWith('/') || /^[A-Za-z]:/.test(posix)) return null;
  if (posix.split('/').some((part) => part === '..' || part === '')) return null;
  return posix;
}

/** The skill folder a `skills/<name>/SKILL.md` path belongs to, or null. */
export function skillFolderFor(bundlePath) {
  const match = /^skills\/([^/]+)\/SKILL\.md$/.exec(bundlePath);
  return match ? match[1] : null;
}

/**
 * What an install would do. Pure: `exists`, `hash` and `targetSkillName` are injected.
 *
 * @param {object} options
 * @param {Record<string, string>} options.files manifest hashes, bundle-relative
 * @param {Record<string, string>} [options.previous] owned hashes from the last install
 * @param {(path: string) => boolean} options.exists
 * @param {(path: string) => string} options.hash sha256 of the target file
 * @param {(path: string) => string | null} [options.targetSkillName] frontmatter name of a target SKILL.md
 * @returns {{add: string[], change: string[], remove: string[], unchanged: string[], conflicts: string[]}}
 */
export function planBundle({ files, previous = {}, exists, hash, targetSkillName = () => null }) {
  const plan = { add: [], change: [], remove: [], unchanged: [], conflicts: [] };
  const expected = Object.keys(files)
    .map(normalizeBundlePath)
    .filter((path) => path !== null && isOwnedPath(path))
    .sort();

  for (const path of expected) {
    if (!exists(path)) {
      plan.add.push(path);
      continue;
    }
    if (hash(path) === files[path]) {
      plan.unchanged.push(path);
      continue;
    }
    const folder = skillFolderFor(path);
    if (folder !== null && targetSkillName(path) !== folder) {
      plan.conflicts.push(path);
      continue;
    }
    plan.change.push(path);
  }

  for (const path of Object.keys(previous).sort()) {
    const normalized = normalizeBundlePath(path);
    if (normalized === null || !isOwnedPath(normalized)) continue;
    if (files[normalized]) continue;
    if (exists(normalized)) plan.remove.push(normalized);
  }

  return plan;
}

/**
 * The owned files recorded by a previous install, or null when the state is missing or unusable.
 * @param {string} text
 * @returns {Record<string, string> | null}
 */
export function parseState(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || !data.files || typeof data.files !== 'object') return null;
  const files = {};
  for (const [path, value] of Object.entries(data.files)) {
    const normalized = normalizeBundlePath(path);
    if (normalized !== null && isOwnedPath(normalized) && typeof value === 'string') {
      files[normalized] = value;
    }
  }
  return files;
}

/** The state file's text, with sorted keys so an unchanged install writes nothing. */
export function stateText(files) {
  const sorted = {};
  for (const path of Object.keys(files).sort()) {
    const normalized = normalizeBundlePath(path);
    if (normalized !== null && isOwnedPath(normalized) && typeof files[path] === 'string') {
      sorted[normalized] = files[path];
    }
  }
  return `${JSON.stringify({ version: 1, files: sorted }, null, 2)}\n`;
}

/** The folders to try removing after files under them are deleted, deepest first. */
export function dirsToPrune(removedPaths) {
  const dirs = new Set();
  for (const file of removedPaths) {
    let dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
    while (dir.includes('/')) {
      dirs.add(dir);
      dir = dir.slice(0, dir.lastIndexOf('/'));
    }
  }
  return [...dirs].sort((a, b) => b.length - a.length);
}
