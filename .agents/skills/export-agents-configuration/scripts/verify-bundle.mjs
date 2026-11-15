#!/usr/bin/env node
/**
 * Verify a received `.agents` bundle against its own MANIFEST.json before anyone installs it.
 *
 * Read-only. Catches a truncated download, a lost executable bit, a skill whose frontmatter name no
 * longer matches its folder, and a bundle that is missing the installer or the gate.
 *
 * Usage:
 *   node verify-bundle.mjs [<bundle-dir>]   # default: the current directory; run it from the bundle
 *
 * Exit codes: 0 clean, 1 findings, 2 no manifest or usage error.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REQUIRED = ['AGENTS.md', 'install.mjs', 'INSTALL.md', 'githooks/pre-commit'];

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function walk(dir, relative = '') {
  const found = [];
  for (const entry of fs.readdirSync(path.join(dir, relative), { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...walk(dir, child));
    else if (entry.isFile()) found.push(child);
  }
  return found;
}

function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return null;
  return {
    name: match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? null,
    description: match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? null,
  };
}

/**
 * Check one bundle directory and return its findings.
 * @param {string} dir
 * @returns {{findings: Array<{kind: string, detail: string}>, files: number, manifest: boolean}}
 */
export function verifyBundleDir(dir) {
  const findings = [];
  const manifestPath = path.join(dir, 'MANIFEST.json');
  let files;
  try {
    files = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files;
  } catch {
    return { findings: [{ kind: 'error', detail: 'no usable MANIFEST.json' }], files: 0, manifest: false };
  }
  if (!files || typeof files !== 'object') {
    return { findings: [{ kind: 'error', detail: 'MANIFEST.json has no files map' }], files: 0, manifest: false };
  }

  const listed = new Set();
  for (const [rel, expected] of Object.entries(files)) {
    if (rel.startsWith('/') || rel.split('/').includes('..')) {
      findings.push({ kind: 'error', detail: `unsafe manifest path: ${rel}` });
      continue;
    }
    listed.add(rel);
    const absolute = path.join(dir, ...rel.split('/'));
    let digest;
    try {
      digest = sha256(fs.readFileSync(absolute));
    } catch {
      findings.push({ kind: 'error', detail: `missing: ${rel}` });
      continue;
    }
    if (digest !== expected) findings.push({ kind: 'error', detail: `hash mismatch: ${rel}` });
  }

  for (const rel of walk(dir)) {
    if (rel !== 'MANIFEST.json' && !listed.has(rel)) {
      findings.push({ kind: 'warn', detail: `not in the manifest: ${rel}` });
    }
  }

  for (const rel of REQUIRED) {
    if (!fs.existsSync(path.join(dir, ...rel.split('/')))) {
      findings.push({ kind: 'error', detail: `required file absent: ${rel}` });
    }
  }

  const skills = Object.keys(files).filter((rel) => /^skills\/[^/]+\/SKILL\.md$/.test(rel));
  if (skills.length === 0) findings.push({ kind: 'error', detail: 'the bundle carries no skill' });
  for (const rel of skills) {
    const folder = rel.split('/')[1];
    const meta = frontmatter(fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8'));
    if (!meta) {
      findings.push({ kind: 'error', detail: `no frontmatter: ${rel}` });
      continue;
    }
    if (meta.name !== folder) {
      findings.push({ kind: 'error', detail: `name ${meta.name} does not match folder ${folder}` });
    }
    if (!meta.description) findings.push({ kind: 'error', detail: `no description: ${rel}` });
    else if (meta.description.length > 1024) findings.push({ kind: 'error', detail: `description too long: ${rel}` });
  }

  if (process.platform !== 'win32') {
    try {
      const mode = fs.statSync(path.join(dir, 'githooks', 'pre-commit')).mode;
      if ((mode & 0o111) === 0) findings.push({ kind: 'error', detail: 'githooks/pre-commit is not executable' });
    } catch {
      // Reported by the required-file check.
    }
  }

  return { findings, files: Object.keys(files).length, manifest: true };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write('Usage: node verify-bundle.mjs [<bundle-dir>]\n');
    return 0;
  }
  const dir = path.resolve(args[0] ?? process.cwd());
  if (!fs.existsSync(dir)) {
    process.stderr.write(`verify-bundle: no such directory: ${dir}\n`);
    return 2;
  }
  const { findings, files, manifest } = verifyBundleDir(dir);
  if (!manifest) {
    for (const finding of findings) process.stderr.write(`verify-bundle: ${finding.detail}\n`);
    return 2;
  }
  process.stdout.write(`bundle : ${dir}\nmanifest: ${files} file(s)\n\n`);
  for (const finding of findings) {
    process.stdout.write(`  ${finding.kind === 'error' ? 'FAIL' : 'warn'} ${finding.detail}\n`);
  }
  const errors = findings.filter((finding) => finding.kind === 'error').length;
  if (errors > 0) {
    process.stdout.write(`\n${errors} finding(s) — do not install this bundle.\n`);
    return 1;
  }
  process.stdout.write(
    '\nClean. Install with:\n  node install.mjs --check\n  node install.mjs --write\n  node install.mjs --check\n',
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
