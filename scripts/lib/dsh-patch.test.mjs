/**
 * Tests for the patch-subset parser and the entry merge.
 *
 * The parser exists because this repository has no YAML package and the patch file is rewritten by
 * the desktop app; a bug here edits a live profile. Every case below is one that was seen or is
 * one edit away from being seen in the real file.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deepEqual, formatYaml, mergePatch, parseYaml, splitPatch } from './dsh-patch.mjs';

const SAMPLE = `# header comment
# second line

- id: ui-theme
  name: "@deepseek-ai/dsh-client-ui-theme"
  config:
    preference: dark
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      ollama:
        api: openai-completions
        baseURL: http://127.0.0.1:11434/v1
        models:
          - id: qwen3.8:27b
            name: qwen3.8:27b
          - id: gemma4:12b
            name: gemma4:12b
`;

test('parses entries, nested maps and a sequence of maps', () => {
  const document = parseYaml(SAMPLE);
  assert.equal(document.length, 2);
  assert.equal(document[0].config.preference, 'dark');
  const ollama = document[1].config.providers.ollama;
  assert.equal(ollama.baseURL, 'http://127.0.0.1:11434/v1');
  assert.equal(ollama.models.length, 2);
  assert.equal(ollama.models[0].id, 'qwen3.8:27b');
});

test('keeps a scalar type map for booleans, numbers and nulls', () => {
  const document = parseYaml('a: true\nb: 120000\nc: 0.5\nd: null\ne: 2026-08-13.1\n');
  assert.deepEqual(document, { a: true, b: 120000, c: 0.5, d: null, e: '2026-08-13.1' });
});

test('formatted output parses back to the same value', () => {
  const value = [
    { id: 'vision-toolkit', config: { provider: { model: 'qwen3.5:9b', credential: 'OLLAMA_LOCAL_KEY' }, timeoutMs: 120000 } },
    { id: 'agent-default-model', name: '@deepseek-ai/dsh-agent-default-model', config: { reasoningEffort: 'high' } },
  ];
  assert.ok(deepEqual(parseYaml(formatYaml(value)), value));
});

test('leaves a colon-bearing model id plain, and quotes what YAML would misread', () => {
  const text = formatYaml([
    { id: 'x', config: { model: 'qwen3.8:27b', url: 'http://127.0.0.1:11434/v1', pkg: '@deepseek-ai/dsh', note: 'a: b' } },
  ]);
  assert.match(text, /model: qwen3\.8:27b/);
  assert.match(text, /url: http:\/\/127\.0\.0\.1:11434\/v1/);
  assert.match(text, /pkg: "@deepseek-ai\/dsh"/);
  assert.match(text, /note: "a: b"/);
  const back = parseYaml(text)[0].config;
  assert.equal(back.model, 'qwen3.8:27b');
  assert.equal(back.note, 'a: b');
});

test('splits entries and reads each id', () => {
  const { preamble, blocks } = splitPatch(SAMPLE);
  assert.deepEqual(preamble.slice(0, 3), ['# header comment', '# second line', '']);
  assert.deepEqual(blocks.map((block) => block.id), ['ui-theme', 'llm-pi-ai']);
  assert.equal(Array.isArray(blocks[0].entry), false, 'a block entry is one object, not a sequence');
  assert.equal(blocks[1].entry.config.providers.ollama.models.length, 2);
});

test('merge replaces only the named entry and keeps the rest byte-identical', () => {
  const merged = mergePatch(SAMPLE, [
    { id: 'llm-pi-ai', name: '@deepseek-ai/dsh-llm-pi-ai', config: { providers: { ollama: { api: 'openai-completions' } } } },
  ]);
  const before = splitPatch(SAMPLE);
  const after = splitPatch(merged);
  assert.deepEqual(after.blocks[0].lines, before.blocks[0].lines, 'the unmanaged entry must not move');
  assert.ok(merged.startsWith('# header comment\n# second line\n'), 'the preamble must survive');
  assert.equal(after.blocks[1].id, 'llm-pi-ai');
  assert.equal(after.blocks[1].entry.config.providers.ollama.baseURL, undefined);
});

test('merge appends an entry that is absent', () => {
  const merged = mergePatch(SAMPLE, [{ id: 'agent-default-model', config: { model: 'deepseek-flash' } }]);
  assert.deepEqual(splitPatch(merged).blocks.map((block) => block.id), ['ui-theme', 'llm-pi-ai', 'agent-default-model']);
});

test('a comment above an entry survives a rewrite of that entry', () => {
  const text = '- id: a\n  config:\n    x: 1\n# why this exists\n- id: b\n  config:\n    y: 2\n';
  const merged = mergePatch(text, [{ id: 'b', config: { y: 3 } }]);
  assert.match(merged, /# why this exists/);
  assert.match(merged, /y: 3/);
});

test('merge leaves the document ending in exactly one newline', () => {
  const merged = mergePatch(`${SAMPLE}\n\n`, [{ id: 'llm-pi-ai', config: {} }]);
  assert.ok(merged.endsWith('\n'));
  assert.ok(!merged.endsWith('\n\n'));
});

test('refuses tab indentation instead of guessing', () => {
  assert.throws(() => parseYaml('- id: a\n\tconfig: {}\n'), /tab indentation/);
});

test('refuses an explicit tag such as !!js', () => {
  assert.throws(() => parseYaml('a: !!js this.ctx\n'), /explicit YAML tags/);
});

test('deepEqual separates a null from a missing key', () => {
  assert.equal(deepEqual({ a: null }, { a: null }), true);
  assert.equal(deepEqual({ a: null }, {}), false);
  assert.equal(deepEqual([1, 2], [1, 2, 3]), false);
});
