#!/usr/bin/env node
// Runner: file/directory I/O and CLI. The conversion logic lives in convert-markdown-lib.mjs (unit tested).

import fs from 'fs';
import path from 'path';
import { convertMarkdown, getHtmlTemplate } from './convert-markdown-lib.mjs';

function processFile(inputPath, outputPath = null) {
  const markdown = fs.readFileSync(inputPath, 'utf8');
  const fileName = path.basename(inputPath, '.md');
  const htmlContent = convertMarkdown(markdown);
  const html = getHtmlTemplate(fileName, htmlContent);

  const output = outputPath || inputPath.replace(/\.md$/, '.html');
  fs.writeFileSync(output, html, 'utf8');

  const stats = fs.statSync(output);
  return { path: output, size: stats.size };
}

function processDirectory(dirPath, outputDir = null) {
  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(dirPath, f));

  const results = [];
  for (const file of files) {
    const outputPath = outputDir
      ? path.join(outputDir, path.basename(file, '.md') + '.html')
      : null;
    results.push(processFile(file, outputPath));
  }

  return results;
}

// CLI
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node convert-markdown.mjs <input.md or directory> [output.html or directory]');
  process.exit(1);
}

const input = args[0];
const output = args[1] || null;

try {
  const stats = fs.statSync(input);

  if (stats.isDirectory()) {
    const results = processDirectory(input, output);
    console.log(`Converted ${results.length} files:`);
    results.forEach(r => console.log(`  ${r.path} (${(r.size / 1024).toFixed(1)} KB)`));
  } else if (stats.isFile() && input.endsWith('.md')) {
    const result = processFile(input, output);
    console.log(`Converted: ${result.path} (${(result.size / 1024).toFixed(1)} KB)`);
  } else {
    console.error('Input must be a .md file or directory');
    process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
