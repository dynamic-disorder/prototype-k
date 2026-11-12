#!/usr/bin/env node
/**
 * Verify a neutral import: no refused files, no secrets, no leftover Claude-only paths or standards,
 * and valid skill frontmatter.
 *
 * Usage:
 *   node verify-import.mjs --source <claude-generic-dir> --target <repo>
 *   node verify-import.mjs --target <repo>          # target checks only
 *   node verify-import.mjs --target <repo> --list   # list the target's skills
 *
 * Exit 0 when every check passes, 1 when any issue is found, 2 on bad usage.
 * Matching text is never printed: only the file and the rule name.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatReport, runVerification } from './verify-import-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultTarget = path.resolve(here, '..', '..', '..', '..');
const selfDir = path.resolve(here, '..');

const result = runVerification(process.argv.slice(2), { defaultTarget, selfDir });
if (result.error) {
  console.error(result.error);
  process.exit(result.exitCode);
}

for (const line of formatReport(result)) process.stdout.write(`${line}\n`);
process.exit(result.exitCode);
