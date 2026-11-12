// Pure HTML generation logic: no file system, process, env or network access. Unit tested in generate-html-lib.test.mjs.
// The runner generate-html.mjs does the I/O and passes the current date in.

export function sanitizeFilename(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function formatDate(now) {
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Fallback output path when the caller passes a bare title instead of an .html path - mirrors the
// unified work-folder convention of ~/.agents/scripts/work-folder-create.mjs.
export function defaultOutputPath(title, now) {
  return `local_user_files/${formatDate(now)}_${sanitizeFilename(title)}/review.html`;
}

export function renderSection(section) {
  if (section.type === 'text') {
    return `<div class="section-content">${section.content}</div>`;
  }

  if (section.type === 'code') {
    return `<pre><code>${escapeHtml(section.content)}</code></pre>`;
  }

  if (section.type === 'list' && section.items) {
    const items = section.items.map(item => {
      const icon = item.type === 'success' ? '✓' : item.type === 'error' ? '✗' : item.type === 'warning' ? '⚠' : 'ℹ';
      const className = item.type || 'info';
      return `<li class="finding-${className}"><span class="finding-icon">${icon}</span>${item.text}</li>`;
    }).join('\n');
    return `<ul class="findings-list">${items}</ul>`;
  }

  if (section.type === 'risks' && section.items) {
    const items = section.items.map(item =>
      `<li class="risk-item"><span class="finding-icon">⚠</span>${escapeHtmlKeepBold(item.text)}</li>`
    ).join('\n');
    return `<ul class="risks-list">${items}</ul>`;
  }

  return '';
}

// Allow simple <b>/<code> tags in item text (author-controlled, not user input) while
// still escaping everything else, so findings can highlight a file:line or symbol.
export function escapeHtmlKeepBold(str) {
  const placeholder = '\x00';
  const tags = [];
  const withPlaceholders = str.replace(/<\/?(b|code)>/g, (m) => {
    tags.push(m);
    return placeholder + (tags.length - 1) + placeholder;
  });
  const escaped = escapeHtml(withPlaceholders);
  return escaped.replace(new RegExp(`${placeholder}(\\d+)${placeholder}`, 'g'), (_, i) => tags[Number(i)]);
}

export function renderVerdict(verdict) {
  if (!verdict) return '';
  const rec = verdict.recommendation || 'Review';
  const recClass = sanitizeFilename(rec).replace(/-/g, '_');
  const riskLevel = verdict.riskLevel || 'low';
  const summary = verdict.summary ? `<p class="verdict-summary">${escapeHtml(verdict.summary)}</p>` : '';
  return `
    <div class="verdict verdict-${recClass}">
      <div class="verdict-header">
        <span class="verdict-badge verdict-badge-${recClass}">${escapeHtml(rec)}</span>
        <span class="risk-badge risk-badge-${riskLevel}">Merge risk: ${escapeHtml(riskLevel)}</span>
      </div>
      ${summary}
    </div>
  `;
}

export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateHtml(data) {
  const { title, metadata = {}, sections = [], verdict } = data;

  const metadataRows = Object.entries(metadata)
    .map(([key, value]) => `<tr><td class="meta-key">${escapeHtml(key)}</td><td>${escapeHtml(String(value))}</td></tr>`)
    .join('\n');

  const sectionsHtml = sections
    .map(section => `
      <div class="section">
        <h2>${escapeHtml(section.title)}</h2>
        ${renderSection(section)}
      </div>
    `)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 2rem;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1a1a1a;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 3px solid #0066cc;
    }
    h2 {
      color: #0066cc;
      margin: 2rem 0 1rem;
      font-size: 1.5rem;
    }
    .metadata {
      background: #f8f9fa;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      margin-bottom: 2rem;
      overflow: hidden;
    }
    .metadata table {
      width: 100%;
      border-collapse: collapse;
    }
    .metadata tr {
      border-bottom: 1px solid #e1e4e8;
    }
    .metadata tr:last-child {
      border-bottom: none;
    }
    .metadata td {
      padding: 0.75rem 1rem;
    }
    .meta-key {
      font-weight: 600;
      color: #1234;
      width: 180px;
    }
    .section {
      margin-bottom: 2rem;
    }
    .section-content {
      color: #24292e;
      white-space: pre-wrap;
    }
    pre {
      background: #f6f8fa;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 1rem;
      overflow-x: auto;
      margin: 1rem 0;
    }
    code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.9rem;
      line-height: 1.45;
    }
    .findings-list {
      list-style: none;
      margin: 1rem 0;
    }
    .findings-list li {
      padding: 0.75rem 1rem;
      margin: 0.5rem 0;
      border-radius: 6px;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .finding-icon {
      font-size: 1.2rem;
      flex-shrink: 0;
    }
    .finding-success {
      background: #d4edda;
      border-left: 4px solid #28a745;
    }
    .finding-error {
      background: #f8d7da;
      border-left: 4px solid #dc3545;
    }
    .finding-warning {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
    }
    .finding-info {
      background: #d1ecf1;
      border-left: 4px solid #17a2b8;
    }
    .verdict {
      border-radius: 8px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 2rem;
      border: 1px solid #e1e4e8;
      background: #f8f9fa;
    }
    .verdict-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .verdict-summary {
      margin-top: 0.75rem;
      font-size: 1.05rem;
      color: #24292e;
    }
    .verdict-badge {
      display: inline-block;
      padding: 0.35rem 0.9rem;
      border-radius: 999px;
      font-weight: 700;
      font-size: 0.95rem;
      color: #fff;
    }
    .verdict-badge-approve { background: #28a745; }
    .verdict-badge-approve_with_suggestions { background: #17a2b8; }
    .verdict-badge-request_changes { background: #dc3545; }
    .verdict-badge-review { background: #6c757d; }
    .risk-badge {
      display: inline-block;
      padding: 0.3rem 0.8rem;
      border-radius: 999px;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .risk-badge-low { background: #d4edda; color: #1234; }
    .risk-badge-medium { background: #fff3cd; color: #1234; }
    .risk-badge-high { background: #f8d7da; color: #721c24; }
    .risks-list {
      list-style: none;
      margin: 1rem 0;
    }
    .risks-list li {
      padding: 0.75rem 1rem;
      margin: 0.5rem 0;
      border-radius: 6px;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      background: #fff3cd;
      border-left: 4px solid #dc3545;
      color: #664d03;
    }
    .risks-list code {
      background: rgba(0,0,0,0.06);
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
    }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
    }
    @media (max-width: 768px) {
      body { padding: 1rem; }
      .container { padding: 1rem; }
      .meta-key { width: 120px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(title)}</h1>
    ${renderVerdict(verdict)}
    ${metadataRows ? `<div class="metadata"><table>${metadataRows}</table></div>` : ''}
    ${sectionsHtml}
  </div>
</body>
</html>`;
}
