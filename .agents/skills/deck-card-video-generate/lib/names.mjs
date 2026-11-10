/** Safe output basenames: no paths, no reserved device names, no control characters. */

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Turn a requested name into a safe file basename.
 * `../../evil` becomes `evil`; `CON` becomes `_CON`; an empty result falls back.
 */
export function sanitizeBaseName(value, fallback = 'demo') {
  const raw = String(value ?? '').trim();
  const parts = raw.replace(/\\/g, '/').split('/');
  let name = parts[parts.length - 1];
  name = name.replace(/[^A-Za-z0-9._-]+/g, '-');
  name = name.replace(/-+/g, '-').replace(/^[.-]+|[.-]+$/g, '');
  if (!name) name = fallback;

  const stem = name.split('.')[0];
  if (RESERVED.test(stem)) name = `_${name}`;

  name = name.slice(0, 80).replace(/[.-]+$/g, '');
  return name || fallback;
}
