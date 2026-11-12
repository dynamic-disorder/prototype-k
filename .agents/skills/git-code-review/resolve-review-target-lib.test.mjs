import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitTarget, detectKind, repoParts, baseBranchFrom, filterChangedFiles, threadCount,
  kindsOfFile, natureOf, resolveReviewTarget, firstTicket,
} from './resolve-review-target-lib.mjs';

const ok = (stdout = '') => ({ status: 0, stdout });
const failed = (status = 1) => ({ status, stdout: '' });
const NO_ENV = { REPO: '', TICKET_PR_URL: '', TICKET_BRANCH: '' };

// Fake git/gh/openThreads: answers keyed by the joined args, every call recorded.
function fakeDeps({ git = {}, gh = {}, threads = '' } = {}) {
  const calls = [];
  return {
    calls,
    git: (args) => { calls.push(`git ${args.join(' ')}`); return git[args.join(' ')] ?? ok(); },
    gh: (args) => { calls.push(`gh ${args.join(' ')}`); return gh[args.join(' ')] ?? failed(); },
    openThreads: (owner, repo, pr) => { calls.push(`threads ${owner}/${repo}#${pr}`); return threads; },
  };
}

const GIT_BASE = {
  'symbolic-ref refs/remotes/origin/HEAD': ok('refs/remotes/origin/develop\n'),
  'branch --show-current': ok('feature/PROJECT_ISSUE_PREFIX-1234-thing\n'),
  'config user.email': ok('me-example\n'),
};
const META_ARGS = 'pr view 7 --repo Acme/widgets --json number,title,url,state,author,headRefName,additions,deletions';
const META_JSON = '{"number":7,"headRefName":"feature/PROJECT_ISSUE_PREFIX-1234-thing","author":{"login":"Me"}}';
const GH_PR7 = {
  'repo view --json nameWithOwner --jq .nameWithOwner': ok('Acme/widgets\n'),
  [META_ARGS]: ok(`${META_JSON}\n`),
  'api user --jq .login': ok('me\n'),
  'pr view 7 --repo Acme/widgets --json author --jq .author.login': ok('Me\n'),
};
const DIFF = 'diff --name-only origin/develop...FETCH_HEAD';

test('splitTarget separates the target token from the instructions', () => {
  // Given: inputs with and without a target, extra whitespace and unknown tokens
  const cases = [
    ['', { kind: 'current', target: '', extra: '' }],
    ['   ', { kind: 'current', target: '', extra: '' }],
    ['.', { kind: 'current', target: '', extra: '' }],
    ['.   check things', { kind: 'current', target: '', extra: 'check things' }],
    ['  other/thing  x y', { kind: 'target', target: 'other/thing', extra: 'x y' }],
    ['7', { kind: 'target', target: '7', extra: '' }],
    ['https://github.com/A/b/pull/7/files  go', { kind: 'target', target: 'https://github.com/A/b/pull/7/files', extra: 'go' }],
    ['foo bar baz', { kind: 'unrecognized', first: 'foo' }],
    ['12abc', { kind: 'unrecognized', first: '12abc' }],
  ];
  // When/Then: each splits as the bash script did
  for (const [raw, expected] of cases) assert.deepEqual(splitTarget(raw), expected, JSON.stringify(raw));
});

test('detectKind maps a target to pr, ticket or branch', () => {
  assert.deepEqual(detectKind('https://github.com/A/b/pull/7'), { kind: 'pr', prNumber: '7' });
  assert.deepEqual(detectKind('42'), { kind: 'pr', prNumber: '42' });
  assert.deepEqual(detectKind('feature/x'), { kind: 'branch', branch: 'feature/x' });
  assert.equal(detectKind('foo'), null);
});

test('repoParts splits owner and name', () => {
  assert.deepEqual(repoParts('Acme/widgets'), { owner: 'Acme', name: 'widgets' });
  assert.deepEqual(repoParts('solo'), { owner: 'solo', name: 'solo' });
});

test('baseBranchFrom falls back to develop when symbolic-ref fails', () => {
  assert.equal(baseBranchFrom(ok('refs/remotes/origin/main\n')), 'main');
  assert.equal(baseBranchFrom(failed(128)), 'develop');
});

test('filterChangedFiles drops bundled assets and the pseudo-language generator', () => {
  // Given: a diff with kept and excluded paths
  const diff = 'src/A.cs\nassets/app.js\nassets/app.css\nassets/a.js.map\nassets/img.png\nPseudoLanguageGenerator/g.cs\nsrc/PseudoLanguageGenerator/h.txt\n';
  // When/Then: only the plain files remain
  assert.equal(filterChangedFiles(diff), 'src/A.cs\nassets/img.png');
  assert.equal(filterChangedFiles(''), '');
});

test('threadCount reads the array length and is empty on bad output', () => {
  assert.equal(threadCount('[{},{}]'), '2');
  assert.equal(threadCount('[]'), '0');
  assert.equal(threadCount('garbage'), '');
  assert.equal(threadCount(''), '');
  assert.equal(threadCount('{}'), 'undefined');
});

test('kindsOfFile follows the original case table', () => {
  // Given: one representative file per rule, including AI-config overlaps
  const cases = [
    ['src/A.cs', ['csharp']],
    ['tests/ATests.cs', ['csharp', 'tests']],
    ['src/BTest.cs', ['csharp', 'tests']],
    ['x/tests/C.cs', ['csharp', 'tests']],
    ['.github/workflows/ci.yml', ['ci']],
    ['scripts/x.sh', ['tooling']],
    ['m.mjs', ['tooling']],
    ['src/ui/foo.ts', ['code']],
    ['tools/t.js', ['tooling']],
    ['x/scripts/s.js', ['tooling']],
    ['tests/e.js', ['tooling']],
    ['docs/a.md', ['docs']],
    ['page.html', ['docs']],
    ['a.csproj', ['config']],
    ['Dockerfile.dev', ['config']],
    ['.gitignore', ['config']],
    ['other.txt', ['code']],
    ['.agents/x.md', ['ai-config']],
    ['sub/SKILL.md', ['ai-config']],
    ['AGENTS.md', ['ai-config']],
    ['.agents/h.js', ['ai-config', 'tooling']],
    ['.mcp.json', ['ai-config', 'config']],
    ['.agents/run.sh', ['ai-config', 'tooling']],
    ['.github/CODEOWNERS', ['ai-config']],
  ];
  // When/Then: kinds match, in insertion order
  for (const [file, expected] of cases) assert.deepEqual(kindsOfFile(file), expected, file);
});

test('natureOf unions kinds in first-seen order without duplicates', () => {
  assert.equal(natureOf('src/A.cs\ntests/ATests.cs\ndocs/a.md\nsrc/B.cs'), 'csharp tests docs');
  assert.equal(natureOf(''), '');
});

test('an unrecognized first token exits 2 and names the current branch', () => {
  // Given: on a feature branch
  const deps = fakeDeps({ git: GIT_BASE });
  // When: the input is not a target
  const r = resolveReviewTarget('foo bar', NO_ENV, deps);
  // Then: two stderr lines, code 2, nothing on stdout
  assert.equal(r.code, 2);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /^UNRECOGNIZED_TARGET: 'foo' is not a PR URL\/number/);
  assert.match(r.stderr, /currently checked-out branch 'feature\/PROJECT_ISSUE_PREFIX-1234-thing'\?/);
});

test('an unrecognized token on a detached HEAD says so', () => {
  const deps = fakeDeps({ git: { 'branch --show-current': ok('') } });
  assert.match(resolveReviewTarget('foo', NO_ENV, deps).stderr, /branch '<detached HEAD>'\?/);
});

test('no target on a detached HEAD fails', () => {
  // Given: git reports no current branch
  const deps = fakeDeps({ git: { 'branch --show-current': ok('') } });
  // When/Then: ERROR on stderr, code 1
  const r = resolveReviewTarget('', NO_ENV, deps);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, 'ERROR: No target given and HEAD is detached. Provide a branch name, a PR URL/number, or a ticket.\n');
});



test('an own PR prints every field, counts open threads and filters the diff', () => {
  // Given: PR 7 authored by the current user, a diff with an asset, a dirty tree
  const deps = fakeDeps({
    git: {
      ...GIT_BASE,
      [DIFF]: ok('src/A.cs\nassets/app.js\n.agents/x.md\n'),
      'status --porcelain': ok(' M a\n?? b\n'),
    },
    gh: GH_PR7,
    threads: '[{},{}]',
  });
  // When: resolving "7 review it"
  const r = resolveReviewTarget('7 review it', NO_ENV, deps);
  // Then: the full key=value block
  assert.equal(r.code, 0);
  assert.equal(r.stdout, [
    `PR_META_JSON=${META_JSON}`,
    'TARGET=7', 'EXTRA_INSTRUCTIONS=review it', 'OWNERSHIP=own', 'PR_AUTHOR=Me', 'OPEN_THREADS=2',
    'CURRENT_BRANCH=feature/PROJECT_ISSUE_PREFIX-1234-thing', 'ON_PR_BRANCH=1', 'TREE_DIRTY=2', 'NATURE=csharp ai-config',
    'BASE_BRANCH=develop', 'BRANCH=feature/PROJECT_ISSUE_PREFIX-1234-thing', 'DIFF_REF=FETCH_HEAD', 'PR_NUMBER=7',
    `TICKET_KEY=${firstTicket('PROJECT_ISSUE_PREFIX-1234')}`, 'CHANGED_FILES<<EOF', 'src/A.cs\n.agents/x.md', 'EOF', '',
  ].join('\n'));
  assert.ok(deps.calls.includes('threads Acme/widgets#7'));
});

test('base is fetched before the branch so FETCH_HEAD points at the branch', () => {
  // Given: a PR review
  const deps = fakeDeps({ git: GIT_BASE, gh: GH_PR7 });
  // When: resolving
  resolveReviewTarget('7', NO_ENV, deps);
  // Then: fetch order is base, then branch
  const fetches = deps.calls.filter((c) => c.startsWith('git fetch'));
  assert.deepEqual(fetches, ['git fetch origin develop', 'git fetch origin feature/PROJECT_ISSUE_PREFIX-1234-thing']);
});

test('a PR by someone else is other and skips the thread lookup', () => {
  // Given: author differs from the gh user
  const gh = { ...GH_PR7, 'pr view 7 --repo Acme/widgets --json author --jq .author.login': ok('Someone\n') };
  const deps = fakeDeps({ git: GIT_BASE, gh, threads: '[{}]' });
  // When: resolving
  const r = resolveReviewTarget('7', NO_ENV, deps);
  // Then: other ownership, empty OPEN_THREADS, no thread call
  assert.match(r.stdout, /OWNERSHIP=other\nPR_AUTHOR=Someone\nOPEN_THREADS=\n/);
  assert.equal(deps.calls.some((c) => c.startsWith('threads')), false);
});

test('without gh identity the last committer email decides ownership for a branch', () => {
  // Given: a branch target, gh unavailable, last commit by another email
  const deps = fakeDeps({
    git: { ...GIT_BASE, 'log -1 --format=%ae FETCH_HEAD': ok('other-example\n') },
  });
  // When: resolving by branch name
  const r = resolveReviewTarget('other/thing', NO_ENV, deps);
  // Then: other, with the default repo used for lookups
  assert.match(r.stdout, /OWNERSHIP=other\n/);
  assert.ok(deps.calls.includes('gh pr list --head other/thing --repo CompanyOrOrganizationName/product_name --json number --jq .[0].number'));
});

test('the current branch is reviewed from HEAD and counts as own', () => {
  // Given: "." with no gh data
  const deps = fakeDeps({ git: GIT_BASE });
  // When: resolving
  const r = resolveReviewTarget('.', NO_ENV, deps);
  // Then: HEAD is the diff ref, no branch fetch, own
  assert.match(r.stdout, /TARGET=<current branch>\n/);
  assert.match(r.stdout, /OWNERSHIP=own\n/);
  assert.match(r.stdout, /DIFF_REF=HEAD\n/);
  assert.deepEqual(deps.calls.filter((c) => c.startsWith('git fetch')), ['git fetch origin develop']);
});

test('reviewing the base branch is refused', () => {
  // Given: the current branch is develop
  const deps = fakeDeps({ git: { ...GIT_BASE, 'branch --show-current': ok('develop\n') } });
  // When/Then: error exit 1
  const r = resolveReviewTarget('.', NO_ENV, deps);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /^ERROR: 'develop' is the base branch: there is nothing to review against itself\./);
});

test('a failed branch fetch exits silently with the git status', () => {
  // Given: the remote branch does not exist
  const deps = fakeDeps({ git: { ...GIT_BASE, 'fetch origin nope/branch': failed(128) } });
  // When/Then: no stdout, status 128
  assert.deepEqual(resolveReviewTarget('nope/branch', NO_ENV, deps), { stdout: '', stderr: '', code: 128 });
});


test('the REPO env var skips the gh repo lookup', () => {
  const deps = fakeDeps({ git: GIT_BASE });
  resolveReviewTarget('other/thing', { ...NO_ENV, REPO: 'Foo/Bar' }, deps);
  assert.equal(deps.calls.some((c) => c.startsWith('gh repo view')), false);
  assert.ok(deps.calls.some((c) => c.includes('--repo Foo/Bar')));
});

test('a CRLF gh login still matches the author case-insensitively', () => {
  // Given: gh output ending in CRLF (jq on Windows) and differing case
  const gh = {
    ...GH_PR7,
    'api user --jq .login': ok('Me\r\n'),
    'pr view 7 --repo Acme/widgets --json author --jq .author.login': ok('me\r\n'),
  };
  // When: resolving
  const r = resolveReviewTarget('7', NO_ENV, fakeDeps({ git: GIT_BASE, gh }));
  // Then: own, and PR_AUTHOR carries no CR
  assert.match(r.stdout, /OWNERSHIP=own\nPR_AUTHOR=me\n/);
});
