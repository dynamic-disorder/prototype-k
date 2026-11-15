#!/usr/bin/env node
/**
 * Render the tracked model tiers into the running DSH profile's patch layer.
 *
 * The template is the source:
 *
 *   <repo>/dsh/dsh_profile_patch.yaml  ->  <dsh home>/profiles/<profile>/cordis.patch.yml
 *
 * Only the entries named in the template are touched, matched by `id`. Every other entry in the
 * patch file — the `ui-*` rows the desktop app writes, and anything hand-written — is carried
 * through byte-for-byte, because the app rewrites that file through a comment-preserving YAML AST
 * and owns only the entry it edited. This installer behaves the same way, so the two do not fight.
 *
 * Two values are probed rather than declared, because they are machine facts:
 *
 *   - the local model list, filtered to what `ollama list` reports (a declared model that is not
 *     pulled would put a row in the picker that answers 404)
 *   - the vision model, the first installed entry of `visionModels`
 *
 * A machine with no Ollama gets the DeepSeek tiers only: the provider and vision entries are left
 * alone and reported as skipped, never written half-configured.
 *
 * Usage (from this repository):
 *   node scripts/install-dsh.mjs             # check; exit 1 when the profile drifted from the template
 *   node scripts/install-dsh.mjs --write     # render the template into the profile's patch file
 *   node scripts/install-dsh.mjs --profile tui
 *
 * Environment:
 *   DSH_HOME      overrides ~/.dsh
 *   DSH_PROFILE   overrides the profile id (default: desktop)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { deepEqual, formatYaml, mergePatch, parseYaml, splitPatch } from './lib/dsh-patch.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatePath = path.join(root, 'dsh', 'dsh_profile_patch.yaml');

function usage() {
  process.stdout.write(
    'Usage: node scripts/install-dsh.mjs [--check|--write] [--profile <id>] [--dsh-home <path>]\n' +
      '  (no option)  check the profile patch against dsh/dsh_profile_patch.yaml\n' +
      '  --check      the same check, named explicitly so the rule and the script agree\n' +
      '  --write      render the template into the profile patch\n' +
      '  --profile    profile id to render (default: $DSH_PROFILE or desktop)\n' +
      '  --dsh-home   DSH home to use (default: $DSH_HOME or ~/.dsh)\n',
  );
}

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  usage();
  process.exit(0);
}

function optionValue(name) {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

const unknown = argv.filter((arg, index) => {
  if (arg === '--write' || arg === '--check') return false;
  if (arg === '--profile' || arg === '--dsh-home') return false;
  return !(index > 0 && ['--profile', '--dsh-home'].includes(argv[index - 1]));
});
if (unknown.length > 0) {
  process.stderr.write(`unknown option: ${unknown.join(' ')}\n`);
  process.exit(2);
}

const mode = argv.includes('--write') ? 'write' : 'check';
const dshHome = optionValue('--dsh-home') ?? process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh');
const profile = optionValue('--profile') ?? process.env.DSH_PROFILE ?? 'desktop';
const patchPath = path.join(dshHome, 'profiles', profile, 'cordis.patch.yml');

const MODEL_TOKEN = '{{localModels}}';
const VISION_TOKEN = '{{visionModel}}';

function probeOllama() {
  try {
    const out = execFileSync('ollama', ['list'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 20_000,
      windowsHide: true,
    });
    const names = new Set();
    for (const line of out.split(/\r?\n/).slice(1)) {
      const name = line.trim().split(/\s+/)[0];
      if (name) names.add(name);
    }
    return { available: true, names };
  } catch {
    return { available: false, names: new Set() };
  }
}

function resolveTokens(value, localModels, visionModel) {
  if (typeof value === 'string') {
    if (value === MODEL_TOKEN) return localModels;
    if (value === VISION_TOKEN) return visionModel;
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => resolveTokens(item, localModels, visionModel));
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = resolveTokens(child, localModels, visionModel);
    }
    return out;
  }
  return value;
}

/** Drop a provider whose only models are missing, rather than declaring an empty list. */
function pruneEmptyModels(entry) {
  const ollama = entry?.config?.providers?.ollama;
  if (!ollama || !Array.isArray(ollama.models)) return entry;
  if (ollama.models.length > 0) return entry;
  delete entry.config.providers.ollama;
  if (Object.keys(entry.config.providers).length === 0) delete entry.config.providers;
  if (Object.keys(entry.config).length === 0) delete entry.config;
  return entry;
}

if (!fs.existsSync(templatePath)) {
  process.stderr.write(`template not found: ${templatePath}\n`);
  process.exit(2);
}

let template;
try {
  template = parseYaml(fs.readFileSync(templatePath, 'utf8'));
} catch (error) {
  process.stderr.write(`template is not readable: ${error.message}\n`);
  process.exit(2);
}
if (!template || !Array.isArray(template.patches)) {
  process.stderr.write(`template has no "patches" list: ${templatePath}\n`);
  process.exit(2);
}

const ollama = probeOllama();
const localModels = (template.localModels ?? [])
  .filter((id) => ollama.names.has(id))
  .map((id) => ({ id, name: id }));
const visionModel = (template.visionModels ?? []).find((id) => ollama.names.has(id)) ?? null;

const skipped = [];
const wanted = [];
for (const patch of template.patches) {
  const entry = pruneEmptyModels(resolveTokens(patch, localModels, visionModel));
  if (entry.config === undefined && entry.id === 'llm-pi-ai' && localModels.length === 0) {
    skipped.push([entry.id, 'no local model installed']);
    continue;
  }
  if (entry.config === undefined && entry.id === 'vision-toolkit') {
    skipped.push([entry.id, 'no vision model installed']);
    continue;
  }
  wanted.push(entry);
}

let current = fs.existsSync(patchPath) ? fs.readFileSync(patchPath, 'utf8') : '';
let blocks = [];
if (current.trim() !== '') {
  try {
    const parsed = splitPatch(current).blocks;
    blocks = parsed;
  } catch (error) {
    process.stderr.write(`${patchPath} is not readable: ${error.message}\n`);
    process.exit(2);
  }
}

const byId = new Map(blocks.filter((block) => block.id !== null).map((block) => [block.id, block]));
const statuses = [];
for (const entry of wanted) {
  const block = byId.get(entry.id);
  if (!block) {
    statuses.push([entry.id, 'missing']);
    continue;
  }
  if (block.entry === null) {
    statuses.push([entry.id, 'unreadable']);
    continue;
  }
  statuses.push([entry.id, deepEqual(block.entry, entry) ? 'ok' : 'stale']);
}

const drift = statuses.filter(([, status]) => status !== 'ok');

process.stdout.write(`source : ${templatePath}\n`);
process.stdout.write(`target : ${patchPath}\n`);
process.stdout.write(`profile: ${profile}\n`);
process.stdout.write(
  `ollama : ${ollama.available ? `${ollama.names.size} models installed, ${localModels.length} in the local tier` : 'not reachable'}\n`,
);
process.stdout.write(`mode   : ${mode}\n\n`);

for (const [id, status] of statuses) process.stdout.write(`  ${status.padEnd(10)} ${id}\n`);
for (const [id, reason] of skipped) process.stdout.write(`  ${'skipped'.padEnd(10)} ${id} (${reason})\n`);

if (drift.length === 0) {
  process.stdout.write('\nThe profile patch matches the template.\n');
  process.exit(0);
}

if (mode === 'check') {
  process.stdout.write(`\n${drift.length} entr${drift.length === 1 ? 'y' : 'ies'} differ — run with --write.\n`);
  process.exit(1);
}

const next = current.trim() === '' ? formatYaml(wanted) : mergePatch(current, wanted);
fs.mkdirSync(path.dirname(patchPath), { recursive: true });
const temporary = `${patchPath}.tmp-${process.pid}`;
fs.writeFileSync(temporary, next);
fs.renameSync(temporary, patchPath);

process.stdout.write(`\nRendered ${wanted.length} entr${wanted.length === 1 ? 'y' : 'ies'} into ${patchPath}.\n`);
process.stdout.write('A running harness picks this up on its next start; restart it to apply.\n');
