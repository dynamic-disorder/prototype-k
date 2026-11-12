/**
 * Unit tests for install-block.mjs: the shared installer runner. Every test uses a temporary
 * directory, a captured output stream and the Given/When/Then convention, so the command line,
 * the exit codes and the writes are exercised without spawning a process.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SHARED_KIND, STYLE_KIND, markers } from './managed-block.mjs';
import { agentsFile, installBlock } from './install-block.mjs';

const SHARED_BLOCK = `${markers(SHARED_KIND).begin}\n<!-- managed -->\n\n## Shared agent rules\n\n### Credentials: never read the credential file\n\nBody.\n\n${markers(SHARED_KIND).end}\n`;
const STYLE_BLOCK = `${markers(STYLE_KIND).begin}\n<!-- managed -->\n\n## Output Style\n\nBody.\n\n${markers(STYLE_KIND).end}\n`;

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'install-block-'));
}

function writeFile(root, name, content) {
  const full = path.join(root, name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

function capture() {
  const parts = [];
  return { write: (chunk) => parts.push(chunk), text: () => parts.join('') };
}

function run(options) {
  const stdout = capture();
  const stderr = capture();
  const code = installBlock({ stdout, stderr, command: 'node test/install.mjs', ...options });
  return { code, stdout: stdout.text(), stderr: stderr.text() };
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test('installBlock_EmptyTarget_InstallsTheBlockAndReportsIt', () => {
  const root = tempDir();
  try {
    // Given: a canonical block and a target that does not exist
    const source = writeFile(root, 'block.md', SHARED_BLOCK);
    const target = path.join(root, 'home', 'AGENTS.md');

    // When: the installer runs
    const result = run({ label: 'installer', kind: SHARED_KIND, source, target });

    // Then: the file is created, carries the block, and the report says installed
    assert.equal(result.code, 0);
    assert.ok(fs.readFileSync(target, 'utf8').includes(SHARED_BLOCK));
    assert.match(result.stdout, /installed/);
    assert.equal(result.stderr, '');
  } finally {
    cleanup(root);
  }
});

test('installBlock_SecondRun_ReportsUpToDate', () => {
  const root = tempDir();
  try {
    // Given: a target the installer has already written
    const source = writeFile(root, 'block.md', SHARED_BLOCK);
    const target = path.join(root, 'AGENTS.md');
    run({ label: 'installer', kind: SHARED_KIND, source, target });

    // When: the installer runs again
    const result = run({ label: 'installer', kind: SHARED_KIND, source, target });

    // Then: nothing changes and the report says up to date
    assert.equal(result.code, 0);
    assert.match(result.stdout, /up to date/);
  } finally {
    cleanup(root);
  }
});

test('installBlock_CheckStale_ReturnsOne', () => {
  const root = tempDir();
  try {
    // Given: an installed target whose block was then edited
    const source = writeFile(root, 'block.md', SHARED_BLOCK);
    const target = path.join(root, 'AGENTS.md');
    run({ label: 'installer', kind: SHARED_KIND, source, target });
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace('Body.', 'Edited.'), 'utf8');

    // When: the installer checks
    const result = run({ label: 'installer', kind: SHARED_KIND, source, target, args: ['--check'] });

    // Then: it reports drift and exits 1 without writing
    assert.equal(result.code, 1);
    assert.match(result.stdout, /OUT OF DATE/);
    assert.ok(fs.readFileSync(target, 'utf8').includes('Edited.'));
  } finally {
    cleanup(root);
  }
});

test('installBlock_CheckFresh_ReturnsZero', () => {
  const root = tempDir();
  try {
    // Given: an installed target
    const source = writeFile(root, 'block.md', SHARED_BLOCK);
    const target = path.join(root, 'AGENTS.md');
    run({ label: 'installer', kind: SHARED_KIND, source, target });

    // When: the installer checks
    const result = run({ label: 'installer', kind: SHARED_KIND, source, target, args: ['--check'] });

    // Then: it reports no drift
    assert.equal(result.code, 0);
    assert.match(result.stdout, /up to date/);
  } finally {
    cleanup(root);
  }
});

test('installBlock_DryRun_WritesNothing', () => {
  const root = tempDir();
  try {
    // Given: a target that does not exist
    const source = writeFile(root, 'block.md', SHARED_BLOCK);
    const target = path.join(root, 'AGENTS.md');

    // When: the installer runs as a dry run
    const result = run({ label: 'installer', kind: SHARED_KIND, source, target, args: ['--dry-run'] });

    // Then: it reports the intended write and creates no file
    assert.equal(result.code, 0);
    assert.match(result.stdout, /would write the block/);
    assert.equal(fs.existsSync(target), false);
  } finally {
    cleanup(root);
  }
});

test('installBlock_Remove_KeepsEverythingOutsideTheBlock', () => {
  const root = tempDir();
  try {
    // Given: a target with a block and a machine note
    const source = writeFile(root, 'block.md', SHARED_BLOCK);
    const target = writeFile(root, 'AGENTS.md', `# AGENTS.md\n\n## Machine notes\n\n- Windows.\n\n${SHARED_BLOCK}`);

    // When: the installer removes its block
    const result = run({ label: 'installer', kind: SHARED_KIND, source, target, args: ['--remove'] });

    // Then: the block is gone and the note remains
    assert.equal(result.code, 0);
    const text = fs.readFileSync(target, 'utf8');
    assert.ok(!text.includes(markers(SHARED_KIND).begin));
    assert.match(text, /- Windows\./);
  } finally {
    cleanup(root);
  }
});

test('installBlock_MissingSource_ReturnsTwo', () => {
  const root = tempDir();
  try {
    // Given: no canonical block file
    // When: the installer runs
    const result = run({ label: 'installer', kind: SHARED_KIND, source: path.join(root, 'absent.md'), target: path.join(root, 'AGENTS.md') });

    // Then: it says what is missing and exits 2
    assert.equal(result.code, 2);
    assert.match(result.stderr, /cannot read the canonical block/);
  } finally {
    cleanup(root);
  }
});

test('installBlock_MalformedSource_ReturnsTwo', () => {
  const root = tempDir();
  try {
    // Given: a canonical block without its end marker
    const source = writeFile(root, 'block.md', SHARED_BLOCK.replace(markers(SHARED_KIND).end, ''));

    // When: the installer runs
    const result = run({ label: 'installer', kind: SHARED_KIND, source, target: path.join(root, 'AGENTS.md') });

    // Then: it refuses and writes nothing
    assert.equal(result.code, 2);
    assert.match(result.stderr, /refusing malformed block/);
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  } finally {
    cleanup(root);
  }
});

test('installBlock_MissingRequiredHeading_ReturnsTwo', () => {
  const root = tempDir();
  try {
    // Given: a block that lost the heading the target must carry
    const source = writeFile(root, 'block.md', SHARED_BLOCK.replace('### Credentials: never read the credential file', '### Something else'));

    // When: the installer runs with that heading required
    const result = run({
      label: 'installer',
      kind: SHARED_KIND,
      source,
      target: path.join(root, 'AGENTS.md'),
      requiredHeadings: ['### Credentials: never read the credential file'],
    });

    // Then: it refuses and names the heading
    assert.equal(result.code, 2);
    assert.match(result.stderr, /required guardrail heading/);
    assert.match(result.stderr, /### Credentials: never read the credential file/);
  } finally {
    cleanup(root);
  }
});

test('installBlock_UnknownOption_ReturnsTwo', () => {
  const root = tempDir();
  try {
    // Given: a valid block and target
    const source = writeFile(root, 'block.md', SHARED_BLOCK);

    // When: an unknown option is passed
    const result = run({ label: 'installer', kind: SHARED_KIND, source, target: path.join(root, 'AGENTS.md'), args: ['--force'] });

    // Then: the option is refused before any write
    assert.equal(result.code, 2);
    assert.match(result.stderr, /unknown option/);
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  } finally {
    cleanup(root);
  }
});

test('installBlock_ConflictingModes_ReturnsTwo', () => {
  const root = tempDir();
  try {
    // Given: a valid block
    const source = writeFile(root, 'block.md', SHARED_BLOCK);

    // When: two modes are requested at once
    const result = run({ label: 'installer', kind: SHARED_KIND, source, target: path.join(root, 'AGENTS.md'), args: ['--check', '--remove'] });

    // Then: the combination is refused
    assert.equal(result.code, 2);
    assert.match(result.stderr, /choose one of/);
  } finally {
    cleanup(root);
  }
});

test('installBlock_Help_ReturnsZeroAndWritesNothing', () => {
  const root = tempDir();
  try {
    // Given: a valid block and a target that does not exist
    const source = writeFile(root, 'block.md', SHARED_BLOCK);
    const target = path.join(root, 'AGENTS.md');

    // When: help is requested
    const result = run({ label: 'installer', kind: SHARED_KIND, source, target, args: ['--help'] });

    // Then: the usage is printed and nothing is written
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Usage: node test\/install\.mjs/);
    assert.equal(fs.existsSync(target), false);
  } finally {
    cleanup(root);
  }
});

test('installBlock_NoteFunc_AddsTheGuardrailLine', () => {
  const root = tempDir();
  try {
    // Given: a block without the credential guardrail
    const source = writeFile(root, 'block.md', STYLE_BLOCK);
    const target = path.join(root, 'AGENTS.md');

    // When: the installer runs with a note that reports the absent guardrail
    const result = run({
      label: 'installer',
      kind: STYLE_KIND,
      source,
      target,
      note: () => 'AGENTS.md has no credential guardrail — run: node global/install.mjs',
    });

    // Then: the note is printed and the write still succeeds
    assert.equal(result.code, 0);
    assert.match(result.stdout, /NOTE +.*credential guardrail/);
  } finally {
    cleanup(root);
  }
});

test('installBlock_NoteFunc_IsSkippedOnRemove', () => {
  const root = tempDir();
  try {
    // Given: an installed target
    const source = writeFile(root, 'block.md', STYLE_BLOCK);
    const target = path.join(root, 'AGENTS.md');
    run({ label: 'installer', kind: STYLE_KIND, source, target });

    // When: the block is removed with a note supplied
    const result = run({ label: 'installer', kind: STYLE_KIND, source, target, args: ['--remove'], note: () => 'NOTE-TEXT' });

    // Then: the removal is silent about the guardrail
    assert.equal(result.code, 0);
    assert.ok(!result.stdout.includes('NOTE-TEXT'));
  } finally {
    cleanup(root);
  }
});

test('installBlock_TwoKinds_CoexistInOneFile', () => {
  const root = tempDir();
  try {
    // Given: a shared block already installed
    const sharedSource = writeFile(root, 'shared.md', SHARED_BLOCK);
    const styleSource = writeFile(root, 'style.md', STYLE_BLOCK);
    const target = path.join(root, 'AGENTS.md');
    run({ label: 'shared', kind: SHARED_KIND, source: sharedSource, target });

    // When: the style block is installed into the same file
    const result = run({ label: 'style', kind: STYLE_KIND, source: styleSource, target });

    // Then: both blocks are present and each appears once
    assert.equal(result.code, 0);
    const text = fs.readFileSync(target, 'utf8');
    assert.equal(text.split(markers(SHARED_KIND).begin).length - 1, 1);
    assert.equal(text.split(markers(STYLE_KIND).begin).length - 1, 1);
  } finally {
    cleanup(root);
  }
});

test('agentsFile_EnvOverride_UsesTheGivenHome', () => {
  // Given: an env with a staging agents home
  const env = { DSH_AGENTS_HOME: path.join('staging', 'agents') };

  // When: the target path is computed
  const target = agentsFile(env);

  // Then: it points at that home's AGENTS.md
  assert.equal(target, path.join('staging', 'agents', 'AGENTS.md'));
});
