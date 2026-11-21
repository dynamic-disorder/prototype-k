/**
 * The accessibility variant of an extracted document.
 *
 * The default extraction keeps its historical layout: one page marker, one
 * images block at the end, and names such as `figure-1.png`. This module reads
 * that output and writes a second document that is easier for a reader and for
 * an AI to follow:
 *
 * - each page opens with `---`, `<!-- page: N -->` and `## Page N`;
 * - a page render sits at the end of its own page;
 * - figures, tables and equations sit beside their caption;
 * - every image has a named, descriptive alt text;
 * - files are named `<page>-<kind>-<index>-<caption-slug>.<ext>`.
 *
 * The CLI writes this layout into `<name>.md` and the images into
 * `<name>.assets/`, beside the legacy page renders. A machine-readable
 * `assets.json` records every placement and the context for each image.
 */
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { cropFigure } from "./figures.mjs";

const PAGE_MARKER = /<!-- page: (\d+) -->/g;

/** Lowercase ASCII words, separated by single dashes, capped on a word edge. */
export function slugify(text, fallback = "image", max = 48) {
  const words = String(text ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  let out = "";
  for (const word of words) {
    const next = out === "" ? word : `${out}-${word}`;
    if (next.length > max) break;
    out = next;
  }
  return out || fallback;
}

/** Strip the printed label (`Figure 1.2:`) from a caption before naming. */
function captionSlug(label, caption, fallback) {
  const body = String(caption ?? "").replace(
    /^(?:fig(?:ure)?\.?|kuva|table|taulukko|equation|kaava)\s*[\d.()a-z-]*\s*[:\-–—]?\s*/i,
    "",
  );
  return slugify(body || label, fallback);
}

/** True when the file starts like a PNG or JPEG and is larger than a stub. */
export function isUsableImage(file) {
  if (!existsSync(file)) return false;
  try {
    if (statSync(file).size < 32) return false;
    const head = readFileSync(file).subarray(0, 4);
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return true;
    return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  } catch {
    return false;
  }
}

/** A caption line on the page, nearest the asset box. */
export function captionNear(pages, pageNumber, box, kind) {
  const page = pages.find((candidate) => candidate.number === pageNumber);
  if (!page) return { label: "", caption: "", line: -1 };

  const pattern =
    kind === "table"
      ? /^(?:table|taulukko)\s*[\d.]+/i
      : kind === "equation"
        ? /^(?:equation|kaava)\s*\(?[\d.]+/i
        : /^(?:fig(?:ure)?\.?|kuva)\s*[\d.]+/i;

  const lines = page.lines ?? [];
  const candidates = [];
  lines.forEach((line, index) => {
    const text = line.text.trim();
    if (!pattern.test(text)) return;
    const anchor = box ? box.y + (box.height ?? 0) / 2 : line.y;
    candidates.push({ index, text, distance: Math.abs(line.y - anchor) });
  });
  if (candidates.length === 0) return { label: "", caption: "", line: -1 };

  candidates.sort((left, right) => left.distance - right.distance);
  const first = candidates[0];
  const nextLine = lines[first.index + 1];
  const next = nextLine?.text.trim() ?? "";
  const gap = nextLine ? Math.abs((lines[first.index].y ?? 0) - (nextLine.y ?? 0)) : 0;
  const continues =
    next &&
    !/^(?:fig(?:ure)?\.?|table|equation)\s*[\d.]/i.test(next) &&
    next.length < 160 &&
    !/[.!?]$/.test(first.text) &&
    gap <= Math.max(12, (lines[first.index].size ?? 10) * 1.4);
  const caption = continues ? `${first.text} ${next}` : first.text;
  return {
    label: (pattern.exec(first.text)?.[0] ?? first.text).replace(/\s+/g, " ").trim(),
    caption,
    line: first.index,
  };
}

/**
 * A printed heading, judged by its font size and its own label.
 *
 * Body text is 12 pt in the thesis; chapter headings are 24.8 pt, sections
 * 17.2 pt and appendices 14.3 pt. A numbered line at body size stays a
 * paragraph, so list-like code and references are not promoted.
 *
 * @returns {number | null} Markdown heading level (2–4), or null
 */
export function headingLevel(line, page) {
  const text = line.trim();
  if (!text || text.length > 120) return null;
  const modelLine = (page?.lines ?? []).find((candidate) => candidate.text.trim() === text);
  if (!modelLine || (modelLine.size ?? 0) < 13.5) return null;

  const numbered = /^(\d+(?:\.\d+)*)\s+\S/.exec(text);
  if (numbered) return Math.min(4, 2 + numbered[1].split(".").length - 1);
  if (/^Liite\s+[A-ZÄÖÅ]\b/.test(text)) return 2;
  if (/^[A-ZÄÖÅ]\.\d+\s+\S/.test(text)) return 3;
  if (/^(?:Tiivistelmä|Abstract|Sisältö|Kirjallisuus|Lähdeluettelo)$/i.test(text)) return 2;
  return null;
}

/** Whether a fenced text block is source code, not a printed table. */
export function isCodeBlock(text) {
  const lines = text.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return false;
  const signals = lines.filter((line) =>
    /(?:\b(?:public|private|protected|class|void|boolean|return|if|else|try|catch|new|static|final|String|List)\b|@Test|@Before|@After|[{};])/.test(
      line,
    ),
  ).length;
  return signals >= Math.max(2, Math.ceil(lines.length * 0.3));
}

/** Remove the PDF's letter-by-letter spacing from a code line. */
function compactCode(text) {
  return text
    .replace(/\b(?:[A-Za-z]\s+){2,}[A-Za-z]\b/g, (run) => run.replace(/\s+/g, ""))
    .replace(/\b([A-Za-z])\s+(\d+)\b/g, "$1$2")
    .replace(/\bi f\b/g, "if")
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s+\(/g, "(")
    .replace(/\s+([,;)])/g, "$1")
    .replace(/([,(])\s+/g, "$1 ");
}

/** A code fence with printed line numbers removed. */
export function codeFence(text) {
  const language = /\b(?:public|private|void|class|boolean|return|if|try|catch|@Test)\b/.test(text)
    ? "java"
    : "text";
  const lines = text
    .split("\n")
    .map((line) => compactCode(line.replace(/^\s*\d+\.\s{0,4}/, "")))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
  return ["```" + language, lines, "```"].join("\n");
}

/** Replace a code-shaped ```text block, leaving real tables alone. */
export function transformCodeBlocks(body) {
  return body.replace(/```text\n([\s\S]*?)```/g, (whole, content) =>
    isCodeBlock(content) ? codeFence(content) : whole,
  );
}

/** A line that is unambiguously source code, not prose. */
function looksLikeCodeLine(line) {
  const text = line.trim();
  if (!text) return false;
  if (/^(?:public|private|protected|class|interface|@Test|@Before|@After|@Override|void|return|if|else|for|while|try|catch|new|import|package)\b/.test(text)) {
    return true;
  }
  if (/^(?:\/\/|\/\*|\*|\.\.\.)/.test(text)) return true;
  if (/^[A-Za-z_][\w<>[\]]*\s+\w+\s*\([^)]*\)\s*\{?$/.test(text)) return true;
  return /[{};]$/.test(text);
}

/** Fence code lines that the PDF left outside an existing code block. */
export function fenceLooseCode(body) {
  const lines = body.split("\n");
  const out = [];
  let inside = false;
  let group = [];

  const flush = () => {
    while (group.length > 0 && !group.at(-1).trim()) group.pop();
    if (group.length >= 2 && isCodeBlock(group.join("\n"))) {
      out.push(codeFence(group.join("\n")));
    } else {
      out.push(...group);
    }
    group = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith("```")) {
      flush();
      out.push(line);
      inside = !inside;
      continue;
    }
    if (inside) {
      out.push(line);
      continue;
    }
    if (looksLikeCodeLine(line)) {
      group.push(line);
      continue;
    }
    if (line.trim() === "" && group.length > 0 && looksLikeCodeLine(lines[index + 1] ?? "")) {
      group.push(line);
      continue;
    }
    flush();
    out.push(line);
  }
  flush();

  // A loose class header immediately before a fence belongs in the same fence.
  return out.join("\n").replace(/```\n+```java\n/g, "\n");
}

/**
 * Absorb a code example's trailing `. . .` / `}` lines that the PDF page
 * break left outside the fence.
 */
export function absorbCodeTail(body) {
  return body.replace(
    /(```(?:java|text)\n[\s\S]*?)\n```\n+((?:(?:\. \. \.|[{};])\s*\n)+)/g,
    (_, open, tail) => `${open}\n${tail.trim()}\n` + "```\n\n",
  );
}

/** Replace a page's plain heading lines with Markdown headings. */
export function decorateHeadings(body, page) {
  return body
    .split("\n")
    .map((line) => {
      const level = headingLevel(line, page);
      return level === null ? line : `${"#".repeat(level)} ${line.trim()}`;
    })
    .join("\n");
}

/** Shorten at a word edge, with an ellipsis when something was cut. */
function shorten(text, max) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const edge = cut.lastIndexOf(" ");
  return `${(edge > max * 0.5 ? cut.slice(0, edge) : cut).trim()}…`;
}

/** The first meaningful line of a page, used in a page render's alt text. */
export function pageTitle(page) {
  for (const line of page?.lines ?? []) {
    const text = line.text.trim();
    if (text.length < 4 || /^\d+$/.test(text)) continue;
    if (/^design patterns: elements/i.test(text)) continue;
    if (/^(?:fig(?:ure)?\.?|kuva|table|taulukko|equation|kaava)\s*\(?[\d.]/i.test(text)) continue;
    // A contents line ends in a dot leader and a page number; it names the
    // section it points at, not the page it is printed on.
    if (/\.{4,}/.test(text) || /…{2,}/.test(text)) continue;
    if (/^\d{1,3}$/.test(text)) continue;
    return shorten(text, 60);
  }
  return "";
}

/** Markdown alt text: one line, no brackets that would close the alt span. */
function altText(text) {
  return shorten(String(text).replace(/\[/g, "(").replace(/\]/g, ")"), 220);
}

/** Link a source file into the accessibility assets folder, preferring a hard link. */
function linkOrCopy(source, target) {
  try {
    linkSync(source, target);
  } catch {
    copyFileSync(source, target);
  }
}

/** Read a JSON sidecar, returning null when it is absent or broken. */
function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** Split the default Markdown into page sections, dropping the legacy blocks. */
export function splitLegacyMarkdown(markdown) {
  const withoutImages = markdown
    .replace(/\n*<!-- page images -->[\s\S]*$/, "")
    .replace(/^!\[[^\]]*\]\([^)]*image-1\.jpg\)\s*$/m, "");
  const pages = [];
  let current = null;
  for (const line of withoutImages.split("\n")) {
    const match = PAGE_MARKER.exec(line);
    PAGE_MARKER.lastIndex = 0;
    if (match) {
      if (current) pages.push(current);
      current = { page: Number(match[1]), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) pages.push(current);
  return pages.map((page) => ({
    page: page.page,
    body: page.lines.join("\n").replace(/^\n+|\n+$/g, ""),
  }));
}

/** Destination file name for one record. */
function destinationName(record) {
  const page = String(record.page).padStart(3, "0");
  if (record.kind === "page") return `page-${page}-full-page.png`;
  const index = record.index ? `-${record.index}` : "";
  const fallback = `${record.kind}${index}`;
  const description = record.caption ? captionSlug(record.label, record.caption, fallback) : fallback;
  return `page-${page}-${fallback}${description === fallback ? "" : `-${description}`}.${record.ext}`;
}

/** Insert an image after the caption line, or at the end of the page. */
function placeFigure(body, record, href) {
  const lines = body.split("\n");
  const needle = record.caption || record.label;
  let index = -1;
  if (needle) {
    const short = needle.slice(0, 60);
    index = lines.findIndex((line) => line.includes(short));
  }
  const image = `![${altText(record.alt)}](${href})`;
  // A printed `Kuva 3.1` caption sits below its image; put the image first.
  if (index >= 0) lines.splice(index, 0, "", image, "");
  else lines.push("", image);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Build the accessibility document from an extracted folder.
 *
 * @param {{ outDir: string, name: string, pages?: object[], targetMd?: string,
 *   targetAssets?: string }} options
 * @returns {{ md: string, assetsDir: string, manifest: string, warnings: string[],
 *   omittedTableCandidates: number }}
 */
export function writeAccessibilityAssets({
  outDir,
  name,
  pages = [],
  targetMd: requestedMd,
  targetAssets: requestedAssets,
}) {
  const sourceMd = path.join(outDir, `${name}.md`);
  if (!existsSync(sourceMd)) {
    throw new Error(`no Markdown to build the accessibility variant: ${sourceMd}`);
  }

  const sourceAssets = path.join(outDir, `${name}.assets`);
  const targetAssets = requestedAssets ?? sourceAssets;
  const targetMd = requestedMd ?? path.join(outDir, `${name}-accessibility.md`);
  if (path.resolve(targetAssets) !== path.resolve(sourceAssets)) {
    rmSync(targetAssets, { recursive: true, force: true });
  }
  mkdirSync(targetAssets, { recursive: true });

  const warnings = [];
  const records = [];
  const used = new Set();

  // Page renders.
  const raster = readJson(path.join(sourceAssets, "raster.json"));
  const rasterPages = Array.isArray(raster?.pages) ? raster.pages : [];
  const pageFiles = new Map();
  for (const file of rasterPages) {
    const number = Number(/(\d+)/.exec(path.basename(file))?.[1] ?? 0);
    if (number > 0) pageFiles.set(number, path.join(sourceAssets, path.basename(file)));
  }
  if (pageFiles.size === 0 && existsSync(sourceAssets)) {
    for (const page of readdirSync(sourceAssets)) {
      const match = /^page-(\d+)\.png$/i.exec(page);
      if (match) pageFiles.set(Number(match[1]), path.join(sourceAssets, page));
    }
  }
  const pageRecords = [];
  for (const [page, file] of [...pageFiles].sort((left, right) => left[0] - right[0])) {
    if (!isUsableImage(file)) {
      warnings.push(`page ${page}: render is missing or not a usable PNG`);
      continue;
    }
    pageRecords.push({
      kind: "page",
      page,
      file,
      ext: "png",
      alt: `Page ${page}${pageTitle(pages.find((entry) => entry.number === page)) ? `: ${pageTitle(pages.find((entry) => entry.number === page))}` : ""} — full page render`,
    });
  }

  // Figures, tables and equations, in the order the extractor wrote them.
  for (const [kind, manifest] of [
    ["figure", "figures.json"],
    ["table", "tables.json"],
    ["equation", "equations.json"],
  ]) {
    const data = readJson(path.join(sourceAssets, manifest));
    const entries = data?.[`${kind}s`] ?? [];
    entries.forEach((entry, position) => {
      const file = path.join(sourceAssets, path.basename(entry.file ?? ""));
      if (!isUsableImage(file)) {
        warnings.push(`${kind} ${position + 1} on page ${entry.page}: crop is missing or unusable`);
        return;
      }
      const found = captionNear(pages, entry.page, entry.box ?? entry, kind);
      const isEquation = kind === "equation";
      const fallbackLabel = `${kind[0].toUpperCase()}${kind.slice(1)} ${position + 1}`;
      const label = isEquation
        ? `Equation ${entry.tag ?? position + 1}`
        : found.label ||
          (kind === "table" ? `Table candidate ${position + 1}` : fallbackLabel);
      const caption = isEquation ? "" : found.caption || "";
      const section = pageTitle(pages.find((candidate) => candidate.number === entry.page));
      const alt = isEquation
        ? `${label}: display formula on page ${entry.page}`
        : caption
          ? caption.toLowerCase().startsWith(label.toLowerCase())
            ? caption
            : `${label}: ${caption}`
          : `${label} on page ${entry.page} (no caption detected${section ? `; section: ${section}` : ""})`;
      records.push({
        kind,
        page: entry.page,
        index: position + 1,
        file,
        ext: "png",
        label,
        caption,
        alt,
      });
    });
  }

  // The single embedded image: valid only on a one-page document, where its
  // page is unambiguous. A multi-page document omits it rather than inventing a
  // page number.
  const embedded = path.join(sourceAssets, "image-1.jpg");
  if (existsSync(embedded)) {
    if (!isUsableImage(embedded)) {
      warnings.push("embedded image-1.jpg is not a usable image; it was omitted");
    } else if (pages.length === 1) {
      records.push({
        kind: "image",
        page: 1,
        index: 1,
        file: embedded,
        ext: "jpg",
        label: "Embedded image",
        caption: "Embedded image",
        alt: "Embedded image on page 1",
      });
    } else {
      warnings.push("embedded image-1.jpg has no page mapping in a multi-page document; it was omitted");
    }
  }

  // A printed `Kuva`/`Figure` caption with a large blank band above it is a
  // figure whose vector art has no Form `/BBox`. Crop that band from the page
  // render so the image sits above its caption instead of disappearing.
  const figurePages = new Set(records.filter((record) => record.kind === "figure").map((record) => record.page));
  let autoCropped = 0;
  for (const page of pages) {
    if (figurePages.has(page.number)) continue;
    const caption = captionNear(pages, page.number, null, "figure");
    if (!caption.label) continue;
    const captionIndex = page.lines.findIndex((line) => line.text.trim().startsWith(caption.label));
    const previous = captionIndex > 0 ? page.lines[captionIndex - 1] : null;
    const gap = previous ? previous.y - page.lines[captionIndex].y : 0;
    const pageImage = pageFiles.get(page.number);
    if (!previous || gap < 80 || !pageImage) continue;

    const target = path.join(sourceAssets, `figure-auto-${page.number}.png`);
    const box = {
      page: page.number,
      x: 60,
      y: page.lines[captionIndex].y + 12,
      width: 492,
      height: gap - 24,
      pageWidth: 612,
      pageHeight: 792,
    };
    try {
      cropFigure(pageImage, box, target);
      records.push({
        kind: "figure",
        page: page.number,
        index: 1,
        file: target,
        ext: "png",
        label: caption.label,
        caption: caption.caption,
        alt: caption.caption,
      });
      autoCropped += 1;
    } catch (error) {
      warnings.push(`figure ${caption.label} on page ${page.number} could not be cropped: ${error.message}`);
    }
  }
  if (autoCropped > 0) {
    warnings.push(
      `${autoCropped} figure(s) were cropped from the gap above their caption (no Form box)`,
    );
  }

  // An uncaptioned table candidate that is really a code listing has no
  // business being an image: it stays a fenced code block below.
  let omittedTableCandidates = 0;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record.kind === "table" && /^Table candidate\b/.test(record.label)) {
      records.splice(index, 1);
      omittedTableCandidates += 1;
    }
  }
  if (omittedTableCandidates > 0) {
    warnings.push(
      `${omittedTableCandidates} uncaptioned table candidate(s) were code listings; emitted as code blocks, not images`,
    );
  }

  // A page render is the fallback for a page whose text layer is empty — a
  // scanned page. A page with text keeps its text; a page with a figure uses
  // the figure crop. Never replace readable text with a picture of the page.
  const pageModel = new Map(pages.map((page) => [page.number, page]));
  const keptPages = pageRecords.filter((record) => {
    const page = pageModel.get(record.page);
    return (page?.text?.trim() ?? "") === "";
  });
  records.unshift(...keptPages);

  for (const record of records) {
    let base = destinationName(record);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      const extension = path.extname(base);
      candidate = `${base.slice(0, -extension.length)}-${suffix}${extension}`;
      suffix += 1;
    }
    used.add(candidate);
    record.name = candidate;
    record.href = `${path.basename(targetAssets)}/${candidate}`;
  }

  const byPage = new Map();
  for (const record of records) {
    if (!byPage.has(record.page)) byPage.set(record.page, []);
    byPage.get(record.page).push(record);
  }

  const legacy = splitLegacyMarkdown(readFileSync(sourceMd, "utf8"));
  const known = new Map(legacy.map((page) => [page.page, page.body]));
  const pageNumbers = [...new Set([...known.keys(), ...byPage.keys()])].sort((left, right) => left - right);
  const sections = [];

  pageNumbers.forEach((pageNumber) => {
    const items = byPage.get(pageNumber) ?? [];
    const page = pageModel.get(pageNumber);
    let body = fenceLooseCode(known.get(pageNumber) ?? "");
    body = transformCodeBlocks(body);
    body = body.replace(/^!\[Table candidate[^\]]*\]\([^)]*table-\d+\.png\)\s*$/gm, "");
    // A removed table candidate has no remaining record to replace; drop its
    // old legacy reference so a code block does not leave a stale image link.
    if (!items.some((item) => item.kind === "table")) {
      body = body.replace(/^!\[Table \d+\]\([^)]*table-\d+\.png\)\s*$/gm, "");
    }
    // The image line can sit between the closing fence and `. . .`; remove it
    // before absorbing the tail.
    body = absorbCodeTail(body);
    // `fenceLooseCode` can wrap a header while the following block is still
    // `text`; after `transformCodeBlocks` both are Java, so join them.
    body = body.replace(/```\n+```java\n/g, "\n");
    body = decorateHeadings(body, page);

    // A table or equation already has an image line from the default writer.
    for (const record of items.filter((entry) => entry.kind === "table" || entry.kind === "equation")) {
      const kind = record.kind;
      // Match the record's own legacy file, not any `${kind}-N.png`: the first
      // replacement inserts a path that still contains its own number, and a
      // loose pattern would let the next record overwrite it.
      const pattern = new RegExp(
        `!\\[${kind[0].toUpperCase()}${kind.slice(1)} [^\\]]+\\]\\([^)]*${kind}-${record.index}\\.png\\)`,
      );
      body = body.replace(pattern, `![${altText(record.alt)}](${record.href})`);
    }

    // Figures have no reference in the default output; place them beside the
    // caption, or at the end of the page when there is none.
    for (const record of items.filter((entry) => entry.kind === "figure" || entry.kind === "image")) {
      body = placeFigure(body, record, record.href);
    }

    const pageRecord = items.find((entry) => entry.kind === "page");
    const pageImage = pageRecord ? `![${altText(pageRecord.alt)}](${pageRecord.href})` : "";
    // The Markdown page number stays in the comment for a machine reader; the
    // only visible number on the page is the document's own printed number.
    const header = `---------\n\n<!-- page: ${pageNumber} -->`;
    sections.push([header, body, pageImage].filter(Boolean).join("\n\n"));
  });

  const markdown = `${sections.join("\n\n")}\n`;
  writeFileSync(targetMd, markdown, "utf8");

  for (const record of records) {
    linkOrCopy(record.file, path.join(targetAssets, record.name));
  }

  const manifest = path.join(targetAssets, "assets.json");
  writeFileSync(
    manifest,
    `${JSON.stringify(
      {
        name,
        source: path.basename(sourceMd),
        pages: pageNumbers.length,
        records: records.map((record) => ({
          page: record.page,
          kind: record.kind,
          label: record.label,
          caption: record.caption,
          file: record.name,
          alt: record.alt,
        })),
        warnings,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return { md: targetMd, assetsDir: targetAssets, manifest, warnings, omittedTableCandidates };
}
