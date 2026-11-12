/**
 * Unit tests for verify-import-rules.mjs: the pure rule functions, with no filesystem access.
 * Every test uses the Given/When/Then convention.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkSkillText,
  checkTextRules,
  isRefusedName,
  isSecret,
} from './verify-import-rules.mjs';

test('isSecret_AwsAccessKey_ReturnsTheRule', () => {
  // Given: text that contains an AWS access key
  const text = 'key = AKIA1234567890ABCDEF';

  // When: the secret rule is checked
  const rule = isSecret(text);

  // Then: the AWS rule is returned
  assert.equal(rule, 'aws-access-key');
});

test('isSecret_PlainText_ReturnsNull', () => {
  // Given: text without a secret pattern
  const text = 'nothing secret here';

  // When: the secret rule is checked
  const rule = isSecret(text);

  // Then: no rule is returned
  assert.equal(rule, null);
});

test('isRefusedName_SecretScanAllowlist_ReturnsTrue', () => {
  // Given: the repo-local allowlist filename
  const name = 'git_commit_secret_scan_allowlist.txt';

  // When: the refusal list is checked
  const refused = isRefusedName(name);

  // Then: it is refused
  assert.equal(refused, true);
});

test('isRefusedName_OrdinarySkill_ReturnsFalse', () => {
  // Given: an ordinary skill filename
  const name = 'SKILL.md';

  // When: the refusal list is checked
  const refused = isRefusedName(name);

  // Then: it is not refused
  assert.equal(refused, false);
});

test('checkSkillText_ValidFrontmatter_ReturnsNoRules', () => {
  // Given: a skill whose name and description are valid
  const text = '---\nname: demo-skill\ndescription: Covers the demo.\n---\n\n# demo\n';

  // When: the skill text is checked
  const rules = checkSkillText('demo-skill', text);

  // Then: no rule is returned
  assert.deepEqual(rules, []);
});

test('checkSkillText_MissingFrontmatter_ReturnsMissingRule', () => {
  // Given: a skill file without frontmatter
  const text = '# demo\n';

  // When: the skill text is checked
  const rules = checkSkillText('demo', text);

  // Then: the missing frontmatter is named
  assert.deepEqual(rules, ['frontmatter:missing']);
});

test('checkSkillText_InvalidNameAndMismatch_ReturnsBothRules', () => {
  // Given: a skill with an invalid name, the wrong folder and no description
  const text = '---\nname: Bad_Name\n---\n\n# demo\n';

  // When: the skill text is checked
  const rules = checkSkillText('wrong-name', text);

  // Then: format, mismatch and description are all named
  assert.deepEqual(rules, [
    'frontmatter:description',
    'frontmatter:name-format',
    'frontmatter:name-mismatch',
  ]);
});

test('checkTextRules_ProductPlaceholder_ReturnsThePlaceholderRule', () => {
  // Given: text with the product placeholder
  const text = 'Use <PRODUCT_NAME> here.';

  // When: the text rules are checked
  const rules = checkTextRules('notes.md', text);

  // Then: the placeholder rule is returned
  assert.deepEqual(rules, ['placeholder:PRODUCT_NAME']);
});

test('checkTextRules_NSubstitute_ReturnsTheSubstituteRule', () => {
  // Given: a test file that still uses NSubstitute
  const text = 'using NSubstitute;\n';

  // When: the text rules are checked
  const rules = checkTextRules('ExampleTests.cs', text);

  // Then: the old substitute is named
  assert.deepEqual(rules, ['substitute:NSubstitute']);
});

test('checkTextRules_TempUserFiles_ReturnsTheOldPathRule', () => {
  // Given: text that still points at temp_user_files
  const text = 'Save it in temp_user_files/.';

  // When: the text rules are checked
  const rules = checkTextRules('notes.md', text);

  // Then: the old path is named
  assert.deepEqual(rules, ['path:temp_user_files']);
});

test('checkTextRules_TicketPrefix_ReturnsTheCommitRule', () => {
  // Given: text that still describes a ticket-prefix commit format
  const text = 'Prefix every subject with the ticket key.';

  // When: the text rules are checked
  const rules = checkTextRules('notes.md', text);

  // Then: the commit rule is named
  assert.deepEqual(rules, ['commit:ticket-prefix']);
});

test('checkTextRules_ClaudePathInScript_ReturnsThePathRule', () => {
  // Given: a shell script that still points at ~/.claude
  const text = 'source ~/.claude/lib.sh\n';

  // When: the text rules are checked
  const rules = checkTextRules('scripts/tool.sh', text);

  // Then: the Claude path is named
  assert.deepEqual(rules, ['path:claude']);
});

test('checkTextRules_ClaudePathInProse_ReturnsNoRule', () => {
  // Given: a README that explains the Claude pointer
  const text = 'Claude Code reads `~/.claude/CLAUDE.md`.\n';

  // When: the text rules are checked
  const rules = checkTextRules('README.md', text);

  // Then: prose is not treated as a runtime path
  assert.deepEqual(rules, []);
});

test('checkTextRules_ClaudePathInShim_ReturnsNoRule', () => {
  // Given: a script under the Claude shim
  const text = 'source ~/.claude/lib.sh\n';

  // When: the text rules are checked as a shim
  const rules = checkTextRules('claude/hooks/post-edit.sh', text, { isShim: true });

  // Then: the shim is allowed to use its own path
  assert.deepEqual(rules, []);
});

test('checkTextRules_Secret_ReturnsTheSecretRule', () => {
  // Given: text with an AWS access key
  const text = 'key = AKIA1234567890ABCDEF';

  // When: the text rules are checked
  const rules = checkTextRules('notes.txt', text);

  // Then: the secret rule is returned
  assert.deepEqual(rules, ['secret:aws-access-key']);
});
