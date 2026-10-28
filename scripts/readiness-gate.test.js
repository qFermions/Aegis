'use strict';
// readiness-gate.test.js: the production-readiness gate page (batch G3, task 1, check D1).
//
// EXPECTED DECISION (written before the page)
// - docs/aegis/production-readiness.md holds one row per criterion; every row names a
//   command (`node ...`), a repository file, or an owner action, and says who runs it:
//   "this batch" or "owner only".
// - The criteria the charter lists are all there: zero autonomous writes, deterministic
//   routing and floors, refused write-capable credentials, a tamper-evident audit trail,
//   failure messages, the latency budget, a model-judged run on held-out cases, an
//   operator validation sample, and vendor facts checked by hand. The last three are owner
//   only.
// - Every file and test the page names exists in the repository.
// - The page never marks the gate passed.
// Run: node --test scripts/readiness-gate.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'docs', 'aegis', 'production-readiness.md');

function criteria(text) {
  return text.split('\n').filter((l) => /^\| \d+ \|/.test(l)).map((l) => {
    const cells = l.split('|').slice(1, -1).map((c) => c.trim());
    return { n: Number(cells[0]), criterion: cells[1], proof: cells[2], who: cells[3], measure: cells[4] };
  });
}

test('every criterion names a command, a file or an owner action, and who runs it', () => {
  const rows = criteria(fs.readFileSync(FILE, 'utf8'));
  assert.ok(rows.length >= 9, `${rows.length} criteria`);
  for (const r of rows) {
    assert.ok(/`node [^`]+`|`(?:scripts|docs|modules)\/[^`]+`|\bthe owner\b|\bowner\b/.test(r.proof), `row ${r.n}: proof names a command, a file or an owner action`);
    assert.match(r.who, /^(?:this batch|owner only|this batch \(code\); owner \(deployment\))$/, `row ${r.n}: who`);
    assert.ok(r.measure.length > 10, `row ${r.n}: measure`);
  }
});

test('the charter criteria are all there, and the three that need the owner are labeled owner only', () => {
  const rows = criteria(fs.readFileSync(FILE, 'utf8'));
  const find = (re) => rows.find((r) => re.test(r.criterion));
  for (const re of [/autonomous writes/i, /routing and floors/i, /write-capable credentials/i, /audit trail/i, /failure state/i, /latency/i]) assert.ok(find(re), String(re));
  for (const re of [/held-out/i, /operator validation/i, /vendor facts/i]) {
    const r = find(re);
    assert.ok(r, String(re));
    assert.equal(r.who, 'owner only', String(re));
  }
});

test('every repository path the page names exists', () => {
  const text = fs.readFileSync(FILE, 'utf8');
  const paths = new Set([...text.matchAll(/((?:scripts|docs|modules)\/[A-Za-z0-9_./-]+\.(?:js|md|json))/g)].map((m) => m[1]));
  assert.ok(paths.size >= 10);
  const missing = [...paths].filter((p) => !fs.existsSync(path.join(ROOT, p)));
  assert.deepEqual(missing, []);
});

test('the page never marks the gate passed', () => {
  const text = fs.readFileSync(FILE, 'utf8');
  assert.match(text, /\*\*Status: NOT PASSED\.\*\*/);
  assert.ok(!/Status:\s*PASSED/i.test(text.replace(/NOT PASSED/g, '')));
});
