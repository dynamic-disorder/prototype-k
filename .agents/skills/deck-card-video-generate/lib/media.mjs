/** ffmpeg filter graphs and ffprobe parsing. */

/** Build the filter_complex that mixes each narration take at its absolute start. */
export function buildNarrationFilter(meta, target) {
  const chains = meta.map((seg, index) => {
    const delay = Math.round(seg.start * 1000);
    return `[${index}:a]aresample=48000,adelay=${delay}:all=1[a${index}]`;
  });
  const mix = meta.map((_, index) => `[a${index}]`).join('');
  const whole = Math.trunc(target);
  return (
    `${chains.join(';')};` +
    `${mix}amix=inputs=${meta.length}:duration=longest:normalize=0,` +
    'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,' +
    `apad=whole_dur=${whole},atrim=0:${whole}[a]`
  );
}

/** Build the video filter that burns the ASS captions over the trimmed capture. */
export function buildEncodeFilter({ fps, width, height }) {
  return `[0:v]fps=${fps},scale=${width}:${height},ass=captions.ass[v]`;
}

/** Extract the duration from ffprobe's default output; null when absent. */
export function parseFfprobeDuration(text) {
  const match = String(text).match(/duration=([\d.]+)/);
  return match ? Number(match[1]) : null;
}
