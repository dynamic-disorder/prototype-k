// Run: node --test ~/.agents/skills/output-markdown-to-html/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { convertMarkdown, convertInlineMarkdown, wrapCodeLine, buildNestedList, getHtmlTemplate, MAX_LINE_WIDTH } from './convert-markdown-lib.mjs';

const fixture = name => fs.readFileSync(fileURLToPath(new URL(`./test-fixtures/${name}`, import.meta.url)), 'utf8');

test('golden: sample.md converts to the recorded body (output of the pre-refactor script)', () => {
  // Given: a markdown sample covering headings, lists, tasks, alerts, tables, code, rules
  // When: converted
  const html = convertMarkdown(fixture('sample.md'));
  // Then: identical to the recorded output
  assert.equal(html, fixture('sample.expected.body.html'));
});

test('convertInlineMarkdown: bold, italic, strike, code, link', () => {
  assert.equal(convertInlineMarkdown('**b** *i* ~~s~~ `c` [t](u)'), '<strong>b</strong> <em>i</em> <del>s</del> <code>c</code> <a href="u">t</a>');
});

test('convertInlineMarkdown: image becomes <img>, not a link with a leading "!"', () => {
  // Given: markdown image syntax
  // When/Then: rendered as an img element (regression: the link rule used to consume it first)
  assert.equal(convertInlineMarkdown('![alt text](img/x.png)'), '<img src="img/x.png" alt="alt text">');
  assert.equal(convertInlineMarkdown('see ![a](b.png) and [c](d)'), 'see <img src="b.png" alt="a"> and <a href="d">c</a>');
});

test('convertInlineMarkdown: plain text is untouched', () => {
  assert.equal(convertInlineMarkdown('nothing special'), 'nothing special');
});

test('convertMarkdown: CRLF input and frontmatter are normalized', () => {
  assert.equal(convertMarkdown('---\r\na: 1\r\n---\r\n# Hi\r\n'), '<h1 id="hi">Hi</h1>\n');
});

test('convertMarkdown: heading ids are lowercase with non-word runs as one dash', () => {
  assert.match(convertMarkdown('## A, B & C!'), /<h2 id="a-b-c-">/);
});

test('convertMarkdown: GitHub alert becomes a styled div, bullets become a list', () => {
  const html = convertMarkdown('> [!TIP]\n> one\n>\n> - a\n> - b\n');
  assert.match(html, /<div class="alert alert-tip"><div class="alert-title">TIP<\/div><p>one<\/p>\n<ul><li>a<\/li><li>b<\/li><\/ul><\/div>/);
});

test('convertMarkdown: table', () => {
  const html = convertMarkdown('\n| H1 | H2 |\n|----|----|\n| a | b |\n');
  assert.match(html, /<table>\n<thead>\n<tr><th>H1<\/th><th>H2<\/th><\/tr>/);
  assert.match(html, /<tr><td>a<\/td><td>b<\/td><\/tr>/);
});

test('convertMarkdown: code block escapes angle brackets and keeps the language', () => {
  assert.equal(convertMarkdown('```js\nif (a < b) {}\n```'), '<pre><code class="language-js">if (a &lt; b) {}\n</code></pre>');
});

test('convertMarkdown: ordered list loses its helper class', () => {
  assert.equal(convertMarkdown('1. a\n2. b'), '<ol>\n<li>a</li>\n<li>b</li></ol>\n');
});

test('convertMarkdown: task items keep the checkbox and are not double wrapped', () => {
  const html = convertMarkdown('- [ ] open\n- [x] done\n');
  assert.equal(html.match(/<ul>/g).length, 1);
  assert.match(html, /<li class="task-list-item"><input type="checkbox" disabled> open<\/li>/);
  assert.match(html, /<input type="checkbox" checked disabled> done/);
});

test('convertMarkdown: horizontal rule and paragraph wrapping', () => {
  assert.equal(convertMarkdown('text\n\n---\n\nmore'), '<p>text</p>\n<hr>\n<p>more</p>');
});

test('buildNestedList: nests by indentation and renders html leaves verbatim', () => {
  const html = buildNestedList([
    { indent: 0, text: 'a', isHtml: false },
    { indent: 2, text: 'b', isHtml: false },
    { indent: 0, text: '<li>raw</li>', isHtml: true },
  ]);
  assert.equal(html, '<ul>\n<li>a<ul>\n<li>b</li>\n</ul>\n</li>\n<li>raw</li>\n</ul>\n');
});

test('wrapCodeLine: short lines are untouched', () => {
  assert.equal(wrapCodeLine('SELECT 1'), 'SELECT 1');
});

test('wrapCodeLine: long line breaks after a comma with continuation indent, within the width', () => {
  const line = 'SELECT ' + Array.from({ length: 30 }, (_, i) => `col${i}`).join(', ');
  const out = wrapCodeLine(line).split('\n');
  assert.ok(out.length > 1);
  assert.ok(out.every(l => l.length <= MAX_LINE_WIDTH), out.join('|'));
  assert.ok(out.slice(1).every(l => l.startsWith('    ')));
  assert.equal(out.map(l => l.trim()).join(' ').replace(/,\s*/g, ','), line.replace(/,\s*/g, ','));
});

test('wrapCodeLine: never breaks inside a quoted string', () => {
  const line = `WHERE name = '${'word '.repeat(30)}' AND x = 1`;
  const quoted = line.slice(line.indexOf("'"), line.lastIndexOf("'") + 1);
  assert.ok(wrapCodeLine(line).includes(quoted));
});

test('wrapCodeLine: a long line without break points is left as-is', () => {
  const line = 'x'.repeat(100);
  assert.equal(wrapCodeLine(line), line);
});

test('getHtmlTemplate: wraps content with the title and styles', () => {
  const html = getHtmlTemplate('My Doc', '<p>x</p>');
  assert.match(html, /<title>My Doc<\/title>/);
  assert.match(html, /<body>\n<p>x<\/p>\n<\/body>/);
  assert.match(html, /\.alert-note/);
});
