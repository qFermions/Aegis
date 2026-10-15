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

test('ESCALATION: a suspected compromise floors even when the wording looks like a routine MFA reset', () => {
  const routine = assess('[FIRST_NAME] got a new phone and MFA still points at the old Authenticator app.');
  const incident = assess('[FIRST_NAME] got a new phone, but we also suspect the account was compromised last week — reset MFA and lock it down.');
  assert.equal(routine.floor, 'none');
  assert.equal(incident.floor, 'T3');
  assert.ok(incident.triggers.some((t) => t.includes('compromise')), incident.triggers.join('|'));
  for (const t of ['user reports a phishing click and an unauthorized sign-in from abroad', 'mailbox was hacked, forwarding rules appeared']) {
    assert.equal(assess(t).floor, 'T3', `must floor: ${t}`);
  }
});

test('ESCALATION: SR-2 retire/delete-device/disable-mailbox wordings floor; confusable homoglyphs cannot hide a risk word', () => {
  for (const [t, want] of [
    ['Retire [DEVICE_NAME] in Intune for the departing staff member', 'retire'],
    ['Delete the [DEVICE_NAME] device record from Intune', 'deletion'],
    ['Disable the mailbox for [UPN] while legal reviews it', 'disable'],
    ['Please wıpe the lost phone for [UPN] today', 'wipe'], // dotless ı (U+0131)
    ['Dеlete the account for [UPN]', 'deletion'], // Cyrillic е (U+0435)
  ]) {
    const r = assess(t);
    assert.equal(r.floor, 'T3', `must floor: ${t}`);
    assert.ok(r.triggers.some((x) => x.toLowerCase().includes(want)), `${t} → ${r.triggers.join('|')}`);
  }
  const { foldConfusables } = require('./tier-guard.js');
  assert.equal(foldConfusables('wıpe dеlete'), 'wipe delete');
  assert.equal(assess('Add [UPN] to the café distribution list').floor, 'none', 'benign accented text is not floored');
  // invisible format characters and small capitals (second review)
  for (const cp of [0x200b, 0x200c, 0x200d, 0x00ad, 0x2060]) {
    const t = 'Please wi' + String.fromCharCode(cp) + 'pe the lost phone for [UPN] today';
    assert.equal(assess(t).floor, 'T3', `format character U+${cp.toString(16)} must not hide "wipe"`);
  }
  assert.equal(assess('ᴡipe [DEVICE_NAME]').floor, 'T3', 'small-capital w folds');
  assert.equal(assess('ｗｉｐｅ [DEVICE_NAME]').floor, 'T3', 'full-width letters fold via NFKD');
  // the graph engine's SR-2 scan folds the same way (kept in sync without importing the lane)
  const engine = require('../graph/engine.js');
  if (typeof engine.scanSr2Triggers === 'function') {
    const plan = { steps: [{ action: 'Please wı' + String.fromCharCode(0x200b) + 'pe [DEVICE_NAME]' }, { action: 'Disable the mailbox for [UPN]' }] };
    const hits = engine.scanSr2Triggers(plan);
    assert.ok(hits.some((h) => /wipe/.test(h)) && hits.some((h) => /mailbox disable/.test(h)), hits.join('|'));
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

test('a dot inside a token ([first.last], DOMAIN.COM, file names) is not a sentence end — existing floors hold', () => {
  for (const t of [
    "Disable [first.last]'s account today",
    "Delete [first.last]'s mailbox before Friday",
    'Remove [first.last] from the finance group',
    'Remove the [first.last] licence',
    'Revoke [USER@DOMAIN.COM] sessions',
    'Exclude [first.last] from the MFA policy',
  ]) assert.equal(assess(t).floor, 'T3', `must floor: ${t}`);
  // a real sentence end still bounds a pattern: two unrelated sentences do not combine
  assert.equal(assess('Disable the screen saver. The user account is fine.').floor, 'none');
  // the dotted extended-gate literal still matches
  assert.equal(assess('edit .claude/settings.local.json').floor, 'T3');
});

// ── G1: Google Workspace / Okta / Jamf consequential wordings ────────────────
// Each new floor has a ticket that must floor (guard AND graph engine, kept in
// sync) and a routine Google-lane counterpart that must stay clean.
const G1_FLOORS = [
  ['transfer', "Transfer [USER@DOMAIN.COM]'s Drive ownership to [MANAGER_UPN] before the account is closed."],
  ['transfer', 'Transfer the Calendar data from [USER@DOMAIN.COM] to [MANAGER_UPN] this afternoon.'],
  ['deprovision', 'Deprovision the Chromebook [DEVICE_ID] in the Admin console; it is leaving the fleet.'],
  ['deprovision', 'Please de-provision [DEVICE_ID] so it stops counting against our upgrades.'],
  ['powerwash', 'Powerwash the Chromebook [DEVICE_ID] remotely, the screen is frozen.'],
  ['work-profile', "Remove the work profile from [FIRST_NAME]'s Android phone, they are switching phones."],
  ['work-profile', "Clear [USER@DOMAIN.COM]'s account off the shared Chromebook in the front office."],
  ['oauth', "Revoke the OAuth tokens for the unknown app on [USER@DOMAIN.COM]'s account."],
  ['oauth', 'Revoke all app passwords for [USER@DOMAIN.COM] and their access tokens.'],
  ['admin-role', 'Make [USER@DOMAIN.COM] a super admin in the Admin console for the migration.'],
  ['admin-role', 'Assign the Help Desk Admin role to [USER@DOMAIN.COM] so they can reset passwords.'],
  ['hold', 'Put [USER@DOMAIN.COM] on a Vault hold before anything is cleaned up.'],
  ['hold', 'Change the Vault retention rule for Gmail to ninety days.'],
  ['hold', 'Legal asked for a litigation hold on [USER@DOMAIN.COM].'],
  ['okta', 'Okta: deactivate [UPN] today, HR confirmed.'],
  ['okta', 'Clear all Okta sessions for [UPN] right now.'],
  ['okta', 'Reset all factors for [UPN] in Okta.'],
  ['okta', 'Deprovision [UPN] from Okta and every assigned app.'],
  ['jamf', 'Jamf: send Erase Computer to [SERIAL_NUMBER], the Mac was stolen.'],
  ['jamf', 'Remote lock the MacBook [SERIAL_NUMBER] in Jamf.'],
  ['jamf', 'Put the iPad [SERIAL_NUMBER] in Lost Mode.'],
  ['jamf', 'Remove the MDM profile from [DEVICE_NAME].'],
  ['jamf', 'Unmanage [SERIAL_NUMBER] in Jamf Pro.'],
];
const G1_LABEL_WORD = {
  transfer: /transfer/i, deprovision: /deprovision/i, powerwash: /powerwash/i, 'work-profile': /work-profile|deletion/i,
  oauth: /oauth|app-password/i, 'admin-role': /admin-role/i, hold: /hold|retention/i, okta: /okta|disable/i, jamf: /jamf|wipe/i,
};
const G1_ROUTINE = [
  'Reset the 2-Step Verification backup codes for [USER@DOMAIN.COM]; they lost the printed sheet.',
  'Add [USER@DOMAIN.COM] to the [GROUP_EMAIL] group so they get the team mail.',
  'Move [USER@DOMAIN.COM] to the [OU_PATH] organizational unit after their team change.',
  'Assign one Google Workspace licence to [USER@DOMAIN.COM] for their start date.',
  'Enroll one new Mac in Jamf through Automated Device Enrollment for the new hire.',
  'Okta: reset the password for [UPN] and send the reset link.',
  'Assign the [APP_NAME] app to [UPN] in Okta.',
  'The Chromebook [DEVICE_ID] cannot join the office Wi-Fi.',
  'Look up the Drive log events for a shared file in the audit log.',
];

test('G1 ESCALATION: every new Google/Okta/Jamf consequential wording floors in the guard and the graph engine', () => {
  const engine = require('../graph/engine.js');
  const misses = [];
  for (const [kind, ticket] of G1_FLOORS) {
    const r = assess(ticket);
    if (r.floor !== 'T3' || !r.triggers.some((t) => G1_LABEL_WORD[kind].test(t))) misses.push(`guard: ${ticket} → ${r.floor} ${r.triggers.join('|')}`);
    const hits = engine.scanSr2Triggers({ steps: [{ id: 's1', action: ticket, undo: '', verify: '' }], powershell: '' });
    if (!hits.some((h) => G1_LABEL_WORD[kind].test(h))) misses.push(`engine: ${ticket} → ${hits.join('|') || 'no hit'}`);
  }
  assert.deepEqual(misses, []);
});

test('G1 routine: the Google-lane counterparts (backup codes, add to group, move one OU, one licence, enroll one Mac) stay clean', () => {
  const engine = require('../graph/engine.js');
  for (const ticket of G1_ROUTINE) {
    assert.deepEqual(assess(ticket), { floor: 'none', triggers: [] }, ticket);
    assert.deepEqual(engine.scanSr2Triggers({ steps: [{ id: 's1', action: ticket, undo: '', verify: '' }], powershell: '' }), [], `engine: ${ticket}`);
  }
});

test('G1 folding: homoglyphs and invisible characters cannot hide a new floor (guard and engine)', () => {
  const engine = require('../graph/engine.js');
  const disguise = (text) => text
    .replace(/a/, 'а')      // Cyrillic a (U+0430)
    .replace(/o/, 'о')      // Cyrillic o (U+043E)
    .replace(/e/, 'е')      // Cyrillic e (U+0435)
    .replace(/(\w)(\w)/, '$1' + String.fromCharCode(0x200b) + '$2');  // zero-width space inside the first word
  const misses = [];
  for (const [kind, ticket] of G1_FLOORS) {
    const disguised = disguise(ticket);
    assert.notEqual(disguised, ticket);
    if (assess(disguised).floor !== 'T3') misses.push(`guard: ${JSON.stringify(disguised)}`);
    const hits = engine.scanSr2Triggers({ steps: [{ id: 's1', action: disguised, undo: '', verify: '' }], powershell: '' });
    if (!hits.some((h) => G1_LABEL_WORD[kind].test(h))) misses.push(`engine: ${JSON.stringify(disguised)}`);
  }
  assert.deepEqual(misses, []);
});
