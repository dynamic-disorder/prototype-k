#!/usr/bin/env node
/**
 * extract-unit-test-context.mjs
 *
 * Extract context for unit test scaffolding from a C# file: classes, public methods,
 * private dependencies, test framework, and whether tests already exist next to it.
 * Thin runner: logic is in extract-unit-test-context-lib.mjs (unit tested).
 *
 * Usage: node extract-unit-test-context.mjs <file-path>
 * Output: JSON to stdout
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extractUnitTestContext } from './extract-unit-test-context-lib.mjs';

const bash = (cmd) => {
  try {
    return execFileSync('bash', ['-c', cmd], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node extract-unit-test-context.mjs <file-path>');
  process.exit(1);
}

const context = extractUnitTestContext(filePath, { readFile: (p) => readFileSync(p, 'utf8'), bash });
console.log(JSON.stringify(context, null, 2));
