import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSkill, checkText, parseFrontmatter, referencesIn, skillsIn } from './check-skills-lib.mjs';

// Patterns are assembled from parts so this file does not carry the strings it looks for.
const placeholderProduct = `<${'PRODUCT_NAME'}>`;
const placeholderCompany = `<${'COMPANY_OR_ORGANIZATION_NAME'}>`;
const substitute = ['NSub', 'stitute'].join('');
const tempPath = ['temp', 'user_files'].join('_');
const argumentsToken = `$${'ARGUMENTS'}`;
const claudePath = ['~', '.claude'].join('/');
const profilePath = ['C:', 'Users', 'someone', 'notes'].join('\\');
const ticketWording = ['ticket', 'prefix'].join('-');

const validSkill = [
  '---',
  'name: sample-skill',
  'description: Does one thing when the reader asks for it.',
  '---',
  '',
  '# sample-skill',
  '',
  'Body.',
].join('\n');

test('parseFrontmatter_ValidBlock_ReturnsNameAndDescription', () => {
  const frontmatter = parseFrontmatter(validSkill);
  assert.equal(frontmatter.name, 'sample-skill');
  assert.equal(frontmatter.description, 'Does one thing when the reader asks for it.');
});

test('parseFrontmatter_MissingBlock_ReturnsNull', () => {
  assert.equal(parseFrontmatter('# no frontmatter'), null);
});

test('checkSkill_ValidText_HasNoHardFindings', () => {
  const findings = checkSkill({ folder: 'sample-skill', text: validSkill });
  assert.deepEqual(findings.filter((finding) => finding.kind === 'hard'), []);
});

test('checkSkill_NameMismatch_IsHard', () => {
  const findings = checkSkill({ folder: 'other-folder', text: validSkill });
  assert.ok(findings.some((finding) => finding.rule === 'frontmatter:name-mismatch'));
});

test('checkSkill_MissingName_IsHard', () => {
  const findings = checkSkill({ folder: 'sample-skill', text: '---\ndescription: x\n---\n# sample-skill\n' });
  assert.ok(findings.some((finding) => finding.rule === 'frontmatter:name-missing'));
});

test('checkSkill_ClaudeOnlyKey_IsHard', () => {
  const text = validSkill.replace('name: sample-skill', 'name: sample-skill\nmodel: sonnet');
  const findings = checkSkill({ folder: 'sample-skill', text });
  assert.ok(findings.some((finding) => finding.rule === 'frontmatter:claude-key:model'));
});

test('checkSkill_LongDescription_IsSoft', () => {
  const text = validSkill.replace('Does one thing when the reader asks for it.', 'x'.repeat(1025));
  const findings = checkSkill({ folder: 'sample-skill', text });
  assert.ok(findings.some((finding) => finding.kind === 'soft' && finding.rule === 'description:over-1024'));
});

test('checkSkill_HeadingDiffersFromName_IsSoft', () => {
  const text = validSkill.replace('# sample-skill', '# something else');
  const findings = checkSkill({ folder: 'sample-skill', text });
  assert.ok(findings.some((finding) => finding.rule === 'heading:not-the-name'));
});

test('checkText_EachLeftover_IsHard', () => {
  const texts = [placeholderProduct, placeholderCompany, substitute, tempPath, argumentsToken, claudePath, ticketWording];
  for (const text of texts) {
    const findings = checkText({ path: 'skill/SKILL.md', text: `a ${text} b`, extension: '.md' });
    assert.ok(findings.length > 0, `no finding for ${text}`);
  }
});

test('checkText_ProfilePath_IsHardMachineIdentifier', () => {
  const findings = checkText({ path: 'notes.md', text: `see ${profilePath}`, extension: '.md' });
  assert.ok(findings.some((finding) => finding.rule.startsWith('machine-identifier:')));
});

test('checkText_CapsDocumentName_IsSoft', () => {
  const findings = checkText({ path: 'skill/TEMPLATES.md', text: 'plain', extension: '.md' });
  assert.deepEqual(findings.map((finding) => finding.rule), ['name:not-snake-case']);
});

test('checkText_SnakeCaseAndFixedNames_AreClean', () => {
  for (const path of ['skill/README.md', 'skill/SKILL.md', 'skill/references/git_flow.md']) {
    assert.deepEqual(checkText({ path, text: 'plain', extension: '.md' }), []);
  }
});

test('referencesIn_LinkAndCodeSpan_AreFoundOnce', () => {
  const text = 'See [x](references/a.md) and `references/b.md`, again `references/a.md#top`.';
  assert.deepEqual(referencesIn(text), ['references/a.md', 'references/b.md']);
});

test('skillsIn_NamedAndBare_AreCollected', () => {
  const text = 'Run `Skill(git-pr-fetch)` then `Skill(csharp-code-review, .)`.';
  assert.deepEqual(skillsIn(text), ['csharp-code-review', 'git-pr-fetch']);
});
