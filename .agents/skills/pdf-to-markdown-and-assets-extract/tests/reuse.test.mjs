/**
 * The raster-reuse decision.
 *
 * A 431-page refresh re-rendered every page even though the source hash and the
 * page files had not changed. These cases prove the reuse is conditional: the
 * manifest must name the same hash, the same dpi and every page file.
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { findReusableRaster, parseArgs } from "../scripts/extract-pdf.mjs";

function withTemp(body) {
  const root = mkdtempSync(path.join(tmpdir(), "pdf-reuse-"));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeManifest(assets, { sourceHash = "abc", dpi = 150, pages = ["page-1.png", "page-2.png"] } = {}) {
  writeFileSync(
    path.join(assets, "raster.json"),
    JSON.stringify({ sourceHash, dpi, tool: "stub", source: "override", pages }),
  );
}

test("reuses the raster by default and honours --no-reuse-raster", () => {
  assert.equal(parseArgs(["doc.pdf"]).reuseRaster, true);
  assert.equal(parseArgs(["doc.pdf", "--no-reuse-raster"]).reuseRaster, false);
});

test("reuses a complete render for the same source and dpi", () => {
  withTemp((root) => {
    const assets = path.join(root, "doc.assets");
    mkdirSync(assets);
    writeFileSync(path.join(assets, "page-1.png"), "png");
    writeFileSync(path.join(assets, "page-2.png"), "png");
    writeManifest(assets);

    const outcome = findReusableRaster(assets, { sourceHash: "abc", dpi: 150, pageCount: 2 });

    assert.equal(outcome.status, "reused");
    assert.equal(outcome.tool, "stub");
    assert.equal(outcome.pages.length, 2);
    assert.equal(path.basename(outcome.pages[0]), "page-1.png");
  });
});

test("renders again after the source hash changes", () => {
  withTemp((root) => {
    const assets = path.join(root, "doc.assets");
    mkdirSync(assets);
    writeFileSync(path.join(assets, "page-1.png"), "png");
    writeFileSync(path.join(assets, "page-2.png"), "png");
    writeManifest(assets);

    assert.equal(
      findReusableRaster(assets, { sourceHash: "different", dpi: 150, pageCount: 2 }),
      null,
    );
  });
});

test("renders again at a different dpi", () => {
  withTemp((root) => {
    const assets = path.join(root, "doc.assets");
    mkdirSync(assets);
    writeFileSync(path.join(assets, "page-1.png"), "png");
    writeFileSync(path.join(assets, "page-2.png"), "png");
    writeManifest(assets);

    assert.equal(findReusableRaster(assets, { sourceHash: "abc", dpi: 300, pageCount: 2 }), null);
  });
});

test("renders again when a named page file is missing", () => {
  withTemp((root) => {
    const assets = path.join(root, "doc.assets");
    mkdirSync(assets);
    writeFileSync(path.join(assets, "page-1.png"), "png");
    writeManifest(assets);

    assert.equal(findReusableRaster(assets, { sourceHash: "abc", dpi: 150, pageCount: 2 }), null);
  });
});

test("renders again when a named page file is empty", () => {
  withTemp((root) => {
    const assets = path.join(root, "doc.assets");
    mkdirSync(assets);
    writeFileSync(path.join(assets, "page-1.png"), "png");
    writeFileSync(path.join(assets, "page-2.png"), "");
    writeManifest(assets);

    assert.equal(findReusableRaster(assets, { sourceHash: "abc", dpi: 150, pageCount: 2 }), null);
  });
});

test("renders again when the manifest is absent or unreadable", () => {
  withTemp((root) => {
    const assets = path.join(root, "doc.assets");
    mkdirSync(assets);
    writeFileSync(path.join(assets, "page-1.png"), "png");
    writeFileSync(path.join(assets, "page-2.png"), "png");

    assert.equal(findReusableRaster(assets, { sourceHash: "abc", dpi: 150, pageCount: 2 }), null);

    writeFileSync(path.join(assets, "raster.json"), "{ not json");
    assert.equal(findReusableRaster(assets, { sourceHash: "abc", dpi: 150, pageCount: 2 }), null);
  });
});
