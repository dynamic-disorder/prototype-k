/**
 * The installer runner shared by global/install.mjs and output-style/install.mjs.
 *
 * One implementation of the command line, the status report and the write, so the two installers
 * differ only in their block kind, source file and guardrail checks. The runner returns the exit code
 * and writes to injected streams, which keeps it unit testable without spawning a process.
 *
 * Exit codes: 0 ok, 1 stale (check only), 2 unusable source, malformed target or usage.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyBlock, missingHeadings, removeBlock, validateBlockText } from './managed-block.mjs';

const KNOWN_ARGS = new Set(['--check', '--dry-run', '--remove', '--help', '-h']);

/**
 * Return the user-global AGENTS.md path, honouring DSH_AGENTS_HOME.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function agentsFile(env = process.env) {
  const home = env.DSH_AGENTS_HOME ?? path.join(os.homedir(), '.agents');
  return path.join(home, 'AGENTS.md');
}

/**
 * Install, check, dry-run or remove one managed block.
 * @param {object} options
 * @param {string} options.label installer name shown in the report
 * @param {string} options.kind block kind, as used in the markers
 * @param {string} options.source canonical block file
 * @param {string} options.target AGENTS.md to write
 * @param {string} options.command command shown in hints, e.g. `node global/install.mjs`
 * @param {string[]} [options.requiredHeadings] headings the final file must carry
 * @param {((state: {target: string, text: string, targetExists: boolean}) => string | null)} [options.note]
 *   optional extra line, for a guardrail the other installer owns
 * @param {string[]} [options.args] command-line arguments; defaults to process.argv
 * @param {{write: (chunk: string) => unknown}} [options.stdout]
 * @param {{write: (chunk: string) => unknown}} [options.stderr]
 * @returns {number} exit code
 */
export function installBlock(options) {
  const {
    label,
    kind,
    source,
    target,
    command,
    requiredHeadings = [],
    note = null,
    args = process.argv.slice(2),
    stdout = process.stdout,
    stderr = process.stderr,
  } = options;

  const unknown = args.filter((arg) => !KNOWN_ARGS.has(arg));
  if (unknown.length > 0) {
    stderr.write(`unknown option: ${unknown.join(', ')}\nTry --help.\n`);
    return 2;
  }

  if (args.includes('--help') || args.includes('-h')) {
    stdout.write(
      `Usage: ${command} [--check|--dry-run|--remove]\n` +
        '  (no option)  install or update the block\n' +
        '  --check      exit 1 when the target is missing or stale\n' +
        '  --dry-run    report the status, write nothing\n' +
        '  --remove     remove the block this installer owns\n',
    );
    return 0;
  }

  const checkOnly = args.includes('--check');
  const dryRun = args.includes('--dry-run');
  const remove = args.includes('--remove');
  if ([checkOnly, dryRun, remove].filter(Boolean).length > 1) {
    stderr.write('choose one of --check, --dry-run and --remove.\n');
    return 2;
  }
  const mode = checkOnly ? 'check' : remove ? 'remove' : dryRun ? 'dry-run' : 'write';

  let block;
  try {
    block = fs.readFileSync(source, 'utf8');
  } catch {
    stderr.write(`cannot read the canonical block: ${source}\n`);
    return 2;
  }

  const blockErrors = validateBlockText(block, kind);
  if (blockErrors.length > 0) {
    stderr.write(`refusing malformed block in ${source}:\n`);
    for (const error of blockErrors) stderr.write(`  - ${error}\n`);
    return 2;
  }

  const targetExists = fs.existsSync(target);
  const existing = targetExists ? fs.readFileSync(target, 'utf8') : '';

  let result;
  try {
    result = remove ? removeBlock(existing, kind) : applyBlock(existing, block, kind);
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 2;
  }

  if (!remove) {
    const missing = missingHeadings(result.text, requiredHeadings);
    if (missing.length > 0) {
      stderr.write('the target would lack a required guardrail heading:\n');
      for (const heading of missing) stderr.write(`  - ${heading}\n`);
      return 2;
    }
  }

  stdout.write(`${label}\n`);
  stdout.write(`  source : ${source}\n`);
  stdout.write(`  target : ${target}${targetExists ? '' : ' (missing)'}\n`);
  stdout.write(`  block  : ${block.split('\n').length - 1} lines\n`);
  stdout.write(`  mode   : ${mode}\n\n`);

  if (note && !remove) {
    const message = note({ target, text: result.text, targetExists });
    if (message) stdout.write(`  NOTE         ${message}\n`);
  }

  if (!result.changed) {
    stdout.write('  up to date\n');
    return 0;
  }

  if (checkOnly) {
    stdout.write(`  OUT OF DATE — run ${command}\n`);
    return 1;
  }

  if (dryRun) {
    stdout.write(`  would ${remove ? 'remove the block' : 'write the block'}\n`);
    stdout.write('\nDry run — nothing written.\n');
    return 0;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, result.text, 'utf8');

  stdout.write(`  ${remove ? 'removed' : targetExists ? 'updated' : 'installed'}      ${target}\n`);
  if (!remove) {
    stdout.write(`\nRestart the harness to pick up the change. Verify: ${command} --check\n`);
  }
  return 0;
}
