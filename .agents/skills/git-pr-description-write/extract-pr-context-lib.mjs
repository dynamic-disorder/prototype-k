// Pure logic of extract-pr-context.mjs (no file system, process or network access).
// Unit tested in extract-pr-context-lib.test.mjs.

const REPO = 'CompanyOrOrganizationName/product_name';
const MECHANICAL_WORDS = ['cherry-pick', 'backport', 'revert', 'bump'];
const NOISE_FILE_RE = /\.(map|css|js)$/i;
const LATEST_COMMITS = 5;
const LISTED_FILES = 20;
const LARGE_CHANGE_FILES = 10;

// A PR URL becomes its number; a plain number or branch name is returned unchanged.
export function prNumberFrom(ref) {
  return ref.includes('/pull/') ? ref.split('/pull/')[1].split(/[/?#]/)[0] : ref;
}

export const ghPrViewCommand = (prNumber) =>
  `gh pr view ${prNumber} --json title,number,state,baseRefName,headRefName,body,commits,files --repo ${REPO}`;

// Ticket-key patterns. The generic export ships none, so no ticket is ever detected.
const TICKET_PATTERNS = [
];

export const extractTicketKey = (pr) => TICKET_PATTERNS.map((re) => (pr.headRefName + ' ' + pr.title).match(re)?.[0]).find(Boolean) ?? null;

export function isMechanicalTitle(title) {
  const t = title.toLowerCase();
  return MECHANICAL_WORDS.some((w) => t.includes(w)) || (t.includes('merge') && t.includes('conflict'));
}

export const summarizeCommits = (commits) =>
  commits.map((c) => ({ message: c.messageHeadline || '', body: (c.messageBody || '').trim() }));

export const relevantFiles = (files) =>
  files.map((f) => f.path).filter((p) => !NOISE_FILE_RE.test(p) && !p.includes('PseudoLanguageGenerator'));

// Hints derived from the commit text; each rule is [test, label] so a new hint is one more row.
const METRIC_RULES = [
  [(t) => /(\d+[mkb]|events?|errors?|logs?|performance|latency|ms)/i.test(t), 'commit messages contain quantifiable hints'],
  [(t) => t.includes('fix'), 'one or more fixes'],
  [(t) => t.includes('add'), 'feature addition'],
  [(t) => t.includes('refactor'), 'refactoring'],
];

export function metricHints(commits) {
  const text = commits.map((c) => c.message + ' ' + c.body).join('\n').toLowerCase();
  return METRIC_RULES.filter(([test]) => test(text)).map(([, label]) => label);
}

export function buildContext(pr, prNumber) {
  if (pr.state === 'MERGED' || pr.state === 'CLOSED') {
    return { error: `PR #${prNumber} is already ${pr.state.toLowerCase()}`, state: pr.state, number: pr.number };
  }
  const isMechanical = isMechanicalTitle(pr.title);
  const commits = summarizeCommits(pr.commits);
  const changedFiles = relevantFiles(pr.files);
  return {
    number: pr.number,
    title: pr.title,
    baseRefName: pr.baseRefName,
    headRefName: pr.headRefName,
    ticketKey: extractTicketKey(pr),
    prType: isMechanical ? 'lean-summary' : 'full-template',
    currentDescription: pr.body,
    commitCount: commits.length,
    commits: commits.slice(-LATEST_COMMITS),
    changedFileCount: changedFiles.length,
    prFileCount: pr.files.length,
    changedFiles: changedFiles.slice(0, LISTED_FILES),
    isLargeChange: changedFiles.length > LARGE_CHANGE_FILES,
    metrics: metricHints(commits),
    classificationHints: {
      isMechanical,
      reason: isMechanical ? 'Branch name or title suggests cherry-pick/backport/revert' : 'Original logic/fix/feature',
    },
  };
}

// deps: { bash(cmd) -> trimmed stdout, throws on failure }. Commits and files come from the PR itself (gh),
// never from local HEAD, so the result is correct for PRs that are not checked out.
export function getPRContext(prRef, deps) {
  const prNumber = prNumberFrom(prRef || deps.bash('git branch --show-current'));
  try {
    return buildContext(JSON.parse(deps.bash(ghPrViewCommand(prNumber))), prNumber);
  } catch (err) {
    return { error: `Failed to fetch PR context: ${err.message}`, prRef };
  }
}
