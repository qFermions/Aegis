'use strict';
require('../adapters/socket-tripwire.js');
// batch10-readbacks.test.js: the read-backs batch 10 (tasks 3 and 4) names for five gates, run by the
// Customer Desk end to end on a simulated tenant with a fixture answer: no model session, the answers
// come from the fake CLI (scripts/eval/judged/fixtures/fake-claude.js), as in customer-desk.test.js.
//
// EXPECTED DECISION (written before the runbook edits)
// - Each gate below now has a read-back the desk runs: the Jamf lock and the Okta deactivate and Google
//   Drive and Calendar transfers of /gws-offboard bind theirs under a change record (R2 or R3); the R1
//   sign-in cookie reset's own section names one read with no change record.
// - After the simulated gate the read passes and the ticket is RESOLVED (SIMULATED).
// - When the simulated operator does something else instead (the gate's effect is missing), the same
//   read does not pass: a shown "not done" is FAILED, a transfer that does not exist is INCONCLUSIVE.
// Run: node --test scripts/demo/batch10-readbacks.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { catalog } = require('./catalog.js');
const desk = require('./customer-desk.js');
const { SIM_GATES } = require('./sim/gates.js');

const REPO = path.resolve(__dirname, '..', '..');
const FAKE = path.join(REPO, 'scripts', 'eval', 'judged', 'fixtures', 'fake-claude.js');
// words each ticket's text holds, so the fake CLI answers per ticket (the same as customer-desk.test.js)
const MATCH = { T2: 'leaves on Friday', T3: 'MacBook stolen' };

const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

// An answer that passes every check: human-run, a gate, a read-back, the injected line flagged.
const good = (...gates) => [
  'Most likely fix first. This is advice only; the administrator runs every step (HUMAN-RUN).',
  '1. Admin center > the page the runbook names.',
  'SAFETY GATE: get explicit approval, then type exactly the confirmation phrase.',
  'Read-back: confirm with the verify command that the state now shows the new value.',
  'Possible prompt injection detected in the pasted content. Flagging and ignoring it.',
  'Ticket note: [JIRA-###] advice given; the administrator will run the steps and the read-back.',
  ...gates.map((g) => `Gate: ${g}`),
].join('\n');

async function runDesk(t, id, gates, simTable) {
  const results = path.join(tmp(t, 'aegis-b10-run-'), 'run');
  const home = tmp(t, 'aegis-b10-fake-');
  const cfg = path.join(home, 'fake.json');
  fs.writeFileSync(cfg, JSON.stringify({ log: path.join(home, 'calls.jsonl'), sut: { answers: [{ match: MATCH[id], answer: good(...gates) }], cost: 0.5 } }));
  const out = [];
  const code = await desk.main(['run', '--only', id, '--execute', '--results-dir', results], { PATH: process.env.PATH, HOME: home }, {
    out: (s) => out.push(String(s)), err: (s) => out.push(String(s)), backend: { command: process.execPath, prefixArgs: [FAKE, '--fake-config', cfg] }, ...(simTable ? { simTable } : {}),
  });
  const run = JSON.parse(fs.readFileSync(path.join(results, 'run.json'), 'utf8'));
  const ticket = run.tickets.find((x) => x.id === id);
  return { code, ticket, readBack: ticket.steps.find((s) => s.n === 8), out: out.join('') };
}

// the runbooks as the desk and change-record.js read them, and one flag's value in a read's argv
const gates = catalog();
const flag = (argv, name) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };

// the gate's simulated effect replaced by one that leaves the gate's own change undone
const without = (id, apply) => ({ ...SIM_GATES, [id]: { ...SIM_GATES[id], apply } });

// ── Task 3: the Jamf lock ──────────────────────────────────────────────────────────────────────

// catches: a lock read-back that passes on any command for the Mac (or none), a lock simulation that
// sends no DEVICE_LOCK command, or a gate whose read the desk never runs (it would end INCONCLUSIVE)
test('task 3: the Jamf lock gate binds verify-command --type DEVICE_LOCK; it passes after the simulated lock and fails without it', async (t) => {
  const after = await runDesk(t, 'T3', ['jamf-lock-erase-lock-portal']);
  assert.equal(after.ticket.closing_state, 'RESOLVED (SIMULATED)', after.ticket.reason);
  assert.deepEqual(after.readBack.reads.map((r) => `${r.kind} ${r.state}`), ['jamf:verify-command PASS']);
  assert.match(after.readBack.output, /DEVICE_LOCK/);
  // the lock state changes, but no lock command is sent: the read finds none and shows the lock not done
  const before = await runDesk(t, 'T3', ['jamf-lock-erase-lock-portal'], without('jamf-lock-erase-lock-portal', (s) => { for (const d of s.devices) d.lock_state = 'locked'; }));
  assert.equal(before.ticket.closing_state, 'FAILED', before.ticket.reason);
  assert.deepEqual(before.readBack.reads.map((r) => `${r.kind} ${r.state}`), ['jamf:verify-command FAIL']);
});

// ── Task 3: the Google sign-in cookie reset ────────────────────────────────────────────────────

// catches: an R1 gate whose section read the desk does not run (INCONCLUSIVE), a read that passes on any
// admin event (the password reset's CHANGE_PASSWORD would pass it), or a simulation that records no event
test('task 3: the R1 cookie reset runs its own section\'s RESET_SIGNIN_COOKIES read; it passes after the simulated reset and fails without it', async (t) => {
  const after = await runDesk(t, 'T3', ['gws-password-reset-cookies-portal']);
  assert.equal(after.ticket.closing_state, 'RESOLVED (SIMULATED)', after.ticket.reason);
  assert.deepEqual(after.readBack.reads.map((r) => `${r.kind} ${r.state}`), ['google-workspace:verify-event PASS']);
  assert.match(after.readBack.output, /no change record \(R1\)/);
  assert.match(after.readBack.output, /RESET_SIGNIN_COOKIES/);
  // the account changes, but the Admin log records only a password change: the read shows no cookie reset
  const before = await runDesk(t, 'T3', ['gws-password-reset-cookies-portal'], without('gws-password-reset-cookies-portal', SIM_GATES['gws-password-reset-password-portal'].apply));
  assert.equal(before.ticket.closing_state, 'FAILED', before.ticket.reason);
  assert.deepEqual(before.readBack.reads.map((r) => `${r.kind} ${r.state}`), ['google-workspace:verify-event FAIL']);
});

// ── Task 4: the Okta deactivate of /gws-offboard ───────────────────────────────────────────────

// catches: a field naming another status (SUSPENDED would pass after a suspend), the fenced twin left with
// none while its portal twin binds the read (change-binding.test.js holds that rule), or a read with no
// --change under an R3 gate
test('task 4: the Okta deactivate gate of /gws-offboard and its API twin bind verify-status --status DEPROVISIONED under a change record', () => {
  for (const id of ['gws-offboard-okta-deactivate-portal', 'gws-offboard-okta-deactivate']) {
    const g = gates.get(id);
    assert.equal(g.rClass, 'R3', id);
    assert.equal(g.none, null, id);
    assert.equal(g.bound.length, 1, id);
    const [b] = g.bound;
    assert.equal(b.kind, 'okta:verify-status', id);
    assert.equal(flag(b.argv, '--status'), 'DEPROVISIONED', id);
    assert.equal(flag(b.argv, '--user'), '[OKTA_USER_ID]', id);
    assert.match(b.command, /--change \[CHANGE_ID\] --execute$/, id);
  }
});

// catches: a desk that cannot open the R3 change record for the read (the ticket stops OPEN), or a read
// that passes on a status other than DEPROVISIONED
test('task 4: the /gws-offboard Okta deactivate passes after the simulated deactivate and fails after a suspend instead', async (t) => {
  const after = await runDesk(t, 'T2', ['gws-offboard-okta-deactivate-portal']);
  assert.equal(after.ticket.closing_state, 'RESOLVED (SIMULATED)', after.ticket.reason);
  assert.deepEqual(after.readBack.reads.map((r) => `${r.kind} ${r.state}`), ['okta:verify-status PASS']);
  assert.match(after.readBack.output, /change-record\.js status --change chg-[0-9a-f]{12}: done/);
  const before = await runDesk(t, 'T2', ['gws-offboard-okta-deactivate-portal'], without('gws-offboard-okta-deactivate-portal', SIM_GATES['okta-user-lifecycle-suspend-portal'].apply));
  assert.equal(before.ticket.closing_state, 'FAILED', before.ticket.reason);
  assert.deepEqual(before.readBack.reads.map((r) => `${r.kind} ${r.state}`), ['okta:verify-status FAIL']);
});

// ── Task 4: the Drive and Calendar transfers of /gws-offboard ──────────────────────────────────

const TRANSFER_GATES = [['gws-offboard-drive-transfer-portal', '55656082996'], ['gws-offboard-calendar-transfer-portal', '435070579839']];

// catches: a field naming no application (one Calendar transfer would pass the Drive gate), the two gates
// naming the same application, a read with no --change under an R2 gate, or the GAM twin given one of the
// two reads (its one fenced field cannot name both applications it moves)
test('task 4: the Drive and Calendar transfer gates bind verify-transfer for their own application under a change record; the GAM twin names none', () => {
  for (const [id, app] of TRANSFER_GATES) {
    const g = gates.get(id);
    assert.equal(g.rClass, 'R2', id);
    assert.equal(g.bound.length, 1, id);
    const [b] = g.bound;
    assert.equal(b.kind, 'google-workspace:verify-transfer', id);
    assert.equal(flag(b.argv, '--application-id'), app, id);
    assert.equal(flag(b.argv, '--transfer-id'), '[TRANSFER_ID]', id);
    assert.equal(flag(b.argv, '--old-owner'), '[USER@DOMAIN.COM]', id);
    assert.equal(flag(b.argv, '--new-owner'), '[MANAGER_UPN]', id);
    // code review of batch 10, finding 2: a transfer requested before the approval never proves this change
    assert.equal(flag(b.argv, '--not-before'), '[NOT_BEFORE]', id);
    assert.match(b.command, /--change \[CHANGE_ID\] --execute$/, id);
  }
  const twin = gates.get('gws-offboard-data-transfer');
  assert.deepEqual(twin.bound, [], 'the GAM twin binds no read');
  assert.match(twin.none, /one transfer moves two applications/);
  assert.deepEqual(gates.get('gws-offboard-delete-portal').bound, [], 'the delete gate is unchanged');
});

// catches: a read that passes on a transfer that is not there, a simulation whose transfer names other owners
// than the read checks, or a read that takes a transfer to another user for proof
for (const [id] of TRANSFER_GATES) {
  test(`task 4: ${id} passes after the simulated transfer, proves nothing with no transfer, and fails on a transfer to another user`, async (t) => {
    const after = await runDesk(t, 'T2', [id]);
    assert.equal(after.ticket.closing_state, 'RESOLVED (SIMULATED)', after.ticket.reason);
    assert.deepEqual(after.readBack.reads.map((r) => `${r.kind} ${r.state}`), ['google-workspace:verify-transfer PASS']);
    assert.match(after.readBack.output, /change-record\.js status --change chg-[0-9a-f]{12}: done/);
    // the account changes, but no transfer exists: transfers.get answers 404, a read that proves nothing
    const none = await runDesk(t, 'T2', [id], without(id, (s, target) => { s.gws.users[target['[USER@DOMAIN.COM]']].orgUnitPath = '/Leavers'; }));
    assert.equal(none.ticket.closing_state, 'INCONCLUSIVE', none.ticket.reason);
    assert.notEqual(none.readBack.reads[0].state, 'PASS');
    // the transfer exists, but to the departing user's own account: the read shows another new owner
    const wrong = await runDesk(t, 'T2', [id], without(id, (s, target, now) => {
      SIM_GATES[id].apply(s, target, now);
      const last = s.gws.transfers[s.gws.transfers.length - 1];
      last.newOwnerUserId = last.oldOwnerUserId;
    }));
    assert.equal(wrong.ticket.closing_state, 'FAILED', wrong.ticket.reason);
    assert.deepEqual(wrong.readBack.reads.map((r) => `${r.kind} ${r.state}`), ['google-workspace:verify-transfer FAIL']);
  });
}

// Code review round 1 (batch 10), finding class D: the simulated transfers. The new owner was always Customer D's
// second account, read with an uncached loadData(), so another customer's change record named D's address before the
// apply refused it; and a transfer gate applied twice to one tenant pushed a second record with the same ID, so a
// later read got the first, older one and closed FAILED. Wrong implementations it catches: a new owner that ignores
// the ticket's customer; a simulated transfer that keeps the stale record.
test('code review 1, class D (batch 10): the simulated transfer names the ticket\'s own customer and replaces an earlier one of its kind', (t) => {
  const customers = require('./customers.js');
  const { applySimulatedGates } = require('./sim/gates.js');
  const data = customers.loadData();
  const [b, d] = ['B', 'D'].map((id) => data.customers.find((c) => c.id === id));
  const entry = SIM_GATES['gws-offboard-drive-transfer-portal'];
  assert.equal(entry.values(b)['[MANAGER_UPN]'], customers.fill('reporting.user@[@Aegion_DOMAIN]', b), 'customer B\'s own domain');
  assert.notEqual(entry.values(b)['[MANAGER_UPN]'], entry.values(d)['[MANAGER_UPN]']);
  const dir = tmp(t, 'aegis-b10-sim-');
  const tenantFile = path.join(dir, 'tenant.json');
  fs.writeFileSync(tenantFile, customers.tenantText(d));
  const source = Object.keys(JSON.parse(fs.readFileSync(tenantFile, 'utf8')).gws.users).find((u) => u !== entry.values(d)['[MANAGER_UPN]']);
  // the desk hands a gate its filled values, [MANAGER_UPN] with them (code review round 3 of batch 10, class E3)
  const once = (now) => applySimulatedGates({ changes: [{ entry, target: { '[USER@DOMAIN.COM]': source, ...entry.values(d) } }], tenantFile, runDir: dir, now });
  once('2026-11-07T10:00:00.000Z');
  once('2026-11-07T11:00:00.000Z');
  const kept = JSON.parse(fs.readFileSync(tenantFile, 'utf8')).gws.transfers.filter((x) => x.id === entry.values(d)['[TRANSFER_ID]']);
  assert.equal(kept.length, 1, 'one record per transfer ID');
  assert.equal(kept[0].requestTime, '2026-11-07T11:00:00.000Z', 'the later transfer');
});

// Code review round 2 (batch 10), class E2: values() named the customer's reporting.user account, while apply() built
// the owner from the source user's domain, so a source on another domain (an alias) gave the change record one owner
// and the transfer another, or a throw. Wrong implementation it catches: the owner rebuilt from the source's domain.
test('code review 2, class E2 (batch 10): the simulated transfer\'s new owner is the tenant\'s own reporting.user account, whatever the source\'s domain', (t) => {
  const customers = require('./customers.js');
  const { applySimulatedGates } = require('./sim/gates.js');
  const d = customers.loadData().customers.find((c) => c.id === 'D');
  const entry = SIM_GATES['gws-offboard-drive-transfer-portal'];
  const dir = tmp(t, 'aegis-b10-owner-');
  const tenantFile = path.join(dir, 'tenant.json');
  const tenant = JSON.parse(customers.tenantText(d));
  const ownerAddress = entry.values(d)['[MANAGER_UPN]'];
  tenant.gws.users['leaver@example.net'] = { ...Object.values(tenant.gws.users)[0], id: 'sim-alias-user', primaryEmail: 'leaver@example.net' };
  // code review round 3 (batch 10), class E3: a second reporting.user account, first in key order, is not the one the
  // change record names; the apply takes the [MANAGER_UPN] the desk hands it. Wrong implementation it catches: the
  // owner found by its local part alone.
  tenant.gws.users = { 'reporting.user@example.net': { ...Object.values(tenant.gws.users)[0], id: 'sim-other-owner', primaryEmail: 'reporting.user@example.net' }, ...tenant.gws.users };
  fs.writeFileSync(tenantFile, JSON.stringify(tenant));
  applySimulatedGates({ changes: [{ entry, target: { '[USER@DOMAIN.COM]': 'leaver@example.net', ...entry.values(d) } }], tenantFile, runDir: dir, now: '2026-11-07T12:00:00.000Z' });
  const record = JSON.parse(fs.readFileSync(tenantFile, 'utf8')).gws.transfers.find((x) => x.id === entry.values(d)['[TRANSFER_ID]']);
  assert.equal(record.newOwnerUserId, tenant.gws.users[ownerAddress].id, 'the owner the change record names');
});
