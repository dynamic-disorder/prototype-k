/** CLI entry-point detection, so scripts can be imported by tests. */
import path from "node:path";
import { fileURLToPath } from "node:url";

/** True when the module at `importMetaUrl` is the script Node was started with. */
export function isMain(importMetaUrl) {
  if (process.argv[1] === undefined) return false;

  let modulePath;
  try {
    modulePath = fileURLToPath(importMetaUrl);
  } catch {
    return false;
  }
  return path.resolve(process.argv[1]) === path.resolve(modulePath);
}
