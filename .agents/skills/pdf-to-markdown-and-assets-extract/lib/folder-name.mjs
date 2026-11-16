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
 * The cap is 50 characters, set by readability rather than by path length: a
 * name longer than that is cut at the last separator that fits, before the word
 * that would cross the cap. Two names that share a 50-character prefix therefore
 * map to one folder, which is the documented collision case — the CLI refuses it
 * and `--name` settles it.
 *
 * A name that differs only in case, accents, spaces or punctuation maps to the
 * same folder. That is deliberate on a case-insensitive filesystem, and it is
 * also the documented collision case: the CLI refuses two documents that would
 * land in one folder instead of letting the second overwrite the first.
 *
 * @module folder-name
 */

/** Longest folder name this module emits, in ASCII characters. */
export const MAX_FOLDER_NAME_LENGTH = 50;

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

  let name = original.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");

  // A scraped page puts its subtitle after a double underscore:
  // `title__the_short_story_about_…`. The title alone names the folder, so the
  // second half never repeats itself at length in the path. A single underscore
  // stays, because it is legal everywhere and often part of the title.
  const split = name.search(/_{2,}/);
  if (split >= 3) name = name.slice(0, split);

  name = name
    .replace(/-{2,}/g, "-")
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "");

  if (name === "") name = "document";
  if (RESERVED.test(name)) name = `${name}-doc`;

  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    // Cut before the word that would cross the cap, never through it: a name
    // that ends `…et_harvest` stays readable, where `…et_harv` is a fragment.
    const window = name.slice(0, MAX_FOLDER_NAME_LENGTH + 1);
    const boundary = Math.max(
      window.lastIndexOf("-"),
      window.lastIndexOf("_"),
      window.lastIndexOf("."),
    );
    name = (boundary > 0 ? window.slice(0, boundary) : window.slice(0, MAX_FOLDER_NAME_LENGTH))
      .replace(/[._-]+$/g, "");
  }

  return name;
}
