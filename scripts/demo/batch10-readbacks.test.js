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
