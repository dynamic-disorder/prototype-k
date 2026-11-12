#!/usr/bin/env node
// Runner: args, file I/O and exit codes. The HTML generation logic lives in generate-html-lib.mjs (unit tested).

import fs from 'fs';
import path from 'path';
import { generateHtml, defaultOutputPath } from './generate-html-lib.mjs';

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node generate-html.mjs <input.json> <output.html>');
    console.error('       node generate-html.mjs <input.json> <title>  (auto-generates filename)');
    process.exit(1);
  }

  const inputPath = args[0];
  let outputPath = args[1];

  if (!inputPath.endsWith('.json')) {
    console.error(`First argument must be a path to a JSON file, got: "${inputPath}"`);
    console.error('Usage: node generate-html.mjs <input.json> <output.html|title>');
    process.exit(1);
  }

  // Read input JSON
  let data;
  try {
    const content = fs.readFileSync(inputPath, 'utf8');
    data = JSON.parse(content);
  } catch (err) {
    console.error(`Error reading input file: ${err.message}`);
    process.exit(1);
  }

  // If second arg doesn't end with .html, treat it as a bare title (no WORK_DIR
  // context available to the caller) and fall back to the unified work-folder convention -
  // see ~/.agents/scripts/temp-work-folder.sh for the naming rule this mirrors.
  if (!outputPath.endsWith('.html')) {
    outputPath = defaultOutputPath(outputPath, new Date());
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate HTML
  const html = generateHtml(data);

  // Write output
  try {
    fs.writeFileSync(outputPath, html, 'utf8');
    console.log(outputPath);
  } catch (err) {
    console.error(`Error writing output file: ${err.message}`);
    process.exit(1);
  }
}

main();
