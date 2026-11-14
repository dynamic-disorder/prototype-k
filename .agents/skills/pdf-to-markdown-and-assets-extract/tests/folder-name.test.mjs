/**
 * One folder per document: the portable name rules and where the CLI writes.
 *
 * A document's folder is derived from its name, so the same tree has to survive
 * a copy between Windows, Linux and macOS. These cases pin the rule (lowercase
 * ASCII, no Windows-reserved name, capped length with a distinguishing digest)
 * and the layout: `<pdf dir>/<name>/<name>.md`, never a shared `extracted/`.
 */
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { folderNameFor, MAX_FOLDER_NAME_LENGTH } from "../lib/folder-name.mjs";
import { documentName, extractOne, main } from "../scripts/extract-pdf.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PDF = path.join(HERE, "resources", "embedded-images-tables.pdf");

function withTemp(body) {
  const root = mkdtempSync(path.join(tmpdir(), "pdf-folder-name-"));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("keeps an already portable document name unchanged", () => {
  assert.equal(folderNameFor("phonebot-2610.08737v1"), "phonebot-2610.08737v1");
});

test("turns a paper title into a readable lowercase folder", () => {
  assert.equal(
    folderNameFor("PhoneBot - A Low-Cost Open Humanoid Robot Platform (2610.08737v1)"),
    "phonebot-a-low-cost-open-humanoid-robot-platform-2610.08737v1",
  );
});

test("strips accents and folds case, so a case-insensitive filesystem agrees", () => {
  assert.equal(folderNameFor("Résumé"), "resume");
  assert.equal(folderNameFor("PhoneBot"), folderNameFor("phonebot"));
});

test("replaces every character Windows forbids", () => {
  assert.equal(folderNameFor('a<b>c:d"e/f\\g|h?i*j'), "a-b-c-d-e-f-g-h-i-j");
});

test("drops leading and trailing dots, spaces and dashes", () => {
  assert.equal(folderNameFor("  .report name.  "), "report-name");
});

test("never returns a Windows device name", () => {
  assert.equal(folderNameFor("CON"), "con-doc");
  assert.equal(folderNameFor("com1"), "com1-doc");
  assert.equal(folderNameFor("COM0"), "com0");
});

test("uses a fallback when nothing usable is left", () => {
  for (const input of ["", "   ", "///", "..."]) {
    assert.equal(folderNameFor(input), "document");
  }
});

test("caps a long name and keeps two long names apart", () => {
  const prefix = "a-very-long-document-title-".repeat(6);
  const first = folderNameFor(`${prefix}first`);
  const second = folderNameFor(`${prefix}second`);

  assert.ok(first.length <= MAX_FOLDER_NAME_LENGTH);
  assert.ok(Buffer.byteLength(first, "utf8") <= MAX_FOLDER_NAME_LENGTH);
  assert.match(first, /-[0-9a-f]{8}$/);
  assert.notEqual(first, second);
  assert.equal(folderNameFor(`${prefix}first`), first, "the name is deterministic");
});

test("documentName prefers --name over the PDF basename", () => {
  assert.equal(documentName(PDF, "Custom Name"), "custom-name");
  assert.equal(documentName(PDF), "embedded-images-tables");
});

test("extractOne writes one folder per document beside the PDF", () => {
  withTemp((root) => {
    const pdf = path.join(root, "My Paper (2026).pdf");
    copyFileSync(PDF, pdf);

    const result = extractOne(pdf, { raster: false });

    assert.equal(result.name, "my-paper-2026");
    assert.ok(existsSync(path.join(root, "my-paper-2026", "my-paper-2026.md")));
    assert.ok(
      existsSync(path.join(root, "my-paper-2026", "my-paper-2026.extraction-summary.json")),
    );
    assert.equal(existsSync(path.join(root, "extracted")), false, "no shared extracted folder");
  });
});

test("an explicit output directory still wins", () => {
  withTemp((root) => {
    const pdf = path.join(root, "paper.pdf");
    copyFileSync(PDF, pdf);
    const out = path.join(root, "chosen");

    const result = extractOne(pdf, { out, raster: false });

    assert.equal(result.name, "paper");
    assert.ok(existsSync(path.join(out, "paper.md")));
    assert.equal(existsSync(path.join(root, "paper")), false);
  });
});

test("refuses two documents that would share one folder", () => {
  withTemp((root) => {
    copyFileSync(PDF, path.join(root, "A B.pdf"));
    copyFileSync(PDF, path.join(root, "A-B.pdf"));

    assert.equal(main([root]), 1, "a collision must fail, not overwrite");
    assert.equal(existsSync(path.join(root, "a-b")), false, "nothing is written");
  });
});
