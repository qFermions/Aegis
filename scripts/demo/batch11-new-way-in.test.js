'use strict';
require('../adapters/socket-tripwire.js');
// batch11-new-way-in.test.js: the Customer Desk acts out the Temporary Access Pass gate of /mfa-issue
// (batch 11, task 5; docs/aegis/answer-format.md section 2, "A new way in before the old way out"), end to
// end on a simulated tenant with a fixture answer: no model session, the answers come from the fake CLI
// (scripts/eval/judged/fixtures/fake-claude.js), as in batch10-readbacks.test.js.
//
// EXPECTED DECISION (written before the gate, the read-back command and the simulator entry)
// - /mfa-issue has a gate [mfa-temporary-access-pass-portal], R3, that binds one read-back under its change
//   record: msgraph verify-temporary-access-pass, bounded by --not-before.
// - After the simulated gate the read passes and the ticket is RESOLVED (SIMULATED).
// - A pass that was already there before the approval (another ticket's) is not this change: the same read
//   shows the change not done, and the ticket is FAILED.
// - The whole path, the pass and then the one-method delete, resolves with both reads passed, the pass listed
//   and the old method gone; the pass value is in no file of the run.
// Run: node --test scripts/demo/batch11-new-way-in.test.js

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
const GATE = 'mfa-temporary-access-pass-portal';
const PASS_TYPE = '#microsoft.graph.temporaryAccessPassAuthenticationMethod';
// words ticket T1's text holds, so the fake CLI answers it (the same as customer-desk.test.js)
const MATCH = 'Locked out after changing my phone';

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

async function runDesk(t, gates, simTable) {
  const results = path.join(tmp(t, 'aegis-b11-run-'), 'run');
  const home = tmp(t, 'aegis-b11-fake-');
  const cfg = path.join(home, 'fake.json');
  fs.writeFileSync(cfg, JSON.stringify({ log: path.join(home, 'calls.jsonl'), sut: { answers: [{ match: MATCH, answer: good(...gates) }], cost: 0.5 } }));
  const out = [];
  const code = await desk.main(['run', '--only', 'T1', '--execute', '--results-dir', results], { PATH: process.env.PATH, HOME: home }, {
    out: (s) => out.push(String(s)), err: (s) => out.push(String(s)), backend: { command: process.execPath, prefixArgs: [FAKE, '--fake-config', cfg] }, ...(simTable ? { simTable } : {}),
  });
  const run = JSON.parse(fs.readFileSync(path.join(results, 'run.json'), 'utf8'));
  const ticket = run.tickets.find((x) => x.id === 'T1');
  const tenant = JSON.parse(fs.readFileSync(path.join(results, 'customers', 'a', 'tenant.json'), 'utf8'));
  return { code, ticket, readBack: ticket.steps.find((s) => s.n === 8), out: out.join(''), tenant, results };
}

const flag = (argv, name) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };
const without = (id, apply) => ({ ...SIM_GATES, [id]: { ...SIM_GATES[id], apply } });
const methodsOf = (tenant) => Object.values(tenant.msgraph.methods)[0];

// catches: the gate written R1 with a read that takes no change record, a read-back with no time bound (an old
// pass would pass it), or a field that names verify-mfa-method, which asks only that a pass is listed
test('the Temporary Access Pass gate is R3 and binds verify-temporary-access-pass, bounded in time, under its change record', () => {
  const g = catalog().get(GATE);
  assert.ok(g && g.kind === 'gate', `${GATE} is a SAFETY GATE of a runbook`);
  assert.equal(g.command, 'mfa-issue');
  assert.equal(g.rClass, 'R3');
  assert.equal(g.none, null);
  assert.equal(g.phrase, 'CREATE TEMPORARY ACCESS PASS FOR [UPN]');
  assert.equal(g.bound.length, 1);
  const [b] = g.bound;
  assert.equal(b.kind, 'msgraph:verify-temporary-access-pass');
  assert.equal(flag(b.argv, '--user'), '[USER_ID]');
  assert.equal(flag(b.argv, '--not-before'), '[NOT_BEFORE]');
  assert.match(b.command, /--change \[CHANGE_ID\] --execute$/);
});

// catches: a simulator entry that changes nothing or adds a method of another type (the ticket would stop OPEN or
// the read would fail), a desk that cannot open the R3 change record for the read, or a read that takes a pass
// from before the approval for this change
test('the desk acts the gate out: the read passes after the simulated pass, and fails on a pass that was there before the approval', async (t) => {
  const after = await runDesk(t, [GATE]);
  assert.equal(after.ticket.closing_state, 'RESOLVED (SIMULATED)', after.ticket.reason);
  assert.deepEqual(after.readBack.reads.map((r) => `${r.kind} ${r.state}`), ['msgraph:verify-temporary-access-pass PASS']);
  assert.match(after.readBack.output, /change-record\.js status --change chg-[0-9a-f]{12}: done/);
  const listed = methodsOf(after.tenant).filter((m) => m['@odata.type'] === PASS_TYPE);
  assert.equal(listed.length, 1, 'one pass, as Entra keeps one per user');
  assert.equal(listed[0].temporaryAccessPass, null, 'the simulated tenant holds no pass value, as Graph returns none on a read');
  // the simulated operator leaves an old pass in place instead of issuing one: listed, but not this change
  const stale = await runDesk(t, [GATE], without(GATE, (s, target) => {
    const id = target['[USER_ID]'];
    s.msgraph.methods[id] = s.msgraph.methods[id].concat([{ '@odata.type': PASS_TYPE, id: 'a3000000-0000-4000-8000-000000000001', temporaryAccessPass: null, createdDateTime: '2026-01-10T09:00:00Z', startDateTime: '2026-01-10T09:00:00Z', lifetimeInMinutes: 60, isUsableOnce: true, isUsable: false, methodUsabilityReason: 'Expired' }]);
  }));
  assert.equal(stale.ticket.closing_state, 'FAILED', stale.ticket.reason);
  assert.deepEqual(stale.readBack.reads.map((r) => `${r.kind} ${r.state}`), ['msgraph:verify-temporary-access-pass FAIL']);
});

// catches: a pass gate and a delete gate that cannot run in one ticket (the second would stop OPEN), or a
// simulated pass that the delete takes away with the old method.
// What the desk does NOT act out (fresh review of batch 11, finding 2): the user's own registration between the two
// gates is a person's step, and the desk runs only the two gates' bound read-backs. So RESOLVED (SIMULATED) here
// proves the two admin changes and nothing about a new method. The runbook's own unbound read for that,
// verify-mfa-method, is run below on the same simulated tenant and does not pass: with only the pass listed, a
// real ticket is not done. Wrong reading this catches: taking the desk's resolved state for "the new method is there".
test('the desk acts both gates in one ticket, the pass and then the one-method delete, each read passed; it does not act out the user registering, and verify-mfa-method shows that', async (t) => {
  const run = await runDesk(t, [GATE, 'mfa-method-delete-portal']);
  assert.equal(run.ticket.closing_state, 'RESOLVED (SIMULATED)', run.ticket.reason);
  assert.deepEqual(run.readBack.reads.map((r) => `${r.kind} ${r.state}`), ['msgraph:verify-temporary-access-pass PASS', 'msgraph:verify-method-absent PASS']);
  const types = methodsOf(run.tenant).map((m) => m['@odata.type']);
  assert.ok(types.includes(PASS_TYPE), 'the pass is still listed: the delete took the one old method only');
  assert.ok(!methodsOf(run.tenant).some((m) => m.id === 'a2000000-0000-4000-8000-000000000001'), 'the old Authenticator method is gone');
  {
    const customers = require('./customers.js');
    const vendors = require('./sim/vendors.js');
    const a = customers.loadData().customers.find((c) => c.id === 'A');
    const out = [];
    const code = await vendors.connectorModule('msgraph').run(
      ['verify-mfa-method', '--user', 'a1000000-0000-4000-8000-000000000001', '--method', 'microsoftAuthenticator', '--execute'],
      { ...customers.tenantVars(a), ...vendors.simulatedCredentials('msgraph'), AEGIS_AUDIT_DIR: path.join(run.results, 'customers', 'a', 'audit') },
      { transport: vendors.transportFor('msgraph', path.join(run.results, 'customers', 'a', 'tenant.json')), sleep: async () => {}, out: (s) => out.push(String(s)), err: (s) => out.push(String(s)) },
    );
    assert.equal(code, 2, `no Authenticator is registered in the simulated tenant, so the runbook's read does not pass: ${out.join('')}`);
  }
  // a second apply replaces the pass: Entra keeps one per user
  const { applySimulatedGates } = require('./sim/gates.js');
  const tenantFile = path.join(run.results, 'customers', 'a', 'tenant.json');
  applySimulatedGates({ changes: [{ entry: SIM_GATES[GATE], target: { '[USER_ID]': 'a1000000-0000-4000-8000-000000000001' } }], tenantFile, runDir: run.results, now: '2026-11-13T12:00:00.000Z' });
  const again = methodsOf(JSON.parse(fs.readFileSync(tenantFile, 'utf8'))).filter((m) => m['@odata.type'] === PASS_TYPE);
  assert.equal(again.length, 1);
  assert.equal(again[0].createdDateTime, '2026-11-13T12:00:00.000Z', 'the later pass');
});
