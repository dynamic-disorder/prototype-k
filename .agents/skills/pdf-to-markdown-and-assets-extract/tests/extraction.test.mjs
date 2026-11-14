/**
 * The output contract the skill documents, proven without Python.
 *
 * Two fixtures: a generated one-page PDF (guard, page marker, sidecar, manifest)
 * and the real-world one with an embedded JPEG (text recovery, asset extraction).
 * Node port of tests/test_pdf_extraction_fixture.py and
 * tests/test_embedded_pdf_fixture.py.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { main } from "../scripts/check_input.mjs";
import {
  extractImage,
  extractText,
  FIXTURE_NAME,
  listPages,
  pageBody,
  pageCount,
  pageMarkedMarkdown,
  PDF_PATH,
  resourcePath,
  writeExtraction,
} from "../lib/pdf-extract.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GUARD = path.join(HERE, "..", "scripts", "check_input.mjs");

/** Expected values for the bundled fixtures; update the JSON, not the tests. */
const EXPECTED = JSON.parse(readFileSync(path.join(HERE, "fixture-expectations.json"), "utf8"))
  .fixtures;

const TEXT_OPERATOR = /\(([\s\S]*?)\)\s*Tj/;

/**
 * Build a minimal valid PDF with one text run per page.
 * A string makes a one-page document; an array makes one page per entry.
 */
function makePdf(input) {
  const texts = Array.isArray(input) ? input : [input];
  const pageNumbers = texts.map((_, index) => 3 + index * 2);
  const fontNumber = 3 + texts.length * 2;

  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"),
    Buffer.from(
      `<< /Type /Pages /Kids [${pageNumbers.map((n) => `${n} 0 R`).join(" ")}] ` +
        `/Count ${texts.length} >>`,
      "latin1",
    ),
  ];

  texts.forEach((text, index) => {
    const content = Buffer.from(`BT /F1 24 Tf 72 720 Td (${text}) Tj ET`, "latin1");
    objects.push(
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
          `/Resources << /Font << /F1 ${fontNumber} 0 R >> >> ` +
          `/Contents ${pageNumbers[index] + 1} 0 R >>`,
        "latin1",
      ),
    );
    objects.push(
      Buffer.concat([
        Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "latin1"),
        content,
        Buffer.from("\nendstream", "latin1"),
      ]),
    );
  });

  objects.push(
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "latin1"),
  );

  const out = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets = [0];
  let length = out[0].length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const chunk = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, "latin1"),
      object,
      Buffer.from("\nendobj\n", "latin1"),
    ]);
    out.push(chunk);
    length += chunk.length;
  });

  const xref = length;
  const trailer = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`];
  for (const offset of offsets.slice(1)) {
    trailer.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  }
  trailer.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return Buffer.concat([...out, Buffer.from(trailer.join(""), "latin1")]);
}

function extractFixtureText(pdfBytes) {
  const match = TEXT_OPERATOR.exec(pdfBytes.toString("latin1"));
  return match ? match[1] : "";
}

function writeGeneratedExtraction(pdfPath, outDir) {
  const name = path.basename(pdfPath, path.extname(pdfPath));
  const text = extractFixtureText(readFileSync(pdfPath));

  const md = path.join(outDir, `${name}.md`);
  writeFileSync(md, `<!-- page: 1 -->\n\n${text}\n`, "utf8");

  const meta = path.join(outDir, `${name}.metadata.json`);
  writeFileSync(
    meta,
    JSON.stringify({ docId: name, edition: "test", pages: 1, textPages: 1 }),
    "utf8",
  );

  const summary = path.join(outDir, `${name}.extraction-summary.json`);
  writeFileSync(summary, JSON.stringify({ documents: [{ name, pages: 1 }] }, null, 2), "utf8");

  return { md, meta, summary };
}

function withTemp(body) {
  const root = mkdtempSync(path.join(tmpdir(), "pdf-extract-"));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("a generated one-page PDF", () => {
  it("is a PDF", () => {
    const bytes = makePdf("Hello PDF extraction");
    assert.ok(bytes.subarray(0, 8).toString("latin1").startsWith("%PDF-1.4"));
  });

  it("passes the input guard", () => {
    withTemp((root) => {
      const pdf = path.join(root, "sample.pdf");
      writeFileSync(pdf, makePdf("Hello PDF extraction"));
      assert.equal(main([pdf]), 0);
    });
  });

  it("has recoverable text", () => {
    assert.equal(extractFixtureText(makePdf("Hello PDF extraction")), "Hello PDF extraction");
  });

  it("writes Markdown with a page marker and the text", () => {
    withTemp((root) => {
      const pdf = path.join(root, "sample.pdf");
      writeFileSync(pdf, makePdf("Hello PDF extraction"));
      const { md } = writeGeneratedExtraction(pdf, root);
      const body = readFileSync(md, "utf8");
      assert.ok(body.startsWith("<!-- page: 1 -->"));
      assert.match(body, /Hello PDF extraction/);
    });
  });

  it("writes a sidecar and manifest that are valid JSON", () => {
    withTemp((root) => {
      const pdf = path.join(root, "sample.pdf");
      writeFileSync(pdf, makePdf("Hello PDF extraction"));
      const { meta, summary } = writeGeneratedExtraction(pdf, root);

      assert.equal(JSON.parse(readFileSync(meta, "utf8")).pages, 1);
      assert.equal(JSON.parse(readFileSync(summary, "utf8")).documents[0].name, "sample");
    });
  });

  it("runs the guard from the command line", () => {
    withTemp((root) => {
      const pdf = path.join(root, "sample.pdf");
      writeFileSync(pdf, makePdf("Hello PDF extraction"));

      const result = spawnSync(process.execPath, [GUARD, pdf], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /input ok: 1 PDF\(s\)/);
    });
  });
});

describe("a generated multi-page PDF", () => {
  const texts = ["First page", "Second page", "Third page"];

  it("splits the pages in document order", () => {
    const pages = listPages(makePdf(texts));
    assert.deepEqual(
      pages.map((page) => page.number),
      [1, 2, 3],
    );
    assert.deepEqual(
      pages.map((page) => page.text),
      texts,
    );
  });

  it("writes one marker per page, without changing the writer", () => {
    const md = pageMarkedMarkdown(listPages(makePdf(texts)), "sample");
    assert.equal(md.match(/<!-- page: \d+ -->/g).length, 3);
    assert.match(md, /<!-- page: 2 -->\n\nSecond page/);
    assert.match(md, /<!-- page: 3 -->\n\nThird page/);
    assert.ok(md.endsWith("![Figure 1](sample.assets/image-1.jpg)\n"));
  });

  it("counts the pages it extracted", () => {
    assert.equal(pageCount(makePdf(texts)), 3);
  });
});

for (const [name, expected] of Object.entries(EXPECTED)) {
  describe(`the ${name} fixture`, () => {
    const pdf = resourcePath(name);
    const data = readFileSync(pdf);

    it("passes the input guard", () => {
      assert.equal(main([pdf]), 0);
    });

    it("reads the expected number of pages", () => {
      assert.equal(listPages(data).length, expected.pages);
    });

    it("numbers the pages from one, in document order", () => {
      assert.deepEqual(
        listPages(data).map((page) => page.number),
        Array.from({ length: expected.pages }, (_, index) => index + 1),
      );
    });

    it("finds text on every page", () => {
      for (const page of listPages(data)) {
        assert.ok(page.text.trim().length > 0, `page ${page.number} carries no text`);
      }
    });

    it("writes one marker per page and the expected line count", () => {
      withTemp((root) => {
        // The writer references whatever page and figure images sit beside it.
        const assets = path.join(root, `${name}.assets`);
        mkdirSync(assets, { recursive: true });
        for (let page = 1; page <= expected.pages; page += 1) {
          writeFileSync(path.join(assets, `page-${page}.png`), "png");
        }
        for (let figure = 1; figure <= expected.figures; figure += 1) {
          writeFileSync(path.join(assets, `figure-${figure}.png`), "png");
        }

        const { md } = writeExtraction(data, root, name);
        const body = readFileSync(md, "utf8");

        assert.equal(body.match(/<!-- page: \d+ -->/g).length, expected.pages);
        assert.equal(body.split("\n").length, expected.markdownLines);
        assert.equal(body.split("\n")[0], "<!-- page: 1 -->");
        assert.ok(body.endsWith("\n"), "fixture Markdown must end with one newline");
      });
    });

    it("references every rendered page and cropped figure", () => {
      withTemp((root) => {
        const assets = path.join(root, `${name}.assets`);
        mkdirSync(assets, { recursive: true });
        const files = [];
        for (let page = 1; page <= expected.pages; page += 1) {
          files.push(`page-${page}.png`);
          writeFileSync(path.join(assets, `page-${page}.png`), "png");
        }
        for (let figure = 1; figure <= expected.figures; figure += 1) {
          files.push(`figure-${figure}.png`);
          writeFileSync(path.join(assets, `figure-${figure}.png`), "png");
        }

        const { md } = writeExtraction(data, root, name);
        const body = readFileSync(md, "utf8");

        assert.match(body, /<!-- page images -->/);
        for (const [index, file] of files.slice(0, expected.pages).entries()) {
          assert.ok(
            body.includes(`![Page ${index + 1}](${name}.assets/${file})`),
            `missing page reference to ${file}`,
          );
          assert.ok(existsSync(path.join(assets, file)), `${file} must exist on disk`);
        }
        if (expected.figures > 0) {
          assert.match(body, /<!-- figures -->/);
          for (let figure = 1; figure <= expected.figures; figure += 1) {
            assert.ok(
              body.includes(`![Figure ${figure}](${name}.assets/figure-${figure}.png)`),
              `missing figure reference ${figure}`,
            );
          }
        }
      });
    });

    it("records the page count in the sidecar and manifest", () => {
      withTemp((root) => {
        const { meta, summary } = writeExtraction(data, root, name);
        const metadata = JSON.parse(readFileSync(meta, "utf8"));
        const manifest = JSON.parse(readFileSync(summary, "utf8"));

        assert.equal(metadata.pages, expected.pages);
        assert.equal(manifest.documents[0].pages, expected.pages);
        assert.equal(manifest.documents[0].name, name);
      });
    });
  });
}

describe("the multi-column fixture", () => {
  const data = readFileSync(resourcePath("multi-column"));

  it("is multi-page, so the per-page path is exercised", () => {
    assert.ok(EXPECTED["multi-column"].pages > 1, "expectations must describe a multi-page fixture");
    assert.ok(listPages(data).length > 1);
  });

  it("keeps pages separate instead of merging them into one blob", () => {
    const pages = listPages(data);
    assert.equal(new Set(pages.map((page) => page.text)).size, pages.length);
    for (const page of pages) {
      assert.ok(page.text.length > 500, `page ${page.number} looks truncated`);
    }
  });

  it("writes no asset reference when the PDF carries no image", () => {
    assert.equal(extractImage(data), null);
    withTemp((root) => {
      const { md, meta } = writeExtraction(data, root, "multi-column");
      const body = readFileSync(md, "utf8");
      assert.ok(!body.includes(".assets/"), "Markdown must not reference a missing asset");
      assert.equal(JSON.parse(readFileSync(meta, "utf8")).images, 0);
    });
  });

  it("joins words that the content stream splits with kerning", () => {
    const pages = listPages(data);
    assert.ok(
      pages.some((page) => /suffers/.test(page.text)),
      "a kerning-split word must be joined",
    );
    assert.ok(
      pages.every((page) => !page.text.includes("suf fers")),
      "kerning must not become a word gap",
    );
  });

  it("keeps the rotated sidebar out of the body flow", () => {
    const body = pageMarkedMarkdown(listPages(data), "multi-column", false);
    assert.match(body, /> Vertical text: /);
    assert.match(body, /arXiv:2004\.04906/);
  });

  it("preserves paragraph breaks instead of one run-on blob", () => {
    const page = listPages(data)[0];
    const body = pageBody(page);
    assert.ok(body.split("\n\n").length >= 4, "page 1 should hold several paragraphs");
    assert.ok(page.lines.length > 20, "page 1 should keep many text lines");
  });

  it("decodes ligatures and math glyphs from the font encodings", () => {
    const text = listPages(data).map((page) => page.text).join("\n");
    assert.match(text, /efficient/, "the fi ligature must decode to text");
    assert.ok(!text.includes("efcient"), "no ligature gap in the body text");
    assert.match(text, /when k \u2265 20/, "the CMSY greaterequal glyph must decode");
  });

  it("presents a table as a monospace facsimile of its printed rows", () => {
    const page = listPages(data).find((candidate) => candidate.text.includes("Training Retriever"));
    assert.ok(page, "the table page must be found");
    const body = pageBody(page);
    assert.match(body, /```text\n/);
    // The header keeps its printed position and the numbers keep their columns;
    // before, this came out as one run-on line per row.
    assert.match(body, /Training Retriever\s+Top-20\s+Top-100/);
    assert.match(body, /None\s+BM25\s+59\.1\s+66\.9\s+55\.0\s+70\.9\s+68\.8\s+73\.7\s+76\.7\s+71\.1\s+84\.1\s+80\.0/);
  });

  it("writes CSV or a pipe table instead when the table format asks for it", () => {
    const page = listPages(data).find((candidate) => candidate.text.includes("Training Retriever"));
    assert.ok(page, "the table page must be found");

    const csv = pageBody(page, { tableFormat: "csv" });
    assert.match(csv, /```csv\n/);
    assert.ok(!csv.includes("```text"), "one table format per run");
    assert.match(csv, /Training,Retriever/);

    const pipe = pageBody(page, { tableFormat: "pipe" });
    assert.match(pipe, /^\| Training \| Retriever \|/);
    assert.match(pipe, /\n\| --- \|/);
    assert.match(pipe, /\n\| None \| BM25 \| 59\.1 \|/);
    assert.ok(!pipe.includes("```text"), "one table format per run");
  });

  it("finds the examples table that has no rules and two passage columns", () => {
    // Table 7 is a header and then a passage per column, each wrapping down its
    // own side: no row carries three cells, so the cell rule cannot see it. It
    // used to fall out as forty paragraphs of prose.
    const page = listPages(data).find((candidate) => candidate.text.includes("Table 7:"));
    assert.ok(page, "the examples-table page must be found");
    const body = pageBody(page);

    assert.match(body, /```text\n/);
    assert.match(body, /Question\s+Passage received by BM25\s+Passage retrieved by DPR/);
    assert.match(body, /What is the body of water/);
    // Both passage columns sit side by side on the printed row.
    assert.match(body, /Title:British Cycling\s+Title: Irish Sea/);
  });

  it("renders the borderless table above Table 6 as a table, not as prose", () => {
    // `Sim Loss / Retrieval Accuracy` has no rules at all: its rows are only
    // positioned text, and they used to fall out as four paragraphs.
    const page = listPages(data).find((page) => page.text.includes("Sim Loss Retrieval Accuracy"));
    assert.ok(page, "the borderless table page must be found");
    const body = pageBody(page);

    assert.match(body, /```text\n/);
    assert.match(body, /Sim Loss\s+Retrieval Accuracy/);
    assert.match(body, /Top-1 Top-5 Top-20 Top-100/);
    assert.match(body, /NLL\s+44\.9\s+66\.8\s+78\.1\s+85\.0/);
  });

  it("does not mistake an equation line for a table", () => {
    const page = listPages(data).find((candidate) => candidate.text.includes("softmax"));
    assert.ok(page, "the equation page must be found");
    assert.ok(!pageBody(page).includes("```text"), "equations are not tables");
  });

  it("rebuilds a displayed formula as LaTeX, in one block", () => {
    const body = pageMarkedMarkdown(listPages(data), "multi-column", false);

    // Eq. (1): a transpose and subscripts, not `sim(q; p) = E Q (q)` split over
    // three Markdown lines with a `|` where the transpose should be.
    assert.ok(
      body.includes("$$ \\mathrm{sim}(q, p) =E_{Q}(q)^{\\top}E_{P}(p). \\tag{1} $$"),
      "Eq. (1) is not one LaTeX display block",
    );
  });

  it("rebuilds the fraction of Eq. (2), which is the formula before 'Positive and negative passages'", () => {
    const body = pageMarkedMarkdown(listPages(data), "multi-column", false);

    // This was nine Markdown lines of glyph soup — `L(qi; p` / `+` / `i ; p` /
    // `−` / `i;1;· · ·` — with `{` as `f` and `,` as `;`.
    assert.ok(
      body.includes(
        "$$ L(q_{i}, p_{i}^{+}, p_{i,1}^{-},\\cdots, p_{i,n}^{-}) =-\\log " +
          "\\frac{e^{\\mathrm{sim}(q_{i},p_{i}^{+})}}" +
          "{e^{\\mathrm{sim}(q_{i},p_{i}^{+})}+\\sum_{j=1}^{n}e^{\\mathrm{sim}(q_{i},p_{i,j}^{-})}}. " +
          "\\tag{2} $$",
      ),
      "Eq. (2) is not the LaTeX of the printed fraction",
    );
  });

  it("keeps the TeX encoding out of the body text", () => {
    const body = pageMarkedMarkdown(listPages(data), "multi-column", false);

    // The set braces of `D = {⟨q_i, …⟩}` decoded as `f` and `g`; the dots of
    // `···` decoded as `←` because a word gap was emitted as a space byte.
    assert.ok(body.includes("$D=\\{\\langle q_{i}"), "the set braces must decode");
    assert.ok(!body.includes("fhq"), "no `f` for an opening brace");
    assert.ok(!body.includes("\\leftarrow"), "a gap must not decode as an arrow");
    assert.ok(body.includes("\\cdots"), "the three dots must be one \\cdots");
  });

  it("references a cropped table image when the assets hold one", () => {
    withTemp((root) => {
      const assets = path.join(root, "multi-column.assets");
      mkdirSync(assets, { recursive: true });
      for (let table = 1; table <= 7; table += 1) {
        writeFileSync(path.join(assets, `table-${table}.png`), "png");
      }

      const { md, meta } = writeExtraction(data, root, "multi-column");
      const body = readFileSync(md, "utf8");

      assert.ok(
        body.includes("![Table 1](multi-column.assets/table-1.png)"),
        "the first table image must be referenced",
      );
      assert.ok(
        body.includes("![Table 7](multi-column.assets/table-7.png)"),
        "the examples table image must be referenced",
      );
      assert.equal(body.match(/!\[Table \d+\]/g).length, 7, "one reference per table");
      assert.equal(JSON.parse(readFileSync(meta, "utf8")).tables, 7);
    });
  });

  it("references a cropped equation image when the assets hold one", () => {
    withTemp((root) => {
      const assets = path.join(root, "multi-column.assets");
      mkdirSync(assets, { recursive: true });
      writeFileSync(path.join(assets, "equation-1.png"), "png");
      writeFileSync(path.join(assets, "equation-2.png"), "png");

      const { md, meta } = writeExtraction(data, root, "multi-column");
      const body = readFileSync(md, "utf8");

      assert.ok(
        body.includes("![Equation (1)](multi-column.assets/equation-1.png)"),
        "the first equation image must be referenced",
      );
      assert.ok(
        body.includes("![Equation (2)](multi-column.assets/equation-2.png)"),
        "the second equation image must be referenced",
      );
      assert.equal(JSON.parse(readFileSync(meta, "utf8")).equations, 5);
    });
  });
});

describe("the embedded-image fixture", () => {
  const data = readFileSync(PDF_PATH);
  const expected = EXPECTED[FIXTURE_NAME];

  it("is a PDF above 100 kB", () => {
    assert.ok(data.subarray(0, 8).toString("latin1").startsWith("%PDF-1.7"));
    assert.ok(data.length > 100_000);
  });

  it("has recoverable article text", () => {
    const text = extractText(data).toLowerCase();
    assert.match(text, /inhibitor/);
    assert.match(text, /stainless/);
  });

  it("carries an embedded JPEG of 1001x673", () => {
    const image = extractImage(data);
    assert.ok(image, "no embedded image found");
    assert.equal(image.width, 1001);
    assert.equal(image.height, 673);
    assert.equal(image.bytes.subarray(0, 3).toString("hex"), "ffd8ff");
  });

  it("writes Markdown, sidecar, manifest and the asset", () => {
    withTemp((root) => {
      const output = path.join(root, "extracted");
      mkdirSync(output);
      const { md, meta, summary, imagePath } = writeExtraction(data, output);

      const body = readFileSync(md, "utf8");
      assert.ok(body.startsWith("<!-- page: 1 -->"));
      assert.match(body.toLowerCase(), /inhibitor/);
      assert.ok(body.includes("(embedded-images-tables.assets/image-1.jpg)"));

      assert.equal(readFileSync(imagePath).subarray(0, 3).toString("hex"), "ffd8ff");
      const metadata = JSON.parse(readFileSync(meta, "utf8"));
      const manifest = JSON.parse(readFileSync(summary, "utf8"));
      assert.equal(metadata.images, 1);
      assert.equal(metadata.pages, expected.pages);
      assert.equal(manifest.documents[0].images, 1);
      assert.equal(manifest.documents[0].pages, expected.pages);
    });
  });
});
