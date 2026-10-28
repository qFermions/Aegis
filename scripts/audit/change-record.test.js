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
  const v = verifyEntry(s, true);
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
  const v = verifyEntry(b, true);
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

test('the change-record module writes only the local audit trail: no network module, no child process', () => {
  const source = fs.readFileSync(CLI, 'utf8');
  const requires = [...source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(requires, ['./audit-log.js', 'node:crypto', 'node:fs', 'node:path']);
});
