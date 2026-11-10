import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { parseTargetSeconds, recordDemo } from '../scripts/record.mjs';

const BASE_CONFIG = {
  baseUrl: 'about:blank',
  viewport: { width: 640, height: 360 },
  settleMs: 0,
};

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'record-'));
}

/** A fake Playwright: an in-memory clock and a page that "waits" instantly. */
function fakeBrowser({ driftMs = 0, gotoError = null } = {}) {
  const state = { clock: 1_000_000, waits: [], closed: { context: 0, browser: 0 } };
  const now = () => state.clock;

  const page = {
    async goto() {
      if (gotoError) throw gotoError;
    },
    async evaluate() {},
    async waitForTimeout(ms) {
      state.waits.push(ms);
      state.clock += ms + driftMs;
    },
    video() {
      return { path: async () => state.videoPath };
    },
  };

  const context = {
    async newPage() {
      return page;
    },
    async close() {
      state.closed.context += 1;
    },
  };

  const browser = {
    async newContext(options) {
      state.contextOptions = options;
      return context;
    },
    async close() {
      state.closed.browser += 1;
    },
  };

  return { module: { async launch() { return browser; } }, state, now };
}

function fakeVideoFile(root) {
  const file = path.join(root, 'capture.webm');
  fs.writeFileSync(file, 'webm-bytes');
  return file;
}

test('length: --seconds wins over config, which wins over the 120 s default', () => {
  assert.equal(parseTargetSeconds([], {}), 120);
  assert.equal(parseTargetSeconds([], { targetSeconds: 30 }), 30);
  assert.equal(parseTargetSeconds(['--seconds', '45'], { targetSeconds: 30 }), 45);
});

test('length outside 15-300 s is refused with the offending value', () => {
  assert.throws(() => parseTargetSeconds(['--seconds', '5'], {}), /15-300 s, got 5/);
  assert.throws(() => parseTargetSeconds([], { targetSeconds: 400 }), /15-300 s, got 400/);
  assert.throws(() => parseTargetSeconds(['--seconds', 'abc'], {}), /15-300 s, got abc/);
});

test('beats are scheduled at absolute seconds and the end is held', async () => {
  const root = tempDir();
  const fake = fakeBrowser();
  fake.state.videoPath = fakeVideoFile(root);
  const logs = [];

  const result = await recordDemo({
    config: BASE_CONFIG,
    targetSeconds: 3,
    outDir: root,
    chromiumModule: fake.module,
    now: fake.now,
    log: (line) => logs.push(line),
    script: async ({ at }) => {
      await at(0.5, 'first', async () => {});
      await at(1.5, 'second', async () => {});
    },
  });

  assert.equal(result.timing.length, 3, 'two beats plus the hold');
  assert.deepEqual(
    result.timing.map((entry) => entry.label),
    ['first', 'second', 'hold end'],
  );
  assert.deepEqual(
    result.timing.map((entry) => entry.scheduled),
    [0.5, 1.5, 3],
  );
  assert.deepEqual(
    result.timing.map((entry) => entry.actual),
    [0.5, 1.5, 3],
  );
  assert.ok(logs.some((line) => /t0 offset/.test(line)));
});

test('the take is copied to raw.webm and timing.json records it', async () => {
  const root = tempDir();
  const fake = fakeBrowser();
  fake.state.videoPath = fakeVideoFile(root);

  const result = await recordDemo({
    config: BASE_CONFIG,
    targetSeconds: 3,
    outDir: root,
    chromiumModule: fake.module,
    now: fake.now,
    log: () => {},
  });

  assert.equal(fs.readFileSync(path.join(root, 'raw.webm'), 'utf8'), 'webm-bytes');
  const timing = JSON.parse(fs.readFileSync(path.join(root, 'timing.json'), 'utf8'));
  assert.equal(timing.targetSeconds, 3);
  assert.equal(typeof timing.t0Offset, 'number');
  assert.equal(timing.timing.length, result.timing.length);
});

test('latency past the absolute mark is reported as drift', async () => {
  const root = tempDir();
  const fake = fakeBrowser({ driftMs: 80 });
  fake.state.videoPath = fakeVideoFile(root);
  const warnings = [];

  await recordDemo({
    config: BASE_CONFIG,
    targetSeconds: 3,
    outDir: root,
    chromiumModule: fake.module,
    now: fake.now,
    log: () => {},
    warn: (line) => warnings.push(line),
    script: async ({ at }) => {
      await at(0.5, 'late', async () => {});
    },
  });

  assert.ok(warnings.some((line) => /drift late/.test(line)), warnings.join('\n'));
  assert.ok(warnings.some((line) => /actual 0\.580/.test(line)), warnings.join('\n'));
});

test('a recording without a video stream fails loudly', async () => {
  const root = tempDir();
  const fake = fakeBrowser();
  fake.state.videoPath = fakeVideoFile(root);

  // Rebuild the module so page.video() returns null.
  const broken = {
    async launch() {
      return {
        async newContext() {
          return {
            async newPage() {
              return {
                async goto() {},
                async evaluate() {},
                async waitForTimeout() {},
                video() {
                  return null;
                },
              };
            },
            async close() {},
          };
        },
        async close() {},
      };
    },
  };

  await assert.rejects(
    () =>
      recordDemo({
        config: BASE_CONFIG,
        targetSeconds: 3,
        outDir: root,
        chromiumModule: broken,
        now: fake.now,
        log: () => {},
        warn: () => {},
      }),
    /no video stream/,
  );
});

test('a real headless take records a video and timing', async (t) => {
  let launched;
  try {
    launched = await chromium.launch();
  } catch {
    t.skip('chromium is not installed');
    return;
  }
  await launched.close();

  const root = tempDir();
  const result = await recordDemo({
    config: { ...BASE_CONFIG, baseUrl: 'data:text/html,<h1>record</h1>' },
    targetSeconds: 2,
    outDir: root,
    log: () => {},
    script: async ({ at, page, pause }) => {
      await at(0.2, 'title', async () => {
        await page.evaluate(() => document.title);
        await pause(50);
      });
    },
  });

  assert.ok(fs.existsSync(result.videoPath), 'raw.webm exists');
  assert.ok(fs.statSync(result.videoPath).size > 0, 'raw.webm holds bytes');
  assert.equal(result.timing.at(-1).label, 'hold end');
});

test('a navigation timeout fails the take and still closes the browser', async () => {
  const root = tempDir();
  const timeout = Object.assign(new Error('page.goto: Timeout 30000ms exceeded.'), {
    name: 'TimeoutError',
  });
  const fake = fakeBrowser({ gotoError: timeout });

  await assert.rejects(
    () =>
      recordDemo({
        config: BASE_CONFIG,
        targetSeconds: 3,
        outDir: root,
        chromiumModule: fake.module,
        now: fake.now,
        log: () => {},
        warn: () => {},
      }),
    /Timeout 30000ms exceeded/,
  );

  assert.deepEqual(fake.state.closed, { context: 1, browser: 1 }, 'context and browser closed');
  assert.equal(fs.existsSync(path.join(root, 'timing.json')), false, 'no timing for a failed take');
  assert.equal(fs.existsSync(path.join(root, 'raw.webm')), false, 'no video for a failed take');
});

test('a throwing beat fails the take and still closes the browser', async () => {
  const root = tempDir();
  const fake = fakeBrowser();
  fake.state.videoPath = fakeVideoFile(root);

  await assert.rejects(
    () =>
      recordDemo({
        config: BASE_CONFIG,
        targetSeconds: 3,
        outDir: root,
        chromiumModule: fake.module,
        now: fake.now,
        log: () => {},
        warn: () => {},
        script: async ({ at }) => {
          await at(0.5, 'first', async () => {});
          throw new Error('beat exploded');
        },
      }),
    /beat exploded/,
  );

  assert.deepEqual(fake.state.closed, { context: 1, browser: 1 }, 'context and browser closed');
  assert.equal(fs.existsSync(path.join(root, 'timing.json')), false, 'no timing for a failed take');
  assert.equal(fs.existsSync(path.join(root, 'raw.webm')), false, 'no video for a failed take');
});
