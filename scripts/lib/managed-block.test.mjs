/**
 * Unit tests for managed-block.mjs: validation, insertion, replacement, removal, line-ending
 * preservation, two coexisting block kinds and the required-heading guard. Every test is pure text
 * work and uses the Given/When/Then convention.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BEGIN_MARKER,
  END_MARKER,
  SHARED_KIND,
  STYLE_KIND,
  applyBlock,
  detectEol,
  locateBlock,
  markers,
  missingHeadings,
  removeBlock,
  validateBlockText,
} from './managed-block.mjs';

const BLOCK = `${BEGIN_MARKER}\n<!-- managed -->\n\n## Shared agent rules\n\nBody.\n\n${END_MARKER}\n`;
const STYLE_BLOCK = `${markers(STYLE_KIND).begin}\n<!-- managed -->\n\n## Output Style\n\nBody.\n\n${markers(STYLE_KIND).end}\n`;

test('validateBlockText_WellFormedBlock_ReturnsNoErrors', () => {
  // Given: a block with markers, a body and a trailing newline
  // When: the block is validated
  const errors = validateBlockText(BLOCK);

  // Then: nothing is reported
  assert.deepEqual(errors, []);
});

test('validateBlockText_MissingEndMarker_ReportsTheEndMarker', () => {
  // Given: a block whose end marker was dropped
  const broken = BLOCK.replace(END_MARKER, '');

  // When: the block is validated
  const errors = validateBlockText(broken);

  // Then: both the count and the closing line are reported
  assert.ok(errors.some((error) => error.includes('exactly one end marker')));
  assert.ok(errors.some((error) => error.includes(`must end with ${END_MARKER}`)));
});

test('validateBlockText_DuplicateBeginMarker_ReportsTheDuplicate', () => {
  // Given: a block that carries the begin marker twice
  const broken = `${BLOCK}\n${BEGIN_MARKER}\n${END_MARKER}\n`;

  // When: the block is validated
  const errors = validateBlockText(broken);

  // Then: the duplicate is refused
  assert.ok(errors.includes('block must contain exactly one begin marker'));
});

test('validateBlockText_EmptyBody_ReportsTheEmptyBody', () => {
  // Given: a block with markers but no content between them
  const broken = `${BEGIN_MARKER}\n\n${END_MARKER}\n`;

  // When: the block is validated
  const errors = validateBlockText(broken);

  // Then: the empty body is refused
  assert.ok(errors.includes('block body must not be empty'));
});

test('validateBlockText_ForeignManagedBlock_ReportsTheForeignBlock', () => {
  // Given: a block that embeds another kind of managed block
  const broken = `${BLOCK.replace(END_MARKER, '')}\n${markers(STYLE_KIND).begin}\n${END_MARKER}\n`;

  // When: the block is validated
  const errors = validateBlockText(broken);

  // Then: the foreign marker is refused
  assert.ok(errors.includes('block must not carry another managed block'));
});

test('validateBlockText_WrongKind_ReportsTheMismatch', () => {
  // Given: the style block, validated as if it were the shared block
  // When: the block is validated with the wrong kind
  const errors = validateBlockText(STYLE_BLOCK, SHARED_KIND);

  // Then: the markers do not match and the foreign kind is named
  assert.ok(errors.some((error) => error.startsWith('block must start with')));
  assert.ok(errors.includes('block must not carry another managed block'));
});

test('markers_StyleKind_ReturnsStyleMarkers', () => {
  // Given: the style block kind
  // When: its markers are built
  const result = markers(STYLE_KIND);

  // Then: both lines name that kind
  assert.equal(result.begin, '<!-- BEGIN managed: documentation-style -->');
  assert.equal(result.end, '<!-- END managed: documentation-style -->');
});

test('markers_EmptyKind_Throws', () => {
  // Given: an empty kind
  // When: its markers are built
  // Then: the call refuses instead of producing a marker that matches nothing
  assert.throws(() => markers(''), /block kind must be a non-empty string/);
});

test('applyBlock_EmptyTarget_AppendsTheBlock', () => {
  // Given: a target that does not exist yet
  // When: the block is applied
  const result = applyBlock('', BLOCK);

  // Then: the block is the whole file and the change is reported
  assert.equal(result.text, BLOCK);
  assert.equal(result.changed, true);
});

test('applyBlock_ContentWithoutBlock_AppendsAfterOneBlankLine', () => {
  // Given: a target that already carries machine notes
  const existing = '# AGENTS.md\n\n## Machine notes\n\n- Windows.\n';

  // When: the block is applied
  const result = applyBlock(existing, BLOCK);

  // Then: the notes are untouched and one blank line separates them from the block
  assert.equal(result.text, `${existing}\n${BLOCK}`);
});

test('applyBlock_ExistingBlock_ReplacesOnlyTheBlock', () => {
  // Given: a target whose block is stale, with content before and after it
  const before = '# AGENTS.md\n\n';
  const after = '\n## Machine notes\n\n- Windows.\n';
  const stale = `${before}${BEGIN_MARKER}\nold body\n${END_MARKER}\n${after}`;

  // When: the canonical block is applied
  const result = applyBlock(stale, BLOCK);

  // Then: the block is replaced and both neighbours survive
  assert.equal(result.text, `${before}${BLOCK}${after}`);
  assert.equal(result.changed, true);
});

test('applyBlock_IdenticalBlock_ReportsNoChange', () => {
  // Given: a target that already carries the canonical block
  const existing = `# AGENTS.md\n\n${BLOCK}`;

  // When: the same block is applied again
  const result = applyBlock(existing, BLOCK);

  // Then: the text is unchanged, so the installer can report "up to date"
  assert.equal(result.changed, false);
  assert.equal(result.text, existing);
});

test('applyBlock_StyleKind_AppendsAfterTheSharedBlock', () => {
  // Given: a target that already carries the shared block
  const existing = `# AGENTS.md\n\n${BLOCK}\n## Machine notes\n\n- Windows.\n`;

  // When: the style block is applied with its own kind
  const result = applyBlock(existing, STYLE_BLOCK, STYLE_KIND);

  // Then: the style block is appended and the shared block is untouched
  assert.ok(result.text.startsWith(`# AGENTS.md\n\n${BLOCK}`));
  assert.ok(result.text.endsWith(STYLE_BLOCK));
  assert.equal(result.text.split(STYLE_BLOCK).length - 1, 1);
});

test('applyBlock_SharedKindAfterStyle_LeavesTheStyleBlockAlone', () => {
  // Given: a target whose style block comes first and has no shared block
  const existing = `# AGENTS.md\n\n${STYLE_BLOCK}`;

  // When: the shared block is applied
  const result = applyBlock(existing, BLOCK);

  // Then: the shared block is appended and the style block is still exactly once
  assert.ok(result.text.startsWith(existing));
  assert.equal(result.text.split(STYLE_BLOCK).length - 1, 1);
  assert.equal(result.text.split(BEGIN_MARKER).length - 1, 1);
});

test('locateBlock_TwoKinds_FindsItsOwnBlock', () => {
  // Given: a target with the style block first and the shared block second
  const first = applyBlock('', STYLE_BLOCK, STYLE_KIND).text;
  const both = applyBlock(first, BLOCK).text;

  // When: each kind is located
  const style = locateBlock(both, STYLE_KIND);
  const shared = locateBlock(both, SHARED_KIND);

  // Then: the two offsets differ and both point at real markers
  assert.ok(style.start < shared.start);
  assert.equal(both.slice(style.start, style.start + markers(STYLE_KIND).begin.length), markers(STYLE_KIND).begin);
  assert.equal(both.slice(shared.start, shared.start + BEGIN_MARKER.length), BEGIN_MARKER);
});

test('applyBlock_CrlfTarget_KeepsCrlfAndStillComparesEqual', () => {
  // Given: a target saved with Windows line endings that already carries the block
  const existing = `# AGENTS.md\r\n\r\n${BLOCK.replace(/\n/g, '\r\n')}`;

  // When: the block is applied again
  const result = applyBlock(existing, BLOCK);

  // Then: the file keeps CRLF and reads as up to date
  assert.equal(result.changed, false);
  assert.ok(result.text.includes('\r\n'));
  assert.equal(detectEol(result.text), '\r\n');
});

test('applyBlock_MalformedBlock_ThrowsBeforeTouchingTheTarget', () => {
  // Given: a canonical block whose end marker is missing
  const broken = BLOCK.replace(END_MARKER, '');

  // When: it is applied to a target
  // Then: the call refuses instead of writing a broken block
  assert.throws(() => applyBlock('# AGENTS.md\n', broken), /refusing malformed block/);
});

test('locateBlock_MissingEndMarker_Throws', () => {
  // Given: a target whose block has a begin marker but no end marker
  const broken = `# AGENTS.md\n\n${BEGIN_MARKER}\nbody\n`;

  // When: the block is located
  // Then: the malformed target is reported instead of being overwritten
  assert.throws(() => locateBlock(broken), /END managed: shared-agent-notes/);
});

test('locateBlock_TargetWithoutBlock_ReturnsNull', () => {
  // Given: a target with no managed block
  // When: the block is located
  const found = locateBlock('# AGENTS.md\n\nnotes\n');

  // Then: nothing is found
  assert.equal(found, null);
});

test('removeBlock_TargetWithBlock_RemovesOnlyTheBlock', () => {
  // Given: a target with a block between two sections
  const existing = `# AGENTS.md\n\n${BLOCK}\n## Machine notes\n\n- Windows.\n`;

  // When: the block is removed
  const result = removeBlock(existing);

  // Then: the block is gone and the notes remain
  assert.equal(result.changed, true);
  assert.ok(!result.text.includes(BEGIN_MARKER));
  assert.ok(result.text.endsWith('## Machine notes\n\n- Windows.\n'));
});

test('removeBlock_BlockAtStart_LeavesNoLeadingBlankLine', () => {
  // Given: a target whose block is the first thing in the file
  const existing = `${BLOCK}\n## Machine notes\n\n- Windows.\n`;

  // When: the block is removed
  const result = removeBlock(existing);

  // Then: the notes start the file, with no blank line left behind
  assert.equal(result.text, '## Machine notes\n\n- Windows.\n');
});

test('removeBlock_BlockAtEnd_LeavesOneTrailingNewline', () => {
  // Given: a target whose block is the last thing in the file
  const existing = `# AGENTS.md\n\n## Machine notes\n\n- Windows.\n\n${BLOCK}`;

  // When: the block is removed
  const result = removeBlock(existing);

  // Then: the notes end the file with a single trailing newline
  assert.equal(result.text, '# AGENTS.md\n\n## Machine notes\n\n- Windows.\n');
});

test('removeBlock_StyleKind_LeavesTheSharedBlockAlone', () => {
  // Given: a target that carries both blocks
  const existing = applyBlock(applyBlock('', STYLE_BLOCK, STYLE_KIND).text, BLOCK).text;

  // When: only the style block is removed
  const result = removeBlock(existing, STYLE_KIND);

  // Then: the shared block survives in full
  assert.ok(result.text.includes(BLOCK.trimEnd()));
  assert.equal(result.text.split(STYLE_BLOCK).length - 1, 0);
});

test('removeBlock_TargetWithoutBlock_ReportsNoChange', () => {
  // Given: a target with no managed block
  const existing = '# AGENTS.md\n\nnotes\n';

  // When: the block is removed
  const result = removeBlock(existing);

  // Then: the file is untouched
  assert.equal(result.changed, false);
  assert.equal(result.text, existing);
});

test('missingHeadings_AllPresent_ReturnsEmpty', () => {
  // Given: text that carries every required heading
  const text = `${BLOCK}\n### Credentials: never read the credential file\n`;

  // When: the headings are checked
  const missing = missingHeadings(text, [
    '## Shared agent rules',
    '### Credentials: never read the credential file',
  ]);

  // Then: nothing is missing
  assert.deepEqual(missing, []);
});

test('missingHeadings_OneAbsent_ReturnsTheAbsentHeading', () => {
  // Given: text that lost one heading
  const text = '## Shared agent rules\n';

  // When: two headings are checked
  const missing = missingHeadings(text, [
    '## Shared agent rules',
    '### Commits: draft, approve, then push what was approved',
  ]);

  // Then: only the absent heading is named
  assert.deepEqual(missing, ['### Commits: draft, approve, then push what was approved']);
});

test('canonicalBlock_RepositoryFile_IsValidAndMachineNeutral', () => {
  // Given: the canonical block shipped in this repository
  const blockPath = path.join(import.meta.dirname, '..', '..', 'global', 'AGENTS.shared.md');
  const blockText = fs.readFileSync(blockPath, 'utf8');

  // When: it is validated and scanned for machine paths and placeholders
  const errors = validateBlockText(blockText);
  const machinePaths = blockText.match(/\b[A-Za-z]:\\|\/mnt\/|\/home\/\w/);

  // Then: it is one valid block with no drive letter, mount root or home path
  assert.deepEqual(errors, []);
  assert.equal(machinePaths, null);
});

test('canonicalBlock_RepositoryFile_CarriesTheCredentialGuardrail', () => {
  // Given: the canonical block shipped in this repository
  const blockPath = path.join(import.meta.dirname, '..', '..', 'global', 'AGENTS.shared.md');
  const blockText = fs.readFileSync(blockPath, 'utf8');

  // When: the guardrail headings are checked
  const missing = missingHeadings(blockText, [
    '### Credentials: never read the credential file',
    '### Your own notes are not the credential store',
  ]);

  // Then: both are present, because the style installer no longer appends them
  assert.deepEqual(missing, []);
});

test('styleBlock_RepositoryFile_IsValid', () => {
  // Given: the style block shipped in this repository
  const blockPath = path.join(import.meta.dirname, '..', '..', 'output-style', 'managed-block.md');
  const blockText = fs.readFileSync(blockPath, 'utf8');

  // When: it is validated as a style block
  const errors = validateBlockText(blockText, STYLE_KIND);

  // Then: it is one valid block with no foreign markers
  assert.deepEqual(errors, []);
});

test('applyBlock_Twice_IsIdempotent', () => {
  // Given: a target with machine notes and no block
  const existing = '# AGENTS.md\n\n## Machine notes\n\n- Windows.\n';

  // When: the block is applied twice
  const once = applyBlock(existing, BLOCK);
  const twice = applyBlock(once.text, BLOCK);

  // Then: the second run changes nothing and the block appears once
  assert.equal(twice.changed, false);
  assert.equal(twice.text.split(BEGIN_MARKER).length - 1, 1);
});
