import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { verifyBundleDir } from './verify-bundle.mjs';

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

function write(dir, rel, text) {
  const absolute = path.join(dir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, text);
}

function makeBundle(t, override = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-bundle-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const files = {
    'AGENTS.md': '# AGENTS\n',
    'install.mjs': '// installer\n',
    'INSTALL.md': '# install\n',
    'githooks/pre-commit': '#!/usr/bin/env bash\n',
    'skills/alpha/SKILL.md': '---\nname: alpha\ndescription: One test skill.\n---\n\n# alpha\n',
    ...override,
  };
  const hashes = {};
  for (const [rel, text] of Object.entries(files)) {
    if (text === null) continue;
    write(dir, rel, text);
    hashes[rel] = sha256(Buffer.from(text));
    if (rel === 'githooks/pre-commit') fs.chmodSync(path.join(dir, ...rel.split('/')), 0o755);
  }
  fs.writeFileSync(path.join(dir, 'MANIFEST.json'), JSON.stringify({ files: hashes }, null, 2));
  return dir;
}

test('verifyBundleDir_cleanBundle_ReturnsNoFindings', (t) => {
  const { findings, files } = verifyBundleDir(makeBundle(t));
  assert.deepEqual(findings, []);
  assert.equal(files, 5);
});

test('verifyBundleDir_changedFile_ReportsHashMismatch', (t) => {
  const dir = makeBundle(t);
  fs.appendFileSync(path.join(dir, 'AGENTS.md'), 'tampered\n');
  const { findings } = verifyBundleDir(dir);
  assert.ok(findings.some((finding) => finding.detail.includes('hash mismatch: AGENTS.md')));
});

test('verifyBundleDir_missingFile_ReportsIt', (t) => {
  const dir = makeBundle(t);
  fs.rmSync(path.join(dir, 'install.mjs'));
  const { findings } = verifyBundleDir(dir);
  assert.ok(findings.some((finding) => finding.detail.includes('missing: install.mjs')));
  assert.ok(findings.some((finding) => finding.detail.includes('required file absent: install.mjs')));
});

test('verifyBundleDir_extraFile_IsAWarning', (t) => {
  const dir = makeBundle(t);
  write(dir, 'notes.txt', 'not in the manifest\n');
  const { findings } = verifyBundleDir(dir);
  const extra = findings.find((finding) => finding.detail.includes('not in the manifest'));
  assert.equal(extra.kind, 'warn');
});

test('verifyBundleDir_skillNameMismatch_IsAnError', (t) => {
  const dir = makeBundle(t, {
    'skills/alpha/SKILL.md': '---\nname: beta\ndescription: One test skill.\n---\n\n# alpha\n',
  });
  const { findings } = verifyBundleDir(dir);
  assert.ok(findings.some((finding) => finding.detail.includes('does not match folder alpha')));
});

test('verifyBundleDir_noManifest_ReturnsUnusable', (t) => {
  const dir = makeBundle(t);
  fs.rmSync(path.join(dir, 'MANIFEST.json'));
  const { manifest, findings } = verifyBundleDir(dir);
  assert.equal(manifest, false);
  assert.equal(findings[0].detail, 'no usable MANIFEST.json');
});
