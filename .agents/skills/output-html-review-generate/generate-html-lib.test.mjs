// Run: node --test ~/.agents/skills/output-html-review-generate/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  sanitizeFilename, formatDate, defaultOutputPath, renderSection,
  escapeHtmlKeepBold, renderVerdict, escapeHtml, generateHtml,
} from './generate-html-lib.mjs';

const fixture = name => fs.readFileSync(fileURLToPath(new URL(`./test-fixtures/${name}`, import.meta.url)), 'utf8');
const NUL = String.fromCharCode(0);

for (const name of ['sample', 'minimal', 'verdict-default', 'verdict-request-changes']) {
  test(`golden: ${name}-input.json renders the recorded HTML (output of the pre-refactor script)`, () => {
    // Given: an input JSON fixture
    const data = JSON.parse(fixture(`${name}-input.json`));
    // When: the HTML is generated
    const html = generateHtml(data);
    // Then: identical to the output recorded from the original script
    assert.equal(html, fixture(`${name}.expected.html`));
  });
}

test('sanitizeFilename: lowercases and collapses non-alphanumeric runs into one dash', () => {
  // Given/When/Then: mixed case, punctuation and spaces
  assert.equal(sanitizeFilename('My Title: Review #5!'), 'my-title-review-5');
});

test('sanitizeFilename: trims leading and trailing dashes', () => {
  assert.equal(sanitizeFilename('--abc--'), 'abc');
});

test('sanitizeFilename: non-ASCII letters are dropped, not transliterated', () => {
  // current behavior (looks like a bug): "Ünï" becomes "n" instead of keeping or transliterating the letters
  assert.equal(sanitizeFilename('Ünï'), 'n');
});

test('sanitizeFilename: a title without alphanumerics gives an empty string', () => {
  // current behavior (looks like a bug): defaultOutputPath then yields "<date>_/review.html"
  assert.equal(sanitizeFilename('!!!'), '');
});

test('formatDate: returns the UTC date as YYYY-MM-DD', () => {
  // Given: a fixed instant late in the UTC day
  const now = new Date('2026-03-04T23:59:59Z');
  // When/Then: only the date part is returned
  assert.equal(formatDate(now), '2026-03-04');
});

test('defaultOutputPath: combines date and sanitized title under the local_user_files convention', () => {
  // Given: a fixed date and a bare title
  const now = new Date('2026-03-04T10:00:00Z');
  // When/Then: the unified work-folder path is built
  assert.equal(defaultOutputPath('PR Review #12', now), 'local_user_files/2026-03-04_pr-review-12/review.html');
});

test('defaultOutputPath: empty sanitized title leaves a dangling underscore', () => {
  // current behavior (looks like a bug): folder name is "2026-03-04_" when the title has no alphanumerics
  assert.equal(defaultOutputPath('???', new Date('2026-03-04T10:00:00Z')), 'local_user_files/2026-03-04_/review.html');
});

test('escapeHtml: escapes ampersand, angle brackets and both quote kinds', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;');
});

test('escapeHtml: escapes the ampersand first so later entities are not double-escaped', () => {
  assert.equal(escapeHtml('<'), '&lt;');
  assert.equal(escapeHtml('&lt;'), '&amp;lt;');
});

test('escapeHtml: empty string stays empty', () => {
  assert.equal(escapeHtml(''), '');
});

test('escapeHtml: a non-string throws', () => {
  // current behavior (looks like a bug): missing title/section title/item text crashes the whole report instead of rendering empty
  assert.throws(() => escapeHtml(undefined), TypeError);
  assert.throws(() => escapeHtml(5), TypeError);
});

test('escapeHtmlKeepBold: keeps b and code tags, escapes everything else', () => {
  assert.equal(
    escapeHtmlKeepBold('<b>x</b> <code>a<b</code> <script>"y"</script>'),
    '<b>x</b> <code>a&lt;b</code> &lt;script&gt;&quot;y&quot;&lt;/script&gt;',
  );
});

test('escapeHtmlKeepBold: tags with attributes or other names are escaped', () => {
  assert.equal(escapeHtmlKeepBold('<b class="x">t</b>'), '&lt;b class=&quot;x&quot;&gt;t</b>');
  assert.equal(escapeHtmlKeepBold('<i>t</i>'), '&lt;i&gt;t&lt;/i&gt;');
});

test('escapeHtmlKeepBold: unbalanced tags are kept as written', () => {
  // current behavior (looks like a bug): a stray </b> or <code> is passed through and can break the surrounding markup
  assert.equal(escapeHtmlKeepBold('a </b> b <code>c'), 'a </b> b <code>c');
});

test('escapeHtmlKeepBold: text without tags equals escapeHtml', () => {
  assert.equal(escapeHtmlKeepBold('1 < 2 & 3'), escapeHtml('1 < 2 & 3'));
});

test('escapeHtmlKeepBold: a pre-existing NUL-digit-NUL sequence in the text is mistaken for a placeholder', () => {
  // current behavior (looks like a bug): the sequence is replaced by tags[7] which does not exist, giving "undefined"
  assert.equal(escapeHtmlKeepBold(`x${NUL}7${NUL}y`), 'xundefinedy');
});

test('renderSection: text is inserted raw, without escaping', () => {
  // current behavior (looks like a bug, or at least inconsistent with code/risks): HTML in text content is not escaped
  assert.equal(renderSection({ type: 'text', content: '<b>hi</b> & <script>x</script>' }), '<div class="section-content"><b>hi</b> & <script>x</script></div>');
});

test('renderSection: code is escaped inside pre/code', () => {
  assert.equal(renderSection({ type: 'code', content: 'a < b && "c"' }), '<pre><code>a &lt; b &amp;&amp; &quot;c&quot;</code></pre>');
});

test('renderSection: list maps each severity to its icon and class', () => {
  // Given: one item per severity, one without type, one with an unknown type
  const html = renderSection({ type: 'list', items: [
    { text: 'ok', type: 'success' },
    { text: 'bad', type: 'error' },
    { text: 'hmm', type: 'warning' },
    { text: 'fyi', type: 'info' },
    { text: 'none' },
    { text: 'odd', type: 'custom' },
  ] });
  // Then: icons and classes follow the severity; missing type is info
  assert.equal(html, [
    '<ul class="findings-list"><li class="finding-success"><span class="finding-icon">✓</span>ok</li>',
    '<li class="finding-error"><span class="finding-icon">✗</span>bad</li>',
    '<li class="finding-warning"><span class="finding-icon">⚠</span>hmm</li>',
    '<li class="finding-info"><span class="finding-icon">ℹ</span>fyi</li>',
    '<li class="finding-info"><span class="finding-icon">ℹ</span>none</li>',
    // current behavior (looks like a bug): unknown type gets the info icon but a class without CSS (unstyled row)
    '<li class="finding-custom"><span class="finding-icon">ℹ</span>odd</li></ul>',
  ].join('\n'));
});

test('renderSection: list item text is inserted raw, without escaping', () => {
  // current behavior (looks like a bug): unlike risks items, list item text is not escaped, so HTML/script passes through
  assert.equal(
    renderSection({ type: 'list', items: [{ text: '<script>x</script>', type: 'error' }] }),
    '<ul class="findings-list"><li class="finding-error"><span class="finding-icon">✗</span><script>x</script></li></ul>',
  );
});

test('renderSection: list without items renders nothing', () => {
  assert.equal(renderSection({ type: 'list' }), '');
});

test('renderSection: list with an empty items array renders an empty ul', () => {
  assert.equal(renderSection({ type: 'list', items: [] }), '<ul class="findings-list"></ul>');
});

test('renderSection: risks keep b/code tags and escape the rest', () => {
  assert.equal(
    renderSection({ type: 'risks', items: [{ text: 'Crash in <code>a.cs:1</code> <script>' }, { text: '<b>x</b>' }] }),
    '<ul class="risks-list"><li class="risk-item"><span class="finding-icon">⚠</span>Crash in <code>a.cs:1</code> &lt;script&gt;</li>\n<li class="risk-item"><span class="finding-icon">⚠</span><b>x</b></li></ul>',
  );
});

test('renderSection: risks without items renders nothing, empty array renders an empty ul', () => {
  assert.equal(renderSection({ type: 'risks' }), '');
  assert.equal(renderSection({ type: 'risks', items: [] }), '<ul class="risks-list"></ul>');
});

test('renderSection: unknown or missing type renders nothing', () => {
  assert.equal(renderSection({ type: 'table', content: 'x' }), '');
  assert.equal(renderSection({ content: 'x' }), '');
});

test('renderVerdict: missing verdict renders nothing', () => {
  assert.equal(renderVerdict(undefined), '');
  assert.equal(renderVerdict(null), '');
});

test('renderVerdict: empty verdict defaults to Review with low risk and no summary', () => {
  const html = renderVerdict({});
  assert.match(html, /<div class="verdict verdict-review">/);
  assert.match(html, /<span class="verdict-badge verdict-badge-review">Review<\/span>/);
  assert.match(html, /<span class="risk-badge risk-badge-low">Merge risk: low<\/span>/);
  assert.doesNotMatch(html, /verdict-summary/);
});

test('renderVerdict: recommendation becomes a snake_case CSS class, text stays readable', () => {
  const html = renderVerdict({ recommendation: 'Approve with suggestions', riskLevel: 'medium', summary: 'Fine.' });
  assert.match(html, /verdict-badge-approve_with_suggestions">Approve with suggestions<\/span>/);
  assert.match(html, /risk-badge-medium">Merge risk: medium/);
  assert.match(html, /<p class="verdict-summary">Fine\.<\/p>/);
});

test('renderVerdict: the recommendation suggested in SKILL.md ("Approve after fixes") has no CSS rule', () => {
  // current behavior (looks like a bug): class becomes approve_after_fixes, which the stylesheet does not define (badge has no background)
  const html = renderVerdict({ recommendation: 'Approve after fixes' });
  assert.match(html, /verdict-badge-approve_after_fixes/);
  assert.doesNotMatch(generateHtml({ title: 't' }), /verdict-badge-approve_after_fixes/);
});

test('renderVerdict: recommendation and summary text are escaped', () => {
  const html = renderVerdict({ recommendation: '<b>x</b>', summary: '<i>&</i>' });
  assert.match(html, />&lt;b&gt;x&lt;\/b&gt;<\/span>/);
  assert.match(html, /<p class="verdict-summary">&lt;i&gt;&amp;&lt;\/i&gt;<\/p>/);
});

test('renderVerdict: riskLevel is escaped in the text but inserted raw into the class attribute', () => {
  // current behavior (looks like a bug): a riskLevel containing a quote breaks out of the class attribute
  const html = renderVerdict({ riskLevel: 'x" onclick="y' });
  assert.match(html, /class="risk-badge risk-badge-x" onclick="y">Merge risk: x&quot; onclick=&quot;y</);
});

test('generateHtml: minimal input has title, no verdict, no metadata table, no sections', () => {
  const html = generateHtml({ title: 'T' });
  assert.match(html, /<title>T<\/title>/);
  assert.match(html, /<h1>T<\/h1>/);
  assert.doesNotMatch(html, /<div class="metadata">/);
  assert.doesNotMatch(html, /<div class="section">/);
  assert.doesNotMatch(html, /<div class="verdict /);
});

test('generateHtml: title is escaped in <title> and <h1>', () => {
  const html = generateHtml({ title: '<x>&"' });
  assert.match(html, /<title>&lt;x&gt;&amp;&quot;<\/title>/);
  assert.match(html, /<h1>&lt;x&gt;&amp;&quot;<\/h1>/);
});

test('generateHtml: metadata keys and values are escaped and values stringified', () => {
  const html = generateHtml({ title: 't', metadata: { 'A<b>': 'x&y', Count: 3, Flag: false, Nothing: null } });
  assert.match(html, /<tr><td class="meta-key">A&lt;b&gt;<\/td><td>x&amp;y<\/td><\/tr>/);
  assert.match(html, /<td class="meta-key">Count<\/td><td>3<\/td>/);
  assert.match(html, /<td class="meta-key">Flag<\/td><td>false<\/td>/);
  // current behavior (looks like a bug): null is shown as the text "null"
  assert.match(html, /<td class="meta-key">Nothing<\/td><td>null<\/td>/);
});

test('generateHtml: empty metadata object renders no metadata block', () => {
  assert.doesNotMatch(generateHtml({ title: 't', metadata: {} }), /class="metadata"/);
});

test('generateHtml: sections render in order with escaped titles', () => {
  const html = generateHtml({ title: 't', sections: [
    { title: 'First <1>', type: 'text', content: 'a' },
    { title: 'Second', type: 'code', content: 'b' },
  ] });
  const first = html.indexOf('<h2>First &lt;1&gt;</h2>');
  const second = html.indexOf('<h2>Second</h2>');
  assert.ok(first > 0 && second > first);
  assert.match(html, /<div class="section-content">a<\/div>/);
  assert.match(html, /<pre><code>b<\/code><\/pre>/);
});

test('generateHtml: a section of unknown type still gets its heading with an empty body', () => {
  assert.match(generateHtml({ title: 't', sections: [{ title: 'S', type: 'zzz' }] }), /<h2>S<\/h2>\n\s+\n\s+<\/div>/);
});

test('generateHtml: verdict is rendered before metadata and sections', () => {
  const html = generateHtml({ title: 't', verdict: { recommendation: 'Approve' }, metadata: { K: 'V' }, sections: [{ title: 'S', type: 'text', content: 'x' }] });
  const v = html.indexOf('<div class="verdict ');
  const m = html.indexOf('<div class="metadata">');
  const s = html.indexOf('<div class="section">');
  assert.ok(v > 0 && m > v && s > m);
});

test('generateHtml: a missing title throws', () => {
  // current behavior (looks like a bug): no fallback title, escapeHtml(undefined) raises a TypeError
  assert.throws(() => generateHtml({}), TypeError);
});

test('generateHtml: output is a complete standalone document', () => {
  const html = generateHtml({ title: 't' });
  assert.ok(html.startsWith('<!DOCTYPE html>\n<html lang="en">'));
  assert.ok(html.endsWith('</body>\n</html>'));
  assert.match(html, /<style>[\s\S]+<\/style>/);
});
