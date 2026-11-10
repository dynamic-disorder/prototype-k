/** SRT parsing, caption wrapping, and ASS subtitle generation. */

export function stampToSeconds(stamp) {
  const [h, m, rest] = stamp.split(':');
  const [s, ms] = rest.split(',');
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

/** Parse SRT cues from text. */
export function parseSrt(text) {
  const cues = [];
  const pattern =
    /\d+\s*\n(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})\s*\n([\s\S]*?)(?=\n\s*\n|$)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    cues.push({
      start: stampToSeconds(match[1]),
      end: stampToSeconds(match[2]),
      text: match[3].trim(),
    });
  }
  return cues;
}

/** ASS timestamp: H:MM:SS.cc */
export function assTime(value) {
  const safe = Math.max(0, value);
  let h = Math.floor(safe / 3600);
  let m = Math.floor((safe % 3600) / 60);
  let s = Math.floor(safe % 60);
  let cs = Math.round((safe - Math.floor(safe)) * 100);
  if (cs === 100) {
    s += 1;
    cs = 0;
  }
  const pad = (number) => String(number).padStart(2, '0');
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
}

/** Wrap caption text to maxChars; ASS uses \N for a hard line break. */
export function wrapText(text, width = 76) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line.length + word.length + 1 <= width) {
      line = `${line} ${word}`.trim();
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.join('\\N');
}

/**
 * Collect caption cues from per-segment SRT files, offset by each segment's
 * absolute start, clamped to the target, and de-overlapped.
 */
export function buildCues(meta, srtBySegment, target) {
  const cues = [];
  for (const seg of meta) {
    const srt = srtBySegment[seg.name];
    if (typeof srt !== 'string') {
      throw new Error(`missing narration for ${seg.name} — run narrate first`);
    }
    for (const cue of parseSrt(srt)) {
      cues.push({
        start: cue.start + seg.start,
        end: Math.min(cue.end + seg.start, target),
        text: cue.text,
      });
    }
  }
  cues.sort((a, b) => a.start - b.start);
  for (let i = 1; i < cues.length; i += 1) {
    if (cues[i].start < cues[i - 1].end) {
      cues[i].start = cues[i - 1].end + 0.02;
    }
  }
  return cues;
}

/** Build the ASS document for the given cues. */
export function buildAss({ cues, width, height, captions = {} }) {
  const font = captions.font ?? 'Segoe UI';
  const size = Math.trunc(captions.size ?? 34);
  const maxChars = Math.trunc(captions.maxChars ?? 76);
  const marginV = Math.max(24, Math.round(height * 0.033));

  const lines = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, ' +
      'Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, ' +
      'Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Caption,${font},${size},&H00FFFFFF,&H000000FF,&H66000000,&H66000000,-1,0,0,0,100,100,0,0,` +
      `3,11,0,2,100,100,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  for (const cue of cues) {
    let end = cue.end;
    if (end <= cue.start) end = cue.start + 1.0;
    const text = wrapText(cue.text, maxChars);
    lines.push(
      `Dialogue: 0,${assTime(cue.start)},${assTime(end)},Caption,,0,0,0,,{\\fad(120,120)}${text}`,
    );
  }

  return `${lines.join('\n')}\n`;
}
