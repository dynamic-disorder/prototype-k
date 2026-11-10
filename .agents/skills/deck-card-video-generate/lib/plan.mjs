/** Shared limits and validators for video.config.json and segments.json. */

export const MIN_TARGET = 15;
export const MAX_TARGET = 300;
export const DEFAULT_TARGET = 120;
export const SLOT_TOLERANCE = 0.05;

export function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Error message when a length is unusable; null when it is in range.
 * `label` names the source in the message, e.g. `--seconds`.
 */
export function checkTarget(value, label) {
  if (!isNumber(value)) return `${label} must be a number`;
  if (value < MIN_TARGET || value > MAX_TARGET) {
    return `${label} ${value} is outside ${MIN_TARGET}-${MAX_TARGET} s`;
  }
  return null;
}

/**
 * Effective length for a script that has already read the config: `--seconds`
 * beats `config.targetSeconds`, which beats the 120 s default. Throws when the
 * chosen value is out of range.
 */
export function resolveTarget(config, override) {
  if (override !== undefined && override !== null) {
    const message = checkTarget(override, '--seconds');
    if (message) throw new Error(message);
    return { target: override, source: 'flag' };
  }
  if (config?.targetSeconds === undefined) {
    return { target: DEFAULT_TARGET, source: 'default' };
  }
  return { target: targetFromConfig(config.targetSeconds), source: 'config' };
}

/** Validate a `targetSeconds` value from the config, throwing on a bad one. */
function targetFromConfig(value) {
  const message = checkTarget(value, 'video.config.json: targetSeconds');
  if (message) throw new Error(message);
  return value;
}

/**
 * Validate the keys the scripts read.
 * `override` is the `--seconds` value when the command was given one.
 * Returns the usable baseUrl and the effective target + its source, plus every error.
 */
export function validateConfig(config, override) {
  const errors = [];
  let baseUrl = null;
  let target = null;
  let source = 'default';

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { errors: ['video.config.json must be a JSON object'], baseUrl, target, source };
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

  if (override !== undefined) {
    const message = checkTarget(override, '--seconds');
    if (message) {
      errors.push(message);
    } else {
      target = override;
      source = 'flag';
    }
  } else if (config.targetSeconds === undefined) {
    target = DEFAULT_TARGET;
  } else {
    const message = checkTarget(config.targetSeconds, 'video.config.json: targetSeconds');
    if (message) {
      errors.push(message);
    } else {
      target = config.targetSeconds;
      source = 'config';
    }
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

  return { errors, baseUrl, target, source };
}

/**
 * Validate segments.json: names, starts, slots, text, and that the slots add up
 * to the length. `target` may be null when the config length is invalid.
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
    errors.push(`segments.json: slots end at ${expected} s, target is ${target} s`);
  }

  return { errors };
}
