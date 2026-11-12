#!/usr/bin/env node
/**
 * Install the shared agent rules into the user-global AGENTS.md.
 *
 * Canonical text lives in this repository; the target is per machine:
 *
 *   <repo>/global/AGENTS.shared.md  ->  $DSH_AGENTS_HOME/AGENTS.md  (default ~/.agents/AGENTS.md)
 *
 * The installer upserts ONE managed block delimited by
 *
 *   <!-- BEGIN managed: shared-agent-notes --> ... <!-- END managed: shared-agent-notes -->
 *
 * and leaves everything outside those markers untouched: the machine notes stay local, and the
 * output-style block is owned by output-style/install.mjs. Running it on each machine is what keeps
 * the two homes identical, so no rule is copied between them.
 *
 * Usage (from this repository):
 *   node global/install.mjs             # install or update the block
 *   node global/install.mjs --check     # exit 1 when the target is missing or stale
 *   node global/install.mjs --dry-run   # report the status, write nothing
 *   node global/install.mjs --remove    # remove the block this installer owns
 *
 * Environment:
 *   DSH_AGENTS_HOME   overrides ~/.agents (the shared agents root)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHARED_KIND } from '../scripts/lib/managed-block.mjs';
import { agentsFile, installBlock } from '../scripts/lib/install-block.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// The credential guardrail travels in this block. These headings are the proof that a truncated
// canonical file cannot be installed, and the style installer only warns about the same rule.
const requiredHeadings = [
  '### Credentials: never read the credential file',
  '### Your own notes are not the credential store',
];

process.exitCode = installBlock({
  label: 'shared-agent-notes installer',
  kind: SHARED_KIND,
  source: path.join(here, 'AGENTS.shared.md'),
  target: agentsFile(),
  command: 'node global/install.mjs',
  requiredHeadings,
  args: process.argv.slice(2),
});
