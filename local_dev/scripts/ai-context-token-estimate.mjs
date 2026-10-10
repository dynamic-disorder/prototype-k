#!/usr/bin/env node
// Estimates token usage of the committed AI-context files (CLAUDE.md, rules, Copilot
// instructions). Rough rule of thumb: ~4 characters per token for English/markdown text.
//
// Node port of ai_context_token_estimate.ps1, which could not run here because `pwsh` is not
// installed on the Omarchy Linux box. Dependency-free: Node built-ins only.
//
// Hooks (.claude/hooks/*) are NOT counted: only their OUTPUT is injected at session start.
//
// Usage:
//   node local_dev/scripts/ai-context-token-estimate.mjs
//   node local_dev/scripts/ai-context-token-estimate.mjs --json   # machine-readable

import { readFileSync, globSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// Explicit relative paths. Wildcards are handed to glob so `.claude/rules/*.md` expands.
// The root `.claude/` tree is git-ignored and now holds only skills, which load on demand rather
// than being injected, so it is deliberately not counted. The per-project `.claude/rules/` files
// are committed and are counted.
const patterns = [
  'CLAUDE.md',
  'CliUtils/CLAUDE.md',
  'FilenameTools/CLAUDE.md',
  'FilenameTools/.claude/rules/*.md',
  'FilenameTools/.github/copilot-instructions.md',
  'CsvTranslations/CLAUDE.md',
  'CsvTranslations/.claude/rules/*.md',
  'CsvTranslations/.github/copilot-instructions.md',
  'MediaRenamer/CLAUDE.md',
  'ai_offline/CLAUDE.md',
  '.clinerules',
  '.github/copilot-instructions.md',
  '.github/clean_code_general_instructions.md',
];

const { values } = parseArgs({
  options: { json: { type: 'boolean', default: false } },
});

// This file lives in local_dev/scripts/, so the repository root is two levels up.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const found = new Set();
for (const pattern of patterns) {
  for (const match of globSync(pattern, { cwd: repoRoot })) {
    found.add(resolve(repoRoot, match));
  }
}

const rows = [...found]
  .sort((a, b) => a.localeCompare(b))
  .map((absolutePath) => {
    // Character count matches PowerShell's `(Get-Content -Raw).Length`: UTF-16 code units.
    const chars = readFileSync(absolutePath, 'utf8').length;
    return {
      file: relative(repoRoot, absolutePath),
      chars,
      estTokens: Math.round(chars / 4),
    };
  });

const totalChars = rows.reduce((sum, row) => sum + row.chars, 0);
const totalTokens = rows.reduce((sum, row) => sum + row.estTokens, 0);

if (values.json) {
  console.log(JSON.stringify({ files: rows, totalChars, totalTokens }, null, 2));
} else {
  const heading = ['File', 'Chars', 'EstTokens'];
  const widths = [
    Math.max(heading[0].length, ...rows.map((r) => r.file.length)),
    Math.max(heading[1].length, ...rows.map((r) => r.chars.toLocaleString('en-US').length)),
    Math.max(heading[2].length, ...rows.map((r) => r.estTokens.toLocaleString('en-US').length)),
  ];
  const line = (cells) => cells.map((cell, i) => cell.padEnd(widths[i])).join('  ').trimEnd();

  console.log(line(heading));
  console.log(line(widths.map((w) => '-'.repeat(w))));
  for (const row of rows) {
    console.log(line([
      row.file,
      row.chars.toLocaleString('en-US'),
      row.estTokens.toLocaleString('en-US'),
    ]));
  }

  console.log();
  console.log(`TOTAL: ${totalChars.toLocaleString('en-US')} chars, ~${totalTokens.toLocaleString('en-US')} estimated tokens`);
}
