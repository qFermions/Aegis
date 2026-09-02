#!/usr/bin/env node
'use strict';
// ms-ticket-eval.test.js — wires the deterministic Microsoft ticket eval into the
// standard battery (`node --test`) and pins the corpus shape so it cannot decay
// into a trivial suite.
// Run: node --test scripts/eval/ms-ticket-eval.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { evaluate } = require('./ms-ticket-eval.js');
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'ms-tickets.json'), 'utf8'));

test('corpus covers the representative Microsoft ticket classes and workloads', () => {
  const classes = new Set(corpus.tickets.map((t) => t.class));
  assert.deepEqual([...classes].sort(), ['DIAGNOSTIC', 'PROCEDURE', 'QUICK_FIX', 'REFERENCE']);
  const routed = new Set(corpus.tickets.flatMap((t) => t.route));
  for (const must of ['password-reset', 'mfa-issue', 'ad-connect', 'license-audit', 'shared-mailbox', 'mailbox-permissions', 'email-quarantine', 'distribution-list', 'conditional-access', 'teams-issue', 'onedrive-issue', 'sharepoint-access', 'new-device-setup', 'intune-compliance', 'new-user', 'offboard', 'device-wipe', 'security-alert-triage']) {
    assert.ok(routed.has(must), `corpus must exercise /${must}`);
  }
  assert.ok(corpus.tickets.length >= 25, 'corpus size');
  assert.ok(corpus.tickets.filter((t) => t.expectFloor === 'T3').length >= 6, 'enough consequential tickets to exercise the floor');
  const { sanitizationHits } = require('../replay/replay-cli.js');
  for (const t of corpus.tickets) assert.deepEqual(sanitizationHits(t.text), [], `${t.id}: corpus text must carry no real email/phone/secret-shaped content`);
});

test('deterministic half passes: floors, route lint, first-occurrence MISS, dangerous pairs', () => {
  const res = evaluate();
  const failures = [
    ...res.rows.filter((r) => !r.ok).map((r) => `${r.id}: ${r.problems.join(' | ')}`),
    ...res.pairs.filter((p) => !p.ok).map((p) => `pair ${p.a}/${p.b}: ${p.problems.join(' | ')}`),
  ];
  assert.deepEqual(failures, []);
  assert.equal(res.ok, true);
  assert.ok(res.summary.commandsCovered >= 18);
});

test('the eval checks implementation, not fixtures: a mutated expectation, a dangling route, and a colliding pair all fail', () => {
  const mutated = JSON.parse(JSON.stringify(corpus));
  const wipe = mutated.tickets.find((x) => x.id === 'T20-device-wipe-stolen');
  wipe.expectFloor = 'none'; // a wipe ticket can never be floor=none — the evaluator must disagree
  const dl = mutated.tickets.find((x) => x.id === 'T12-dl-add-member');
  dl.route = ['does-not-exist'];
  mutated.dangerousPairs.push({ why: 'identical text can never be a safe pair', a: 'T03-mfa-new-phone', b: 'T03-mfa-new-phone', floorsMustDiffer: true });
  const res = evaluate(mutated);
  assert.equal(res.ok, false);
  const wipeRow = res.rows.find((r) => r.id === 'T20-device-wipe-stolen');
  assert.ok(wipeRow.problems.some((p) => /floor T3, expected none/.test(p)), wipeRow.problems.join(' | '));
  const dlRow = res.rows.find((r) => r.id === 'T12-dl-add-member');
  assert.ok(dlRow.problems.some((p) => /does not exist/.test(p)));
  const badPair = res.pairs.find((p) => p.a === p.b);
  assert.ok(badPair.problems.some((p) => /collide/.test(p)) && badPair.problems.some((p) => /floors do not differ/.test(p)));
  // and the untouched corpus still passes — the failures above come from the mutations, not from the evaluator
  assert.equal(evaluate().ok, true);
});
