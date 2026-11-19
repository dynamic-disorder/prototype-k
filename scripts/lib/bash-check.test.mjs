/**
 * Unit tests for bash-check.mjs: the git-installation mapping, the WSL-launcher test, PATH order, and
 * the three Windows outcomes. Every case builds its own directories, so it says nothing about the
 * machine it runs on.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkBash, firstOnPath, gitBashFromExecPath, isWindowsLauncher } from './bash-check.mjs';

function scratch(t, prefix = 'bash-check-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('the git exec path maps to that installation bin directory', () => {
  // Given a Windows git installation layout
  const execPath = path.join('C:', 'Program Files', 'Git', 'mingw64', 'libexec', 'git-core');
  // When the bash of that installation is derived
  const bash = gitBashFromExecPath(execPath);
  // Then it sits in <root>/bin, never inside libexec
  assert.equal(path.basename(bash), 'bash.exe');
  assert.equal(path.dirname(path.dirname(bash)), path.join('C:', 'Program Files', 'Git'));
  assert.ok(!bash.includes('libexec'));
});

test('the WSL launcher is recognised by the directories it lives in', () => {
  // Given the Windows directory and three bash paths
  const root = path.join('C:', 'Windows');
  const system32 = path.join(root, 'System32', 'bash.exe');
  const storeAlias = path.join(
    'C:',
    'Users',
    'someone',
    'AppData',
    'Local',
    'Microsoft',
    'WindowsApps',
    'bash.exe',
  );
  const gitBash = path.join('C:', 'Program Files', 'Git', 'bin', 'bash.exe');
  // When each path is classified
  // Then only the launcher directories answer true
  assert.equal(isWindowsLauncher(system32, root), true);
  assert.equal(isWindowsLauncher(storeAlias, root), true);
  assert.equal(isWindowsLauncher(gitBash, root), false);
});

test('the first directory on PATH that holds the name wins', (t) => {
  // Given two directories, only the second holding the file
  const first = scratch(t);
  const second = scratch(t);
  fs.writeFileSync(path.join(second, 'bash.exe'), '');
  // When the PATH is searched in order
  const found = firstOnPath(['bash.exe'], [first, second].join(path.delimiter));
  // Then the later directory is reported
  assert.equal(found, path.join(second, 'bash.exe'));
});

test('a real bash.exe on PATH passes the Windows check', (t) => {
  // Given a directory holding a bash that is not the launcher
  const dir = scratch(t);
  fs.writeFileSync(path.join(dir, 'bash.exe'), '');
  // When the Windows check runs over it
  const state = checkBash({ platform: 'win32', searchPath: dir, systemRoot: path.join('C:', 'Windows') });
  // Then it passes and names the file
  assert.equal(state.status, 'ok');
  assert.equal(state.found, path.join(dir, 'bash.exe'));
});

test('a bash.exe under the Windows directory fails the Windows check', (t) => {
  // Given a System32 holding a bash.exe
  const root = scratch(t);
  const system32 = path.join(root, 'Windows', 'System32');
  fs.mkdirSync(system32, { recursive: true });
  fs.writeFileSync(path.join(system32, 'bash.exe'), '');
  // When the Windows check runs
  const state = checkBash({ platform: 'win32', searchPath: system32, systemRoot: path.join(root, 'Windows') });
  // Then it reports the launcher rather than a pass
  assert.equal(state.status, 'wsl');
});

test('an empty PATH reports bash as missing', () => {
  // Given no PATH at all
  // When the Windows check runs
  const state = checkBash({ platform: 'win32', searchPath: '', systemRoot: path.join('C:', 'Windows') });
  // Then it says so instead of guessing
  assert.equal(state.status, 'missing');
  assert.equal(state.found, '');
});
