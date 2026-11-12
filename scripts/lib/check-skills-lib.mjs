/**
 * Pure checks for a skill tree: frontmatter, leftovers, reference mentions and naming. The runner
 * (`scripts/check-skills.mjs`) walks the filesystem and prints what these functions return.
 */
import { findLeaks } from './export-plan.mjs';

/** Frontmatter keys that belong to a Claude-only surface, never to a neutral skill. */
export const FORBIDDEN_FRONTMATTER_KEYS = ['model', 'user-invocable', 'allowed-tools', 'context', 'agent'];

// The literals are assembled from parts on purpose: this file is scanned by the checks it defines, so a
// registry of leftovers must not match itself.
const join = (...chunks) => chunks.join('');
const placeholder = (token) => new RegExp(`<${token}>`);

/** Text left over from a source export. The Claude layer is refused because it is not part of the home. */
export const LEFTOVERS = [
  { rule: 'placeholder-product-name', re: placeholder(join('PRODUCT', '_NAME')) },
  { rule: 'placeholder-company-name', re: placeholder(join('COMPANY', '_OR_ORGANIZATION_NAME')) },
  { rule: 'placeholder-ticket-key', re: placeholder(join('PROJECT', '_TICKET', '_PREFIX')) },
  { rule: 'substitute-mocking-library', re: new RegExp(`\\b${join('NSub', 'stitute')}\\b`) },
  { rule: 'path-temp-scratch', re: new RegExp(`\\b${join('temp', '_user_files')}\\b`) },
  { rule: 'arguments-positional-token', re: new RegExp(join('\\$', 'ARGUMENTS')) },
  { rule: 'path-claude-layer', re: /~\/\.claude|\.claude\// },
  { rule: 'ticket-wording', re: new RegExp([join('ticket', '[- ]', 'prefix'), join('ticket', ' ', 'key'), join('TICKET', '_PREFIX')].join('|'), 'i') },
];

/** Skill names a folder may carry: lower-case kebab-case. */
export const SKILL_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Document names in the tree: snake_case, ASCII, no spaces. README.md and SKILL.md are fixed by the tools. */
export const DOC_NAME_RE = /^[a-z0-9_]+\.md$/;

/** Frontmatter fields, or null when the block is missing or unterminated. */
export function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  const raw = match[1];
  return {
    raw,
    name: raw.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? '',
    description: raw.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? '',
  };
}

/** The document's H1: the first `# ` line outside a fenced code block, or null when there is none. */
export function firstHeading(text) {
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = line.match(/^# (.+)$/);
    if (match) return match[1].trim();
  }
  return null;
}

/** Findings for one `SKILL.md`: `hard` blocks a run, `soft` is reported for judgement. */
export function checkSkill({ folder, text }) {
  const findings = [];
  const add = (kind, rule) => findings.push({ kind, rule, detail: folder });
  const frontmatter = parseFrontmatter(text);
  if (!frontmatter) {
    add('hard', 'frontmatter:missing');
    return findings;
  }
  if (!frontmatter.name) add('hard', 'frontmatter:name-missing');
  if (!frontmatter.description) add('hard', 'frontmatter:description-missing');
  if (frontmatter.name && frontmatter.name !== folder) add('hard', 'frontmatter:name-mismatch');
  if (frontmatter.name && !SKILL_NAME_RE.test(frontmatter.name)) add('hard', 'frontmatter:name-format');
  if (frontmatter.description && frontmatter.description.length > 1024) add('soft', 'description:over-1024');
  for (const key of FORBIDDEN_FRONTMATTER_KEYS) {
    if (new RegExp(`^${key}:`, 'm').test(frontmatter.raw)) add('hard', `frontmatter:claude-key:${key}`);
  }
  const h1 = firstHeading(text);
  if (!h1) add('soft', 'heading:missing');
  else if (frontmatter.name && h1 !== frontmatter.name) add('soft', 'heading:not-the-name');
  return findings;
}

/** Findings for any text file: leftovers, machine identifiers and the doc naming rule. */
export function checkText({ path, text, extension }) {
  const findings = [];
  for (const { rule, re } of LEFTOVERS) {
    if (re.test(text)) findings.push({ kind: 'hard', rule, detail: path });
  }
  for (const leak of findLeaks(text)) {
    findings.push({ kind: 'hard', rule: `machine-identifier:${leak.rule}`, detail: `${path}:${leak.line}` });
  }
  if (extension === '.md') {
    const base = path.split('/').pop();
    if (!['SKILL.md', 'README.md'].includes(base) && !DOC_NAME_RE.test(base)) {
      findings.push({ kind: 'soft', rule: 'name:not-snake-case', detail: path });
    }
  }
  return findings;
}

/** `references/...` paths a document names, as links or in code spans, deduplicated. */
export function referencesIn(text) {
  const found = new Set();
  for (const match of text.matchAll(/\]\((references\/[^)\s]+)\)/g)) found.add(match[1].split('#')[0]);
  for (const match of text.matchAll(/`(references\/[^`]+)`/g)) found.add(match[1].split('#')[0]);
  return [...found].sort();
}

/** Skill names a document invokes as `Skill(<name>)`, deduplicated. */
export function skillsIn(text) {
  const found = new Set();
  for (const match of text.matchAll(/Skill\(([a-z0-9-]+)/g)) found.add(match[1]);
  return [...found].sort();
}
