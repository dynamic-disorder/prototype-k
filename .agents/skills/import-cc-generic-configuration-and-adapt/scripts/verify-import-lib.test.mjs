/**
 * Unit tests for verify-import-lib.mjs: target and source verification, the CLI result, the report
 * formatter and the skill listing. Every test uses a temporary directory and the Given/When/Then
 * convention.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatReport, listSkills, runVerification, verifySource, verifyTarget } from './verify-import-lib.mjs';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'verify-import-'));
}

function writeFile(root, relative, content) {
  const full = path.join(root, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function writeSkill(root, name, extra = '') {
  writeFile(
    root,
    `.agents/skills/${name}/SKILL.md`,
    `---\nname: ${name}\ndescription: Covers ${name}.\n---\n\n# ${name}\n${extra}`,
  );
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test('verifyTarget_CleanSkill_ReportsNoIssues', () => {
  const root = tempDir();
  try {
    // Given: a target with one valid skill
    writeSkill(root, 'demo-skill');

    // When: the target is verified
    const result = verifyTarget(root);

    // Then: no issues are reported and the skill is counted
    assert.deepEqual(result.issues, []);
    assert.equal(result.skills, 1);
  } finally {
    cleanup(root);
  }
});

test('verifyTarget_ProductPlaceholder_ReportsThePlaceholder', () => {
  const root = tempDir();
  try {
    // Given: a file that still contains the product placeholder
    writeFile(root, 'notes.md', 'Use <PRODUCT_NAME> here.');

    // When: the target is verified
    const result = verifyTarget(root);

    // Then: the placeholder is named as the issue
    assert.ok(result.issues.some((issue) => issue.endsWith('placeholder:PRODUCT_NAME')));
  } finally {
    cleanup(root);
  }
});

test('verifyTarget_NSubstitute_ReportsTheOldSubstitute', () => {
  const root = tempDir();
  try {
    // Given: a test file that still uses NSubstitute
    writeFile(root, 'Example.Tests/ExampleTests.cs', 'using NSubstitute;\n');

    // When: the target is verified
    const result = verifyTarget(root);

    // Then: the old substitute is named
    assert.ok(result.issues.some((issue) => issue.endsWith('substitute:NSubstitute')));
  } finally {
    cleanup(root);
  }
});

test('verifyTarget_TempUserFiles_ReportsTheOldPath', () => {
  const root = tempDir();
  try {
    // Given: a skill that still writes to temp_user_files
    writeFile(root, 'notes.md', 'Save it in temp_user_files/.');

    // When: the target is verified
    const result = verifyTarget(root);

    // Then: the old path is named
    assert.ok(result.issues.some((issue) => issue.endsWith('path:temp_user_files')));
  } finally {
    cleanup(root);
  }
});

test('verifyTarget_ClaudePathInScript_ReportsThePath', () => {
  const root = tempDir();
  try {
    // Given: a neutral script that still points at ~/.claude
    writeFile(root, 'scripts/tool.sh', '#!/usr/bin/env bash\nsource ~/.claude/lib.sh\n');

    // When: the target is verified
    const result = verifyTarget(root);

    // Then: the Claude path is named
    assert.ok(result.issues.some((issue) => issue.endsWith('path:claude')));
  } finally {
    cleanup(root);
  }
});

test('verifyTarget_ClaudeShim_IsSkipped', () => {
  const root = tempDir();
  try {
    // Given: a Claude shim that legitimately uses its own paths
    writeFile(root, 'claude/hooks/post-edit.sh', 'source ~/.claude/lib.sh\n');

    // When: the target is verified
    const result = verifyTarget(root);

    // Then: the shim is not scanned and no issue is raised
    assert.deepEqual(result.issues, []);
  } finally {
    cleanup(root);
  }
});

test('verifyTarget_InvalidFrontmatter_ReportsEveryProblem', () => {
  const root = tempDir();
  try {
    // Given: a skill whose name is invalid, mismatched and lacks a description
    writeFile(root, '.agents/skills/wrong-name/SKILL.md', '---\nname: Bad_Name\n---\n\n# wrong\n');

    // When: the target is verified
    const result = verifyTarget(root);

    // Then: format, mismatch and description are all reported
    assert.ok(result.issues.some((issue) => issue.endsWith('frontmatter:name-format')));
    assert.ok(result.issues.some((issue) => issue.endsWith('frontmatter:name-mismatch')));
    assert.ok(result.issues.some((issue) => issue.endsWith('frontmatter:description')));
  } finally {
    cleanup(root);
  }
});

test('verifyTarget_Secret_ReportsTheRuleWithoutEchoingTheValue', () => {
  const root = tempDir();
  const secret = 'AKIA1234567890ABCDEF';
  try {
    // Given: a file that contains an AWS access key
    writeFile(root, 'notes.txt', `key = ${secret}\n`);

    // When: the target is verified
    const result = verifyTarget(root);

    // Then: the secret rule is named and the value never appears in the report
    const report = result.issues.join('\n');
    assert.ok(report.includes('secret:aws-access-key'));
    assert.equal(report.includes(secret), false);
  } finally {
    cleanup(root);
  }
});

test('verifyTarget_ClaudePathInProse_IsNotReported', () => {
  const root = tempDir();
  try {
    // Given: a README that explains the Claude pointer
    writeFile(root, 'README.md', 'Claude Code reads `~/.claude/CLAUDE.md`.\n');

    // When: the target is verified
    const result = verifyTarget(root);

    // Then: prose is not treated as a runtime path
    assert.deepEqual(result.issues, []);
  } finally {
    cleanup(root);
  }
});

test('verifySource_RefusedFilesAndNestedExport_AreReportedOnce', () => {
  const source = tempDir();
  try {
    // Given: a source with two refused files and a nested copy of the export
    writeFile(source, 'claude_placeholder_values.txt', 'PRODUCT_NAME = example\n');
    writeFile(source, 'lib/env-db.sh', '#!/usr/bin/env bash\n');
    writeFile(source, '.claude-generic-nested/hooks/check.sh', '#!/usr/bin/env bash\n');

    // When: the source is verified
    const result = verifySource(source);

    // Then: both refusals are reported, the nested copy is noted and not scanned
    assert.equal(result.issues.length, 2);
    assert.ok(result.issues.some((issue) => issue.includes('claude_placeholder_values.txt')));
    assert.ok(result.issues.some((issue) => issue.includes('env-db.sh')));
    assert.equal(result.notes.length, 1);
    assert.ok(result.notes[0].includes('nested export skipped'));
  } finally {
    cleanup(source);
  }
});

test('verifySource_SecretInPlainFile_IsReportedWithoutEchoingIt', () => {
  const source = tempDir();
  const secret = 'AKIA1234567890ABCDEF';
  try {
    // Given: a non-refused source file that contains a secret
    writeFile(source, 'notes.md', `key = ${secret}\n`);

    // When: the source is verified
    const result = verifySource(source);

    // Then: the secret rule is named and the value is not echoed
    const report = result.issues.join('\n');
    assert.ok(report.includes('secret:aws-access-key'));
    assert.equal(report.includes(secret), false);
  } finally {
    cleanup(source);
  }
});

test('listSkills_ReturnsSortedSkillNames', () => {
  const root = tempDir();
  try {
    // Given: two skills created out of order
    writeSkill(root, 'zebra');
    writeSkill(root, 'alpha');

    // When: the skills are listed
    const names = listSkills(root);

    // Then: both names come back sorted
    assert.deepEqual(names, ['alpha', 'zebra']);
  } finally {
    cleanup(root);
  }
});

test('runVerification_CleanTarget_ExitsZero', () => {
  const root = tempDir();
  try {
    // Given: a clean target and the target argument
    writeSkill(root, 'demo-skill');

    // When: the CLI logic runs
    const result = runVerification(['--target', root]);

    // Then: it exits zero with no issues
    assert.equal(result.exitCode, 0);
    assert.deepEqual(result.issues, []);
  } finally {
    cleanup(root);
  }
});

test('runVerification_MissingTarget_ExitsTwo', () => {
  const root = tempDir();
  try {
    // Given: a target path that does not exist
    const missing = path.join(root, 'missing');

    // When: the CLI logic runs
    const result = runVerification(['--target', missing]);

    // Then: it reports the missing target and exits two
    assert.equal(result.exitCode, 2);
    assert.ok(result.error.includes('target not found'));
  } finally {
    cleanup(root);
  }
});

test('runVerification_SourceRefusals_ExitsOne', () => {
  const target = tempDir();
  const source = tempDir();
  try {
    // Given: a clean target and a source with one refused file
    writeSkill(target, 'demo-skill');
    writeFile(source, 'claude_placeholder_values.txt', 'PRODUCT_NAME = example\n');

    // When: the CLI logic runs
    const result = runVerification(['--source', source, '--target', target]);

    // Then: it exits one with the refusal
    assert.equal(result.exitCode, 1);
    assert.ok(result.issues.some((issue) => issue.includes('claude_placeholder_values.txt')));
  } finally {
    cleanup(target);
    cleanup(source);
  }
});

test('runVerification_List_ReturnsSkillNames', () => {
  const root = tempDir();
  try {
    // Given: a target with two skills
    writeSkill(root, 'zebra');
    writeSkill(root, 'alpha');

    // When: the CLI logic runs with --list
    const result = runVerification(['--target', root, '--list']);

    // Then: the names are returned sorted
    assert.deepEqual(result.list, ['alpha', 'zebra']);
  } finally {
    cleanup(root);
  }
});

test('formatReport_NoIssues_PrintsZero', () => {
  // Given: a result with no issues
  const result = {
    target: 'repo',
    source: null,
    files: 3,
    skills: 1,
    notes: [],
    issues: [],
    list: [],
  };

  // When: the report is formatted
  const lines = formatReport(result);

  // Then: it ends with the zero-issue line
  assert.equal(lines.at(-1), '0 issues');
});

test('formatReport_Issues_PrintsCountAndBullets', () => {
  // Given: a result with one issue
  const result = {
    target: 'repo',
    source: null,
    files: 3,
    skills: 1,
    notes: ['a note'],
    issues: ['file.md: rule'],
    list: [],
  };

  // When: the report is formatted
  const lines = formatReport(result);

  // Then: the count and the issue are both present
  assert.ok(lines.includes('issues: 1'));
  assert.ok(lines.includes('- file.md: rule'));
  assert.ok(lines.includes('note: a note'));
});

