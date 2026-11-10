/**
 * End-to-end step tests, including regressions for the two defects a fresh
 * Linux clone exposed: a missing `test-results/` parent, and page renders whose
 * numbers are zero-padded by the renderer.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { encodePng } from "./png.mjs";
import {
  createRunDir,
  cropEquationFixtures,
  cropEquations,
  cropFigures,
  cropFixtures,
  cropTableFixtures,
  cropTables,
  ocrFixtures,
  findPageRender,
  parseTestCount,
  rasteriseFixtures,
  timestamp,
  verifyExtraction,
} from "../scripts/run-steps.mjs";

function silenced(body) {
  const log = console.log;
  const error = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return body();
  } finally {
    console.log = log;
    console.error = error;
  }
}

function withTemp(body) {
  const root = mkdtempSync(path.join(tmpdir(), "pdf-steps-"));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** A solid RGBA image, enough for a crop to slice. */
function image(width, height) {
  const data = Buffer.alloc(width * height * 4, 200);
  return encodePng({ width, height, channels: 4, data });
}

test("formats the run stamp as YYYY-MM-DD_HH-mm.sss", () => {
  assert.equal(timestamp(new Date(2026, 10, 10, 9, 56, 0, 499)), "2026-11-10_09-56.499");
});

test("regression: creates test-results in a fresh clone", () => {
  withTemp((root) => {
    const dir = createRunDir(root, new Date(2026, 10, 10, 9, 56, 0, 499));

    assert.equal(path.basename(dir), "2026-11-10_09-56.499");
    assert.ok(existsSync(path.join(root, "test-results")), "parent folder exists");
  });
});

test("suffixes a second run with the same stamp", () => {
  withTemp((root) => {
    const stamp = new Date(2026, 10, 10, 9, 56, 0, 499);
    const first = createRunDir(root, stamp);
    const second = createRunDir(root, stamp);

    assert.notEqual(first, second);
    assert.equal(path.basename(second), "2026-11-10_09-56.499-1");
  });
});

test("regression: finds a zero-padded page render by page number", () => {
  withTemp((root) => {
    writeFileSync(path.join(root, "page-05.png"), "png");

    assert.equal(findPageRender(root, 5), path.join(root, "page-05.png"));
  });
});

test("finds an unpadded page render and reports a missing one", () => {
  withTemp((root) => {
    writeFileSync(path.join(root, "page-5.png"), "png");
    writeFileSync(path.join(root, "page-15.png"), "png");

    assert.equal(findPageRender(root, 5), path.join(root, "page-5.png"));
    assert.equal(findPageRender(root, 15), path.join(root, "page-15.png"));
    assert.equal(findPageRender(root, 7), null);
  });
});

test("regression: crops a figure from a zero-padded page render", () => {
  withTemp((root) => {
    writeFileSync(path.join(root, "page-05.png"), image(120, 160));

    const box = { page: 5, x: 10, y: 20, width: 30, height: 40, pageWidth: 120, pageHeight: 160 };
    const { cropped, failures } = cropFigures({ assetsDir: root, boxes: [box] });

    assert.equal(failures.length, 0);
    assert.equal(cropped.length, 1);
    assert.equal(cropped[0].file, "figure-1.png");
    assert.equal(readFileSync(path.join(root, "figure-1.png")).subarray(1, 4).toString("latin1"), "PNG");
  });
});

test("reports a figure whose page render is missing", () => {
  withTemp((root) => {
    const box = { page: 5, x: 0, y: 0, width: 10, height: 10, pageWidth: 100, pageHeight: 100 };
    const { cropped, failures } = cropFigures({ assetsDir: root, boxes: [box] });

    assert.equal(cropped.length, 0);
    assert.equal(failures.length, 1);
    assert.match(failures[0].reason, /no render for page 5/);
  });
});

test("verifies page markers and fails on a mismatch", () => {
  withTemp((root) => {
    const fixture = "sample";
    mkdirSync(path.join(root, "extracted", fixture), { recursive: true });
    writeFileSync(
      path.join(root, "extracted", fixture, `${fixture}.md`),
      "<!-- page: 1 -->\n\ntext\n",
      "utf8",
    );

    const log = console.log;
    const error = console.error;
    console.log = () => {};
    console.error = () => {};
    try {
      assert.equal(verifyExtraction(root, { sample: { pages: 1 } }), 0);
      assert.equal(verifyExtraction(root, { sample: { pages: 2 } }), 1);
      assert.equal(verifyExtraction(root, { missing: { pages: 1 } }), 1);
    } finally {
      console.log = log;
      console.error = error;
    }
  });
});

test("reads the test count from either reporter format", () => {
  assert.equal(parseTestCount("ℹ tests 42\nℹ pass 42"), 42);
  assert.equal(parseTestCount("# tests 7\n# pass 7"), 7);
  assert.equal(parseTestCount("Ran 22 tests in 0.3s"), 22);
  assert.equal(parseTestCount("no count here"), null);
});

test("rasterising is skipped when no engine exists", () => {
  withTemp((root) => {
    const fixtures = { sample: { pages: 1 } };
    const { raster, rasterStatus } = silenced(() => rasteriseFixtures(root, fixtures, {
      env: { PDF_NO_WINDOWS_RASTER: "1", PDF_NO_RASTER_INSTALL: "1" },
      candidates: [],
    }));

    assert.equal(raster.sample, "skipped");
    assert.equal(rasterStatus, 0);
    assert.equal(existsSync(path.join(root, "extracted")), false, "a skip writes nothing");
  });
});

test("figure cropping is skipped when the raster was skipped", () => {
  withTemp((root) => {
    const { figures, figuresStatus } = silenced(() => cropFixtures(root, { sample: { pages: 1, figures: 0 } }, {
      sample: "skipped",
    }));

    assert.deepEqual(figures.sample, { status: "skipped", count: 0 });
    assert.equal(figuresStatus, 0);
  });
});

test("regression: crops each equation and records its LaTeX beside the image", () => {
  withTemp((root) => {
    writeFileSync(path.join(root, "page-03.png"), image(120, 160));

    const box = {
      page: 3,
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      pageWidth: 120,
      pageHeight: 160,
      latex: "\\frac{a}{b}",
      tag: "(2)",
    };
    const { cropped, failures } = cropEquations({ assetsDir: root, boxes: [box] });

    assert.equal(failures.length, 0);
    assert.equal(cropped.length, 1);
    assert.equal(cropped[0].file, "equation-1.png", "equations are numbered in document order");
    assert.equal(cropped[0].tag, "(2)");
    assert.equal(cropped[0].latex, "\\frac{a}{b}");
    assert.ok(existsSync(path.join(root, "equation-1.png")));
  });
});

test("equation cropping is skipped when the raster was skipped", () => {
  withTemp((root) => {
    const { equations, equationsStatus } = silenced(() =>
      cropEquationFixtures(root, { sample: { pages: 1, equations: 0 } }, { sample: "skipped" }),
    );

    assert.deepEqual(equations.sample, { status: "skipped", count: 0 });
    assert.equal(equationsStatus, 0);
  });
});

test("regression: crops each table and numbers it in document order", () => {
  withTemp((root) => {
    writeFileSync(path.join(root, "page-12.png"), image(120, 160));

    const box = { page: 12, x: 10, y: 20, width: 30, height: 40, pageWidth: 120, pageHeight: 160 };
    const { cropped, failures } = cropTables({ assetsDir: root, boxes: [box, box] });

    assert.equal(failures.length, 0);
    assert.equal(cropped.length, 2);
    assert.equal(cropped[0].file, "table-1.png");
    assert.equal(cropped[1].file, "table-2.png");
    assert.ok(existsSync(path.join(root, "table-2.png")));
  });
});

test("table cropping is skipped when the raster was skipped", () => {
  withTemp((root) => {
    const { tables, tablesStatus } = silenced(() =>
      cropTableFixtures(root, { sample: { pages: 1, tables: 0 } }, { sample: "skipped" }),
    );

    assert.deepEqual(tables.sample, { status: "skipped", count: 0 });
    assert.equal(tablesStatus, 0);
  });
});

test("OCR is skipped when no engine exists", () => {
  withTemp((root) => {
    const assets = path.join(root, "extracted", "sample", "sample.assets");
    mkdirSync(assets, { recursive: true });
    writeFileSync(path.join(assets, "page-1.png"), "png");

    const { ocr, ocrStatus } = silenced(() => ocrFixtures(root, { sample: { pages: 1 } }, {
      env: { PDF_NO_WINDOWS_OCR: "1", PDF_NO_OCR_INSTALL: "1" },
      candidates: [],
    }));

    assert.equal(ocr.sample, "skipped");
    assert.equal(ocrStatus, 0);
  });
});

test("OCR reads the page images through the configured command", () => {
  withTemp((root) => {
    const assets = path.join(root, "extracted", "sample", "sample.assets");
    mkdirSync(assets, { recursive: true });
    writeFileSync(path.join(assets, "page-1.png"), "png");

    const stub = path.join(root, "stub.mjs");
    writeFileSync(
      stub,
      'import { writeFileSync } from "node:fs";\nconst [image, out] = process.argv.slice(2);\nwriteFileSync(`${out}.txt`, `read ${image}`);\n',
      "utf8",
    );

    const { ocr, ocrStatus } = silenced(() => ocrFixtures(root, { sample: { pages: 1 } }, {
      env: { PDF_OCR_CMD: `"${process.execPath}" "${stub}" {image} {out}` },
      candidates: [],
    }));

    assert.equal(ocr.sample, "extracted");
    assert.equal(ocrStatus, 0);
    assert.match(readFileSync(path.join(assets, "ocr", "page-1.txt"), "utf8"), /page-1\.png/);
  });
});
