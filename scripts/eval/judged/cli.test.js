'use strict';
require('../../adapters/socket-tripwire.js');
// cli.test.js: the judged-eval runner end to end, with the fake CLI (capability row 26, B9).
//
// EXPECTED DECISION (written before the CLI)
// - Without --execute the run is a dry run: the plan and a cost estimate, exit 4, and no
//   process is started (no claude, no git).
// - A case file inside the repository, or reached through a symlink into it, is refused (exit 1).
// - The DEV set, copied to a temporary file, runs through the runner with the fake CLI as both
//   backends and produces results.json, report.md and, when asked, the calibration sheet.
// - Without a threshold the runner prints NO VERDICT and exits 3, never PASS; with one it
//   prints PASS (0) or FAIL (2); a boundary violation is FAIL whatever was given.
// - The terminal shows case ids, verdicts and scores only, never case text or answers.
// - A results directory in a tracked part of the repository is refused before any case runs.
// Run: node --test scripts/eval/judged/cli.test.js

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const cli = require('../judged-eval.js');
const cases = require('./cases.js');
const calibrate = require('./calibrate.js');
const { REPO_ROOT } = require('./paths.js');

const CLI = path.join(__dirname, '..', 'judged-eval.js');
const DEV = path.join(__dirname, 'dev-cases.jsonl');
const FAKE = path.join(__dirname, 'fixtures', 'fake-claude.js');
const DEV_CASES = cases.readCaseFile(DEV).cases;

function setup(t, fakeConfig = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-judged-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const copy = path.join(dir, 'dev-cases.jsonl');
  fs.copyFileSync(DEV, copy);
  const cfg = path.join(dir, 'fake.json');
  const log = path.join(dir, 'calls.jsonl');
  fs.writeFileSync(cfg, JSON.stringify({ log, ...fakeConfig }));
  const out = [];
  const err = [];
  const io = { out: (s) => out.push(s), err: (s) => err.push(s) };
  const deps = { backend: { command: process.execPath, prefixArgs: [FAKE, '--fake-config', cfg] }, env: { PATH: process.env.PATH, AEGIS_TEST_TOKEN: 'x' }, graceMs: 200 };
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { dir, copy, out, err, io, deps, calls, results: path.join(dir, 'results') };
}

// No ticket, evidence, follow-up or answer text ever reaches the terminal.
function assertNoCaseText(lines) {
  const text = lines.join('\n');
  for (const c of DEV_CASES) {
    for (const s of [c.ticket, c.evidence, c.follow_up].filter(Boolean)) assert.ok(!text.includes(s.slice(0, 40)), `${c.id} text on the terminal`);
  }
  assert.ok(!text.includes('Most likely fix first'), 'no answer text on the terminal');
}

test('a dry run prints the plan and the estimate, exits 4, and starts no process', async (t) => {
  const s = setup(t);
  let spawned = 0;
  const deps = { ...s.deps, spawn: () => { spawned += 1; throw new Error('spawn in a dry run'); }, git: () => { spawned += 1; throw new Error('git in a dry run'); } };
  const code = await cli.main(['run', '--cases', s.copy], s.io, deps);
  assert.equal(code, 4, s.err.join('\n'));
  assert.equal(spawned, 0);
  assert.equal(s.calls().length, 0);
  const text = s.out.join('\n');
  assert.match(text, /DRY RUN/);
  assert.match(text, /cases: 8 \(DEV01, DEV02, DEV03, DEV04, DEV05, DEV06, DEV07, DEV08\)/);
  assert.match(text, /system-under-test sessions: 8, turns: 9 \(1 follow-up turn/);
  assert.match(text, /judge sessions: 8/);
  assert.match(text, /about 22\.50 US dollars .*docs\/evidence\/runtime-smoke\.md\); judge cost is not in the estimate until measured/);
  assert.match(text, /claude -p <ticket> --output-format stream-json --verbose --max-turns 24 --tools Read Grep Glob Agent --allowedTools Read Grep Glob Agent --disallowedTools Bash WebFetch WebSearch/);
  assert.match(text, /--tools "" --no-session-persistence/);
  assertNoCaseText(s.out);
});

test('the real CLI refuses the DEV file in the repository and a symlink into it (exit 1); dry run on a copy exits 4', (t) => {
  const s = setup(t);
  const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
  const inRepo = run('run', '--cases', DEV);
  assert.equal(inRepo.status, 1);
  assert.match(inRepo.stderr, /inside the repository working tree/);
  const link = path.join(s.dir, 'link.jsonl');
  let linked = true;
  try { fs.symlinkSync(DEV, link, 'file'); } catch (e) { if (e.code === 'EPERM' || e.code === 'EACCES') linked = false; else throw e; }
  if (linked) {
    const viaLink = run('run', '--cases', link, '--execute');
    assert.equal(viaLink.status, 1);
    assert.match(viaLink.stderr, /through a symlink/);
  }
  const dry = run('run', '--cases', s.copy);
  assert.equal(dry.status, 4, dry.stderr);
  assert.equal(run('--help').status, 0);
  assert.equal(run('run', '--cases', s.copy, '--bogus').status, 1);
  assert.equal(run('run', '--cases', s.copy, '--thresholds', path.join(REPO_ROOT, '.env.example')).status, 1, 'a thresholds file in the repository');
});

test('the DEV set runs through the runner with the fake backends and produces the report; no threshold gives NO VERDICT (exit 3)', async (t) => {
  const s = setup(t);
  const code = await cli.main(['run', '--cases', s.copy, '--execute', '--results-dir', s.results, '--calibration-sheet', '3', '--judge-model', 'judge-x'], s.io, s.deps);
  assert.equal(code, 3, `${s.out.join('\n')}\n${s.err.join('\n')}`);
  const lines = s.out.filter((l) => /^DEV\d\d /.test(l));
  assert.deepEqual(lines.map((l) => l.split(' ')[0]), DEV_CASES.map((c) => c.id));
  assert.ok(lines.every((l) => /^DEV\d\d (PASS|FAIL|INCONCLUSIVE) (\d+\/\d+|n\/a)$/.test(l)), lines.join('\n'));
  assert.equal(s.out[s.out.length - 1], 'NO VERDICT: no threshold was given');
  assert.ok(!s.out.some((l) => /^PASS/.test(l)), 'PASS is never printed without a threshold');
  assertNoCaseText(s.out);
  const json = JSON.parse(fs.readFileSync(path.join(s.results, 'results.json'), 'utf8'));
  assert.equal(json.label, 'simulated: model-judged on a case file, no real tenant');
  assert.equal(json.cases.length, 8);
  assert.equal(json.summary.measures.pass_rate.denominator, 8, 'all 8 judged');
  assert.deepEqual(json.judge_models, ['fake-judge-model']);
  assert.equal(json.config.judge_model, 'judge-x');
  assert.ok(fs.readFileSync(path.join(s.results, 'report.md'), 'utf8').includes(json.label));
  const sheet = calibrate.parseCsv(fs.readFileSync(path.join(s.results, 'calibration-sheet.csv'), 'utf8'));
  assert.equal(sheet.length, 4);
  // 8 SUT sessions + 1 follow-up turn + 8 judge calls; the follow-up resumes its session
  const calls = s.calls();
  assert.equal(calls.filter((c) => c.role === 'sut').length, 9);
  assert.equal(calls.filter((c) => c.role === 'judge').length, 8);
  assert.equal(calls.filter((c) => c.resume).length, 1);
  assert.ok(calls.every((c) => !c.env.includes('AEGIS_TEST_TOKEN')), 'scrubbed in every child');
  // the judge never sees the ticket outside its data block
  for (const call of calls.filter((c) => c.role === 'judge')) {
    const m = /<<<BEGIN-DATA-([0-9a-f]{24})>>>/.exec(call.prompt);
    const outside = call.prompt.split(`\n<<<BEGIN-DATA-${m[1]}>>>\n`)[0] + call.prompt.split(`\n<<<END-DATA-${m[1]}>>>\n`)[1];
    const c = DEV_CASES.find((x) => call.prompt.includes(x.ticket));
    assert.ok(c && !outside.includes(c.ticket), 'ticket only inside the data block');
  }
});

test('with a threshold the runner prints PASS or FAIL; the calibrate command reports agreement and kappa', async (t) => {
  const s = setup(t);
  const code = await cli.main(['run', '--cases', s.copy, '--execute', '--results-dir', s.results, '--pass-threshold', '0.5', '--calibration-sheet', '8'], s.io, s.deps);
  const json = JSON.parse(fs.readFileSync(path.join(s.results, 'results.json'), 'utf8'));
  const rate = json.summary.measures.pass_rate.rate;
  assert.equal(code, rate >= 0.5 && json.summary.inconclusive === 0 && json.summary.measures.boundary_violations.count === 0 ? 0 : 2);
  assert.match(s.out[s.out.length - 1], code === 0 ? /^PASS: / : /^FAIL: /);
  // The owner fills the blind sheet with the judge's scores except one classification cell (1
  // where the fake judge gave 2). Every judge score is 2, so with n scored pairs: po = (n-1)/n,
  // pe = (n-1)/n (owner 2 on n-1 pairs, judge 2 on all), kappa = 0.
  const rows = calibrate.parseCsv(fs.readFileSync(path.join(s.results, 'calibration-sheet.csv'), 'utf8'));
  assert.equal(rows.length, 9, 'all 8 cases sampled');
  const byId = new Map(json.cases.map((c) => [c.id, c.rows]));
  const filled = [rows[0], ...rows.slice(1).map((r, i) => [r[0], 'x', 'y', ...calibrate.SCORE_COLUMNS.map((k) => {
    if (i === 0 && k === 'classification') return '1';
    const v = byId.get(r[0])[k];
    return v === null ? 'NA' : String(v);
  })])];
  const sheetFile = path.join(s.dir, 'filled.csv');
  fs.writeFileSync(sheetFile, calibrate.toCsv(filled));
  const calib = async (...extra) => {
    const out = [];
    const c = await cli.main(['calibrate', '--sheet', sheetFile, '--run', path.join(s.results, 'results.json'), ...extra], { out: (x) => out.push(x), err: (x) => out.push(x) }, {});
    return { code: c, out };
  };
  const none = await calib();
  assert.equal(none.code, 3, 'no agreement threshold: NO VERDICT');
  assert.equal(none.out[none.out.length - 1], 'NO VERDICT: no threshold was given');
  const overall = none.out.find((l) => l.startsWith('overall: '));
  const [, agree, pairs] = /^overall: agreement (\d+)\/(\d+) .*kappa 0\.000$/.exec(overall) || [];
  assert.equal(Number(agree), Number(pairs) - 1, overall);
  assert.match(none.out.find((l) => l.startsWith('classification: ')), /^classification: agreement 7\/8 \(0\.875\), kappa 0\.000$/);
  assert.equal((await calib('--agreement-threshold', '0.6')).code, 2);
  assert.equal((await calib('--agreement-threshold', '-0.5')).code, 0);
});

test('a boundary violation fails the run even without a threshold (exit 2)', async (t) => {
  const s = setup(t, { sut: { answer: 'Done. I disabled the account for [UPN] and the administrator can verify-account-enabled.' } });
  const code = await cli.main(['run', '--cases', s.copy, '--execute', '--results-dir', s.results], s.io, s.deps);
  assert.equal(code, 2);
  assert.match(s.out[s.out.length - 1], /^FAIL: 8 boundary violation\(s\)/);
});

test('a timed-out case is INCONCLUSIVE and never counts as a pass', async (t) => {
  const s = setup(t, { sut: { mode: 'slow', sleep_ms: 30000 } });
  const one = path.join(s.dir, 'one.jsonl');
  fs.writeFileSync(one, `${fs.readFileSync(s.copy, 'utf8').split('\n')[0]}\n`);
  const code = await cli.main(['run', '--cases', one, '--execute', '--results-dir', s.results, '--timeout-ms', '300', '--pass-threshold', '0'], s.io, s.deps);
  assert.equal(code, 2);
  assert.ok(s.out.includes('DEV01 INCONCLUSIVE n/a'), s.out.join('\n'));
  const json = JSON.parse(fs.readFileSync(path.join(s.results, 'results.json'), 'utf8'));
  assert.equal(json.cases[0].sut.state, 'TIMEOUT');
  assert.equal(s.calls().filter((c) => c.role === 'judge').length, 0, 'no judge for a case that did not run');
});

test('a results directory in a tracked part of the repository is refused before any case runs', async (t) => {
  const s = setup(t);
  const code = await cli.main(['run', '--cases', s.copy, '--execute', '--results-dir', path.join(REPO_ROOT, 'scripts', 'eval', 'judged', 'out')], s.io, s.deps);
  assert.equal(code, 1);
  assert.match(s.err.join('\n'), /not ignored by git/);
  assert.equal(s.calls().length, 0);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'scripts', 'eval', 'judged', 'out')), false);
});
