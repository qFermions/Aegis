'use strict';
// early-time-bound.test.js: a time bound earlier than the change's approval is refused before any
// read (batch G4, code review round 1, finding 4).
//
// EXPECTED DECISION (written before the fix)
// - A verify-* read-back run under --change with --not-before earlier than that change's
//   approval could pass on a change made before the approval, so it never proves the change.
//   Before the fix it was refused only after the read (link, status, countedView): the read ran,
//   was recorded verified with an audit_seq, and the CLI printed it as linkable.
// - The pre-read check (change-record.js bindRefusal, called by cli-support.js changeRefusal with
//   the run's arguments) refuses it before any read, dry or live: no transport call, nothing
//   written to the trail, exit 1, and a message naming the bound, the approval's time and the
//   way forward. A bound at or after the approval goes on to the read. The time bound is read in
//   both forms the connectors take (ISO 8601 with a zone, epoch milliseconds).
// - Called for a read-back that names a time bound without the run's arguments, the check fails
//   closed. The after-the-fact checks (link, status) stay (change-record.test.js, A3).
// Run: node --test scripts/audit/early-time-bound.test.js

require('../adapters/socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const audit = require('./audit-log.js');
const changes = require('./change-record.js');
const support = require('../adapters/cli-support.js');
const { testRunbooks } = require('./trail-helper.js');

const APPROVED_AT = Date.parse('2026-10-28T08:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();
const DIGEST_A = 'a'.repeat(64);
// every verify-* command that takes a time bound, with its other pass flags as a run passes them
const TIMED = {
  'fleet:verify-checked-in': [], 'fleet:verify-deleted': [],
  'google-workspace:verify-event': ['--app', 'admin', '--event', 'CHANGE_PASSWORD'],
  'jamf:verify-command': ['--type', 'INSTALL_PROFILE'], 'jamf:verify-checked-in': [],
  'linear:verify-comment': ['--expect-sha256', DIGEST_A],
  'msgraph:verify-password-changed': [], 'msgraph:verify-signin': [], 'msgraph:verify-device-synced': [], 'msgraph:verify-sessions-revoked': [],
  'okta:verify-sessions-cleared': [], 'okta:verify-password-reset': [],
  'slack:verify-posted': ['--expect-sha256', DIGEST_A],
  'jira:verify-create': ['--expect-sha256', DIGEST_A], 'jira:verify-comment': ['--expect-sha256', DIGEST_A],
};

function trail(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-early-bound-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { AEGIS_AUDIT_DIR: path.join(dir, 'audit') };
  const procedure = path.join(dir, 'procedure.md');
  fs.writeFileSync(procedure, 'Phase B: the gated change for [UPN].\n');
  const sink = audit.auditSink(env);
  const gateFor = testRunbooks(dir, t);
  const record = (argv) => {
    const out = [];
    const err = [];
    const code = changes.main(argv, env, { out: (s) => out.push(s), err: (s) => err.push(s), now: () => APPROVED_AT });
    let json = null;
    try { json = JSON.parse(out.join('')); } catch { /* not JSON */ }
    return { code, json, text: out.join('') + err.join('') };
  };
  // an approved change whose read-back is readBack; its approval is recorded at APPROVED_AT
  const open = (readBack) => {
    const g = gateFor(readBack);
    const o = record(['open', '--command', g.command, '--gate', g.gate, '--r-class', 'R2', '--target', '[UPN]', '--read-back', readBack, '--procedure-file', procedure]);
    assert.equal(o.code, 0, o.text);
    const a = record(['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]);
    assert.equal(a.code, 0, a.text);
    assert.equal(a.json.approved_at, iso(APPROVED_AT));
    return o.json.change;
  };
  return { sink, open };
}

const argvFor = (kind, others, notBefore) => [kind.split(':')[1], ...others, '--not-before', notBefore];

test('F4: bindRefusal refuses a --not-before earlier than the approval, before any read, for every read-back with a time bound', (t) => {
  for (const [kind, others] of Object.entries(TIMED)) {
    const tr = trail(t);
    const readBack = audit.readBackFor(kind, argvFor(kind, others, iso(APPROVED_AT)));
    assert.match(readBack, / --not-before\b/, `${kind}: named with its bound, bare`);
    const change = tr.open(readBack);
    const before = tr.sink.log.entries().length;
    const early = changes.bindRefusal(tr.sink.log, change, readBack, argvFor(kind, others, iso(APPROVED_AT - 60 * 1000)));
    assert.match(String(early), /--not-before 2026-10-28T07:59:00\.000Z/, `${kind}: names the bound`);
    assert.match(String(early), /earlier than the approval/, `${kind}: says why`);
    assert.match(String(early), /2026-10-28T08:00:00\.000Z/, `${kind}: names the approval's time`);
    assert.equal(changes.bindRefusal(tr.sink.log, change, readBack, argvFor(kind, others, iso(APPROVED_AT))), null, `${kind}: at the approval's time it may run`);
    assert.equal(changes.bindRefusal(tr.sink.log, change, readBack, argvFor(kind, others, iso(APPROVED_AT + 1000))), null, `${kind}: after it, it may run`);
    assert.equal(tr.sink.log.entries().length, before, `${kind}: the check writes nothing`);
  }
});

test('F4: a time bound in epoch milliseconds is judged the same way before the read', (t) => {
  const tr = trail(t);
  const kind = 'jira:verify-create';
  const readBack = `${kind} --expect-sha256 ${DIGEST_A} --not-before`;
  const change = tr.open(readBack);
  assert.match(String(changes.bindRefusal(tr.sink.log, change, readBack, argvFor(kind, TIMED[kind], String(APPROVED_AT - 1)))), /earlier than the approval/);
  assert.equal(changes.bindRefusal(tr.sink.log, change, readBack, argvFor(kind, TIMED[kind], String(APPROVED_AT))), null);
});

test('F4: called for a read-back with a time bound but without the run\'s arguments, the check fails closed', (t) => {
  const tr = trail(t);
  const readBack = 'msgraph:verify-sessions-revoked --not-before';
  const change = tr.open(readBack);
  assert.match(String(changes.bindRefusal(tr.sink.log, change, readBack)), /--not-before/);
  // a read-back without a time bound needs no arguments, as before
  const plain = tr.open('okta:verify-factor-reset');
  assert.equal(changes.bindRefusal(tr.sink.log, plain, 'okta:verify-factor-reset'), null);
});

test('F4: changeRefusal, the check every verify-* CLI runs before any read, refuses an early --not-before for each connector', (t) => {
  for (const [kind, others] of Object.entries(TIMED)) {
    const tr = trail(t);
    const [connector, command] = kind.split(':');
    const change = tr.open(audit.readBackFor(kind, argvFor(kind, others, iso(APPROVED_AT))));
    const early = support.changeRefusal(connector, command, support.takeChange([...argvFor(kind, others, iso(APPROVED_AT - 3600 * 1000)), '--change', change]), tr.sink);
    assert.match(String(early), /earlier than the approval/, `${kind}: ${early}`);
    const onTime = support.changeRefusal(connector, command, support.takeChange([...argvFor(kind, others, iso(APPROVED_AT)), '--change', change]), tr.sink);
    assert.equal(onTime, null, `${kind}: ${onTime}`);
  }
});

// One CLI end to end: the early read never reaches the transport and the trail holds no verify entry,
// dry or live; the same read bounded at the approval reads and is recorded.
test('F4: fleet verify-checked-in with an early --not-before exits 1 with no transport call and nothing recorded', async (t) => {
  const fleet = require('../adapters/fleet-client.js');
  const tr = trail(t);
  const kind = 'fleet:verify-checked-in';
  const change = tr.open(`${kind} --not-before`);
  const env = { FLEET_URL: 'fleet.example.invalid', FLEET_API_TOKEN: ['sentinel', 'early', 'bound', String(7 * 919)].join('-') };
  const runIt = async (notBefore, execute) => {
    const calls = [];
    const transport = async (request) => {
      calls.push(request);
      return { status: 200, headers: {}, body: JSON.stringify({ host: { id: 7, platform: 'darwin', status: 'online', seen_time: '2026-10-28T09:40:00Z', detail_updated_at: '2026-10-28T09:20:00Z', last_mdm_checked_in_at: '2026-10-28T09:30:00Z', mdm: { enrollment_status: 'On (automatic)', connected_to_fleet: true } } }) };
    };
    const out = [];
    const err = [];
    const argv = ['verify-checked-in', '--id', '7', '--not-before', notBefore, '--change', change, ...(execute ? ['--execute'] : [])];
    const code = await fleet.run(argv, env, { transport, audit: tr.sink, now: () => Date.parse('2026-10-28T12:00:00Z'), sleep: async () => {}, timeoutMs: 50, out: (s) => out.push(String(s)), err: (s) => err.push(String(s)) });
    return { code, calls: calls.length, text: `${out.join('\n')}\n${err.join('\n')}` };
  };
  for (const execute of [false, true]) {
    const before = tr.sink.log.entries().length;
    const r = await runIt('2026-10-28T07:00:00Z', execute);
    assert.equal(r.code, 1, `${execute ? 'live' : 'dry'}: ${r.text}`);
    assert.equal(r.calls, 0, 'no transport call');
    assert.match(r.text, /earlier than the approval/);
    assert.doesNotMatch(r.text, /audit_seq/, 'nothing is printed as linkable');
    assert.equal(tr.sink.log.entries().length, before, 'nothing recorded');
  }
  const ok = await runIt('2026-10-28T09:00:00Z', true);
  assert.equal(ok.code, 0, ok.text);
  assert.ok(ok.calls > 0);
  const v = tr.sink.log.entries().filter((e) => e.kind === 'verify');
  assert.equal(v.length, 1);
  assert.equal(v[0].change, change);
});
