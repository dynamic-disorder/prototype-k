/**
 * Bundling an existing Markdown document with its sibling assets.
 *
 * A scraped article arrives as `Article.md` beside `Article.Picture1.webp`,
 * with the Markdown referencing those siblings by name. The bundle puts the
 * document and its images into the same shape extraction writes, and every
 * reference must still resolve afterwards.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  assetName,
  bundleOne,
  companionAssets,
  findMarkdown,
  main,
  rewriteReferences,
} from "../scripts/bundle-markdown.mjs";

function withTemp(body) {
  const root = mkdtempSync(path.join(tmpdir(), "bundle-markdown-"));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const ARTICLE = [
  "<!-- page: 1 -->",
  "",
  "A sentence with ![Picture1.webp](My_Article__Draft.Picture1.webp) inline.",
  "",
  "![Picture2.webp](My_Article__Draft.Picture2.webp)",
  "",
].join("\n");

function fixture(root) {
  const md = path.join(root, "My_Article__Draft.md");
  writeFileSync(md, ARTICLE, "utf8");
  writeFileSync(path.join(root, "My_Article__Draft.Picture1.webp"), "one", "utf8");
  writeFileSync(path.join(root, "My_Article__Draft.Picture2.webp"), "two", "utf8");
  writeFileSync(path.join(root, "My_Article__Draft.notes.txt"), "notes", "utf8");
  writeFileSync(path.join(root, "Other.md"), "other\n", "utf8");
  return md;
}

test("a companion is a sibling that continues the stem after a separator", () => {
  withTemp((root) => {
    const md = fixture(root);
    const names = companionAssets(md).map((file) => path.basename(file));
    assert.deepEqual(names, [
      "My_Article__Draft.Picture1.webp",
      "My_Article__Draft.Picture2.webp",
      "My_Article__Draft.notes.txt",
    ]);
  });
});

test("an asset keeps the part of its name after the stem", () => {
  assert.equal(
    assetName("My_Article__Draft.Picture1.webp", "/tmp/My_Article__Draft.md"),
    "Picture1.webp",
  );
});

test("references are rewritten to the assets folder, and counted", () => {
  const result = rewriteReferences(
    ARTICLE,
    [
      { from: "My_Article__Draft.Picture1.webp", to: "my-article.assets/Picture1.webp" },
      { from: "My_Article__Draft.Picture2.webp", to: "my-article.assets/Picture2.webp" },
    ],
    "my-article",
  );
  assert.equal(result.rewritten, 2);
  assert.match(result.text, /!\[Picture1\.webp\]\(my-article\.assets\/Picture1\.webp\)/);
  assert.doesNotMatch(result.text, /My_Article__Draft\./);
});

test("bundles a document into one folder with its assets and a sidecar", () => {
  withTemp((root) => {
    const md = fixture(root);
    const result = bundleOne(md, { name: "my-article" });

    assert.equal(result.name, "my-article");
    assert.equal(result.assets, 3);
    assert.equal(result.rewritten, 2);

    const folder = path.join(root, "my-article");
    const body = readFileSync(path.join(folder, "my-article.md"), "utf8");
    assert.match(body, /my-article\.assets\/Picture1\.webp/);
    assert.match(body, /my-article\.assets\/Picture2\.webp/);
    assert.ok(existsSync(path.join(folder, "my-article.assets", "Picture1.webp")));
    assert.ok(existsSync(path.join(folder, "my-article.assets", "Picture2.webp")));
    assert.ok(existsSync(path.join(folder, "my-article.assets", "notes.txt")));

    const meta = JSON.parse(readFileSync(path.join(folder, "my-article.metadata.json"), "utf8"));
    assert.equal(meta.kind, "markdown");
    assert.equal(meta.assets, 3);
    assert.equal(meta.referencesRewritten, 2);

    // Copy is the default: the originals stay where they were.
    assert.ok(existsSync(md));
    assert.ok(existsSync(path.join(root, "My_Article__Draft.Picture1.webp")));
  });
});

test("refuses to overwrite an earlier bundle", () => {
  withTemp((root) => {
    const md = fixture(root);
    bundleOne(md, { name: "my-article" });
    assert.throws(() => bundleOne(md, { name: "my-article" }), /refusing to overwrite/);
  });
});

test("--move removes the originals after a successful write", () => {
  withTemp((root) => {
    const md = fixture(root);
    const result = bundleOne(md, { name: "my-article", move: true });
    assert.equal(result.assets, 3);
    assert.equal(existsSync(md), false);
    assert.equal(existsSync(path.join(root, "My_Article__Draft.Picture1.webp")), false);
    assert.ok(existsSync(path.join(root, "my-article", "my-article.md")));
    assert.ok(existsSync(path.join(root, "Other.md")), "another document is untouched");
  });
});

test("the guard refuses a path that names no Markdown", () => {
  withTemp((root) => {
    writeFileSync(path.join(root, "paper.pdf"), "not a pdf", "utf8");
    assert.equal(main([root]), 1);
    assert.equal(findMarkdown(root).length, 0);
    assert.match(path.basename(root), /bundle-markdown-/);
  });
});

test("two documents that would share one folder are refused", () => {
  withTemp((root) => {
    mkdirSync(path.join(root, "nested"));
    writeFileSync(path.join(root, "A B.md"), "a\n", "utf8");
    writeFileSync(path.join(root, "nested", "A-B.md"), "b\n", "utf8");
    assert.equal(main([root]), 1);
    assert.equal(existsSync(path.join(root, "a-b")), false, "nothing is written");
  });
});

test("the command line writes one folder per document", () => {
  withTemp((root) => {
    fixture(root);
    const status = main([path.join(root, "My_Article__Draft.md"), "--name", "my-article"]);
    assert.equal(status, 0);
    assert.ok(existsSync(path.join(root, "my-article", "my-article.md")));
  });
});
