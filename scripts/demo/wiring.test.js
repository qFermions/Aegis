'use strict';
require('../adapters/socket-tripwire.js');
// wiring.test.js: the desk is documented and wired in (batch 6, task 6).
//
// EXPECTED DECISION (written before the docs)
// - scripts/demo/README.md says what is real and what is simulated, and shows the dry run, the real
//   run, a subset and the viewer; each command it shows parses with the real CLI.
// - CI runs the dry run and checks exit 4; CI never passes --execute.
// - node --test (which CI runs) picks up every test in scripts/demo/.
// - The explainer is under 60 lines; the quiz exists with its answers collapsed.
// A wrong implementation each catches: a README command with a flag the CLI dropped; a CI step that
// runs --execute or ignores the exit code; a test file named so node --test skips it.
// Run: node --test scripts/demo/wiring.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const desk = require('./customer-desk.js');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('the README says what is real, what is simulated, where results go and what it costs', () => {
  const text = read('scripts/demo/README.md');
  for (const needle of ['## What is real', '## What is simulated', 'SIMULATED OPERATOR', '~/aegis-demo-runs/', '--results-dir', 'total_cost_usd', '2.50', 'AEGIS ADVISES; HUMANS EXECUTE']) {
    assert.ok(text.includes(needle), needle);
  }
  assert.ok(text.includes('It shows the pipeline, not answer quality.'));
});

test('every desk command the README shows parses with the real CLI', async () => {
  const text = read('scripts/demo/README.md');
  const lines = [...text.matchAll(/^node scripts\/demo\/customer-desk\.js(.*)$/gm)].map((m) => m[1].trim());
  const shown = lines.join('\n');
  assert.ok(lines.length >= 4, 'dry run, real run, subset and viewer');
  assert.ok(lines.includes(''), 'the plain dry run');
  assert.match(shown, /^run --execute$/m);
  assert.match(shown, /^run --only T4,T6 --execute$/m);
  assert.match(shown, /^--view /m);
  for (const line of lines) {
    // each runs as a dry run here: --execute is taken out, so nothing starts; a view needs a folder
    if (line.startsWith('--view')) continue;
    const argv = line.split(/\s+/).filter((a) => a && a !== '--execute');
    const out = [];
    const code = await desk.main(argv, { HOME: '/nonexistent-home-for-the-wiring-test' }, { out: (s) => out.push(s), err: (s) => out.push(s), spawn: () => { throw new Error('no process'); } });
    assert.equal(code, 4, `${line}: ${out.join('')}`);
  }
});

test('CI runs the dry run and checks exit 4, and never starts a model', () => {
  const ci = read('.github/workflows/ci.yml');
  const at = ci.indexOf('node scripts/demo/customer-desk.js');
  assert.ok(at > 0, 'a CI step runs the desk');
  const step = ci.slice(ci.lastIndexOf('- name:', at), ci.indexOf('test "$code" -eq 4', at) + 20);
  assert.match(step, /node scripts\/demo\/customer-desk\.js\n/, 'the plain dry run');
  assert.match(step, /test "\$code" -eq 4/);
  assert.doesNotMatch(ci, /customer-desk\.js[^\n]*--execute/);
  assert.match(ci, /run: node --test\n/);
});

test('every test in scripts/demo is one node --test picks up', () => {
  const files = fs.readdirSync(path.join(ROOT, 'scripts', 'demo'), { recursive: true }).map(String).filter((f) => f.endsWith('.js') && /test/i.test(f));
  assert.deepEqual(files.sort(), ['customer-desk.test.js', 'customers.test.js', 'render.test.js', 'wiring.test.js']);
});

test('the explainer is under 60 lines and the quiz keeps its answers collapsed', () => {
  const explainer = read('docs/explainers/batch6-customer-desk.md');
  assert.ok(explainer.split('\n').length < 60, `${explainer.split('\n').length} lines`);
  assert.ok(explainer.includes('scripts/demo/README.md'));
  const quiz = read('docs/explainers/batch6-customer-desk-quiz.md');
  assert.equal((quiz.match(/^\d\. /gm) || []).filter(Boolean).length >= 5, true, 'five questions');
  assert.match(quiz, /<details>/);
});

test('no file of this batch holds a long dash', () => {
  for (const dir of ['scripts/demo', 'docs/aegis/demo', 'docs/explainers']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir), { recursive: true }).map(String)) {
      const file = path.join(ROOT, dir, f);
      if (!fs.statSync(file).isFile() || /\.png$/.test(f)) continue;
      if (dir === 'docs/explainers' && !f.startsWith('batch6-')) continue;
      assert.ok(!fs.readFileSync(file, 'utf8').includes('—'), path.join(dir, f));
    }
  }
});
