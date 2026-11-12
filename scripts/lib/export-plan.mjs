/**
 * The portable export's rules, as pure functions: which home paths become which bundle paths,
 * which files the bundle must never carry, what a text file must not contain, and the shape of
 * the manifest. Nothing here touches the filesystem, so every rule is testable on its own.
 *
 * "Home" is this checkout. "Bundle" is the `.agents-generic-<date>` tree a portable machine copies
 * into `~/.agents`; it holds the files the machine reads, not the tooling that generates them.
 */

/** The bundle directory name prefix; the date follows it. */
export const BUNDLE_PREFIX = '.agents-generic-';

/** The home directories the bundle is generated from, in the order they are walked. */
export const BUNDLED_ROOTS = ['.agents/skills', '.agents/hooks', '.githooks', 'scripts'];

/**
 * Files the bundle must never carry, as bundle-relative paths. The first six are the refusal list
 * in the umbrella plan; the last three are the siblings of the Windows credential helper the plan
 * also refuses. A refusal is an error, not a silent skip: the run names the file and stops.
 */
export const REFUSED_PATHS = [
  'claude_placeholder_values.txt',
  'lib/repo-env-db.sh',
  'lib/repo-env-db.md',
  'lib/repo-env-github.sh',
  'lib/repo-env-github.md',
  'reference/git_commit_secret_scan_allowlist.txt',
  'scripts/windows-credential-store.ps1',
  'scripts/windows-credential-store-lib.mjs',
  'scripts/windows-credential-store.mjs',
];

/** A refused basename is refused wherever it appears, because the name is unambiguous. */
export const REFUSED_BASENAMES = ['claude_placeholder_values.txt'];

/** Directory names that never enter the bundle, at any depth. */
export const EXCLUDED_DIRECTORIES = [
  'node_modules',
  '.git',
  'dist',
  'test-results',
  'local_user_files',
  'artifacts',
  'bin',
  'obj',
  '.vs',
];

/** File names and extensions that never enter the bundle. */
export const EXCLUDED_BASENAMES = ['.DS_Store', 'Thumbs.db', '.env'];

/** Extensions that hold a secret or a key rather than configuration. */
export const EXCLUDED_EXTENSIONS = ['.key', '.pem', '.pfx', '.p12', '.log'];

/** Home scripts that are not part of the bundle: one links into the checkout, one is this tool. */
export const NOT_BUNDLED_SCRIPTS = [
  'install-global.mjs',
  'export-agents.mjs',
  'export-plan.mjs',
];

/**
 * Entries that do not come from a walk: composed or renamed files. `kind` is `compose` for the
 * rules file assembled from two sources, `copy` for a verbatim file.
 */
export const STATIC_ENTRIES = [
  {
    bundle: 'AGENTS.md',
    kind: 'compose',
    sources: ['global/AGENTS.shared.md', 'output-style/managed-block.md'],
  },
  { bundle: 'settings.json', kind: 'copy', source: 'export/settings.json' },
  { bundle: 'README.md', kind: 'copy', source: 'export/README.md' },
  { bundle: 'project-seed/AGENTS.md', kind: 'copy', source: 'export/project-seed/AGENTS.md' },
  { bundle: 'project-seed/.editorconfig', kind: 'copy', source: '.editorconfig' },
  { bundle: 'project-seed/Directory.Build.props', kind: 'copy', source: 'Directory.Build.props' },
  { bundle: 'project-seed/.gitattributes', kind: 'copy', source: '.gitattributes' },
  { bundle: 'project-seed/.gitignore', kind: 'copy', source: 'export/project-seed/.gitignore' },
];

/** The generated manifest, the one file in the bundle that lists the others. */
export const MANIFEST_NAME = 'MANIFEST.json';

/**
 * Identity and mount leaks. The same classes the publication gate refuses, restated here so the
 * export can check a tree it is about to write, without shelling out to the gate.
 */
export const LEAK_PATTERNS = [
  { rule: 'windows-profile', re: /[A-Za-z]:[\\/]Users[\\/]/ },
  { rule: 'windows-profile-msys', re: /\/[a-z]\/Users\// },
  { rule: 'mounted-volume', re: /\/mnt\/([a-z]\/[A-Za-z]|[^/\s]*([0-9]|-)|[A-Z]{2,})/ },
  { rule: 'posix-home', re: /\/home\/[a-z]/ },
  { rule: 'mounted-drive-tree', re: /(^|[\s("'])\/[a-z]\/[A-Za-z]/ },
  { rule: 'drive-checkout', re: /[A-Za-z]:[\\/](code|src|dev|repos|projects|GitHub)[\\/]/ },
];

/** The one bundled file that carries the leak patterns themselves; it is exempt from its own scan. */
export const SCANNER_BUNDLE_PATH = 'scripts/scan-publication-leaks.sh';

/** A path as the bundle records it: forward slashes, no leading `./`. */
export function toPosix(path) {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * The bundle path for a home path, or null when the file is not part of the bundle.
 *
 *   .agents/skills/<name>/…  ->  skills/<name>/…
 *   .agents/hooks/<file>     ->  hooks/<file>
 *   .githooks/<file>         ->  githooks/<file>
 *   scripts/lib/<file>       ->  lib/<file>          (tests excluded)
 *   scripts/<file>           ->  scripts/<file>      (the exporters excluded)
 */
export function bundlePathFor(homePath) {
  const path = toPosix(homePath);
  if (path.startsWith('.agents/skills/')) return `skills/${path.slice('.agents/skills/'.length)}`;
  if (path.startsWith('.agents/hooks/')) return `hooks/${path.slice('.agents/hooks/'.length)}`;
  if (path.startsWith('.githooks/')) return `githooks/${path.slice('.githooks/'.length)}`;
  if (path.startsWith('scripts/lib/')) {
    const rest = path.slice('scripts/lib/'.length);
    if (rest.includes('/')) return null;
    if (rest.endsWith('.test.mjs')) return null;
    if (NOT_BUNDLED_SCRIPTS.includes(rest)) return null;
    return `lib/${rest}`;
  }
  if (path.startsWith('scripts/')) {
    const rest = path.slice('scripts/'.length);
    if (rest.includes('/')) return null;
    if (NOT_BUNDLED_SCRIPTS.includes(rest)) return null;
    return `scripts/${rest}`;
  }
  return null;
}

/** True when a home path must not enter the bundle: a build folder, scratch, or a key. */
export function isExcluded(homePath) {
  const parts = toPosix(homePath).split('/');
  if (parts.some((part) => EXCLUDED_DIRECTORIES.includes(part))) return true;
  const base = parts[parts.length - 1];
  if (EXCLUDED_BASENAMES.includes(base)) return true;
  if (base.startsWith('.credentials')) return true;
  return EXCLUDED_EXTENSIONS.some((extension) => base.toLowerCase().endsWith(extension));
}

/** True when a bundle path is on the refusal list, by exact path or by basename. */
export function isRefused(bundlePath) {
  const path = toPosix(bundlePath);
  if (REFUSED_PATHS.includes(path)) return true;
  const base = path.split('/').pop();
  return REFUSED_BASENAMES.includes(base);
}

/**
 * The bundle's AGENTS.md: the shared rules followed by the style block, one file. The installers
 * upsert the same two blocks into `~/.agents/AGENTS.md`, so a portable machine reads one text.
 */
export function composeAgentsMd(shared, style) {
  return `${shared.trimEnd()}\n\n${style.trimEnd()}\n`;
}

/** Leak findings in one text, as line numbers and rule names. The matching text is never returned. */
export function findLeaks(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const hit = LEAK_PATTERNS.find((pattern) => pattern.re.test(line));
    if (hit) findings.push({ line: index + 1, rule: hit.rule });
  }
  return findings;
}

/** The manifest text: every bundle path except the manifest itself, with its sha256, in sorted order. */
export function manifestText(files) {
  const sorted = {};
  for (const path of Object.keys(files).sort()) sorted[path] = files[path];
  return `${JSON.stringify({ files: sorted }, null, 2)}\n`;
}

/** The bundle directory name for a moment: `.agents-generic-YYYY-MM-DD_HH-mm`. */
export function bundleDirName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}`;
  return `${BUNDLE_PREFIX}${stamp}`;
}

/** Parsed command line: one mode, an output directory and whether to archive. */
export function parseArgs(argv) {
  const result = { mode: 'write', out: null, archive: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') result.mode = 'check';
    else if (arg === '--archive') result.archive = true;
    else if (arg === '--out') {
      result.out = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === '--help' || arg === '-h') result.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return result;
}

/** The files a bundle must contain, given the entries a run planned. */
export function expectedFiles(entries) {
  return entries.map((entry) => entry.bundle).concat(MANIFEST_NAME).sort();
}
