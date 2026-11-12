// Run: node --test ~/.agents/skills/git-pr-fetch/*.test.mjs
// Golden files in golden/ were recorded from the former bash scripts (fetch-pr.sh, filter-unresolved.sh) and pin the
// output, messages and exit codes. Three goldens changed on purpose when the scripts became .mjs (script name in the usage
// text, no machine path) and three because the port fixes the awk parser, which dropped the author and body of replies
// (fetch-pr_full, filter_mixed, filter_flat).
// Re-record only on purpose: UPDATE_GOLDEN=1 node --test skills/git-pr-fetch/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_OWNER, DEFAULT_REPO, run, parseIdentifier, cacheKey, apiUrls, statusError, formatComments, formatReviews, formatUnresolved, formatPr, stripTrailingNewlines } from './fetch-pr-lib.mjs';
import { filterUnresolved, runFilter } from './filter-unresolved-lib.mjs';

const GOLDEN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'golden');
const UPDATE = process.env.UPDATE_GOLDEN === '1';
// Goldens hold {{DEFAULT_REPO}} instead of the default owner/repo, so they stay valid when those names are replaced (generic export).
const DEFAULT_SLUG = `${DEFAULT_OWNER}/${DEFAULT_REPO}`;
const API_DEFAULT = `https://api.github.com/repos/${DEFAULT_SLUG}`;
const withToken = s => s.replaceAll(DEFAULT_SLUG, '{{DEFAULT_REPO}}');

// ---------- harness: fake dependencies instead of fake gh / curl ----------
async function runFetch(args, { fixtures = {}, ghFail = false, status = {}, remaining = '4999', reset = '0', cacheHit = '' } = {}) {
  const result = { out: '', err: '', calls: [], cacheCalls: [], cacheValue: '' };
  const kindOf = url => (/\/issues\/\d+\/comments$/.test(url) ? 'comments' : /\/pulls\/\d+\/reviews$/.test(url) ? 'reviews' : /\/pulls\/\d+\/comments$/.test(url) ? 'review_comments' : 'pr');
  const deps = {
    ghToken: () => (ghFail ? null : 'fake-token'),
    fetchApi: async url => {
      result.calls.push(url);
      const kind = kindOf(url);
      return { status: status[kind] ?? 200, headers: { 'x-ratelimit-remaining': remaining, 'x-ratelimit-reset': reset }, text: typeof fixtures[kind] === 'string' ? fixtures[kind] : JSON.stringify(fixtures[kind]) };
    },
    cacheGet: key => { result.cacheCalls.push(`get ${key}`); return cacheHit; },
    cacheSet: (key, ttl, value) => { result.cacheCalls.push(`set ${key} ${ttl}`); result.cacheValue = value; },
    out: s => { result.out += s; },
    err: s => { result.err += s; },
  };
  result.code = await run(args, deps);
  return result;
}

const record = r => withToken(`${r.out}--- stderr ---\n${r.err.replace(/(Wait until ).*?\.\n/g, '$1<DATE>.\n')}--- exit ${r.code} ---\n`);

function expectGolden(name, actual) {
  const file = path.join(GOLDEN, `${name}.txt`);
  if (UPDATE) { fs.mkdirSync(GOLDEN, { recursive: true }); fs.writeFileSync(file, actual); return; }
  assert.ok(fs.existsSync(file), `golden file missing: ${file} (record with UPDATE_GOLDEN=1)`);
  assert.equal(actual, fs.readFileSync(file, 'utf8'));
}

// ---------- fixtures in the shape GitHub returns (nested user/_links objects) ----------
const user = login => ({ login, id: 1000 + login.length, node_id: 'U_x', type: 'User', site_admin: false });
const reviewComment = ({ id, login, path: p, body, line = 12, replyTo, created = '2026-01-05T10:00:00Z' }) => ({
  url: `https://api.github.com/repos/o/r/pulls/comments/${id}`, pull_request_review_id: 9000 + id, id, node_id: `C_${id}`,
  diff_hunk: '@@ -1,3 +1,4 @@', path: p, commit_id: 'abc', original_commit_id: 'abc', user: user(login), body,
  created_at: created, updated_at: created, html_url: `https://github.com/o/r/pull/7#discussion_r${id}`, pull_request_url: 'https://api.github.com/repos/o/r/pulls/7',
  author_association: 'MEMBER', _links: { self: { href: 'x' }, html: { href: 'y' }, pull_request: { href: 'z' } },
  reactions: { url: 'u', total_count: 0 }, start_line: null, original_start_line: null, start_side: null, line, original_line: line, side: 'RIGHT',
  ...(replyTo ? { in_reply_to_id: replyTo } : {}), position: 3, original_position: 3, subject_type: 'line',
});
const issueComment = (login, body, created = '2026-01-04T09:00:00Z') => ({ url: 'u', id: 5, user: user(login), created_at: created, updated_at: created, body });
const review = (login, state, body, submitted = '2026-01-06T08:00:00Z') => ({ id: 77, user: user(login), body, state, submitted_at: submitted });
const pr = (over = {}) => ({
  url: 'u', id: 1, number: 7, state: 'open', title: 'Add widget', user: user('alice'), body: 'Adds the widget.\n\nSecond paragraph.',
  created_at: '2026-01-03T07:00:00Z', updated_at: '2026-01-07T07:30:00Z', closed_at: null, merged_at: null,
  head: { ref: 'feature/widget', sha: 's1' }, base: { ref: 'develop', sha: 's2' }, commits: 3, additions: 120, deletions: 4, changed_files: 5, ...over,
});

const rcMixed = [
  reviewComment({ id: 101, login: 'bob', path: 'src/A.cs', body: 'Why not use a constant here?', line: 10 }), // no replies -> unresolved
  reviewComment({ id: 102, login: 'bob', path: 'src/B.cs', body: 'Line one\\nLine two with \\"quotes\\"', line: 20 }), // replied by author -> resolved
  reviewComment({ id: 103, login: 'alice', path: 'src/B.cs', body: 'Done, changed it.', replyTo: 102, created: '2026-01-05T11:00:00Z' }),
  reviewComment({ id: 104, login: 'carol', path: 'src/C.cs', body: 'Please rename.', line: 30 }), // last reply by other -> unresolved
  reviewComment({ id: 105, login: 'alice', path: 'src/C.cs', body: 'Renamed.', replyTo: 104 }),
  reviewComment({ id: 106, login: 'carol', path: 'src/C.cs', body: 'Still wrong.', replyTo: 104 }),
];
const full = () => ({
  pr: pr(), comments: [issueComment('carol', 'Looks good overall.'), issueComment('bob', 'One more thing.')],
  reviews: [review('bob', 'CHANGES_REQUESTED', 'See inline.'), review('carol', 'APPROVED', ''), review('dave', 'PENDING', 'draft')], review_comments: rcMixed,
});
const empty = () => ({ pr: pr({ body: null }), comments: [], reviews: [], review_comments: [] });

// ---------- fetch-pr: golden output ----------
test('fetch-pr: PR with comments, reviews and mixed review threads', async () => {
  const r = await runFetch(['7'], { fixtures: full() });
  expectGolden('fetch-pr_full', record(r));
  assert.equal(r.code, 0);
  assert.deepEqual(r.calls.map(u => u.replace(`${API_DEFAULT}/`, '')), ['pulls/7', 'issues/7/comments', 'pulls/7/reviews', 'pulls/7/comments']);
  assert.deepEqual(r.cacheCalls, [`get pr-${DEFAULT_OWNER}-${DEFAULT_REPO}-7`, `set pr-${DEFAULT_OWNER}-${DEFAULT_REPO}-7 900`]);
  assert.equal(r.cacheValue + '\n', r.out); // what is cached is exactly what is printed
});

test('fetch-pr: merged PR without description, comments, reviews', async () => {
  const r = await runFetch(['7'], { fixtures: { ...empty(), pr: pr({ state: 'closed', body: '', merged_at: '2026-01-08T12:00:00Z' }) } });
  expectGolden('fetch-pr_merged_empty', record(r));
});

test('fetch-pr: open PR with empty collections', async () => {
  expectGolden('fetch-pr_empty', record(await runFetch(['7'], { fixtures: empty() })));
});

test('fetch-pr: accepted identifier forms map to owner/repo/number', async () => {
  const first = async id => (await runFetch([id], { fixtures: empty() })).calls[0];
  assert.equal(await first('7'), `${API_DEFAULT}/pulls/7`);
  assert.equal(await first('https://github.com/acme/widgets/pull/42'), 'https://api.github.com/repos/acme/widgets/pulls/42');
  assert.equal(await first('acme/widgets#42'), 'https://api.github.com/repos/acme/widgets/pulls/42');
});

test('fetch-pr: cache hit prints the cached text and does not call the API', async () => {
  const r = await runFetch(['7'], { fixtures: empty(), cacheHit: 'CACHED OUTPUT' });
  assert.equal(r.out, 'CACHED OUTPUT\n');
  assert.equal(r.code, 0);
  assert.deepEqual(r.calls, []);
});

for (const [name, args, opts] of [
  ['no_argument', [], {}],
  ['invalid_identifier', ['not a pr'], {}],
  ['gh_not_authenticated', ['7'], { ghFail: true }],
  ['http_401', ['7'], { status: { pr: 401 } }],
  ['http_403_forbidden', ['7'], { status: { pr: 403 } }],
  ['http_403_rate_limited', ['7'], { status: { pr: 403 }, remaining: '0', reset: '1893456000' }],
  ['http_404', ['7'], { status: { pr: 404 } }],
  ['http_429', ['7'], { status: { pr: 429 }, reset: '1893456000' }],
  ['http_500', ['7'], { status: { pr: 500 } }],
  ['http_404_on_later_call', ['7'], { status: { reviews: 404 } }],
]) {
  test(`fetch-pr error path: ${name}`, async () => {
    const r = await runFetch(args, { fixtures: empty(), ...opts });
    expectGolden(`fetch-pr_error_${name}`, record(r));
    assert.equal(r.code, 1);
    assert.equal(r.out, '');
  });
}

// ---------- fetch-pr: behavior beyond the goldens ----------
test('fetch-pr: a request that fails outright (status 0) reports HTTP 000', async () => {
  const r = await runFetch(['7'], { fixtures: empty(), status: { pr: 0 } });
  assert.equal(r.err, 'ERROR: Unexpected HTTP 000 from GitHub API.\n');
});

test('fetch-pr: a non-JSON answer is a clear error naming the URL, not a stack trace', async () => {
  const r = await runFetch(['7'], { fixtures: { ...empty(), pr: '<html>nope</html>' } });
  assert.equal(r.code, 1);
  assert.ok(r.err.includes(`invalid JSON for ${API_DEFAULT}/pulls/7`), r.err);
});

test('fetch-pr: the identifier is checked before the API, the gh login before the identifier shape', async () => {
  const r = await runFetch(['not a pr'], { fixtures: empty(), ghFail: true });
  assert.match(r.err, /gh CLI not authenticated/);
  assert.deepEqual(r.calls, []);
});

test('fetch-pr: a failing cache never fails the fetch', async () => {
  const out = [];
  const err = [];
  const code = await run(['7'], {
    ghToken: () => 't', fetchApi: async url => ({ status: 200, headers: {}, text: JSON.stringify(/\/pulls\/7$/.test(url) ? pr() : []) }),
    cacheGet: () => { throw new Error('no bash'); }, cacheSet: () => { throw new Error('no bash'); }, out: s => out.push(s), err: s => err.push(s),
  });
  assert.equal(code, 0);
  assert.deepEqual(err, []);
  assert.match(out.join(''), /^# PR #7: Add widget\n/);
});

// ---------- real GitHub JSON: the awk parser could not read it ----------
test('filter: real GitHub-shaped JSON yields correct threads, dates, lines, bodies and replies', () => {
  const md = filterUnresolved(rcMixed, 'alice');
  expectGolden('filter_mixed', md + '--- stderr ---\n--- exit 0 ---\n');
  assert.match(md, /\*\*Total threads:\*\* 3/);
  assert.match(md, /\*\*Total unresolved:\*\* 2\/3/);
});

// ---------- parseIdentifier / small pure functions ----------
test('parseIdentifier: URL, owner/repo#n and bare numbers; owner and repo are kept as written', () => {
  assert.deepEqual(parseIdentifier(`https://github.com/${DEFAULT_SLUG}/pull/312`), { owner: DEFAULT_OWNER, repo: DEFAULT_REPO, number: '312' });
  assert.deepEqual(parseIdentifier('https://github.com/a/b/pull/9/files'), { owner: 'a', repo: 'b', number: '9' });
  assert.deepEqual(parseIdentifier('a-b/c.d#12'), { owner: 'a-b', repo: 'c.d', number: '12' });
  assert.deepEqual(parseIdentifier('15'), { owner: DEFAULT_OWNER, repo: DEFAULT_REPO, number: '15' });
});

test('parseIdentifier: empty input is an early error with usage, a bad shape is a late error', () => {
  const none = parseIdentifier('');
  assert.equal(none.early, true);
  assert.equal(none.error[0], 'ERROR: No PR identifier provided');
  const bad = parseIdentifier('12 34');
  assert.equal(bad.early, false);
  assert.deepEqual(bad.error, ['ERROR: Invalid PR identifier: 12 34', 'Use: URL, number, or owner/repo#number']);
  assert.equal(parseIdentifier('#12').early, false);
  assert.equal(parseIdentifier('a/b#x').early, false);
});

test('cacheKey and apiUrls: derived from owner, repo and number', () => {
  const id = { owner: 'o', repo: 'r', number: '3' };
  assert.equal(cacheKey(id), 'pr-o-r-3');
  assert.deepEqual(apiUrls(id), {
    pr: 'https://api.github.com/repos/o/r/pulls/3',
    comments: 'https://api.github.com/repos/o/r/issues/3/comments',
    reviews: 'https://api.github.com/repos/o/r/pulls/3/reviews',
    reviewComments: 'https://api.github.com/repos/o/r/pulls/3/comments',
  });
});

test('statusError: 200 is fine, every other status has its own message', () => {
  const id = { owner: 'o', repo: 'r', number: '3' };
  assert.equal(statusError(200, {}, id), null);
  assert.match(statusError(401, {}, id), /HTTP 401/);
  assert.match(statusError(403, { 'x-ratelimit-remaining': '12' }, id), /HTTP 403/);
  assert.match(statusError(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1893456000' }, id), /rate limit exceeded\. Wait until .+\.$/);
  assert.equal(statusError(404, {}, id), "ERROR: PR #3 not found in o/r or you don't have access.");
  assert.match(statusError(429, { 'x-ratelimit-reset': '1893456000' }, id), /rate limit exceeded/);
  assert.equal(statusError(502, {}, id), 'ERROR: Unexpected HTTP 502 from GitHub API.');
});

test('statusError: a missing or non-numeric reset header says the reset time is unknown', () => {
  const id = { owner: 'o', repo: 'r', number: '3' };
  assert.match(statusError(429, {}, id), /Wait until reset time unknown\.$/);
  assert.match(statusError(429, { 'x-ratelimit-reset': 'soon' }, id), /reset time unknown/);
});

test('stripTrailingNewlines: removes only trailing line feeds', () => {
  assert.equal(stripTrailingNewlines('a\n\nb\n\n\n'), 'a\n\nb');
  assert.equal(stripTrailingNewlines('a  '), 'a  ');
});

test('formatComments: separator after each comment, none after the last, fallbacks for missing user and body', () => {
  assert.equal(formatComments([]), '*(No comments)*');
  assert.equal(
    formatComments([{ user: { login: 'a' }, created_at: '2026-01-01T10:00:00Z', body: 'x' }, { created_at: '2026-01-02T00:00:00Z' }]),
    '**a** on 2026-01-01:\n\nx\n\n---\n\n**unknown** on 2026-01-02:\n\n\n\n---',
  );
});

test('formatReviews: pending reviews are dropped, an empty body becomes "(no comment)", all pending gives an empty section', () => {
  assert.equal(formatReviews([]), '*(No reviews)*');
  const text = formatReviews([
    { user: { login: 'a' }, state: 'APPROVED', submitted_at: '2026-01-01T00:00:00Z', body: '' },
    { user: { login: 'b' }, state: 'PENDING', submitted_at: '2026-01-02T00:00:00Z', body: 'draft' },
  ]);
  assert.equal(text, '**a** - APPROVED on 2026-01-01:\n\n(no comment)\n\n---');
  assert.equal(formatReviews([{ user: { login: 'b' }, state: 'PENDING', body: 'x' }]), '');
});

test('formatUnresolved: no review comments gives the fixed placeholder section', () => {
  assert.equal(formatUnresolved([], 'a'), '# Unresolved Review Comments\n\n*(No review comments)*');
});

test('formatPr: missing fields fall back to empty text and zeros; a literal "null" body counts as no description', () => {
  const text = formatPr({ pr: { body: 'null' }, comments: [], reviews: [], reviewComments: [] }, 5);
  assert.match(text, /^# PR #5: \n/);
  assert.match(text, /\| \*\*Commits\*\* \| 0 \|/);
  assert.match(text, /\| \*\*Additions\*\* \| \+0 \|/);
  assert.match(text, /## Description\n\n\*\(No description provided\)\*\n/);
  assert.ok(!text.includes('**Merged**'));
});

test('formatPr: PR text from the API is inserted literally (no shell expansion of $ or backticks)', () => {
  const text = formatPr({ pr: pr({ title: 'Use $HOME and `id` and $(whoami)' }), comments: [], reviews: [], reviewComments: [] }, 5);
  assert.match(text, /^# PR #5: Use \$HOME and `id` and \$\(whoami\)\n/);
});

// ---------- filter-unresolved ----------
const rc = (id, login, over = {}) => ({ id, user: { login }, path: 'a.cs', body: `b${id}`, created_at: '2026-02-01T10:00:00Z', original_line: 4, ...over });

test('filterUnresolved: a thread without replies is unresolved, one whose last reply is by the author is resolved', () => {
  const md = filterUnresolved([rc(1, 'bob'), rc(2, 'bob', { path: 'b.cs' }), rc(3, 'alice', { in_reply_to_id: 2 })], 'alice');
  assert.match(md, /\*\*Total unresolved:\*\* 1\/2/);
  assert.match(md, /## 1\. \*\*bob\*\* on `a\.cs:4`/);
  assert.ok(!md.includes('b.cs'));
});

test('filterUnresolved: the LAST reply decides, not any reply by the author', () => {
  const md = filterUnresolved([rc(1, 'bob'), rc(2, 'alice', { in_reply_to_id: 1 }), rc(3, 'bob', { in_reply_to_id: 1 })], 'alice');
  assert.match(md, /\*\*Replies:\*\* 2 \(last by bob\)/);
  assert.match(md, /<details><summary>Show replies<\/summary>[\s\S]*\*\*alice:\*\*[\s\S]*\*\*bob:\*\*[\s\S]*<\/details>/);
});

test('filterUnresolved: no original_line shows the bare path; missing date and body stay empty', () => {
  const md = filterUnresolved([rc(1, 'bob', { original_line: null, created_at: undefined, body: null })], 'alice');
  assert.match(md, /on `a\.cs`\n/);
  assert.match(md, /\*\*Date:\*\* \n/);
});

test('filterUnresolved: replies to an unknown thread are ignored and not counted', () => {
  const md = filterUnresolved([rc(1, 'bob'), rc(2, 'carol', { in_reply_to_id: 999 })], 'alice');
  assert.match(md, /\*\*Total threads:\*\* 1/);
});

test('filterUnresolved: no comments gives zero of zero', () => {
  assert.match(filterUnresolved([], 'alice'), /\*\*Total unresolved:\*\* 0\/0\n$/);
});

test('filterUnresolved: bodies keep real line breaks and quotes from the JSON', () => {
  const md = filterUnresolved(JSON.parse(JSON.stringify([rc(1, 'bob', { body: 'one\ntwo "q"' })])), 'alice');
  assert.match(md, /\*\*Comment:\*\*\n\none\ntwo "q"\n/);
});

// ---------- filter-unresolved CLI (one-line nested objects: the shape the old awk parser handled) ----------
function runFilterCli(args, files = {}) {
  const r = { out: '', err: '' };
  r.code = runFilter(args, { readFile: p => files[p] ?? null, out: s => { r.out += s; }, err: s => { r.err += s; } });
  return r;
}
const cliRecord = r => `${r.out}--- stderr ---\n${r.err}--- exit ${r.code} ---\n`;

test('filter-unresolved CLI: one-line nested objects give the same output as the former awk script', () => {
  const flat = [
    { id: 1, user: { login: 'bob' }, path: 'a.cs', body: 'First', original_line: 4, created_at: '2026-02-01T00:00:00Z' },
    { id: 2, user: { login: 'alice' }, path: 'a.cs', body: 'Reply', in_reply_to_id: 1, created_at: '2026-02-02T00:00:00Z' },
    { id: 3, user: { login: 'bob' }, path: 'b.cs', body: 'Second', original_line: 9, created_at: '2026-02-03T00:00:00Z' },
    { id: 4, user: { login: 'carol' }, path: 'c.cs', body: 'Q', created_at: '2026-02-04T00:00:00Z' },
    { id: 5, user: { login: 'alice' }, path: 'c.cs', body: 'A', in_reply_to_id: 4, created_at: '2026-02-05T00:00:00Z' },
    { id: 6, user: { login: 'carol' }, path: 'c.cs', body: 'B', in_reply_to_id: 4, created_at: '2026-02-06T00:00:00Z' },
  ];
  expectGolden('filter_flat', cliRecord(runFilterCli(['rc.json', 'alice'], { 'rc.json': JSON.stringify(flat, null, 2) })));
});

test('filter-unresolved CLI: empty array', () => {
  expectGolden('filter_empty', cliRecord(runFilterCli(['rc.json', 'alice'], { 'rc.json': '[]\n' })));
});

for (const [name, args] of [['missing_args', []], ['missing_author', ['rc.json']], ['missing_file', ['/no/such/file.json', 'alice']]]) {
  test(`filter-unresolved CLI error path: ${name}`, () => {
    const r = runFilterCli(args, { 'rc.json': '[]\n' });
    expectGolden(`filter_error_${name}`, cliRecord(r));
    assert.equal(r.code, 1);
    assert.equal(r.out, '');
  });
}

test('filter-unresolved CLI: invalid JSON and a non-array are reported, not thrown', () => {
  const bad = runFilterCli(['rc.json', 'a'], { 'rc.json': '{oops' });
  assert.equal(bad.code, 1);
  assert.match(bad.err, /rc\.json is not valid JSON/);
  const obj = runFilterCli(['rc.json', 'a'], { 'rc.json': '{}' });
  assert.equal(obj.code, 1);
  assert.match(obj.err, /must hold a JSON array/);
});
