require('../adapters/socket-tripwire.js'); // first, so no socket can open in this file
// vendor-facts-priority.test.js: the order in which the owner checks unconfirmed vendor facts
// (readiness row 11).
//
// EXPECTED DECISION (written before the code)
// - On the small fixture set (a G2 list, a G3 list, a vendor-facts page and two runbooks whose
//   lines moved two down since the G2 list was made) the page is exactly the expected fixture:
//   facts behind an R3 gate first, then R2, then R1 or R0, then no gate; G3 facts before G2 rows
//   in each group, each in its list's order.
// - A gate's class is the highest R class on its Reversibility line ("R1 to R3" is R3); its
//   section runs past the end of a code fence to the next heading outside a fence.
// - A G2 row is found again by its extracted cell, not by its stale line number; a row whose
//   text is gone is "line not found" and rests on no gate.
// - --check exits 1 when the page on disk is stale and 0 after a plain run; on the real repo
//   the committed page is current.
// Run: node --test scripts/eval/vendor-facts-priority.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const v = require('./vendor-facts-priority.js');

const FIXTURES = path.join(__dirname, 'fixtures', 'vendor-facts-priority');
const OPTIONS = { root: FIXTURES, g2: 'g2-list.txt', g3: 'g3-list.txt', facts: 'facts.txt', runbookDir: 'commands', runbookExt: '.runbook' };

test('the fixture page equals the expected fixture exactly', () => {
  const expected = fs.readFileSync(path.join(FIXTURES, 'expected-output.txt'), 'utf8');
  assert.equal(v.generate(OPTIONS), expected);
});

test('order: R3, then R2, then R1 or R0, then no gate; G3 before G2 inside a group', () => {
  const { facts } = v.build(OPTIONS);
  assert.deepEqual(facts.map((f) => `${f.group} ${f.id}`), [
    'R3 X-01', 'R3 alpha.runbook:12', 'R3 alpha.runbook:19',
    'R2 X-02, X-03', 'R2 Y-01',
    'low alpha.runbook:25',
    'none Z note', 'none Y-02', 'none alpha.runbook:5', 'none alpha.runbook:29#1', 'none alpha.runbook:29#2', 'none alpha.runbook:40', 'none demo.js:5',
  ]);
});

test('a gate takes the highest R class on its Reversibility line, and its section runs past a fence to the next heading', () => {
  const alpha = v.parseGates('alpha.runbook', fs.readFileSync(path.join(FIXTURES, 'commands', 'alpha.runbook'), 'utf8'));
  assert.deepEqual(alpha.map((g) => [g.id, g.rclass]), [['alpha-erase-portal', 'R3'], ['alpha-script-portal', 'R3'], ['alpha-note-portal', 'R1']]);
  const beta = v.parseGates('beta.runbook', fs.readFileSync(path.join(FIXTURES, 'commands', 'beta.runbook'), 'utf8'));
  assert.equal(beta.length, 1);
  assert.match(beta[0].text, /Y-01 is cited here/);
  assert.doesNotMatch(beta[0].text, /outside any gate/);
});

test('a G2 row is found by its text after its line moved; a removed line and a script line rest on no gate', () => {
  const { facts } = v.build(OPTIONS);
  const by = Object.fromEntries(facts.map((f) => [f.id, f]));
  assert.equal(by['alpha.runbook:12'].status, 'now line 14');
  assert.equal(by['alpha.runbook:40'].status, 'line not found in the current runbook');
  assert.equal(by['demo.js:5'].status, 'in a script, not a runbook');
  assert.deepEqual([by['alpha.runbook:29#1'].check, by['alpha.runbook:29#2'].check], ['example.invalid/alpha-guide', 'example.invalid/alpha-api']);
});

test('the extraction matches the G2 list\'s own cells on the real repo for every runbook row', () => {
  const { facts } = v.build();
  const runbookRows = facts.filter((f) => f.source === 'g2' && !f.status.startsWith('in a script'));
  assert.ok(runbookRows.length > 300, `${runbookRows.length} G2 runbook rows`);
  assert.deepEqual(runbookRows.filter((f) => f.status.startsWith('line not found')).map((f) => f.id), []);
});

test('the page quotes no gate or preview marker as written', () => {
  const page = v.generate();
  assert.doesNotMatch(page, /SAFETY GATE \[|PREVIEW ONLY \[|PORTAL ACTION \[/);
  assert.doesNotMatch(page, /\u2014/);
});

test('--check exits 1 on a stale page and 0 after a plain run', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-vfp-'));
  try {
    const output = path.join(dir, 'page.md');
    fs.writeFileSync(output, 'stale\n');
    const said = [];
    assert.equal(v.main(['--check'], { ...OPTIONS, output }, (s) => said.push(s)), 1);
    assert.equal(v.main([], { ...OPTIONS, output }, (s) => said.push(s)), 0);
    assert.equal(v.main(['--check'], { ...OPTIONS, output }, (s) => said.push(s)), 0);
    assert.equal(fs.readFileSync(output, 'utf8'), fs.readFileSync(path.join(FIXTURES, 'expected-output.txt'), 'utf8'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('on the real repo, the committed page is current (--check exits 0)', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'vendor-facts-priority.js'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
