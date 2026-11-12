// Run: node --test ~/.agents/skills/git-pr-description-write/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { prNumberFrom, ghPrViewCommand, extractTicketKey, isMechanicalTitle, summarizeCommits, relevantFiles, metricHints, buildContext, getPRContext } from './extract-pr-context-lib.mjs';

const pr = (over = {}) => ({
  number: 7, title: 'PROJECT_ISSUE_PREFIX-1234 Add thing', state: 'OPEN', baseRefName: 'develop', headRefName: 'feature/PROJECT_ISSUE_PREFIX-1234-thing', body: 'old',
  commits: [{ messageHeadline: 'Add x', messageBody: ' body \n' }], files: [{ path: 'src/A.cs' }], ...over,
});

test('prNumberFrom: strips URLs down to the number and leaves other refs alone', () => {
  // When/Then: loop over every accepted reference form
  const cases = [
    ['https://github.com/CompanyOrOrganizationName/product_name/pull/1234', '1234'],
    ['https://github.com/CompanyOrOrganizationName/product_name/pull/1234/files?x=1', '1234'],
    ['https://github.com/CompanyOrOrganizationName/product_name/pull/1234#issuecomment-1', '1234'],
    ['25223', '25223'],
    ['feature/PROJECT_ISSUE_PREFIX-1234-x', 'feature/PROJECT_ISSUE_PREFIX-1234-x'],
  ];
  for (const [ref, expected] of cases) assert.equal(prNumberFrom(ref), expected, ref);
});

test('ghPrViewCommand: targets the CompanyOrOrganizationName/product_name repo', () => {
  // When/Then
  assert.match(ghPrViewCommand('5'), /^gh pr view 5 --json .*--repo CompanyOrOrganizationName\/product_name$/);
});


test('isMechanicalTitle: cherry-pick, backport, revert, bump, or merge plus conflict', () => {
  // When/Then: loop over titles with the expected classification
  const cases = [
    ['Cherry-Pick of PROJECT_ISSUE_PREFIX-1234', true], ['Backport fix', true], ['Revert "x"', true], ['Bump lib', true],
    ['Merge develop, resolve conflict', true], ['Merge develop', false], ['Fix conflict in parser', false], ['Add thing', false],
  ];
  for (const [title, expected] of cases) assert.equal(isMechanicalTitle(title), expected, title);
});

test('summarizeCommits: defaults missing fields and trims the body', () => {
  // When/Then
  assert.deepEqual(summarizeCommits([{ messageHeadline: 'h', messageBody: ' b \n' }, {}]), [{ message: 'h', body: 'b' }, { message: '', body: '' }]);
});

test('relevantFiles: drops generated js/css/map files and PseudoLanguageGenerator', () => {
  // When/Then
  const files = ['a.cs', 'b.JS', 'c.css', 'd.js.map', 'x/PseudoLanguageGenerator/e.cs', 'f.json'].map((path) => ({ path }));
  assert.deepEqual(relevantFiles(files), ['a.cs', 'f.json']);
});

test('metricHints: each rule fires on its own keyword', () => {
  // When/Then: loop over commit text and the hints it must produce
  const msg = (message) => [{ message, body: '' }];
  const cases = [
    ['plain words', []],
    ['fix bug', ['one or more fixes']],
    ['add feature', ['feature addition']],
    ['refactor module', ['refactoring']],
    ['cut latency 50ms', ['commit messages contain quantifiable hints']],
  ];
  for (const [text, expected] of cases) assert.deepEqual(metricHints(msg(text)), expected, text);
});

test('buildContext: open PR gets the full context with latest 5 commits and first 20 files', () => {
  // Given
  const commits = Array.from({ length: 8 }, (_, i) => ({ messageHeadline: `c${i}` }));
  const files = Array.from({ length: 25 }, (_, i) => ({ path: `f${i}.cs` }));
  // When
  const ctx = buildContext(pr({ commits, files }), '7');
  // Then
  assert.equal(ctx.commitCount, 8);
  assert.deepEqual(ctx.commits.map((c) => c.message), ['c3', 'c4', 'c5', 'c6', 'c7']);
  assert.equal(ctx.changedFileCount, 25);
  assert.equal(ctx.changedFiles.length, 20);
  assert.equal(ctx.isLargeChange, true);
  assert.equal(ctx.prType, 'full-template');
  assert.equal(ctx.currentDescription, 'old');
});

test('buildContext: mechanical title selects the lean summary', () => {
  // When
  const ctx = buildContext(pr({ title: 'Backport PROJECT_ISSUE_PREFIX-1234' }), '7');
  // Then
  assert.equal(ctx.prType, 'lean-summary');
  assert.equal(ctx.classificationHints.isMechanical, true);
});

test('buildContext: merged and closed PRs return an error object', () => {
  // When/Then
  assert.deepEqual(buildContext(pr({ state: 'MERGED' }), '7'), { error: 'PR #7 is already merged', state: 'MERGED', number: 7 });
  assert.equal(buildContext(pr({ state: 'CLOSED' }), '7').error, 'PR #7 is already closed');
});

test('getPRContext: without a reference it asks git for the current branch, with one it does not', () => {
  // Given
  const calls = [];
  const bash = (cmd) => { calls.push(cmd); return cmd.startsWith('git') ? 'feature/PROJECT_ISSUE_PREFIX-1234' : JSON.stringify(pr()); };
  // When
  getPRContext('', { bash });
  getPRContext('https://github.com/CompanyOrOrganizationName/product_name/pull/42', { bash });
  // Then
  assert.deepEqual(calls.map((c) => c.split(' ').slice(0, 4).join(' ')), ['git branch --show-current', 'gh pr view feature/PROJECT_ISSUE_PREFIX-1234', 'gh pr view 42']);
});

test('getPRContext: a failing gh call returns an error object instead of throwing', () => {
  // When
  const ctx = getPRContext('9', { bash: () => { throw new Error('boom'); } });
  // Then
  assert.deepEqual(ctx, { error: 'Failed to fetch PR context: boom', prRef: '9' });
});
