/**
 * The YAML subset the DSH profile patch uses, and the merge that keeps everything else intact.
 *
 * The patch file is a top-level YAML sequence of entries, each `{ id, name?, config? }`. It is
 * written by the desktop app through a comment-preserving AST, so a hand-rolled parser is the one
 * thing that can silently corrupt it. Two rules follow:
 *
 *   - **Refuse rather than guess.** Tab indentation, `!!js` tags and flow collections throw; the
 *     installer then stops with a message instead of rewriting a file it does not understand.
 *   - **Only the entries named here are rewritten.** Unmanaged blocks are carried through
 *     byte-for-byte, so the app's own `ui-*` rows and any hand note survive a render.
 *
 * No dependency: this repository has no YAML package, and adding one to parse a 2 KB file with a
 * fixed shape would be a worse trade than the ninety lines below.
 */

// A colon is legal inside a plain scalar (`qwen3.8:27b`, `http://host:11434/v1`) as long as it is
// not followed by a space; a leading indicator character is not, so `@scope/name` stays quoted.
const PLAIN_SCALAR = /^[A-Za-z0-9_./:@-]+$/;
const LEADING_INDICATOR = /^[-?:,[\]{}#&*!|>'"%@`]/;
const RESERVED = /^(true|false|null|~)$/i;

function fail(line, message) {
  throw new Error(`yaml line ${line}: ${message}`);
}

/** Remove a trailing `#` comment, respecting quoted strings. */
function stripComment(line) {
  let out = '';
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      out += ch;
      if (quote === '"' && ch === '\\') {
        out += line[i + 1] ?? '';
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) break;
    out += ch;
  }
  return out;
}

function tokenize(text) {
  const tokens = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (/^ *\t/.test(raw)) fail(i + 1, 'tab indentation is refused; use spaces');
    if (/^\s*!!/.test(raw) || /:\s+!!/.test(raw)) fail(i + 1, 'explicit YAML tags are refused');
    const line = stripComment(raw);
    if (line.trim() === '') continue;
    const indent = line.length - line.trimStart().length;
    tokens.push({ indent, text: line.trim(), line: i + 1 });
  }
  return tokens;
}

function parseScalar(text, line) {
  if (text.startsWith('[') || text.startsWith('{')) fail(line, 'flow collections are refused');
  if (text.startsWith('"')) {
    if (!text.endsWith('"') || text.length < 2) fail(line, 'unterminated double-quoted scalar');
    try {
      return JSON.parse(text);
    } catch {
      fail(line, 'invalid escape in double-quoted scalar');
    }
  }
  if (text.startsWith("'")) {
    if (!text.endsWith("'") || text.length < 2) fail(line, 'unterminated single-quoted scalar');
    return text.slice(1, -1).replaceAll("''", "'");
  }
  if (text === '' || text === '~' || /^null$/i.test(text)) return null;
  if (/^true$/i.test(text)) return true;
  if (/^false$/i.test(text)) return false;
  if (/^-?\d+$/.test(text)) return Number.parseInt(text, 10);
  if (/^-?\d+\.\d+$/.test(text)) return Number.parseFloat(text);
  return text;
}

function matchKey(text) {
  const at = text.indexOf(':');
  if (at <= 0) return null;
  const key = text.slice(0, at).trim();
  const rest = text.slice(at + 1);
  if (rest !== '' && !/^\s/.test(rest)) return null;
  return { key, rest: rest.trim() };
}

const isSeqItem = (text) => text === '-' || text.startsWith('- ');

function parseBlock(tokens, index, indent) {
  if (index >= tokens.length) return [null, index];
  return isSeqItem(tokens[index].text)
    ? parseSequence(tokens, index, indent)
    : parseMapping(tokens, index, indent);
}

function parseMapping(tokens, index, indent) {
  const value = {};
  let i = index;
  while (i < tokens.length && tokens[i].indent === indent && !isSeqItem(tokens[i].text)) {
    const token = tokens[i];
    const pair = matchKey(token.text);
    if (!pair) fail(token.line, `expected "key: value", found "${token.text}"`);
    i += 1;
    if (pair.rest === '') {
      if (i < tokens.length && tokens[i].indent > indent) {
        const [child, next] = parseBlock(tokens, i, tokens[i].indent);
        value[pair.key] = child;
        i = next;
      } else {
        value[pair.key] = null;
      }
      continue;
    }
    value[pair.key] = parseScalar(pair.rest, token.line);
  }
  return [value, i];
}

function parseSequence(tokens, index, indent) {
  const value = [];
  let i = index;
  while (i < tokens.length && tokens[i].indent === indent && isSeqItem(tokens[i].text)) {
    const token = tokens[i];
    const inline = token.text.slice(1).trim();
    i += 1;
    if (inline === '') {
      if (i < tokens.length && tokens[i].indent > indent) {
        const [child, next] = parseBlock(tokens, i, tokens[i].indent);
        value.push(child);
        i = next;
      } else {
        value.push(null);
      }
      continue;
    }
    const pair = matchKey(inline);
    if (!pair) {
      value.push(parseScalar(inline, token.line));
      continue;
    }
    // An inline mapping on the dash line: parse this pair, then the rest at the item's own indent.
    const itemIndent = indent + 2;
    const item = {};
    if (pair.rest === '') {
      if (i < tokens.length && tokens[i].indent > itemIndent) {
        const [child, next] = parseBlock(tokens, i, tokens[i].indent);
        item[pair.key] = child;
        i = next;
      } else {
        item[pair.key] = null;
      }
    } else {
      item[pair.key] = parseScalar(pair.rest, token.line);
    }
    const [rest, next] = parseMapping(tokens, i, itemIndent);
    Object.assign(item, rest);
    value.push(item);
    i = next;
  }
  return [value, i];
}

/** Parse the profile patch document. Throws on anything outside the supported subset. */
export function parseYaml(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;
  const [value, consumed] = parseBlock(tokens, 0, tokens[0].indent);
  if (consumed !== tokens.length) {
    fail(tokens[consumed].line, 'unexpected indentation or content');
  }
  return value;
}

function formatScalar(value) {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const text = String(value);
  const plain =
    PLAIN_SCALAR.test(text) && !RESERVED.test(text) && !text.includes(': ') && !LEADING_INDICATOR.test(text);
  if (plain) return text;
  return JSON.stringify(text);
}

function emitMapping(value, indent) {
  const pad = ' '.repeat(indent);
  const lines = [];
  for (const [key, child] of Object.entries(value)) {
    if (child !== null && typeof child === 'object') {
      lines.push(`${pad}${key}:`, ...emit(child, indent + 2));
      continue;
    }
    lines.push(`${pad}${key}: ${formatScalar(child)}`);
  }
  return lines;
}

function emitSequence(value, indent) {
  const pad = ' '.repeat(indent);
  const lines = [];
  for (const item of value) {
    if (item === null || typeof item !== 'object') {
      lines.push(`${pad}- ${formatScalar(item)}`);
      continue;
    }
    const [first, ...rest] = Object.entries(item);
    if (first === undefined) {
      lines.push(`${pad}- {}`);
      continue;
    }
    const [key, child] = first;
    if (child !== null && typeof child === 'object') {
      lines.push(`${pad}- ${key}:`, ...emit(child, indent + 4));
    } else {
      lines.push(`${pad}- ${key}: ${formatScalar(child)}`);
    }
    if (rest.length > 0) lines.push(...emitMapping(Object.fromEntries(rest), indent + 2));
  }
  return lines;
}

function emit(value, indent) {
  if (Array.isArray(value)) return emitSequence(value, indent);
  if (value !== null && typeof value === 'object') return emitMapping(value, indent);
  throw new Error('cannot format a bare scalar as a YAML document');
}

/** Canonical YAML for one entry or a document, newline-terminated. */
export function formatYaml(value) {
  return `${emit(value, 0).join('\n')}\n`;
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
}

/**
 * Split the document into the preamble (comments before the first entry) and one block per entry.
 * Each block keeps its own lines so a rewritten entry cannot disturb its neighbours.
 */
export function splitPatch(text) {
  const lines = text.split('\n');
  const preamble = [];
  const blocks = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith('- ')) {
      if (current) blocks.push(current);
      current = { lines: [line] };
      continue;
    }
    if (current) current.lines.push(line);
    else preamble.push(line);
  }
  if (current) blocks.push(current);

  for (const block of blocks) {
    const pair = matchKey(block.lines[0].slice(2).trim());
    block.id = pair && pair.key === 'id' ? String(parseScalar(pair.rest, 1)) : null;
    block.entry = null;
    try {
      // One block is a sequence of exactly one item; the entry is that item, not the sequence.
      const parsed = parseYaml(block.lines.join('\n'));
      block.entry = Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed;
    } catch {
      block.entry = null;
    }
  }
  return { preamble, blocks };
}

function joinLines(lines) {
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

/**
 * Merge the wanted entries into the document, replacing only their own blocks.
 *
 * A block's leading comments and trailing blank lines travel with it, so a comment placed above an
 * entry is not deleted by a render. An entry that is absent is appended at the end.
 */
export function mergePatch(text, wanted) {
  const { preamble, blocks } = splitPatch(text);
  const pending = new Map(wanted.map((entry) => [entry.id, entry]));
  const out = [...preamble];

  for (const block of blocks) {
    const target = block.id === null ? undefined : pending.get(block.id);
    if (!target) {
      out.push(...block.lines);
      continue;
    }
    pending.delete(block.id);
    let head = 0;
    while (head < block.lines.length && /^\s*(#.*)?$/.test(block.lines[head])) head += 1;
    let tail = block.lines.length;
    while (tail > head && block.lines[tail - 1].trim() === '') tail -= 1;
    out.push(
      ...block.lines.slice(0, head),
      ...formatYaml([target]).split('\n').slice(0, -1),
      ...block.lines.slice(tail),
    );
  }

  for (const entry of pending.values()) out.push(...formatYaml([entry]).split('\n').slice(0, -1));
  return joinLines(out);
}
