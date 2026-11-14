'use strict';
require('../../adapters/socket-tripwire.js');
// budget.test.js: the judged runner's spending limit (batch 11, added with task 8's 18 US dollar ceiling).
//
// EXPECTED DECISION (written before the flag)
// - `--budget-usd N` is a limit in US dollars for the whole run (system under test and judge together). Before each
//   case the runner stops if what it has spent plus what one more case is likely to cost (the dearest case so far in
//   this run, or 1.00 US dollar before any case has reported a cost) would pass the limit.
// - A case that did not run is in results.json and report.md as INCONCLUSIVE with the reason, never as a pass, and
//   starts no process; the terminal says how many did not run. The run's own verdict rules are unchanged (an
//   inconclusive case is never a PASS).
// - Without the flag nothing changes. A value that is not a positive amount is refused before any case runs.
// Wrong implementations it catches: a guard that checks only after a case has run past the limit (the third case
// would start); one that drops the cases it did not run (results would list fewer cases than the file holds); one
// that counts the system under test and forgets the judge (the limit of 2.50 would let a third case start).
// Run: node --test scripts/eval/judged/budget.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const cli = require('../judged-eval.js');

const DEV = path.join(__dirname, 'dev-cases.jsonl');
const FAKE = path.join(__dirname, 'fixtures', 'fake-claude.js');
// the eight cases of batch G4 (DEV01 to DEV08), the DEV file's first eight lines: the counts below are written against them
const G4_TEXT = `${fs.readFileSync(DEV, 'utf8').split('\n').slice(0, 8).join('\n')}\n`;

function setup(t, fakeConfig) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'aegis-judged-budget-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const caseDir = path.join(dir, 'cases');
  fs.mkdirSync(caseDir);
  const copy = path.join(caseDir, 'dev-cases.jsonl');
  fs.writeFileSync(copy, G4_TEXT);
  const cfg = path.join(dir, 'fake.json');
  const log = path.join(dir, 'calls.jsonl');
  fs.writeFileSync(cfg, JSON.stringify({ log, ...fakeConfig }));
  const out = [];
  const err = [];
  const io = { out: (s) => out.push(s), err: (s) => err.push(s) };
  const deps = { backend: { command: process.execPath, prefixArgs: [FAKE, '--fake-config', cfg] }, env: { PATH: process.env.PATH }, graceMs: 200 };
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { copy, out, err, io, deps, calls, results: path.join(dir, 'results') };
}

test('--budget-usd stops before the case that could pass the limit, and records the rest as not run', async (t) => {
  // each case costs 1.00 (system under test) + 0.25 (judge) = 1.25; a limit of 2.50 pays for exactly two
  const s = setup(t, { sut: { cost: 1.0 }, judge: { cost: 0.25 } });
  const code = await cli.main(['run', '--cases', s.copy, '--results-dir', s.results, '--execute', '--budget-usd', '2.50'], s.io, s.deps);
  assert.equal(code, 3, 'no threshold was given, so the run has no verdict, as before');
  const run = JSON.parse(fs.readFileSync(path.join(s.results, 'results.json'), 'utf8'));
  assert.equal(run.cases.length, 8, 'every case of the file is in the results');
  const ran = run.cases.filter((c) => c.sut.state !== 'NOT_RUN');
  assert.deepEqual(ran.map((c) => c.id), ['DEV01', 'DEV02'], 'two cases fit in 2.50');
  const skipped = run.cases.filter((c) => c.sut.state === 'NOT_RUN');
  assert.equal(skipped.length, 6);
  for (const c of skipped) {
    assert.equal(c.verdict, 'INCONCLUSIVE', c.id);
    assert.match(c.reasons.join(' '), /not run: the run's limit of 2\.50 US dollars/);
    assert.equal(c.judge, null);
  }
  assert.equal(s.calls().filter((c) => c.role === 'sut').length, 2, 'no process was started for a case that did not run');
  assert.equal(s.calls().filter((c) => c.role === 'judge').length, 2);
  assert.equal(run.config.budget_usd, 2.5);
  assert.equal(Number(run.spent_usd.toFixed(2)), 2.5);
  assert.ok(s.out.some((l) => /6 case\(s\) did not run/.test(l)), s.out.join('\n'));
  const md = fs.readFileSync(path.join(s.results, 'report.md'), 'utf8');
  assert.match(md, /\| DEV03 \| okta \| INCONCLUSIVE \|/);
  assert.match(md, /not run: the run's limit/);
});

test('before any case has reported a cost, one more case is taken to cost 1.00 US dollar; a larger limit runs them all', async (t) => {
  const tight = setup(t, { sut: { cost: 0.1 }, judge: { cost: 0.01 } });
  await cli.main(['run', '--cases', tight.copy, '--results-dir', tight.results, '--execute', '--budget-usd', '0.90'], tight.io, tight.deps);
  assert.equal(tight.calls().length, 0, 'a limit under the first guess starts nothing');
  const none = JSON.parse(fs.readFileSync(path.join(tight.results, 'results.json'), 'utf8'));
  assert.ok(none.cases.every((c) => c.sut.state === 'NOT_RUN' && c.verdict === 'INCONCLUSIVE'));

  const roomy = setup(t, { sut: { cost: 0.1 }, judge: { cost: 0.01 } });
  await cli.main(['run', '--cases', roomy.copy, '--results-dir', roomy.results, '--execute', '--budget-usd', '5'], roomy.io, roomy.deps);
  const all = JSON.parse(fs.readFileSync(path.join(roomy.results, 'results.json'), 'utf8'));
  assert.ok(all.cases.every((c) => c.sut.state === 'OK'), 'eight cases at 0.11 each fit in 5.00');
  // eight cases at 0.10 plus 0.01 for the judge, and one more 0.10 for the one case with a follow-up turn
  const followUps = all.cases.filter((c) => c.sut.turns.length === 2).length;
  assert.equal(followUps, 1);
  assert.equal(Number(all.spent_usd.toFixed(2)), 0.98);
});

test('--budget-usd takes a positive amount; without the flag the results carry no limit', async (t) => {
  for (const bad of ['abc', '0', '-1', '1.2.3']) {
    const s = setup(t, {});
    assert.equal(await cli.main(['run', '--cases', s.copy, '--results-dir', s.results, '--execute', '--budget-usd', bad], s.io, s.deps), 1, bad);
    assert.match(s.err.join(' '), /--budget-usd/);
    assert.equal(s.calls().length, 0);
  }
  const s = setup(t, {});
  await cli.main(['run', '--cases', s.copy, '--results-dir', s.results, '--execute'], s.io, s.deps);
  const run = JSON.parse(fs.readFileSync(path.join(s.results, 'results.json'), 'utf8'));
  assert.equal(run.config.budget_usd, null);
  assert.ok(run.cases.every((c) => c.sut.state === 'OK'));
  // the dry run names the limit when one is given
  const dry = setup(t, {});
  assert.equal(await cli.main(['run', '--cases', dry.copy, '--budget-usd', '9'], dry.io, dry.deps), 4);
  assert.ok(dry.out.some((l) => /limit: 9\.00 US dollars/.test(l)), dry.out.join('\n'));
});

// Code review round 1, finding 2: a case whose session stopped with no cost reported (a timeout, an output-cap kill, a
// follow-up that failed) added nothing to what the run had spent, so the guard kept starting cases past the limit. As
// the desk does, a cost that is unknown stops the run under a limit: what it spent cannot be counted. Wrong
// implementation it catches: one that adds 0 for an unknown cost (the second case would start).
test('code review 1: a session that stops with no cost reported stops the run under a limit; the rest are not run', async (t) => {
  const s = setup(t, { sut: { mode: 'slow', sleep_ms: 20000, cost: 1.0 }, judge: { cost: 0.25 } });
  const code = await cli.main(['run', '--cases', s.copy, '--results-dir', s.results, '--execute', '--budget-usd', '9.00', '--timeout-ms', '300'], s.io, s.deps);
  assert.equal(code, 3);
  const run = JSON.parse(fs.readFileSync(path.join(s.results, 'results.json'), 'utf8'));
  assert.deepEqual(run.cases.filter((c) => c.sut.state !== 'NOT_RUN').map((c) => [c.id, c.sut.state]), [['DEV01', 'TIMEOUT']]);
  for (const c of run.cases.filter((x) => x.sut.state === 'NOT_RUN')) {
    assert.equal(c.verdict, 'INCONCLUSIVE');
    assert.match(c.reasons[0], /stopped with no cost reported, so what the run spent is unknown/);
  }
  assert.equal(s.calls().filter((c) => c.role === 'sut').length, 1, 'one session started');
  // without a limit nothing changes: every case runs
  const free = setup(t, { sut: { mode: 'slow', sleep_ms: 20000 } });
  await cli.main(['run', '--cases', free.copy, '--results-dir', free.results, '--execute', '--timeout-ms', '300'], free.io, free.deps);
  assert.equal(free.calls().filter((c) => c.role === 'sut').length, 8);
});
