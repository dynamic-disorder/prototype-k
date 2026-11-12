// Pure logic of fetch-pr.mjs (no file system, process or network access of its own) so it can be unit tested.
// Output, messages and exit codes are pinned by the golden files in golden/ (recorded from the former fetch-pr.sh).
import { filterUnresolved } from './filter-unresolved-lib.mjs';

export const DEFAULT_OWNER = 'CompanyOrOrganizationName';
export const DEFAULT_REPO = 'product_name';
export const API_BASE = 'https://api.github.com';
export const CACHE_TTL_SECONDS = 900;

const USAGE_LINES = [
  'ERROR: No PR identifier provided',
  'Usage: fetch-pr.mjs <PR_NUMBER|PR_URL>',
  'Examples:',
  '  fetch-pr.mjs 22312',
  '  fetch-pr.mjs https://github.com/CompanyOrOrganizationName/product_name/pull/1234',
];

export const stripTrailingNewlines = s => s.replace(/\n+$/, '');
const day = iso => (iso ?? '').split('T')[0];

// Returns { owner, repo, number } or { error: [lines], early }. An early error is reported before the gh login check, a late one after it.
export function parseIdentifier(input) {
  if (!input) return { error: USAGE_LINES, early: true };
  const url = input.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/([0-9]+)/);
  const short = input.match(/^([^/]+)\/([^#]+)#([0-9]+)$/);
  const m = url ?? short;
  if (m) return { owner: m[1], repo: m[2], number: m[3] };
  if (/^[0-9]+$/.test(input)) return { owner: DEFAULT_OWNER, repo: DEFAULT_REPO, number: input };
  return { error: [`ERROR: Invalid PR identifier: ${input}`, 'Use: URL, number, or owner/repo#number'], early: false };
}

export const cacheKey = ({ owner, repo, number }) => `pr-${owner}-${repo}-${number}`;

export const apiUrls = ({ owner, repo, number }) => ({
  pr: `${API_BASE}/repos/${owner}/${repo}/pulls/${number}`,
  comments: `${API_BASE}/repos/${owner}/${repo}/issues/${number}/comments`,
  reviews: `${API_BASE}/repos/${owner}/${repo}/pulls/${number}/reviews`,
  reviewComments: `${API_BASE}/repos/${owner}/${repo}/pulls/${number}/comments`,
});

const resetText = reset => {
  const seconds = Number(reset);
  return reset && Number.isFinite(seconds) ? new Date(seconds * 1000).toString() : 'reset time unknown';
};

// status 0 = the request itself failed. Returns the error message for a non-200 answer, or null for 200.
export function statusError(status, headers, { owner, repo, number }) {
  const remaining = headers['x-ratelimit-remaining'];
  const rateLimited = `ERROR: GitHub API rate limit exceeded. Wait until ${resetText(headers['x-ratelimit-reset'])}.`;
  switch (status) {
    case 200: return null;
    case 401: return 'ERROR: Authentication failed (HTTP 401). Check GITHUB_TOKEN in settings.local.json.';
    case 403: return remaining === '0' ? rateLimited : 'ERROR: Authentication failed (HTTP 403). Check GITHUB_TOKEN in settings.local.json.';
    case 404: return `ERROR: PR #${number} not found in ${owner}/${repo} or you don't have access.`;
    case 429: return rateLimited;
    default: return `ERROR: Unexpected HTTP ${String(status).padStart(3, '0')} from GitHub API.`;
  }
}

export function formatComments(comments) {
  if (comments.length === 0) return '*(No comments)*';
  return stripTrailingNewlines(comments
    .map(c => `**${c.user?.login || 'unknown'}** on ${day(c.created_at)}:\n\n${c.body || ''}\n\n---\n\n`)
    .join(''));
}

export function formatReviews(reviews) {
  if (reviews.length === 0) return '*(No reviews)*';
  return stripTrailingNewlines(reviews
    .filter(r => r.state !== 'PENDING')
    .map(r => `**${r.user?.login || 'unknown'}** - ${r.state} on ${day(r.submitted_at)}:\n\n${r.body || '(no comment)'}\n\n---\n\n`)
    .join(''));
}

export const formatUnresolved = (reviewComments, author) =>
  reviewComments.length > 0
    ? stripTrailingNewlines(filterUnresolved(reviewComments, author))
    : '# Unresolved Review Comments\n\n*(No review comments)*';

// data = { pr, comments, reviews, reviewComments } as returned by the GitHub API (parsed).
export function formatPr({ pr, comments, reviews, reviewComments }, number) {
  const author = pr.user?.login || '';
  const title = pr.title || '';
  const body = stripTrailingNewlines(pr.body || '');
  const merged = pr.merged_at && pr.merged_at !== 'null' ? `| **Merged** | ${pr.merged_at} |\n` : '';
  return `# PR #${number}: ${title}

| Field | Value |
|-------|-------|
| **Title** | ${title} |
| **State** | ${pr.state || ''} |
| **Author** | ${author} |
| **Created** | ${day(pr.created_at)} |
| **Updated** | ${day(pr.updated_at)} |
${merged}| **Base** | ${pr.base?.ref || ''} |
| **Head** | ${pr.head?.ref || ''} |
| **Commits** | ${pr.commits || 0} |
| **Changed Files** | ${pr.changed_files || 0} |
| **Additions** | +${pr.additions || 0} |
| **Deletions** | -${pr.deletions || 0} |

## Description

${body && body !== 'null' ? body : '*(No description provided)*'}

## Comments (${comments.length})

${formatComments(comments)}

## Reviews (${reviews.length})

${formatReviews(reviews)}

${formatUnresolved(reviewComments, author)}`;
}

// deps: { ghToken() -> string | null, fetchApi(url, token) -> Promise<{ status, headers, text }>,
//         cacheGet(key) -> string, cacheSet(key, ttlSeconds, value), out(text), err(text) }.
// Returns the exit code. The cache is only a speed-up: its failures never fail a fetch.
export async function run(argv, deps) {
  const fail = lines => { deps.err(lines.map(l => `${l}\n`).join('')); return 1; };
  const [input] = argv;

  const id = parseIdentifier(input);
  if (id.error?.length && id.early) return fail(id.error);
  const token = deps.ghToken();
  if (!token) return fail(['ERROR: gh CLI not authenticated. Run: gh auth login']);
  if (id.error) return fail(id.error);

  const key = cacheKey(id);
  const cached = safe(() => deps.cacheGet(key), '');
  if (cached) { deps.out(`${cached}\n`); return 0; }

  const urls = apiUrls(id);
  const data = {};
  for (const [name, url] of Object.entries(urls)) {
    const res = await deps.fetchApi(url, token);
    const message = statusError(res.status, res.headers, id);
    if (message) return fail([message]);
    try {
      data[name] = JSON.parse(res.text);
    } catch {
      return fail([`ERROR: GitHub API returned invalid JSON for ${url}.`]);
    }
  }

  const output = formatPr({ pr: data.pr, comments: data.comments, reviews: data.reviews, reviewComments: data.reviewComments }, id.number);
  safe(() => deps.cacheSet(key, CACHE_TTL_SECONDS, output), undefined);
  deps.out(`${output}\n`);
  return 0;
}

function safe(fn, fallback) {
  try { return fn() ?? fallback; } catch { return fallback; }
}
