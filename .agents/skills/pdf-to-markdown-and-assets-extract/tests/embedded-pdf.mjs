/**
 * Fixture-only extractor for the bundled test PDFs.
 *
 * The skill delegates real extraction to the project's extractor, so this module
 * proves the output contract instead: pages are read from the PDF's page tree,
 * each page's text is laid out line by line from its text matrices, vertical
 * text is kept out of the body flow, and the embedded JPEG becomes an asset.
 *
 * Pages are read from the PDF itself — nested `/Pages` nodes and compressed
 * object streams included — so a multi-page fixture needs no code change.
 * Tables are not reconstructed into Markdown tables: their rows survive as text
 * lines, which is the limit of a fixture-grade extractor.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync }

 from "node:fs";

import path from "node:path";

import { inflateSync }

 from "node:zlib";

import { fileURLToPath }

 from "node:url";

import {
  buildEquation,
  isEquationNumber,
  latexSequence,
  MATH_FAMILIES,
  mathSlot,
  TEX_FAMILIES,}

 from "./math.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const RESOURCE_DIR = path.join(HERE, "resources");

export const PDF_PATH = path.join(RESOURCE_DIR, "embedded-images-tables.pdf");

export const FIXTURE_NAME = path.basename(PDF_PATH, path.extname(PDF_PATH));

/** Absolute path to a fixture PDF in tests/resources.
 */
export function resourcePath(name) {
  return path.join(RESOURCE_DIR, `${name}.pdf`);
}/** Count `/Type /Page` objects, excluding the `/Pages` tree node.
 */
export function pageCount(data) {
  return (data.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length;
}/** Map object number to `{ dict, stream }`; binary stream bytes are skipped.
 */
export function readObjects(text) {
  const objects = new Map();
  const header = /(\d+)\s+0\s+obj\b/g;
  let match;
  while ((match = header.exec(text)) !== null) {
    const number = Number(match[1]);
    const after = match.index + match[0].length;
    const streamAt = text.indexOf("stream", after);
    const endobjAt = text.indexOf("endobj", after);
    if (streamAt < 0 || (endobjAt >= 0 && endobjAt < streamAt)) {
      objects.set(number, {
        dict: text.slice(after, endobjAt < 0 ? text.length : endobjAt),
        stream: null,
      });
      continue;
    }
    const dict = text.slice(after, streamAt);
    let start = streamAt + "stream".length;
    if (text.slice(start, start + 2) === "\r\n") start += 2;
    else if (text[start] === "\n" || text[start] === "\r") start += 1;
    const lengthMatch = /\/Length\s+(\d+)/.exec(dict);
    const end = lengthMatch ? start + Number(lengthMatch[1]) : text.indexOf("endstream", start);
    objects.set(number, { dict, stream: text.slice(start, end) });
    header.lastIndex = Math.max(header.lastIndex, end);
  }
  return objects;
}/**
 * Inflate `/Type /ObjStm` containers and register the objects they hold.
 *
 * PDF 1.5+ may store dictionaries — including the page tree — inside compressed
 * object streams. Without this step a page tree that is not written top-level
 * looks empty.
 */
export function expandObjectStreams(objects) {
  for (const [, object] of [...objects.entries()]) {
    if (!/\/Type\s*\/ObjStm\b/.test(object.dict) || object.stream === null) continue;
    const countMatch = /\/N\s+(\d+)/.exec(object.dict);
    const firstMatch = /\/First\s+(\d+)/.exec(object.dict);
    if (!countMatch || !firstMatch) continue;
    let raw = Buffer.from(object.stream, "latin1");
    if (object.dict.includes("/FlateDecode")) {
      try {
        raw = inflateSync(raw);
      } catch {
        continue;
      }
    }
    const body = raw.toString("latin1");
    const first = Number(firstMatch[1]);
    const pairs = [...body.slice(0, first).matchAll(/(\d+)\s+(\d+)/g)].map((pair) => ({
      number: Number(pair[1]),
      offset: Number(pair[2]),
    }));
    const count = Math.min(Number(countMatch[1]), pairs.length);
    for (let index = 0; index < count; index += 1) {
      const start = first + pairs[index].offset;
      const end = index + 1 < count ? first + pairs[index + 1].offset : body.length;
      if (!objects.has(pairs[index].number)) {
        objects.set(pairs[index].number, { dict: body.slice(start, end), stream: null });
      }
    }
  }}

/**
 * Page object numbers in document order.
 *
 * Walk the page tree from the catalog's `/Pages` root and recurse into nested
 * `/Pages` nodes. Fall back to file order when the tree cannot be resolved.
 */
function pageOrder(objects) {
  const catalog = [...objects.values()].find((object) =>
    /\/Type\s*\/Catalog\b/.test(object.dict),
  );
  const root = catalog ? /\/Pages\s+(\d+)\s+0\s+R/.exec(catalog.dict) : null;
  const pages = [];
  const seen = new Set();
  const visit = (number) => {
    if (seen.has(number)) return;
    seen.add(number);
    const node = objects.get(number);
    if (!node) return;
    if (/\/Type\s*\/Pages\b/.test(node.dict)) {
      const kids = /\/Kids\s*\[([^\]]*)\]/.exec(node.dict);
      if (!kids) return;
      for (const kid of kids[1].matchAll(/(\d+)\s+0\s+R/g)) visit(Number(kid[1]));
      return;
    }
    if (/\/Type\s*\/Page\b/.test(node.dict)) pages.push(number);
  };
  if (root) visit(Number(root[1]));
  if (pages.length) return pages;
  return [...objects.entries()]
    .filter(([, object]) => /\/Type\s*\/Page\b/.test(object.dict))
    .map(([number]) => number);}

/** Object numbers of a page's content streams, in order.
 */
function contentRefs(dict) {
  const contents = /\/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)/.exec(dict);
  if (!contents) return [];
  return [...contents[1].matchAll(/(\d+)\s+0\s+R/g)].map((entry) => Number(entry[1]));}

/** Resource name → decoder for every font a page declares.
 */
function pageFonts(objects, pageDict) {
  const decoders = new Map();
  const resources = resolveDict(objects, pageDict, "Resources");
  const fontDict = resources ? resolveDict(objects, resources.dict, "Font") : null;
  if (!fontDict) return decoders;
  for (const match of fontDict.dict.matchAll(/\/([^\s/\[\]()<>{}%]+)\s+(\d+)\s+0\s+R/g)) {
    const font = objects.get(Number(match[2]));
    if (font) decoders.set(match[1], fontDecoder(objects, font.dict));
  }
  return decoders;}

/** Glyph names used by the encodings in these fixtures, mapped to Unicode.
 */
const GLYPH_UNICODE = {
  fi: "fi",
  fl: "fl",
  ff: "ff",
  ffi: "ffi",
  ffl: "ffl",
  quoteright: "\u2019",
  quoteleft: "\u2018",
  quotedblleft: "\u201c",
  quotedblright: "\u201d",
  endash: "\u2013",
  emdash: "\u2014",
  bullet: "\u2022",
  degree: "\u00b0",
  greaterequal: "\u2265",
  lessequal: "\u2264",
  plusminus: "\u00b1",
  multiply: "\u00d7",
  divide: "\u00f7",
  element: "\u2208",
  notelement: "\u2209",
  subset: "\u2282",
  superset: "\u2283",
  union: "\u222a",
  intersection: "\u2229",
  infinity: "\u221e",
  summation: "\u2211",
  product: "\u220f",
  radical: "\u221a",
  minus: "\u2212",
  periodcentered: "\u00b7",
  similar: "\u223c",
  approxequal: "\u2248",
  notequal: "\u2260",
  equivalence: "\u2261",
  congruent: "\u2245",
  perpendicular: "\u22a5",
  asteriskmath: "\u2217",
  dotmath: "\u22c5",
  arrowright: "\u2192",
  arrowleft: "\u2190",
  alpha: "\u03b1",
  beta: "\u03b2",
  gamma: "\u03b3",
  delta: "\u03b4",
  epsilon: "\u03b5",
  zeta: "\u03b6",
  eta: "\u03b7",
  theta: "\u03b8",
  iota: "\u03b9",
  kappa: "\u03ba",
  lambda: "\u03bb",
  mu: "\u03bc",
  nu: "\u03bd",
  xi: "\u03be",
  pi: "\u03c0",
  rho: "\u03c1",
  sigma: "\u03c3",
  tau: "\u03c4",
  upsilon: "\u03c5",
  phi: "\u03c6",
  chi: "\u03c7",
  psi: "\u03c8",
  omega: "\u03c9",}

;/** TeX text fonts: 0x00–0x0A Greek capitals, 0x0B–0x0F ligatures.
 */
const CM_TEXT_CAPITALS = {
  0x00: "\u0393",
  0x01: "\u0394",
  0x02: "\u0398",
  0x03: "\u039b",
  0x04: "\u039e",
  0x05: "\u03a0",
  0x06: "\u03a3",
  0x07: "\u03a5",
  0x08: "\u03a6",
  0x09: "\u03a8",
  0x0a: "\u03a9",}

;const CM_TEXT_LIGATURES = { 0x0b: "ff", 0x0c: "fi", 0x0d: "fl", 0x0e: "ffi", 0x0f: "ffl" }

;/** Digit and punctuation names that appear in `/Differences` arrays.
 */
const GLYPH_NAMES = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  space: " ",
  exclam: "!",
  quotesingle: "'",
  quotedbl: '"',
  numbersign: "#",
  dollar: "$",
  percent: "%",
  ampersand: "&",
  parenleft: "(",
  parenright: ")",
  asterisk: "*",
  plus: "+",
  comma: ",",
  hyphen: "-",
  period: ".",
  slash: "/",
  colon: ":",
  semicolon: ";",
  less: "<",
  equal: "=",
  greater: ">",
  question: "?",
  at: "@",
  bracketleft: "[",
  backslash: "\\",
  bracketright: "]",
  underscore: "_",
  braceleft: "{",
  bar: "|",
  braceright: "}",
  asciitilde: "~",
  asciicircum: "^",
  grave: "`",
  acute: "\u00b4",
  dieresis: "\u00a8",
  ring: "\u02da",
  breve: "\u02d8",
  caron: "\u02c7",
  cedilla: "\u00b8",
  circumflex: "\u02c6",
  dotaccent: "\u02d9",
  ogonek: "\u02db",
  tilde: "\u02dc",}

;/** Unicode for a glyph name, or an empty string when it is unknown.
 */
function glyphToUnicode(name) {
  if (GLYPH_UNICODE[name] !== undefined) return GLYPH_UNICODE[name];
  if (GLYPH_NAMES[name] !== undefined) return GLYPH_NAMES[name];
  if (name.length === 1) return name;
  if (/^uni[0-9A-F]{4}$/i.test(name)) return String.fromCharCode(Number.parseInt(name.slice(3), 16));
  return "";}

/** Resolve a dictionary value that may be inline or an indirect reference.
 */
function resolveDict(objects, dict, key) {
  const ref = new RegExp(`/${key}\\s+(\\d+)\\s+0\\s+R`).exec(dict);
  if (ref) return objects.get(Number(ref[1]));
  const inline = new RegExp(`/${key}\\s*(<<[\\s\\S]*?>>)`).exec(dict);
  return inline ? { dict: inline[1] } : null;}

/** TeX family of a base font name: the font decides how its bytes decode.
 */
export function fontFamily(base) {
  if (/CMSY/.test(base)) return "cmsy";
  if (/CMMI/.test(base)) return "cmmi";
  if (/CMEX/.test(base)) return "cmex";
  if (/MSAM/.test(base)) return "msam";
  if (/MSBM/.test(base)) return "msbm";
  if (/CMBX/.test(base)) return "cmbold";
  if (/CMR|CMTI|CMSS|CMCSC/.test(base)) return "cmtext";
  return "other";}

/**
 * Build a font's decoder: family, `/Differences` glyph names and advance widths.
 *
 * The widths are what a run actually occupies on the page: without them the
 * gap between two runs can only be guessed from the character count, which is
 * how `encoder E_P(·)` lost its space and read as `encoderE P (·)`.
 */
function fontDecoder(objects, dict) {
  const base = (/\/BaseFont\s*\/([^\s/>]+)/.exec(dict)?.[1] ?? "").replace(/^[A-Z]{6}\+/, "");
  const family = fontFamily(base);
  const differences = new Map();
  const encodingRef = /\/Encoding\s+(\d+)\s+0\s+R/.exec(dict);
  const encoding = encodingRef ? objects.get(Number(encodingRef[1])) : null;
  const table = encoding ? /\/Differences\s*\[([^\]]*)\]/.exec(encoding.dict) : null;
  if (table) {
    let code = 0;
    for (const token of table[1].matchAll(/\/([^\s/]+)|\d+/g)) {
      if (token[0].startsWith("/")) {
        differences.set(code, token[0].slice(1));
        code += 1;
      } else {
        code = Number(token[0]);
      }
    }
  }
  const firstChar = Number(/\/FirstChar\s+(\d+)/.exec(dict)?.[1] ?? 0);
 const widthRef = /\/Widths\s+(\d+)\s+0\s+R/.exec(dict);
  const widthSource = widthRef
    ? objects.get(Number(widthRef[1]))?.dict
    : /\/Widths\s*\[[^\]]*\]/.exec(dict)?.[0];
  const widthTable = widthSource ? /\[([^\]]*)\]/.exec(widthSource) : null;
  const widths = widthTable
    ? widthTable[1]
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(Number)
    : [];
  return { base, family, differences, firstChar, widths };}

/** Advance width of one character, in points, from the font's `/Widths`.
 */
function charWidth(font, character, size) {
  if (!font?.widths.length) return size * 0.5;
  const index = character.codePointAt(0) - font.firstChar;
  return ((font.widths[index] ?? font.widths[0] ?? 500) / 1000) * size;}

/** Advance width of one decoded string, in points, from the font's `/Widths`.
 */
function textWidth(text, font, size) {
  if (!font?.widths.length) return text.length * size * 0.5;
  let total = 0;
  for (const character of text) total += charWidth(font, character, size);
  return total;}

/** Decode a literal's bytes with the font in force.
 */
function decodeBytes(text, font) {
  if (!font) return text.replace(/[\u0000-\u001f]/g, "");
  let out = "";
  for (const character of text) {
    const code = character.codePointAt(0);
    const glyph = font.differences.get(code);
    if (glyph) {
      out += glyphToUnicode(glyph);
      continue;
    }
    if (MATH_FAMILIES.has(font.family)) {
      const slot = mathSlot(font.family, code);
      if (slot !== null) {
        out += slot;
        continue;
      }
    }
    if (font.family === "cmtext" || font.family === "cmbold") {
      if (CM_TEXT_LIGATURES[code]) {
        out += CM_TEXT_LIGATURES[code];
        continue;
      }
      if (CM_TEXT_CAPITALS[code]) {
        out += CM_TEXT_CAPITALS[code];
        continue;
      }
    }
    if (code < 32) continue;
    out += character;
  }
  return out;}

/** Decode a PDF string literal, including octal and backslash escapes.
 */
function decodeString(literal) {
  const body = literal.slice(1, -1);
  return body.replace(/\\([0-7]{1,3}|[\s\S])/g, (_, escaped) => {
    if (/^[0-7]+$/.test(escaped)) return String.fromCharCode(Number.parseInt(escaped, 8));
    const named = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
    return named[escaped] ?? escaped;
  });}

/**
 * Text of a `TJ` array: literals concatenated, with a space wherever a large
 * negative adjustment marks a word gap. Small adjustments are kerning and must
 * not split a word, but they do still move the cursor, so their advance is
 * returned separately for the run's width.
 */
/**
 * A word gap inside a `TJ` array, marked with a private-use character that no
 * font slot can claim. Inserting a real space would be decoded as a glyph —
 * CMSY reads byte 0x20 as `←`, so `· · ·` came back as `·←·←·`.
 */
export const TJ_GAP = "\uE000";
/**
 * Text of a `TJ` array: literals concatenated, with a gap wherever a large
 * negative adjustment marks one.
 *
 * The gap's own advance replaces the nominal width of a space glyph: a
 * justified line shrinks its spaces, and counting a full 0.25 em there made a
 * run look wider than it is and swallowed the space before the next math run.
 */
export function showText(arrayLiteral) {
  if (arrayLiteral.startsWith("(")) {
    const text = decodeString(arrayLiteral);
    return { text, advance: 0, pieces: [{ text }] };
  }
  let text = "";
  let advance = 0;
  const pieces = [];
  for (const part of arrayLiteral.matchAll(/\((?:[^()\\]|\\.)*\)|-?\d*\.?\d+/g)) {
    if (part[0].startsWith("(")) {
      const literal = decodeString(part[0]);
      text += literal;
      pieces.push({ text: literal });
      continue;
    }
    const adjustment = Number(part[0]);
    if (adjustment <= -100 && !/\s$/.test(text)) text += TJ_GAP;
    advance -= adjustment / 1000;
    pieces.push({ gap: (-adjustment / 1000) * 1 });
  }
  return { text, advance, pieces };}

const CONTENT_TOKEN =
  /\((?:[^()\\]|\\.)*\)|\[(?:[^\]\\]|\\.)*\]|\/[^\s/\[\]()<>{}%]*|-?\d*\.?\d+|[A-Za-z'"*]+/g;
/**
 * Walk one content stream, collecting text runs with their positions and the
 * stroked horizontal rules that separate the two halves of a fraction.
 * @param {string} content the inflated content stream
 * @param {object[]} runs collected runs, appended in stream order
 * @param {Map<string, object> | undefined} fonts resource name → decoder
 * @param {object[]} [rules] collected horizontal rules in page points
 */
function parseContent(content, runs, fonts, rules = [], verticals = []) {
  const operands = [];
  let matrix = [1, 0, 0, 1, 0, 0];
  let ctm = [1, 0, 0, 1, 0, 0];
  const ctmStack = [];
  let leading = 0;
  let size = 10;
  let font = fonts?.get("") ?? null;
  let path = null;
  const rotation = () => Math.round((Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI);
  /**  
 * Record one text run: its decoded text, its advance, and its words with the  
 * position each one starts at. A table's columns are only recoverable from  
 * those positions — `44.9 66.8 78.1 85.0` is one run, and only the measured  
 * offset of each number says which column it belongs to.
 */
  const emit = (pieces) => {
    let text = "";
    let offset = 0;
    const words = [];
    let word = null;
    for (const piece of pieces) {
      if (piece.gap !== undefined) {
        const advance = piece.gap * size;
       if (advance >= size * 0.15 && word) {
          words.push(word);
          word = null;
          text += " ";
        }
        offset += advance;
        continue;
      }
      for (const character of piece.text) {
        const decoded = decodeBytes(character, font);
        const advance = charWidth(font, character, size);
        if (!decoded || /^\s$/.test(decoded)) {
          if (word) {
            words.push(word);
            word = null;
          }
          offset += advance;
          text += " ";
          continue;
        }
        text += decoded;
        if (!word) word = { text: "", x: offset, width: 0 };
        word.text += decoded;
        word.width += advance;
        offset += advance;
      }
    }
    if (word) words.push(word);
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return;
    runs.push({
      x: matrix[4],
      y: matrix[5],
      size,
      rotation: rotation(),
      text: clean,
      width: offset,
      family: font?.family ?? "other",
      words,
    });
  };
  /**
   * Record a stroked path when it is one straight line: a fraction bar, a table
   * rule, or the vertical separator between two of a table's columns.
   */
  const finishPath = () => {
    if (!path || path.points.length < 2) {
      path = null;
      return;
    }
    const [first, ...rest] = path.points;
    const flat = rest.every((point) => Math.abs(point.y - first.y) < 0.6);
    const upright = rest.every((point) => Math.abs(point.x - first.x) < 0.6);
    const xs = path.points.map((point) => point.x);
    const ys = path.points.map((point) => point.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);

    if (!path.filled && flat && width > 4) {
      rules.push({ x: Math.min(...xs), y: first.y, width });
    } else if (!path.filled && upright && height > 4) {
      verticals.push({ x: first.x, y: Math.min(...ys), height });
    }
    path = null;
  };
  const move = (tx, ty) => {
    matrix = [
      matrix[0],
      matrix[1],
      matrix[2],
      matrix[3],
      matrix[4] + matrix[0] * tx + matrix[2] * ty,
      matrix[5] + matrix[1] * tx + matrix[3] * ty,
    ];
  };
  const numbers = () => operands.filter((value) => typeof value === "number");
  for (const token of content.matchAll(CONTENT_TOKEN)) {
    const value = token[0];
    if (value.startsWith("(") || value.startsWith("[") || value.startsWith("/")) {
      operands.push(value);
      continue;
    }
    if (/^-?\d*\.?\d+$/.test(value)) {
      operands.push(Number(value));
      continue;
    }
    switch (value) {
      case "q":
        ctmStack.push([...ctm]);
        break;
      case "Q":
        ctm = ctmStack.pop() ?? [1, 0, 0, 1, 0, 0];
        break;
      case "cm": {
        const last = numbers().slice(-6);
        if (last.length === 6) ctm = multiplyMatrix(last, ctm);
        break;
      }
      case "re": {
        const box = numbers().slice(-4);
        if (box.length === 4) {
          const [x, y, width, height] = box;
          const corners = [
            [x, y],
            [x + width, y],
            [x, y + height],
            [x + width, y + height],
          ].map(([px, py]) => applyMatrix(ctm, px, py));
          const xs = corners.map(([px]) => px);
          const ys = corners.map(([, py]) => py);
          const ruleWidth = Math.max(...xs) - Math.min(...xs);
          const ruleHeight = Math.max(...ys) - Math.min(...ys);
          if (ruleHeight < 2 && ruleWidth > 4) {
            rules.push({ x: Math.min(...xs), y: Math.min(...ys), width: ruleWidth });
          } else if (ruleWidth < 2 && ruleHeight > 4) {
            verticals.push({ x: Math.min(...xs), y: Math.min(...ys), height: ruleHeight });
          }
        }
        break;
      }
      case "m":
      case "l": {
        const point = numbers().slice(-2);
        if (point.length === 2) {
          const [px, py] = applyMatrix(ctm, point[0], point[1]);
          if (!path) path = { points: [], filled: false };
          path.points.push({ x: px, y: py });
        }
        break;
      }
      case "f":
      case "F":
      case "f*":
      case "B":
      case "b":
        if (path) path.filled = true;
        finishPath();
        break;
      case "S":
      case "s":
        finishPath();
        break;
      case "BT":
        matrix = [1, 0, 0, 1, 0, 0];
        break;
      case "Tm": {
        const last = numbers().slice(-6);
        if (last.length === 6) matrix = last;
        break;
      }
      case "Td":
      case "TD": {
        const last = numbers().slice(-2);
        if (last.length === 2) {
          if (value === "TD") leading = -last[1];
          move(last[0], last[1]);
        }
        break;
      }
      case "T*":
        move(0, -leading);
        break;
      case "TL": {
        const last = numbers().slice(-1);
        if (last.length) leading = last[0];
        break;
      }
      case "Tf": {
        const last = numbers().slice(-1);
        if (last.length) size = last[0];
        const resourceName = operands.find(
          (value) => typeof value === "string" && value.startsWith("/"),
        );
        if (resourceName) font = fonts?.get(resourceName.slice(1)) ?? null;
        break;
      }
      case "Tj": {
        const literal = operands.at(-1);
        if (typeof literal === "string" && literal.startsWith("(")) emit([{ text: decodeString(literal) }]);
        break;
      }
      case "TJ": {
        const array = operands.at(-1);
        if (typeof array === "string" && array.startsWith("[")) emit(showText(array).pieces);
        break;
      }
      case "'":
      case '"': {
        move(0, -leading);
        const literal = operands.at(-1);
        if (typeof literal === "string" && literal.startsWith("(")) emit([{ text: decodeString(literal) }]);
        break;
      }
      default:
        break;
    }
    operands.length = 0;
  }}

/**
 * Group runs that share a baseline into lines, preserving stream order.
 *
 * A sub- or superscript is drawn on its own baseline a few points off the line,
 * so a row that is script-sized, sits within one em of the row above it and
 * stays inside that row's span is folded back into it. Without this a formula
 * becomes one Markdown line per script: `L(qi; p` / `+` / `i ; p` / `−` / `i;1`.
 */
export function groupLines(runs) {
  const rows = [];
  let current = null;
  for (const run of runs) {
    const tolerance = Math.max(2, run.size * 0.35);
    if (!current || current.rotation !== run.rotation || Math.abs(current.y - run.y) > tolerance) {
      current = { y: run.y, rotation: run.rotation, size: run.size, parts: [] };
      rows.push(current);
    }
    current.parts.push(run);
    current.size = Math.max(current.size, run.size);
  }
  const lines = [];
  for (const row of rows) {
    const base = lines.at(-1);
    const span = (entry) => {
      const xs = entry.parts.flatMap((part) => [part.x, part.x + part.width]);
      return { left: Math.min(...xs), right: Math.max(...xs) };
    };
   if (base && Math.abs(base.y - row.y) <= Math.max(2, row.size * 0.35)) {
      base.parts.push(...row.parts);
      base.size = Math.max(base.size, row.size);
      continue;
    }
    if (base && isScriptRow(row, base, span)) {
      base.parts.push(...row.parts);
      base.size = Math.max(base.size, row.size);
      continue;
    }
    lines.push(row);
  }
  return lines.map((line) => {
    const parts = [...line.parts]
      .sort((left, right) => left.x - right.x)
      .map((part) => ({
        x: part.x,
        y: part.y,
        width: part.width,
        size: part.size,
        text: part.text,
        family: part.family,
        words: (part.words ?? []).map((word) => ({ ...word, x: part.x + word.x })),
      }));
    return {
      y: line.y,
      rotation: line.rotation,
      size: line.size,
      text: joinRuns(parts),
      parts,
    };
  });}

/**
 * Whether a row is a script sitting on the line above it. The row overlaps the
 * base line rather than fitting inside it: a superscript on the last word runs
 * past the base row's right edge.
 */
function isScriptRow(row, base, span) {
  if (row.rotation !== base.rotation) return false;
  if (row.size > base.size * 0.85) return false;
  if (Math.abs(row.y - base.y) > base.size * 0.8) return false;
  if (row.parts.length > 4) return false;
  const inner = span(row);
  const outer = span(base);
  return inner.left < outer.right + base.size && inner.right > outer.left - base.size;}

/**
 * Whether two adjacent runs are separated by a word space.
 *
 * A wide gap is a space whatever the characters are. A narrow one is a space
 * only between two word characters: a justified line packs its spaces tighter
 * than the nominal width, so a run can end up to a third of an em inside the
 * position the next run starts from — while `d` and `-dimensional` abut exactly
 * and must stay one word.
 */
export function needsSpace(previous, next, gap, size) {
  if (!previous) return false;
  if (gap > Math.max(1, size * 0.25)) return true;
  if (gap <= -size * 0.35) return false;
  return /[A-Za-z0-9).,:;]$/.test(previous) && /^[A-Za-z0-9(]/.test(next);}

/** Join runs of one line, inserting a space only across a visible gap.
 */
function joinRuns(parts) {
  let text = "";
  let cursor = null;
  for (const part of parts) {
    const gap = cursor === null ? 0 : part.x - cursor;
    if (text && !/\s$/.test(text) && needsSpace(text, part.text, gap, part.size)) text += " ";
    text += part.text;
    cursor = part.x + part.width;
  }
  return text.replace(/\s+/g, " ").trim();}

/**
 * Read every page in document order, with its text laid out line by line and
 * its display equations rebuilt as LaTeX.
 * @param {Buffer} data PDF bytes
 * @returns {{ number: number, text: string, lines: object[], equations: object[] }[]}
 */
export function listPages(data) {
  const text = data.toString("latin1");
  const objects = readObjects(text);
  expandObjectStreams(objects);
  return pageOrder(objects).map((number, index) => {
    const page = objects.get(number);
    const runs = [];
    const rules = [];
    const verticals = [];
    if (page) {
      const fonts = pageFonts(objects, page.dict);
      for (const ref of contentRefs(page.dict)) {
        const object = objects.get(ref);
        if (!object?.stream) continue;
        let raw = Buffer.from(object.stream, "latin1");
        if (object.dict.includes("/FlateDecode")) {
          try {
            raw = inflateSync(raw);
          } catch {
            continue;
          }
        }
        parseContent(raw.toString("latin1"), runs, fonts, rules, verticals);
      }
    }
    const lines = groupLines(runs);
    const equations = page ? findEquations(lines, rules, pageSize(page.dict)) : [];
    const tables = page ? findTables(lines, pageSize(page.dict), equations, rules, verticals) : [];
    return {
      number: index + 1,
      text: lines.map((line) => line.text).join("\n"),
      lines,
      equations,
      tables,
      rules,
      verticals,
    };
  });}

/**
 * A line belongs to a display formula when most of it is set in a TeX face and
 * the rest is a short upright word (`\text{start}`, `\textrm{selected}`) or the
 * printed number `(2)`. A line of prose has body-font runs that carry spaces.
 */
function isMathLine(line) {
  if (line.rotation !== 0) return false;
  const parts = line.parts.filter((part) => !isEquationNumber(part));
  if (!parts.length) return false;
  const tex = parts.filter((part) => TEX_FAMILIES.has(part.family));
  if (!tex.length || tex.length < parts.length * 0.6) return false;
  if (!tex.some((part) => MATH_FAMILIES.has(part.family))) return false;
  return parts.every(
    (part) => TEX_FAMILIES.has(part.family) || /^[A-Za-z]{1,12}$/.test(part.text.trim()),
  );}

/** Whether a rule lies between two lines — the fraction bar of one formula.
 */
function ruleBetween(rules, above, below) {
  const top = Math.max(above.y, below.y);
  const bottom = Math.min(above.y, below.y);
  const parts = [...above.parts, ...below.parts];
  const left = Math.min(...parts.map((part) => part.x));
  const right = Math.max(...parts.map((part) => part.x + part.width));
  return rules.some(
    (rule) => rule.y < top && rule.y > bottom && rule.x < right && rule.x + rule.width > left,
  );}

/** A line made only of CMEX delimiters: a `\left( … \right)` drawn above the baseline.
 */
function isDelimiterLine(line) {
  return line.parts.length > 0 && line.parts.every((part) => part.family === "cmex");}

/** A line that opens with a relation continues the formula above it.
 */
function opensWithRelation(line) {
  const first = [...line.parts].sort((left, right) => left.x - right.x)[0];
  return first ? first.text.trim().startsWith("=") : false;}

/**
 * Left edges that prose starts at — one per column, plus a footnote edge.
 * A display formula is indented away from every one of them.
 */
function pageMargins(lines) {
  const counts = new Map();
  for (const line of lines) {
    const prose = line.parts.some(
      (part) => part.family === "other" && part.text.trim().length > 15,
    );
    if (!prose) continue;
    const left = Math.round(Math.min(...line.parts.map((part) => part.x)) / 2) * 2;
    counts.set(left, (counts.get(left) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count >= 2).map(([left]) => left);}

/**
 * Display equations on one page, in reading order.
 *
 * A formula set apart from the prose is a display equation: it starts where a
 * line of pure math sits one em or more below the line before it, or where the
 * page prints an equation number. A formula that wraps inside a paragraph stays
 * inline, which is why the gap test, not the font test alone, decides a start.
 *
 * Each entry records the lines it spans, the LaTeX rebuilt for it, the printed
 * number when the page shows one, and the box it occupies — the box is what the
 * raster path crops into `equation-<n>.png`.
 */
function findEquations(lines, rules, size) {
  const equations = [];
  const margins = pageMargins(lines);
  let start = -1;
  let last = -1;
  const begins = (index) => {
    const line = lines[index];
    if (!isMathLine(line)) return false;
    if (line.parts.some((part) => isEquationNumber(part))) return true;
   const left = Math.min(...line.parts.map((part) => part.x));
    if (margins.some((margin) => Math.abs(left - margin) < 4)) return false;
    if (index === 0) return true;
    return Math.abs(lines[index - 1].y - line.y) > line.size * 1.6;
  };
  const block = (from, to) => {
    const runs = lines.slice(from, to + 1).flatMap((line) => line.parts);
    if (runs.length < 2) return;
    const built = buildEquation(runs, rules);
    if (!built?.latex) return;
    const left = Math.min(...runs.map((run) => run.x));
    const right = Math.max(...runs.map((run) => run.x + run.width));
    if (right - left <= Math.max(...runs.map((run) => run.size))) return;
    const top = Math.max(...runs.map((run) => run.y + run.size * 0.8));
    const bottom = Math.min(...runs.map((run) => run.y - run.size * 0.25));
   const largest = Math.max(...runs.map((run) => run.size));
    const tally = new Map();
    for (const run of runs) {
      if (run.size === largest) tally.set(run.y, (tally.get(run.y) ?? 0) + run.width);
    }
    const baseline = [...tally.entries()].sort((left, right) => right[1] - left[1])[0][0];
   const previous = equations.at(-1);
    const ceiling = previous ? previous.baseline - largest * 0.42 : top;
    equations.push({
      start: from,
      end: to,
      latex: built.latex,
      tag: built.tag,
      baseline,
      box: {
        x: left - 1.5,
        y: bottom - 1.5,
        width: right - left + 3,
        height: Math.min(top, ceiling) - bottom + 3,
        pageWidth: size.width,
        pageHeight: size.height,
      },
    });
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (start >= 0) {
      const size = lines[start].size;
      const gap = Math.abs(line.y - lines[last].y);
      const relation = opensWithRelation(line);
      const straddles = ruleBetween(rules, lines[last], line);
     const forwards =
        line.y <= lines[start].y + size * 0.5 ||
        relation ||
        straddles ||
        isDelimiterLine(line);
      const linked = gap <= size * 1.5 || relation || straddles;
      if (isMathLine(line) && linked && forwards) {
        last = index;
        continue;
      }
      block(start, last);
      start = -1;
    }
    if (begins(index)) {
      start = index;
      last = index;
    }
  }
  if (start >= 0) block(start, last);
  return equations;}

/**
 * Tables on one page, in reading order.
 *
 * Two shapes are recognised. A ruled grid is three or more rows, at least two of
 * them carrying three or more cells, where a cell boundary is a gap much wider
 * than a word space. A table with no rules at all — a header, then a passage per
 * column, each one wrapping down its own side, as the examples table is set —
 * gives no such rows: it is found from its printed caption, and the lines above
 * that caption in the table's smaller face are the table.
 *
 * Each entry records the lines it spans and the box it occupies; the box is what
 * the raster path crops into `table-<n>.png`.
 */
export function findTables(lines, size, equations = [], rules = [], verticals = []) {
  const tables = [];
  const inEquation = (index) =>
    equations.some((equation) => index >= equation.start && index <= equation.end);
  const claimed = (index) => tables.some((table) => index >= table.start && index <= table.end);
  const record = (start, end) => {
    const block = lines.slice(start, end + 1);
    const words = block.flatMap(lineWords);
    if (!words.length) return;

    let left = Math.min(...words.map((word) => word.x));
    let right = Math.max(...words.map((word) => word.x + word.width));
    let top = Math.max(...block.map((line) => line.y));
    let bottom = Math.min(...block.map((line) => line.y));
    const textSize = Math.max(...words.map((word) => word.size));

    // A table's frame is part of the table. The text box stops at the first and
    // last line's ink, which cuts the rules a few points above and below them —
    // and a rule spans the table, so it also settles the left and right edges.
    const nearby = rules.filter(
      (rule) => rule.x + rule.width > left - textSize && rule.x < right + textSize,
    );
    const above = nearby
      .filter((rule) => rule.y > top && rule.y <= top + textSize * 3)
      .sort((one, other) => other.y - one.y)[0];
    const below = nearby
      .filter((rule) => rule.y < bottom && rule.y >= bottom - textSize * 3)
      .sort((one, other) => one.y - other.y)[0];

    for (const rule of [above, below].filter(Boolean)) {
      left = Math.min(left, rule.x);
      right = Math.max(right, rule.x + rule.width);
    }
    if (above) top = above.y;
    if (below) bottom = below.y;

    // A table boxed by vertical rules keeps them too. A separator between two
    // columns lies inside the text span and changes nothing; a border lies just
    // outside it, and a PDF may draw that border in one piece per row, so the
    // test is where the stroke is, not how long it is.
    const sides = verticals
      .filter((line) => line.y <= top + textSize && line.y + line.height >= bottom - textSize)
      .filter((line) => line.x < left - 0.5 || line.x > right + 0.5)
      .filter((line) => line.x >= left - textSize * 2 && line.x <= right + textSize * 2);
    if (sides.length) {
      left = Math.min(left, ...sides.map((line) => line.x));
      right = Math.max(right, ...sides.map((line) => line.x));
    }

    // The printed number, when the caption sits directly below the table: it is
    // the label a reader recognises, and it need not match the position in the
    // document — this paper numbers Table 7 after a Table 5 and a Table 6.
    const caption = lines[end + 1]?.text.trim() ?? "";
    const printed = /^Table\s+(\d+)/.exec(caption)?.[1] ?? null;

    tables.push({
      start,
      end,
      tag: printed,
      box: {
        x: left - 2,
        y: bottom - 1.5,
        width: right - left + 4,
        height: top + 1.5 - (bottom - 1.5),
        pageWidth: size.width,
        pageHeight: size.height,
      },
    });
  };
  const CAPTION = /^Table\s+\d+\s*[:.]/;
  const isCaption = (line) => CAPTION.test(line.text.trim());
  for (let index = 0; index < lines.length; index += 1) {
    if (inEquation(index) || claimed(index)) continue;
    const cells = lineCells(lines[index]);
    if (!cells) continue;
    let multiCell = 1;
    let wideRows = cells.length >= 3 ? 1 : 0;
    let rows = 1;
    let top = lines[index].y;
    let bottom = lines[index].y;
    // A group label sits in a wider gap than a row does, and the table goes on
    // below it — this is what keeps Table 4 one table instead of two.
    const margin = (candidate) => candidate.size * 3.5;
    const inside = (candidate) =>
      candidate.y <= top + margin(candidate) && candidate.y >= bottom - margin(candidate);
    let next = index + 1;
    while (next < lines.length) {
      const candidate = lines[next];
     if (isCaption(candidate)) break;
      if (!inside(candidate)) break;
      const candidateCells = lineCells(candidate);
      if (candidateCells) {
        multiCell += 1;
        if (candidateCells.length >= 3) wideRows += 1;
        rows += 1;
        top = Math.max(top, candidate.y);
        bottom = Math.min(bottom, candidate.y);
        next += 1;
        continue;
      }
      let probe = next + 1;
      let followed = false;
      while (probe < lines.length && Math.abs(lines[probe].y - candidate.y) <= candidate.size * 3) {
        if (lineCells(lines[probe])) {
          followed = true;
          break;
        }
        probe += 1;
      }
      if (!followed) break;
      rows += 1;
      top = Math.max(top, candidate.y);
      bottom = Math.min(bottom, candidate.y);
      next += 1;
    }
    if (rows < 3 || multiCell < 3 || wideRows < 2) continue;
    record(index, next - 1);
    index = next - 1;
  }
 for (let index = 0; index < lines.length; index += 1) {
    const caption = lines[index];
    if (!isCaption(caption)) continue;
    // A caption is smaller than the body text after it; look far enough past
    // the caption's own continuation lines to find a body line.
    const after = lines.slice(index + 1, index + 9);
    const bodySize = Math.max(caption.size, ...after.map((line) => line.size));
    if (caption.size >= bodySize) continue;
    const prose = (line) =>
      line.size >= caption.size &&
      (lineCells(line)?.length ?? 1) <= 1 &&
      line.text.trim().length > 30;
    let start = index - 1;
    while (start > 0) {
      const candidate = lines[start - 1];
      if (claimed(start - 1) || inEquation(start - 1)) break;
      if (prose(candidate)) break;
     start -= 1;
    }
    if (index - start < 2) continue;
    const block = lines.slice(start, index);
    if (!block.some((line) => (lineCells(line)?.length ?? 0) >= 2)) continue;
    if (tables.some((table) => start <= table.end && index - 1 >= table.start)) continue;
    record(start, index - 1);
  }
  return tables.sort((left, right) => left.start - right.start);}

/**
 * Boxes of the tables, one per table in document order.
 * @returns {{ page: number, x: number, y: number, width: number, height: number,
 *   pageWidth: number, pageHeight: number }[]}
 */
export function tableBoxes(data) {
  return listPages(data).flatMap((page) =>
    page.tables.map((table) => ({ page: page.number, ...table.box })),
  );}

/**
 * Boxes of the display equations, one per equation in document order.
 * @returns {{ page: number, x: number, y: number, width: number, height: number,
 *   pageWidth: number, pageHeight: number, latex: string, tag: string | null }[]}
 */
export function equationBoxes(data) {
  return listPages(data).flatMap((page) =>
    page.equations.map((equation) => ({
      page: page.number,
      ...equation.box,
      latex: equation.latex,
      tag: equation.tag,
    })),
  );}

/** Page width and height in points, from `/MediaBox`.
 */
export function pageSize(pageDict) {
  const box = /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/.exec(
    pageDict,
  );
  if (!box) return { width: 612, height: 792 };
  return {
    width: Math.abs(Number(box[3]) - Number(box[1])),
    height: Math.abs(Number(box[4]) - Number(box[2])),
  };}

/** Multiply a matrix by the current transform, PDF row-vector convention.
 */
function multiplyMatrix(left, right) {
  const [a, b, c, d, e, f] = left;
  const [m0, m1, m2, m3, m4, m5] = right;
  return [
    a * m0 + b * m2,
    a * m1 + b * m3,
    c * m0 + d * m2,
    c * m1 + d * m3,
    e * m0 + f * m2 + m4,
    e * m1 + f * m3 + m5,
  ];}

function applyMatrix(matrix, x, y) {
  return [x * matrix[0] + y * matrix[2] + matrix[4], x * matrix[1] + y * matrix[3] + matrix[5]];}

/** Resource name → object number for a page's XObjects.
 */
function xobjectRefs(objects, pageDict) {
  const refs = new Map();
  const resources = resolveDict(objects, pageDict, "Resources");
  const xobjects = resources ? resolveDict(objects, resources.dict, "XObject") : null;
  if (!xobjects) return refs;
  for (const match of xobjects.dict.matchAll(/\/([^\s/\[\]()<>{}%]+)\s+(\d+)\s+0\s+R/g)) {
    refs.set(match[1], Number(match[2]));
  }
  return refs;}

/**
 * Bounding boxes of the vector figures a page draws.
 *
 * Tracks the graphics state (`q`, `Q`, `cm`), and on `Do` of a Form XObject
 * transforms its `/BBox` through the form matrix and the current transform.
 * Glyph forms (a few points wide) are ignored.
 * @returns {{ page: number, x: number, y: number, width: number, height: number,
 *   pageWidth: number, pageHeight: number }[]}
 */
export function figureBoxes(data) {
  const text = data.toString("latin1");
  const objects = readObjects(text);
  expandObjectStreams(objects);
  const figures = [];
  pageOrder(objects).forEach((number, index) => {
    const page = objects.get(number);
    if (!page) return;
    const refs = xobjectRefs(objects, page.dict);
    const size = pageSize(page.dict);
    const stack = [];
    let transform = [1, 0, 0, 1, 0, 0];
    let operands = [];
    for (const ref of contentRefs(page.dict)) {
      const object = objects.get(ref);
      if (!object?.stream) continue;
      let raw = Buffer.from(object.stream, "latin1");
      if (object.dict.includes("/FlateDecode")) {
        try {
          raw = inflateSync(raw);
        } catch {
          continue;
        }
      }
      for (const token of raw.toString("latin1").matchAll(CONTENT_TOKEN)) {
        const value = token[0];
        if (value.startsWith("/")) {
          operands.push(value.slice(1));
          continue;
        }
        if (/^-?\d*\.?\d+$/.test(value)) {
          operands.push(Number(value));
          continue;
        }
        const numbers = operands.filter((entry) => typeof entry === "number");
        if (value === "q") {
          stack.push([...transform]);
        } else if (value === "Q") {
          transform = stack.pop() ?? [1, 0, 0, 1, 0, 0];
        } else if (value === "cm") {
          const matrix = numbers.slice(-6);
          if (matrix.length === 6) transform = multiplyMatrix(matrix, transform);
        } else if (value === "Do") {
          const name = operands.find((entry) => typeof entry === "string");
          const xobject = name ? objects.get(refs.get(name) ?? -1) : null;
          const bbox = xobject
            ? /\/BBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/.exec(xobject.dict)
            : null;
          if (bbox) {
            const formMatrix = /\/Matrix\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/.exec(
              xobject.dict,
            );
            const local = formMatrix ? formMatrix.slice(1).map(Number) : [1, 0, 0, 1, 0, 0];
            const combined = multiplyMatrix(local, transform);
            const corners = [
              [Number(bbox[1]), Number(bbox[2])],
              [Number(bbox[3]), Number(bbox[2])],
              [Number(bbox[1]), Number(bbox[4])],
              [Number(bbox[3]), Number(bbox[4])],
            ].map(([x, y]) => applyMatrix(combined, x, y));
            const xs = corners.map(([x]) => x);
            const ys = corners.map(([, y]) => y);
            const left = Math.min(...xs);
            const bottom = Math.min(...ys);
            const width = Math.max(...xs) - left;
            const height = Math.max(...ys) - bottom;
            if (width >= 40 && height >= 40) {
              figures.push({
                page: index + 1,
                x: left,
                y: bottom,
                width,
                height,
                pageWidth: size.width,
                pageHeight: size.height,
              });
            }
          }
        }
        operands = [];
      }
    }
  });
  return figures;}

export function extractText(data) {
  return listPages(data)
    .map((page) => page.text)
    .filter(Boolean)
    .join(" ");}

/** Read the first embedded image: its bytes, width and height.
 */
export function extractImage(data) {
  const text = data.toString("latin1");
  const marker = text.search(/\/Subtype\s*\/Image/);
  if (marker < 0) return null;
  const headStart = text.lastIndexOf("<<", marker);
  const streamIndex = text.indexOf("stream", marker);
  const head = text.slice(headStart, streamIndex);
  const length = Number(/\/Length\s+(\d+)/.exec(head)[1]);
  const width = Number(/\/Width\s+(\d+)/.exec(head)[1]);
  const height = Number(/\/Height\s+(\d+)/.exec(head)[1]);
  let start = streamIndex + "stream".length;
  if (text.slice(start, start + 2) === "\r\n") start += 2;
  else if (text[start] === "\n" || text[start] === "\r") start += 1;
  return { bytes: data.subarray(start, start + length), width, height };}

/** Collapse whitespace and wrap to a fixed width — used for single-run pages.
 */
export function formatText(text, width = 100) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const lines = [];
  let line = "";
  for (const word of cleaned.split(" ")) {
    if (!word) continue;
    if (line.length + word.length + 1 <= width) {
      line = `${line} ${word}`.trim();
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");}

/**
 * Page body: horizontal lines in layout order, paragraphs separated by a blank
 * line, and vertical text quoted at the end instead of polluting the flow.
 */
/** Words of one line, with the x each one starts at.
 */
function lineWords(line) {
  return (line.parts ?? []).flatMap((part) =>
    part.words?.length
      ? part.words.map((word) => ({ ...word, size: part.size }))
      : [{ text: part.text, x: part.x, width: part.width ?? part.text.length * part.size * 0.5, size: part.size }],
  );}

/**
 * Split one line into table cells with the x each one starts at; null when it
 * is not a multi-cell line.
 */
export function lineCellEntries(line) {
  const words = lineWords(line);
  if (words.length < 2) return null;
  const cells = [];
  let current = null;
  for (const word of words) {
    if (current === null) {
      current = { text: word.text, x: word.x, end: word.x + word.width };
      continue;
    }
    const gap = word.x - current.end;
    if (gap > Math.max(4, word.size * 0.9)) {
      cells.push({ text: current.text, x: current.x });
      current = { text: word.text, x: word.x, end: word.x + word.width };
    } else {
      current.text += (gap > word.size * 0.15 ? " " : "") + word.text;
      current.end = word.x + word.width;
    }
  }
  if (current) cells.push({ text: current.text, x: current.x });
  return cells.length >= 2 ? cells : null;}

/**
 * Split one line into table cells; null when it is not a multi-cell line.
 *
 * A column boundary is a gap much wider than a word space — the printed table
 * pads its columns with drawn space, which is why `44.9 66.8 78.1 85.0` is four
 * cells and a justified paragraph is one.
 */
export function lineCells(line) {
  return lineCellEntries(line)?.map((cell) => cell.text) ?? null;}

/**
 * Render the rows of a table as a monospace facsimile of the printed layout.
 *
 * Each word is placed at the column its x position names, which is what
 * `pdftotext -layout` gives: the printed relationships survive — a header over
 * its numbers, a label between the two rows it groups — and a monospace face
 * makes them line up. Nothing is inferred, and the cost is stated: a cell whose
 * text is wider in monospace than on the page pushes its neighbour right by a
 * space, so a wide label can leave the next column one character out.
 * @param {{ y: number, parts: object[] }[]} lines the table's lines, in reading order
 */
export function layoutTable(lines) {
  const ordered = [...lines].sort((left, right) => right.y - left.y);
  const words = ordered.flatMap(lineWords);
  if (!words.length) return "";
  const size = Math.max(...words.map((word) => word.size));
  const left = Math.min(...words.map((word) => word.x));
  const cell = Math.max(2, size * 0.55);
 const rows = [];
  for (const line of ordered) {
    const row = rows.at(-1);
    if (row && Math.abs(row.y - line.y) <= Math.max(1, line.size * 0.15)) row.lines.push(line);
    else rows.push({ y: line.y, lines: [line] });
  }
  const rendered = rows.map((row) => {
    let out = "";
    for (const word of row.lines.flatMap(lineWords)) {
      const column = Math.round((word.x - left) / cell);
      if (out.length < column) out += " ".repeat(column - out.length);
     else if (out.length > 0 && !out.endsWith(" ")) out += " ";
      out += word.text;
    }
    return out.replace(/\s+$/, "");
  });
  return ["```text", ...rendered.filter((line) => line.length > 0), "```"].join("\n");}

/**
 * Place the cells of a table into a rectangular grid.
 *
 * The widest printed row defines the columns — it is the one that separates the
 * most cells — and every other row's cells are placed in the column nearest
 * their x position. That is what lines a two-row header up with its numbers:
 * the sub-header's `NQ` lands over the `59.1` column rather than two cells left.
 * @returns {{ matrix: string[][], numeric: boolean[] }}
 */
function tableGrid(lines) {
  const rows = [...lines].sort((left, right) => right.y - left.y);
  const entries = rows
    .map((line) => lineCellEntries(line) ?? [{ text: line.text.trim(), x: lineWords(line)[0]?.x ?? 0 }])
    .filter((row) => row.length && row.some((cell) => cell.text));
  if (!entries.length) return { matrix: [], numeric: [] };
  const widest = entries.reduce((best, row) => (row.length > best.length ? row : best), entries[0]);
  const anchors = widest.map((cell) => cell.x);
  const closest = (x) => {
    let best = 0;
    let distance = Infinity;
    anchors.forEach((anchor, index) => {
      const away = Math.abs(anchor - x);
      if (away < distance) {
        distance = away;
        best = index;
      }
    });
    return best;
  };
  const matrix = entries.map((row) => {
    const cells = new Array(anchors.length).fill("");
    for (const cell of row) {
      const index = closest(cell.x);
      cells[index] = cells[index] ? `${cells[index]} ${cell.text}` : cell.text;
    }
    return cells;
  });
 const numeric = anchors.map((_, index) => {
    const filled = matrix.slice(1).map((row) => row[index]).filter(Boolean);
    return filled.length > 0 && filled.every((cell) => /^[\d.,%\u2212-]+$/.test(cell));
  });
  return { matrix, numeric };}

/**
 * Render the rows of a table as CSV, one record per printed row.
 * @param {{ y: number, parts: object[] }[]} lines the table's lines, in reading order
 * @returns {string} a fenced `csv` block, or an empty string when there is no table
 */
export function csvTable(lines) {
  const { matrix } = tableGrid(lines);
  if (!matrix.length) return "";
  const quote = (value) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
  return ["```csv", ...matrix.map((cells) => cells.map(quote).join(",")), "```"].join("\n");}

/**
 * Render the rows of a table as a Markdown pipe table.
 *
 * The first row becomes the header, because Markdown has nowhere else to put it;
 * a table whose real header spans two printed rows keeps the second one as a
 * body row, and a merged cell opens an empty column rather than a span, since a
 * pipe table has no column spans.
 * @param {{ y: number, parts: object[] }[]} lines the table's lines, in reading order
 * @returns {string} a pipe table, or an empty string when there is no table
 */
export function pipeTable(lines) {
  const { matrix, numeric } = tableGrid(lines);
  if (!matrix.length) return "";
  const cell = (value) => value.replaceAll("|", "\\|").trim();
  const rule = numeric.map((right) => (right ? "---:" : "---"));
  const [header, ...body] = matrix;
  return [
    `| ${header.map(cell).join(" | ")} |`,
    `| ${rule.join(" | ")} |`,
    ...body.map((cells) => `| ${cells.map(cell).join(" | ")} |`),
  ].join("\n");}

/**
 * One laid-out line as Markdown.
 *
 * Prose runs are copied as they are; a run of TeX faces becomes inline math, so
 * `encoder`, a math-italic `E` with a sub `P` and `(·)` read
 * `encoder $E_{P}(\cdot)$` instead of fusing into one word.
 */
export function renderLine(line) {
  const parts = line.parts ?? [];
  const pieces = [];
  let cursor = 0;
  let lastChar = "";
  for (let index = 0; index < parts.length; ) {
    const part = parts[index];
    const gap = part.x - cursor;
    if (pieces.length && needsSpace(lastChar, part.text, gap, part.size)) pieces.push(" ");
    if (part.family === "other") {
      pieces.push(part.text);
      lastChar = part.text.slice(-1);
      cursor = part.x + part.width;
      index += 1;
      continue;
    }
    let end = index;
    while (end + 1 < parts.length) {
      const next = parts[end + 1];
      if (next.family !== "other") {
        end += 1;
        continue;
      }
     const after = parts[end + 2];
      if (after && after.family !== "other" && /^[A-Za-z]{1,12}$/.test(next.text.trim())) {
        end += 2;
        continue;
      }
      break;
    }
    const span = parts.slice(index, end + 1);
    const frame = span.reduce((best, run) => (run.size > best.size ? run : best), span[0]);
    pieces.push(`$${latexSequence(span, frame.y, frame.size)}$`);
   lastChar = span.at(-1).text.trim().slice(-1) || lastChar;
    cursor = Math.max(...span.map((run) => run.x + run.width));
    index = end + 1;
  }
  return pieces.join("").replace(/\s+/g, " ").trim();}

/**
 * Page body: horizontal lines in layout order, paragraphs separated by a blank
 * line, display equations as `$$…$$`, aligned cell rows rendered as a fenced
 * text table, and vertical text quoted at the end instead of polluting the flow.
 */
export function pageBody(page, { equationImages = [], tableImages = [], tableStart = 0, tableFormat = "ascii" }

 = {}

) {
  const blocks = [];
  let paragraph = [];
  let previous = null;
  const vertical = [];
  const lines = page.lines;
  const equations = (page.equations ?? []).map((equation, index) => ({ ...equation, index }));
  const tables = (page.tables ?? []).map((table, index) => ({ ...table, index }));
  let index = 0;
  const flush = () => {
    if (paragraph.length) blocks.push(paragraph.join("\n"));
    paragraph = [];
    previous = null;
  };
  while (index < lines.length) {
    const line = lines[index];
    const equation = equations.find((candidate) => candidate.start === index);
    if (equation) {
      flush();
      const tag = equation.tag ? ` \\tag{${equation.tag.slice(1, -1)}}` : "";
      blocks.push(`$$ ${equation.latex}${tag} $$`);
      const image = equationImages[equation.index];
      if (image) {
        const label = equation.tag ? `Equation ${equation.tag}` : `Equation ${equation.index + 1}`;
        blocks.push(`![${label}](${image})`);
      }
      index = equation.end + 1;
      continue;
    }
    if (line.rotation !== 0) {
      vertical.push(line.text);
      index += 1;
      continue;
    }
    const table = tables.find((candidate) => candidate.start === index);
    if (table) {
      const blockLines = lines.slice(table.start, table.end + 1);
      flush();
      blocks.push(
        tableFormat === "csv"
          ? csvTable(blockLines)
          : tableFormat === "pipe"
            ? pipeTable(blockLines)
            : layoutTable(blockLines),
      );
      const image = tableImages[table.index];
      if (image) blocks.push(`![Table ${tableStart + table.index + 1}](${image})`);
      index = table.end + 1;
      continue;
    }
    if (previous && Math.abs(previous.y - line.y) > Math.max(2, previous.size * 1.6)) flush();
    paragraph.push(renderLine(line));
    previous = line;
    index += 1;
  }
  flush();
  if (vertical.length) blocks.push(`> Vertical text: ${vertical.join(" ")}`);
  return blocks.join("\n\n");}

/**
 * Build the page-marked Markdown body: one marker per page, then the assets.
 * @param {{ number: number, lines: object[], equations?: object[] }[]} pages
 * @param {string} name document basename, used for the asset references
 * @param {boolean} withImage append the first image's Markdown reference
 * @param {string[]} pageImages rendered page files to reference, e.g. page-1.png
 * @param {string[]} figureImages cropped figure files, in document order
 * @param {string[]} equationImages cropped equation files, in document order
 * @param {string[]} tableImages cropped table files, in document order
 * @param {"ascii" | "csv"} tableFormat how a detected table is written
 */
export function pageMarkedMarkdown(
  pages,
  name,
  withImage = true,
  pageImages = [],
  figureImages = [],
  equationImages = [],
  tableImages = [],
  tableFormat = "ascii",) {
  let offset = 0;
  let tableOffset = 0;
  const blocks = pages.map((page) => {
    const count = page.equations?.length ?? 0;
    const files = equationImages.slice(offset, offset + count).map((file) => `${name}.assets/${file}`);
    offset += count;
    const tableCount = page.tables?.length ?? 0;
    const tableFiles = tableImages
      .slice(tableOffset, tableOffset + tableCount)
      .map((file) => `${name}.assets/${file}`);
    tableOffset += tableCount;
    const body = pageBody(page, {
      equationImages: files,
      tableImages: tableFiles,
      tableStart: tableOffset - tableCount,
      tableFormat,
    });
    return body ? `<!-- page: ${page.number} -->\n\n${body}` : `<!-- page: ${page.number} -->`;
  });
  if (withImage) blocks.push(`![Figure 1](${name}.assets/image-1.jpg)`);
  if (pageImages.length > 0) {
    const references = pageImages.map((file, index) => `![Page ${index + 1}](${name}.assets/${file})`);
    blocks.push(["<!-- page images -->", ...references].join("\n"));
  }
  if (figureImages.length > 0) {
    const references = figureImages.map((file, index) => `![Figure ${index + 1}](${name}.assets/${file})`);
    blocks.push(["<!-- figures -->", ...references].join("\n"));
  }
  return `${blocks.join("\n\n")}\n`;}

/** Rendered images already present in the assets folder, in page order.
 */
function findImages(outDir, name, prefix) {
  const assetsDir = path.join(outDir, `${name}.assets`);
  if (!existsSync(assetsDir)) return [];
  const pageNumber = (file) => Number(/(\d+)/.exec(file)?.[1] ?? 0);
  return readdirSync(assetsDir)
    .filter((file) => new RegExp(`^${prefix}-\\d+\\.png$`, "i").test(file))
    .sort((left, right) => pageNumber(left) - pageNumber(right));}

/**
 * Write the page-marked Markdown, sidecar, manifest and image asset.
 * @param {Buffer} data the fixture PDF bytes
 * @param {string} outDir the directory to write into
 * @param {string} name document basename; defaults to the embedded fixture
 */
export function writeExtraction(data, outDir, name = FIXTURE_NAME) {
  const pages = listPages(data);
  const image = extractImage(data);
  let imagePath = null;
  if (image) {
    const assets = path.join(outDir, `${name}.assets`);
    mkdirSync(assets, { recursive: true });
    imagePath = path.join(assets, "image-1.jpg");
    writeFileSync(imagePath, image.bytes);
  }
  const md = path.join(outDir, `${name}.md`);
  writeFileSync(
    md,
    pageMarkedMarkdown(
      pages,
      name,
      image !== null,
      findImages(outDir, name, "page"),
      findImages(outDir, name, "figure"),
      findImages(outDir, name, "equation"),
      findImages(outDir, name, "table"),
      ["csv", "pipe"].includes(process.env.PDF_TABLE_FORMAT) ? process.env.PDF_TABLE_FORMAT : "ascii",
    ),
    "utf8",
  );
  const images = image ? 1 : 0;
  const equations = pages.reduce((total, page) => total + (page.equations?.length ?? 0), 0);
  const tables = pages.reduce((total, page) => total + (page.tables?.length ?? 0), 0);
  const meta = path.join(outDir, `${name}.metadata.json`);
  writeFileSync(
    meta,
    JSON.stringify({ docId: name, pages: pages.length, images, equations, tables }),
    "utf8",
  );
  const summary = path.join(outDir, "summary.json");
  writeFileSync(
    summary,
    JSON.stringify({ documents: [{ name, pages: pages.length, images, equations, tables }] }, null, 2),
    "utf8",
  );
  return { md, meta, summary, imagePath };}

