import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { extractDocx } from '../lib/docx-extract.mjs';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const read = (name) => readFileSync(join(fixtures, name));
const extract = (name, id = name.replace(/\.docx$/, '')) => extractDocx(read(name), id);

test('headings and tables become Markdown blocks with section markers', () => {
  const { markdown, stats } = extract('headings-tables.docx');

  assert.match(markdown, /^<!-- section: 1 -->/);
  assert.match(markdown, /## Build steps/);
  assert.match(markdown, /# Reference guide/);
  assert.match(markdown, /\| Name \| Value \|/);
  assert.match(markdown, /\| servo \| XL430 \|/);
  assert.equal(stats.headings, 2);
  assert.equal(stats.tables, 1);
  assert.equal(stats.lists, 3);
  assert.equal(stats.sections, 3);
});

test('a heading opens a new section in document order', () => {
  const { markdown, stats } = extract('headings-tables.docx');
  const positions = [...markdown.matchAll(/<!-- section: (\d+) -->/g)].map((match) => Number(match[1]));

  assert.deepEqual(positions, Array.from({ length: stats.sections }, (_, index) => index + 1));
});

test('an embedded image is extracted and referenced from the Markdown', () => {
  const { markdown, stats, images } = extractDocx(read('images.docx'), 'figure');

  assert.equal(stats.images, 1);
  assert.equal(images.length, 1);
  assert.match(images[0].name, /^image-1\.(png|jpg|jpeg|gif|emf|wmf)$/);
  assert.ok(images[0].bytes.length > 0);
  assert.match(markdown, /!\[image-1\.[a-z]+\]\(figure\.assets\/image-1\.[a-z]+\)/);
});

test('a page break is counted and both sides of it survive', () => {
  const { markdown, stats } = extract('breaks-runs.docx');

  assert.equal(stats.pageBreaks, 1);
  assert.match(markdown, /before the break/);
  assert.match(markdown, /after the break/);
});

test('a document with no Word body is refused', () => {
  assert.throws(() => extractDocx(Buffer.from('not a zip'), 'broken'), /zip:/);
});
