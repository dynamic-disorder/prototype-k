// Run: node --test ~/.agents/skills/git-code-review-resolve-feedbacks/*.test.mjs
// Expected values were recorded from the pre-refactor resolve-feedback.mjs (fake gh on PATH, no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parseRef, allPresent, invalidRefMessage, unknownCommandMessage,
  buildFetchQuery, buildFetchCommand, notFoundMessage, shapeThreads,
  buildCygpathCommand, buildReplyCommand, buildCommentCommand, buildResolveCommand,
  emptyBodyMessage, isBodyMismatch, replyMismatchMessage, commentMismatchMessage,
  replyResult, commentResult,
} from './resolve-feedback-lib.mjs';

const fixture = name => fs.readFileSync(fileURLToPath(new URL(`./test-fixtures/${name}`, import.meta.url)), 'utf8');
const json = name => JSON.parse(fixture(name));

// parseRef

test('parseRef: PR URL', () => {
  // Given: a full PR URL
  // When: parsed
  // Then: owner, repo and number are extracted (number stays a string)
  assert.deepEqual(parseRef('https://github.com/CompanyOrOrganizationName/product_name/pull/1234'), { owner: 'CompanyOrOrganizationName', repo: 'product_name', prNumber: '1234' });
});

test('parseRef: PR URL with a trailing path or fragment', () => {
  assert.deepEqual(parseRef('https://github.com/CompanyOrOrganizationName/product_name/pull/1234/files#diff'), { owner: 'CompanyOrOrganizationName', repo: 'product_name', prNumber: '1234' });
});

test('parseRef: owner/repo#number', () => {
  assert.deepEqual(parseRef('CompanyOrOrganizationName/product_name#1234'), { owner: 'CompanyOrOrganizationName', repo: 'product_name', prNumber: '1234' });
  assert.deepEqual(parseRef('o/r.x#7'), { owner: 'o', repo: 'r.x', prNumber: '7' });
});

test('parseRef: bare number defaults to CompanyOrOrganizationName/product_name', () => {
  assert.deepEqual(parseRef('22515'), { owner: 'CompanyOrOrganizationName', repo: 'product_name', prNumber: '22515' });
});

test('parseRef: invalid input returns null', () => {
  assert.equal(parseRef('abc'), null);
  assert.equal(parseRef('12ab'), null);
  assert.equal(parseRef(''), null);
  assert.equal(parseRef('CompanyOrOrganizationName/product_name'), null);
  assert.equal(parseRef('CompanyOrOrganizationName/product_name#'), null);
});

test('parseRef: URL regex is unanchored', () => {
  // current behavior (looks like a bug): "pull/12abc" parses as PR 12
  assert.deepEqual(parseRef('https://github.com/o/r/pull/12abc'), { owner: 'o', repo: 'r', prNumber: '12' });
  // current behavior (looks like a bug): a host that merely ends in github.com is accepted
  assert.deepEqual(parseRef('https://evilgithub.com/o/r/pull/1'), { owner: 'o', repo: 'r', prNumber: '1' });
  // current behavior (looks like a bug): repo may contain a slash in the short form
  assert.deepEqual(parseRef('a/b/c#1'), { owner: 'a', repo: 'b/c', prNumber: '1' });
});

// allPresent

test('allPresent: true only when every value is truthy', () => {
  assert.equal(allPresent(['a', 'b']), true);
  assert.equal(allPresent([]), true);
  assert.equal(allPresent(['a', undefined]), false);
  assert.equal(allPresent(['a', '']), false);
  assert.equal(allPresent(['a', null]), false);
});

test('allPresent: the string "0" counts as present', () => {
  assert.equal(allPresent(['0']), true);
});

// messages

test('invalidRefMessage: quotes the input', () => {
  assert.equal(invalidRefMessage('abc'), 'Invalid input: "abc". Provide a PR URL, owner/repo#number, or bare number.');
  assert.equal(invalidRefMessage(''), 'Invalid input: "". Provide a PR URL, owner/repo#number, or bare number.');
});

test('unknownCommandMessage: undefined command prints an empty name', () => {
  assert.equal(unknownCommandMessage(undefined), 'Unknown command: "". Use parse|fetch|reply|comment|resolve.');
  assert.equal(unknownCommandMessage('bogus'), 'Unknown command: "bogus". Use parse|fetch|reply|comment|resolve.');
});

test('notFoundMessage: names PR number and repository', () => {
  assert.equal(notFoundMessage('22515', 'CompanyOrOrganizationName', 'product_name'), 'PR #22515 not found in CompanyOrOrganizationName/product_name.');
});

test('emptyBodyMessage: names the file', () => {
  assert.equal(emptyBodyMessage('body.txt'), 'Body file "body.txt" is empty - nothing to post.');
});

// fetch query and command

test('buildFetchQuery: golden query recorded from the pre-refactor script', () => {
  // Given: owner, repo and PR number
  // When: the query is built
  // Then: identical to the query the old script passed to gh
  assert.equal(buildFetchQuery('CompanyOrOrganizationName', 'product_name', '22515'), fixture('fetch-query.expected.txt'));
});

test('buildFetchQuery: values are interpolated verbatim', () => {
  const q = buildFetchQuery('o', 'r', '5');
  assert.match(q, /repository\(owner: "o", name: "r"\)/);
  assert.match(q, /pullRequest\(number: 5\)/);
});

test('buildFetchQuery: quotes in owner are not escaped for GraphQL', () => {
  // current behavior (looks like a bug): owner `o"w` breaks out of the GraphQL string literal
  assert.match(buildFetchQuery('o"w', 'r', '5'), /owner: "o"w"/);
});

test('buildFetchCommand: wraps the query for bash single quotes', () => {
  const cmd = buildFetchCommand('CompanyOrOrganizationName', 'product_name', '22515');
  assert.equal(cmd, `gh api graphql -f query='${fixture('fetch-query.expected.txt')}'`);
});

test('buildFetchCommand: single quotes in values are escaped as quote-backslash-quote-quote', () => {
  const cmd = buildFetchCommand("o'w", 'r', '5');
  assert.ok(cmd.includes(`owner: "o'\\''w"`));
});

// shapeThreads

test('shapeThreads: golden - unresolved threads only, comments without databaseId dropped', () => {
  // Given: a recorded GraphQL response with a resolved thread, an empty thread, a null line, a null commit and a comment without databaseId
  // When: shaped
  // Then: equals the output of the pre-refactor fetch command
  assert.deepEqual(shapeThreads(json('fetch-response.json')), json('fetch-response.expected.json'));
});

test('shapeThreads: missing commit gives commitId null, missing line stays null', () => {
  const threads = shapeThreads(json('fetch-response.json'));
  assert.equal(threads[0].comments[1].commitId, null);
  assert.equal(threads[0].comments[1].line, null);
});

test('shapeThreads: all threads resolved gives an empty list', () => {
  const data = { data: { repository: { pullRequest: { reviewThreads: { nodes: [{ id: 'T', isResolved: true, comments: { nodes: [] } }] } } } } };
  assert.deepEqual(shapeThreads(data), []);
});

test('shapeThreads: no threads gives an empty list', () => {
  const data = { data: { repository: { pullRequest: { reviewThreads: { nodes: [] } } } } };
  assert.deepEqual(shapeThreads(data), []);
});

test('shapeThreads: missing pull request, repository, data or null input gives null', () => {
  assert.equal(shapeThreads(json('fetch-nopr.json')), null);
  assert.equal(shapeThreads({ data: { repository: null } }), null);
  assert.equal(shapeThreads({}), null);
  assert.equal(shapeThreads(null), null);
});

test('shapeThreads: a PR without reviewThreads throws instead of returning null', () => {
  // current behavior (looks like a bug): TypeError on pr.reviewThreads.nodes
  assert.throws(() => shapeThreads({ data: { repository: { pullRequest: {} } } }), TypeError);
});

test('shapeThreads: databaseId 0 is kept (only null/undefined are dropped)', () => {
  const data = { data: { repository: { pullRequest: { reviewThreads: { nodes: [{ id: 'T', isResolved: false, comments: { nodes: [{ databaseId: 0, body: 'b', path: 'p', line: 1, commit: { oid: 'o' } }] } }] } } } } };
  assert.equal(shapeThreads(data)[0].comments.length, 1);
});

// gh command strings

test('buildCygpathCommand: converts with a bash fallback to the original path', () => {
  assert.equal(buildCygpathCommand('body.txt'), 'cygpath -m "body.txt" 2>/dev/null || echo "body.txt"');
});

test('buildReplyCommand: golden gh invocation recorded from the pre-refactor script', () => {
  // Given: reply arguments and the node-readable body path
  // When: the command is built
  // Then: matches the arguments the old script passed to gh (body read via -F body=@file)
  const cmd = buildReplyCommand({ owner: 'CompanyOrOrganizationName', repo: 'product_name', prNumber: '1', commentId: '101', path: 'src/a.cs', line: '12', commitId: 'abc123', bodyPathNode: 'C:/t/body.txt' });
  assert.equal(cmd, 'gh api "repos/CompanyOrOrganizationName/product_name/pulls/1/comments" -X POST -F body=@"C:/t/body.txt" -f commit_id="abc123" -f path="src/a.cs" -F line=12 -f side=RIGHT -F in_reply_to=101');
});

test('buildReplyCommand: never uses the raw -f body= form', () => {
  const cmd = buildReplyCommand({ owner: 'o', repo: 'r', prNumber: '1', commentId: '2', path: 'p', line: '3', commitId: 'c', bodyPathNode: 'f' });
  assert.ok(!/-f body=/.test(cmd));
  assert.ok(cmd.includes('-F body=@"f"'));
});

test('buildReplyCommand: path is interpolated into a bash string without escaping', () => {
  // current behavior (looks like a bug): `$(...)` or a double quote in path reaches bash unescaped
  const cmd = buildReplyCommand({ owner: 'o', repo: 'r', prNumber: '1', commentId: '2', path: 'a"b$(x)', line: '3', commitId: 'c', bodyPathNode: 'f' });
  assert.ok(cmd.includes('-f path="a"b$(x)"'));
});

test('buildCommentCommand: golden gh invocation for a top-level PR comment', () => {
  assert.equal(
    buildCommentCommand({ owner: 'CompanyOrOrganizationName', repo: 'product_name', prNumber: '1', bodyPathNode: 'C:/t/body.txt' }),
    'gh api "repos/CompanyOrOrganizationName/product_name/issues/1/comments" -X POST -F body=@"C:/t/body.txt"',
  );
});

test('buildResolveCommand: golden GraphQL mutation', () => {
  assert.equal(
    buildResolveCommand('PRRT_a'),
    `gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "PRRT_a"}) { thread { id isResolved } } }'`,
  );
});

test('buildResolveCommand: quotes in the thread id are not escaped', () => {
  // current behavior (looks like a bug): `x"y` ends the GraphQL string early
  assert.ok(buildResolveCommand('x"y').includes('threadId: "x"y"'));
});

// reply verification

test('isBodyMismatch: identical text is a match', () => {
  assert.equal(isBodyMismatch({ body: 'Done.' }, 'Done.'), false);
});

test('isBodyMismatch: surrounding whitespace and trailing newline are ignored', () => {
  assert.equal(isBodyMismatch({ body: 'Done.' }, 'Done.\n'), false);
  assert.equal(isBodyMismatch({ body: '  Done.\n' }, 'Done.'), false);
});

test('isBodyMismatch: the literal @path string (the gh -f body=@file footgun) is a mismatch', () => {
  assert.equal(isBodyMismatch({ body: '@body.txt' }, 'Done.'), true);
});

test('isBodyMismatch: missing or empty posted body is a mismatch', () => {
  assert.equal(isBodyMismatch({}, 'Done.'), true);
  assert.equal(isBodyMismatch({ body: '' }, 'Done.'), true);
  assert.equal(isBodyMismatch({ body: null }, 'Done.'), true);
});

test('isBodyMismatch: inner whitespace differences are a mismatch', () => {
  assert.equal(isBodyMismatch({ body: 'a  b' }, 'a b'), true);
});

test('isBodyMismatch: a null response (gh printed "null") throws', () => {
  // current behavior (looks like a bug): TypeError instead of a clear failure message
  assert.throws(() => isBodyMismatch(null, 'x'), TypeError);
});

test('replyMismatchMessage: golden text with the literal-path body', () => {
  assert.equal(
    replyMismatchMessage({ id: 556, body: '@baseline/body.txt' }, 'CompanyOrOrganizationName', 'product_name'),
    'Posted comment 556 body does not match the intended reply text - got: "@baseline/body.txt". Fix the mismatched comment (gh api --method PATCH repos/CompanyOrOrganizationName/product_name/pulls/comments/556 -f body="$(cat file)") and rerun.',
  );
});

test('replyMismatchMessage: missing body prints an empty string, long body is cut to 120 characters', () => {
  assert.match(replyMismatchMessage({ id: 1 }, 'o', 'r'), /got: ""\./);
  const msg = replyMismatchMessage({ id: 1, body: 'x'.repeat(200) }, 'o', 'r');
  assert.ok(msg.includes(`got: "${'x'.repeat(120)}".`));
});

test('replyMismatchMessage: a missing id prints "?" first and "undefined" in the PATCH hint', () => {
  // current behavior (looks like a bug): the fix hint contains pulls/comments/undefined
  const msg = replyMismatchMessage({ body: 'x' }, 'o', 'r');
  assert.ok(msg.startsWith('Posted comment ? body'));
  assert.ok(msg.includes('pulls/comments/undefined'));
});

test('replyMismatchMessage: the PATCH hint uses -f body="$(cat file)"', () => {
  // current behavior (looks like a bug): the raw-field form the script's own comments warn against
  assert.ok(replyMismatchMessage({ id: 1, body: 'x' }, 'o', 'r').includes('-f body="$(cat file)"'));
});

test('commentMismatchMessage: golden text', () => {
  assert.equal(
    commentMismatchMessage({ id: 557 }, 'CompanyOrOrganizationName', 'product_name'),
    'Posted comment 557 body does not match the intended text - got: "". Fix the mismatched comment (gh api --method PATCH repos/CompanyOrOrganizationName/product_name/issues/comments/557 -F body=@"<bodyFile>") and rerun.',
  );
});

test('commentMismatchMessage: missing id prints "?" and "undefined"', () => {
  const msg = commentMismatchMessage({ body: 'x' }, 'o', 'r');
  assert.ok(msg.startsWith('Posted comment ? body'));
  assert.ok(msg.includes('issues/comments/undefined'));
});

// results

test('replyResult: ok with the new comment id', () => {
  assert.deepEqual(replyResult({ id: 555, body: 'x' }), { ok: true, commentId: 555 });
  assert.equal(JSON.stringify(replyResult({ id: 555 })), '{"ok":true,"commentId":555}');
});

test('commentResult: ok with id and html_url as url', () => {
  assert.deepEqual(commentResult({ id: 555, html_url: 'https://github.com/o/r/pull/1#issuecomment-555' }), { ok: true, commentId: 555, url: 'https://github.com/o/r/pull/1#issuecomment-555' });
});

test('commentResult: a missing html_url is dropped from the JSON', () => {
  assert.equal(JSON.stringify(commentResult({ id: 1 })), '{"ok":true,"commentId":1}');
});
