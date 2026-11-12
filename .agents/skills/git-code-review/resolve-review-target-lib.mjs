// Pure logic for resolve-review-target.mjs: target parsing, change-nature rules, text
// transforms and the resolve flow. git, gh and the thread lookup run through injected
// deps, so nothing here touches the file system, the process or the network.
//
// deps.git(args, { stderr }) -> { status, stdout }  stderr: 'ignore' (bash `2>/dev/null`) or 'inherit'
// deps.gh(args, { stderr })  -> { status, stdout }  same options
// deps.openThreads(owner, repo, prNumber) -> string  raw JSON text of the unresolved-thread fetch ('' on failure)
// env: { REPO, TICKET_PR_URL, TICKET_BRANCH } as strings (unset and empty are the same)
//
// The flow returns { stdout, stderr, code }. A non-zero code with no message mirrors bash
// `set -e` + `pipefail`: a failed command stopped the script silently with its own status.

import { format } from 'node:util';

const DEFAULT_REPO = 'CompanyOrOrganizationName/product_name';
const DEFAULT_BASE_BRANCH = 'develop';
const WHITESPACE = '[ \\t\\n\\r\\f\\v]';
const LEADING_WS_RE = new RegExp(`^${WHITESPACE}+`);
const FIRST_TOKEN_RE = new RegExp(`^[^ \\t\\n\\r\\f\\v]*`);
const PR_URL_RE = /github\.com\/[^/]+\/[^/]+\/pull\/([0-9]+)/;
const PR_NUMBER_RE = /^[0-9]+$/;
// Ticket-key patterns. The generic export ships none, so no issue id is recognized.
const TICKET_KEY_RES = [
];
const TICKET_RES = [
];
const isTicketKey = (text) => TICKET_KEY_RES.some((re) => re.test(text));
const EXCLUDED_FILE_RES = [/assets\/.*\.(js|css|map)$/, /PseudoLanguageGenerator\//];

// Shell command substitution drops trailing newlines (Git Bash also drops the CR of a CRLF).
export const stripTrailingNewlines = (text) => text.replace(/(\r?\n)+$/, '');
export const trimLeadingWhitespace = (text) => text.replace(LEADING_WS_RE, '');
export const firstTicket = (text) => TICKET_RES.map((re) => text.match(re)?.[0]).find(Boolean) ?? '';

// Output of a command whose failure falls back to a default (`cmd || echo default`).
const okOr = (res, fallback) => (res.status === 0 ? stripTrailingNewlines(res.stdout) : fallback);

// --- 0. Split target from instructions ---------------------------------------
// The target must be the first token: a PR URL/number, a issue id, a branch (contains '/') or '.'.
export function splitTarget(raw) {
  const trimmed = trimLeadingWhitespace(raw);
  const first = trimmed.match(FIRST_TOKEN_RE)[0];
  const extra = trimLeadingWhitespace(trimmed.slice(first.length));
  if (first === '' || first === '.') return { kind: 'current', target: '', extra };
  const isTarget = PR_URL_RE.test(first) || PR_NUMBER_RE.test(first) || isTicketKey(first) || first.includes('/');
  return isTarget ? { kind: 'target', target: first, extra } : { kind: 'unrecognized', first };
}

// --- 1. Detect input kind ----------------------------------------------------
export function detectKind(target) {
  const prUrl = target.match(PR_URL_RE);
  if (prUrl) return { kind: 'pr', prNumber: prUrl[1] };
  if (PR_NUMBER_RE.test(target)) return { kind: 'pr', prNumber: target };
  if (isTicketKey(target)) return { kind: 'ticket', ticketKey: target };
  if (target.includes('/')) return { kind: 'branch', branch: target };
  return null;
}

export const repoParts = (repo) => ({
  owner: repo.slice(0, repo.includes('/') ? repo.indexOf('/') : repo.length),
  name: repo.slice(repo.lastIndexOf('/') + 1),
});

export function baseBranchFrom({ status, stdout }) {
  if (status !== 0) return DEFAULT_BASE_BRANCH;
  return stripTrailingNewlines(stdout).replace('refs/remotes/origin/', '');
}

// The head branch as the original node one-liner printed it.
export const headRefName = (prJson) => format(JSON.parse(prJson).headRefName);

export function filterChangedFiles(diffOutput) {
  const lines = diffOutput === '' ? [] : diffOutput.replace(/\n$/, '').split('\n');
  return lines.filter((l) => !EXCLUDED_FILE_RES.some((re) => re.test(l))).join('\n');
}

export function threadCount(fetchOutput) {
  try {
    return format(JSON.parse(fetchOutput).length);
  } catch {
    return '';
  }
}

export const countLines = (text) => (text.match(/\n/g) ?? []).length;

// --- 5. Nature of the change -------------------------------------------------
// Bash `case` globs: only `*` is special and it also matches '/'.
const REGEX_SPECIAL_RE = /[.+?^${}()|[\]\\]/g;
const escapeRegExp = (text) => text.replace(REGEX_SPECIAL_RE, '\\$&');
const globToRegExp = (glob) => new RegExp(`^${glob.split('*').map(escapeRegExp).join('.*')}$`, 's');
const matchesAny = (globs, file) => globs.some((g) => globToRegExp(g).test(file));

const AI_CONFIG_GLOBS = [
  '.agents/*', '*/.agents/*', 'AGENTS.md', '*/AGENTS.md', '*SKILL.md',
  '.github/CODEOWNERS', '.mcp.json', '*/.mcp.json',
];

const TEST_FILE_GLOBS = ['tests/*', '*/tests/*', '*Tests.cs', '*Test.cs'];
const SCRIPT_DIR_GLOBS = ['tools/*', 'scripts/*', '*/scripts/*', 'tests/*', '.agents/*', '*/.agents/*'];

// First matching row wins. `refine` adds kinds when its globs match, else `orElse`.
export const NATURE_RULES = [
  { globs: ['.github/workflows/*'], kinds: ['ci'] },
  { globs: ['*.cs'], kinds: ['csharp'], refine: { globs: TEST_FILE_GLOBS, add: ['tests'] } },
  { globs: ['*.sh', '*.mjs', '*.py', '*.bat', '*.cmd', '*.ps1', '*.psm1', '*.psd1'], kinds: ['tooling'] },
  { globs: ['*.js', '*.ts'], kinds: [], refine: { globs: SCRIPT_DIR_GLOBS, add: ['tooling'], orElse: ['code'] } },
  { globs: ['*.md', '*.html', 'docs/*'], kinds: ['docs'], skipIfAiConfig: true },
  { globs: ['*.csproj', '*.props', '*.json', '*.yml', '*.yaml', '*.tf', 'Dockerfile*', '.gitignore'], kinds: ['config'] },
  { globs: ['*'], kinds: ['code'], skipIfAiConfig: true },
];

export function kindsOfFile(file) {
  const aiConfig = matchesAny(AI_CONFIG_GLOBS, file);
  const kinds = aiConfig ? ['ai-config'] : [];
  const rule = NATURE_RULES.find((r) => matchesAny(r.globs, file));
  if (rule.skipIfAiConfig && aiConfig) return kinds;
  const refined = rule.refine
    ? (matchesAny(rule.refine.globs, file) ? rule.refine.add : (rule.refine.orElse ?? []))
    : [];
  return [...kinds, ...rule.kinds, ...refined];
}

export function natureOf(changedFiles) {
  const kinds = changedFiles.split('\n').filter((f) => f !== '').flatMap(kindsOfFile);
  return [...new Set(kinds)].join(' ');
}

// --- gh argument builders ----------------------------------------------------
const repoViewArgs = () => ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'];
const prMetaArgs = (pr, repo) => ['pr', 'view', pr, '--repo', repo, '--json', 'number,title,url,state,author,headRefName,additions,deletions'];
const prHeadRefArgs = (pr, repo) => ['pr', 'view', pr, '--repo', repo, '--json', 'headRefName'];
const prForBranchArgs = (branch, repo) => ['pr', 'list', '--head', branch, '--repo', repo, '--json', 'number', '--jq', '.[0].number'];
const prTitleBodyArgs = (pr, repo) => ['pr', 'view', pr, '--repo', repo, '--json', 'title,body', '--jq', '.title + " " + .body'];
const currentUserArgs = () => ['api', 'user', '--jq', '.login'];
const prAuthorArgs = (pr, repo) => ['pr', 'view', pr, '--repo', repo, '--json', 'author', '--jq', '.author.login'];

export function resolveReviewTarget(rawInput, env, deps) {
  const out = [];
  const errLines = [];
  const finish = (code) => ({
    stdout: out.map((l) => `${l}\n`).join(''),
    stderr: errLines.map((l) => `${l}\n`).join(''),
    code,
  });
  const fail = (message) => { errLines.push(`ERROR: ${message}`); return finish(1); };
  const gh = (args, stderr = 'ignore') => deps.gh(args, { stderr });
  const git = (args, stderr = 'ignore') => deps.git(args, { stderr });

  // --- 0. Split target from instructions
  const split = splitTarget(rawInput);
  if (split.kind === 'unrecognized') {
    const current = stripTrailingNewlines(git(['branch', '--show-current']).stdout);
    errLines.push(`UNRECOGNIZED_TARGET: '${split.first}' is not a PR URL/number, issue id, or branch name (branches contain '/').`);
    errLines.push(`Ask the user: did they mean to review the currently checked-out branch '${current || '<detached HEAD>'}'? If yes, re-run with '.' as the target (e.g. '. <instructions>'). If not, ask for the correct target.`);
    return finish(2);
  }
  const { target: argumentsText, extra } = split;

  // --- 1. Detect input kind
  let kind = 'branch';
  let branch = '';
  let prNumber = '';
  let ticketKey = '';
  let useLocalHead = false;

  if (argumentsText === '') {
    // No target given: review the currently checked-out branch, including unpushed commits.
    const current = git(['branch', '--show-current'], 'inherit');
    if (current.status !== 0) return finish(current.status);
    branch = stripTrailingNewlines(current.stdout);
    if (branch === '') return fail('No target given and HEAD is detached. Provide a branch name, a PR URL/number, or a ticket.');
    useLocalHead = true;
  } else {
    const detected = detectKind(argumentsText);
    if (!detected) return fail(`Unrecognized input '${argumentsText}'. Provide a branch name (contains '/'), a PR URL/number, or a ticket (e.g. PROJECT_ISSUE_PREFIX-1234).`);
    ({ kind } = detected);
    branch = detected.branch ?? '';
    prNumber = detected.prNumber ?? '';
    ticketKey = detected.ticketKey ?? '';
  }

  const repo = env.REPO || okOr(gh(repoViewArgs()), DEFAULT_REPO);

  // --- 2. Resolve to a branch
  if (kind === 'pr') {
    const meta = gh(prMetaArgs(prNumber, repo), 'inherit');
    if (meta.status !== 0) return finish(meta.status);
    const prJson = stripTrailingNewlines(meta.stdout);
    branch = headRefName(prJson);
    out.push(`PR_META_JSON=${prJson}`);
  } else if (kind === 'ticket') {
    // The caller fetches ticket context first and passes any PR URL / branch back in via env.
    if (env.TICKET_PR_URL) {
      const numbers = [...env.TICKET_PR_URL.matchAll(/pull\/([0-9]+)/g)].map((m) => m[1]);
      if (numbers.length === 0) return finish(1);
      prNumber = numbers.join('\n');
      const head = gh(prHeadRefArgs(prNumber, repo), 'inherit');
      if (head.status !== 0) return finish(head.status);
      branch = headRefName(stripTrailingNewlines(head.stdout));
    } else if (env.TICKET_BRANCH) {
      branch = env.TICKET_BRANCH;
    } else {
      out.push('NO_CODE_TARGET=1');
      return finish(0);
    }
  }

  if (ticketKey === '') ticketKey = firstTicket(branch);

  // --- 3. Fetch branch + diff
  const baseBranch = baseBranchFrom(git(['symbolic-ref', 'refs/remotes/origin/HEAD']));
  if (branch === baseBranch) {
    return fail(`'${branch}' is the base branch: there is nothing to review against itself. Check out the feature branch, or give a PR number, issue id, or branch name.`);
  }

  // Refresh the base first: a stale origin/<base> inflates the diff with unrelated files.
  // The branch fetch must be the last one to set FETCH_HEAD.
  git(['fetch', 'origin', baseBranch]);
  let diffRef = 'HEAD';
  if (!useLocalHead) {
    const fetched = git(['fetch', 'origin', branch], 'inherit');
    if (fetched.status !== 0) return finish(fetched.status);
    diffRef = 'FETCH_HEAD';
  }

  if (kind !== 'pr') prNumber = okOr(gh(prForBranchArgs(branch, repo)), '');

  const diff = git(['diff', '--name-only', `origin/${baseBranch}...${diffRef}`], 'inherit');
  const changedFiles = stripTrailingNewlines(filterChangedFiles(diff.stdout));

  // Branch names often omit the ticket: fall back to the PR title and body.
  if (ticketKey === '' && prNumber !== '') {
    ticketKey = firstTicket(okOr(gh(prTitleBodyArgs(prNumber, repo)), ''));
  }

  // --- 4. Ownership: own (the user's work) vs other (someone else's PR/branch)
  const me = okOr(gh(currentUserArgs()), '');
  const author = prNumber === '' ? '' : okOr(gh(prAuthorArgs(prNumber, repo)), '');
  let ownership;
  if (author !== '' && me !== '') {
    ownership = author.toLowerCase() === me.toLowerCase() ? 'own' : 'other';
  } else if (useLocalHead) {
    ownership = 'own';
  } else {
    const lastEmail = stripTrailingNewlines(git(['log', '-1', '--format=%ae', diffRef]).stdout);
    const myEmail = stripTrailingNewlines(git(['config', 'user.email'], 'inherit').stdout);
    ownership = lastEmail !== '' && lastEmail === myEmail ? 'own' : 'other';
  }

  // Own PR: count unresolved review threads (the skill resolves them first) and
  // report whether the resolver's code fixes would land on the PR branch.
  const currentBranch = stripTrailingNewlines(git(['branch', '--show-current']).stdout);
  const onPrBranch = currentBranch === branch ? 1 : 0;
  const porcelain = git(['status', '--porcelain']);
  if (porcelain.status !== 0) return finish(porcelain.status);
  const treeDirty = String(countLines(porcelain.stdout));

  let openThreads = '';
  if (ownership === 'own' && prNumber !== '') {
    const { owner, name } = repoParts(repo);
    openThreads = threadCount(deps.openThreads(owner, name, prNumber));
  }

  out.push(
    `TARGET=${argumentsText || '<current branch>'}`,
    `EXTRA_INSTRUCTIONS=${extra}`,
    `OWNERSHIP=${ownership}`,
    `PR_AUTHOR=${author}`,
    `OPEN_THREADS=${openThreads}`,
    `CURRENT_BRANCH=${currentBranch}`,
    `ON_PR_BRANCH=${onPrBranch}`,
    `TREE_DIRTY=${treeDirty}`,
    `NATURE=${natureOf(changedFiles)}`,
    `BASE_BRANCH=${baseBranch}`,
    `BRANCH=${branch}`,
    `DIFF_REF=${diffRef}`,
    `PR_NUMBER=${prNumber}`,
    `TICKET_KEY=${ticketKey}`,
    'CHANGED_FILES<<EOF',
    changedFiles,
    'EOF',
  );
  return finish(0);
}
