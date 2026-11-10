/**
 * Count the active beats in a record.mjs source.
 *
 * A beat is an uncommented `at(...)` call between the BEATS markers. The
 * template ships its example beats as comments, so an unedited copy counts 0.
 */
export function countBeats(source) {
  let inBlock = false;
  let found = false;
  let count = 0;

  for (const line of String(source).split(/\r?\n/)) {
    const stripped = line.trim();
    if (/\bEND\s+BEATS\b/.test(stripped)) {
      inBlock = false;
      continue;
    }
    if (!inBlock && /^\/\/\s*-{3,}\s*BEATS\b/.test(stripped)) {
      inBlock = true;
      found = true;
      continue;
    }
    if (!inBlock || stripped.startsWith('//') || stripped.startsWith('#')) continue;
    const matches = stripped.match(/\bat\s*\(/g);
    if (matches) count += matches.length;
  }

  return { count, found };
}
