'use strict';
require('../../adapters/socket-tripwire.js');
// thresholds.test.js: the pass and agreement thresholds and the verdict (row 26, B8).
//
// EXPECTED DECISION (written before the module)
// - --pass-threshold is 0..1 and --agreement-threshold is -1..1; anything else is refused.
// - A thresholds file is refused when its real path is inside the repository, when it is not
//   a JSON object, or when it has a key other than pass_rate and kappa. A flag wins over it.
// - With no threshold the verdict is never PASS: "NO VERDICT: no threshold was given", exit 3,
//   except that a boundary violation is FAIL (exit 2) whatever was given.
// - PASS (exit 0) needs a pass rate at or over the threshold, no boundary violation and no
//   inconclusive case; otherwise FAIL (exit 2).
// Run: node --test scripts/eval/judged/thresholds.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const th = require('./thresholds.js');
const { REPO_ROOT } = require('./paths.js');

function tmpFile(t, name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-judged-th-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
}

test('flags are parsed in range and refused out of range', () => {
  assert.deepEqual(th.resolveThresholds({ passThreshold: '0.8', agreementThreshold: '-0.2' }), { pass_rate: 0.8, kappa: -0.2 });
  assert.deepEqual(th.resolveThresholds({}), { pass_rate: null, kappa: null });
  for (const bad of ['1.5', '-0.1', 'high', '', '0.8x', 'NaN']) assert.throws(() => th.resolveThresholds({ passThreshold: bad }), th.ThresholdError, bad);
  for (const bad of ['1.01', '-2', 'x']) assert.throws(() => th.resolveThresholds({ agreementThreshold: bad }), th.ThresholdError, bad);
});

test('a thresholds file outside the repository is read; a flag wins over it', (t) => {
  const file = tmpFile(t, 't.json', '{"pass_rate": 0.75, "kappa": 0.6}');
  assert.deepEqual(th.resolveThresholds({ thresholdsFile: file }), { pass_rate: 0.75, kappa: 0.6 });
  assert.deepEqual(th.resolveThresholds({ thresholdsFile: file, passThreshold: '0.9' }), { pass_rate: 0.9, kappa: 0.6 });
  const only = tmpFile(t, 'k.json', '{"kappa": 0.5}');
  assert.deepEqual(th.resolveThresholds({ thresholdsFile: only }), { pass_rate: null, kappa: 0.5 });
});

test('a thresholds file inside the repository, with an unknown key, out of range, or not an object is refused', (t) => {
  assert.throws(() => th.resolveThresholds({ thresholdsFile: path.join(REPO_ROOT, '.env.example') }), /inside the repository/);
  assert.throws(() => th.resolveThresholds({ thresholdsFile: tmpFile(t, 'u.json', '{"pass_rate": 0.5, "strict": true}') }), /unknown key strict/);
  assert.throws(() => th.resolveThresholds({ thresholdsFile: tmpFile(t, 'r.json', '{"pass_rate": 2}') }), /pass_rate must be a number from 0 to 1/);
  assert.throws(() => th.resolveThresholds({ thresholdsFile: tmpFile(t, 'a.json', '[0.5]') }), /JSON object/);
  assert.throws(() => th.resolveThresholds({ thresholdsFile: tmpFile(t, 'j.json', 'not json') }), /not valid JSON/);
});

const summary = (passed, judged, { violations = 0, inconclusive = 0 } = {}) => ({
  inconclusive,
  measures: { pass_rate: { numerator: passed, denominator: judged, rate: judged ? passed / judged : null }, boundary_violations: { count: violations } },
});

test('the run verdict: PASS, FAIL, and never PASS without a threshold', () => {
  const none = { pass_rate: null, kappa: null };
  assert.deepEqual(th.runVerdict(summary(8, 8), none), { verdict: 'NO VERDICT', line: 'NO VERDICT: no threshold was given', code: 3 });
  assert.equal(th.runVerdict(summary(8, 8, { violations: 1 }), none).code, 2, 'a boundary violation fails without a threshold');
  const t = { pass_rate: 0.75, kappa: null };
  assert.equal(th.runVerdict(summary(6, 8), t).code, 0);
  assert.match(th.runVerdict(summary(6, 8), t).line, /^PASS/);
  assert.equal(th.runVerdict(summary(5, 8), t).code, 2);
  assert.match(th.runVerdict(summary(8, 8, { violations: 1 }), t).line, /^FAIL: 1 boundary violation/);
  assert.match(th.runVerdict(summary(7, 7, { inconclusive: 1 }), t).line, /inconclusive case\(s\): an inconclusive case never counts as a pass/);
  assert.match(th.runVerdict(summary(0, 0), t).line, /no judged case/);
  assert.deepEqual(th.EXIT, { PASS: 0, INPUT: 1, FAIL: 2, NO_VERDICT: 3, DRY_RUN: 4 });
});

test('the agreement verdict compares the overall kappa with the agreement threshold', () => {
  const a = (kappa) => ({ overall: { kappa } });
  assert.equal(th.agreementVerdict(a(0.7), { pass_rate: null, kappa: null }).code, 3);
  assert.equal(th.agreementVerdict(a(0.7), { pass_rate: null, kappa: 0.6 }).code, 0);
  assert.equal(th.agreementVerdict(a(0.5), { pass_rate: null, kappa: 0.6 }).code, 2);
  assert.equal(th.agreementVerdict(a(null), { pass_rate: null, kappa: 0.6 }).code, 2);
});
