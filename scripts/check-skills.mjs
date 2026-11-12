#!/usr/bin/env node
/**
 * Check the skill tree before a commit or after an import.
 *
 * Every check reads files and prints findings; nothing is rewritten. `hard` findings exit 1, `soft`
 * ones are reported and left to judgement. The patterns, frontmatter rules and naming rules live in
 * `scripts/lib/check-skills-lib.mjs`.
 *
 * Usage (from this repository):
 *   node scripts/check-skills.mjs            # the whole `.agents/skills` tree
 *   node scripts/check-skills.mjs <dir>      # one skill folder
 *
 * The importer skill is skipped on purpose: its own files define the placeholders and patterns this
 * check looks for, and it documents them as text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSkill, checkText, referencesIn, skillsIn } from './lib/check-skills-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = path.join(root, '.agents', 'skills');
const skipped = new Set(['node_modules', 'import-cc-generic-configuration-and-adapt']);
const textExtensions = new Set(['.md', '.mjs', '.js', '.sh', '.json', '.txt']);
const target = process.argv[2] ? path.resolve(root, process.argv[2]) : skillsDir;

if (!fs.existsSync(target)) {
  process.stderr.write(`no such directory: ${target}\n`);
  process.exit(2);
}

const skillFolders = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !skipped.has(entry.name))
  .map((entry) => entry.name);
const known = new Set(skillFolders);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipped.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const findings = [];
let files = 0;
let skills = 0;

for (const file of walk(target)) {
  const extension = path.extname(file).toLowerCase();
  if (!textExtensions.has(extension)) continue;
  const relative = path.relative(root, file).split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');
  files += 1;

  if (path.basename(file) === 'SKILL.md') {
    skills += 1;
    findings.push(...checkSkill({ folder: path.basename(path.dirname(file)), text }));
  }
  findings.push(...checkText({ path: relative, text, extension }));

  if (extension === '.md') {
    const dir = path.dirname(file);
    for (const reference of referencesIn(text)) {
      if (!fs.existsSync(path.join(dir, reference))) {
        findings.push({ kind: 'hard', rule: 'reference:missing', detail: `${relative} -> ${reference}` });
      }
    }
    for (const skill of skillsIn(text)) {
      if (!known.has(skill)) {
        findings.push({ kind: 'hard', rule: 'skill:unknown', detail: `${relative} -> ${skill}` });
      }
    }
  }
}

const hard = findings.filter((finding) => finding.kind === 'hard');
const soft = findings.filter((finding) => finding.kind === 'soft');

process.stdout.write(`checked ${skills} skills, ${files} files in ${path.relative(root, target) || '.'}\n`);
process.stdout.write(`hard findings: ${hard.length}\n`);
for (const finding of hard) process.stdout.write(`  ${finding.rule}  ${finding.detail}\n`);
process.stdout.write(`soft findings: ${soft.length}\n`);
for (const finding of soft) process.stdout.write(`  ${finding.rule}  ${finding.detail}\n`);
process.exit(hard.length === 0 ? 0 : 1);
