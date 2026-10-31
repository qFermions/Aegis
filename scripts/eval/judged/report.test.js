'use strict';
require('../../adapters/socket-tripwire.js');
// report.test.js: the measures and pages of a judged-eval run (capability row 26, B6).
//
// EXPECTED DECISION (written before the module)
// - On a fixed set of six case results (four judged, two inconclusive) every measure has
//   the numerator and denominator worked out by hand below, rate null when the
//   denominator is 0.
// - Regressions: ids that passed in the baseline and do not pass now, over ids in both.
// - One row per platform and per scenario; a platform row under 10 cases carries the note.
// - results.json and report.md both carry the simulated label; the terminal line holds the
//   id, the verdict and the score only.
// Run: node --test scripts/eval/judged/report.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const report = require('./report.js');

const ROWS = { classification: 2, first_action: 2, gui_path: 2, command_discipline: null, risk: 2, verification: 2, ticket_note: 2, continuity: null, privacy: 2, correctness: 2, escalation: 2, boundary: 2, clarify_first: null };
const check = (name, verdict) => ({ check: name, verdict, applies: true, span: null });

function mk(id, platform, scenario, cc, verdict, o = {}) {
  const ran = o.sutState !== 'TIMEOUT';
  return {
    id, platform, scenario, change_class: cc, verdict,
    sut: { state: ran ? 'OK' : 'TIMEOUT', duration_ms: o.duration ?? 0, cost_usd: o.cost ?? null, answer: 'SECRET-ANSWER-TEXT' },
    checks: ran ? [check('boundary', o.boundary || 'pass'), check('human-confirmation', o.human || 'pass'), check('read-back', o.readBack || 'pass')] : [],
    judge: verdict === 'INCONCLUSIVE' ? (ran ? { state: 'INVALID', cost_usd: null } : null) : { state: 'OK', cost_usd: o.judgeCost ?? null, must: o.must || [{ met: true }], must_not: o.mustNot || [{ present: false }] },
    rows: verdict === 'INCONCLUSIVE' ? null : { ...ROWS, ...(o.rows || {}) },
    total: verdict === 'INCONCLUSIVE' ? null : 20, max: verdict === 'INCONCLUSIVE' ? null : 20, reasons: [],
  };
}

// A..D judged, E judge-invalid, F timed out. Worked by hand:
// pass 2/4; correctness A,C,D = 3/4; changes A(R1) B(R2) C(R3): procedure A,C = 2/3 (B fails
// human-confirmation), verification A,C = 2/3 (B scores 1); escalation A,C,D = 3/4 (B 0);
// boundary violations D (check failed) = 1 over 5 answered; latency over A..E [100,300,200,400,500]
// nearest-rank p50 300, p95 500; cost A,B,D,E = 5.0 over 4 of 6, 1.25 per case.
const RESULTS = [
  mk('A', 'microsoft', 's1', 'R1', 'PASS', { duration: 100, cost: 1.0, judgeCost: 0.1 }),
  mk('B', 'microsoft', 's1', 'R2', 'FAIL', { duration: 300, cost: 2.0, human: 'fail', rows: { verification: 1, escalation: 0 }, must: [{ met: true }, { met: false }] }),
  mk('C', 'google', 's2', 'R3', 'PASS', { duration: 200 }),
  mk('D', 'google', 's2', 'none', 'FAIL', { duration: 400, cost: 0.5, boundary: 'fail' }),
  mk('E', 'okta', 's3', 'R1', 'INCONCLUSIVE', { duration: 500, cost: 1.5 }),
  mk('F', 'okta', 's3', 'R2', 'INCONCLUSIVE', { sutState: 'TIMEOUT' }),
];
const BASELINE = { cases: [{ id: 'A', verdict: 'PASS' }, { id: 'B', verdict: 'PASS' }, { id: 'C', verdict: 'FAIL' }, { id: 'E', verdict: 'PASS' }, { id: 'Z', verdict: 'PASS' }] };

const frac = (m) => [m.numerator, m.denominator];

test('every measure has the hand-computed numerator and denominator', () => {
  const s = report.summarize(RESULTS);
  assert.deepEqual([s.cases, s.judged, s.passed, s.failed, s.inconclusive], [6, 4, 2, 2, 2]);
  const m = s.measures;
  assert.deepEqual(frac(m.pass_rate), [2, 4]);
  assert.equal(m.pass_rate.rate, 0.5);
  assert.deepEqual(frac(m.correctness), [3, 4]);
  assert.deepEqual(frac(m.procedure_validity), [2, 3]);
  assert.deepEqual(frac(m.verification_quality), [2, 3]);
  assert.deepEqual(frac(m.appropriate_escalation), [3, 4]);
  assert.deepEqual(m.boundary_violations, { count: 1, over: 5, ids: ['D'] });
  assert.deepEqual(m.latency_ms, { p50: 300, p95: 500, over: 5 });
  assert.deepEqual([m.cost_usd.total, m.cost_usd.per_case, m.cost_usd.reported, m.cost_usd.of, m.cost_usd.judge_total, m.cost_usd.judge_reported], [5, 1.25, 4, 6, 0.1, 1]);
  assert.equal(m.regressions, null, 'no baseline given');
});

test('a judge Boundary of 0 is a violation too, and a denominator of 0 gives rate null', () => {
  const s = report.summarize([mk('G', 'jira', 's', 'none', 'FAIL', { rows: { boundary: 0 } })]);
  assert.deepEqual(s.measures.boundary_violations.ids, ['G']);
  assert.deepEqual(s.measures.procedure_validity, { numerator: 0, denominator: 0, rate: null });
  const none = report.summarize([mk('H', 'jira', 's', 'R1', 'INCONCLUSIVE', { sutState: 'TIMEOUT' })]);
  assert.equal(none.measures.pass_rate.rate, null);
  assert.deepEqual(none.measures.latency_ms, { p50: null, p95: null, over: 0 });
  assert.equal(none.measures.cost_usd.total, null);
});

test('regressions: passed in the baseline and not now, over ids in both', () => {
  const r = report.summarize(RESULTS, { baseline: BASELINE }).measures.regressions;
  assert.deepEqual([r.numerator, r.denominator, r.rate, r.ids], [2, 4, 0.5, ['B', 'E']]);
  const fs2 = report.summarize(RESULTS, { baseline: { cases: [{ id: 'Q', verdict: 'PASS' }] } }).measures.regressions;
  assert.deepEqual([fs2.numerator, fs2.denominator, fs2.rate], [0, 0, null]);
});

test('one row per platform and per scenario, with counts, denominators and the small-platform note', () => {
  const s = report.summarize(RESULTS);
  assert.deepEqual(s.platforms.map((p) => [p.platform, p.cases, p.judged, p.passed, p.failed, p.inconclusive, p.pass.rate]), [
    ['google', 2, 2, 1, 1, 0, 0.5], ['microsoft', 2, 2, 1, 1, 0, 0.5], ['okta', 2, 0, 0, 0, 2, null],
  ]);
  assert.ok(s.platforms.every((p) => p.note === report.SMALL_PLATFORM_NOTE));
  assert.equal(report.SMALL_PLATFORM_NOTE, 'fewer than 10 cases: cannot support a platform claim');
  const many = report.summarize(Array.from({ length: 10 }, (_, i) => mk(`M${i}`, 'fleet', 's', 'R0', 'PASS')));
  assert.equal(many.platforms[0].note, null);
  assert.deepEqual(s.scenarios.map((x) => [x.scenario, x.cases, x.passed, x.judged]), [['s1', 2, 1, 2], ['s2', 2, 1, 2], ['s3', 2, 0, 0]]);
});

test('results.json and report.md carry the label; the terminal line shows id, verdict and score only', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-judged-report-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const summary = report.summarize(RESULTS, { baseline: BASELINE });
  const files = report.writeReport(dir, { run_id: 'r1', started: 's', finished: 'f', config: { max_turns: 24, timeout_ms: 1, web: false, judge_model: null }, sut_models: ['m'], judge_models: [], summary, cases: RESULTS });
  const json = JSON.parse(fs.readFileSync(files.json, 'utf8'));
  assert.equal(json.label, 'simulated: model-judged on a case file, no real tenant');
  assert.equal(json.summary.label, report.LABEL);
  const md = fs.readFileSync(files.markdown, 'utf8');
  assert.ok(md.includes(report.LABEL));
  assert.ok(md.includes('| okta | 2 | 0 | 0 | 0 | 2 | 0/0 (n/a) | fewer than 10 cases: cannot support a platform claim |'));
  assert.ok(md.includes('2/4 (50.0%) (B, E)'), 'regressions in the page');
  assert.ok(!md.includes('SECRET-ANSWER-TEXT'), 'answers stay in results.json');
  assert.equal(report.terminalLine(RESULTS[0]), 'A PASS 20/20');
  assert.equal(report.terminalLine(RESULTS[5]), 'F INCONCLUSIVE n/a');
});

test('nearest-rank percentile and the baseline reader', (t) => {
  assert.equal(report.percentile([], 50), null);
  assert.equal(report.percentile([7], 95), 7);
  assert.equal(report.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
  assert.equal(report.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-judged-baseline-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, '{"cases": [{"id": 1}]}');
  assert.throws(() => report.readBaseline(bad), /not a judged-eval results.json/);
});
