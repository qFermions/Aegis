'use strict';
// temp-dir.test.js: one shared temporary-folder helper that survives a stale TMPDIR (batch 8, task 10c).
//
// EXPECTED DECISION (written before the helper)
// - scripts/temp-dir.js exports makeTempDir(prefix). With TMPDIR, TMP and TEMP naming a folder that does
//   not exist, it still returns a new folder that exists and is not under the stale path: it falls back to
//   the system temporary folder (%SystemRoot%\Temp on Windows, /tmp elsewhere), as socket-tripwire.js did
//   on its own, and throws when both fail. It loads Node builtins only, since the tripwire is loaded with
//   --require before anything else.
// - The four places that made a temporary folder from os.tmpdir() call it: socket-tripwire.js,
//   replay-demo.js, judge.js and trail-helper.js. Three are run under a stale TMPDIR here; the tripwire's
//   own stale-TMPDIR test is socket-tripwire.test.js, so here its source is checked to use the helper.
// Wrong implementation it catches: a helper whose catch returns the path it meant to make without making
// it (the folder does not exist), or a caller left on fs.mkdtempSync(os.tmpdir()), which throws ENOENT
// under a stale TMPDIR (replay-demo exits 1, the judge run throws).
// Run: node --test scripts/temp-dir.test.js

require('./adapters/socket-tripwire.js');

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const HELPER = path.join(__dirname, 'temp-dir.js');
const STALE = path.join(path.parse(process.cwd()).root, 'aegis-no-such-folder', 'x');

function staleEnv() {
  const env = { ...process.env, TMPDIR: STALE, TMP: STALE, TEMP: STALE };
  delete env.NODE_OPTIONS;
  return env;
}
// runs code in a child under the stale folder and returns its last stdout line, parsed
function child(code) {
  const r = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8', env: staleEnv(), cwd: path.join(__dirname, '..') });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').pop());
}

test('makeTempDir returns a new folder that exists under a stale TMPDIR, outside the stale path', () => {
  const seen = child(`
    const fs = require('node:fs');
    const { makeTempDir } = require(${JSON.stringify(HELPER)});
    const a = makeTempDir('aegis-temp-dir-test-');
    const b = makeTempDir('aegis-temp-dir-test-');
    console.log(JSON.stringify({ a, b, exists: fs.existsSync(a) && fs.statSync(a).isDirectory() }));
    fs.rmSync(a, { recursive: true, force: true });
    fs.rmSync(b, { recursive: true, force: true });
  `);
  assert.equal(seen.exists, true, 'the folder was made');
  assert.notEqual(seen.a, seen.b, 'a new folder each call');
  assert.ok(!seen.a.startsWith(STALE), 'not under the stale folder');
  assert.ok(path.basename(seen.a).startsWith('aegis-temp-dir-test-'), 'the prefix is kept');
});

test('makeTempDir loads Node builtins only, so the tripwire can load it first', () => {
  const requires = [...fs.readFileSync(HELPER, 'utf8').matchAll(/require\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
  assert.ok(requires.length > 0 && requires.every((r) => r.startsWith('node:')), requires.join(', '));
});

test('replay-demo runs to exit 0 under a stale TMPDIR', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'replay', 'replay-demo.js')], { encoding: 'utf8', env: staleEnv() });
  assert.equal(r.status, 0, r.stderr);
});

test('the change trail of the runbook tests is made under a stale TMPDIR', () => {
  const seen = child(`
    const after = [];
    const { changeTrail } = require(${JSON.stringify(path.join(__dirname, 'audit', 'trail-helper.js'))});
    const trail = changeTrail({ after: (f) => after.push(f) });
    console.log(JSON.stringify({ ok: typeof trail.changeFor === 'function' }));
    for (const f of after) f();
  `);
  assert.equal(seen.ok, true);
});

test('a judge run makes its folder under a stale TMPDIR', () => {
  const seen = child(`
    const judge = require(${JSON.stringify(path.join(__dirname, 'eval', 'judged', 'judge.js'))});
    // the fake judge answers with the shape its prompt carries
    const prompt = 'Grade.\\nBEGIN-SHAPE\\n' + JSON.stringify({ scores: {}, must: [], must_not: [] }) + '\\nEND-SHAPE';
    judge.judgeOnce(prompt, { command: process.execPath, prefixArgs: [${JSON.stringify(path.join(__dirname, 'eval', 'judged', 'fixtures', 'fake-claude.js'))}], env: { PATH: process.env.PATH }, timeoutMs: 20000, graceMs: 200 })
      .then((t) => console.log(JSON.stringify({ state: t.state, reason: t.reason || null })));
  `);
  assert.equal(seen.state, 'OK', seen.reason);
});

test('each of the four callers uses the helper and makes no temporary folder of its own', () => {
  for (const file of ['adapters/socket-tripwire.js', 'replay/replay-demo.js', 'eval/judged/judge.js', 'audit/trail-helper.js']) {
    const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.match(text, /require\('(?:\.\.\/)+temp-dir\.js'\)/, `${file} requires the helper`);
    assert.doesNotMatch(text, /mkdtempSync/, `${file} makes no temporary folder itself`);
  }
  // the tripwire keeps its reason for throwing rather than going on without a folder
  assert.match(fs.readFileSync(path.join(__dirname, 'adapters', 'socket-tripwire.js'), 'utf8'), /so no\n?\s*(?:\/\/ )?CLI in a test ever falls through to the operator's real trail/);
});
