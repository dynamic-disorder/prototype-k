/** Shared limits and validators for video.config.json and segments.json. */

export const MIN_TARGET = 15;
export const MAX_TARGET = 300;
export const SLOT_TOLERANCE = 0.05;

export function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validate the keys the scripts read.
 * Returns the parsed baseUrl and target when they are usable, plus every error.
 */
export function validateConfig(config) {
  const errors = [];
  let baseUrl = null;
  let target = null;

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { errors: ['video.config.json must be a JSON object'], baseUrl, target };
  }

  if (typeof config.baseUrl !== 'string' || !config.baseUrl.trim()) {
    errors.push('video.config.json: baseUrl is missing or empty');
  } else {
    try {
      const parsed = new URL(config.baseUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('scheme');
      baseUrl = config.baseUrl;
    } catch {
      errors.push(`video.config.json: baseUrl is not an http(s) URL: ${config.baseUrl}`);
    }
  }

  if (!isNumber(config.targetSeconds)) {
    errors.push('video.config.json: targetSeconds is missing or not a number');
  } else if (config.targetSeconds < MIN_TARGET || config.targetSeconds > MAX_TARGET) {
    errors.push(
      `video.config.json: targetSeconds ${config.targetSeconds} is outside ${MIN_TARGET}-${MAX_TARGET} s`,
    );
  } else {
    target = config.targetSeconds;
  }

  if (typeof config.outDir !== 'string' || !config.outDir.trim()) {
    errors.push('video.config.json: outDir is missing or empty');
  }

  if (!config.viewport || typeof config.viewport !== 'object' || Array.isArray(config.viewport)) {
    errors.push('video.config.json: viewport is missing');
  } else {
    for (const key of ['width', 'height']) {
      const value = config.viewport[key];
      if (!isNumber(value) || value <= 0) {
        errors.push(`video.config.json: viewport.${key} must be a positive number`);
      }
    }
  }

  if (!isNumber(config.fps) || config.fps <= 0) {
    errors.push('video.config.json: fps must be a positive number');
  }

  for (const key of ['voice', 'rate', 'pitch', 'preset', 'audioBitrate']) {
    if (typeof config[key] !== 'string' || !config[key].trim()) {
      errors.push(`video.config.json: ${key} is missing or empty`);
    }
  }

  if (!isNumber(config.crf)) {
    errors.push('video.config.json: crf must be a number');
  }

  return { errors, baseUrl, target };
}

/**
 * Validate segments.json: names, starts, slots, text, and that the slots add up
 * to targetSeconds. `target` may be null when the config target is invalid.
 */
export function validateSegments(segments, target) {
  const errors = [];
  if (!Array.isArray(segments)) {
    return { errors: ['segments.json must be a JSON array'] };
  }
  if (segments.length === 0) {
    return { errors: ['segments.json is empty; the narration needs at least one segment'] };
  }

  let expected = 0;
  const names = new Set();

  segments.forEach((seg, index) => {
    const where = `segments.json[${index + 1}]`;
    if (!seg || typeof seg !== 'object' || Array.isArray(seg)) {
      errors.push(`${where} must be an object`);
      return;
    }

    if (typeof seg.name !== 'string' || !seg.name.trim()) {
      errors.push(`${where}: name is missing or empty`);
    } else if (names.has(seg.name)) {
      errors.push(`${where}: name ${JSON.stringify(seg.name)} is duplicated`);
    } else {
      names.add(seg.name);
    }

    let start = seg.start;
    let slot = seg.slot;
    if (!isNumber(start) || start < 0) {
      errors.push(`${where}: start must be a non-negative number`);
      start = null;
    }
    if (!isNumber(slot) || slot <= 0) {
      errors.push(`${where}: slot must be a positive number`);
      slot = null;
    }
    if (typeof seg.text !== 'string' || !seg.text.trim()) {
      errors.push(`${where}: text is missing or empty`);
    }

    if (start !== null) {
      if (Math.abs(start - expected) > SLOT_TOLERANCE) {
        errors.push(`${where}: start ${start} does not follow the previous slots (${expected})`);
      }
      expected = start;
    }
    if (slot !== null) expected += slot;
  });

  if (isNumber(target) && Math.abs(expected - target) > SLOT_TOLERANCE) {
    errors.push(`segments.json: slots end at ${expected} s, targetSeconds is ${target} s`);
  }

  return { errors };
}
