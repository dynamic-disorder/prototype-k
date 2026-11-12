// Fetch a GitHub PR with its comments, reviews and unresolved review threads as markdown.
// Thin runner: logic is in fetch-pr-lib.mjs (unit tested). Usage: node fetch-pr.mjs <PR_NUMBER|PR_URL|owner/repo#number>
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { run } from './fetch-pr-lib.mjs';

const cacheScript = join(process.env.HOME || homedir(), '.agents', 'scripts', 'cache-ttl-kv.sh');
const bash = (...args) => execFileSync('bash', [cacheScript, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

const deps = {
  ghToken() {
    try {
      return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
    } catch {
      return null;
    }
  },
  async fetchApi(url, token) {
    try {
      const res = await fetch(url, { headers: { Authorization: `token ${token}`, 'User-Agent': 'git-pr-fetch' } });
      return { status: res.status, headers: Object.fromEntries(res.headers), text: await res.text() };
    } catch {
      return { status: 0, headers: {}, text: '' };
    }
  },
  cacheGet: key => bash('get', key).replace(/\n+$/, ''),
  cacheSet: (key, ttl, value) => bash('set', key, String(ttl), value),
  out: s => process.stdout.write(s),
  err: s => process.stderr.write(s),
};

process.exitCode = await run(process.argv.slice(2), deps);
