'use strict';
require('../../adapters/socket-tripwire.js');
// model-pin.test.js: every model session that batch 11's runs start names its model (batch 11 resumed, task 8).
//
// Why: this machine's settings file names a default model, and a session started with no --model runs on it, so a
// run measured "on Aegis" could run on whatever that default is that day. The commander's correctness run was
// measured on claude-opus-5-5, so the runs pin that model and record the one each session reports.
//
// EXPECTED DECISION (written before the code)
// - backends.PINNED_MODEL is claude-opus-5-5. sutArgs and judgeArgs end with --model <model>: the pinned one when
//   none is given, the given one otherwise. A value that is not a model name (empty, a space, a leading dash, over
//   100 characters) is refused before anything starts.
// - The model comes after --tools, so aegis-chat, which keeps only the arguments from --tools on, keeps it too.
// - caseVerdict, given the two pinned models, makes a case INCONCLUSIVE whatever its grade when its system under test
//   or its judge reports another model, or reports none; the reason names the model reported and the pin. Without
//   pins it decides as before.
// - judged-eval: --model sets the system under test's model and --judge-model the judge's, both claude-opus-5-5 by
//   default; the dry run prints both in its command previews; results.json keeps both in config; report.md says how
//   many cases ran on another model than the pinned one.
// Wrong implementations these catch: a pin written only in a README (no --model in the argv); a --model placed
// before --tools (the chat would drop it); a check that trusts the flag instead of the model the session reports; a
// check that lets a case with no reported model pass; a judge left on the default model.
// Run: node --test scripts/eval/judged/model-pin.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const backends = require('./backends.js');
const judge = require('./judge.js');
const cli = require('../judged-eval.js');

const FAKE = path.join(__dirname, 'fixtures', 'fake-claude.js');
const DEV = path.join(__dirname, 'dev-cases.jsonl');
// two of batch G4's cases (DEV01, DEV02), enough to show every case of a run is pinned
const TWO = `${fs.readFileSync(DEV, 'utf8').split('\n').slice(0, 2).join('\n')}\n`;

const tail = (args) => args.slice(-2);

test('PINNED_MODEL is claude-opus-5-5, and both session kinds end with --model, the pinned one by default', () => {
  assert.equal(backends.PINNED_MODEL, 'claude-opus-5-5');
  assert.deepEqual(tail(backends.sutArgs({ prompt: 'P' })), ['--model', 'claude-opus-5-5']);
  assert.deepEqual(tail(backends.sutArgs({ prompt: 'P', resume: 'sess-1' })), ['--model', 'claude-opus-5-5'], 'a follow-up turn too');
  assert.deepEqual(tail(backends.judgeArgs({ prompt: 'J' })), ['--model', 'claude-opus-5-5']);
  assert.deepEqual(tail(backends.sutArgs({ prompt: 'P', model: 'claude-sonnet-5-5' })), ['--model', 'claude-sonnet-5-5']);
  assert.deepEqual(tail(backends.judgeArgs({ prompt: 'J', model: 'judge-x' })), ['--model', 'judge-x']);
  assert.equal(backends.sutArgs({ prompt: 'P' }).filter((a) => a === '--model').length, 1, 'one --model');
  // aegis-chat keeps the arguments from --tools on
  const chatPart = backends.sutArgs({ prompt: '', persist: false }).slice(backends.sutArgs({ prompt: '', persist: false }).indexOf('--tools'));
  assert.deepEqual(tail(chatPart), ['--model', 'claude-opus-5-5']);
});

test('a value that is not a model name is refused before any session starts', () => {
  for (const bad of ['', 'two words', '-x', '--model', 'x'.repeat(101), 'a/b', 'opus;rm']) {
    assert.throws(() => backends.sutArgs({ prompt: 'P', model: bad }), /model name/, JSON.stringify(bad));
    assert.throws(() => backends.judgeArgs({ prompt: 'J', model: bad }), /model name/, JSON.stringify(bad));
  }
  for (const good of ['claude-opus-5-5', 'claude-fable-5-2', 'opus', 'claude-opus-5-5[1m]', 'vendor:model.v2']) assert.ok(backends.isModelName(good), good);
});

// A judged case that would pass, then the same case on another model.
const kase = { id: 'X1', expected: { must: ['a'], must_not: ['b'] } };
const sutOn = (model) => ({ state: 'OK', model, outside_reads: [] });
const judgeOn = (model) => ({ state: 'OK', model, scores: Object.fromEntries(judge.ROWS.map((r) => [r.key, 2])), must: [{ met: true }], must_not: [{ present: false }] });
const PINS = { sut: 'claude-opus-5-5', judge: 'claude-opus-5-5' };

test('caseVerdict: a case on another model, or on a model not reported, is INCONCLUSIVE whatever its grade, and names both', () => {
  const ok = judge.caseVerdict(kase, sutOn('claude-opus-5-5'), [], judgeOn('claude-opus-5-5'), PINS);
  assert.equal(ok.verdict, 'PASS', ok.reasons.join('; '));
  assert.deepEqual(judge.caseVerdict(kase, sutOn('claude-fable-5-2'), [], judgeOn('claude-fable-5-2')).verdict, 'PASS', 'no pins: decided as before');

  const sutOff = judge.caseVerdict(kase, sutOn('claude-fable-5-2'), [], judgeOn('claude-opus-5-5'), PINS);
  assert.equal(sutOff.verdict, 'INCONCLUSIVE');
  assert.match(sutOff.reasons[0], /system under test ran on claude-fable-5-2, not the pinned claude-opus-5-5/);
  assert.equal(sutOff.total, ok.total, 'the grade is kept for the record');

  const judgeOff = judge.caseVerdict(kase, sutOn('claude-opus-5-5'), [], judgeOn('claude-fable-5-2'), PINS);
  assert.equal(judgeOff.verdict, 'INCONCLUSIVE');
  assert.match(judgeOff.reasons[0], /judge ran on claude-fable-5-2, not the pinned claude-opus-5-5/);

  const unsaid = judge.caseVerdict(kase, sutOn(null), [], judgeOn('claude-opus-5-5'), PINS);
  assert.equal(unsaid.verdict, 'INCONCLUSIVE');
  assert.match(unsaid.reasons[0], /system under test did not report its model; the pin is claude-opus-5-5/);

  // a failed case stays INCONCLUSIVE or FAIL as before, and still names the model
  const failed = judge.caseVerdict(kase, sutOn('claude-fable-5-2'), [], { ...judgeOn('claude-opus-5-5'), must: [{ met: false }] }, PINS);
  assert.equal(failed.verdict, 'INCONCLUSIVE');
  assert.ok(failed.reasons.some((r) => /must item 1 not met/.test(r)), 'the grade\'s own reasons are kept');
  // a session that did not run is INCONCLUSIVE for that reason, and no model is asked of it
  const notRun = judge.caseVerdict(kase, { state: 'TIMEOUT', model: null, outside_reads: [] }, [], null, PINS);
  assert.deepEqual(notRun.reasons, ['system under test TIMEOUT']);
});

function setup(t, fakeConfig = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-model-pin-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const copy = path.join(dir, 'cases.jsonl');
  fs.writeFileSync(copy, TWO);
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

const modelOf = (args) => args[args.indexOf('--model') + 1];

test('judged-eval: the dry run shows both models; a bad --model is refused; a run pins every session and records what each reported', async (t) => {
  const s = setup(t);
  assert.equal(await cli.main(['run', '--cases', s.copy], s.io, s.deps), 4);
  const plan = s.out.join('\n');
  assert.match(plan, /^system under test: claude -p .* --model claude-opus-5-5 \(cwd/m);
  assert.match(plan, /^judge: claude -p .* --model claude-opus-5-5 \(cwd/m);

  const bad = setup(t);
  assert.equal(await cli.main(['run', '--cases', bad.copy, '--model', 'two words'], bad.io, bad.deps), 1);
  assert.match(bad.err.join('\n'), /--model is a model name/);
  assert.equal(bad.calls().length, 0);

  const run = setup(t);
  const code = await cli.main(['run', '--cases', run.copy, '--execute', '--results-dir', run.results], run.io, run.deps);
  assert.equal(code, 3, `${run.out.join('\n')}\n${run.err.join('\n')}`);
  const calls = run.calls();
  assert.equal(calls.length, 4, 'two system-under-test sessions and two judges');
  for (const c of calls) assert.equal(modelOf(c.args), 'claude-opus-5-5', `${c.role} pinned`);
  const json = JSON.parse(fs.readFileSync(path.join(run.results, 'results.json'), 'utf8'));
  assert.equal(json.config.model, 'claude-opus-5-5');
  assert.equal(json.config.judge_model, 'claude-opus-5-5');
  assert.deepEqual(json.sut_models, ['claude-opus-5-5']);
  assert.deepEqual(json.judge_models, ['claude-opus-5-5']);
  for (const c of json.cases) {
    assert.equal(c.sut.model, 'claude-opus-5-5', c.id);
    assert.equal(c.judge.model, 'claude-opus-5-5', c.id);
    assert.notEqual(c.verdict, 'INCONCLUSIVE', `${c.id}: ${c.reasons.join('; ')}`);
  }
  assert.deepEqual(json.summary.off_model, { count: 0, ids: [] });
  const report = fs.readFileSync(path.join(run.results, 'report.md'), 'utf8');
  assert.match(report, /System under test model: claude-opus-5-5 \(pinned claude-opus-5-5\)\. Judge model: claude-opus-5-5 \(pinned claude-opus-5-5\)/);
  assert.match(report, /\| Cases that ran on another model than the pinned one \(each is INCONCLUSIVE\) \| 0 \|/);
});

test('judged-eval: a session that reports another model than the one asked for makes its case INCONCLUSIVE, and the report counts it', async (t) => {
  // the fake reports the model in its own settings, whatever --model it was given: a CLI that ran another model
  const s = setup(t, { sut: { model: 'claude-fable-5-2' } });
  const code = await cli.main(['run', '--cases', s.copy, '--execute', '--results-dir', s.results, '--model', 'claude-sonnet-5-5', '--judge-model', 'judge-x'], s.io, s.deps);
  assert.equal(code, 3, `${s.out.join('\n')}\n${s.err.join('\n')}`);
  const calls = s.calls();
  assert.deepEqual(calls.filter((c) => c.role === 'sut').map((c) => modelOf(c.args)), ['claude-sonnet-5-5', 'claude-sonnet-5-5']);
  assert.deepEqual(calls.filter((c) => c.role === 'judge').map((c) => modelOf(c.args)), ['judge-x', 'judge-x']);
  const json = JSON.parse(fs.readFileSync(path.join(s.results, 'results.json'), 'utf8'));
  for (const c of json.cases) {
    assert.equal(c.verdict, 'INCONCLUSIVE', c.id);
    assert.match(c.reasons[0], /system under test ran on claude-fable-5-2, not the pinned claude-sonnet-5-5/);
  }
  assert.deepEqual(json.summary.off_model, { count: 2, ids: ['DEV01', 'DEV02'] });
  assert.match(fs.readFileSync(path.join(s.results, 'report.md'), 'utf8'), /\| Cases that ran on another model than the pinned one \(each is INCONCLUSIVE\) \| 2 \(DEV01, DEV02\) \|/);
});
