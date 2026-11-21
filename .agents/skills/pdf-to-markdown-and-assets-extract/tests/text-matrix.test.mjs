/**
 * Regression cases for the text matrix and line matrix.
 *
 * The 431-page run that prompted these tests fused every word whose spaces were
 * drawn as separate `( ) Tj` runs, because the parser never advanced the text
 * matrix after a show operation. `Td` then compounded from the wrong origin and
 * a line could reorder itself. These cases are hand-built content streams, so
 * they fail on the rule, not on a fixture PDF.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { groupLines, normalizeText, parseContent, textQuality } from "../lib/pdf-extract.mjs";

/** Parse one content stream and return its runs. */
function runsFor(content) {
  const runs = [];
  parseContent(content, runs, new Map());
  return runs;
}

/** Parse one content stream and return its laid-out lines. */
function linesFor(content) {
  return groupLines(runsFor(content));
}

describe("text matrix", () => {
  test("advances after a Tj so the next run has its own x", () => {
    const lines = linesFor("BT /F1 10 Tf 72 720 Td (A) Tj (B) Tj ET");

    assert.equal(lines.length, 1);
    assert.equal(lines[0].text, "AB");
    assert.deepEqual(lines[0].parts.map((part) => part.x), [72, 77]);
  });

  test("keeps the space drawn as a separate whitespace Tj", () => {
    const lines = linesFor("BT /F1 10 Tf 72 720 Td (A) Tj ( ) Tj (B) Tj ET");

    assert.equal(lines.length, 1);
    assert.equal(lines[0].text, "A B");
    assert.deepEqual(lines[0].parts.map((part) => part.x), [72, 82]);
  });

  test("applies Td from the line origin, not from the advanced text position", () => {
    const lines = linesFor("BT /F1 10 Tf 72 720 Td (A) Tj 10 0 Td (B) Tj ET");

    assert.equal(lines.length, 1);
    assert.equal(lines[0].text, "A B");
    assert.deepEqual(lines[0].parts.map((part) => part.x), [72, 82]);
  });

  test("keeps a leading TJ gap before a separately drawn citation number", () => {
    const lines = linesFor("BT /F1 10 Tf 72 720 Td (A) Tj [-500(B)] TJ ET");

    assert.equal(lines.length, 1);
    assert.equal(lines[0].text, "A B");
    assert.deepEqual(lines[0].parts.map((part) => part.x), [72, 77]);
    assert.equal(lines[0].parts[1].text, " B");
  });

  test("preserves stream order when a same-size x inversion proves a broken matrix", () => {
    // `D` is placed left of the `e` that stream order puts before it. Sorting
    // by x would read `D` first; the page drew `e`, then `D`.
    const lines = linesFor(
      "BT /F1 10 Tf 72 720 Td (e) Tj -3 0 Td (D) Tj 6 0 Td (esign) Tj ET",
    );

    assert.equal(lines.length, 1);
    assert.equal(lines[0].text, "eDesign");
  });
});

describe("separated diaeresis", () => {
  test("recomposes the spacing diaeresis before a vowel", () => {
    assert.equal(normalizeText("Suvi Sipil\u00a8a"), "Suvi Sipilä");
    assert.equal(normalizeText("S\u00a8ailytyspaikka"), "Säilytyspaikka");
    assert.equal(normalizeText("F\u00a8orvaringsst\u00a8alle"), "Förvaringsställe");
    assert.equal(normalizeText("\u00a8Ovriga"), "Övriga");
    assert.equal(normalizeText("mit \u00a8 a tahansa"), "mitä tahansa");
    assert.equal(normalizeText("k \u00a8 asittely"), "käsittely");
    assert.equal(normalizeText("Vidgen.\u00a8 An exploration"), "Vidgen. An exploration");
    assert.equal(normalizeText("sitaatti [CK91"), "sitaatti [CK91]");
    assert.equal(normalizeText("Kuva 3.1: WTFs per minute [Hol08"), "Kuva 3.1: WTFs per minute [Hol08]");
  });

  test("leaves a combining mark to NFC", () => {
    assert.equal(normalizeText("Sipila\u0308"), "Sipilä");
  });
});

describe("text quality evidence", () => {
  test("reports a long fused line and a long token", () => {
    const quality = textQuality([
      {
        lines: [
          { text: "A normal line keeps its words apart." },
          { text: "afusedlinethatcarriesfortyormorecharacters" },
          { text: "implementationsimilar" },
        ],
      },
    ]);

    assert.equal(quality.noSpaceLines, 1);
    assert.equal(quality.longTokens, 2, "both long fused strings are long tokens");
    assert.ok(quality.warnings.length >= 1);
    assert.match(quality.warnings.join(" "), /no space/);
    assert.ok(quality.samples.some((sample) => sample.startsWith("afusedline")));
  });

  test("does not warn on a table of contents dot leader", () => {
    const quality = textQuality([
      { lines: [{ text: "Foreword.............................................................9" }] },
    ]);

    assert.equal(quality.noSpaceLines, 0);
    assert.deepEqual(quality.warnings, []);
  });

  test("does not warn on a URL line with no spaces", () => {
    const quality = textQuality([
      { lines: [{ text: "//www.appjetty.com/blog/acceptable-response-rate-for-online-" }] },
    ]);

    assert.equal(quality.noSpaceLines, 0);
    assert.deepEqual(quality.warnings, []);
  });

  test("does not warn on a code line with no spaces", () => {
    const quality = textQuality([
      { lines: [{ text: "_fontName->SetText(_fontList->GetSelection());" }] },
    ]);

    assert.equal(quality.noSpaceLines, 0);
    assert.deepEqual(quality.warnings, []);
  });

  test("counts long tokens and warns without failing", () => {
    const tokens = Array.from({ length: 11 }, (_, index) =>
      String.fromCharCode(97 + index).repeat(20),
    );
    const quality = textQuality([{ lines: [{ text: tokens.join(" ") }] }]);

    assert.equal(quality.longTokens, 11);
    assert.match(quality.warnings.join(" "), /20 letters/);
  });

  test("stays quiet on ordinary prose", () => {
    const quality = textQuality([
      { lines: [{ text: "The pattern name is a handle we can use to describe a design problem." }] },
    ]);

    assert.deepEqual(quality.warnings, []);
  });
});
