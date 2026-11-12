// Pure logic of git-commit-context-fetch.mjs: report building and the git call sequence.
// The runner injects `git(args, { quiet })` returning { status, stdout }.

// Mirrors shell command substitution, which drops trailing newlines.
export const trimTrailingNewlines = (text) => text.replace(/\n+$/, '');

// Ticket-key patterns. The generic export ships none, so no ticket is ever detected.
const TICKET_PATTERNS = [
];

export const extractTicketKey = (branch) => TICKET_PATTERNS.map((re) => branch.match(re)?.[0]).find(Boolean) ?? '';

export const indentLines = (text) => {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines.map((line) => `  ${line}`);
};

export const buildNothingReport = (branch) => [
  'STATUS: nothing_staged_or_changed',
  `BRANCH: ${branch}`,
];

export const buildReport = ({ diffSource, branch, ticket, changedFiles, diff }) => [
  `DIFF_SOURCE: ${diffSource}`,
  `BRANCH: ${branch}`,
  `TICKET_KEY: ${ticket === '' ? 'none' : ticket}`,
  'CHANGED_FILES:',
  ...indentLines(changedFiles),
  '---DIFF---',
  diff,
];

// Returns { lines, code }; a failing git call aborts with its exit status (the original ran with set -e).
export const fetchContext = (git) => {
  const failure = (r) => ({ lines: [], code: r.status });

  let diffSource = 'staged';
  let diffResult = git(['diff', '--staged']);
  if (diffResult.status !== 0) return failure(diffResult);
  let diff = trimTrailingNewlines(diffResult.stdout);
  if (diff === '') {
    diffSource = 'HEAD';
    diffResult = git(['diff', 'HEAD']);
    if (diffResult.status !== 0) return failure(diffResult);
    diff = trimTrailingNewlines(diffResult.stdout);
  }

  // Stdout counts even on failure: in a repo without commits git prints "HEAD" before it errors.
  const branch = trimTrailingNewlines(git(['rev-parse', '--abbrev-ref', 'HEAD'], { quiet: true }).stdout);

  if (diff === '') return { lines: buildNothingReport(branch), code: 0 };

  const names = git(diffSource === 'staged' ? ['diff', '--staged', '--name-only'] : ['diff', 'HEAD', '--name-only']);
  if (names.status !== 0) return failure(names);

  return {
    lines: buildReport({ diffSource, branch, ticket: extractTicketKey(branch), changedFiles: names.stdout, diff }),
    code: 0,
  };
};
