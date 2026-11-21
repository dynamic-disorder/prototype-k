/**
 * The accessibility variant: page headings, inline captioned assets, descriptive
 * file names and an asset manifest, without touching the default document.
 */
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  absorbCodeTail,
  captionNear,
  codeFence,
  fenceLooseCode,
  isCodeBlock,
  transformCodeBlocks,
  writeAccessibilityAssets,
} from "../lib/accessibility-assets.mjs";
import { encodePng } from "../lib/png.mjs";
import { main, parseArgs } from "../scripts/extract-pdf.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function withTemp(body) {
  const root = mkdtempSync(path.join(tmpdir(), "pdf-accessibility-"));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function png() {
  return encodePng({
    width: 8,
    height: 8,
    channels: 3,
    data: Buffer.alloc(8 * 8 * 3, 255),
  });
}

function writeFixture(root) {
  const assets = path.join(root, "doc.assets");
  mkdirSync(assets);
  for (const file of ["page-1.png", "page-2.png", "figure-1.png", "table-1.png", "equation-1.png"]) {
    writeFileSync(path.join(assets, file), png());
  }
  writeFileSync(
    path.join(root, "doc.md"),
    [
      "<!-- page: 1 -->",
      "",
      "Figure 1: A diagram of the system.",
      "",
      "Body one.",
      "",
      "<!-- page: 2 -->",
      "",
      "Table 1: Values.",
      "",
      "```text",
      "1 2",
      "```",
      "",
      "![Table 1](doc.assets/table-1.png)",
      "",
      "$$ x $$",
      "",
      "![Equation (2.1)](doc.assets/equation-1.png)",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(assets, "raster.json"),
    JSON.stringify({ pages: ["page-1.png", "page-2.png"], dpi: 150 }),
  );
  writeFileSync(
    path.join(assets, "figures.json"),
    JSON.stringify({
      figures: [{ page: 1, file: "figure-1.png", x: 10, y: 20, width: 30, height: 40 }],
    }),
  );
  writeFileSync(
    path.join(assets, "tables.json"),
    JSON.stringify({
      tables: [{ number: 1, page: 2, file: "table-1.png", box: { x: 10, y: 20, width: 30, height: 40 } }],
    }),
  );
  writeFileSync(
    path.join(assets, "equations.json"),
    JSON.stringify({
      equations: [
        {
          number: 1,
          page: 2,
          tag: "(2.1)",
          latex: "x",
          file: "equation-1.png",
          box: { x: 10, y: 40, width: 30, height: 20 },
        },
      ],
    }),
  );
  return assets;
}

const pages = [
  {
    number: 1,
    text: "Figure 1: A diagram of the system.\nBody one.",
    lines: [
      { y: 70, text: "Figure 1: A diagram of the system." },
      { y: 40, text: "Body one." },
    ],
  },
  {
    number: 2,
    text: "Table 1: Values.\nEquation (2.1)",
    lines: [
      { y: 70, text: "Table 1: Values." },
      { y: 40, text: "Equation (2.1)" },
    ],
  },
];

test("matches Finnish figure and table captions", () => {
  const page = {
    number: 1,
    lines: [
      { y: 70, size: 10, text: "Kuva 4.1: Vastaajien koulutustausta." },
      { y: 50, size: 10, text: "Taulukko 5.1: Hyviksi koetut kommentit." },
    ],
  };
  const figure = captionNear([page], 1, { y: 20, height: 40 }, "figure");
  const table = captionNear([page], 1, { y: 10, height: 30 }, "table");

  assert.equal(figure.label, "Kuva 4.1");
  assert.match(figure.caption, /Vastaajien koulutustausta/);
  assert.equal(table.label, "Taulukko 5.1");
  assert.match(table.caption, /Hyviksi koetut kommentit/);
});

test("the CLI writes the accessibility layout into the main Markdown", () => {
  withTemp((root) => {
    const pdf = path.join(root, "paper.pdf");
    copyFileSync(path.join(HERE, "resources", "embedded-images-tables.pdf"), pdf);
    const out = path.join(root, "out");

    assert.equal(main([pdf, out, "--no-raster"]), 0);
    const body = readFileSync(path.join(out, "paper.md"), "utf8");

    assert.match(body, /<!-- page: 1 -->/);
    assert.match(body, /^---------$/m);
    assert.ok(!body.includes("## Page 1"));
    assert.ok(!existsSync(path.join(out, "paper-accessibility.md")));
  });
});

test("is on by default and can be disabled", () => {
  assert.equal(parseArgs(["doc.pdf"]).accessibilityAssets, true);
  assert.equal(
    parseArgs(["doc.pdf", "--with-accessibility-assets"]).accessibilityAssets,
    true,
  );
  assert.equal(
    parseArgs(["doc.pdf", "--no-accessibility-assets"]).accessibilityAssets,
    false,
  );
});

test("writes page headings, separators and inline captioned assets", () => {
  withTemp((root) => {
    writeFixture(root);
    const original = readFileSync(path.join(root, "doc.md"), "utf8");

    const result = writeAccessibilityAssets({ outDir: root, name: "doc", pages });
    const body = readFileSync(result.md, "utf8");

    assert.match(body, /^---------\n\n<!-- page: 1 -->/m);
    assert.match(body, /\n\n---------\n\n<!-- page: 2 -->\n\nTable 1/);
    assert.doesNotMatch(body, /<!-- page: 1 -->\n\n1/);
    assert.match(body, /!\[Figure 1: A diagram of the system\.\]\(doc\.assets\/page-001-figure-1-a-diagram-of-the-system\.png\)/);
    assert.match(body, /!\[Table 1: Values\.\]\(doc\.assets\/page-002-table-1-values\.png\)/);
    assert.match(body, /!\[Equation \(2\.1\): display formula on page 2\]\(doc\.assets\/page-002-equation-1\.png\)/);
    assert.ok(!body.includes("full page render"), "a text page must not become a page image");
    assert.ok(!body.includes("![Table 1](doc.assets/table-1.png)"));
    assert.equal(readFileSync(path.join(root, "doc.md"), "utf8"), original, "the default document is untouched");

    const manifest = JSON.parse(readFileSync(result.manifest, "utf8"));
    assert.equal(manifest.records.length, 3);
    assert.equal(manifest.records.filter((record) => record.kind === "figure").length, 1);
    assert.equal(manifest.records.filter((record) => record.kind === "table").length, 1);
    assert.equal(manifest.records.filter((record) => record.kind === "equation").length, 1);
    assert.equal(manifest.records.filter((record) => record.kind === "page").length, 0);
    for (const record of manifest.records) {
      assert.ok(existsSync(path.join(result.assetsDir, record.file)), record.file);
      assert.ok(record.alt.length > 10, `alt for ${record.file}`);
      assert.ok(!("description" in record), "descriptions live in assets.json only");
    }
  });
});

test("recognises a code-shaped text block and removes printed line numbers", () => {
  const block = [
    "```text",
    "1.  public  void handleAccount  () {",
    "2.    if ( addAccount ( account )) {",
    "3.      return true;",
    "4.    }",
    "5.  }",
    "```",
  ].join("\n");

  assert.equal(isCodeBlock("1.  public  void handleAccount  () {\n2.    return true;\n}"), true);
  const fenced = transformCodeBlocks(block);
  assert.match(fenced, /^```java/m);
  assert.match(fenced, /^public  void handleAccount\(\) \{/m);
  assert.doesNotMatch(fenced, /^\d+\.\s/m);
});

test("fences a loose class header and rejoins it to the following method fence", () => {
  const body = [
    "public class CalculatorTest {",
    "",
    "@Test",
    "",
    "```java",
    "public void testAddFunction() {",
    "}",
    "```",
    "",
    "Koodiesimerkki 3.3",
  ].join("\n");

  const fixed = fenceLooseCode(body);

  assert.equal((fixed.match(/```java/g) ?? []).length, 1);
  assert.match(fixed, /^```java\npublic class CalculatorTest/m);
  assert.match(fixed, /@Test\n+public void testAddFunction/);
  assert.ok(fixed.indexOf("public class CalculatorTest") < fixed.indexOf("public void testAddFunction"));
});

test("compacts letter-spaced code tokens", () => {
  const fenced = codeFence("Calculator c a l c u l a t o r = new Calculator ( ) ;\nassertEquals (4 , r e s u l t ) ;");
  assert.match(fenced, /Calculator calculator = new Calculator\(\);/);
  assert.match(fenced, /assertEquals\(4, result\);/);
});

test("absorbs a code tail split outside the fence", () => {
  const body = [
    "```java",
    "public class Order {",
    "```",
    "",
    ". . .",
    "}",
    "",
    "Koodiesimerkki 3.1: Paha koodihaju.",
  ].join("\n");

  const fixed = absorbCodeTail(body);

  assert.match(fixed, /\. \. \.\n}\n```\n\nKoodiesimerkki 3\.1/);
  assert.ok(!/```\n\n\. \. \./.test(fixed));
});

test("promotes printed chapter and section titles to Markdown headings", () => {
  withTemp((root) => {
    writeFileSync(
      path.join(root, "doc.md"),
      [
        "<!-- page: 1 -->",
        "",
        "2 Puhdas koodi",
        "",
        "Body text.",
        "",
        "2.1 Nimeämiskäytännöt",
        "",
        "More body.",
        "",
      ].join("\n"),
    );
    const headingPages = [
      {
        number: 1,
        text: "2 Puhdas koodi\nBody text.\n2.1 Nimeämiskäytännöt\nMore body.",
        lines: [
          { y: 100, size: 24.8, text: "2 Puhdas koodi" },
          { y: 80, size: 12, text: "Body text." },
          { y: 60, size: 17.2, text: "2.1 Nimeämiskäytännöt" },
          { y: 40, size: 12, text: "More body." },
        ],
      },
    ];

    const result = writeAccessibilityAssets({ outDir: root, name: "doc", pages: headingPages });
    const body = readFileSync(result.md, "utf8");

    assert.match(body, /^## 2 Puhdas koodi$/m);
    assert.match(body, /^### 2\.1 Nimeämiskäytännöt$/m);
    assert.ok(!body.includes("## Page 1"));
  });
});

test("keeps a page render when the page has no extractable text", () => {
  withTemp((root) => {
    writeFixture(root);
    const emptyPages = [
      { number: 1, text: "", lines: [] },
      { number: 2, text: "", lines: [] },
    ];

    const result = writeAccessibilityAssets({ outDir: root, name: "doc", pages: emptyPages });
    const body = readFileSync(result.md, "utf8");

    assert.match(body, /!\[Page 1 — full page render\]\(doc\.assets\/page-001-full-page\.png\)/);
    assert.match(body, /!\[Page 2 — full page render\]\(doc\.assets\/page-002-full-page\.png\)/);
  });
});

test("omits an invalid embedded image and records the warning", () => {
  withTemp((root) => {
    const assets = writeFixture(root);
    writeFileSync(path.join(assets, "image-1.jpg"), "not an image");
    writeFileSync(
      path.join(root, "doc.md"),
      `${readFileSync(path.join(root, "doc.md"), "utf8")}\n![Figure 1](doc.assets/image-1.jpg)\n`,
    );

    const result = writeAccessibilityAssets({ outDir: root, name: "doc", pages });
    const body = readFileSync(result.md, "utf8");

    assert.ok(!body.includes("image-1.jpg"));
    assert.match(result.warnings.join(" "), /not a usable image/);
    assert.ok(!existsSync(path.join(result.assetsDir, "page-001-image-1-embedded-image.jpg")));
  });
});

test("keeps a valid embedded image on a one-page document", () => {
  withTemp((root) => {
    const assets = writeFixture(root);
    writeFileSync(path.join(assets, "image-1.jpg"), png());
    writeFileSync(
      path.join(root, "doc.md"),
      "<!-- page: 1 -->\n\n![Figure 1](doc.assets/image-1.jpg)\n",
    );

    const result = writeAccessibilityAssets({ outDir: root, name: "doc", pages: pages.slice(0, 1) });
    const body = readFileSync(result.md, "utf8");

    assert.match(body, /!\[Embedded image on page 1\]\(doc\.assets\/page-001-image-1-embedded-image\.jpg\)/);
    assert.ok(existsSync(path.join(result.assetsDir, "page-001-image-1-embedded-image.jpg")));
  });
});
