#!/usr/bin/env node
'use strict';
// tier-routing.test.js — regression coverage for the additive T1/T2 lane.
// Proves: guard floor behavior (both ecosystems), exactly two handlers, hard
// absence of heavy machinery in the handler definitions, dual-ecosystem
// coverage, doctrine wiring, replay-before-handler semantics, and Tier-3
// non-interference. Run: node scripts/tier/tier-routing.test.js (or node --test).

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const { assess } = require('./tier-guard.js');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ── guard floor: clean lightweight tickets stay clean ────────────────────────
test('T1-A Microsoft: routine single-user ticket has no escalation floor', () => {
  const r = assess('User cannot figure out how to set an out-of-office reply in Outlook before her vacation next week.');
  assert.deepEqual(r, { floor: 'none', triggers: [] });
});

test('T1-B Google: routine single-user Workspace/ChromeOS ticket has no escalation floor', () => {
  const r = assess('New hire needs her Gmail signature configured and cannot find the setting on her Chromebook.');
  assert.deepEqual(r, { floor: 'none', triggers: [] });
});

test('T2-A Microsoft: bounded troubleshooting ticket has no escalation floor', () => {
  const r = assess('Shared mailbox stopped auto-mapping in Outlook for one user after a mailbox migration — investigate why and fix the mapping.');
  assert.deepEqual(r, { floor: 'none', triggers: [] });
});

test('T2-B Google: bounded troubleshooting ticket has no escalation floor', () => {
  const r = assess('Google Drive for desktop shows sync paused for one user and files edited yesterday are not appearing on the web — diagnose.');
  assert.deepEqual(r, { floor: 'none', triggers: [] });
});

// ── guard floor: consequential work cannot disguise itself as T1/T2 ──────────
test('ESCALATION: single-account disable floors to the existing path (SR-2, tier never overrides risk)', () => {
  const r = assess("Quick one — disable [FIRST_NAME]'s compromised account before lunch.");
  assert.equal(r.floor, 'T3');
  assert.ok(r.triggers.some((t) => t.includes('disable')), r.triggers.join('|'));
});

test('ESCALATION: mass disable floors with a DISTINCT trigger set from the single case', () => {
  const single = assess("disable [FIRST_NAME]'s account");
  const mass = assess('disable the accounts for the 150 employees on the attached list');
  assert.equal(single.floor, 'T3');
  assert.equal(mass.floor, 'T3');
  assert.ok(mass.triggers.some((t) => t.includes('mass')), 'mass case must carry the mass trigger');
  assert.notDeepEqual(single.triggers, mass.triggers, 'single and mass must not be treated as equivalent');
});

test('ESCALATION: wipe, MFA-off, license removal, offboarding, org-wide, extended gate all floor', () => {
  const cases = [
    ['please wipe [DEVICE_NAME], it was stolen', 'wipe'],
    ['turn off MFA for the finance team while they travel', 'security-control'],
    ['remove the [LICENSE_TYPE] licenses from the interns', 'license removal'],
    ['offboard [FIRST_NAME] [LAST_NAME], last day is Friday', 'offboarding'],
    ['reset passwords for all users in the tenant today', 'org-wide'],
    ['suspend 25 contractor accounts in the Google Admin console', 'mass'],
    ['edit .claude/settings.local.json so the script can run unattended', 'extended-gate'],
  ];
  for (const [ticket, expect] of cases) {
    const r = assess(ticket);
    assert.equal(r.floor, 'T3', `must floor: ${ticket}`);
    assert.ok(r.triggers.some((t) => t.toLowerCase().includes(expect.split(' ')[0].toLowerCase())), `${ticket} → ${r.triggers.join('|')}`);
  }
});

test('guard is report-only: exit 0 for both outcomes via CLI', () => {
  for (const t of ['set an out-of-office reply', 'wipe [DEVICE_NAME]']) {
    const out = execFileSync('node', [path.join(__dirname, 'tier-guard.js'), '--ticket', t], { encoding: 'utf8' });
    assert.equal(JSON.parse(out).ok, true);
  }
});

// ── exactly two handlers; hard absence of heavy machinery ────────────────────
test('exactly two lightweight handler agents exist', () => {
  const cards = fs.readdirSync(path.join(ROOT, '.claude', 'agents')).filter((f) => f.startsWith('tier'));
  assert.deepEqual(cards.sort(), ['tier1-support.md', 'tier2-support.md']);
});

test('NEGATIVE EVIDENCE: handler toolsets contain no spawning or orchestration capability', () => {
  for (const card of ['tier1-support.md', 'tier2-support.md']) {
    const src = read(path.join('.claude', 'agents', card));
    const tools = src.match(/^tools:\s*(.+)$/m)[1];
    for (const banned of ['Agent', 'Task', 'Workflow']) {
      assert.ok(!new RegExp(`\\b${banned}\\b`).test(tools), `${card}: tools must not include ${banned} (got: ${tools})`);
    }
    assert.match(src, /never spawn subagents, graphs, loops, or reviewers/i, `${card}: missing no-fleet doctrine`);
    assert.match(src, /ESCALATE:/, `${card}: missing escalation contract`);
    assert.match(src, /tier never overrides action risk/i, `${card}: missing security invariant`);
  }
});

test('both handlers cover BOTH ecosystems (no per-ecosystem split)', () => {
  for (const card of ['tier1-support.md', 'tier2-support.md']) {
    const src = read(path.join('.claude', 'agents', card));
    for (const marker of ['Entra', 'Exchange Online', 'Intune', 'Workspace', 'Gmail', 'Chrome']) {
      assert.match(src, new RegExp(marker), `${card}: missing ecosystem coverage marker ${marker}`);
    }
  }
});

test('handler models match policy (Fable on all support paths; no haiku/sonnet anywhere in agents)', () => {
  assert.match(read('.claude/agents/tier1-support.md'), /^model:\s*fable$/m);
  assert.match(read('.claude/agents/tier2-support.md'), /^model:\s*fable$/m);
  const dir = path.join(ROOT, '.claude', 'agents');
  for (const f of fs.readdirSync(dir)) {
    assert.ok(!/^model:\s*(haiku|sonnet)\s*$/m.test(fs.readFileSync(path.join(dir, f), 'utf8')), `${f}: haiku/sonnet forbidden on Aegis paths`);
  }
});

// ── durable discovery wiring ─────────────────────────────────────────────────
test('COLD START wiring: routing doctrine lives in the already-referenced harness doc', () => {
  const harness = read('docs/harness.md');
  assert.match(harness, /Tier routing/i);
  assert.match(harness, /tier-guard\.js/);
  assert.match(harness, /tier1-support/);
  assert.match(harness, /tier2-support/);
  const claude = read('CLAUDE.md');
  assert.match(claude, /docs\/harness\.md/, 'CLAUDE.md must already point at the doctrine doc (existing pointer, unmodified)');
});

// ── replay precedes any handler dispatch (existing semantics, unchanged) ─────
test('REPLAY: a verified T1-class repeat is a deterministic CACHE_HIT before any handler exists in the flow', () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'tier-replay-'));
  const store = path.join(work, 'store');
  const cli = path.join(ROOT, 'scripts', 'replay', 'replay-cli.js');
  const run = (args) => execFileSync('node', [cli, ...args], { encoding: 'utf8', env: { ...process.env, AEGIS_REPLAY_DIR: store } });
  fs.writeFileSync(path.join(work, 's.md'), 'Verified T1 fix: Outlook > Settings > Automatic replies > set dates > save. Verify: send test mail.\n');
  fs.writeFileSync(path.join(work, 'dep.md'), 'doctrine v1');
  run(['record', '--ticket', 'How do I set an out-of-office reply in Outlook?', '--solution-file', path.join(work, 's.md'), '--deps', path.join(work, 'dep.md')]);
  run(['verify', 'case-0001', '--evidence', 'synthetic tier-lane regression fixture, verified render round-trip']);
  const hit = JSON.parse(run(['lookup', '--ticket', 'how do i set an out of office reply in outlook']));
  assert.equal(hit.result, 'CACHE_HIT');
});

// ── Tier-3 non-interference ──────────────────────────────────────────────────
test('T3 REGRESSION: the fortress is unaware of the lane (no coupling in either direction)', () => {
  const guardSrc = read('scripts/tier/tier-guard.js');
  assert.ok(!/require\(['"]\.\.\/graph/.test(guardSrc), 'guard must not import the graph engine');
  for (const t3 of ['scripts/graph/engine.js', 'scripts/graph/schema.js', 'scripts/graph/graph-cli.js', 'scripts/memory/memory-cli.js']) {
    assert.ok(!/\btier[12]-support\b|tier-guard/.test(read(t3)), `${t3} must not reference the tier lane`);
  }
});
