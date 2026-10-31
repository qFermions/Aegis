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

test('an approval written straight into the trail with a mismatched digest still leaves the change not done', (t) => {
  const s = setup(t);
  const o = openChange(s);
  const w = s.run(AUDIT_CLI, ['approval', '--ref', 'IT-124', '--gate', 'okta-mfa-reset-selected-portal', '--procedure-sha256', 'c'.repeat(64), '--change', o.json.change]);
  assert.equal(w.code, 0, w.stderr);
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
  const fleet = s.log.append({ kind: 'verify', connector: 'fleet', command: 'verify-checked-in', verified: true, state: 'OK', change: null });
  const status = s.log.append({ kind: 'verify', connector: 'okta', command: 'verify-status', verified: true, state: 'OK', change: null });
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
  for (const good of ['okta:verify-factor-reset', 'github:verify-collaborator', 'jamf:verify-checked-in', 'jira:verify-comment']) assert.equal(open(good).code, 0, good);
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

function openCounted(s, g, expected) {
  const args = ['open', '--command', g.command, '--gate', g.gate, '--r-class', 'R3', '--target', '[FLEET_NAME]', '--read-back', g.readBack, '--procedure-file', s.procedure];
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
const personRead = (s, change, verified = true) => s.log.append({ kind: 'verify', connector: 'okta', command: 'verify-group-member', verified, state: 'OK', change });
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
