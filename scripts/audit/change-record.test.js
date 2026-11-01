#!/usr/bin/env node
'use strict';
// change-record.test.js: change records for R2 and R3 procedures (batch G3, task 3c).
//
// EXPECTED DECISION (written before the module)
// - open records the procedure Aegis issued (command, gate, R class, placeholder target)
//   with the SHA-256 of its text and returns a change id; R0 and R1 are refused (a change
//   record is for R2 and R3).
// - approve records the operator's approval reference (an issue key) for that change, only
//   when the approved digest equals the issued one; a mismatch is refused and nothing is
//   recorded. The approval authorizes a person's procedure; nothing in the module writes
//   anywhere but the local audit trail (no network module, no child process).
// - link joins a verify-* result already in the trail to the change.
// - Batch G3, code review round 1 (finding 2): open names the read-back that proves the
//   change (--read-back connector:verify-command, such as okta:verify-factor-reset); link
//   refuses a verify-* result of any other connector or command, and status never counts
//   one, even a link written into the trail around the CLI.
// - status reports the change done only when all three match in order: the issued digest,
//   an approval of that digest after it, and a verify-* result that verified after the
//   approval, on an intact chain. Anything missing or mismatched is "not done", with the
//   reason, exit 2.
// - Batch G3 close-out (owner decision 1): a read-back is bound to its change when it is
//   recorded (the verify-* CLIs take --change, scripts/adapters/change-binding.test.js). link
//   refuses a verify entry recorded with change null or under another change, and status never
//   counts one, even a link written into the trail around the CLI. The tests below that link a
//   read-back record it under its change, as the CLIs now do.
// Run: node --test scripts/audit/change-record.test.js

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const audit = require('./audit-log.js');
const changes = require('./change-record.js');

const CLI = path.join(__dirname, 'change-record.js');
const AUDIT_CLI = path.join(__dirname, 'audit-log.js');

function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-change-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const procedure = path.join(dir, 'procedure.md');
  fs.writeFileSync(procedure, 'Phase B: reset the selected Okta authenticator for [UPN].\r\nType exactly: RESET SELECTED OKTA AUTHENTICATORS FOR [UPN]  \n\n');
  const env = { ...process.env, AEGIS_AUDIT_DIR: path.join(dir, 'audit') };
  const run = (cli, args) => {
    const r = spawnSync(process.execPath, [cli, ...args], { env, encoding: 'utf8' });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* not JSON */ }
    return { code: r.status, stdout: r.stdout, stderr: r.stderr, json };
  };
  const log = audit.openAuditLog({ dir: env.AEGIS_AUDIT_DIR });
  return { dir, procedure, env, run, log };
}

function openChange(s, rClass = 'R2') {
  const r = s.run(CLI, ['open', '--command', 'okta-mfa-reset', '--gate', 'okta-mfa-reset-selected-portal', '--r-class', rClass, '--target', '[UPN]', '--read-back', 'okta:verify-factor-reset', '--procedure-file', s.procedure]);
  return r;
}
const verifyEntry = (s, verified, change = null) => s.log.append({ kind: 'verify', connector: 'okta', command: 'verify-factor-reset', verified, state: 'OK', change });

test('open, approve, a passing verify-* read-back and link: the change is done (exit 0)', (t) => {
  const s = setup(t);
  const o = openChange(s);
  assert.equal(o.code, 0, o.stderr);
  assert.match(o.json.change, /^chg-[0-9a-f]{12}$/);
  assert.match(o.json.procedure_sha256, /^[0-9a-f]{64}$/);
  assert.equal(o.json.procedure_sha256, changes.procedureDigest(fs.readFileSync(s.procedure, 'utf8')));
  const a = s.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]);
  assert.equal(a.code, 0, a.stderr);
  assert.match(a.stdout, /authorizes a person's procedure/i);
  assert.match(a.stdout, /no change/i);
  const v = verifyEntry(s, true, o.json.change);
  const l = s.run(CLI, ['link', '--change', o.json.change, '--verify-seq', String(v.seq)]);
  assert.equal(l.code, 0, l.stderr);
  const st = s.run(CLI, ['status', '--change', o.json.change]);
  assert.equal(st.code, 0, st.stdout + st.stderr);
  assert.equal(st.json.done, true);
  assert.deepEqual(st.json.missing, []);
  assert.equal(st.json.approval.ref, 'IT-123');
});

test('an approval of another digest is refused at approve and nothing is recorded; the change is not done', (t) => {
  const s = setup(t);
  const o = openChange(s);
  const before = s.log.entries().length;
  const a = s.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', 'b'.repeat(64)]);
  assert.equal(a.code, 2);
  assert.match(a.stderr, /does not match/);
  assert.equal(s.log.entries().length, before, 'nothing recorded');
  const st = s.run(CLI, ['status', '--change', o.json.change]);
  assert.equal(st.code, 2);
  assert.equal(st.json.done, false);
  assert.ok(st.json.missing.some((m) => /approval/i.test(m)));
});

// Batch G4, task A2: audit-log.js approval no longer writes (the A2 tests below), so the
// mismatched approval is written around both CLIs, as an older trail may hold one.
test('an approval written straight into the trail with a mismatched digest still leaves the change not done', (t) => {
  const s = setup(t);
  const o = openChange(s);
  const w = s.run(AUDIT_CLI, ['approval', '--ref', 'IT-124', '--gate', 'okta-mfa-reset-selected-portal', '--procedure-sha256', 'c'.repeat(64), '--change', o.json.change]);
  assert.equal(w.code, 1, w.stdout);
  s.log.append({ kind: 'approval', ref: 'IT-124', gate: 'okta-mfa-reset-selected-portal', procedure_sha256: 'c'.repeat(64), change: o.json.change });
  const v = verifyEntry(s, true);
  s.run(CLI, ['link', '--change', o.json.change, '--verify-seq', String(v.seq)]);
  const st = s.run(CLI, ['status', '--change', o.json.change]);
  assert.equal(st.code, 2);
  assert.equal(st.json.done, false);
  assert.ok(st.json.missing.some((m) => /does not match/i.test(m)), JSON.stringify(st.json));
});

test('missing approval, missing read-back, a read-back that did not verify, or a read-back before the approval: not done', (t) => {
  const noApproval = setup(t);
  const o1 = openChange(noApproval);
  const v1 = verifyEntry(noApproval, true);
  noApproval.run(CLI, ['link', '--change', o1.json.change, '--verify-seq', String(v1.seq)]);
  assert.equal(noApproval.run(CLI, ['status', '--change', o1.json.change]).json.done, false);

  const noVerify = setup(t);
  const o2 = openChange(noVerify);
  noVerify.run(CLI, ['approve', '--change', o2.json.change, '--ref', 'IT-125', '--procedure-sha256', o2.json.procedure_sha256]);
  const st2 = noVerify.run(CLI, ['status', '--change', o2.json.change]);
  assert.equal(st2.json.done, false);
  assert.ok(st2.json.missing.some((m) => /read-back/i.test(m)));

  const failed = setup(t);
  const o3 = openChange(failed);
  failed.run(CLI, ['approve', '--change', o3.json.change, '--ref', 'IT-126', '--procedure-sha256', o3.json.procedure_sha256]);
  const v3 = verifyEntry(failed, false);
  failed.run(CLI, ['link', '--change', o3.json.change, '--verify-seq', String(v3.seq)]);
  assert.equal(failed.run(CLI, ['status', '--change', o3.json.change]).json.done, false);

  const early = setup(t);
  const o4 = openChange(early);
  const v4 = verifyEntry(early, true);
  early.run(CLI, ['approve', '--change', o4.json.change, '--ref', 'IT-127', '--procedure-sha256', o4.json.procedure_sha256]);
  early.run(CLI, ['link', '--change', o4.json.change, '--verify-seq', String(v4.seq)]);
  const st4 = early.run(CLI, ['status', '--change', o4.json.change]);
  assert.equal(st4.json.done, false, 'a read-back taken before the approval does not prove the approved change');

  const notVerify = setup(t);
  const o5 = openChange(notVerify);
  const call = notVerify.log.append({ kind: 'connector-call', connector: 'okta', operation: 'user', state: 'OK', attempts: 1, status: 200, request_id: null, handoff: null, duration_ms: 3 });
  const l5 = notVerify.run(CLI, ['link', '--change', o5.json.change, '--verify-seq', String(call.seq)]);
  assert.equal(l5.code, 2, 'only a verify-* result can be linked');
});

test('R0 and R1 procedures are refused at open; an unknown change is not done; a broken trail is not done', (t) => {
  const s = setup(t);
  for (const r of ['R0', 'R1']) assert.equal(openChange(s, r).code, 1, `${r} refused`);
  assert.equal(s.run(CLI, ['status', '--change', 'chg-000000000000']).code, 2);

  const b = setup(t);
  const o = openChange(b);
  b.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-128', '--procedure-sha256', o.json.procedure_sha256]);
  const v = verifyEntry(b, true, o.json.change);
  b.run(CLI, ['link', '--change', o.json.change, '--verify-seq', String(v.seq)]);
  assert.equal(b.run(CLI, ['status', '--change', o.json.change]).json.done, true);
  const file = path.join(b.env.AEGIS_AUDIT_DIR, audit.LOG_FILE);
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const e = JSON.parse(lines[1]); e.ref = 'IT-999'; lines[1] = JSON.stringify(e);
  fs.writeFileSync(file, lines.map((l) => `${l}\n`).join(''));
  const st = b.run(CLI, ['status', '--change', o.json.change]);
  assert.equal(st.code, 2);
  assert.ok(st.json.missing.some((m) => /broken/i.test(m)));
});

test('open needs the read-back that proves the change; link refuses another kind, and status never counts one', (t) => {
  const s = setup(t);
  const bare = s.run(CLI, ['open', '--command', 'okta-mfa-reset', '--gate', 'okta-mfa-reset-selected-portal', '--r-class', 'R2', '--target', '[UPN]', '--procedure-file', s.procedure]);
  assert.equal(bare.code, 1, '--read-back is required');
  assert.match(bare.stderr, /--read-back/);
  const bad = s.run(CLI, ['open', '--command', 'okta-mfa-reset', '--gate', 'okta-mfa-reset-selected-portal', '--r-class', 'R2', '--target', '[UPN]', '--read-back', 'okta:reset-factor', '--procedure-file', s.procedure]);
  assert.equal(bad.code, 1, 'a read-back is connector:verify-command');
  const o = openChange(s);
  assert.equal(o.code, 0, o.stderr);
  s.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]);
  // a verified read-back of another connector, and of another okta command
  // its time bound is a pass flag since batch G4 (task A3), so the entry records its flags
  const fleet = s.log.append({ kind: 'verify', connector: 'fleet', command: 'verify-checked-in', verified: true, state: 'OK', change: null, flags: '' });
  const status = s.log.append({ kind: 'verify', connector: 'okta', command: 'verify-status', verified: true, state: 'OK', change: null, flags: '--status SUSPENDED' });
  for (const v of [fleet, status]) {
    const before = s.log.entries().length;
    const l = s.run(CLI, ['link', '--change', o.json.change, '--verify-seq', String(v.seq)]);
    assert.equal(l.code, 2, `link of ${v.seq} refused`);
    assert.match(l.stderr, /okta:verify-factor-reset/);
    assert.equal(s.log.entries().length, before, 'nothing recorded');
  }
  // a link written into the trail around the CLI still does not make the change done
  s.log.append({ kind: 'change-link', change: o.json.change, verify_seq: fleet.seq });
  const st = s.run(CLI, ['status', '--change', o.json.change]);
  assert.equal(st.code, 2);
  assert.equal(st.json.done, false);
  assert.ok(st.json.missing.some((m) => /okta:verify-factor-reset/.test(m)), st.stdout);
  assert.equal(st.json.procedure.read_back, 'okta:verify-factor-reset');
});

// Code review round 2, finding 8: with no matching approval, a verified read-back of the
// right kind is not "a read-back before the approval"; the reason is the missing approval.
test('with no approval, status names the missing approval and never says the read-back ran before it', (t) => {
  const s = setup(t);
  const o = openChange(s);
  const v = verifyEntry(s, true);
  s.run(CLI, ['link', '--change', o.json.change, '--verify-seq', String(v.seq)]);
  const st = s.run(CLI, ['status', '--change', o.json.change]);
  assert.equal(st.code, 2);
  assert.ok(st.json.missing.some((m) => /no approval reference/.test(m)), st.stdout);
  assert.ok(!st.json.missing.some((m) => /before the approval/.test(m)), st.stdout);
});

// Code review round 2, finding 5: one verify-* result proves one change. A second link of
// the same read-back is refused, and a second link written around the CLI does not count.
test('one read-back proves one change: a second link is refused, and one written around the CLI does not count', (t) => {
  const s = setup(t);
  const a = openChange(s);
  const b = openChange(s);
  for (const o of [a, b]) s.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]);
  const v = verifyEntry(s, true, a.json.change);
  assert.equal(s.run(CLI, ['link', '--change', a.json.change, '--verify-seq', String(v.seq)]).code, 0);
  const before = s.log.entries().length;
  const second = s.run(CLI, ['link', '--change', b.json.change, '--verify-seq', String(v.seq)]);
  assert.equal(second.code, 2);
  assert.match(second.stderr, new RegExp(a.json.change));
  assert.equal(s.log.entries().length, before, 'nothing recorded');
  s.log.append({ kind: 'change-link', change: b.json.change, verify_seq: v.seq });
  assert.equal(s.run(CLI, ['status', '--change', a.json.change]).code, 0, 'the first change keeps its proof');
  const st = s.run(CLI, ['status', '--change', b.json.change]);
  assert.equal(st.code, 2);
  assert.ok(st.json.missing.some((m) => /already proves/.test(m)), st.stdout);
});

// Code review round 2, finding 7: the read-back named at open is a verify-* command the
// connector really has, so a typo is refused before anyone approves or runs the procedure.
test('open refuses a read-back the connector does not have (a typo or an unknown connector); a real one is accepted', (t) => {
  const s = setup(t);
  const open = (readBack) => s.run(CLI, ['open', '--command', 'okta-mfa-reset', '--gate', 'okta-mfa-reset-selected-portal', '--r-class', 'R2', '--target', '[UPN]', '--read-back', readBack, '--procedure-file', s.procedure]);
  for (const bad of ['okta:verify-factor-rest', 'oktaa:verify-factor-reset', 'github:verify-factor-reset']) {
    const r = open(bad);
    assert.equal(r.code, 1, bad);
    assert.match(r.stderr, /no such read-back|no connector/, bad);
  }
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
  assert.equal(open('okta:verify-factor-reset').code, 0);
  // read-backs the connectors have pass the connector check; this gate's runbook binds Okta
  // read-backs only, so open refuses them for the gate (security review 1 of the batch G3
  // close-out 3)
  for (const other of ['github:verify-collaborator', 'jamf:verify-checked-in', 'jira:verify-comment']) {
    const r = open(other);
    assert.equal(r.code, 1, other);
    assert.doesNotMatch(r.stderr, /no such read-back|no connector/, other);
    assert.match(r.stderr, /gate okta-mfa-reset-selected-portal's read-back in \.claude\/commands\/okta-mfa-reset\.md runs as okta:verify-factor-reset, not as /, other);
  }
});

// Code review round 3, finding 1: a read-back is named as the trail records it, by the
// connector name its verify entries carry (google-workspace, not the file name gws).
test('open names a read-back by the connector name its verify entries carry (google-workspace), never by a file name', (t) => {
  const s = setup(t);
  const open = (readBack) => s.run(CLI, ['open', '--command', 'gws-account-containment', '--gate', 'gws-account-containment-suspend-portal', '--r-class', 'R2', '--target', '[UPN]', '--read-back', readBack, '--procedure-file', s.procedure]);
  assert.equal(open('google-workspace:verify-suspended').code, 0);
  const byFile = open('gws:verify-suspended');
  assert.equal(byFile.code, 1);
  assert.match(byFile.stderr, /no connector named gws/);
});

// Code review round 3, finding 6: only a command key counts, a line that starts with the
// quoted name and a colon inside a command table; a comment, a usage line or an error text
// that mentions the same words does not.
test('a read-back command counts only as a command-table key, never as a mention in a comment or a string', () => {
  const src = [
    '// a comment that says \'verify-ghost\': here',
    'const USAGE = "verify-usage --id N";',
    'throw new Error("\'verify-error\': not a command");',
    'const COMMANDS = Object.freeze({',
    '  \'verify-real\': { kind: \'verify\' },',
    '});',
  ].join('\n');
  assert.equal(changes.hasCommandKey(src, 'verify-real'), true);
  for (const c of ['verify-ghost', 'verify-usage', 'verify-error']) assert.equal(changes.hasCommandKey(src, c), false, c);
});

// Code review round 3, finding 5: since one read-back proves one change, link refuses one
// that cannot prove this change (no approval yet, ran before the approval, did not verify,
// or recorded for another change), so a mistaken link cannot take it from the right change.
test('link refuses a read-back that cannot prove the change: no approval, before the approval, not verified, or recorded for another change', (t) => {
  const s = setup(t);
  const a = openChange(s);
  const early = verifyEntry(s, true);
  const unapproved = s.run(CLI, ['link', '--change', a.json.change, '--verify-seq', String(early.seq)]);
  assert.equal(unapproved.code, 2, 'no approval yet');
  assert.match(unapproved.stderr, /approv/);
  s.run(CLI, ['approve', '--change', a.json.change, '--ref', 'IT-123', '--procedure-sha256', a.json.procedure_sha256]);
  const before = s.run(CLI, ['link', '--change', a.json.change, '--verify-seq', String(early.seq)]);
  assert.equal(before.code, 2, 'ran before the approval');
  const failed = verifyEntry(s, false);
  assert.equal(s.run(CLI, ['link', '--change', a.json.change, '--verify-seq', String(failed.seq)]).code, 2, 'did not verify');
  const other = verifyEntry(s, true, 'chg-0123456789ab');
  assert.equal(s.run(CLI, ['link', '--change', a.json.change, '--verify-seq', String(other.seq)]).code, 2, 'recorded for another change');
  assert.equal(s.log.entries().filter((e) => e.kind === 'change-link').length, 0, 'nothing linked');
  const good = verifyEntry(s, true, a.json.change);
  assert.equal(s.run(CLI, ['link', '--change', a.json.change, '--verify-seq', String(good.seq)]).code, 0);
});

// Batch G3 close-out, owner decision 1: a read-back recorded without --change (change null)
// proves no change; link refuses it, names --change, and records nothing.
test('link refuses a read-back recorded without --change and says to run it again with --change; nothing is recorded', (t) => {
  const s = setup(t);
  const o = openChange(s);
  s.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]);
  const unbound = verifyEntry(s, true);
  const before = s.log.entries().length;
  const l = s.run(CLI, ['link', '--change', o.json.change, '--verify-seq', String(unbound.seq)]);
  assert.equal(l.code, 2);
  assert.match(l.stderr, /without --change/);
  assert.match(l.stderr, new RegExp(`--change ${o.json.change}`));
  assert.equal(s.log.entries().length, before, 'nothing recorded');
  assert.equal(s.run(CLI, ['status', '--change', o.json.change]).json.done, false);
});

test('status never counts a read-back that was not recorded under this change, even one linked around the CLI', (t) => {
  const s = setup(t);
  const o = openChange(s);
  s.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]);
  for (const change of [null, 'chg-0123456789ab']) {
    const v = verifyEntry(s, true, change);
    s.log.append({ kind: 'change-link', change: o.json.change, verify_seq: v.seq });
    const st = s.run(CLI, ['status', '--change', o.json.change]);
    assert.equal(st.code, 2, `${change}: ${st.stdout}`);
    assert.equal(st.json.done, false);
    assert.ok(st.json.missing.some((m) => /not run with --change/.test(m)), st.stdout);
  }
});

test('bindRefusal: the verify-* CLIs may run under a change only when it is open for exactly that read-back and approved', (t) => {
  const s = setup(t);
  assert.match(changes.bindRefusal(s.log, 'chg-0123456789ab', 'okta:verify-factor-reset'), /holds no change/);
  const o = openChange(s);
  assert.match(changes.bindRefusal(s.log, o.json.change, 'okta:verify-factor-reset'), /no approval/);
  s.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]);
  assert.match(changes.bindRefusal(s.log, o.json.change, 'okta:verify-status'), /proved by okta:verify-factor-reset/);
  assert.match(changes.bindRefusal(s.log, o.json.change, 'github:verify-factor-reset'), /proved by okta:verify-factor-reset/);
  assert.equal(changes.bindRefusal(s.log, o.json.change, 'okta:verify-factor-reset'), null);
});

test('the change-record module writes only the local audit trail: no network module, no child process', () => {
  const source = fs.readFileSync(CLI, 'utf8');
  const requires = [...source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(requires, ['./audit-log.js', 'node:crypto', 'node:fs', 'node:path']);
});

// Code review round 2 of the batch G3 close-out, finding 2: open's printed next steps say to run
// the read-back with --change and the id, and that link takes the audit_seq it prints.
test('open tells the operator to run the read-back with --change <id> and to link the audit_seq it prints', (t) => {
  const s = setup(t);
  const o = openChange(s);
  const step = o.json.next.find((n) => /read-back/.test(n));
  assert.ok(step.includes(`--change ${o.json.change}`), step);
  assert.match(step, /audit_seq/);
  // Jira prints the seq in its own line (code review round 3, finding 7)
  assert.match(step, /Recorded as audit entry N/);
});

// ── Batch G3 close-out 2, owner decision 2: a counted batch change ──────────────────────────
// A gate whose required confirmation names a count of objects, each proved by its own verify-*
// read-back (change-record.js COUNTED_GATES), is opened with --expected N, the number written in
// the ticket. status prints "verified k of N", lists each failed read-back, and reports done
// only when N distinct bound read-backs passed after the approval; anything less is "partial",
// never done. Distinct means distinct run ids where the read-back records one (a job id, never a
// user, email, device name or serial); where it records none, bound read-backs are counted and
// status says a repeated read of the same object is not detected. A gate without a count keeps
// the one-read-back rule (every test above).
const FLEET_BATCH = { gate: 'fleet-device-actions-batch-script-portal', command: 'fleet-device-actions', readBack: 'fleet:verify-script' };
const OKTA_BULK = { gate: 'okta-group-membership-bulk-add-portal', command: 'okta-group-membership', readBack: 'okta:verify-group-member' };

// Batch G3 close-out 3, owner decision H2: a counted gate's saved procedure carries its count on
// one line, Count: N, so the approved digest covers N and open refuses another --expected.
function countedProcedure(s, n) {
  const file = path.join(s.dir, `procedure-count-${n}.md`);
  fs.writeFileSync(file, `${fs.readFileSync(s.procedure, 'utf8').replace(/\s+$/, '')}\nCount: ${n}\n`);
  return file;
}
function openCounted(s, g, expected) {
  const args = ['open', '--command', g.command, '--gate', g.gate, '--r-class', 'R3', '--target', '[FLEET_NAME]', '--read-back', g.readBack, '--procedure-file', expected === undefined ? s.procedure : countedProcedure(s, expected)];
  if (expected !== undefined) args.push('--expected', String(expected));
  return s.run(CLI, args);
}
function approved(s, g, expected) {
  const o = openCounted(s, g, expected);
  assert.equal(o.code, 0, o.stderr);
  const a = s.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]);
  assert.equal(a.code, 0, a.stderr);
  return o.json.change;
}
// Fleet's script execution ids are UUIDs (vendor docs); a run id of any other form is refused
const uuid = (n) => `3f2a9c1e-77b0-4c2b-9d1e-${String(n).padStart(12, '0')}`;
const runRead = (s, change, run, verified = true) => s.log.append({ kind: 'verify', connector: 'fleet', command: 'verify-script', verified, state: 'OK', change, run });
// a presence read records no pass flag ('' since the batch G3 close-out 3, owner decision H1)
const personRead = (s, change, verified = true, flags = '') => s.log.append({ kind: 'verify', connector: 'okta', command: 'verify-group-member', verified, state: 'OK', change, flags });
const status = (s, change) => s.run(CLI, ['status', '--change', change]);

test('a counted gate opened without --expected is refused at open, and nothing is recorded', (t) => {
  const s = setup(t);
  const before = s.log.entries().length;
  const r = openCounted(s, FLEET_BATCH);
  assert.equal(r.code, 1, r.stdout);
  assert.match(r.stderr, /names a count \(\[HOST_COUNT\]\): open it with --expected N, the number written in the ticket/);
  assert.equal(s.log.entries().length, before);
  for (const bad of ['0', '-1', '2.5', 'ten', '100001']) {
    const b = openCounted(s, FLEET_BATCH, bad);
    assert.equal(b.code, 1, bad);
    assert.match(b.stderr, /--expected is the number of objects written in the ticket/, bad);
  }
  assert.equal(s.log.entries().length, before);
});

test('a gate without a count refuses --expected and keeps the one-read-back rule', (t) => {
  const s = setup(t);
  const r = s.run(CLI, ['open', '--command', 'okta-mfa-reset', '--gate', 'okta-mfa-reset-selected-portal', '--r-class', 'R2', '--target', '[UPN]', '--read-back', 'okta:verify-factor-reset', '--procedure-file', s.procedure, '--expected', '3']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /names no count/);
  const o = openChange(s);
  assert.equal(o.code, 0, o.stderr);
  const v = s.run(CLI, ['status', '--change', o.json.change]);
  assert.equal(v.json.expected, undefined, 'an uncounted change reports no count');
  assert.equal(v.json.result, undefined);
});

test('k below N reads partial and never done; k equal to N reads done', (t) => {
  const s = setup(t);
  const change = approved(s, FLEET_BATCH, 3);
  runRead(s, change, uuid(1));
  runRead(s, change, uuid(2));
  const partial = status(s, change);
  assert.equal(partial.code, 2);
  assert.equal(partial.json.done, false);
  assert.equal(partial.json.result, 'partial');
  assert.equal(partial.json.summary, 'verified 2 of 3');
  assert.ok(partial.json.missing.some((m) => /verified 2 of 3/.test(m)), partial.stdout);
  runRead(s, change, uuid(3));
  const done = status(s, change);
  assert.equal(done.code, 0, done.stdout);
  assert.equal(done.json.done, true);
  assert.equal(done.json.result, 'done');
  assert.equal(done.json.summary, 'verified 3 of 3');
  assert.deepEqual(done.json.failed, []);
});

test('one failed host keeps the change not done and names that read-back', (t) => {
  const s = setup(t);
  const change = approved(s, FLEET_BATCH, 2);
  runRead(s, change, uuid(1));
  runRead(s, change, uuid(2));
  const bad = runRead(s, change, uuid(3), false);
  const v = status(s, change);
  assert.equal(v.code, 2);
  assert.equal(v.json.done, false);
  assert.equal(v.json.result, 'partial');
  assert.deepEqual(v.json.failed, [{ seq: bad.seq, run: uuid(3), state: 'OK' }]);
  assert.ok(v.json.missing.some((m) => m.includes(`seq ${bad.seq}`) && m.includes(uuid(3))), v.stdout);
  // a run that failed while the host had not reported and passed later counts as passed
  runRead(s, change, uuid(3), true);
  const again = status(s, change);
  assert.deepEqual(again.json.failed, []);
  assert.equal(again.json.summary, 'verified 3 of 2');
  assert.equal(again.json.done, false, 'more hosts passed than the ticket names: not done');
  assert.ok(again.json.missing.some((m) => /more than the 2 the ticket names/.test(m)), again.stdout);
});

test('the same execution id read twice counts once', (t) => {
  const s = setup(t);
  const change = approved(s, FLEET_BATCH, 2);
  runRead(s, change, uuid(1));
  runRead(s, change, uuid(1));
  const v = status(s, change);
  assert.equal(v.json.summary, 'verified 1 of 2');
  assert.equal(v.json.done, false);
  runRead(s, change, uuid(2));
  assert.equal(status(s, change).json.done, true);
});

test('a read-back that records no run id counts bound read-backs and says a repeated read is not detected', (t) => {
  const s = setup(t);
  const change = approved(s, OKTA_BULK, 2);
  personRead(s, change);
  const one = status(s, change);
  assert.equal(one.json.summary, 'verified 1 of 2');
  assert.match(one.json.note, /a repeated read of the same object is not detected/);
  personRead(s, change);
  const two = status(s, change);
  assert.equal(two.json.done, true, two.stdout);
  assert.match(two.json.note, /a repeated read of the same object is not detected/);
});

test('only bound read-backs of the named kind recorded after the approval count toward k', (t) => {
  const s = setup(t);
  const o = openCounted(s, FLEET_BATCH, 2);
  // before the approval, unbound, another change's, another command's: none counts
  const early = runRead(s, o.json.change, uuid(9));
  s.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]);
  runRead(s, null, uuid(1));
  runRead(s, 'chg-0123456789ab', uuid(2));
  s.log.append({ kind: 'verify', connector: 'fleet', command: 'verify-lock', verified: true, state: 'OK', change: o.json.change });
  const v = status(s, o.json.change);
  assert.equal(v.json.summary, 'verified 0 of 2', v.stdout);
  assert.ok(early.seq > 0);
});

test('the audit trail takes a run id that is a job id and refuses one that is not job-shaped', (t) => {
  const s = setup(t);
  assert.ok(runRead(s, null, '3f2a9c1e-77b0-4c2b-9d1e-0a1b2c3d4e5f').seq > 0);
  // security review 1 of the batch G3 close-out 2: a serial, a host name or a user name passed
  // as an execution id must never be recorded, so the trail takes a UUID only
  for (const bad of ['person@example.com', 'two words', '', 'x'.repeat(129), 'C02XK1ABJG5H', 'LT-JohnSmith', 'DESKTOP-JSMITH01', 'jsmith', 'exec-0001']) {
    assert.throws(() => runRead(s, null, bad), audit.AuditRefused, bad);
  }
  assert.throws(() => s.log.append({ kind: 'procedure', command: 'okta-mfa-reset', gate: 'g', r_class: 'R2', target: '[UPN]', read_back: null, procedure_sha256: null, change: null, expected: 3 }), audit.AuditRefused, 'a count only on a change record');
});

// ── Code review round 1 of the batch G3 close-out 2 ─────────────────────────────────────────
// Finding 1: a Fleet read that got no answer (a timeout, a 404 from a mistyped id) records run
// null; it proves nothing about any host, so it is listed and does not block a change whose N
// runs passed. Finding 2: a pass with no run id (Fleet answered without execution_id) cannot be
// told apart from a re-read, so for a read-back that records run ids it does not count toward k.
test('a Fleet read with no run id is listed as uncounted: one that got no answer does not block, a passing one does not count', (t) => {
  const s = setup(t);
  const change = approved(s, FLEET_BATCH, 2);
  const timeout = s.log.append({ kind: 'verify', connector: 'fleet', command: 'verify-script', verified: false, state: 'TIMEOUT', change });
  const noId = s.log.append({ kind: 'verify', connector: 'fleet', command: 'verify-script', verified: true, state: 'OK', change });
  runRead(s, change, uuid(1));
  const one = status(s, change);
  assert.equal(one.json.summary, 'verified 1 of 2', 'a pass with no run id does not count');
  assert.deepEqual(one.json.uncounted.map((u) => u.seq), [timeout.seq, noId.seq]);
  assert.deepEqual(one.json.failed, [], 'a read with no answer is not a failed host');
  runRead(s, change, uuid(2));
  const done = status(s, change);
  assert.equal(done.json.done, true, done.stdout);
  assert.equal(done.json.uncounted.length, 2);
});

// Finding 4 (round 1) made a failed read with no run id non-blocking; code review round 2,
// finding 1, showed that lets a batch with a known failed object read done. The owner's rule
// stands: a failed read keeps the change not done and is named. With no run id it cannot be
// matched to a later pass of the same object, so it stays (a new change takes the objects left).
// Round 2, finding 5: more passes than N also reads partial, as with run ids.
test('a read-back with no run id: a failed read keeps the change not done, and more passes than N read partial', (t) => {
  const s = setup(t);
  const change = approved(s, OKTA_BULK, 2);
  const bad = personRead(s, change, false);
  personRead(s, change);
  personRead(s, change);
  const v = status(s, change);
  assert.equal(v.json.done, false, v.stdout);
  assert.equal(v.json.summary, 'verified 2 of 2');
  assert.deepEqual(v.json.failed.map((f) => f.seq), [bad.seq]);
  assert.ok(v.json.missing.some((m) => m.includes(`seq ${bad.seq}`)), v.stdout);
  assert.match(v.json.note, /a repeated read of the same object is not detected/);
  const over = approved(s, OKTA_BULK, 2);
  personRead(s, over); personRead(s, over); personRead(s, over);
  const o = status(s, over);
  assert.equal(o.json.done, false);
  assert.ok(o.json.missing.some((m) => /more than the 2 the ticket names/.test(m)), o.stdout);
});

// Finding 6: open checks the gate against the runbook it names, so a mistyped counted gate is
// refused instead of falling back to the one-read-back rule.
// Code review round 2, finding 2: a command with no runbook is refused too, so a misspelled
// --command cannot skip the gate check; finding 3: the gate is checked before the count, so a
// misspelled counted gate given with --expected is told the gate is missing.
test('open refuses a command with no runbook, and checks the gate before the count', (t) => {
  const s = setup(t);
  const r = s.run(CLI, ['open', '--command', 'fleet-device-action', '--gate', 'fleet-device-actions-batch-script', '--r-class', 'R3', '--target', '[FLEET_NAME]', '--read-back', 'fleet:verify-script', '--procedure-file', s.procedure]);
  assert.equal(r.code, 1, r.stdout);
  assert.match(r.stderr, /no runbook \.claude\/commands\/fleet-device-action\.md/);
  const e = s.run(CLI, ['open', '--command', 'fleet-device-actions', '--gate', 'fleet-device-actions-batch-script', '--r-class', 'R3', '--target', '[FLEET_NAME]', '--read-back', 'fleet:verify-script', '--procedure-file', s.procedure, '--expected', '5']);
  assert.equal(e.code, 1);
  assert.match(e.stderr, /has no gate fleet-device-actions-batch-script/);
  const bad = s.run(CLI, ['open', '--command', '../../etc/passwd', '--gate', 'g', '--r-class', 'R3', '--target', '[UPN]', '--read-back', 'fleet:verify-script', '--procedure-file', s.procedure]);
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /--command is a runbook name/);
  assert.equal(s.log.entries().length, 0);
});

// Round 2, finding 4: a Fleet read that got an answer but recorded no run id (an answer for no
// id, or another id) is a failed host, not a read with no answer, so it blocks; only a read with
// no answer (a state other than OK) is uncounted. Finding 9: open's next step for a read-back
// with no run id says to read each object once and that a re-read is not detected. Finding 14:
// the trail takes a run only on a read-back that records one.
test('a Fleet failure with an answer but no run id blocks; open\'s next step and the trail follow the run-id rule', (t) => {
  const s = setup(t);
  const change = approved(s, FLEET_BATCH, 1);
  const answered = s.log.append({ kind: 'verify', connector: 'fleet', command: 'verify-script', verified: false, state: 'OK', change });
  runRead(s, change, uuid(1));
  const v = status(s, change);
  assert.equal(v.json.done, false, v.stdout);
  assert.deepEqual(v.json.failed.map((f) => f.seq), [answered.seq]);
  const o = openCounted(s, OKTA_BULK, 3);
  const step = o.json.next.find((n) => /read-back/.test(n));
  assert.match(step, /read each of the 3 objects once: a re-read of the same object is not detected/);
  assert.doesNotMatch(step, /distinct/);
  assert.throws(() => s.log.append({ kind: 'verify', connector: 'okta', command: 'verify-group-member', verified: true, state: 'OK', change: null, run: uuid(7) }), audit.AuditRefused);
});

test('open refuses a gate the named runbook does not have', (t) => {
  const s = setup(t);
  const r = s.run(CLI, ['open', '--command', 'fleet-device-actions', '--gate', 'fleet-device-actions-batch-script', '--r-class', 'R3', '--target', '[FLEET_NAME]', '--read-back', 'fleet:verify-script', '--procedure-file', s.procedure]);
  assert.equal(r.code, 1, r.stdout);
  assert.match(r.stderr, /\.claude\/commands\/fleet-device-actions\.md has no gate fleet-device-actions-batch-script/);
  assert.equal(s.log.entries().length, 0);
});

// Code review round 3 of the batch G3 close-out 2. Finding 1: a read that got no answer (a state
// other than OK: a timeout, a rate limit, a 404 from a mistyped id) proves nothing about any
// object, so it is uncounted for every counted kind, not a failed object that blocks for good.
// Finding 2: a Fleet failure that got an answer but recorded no run id cannot be matched to a
// later pass of the same host, so status names the way forward: a new change for the hosts left.
test('a read with no answer is uncounted for a read-back with no run id too; an answered Fleet failure with no run id names the way forward', (t) => {
  const s = setup(t);
  const change = approved(s, OKTA_BULK, 2);
  const timeout = s.log.append({ kind: 'verify', connector: 'okta', command: 'verify-group-member', verified: false, state: 'TIMEOUT', change, flags: '' });
  personRead(s, change);
  personRead(s, change);
  const v = status(s, change);
  assert.equal(v.json.done, true, v.stdout);
  assert.deepEqual(v.json.failed, []);
  assert.deepEqual(v.json.uncounted.map((u) => u.seq), [timeout.seq]);
  const fleet = approved(s, FLEET_BATCH, 1);
  s.log.append({ kind: 'verify', connector: 'fleet', command: 'verify-script', verified: false, state: 'OK', change: fleet });
  runRead(s, fleet, uuid(1));
  const f = status(s, fleet);
  assert.equal(f.json.done, false);
  assert.ok(f.json.missing.some((m) => /recorded no run id/.test(m) && /open a new change for the hosts left/.test(m)), f.stdout);
  assert.ok(!f.json.missing.some((m) => /that run never passed/.test(m) && !/\(run /.test(m)), 'no "that run never passed" for an entry with no run');
});

// ── Batch G3 close-out 3, owner decision H1: a presence pass never proves a removal ───────────
// The change record names its read-back with the flags that change what its pass means
// (okta:verify-group-member --absent); open refuses a flag that does not, a value outside its
// set, and a form the gate's own read-back lines in its runbook do not use; link and status
// count only a read-back whose recorded flags match.
const H1 = {
  removePerson: { gate: 'okta-group-membership-remove-person-portal', command: 'okta-group-membership' },
  ruleCreate: { gate: 'okta-group-membership-rule-create-portal', command: 'okta-group-membership' },
  bulkRemove: { gate: 'okta-group-membership-bulk-remove-portal', command: 'okta-group-membership' },
  protection: { gate: 'github-branch-protection-add-rule-portal', command: 'github-branch-protection' },
};
const openH1 = (s, g, readBack, more = []) => {
  const n = more.includes('--expected') ? more[more.indexOf('--expected') + 1] : undefined;
  return s.run(CLI, ['open', '--command', g.command, '--gate', g.gate, '--r-class', 'R2', '--target', '[UPN]', '--read-back', readBack, '--procedure-file', n === undefined ? s.procedure : countedProcedure(s, n), ...more]);
};
function approvedH1(s, g, readBack, more) {
  const o = openH1(s, g, readBack, more);
  assert.equal(o.code, 0, o.stderr);
  assert.equal(s.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]).code, 0);
  return o.json.change;
}
const link = (s, change, seq) => s.run(CLI, ['link', '--change', change, '--verify-seq', String(seq)]);

test('open names the read-back with its pass flags, in one form, and refuses a flag that does not change what a pass means', (t) => {
  const s = setup(t);
  const o = openH1(s, H1.protection, 'github:verify-protection --reviews 2 --no-deletions --enforce-admins --no-force-push');
  assert.equal(o.code, 0, o.stderr);
  assert.equal(s.log.entries().find((e) => e.change === o.json.change).read_back, 'github:verify-protection --enforce-admins --no-deletions --no-force-push --reviews 2');
  const object = openH1(s, H1.removePerson, 'okta:verify-group-member --group 00g1 --absent');
  assert.equal(object.code, 1);
  assert.match(object.stderr, /--group does not change what okta:verify-group-member's pass means/);
  const value = openH1(s, H1.removePerson, 'okta:verify-group-member --absent yes');
  assert.equal(value.code, 1, value.stdout);
  assert.equal(s.log.entries().length, 1, 'only the first open was recorded');
});

test('open refuses a removal gate named without --absent, and an add gate named with it', (t) => {
  const s = setup(t);
  const bare = openH1(s, H1.removePerson, 'okta:verify-group-member');
  assert.equal(bare.code, 1, bare.stdout);
  assert.match(bare.stderr, /okta-group-membership-remove-person-portal/);
  assert.match(bare.stderr, /okta:verify-group-member --absent/);
  const add = openH1(s, H1.ruleCreate, 'okta:verify-group-member --absent');
  assert.equal(add.code, 1, add.stdout);
  assert.match(add.stderr, /okta-group-membership-rule-create-portal/);
  assert.equal(openH1(s, H1.removePerson, 'okta:verify-group-member --absent').code, 0);
  assert.equal(openH1(s, H1.ruleCreate, 'okta:verify-group-member').code, 0);
});

// Security review 1 of the batch G3 close-out 3: the form check compared only the gate's lines
// of the same read-back, so a removal gate could be opened for another connector's or another
// command's presence read. A gate whose runbook binds read-backs now takes only one of those.
test('open refuses a read-back the gate\'s runbook does not bind for it: another connector\'s or command\'s read never proves a removal', (t) => {
  const s = setup(t);
  // the one-person removal binds two read-backs, both with --absent
  for (const readBack of ['msgraph:verify-group-member', 'msgraph:verify-group-member --absent', 'okta:verify-app-assigned']) {
    const o = openH1(s, H1.removePerson, readBack);
    assert.equal(o.code, 1, `${readBack}: ${o.stdout}`);
    assert.match(o.stderr, /gate okta-group-membership-remove-person-portal's read-back in \.claude\/commands\/okta-group-membership\.md runs as okta:verify-group-member --absent or okta:verify-app-assigned --absent, not as /, readBack);
  }
  // the counted removal binds one, so the other Okta read-back and Graph's are refused
  for (const readBack of ['okta:verify-app-assigned --absent', 'msgraph:verify-group-member --absent']) {
    const counted = openH1(s, H1.bulkRemove, readBack, ['--expected', '2']);
    assert.equal(counted.code, 1, `${readBack}: ${counted.stdout}`);
    assert.match(counted.stderr, /gate okta-group-membership-bulk-remove-portal's read-back in \.claude\/commands\/okta-group-membership\.md runs as okta:verify-group-member --absent, not as /, readBack);
  }
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
  assert.equal(openH1(s, H1.removePerson, 'okta:verify-group-member --absent').code, 0);
  assert.equal(openH1(s, H1.removePerson, 'okta:verify-app-assigned --absent').code, 0);
});

// Code review round 1 of the batch G3 close-out 3, finding 1: a comment that names its read-back
// for several gates ("read-back of [a], [b] or [c]") bound it to the first gate only, so the
// others took any read-back. Each gate it names now binds it.
test('a read-back named for several gates in one comment binds each of them', (t) => {
  const s = setup(t);
  const open = (command, gate, readBack) => s.run(CLI, ['open', '--command', command, '--gate', gate, '--r-class', 'R2', '--target', '[UPN]', '--read-back', readBack, '--procedure-file', s.procedure]);
  const named = [
    // since batch G4 (task A3) a time-bounded read-back is named with its bound, bare
    ['password-reset', 'password-reset-cloud-portal', 'msgraph:verify-password-changed --not-before'],
    ['password-reset', 'password-cloud-reset', 'msgraph:verify-password-changed --not-before'],
    ['password-reset', 'password-reset-synced-portal', 'msgraph:verify-password-changed --not-before'],
    ['password-reset', 'password-session-revoke-portal', 'msgraph:verify-sessions-revoked --not-before'],
    ['password-reset', 'password-session-revoke', 'msgraph:verify-sessions-revoked --not-before'],
    ['security-alert-triage', 'security-session-revoke-portal', 'msgraph:verify-sessions-revoked --not-before'],
    ['security-alert-triage', 'security-session-revoke', 'msgraph:verify-sessions-revoked --not-before'],
  ];
  for (const [command, gate, readBack] of named) {
    const other = open(command, gate, 'msgraph:verify-group-member');
    assert.equal(other.code, 1, `${gate}: ${other.stdout}`);
    assert.match(other.stderr, new RegExp(`gate ${gate}'s read-back in \\.claude/commands/${command}\\.md runs as ${readBack}, not as msgraph:verify-group-member`), gate);
  }
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
  for (const [command, gate, readBack] of named) assert.equal(open(command, gate, readBack).code, 0, `${gate} opens for ${readBack}`);
});

// Code review round 1 of the batch G3 close-out 3, finding 5: a gate whose runbook binds no
// read-back was not compared, so open took any read-back for it, and an unrelated or presence
// pass could make an R3 disable or removal done. Such a gate now takes no change record.
test('open refuses a gate whose runbook binds no read-back: its proof is the read its runbook names, never a change record', (t) => {
  const s = setup(t);
  const open = (command, gate, readBack) => s.run(CLI, ['open', '--command', command, '--gate', gate, '--r-class', 'R3', '--target', '[UPN]', '--read-back', readBack, '--procedure-file', s.procedure]);
  for (const [command, gate, readBack] of [
    ['offboard', 'offboard-ad-disable-portal', 'msgraph:verify-account-enabled --enabled false'],
    ['offboard', 'offboard-group-strip-portal', 'msgraph:verify-group-member --absent'],
    ['security-alert-triage', 'security-synced-ad-disable', 'okta:verify-group-member'],
    ['printer-issue', 'print-queue-delete-portal', 'okta:verify-factor-reset'],
  ]) {
    const r = open(command, gate, readBack);
    assert.equal(r.code, 1, `${gate}: ${r.stdout}`);
    assert.match(r.stderr, new RegExp(`gate ${gate} in \\.claude/commands/${command}\\.md binds no read-back`), gate);
  }
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
});

// Code review round 1 of the batch G3 close-out 3, finding 3: the rollback read-back written in
// the prose after /github-branch-protection's Phase F was bound to the last exception gate above
// it, so open for "disable a ruleset" took only the read that passes when protection is on.
test('an exception gate that weakens protection is never opened for the read that passes when protection is on', (t) => {
  const s = setup(t);
  const on = 'github:verify-protection --enforce-admins --no-deletions --no-force-push --reviews 2';
  const r = s.run(CLI, ['open', '--command', 'github-branch-protection', '--gate', 'github-branch-protection-disable-ruleset-portal', '--r-class', 'R3', '--target', '[REPO_NAME]', '--read-back', on, '--procedure-file', s.procedure]);
  assert.equal(r.code, 1, r.stdout);
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
  // the rollback gates that restore protection still take it
  assert.equal(openH1(s, H1.protection, on).code, 0);
});

test('a removal change is not done by a passing read without --absent, and is done by a passing --absent read under its change', (t) => {
  const s = setup(t);
  const change = approvedH1(s, H1.removePerson, 'okta:verify-group-member --absent');
  const presence = personRead(s, change, true, '');
  const l = link(s, change, presence.seq);
  assert.equal(l.code, 2, l.stdout);
  assert.match(l.stderr, /okta:verify-group-member --absent/);
  assert.equal(status(s, change).json.done, false);
  const absent = personRead(s, change, true, '--absent');
  assert.equal(link(s, change, absent.seq).code, 0);
  assert.equal(status(s, change).json.done, true);
});

test('an add change is not done by an --absent read', (t) => {
  const s = setup(t);
  const change = approvedH1(s, H1.ruleCreate, 'okta:verify-group-member');
  const absent = personRead(s, change, true, '--absent');
  assert.equal(link(s, change, absent.seq).code, 2);
  assert.equal(status(s, change).json.done, false);
  const present = personRead(s, change, true, '');
  assert.equal(link(s, change, present.seq).code, 0);
  assert.equal(status(s, change).json.done, true);
});

test('a counted removal counts only --absent reads: a presence read is listed as uncounted', (t) => {
  const s = setup(t);
  const change = approvedH1(s, H1.bulkRemove, 'okta:verify-group-member --absent', ['--expected', '2']);
  const presence = personRead(s, change, true, '');
  personRead(s, change, true, '--absent');
  const one = status(s, change);
  assert.equal(one.json.summary, 'verified 1 of 2', one.stdout);
  assert.ok(one.json.uncounted.some((u) => u.seq === presence.seq && /flags/.test(u.reason)), one.stdout);
  personRead(s, change, true, '--absent');
  assert.equal(status(s, change).json.done, true);
});

// Code review round 1 of the batch G3 close-out 3, finding 2: a change record opened before this
// batch names its read-back bare (okta:verify-group-member) even for a removal, and a bare name
// now means the presence form, so an in-flight removal change would be proved by a presence read
// and its --absent read refused. The --change check, link and status re-check the change's
// read-back against its gate's runbook, so such a change proves nothing and says to open a new one.
test('a change whose read-back its gate no longer binds in that form (opened before this batch, or written around the CLI) is never done and refuses its read', (t) => {
  const s = setup(t);
  const change = 'chg-0123456789ab';
  const digest = changes.procedureDigest(fs.readFileSync(s.procedure, 'utf8'));
  const old = s.log.append({ kind: 'procedure', command: H1.removePerson.command, gate: H1.removePerson.gate, r_class: 'R2', target: '[UPN]', read_back: 'okta:verify-group-member', procedure_sha256: digest, change });
  s.log.append({ kind: 'approval', ref: 'IT-123', gate: H1.removePerson.gate, procedure_sha256: digest, change });
  const refusal = changes.bindRefusal(s.log, change, 'okta:verify-group-member');
  assert.match(String(refusal), /okta-group-membership-remove-person-portal/, 'the presence read is refused before any read');
  assert.match(String(refusal), /open a new change/);
  const presence = personRead(s, change, true, '');
  assert.ok(presence.seq > old.seq);
  const l = link(s, change, presence.seq);
  assert.equal(l.code, 2, l.stdout);
  const st = status(s, change);
  assert.equal(st.json.done, false, st.stdout);
  assert.ok(st.json.missing.some((m) => /open a new change/.test(m)), st.stdout);
});

// Code review round 2 of the batch G3 close-out 3, finding 2: the re-check judged every change
// against today's runbook, so a done change read not done after any edit of its runbook (a
// read-back line moved, a gate renamed). Only a read-back named without the pass flags its gate's
// line runs is stale now: the one way a change opened before this batch differs. Finding 9:
// approve refuses such a change, so no approval is recorded for one nothing can prove.
test('a done change stays done after its runbook changes; only a read-back named without its line\'s pass flags is stale', (t) => {
  const s = setup(t);
  const gateFor = require('./trail-helper.js').testRunbooks(s.dir, t);
  const g = gateFor('okta:verify-group-member --absent');
  const call = (argv) => {
    const out = [];
    const err = [];
    const code = changes.main(argv, s.env, { out: (x) => out.push(x), err: (x) => err.push(x) });
    return { code, text: out.join('') + err.join(''), json: (() => { try { return JSON.parse(out.join('')); } catch { return null; } })() };
  };
  const o = call(['open', '--command', g.command, '--gate', g.gate, '--r-class', 'R2', '--target', '[UPN]', '--read-back', 'okta:verify-group-member --absent', '--procedure-file', s.procedure]);
  assert.equal(o.code, 0, o.text);
  assert.equal(call(['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]).code, 0);
  const read = personRead(s, o.json.change, true, '--absent');
  assert.equal(call(['link', '--change', o.json.change, '--verify-seq', String(read.seq)]).code, 0);
  assert.equal(call(['status', '--change', o.json.change]).json.done, true);
  // the runbook is edited: the gate's read-back line is removed
  const file = path.join(s.dir, 'commands', 'aegis-test.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^node scripts\/adapters\/okta-client\.js .*$/m, '# the read-back moved'));
  const after = call(['status', '--change', o.json.change]);
  assert.equal(after.json.done, true, after.text);
});

test('approve refuses a change whose read-back is named without its gate\'s pass flags, and records nothing', (t) => {
  const s = setup(t);
  const change = 'chg-0123456789ab';
  const digest = changes.procedureDigest(fs.readFileSync(s.procedure, 'utf8'));
  s.log.append({ kind: 'procedure', command: H1.removePerson.command, gate: H1.removePerson.gate, r_class: 'R2', target: '[UPN]', read_back: 'okta:verify-group-member', procedure_sha256: digest, change });
  const before = s.log.entries().length;
  const a = s.run(CLI, ['approve', '--change', change, '--ref', 'IT-123', '--procedure-sha256', digest]);
  assert.notEqual(a.code, 0, a.stdout);
  assert.match(a.stderr, /open a new change/);
  assert.equal(s.log.entries().length, before, 'nothing recorded');
});

// Code review round 3 of the batch G3 close-out 3, findings 1 and 2: round 2 judged only a
// read-back named bare, so an entry from before this batch that names a read-back its gate does
// not bind (or a gate that binds none) was no longer stale, and a change opened today could still
// turn stale when its runbook later changed. open now marks its entries (gate_checked); an entry
// without the mark gets open's whole check, failing closed, and a marked one is never re-judged.
test('an entry from before this batch is judged by open\'s whole check; a change open marked is never re-judged', (t) => {
  const s = setup(t);
  const digest = changes.procedureDigest(fs.readFileSync(s.procedure, 'utf8'));
  const old = (change, command, gate, readBack) => {
    s.log.append({ kind: 'procedure', command, gate, r_class: 'R3', target: '[UPN]', read_back: readBack, procedure_sha256: digest, change });
    s.log.append({ kind: 'approval', ref: 'IT-123', gate, procedure_sha256: digest, change });
  };
  old('chg-0000000000a1', 'okta-user-lifecycle', 'okta-user-lifecycle-deactivate-portal', 'okta:verify-factor-reset');
  assert.match(String(changes.bindRefusal(s.log, 'chg-0000000000a1', 'okta:verify-factor-reset')), /open a new change/, 'another kind than the gate binds');
  old('chg-0000000000a2', 'printer-issue', 'print-queue-delete-portal', 'okta:verify-factor-reset');
  assert.match(String(changes.bindRefusal(s.log, 'chg-0000000000a2', 'okta:verify-factor-reset')), /open a new change/, 'a gate that binds no read-back');
  // a change opened today, bare on an add gate, stays valid when its line later gains --absent
  const gateFor = require('./trail-helper.js').testRunbooks(s.dir, t);
  const g = gateFor('okta:verify-group-member');
  const out = [];
  assert.equal(changes.main(['open', '--command', g.command, '--gate', g.gate, '--r-class', 'R2', '--target', '[UPN]', '--read-back', 'okta:verify-group-member', '--procedure-file', s.procedure], s.env, { out: (x) => out.push(x), err: () => {} }), 0);
  const o = JSON.parse(out.join(''));
  assert.equal(s.log.entries().find((e) => e.change === o.change).gate_checked, true, 'open marks its entry');
  assert.equal(changes.main(['approve', '--change', o.change, '--ref', 'IT-123', '--procedure-sha256', o.procedure_sha256], s.env, { out: () => {}, err: () => {} }), 0);
  const file = path.join(s.dir, 'commands', 'aegis-test.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('verify-group-member --change', 'verify-group-member --absent --change'));
  assert.equal(changes.bindRefusal(s.log, o.change, 'okta:verify-group-member'), null);
});

// ── Batch G3 close-out 3, owner decision H2: the approval covers N ─────────────────────────────
// A counted gate's saved procedure carries its count on one line, Count: N; open refuses an
// --expected that differs from it, and a procedure without one, so the digest the approval names
// covers N. A gate without a count keeps today's rule.
const openBatch = (s, file, expected) => s.run(CLI, ['open', '--command', FLEET_BATCH.command, '--gate', FLEET_BATCH.gate, '--r-class', 'R3', '--target', '[FLEET_NAME]', '--read-back', FLEET_BATCH.readBack, '--procedure-file', file, '--expected', String(expected)]);

test('a counted gate\'s procedure carries its count, and open refuses an N that differs from it or a procedure without one', (t) => {
  const s = setup(t);
  const none = openBatch(s, s.procedure, 3);
  assert.equal(none.code, 1, none.stdout);
  assert.match(none.stderr, /Count: N/);
  const differ = openBatch(s, countedProcedure(s, 5), 3);
  assert.equal(differ.code, 1, differ.stdout);
  assert.match(differ.stderr, /--expected 3 is not the Count: 5/);
  const twice = path.join(s.dir, 'procedure-twice.md');
  fs.writeFileSync(twice, `${fs.readFileSync(countedProcedure(s, 3), 'utf8')}Count: 4\n`);
  assert.equal(openBatch(s, twice, 3).code, 1, 'one Count line');
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
  const same = openBatch(s, countedProcedure(s, 3), 3);
  assert.equal(same.code, 0, same.stderr);
  assert.equal(s.log.entries()[0].expected, 3);
});

// Code review round 1 of the batch G3 close-out 3, finding 12: only a line starting exactly with
// "Count:" was read, so an indented, bulleted, quoted or upper-case second count was ignored while
// the approver saw it. Any line whose first word is a count now counts, and there must be one.
test('a second count written in another shape (indented, a bullet, a quote, a heading, another case) is refused', (t) => {
  const s = setup(t);
  for (const extra of ['  Count: 50', '- Count: 50', '* Count: 50', '> Count: 50', '## Count: 50', 'COUNT: 50', 'count:50', '1. Count: 50']) {
    const file = path.join(s.dir, 'procedure-shape.md');
    fs.writeFileSync(file, `${fs.readFileSync(countedProcedure(s, 5), 'utf8')}${extra}\n`);
    const r = openBatch(s, file, 5);
    assert.equal(r.code, 1, `${JSON.stringify(extra)}: ${r.stdout}`);
    assert.match(r.stderr, /one line Count: N/, extra);
  }
  const alone = path.join(s.dir, 'procedure-bullet.md');
  fs.writeFileSync(alone, `${fs.readFileSync(s.procedure, 'utf8')}- Count: 5\n`);
  assert.equal(openBatch(s, alone, 5).code, 1, 'the count line is exactly Count: N');
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
  assert.equal(openBatch(s, countedProcedure(s, 5), 5).code, 0);
});

// Code review round 2 of the batch G3 close-out 3, finding 5: Markdown emphasis, a task box, a
// table cell or backticks still hid a second count the approver would read.
test('a second count wrapped in Markdown (bold, a task box, a table cell, italics, backticks) is refused', (t) => {
  const s = setup(t);
  for (const extra of ['**Count**: 50', '**Count:** 50', '- [ ] Count: 50', '| Count: 50 |', '_Count:_ 50', '`Count: 50`']) {
    const file = path.join(s.dir, 'procedure-markdown.md');
    fs.writeFileSync(file, `${fs.readFileSync(countedProcedure(s, 5), 'utf8')}${extra}\n`);
    const r = openBatch(s, file, 5);
    assert.equal(r.code, 1, `${JSON.stringify(extra)}: ${r.stdout}`);
  }
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
});

// Code review round 3 of the batch G3 close-out 3, finding 4: links, HTML, strikethrough,
// escaped emphasis, a later table cell, other bullets and an invisible prefix still hid a second
// count. Any line where the word count is followed by a colon is now a count line.
test('a second count in any line where the word count meets a colon is refused', (t) => {
  const s = setup(t);
  for (const extra of ['[Count: 50](#)', '<b>Count:</b> 50', '~~Count: 50~~', '\\*\\*Count\\*\\*: 50', '| Hosts | Count: 50 |', '\u2022 Count: 50', 'a) Count: 50', '\u200bCount: 50', 'Count\uff1a 50']) {
    const file = path.join(s.dir, 'procedure-any.md');
    fs.writeFileSync(file, `${fs.readFileSync(countedProcedure(s, 5), 'utf8')}${extra}\n`);
    const r = openBatch(s, file, 5);
    assert.equal(r.code, 1, `${JSON.stringify(extra)}: ${r.stdout}`);
  }
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
  assert.equal(openBatch(s, countedProcedure(s, 5), 5).code, 0, 'the one plain Count line still opens');
});

test('an approval given for one N does not cover a different N', (t) => {
  const s = setup(t);
  const twelve = openBatch(s, countedProcedure(s, 12), 12);
  assert.equal(twelve.code, 0, twelve.stderr);
  assert.equal(s.run(CLI, ['approve', '--change', twelve.json.change, '--ref', 'IT-123', '--procedure-sha256', twelve.json.procedure_sha256]).code, 0);
  const five = openBatch(s, countedProcedure(s, 5), 5);
  assert.equal(five.code, 0, five.stderr);
  assert.notEqual(five.json.procedure_sha256, twelve.json.procedure_sha256, 'the count is inside the approved digest');
  const reuse = s.run(CLI, ['approve', '--change', five.json.change, '--ref', 'IT-123', '--procedure-sha256', twelve.json.procedure_sha256]);
  assert.equal(reuse.code, 2, reuse.stdout);
  assert.match(reuse.stderr, /does not match/);
  for (let i = 1; i <= 5; i += 1) runRead(s, five.json.change, uuid(i));
  const v = status(s, five.json.change);
  assert.equal(v.json.done, false, 'a change whose N no one approved never reads done');
  assert.match(v.json.missing.join(' '), /no approval/);
});

test('a gate without a count keeps today\'s rule: no Count line needed, and --expected still refused', (t) => {
  const s = setup(t);
  assert.equal(openChange(s).code, 0, 'an uncounted gate opens with a procedure that has no Count line');
  const withCount = s.run(CLI, ['open', '--command', 'okta-mfa-reset', '--gate', 'okta-mfa-reset-selected-portal', '--r-class', 'R2', '--target', '[UPN]', '--read-back', 'okta:verify-factor-reset', '--procedure-file', countedProcedure(s, 2)]);
  assert.equal(withCount.code, 0, 'a Count line on an uncounted gate is only text');
  const expected = s.run(CLI, ['open', '--command', 'okta-mfa-reset', '--gate', 'okta-mfa-reset-selected-portal', '--r-class', 'R2', '--target', '[UPN]', '--read-back', 'okta:verify-factor-reset', '--procedure-file', countedProcedure(s, 2), '--expected', '2']);
  assert.equal(expected.code, 1);
  assert.match(expected.stderr, /names no count/);
});

// ── Batch G4, task A1: security review 2's O1, a disguised count line ──────────────────────────
// A count line disguised with a format character or a look-alike letter, next to a real count hidden
// in an HTML comment, passed checkCount: the approver saw Count: 5 and the change opened for 50.
// Before matching, the text is folded (compatibility decomposition, every \p{Cf}, \p{Mn} and \p{Me}
// character removed, composed again); a count line whose keyword holds a letter outside A to Z is
// refused; a count line inside an HTML comment or another hidden region is refused; the one
// accepted form stays the visible line Count: N.
const withLines = (s, name, extra) => {
  const file = path.join(s.dir, `procedure-${name}.md`);
  fs.writeFileSync(file, `${fs.readFileSync(s.procedure, 'utf8').replace(/\s+$/, '')}\n${extra.join('\n')}\n`);
  return file;
};

test('A1: a format character inside the keyword (zero width, soft hyphen, bidi, variation selector, tag) makes a count line, so a second count is refused', (t) => {
  const s = setup(t);
  for (const inside of ['​', '­', '‮', '⁦', '️', '\u{e0041}', '⁠']) {
    const disguised = `Cou${inside}nt: 50`;
    const beside = openBatch(s, withLines(s, 'format', ['Count: 5', disguised]), 5);
    assert.equal(beside.code, 1, `${JSON.stringify(disguised)} beside the real line: ${beside.stdout}`);
    assert.match(beside.stderr, /one line Count: N/, JSON.stringify(disguised));
    const alone = openBatch(s, withLines(s, 'format-alone', [disguised]), 50);
    assert.equal(alone.code, 1, `${JSON.stringify(disguised)} alone: ${alone.stdout}`);
  }
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
});

test('A1: a combining mark on a letter of the keyword or on the number makes a count line, so a second count is refused', (t) => {
  const s = setup(t);
  for (const disguised of ['Cöunt: 50', 'Çount: 50', 'Count́: 50', 'Count: 5⃝0', 'Coun̶t: 50']) {
    const r = openBatch(s, withLines(s, 'mark', ['Count: 5', disguised]), 5);
    assert.equal(r.code, 1, `${JSON.stringify(disguised)}: ${r.stdout}`);
    assert.match(r.stderr, /one line Count: N/, JSON.stringify(disguised));
  }
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
});

test('A1: a look-alike letter outside A to Z in the keyword (Cyrillic, Greek, a small capital) is refused, alone or beside the real line', (t) => {
  const s = setup(t);
  for (const disguised of ['Cоunt: 50', 'Сount: 50', 'Cοunt: 50', 'Counт: 50', 'ᴄount: 50', 'Соипт: 50']) {
    const beside = openBatch(s, withLines(s, 'script', ['Count: 5', disguised]), 5);
    assert.equal(beside.code, 1, `${JSON.stringify(disguised)} beside the real line: ${beside.stdout}`);
    assert.match(beside.stderr, /outside the Latin letters A to Z/, JSON.stringify(disguised));
    const alone = openBatch(s, withLines(s, 'script-alone', [disguised]), 50);
    assert.equal(alone.code, 1, `${JSON.stringify(disguised)} alone: ${alone.stdout}`);
    assert.match(alone.stderr, /outside the Latin letters A to Z/, JSON.stringify(disguised));
  }
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
});

test('A1: a full-width digit or letter is a count line but not the accepted form', (t) => {
  const s = setup(t);
  for (const disguised of ['Count: ５', 'Ｃount: 5', 'Count: ５０', 'Count：5']) {
    const alone = openBatch(s, withLines(s, 'wide', [disguised]), 5);
    assert.equal(alone.code, 1, `${JSON.stringify(disguised)} alone: ${alone.stdout}`);
    const beside = openBatch(s, withLines(s, 'wide-beside', ['Count: 5', disguised]), 5);
    assert.equal(beside.code, 1, `${JSON.stringify(disguised)} beside the real line: ${beside.stdout}`);
  }
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
});

test('A1 (O1): a real count hidden in an HTML comment next to a disguised visible one is refused, for either number', (t) => {
  const s = setup(t);
  const hidden = [
    ['<!--', 'Count: 50', '-->'],
    ['<!-- Count: 50 -->'],
    ['<!--', 'Count: 50'],
    ['<div hidden>', 'Count: 50', '</div>'],
    ['<span style="display: none">', 'Count: 50', '</span>'],
    ['<p style="visibility:hidden">', 'Count: 50', '</p>'],
    ['<template>', 'Count: 50', '</template>'],
    ['<script>', 'Count: 50', '</script>'],
    ['<style>', 'Count: 50', '</style>'],
    ['<noscript>', 'Count: 50', '</noscript>'],
    ['[//]: # (Count: 50)'],
  ];
  for (const visible of ['Cоunt: 5', 'Cou​nt: 5', 'Cöunt: 5', 'Count: 5']) {
    for (const region of hidden) {
      for (const expected of [5, 50]) {
        const r = openBatch(s, withLines(s, 'hidden', [visible, ...region]), expected);
        assert.equal(r.code, 1, `${JSON.stringify([visible, ...region])} --expected ${expected}: ${r.stdout}`);
      }
    }
  }
  // the O1 case itself names the hidden region
  const o1 = openBatch(s, withLines(s, 'o1', ['Cоunt: 5', '<!--', 'Count: 50', '-->']), 50);
  assert.match(o1.stderr, /HTML comment or another hidden region/);
  const plainHidden = openBatch(s, withLines(s, 'plain-hidden', ['Count: 5', '<!--', 'Count: 50', '-->']), 5);
  assert.match(plainHidden.stderr, /HTML comment or another hidden region/);
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
});

test('A1: the plain visible line Count: N still opens, beside comments, hidden regions and words that only look near it', (t) => {
  const s = setup(t);
  const plain = openBatch(s, withLines(s, 'plain', ['Count: 5']), 5);
  assert.equal(plain.code, 0, plain.stderr);
  const around = openBatch(s, withLines(s, 'around', ['<!-- reviewed by [ADMIN_NAME] -->', 'Count: 5', '<details><summary>Script</summary>', 'Write-Host "[HOST_COUNT] hosts"', '</details>', 'Mount: /dev/[DEVICE_NAME]', 'Court: none', 'Accounts: 5 (see the ticket)']), 5);
  assert.equal(around.code, 0, around.stderr);
  assert.equal(s.log.entries().length, 2);
  assert.equal(s.log.entries()[1].expected, 5);
});

// ── Batch G4, code review round 1, finding 11: an invisible filler inside the keyword ────────────
// A Default_Ignorable_Code_Point character that is not a format character or a mark survived the
// fold: the Hangul fillers (U+3164, U+115F, U+1160, U+FFA0) are letters, and unassigned default
// ignorable code points (U+2065, U+FFF0, U+E0080, U+E0FFF) are in no class the fold removed. Both
// render as nothing, so Cou<filler>nt: 999 read as Count: 999 beside the real Count: 5 was not seen
// as a second count. Every \p{Default_Ignorable_Code_Point} character is removed before matching,
// as format characters are; the visible plain Count: N stays the only accepted form.
const FILLERS = { hangul: ['ㅤ', 'ᅟ', 'ᅠ', 'ﾠ'], unassigned: ['⁥', '￰', '\u{e0080}', '\u{e0fff}'] };
for (const [label, chars] of Object.entries(FILLERS)) {
  test(`F11: an invisible ${label} default ignorable character inside the keyword makes a count line, so a second count is refused`, (t) => {
    const s = setup(t);
    for (const inside of chars) {
      for (const disguised of [`Cou${inside}nt: 999`, `${inside}Count: 999`, `C${inside}o${inside}u${inside}n${inside}t: 999`]) {
        const beside = openBatch(s, withLines(s, 'filler', ['Count: 5', disguised]), 5);
        assert.equal(beside.code, 1, `${JSON.stringify(disguised)} beside the real line: ${beside.stdout}`);
        assert.match(beside.stderr, /one line Count: N/, JSON.stringify(disguised));
        const alone = openBatch(s, withLines(s, 'filler-alone', [disguised]), 999);
        assert.equal(alone.code, 1, `${JSON.stringify(disguised)} alone: ${alone.stdout}`);
      }
    }
    assert.equal(s.log.entries().length, 0, 'nothing recorded');
  });
}

test('F11: a count whose keyword holds a filler inside a hidden region is refused as hidden', (t) => {
  const s = setup(t);
  for (const inside of [...FILLERS.hangul, ...FILLERS.unassigned]) {
    const r = openBatch(s, withLines(s, 'filler-hidden', ['Count: 5', `<!-- Cou${inside}nt: 999 -->`]), 5);
    assert.equal(r.code, 1, `${JSON.stringify(inside)}: ${r.stdout}`);
    assert.match(r.stderr, /HTML comment or another hidden region/, JSON.stringify(inside));
  }
  assert.equal(s.log.entries().length, 0, 'nothing recorded');
});

test('F11: the plain visible Count: N still opens when a filler sits elsewhere in the text', (t) => {
  const s = setup(t);
  const r = openBatch(s, withLines(s, 'filler-elsewhere', ['Count: 5', `Note:${FILLERS.hangul[0]} the hosts are in the ticket`, `Mount${FILLERS.unassigned[0]}: none`]), 5);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(s.log.entries().length, 1);
  assert.equal(s.log.entries()[0].expected, 5);
});

// ── Batch G4, task A2: one approval writer ───────────────────────────────────────────────────────
// audit-log.js approval wrote an approval for any change id (round 3 of the batch G3 close-out 3,
// finding 5). It is removed from the CLI: change-record.js approve is the one writer, and it checks
// that the change is open, the gate it names, the digest of the procedure issued for it, and that
// the change has no earlier approval; a refusal writes nothing.
test('A2: audit-log.js approval writes nothing: an unknown change id, a change not yet opened, a mismatched digest, a second approval', (t) => {
  const s = setup(t);
  const procedureOnly = s.run(AUDIT_CLI, ['procedure', '--command', 'okta-mfa-reset', '--gate', 'okta-mfa-reset-selected-portal', '--r-class', 'R2', '--target', '[UPN]', '--procedure-sha256', 'd'.repeat(64)]);
  assert.equal(procedureOnly.code, 0, procedureOnly.stderr);
  const o = openChange(s);
  assert.equal(o.code, 0, o.stderr);
  const first = s.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]);
  assert.equal(first.code, 0, first.stderr);
  const before = s.log.entries().length;
  const cases = [
    ['an unknown change id', ['--change', 'chg-zz', '--procedure-sha256', o.json.procedure_sha256]],
    ['a change not yet opened', ['--change', 'chg-0123456789ab', '--procedure-sha256', 'd'.repeat(64)]],
    ['a mismatched digest', ['--change', o.json.change, '--procedure-sha256', 'c'.repeat(64)]],
    ['a second approval', ['--change', o.json.change, '--procedure-sha256', o.json.procedure_sha256]],
  ];
  for (const [label, rest] of cases) {
    const r = s.run(AUDIT_CLI, ['approval', '--ref', 'IT-124', '--gate', 'okta-mfa-reset-selected-portal', ...rest]);
    assert.equal(r.code, 1, `${label}: ${r.stdout}`);
    assert.match(r.stderr, /change-record\.js approve/, label);
    assert.equal(s.log.entries().length, before, `${label}: nothing recorded`);
  }
  assert.doesNotMatch(fs.readFileSync(AUDIT_CLI, 'utf8').split('\n').slice(0, 40).join('\n'), /audit-log\.js approval --ref/, 'the header no longer offers the approval command');
});

test('A2: change-record.js approve refuses an unknown change, a change not yet opened, a mismatched digest and a second approval, and writes nothing', (t) => {
  const s = setup(t);
  const o = openChange(s);
  assert.equal(s.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]).code, 0);
  const before = s.log.entries().length;
  const unknown = s.run(CLI, ['approve', '--change', 'chg-zz', '--ref', 'IT-124', '--procedure-sha256', o.json.procedure_sha256]);
  assert.notEqual(unknown.code, 0, unknown.stdout);
  const notOpened = s.run(CLI, ['approve', '--change', 'chg-0123456789ab', '--ref', 'IT-124', '--procedure-sha256', o.json.procedure_sha256]);
  assert.equal(notOpened.code, 2, notOpened.stdout);
  assert.match(notOpened.stderr, /no procedure was issued/);
  const mismatch = s.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-124', '--procedure-sha256', 'c'.repeat(64)]);
  assert.equal(mismatch.code, 2, mismatch.stdout);
  const second = s.run(CLI, ['approve', '--change', o.json.change, '--ref', 'IT-125', '--procedure-sha256', o.json.procedure_sha256]);
  assert.equal(second.code, 2, second.stdout);
  assert.match(second.stderr, /already has an approval \(audit seq \d+, IT-123\); one approval per change\. Nothing was recorded/);
  assert.equal(s.log.entries().length, before, 'nothing recorded');
  // the supported path still makes the change done
  const v = verifyEntry(s, true, o.json.change);
  assert.equal(s.run(CLI, ['link', '--change', o.json.change, '--verify-seq', String(v.seq)]).code, 0);
  const st = s.run(CLI, ['status', '--change', o.json.change]);
  assert.equal(st.code, 0, st.stdout);
  assert.equal(st.json.approval.ref, 'IT-123');
});

test('A2: two approvals of one change raced from two processes: exactly one is recorded', async (t) => {
  const s = setup(t);
  const o = openChange(s);
  const { spawn } = require('node:child_process');
  const once = (ref) => new Promise((resolve) => {
    const c = spawn(process.execPath, [CLI, 'approve', '--change', o.json.change, '--ref', ref, '--procedure-sha256', o.json.procedure_sha256], { env: s.env });
    c.on('close', (code) => resolve(code));
  });
  const codes = await Promise.all(['IT-201', 'IT-202', 'IT-203', 'IT-204'].map(once));
  assert.deepEqual(codes.sort(), [0, 2, 2, 2]);
  assert.equal(s.log.entries().filter((e) => e.kind === 'approval').length, 1);
});

// ── Batch G4, task A3: every flag that decides what a pass means (D10 on PR #9) ───────────────────
// A time bound (--not-before) is recorded with its read-back: the change names it bare (its value is
// chosen after the approval), the verify entry records the value in UTC, and a --not-before earlier
// than the change's approval never proves the change, since it could pass on a change made before
// the approval. The closed-set flag newly declared (--method) and the digest and type flags count
// only with the same value.
const { testRunbooks } = require('./trail-helper.js');
const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
// every verify-* command that takes a time bound, with the other pass flags it is named with
const TIMED = {
  'fleet:verify-checked-in': '', 'fleet:verify-deleted': '',
  'google-workspace:verify-event': '--app admin --event CHANGE_PASSWORD',
  'jamf:verify-command': '--type INSTALL_PROFILE', 'jamf:verify-checked-in': '',
  'linear:verify-comment': `--expect-sha256 ${DIGEST_A}`,
  'msgraph:verify-password-changed': '', 'msgraph:verify-signin': '', 'msgraph:verify-device-synced': '', 'msgraph:verify-sessions-revoked': '',
  'okta:verify-sessions-cleared': '', 'okta:verify-password-reset': '',
  'slack:verify-posted': `--expect-sha256 ${DIGEST_A}`,
  'jira:verify-create': `--expect-sha256 ${DIGEST_A}`, 'jira:verify-comment': `--expect-sha256 ${DIGEST_A}`,
};

function inProcessTrail(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-a3-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { AEGIS_AUDIT_DIR: path.join(dir, 'audit') };
  const procedure = path.join(dir, 'procedure.md');
  fs.writeFileSync(procedure, 'Phase B: the gated change for [UPN].\n');
  const gateFor = testRunbooks(dir, t);
  const log = audit.openAuditLog({ dir: env.AEGIS_AUDIT_DIR });
  const record = (argv) => {
    const out = [];
    const err = [];
    const code = changes.main(argv, env, { out: (x) => out.push(x), err: (x) => err.push(x) });
    let json = null;
    try { json = JSON.parse(out.join('')); } catch { /* not JSON */ }
    return { code, json, text: out.join('') + err.join('') };
  };
  const approvedChange = (readBack) => {
    const g = gateFor(readBack);
    const o = record(['open', '--command', g.command, '--gate', g.gate, '--r-class', 'R2', '--target', '[UPN]', '--read-back', readBack, '--procedure-file', procedure]);
    assert.equal(o.code, 0, o.text);
    const a = record(['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]);
    assert.equal(a.code, 0, a.text);
    const approval = log.entries().find((e) => e.kind === 'approval' && e.change === o.json.change);
    return { change: o.json.change, approvalAt: Date.parse(approval.at), approve: a };
  };
  const read = (kind, change, flags, verified = true) => {
    const [connector, command] = kind.split(':');
    return log.append({ kind: 'verify', connector, command, verified, state: 'OK', change, run: null, flags });
  };
  return { record, approvedChange, read, log, gateFor, procedure };
}
const iso = (ms) => new Date(ms).toISOString();

test('A3: each read-back with a time bound is named with --not-before; one earlier than the approval is not done, one at or after it is done when it passes', (t) => {
  const declaredTimed = Object.entries(audit.PASS_FLAGS).filter(([, f]) => f['not-before']).map(([k]) => k).sort();
  assert.deepEqual(declaredTimed, Object.keys(TIMED).sort(), 'every command with a time bound is covered here');
  for (const [kind, others] of Object.entries(TIMED)) {
    const tr = inProcessTrail(t);
    const named = audit.parseReadBack([kind, others, '--not-before'].filter(Boolean).join(' ')).readBack;
    const { change, approvalAt, approve } = tr.approvedChange(named);
    assert.match(approve.json.next || approve.text, /--not-before at or after/, `${kind}: approve names the earliest time bound`);
    const flagsFor = (ms) => audit.passFlags(kind, [kind.split(':')[1], ...others.split(' ').filter(Boolean), '--not-before', iso(ms)]);
    assert.match(flagsFor(approvalAt), /--not-before \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, `${kind}: the value is recorded in UTC`);
    const early = tr.read(kind, change, flagsFor(approvalAt - 3600 * 1000));
    const l1 = tr.record(['link', '--change', change, '--verify-seq', String(early.seq)]);
    assert.equal(l1.code, 2, `${kind}: ${l1.text}`);
    assert.match(l1.text, /earlier than the approval/, kind);
    const st1 = tr.record(['status', '--change', change]);
    assert.equal(st1.json.done, false, `${kind}: an early time bound never proves the change`);
    const onTime = tr.read(kind, change, flagsFor(approvalAt));
    const l2 = tr.record(['link', '--change', change, '--verify-seq', String(onTime.seq)]);
    assert.equal(l2.code, 0, `${kind}: ${l2.text}`);
    const st2 = tr.record(['status', '--change', change]);
    assert.equal(st2.code, 0, `${kind}: ${st2.text}`);
    assert.equal(st2.json.done, true, kind);
  }
});

test('A3: an early time bound linked around the CLI still never makes the change done', (t) => {
  const tr = inProcessTrail(t);
  const kind = 'msgraph:verify-sessions-revoked';
  const { change, approvalAt } = tr.approvedChange(`${kind} --not-before`);
  const early = tr.read(kind, change, audit.passFlags(kind, ['verify-sessions-revoked', '--not-before', iso(approvalAt - 60000)]));
  tr.log.append({ kind: 'change-link', change, verify_seq: early.seq });
  const st = tr.record(['status', '--change', change]);
  assert.equal(st.json.done, false);
  assert.match(st.json.missing.join(' '), /earlier than the approval/);
});

test('A3: a time bound in epoch milliseconds is recorded in UTC and judged the same way', (t) => {
  const tr = inProcessTrail(t);
  const kind = 'jira:verify-create';
  const { change, approvalAt } = tr.approvedChange(`${kind} --expect-sha256 ${DIGEST_A} --not-before`);
  const flags = audit.passFlags(kind, ['verify-create', '--expect-sha256', DIGEST_A, '--not-before', String(approvalAt + 1000)]);
  assert.equal(flags, `--expect-sha256 ${DIGEST_A} --not-before ${iso(approvalAt + 1000)}`);
  const v = tr.read(kind, change, flags);
  assert.equal(tr.record(['link', '--change', change, '--verify-seq', String(v.seq)]).code, 0);
  assert.equal(tr.record(['status', '--change', change]).json.done, true);
});

test('A3: a change whose read-back takes a time bound is not opened without it, and the bound is named without a value', (t) => {
  const tr = inProcessTrail(t);
  const g = tr.gateFor('msgraph:verify-sessions-revoked --not-before');
  for (const bad of ['msgraph:verify-sessions-revoked', 'msgraph:verify-sessions-revoked --not-before 2026-10-28T09:00:00Z']) {
    const r = tr.record(['open', '--command', g.command, '--gate', g.gate, '--r-class', 'R2', '--target', '[UPN]', '--read-back', bad, '--procedure-file', tr.procedure]);
    assert.equal(r.code, 1, `${bad}: ${r.text}`);
    assert.match(r.text, /--not-before/, bad);
  }
  const good = tr.record(['open', '--command', g.command, '--gate', g.gate, '--r-class', 'R2', '--target', '[UPN]', '--read-back', 'msgraph:verify-sessions-revoked --not-before', '--procedure-file', tr.procedure]);
  assert.equal(good.code, 0, good.text);
  assert.match(good.json.next.join(' '), /--not-before at or after the approval/);
});

// --factor-type stays not a pass flag (scripts/adapters/verify-flags.js gives the reason), so it is
// not among these cases.
test('A3: a mismatched --expect-sha256, --type or --method is not done', (t) => {
  const cases = [
    ['slack:verify-posted', `--expect-sha256 ${DIGEST_A} --not-before`, (ms) => `--expect-sha256 ${DIGEST_B} --not-before ${iso(ms)}`],
    ['linear:verify-comment', `--expect-sha256 ${DIGEST_A} --not-before`, (ms) => `--expect-sha256 ${DIGEST_B} --not-before ${iso(ms)}`],
    ['jira:verify-comment', `--expect-sha256 ${DIGEST_A} --not-before`, (ms) => `--expect-sha256 ${DIGEST_B} --not-before ${iso(ms)}`],
    ['jamf:verify-command', '--not-before --type INSTALL_PROFILE', (ms) => `--not-before ${iso(ms)} --type REMOVE_PROFILE`],
    ['slack:verify-guest', '--type single', () => '--type multi'],
    ['msgraph:verify-mfa-method', '--method microsoftAuthenticator', () => '--method phone'],
  ];
  for (const [kind, named, other] of cases) {
    const tr = inProcessTrail(t);
    const { change, approvalAt } = tr.approvedChange(`${kind} ${named}`);
    const v = tr.read(kind, change, other(approvalAt + 1000));
    const l = tr.record(['link', '--change', change, '--verify-seq', String(v.seq)]);
    assert.equal(l.code, 2, `${kind}: ${l.text}`);
    assert.match(l.text, /this change is proved only by/, kind);
    assert.equal(tr.record(['status', '--change', change]).json.done, false, kind);
  }
});

// ── Batch G4, task D1: one INCONCLUSIVE verdict state ─────────────────────────────────────────
// A read-back whose answer proves nothing either way is recorded with state INCONCLUSIVE and
// verified false. A counted change lists it under uncounted with that reason: it neither counts
// toward N nor keeps the change partial, with or without a run id, and link refuses it as a
// proof like any read-back that did not verify.
const inconclusiveRead = (s, entry) => s.log.append({ kind: 'verify', verified: false, state: 'INCONCLUSIVE', ...entry });

test('D1: an INCONCLUSIVE read-back is uncounted with its reason, never a pass and never a failed object (no run id)', (t) => {
  const s = setup(t);
  const change = approved(s, OKTA_BULK, 2);
  const unsure = inconclusiveRead(s, { connector: 'okta', command: 'verify-group-member', change, flags: '' });
  personRead(s, change);
  const v = status(s, change);
  assert.equal(v.code, 2, v.stdout);
  assert.equal(v.json.done, false);
  assert.equal(v.json.summary, 'verified 1 of 2');
  assert.deepEqual(v.json.failed, [], 'an INCONCLUSIVE read is not a failed object');
  assert.deepEqual(v.json.uncounted.map((u) => [u.seq, u.state]), [[unsure.seq, 'INCONCLUSIVE']]);
  assert.match(v.json.uncounted[0].reason, /proves nothing either way \(INCONCLUSIVE\)/);
  assert.match(v.json.uncounted[0].reason, /neither a pass nor a failed object/);
  personRead(s, change);
  const done = status(s, change);
  assert.equal(done.json.done, true, done.stdout);
  assert.equal(done.json.summary, 'verified 2 of 2');
});

test('D1: an INCONCLUSIVE read of a run is uncounted, and a later pass of the same run counts once', (t) => {
  const s = setup(t);
  const change = approved(s, FLEET_BATCH, 1);
  const pending = inconclusiveRead(s, { connector: 'fleet', command: 'verify-script', change, run: uuid(1) });
  const before = status(s, change);
  assert.equal(before.json.done, false);
  assert.equal(before.json.summary, 'verified 0 of 1');
  assert.deepEqual(before.json.failed, []);
  assert.deepEqual(before.json.uncounted.map((u) => [u.seq, u.run, u.state]), [[pending.seq, uuid(1), 'INCONCLUSIVE']]);
  assert.match(before.json.uncounted[0].reason, /proves nothing either way/);
  runRead(s, change, uuid(1));
  const after = status(s, change);
  assert.equal(after.json.done, true, after.stdout);
  assert.equal(after.json.summary, 'verified 1 of 1');
});

test('D1: link refuses an INCONCLUSIVE read-back as the proof of a change', (t) => {
  const s = setup(t);
  const o = openChange(s);
  assert.equal(o.code, 0, o.stderr);
  const change = o.json.change;
  assert.equal(s.run(CLI, ['approve', '--change', change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]).code, 0);
  const unsure = inconclusiveRead(s, { connector: 'okta', command: 'verify-factor-reset', change });
  const l = s.run(CLI, ['link', '--change', change, '--verify-seq', String(unsure.seq)]);
  assert.equal(l.code, 2, l.stdout);
  assert.match(l.stderr, /did not verify/);
  assert.equal(status(s, change).json.done, false);
});
