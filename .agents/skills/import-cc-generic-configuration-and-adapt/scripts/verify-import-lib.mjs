import fs from 'node:fs';
import path from 'node:path';
import {
  REFUSED,
  SKIP_DIRS,
  TEXT_EXT,
  checkSkillText,
  checkTextRules,
  isSecret,
} from './verify-import-rules.mjs';

export function listSkills(target) {
  const skillsDir = path.join(target, '.agents', 'skills');
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function walk(dir, visit, selfDir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || full === selfDir) continue;
      walk(full, visit, selfDir);
    } else if (entry.isFile()) {
      visit(full);
    }
  }
}

export function verifyTarget(target, { selfDir = null } = {}) {
  const issues = [];
  const count = { files: 0, skills: 0 };
  const report = (file, rule) => issues.push(`${path.relative(target, file)}: ${rule}`);
  const claudePrefix = path.join(target, 'claude') + path.sep;

  const checkText = (full) => {
    if (!TEXT_EXT.has(path.extname(full).toLowerCase())) return;
    const text = fs.readFileSync(full, 'utf8');
    count.files += 1;
    for (const rule of checkTextRules(full, text, { isShim: full.startsWith(claudePrefix) })) {
      report(full, rule);
    }
  };

  const checkSkill = (full) => {
    count.skills += 1;
    const text = fs.readFileSync(full, 'utf8');
    for (const rule of checkSkillText(path.basename(path.dirname(full)), text)) {
      report(full, rule);
    }
  };

  walk(
    target,
    (full) => {
      if (path.basename(full) === 'SKILL.md') checkSkill(full);
      checkText(full);
    },
    selfDir,
  );

  return { target, files: count.files, skills: count.skills, issues };
}

export function verifySource(source) {
  const issues = [];
  const notes = [];

  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.claude-generic-') && path.resolve(full) !== path.resolve(source)) {
          notes.push(`nested export skipped: ${path.relative(source, full)}`);
          continue;
        }
        scan(full);
      } else if (entry.isFile()) {
        if (REFUSED.includes(entry.name)) {
          issues.push(`${path.relative(source, full)}: refused`);
        } else if (TEXT_EXT.has(path.extname(full).toLowerCase())) {
          const secret = isSecret(fs.readFileSync(full, 'utf8'));
          if (secret) issues.push(`${path.relative(source, full)}: secret:${secret}`);
        }
      }
    }
  };

  scan(source);
  return { source, issues, notes };
}

export function runVerification(argv, { cwd = process.cwd(), defaultTarget = null, selfDir = null } = {}) {
  const arg = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const sourceArg = arg('--source');
  const targetArg = arg('--target');
  const source = sourceArg ? path.resolve(cwd, sourceArg) : null;
  const target = targetArg ? path.resolve(cwd, targetArg) : defaultTarget;

  if (!target || !fs.existsSync(target)) {
    return { exitCode: 2, error: `target not found: ${target}` };
  }
  if (source && !fs.existsSync(source)) {
    return { exitCode: 2, error: `source not found: ${source}` };
  }

  const targetResult = verifyTarget(target, { selfDir });
  const sourceResult = source ? verifySource(source) : { issues: [], notes: [] };
  const issues = [...sourceResult.issues, ...targetResult.issues];

  return {
    exitCode: issues.length === 0 ? 0 : 1,
    target,
    source,
    files: targetResult.files,
    skills: targetResult.skills,
    notes: sourceResult.notes,
    issues,
    list: !source && argv.includes('--list') ? listSkills(target) : [],
  };
}

export function formatReport(result) {
  const lines = [...result.list];
  lines.push(`target: ${result.target}`);
  if (result.source) lines.push(`source: ${result.source}`);
  lines.push(`checked: ${result.files} text files, ${result.skills} skills`);
  for (const note of result.notes) lines.push(`note: ${note}`);

  if (result.issues.length === 0) {
    lines.push('0 issues');
  } else {
    lines.push(`issues: ${result.issues.length}`);
    for (const issue of result.issues) lines.push(`- ${issue}`);
  }
  return lines;
}
