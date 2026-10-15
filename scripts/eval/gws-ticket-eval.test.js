#!/usr/bin/env node
'use strict';
// gws-ticket-eval.test.js — wires the deterministic Google Workspace / Okta / Jamf
// ticket eval into the standard battery (`node --test`), pins the corpus shape
// so it cannot decay into a trivial suite, and proves both lanes run one shared
// evaluator.
// Run: node --test scripts/eval/gws-ticket-eval.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { evaluate } = require('./gws-ticket-eval.js');
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'gws-tickets.json'), 'utf8'));

// The Phase-3 command surface this corpus must exercise (every one of the 19).
const MUST_EXERCISE = [
  'gws-new-user', 'gws-offboard', 'gws-password-reset', 'gws-2sv-reset', 'gws-group-membership', 'gws-ou-move',
  'gws-license-assign', 'gws-drive-transfer', 'gws-audit-log', 'gws-chromeos-device', 'okta-app-assignment',
  'okta-mfa-reset', 'okta-user-lifecycle', 'jamf-enroll-mac', 'jamf-lock-erase', 'mac-new-hire-laptop',
  'gws-gmail-delivery', 'mac-troubleshoot', 'zoom-room-issue',
];

test('corpus covers the representative Google Workspace / Okta / Jamf / macOS ticket classes and duties', () => {
  const classes = new Set(corpus.tickets.map((t) => t.class));
  assert.deepEqual([...classes].sort(), ['DIAGNOSTIC', 'PROCEDURE', 'QUICK_FIX', 'REFERENCE']);
  const routed = new Set(corpus.tickets.flatMap((t) => t.route));
  for (const must of MUST_EXERCISE) assert.ok(routed.has(must), `corpus must exercise /${must}`);
  assert.ok(corpus.tickets.length >= 28, 'corpus size');
  assert.ok(corpus.tickets.filter((t) => t.expectFloor === 'T3').length >= 7, 'enough consequential tickets to exercise the floor');
  assert.ok(corpus.dangerousPairs.length >= 6, 'at least six dangerous pairs');
  assert.ok(corpus.dangerousPairs.filter((p) => p.floorsMustDiffer).length >= 3, 'at least three pairs must floor apart');
  for (const p of corpus.dangerousPairs) assert.ok(typeof p.why === 'string' && p.why.length > 20 && typeof p.floorsMustDiffer === 'boolean', `${p.a}/${p.b}: why + floorsMustDiffer`);
  assert.equal(new Set(corpus.tickets.map((t) => t.id)).size, corpus.tickets.length, 'ticket ids are unique');
  const { sanitizationHits } = require('../replay/replay-cli.js');
  for (const t of corpus.tickets) assert.deepEqual(sanitizationHits(t.text), [], `${t.id}: corpus text must carry no real email/phone/secret-shaped content`);
  // the probes the batch requires: a pasted urgency/authority bypass and a suspected compromise
  assert.ok(corpus.tickets.some((t) => t.probe && /urgency/i.test(t.probe) && t.expectFloor === 'T3'), 'urgency-bypass probe present and floored');
  assert.ok(corpus.tickets.some((t) => (t.expectTriggers || []).includes('compromise')), 'suspected-compromise variant present');
});

test('deterministic half passes: floors, route lint, first-occurrence MISS, dangerous pairs', () => {
  const res = evaluate();
  const failures = [
    ...res.rows.filter((r) => !r.ok).map((r) => `${r.id}: ${r.problems.join(' | ')}`),
    ...res.pairs.filter((p) => !p.ok).map((p) => `pair ${p.a}/${p.b}: ${p.problems.join(' | ')}`),
  ];
  assert.deepEqual(failures, []);
  assert.equal(res.ok, true);
  assert.ok(res.summary.commandsCovered >= MUST_EXERCISE.length);
});

test('the eval checks implementation, not fixtures: a mutated expectation, a dangling route, and a colliding pair all fail', () => {
  const mutated = JSON.parse(JSON.stringify(corpus));
  const wipe = mutated.tickets.find((x) => x.id === 'G29-jamf-erase-stolen');
  wipe.expectFloor = 'none'; // a Jamf wipe ticket can never be floor=none — the evaluator must disagree
  const group = mutated.tickets.find((x) => x.id === 'G05-group-add-member');
  group.route = ['does-not-exist'];
  mutated.dangerousPairs.push({ why: 'identical text can never be a safe pair', a: 'G22-okta-password-reset', b: 'G22-okta-password-reset', floorsMustDiffer: true });
  const res = evaluate(mutated);
  assert.equal(res.ok, false);
  const wipeRow = res.rows.find((r) => r.id === 'G29-jamf-erase-stolen');
  assert.ok(wipeRow.problems.some((p) => /floor T3, expected none/.test(p)), wipeRow.problems.join(' | '));
  const groupRow = res.rows.find((r) => r.id === 'G05-group-add-member');
  assert.ok(groupRow.problems.some((p) => /does not exist/.test(p)));
  const badPair = res.pairs.find((p) => p.a === p.b);
  assert.ok(badPair.problems.some((p) => /collide/.test(p)) && badPair.problems.some((p) => /floors do not differ/.test(p)));
  // and the untouched corpus still passes — the failures above come from the mutations, not from the evaluator
  assert.equal(evaluate().ok, true);
});

test('both lanes run one shared evaluator (no copy-pasted evaluation logic)', () => {
  const core = require('./ticket-eval-core.js');
  for (const file of ['ms-ticket-eval.js', 'gws-ticket-eval.js']) {
    const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.match(src, /require\('\.\/ticket-eval-core\.js'\)/, `${file} must use the shared core`);
    for (const logic of ['replayLookup', 'lintCommand', 'assess(', 'keyOf(', 'shapeOf(']) {
      assert.ok(!src.includes(logic), `${file} must not carry its own evaluation logic (${logic})`);
    }
  }
  // the Microsoft corpus still evaluates identically through the core
  const ms = require('./ms-ticket-eval.js').evaluate();
  const direct = core.evaluate(JSON.parse(fs.readFileSync(path.join(__dirname, 'ms-tickets.json'), 'utf8')));
  assert.deepEqual(ms.summary, direct.summary);
});
