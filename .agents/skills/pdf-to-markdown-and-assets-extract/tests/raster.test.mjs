/**
 * Tests for the optional raster path.
 *
 * No rasteriser is assumed: the end-to-end case supplies a stub through
 * `PDF_RASTER_CMD`, the default path is proven to skip cleanly when no tool
 * exists, and one host case proves a renderer installed outside `PATH` is still
 * found (it skips on a host without one).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  byPageNumber,
  expandFolders,
  findRasteriser,
  rasterCommand,
  rasterInstalls,
  rasterise,
  splitCommand,
  toolVersion,
  windowsRasteriser,
} from "../scripts/rasterise.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function withTemp(body) {
  const root = mkdtempSync(path.join(tmpdir(), "pdf-raster-"));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("splits a quoted command into tokens", () => {
  assert.deepEqual(splitCommand('"C:\\Program Files\\tool.exe" -r 150 file.pdf out'), [
    "C:\\Program Files\\tool.exe",
    "-r",
    "150",
    "file.pdf",
    "out",
  ]);
});

test("substitutes every placeholder in a template", () => {
  const { command, args } = rasterCommand("pdftoppm -png -r {dpi} {input} {prefix}", {
    input: "doc.pdf",
    prefix: "out/page",
    dpi: 150,
  });

  assert.equal(command, "pdftoppm");
  assert.deepEqual(args, ["-png", "-r", "150", "doc.pdf", "out/page"]);
});

test("substitutes a placeholder embedded in a longer token", () => {
  const { args } = rasterCommand("mutool draw -o {prefix}-%d.png -r {dpi} {input}", {
    input: "doc.pdf",
    prefix: "out/page",
    dpi: 96,
  });

  assert.deepEqual(args, ["draw", "-o", "out/page-%d.png", "-r", "96", "doc.pdf"]);
});

test("substitutes the assets directory", () => {
  const { args } = rasterCommand("tool -o {assets} {input}", {
    input: "doc.pdf",
    prefix: path.join("out", "page"),
    dpi: 150,
  });

  assert.deepEqual(args, ["-o", "out", "doc.pdf"]);
});

test("orders page files naturally", () => {
  assert.deepEqual(["page-10.png", "page-2.png", "page-1.png"].sort(byPageNumber), [
    "page-1.png",
    "page-2.png",
    "page-10.png",
  ]);
});

test("honours PDF_RASTER_CMD over the built-in candidates", () => {
  const found = findRasteriser({ env: { PDF_RASTER_CMD: "custom-tool {input} {prefix}" } });
  assert.deepEqual(found, {
    tool: "custom",
    template: "custom-tool {input} {prefix}",
    source: "override",
  });
});

test("reads a version printed to stderr", () => {
  assert.equal(toolVersion({ stdout: "", stderr: "pdftoppm version 24.02.0\nCopyright\n" }), "pdftoppm version 24.02.0");
  assert.equal(toolVersion({ stdout: "magick 7.1.1\n", stderr: "" }), "magick 7.1.1");
  assert.equal(toolVersion({}), undefined);
});

test("lists the standard install folder in renderer preference order", () => {
  const windows = rasterInstalls({
    platform: "win32",
    env: {
      ProgramFiles: "D:\\Apps",
      "ProgramFiles(x86)": "D:\\Apps32",
      LOCALAPPDATA: "D:\\Local",
      ProgramData: "C:\\ProgramData",
      USERPROFILE: "C:\\Users\\me",
    },
  });
  assert.ok(windows.includes(path.win32.join("C:\\ProgramData", "chocolatey", "bin", "pdftoppm.exe")));
  assert.ok(windows.includes(path.win32.join("D:\\Local", "Microsoft", "WinGet", "Links", "magick.exe")));

  const mac = rasterInstalls({ platform: "darwin", env: {} });
  assert.deepEqual(mac.slice(0, 3), [
    "/opt/homebrew/bin/pdftoppm",
    "/usr/local/bin/pdftoppm",
    "/opt/local/bin/pdftoppm",
  ]);
  assert.ok(mac.includes("/usr/local/bin/magick"));

  const linux = rasterInstalls({ platform: "linux", env: {} });
  assert.equal(linux[0], "/usr/bin/pdftoppm");
  assert.ok(linux.includes("/usr/local/bin/mutool"));
  assert.deepEqual(rasterInstalls({ platform: "aix", env: {} }), []);
});

test("expands a versioned install folder", (t) => {
  if (process.platform !== "win32") {
    t.skip("the wildcard rule is a Windows layout");
    return;
  }

  withTemp((root) => {
    const versioned = path.join(root, "ImageMagick-7.1.1");
    mkdirSync(versioned);

    const folders = expandFolders("%ProgramFiles%\\ImageMagick*", {
      env: { ProgramFiles: root },
      platform: "win32",
    });

    assert.deepEqual(folders, [versioned]);
    assert.ok(rasterInstalls({ platform: "win32", env: { ProgramFiles: root } }).includes(path.win32.join(versioned, "magick.exe")));
  });
});

test("finds a renderer in a standard install folder when PATH is stale", () => {
  withTemp((root) => {
    const executable = path.join(root, "poppler-24.02.0", "Library", "bin", "pdftoppm");
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(executable, "");

    const found = findRasteriser({
      env: {},
      candidates: [],
      installs: [executable],
      runner: () => ({ status: 1, stdout: "", stderr: "pdftoppm version 24.02.0\nCopyright 2005-2024\n" }),
    });

    assert.equal(found.tool, "pdftoppm");
    assert.equal(found.source, "install");
    assert.equal(found.executable, executable);
    assert.equal(found.version, "pdftoppm version 24.02.0");

    const { command, args } = rasterCommand(found.template, {
      input: "doc.pdf",
      prefix: "out/page",
      dpi: 150,
    });
    assert.equal(command, executable);
    assert.deepEqual(args, ["-png", "-r", "150", "doc.pdf", "out/page"]);
  });
});

test("ignores an install candidate that cannot launch", () => {
  withTemp((root) => {
    const executable = path.join(root, "bin", "pdftoppm");
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(executable, "");

    const found = findRasteriser({
      env: { PDF_NO_WINDOWS_RASTER: "1" },
      candidates: [],
      installs: [executable],
      runner: () => ({ error: new Error("ENOENT"), status: null, stdout: "", stderr: "" }),
    });

    assert.equal(found, null);
  });
});

test("skips the install-folder scan when PDF_NO_RASTER_INSTALL=1", () => {
  withTemp((root) => {
    const executable = path.join(root, "bin", "pdftoppm");
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(executable, "");

    const found = findRasteriser({
      env: { PDF_NO_RASTER_INSTALL: "1", PDF_NO_WINDOWS_RASTER: "1" },
      candidates: [],
      installs: [executable],
      runner: () => ({ status: 0, stdout: "pdftoppm version 24.02.0\n", stderr: "" }),
    });

    assert.equal(found, null);
  });
});

test("finds the host's renderer even when PATH does not carry it", (t) => {
  const env = { ...process.env };
  delete env.PDF_RASTER_CMD;
  delete env.PDF_NO_RASTER_INSTALL;

  const found = findRasteriser({ env, candidates: [] });
  if (found === null || found.source !== "install") {
    t.skip("host has no renderer outside PATH");
    return;
  }

  assert.ok(found.executable, "a found renderer names the executable it ran");
  assert.ok(existsSync(found.executable), `${found.executable} exists`);
  assert.match(found.version ?? "", /\d+\.\d+/);
});

test("skips cleanly when no rasteriser exists", () => {
  withTemp((root) => {
    const outcome = rasterise({
      pdf: "doc.pdf",
      outDir: path.join(root, "pages"),
      env: { PDF_NO_WINDOWS_RASTER: "1" },
      candidates: [],
      installs: [],
    });

    assert.equal(outcome.status, "skipped");
    assert.equal(outcome.pages.length, 0);
    assert.match(outcome.reason, /PDF_RASTER_CMD/);
    assert.equal(readdirSync(root).length, 0, "a skip must not create output");
  });
});

test("renders a real page with the Windows built-in renderer", (t) => {
  if (process.platform !== "win32" || !windowsRasteriser()) {
    t.skip("no Windows PDF renderer on this host");
    return;
  }

  withTemp((root) => {
    const outcome = rasterise({
      pdf: path.join(HERE, "..", "tests", "resources", "embedded-images-tables.pdf"),
      outDir: path.join(root, "doc.assets"),
      dpi: 72,
      env: {},
      candidates: [],
    });

    assert.equal(outcome.status, "rendered");
    assert.equal(outcome.tool, "windows-pdf");
    assert.equal(outcome.pages.length, 1);
    assert.equal(readFileSync(outcome.pages[0]).subarray(1, 4).toString("latin1"), "PNG");
  });
});

test("renders every page through a stub rasteriser", () => {
  withTemp((root) => {
    const stub = path.join(root, "stub.mjs");
    writeFileSync(
      stub,
      [
        'import { writeFileSync } from "node:fs";',
        "const [input, prefix] = process.argv.slice(2);",
        'if (!input.endsWith(".pdf")) throw new Error("no pdf");',
        'writeFileSync(`${prefix}-1.png`, "page one");',
        'writeFileSync(`${prefix}-10.png`, "page ten");',
        'writeFileSync(`${prefix}-2.png`, "page two");',
      ].join("\n"),
      "utf8",
    );

    const pdf = path.join(root, "doc.pdf");
    writeFileSync(pdf, "%PDF-1.4\n", "utf8");

    const outcome = rasterise({
      pdf,
      outDir: path.join(root, "pages"),
      dpi: 96,
      env: {
        PDF_RASTER_CMD: `"${process.execPath}" "${stub}" {input} {prefix} {dpi}`,
      },
    });

    assert.equal(outcome.status, "rendered");
    assert.equal(outcome.tool, "custom");
    assert.equal(outcome.dpi, 96);
    assert.deepEqual(
      outcome.pages.map((file) => path.basename(file)),
      ["page-1.png", "page-2.png", "page-10.png"],
    );
    assert.equal(readFileSync(outcome.pages[0], "utf8"), "page one");
  });
});

test("fails when the rasteriser exits non-zero", () => {
  withTemp((root) => {
    const stub = path.join(root, "fail.mjs");
    writeFileSync(stub, 'console.error("boom"); process.exit(3);', "utf8");

    assert.throws(
      () =>
        rasterise({
          pdf: path.join(root, "doc.pdf"),
          outDir: path.join(root, "pages"),
          env: { PDF_RASTER_CMD: `"${process.execPath}" "${stub}"` },
        }),
      /exited 3: boom/,
    );
  });
});

test("the CLI writes raster.json and exits 0 when skipping", () => {
  withTemp((root) => {
    const out = path.join(root, "pages");
    const emptyBin = path.join(root, "bin");
    mkdirSync(out);
    mkdirSync(emptyBin);

    // PATH must hold no rasteriser at all; Node itself is invoked by full path.
    const cleanEnv = { ...process.env, PATH: emptyBin };
    delete cleanEnv.PDF_RASTER_CMD;
    cleanEnv.PDF_NO_WINDOWS_RASTER = "1";
    // This host may carry a real renderer; the case proves the skip, not discovery.
    cleanEnv.PDF_NO_RASTER_INSTALL = "1";

    const result = spawnSync(
      process.execPath,
      [path.join(HERE, "..", "scripts", "rasterise.mjs"), "multi-column", out],
      { encoding: "utf8", env: cleanEnv },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /raster skipped|raster: \d+ page/);
    const report = JSON.parse(readFileSync(path.join(out, "raster.json"), "utf8"));
    assert.equal(report.status, "skipped");
    assert.equal(report.dpi, 150);
  });
});
