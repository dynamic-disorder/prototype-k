/**
 * Regression tests for the math path: the font slots, the scripts, the fraction
 * and the two places a formula reaches the Markdown — a display block and an
 * inline span.
 *
 * Every case here was a defect seen in the bundled paper. They are written
 * against hand-built runs so they fail on the rule, not on the fixture.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildEquation,
  isEquationNumber,
  latexForText,
  latexRows,
  latexSequence,
  mathSlot,
} from "./math.mjs";
import {
  fontFamily,
  groupLines,
  needsSpace,
  renderLine,
  showText,
  TJ_GAP,
} from "./embedded-pdf.mjs";

/** One run, with the fields the math code reads. */
function run(x, y, size, text, family, width = text.length * size * 0.5) {
  return { x, y, size, text, family, width };
}

describe("TeX math-font slots", () => {
  test("CMSY punctuation decodes instead of reading as ASCII", () => {
    // `{` and `}` sit at 0x66/0x67: read as ASCII they became `f` and `g`,
    // which is how `D = {q_i, ...}` came out as `D = fhqi, ...g`.
    assert.equal(mathSlot("cmsy", 0x66), "{");
    assert.equal(mathSlot("cmsy", 0x67), "}");
    assert.equal(mathSlot("cmsy", 0x68), "\u27e8");
    assert.equal(mathSlot("cmsy", 0x69), "\u27e9");
    assert.equal(mathSlot("cmsy", 0x6a), "|");
    assert.equal(mathSlot("cmsy", 0x00), "\u2212");
    assert.equal(mathSlot("cmsy", 0x14), "\u2264");
    assert.equal(mathSlot("cmsy", 0x15), "\u2265");
  });

  test("CMSY arrows decode, not the ASCII byte they are drawn at", () => {
    // `R : (q, C) → C_F` draws its arrow as the ASCII `!` byte.
    assert.equal(mathSlot("cmsy", 0x21), "\u2192");
    assert.equal(mathSlot("cmsy", 0x20), "\u2190");
  });

  test("CMMI punctuation decodes, not the ASCII byte it is drawn at", () => {
    // A comma is drawn at 0x3B, which ASCII reads as `;`: the parameter list
    // of L(q_i; p_i^+, ...) came out with semicolons.
    assert.equal(mathSlot("cmmi", 0x3b), ",");
    assert.equal(mathSlot("cmmi", 0x3a), ".");
    assert.equal(mathSlot("cmmi", 0x0b), "\u03b1");
  });

  test("CMEX delimiters and the summation sign decode", () => {
    // Dropped as control bytes, `\left(` and `\right)` vanished from
    // `softmax(P_i w)`.
    assert.equal(mathSlot("cmex", 0x00), "(");
    assert.equal(mathSlot("cmex", 0x01), ")");
    assert.equal(mathSlot("cmex", 0x50), "\u2211");
  });

  test("MSAM transpose decodes", () => {
    assert.equal(mathSlot("msam", 0x7c), "\u22a4");
  });

  test("an unmapped slot stays unmapped rather than guessed", () => {
    assert.equal(mathSlot("cmsy", 0x7e), null);
    assert.equal(mathSlot("msbm", 0x00), null);
  });
});

describe("LaTeX for one run", () => {
  test("a roman word becomes its operator name", () => {
    assert.equal(latexForText("log", "cmtext"), "\\log ");
    assert.equal(latexForText("sim(", "cmtext"), "\\mathrm{sim} (");
  });

  test("math-italic letters stay letters", () => {
    assert.equal(latexForText("q", "cmmi"), "q");
    assert.equal(latexForText("−", "cmsy"), "-");
  });

  test("a bold letter keeps its boldness", () => {
    // A single italic letter is already italic in math mode, but a bold one is
    // not: `\mathbf{P}` must survive, or eq. (3) loses its bold P.
    assert.equal(latexForText("P", "cmbold").trim(), "\\mathbf{P}");
  });

  test("a body-font word inside math is upright", () => {
    assert.equal(latexForText("start", "other").trim(), "\\mathrm{start}");
  });
});

describe("scripts", () => {
  test("a subscript attaches to its base", () => {
    const latex = latexSequence([run(10, 100, 10, "q", "cmmi"), run(16, 98, 7, "i", "cmmi")], 100, 10);
    assert.equal(latex, "q_{i}");
  });

  test("a superscript and a subscript attach to the same base", () => {
    const latex = latexSequence(
      [run(10, 100, 10, "p", "cmmi"), run(16, 104, 7, "+", "cmtext"), run(16, 96, 7, "i", "cmmi")],
      100,
      10,
    );

    // Either order is valid LaTeX; the writer emits the subscript first.\n    assert.equal(latex, "p_{i}^{+}");
  });

  test("a subscript keeps its own subscripts", () => {
    // `e^{sim(q_i, p_i^+)}`: the `i` inside the superscript is a subscript of
    // `q`, not a second superscript of `e`.
    const runs = [
      run(10, 100, 10, "e", "cmmi"),
      run(16, 104, 7, "sim(", "cmtext"),
      run(30, 104, 7, "q", "cmmi"),
      run(34, 102.5, 5, "i", "cmmi"),
      run(38, 104, 7, ")", "cmtext"),
    ];

    assert.equal(latexSequence(runs, 100, 10), "e^{\\mathrm{sim}(q_{i})}");
  });

  test("a script drawn after its sibling is not a nested one", () => {
    // `w_{s+1}^{(i)}` arrives as `s`, `(i`, `+1`, `)`: both slots stay open.
    const runs = [
      run(10, 100, 10, "w", "cmmi"),
      run(16, 98, 7, "s", "cmmi"),
      run(20, 102, 7, "(", "cmtext"),
      run(22, 102, 7, "i", "cmmi"),
      run(26, 98, 7, "+1", "cmtext"),
      run(32, 102, 7, ")", "cmtext"),
    ];

    assert.equal(latexSequence(runs, 100, 10), "w_{s+1}^{(i)}");
  });

  test("a raised circumflex accents the atom before it", () => {
    // `\hat{\mathbf{P}}^{\top}` arrives as bold `P`, a raised `^`, then `⊤`.
    const runs = [
      run(10, 100, 10, "P", "cmbold"),
      run(12, 103, 10, "^", "cmtext"),
      run(16, 104, 8, "\u22a4", "msam"),
    ];

    assert.equal(latexSequence(runs, 100, 10), "\\hat{\\mathbf{P}}^{\\top}");
  });
});

describe("fractions", () => {
  const rule = { x: 40, y: 98, width: 60 };

  test("a rule splits the runs above it from the runs below", () => {
    const runs = [
      run(10, 100, 10, "=", "cmtext"),
      run(45, 103, 10, "a", "cmmi"),
      run(45, 96, 10, "b", "cmmi"),
    ];

    const built = buildEquation(runs, [rule]);
    assert.ok(built);
    assert.match(built.latex, /= ?\\frac\{a\}\{b\}/);
  });

  test("a full stop after the rule stays outside the fraction", () => {
    // The sentence's full stop sits on the denominator's baseline but past the
    // rule's right edge; it belongs after the \frac, not inside it.
    const runs = [
      run(45, 103, 10, "a", "cmmi"),
      run(45, 96, 10, "b", "cmmi"),
      run(101, 96, 10, ".", "cmmi", 2.7),
    ];

    const built = buildEquation(runs, [rule]);
    assert.equal(built.latex, "\\frac{a}{b}.");
  });

  test("the printed number becomes a tag", () => {
    const runs = [
      run(45, 103, 10, "a", "cmmi"),
      run(45, 96, 10, "b", "cmmi"),
      run(120, 100, 10, "(2)", "other"),
    ];

    const built = buildEquation(runs, [rule]);
    assert.equal(built.tag, "(2)");
    assert.ok(!built.latex.includes("(2)"), "the number is not part of the formula");
  });

  test("an equation number is recognised only as a parenthesised number", () => {
    assert.ok(isEquationNumber({ family: "other", text: "(12)" }));
    assert.ok(!isEquationNumber({ family: "cmmi", text: "(12)" }));
    assert.ok(!isEquationNumber({ family: "other", text: "(a)" }));
  });

  test("three scattered dots become \\cdots", () => {
    const dots = [
      run(10, 100, 10, "\u00b7", "cmsy"),
      run(14, 100, 10, "\u00b7", "cmsy"),
      run(18, 100, 10, "\u00b7", "cmsy"),
    ];

    assert.equal(latexRows(dots), "\\cdots");
  });
});

describe("line assembly", () => {
  test("a script run joins the line it sits on", () => {
    // `p` and its raised `+` were two Markdown lines before.
    const lines = groupLines([
      { x: 10, y: 100, size: 10, width: 5, text: "p", rotation: 0, family: "cmmi" },
      { x: 15, y: 104, size: 7, width: 4, text: "+", rotation: 0, family: "cmtext" },
    ]);

    assert.equal(lines.length, 1);
    assert.equal(lines[0].parts.length, 2);
  });

  test("a raised script on the last word still joins its line", () => {
    // `R^{L×h}`: the superscript starts past the base row's right edge.
    const lines = groupLines([
      { x: 10, y: 100, size: 10, width: 90, text: "R", rotation: 0, family: "msbm" },
      { x: 101, y: 104, size: 7, width: 20, text: "L\u00d7h", rotation: 0, family: "cmmi" },
    ]);

    assert.equal(lines.length, 1);
  });

  test("the next line is not a script", () => {
    const lines = groupLines([
      { x: 10, y: 100, size: 10, width: 90, text: "R", rotation: 0, family: "msbm" },
      { x: 10, y: 87, size: 10, width: 90, text: "next", rotation: 0, family: "cmmi" },
    ]);

    assert.equal(lines.length, 2);
  });
});

describe("word spaces", () => {
  test("a wide gap is a space", () => {
    assert.ok(needsSpace("a", "b", 3, 10));
  });

  test("a hyphen attaches to the word before it", () => {
    // `d-dimensional` must not become `d -dimensional`.
    assert.ok(!needsSpace("d", "-dimensional", 0, 10));
  });

  test("a justified run may end short of the next run", () => {
    // The space before `E_Q` was lost because a justified run's nominal width
    // is wider than what it drew.
    assert.ok(needsSpace("encoder", "E", -1.5, 10));
  });

  test("a long negative gap is never a space", () => {
    assert.ok(!needsSpace("encoder", "E", -8, 10));
  });
});

describe("a TJ array", () => {
  test("a word gap is marked, never emitted as a space glyph", () => {
    // A literal space is decoded through the font, and CMSY reads byte 0x20
    // as `←`: the dots of `· · ·` came back as `·←·←·`.
    const shown = showText("[(a)-250(b)]");
    assert.equal(shown.text, `a${TJ_GAP}b`);
    assert.ok(!shown.text.includes(" "));
  });

  test("a small kerning adjustment does not split a word", () => {
    assert.equal(showText("[(suf)-5(fers)]").text, "suffers");
  });

  test("a gap that the literal already holds is not doubled", () => {
    assert.equal(showText("[(a )-250(b)]").text, "a b");
  });
});

describe("a text line with inline math", () => {
  const line = {
    y: 100,
    size: 10,
    rotation: 0,
    parts: [
      { x: 10, y: 100, size: 10, width: 40, text: "encoder", family: "other" },
      { x: 52, y: 100, size: 10, width: 7, text: "E", family: "cmmi" },
      { x: 59, y: 98, size: 7, width: 5, text: "P", family: "cmmi" },
      { x: 64, y: 100, size: 10, width: 4, text: "(", family: "cmtext" },
    ],
  };

  test("the math is wrapped in $…$ and keeps its subscript", () => {
    assert.equal(renderLine(line), "encoder $E_{P}($");
  });

  test("a word after the closing $ still gets its space", () => {
    const withWord = {
      ...line,
      parts: [
        { x: 10, y: 100, size: 10, width: 20, text: "and", family: "other" },
        { x: 32, y: 100, size: 10, width: 6, text: "h", family: "cmmi" },
        { x: 40, y: 100, size: 10, width: 20, text: "hidden", family: "other" },
      ],
    };

    assert.equal(renderLine(withWord), "and $h$ hidden");
  });
});

describe("font families", () => {
  test("each TeX face is recognised, subsets included", () => {
    assert.equal(fontFamily("CMSY10"), "cmsy");
    assert.equal(fontFamily("CMMI8"), "cmmi");
    assert.equal(fontFamily("CMEX10"), "cmex");
    assert.equal(fontFamily("MSAM10"), "msam");
    assert.equal(fontFamily("MSBM10"), "msbm");
    assert.equal(fontFamily("CMBX10"), "cmbold");
    assert.equal(fontFamily("CMR10"), "cmtext");
    assert.equal(fontFamily("NimbusRomNo9L-Regu"), "other");
  });
});
