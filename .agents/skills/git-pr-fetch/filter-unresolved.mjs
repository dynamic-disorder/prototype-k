// Filter unresolved review comment threads. Thin runner: logic is in filter-unresolved-lib.mjs (unit tested).
// Usage: node filter-unresolved.mjs <review_comments.json> <pr_author>
import { existsSync, readFileSync } from 'node:fs';
import { runFilter } from './filter-unresolved-lib.mjs';

process.exitCode = runFilter(process.argv.slice(2), {
  readFile: p => (existsSync(p) ? readFileSync(p, 'utf8') : null),
  out: s => process.stdout.write(s),
  err: s => process.stderr.write(s),
});
