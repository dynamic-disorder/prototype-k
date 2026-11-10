#!/usr/bin/env node
/** Preflight: stop before recording when an input is not real. */
import fs from 'node:fs';
import path from 'node:path';
import { takeSeconds } from '../lib/args.mjs';
import { countBeats } from '../lib/beats.mjs';
import { isNumber, validateConfig, validateSegments } from '../lib/plan.mjs';

const parsed = takeSeconds(process.argv.slice(2));
if (parsed.error) {
  console.error(parsed.error);
  process.exit(1);
}

const taskDir = path.resolve(parsed.rest[0] ?? '.');
const errors = [];

function readJson(name) {
  const file = path.join(taskDir, name);
  if (!fs.existsSync(file)) {
    errors.push(`${name} is missing`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${name} is not valid JSON: ${error.message}`);
    return null;
  }
}

async function checkReachable(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    console.log(`baseUrl ${url} answered HTTP ${response.status}`);
  } catch (error) {
    const reason = error?.cause?.code ?? error?.message ?? String(error);
    errors.push(`baseUrl ${url} did not answer: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

const config = readJson('video.config.json');
const segments = readJson('segments.json');

let baseUrl = null;
let target = null;
let source = 'default';
if (config !== null) {
  const result = validateConfig(config, parsed.seconds);
  errors.push(...result.errors);
  baseUrl = result.baseUrl;
  target = result.target;
  source = result.source;
  if (parsed.seconds !== undefined && isNumber(config.targetSeconds) && config.targetSeconds !== parsed.seconds) {
    console.warn(
      `--seconds ${parsed.seconds} overrides video.config.json targetSeconds ${config.targetSeconds}`,
    );
  }
}

if (segments !== null) {
  errors.push(...validateSegments(segments, target).errors);
}

let beats = 0;
const recordFile = path.join(taskDir, 'record.mjs');
if (!fs.existsSync(recordFile)) {
  errors.push('record.mjs is missing');
} else {
  const counted = countBeats(fs.readFileSync(recordFile, 'utf8'));
  beats = counted.count;
  if (!counted.found) {
    errors.push('record.mjs: BEATS markers not found');
  } else if (beats === 0) {
    errors.push('record.mjs: no active beat between the BEATS markers (the template beats are comments)');
  }
}

if (baseUrl) await checkReachable(baseUrl);

if (errors.length > 0) {
  for (const message of errors) console.error(`ERROR: ${message}`);
  console.error(`input guard failed: ${errors.length} problem(s); fix them and rerun`);
  process.exit(1);
}

const label = source === 'default' ? 'default' : source === 'flag' ? '--seconds' : 'config';
console.log(
  `input ok: ${baseUrl}, target ${target} s (${label}), ${beats} beat(s), ${segments.length} segment(s)`,
);
