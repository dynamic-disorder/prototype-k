/**
 * TeX math fonts, their glyph slots, and the LaTeX rebuilt from glyph positions.
 *
 * The bundled paper is typeset by pdfTeX: a formula is positioned glyphs in CMR,
 * CMMI, CMSY, CMEX and MSAM, with no `/Encoding` and no `/ToUnicode`. A byte is
 * therefore only meaningful through the font's own slot table — reading it as
 * ASCII is what turned `{` into `f`, `}` into `g` and `,` into `;`.
 *
 * Structure comes from position, not guesswork:
 * - a run smaller than its line and above the baseline is a superscript, below
 *   it a subscript, and its own baseline becomes the frame for anything nested;
 * - a stroked horizontal rule inside a math block splits the runs above it from
 *   the runs below it, which is a fraction;
 * - an isolated `(n)` on the right margin of the block is that equation's number.
 *
 * Nothing here invents a symbol: a slot that is not mapped stays as its literal
 * byte, and a math block with no rule is emitted as one linear LaTeX line.
 */

/** Font families that only ever carry math. */
export const MATH_FAMILIES = new Set(["cmmi", "cmsy", "cmex", "msam", "msbm"]);

/** TeX families at all — text fonts (cmr, cmbx, cmti) count as math inside a formula. */
export const TEX_FAMILIES = new Set([...MATH_FAMILIES, "cmtext", "cmbold"]);

/**
 * CMSY10 slots. 0x00–0x1F are the operators and relations that appear in
 * running text; 0x66/0x67 are the visible set braces (`\{` and `\}`), which is
 * why an unmapped `{` read as the ASCII letter `f` and `}` as `g`.
 */
const CMSY = {
  0x00: "\u2212", // minus
  0x01: "\u00b7", // periodcentered
  0x02: "\u00d7", // multiply
  0x03: "\u2217", // asteriskmath
  0x04: "\u00f7", // divide
  0x05: "\u22c4", // diamondmath
  0x06: "\u00b1", // plusminus
  0x07: "\u2213", // minusplus
  0x08: "\u2295", // circleplus
  0x09: "\u2296", // circleminus
  0x0a: "\u2297", // circlemultiply
  0x0b: "\u2298", // circledivide
  0x0c: "\u2299", // circledot
  0x0d: "\u25ef", // bigcircle
  0x0e: "\u2218", // circle
  0x0f: "\u2219", // bullet
  0x10: "\u224d", // asymp
  0x11: "\u2261", // equivalence
  0x12: "\u2286", // reflexsubset
  0x13: "\u2287", // reflexsuperset
  0x14: "\u2264", // lessequal
  0x15: "\u2265", // greaterequal
  0x16: "\u2aaf", // precedesequal
  0x17: "\u2ab0", // followsequal
  0x18: "\u223c", // similar
  0x19: "\u2248", // approxequal
  0x1a: "\u2282", // propersubset
  0x1b: "\u2283", // propersuperset
  0x1c: "\u226a", // lessmuch
  0x1d: "\u226b", // greatermuch
  0x1e: "\u227a", // precedes
  0x1f: "\u227b", // follows
  // The arrow range. 0x21 is verified against this paper: `R : (q, C) → C_F`
  // draws its arrow as the ASCII `!` byte. The rest of the range is the
  // standard CMSY layout.
  0x20: "\u2190", // arrowleft
  0x21: "\u2192", // arrowright
  0x22: "\u2191", // arrowup
  0x23: "\u2193", // arrowdown
  0x24: "\u2194", // arrowboth
  0x25: "\u2197", // arrownortheast
  0x26: "\u2198", // arrowsoutheast
  0x27: "\u2243", // similarequal
  0x28: "\u21d0", // arrowdblleft
  0x29: "\u21d2", // arrowdblright
  0x2a: "\u21d1", // arrowdblup
  0x2b: "\u21d3", // arrowdbldown
  0x2c: "\u21d4", // arrowdblboth
  0x2d: "\u2196", // arrownorthwest
  0x2e: "\u2199", // arrowsouthwest
  0x2f: "\u221d", // proportional
  // 0x32 is the only relation slot this paper draws: `∈` in `R^{h×k}`.
  0x32: "\u2208", // element
  0x66: "{",
  0x67: "}",
  0x68: "\u27e8", // angleleft
  0x69: "\u27e9", // angleright
  0x6a: "|", // verticalbar
};

/**
 * CMMI10 slots. Greek letters sit at 0x0B–0x1F; the punctuation that matters is
 * 0x3A and 0x3B, which hold a period and a comma while ASCII reads them as `:`
 * and `;` — the reason a parameter list came out as `L(qi; p+i ; ...)`.
 */
const CMMI = {
  0x0b: "\u03b1",
  0x0c: "\u03b2",
  0x0d: "\u03b3",
  0x0e: "\u03b4",
  0x0f: "\u03b5",
  0x10: "\u03b6",
  0x11: "\u03b7",
  0x12: "\u03b8",
  0x13: "\u03b9",
  0x14: "\u03ba",
  0x15: "\u03bb",
  0x16: "\u03bc",
  0x17: "\u03bd",
  0x18: "\u03be",
  0x19: "\u03c0",
  0x1a: "\u03c1",
  0x1b: "\u03c3",
  0x1c: "\u03c4",
  0x1d: "\u03c5",
  0x1e: "\u03c6",
  0x1f: "\u03c7",
  0x3a: ".",
  0x3b: ",",
};

/**
 * The slots this paper draws from CMEX10 and MSAM10. Both were read off the
 * rendered page: CMEX10 0x50 draws the display summation sign and MSAM10 0x7C
 * the `\top` of a transpose. Only these two slots are asserted, so nothing else
 * in either font is guessed here.
 */
/**
 * The slots this paper draws from CMEX10 and MSAM10, read off the rendered page:
 * 0x00–0x03 are the large delimiters of `\left( … \right)`, 0x50 the display
 * summation sign, and MSAM10 0x7C the `\top` of a transpose. Dropping the
 * delimiters is why `softmax(P_i w)` came back without its parentheses.
 */
const CMEX = { 0x00: "(", 0x01: ")", 0x02: "[", 0x03: "]", 0x50: "\u2211" };
const MSAM = { 0x7c: "\u22a4" };

const SLOTS = { cmsy: CMSY, cmmi: CMMI, cmex: CMEX, msam: MSAM, msbm: {} };

/** Unicode for a TeX math-font slot, or null when the slot is not mapped. */
export function mathSlot(family, code) {
  const table = SLOTS[family];
  return table && table[code] !== undefined ? table[code] : null;
}

/** Unicode → LaTeX. Anything absent is emitted as its own character. */
const LATEX = {
  "\u2212": "-",
  "\u00b7": "\\cdot ",
  "\u00d7": "\\times ",
  "\u00f7": "\\div ",
  "\u00b1": "\\pm ",
  "\u2213": "\\mp ",
  "\u2264": "\\leq ",
  "\u2265": "\\geq ",
  "\u226a": "\\ll ",
  "\u226b": "\\gg ",
  "\u2248": "\\approx ",
  "\u2261": "\\equiv ",
  "\u223c": "\\sim ",
  "\u224d": "\\asymp ",
  "\u221d": "\\propto ",
  "\u2282": "\\subset ",
  "\u2283": "\\supset ",
  "\u2286": "\\subseteq ",
  "\u2287": "\\supseteq ",
  "\u2208": "\\in ",
  "\u2209": "\\notin ",
  "\u2200": "\\forall ",
  "\u2203": "\\exists ",
  "\u2205": "\\emptyset ",
  "\u221e": "\\infty ",
  "\u2211": "\\sum ",
  "\u220f": "\\prod ",
  "\u222a": "\\cup ",
  "\u2229": "\\cap ",
  "\u2227": "\\wedge ",
  "\u2228": "\\vee ",
  "\u2245": "\\cong ",
  "\u2243": "\\simeq ",
  "\u22a5": "\\bot ",
  "\u22a4": "\\top ",
  "\u2192": "\\to ",
  "\u2190": "\\leftarrow ",
  "\u2194": "\\leftrightarrow ",
  "\u21d2": "\\Rightarrow ",
  "\u21d0": "\\Leftarrow ",
  "\u21d4": "\\Leftrightarrow ",
  "\u2202": "\\partial ",
  "\u2207": "\\nabla ",
  "\u211c": "\\Re ",
  "\u2111": "\\Im ",
  "\u2135": "\\aleph ",
  "\u2217": "\\ast ",
  "\u2219": "\\bullet ",
  "\u2218": "\\circ ",
  "\u22ef": "\\cdots ",
  "\u2026": "\\ldots ",
  "\u2032": "\\prime ",
  "\u27e8": "\\langle ",
  "\u27e9": "\\rangle ",
  "{": "\\{",
  "}": "\\}",
  "#": "\\#",
  "%": "\\%",
  "&": "\\&",
  "$": "\\$",
  "_": "\\_",
};

/** CMR words with a LaTeX command of their own. */
const OPERATORS = new Set(["log", "ln", "sin", "cos", "tan", "exp", "max", "min", "lim", "det", "sup", "arg"]);

/**
 * OT1 slots that hold a combining accent rather than a character. TeX draws the
 * accent as its own raised glyph, so `\hat{\mathbf{P}}` arrives as a bold `P`
 * followed by a raised `^`; wrapping the atom before it is what puts the hat
 * back on the letter instead of leaving a stray caret in the formula.
 */
const ACCENTS = {
  "^": "hat",
  "~": "tilde",
  "\u00a8": "ddot",
  "\u00b4": "acute",
  "\u02d8": "breve",
  "\u02c7": "check",
  "\u02d9": "dot",
  "\u02da": "ring",
};

/** Whether a run is a lone accent glyph. */
function accentOf(run) {
  const text = run.text.trim();
  return text.length === 1 && ACCENTS[text] ? ACCENTS[text] : null;
}

/** LaTeX for one decoded glyph. */
function latexGlyph(character) {
  return LATEX[character] ?? character;
}

/**
 * LaTeX for one run's text.
 *
 * A roman (CMR) run of two or more letters is a word: `sim` becomes
 * `\mathrm{sim}`, `log` becomes `\log`. A math-italic run is emitted letter by
 * letter, which is what math mode already renders.
 */
export function latexForText(text, family) {
  if (family === "cmtext" || family === "cmbold" || family === "other") {
    const wrap = family === "cmbold" ? "\\mathbf" : "\\mathrm";
    let out = "";
    let word = "";
    const flush = () => {
      if (!word) return;
      if (OPERATORS.has(word)) out += `\\${word} `;
      else if (word.length > 1 || family === "cmbold") out += `${wrap}{${word}} `;
      else out += word;
      word = "";
    };

    for (const character of text) {
      if (/[A-Za-z]/.test(character)) word += character;
      else {
        flush();
        out += latexGlyph(character);
      }
    }
    flush();
    return out;
  }

  let out = "";
  for (const character of text) out += latexGlyph(character);
  return out;
}

/** Tolerance inside a line, in points: anything smaller is baseline jitter. */
function tolerance(size) {
  return Math.max(0.8, size * 0.12);
}

/** A run is script-sized when it is clearly smaller than the frame it sits in. */
function isScript(run, size) {
  return run.size <= size * 0.92;
}

/**
 * LaTeX for one visual row of runs, baseline first.
 *
 * Scripts are attached to the atom before them and nest: the frame of a
 * superscript is its own baseline, so `e^{sim(q_{i},p^{+}_{i})}` keeps the
 * subscript inside the superscript instead of lifting it to the line.
 * @param {{ x: number, y: number, size: number, text: string, family: string }[]} runs
 * @param {number} baseline the y a run at rest sits on
 * @param {number} size the size of the atom that owns this frame
 */
export function latexSequence(runs, baseline, size) {
  const sorted = [...runs].sort((left, right) => left.x - right.x);
  let out = "";
  let baseStart = 0;
  // One subscript slot and one superscript slot per atom: TeX may draw the
  // subscript after the superscript, so `w_{s+1}^{(i)}` arrives as
  // `s`, `(i`, `+1`, `)` and both scripts have to keep accumulating.
  let slots = { sup: null, sub: null };
  let index = 0;

  const flushSlots = () => {
    if (slots.sub !== null) out += `_{${slots.sub}}`;
    if (slots.sup !== null) out += `^{${slots.sup}}`;
    slots = { sup: null, sub: null };
  };

  while (index < sorted.length) {
    const run = sorted[index];
    const accent = accentOf(run);

    if (accent && out) {
      out = `${out.slice(0, baseStart)}\\${accent}{${out.slice(baseStart)}}`;
      index += 1;
      continue;
    }

    if (isScript(run, size) && Math.abs(run.y - baseline) > tolerance(size)) {
      const role = run.y > baseline ? "sup" : "sub";
      let end = index;
      while (
        end + 1 < sorted.length &&
        isScript(sorted[end + 1], size) &&
        (Math.abs(sorted[end + 1].y - run.y) <= tolerance(run.size) ||
          sorted[end + 1].size <= run.size * 0.92)
      ) {
        end += 1;
      }

      const body = latexSequence(sorted.slice(index, end + 1), run.y, run.size);
      slots[role] = slots[role] === null ? body : slots[role] + body;
      index = end + 1;
      continue;
    }

    flushSlots();
    baseStart = out.length;
    out += latexForText(run.text, run.family);
    index += 1;
  }

  flushSlots();
  return tidy(out);
}

/**
 * The run a row is set on: among the largest runs, the baseline shared by the
 * most of them. `\sum` sits raised above its own line and must not become the
 * frame, or every baseline run would be read as its subscript.
 */
function frameOf(runs) {
  const size = Math.max(...runs.map((run) => run.size));
  const tally = new Map();
  for (const run of runs) {
    if (run.size !== size) continue;
    const key = run.y.toFixed(1);
    const entry = tally.get(key) ?? { y: run.y, count: 0, width: 0 };
    entry.count += 1;
    entry.width += run.width;
    tally.set(key, entry);
  }

  const best = [...tally.values()].sort((left, right) => right.count - left.count || right.width - left.width);
  return { y: best[0]?.y ?? runs[0].y, size };
}

/**
 * Group runs into visual rows, reading order first.
 *
 * The row is seeded by its frame — the baseline shared by most of the largest
 * runs — not by the topmost run, so a raised `\sum` or a superscript cannot pull
 * the next visual line into this one.
 */
function groupRows(runs) {
  const rows = [];
  let remaining = [...runs];

  while (remaining.length) {
    const frame = frameOf(remaining);
    const tolerance = Math.max(2, frame.size * 1.1);
    const inRow = remaining.filter((run) => Math.abs(run.y - frame.y) <= tolerance);
    rows.push({ frame, runs: inRow });
    remaining = remaining.filter((run) => !inRow.includes(run));
  }

  return rows.sort((left, right) => right.frame.y - left.frame.y);
}

/**
 * LaTeX for a block of runs that has no rule: one line per visual row, rows in
 * reading order.
 */
export function latexRows(runs) {
  if (!runs.length) return "";

  return groupRows(runs)
    .map((row) => {
      const frame = frameOf(row.runs);
      return latexSequence(row.runs, frame.y, frame.size);
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whether a run is an equation number such as `(2)`, set outside the math. */
export function isEquationNumber(run) {
  return run.family === "other" && /^\(\d{1,3}\)$/.test(run.text.trim());
}

/** Horizontal centre of a run. */
function centre(run) {
  return run.x + run.width / 2;
}

/**
 * Build one display equation: LaTeX for the block and its printed number.
 *
 * The rule inside a block is the fraction bar. Rows whose centre falls over the
 * rule and within 1.6 em of it are the fraction — above the rule the numerator,
 * below it the denominator. Rows to the left of the rule are the left-hand side
 * and come first, rows to the right continue the formula. A block only joins a
 * wrapped formula when a real rule splits it; otherwise its rows stay in order.
 * @param {{ x: number, y: number, size: number, width: number, text: string, family: string }[]} runs
 * @param {{ x: number, y: number, width: number }[]} rules horizontal rules on the page
 * @returns {{ latex: string, tag: string | null } | null}
 */
export function buildEquation(runs, rules) {
  const tag = runs.find(isEquationNumber)?.text.trim() ?? null;
  const body = runs.filter((run) => !isEquationNumber(run));
  if (!body.length) return null;

  const size = Math.max(...body.map((run) => run.size));
  const top = Math.max(...body.map((run) => run.y));
  const bottom = Math.min(...body.map((run) => run.y));

  const rule = rules
    .filter((entry) => entry.width > size && entry.y <= top + size && entry.y >= bottom - size)
    .sort((left, right) => right.width - left.width)[0];

  if (rule) {
    const band = size * 1.6;
    const left = rule.x;
    const right = rule.x + rule.width;
    const middle = (left + right) / 2;

    const overRule = (run) =>
      Math.abs(run.y - rule.y) <= band && run.x >= left - 2 && run.x <= right - 1;

    const numerator = body.filter((run) => overRule(run) && run.y > rule.y);
    const denominator = body.filter((run) => overRule(run) && run.y < rule.y);
    const rest = body.filter((run) => !overRule(run));

    if (numerator.length && denominator.length) {
      // The left-hand side is everything left of the rule; a run past its right
      // edge is what follows the fraction — the full stop that ends the sentence.
      const prefix = rest.filter((run) => run.x < right - 1);
      const suffix = rest.filter((run) => run.x >= right - 1);

      const latex = tidy(
        [
          latexRows(prefix),
          `\\frac{${latexRows(numerator)}}{${latexRows(denominator)}}`,
          latexRows(suffix),
        ]
          .filter(Boolean)
          .join(" "),
      );

      return { latex, tag };
    }
  }

  return { latex: tidy(latexRows(body)), tag };
}

/** Collapse the whitespace the word builder leaves, and tidy punctuation. */
function tidy(latex) {
  return latex
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:()])/g, "$1")
    .replace(/\s+([_^])/g, "$1")
    .replace(/\s+}/g, "}")
    .replace(/\\cdot \\cdot \\cdot( \\cdot)*/g, "\\cdots")
    .trim();
}
