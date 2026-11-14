/**
 * Moving the original PDF and its companions into the document's folder.
 *
 * A companion shares the PDF's stem and continues with a separator, so the
 * abstract beside `paper.pdf` travels with it. The move is opt-in, refuses to
 * overwrite, and never touches another PDF — that is a document, not a
 * companion, and the next extraction still needs its input.
 */
import assert from "node:assert/strict";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { companionFiles, extractOne, main, moveSourceFiles, parseArgs } from "../scripts/extract-pdf.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PDF = path.join(HERE, "resources", "embedded-images-tables.pdf");

function withTemp(body) {
  const root = mkdtempSync(path.join(tmpdir(), "pdf-move-source-"));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** A paper with its abstract, notes, a lookalike and an unrelated file. */
function writeBundle(root) {
  const pdf = path.join(root, "My Paper.pdf");
  copyFileSync(PDF, pdf);
  writeFileSync(path.join(root, "My Paper - abstract.txt"), "the abstract\n");
  writeFileSync(path.join(root, "My Paper.notes.md"), "the notes\n");
  writeFileSync(path.join(root, "My Paper2.txt"), "not a companion\n");
  writeFileSync(path.join(root, "Other.txt"), "unrelated\n");
  copyFileSync(PDF, path.join(root, "My Paper - appendix.pdf"));
  mkdirSync(path.join(root, "My Paper - folder"));
  return pdf;
}

test("companions share the stem and a separator", () => {
  withTemp((root) => {
    const names = companionFiles(writeBundle(root))
      .map((file) => path.basename(file))
      .sort();
    assert.deepEqual(names, ["My Paper - abstract.txt", "My Paper.notes.md"]);
  });
});

test("--move-source is opt-in", () => {
  assert.equal(parseArgs(["paper.pdf"]).moveSource, false);
  assert.equal(parseArgs(["paper.pdf", "--move-source"]).moveSource, true);
});

test("moves the PDF and its companions into the document folder", () => {
  withTemp((root) => {
    const pdf = writeBundle(root);
    const result = extractOne(pdf, { raster: false, moveSource: true });

    assert.deepEqual(result.moved, [
      "My Paper - abstract.txt",
      "My Paper.notes.md",
      "My Paper.pdf",
    ]);
    const folder = path.join(root, "my-paper");
    for (const name of result.moved) {
      assert.ok(existsSync(path.join(folder, name)), `${name} is in the folder`);
    }
    assert.equal(existsSync(pdf), false, "the source PDF left its old folder");
    assert.ok(existsSync(path.join(root, "My Paper2.txt")), "a lookalike stays put");
    assert.ok(existsSync(path.join(root, "Other.txt")), "an unrelated file stays put");
    assert.ok(existsSync(path.join(root, "My Paper - appendix.pdf")), "another PDF stays put");
    assert.ok(existsSync(path.join(root, "My Paper - folder")), "a folder stays put");
  });
});

test("refuses to overwrite an existing file and moves nothing", () => {
  withTemp((root) => {
    const pdf = writeBundle(root);
    const out = path.join(root, "chosen");
    mkdirSync(out);
    writeFileSync(path.join(out, "My Paper - abstract.txt"), "already here\n");

    assert.throws(
      () => extractOne(pdf, { out, raster: false, moveSource: true }),
      /refusing to overwrite My Paper - abstract\.txt/,
    );
    assert.ok(existsSync(pdf), "the PDF is still in place");
    assert.equal(
      readFileSync(path.join(root, "My Paper - abstract.txt"), "utf8"),
      "the abstract\n",
    );
  });
});

test("moving into the folder the files already sit in is a no-op", () => {
  withTemp((root) => {
    const pdf = writeBundle(root);
    assert.deepEqual(moveSourceFiles(pdf, root), []);
  });
});

test("the command line moves the source when asked", () => {
  withTemp((root) => {
    const pdf = path.join(root, "Paper.pdf");
    copyFileSync(PDF, pdf);
    writeFileSync(path.join(root, "Paper - abstract.txt"), "abstract\n");

    assert.equal(main([pdf, "--move-source", "--no-raster"]), 0);
    assert.ok(existsSync(path.join(root, "paper", "Paper.pdf")));
    assert.ok(existsSync(path.join(root, "paper", "Paper - abstract.txt")));
    assert.equal(existsSync(pdf), false);
  });
});
