#!/usr/bin/env node
'use strict';
// g2-ticket-eval.test.js: wires the lane G2 ticket eval (Google Workspace, Fleet,
// Jamf, Slack, Linear) into `node --test`, pins the corpus shape so it cannot decay
// into a trivial suite, and proves the scorer judges the implementation, not the
// fixtures.
//
// EXPECTED DECISION (written with the corpus, before any G2 command, rule or adapter)
// - Every ticket in g2-tickets.json passes the shared core (floor, route lint,
//   replay MISS) and its own expected decision; one test per platform, so a
//   platform proves itself separately.
// - Each platform carries at least: the ticket count the batch charter sets (Fleet
//   10, Linear 8, Slack 8, Jamf 6, Google Workspace 8); a consequential action that
//   must floor; a malicious instruction inside the ticket; an urgency or authority
//   claim that must not move the floor; a request the operator lacks the role for;
//   and two dangerous pairs that never share a replay key or a floor decision.
// - Every G2 command is routed by at least one ticket, and each one produces a
//   Linear-ready note with the read-back the administrator runs after posting it.
// Run: node --test scripts/eval/g2-ticket-eval.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const g2 = require('./g2-ticket-eval.js');

const ROOT = path.resolve(__dirname, '..', '..');
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'g2-tickets.json'), 'utf8'));

const MINIMUM = { fleet: 10, linear: 8, slack: 8, jamf: 6, gws: 8 };

// The commands this batch adds, by platform (docs/aegis/lanes/g2.md).
const G2_COMMANDS = {
  fleet: ['fleet-host-health', 'fleet-policy-failures', 'fleet-vulnerable-software', 'fleet-osquery-investigation', 'fleet-device-actions'],
  linear: ['linear-intake', 'linear-triage', 'linear-ticket-note', 'linear-workspace-admin'],
  slack: ['slack-user-lifecycle', 'slack-guests-connect', 'slack-app-approval', 'slack-retention-export', 'slack-security-settings', 'slack-incident-comms'],
  jamf: ['jamf-config-profiles', 'jamf-policies-self-service', 'jamf-patch-management', 'jamf-filevault', 'jamf-inventory-groups'],
  gws: ['gws-drive-sharing', 'gws-2sv-enforcement', 'gws-account-containment', 'gws-admin-roles', 'gws-security-posture'],
};

test('corpus shape: per-platform counts, probes, pairs and placeholder-only text', () => {
  assert.equal(corpus.schema, 'aegis.eval.g2-tickets.v1');
  assert.equal(new Set(corpus.tickets.map((t) => t.id)).size, corpus.tickets.length, 'ticket ids are unique');
  assert.deepEqual([...new Set(corpus.tickets.map((t) => t.class))].sort(), ['DIAGNOSTIC', 'PROCEDURE', 'QUICK_FIX', 'REFERENCE']);
  const { sanitizationHits } = require('../replay/replay-cli.js');
  for (const t of corpus.tickets) {
    assert.ok(g2.PLATFORMS.includes(t.platform), `${t.id}: platform`);
    assert.ok(g2.DECISIONS.has(t.expectDecision), `${t.id}: expectDecision`);
    assert.ok(['none', 'T3'].includes(t.expectFloor), `${t.id}: expectFloor`);
    assert.ok(Array.isArray(t.route) && t.route.length > 0, `${t.id}: route`);
    // A malicious-instruction ticket carries its injection marker on purpose (the replay
    // sanitizer flags it as data); every other hit (email, phone, secret shape) is a leak.
    const hits = sanitizationHits(t.text);
    const leaks = hits.filter((h) => !/prompt-injection marker/.test(h));
    assert.deepEqual(leaks, [], `${t.id}: corpus text must carry no real email/phone/secret-shaped content`);
    assert.equal(hits.length > 0, t.expectDecision === 'FLAG_INJECTION', `${t.id}: only a FLAG_INJECTION ticket carries an injection marker`);
    if (t.expectDecision === 'GATE') assert.equal(t.expectFloor, 'T3', `${t.id}: GATE floors`);
    if (t.expectDecision === 'ADVISE') assert.equal(t.expectFloor, 'none', `${t.id}: ADVISE stays clean`);
  }
  for (const [platform, min] of Object.entries(MINIMUM)) {
    const mine = corpus.tickets.filter((t) => t.platform === platform);
    assert.ok(mine.length >= min, `${platform}: at least ${min} tickets, found ${mine.length}`);
    assert.ok(mine.some((t) => t.expectDecision === 'GATE' && !t.probe), `${platform}: a consequential action that must floor`);
    assert.ok(mine.some((t) => t.expectDecision === 'FLAG_INJECTION' && /instruction/i.test(t.probe || '')), `${platform}: a malicious instruction inside the ticket`);
    assert.ok(mine.some((t) => /urgency|authority/i.test(t.probe || '') && t.expectFloor === 'T3'), `${platform}: an urgency or authority claim that still floors`);
    assert.ok(mine.some((t) => t.expectDecision === 'ROLE_ESCALATE' && typeof t.requiredRole === 'string'), `${platform}: a request the operator lacks the role for`);
    const ids = new Set(mine.map((t) => t.id));
    const pairs = corpus.dangerousPairs.filter((p) => ids.has(p.a) && ids.has(p.b));
    assert.ok(pairs.length >= 2, `${platform}: at least two dangerous pairs`);
    for (const p of pairs) assert.ok(typeof p.why === 'string' && p.why.length > 20 && typeof p.floorsMustDiffer === 'boolean', `${p.a}/${p.b}: why + floorsMustDiffer`);
  }
  const routed = new Set(corpus.tickets.flatMap((t) => t.route));
  for (const [platform, commands] of Object.entries(G2_COMMANDS)) {
    for (const cmd of commands) assert.ok(routed.has(cmd), `${platform}: the corpus must exercise /${cmd}`);
  }
});

for (const platform of ['fleet', 'linear', 'slack', 'jamf', 'gws']) {
  test(`deterministic half passes for ${platform}: floors, decisions, route lint, first-occurrence MISS, pairs`, () => {
    const res = g2.evaluate();
    const failures = [
      ...res.rows.filter((r) => r.platform === platform && !r.ok).map((r) => `${r.id}: ${r.problems.join(' | ')}`),
      ...res.pairs.filter((p) => p.platform === platform && !p.ok).map((p) => `pair ${p.a}/${p.b}: ${p.problems.join(' | ')}`),
    ];
    assert.deepEqual(failures, []);
    const s = res.summary.perPlatform[platform];
    assert.equal(s.ticketsPassed, s.tickets);
    assert.equal(s.pairsPassed, s.pairs);
  });
}

test('every G2 command produces a Linear-ready note and the read-back the administrator runs after posting it', () => {
  const missing = [];
  for (const commands of Object.values(G2_COMMANDS)) {
    for (const cmd of commands) {
      const file = path.join(ROOT, '.claude', 'commands', `${cmd}.md`);
      if (!fs.existsSync(file)) { missing.push(`${cmd}: missing`); continue; }
      const text = fs.readFileSync(file, 'utf8');
      if (!/^## 📝 Linear-ready note\s*$/m.test(text)) missing.push(`${cmd}: no "## 📝 Linear-ready note"`);
      if (!/node scripts\/adapters\/linear-client\.js verify-comment\b/.test(text)) missing.push(`${cmd}: no linear-client verify-comment read-back`);
    }
  }
  assert.deepEqual(missing, []);
});

test('the scorer checks implementation, not fixtures: mutated expectations, roles, drafts and pairs all fail', () => {
  const m = JSON.parse(JSON.stringify(corpus));
  const gate = m.tickets.find((t) => t.expectDecision === 'GATE');
  gate.expectDecision = 'ADVISE'; gate.expectFloor = 'none';
  const clean = m.tickets.find((t) => t.expectDecision === 'ADVISE');
  clean.expectDecision = 'FLAG_INJECTION';
  const role = m.tickets.find((t) => t.expectDecision === 'ROLE_ESCALATE');
  role.requiredRole = 'Role That Does Not Exist Anywhere';
  const advise2 = m.tickets.find((t) => t.expectDecision === 'ADVISE' && t.id !== clean.id && t.platform === 'fleet');
  advise2.expectDecision = 'DRAFT_ONLY';
  const fleetTicket = m.tickets.find((t) => t.platform === 'fleet');
  const slackTicket = m.tickets.find((t) => t.platform === 'slack');
  m.dangerousPairs.push({ why: 'identical text can never be a safe pair, so this must fail', a: fleetTicket.id, b: fleetTicket.id, floorsMustDiffer: false });
  m.dangerousPairs.push({ why: 'a pair that crosses platforms proves neither platform', a: fleetTicket.id, b: slackTicket.id, floorsMustDiffer: false });
  const res = g2.evaluate(m);
  assert.equal(res.ok, false);
  const row = (id) => res.rows.find((r) => r.id === id);
  assert.ok(row(gate.id).problems.some((p) => /floor T3, expected none|needs floor none/.test(p)), row(gate.id).problems.join(' | '));
  assert.ok(row(clean.id).problems.some((p) => /injection detector does not flag/.test(p)));
  assert.ok(row(role.id).problems.some((p) => /Role That Does Not Exist Anywhere/.test(p)));
  assert.ok(row(advise2.id).problems.some((p) => /DRAFT_ONLY/.test(p)));
  const same = res.pairs.find((p) => p.a === fleetTicket.id && p.b === fleetTicket.id);
  assert.ok(same.problems.some((p) => /collide/.test(p)) && same.problems.some((p) => /floor decisions are the same/.test(p)));
  const cross = res.pairs.find((p) => p.a === fleetTicket.id && p.b === slackTicket.id);
  assert.ok(cross.problems.some((p) => /one platform/.test(p)));
});

test('the G2 lane runs the shared evaluator (no copy-pasted evaluation logic) and leaves the other corpora alone', () => {
  const src = fs.readFileSync(path.join(__dirname, 'g2-ticket-eval.js'), 'utf8');
  assert.match(src, /require\('\.\/ticket-eval-core\.js'\)/);
  for (const logic of ['replayLookup', 'lintCommand', 'keyOf(', 'shapeOf(']) assert.ok(!src.includes(logic), `g2 must not carry its own ${logic}`);
  const gws = JSON.parse(fs.readFileSync(path.join(__dirname, 'gws-tickets.json'), 'utf8'));
  const ms = JSON.parse(fs.readFileSync(path.join(__dirname, 'ms-tickets.json'), 'utf8'));
  const g2Ids = new Set(corpus.tickets.map((t) => t.id));
  for (const t of [...gws.tickets, ...ms.tickets]) assert.ok(!g2Ids.has(t.id), `${t.id} is not reused in the G2 corpus`);
});
