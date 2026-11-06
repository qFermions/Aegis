'use strict';
// account-name.test.js: no tracked file holds the local account name (batch 7, task 1).
//
// EXPECTED DECISION (written before the fix)
// - The name is read at run time and never written anywhere: not into a file, not into a failure
//   message, which names only the files that hold it.
// - A name of 4 characters or fewer, or a generic CI account, is skipped: it would match ordinary words.
// A wrong implementation this catches: a capture saved with a local path or account name, in any
// folder, in any case, in any form (a reviewer's quoted command, an encoded folder name).
// Run: node --test scripts/account-name.test.js

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const GENERIC = new Set(['runner', 'root', 'user', 'ubuntu', 'admin', 'vscode']);

function accountToCheck(name) {
  const lower = String(name || '').toLowerCase();
  return lower.length <= 4 || GENERIC.has(lower) ? null : lower;
}

// Paths of tracked files holding the text, in any case. git grep exits 1 when it finds nothing.
function trackedFilesHolding(text) {
  const r = spawnSync('git', ['grep', '-il', '--fixed-strings', '-e', text], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  assert.ok(r.status === 0 || r.status === 1, `git grep failed with status ${r.status}`);
  return r.stdout.split('\n').filter(Boolean);
}

test('the skip rule: short names and generic CI accounts are skipped, any other name is lower-cased', () => {
  for (const skipped of ['runner', 'ROOT', 'user', 'ubuntu', 'admin', 'vscode', 'abcd', 'a', '', null, undefined]) assert.equal(accountToCheck(skipped), null, String(skipped));
  assert.equal(accountToCheck('SomeOwner'), 'someowner');
  assert.equal(accountToCheck('abcde'), 'abcde');
});

test('the search finds a tracked file in any case, and finds nothing for text no file holds', () => {
  assert.ok(trackedFilesHolding('ADVISES; humans EXECUTE').length > 0, 'a phrase the repository holds, in another case');
  assert.deepEqual(trackedFilesHolding(['no', 'tracked', 'file', 'holds', 'this', String(7 * 919)].join('-z-')), []);
});

test('no tracked file holds the local account name', (t) => {
  const name = accountToCheck(os.userInfo().username);
  if (!name) { t.skip('this account name is short or generic'); return; }
  assert.deepEqual(trackedFilesHolding(name), [], 'these tracked files hold the local account name');
});
