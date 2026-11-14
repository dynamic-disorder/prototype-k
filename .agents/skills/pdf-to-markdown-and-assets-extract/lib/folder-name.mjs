/**
 * The portable per-document folder name.
 *
 * Every extraction writes one folder of its own beside the source PDF, so two
 * documents never share a directory. That folder has to survive a copy between
 * Windows, Linux and macOS, which disagree about legal characters, case and
 * path length. The rules keep the name to lowercase ASCII `[a-z0-9._-]`, drop
 * the characters Windows rejects and the leading or trailing dots and spaces
 * it silently strips, rename the reserved device names, and cap the length.
 *
 * The cap is 100 characters, set by the longest artifact the extractor writes:
 * `<name>.extraction-summary.json` adds 24 characters, so the file path is at
 * most 124 characters and the source folder may spend 135 of the 259-character
 * Windows path. A longer name keeps its first 91 characters and gains `-` plus
 * 8 hex digits of its own digest, so two names that share a prefix stay apart.
 *
 * A name that differs only in case, accents, spaces or punctuation maps to the
 * same folder. That is deliberate on a case-insensitive filesystem, and it is
 * also the documented collision case: the CLI refuses two documents that would
 * land in one folder instead of letting the second overwrite the first.
 *
 * @module folder-name
 */
import { createHash } from "node:crypto";

/** Longest folder name this module emits, in ASCII characters. */
export const MAX_FOLDER_NAME_LENGTH = 100;

/** Windows device names, reserved with or without an extension. */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

/**
 * Turn a document name into one portable folder name.
 *
 * The result contains only lowercase `a-z`, `0-9`, `.`, `_` and `-`, never
 * starts or ends with a separator or a dot, is never a Windows device name,
 * and is at most `MAX_FOLDER_NAME_LENGTH` characters long. An empty or
 * entirely unusable input becomes `document`.
 *
 * @param {string} source the document name, normally the PDF's basename
 * @returns {string}
 */
export function folderNameFor(source) {
  const original = String(source ?? "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "");

  let name = original
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");

  if (name === "") name = "document";
  if (RESERVED.test(name)) name = `${name}-doc`;

  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    const suffix = createHash("sha256").update(original).digest("hex").slice(0, 8);
    const keep = MAX_FOLDER_NAME_LENGTH - suffix.length - 1;
    name = `${name.slice(0, keep).replace(/[._-]+$/g, "")}-${suffix}`;
  }

  return name;
}
