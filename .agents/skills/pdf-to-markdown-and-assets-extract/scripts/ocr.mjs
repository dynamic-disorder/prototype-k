#!/usr/bin/env node
/**
 * Read rendered pages with an OCR engine.
 *
 * Usage (from the skill folder):
 *     node scripts/ocr.mjs <image dir> <output dir> [--lang eng]
 *
 * The engine is found in this order: `PDF_OCR_CMD`, then `tesseract` on `PATH`,
 * then `tesseract` in the folders a package manager installs it to — so a
 * `PATH` that predates the install no longer hides an engine that is on disk —
 * then the Windows built-in engine. Set `PDF_OCR_CMD` to override the lot, e.g.
 *     PDF_OCR_CMD="my-ocr {image} {out} --lang {lang}"
 * where `{image}` is the page PNG, `{out}` the output path without extension and
 * `{lang}` the language code. The engine must write `<out>.txt`.
 *
 * OCR exists to read what text extraction cannot — letters drawn as vector
 * glyphs in the source PDF. Its text is recorded beside the page image and is
 * never merged into the Markdown: recognition errors must not become document
 * text. A missing engine is a recorded skip, not a failure.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { invokedDirectly } from "../lib/invoked.mjs";

import { splitCommand } from "./rasterise.mjs";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_LANG = "eng";

export const CANDIDATES = [{ tool: "tesseract", template: "tesseract {image} {out} -l {lang}" }];

/**
 * Folders an installer or package manager leaves Tesseract in. They are probed
 * only after `PATH`, so an engine that is on disk is still found by a shell
 * that started before the install. `%VAR%` expands from the run's environment,
 * so a relocated Program Files or profile still resolves.
 */
export const INSTALL_DIRS = {
  win32: [
    "%ProgramFiles%\\Tesseract-OCR",
    "%ProgramFiles(x86)%\\Tesseract-OCR",
    "%LOCALAPPDATA%\\Programs\\Tesseract-OCR",
    "%LOCALAPPDATA%\\Tesseract-OCR",
    "%ProgramData%\\chocolatey\\bin",
    "%USERPROFILE%\\scoop\\shims",
    "%USERPROFILE%\\scoop\\apps\\tesseract\\current",
  ],
  darwin: ["/opt/homebrew/bin", "/usr/local/bin", "/opt/local/bin"],
  linux: ["/usr/bin", "/usr/local/bin", "/snap/bin", "/var/lib/flatpak/exports/bin"],
};

/** Case-insensitive environment lookup: Windows variable names are not case-sensitive. */
function environmentValue(env, name) {
  if (env[name] !== undefined) return env[name];
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(env)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

/** Expand `%NAME%` from `env`; return `null` when a variable is unset. */
export function expandFolder(folder, env = process.env) {
  let missing = false;
  const expanded = folder.replace(/%([^%]+)%/g, (_, name) => {
    const value = environmentValue(env, name);
    if (value === undefined || value === "") {
      missing = true;
      return "";
    }
    return value;
  });
  return missing ? null : expanded;
}

/**
 * Absolute paths where Tesseract may sit without being on `PATH`.
 * @returns {string[]}
 */
export function installCandidates({ platform = process.platform, env = process.env } = {}) {
  const windows = platform === "win32";
  const executable = windows ? "tesseract.exe" : "tesseract";
  // Join with the target platform's separator, not the host's: a Windows run
  // must still describe `/opt/homebrew/bin` correctly.
  const join = windows ? path.win32.join : path.posix.join;
  return (INSTALL_DIRS[platform] ?? [])
    .map((folder) => expandFolder(folder, env))
    .filter((folder) => folder !== null)
    .map((folder) => join(folder, executable));
}

/**
 * Pin the build from the `--version` banner:
 * `tesseract v5.4.0.20240606` becomes `v5.4.0.20240606`.
 * @returns {string | undefined}
 */
export function engineVersion(stdout) {
  const line = String(stdout ?? "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(Boolean);
  return line === undefined ? undefined : line.replace(/^tesseract\s+/i, "");
}

/**
 * The Windows built-in OCR engine (`Windows.Media.Ocr`), available without an
 * install. Its language is a BCP-47 tag, not a Tesseract code.
 */
export function windowsOcrEngine() {
  const executable = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  if (!existsSync(executable)) return null;

  return {
    tool: "windows-ocr",
    source: "builtin",
    template:
      `"${executable}" -NoProfile -ExecutionPolicy Bypass ` +
      `-File "${path.join(SCRIPTS_DIR, "ocr-win.ps1")}" ` +
      "-ImagePath {image} -OutPath {out}.txt -Language {lang}",
  };
}

/** Substitute placeholders in an OCR command template. */
export function ocrCommand(template, { image, out, lang = DEFAULT_LANG }) {
  const [command, ...args] = splitCommand(template).map((token) =>
    token.replaceAll("{image}", image).replaceAll("{out}", out).replaceAll("{lang}", lang),
  );
  return { command, args };
}

/**
 * Resolve a bare command to the file the OS would run, for the record only:
 * `where` on Windows, `which` elsewhere. Returns `null` when the locator cannot
 * tell, so the report says nothing rather than naming a path it did not prove.
 */
export function resolveCommand(command, { platform = process.platform, runner = spawnSync } = {}) {
  const locator = platform === "win32" ? "where" : "which";
  const found = runner(locator, [command], { encoding: "utf8" });
  if (found.error !== undefined || found.status !== 0) return null;

  const first = String(found.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return first ?? null;
}

/**
 * Pick the OCR engine: `PDF_OCR_CMD`, then `tesseract` on `PATH`, then
 * `tesseract` in a standard install folder, then Windows' own engine.
 * @returns {{ tool: string, template: string, source: string,
 *   executable?: string, version?: string } | null}
 */
export function findOcrEngine({
  env = process.env,
  candidates = CANDIDATES,
  platform = process.platform,
  installs,
  runner = spawnSync,
  exists = existsSync,
} = {}) {
  if (env.PDF_OCR_CMD) return { tool: "custom", template: env.PDF_OCR_CMD, source: "override" };

  for (const candidate of candidates) {
    const probe = runner(candidate.tool, ["--version"], { encoding: "utf8", env });
    if (probe.error === undefined) {
      const executable = resolveCommand(candidate.tool, { platform, runner });
      return {
        ...candidate,
        source: "path",
        ...(executable === null ? {} : { executable }),
        version: engineVersion(probe.stdout),
      };
    }
  }

  if (env.PDF_NO_OCR_INSTALL !== "1") {
    for (const executable of installs ?? installCandidates({ platform, env })) {
      if (!exists(executable)) continue;
      const probe = runner(executable, ["--version"], { encoding: "utf8", env });
      if (probe.error !== undefined || probe.status !== 0) continue;
      return {
        tool: "tesseract",
        template: `"${executable}" {image} {out} -l {lang}`,
        source: "install",
        executable,
        version: engineVersion(probe.stdout),
      };
    }
  }

  if (env.PDF_NO_WINDOWS_OCR === "1") return null;
  return windowsOcrEngine();
}

/** Name an engine for a log line: tool, build and executable when known. */
export function engineLabel(outcome) {
  const parts = [outcome.tool];
  if (outcome.version) parts.push(outcome.version);
  if (outcome.executable) parts.push(`at ${outcome.executable}`);
  return parts.join(" ");
}

/**
 * Read every page image into `<outDir>/page-<n>.txt`.
 * @returns {{ status: "extracted" | "skipped", tool?: string, source?: string,
 *   executable?: string, version?: string, lang: string,
 *   pages: { image: string, text: string, chars: number }[], reason?: string }}
 */
export function ocrImages({
  images = [],
  outDir,
  lang = DEFAULT_LANG,
  env = process.env,
  candidates,
  platform,
  installs,
  exists = existsSync,
  runner = spawnSync,
} = {}) {
  if (images.length === 0) {
    return { status: "skipped", lang, pages: [], reason: "no page images to read" };
  }

  // `candidates`, `platform` and `installs` stay undefined when the caller has
  // no opinion: `findOcrEngine` owns those defaults, so a narrowed candidate
  // list here cannot quietly drop the standard install folders.
  const engine = findOcrEngine({ env, candidates, platform, installs, exists });
  if (!engine) {
    return {
      status: "skipped",
      lang,
      pages: [],
      reason: "no OCR engine: tesseract is on neither PATH nor a standard install folder; set PDF_OCR_CMD to add one",
    };
  }

  mkdirSync(outDir, { recursive: true });
  const pages = images.map((image) => {
    const baseName = path.basename(image, path.extname(image));
    const base = path.join(path.resolve(outDir), baseName);
    const { command, args } = ocrCommand(engine.template, {
      image: path.resolve(image),
      out: base,
      lang,
    });

    const result = runner(command, args, { encoding: "utf8" });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`${engine.tool} exited ${result.status}: ${(result.stderr ?? "").trim()}`);
    }

    const textPath = `${base}.txt`;
    if (!existsSync(textPath)) {
      throw new Error(`${engine.tool} wrote no ${path.basename(textPath)}`);
    }

    const text = readFileSync(textPath, "utf8");
    return { image: path.basename(image), text: path.basename(textPath), chars: text.trim().length };
  });

  return {
    status: "extracted",
    tool: engine.tool,
    source: engine.source,
    ...(engine.executable === undefined ? {} : { executable: engine.executable }),
    ...(engine.version === undefined ? {} : { version: engine.version }),
    lang,
    pages,
  };
}

/** Natural order for page files: page-2 before page-10. */
export function pageImagesIn(directory, prefix) {
  if (!existsSync(directory)) return [];
  const number = (name) => Number(/(\d+)(?!.*\d)/.exec(name)?.[1] ?? 0);
  return readdirSync(directory)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .filter((name) => !prefix || name.toLowerCase().startsWith(`${prefix.toLowerCase()}-`))
    .sort((left, right) => number(left) - number(right))
    .map((name) => path.join(directory, name));
}

function main(argv) {
  if (argv.length < 2) {
    console.error("usage: ocr.mjs <image dir> <output dir> [--lang eng]");
    return 1;
  }

  const [imageDir, outDirArg, ...rest] = argv;
  const langFlag = rest.indexOf("--lang");
  const lang = langFlag >= 0 && rest[langFlag + 1] ? rest[langFlag + 1] : DEFAULT_LANG;
  const outDir = path.resolve(outDirArg);

  let outcome;
  try {
    outcome = ocrImages({ images: pageImagesIn(path.resolve(imageDir)), outDir, lang });
  } catch (error) {
    console.error(`ocr failed: ${error.message}`);
    return 1;
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "ocr.json"), `${JSON.stringify(outcome, null, 2)}\n`, "utf8");
  if (outcome.status === "skipped") {
    console.log(`ocr skipped: ${outcome.reason}`);
  } else {
    console.log(`ocr: ${outcome.pages.length} page(s) via ${engineLabel(outcome)} (${outcome.lang})`);
  }
  return 0;
}

const argv = process.argv.slice(2);
if (invokedDirectly(import.meta.url)) {
  process.exit(main(argv));
}
