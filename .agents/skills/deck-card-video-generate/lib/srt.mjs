/** SRT helpers for the sentence-boundary metadata from msedge-tts. */

export const TICKS_PER_SECOND = 10_000_000;

export function ticksToSeconds(ticks) {
  return ticks / TICKS_PER_SECOND;
}

export function srtTimestamp(seconds) {
  const totalMs = Math.round(Math.max(0, seconds) * 1000);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (value, width = 2) => String(value).padStart(width, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/** Return cues (relative to the segment start) from an msedge-tts metadata document. */
export function cuesFromMetadata(metadata) {
  const items = Array.isArray(metadata?.Metadata) ? metadata.Metadata : [];
  return items
    .filter((item) => item.Type === 'SentenceBoundary' || item.Type === 'WordBoundary')
    .map((item) => ({
      start: ticksToSeconds(item.Data.Offset),
      end: ticksToSeconds(item.Data.Offset + item.Data.Duration),
      text: item.Data.text.Text,
    }));
}

/** Build an SRT document from an msedge-tts metadata document. */
export function srtFromMetadata(metadata) {
  return cuesFromMetadata(metadata)
    .map((cue, index) => `${index + 1}\n${srtTimestamp(cue.start)} --> ${srtTimestamp(cue.end)}\n${cue.text}\n`)
    .join('\n');
}
