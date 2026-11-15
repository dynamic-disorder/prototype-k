import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dirsToPrune,
  isOwnedPath,
  normalizeBundlePath,
  parseState,
  planBundle,
  skillFolderFor,
  stateText,
} from './install-bundle.mjs';

test('normalizeBundlePath_forwardSlashPath_ReturnsIt', () => {
  assert.equal(normalizeBundlePath('skills/a/SKILL.md'), 'skills/a/SKILL.md');
});

test('normalizeBundlePath_backslashesAndDotSlash_AreNormalised', () => {
  assert.equal(normalizeBundlePath('.\\skills\\a\\SKILL.md'), 'skills/a/SKILL.md');
});

test('normalizeBundlePath_escapingPath_ReturnsNull', () => {
  for (const value of ['../outside', 'skills/../../etc/passwd', '/etc/passwd', 'C:/x', 'skills//x', '']) {
    assert.equal(normalizeBundlePath(value), null, value);
  }
});

test('normalizeBundlePath_nonString_ReturnsNull', () => {
  assert.equal(normalizeBundlePath(42), null);
  assert.equal(normalizeBundlePath(null), null);
});

test('isOwnedPath_ownedAndDocumentationPaths_AreDistinguished', () => {
  for (const owned of ['skills/a/SKILL.md', 'hooks/x.sh', 'scripts/x.mjs', 'lib/y.mjs', 'githooks/pre-commit']) {
    assert.equal(isOwnedPath(owned), true, owned);
  }
  for (const notOwned of ['AGENTS.md', 'README.md', 'INSTALL.md', 'install.mjs', 'settings.json', 'blocks/a.md', 'project-seed/AGENTS.md']) {
    assert.equal(isOwnedPath(notOwned), false, notOwned);
  }
});

test('skillFolderFor_skillEntry_ReturnsFolder', () => {
  assert.equal(skillFolderFor('skills/git-commit/SKILL.md'), 'git-commit');
  assert.equal(skillFolderFor('skills/git-commit/scripts/x.mjs'), null);
});

test('planBundle_newBundle_AddsEveryOwnedFile', () => {
  const files = {
    'AGENTS.md': 'h0',
    'skills/a/SKILL.md': 'h1',
    'githooks/pre-commit': 'h2',
  };
  const plan = planBundle({ files, exists: () => false, hash: () => '' });
  assert.deepEqual(plan.add, ['githooks/pre-commit', 'skills/a/SKILL.md']);
  assert.deepEqual(plan.change, []);
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.unchanged, []);
  assert.deepEqual(plan.conflicts, []);
});

test('planBundle_matchingHash_IsUnchanged', () => {
  const files = { 'githooks/pre-commit': 'h2' };
  const plan = planBundle({ files, exists: () => true, hash: () => 'h2' });
  assert.deepEqual(plan.unchanged, ['githooks/pre-commit']);
  assert.deepEqual(plan.change, []);
});

test('planBundle_differentHash_IsAChange', () => {
  const files = { 'hooks/x.sh': 'new' };
  const plan = planBundle({ files, exists: () => true, hash: () => 'old' });
  assert.deepEqual(plan.change, ['hooks/x.sh']);
});

test('planBundle_skillNameMismatch_IsAConflict', () => {
  const files = { 'skills/a/SKILL.md': 'new' };
  const plan = planBundle({
    files,
    exists: () => true,
    hash: () => 'old',
    targetSkillName: () => 'someone-else',
  });
  assert.deepEqual(plan.conflicts, ['skills/a/SKILL.md']);
  assert.deepEqual(plan.change, []);
});

test('planBundle_skillNameMissing_IsAConflict', () => {
  const files = { 'skills/a/SKILL.md': 'new' };
  const plan = planBundle({ files, exists: () => true, hash: () => 'old', targetSkillName: () => null });
  assert.deepEqual(plan.conflicts, ['skills/a/SKILL.md']);
});

test('planBundle_ownedFileGoneFromManifest_IsRemoved', () => {
  const plan = planBundle({
    files: { 'skills/a/SKILL.md': 'h1' },
    previous: { 'skills/old/SKILL.md': 'h0', 'AGENTS.md': 'h9' },
    exists: () => true,
    hash: () => 'h1',
  });
  assert.deepEqual(plan.remove, ['skills/old/SKILL.md']);
});

test('planBundle_previousFileAlreadyGone_IsNotRemoved', () => {
  const plan = planBundle({
    files: {},
    previous: { 'skills/old/SKILL.md': 'h0' },
    exists: () => false,
    hash: () => '',
  });
  assert.deepEqual(plan.remove, []);
});

test('parseState_validState_ReturnsOwnedFiles', () => {
  const text = JSON.stringify({ version: 1, files: { 'skills/a/SKILL.md': 'h1', 'AGENTS.md': 'h0' } });
  assert.deepEqual(parseState(text), { 'skills/a/SKILL.md': 'h1' });
});

test('parseState_malformedOrForeign_ReturnsNullOrEmpty', () => {
  assert.equal(parseState('not json'), null);
  assert.equal(parseState('{}'), null);
  assert.deepEqual(parseState(JSON.stringify({ files: { 'AGENTS.md': 'h0' } })), {});
});

test('stateText_sortsKeysAndSkipsForeignPaths', () => {
  const text = stateText({ 'skills/b/SKILL.md': 'h2', 'skills/a/SKILL.md': 'h1', 'README.md': 'h0' });
  assert.equal(
    text,
    `${JSON.stringify({ version: 1, files: { 'skills/a/SKILL.md': 'h1', 'skills/b/SKILL.md': 'h2' } }, null, 2)}\n`,
  );
});

test('dirsToPrune_returnsDeepestFirstAndNeverTheRoot', () => {
  assert.deepEqual(dirsToPrune(['skills/a/refs/x.md', 'skills/a/SKILL.md', 'githooks/pre-commit']), [
    'skills/a/refs',
    'skills/a',
  ]);
});
