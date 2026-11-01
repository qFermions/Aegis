'use strict';
// wiring.test.js: the judged-eval runner is documented and wired in (batch G4, task B10).
//
// EXPECTED DECISION (written before the docs)
// - scripts/eval/README.md has a section on the runner: the dry run, --execute, calibration,
//   thresholds, where case files and results live, and the "simulated" label.
// - Readiness row 9 names the runner command and the calibration step, stays owner only, and the
//   gate still reads NOT PASSED.
// - Capability-map row 26 reads "implemented but unverified" (no real run yet) and names the runner.
// - CI dry-runs the runner on the DEV set copied out of the repository; its unit tests run in
//   node --test, which CI runs.
// - The explainer docs/explainers/g4-eval-and-closeout.md exists and is under 60 lines.
// Run: node --test scripts/eval/judged/wiring.test.js

require('../../adapters/socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('the eval README has a section on the runner with its commands, locations and label', () => {
  const text = read('scripts/eval/README.md');
  const at = text.indexOf('## 2d. Model-judged runner');
  assert.ok(at > 0, 'a 2d section');
  const section = text.slice(at, text.indexOf('\n## ', at + 5));
  for (const needle of ['node scripts/eval/judged-eval.js run --cases', '--execute', 'node scripts/eval/judged-eval.js calibrate --sheet', '--calibration-sheet', '--pass-threshold', '--agreement-threshold', '.aegis-state/evals/', 'simulated: model-judged on a case file, no real tenant', 'dev-cases.jsonl', 'outside the repository']) {
    assert.ok(section.includes(needle), `the section names ${needle}`);
  }
});

test('readiness row 9 names the runner and the calibration step, stays owner only, and the gate reads NOT PASSED', () => {
  const text = read('docs/aegis/production-readiness.md');
  assert.match(text, /\*\*Status: NOT PASSED\.\*\*/);
  const row = text.split('\n').find((l) => l.startsWith('| 9 |'));
  assert.ok(row, 'row 9');
  assert.match(row, /`node scripts\/eval\/judged-eval\.js run --cases [^`]+ --execute`/);
  assert.match(row, /`node scripts\/eval\/judged-eval\.js calibrate --sheet [^`]+ --run [^`]+`/);
  assert.match(row, /\| owner only \|/);
});

test('capability-map row 26 reads implemented but unverified and names the runner', () => {
  const row = read('docs/aegis/capability-map.md').split('\n').find((l) => l.startsWith('| 26 |'));
  assert.ok(row, 'row 26');
  assert.match(row, /\| implemented but unverified \|/);
  assert.match(row, /scripts\/eval\/judged-eval\.js/);
});

test('CI dry-runs the runner on the DEV set copied out of the repository, and runs node --test', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /run: node --test\n/);
  assert.match(ci, /cp scripts\/eval\/judged\/dev-cases\.jsonl "\$RUNNER_TEMP\/dev-cases\.jsonl"/);
  assert.match(ci, /node scripts\/eval\/judged-eval\.js run --cases "\$RUNNER_TEMP\/dev-cases\.jsonl"/);
  assert.doesNotMatch(ci, /judged-eval\.js[^\n]*--execute/, 'CI never runs the real backends');
});

test('the explainer exists and is under 60 lines', () => {
  const text = read('docs/explainers/g4-eval-and-closeout.md');
  assert.ok(text.split('\n').length < 60, `${text.split('\n').length} lines`);
  assert.match(text, /judged-eval\.js/);
});
