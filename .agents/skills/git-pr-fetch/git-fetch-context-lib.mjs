// Pure logic for git-fetch-context.mjs: input classification, text transforms and the
// PR / branch / commit flows. git and gh run through injected deps, so nothing here
// touches the file system, the process or the network.
//
// deps.git(args, { stderr }) -> { status, stdout }   stderr: 'ignore' (bash `2>/dev/null`) or 'inherit'
// deps.gh(args, { stderr })  -> { status, stdout }   stderr: 'ignore', 'inherit' or 'merge' (bash `2>&1`, appended to stdout)
// deps.ghAvailable()         -> boolean
// Every flow returns { stdout, code }. A non-zero code from a failed git call mirrors
// bash `set -e` + `pipefail`: the script stopped silently with that command's status.

import { format } from 'node:util';

const PR_URL_RE = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[0-9]+/;
const COMMIT_RE = /^[0-9a-f]{7,40}$/;
const ASSET_RE = /assets\/.*\.(js|css|map)$/;
// Ticket-key patterns. The generic export ships none, so no ticket is ever detected.
const TICKET_PATTERNS = [
];
const DEFAULT_BASE_BRANCH = 'develop';
const PR_FIELDS = 'number,title,url,state,author,headRefName,additions,deletions';

// Shell command substitution drops trailing newlines (Git Bash also drops the CR of a CRLF).
export const stripTrailingNewlines = (text) => text.replace(/(\r?\n)+$/, '');

// What `wc -l` counts: newline characters.
export const countLines = (text) => (text.match(/\n/g) ?? []).length;

export const firstTicket = (text) => TICKET_PATTERNS.map((re) => text.match(re)?.[0]).find(Boolean) ?? '';

// `console.log(value)` as the original node one-liners printed it.
const show = (value) => format(value);

export function classifyInput(input) {
  if (PR_URL_RE.test(input)) {
    const numbers = [...input.matchAll(/pull\/([0-9]+)/g)].map((m) => m[1]);
    return { type: 'PR', prNumber: numbers.join('\n') };
  }
  if (input.includes('/')) return { type: 'BRANCH', branch: input };
  if (COMMIT_RE.test(input)) return { type: 'COMMIT', commit: input };
  return null;
}

// symbolic-ref prints "refs/remotes/origin/<base>"; any failure means the default.
export function baseBranchFrom({ status, stdout }) {
  if (status !== 0) return DEFAULT_BASE_BRANCH;
  return stripTrailingNewlines(stdout).replace('refs/remotes/origin/', '');
}

export function dropAssetFiles(text) {
  const kept = text === '' ? [] : text.replace(/\n$/, '').split('\n').filter((l) => !ASSET_RE.test(l));
  return kept.join('\n');
}

// `echo "$FILES" | sed 's/^/- /'`: an empty list still prints one "- " line.
export const bulletLines = (files) => files.split('\n').map((l) => `- ${l}`);

export function remoteUrlToRepoPath(remoteUrl) {
  return remoteUrl.replace(/.*github.com[:/]/, '').replace(/\.git$/, '');
}

export const prUrlFor = (repoPath, prNumber) => `https://github.com/${repoPath}/pull/${prNumber}`;

export function parsePrData(text) {
  const data = JSON.parse(text);
  return {
    branch: show(data.headRefName),
    title: show(data.title),
    state: show(data.state),
    author: show(data.author.login),
    additions: show(data.additions),
    deletions: show(data.deletions),
  };
}

const withTicket = (lines, ticket) => (ticket ? [...lines, `Ticket: ${ticket}`] : lines);
const result = (lines, code = 0) => ({ stdout: lines.map((l) => `${l}\n`).join(''), code });
const fail = (message) => result([message], 1);
const silentExit = (code) => ({ stdout: '', code });

function prFlow({ prNumber }, baseBranch, deps) {
  if (!deps.ghAvailable()) return fail('Error: gh CLI not found. Cannot fetch PR without it.');

  const prData = stripTrailingNewlines(
    deps.gh(['pr', 'view', prNumber, '--json', PR_FIELDS], { stderr: 'merge' }).stdout);
  if (prData.includes('could not resolve')) return fail(`Error: PR #${prNumber} not found`);

  const pr = parsePrData(prData);

  deps.git(['fetch', 'origin', pr.branch], { stderr: 'ignore' });
  const log = deps.git(['log', `origin/${baseBranch}..FETCH_HEAD`, '--oneline'], { stderr: 'ignore' });
  if (log.status !== 0) return silentExit(log.status);
  const commits = countLines(log.stdout);

  const diff = deps.git(['diff', '--name-only', `origin/${baseBranch}...FETCH_HEAD`], { stderr: 'ignore' });
  const files = stripTrailingNewlines(dropAssetFiles(diff.stdout));

  return result(withTicket([
    'Type: PR',
    'Source: gh CLI',
    `PR: #${prNumber} (${pr.state})`,
    `Title: ${pr.title}`,
    `Branch: ${pr.branch}`,
    `Author: ${pr.author}`,
    `Commits: ${commits}`,
    `Additions: +${pr.additions}`,
    `Deletions: -${pr.deletions}`,
  ], firstTicket(pr.branch)).concat('', 'Changed Files:', bulletLines(files)));
}

function branchFlow({ branch }, baseBranch, deps, usageName) {
  if (deps.ghAvailable()) {
    const listed = stripTrailingNewlines(
      deps.gh(['pr', 'list', '--head', branch, '--json', 'number', '--limit', '1'], { stderr: 'ignore' }).stdout);
    if (listed !== '' && listed !== '[]') {
      const prNumber = JSON.parse(listed)[0].number;
      const remote = stripTrailingNewlines(deps.git(['remote', 'get-url', 'origin'], { stderr: 'inherit' }).stdout);
      return runFetchContext(prUrlFor(remoteUrlToRepoPath(remote), prNumber), usageName, deps);
    }
  }

  // ls-remote exits 0 for an unknown branch (no --exit-code), so this only trips on an unreachable remote.
  if (deps.git(['ls-remote', '--heads', 'origin', branch], { stderr: 'ignore' }).status !== 0) {
    return fail(`Error: Branch '${branch}' not found in remote`);
  }

  deps.git(['fetch', 'origin', branch], { stderr: 'ignore' });
  const range = `origin/${baseBranch}...origin/${branch}`;
  const log = deps.git(['log', `origin/${baseBranch}..origin/${branch}`, '--oneline'], { stderr: 'ignore' });
  if (log.status !== 0) return silentExit(log.status);
  const files = stripTrailingNewlines(deps.git(['diff', '--name-only', range], { stderr: 'ignore' }).stdout);
  const stats = stripTrailingNewlines(deps.git(['diff', '--shortstat', range], { stderr: 'ignore' }).stdout);

  return result(withTicket([
    'Type: Branch',
    'Source: git',
    `Branch: ${branch}`,
    `Commits: ${countLines(log.stdout)}`,
    `Stats: ${stats}`,
  ], firstTicket(branch)).concat('', 'Changed Files:', bulletLines(files)));
}

function commitFlow({ commit }, deps) {
  if (deps.git(['show', commit, '--format=', '--name-only'], { stderr: 'ignore' }).status !== 0) {
    return fail(`Error: Commit '${commit}' not found`);
  }

  const data = deps.git(['show', '--stat', '--format=%H|%s|%an|%ae|%ad', commit], { stderr: 'inherit' });
  if (data.status !== 0) return silentExit(data.status);
  const [hash, subject, author] = data.stdout.split('\n')[0].split('|');

  const names = deps.git(['show', '--name-only', '--format=', commit], { stderr: 'inherit' });
  if (names.status !== 0) return silentExit(names.status);
  const files = stripTrailingNewlines(names.stdout);

  return result(withTicket([
    'Type: Commit',
    'Source: git',
    `Hash: ${hash}`,
    `Subject: ${subject}`,
    `Author: ${author}`,
  ], firstTicket(subject)).concat('', 'Changed Files:', bulletLines(files)));
}

export function runFetchContext(input, usageName, deps) {
  if (!input) return fail(`Usage: ${usageName} <PR_URL|BRANCH|COMMIT>`);

  const target = classifyInput(input);
  if (!target) return fail('Invalid input. Provide PR URL, branch name, or commit hash.');

  const baseBranch = baseBranchFrom(deps.git(['symbolic-ref', 'refs/remotes/origin/HEAD'], { stderr: 'ignore' }));

  switch (target.type) {
    case 'PR': return prFlow(target, baseBranch, deps);
    case 'BRANCH': return branchFlow(target, baseBranch, deps, usageName);
    default: return commitFlow(target, deps);
  }
}
