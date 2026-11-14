/**
 * PNG crop and figure-box tests: the geometry that turns a vector figure into
 * an asset, without depending on a renderer.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { figureBoxes } from "../lib/pdf-extract.mjs";
import { boxToPixels, cropFigure } from "../lib/figures.mjs";
import { cropPixels, decodePng, encodePng } from "../lib/png.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RESOURCE = (name) => path.join(HERE, "resources", `${name}.pdf`);

function withTemp(body) {
  const root = mkdtempSync(path.join(tmpdir(), "pdf-figures-"));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** A small RGBA image where every pixel encodes its coordinates. */
function syntheticImage(width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = x;
      data[offset + 1] = y;
      data[offset + 2] = (x + y) % 256;
      data[offset + 3] = 255;
    }
  }
  return { width, height, channels: 4, data };
}

test("encodes and decodes a PNG losslessly", () => {
  const source = syntheticImage(6, 4);
  const decoded = decodePng(encodePng(source));

  assert.equal(decoded.width, 6);
  assert.equal(decoded.height, 4);
  assert.equal(decoded.channels, 4);
  assert.ok(decoded.data.equals(source.data));
});

test("crops pixels without shifting them", () => {
  const source = syntheticImage(10, 10);
  const cropped = cropPixels(source, { left: 2, top: 3, width: 4, height: 5 });

  assert.equal(cropped.width, 4);
  assert.equal(cropped.height, 5);
  for (let y = 0; y < cropped.height; y += 1) {
    for (let x = 0; x < cropped.width; x += 1) {
      const offset = (y * cropped.width + x) * 4;
      assert.equal(cropped.data[offset], x + 2);
      assert.equal(cropped.data[offset + 1], y + 3);
    }
  }
});

test("maps a PDF box onto a page render, flipping the y axis", () => {
  const rect = boxToPixels(
    { x: 100, y: 200, width: 50, height: 40, pageWidth: 600, pageHeight: 800 },
    { width: 1200, height: 1600 },
  );

  assert.deepEqual(rect, { left: 200, top: 1120, width: 100, height: 80 });
});

test("crops a figure from a page render onto disk", () => {
  withTemp((root) => {
    const page = path.join(root, "page-1.png");
    writeFileSync(page, encodePng(syntheticImage(120, 160)));

    const target = path.join(root, "figure-1.png");
    const written = cropFigure(
      page,
      { x: 10, y: 20, width: 30, height: 40, pageWidth: 120, pageHeight: 160 },
      target,
    );

    assert.equal(written.width, 30);
    assert.equal(written.height, 40);
    const decoded = decodePng(readFileSync(target));
    assert.equal(decoded.width, 30);
    assert.equal(decoded.height, 40);
  });
});

test("finds the vector figure box in the multi-column fixture", () => {
  const boxes = figureBoxes(readFileSync(RESOURCE("multi-column")));

  assert.equal(boxes.length, 1);
  const [box] = boxes;
  assert.equal(box.page, 5);
  assert.ok(Math.abs(box.x - 307.276) < 0.5, `x ${box.x}`);
  assert.ok(Math.abs(box.y - 462.687) < 0.5, `y ${box.y}`);
  assert.ok(Math.abs(box.width - 230.4) < 0.5, `width ${box.width}`);
  assert.ok(Math.abs(box.height - 156.8) < 0.5, `height ${box.height}`);
});

test("finds no figure box in the embedded-image fixture", () => {
  assert.deepEqual(figureBoxes(readFileSync(RESOURCE("embedded-images-tables"))), []);
});
