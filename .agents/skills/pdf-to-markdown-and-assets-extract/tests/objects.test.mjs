/**
 * Reading objects past a stream whose `/Length` is a reference.
 *
 * A PDF may write `/Length 1178 0 R`; read as a byte count, the scan jumps 1178
 * bytes past the stream and swallows the object after it. In one thesis that
 * object was an object stream holding ten pages, so a 90-page document
 * extracted as 80.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { listPages, readObjects } from "../lib/pdf-extract.mjs";

const CONTENT = "BT ET";

function indirectLengthPdf() {
  const body = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >> endobj",
    `4 0 obj << /Length 7 0 R >>\nstream\n${CONTENT}\nendstream\nendobj`,
    "5 0 obj << /Note (written later) >> endobj",
    "7 0 obj 5 endobj",
  ];
  const parts = ["%PDF-1.7\n"];
  const offsets = [];
  for (const [index, object] of body.entries()) {
    offsets.push(parts.join("").length);
    parts.push(`${object}\n`);
  }
  const xref = [
    `xref\n0 ${body.length + 1}`,
    "0000000000 65535 f",
    ...body.map((_, index) => `${String(offsets[index]).padStart(10, "0")} 00000 n`),
  ].join("\n");
  parts.push(`${xref}\ntrailer\n<< /Size ${body.length + 1} /Root 1 0 R >>\nstartxref\n0\n%%EOF\n`);
  return Buffer.from(parts.join(""), "latin1");
}

describe("a stream whose /Length is an indirect reference", () => {
  it("ends the stream at endstream, not at the reference's number", () => {
    const objects = readObjects(indirectLengthPdf().toString("latin1"));
    assert.equal(objects.get(4).stream.trim(), CONTENT);
  });

  it("still finds the object written after that stream", () => {
    const objects = readObjects(indirectLengthPdf().toString("latin1"));
    assert.ok(objects.has(5), "the following object is not swallowed");
    assert.match(objects.get(5).dict, /written later/);
  });

  it("keeps every page of the document", () => {
    assert.equal(listPages(indirectLengthPdf()).length, 1);
  });
});
