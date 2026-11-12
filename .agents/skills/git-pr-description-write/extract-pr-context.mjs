#!/usr/bin/env node
/**
 * extract-pr-context.mjs
 *
 * Extract PR context into structured JSON for git-pr-description-write skill.
 * Replaces manual parsing of gh pr view, git log, git diff - Claude receives
 * pre-digested context instead of raw CLI output.
 * Thin runner: logic is in extract-pr-context-lib.mjs (unit tested).
 *
 * Usage: node extract-pr-context.mjs [pr-url-or-number]  (no argument = PR of the current branch)
 * Output: JSON to stdout
 */

import { execFileSync } from 'node:child_process';
import { getPRContext } from './extract-pr-context-lib.mjs';

const bash = (cmd) => execFileSync('bash', ['-c', cmd], { encoding: 'utf8' }).trim();

console.log(JSON.stringify(getPRContext(process.argv[2] || '', { bash }), null, 2));
