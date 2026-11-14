/** Table layout: cell splitting from word positions, and the two table writers. */
import assert from "node:assert/strict";
import { test } from "node:test";

import { csvTable, findTables, layoutTable, lineCells, pipeTable } from "../lib/pdf-extract.mjs";

/**
 * One line with words at their printed x positions. A word's x is what says
 * which column it belongs to, so every fixture here is built from positions.
 */
function line(y, words, size = 10) {
  return {
    y,
    rotation: 0,
    size,
    text: words.map((word) => word.text).join(" "),
    parts: [
      {
        x: words[0].x,
        y,
        size,
        width: 0,
        text: words.map((word) => word.text).join(" "),
        family: "other",
        words: words.map((word) => ({ ...word, width: word.text.length * size * 0.5 })),
      },
    ],
  };
}

test("a single cell is not a table row", () => {
  assert.equal(lineCells(line(0, [{ x: 72, text: "prose" }])), null);
});

test("a column gap splits cells", () => {
  const cells = lineCells(
    line(0, [
      { x: 72, text: "Label1" },
      { x: 240, text: "Label2" },
    ]),
  );

  assert.deepEqual(cells, ["Label1", "Label2"]);
});

test("a word space joins words into one cell", () => {
  const cells = lineCells(
    line(0, [
      { x: 72, text: "None" },
      { x: 96, text: "BM25" },
      { x: 240, text: "59.1" },
    ]),
  );

  assert.deepEqual(cells, ["None BM25", "59.1"]);
});

test("a padded run splits into one cell per column", () => {
  // `44.9 66.8 78.1 85.0` is drawn as one run with wide padding; the offsets
  // are what make it four cells rather than one.
  const cells = lineCells(
    line(0, [
      { x: 380, text: "44.9" },
      { x: 410, text: "66.8" },
      { x: 440, text: "78.1" },
      { x: 470, text: "85.0" },
    ]),
  );

  assert.deepEqual(cells, ["44.9", "66.8", "78.1", "85.0"]);
});

test("the facsimile places a word at the column its x names", () => {
  const table = layoutTable([
    line(20, [
      { x: 72, text: "Name" },
      { x: 105, text: "Score" },
    ]),
    line(0, [
      { x: 72, text: "alpha" },
      { x: 105, text: "10" },
    ]),
  ]);

  assert.equal(table, ["```text", "Name  Score", "alpha 10", "```"].join("\n"));
});

test("the facsimile keeps the printed row order", () => {
  // A group label printed between two rows stays between them.
  const table = layoutTable([
    line(20, [{ x: 72, text: "row-one" }]),
    line(10, [{ x: 72, text: "group" }]),
    line(0, [{ x: 72, text: "row-two" }]),
  ]);

  assert.equal(table, ["```text", "row-one", "group", "row-two", "```"].join("\n"));
});

test("the CSV writer puts each cell in the column its x names", () => {
  const table = csvTable([
    line(20, [
      { x: 72, text: "Name" },
      { x: 120, text: "Score" },
    ]),
    line(0, [
      { x: 72, text: "alpha" },
      { x: 120, text: "10" },
    ]),
  ]);

  assert.equal(table, ["```csv", "Name,Score", "alpha,10", "```"].join("\n"));
});

test("the CSV writer quotes a cell that holds a comma", () => {
  const table = csvTable([
    line(20, [
      { x: 72, text: "Count" },
      { x: 120, text: "Notes" },
    ]),
    line(0, [
      { x: 72, text: "79,168" },
      { x: 120, text: "x" },
    ]),
  ]);

  assert.ok(table.includes('"79,168",x'), table);
});

test("the pipe writer makes a header, a numeric rule and body rows", () => {
  const table = pipeTable([
    line(20, [
      { x: 72, text: "Name" },
      { x: 120, text: "Score" },
      { x: 160, text: "Rank" },
    ]),
    line(0, [
      { x: 72, text: "alpha" },
      { x: 120, text: "10" },
      { x: 160, text: "3" },
    ]),
  ]);

  assert.equal(
    table,
    ["| Name | Score | Rank |", "| --- | ---: | ---: |", "| alpha | 10 | 3 |"].join("\n"),
  );
});

test("the pipe writer lines a sub-header up with its numbers", () => {
  // Two-row header: the widest row names the columns, so `NQ` lands over `59.1`
  // rather than one cell to the left.
  const table = pipeTable([
    line(20, [
      { x: 72, text: "Model" },
      { x: 160, text: "NQ" },
      { x: 220, text: "WQ" },
    ]),
    line(10, [
      { x: 72, text: "DPR" },
      { x: 160, text: "59.1" },
      { x: 220, text: "66.9" },
    ]),
    line(0, [
      { x: 72, text: "BM25" },
      { x: 160, text: "78.4" },
      { x: 220, text: "79.4" },
    ]),
  ]);

  assert.equal(
    table,
    [
      "| Model | NQ | WQ |",
      "| --- | ---: | ---: |",
      "| DPR | 59.1 | 66.9 |",
      "| BM25 | 78.4 | 79.4 |",
    ].join("\n"),
  );
});

test("the pipe writer escapes a pipe inside a cell", () => {
  const table = pipeTable([
    line(20, [
      { x: 72, text: "a|b" },
      { x: 160, text: "c" },
    ]),
    line(0, [
      { x: 72, text: "x" },
      { x: 160, text: "y" },
    ]),
  ]);

  assert.ok(table.includes("| a\\|b | c |"), table);
});

test("a table that is boxed by vertical rules keeps them", () => {
  // A border lies just outside the text, and this PDF draws it one piece per
  // row, so a short stroke at the table's own x is still an edge.
  const page = {
    number: 1,
    lines: [
      line(700, [
        { x: 80, text: "Question" },
        { x: 240, text: "Passage" },
        { x: 400, text: "Retrieved" },
      ]),
      line(680, [
        { x: 80, text: "What is the body" },
        { x: 240, text: "Title: British" },
        { x: 400, text: "Title: Sea" },
      ]),
      line(660, [
        { x: 80, text: "of water?" },
        { x: 240, text: "England is not" },
        { x: 400, text: "Traffic" },
      ]),
    ],
    rules: [
      { x: 70, y: 708, width: 380 },
      { x: 70, y: 650, width: 380 },
    ],
    verticals: [
      { x: 60, y: 655, height: 60 },
      { x: 460, y: 655, height: 60 },
      { x: 240, y: 655, height: 60 },
    ],
  };

  const [table] = findTables(page.lines, { width: 595, height: 842 }, [], page.rules, page.verticals);
  assert.equal(table.box.x, 58, "the left border sets the crop");
  assert.equal(table.box.width, 404, "both borders are inside the crop");
});

test("a vertical separator inside the text span does not widen the crop", () => {
  const page = {
    number: 1,
    lines: [
      line(700, [
        { x: 80, text: "Question" },
        { x: 240, text: "Passage" },
        { x: 400, text: "Retrieved" },
      ]),
      line(680, [
        { x: 80, text: "What is the body" },
        { x: 240, text: "Title: British" },
        { x: 400, text: "Title: Sea" },
      ]),
      line(660, [
        { x: 80, text: "of water?" },
        { x: 240, text: "England is not" },
        { x: 400, text: "Traffic" },
      ]),
    ],
    rules: [
      { x: 70, y: 708, width: 380 },
      { x: 70, y: 650, width: 380 },
    ],
    verticals: [{ x: 240, y: 655, height: 60 }],
  };

  const [table] = findTables(page.lines, { width: 595, height: 842 }, [], page.rules, page.verticals);
  assert.equal(table.box.x, 68, "the rule span still sets the crop");
  assert.equal(table.box.width, 384, "an inner separator adds nothing");
});

test("a table's crop keeps its own rules as the frame", () => {
  // The text of Table 7 stops at its first and last line, which cuts the rules a
  // few points above and below; the crop snaps to them and takes their span.
  const page = {
    number: 1,
    lines: [
      line(700, [
        { x: 80, text: "Question" },
        { x: 240, text: "Passage received" },
        { x: 400, text: "Passage" },
      ]),
      line(680, [
        { x: 80, text: "What is the body" },
        { x: 240, text: "Title: British Cycling" },
        { x: 400, text: "Title: Sea" },
      ]),
      line(660, [
        { x: 80, text: "of water?" },
        { x: 240, text: "England is not recognised" },
        { x: 400, text: "Traffic" },
      ]),
    ],
    equations: [],
    tables: [],
    rules: [
      { x: 70, y: 708, width: 380 },
      { x: 70, y: 690, width: 380 },
      { x: 70, y: 650, width: 380 },
    ],
  };

  const boxes = findTables(page.lines, { width: 595, height: 842 }, [], page.rules);
  assert.equal(boxes.length, 1);

  const [table] = boxes;
  assert.ok(Math.abs(table.box.x - 68) < 0.01, "the rule's left edge sets the crop");
  assert.ok(Math.abs(table.box.width - 384) < 0.01, "the rule's span sets the width");
  assert.ok(table.box.y <= 648.5 && table.box.y + table.box.height >= 709.5, "both rules are inside");
});
