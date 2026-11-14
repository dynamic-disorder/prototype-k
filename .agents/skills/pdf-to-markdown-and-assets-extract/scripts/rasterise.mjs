#!/usr/bin/env node
/**
 * Render PDF pages to PNG with an external rasteriser.
 *
 * Usage (from the skill folder):
 *     node scripts/rasterise.mjs <fixture> <output dir> [--dpi 150]
 *
 * The rasteriser is `pdftoppm`, `mutool` or `magick`, on `PATH` or in a
 * standard install folder — a `PATH` that predates the install no longer hides
 * a renderer that is on disk. Set `PDF_RASTER_CMD` to override it, e.g.
 *     PDF_RASTER_CMD="my-tool -r {dpi} {input} {prefix}"
 * where `{input}` is the PDF, `{prefix}` the output prefix and `{dpi}` the
 * resolution. The page files are globbed after the run, so a tool that
 * zero-pads or names pages differently still works.
 *
 * The path exists to recover what text extraction cannot: vector figures and
 * glyph-drawn ligatures. It never replaces the text output, and a missing tool
 * is recorded as a skip, not a failure.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { invokedDirectly } from "../lib/invoked.mjs";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_DPI = 150;

export const CANDIDATES = [
  { tool: "pdftoppm", template: "pdftoppm -png -r {dpi} {input} {prefix}", versionArgs: ["-v"] },
  { tool: "mutool", template: "mutool draw -o {prefix}-%d.png -r {dpi} {input}", versionArgs: ["-v"] },
  { tool: "magick", template: "magick -density {dpi} {input} {prefix}-%d.png", versionArgs: ["--version"] },
];

/**
 * Folders an installer or package manager leaves a renderer in. A `*` matches
 * a versioned folder (`ImageMagick-7.1.1`), and `%VAR%` expands from the run's
 * environment.
 */
export const INSTALL_RULES = {
  win32: [
    { folder: "%ProgramFiles%\\poppler*\\Library\\bin", tools: ["pdftoppm"] },
    { folder: "%ProgramFiles%\\poppler*\\bin", tools: ["pdftoppm"] },
    { folder: "%ProgramFiles%\\ImageMagick*", tools: ["magick"] },
    { folder: "%ProgramFiles%\\MuPDF*", tools: ["mutool"] },
    { folder: "%ProgramData%\\chocolatey\\bin", tools: ["pdftoppm", "mutool", "magick"] },
    { folder: "%USERPROFILE%\\scoop\\shims", tools: ["pdftoppm", "mutool", "magick"] },
    { folder: "%USERPROFILE%\\scoop\\apps\\poppler\\current\\bin", tools: ["pdftoppm"] },
    { folder: "%LOCALAPPDATA%\\Microsoft\\WinGet\\Links", tools: ["pdftoppm", "mutool", "magick"] },
  ],
  darwin: [
    { folder: "/opt/homebrew/bin", tools: ["pdftoppm", "mutool", "magick"] },
    { folder: "/usr/local/bin", tools: ["pdftoppm", "mutool", "magick"] },
    { folder: "/opt/local/bin", tools: ["pdftoppm", "mutool", "magick"] },
  ],
  linux: [
    { folder: "/usr/bin", tools: ["pdftoppm", "mutool", "magick"] },
    { folder: "/usr/local/bin", tools: ["pdftoppm", "mutool", "magick"] },
    { folder: "/snap/bin", tools: ["pdftoppm", "mutool", "magick"] },
    { folder: "/var/lib/flatpak/exports/bin", tools: ["pdftoppm", "mutool", "magick"] },
  ],
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
function expandVars(folder, env) {
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
 * Resolve one folder rule to the folders it names, expanding `%VAR%` and a `*`
 * in the last named folder. A rule whose variable is unset, or whose `*`
 * matches nothing, resolves to no folder.
 * @returns {string[]}
 */
export function expandFolders(folder, { env = process.env, platform = process.platform } = {}) {
  const flavour = platform === "win32" ? path.win32 : path.posix;
  const expanded = expandVars(folder, env);
  if (expanded === null) return [];

  const star = expanded.indexOf("*");
  if (star === -1) return [expanded];

  const head = expanded.slice(0, star);
  const tail = expanded.slice(star + 1);
  const parent = flavour.dirname(head);
  const prefix = flavour.basename(head).toLowerCase();

  let entries;
  try {
    entries = readdirSync(parent, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isDirectory() && entry.name.toLowerCase().startsWith(prefix))
    .map((entry) => `${flavour.join(parent, entry.name)}${tail}`);
}

/**
 * Absolute paths where a renderer may sit without being on `PATH`, in the
 * renderer preference order.
 * @returns {string[]}
 */
export function rasterInstalls({ platform = process.platform, env = process.env } = {}) {
  const flavour = platform === "win32" ? path.win32 : path.posix;
  const rules = INSTALL_RULES[platform] ?? [];
  const installed = [];

  for (const { tool } of CANDIDATES) {
    const executable = platform === "win32" ? `${tool}.exe` : tool;
    for (const rule of rules) {
      if (!rule.tools.includes(tool)) continue;
      for (const folder of expandFolders(rule.folder, { env, platform })) {
        installed.push(flavour.join(folder, executable));
      }
    }
  }

  return installed;
}

/** Read the tool banner: poppler prints its version to stderr, not stdout. */
export function toolVersion(probe) {
  const stdout = (probe.stdout ?? "").trim();
  const text = stdout === "" ? (probe.stderr ?? "") : stdout;
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

/** Name a renderer for a log line: tool, build and executable when known. */
export function toolLabel(outcome) {
  const parts = [outcome.tool];
  if (outcome.version) {
    parts.push(outcome.version.replace(new RegExp(`^${outcome.tool}\\s+`, "i"), ""));
  }
  if (outcome.executable) parts.push(`at ${outcome.executable}`);
  return parts.join(" ");
}

/**
 * The Windows built-in renderer: `Windows.Data.Pdf` through Windows PowerShell.
 * It needs no install, and is the fallback on a host with no poppler or
 * ImageMagick.
 */
export function windowsRasteriser() {
  const executable = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  if (!existsSync(executable)) return null;

  return {
    tool: "windows-pdf",
    source: "builtin",
    template:
      `"${executable}" -NoProfile -ExecutionPolicy Bypass ` +
      `-File "${path.join(SCRIPTS_DIR, "rasterise-win.ps1")}" ` +
      "-InputPath {input} -AssetsDir {assets} -Dpi {dpi} -Prefix page",
  };
}

/** Split a command string into tokens, honouring double quotes. */
export function splitCommand(command) {
  const tokens = [];
  for (const match of command.matchAll(/"([^"]*)"|(\S+)/g)) {
    tokens.push(match[1] ?? match[2]);
  }
  return tokens;
}

/**
 * Substitute placeholders in a command template.
 * `{assets}` is the directory holding `{prefix}`.
 * @returns {{ command: string, args: string[] }}
 */
export function rasterCommand(template, { input, prefix, dpi = DEFAULT_DPI }) {
  const assets = path.dirname(prefix);
  const [command, ...args] = splitCommand(template).map((token) =>
    token
      .replaceAll("{input}", input)
      .replaceAll("{prefix}", prefix)
      .replaceAll("{assets}", assets)
      .replaceAll("{dpi}", String(dpi)),
  );
  return { command, args };
}

/** Natural order for page files: page-2 before page-10. */
export function byPageNumber(left, right) {
  const number = (name) => Number(/(\d+)(?!.*\d)/.exec(name)?.[1] ?? 0);
  return number(left) - number(right);
}

/**
 * Pick the rasteriser: `PDF_RASTER_CMD` first, then the known tools on PATH,
 * then a standard install folder, then the Windows built-in renderer.
 * @returns {{ tool: string, template: string, source: string,
 *   executable?: string, version?: string } | null}
 */
export function findRasteriser({
  env = process.env,
  candidates = CANDIDATES,
  platform = process.platform,
  installs,
  runner = spawnSync,
  exists = existsSync,
} = {}) {
  if (env.PDF_RASTER_CMD) return { tool: "custom", template: env.PDF_RASTER_CMD, source: "override" };

  for (const candidate of candidates) {
    const { versionArgs, ...match } = candidate;
    const probe = runner(candidate.tool, versionArgs ?? ["--version"], { encoding: "utf8", env });
    if (probe.error === undefined) {
      return { ...match, source: "path", version: toolVersion(probe) };
    }
  }

  if (env.PDF_NO_RASTER_INSTALL !== "1") {
    for (const executable of installs ?? rasterInstalls({ platform, env })) {
      if (!exists(executable)) continue;
      const tool = path.basename(executable).replace(/\.exe$/i, "");
      const base = CANDIDATES.find((candidate) => candidate.tool === tool);
      if (base === undefined) continue;
      const probe = runner(executable, base.versionArgs ?? ["--version"], { encoding: "utf8", env });
      // Launching is enough to be the tool; the banner may still be a usage line.
      if (probe.error !== undefined) continue;
      return {
        tool,
        template: `"${executable}"${base.template.slice(base.tool.length)}`,
        source: "install",
        executable,
        version: toolVersion(probe),
      };
    }
  }

  if (env.PDF_NO_WINDOWS_RASTER === "1") return null;
  return windowsRasteriser();
}

/**
 * Render every page of a PDF to `<outDir>/*.png`.
 * @returns {{ status: "rendered" | "skipped", tool?: string, source?: string,
 *   executable?: string, version?: string, dpi: number, pages: string[],
 *   reason?: string }}
 */
export function rasterise({
  pdf,
  outDir,
  dpi = DEFAULT_DPI,
  env = process.env,
  candidates,
  platform,
  installs,
  exists = existsSync,
  runner = spawnSync,
} = {}) {
  // `candidates`, `platform` and `installs` stay undefined when the caller has
  // no opinion: `findRasteriser` owns those defaults.
  const rasteriser = findRasteriser({ env, candidates, platform, installs, exists });
  if (!rasteriser) {
    return {
      status: "skipped",
      dpi,
      pages: [],
      reason:
        "no rasteriser: pdftoppm, mutool and magick are on neither PATH nor a standard install folder; set PDF_RASTER_CMD to add one",
    };
  }

  mkdirSync(outDir, { recursive: true });
  const prefix = path.join(path.resolve(outDir), "page");
  const { command, args } = rasterCommand(rasteriser.template, {
    input: path.resolve(pdf),
    prefix,
    dpi,
  });

  const result = runner(command, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${rasteriser.tool} exited ${result.status}: ${(result.stderr ?? "").trim()}`);
  }

  const pages = readdirSync(outDir)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .sort(byPageNumber)
    .map((name) => path.join(outDir, name));

  return {
    status: "rendered",
    tool: rasteriser.tool,
    source: rasteriser.source,
    ...(rasteriser.executable === undefined ? {} : { executable: rasteriser.executable }),
    ...(rasteriser.version === undefined ? {} : { version: rasteriser.version }),
    dpi,
    pages,
  };
}

function main(argv) {
  if (argv.length < 2) {
    console.error("usage: rasterise.mjs <fixture> <output dir> [--dpi 150]");
    return 1;
  }

  const [fixture, outDirArg, ...rest] = argv;
  const dpiFlag = rest.indexOf("--dpi");
  const dpi = dpiFlag >= 0 && rest[dpiFlag + 1] ? Number(rest[dpiFlag + 1]) : DEFAULT_DPI;
  const outDir = path.resolve(outDirArg);

  let outcome;
  try {
    outcome = rasterise({
      pdf: path.resolve("tests", "resources", `${fixture}.pdf`),
      outDir,
      dpi,
    });
  } catch (error) {
    console.error(`raster failed: ${error.message}`);
    return 1;
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "raster.json"),
    `${JSON.stringify({ fixture, ...outcome }, null, 2)}\n`,
    "utf8",
  );

  if (outcome.status === "skipped") {
    console.log(`raster skipped: ${outcome.reason}`);
  } else {
    console.log(`raster: ${outcome.pages.length} page(s) at ${outcome.dpi} dpi via ${toolLabel(outcome)}`);
  }
  return 0;
}

const argv = process.argv.slice(2);
if (invokedDirectly(import.meta.url)) {
  process.exit(main(argv));
}
