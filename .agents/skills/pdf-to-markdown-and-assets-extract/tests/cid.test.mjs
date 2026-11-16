/**
 * CID and hex-string decoding: the case that used to extract as blank pages.
 *
 * A `Type0` font addresses glyphs by CID, so its text is written as hex strings
 * (`<00010002>`) and means nothing without the font's `/ToUnicode` map. These
 * fixtures are generated here, so the test carries no document of its own: one
 * page, one CID font, one hex string, and the map that gives the codes letters.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import {
  hexToText,
  listPages,
  parseCidWidths,
  stringBytes,
  toUnicodeMap,
  writeExtraction,
} from "../lib/pdf-extract.mjs";

const TO_UNICODE = [
  "/CIDInit /ProcSet findresource begin",
  "12 dict begin",
  "begincmap",
  "1 begincodespacerange",
  "<0000> <FFFF>",
  "endcodespacerange",
  "1 beginbfchar",
  "<0001> <0041>",
  "endbfchar",
  "1 beginbfchar",
  "<0002> <0042>",
  "endbfchar",
  "1 beginbfrange",
  "<0010> <0012> <0044>",
  "endbfrange",
  "endcmap",
  "CMapName currentdict /CMap defineresource pop",
  "end",
  "end",
].join("\n");

/**
 * A one-page PDF whose text is hex strings in a CID font.
 * @param {{ toUnicode?: boolean }} options
 * @returns {Buffer}
 */
function cidPdf({ toUnicode = true } = {}) {
  const content = [
    "BT /F0 12 Tf 72 720 Td <00010002> Tj ET",
    "BT /F0 12 Tf 72 700 Td <001000110012> Tj ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources 5 0 R /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Font << /F0 6 0 R >> >>",
    `<< /Type /Font /Subtype /Type0 /BaseFont /Test+Font /Encoding /Identity-H ` +
      `/DescendantFonts [7 0 R]${toUnicode ? " /ToUnicode 9 0 R" : ""} >>`,
    "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Test+Font " +
      "/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> " +
      "/DW 1000 /W [1 [500 600] 16 [700 800 900]] >>",
    null,
    `<< /Length ${TO_UNICODE.length} >>\nstream\n${TO_UNICODE}\nendstream`,
  ];

  const parts = ["%PDF-1.7\n"];
  const offsets = [];
  objects.forEach((body, index) => {
    if (body === null) return;
    const number = index + 1;
    offsets[number] = parts.join("").length;
    parts.push(`${number} 0 obj\n${body}\nendobj\n`);
  });
  const startXref = parts.join("").length;
  const xref = [
    `xref\n0 ${objects.length + 1}`,
    "0000000000 65535 f",
    ...objects.map((_, index) =>
      offsets[index + 1] === undefined
        ? "0000000000 00000 f"
        : `${String(offsets[index + 1]).padStart(10, "0")} 00000 n`,
    ),
  ].join("\n");
  parts.push(`${xref}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`);
  parts.push(`startxref\n${startXref}\n%%EOF\n`);
  return Buffer.from(parts.join(""), "latin1");
}

const roots = [];
function withTemp(work) {
  const root = mkdtempSync(path.join(tmpdir(), "cid-"));
  roots.push(root);
  try {
    return work(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe("hex strings and CID fonts", () => {
  it("decodes a hex string to its bytes", () => {
    assert.equal(stringBytes("<00410042>"), "\u0000A\u0000B");
    assert.equal(stringBytes("<4142>"), "AB");
  });

  it("decodes a ToUnicode destination as UTF-16BE", () => {
    assert.equal(hexToText("0041"), "A");
    assert.equal(hexToText("00E9"), "\u00e9");
    assert.equal(hexToText("41"), "A");
  });

  it("reads both width forms of /W", () => {
    const widths = parseCidWidths("/DW 1000 /W [1 [500 600] 16 [700 800 900] 30 32 250]");
    assert.equal(widths.get(1), 500);
    assert.equal(widths.get(2), 600);
    assert.equal(widths.get(16), 700);
    assert.equal(widths.get(18), 900);
    assert.equal(widths.get(30), 250);
    assert.equal(widths.get(32), 250);
  });

  it("maps bfchar and bfrange codes", () => {
    const data = cidPdf();
    const text = data.toString("latin1");
    const objects = new Map();
    for (const match of text.matchAll(/(\d+) 0 obj\b/g)) {
      objects.set(Number(match[1]), { dict: text.slice(match.index, match.index + 400), stream: null });
    }
    const map = toUnicodeMap(new Map([[9, { dict: ">>", stream: TO_UNICODE }]]), "/ToUnicode 9 0 R");
    assert.equal(map.get(1), "A");
    assert.equal(map.get(2), "B");
    assert.equal(map.get(0x10), "D");
    assert.equal(map.get(0x12), "F");
  });

  it("extracts the text of a CID page instead of a blank page", () => {
    const pages = listPages(cidPdf());
    assert.equal(pages.length, 1);
    assert.equal(pages[0].text, "AB\nDEF");
    assert.equal(pages[0].unmapped, 0);
  });

  it("records unmapped glyphs instead of inventing letters", () => {
    const pages = listPages(cidPdf({ toUnicode: false }));
    assert.equal(pages[0].text, "");
    assert.equal(pages[0].unmapped, 5);
  });

  it("writes the CID text with one page marker and a sidecar", () => {
    withTemp((root) => {
      const { md, meta } = writeExtraction(cidPdf(), root, "cid-page");
      const body = readFileSync(md, "utf8");
      assert.equal(body.match(/<!-- page: \d+ -->/g).length, 1);
      assert.equal(body.split("\n")[0], "<!-- page: 1 -->");
      assert.ok(body.includes("AB"), "the first run keeps its letters");
      assert.ok(body.includes("DEF"), "the range-mapped run keeps its letters");
      const sidecar = JSON.parse(readFileSync(meta, "utf8"));
      assert.equal(sidecar.pages, 1);
      assert.equal(sidecar.unmappedGlyphs, 0);
    });
  });
});
