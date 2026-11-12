// Pure functions of convert-markdown.mjs (no file system, no process access) so they can be unit tested.
// Simple markdown-to-HTML converter with no external dependencies
export function convertMarkdown(markdown) {
  let html = markdown.replace(/\r\n?/g, '\n');

  // Strip frontmatter
  html = html.replace(/^---\n[\s\S]*?\n---\n/, '');

  // GitHub-style alerts (must come before blockquotes). Body lines may be
  // "> text" or a bare ">" (blank line inside the alert) - both are matched
  // so multi-paragraph alert bodies don't break out of the div early.
  html = html.replace(/^> \[!(NOTE|WARNING|IMPORTANT|TIP|DANGER)\]\n((?:>.*\n?)+)/gm, (match, type, content) => {
    const alertClass = type.toLowerCase();
    const cleanContent = content.replace(/^> ?/gm, '');
    const paragraphs = cleanContent.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const body = paragraphs.map(p => {
      const lines = p.split('\n').map(l => l.trim());
      if (lines.every(l => l.startsWith('- '))) {
        const items = lines.map(l => `<li>${convertInlineMarkdown(l.slice(2))}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${convertInlineMarkdown(lines.join(' '))}</p>`;
    }).join('\n');
    return `<div class="alert alert-${alertClass}"><div class="alert-title">${type}</div>${body}</div>\n`;
  });

  // Code blocks (before inline code)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const wrapped = code.split('\n').map(line => wrapCodeLine(line)).join('\n');
    const escaped = wrapped.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre><code class="language-${lang || 'text'}">${escaped}</code></pre>`;
  });

  // Headers with anchor links
  html = html.replace(/^### (.*$)/gm, (match, text) => {
    const id = text.toLowerCase().replace(/[^\w]+/g, '-');
    return `<h3 id="${id}">${convertInlineMarkdown(text)}</h3>`;
  });
  html = html.replace(/^## (.*$)/gm, (match, text) => {
    const id = text.toLowerCase().replace(/[^\w]+/g, '-');
    return `<h2 id="${id}">${convertInlineMarkdown(text)}</h2>`;
  });
  html = html.replace(/^# (.*$)/gm, (match, text) => {
    const id = text.toLowerCase().replace(/[^\w]+/g, '-');
    return `<h1 id="${id}">${convertInlineMarkdown(text)}</h1>`;
  });

  // Tables
  html = html.replace(/\n\|(.+)\|\n\|([-:\s|]+)\|\n((?:\|.+\|\n?)+)/g, (match, header, separator, rows) => {
    const headers = header.split('|').map(h => h.trim()).filter(Boolean);
    const rowData = rows.trim().split('\n').map(row =>
      row.split('|').map(cell => cell.trim()).filter(Boolean)
    );

    let table = '<table>\n<thead>\n<tr>';
    headers.forEach(h => table += `<th>${convertInlineMarkdown(h)}</th>`);
    table += '</tr>\n</thead>\n<tbody>\n';
    rowData.forEach(row => {
      table += '<tr>';
      row.forEach(cell => table += `<td>${convertInlineMarkdown(cell)}</td>`);
      table += '</tr>\n';
    });
    table += '</tbody>\n</table>\n';
    return table;
  });

  // Lists (unordered) - task checkboxes convert to <li> first (leaf-only, never
  // nested), then one indentation-aware pass builds a (possibly nested) <ul> from
  // any contiguous run of raw "- " bullets and/or those pre-built task <li> lines.
  // One unified pass so there's no separate wrap-if-unwrapped step to accidentally
  // double-wrap something (that was a real, previously-fixed bug in this script).
  html = html.replace(/^(\s*)- \[ \] (.+)$/gm, (m, indent, text) => `${indent}<li class="task-list-item"><input type="checkbox" disabled> ${convertInlineMarkdown(text)}</li>`);
  html = html.replace(/^(\s*)- \[x\] (.+)$/gm, (m, indent, text) => `${indent}<li class="task-list-item"><input type="checkbox" checked disabled> ${convertInlineMarkdown(text)}</li>`);
  html = html.replace(/(^[ \t]*(?:-\s+.+|<li\b.*<\/li>)\s*$\n?)+/gm, block => {
    const lines = block.split('\n').filter(l => l.trim()).map(line => {
      const dash = line.match(/^(\s*)-\s+(.+)$/);
      if (dash) return { indent: dash[1].length, text: dash[2], isHtml: false };
      const li = line.match(/^(\s*)(<li\b.*<\/li>)\s*$/);
      return { indent: li[1].length, text: li[2], isHtml: true };
    });
    return buildNestedList(lines);
  });

  // Lists (ordered)
  html = html.replace(/^\d+\. (.+)$/gm, (m, text) => `<li class="ol-item">${convertInlineMarkdown(text)}</li>`);
  html = html.replace(/(<li class="ol-item">.*<\/li>\n?)+/g, match => `<ol>\n${match.replace(/ class="ol-item"/g, '')}</ol>\n`);

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Paragraphs (after all block elements)
  html = html.split('\n\n').map(block => {
    if (block.match(/^<(h[1-6]|pre|div|table|ul|ol|blockquote|hr)/)) {
      return block;
    }
    return `<p>${convertInlineMarkdown(block.trim())}</p>`;
  }).join('\n');

  return html;
}

// xhtml2pdf doesn't wrap long <pre> lines in the PDF regardless of CSS white-space -
// a long SQL line just overflows off the page (confirmed 2026-09-16). Wrap here instead,
// at the last safe whitespace before MAX_LINE_WIDTH, never inside a '...' string literal
// (breaking there would insert a literal newline into the string value).
export const MAX_LINE_WIDTH = 72;
export function wrapCodeLine(line, maxWidth = MAX_LINE_WIDTH, continuationIndent = '    ') {
  if (line.length <= maxWidth) return line;

  // Safe cut points: right after a comma, or at a whitespace run - never inside a
  // '...' string literal (that would insert a real newline into the string value).
  const breakPoints = [];
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "'") inQuote = !inQuote;
    if (inQuote) continue;
    if (line[i] === ',') breakPoints.push({ at: i + 1, dropChar: false });
    else if (/\s/.test(line[i]) && !/\s/.test(line[i - 1] || '')) breakPoints.push({ at: i, dropChar: true });
  }
  if (breakPoints.length === 0) return line; // nothing safe to break on - leave as-is

  const out = [];
  let start = 0;
  let currentMax = maxWidth;
  while (line.length - start > currentMax) {
    const candidates = breakPoints.filter(b => b.at > start && b.at - start <= currentMax);
    const nextAfter = breakPoints.find(b => b.at > start + currentMax);
    const bp = candidates.length ? candidates[candidates.length - 1] : nextAfter;
    if (bp === undefined) break;
    out.push(line.slice(start, bp.at));
    start = bp.dropChar ? bp.at + 1 : bp.at;
    currentMax = maxWidth - continuationIndent.length;
  }
  out.push(line.slice(start));
  return out.map((l, i) => (i === 0 ? l : continuationIndent + l.trimStart())).join('\n');
}

// Builds a nested <ul> from a flat list of { indent, text } bullet lines, based on
// leading-whitespace depth - lets a bullet have indented sub-bullets under it
// (e.g. "Verified:" with sub-steps), which a single-pass flat wrap can't express.
export function buildNestedList(lines) {
  const root = { indent: -1, children: [] };
  const stack = [root];
  for (const { indent, text, isHtml } of lines) {
    const node = { indent, text, isHtml, children: [] };
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  function render(node) {
    if (!node.children.length) return '';
    let out = '<ul>\n';
    for (const child of node.children) {
      // isHtml leaves (task-list items) are already a complete <li>...</li> - use verbatim.
      out += child.isHtml ? `${child.text}\n` : `<li>${convertInlineMarkdown(child.text)}${render(child)}</li>\n`;
    }
    out += '</ul>\n';
    return out;
  }
  return render(root);
}

export function convertInlineMarkdown(text) {
  let result = text;

  // Images (before links, otherwise the link rule consumes "[alt](src)" and leaves a stray "!")
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Bold
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Strikethrough
  result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // Inline code (last to avoid conflicts)
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

  return result;
}

export function getHtmlTemplate(title, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #24292e;
      background: #fff;
      padding: 2rem;
      max-width: 1000px;
      margin: 0 auto;
    }
    /* xhtml2pdf doesn't collapse adjacent vertical margins like a browser does, so every
       rule below uses margin-bottom only (no margin-top) - otherwise consecutive elements'
       margins add up instead of merging, producing exaggerated gaps in the PDF only. */
    h1 { font-size: 2em; margin: 0 0 0.67em 0; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; margin: 0 0 0.83em 0; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h3 { font-size: 1.17em; margin: 0 0 1em 0; }
    h4 { font-size: 1em; margin: 0 0 1.33em 0; }
    p { margin: 0 0 1em 0; }
    code {
      background: #f6f8fa;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 95%;
    }
    pre {
      background: #f6f8fa;
      padding: 1em;
      border-radius: 6px;
      overflow-x: auto;
      margin: 0 0 1em 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      word-break: break-word;
    }
    pre code { background: none; padding: 0; font-size: 100%; white-space: inherit; }
    blockquote {
      border-left: 4px solid #dfe2e5;
      color: #6a737d;
      padding-left: 1em;
      margin: 0 0 1em 0;
    }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0 0 1em 0;
    }
    th, td {
      border: 1px solid #dfe2e5;
      padding: 0.6em 1em;
      text-align: left;
    }
    th { background: #f6f8fa; font-weight: 600; }
    ul, ol { margin: 0 0 1em 0; padding-left: 2em; }
    li { margin: 0 0 0.25em 0; }
    /* Nested padding-left doesn't reliably compound under xhtml2pdf the way it does
       in a browser, so a sub-list needs its own explicit indent, not just inherited. */
    li > ul, li > ol { margin: 0.25em 0 0 1.5em; padding-left: 1.5em; }
    li > ul { list-style-type: circle; }
    .alert {
      padding: 0.85em 1em;
      margin: 0 0 1em 0;
      border-left: 4px solid;
      border-radius: 4px;
      color: #24292e;
    }
    .alert p, .alert ul { color: #24292e; margin: 0 0 0.5em 0; }
    .alert p:last-child, .alert ul:last-child { margin-bottom: 0; }
    .alert-title {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.85em;
      letter-spacing: 0.03em;
      line-height: 1.4;
      margin: 0 0 0.5em 0;
    }
    /* CompanyOrOrganizationName brand palette (rvvty-sea/warning/fuchsia/forest/error, converted from
       src/web/apps/variables.css OKLCH tokens to hex - xhtml2pdf can't render oklch()) */
    .alert-note { background: #e8f2f3; border-color: #1234; }
    .alert-note .alert-title { color: #1234; }
    .alert-warning { background: #fdf7e6; border-color: #e7b007; }
    .alert-warning .alert-title { color: #a97a00; }
    .alert-important { background: #f5eaf1; border-color: #9e306e; }
    .alert-important .alert-title { color: #9e306e; }
    .alert-tip { background: #e9f3ea; border-color: #1234; }
    .alert-tip .alert-title { color: #1234; }
    .alert-danger { background: #fceaea; border-color: #dc2828; }
    .alert-danger .alert-title { color: #dc2828; }
    .task-list-item { list-style: none; margin-left: -1.5em; }
    .task-list-item input { margin-right: 0.5em; }
    hr { border: none; border-top: 2px solid #eaecef; margin: 2em 0; }
    @media (max-width: 768px) {
      body { padding: 1rem; font-size: 14px; }
    }
    @media print {
      body { max-width: none; padding: 0; }
      a { color: inherit; text-decoration: underline; }
      pre { border: 1px solid #ddd; }
    }
  </style>
</head>
<body>
${content}
</body>
</html>`;
}
