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
  return { sink, open, env, record };
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

// ── Code review round 2 of batch G4, finding 11: an approval time that cannot be read ─────────────
//
// EXPECTED DECISION (written before the fix)
// - A time bound proves a change only when it is shown to be at or after the change's approval.
//   When the approval's at is missing or does not parse as a time, nothing shows that, so every
//   check fails closed: the pre-read check (bindRefusal, and changeRefusal that calls it) refuses
//   the read-back with a message saying the approval's time could not be read, writing nothing;
//   status (a one-read-back change and a counted change) never counts such a read-back; link
//   refuses it, writing nothing. Before the fix earlyBound read such an approval as "no bound is
//   early", so any bound passed every check.
// - The trail itself refuses an entry whose at does not parse (audit-log.js verify), so only a
//   trail written around it, or a caller that hands the checks its own log, can hold one; the
//   tests hand the checks a view of a real trail in which the approval's at is replaced.
// - A read-back without a time bound does not use the approval's time, so it is judged as before.

const BAD_TIMES = [['missing', undefined], ['empty', ''], ['not a time', 'not-a-time'], ['a number', APPROVED_AT]];
// the trail as the checks read it, with the approval's at replaced (left out when undefined) and
// each other entry passed through other
function withApprovalAt(log, at, other = (e) => e) {
  const swap = (e) => {
    if (e.kind !== 'approval') return other(e);
    const { at: _dropped, ...rest } = e;
    return at === undefined ? rest : { ...rest, at };
  };
  return { verify: () => log.verify(), entries: () => log.entries().map(swap), append: (...a) => log.append(...a) };
}
const TIMED_READ_BACK = 'msgraph:verify-sessions-revoked --not-before';
const LATE = iso(APPROVED_AT + 3600 * 1000);
const UNREADABLE = /the approval's time could not be read/;
const timedVerify = (tr, change) => tr.sink.log.append({ kind: 'verify', connector: 'msgraph', command: 'verify-sessions-revoked', verified: true, state: 'OK', change, flags: `--not-before ${LATE}` });

test('F11: with the approval\'s time missing or unreadable, the pre-read check refuses a time-bounded read-back and writes nothing', (t) => {
  for (const [label, at] of BAD_TIMES) {
    const tr = trail(t);
    const change = tr.open(TIMED_READ_BACK);
    const plain = tr.open('okta:verify-factor-reset');
    const view = withApprovalAt(tr.sink.log, at);
    const before = tr.sink.log.entries().length;
    const argv = ['verify-sessions-revoked', '--not-before', LATE];
    assert.equal(changes.bindRefusal(tr.sink.log, change, TIMED_READ_BACK, argv), null, `${label}: with the approval's time readable, the late bound may run`);
    const refused = changes.bindRefusal(view, change, TIMED_READ_BACK, argv);
    assert.match(String(refused), UNREADABLE, `${label}: bindRefusal says the approval's time could not be read: ${refused}`);
    assert.match(String(refused), /Nothing was read or recorded/, `${label}: says nothing was read`);
    const cli = support.changeRefusal('msgraph', 'verify-sessions-revoked', support.takeChange([...argv, '--change', change]), { log: view });
    assert.match(String(cli), UNREADABLE, `${label}: changeRefusal refuses too: ${cli}`);
    // a read-back without a time bound does not use the approval's time
    assert.equal(changes.bindRefusal(view, plain, 'okta:verify-factor-reset'), null, `${label}: a read-back without a time bound is judged as before`);
    assert.equal(tr.sink.log.entries().length, before, `${label}: the check writes nothing`);
  }
});

test('F11: status never counts a time-bounded read-back when the approval\'s time is missing or unreadable', (t) => {
  for (const [label, at] of BAD_TIMES) {
    const tr = trail(t);
    const change = tr.open(TIMED_READ_BACK);
    const v = timedVerify(tr, change);
    tr.sink.log.append({ kind: 'change-link', change, verify_seq: v.seq });
    assert.equal(changes.changeView(tr.sink.log, change).done, true, `${label}: with the approval's time readable, the change is done`);
    const view = changes.changeView(withApprovalAt(tr.sink.log, at), change);
    assert.equal(view.done, false, `${label}: not done`);
    assert.equal(view.readBack, null, `${label}: no read-back proves it`);
    assert.ok(view.missing.some((m) => UNREADABLE.test(m)), `${label}: says why: ${view.missing.join(' | ')}`);
  }
});

test('F11: a counted change lists a time-bounded read-back as uncounted when the approval\'s time is missing or unreadable', (t) => {
  for (const [label, at] of BAD_TIMES) {
    const tr = trail(t);
    const change = tr.open(TIMED_READ_BACK);
    timedVerify(tr, change);
    // no counted gate takes a time bound today, so the procedure entry is read as a counted one
    const counted = (e) => (e.kind === 'procedure' && e.change === change ? { ...e, expected: 1 } : e);
    assert.equal(changes.changeView(withApprovalAt(tr.sink.log, iso(APPROVED_AT), counted), change).done, true, `${label}: with the approval's time readable, 1 of 1 is done`);
    const view = changes.changeView(withApprovalAt(tr.sink.log, at, counted), change);
    assert.equal(view.done, false, `${label}: not done`);
    assert.equal(view.verified, 0, `${label}: nothing counted`);
    assert.equal(view.uncounted.length, 1, `${label}: listed as uncounted`);
    assert.match(view.uncounted[0].reason, UNREADABLE, `${label}: says why: ${view.uncounted[0].reason}`);
  }
});

test('F11: link refuses a time-bounded read-back when the approval\'s time is missing or unreadable, writing nothing', (t) => {
  for (const [label, at] of BAD_TIMES) {
    const tr = trail(t);
    const change = tr.open(TIMED_READ_BACK);
    const v = timedVerify(tr, change);
    const before = tr.sink.log.entries().length;
    const real = audit.openAuditLog;
    // change-record.js main opens the trail through audit-log.js; this run reads it with the
    // approval's at replaced
    audit.openAuditLog = (options) => withApprovalAt(real(options), at);
    let r;
    try {
      r = tr.record(['link', '--change', change, '--verify-seq', String(v.seq)]);
    } finally {
      audit.openAuditLog = real;
    }
    assert.equal(r.code, 2, `${label}: refused: ${r.text}`);
    assert.match(r.text, UNREADABLE, `${label}: says why: ${r.text}`);
    assert.match(r.text, /Nothing was recorded/, `${label}: says nothing was recorded`);
    assert.equal(tr.sink.log.entries().length, before, `${label}: nothing written`);
    // with the approval's time readable, the same link is written
    assert.equal(tr.record(['link', '--change', change, '--verify-seq', String(v.seq)]).code, 0, `${label}: linked when the time is readable`);
  }
});

// Code review round 3 of batch G4, finding 9: the unreadable-approval message said to run
// node scripts/audit/audit-log.js verify, but every check that gives it reads the trail only after
// verify reported the chain intact (changeView), so verify has nothing to add. The approval of this
// change can never be shown, so the way forward is a new change: the message names it, with the
// command that opens one, at every check that gives it (the pre-read check, status of a
// one-read-back change and of a counted change, link).
const NEW_CHANGE = /open a new change with node scripts\/audit\/change-record\.js open/;
const VERIFY_REMEDY = /audit-log\.js verify/;
test('round 3 F9: the unreadable-approval message says to open a new change, not to run audit-log.js verify', (t) => {
  for (const [label, at] of BAD_TIMES) {
    const tr = trail(t);
    const change = tr.open(TIMED_READ_BACK);
    const v = timedVerify(tr, change);
    const messages = [];
    messages.push(['pre-read check', String(changes.bindRefusal(withApprovalAt(tr.sink.log, at), change, TIMED_READ_BACK, ['verify-sessions-revoked', '--not-before', LATE]))]);
    const counted = (e) => (e.kind === 'procedure' && e.change === change ? { ...e, expected: 1 } : e);
    messages.push(['counted status', changes.changeView(withApprovalAt(tr.sink.log, at, counted), change).uncounted.map((u) => u.reason).join(' | ')]);
    const real = audit.openAuditLog;
    audit.openAuditLog = (options) => withApprovalAt(real(options), at);
    try {
      messages.push(['link', tr.record(['link', '--change', change, '--verify-seq', String(v.seq)]).text]);
    } finally {
      audit.openAuditLog = real;
    }
    tr.sink.log.append({ kind: 'change-link', change, verify_seq: v.seq });
    messages.push(['status', changes.changeView(withApprovalAt(tr.sink.log, at), change).missing.join(' | ')]);
    for (const [where, text] of messages) {
      assert.match(text, UNREADABLE, `${label}, ${where}: ${text}`);
      assert.match(text, NEW_CHANGE, `${label}, ${where}: names the new change and how to open it: ${text}`);
      assert.doesNotMatch(text, VERIFY_REMEDY, `${label}, ${where}: no longer points to audit-log.js verify: ${text}`);
    }
  }
});
