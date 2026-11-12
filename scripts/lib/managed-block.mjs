/**
 * Managed-block text handling, shared by every installer that injects a block into AGENTS.md.
 *
 * A block is delimited by two markers that name its kind, so two installers can own two blocks in
 * the same file without touching each other:
 *
 *   <!-- BEGIN managed: shared-agent-notes -->   ...   <!-- END managed: shared-agent-notes -->
 *   <!-- BEGIN managed: documentation-style -->  ...   <!-- END managed: documentation-style -->
 *
 * The functions are pure: they take file text and return new text, so the installers stay thin
 * wrappers around the filesystem and every edge case is unit tested.
 */

export const SHARED_KIND = 'shared-agent-notes';
export const STYLE_KIND = 'documentation-style';

/**
 * Return the begin and end marker lines for a block kind.
 * @param {string} kind
 * @returns {{begin: string, end: string}}
 */
export function markers(kind) {
  if (typeof kind !== 'string' || kind.trim() === '') {
    throw new Error('block kind must be a non-empty string');
  }
  return {
    begin: `<!-- BEGIN managed: ${kind} -->`,
    end: `<!-- END managed: ${kind} -->`,
  };
}

export const BEGIN_MARKER = markers(SHARED_KIND).begin;
export const END_MARKER = markers(SHARED_KIND).end;

/**
 * Return the text with Windows line endings normalised to LF.
 * @param {string} text
 * @returns {string}
 */
export function toLf(text) {
  return text.replace(/\r\n/g, '\n');
}

/**
 * Return the line ending the text already uses, so a rewrite keeps the file's convention.
 * @param {string} text
 * @returns {'\n' | '\r\n'}
 */
export function detectEol(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/**
 * Check that a block file is exactly one self-contained managed block of the expected kind.
 *
 * A block that carries a second begin marker, no end marker, a foreign kind or no body would
 * corrupt the target on replace, so the installer refuses it before touching any file.
 * @param {string} blockText
 * @param {string} [kind]
 * @returns {string[]} one message per defect; empty when the block is usable
 */
export function validateBlockText(blockText, kind = SHARED_KIND) {
  const { begin, end } = markers(kind);
  const errors = [];
  const text = toLf(blockText);

  if (!text.startsWith(`${begin}\n`)) {
    errors.push(`block must start with ${begin}`);
  }
  if (text.split(begin).length - 1 !== 1) {
    errors.push('block must contain exactly one begin marker');
  }
  if (text.split(end).length - 1 !== 1) {
    errors.push('block must contain exactly one end marker');
  }
  if (!text.trimEnd().endsWith(end)) {
    errors.push(`block must end with ${end}`);
  }

  const foreign = [...text.matchAll(/<!-- (?:BEGIN|END) managed: (.+?) -->/g)].filter(
    (match) => match[1] !== kind,
  );
  if (foreign.length > 0) {
    errors.push('block must not carry another managed block');
  }

  const start = text.indexOf(`${begin}\n`);
  const stop = text.indexOf(end);
  if (start >= 0 && stop > start) {
    const body = text.slice(start + begin.length, stop).trim();
    if (body.length === 0) errors.push('block body must not be empty');
  }

  return errors;
}

/**
 * Locate one kind of managed block in existing text.
 * @param {string} text
 * @param {string} [kind]
 * @returns {{start: number, end: number} | null} character offsets: start of the begin marker line,
 *   and the offset just after the end marker line
 */
export function locateBlock(text, kind = SHARED_KIND) {
  const { begin, end } = markers(kind);
  const lf = toLf(text);
  const start = lf.indexOf(begin);
  if (start < 0) return null;

  const stop = lf.indexOf(end, start);
  if (stop < 0) {
    throw new Error(`managed block is malformed: ${end} is missing`);
  }
  if (lf.indexOf(begin, start + begin.length) >= 0) {
    throw new Error('managed block is malformed: the begin marker appears twice');
  }

  const lineEnd = lf.indexOf('\n', stop);
  return { start, end: lineEnd < 0 ? lf.length : lineEnd + 1 };
}

/**
 * Insert the block, or replace the existing block of the same kind, leaving everything else as it is.
 * @param {string} existing current target text, or an empty string when the target does not exist
 * @param {string} blockText the canonical block, including its markers
 * @param {string} [kind]
 * @returns {{text: string, changed: boolean}}
 */
export function applyBlock(existing, blockText, kind = SHARED_KIND) {
  const errors = validateBlockText(blockText, kind);
  if (errors.length > 0) {
    throw new Error(`refusing malformed block: ${errors.join('; ')}`);
  }

  const eol = detectEol(existing);
  const current = toLf(existing);
  const block = `${toLf(blockText).trimEnd()}\n`;
  const found = locateBlock(current, kind);

  let next;
  if (!found) {
    const base = current.trim() === '' ? '' : `${current.replace(/\n+$/, '')}\n\n`;
    next = `${base}${block}`;
  } else {
    next = `${current.slice(0, found.start)}${block}${current.slice(found.end)}`;
  }

  const changed = next !== current;
  return { text: eol === '\r\n' ? next.replace(/\n/g, '\r\n') : next, changed };
}

/**
 * Remove one kind of managed block and leave the rest of the file in place.
 * @param {string} existing current target text
 * @param {string} [kind]
 * @returns {{text: string, changed: boolean}}
 */
export function removeBlock(existing, kind = SHARED_KIND) {
  const current = toLf(existing);
  const found = locateBlock(current, kind);
  if (!found) return { text: existing, changed: false };

  let next = `${current.slice(0, found.start)}${current.slice(found.end)}`.replace(/\n{3,}/g, '\n\n');
  next = next.replace(/^\n+/, '').trimEnd();
  next = next === '' ? '' : `${next}\n`;
  return { text: next, changed: next !== current };
}

/**
 * Report headings that the target must carry, so a truncated canonical file is caught at install time.
 * @param {string} text
 * @param {string[]} headings literal heading lines
 * @returns {string[]} the headings that are absent
 */
export function missingHeadings(text, headings) {
  const lf = toLf(text);
  return headings.filter((heading) => !lf.includes(heading));
}
