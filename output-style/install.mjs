#!/usr/bin/env node
/**
 * Install the executive-first documentation style into the shared user-global instructions.
 *
 * One target: $DSH_AGENTS_HOME/AGENTS.md, default ~/.agents/AGENTS.md. That file is the shared
 * instruction file every AGENTS.md-aware tool reads, so the style is installed once and no
 * harness-specific copy is kept.
 *
 * Idempotent and non-destructive: it upserts ONE managed block delimited by
 *
 *   <!-- BEGIN managed: documentation-style --> ... <!-- END managed: documentation-style -->
 *
 * and leaves everything outside those markers untouched, including the shared-agent-notes block
 * owned by global/install.mjs. Re-running after editing managed-block.md updates the block in place.
 *
 * Usage (from this repository):
 *   node output-style/install.mjs             # install or update the block
 *   node output-style/install.mjs --check     # exit 1 when the block is missing or stale
 *   node output-style/install.mjs --dry-run   # report the status, write nothing
 *   node output-style/install.mjs --remove    # remove the block this installer owns
 *
 * Environment:
 *   DSH_AGENTS_HOME   overrides ~/.agents (the shared agents root)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STYLE_KIND } from '../scripts/lib/managed-block.mjs';
import { agentsFile, installBlock } from '../scripts/lib/install-block.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const guardrailHeading = '### Credentials: never read the credential file';

process.exitCode = installBlock({
  label: 'documentation-style installer',
  kind: STYLE_KIND,
  source: path.join(here, 'managed-block.md'),
  target: agentsFile(),
  command: 'node output-style/install.mjs',
  note: ({ target, text }) =>
    text.includes(guardrailHeading)
      ? null
      : `${target} has no credential guardrail — run: node global/install.mjs`,
  args: process.argv.slice(2),
});
