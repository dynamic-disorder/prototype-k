/**
 * True when this module is the script Node was started with.
 *
 * A plain string compare is wrong here. The skill is installed as a link —
 * `~/.agents/skills/<name>` points at the checkout — so `process.argv[1]` keeps
 * the link path while `import.meta.url` resolves to the target. The two never
 * match, `main` is skipped, and the script exits 0 having done nothing, which
 * reads as success to a caller. Comparing real paths fixes it.
 */
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param {string} moduleUrl the caller's `import.meta.url`
 * @returns {boolean}
 */
export function invokedDirectly(moduleUrl) {
  if (process.argv[1] === undefined) return false;

  const script = path.resolve(process.argv[1]);
  const module = path.resolve(fileURLToPath(moduleUrl));
  if (script === module) return true;

  try {
    const resolve = realpathSync.native ?? realpathSync;
    return resolve(script) === resolve(module);
  } catch {
    return false;
  }
}
