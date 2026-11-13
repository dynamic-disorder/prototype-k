/**
 * Unit tests for export-plan.mjs: the home-to-bundle mapping, the exclusions, the refusal list, the
 * AGENTS.md composition, the leak patterns, the manifest text and the command line. Every test is
 * pure work on paths and strings, and follows the Given/When/Then convention.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MANIFEST_NAME,
  REFUSED_PATHS,
  SCANNER_BUNDLE_PATH,
  STATIC_ENTRIES,
  bundleDirName,
  bundlePathFor,
  composeAgentsMd,
  expectedFiles,
  findLeaks,
  isExcluded,
  isRefused,
  manifestText,
  parseArgs,
  toPosix,
} from './export-plan.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(here, '..', '..');

test('bundlePathFor_AgentSkill_MapsIntoSkills', () => {
  // Given: a skill file inside the home's agent directory
  // When: it is mapped
  const bundle = bundlePathFor('.agents/skills/git-commit/SKILL.md');

  // Then: it keeps its skill folder under the bundle's own skills root
  assert.equal(bundle, 'skills/git-commit/SKILL.md');
});

test('bundlePathFor_HooksAndGithooks_MapByDirectory', () => {
  // Given: one file from each hook directory
  // When: both are mapped
  const hooks = bundlePathFor('.agents/hooks/pre-commit-build-check.sh');
  const githooks = bundlePathFor('.githooks/pre-push');

  // Then: each keeps its directory name at the bundle root
  assert.equal(hooks, 'hooks/pre-commit-build-check.sh');
  assert.equal(githooks, 'githooks/pre-push');
});

test('bundlePathFor_SharedLibrary_MapsIntoLib', () => {
  // Given: a shared library under the scripts directory
  // When: it is mapped
  const bundle = bundlePathFor('scripts/lib/managed-block.mjs');

  // Then: it moves to the bundle's lib root
  assert.equal(bundle, 'lib/managed-block.mjs');
});

test('bundlePathFor_LibraryTest_ReturnsNull', () => {
  // Given: a unit test for a shared library
  // When: it is mapped
  const bundle = bundlePathFor('scripts/lib/export-plan.test.mjs');

  // Then: the bundle carries no tests for its own libraries
  assert.equal(bundle, null);
});

test('bundlePathFor_ExporterAndInstaller_ReturnNull', () => {
  // Given: the exporter, its planner, the link installer, the skill checker and the rehearsal
  // When: each is mapped
  const mapped = [
    'scripts/export-agents.mjs',
    'scripts/lib/export-plan.mjs',
    'scripts/install-global.mjs',
    'scripts/check-skills.mjs',
    'scripts/lib/check-skills-lib.mjs',
    'scripts/rehearse-linux-install.sh',
  ].map(bundlePathFor);

  // Then: none enters the bundle
  assert.deepEqual(mapped, [null, null, null, null, null, null]);
});

test('bundlePathFor_ProjectFile_ReturnsNull', () => {
  // Given: files that belong to the checkout rather than the configuration
  // When: each is mapped
  const mapped = ['CsvTranslations/Program.cs', 'docs/README.md', 'local_dev/README.md', 'README.md'].map(
    bundlePathFor,
  );

  // Then: none enters the bundle
  assert.deepEqual(mapped, [null, null, null, null]);
});

test('bundlePathFor_WindowsSeparator_Normalises', () => {
  // Given: a path written with a backslash, as Windows reports it
  // When: it is mapped
  const bundle = bundlePathFor('.agents\\skills\\spike\\SKILL.md');

  // Then: the bundle path uses forward slashes
  assert.equal(bundle, 'skills/spike/SKILL.md');
});

test('isExcluded_BuildAndScratchDirectories_ReturnTrue', () => {
  // Given: a dependency tree, a build folder and the generated export
  // When: each is tested
  const excluded = [
    'skills/deck-card-video-generate/node_modules/react/index.js',
    'skills/x/bin/Debug/x.dll',
    'dist/.agents-generic-2026-11-13_00-00/AGENTS.md',
    'local_user_files/notes.md',
    'skills/x/test-results/run.json',
  ].map(isExcluded);

  // Then: all are excluded
  assert.deepEqual(excluded, [true, true, true, true, true]);
});

test('isExcluded_OrdinarySkillFile_ReturnsFalse', () => {
  // Given: a skill file that belongs in the bundle
  // When: it is tested
  const excluded = isExcluded('.agents/skills/spike/SKILL.md');

  // Then: it is kept
  assert.equal(excluded, false);
});

test('isExcluded_SkillNamedLikeABuildFolder_ReturnsFalse', () => {
  // Given: the skill whose folder name matches the checkout's publish output folder
  // When: it is tested
  const excluded = isExcluded('.agents/skills/publish/SKILL.md');

  // Then: it is kept — a folder name alone must not exclude a skill
  assert.equal(excluded, false);
});

test('isExcluded_SecretBearingFiles_ReturnTrue', () => {
  // Given: a key, a certificate and a credential file
  // When: each is tested
  const excluded = ['id_rsa.key', 'certs/site.pem', '.credentials.yaml', '.env'].map((file) =>
    isExcluded(`skills/x/${file}`),
  );

  // Then: all are excluded
  assert.deepEqual(excluded, [true, true, true, true]);
});

test('isRefused_EveryPlanRefusal_ReturnsTrue', () => {
  // Given: the refusal list the umbrella plan states
  // When: each path is tested
  const refused = REFUSED_PATHS.map(isRefused);

  // Then: every one is refused
  assert.deepEqual(refused, REFUSED_PATHS.map(() => true));
});

test('isRefused_PlaceholderMapInAnyDirectory_ReturnsTrue', () => {
  // Given: the placeholder map placed outside its usual folder
  // When: it is tested by bundle path
  const refused = isRefused('reference/nested/claude_placeholder_values.txt');

  // Then: the basename alone refuses it
  assert.equal(refused, true);
});

test('isRefused_OrdinaryFile_ReturnsFalse', () => {
  // Given: an ordinary bundled file
  // When: it is tested
  const refused = isRefused('skills/spike/SKILL.md');

  // Then: it is allowed
  assert.equal(refused, false);
});

test('composeAgentsMd_SharedAndStyle_OneFileWithOneBlankLine', () => {
  // Given: the shared rules and the style block, each ending with a newline
  // When: the bundle's AGENTS.md is composed
  const composed = composeAgentsMd('# Shared\n\nRule.\n', '# Style\n\nRule.\n');

  // Then: the shared block comes first, one blank line separates them, one newline closes the file
  assert.equal(composed, '# Shared\n\nRule.\n\n# Style\n\nRule.\n');
});

test('findLeaks_ProfilePath_ReportsTheLineAndRule', () => {
  // Given: text whose third line carries a Windows profile path
  const text = 'first\nsecond\nC:\\Users\\someone\\code\n';

  // When: the text is scanned
  const findings = findLeaks(text);

  // Then: the third line is reported under the profile rule, and the match is not returned
  assert.deepEqual(findings, [{ line: 3, rule: 'windows-profile' }]);
});

test('findLeaks_ProfileVariable_Passes', () => {
  // Given: the approved ways to write a home path
  const text = '%USERPROFILE%\\code\n~/code\n$REPO_ROOT/code\n';

  // When: the text is scanned
  const findings = findLeaks(text);

  // Then: nothing is reported
  assert.deepEqual(findings, []);
});

test('findLeaks_MountedVolume_ReportsTheVolumeForm', () => {
  // Given: a mounted volume whose component carries a digit, assembled from parts so this file does
  // not itself carry the form the gate refuses
  const text = `the tree lives under ${['', 'mnt', 't7', 'checkout'].join('/')}\n`;

  // When: the text is scanned
  const findings = findLeaks(text);

  // Then: the mounted-volume rule reports it
  assert.deepEqual(findings, [{ line: 1, rule: 'mounted-volume' }]);
});

test('findLeaks_PlainMountComponent_IsDeliberatelyAllowed', () => {
  // Given: a plain lowercase mount component, the shape of an illustration rather than a real mount
  const text = `an example: ${['', 'mnt', 'data', 'input.csv'].join('/')}\n`;

  // When: the text is scanned
  const findings = findLeaks(text);

  // Then: nothing is reported, matching the scanner's stated tolerance
  assert.deepEqual(findings, []);
});

test('findLeaks_ScannerPatternLine_ReportsItself', () => {
  // Given: the scanner's own pattern line, read from the file rather than copied into this one
  const scanner = fs
    .readFileSync(path.join(repository, 'scripts', 'scan-publication-leaks.sh'), 'utf8')
    .split(/\r?\n/);
  const start = scanner.findIndex((line) => line.includes('FAIL_PATTERN <<'));
  const patternLine = scanner[start + 1] ?? '';

  // When: it is scanned
  const findings = findLeaks(patternLine);

  // Then: it matches its own mount form, which is why the one file that carries the patterns is
  // exempt by path rather than by content
  assert.equal(findings.length > 0, true);
  assert.equal(findings[0].rule, 'mounted-volume');
});

test('scannerBundlePath_MatchesTheRealScannerFile', () => {
  // Given: the export's exemption path and the scanner the bundle carries
  const homePath = 'scripts/scan-publication-leaks.sh';

  // When: the home path is mapped and the file is resolved
  const mapped = bundlePathFor(homePath);
  const exists = fs.existsSync(path.join(repository, homePath));

  // Then: the exemption names the bundle path of a file that exists
  assert.equal(mapped, SCANNER_BUNDLE_PATH);
  assert.equal(exists, true);
});

test('manifestText_UnsortedInput_IsSortedAndClosed', () => {
  // Given: hashes supplied out of order
  // When: the manifest text is rendered
  const text = manifestText({ 'b.md': '2', 'a.md': '1' });

  // Then: the keys are sorted and the file ends with one newline
  assert.equal(text, '{\n  "files": {\n    "a.md": "1",\n    "b.md": "2"\n  }\n}\n');
});

test('manifestText_RoundTrip_KeepsEveryHash', () => {
  // Given: one entry
  // When: the manifest is rendered and parsed again
  const parsed = JSON.parse(manifestText({ 'skills/x/SKILL.md': 'abc' }));

  // Then: the hash survives the round trip
  assert.deepEqual(parsed, { files: { 'skills/x/SKILL.md': 'abc' } });
});

test('bundleDirName_KnownMoment_FormatsDateAndTime', () => {
  // Given: a fixed moment
  const moment = new Date(2026, 10, 13, 9, 5);

  // When: the bundle name is built
  const name = bundleDirName(moment);

  // Then: the date and time are zero padded and separated as the reference export does
  assert.equal(name, '.agents-generic-2026-11-13_09-05');
});

test('parseArgs_NoArguments_PlansAWrite', () => {
  // Given: no arguments
  // When: the command line is parsed
  const options = parseArgs([]);

  // Then: the default is a write with a generated directory
  assert.deepEqual(options, { mode: 'write', out: null, archive: false, help: false });
});

test('parseArgs_AllFlags_AreRead', () => {
  // Given: every supported flag
  // When: the command line is parsed
  const options = parseArgs(['--out', 'dist/tmp', '--check', '--archive']);

  // Then: each is recorded
  assert.deepEqual(options, { mode: 'check', out: 'dist/tmp', archive: true, help: false });
});

test('parseArgs_UnknownArgument_Throws', () => {
  // Given: an argument the exporter does not support
  // When: the command line is parsed
  // Then: the parse refuses it rather than ignoring it
  assert.throws(() => parseArgs(['--force']), /unknown argument: --force/);
});

test('expectedFiles_Entries_AddTheManifestAndSort', () => {
  // Given: two planned entries
  // When: the expected file list is built
  const files = expectedFiles([{ bundle: 'skills/z/SKILL.md' }, { bundle: 'AGENTS.md' }]);

  // Then: the manifest is expected too, and the list is sorted
  assert.deepEqual(files, ['AGENTS.md', MANIFEST_NAME, 'skills/z/SKILL.md']);
});

test('toPosix_BackslashPath_UsesForwardSlashes', () => {
  // Given: a Windows-style path
  // When: it is normalised
  // Then: it uses forward slashes without a leading dot-slash
  assert.equal(toPosix('.\\skills\\x'), 'skills/x');
});

test('staticEntries_EverySourceExistsInTheRepository', () => {
  // Given: the composed and copied entries the plan declares
  const sources = STATIC_ENTRIES.flatMap((entry) => entry.sources ?? [entry.source]);

  // When: each source is resolved in the checkout
  const missing = sources.filter((source) => !fs.existsSync(path.join(repository, source)));

  // Then: none is missing, so every declared file has a real origin
  assert.deepEqual(missing, []);
});
