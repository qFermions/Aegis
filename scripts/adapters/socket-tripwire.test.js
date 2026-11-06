'use strict';
// socket-tripwire.test.js: a stale temporary folder does not crash the tripwire (batch 7, task 7).
//
// EXPECTED DECISION (written before the fix)
// - With TMPDIR, TMP and TEMP naming a folder that does not exist, requiring the tripwire still works: its
//   audit folder falls back to the system temporary folder, and the tripwire is still armed.
// - An AEGIS_AUDIT_DIR already set is left alone.
// A wrong implementation this catches: a catch that leaves the audit folder unset, so a CLI run in a test
// would write the operator's real trail; the child checks the folder exists and is outside the stale path.
// Run: node --test scripts/adapters/socket-tripwire.test.js

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { test } = require('node:test');

const TRIPWIRE = path.join(__dirname, 'socket-tripwire.js');
const DESK = path.join(__dirname, '..', 'demo', 'customer-desk.js');
const STALE = path.join(path.parse(process.cwd()).root, 'aegis-no-such-folder', 'x');

function childEnv(extra = {}) {
  const env = { ...process.env, TMPDIR: STALE, TMP: STALE, TEMP: STALE };
  delete env.AEGIS_AUDIT_DIR;
  delete env.NODE_OPTIONS;
  return { ...env, ...extra };
}

const CHILD = `
  const fs = require('node:fs');
  require(${JSON.stringify(TRIPWIRE)});
  const dir = process.env.AEGIS_AUDIT_DIR;
  let tripped = false;
  try { require('node:net').connect(1, '127.0.0.1'); } catch { tripped = true; }
  console.log(JSON.stringify({ dir, exists: Boolean(dir) && fs.existsSync(dir), tripped, armed: process.env.AEGIS_NETWORK_TRIPWIRE }));
`;

test('a stale temporary folder falls back to the system one, with the tripwire still armed', () => {
  const r = spawnSync(process.execPath, ['-e', CHILD], { encoding: 'utf8', env: childEnv() });
  assert.equal(r.status, 0, r.stderr);
  const seen = JSON.parse(r.stdout);
  assert.equal(seen.exists, true, 'the audit folder was made');
  assert.ok(!seen.dir.startsWith(STALE), 'not under the stale folder');
  assert.equal(seen.tripped, true);
  assert.equal(seen.armed, '1');
});

test('an audit folder already set is left alone', () => {
  const r = spawnSync(process.execPath, ['-e', CHILD], { encoding: 'utf8', env: childEnv({ AEGIS_AUDIT_DIR: 'already-set' }) });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).dir, 'already-set');
});

test('the desk\'s dry run works under a stale temporary folder', () => {
  const r = spawnSync(process.execPath, [DESK, '--only', 'T7'], { encoding: 'utf8', env: childEnv() });
  assert.equal(r.status, 4, r.stderr);
  assert.match(r.stdout, /DRY RUN/);
});
