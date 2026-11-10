/** Narration planning: cache decision, slack check, run totals. */

/** Rewrite a take only when forced or either output is missing. */
export function needsSynthesis({ force, hasAudio, hasCaptions }) {
  return Boolean(force) || !hasAudio || !hasCaptions;
}

/**
 * Slack left in a slot, and the warning when it falls under 0.8 s.
 * @returns {{ slack: number, warning: string | null }}
 */
export function speechSlack(segment, speech) {
  const slack = segment.slot - speech;
  if (slack >= 0.8) return { slack, warning: null };
  return {
    slack,
    warning:
      `WARNING ${segment.name}: speech ${speech.toFixed(2)}s, slack ${slack.toFixed(2)}s — ` +
      "shorten the text or widen the slot",
  };
}

/** End of the last spoken take, in seconds. */
export function lastSpeechEnd(meta) {
  return meta.reduce((end, segment) => Math.max(end, segment.start + segment.duration), 0);
}

/** Total speech time across takes. */
export function speechTotal(meta) {
  return meta.reduce((total, segment) => total + segment.duration, 0);
}

/** The message when speech runs past the target, or null when it fits. */
export function overrunMessage(last, target) {
  if (last <= target) return null;
  return `last speech ends at ${last.toFixed(2)}s, past the ${target} s target — re-plan the slots`;
}
