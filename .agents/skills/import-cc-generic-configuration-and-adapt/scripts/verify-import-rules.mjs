import path from 'node:path';

export const SKIP_DIRS = new Set(['.git', 'node_modules', 'bin', 'obj', 'dist', 'local_user_files', 'claude']);
export const TEXT_EXT = new Set(['.md', '.mjs', '.js', '.sh', '.ps1', '.json', '.txt', '.yml', '.yaml', '.cs']);
export const REFUSED = [
  'claude_placeholder_values.txt',
  'env-db.sh',
  'env-db.md',
  'env-github.sh',
  'env-github.md',
  'repo-env-db.sh',
  'repo-env-db.md',
  'repo-env-github.sh',
  'repo-env-github.md',
  'windows-credential-store.ps1',
  'git_commit_secret_scan_allowlist.txt',
];
export const SECRET_PATTERNS = [
  ['aws-access-key', /AKIA[0-9A-Z]{16}/],
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['github-token', /gh[pousr]_[A-Za-z0-9]{20,}/],
  ['slack-token', /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ['provider-key', /sk-[A-Za-z0-9]{20,}/],
];

export function isSecret(text) {
  return SECRET_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

export function isRefusedName(name) {
  return REFUSED.includes(name);
}

export function checkSkillText(folderName, text) {
  const rules = [];
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return ['frontmatter:missing'];

  const name = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!name) rules.push('frontmatter:name');
  if (!description) rules.push('frontmatter:description');
  if (name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) rules.push('frontmatter:name-format');
  if (name && name !== folderName) rules.push('frontmatter:name-mismatch');
  return rules;
}

export function checkTextRules(fileName, text, { isShim = false } = {}) {
  const rules = [];

  const secret = isSecret(text);
  if (secret) rules.push(`secret:${secret}`);

  for (const [rule, pattern] of [
    ['placeholder:PRODUCT_NAME', /<PRODUCT_NAME>/],
    ['placeholder:COMPANY', /<COMPANY_OR_ORGANIZATION_NAME>/],
    ['placeholder:TICKET_PREFIX', /<PROJECT_TICKET_PREFIX>/],
    ['substitute:NSubstitute', /\bNSubstitute\b/],
    ['path:temp_user_files', /\btemp_user_files\b/],
    ['commit:ticket-prefix', /ticket[- ]prefix|ticket key|TICKET_PREFIX/i],
  ]) {
    if (pattern.test(text)) rules.push(rule);
  }

  if (!isShim) {
    const extension = path.extname(fileName).toLowerCase();
    const runtime = ['.sh', '.mjs', '.js', '.ps1', '.json'].includes(extension);
    if ((runtime || path.basename(fileName) === 'SKILL.md') && /~\/\.claude|\.claude\//.test(text)) {
      rules.push('path:claude');
    }
  }

  return rules;
}
