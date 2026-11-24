import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import test from 'node:test';
import { findDocuments } from '../scripts/check-input.mjs';

const here = dirname(fileURLToPath(import.meta.url));

test('a folder is searched recursively for Word documents', () => {
  const found = findDocuments(join(here, 'fixtures'));

  assert.equal(found.length, 3);
  assert.ok(found.every((path) => path.endsWith('.docx')));
});

test('a path with no Word document returns nothing', () => {
  assert.deepEqual(findDocuments(join(here, 'fixtures', 'extraction.test.mjs')), []);
});

test('a missing path returns nothing', () => {
  assert.deepEqual(findDocuments(join(here, 'fixtures', 'does-not-exist.docx')), []);
});
