/**
 * Tests for the Node port of the input guard.
 *
 * Mirrors tests/test_check_input.py case for case, adds a command-line run, and
 * compares against the Python guard whenever Python is available so the two
 * implementations cannot drift apart unnoticed.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { findPdfs, main } from "../scripts/check_input.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, "..", "scripts", "check_input.mjs");
const PYTHON_SCRIPT = path.join(HERE, "..", "scripts", "check_input.py");

/** A throwaway folder with the fixtures every case needs. */
function makeFixtureRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "pdf-guard-"));
  writeFileSync(path.join(root, "a.pdf"), "a");
  writeFileSync(path.join(root, "b.PDF"), "b");
  writeFileSync(path.join(root, "note.txt"), "not a pdf");
  mkdirSync(path.join(root, "nested"));
  writeFileSync(path.join(root, "nested", "c.pdf"), "c");
  mkdirSync(path.join(root, "empty"));
  return root;
}

function relativePosix(root, candidate) {
  return path.relative(root, candidate).split(path.sep).join("/");
}

/** Run main() while capturing what it writes to stdout and stderr. */
function runMain(argv) {
  const out = [];
  const err = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => out.push(args.join(" "));
  console.error = (...args) => err.push(args.join(" "));
  try {
    const code = main(argv);
    return { code, stdout: out.join("\n"), stderr: err.join("\n") };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

function withRoot(body) {
  const root = makeFixtureRoot();
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("a single PDF file is returned as-is", () => {
  withRoot((root) => {
    const pdf = path.join(root, "a.pdf");
    assert.deepEqual(findPdfs(pdf), [pdf]);
  });
});

test("an uppercase .PDF suffix is accepted", () => {
  withRoot((root) => {
    const pdf = path.join(root, "b.PDF");
    assert.deepEqual(findPdfs(pdf), [pdf]);
  });
});

test("a folder returns every PDF, nested ones included, sorted", () => {
  withRoot((root) => {
    assert.deepEqual(findPdfs(root).map((pdf) => relativePosix(root, pdf)), [
      "a.pdf",
      "b.PDF",
      "nested/c.pdf",
    ]);
  });
});

test("a non-PDF file returns nothing", () => {
  withRoot((root) => {
    assert.deepEqual(findPdfs(path.join(root, "note.txt")), []);
  });
});

test("a missing path returns nothing", () => {
  withRoot((root) => {
    assert.deepEqual(findPdfs(path.join(root, "missing.pdf")), []);
  });
});

test("an empty folder returns nothing", () => {
  withRoot((root) => {
    assert.deepEqual(findPdfs(path.join(root, "empty")), []);
  });
});

test("main accepts a PDF", () => {
  withRoot((root) => {
    const result = runMain([path.join(root, "a.pdf")]);
    assert.equal(result.code, 0);
    assert.equal(result.stdout, "input ok: 1 PDF(s)");
    assert.equal(result.stderr, "");
  });
});

test("main rejects a text file", () => {
  withRoot((root) => {
    const result = runMain([path.join(root, "note.txt")]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /names no PDF; extraction not started\./);
    assert.equal(result.stdout, "");
  });
});

test("main rejects a missing path", () => {
  withRoot((root) => {
    const result = runMain([path.join(root, "nope.pdf")]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /names no PDF/);
  });
});

test("main reports usage without a path", () => {
  const result = runMain([]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /usage: check_input\.mjs/);
});

test("the guard runs from the command line", () => {
  withRoot((root) => {
    const result = spawnSync(process.execPath, [SCRIPT, path.join(root, "a.pdf")], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /input ok: 1 PDF\(s\)/);
  });
});

test("the guard reports a folder count on the command line", () => {
  withRoot((root) => {
    const result = spawnSync(process.execPath, [SCRIPT, root], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "input ok: 3 PDF(s)");
  });
});

test("the guard matches the Python guard when Python is available", (t) => {
  const python = ["python", "python3"].find(
    (candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).error === undefined,
  );
  if (!python) {
    t.skip("no Python interpreter on PATH");
    return;
  }

  withRoot((root) => {
    const cases = [
      { target: root, exit: 0 },
      { target: path.join(root, "a.pdf"), exit: 0 },
      { target: path.join(root, "note.txt"), exit: 1 },
      { target: path.join(root, "empty"), exit: 1 },
      { target: path.join(root, "missing.pdf"), exit: 1 },
    ];

    for (const { target, exit } of cases) {
      const nodeRun = spawnSync(process.execPath, [SCRIPT, target], { encoding: "utf8" });
      const pythonRun = spawnSync(python, [PYTHON_SCRIPT, target], { encoding: "utf8" });

      assert.equal(nodeRun.status, exit, `Node exit code for ${target}`);
      assert.equal(pythonRun.status, exit, `Python exit code for ${target}`);
      assert.equal(nodeRun.stdout.trim(), pythonRun.stdout.trim(), `stdout for ${target}`);
      if (exit === 1) {
        assert.match(nodeRun.stderr, /names no PDF/, `Node rejected ${target}`);
        assert.match(pythonRun.stderr, /names no PDF/, `Python rejected ${target}`);
      }
    }
  });
});
