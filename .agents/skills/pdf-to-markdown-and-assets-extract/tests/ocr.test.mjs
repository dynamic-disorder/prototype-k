/**
 * Tests for the optional OCR path.
 *
 * No OCR engine is assumed: the end-to-end case supplies a stub through
 * `PDF_OCR_CMD`, the default path is proven to skip cleanly when no engine
 * exists, and one host case proves an engine installed outside `PATH` is still
 * found (it skips on a host without Tesseract).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  engineVersion,
  findOcrEngine,
  installCandidates,
  ocrCommand,
  ocrImages,
  resolveCommand,
  windowsOcrEngine,
} from "../scripts/ocr.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function withTemp(body) {
  const root = mkdtempSync(path.join(tmpdir(), "pdf-ocr-"));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("substitutes image, output and language placeholders", () => {
  const { command, args } = ocrCommand("tesseract {image} {out} -l {lang}", {
    image: "page-1.png",
    out: "out/page-1",
    lang: "deu",
  });

  assert.equal(command, "tesseract");
  assert.deepEqual(args, ["page-1.png", "out/page-1", "-l", "deu"]);
});

test("skips when there are no page images", () => {
  withTemp((root) => {
    const outcome = ocrImages({ images: [], outDir: path.join(root, "ocr"), env: {} });

    assert.equal(outcome.status, "skipped");
    assert.match(outcome.reason, /no page images/);
    assert.equal(readdirSync(root).length, 0);
  });
});

test("skips when no engine exists", () => {
  withTemp((root) => {
    const outcome = ocrImages({
      images: [path.join(root, "page-1.png")],
      outDir: path.join(root, "ocr"),
      env: { PDF_NO_WINDOWS_OCR: "1" },
      candidates: [],
      installs: [],
    });

    assert.equal(outcome.status, "skipped");
    assert.match(outcome.reason, /PDF_OCR_CMD/);
  });
});

test("falls back to the Windows OCR engine when Tesseract is absent", (t) => {
  if (process.platform !== "win32" || !windowsOcrEngine()) {
    t.skip("no Windows OCR engine on this host");
    return;
  }

  const found = findOcrEngine({ env: {}, candidates: [] });
  assert.equal(found.tool, "windows-ocr");
  assert.equal(found.source, "builtin");
  assert.match(found.template, /ocr-win\.ps1/);
});

test("reads the build from the engine banner", () => {
  assert.equal(engineVersion("tesseract v5.4.0.20240606\n leptonica-1.84.1\n"), "v5.4.0.20240606");
  assert.equal(engineVersion(""), undefined);
  assert.equal(engineVersion(undefined), undefined);
});

test("resolves the executable of a PATH engine with where or which", () => {
  const calls = [];
  const windows = resolveCommand("tesseract", {
    platform: "win32",
    runner: (locator, args) => {
      calls.push([locator, ...args]);
      return { status: 0, stdout: "C:\\Program Files\\Tesseract-OCR\\tesseract.exe\r\n", stderr: "" };
    },
  });
  assert.equal(windows, "C:\\Program Files\\Tesseract-OCR\\tesseract.exe");
  assert.deepEqual(calls[0], ["where", "tesseract"]);

  assert.equal(
    resolveCommand("tesseract", {
      platform: "linux",
      runner: () => ({ status: 0, stdout: "/usr/bin/tesseract\n", stderr: "" }),
    }),
    "/usr/bin/tesseract",
  );
  assert.equal(
    resolveCommand("tesseract", {
      platform: "darwin",
      runner: () => ({ error: new Error("ENOENT"), status: null, stdout: "", stderr: "" }),
    }),
    null,
  );
  assert.equal(
    resolveCommand("tesseract", { platform: "linux", runner: () => ({ status: 1, stdout: "", stderr: "" }) }),
    null,
  );
});

test("records the executable of an engine found on PATH", () => {
  const found = findOcrEngine({
    env: {},
    candidates: [{ tool: "tesseract", template: "tesseract {image} {out} -l {lang}" }],
    platform: "win32",
    runner: (command) =>
      command === "where"
        ? { status: 0, stdout: "C:\\Tools\\tesseract.exe\n", stderr: "" }
        : { status: 0, stdout: "tesseract v5.4.0.20240606\n", stderr: "" },
  });

  assert.equal(found.source, "path");
  assert.equal(found.executable, "C:\\Tools\\tesseract.exe");
  assert.equal(found.version, "v5.4.0.20240606");
});

test("lists the standard install folder for each platform", () => {
  const windows = installCandidates({
    platform: "win32",
    env: {
      ProgramFiles: "D:\\Apps",
      "ProgramFiles(x86)": "D:\\Apps32",
      LOCALAPPDATA: "D:\\Local",
      ProgramData: "C:\\ProgramData",
      USERPROFILE: "C:\\Users\\me",
    },
  });
  assert.ok(windows.includes(path.win32.join("D:\\Apps", "Tesseract-OCR", "tesseract.exe")));
  assert.ok(windows.includes(path.win32.join("D:\\Local", "Programs", "Tesseract-OCR", "tesseract.exe")));
  assert.ok(windows.includes(path.win32.join("C:\\Users\\me\\scoop", "shims", "tesseract.exe")));
  assert.ok(windows.every((candidate) => candidate.endsWith("tesseract.exe")));

  assert.deepEqual(installCandidates({ platform: "darwin", env: {} }), [
    "/opt/homebrew/bin/tesseract",
    "/usr/local/bin/tesseract",
    "/opt/local/bin/tesseract",
  ]);
  assert.ok(installCandidates({ platform: "linux", env: {} }).includes("/usr/bin/tesseract"));
  assert.deepEqual(installCandidates({ platform: "aix", env: {} }), []);
});

test("finds Tesseract in a standard install folder when PATH is stale", () => {
  withTemp((root) => {
    const executable = path.join(
      root,
      "Program Files",
      "Tesseract-OCR",
      process.platform === "win32" ? "tesseract.exe" : "tesseract",
    );
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(executable, "");

    const found = findOcrEngine({
      env: {},
      candidates: [],
      installs: [executable],
      runner: () => ({ status: 0, stdout: "tesseract v5.4.0.20240606\n leptonica-1.84.1\n", stderr: "" }),
    });

    assert.equal(found.tool, "tesseract");
    assert.equal(found.source, "install");
    assert.equal(found.executable, executable);
    assert.equal(found.version, "v5.4.0.20240606");

    const { command, args } = ocrCommand(found.template, {
      image: "page-1.png",
      out: "out/page-1",
      lang: "eng",
    });
    assert.equal(command, executable);
    assert.deepEqual(args, ["page-1.png", "out/page-1", "-l", "eng"]);
  });
});

test("ignores an install candidate that does not run", () => {
  withTemp((root) => {
    const executable = path.join(root, "Tesseract-OCR", "tesseract");
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(executable, "");

    const found = findOcrEngine({
      env: { PDF_NO_WINDOWS_OCR: "1" },
      candidates: [],
      installs: [executable],
      runner: () => ({ status: 1, stdout: "", stderr: "not an engine" }),
    });

    assert.equal(found, null);
  });
});

test("skips the install-folder scan when PDF_NO_OCR_INSTALL=1", () => {
  withTemp((root) => {
    const executable = path.join(root, "Tesseract-OCR", "tesseract");
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(executable, "");

    const found = findOcrEngine({
      env: { PDF_NO_OCR_INSTALL: "1", PDF_NO_WINDOWS_OCR: "1" },
      candidates: [],
      installs: [executable],
      runner: () => ({ status: 0, stdout: "tesseract v9.9.9\n", stderr: "" }),
    });

    assert.equal(found, null);
  });
});

test("finds the host's Tesseract even when PATH does not carry it", (t) => {
  const env = { ...process.env };
  delete env.PDF_OCR_CMD;
  delete env.PDF_NO_OCR_INSTALL;

  const found = findOcrEngine({ env, candidates: [] });
  if (found === null || found.tool !== "tesseract") {
    t.skip("host has no Tesseract outside PATH");
    return;
  }

  assert.ok(found.executable, "a found Tesseract names the executable it ran");
  assert.ok(existsSync(found.executable), `${found.executable} exists`);
  assert.match(found.version ?? "", /v?\d+\.\d+/);
});

test("reads pages through a stub engine", () => {
  withTemp((root) => {
    const images = path.join(root, "pages");
    mkdirSync(images);
    writeFileSync(path.join(images, "page-1.png"), "png");
    writeFileSync(path.join(images, "page-2.png"), "png");

    const stub = path.join(root, "stub.mjs");
    writeFileSync(
      stub,
      [
        'import { writeFileSync } from "node:fs";',
        "const [image, out] = process.argv.slice(2);",
        'writeFileSync(`${out}.txt`, `text of ${image}`);',
      ].join("\n"),
      "utf8",
    );

    const outcome = ocrImages({
      images: [path.join(images, "page-1.png"), path.join(images, "page-2.png")],
      outDir: path.join(root, "ocr"),
      env: { PDF_OCR_CMD: `"${process.execPath}" "${stub}" {image} {out}` },
    });

    assert.equal(outcome.status, "extracted");
    assert.equal(outcome.tool, "custom");
    assert.deepEqual(
      outcome.pages.map((page) => page.text),
      ["page-1.txt", "page-2.txt"],
    );
    assert.match(readFileSync(path.join(root, "ocr", "page-1.txt"), "utf8"), /page-1\.png/);
    assert.ok(outcome.pages.every((page) => page.chars > 0));
  });
});

test("fails when the engine exits non-zero", () => {
  withTemp((root) => {
    const stub = path.join(root, "fail.mjs");
    writeFileSync(stub, 'console.error("boom"); process.exit(4);', "utf8");

    assert.throws(
      () =>
        ocrImages({
          images: [path.join(root, "page-1.png")],
          outDir: path.join(root, "ocr"),
          env: { PDF_OCR_CMD: `"${process.execPath}" "${stub}"` },
        }),
      /exited 4: boom/,
    );
  });
});

test("fails when the engine writes no text file", () => {
  withTemp((root) => {
    const stub = path.join(root, "silent.mjs");
    writeFileSync(stub, "process.exit(0);", "utf8");

    assert.throws(
      () =>
        ocrImages({
          images: [path.join(root, "page-1.png")],
          outDir: path.join(root, "ocr"),
          env: { PDF_OCR_CMD: `"${process.execPath}" "${stub}"` },
        }),
      /wrote no page-1\.txt/,
    );
  });
});

test("the CLI writes ocr.json and exits 0 when skipping", () => {
  withTemp((root) => {
    const images = path.join(root, "pages");
    const out = path.join(root, "ocr");
    const emptyBin = path.join(root, "bin");
    mkdirSync(images);
    mkdirSync(emptyBin);
    writeFileSync(path.join(images, "page-1.png"), "png");

    // PATH must hold no OCR engine; Node itself is invoked by full path.
    const cleanEnv = { ...process.env, PATH: emptyBin };
    delete cleanEnv.PDF_OCR_CMD;
    cleanEnv.PDF_NO_WINDOWS_OCR = "1";
    // This host may carry a real install; the case proves the skip, not discovery.
    cleanEnv.PDF_NO_OCR_INSTALL = "1";

    const result = spawnSync(
      process.execPath,
      [path.join(HERE, "..", "scripts", "ocr.mjs"), images, out],
      { encoding: "utf8", env: cleanEnv },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ocr skipped|ocr: \d+ page/);
    const report = JSON.parse(readFileSync(path.join(out, "ocr.json"), "utf8"));
    assert.equal(report.status, "skipped");
  });
});
