/** Timestamped run folders under test-results/. */
import fs from 'node:fs';
import path from 'node:path';

/**
 * `YYYY-MM-DD_HH-mm.sss` in local time. The colon from the requested
 * `hh:MM.sss` is replaced with `-` because Windows forbids `:` in names.
 */
export function timestamp(date = new Date()) {
  const pad = (value, width = 2) => String(value).padStart(width, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}-${pad(date.getMinutes())}.${pad(date.getMilliseconds(), 3)}`
  );
}

/** Create a unique run folder, appending -1, -2 if two runs share a millisecond. */
export function createRunDir(root) {
  const base = path.join(root, 'test-results', timestamp());
  let dir = base;
  let suffix = 1;
  while (fs.existsSync(dir)) {
    dir = `${base}-${suffix}`;
    suffix += 1;
  }
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
