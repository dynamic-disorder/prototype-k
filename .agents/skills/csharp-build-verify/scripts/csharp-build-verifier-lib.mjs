// Pure logic for csharp-build-verifier: no fs/process/network. Side effects arrive through `deps`.

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const NC = '\x1b[0m';

const WARNING_RE = /warning (CS|CA|IDE|S[0-9]|xUnit|SA|RCS|MA)/;
const ERROR_RE = /error (CS|CA)/;
const SOLUTION_EXCLUDE_RE = /\/(bin|obj)\//;

// Rule table: which roots a change category builds, in the order the original script appended them.
const ROOT_RULES = [
  { root: 'src', flags: ['src', 'testApi'] },
  { root: 'tests', flags: ['test', 'testApi'] },
  { root: 'tools', flags: ['tools'] },
];

const collator = new Intl.Collator('en', { ignorePunctuation: true });
// Mirrors `sort` under en_US: collation order, codepoint order as tie-break.
export const collate = (a, b) => collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);

export const splitWords = (text) => text.split(/\s+/).filter((w) => w !== '');

export const stripTrailingNewlines = (text) => text.replace(/\n+$/, '');

export function classifyChanges(files) {
  const flags = { src: false, testApi: false, test: false, tools: false };
  for (const file of files) {
    if (file.startsWith('src/')) flags.src = true;
    else if (file.startsWith('tests/api/')) flags.testApi = true;
    else if (file.startsWith('tests/')) flags.test = true;
    else if (file.startsWith('tools/')) flags.tools = true;
  }
  return flags;
}

export const rootsToBuild = (flags) =>
  ROOT_RULES.filter((rule) => rule.flags.some((f) => flags[f])).map((rule) => rule.root);

// Distinct "<root>/<component>" prefixes of the changed files under one root.
export function componentDirs(root, changedLines) {
  const dirs = changedLines
    .filter((l) => l.startsWith(`${root}/`))
    .map((l) => `${root}/${l.split('/')[1] ?? ''}`);
  return [...new Set(dirs)].sort(collate);
}

// Emulates `find <dir> -maxdepth N -name "*.sln" -not -path "*/bin/*" -not -path "*/obj/*"`.
// listDir(dir) returns [{ name, isDir }] or null when the directory does not exist.
export function findSolutions(dir, maxDepth, listDir) {
  const found = [];
  const walk = (current, depth) => {
    const entries = listDir(current);
    if (!entries) return;
    for (const { name, isDir } of entries) {
      const full = `${current}/${name}`;
      if (name.endsWith('.sln') && !SOLUTION_EXCLUDE_RE.test(full)) found.push(full);
      if (isDir && depth < maxDepth) walk(full, depth + 1);
    }
  };
  walk(dir, 1);
  return found;
}

export function planSolutions({ stagedFiles, modifiedFiles, changedLines, listDir }) {
  const flags = classifyChanges([...stagedFiles, ...modifiedFiles]);
  const roots = rootsToBuild(flags);
  const solutions = [];
  for (const root of roots) {
    for (const dir of componentDirs(root, changedLines)) {
      if (listDir(dir) !== null) solutions.push(...findSolutions(dir, 3, listDir));
    }
  }
  if (solutions.length === 0) {
    for (const root of roots) solutions.push(...findSolutions(`./${root}`, 4, listDir));
  }
  return [...new Set(splitWords(solutions.join(' ')))].sort(collate);
}

// Line numbers touched by the new side of every hunk header in a `git diff -U0` text.
export function changedLineNumbers(diffText) {
  const numbers = [];
  for (const line of diffText.split('\n')) {
    const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!m) continue;
    const start = Number(m[1]);
    const len = m[2] === undefined ? 1 : Number(m[2]);
    for (let i = 0; i < len; i++) numbers.push(start + i);
  }
  return numbers;
}

// Last two path segments joined by a backslash, as they appear in MSBuild output on Windows.
export function fileTail(file) {
  const parts = file.split('/');
  return (parts.length >= 2 ? parts.slice(-2) : parts).join('\\');
}

// Warnings whose file part (text before ": warning") contains the tail. CS0612 (obsolete) is ignored.
export function warningsForFile(buildOutput, tail) {
  return buildOutput
    .split('\n')
    .filter((l) => WARNING_RE.test(l) && !l.includes('CS0612'))
    .filter((l) => {
      const i = l.indexOf(': warning');
      return i >= 0 && l.slice(0, i + 1).includes(tail);
    });
}

export function warningLineNumber(warningLine) {
  const m = /[\s\S]*\((\d+),\d+\)/.exec(warningLine);
  return m ? m[1] : '';
}

export const errorLines = (buildOutput) => buildOutput.split('\n').filter((l) => ERROR_RE.test(l));

export function newWarningsOnChangedLines({ files, buildOutput, changedLinesFor }) {
  const result = [];
  for (const file of files) {
    if (!file.endsWith('.cs') && !file.endsWith('.csproj')) continue;
    const changed = new Set(changedLinesFor(file).map(String));
    if (changed.size === 0) continue;
    for (const w of warningsForFile(buildOutput, fileTail(file))) {
      const num = warningLineNumber(w);
      if (num !== '' && changed.has(num)) result.push(w);
    }
  }
  return result;
}

// deps: git(args) -> stdout string ('' on failure), listDir(dir), build(sln) -> { ok, output }, out(line)
export function verify(deps) {
  const gitLines = (args) => stripTrailingNewlines(deps.git(args));
  const staged = gitLines(['diff', '--staged', '--name-only', '--', '*.cs', '*.csproj']);
  const modified = gitLines(['diff', '--name-only', '--', '*.cs', '*.csproj']);

  if (staged === '' && modified === '') {
    deps.out('No C# changes detected');
    return 0;
  }

  const stagedFiles = splitWords(staged);
  const modifiedFiles = splitWords(modified);
  const changedLines = `${staged}\n${modified}`.split('\n').filter((l) => l !== '');
  const solutions = planSolutions({ stagedFiles, modifiedFiles, changedLines, listDir: deps.listDir });

  if (solutions.length === 0) {
    deps.out('No matching solutions found for changed files');
    return 0;
  }

  const changedLinesFor = (file) =>
    changedLineNumbers(`${deps.git(['diff', '--staged', '-U0', '--', file])}\n${deps.git(['diff', '-U0', '--', file])}`);
  const files = [...stagedFiles, ...modifiedFiles];
  let errors = 0;

  for (const sln of solutions) {
    deps.out(`Building: ${sln}`);
    const { ok, output } = deps.build(sln);
    if (ok) {
      const warnings = newWarningsOnChangedLines({ files, buildOutput: output, changedLinesFor });
      if (warnings.length > 0) {
        deps.out(`${RED}Build: NEW warnings on changed lines (${warnings.length})${NC}`);
        for (const w of warnings) deps.out(w);
        errors++;
      } else {
        deps.out(`${GREEN}Build: OK${NC}`);
      }
    } else {
      errors++;
      deps.out(`${RED}Build: FAILED${NC}`);
      const found = errorLines(output);
      // The original aborts here (set -e + pipefail: grep finds nothing) without the "Commit aborted" line.
      if (found.length === 0) return 1;
      for (const l of found) deps.out(l);
    }
  }

  if (errors > 0) {
    deps.out(`\n${RED}Commit aborted. Fix errors and warnings before committing.${NC}`);
    return 1;
  }
  return 0;
}
