#!/usr/bin/env node
'use strict';
// audit-log.test.js: the append-only, hash-chained audit trail (batch G3, task 3b).
//
// EXPECTED DECISION (written before the module)
// - One module writes the trail: scripts/audit/audit-log.js. Every entry is one JSON line
//   with seq, at, kind, its fields, prev (the hash of the entry before it) and hash; a head
//   file names the last seq and hash.
// - Four kinds: connector-call, procedure, approval, verify. Each kind has a fixed field
//   list and every value has a fixed shape (names, states, numbers, placeholders, issue
//   keys, SHA-256 digests). Anything else is refused before a byte is written, so a secret,
//   a token, a raw body or a personal value cannot reach the file.
// - verify walks the chain and reports the first broken link: an edited entry, a line that
//   is not JSON (a cut line), a missing, reordered or inserted entry, a removed tail (the
//   head names a later entry) or a missing head. An append onto a broken tail is refused.
// - Concurrent writers (separate processes) never corrupt the chain.
// - status summarises connector failures by connector and state over a time window.
// - The README says what the chain cannot prove without external storage.
// Run: node --test scripts/audit/audit-log.test.js

const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const audit = require('./audit-log.js');

const CLI = path.join(__dirname, 'audit-log.js');
const NOW = Date.parse('2026-10-28T12:00:00.000Z');
// a synthetic address at a reserved domain, built at run time so the commit scanner does not
// read the fixture as a real address
const PERSON_ADDRESS = ['person', 'corp.example'].join('@');

function freshDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-audit-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const CALL = { kind: 'connector-call', connector: 'fleet', operation: 'host', state: 'OK', attempts: 1, status: 200, request_id: null, handoff: null, duration_ms: 12 };
const PROCEDURE = { kind: 'procedure', command: 'okta-mfa-reset', gate: 'okta-mfa-reset-selected-portal', r_class: 'R2', target: '[UPN]', read_back: 'okta:verify-factor-reset --factor-type push', procedure_sha256: 'a'.repeat(64), change: 'chg-0123456789ab' };
const APPROVAL = { kind: 'approval', ref: 'IT-123', gate: 'okta-mfa-reset-selected-portal', procedure_sha256: 'a'.repeat(64), change: 'chg-0123456789ab' };
// --factor-type is a pass flag since the A3 fix on branch fix/g4-a3-factor-type, so the entry records it
const VERIFY = { kind: 'verify', connector: 'okta', command: 'verify-factor-reset', verified: true, state: 'OK', change: null, flags: '--factor-type push' };

function seeded(t, n = 4) {
  const dir = freshDir(t);
  const log = audit.openAuditLog({ dir, now: () => NOW });
  const entries = [CALL, PROCEDURE, APPROVAL, VERIFY];
  for (let i = 0; i < n; i += 1) log.append(entries[i % entries.length]);
  return { dir, log, file: path.join(dir, audit.LOG_FILE), head: path.join(dir, audit.HEAD_FILE) };
}
const linesOf = (file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
const writeLines = (file, lines) => fs.writeFileSync(file, lines.map((l) => `${l}\n`).join(''));

test('append writes one hash-chained JSON line per entry and a head naming the last one; verify passes', (t) => {
  const { log, file, head } = seeded(t, 4);
  const lines = linesOf(file);
  assert.equal(lines.length, 4);
  const entries = lines.map((l) => JSON.parse(l));
  assert.deepEqual(entries.map((e) => e.seq), [1, 2, 3, 4]);
  assert.equal(entries[0].prev, audit.GENESIS);
  for (let i = 1; i < 4; i += 1) assert.equal(entries[i].prev, entries[i - 1].hash, `entry ${i + 1} links to entry ${i}`);
  for (const e of entries) assert.match(e.hash, /^[0-9a-f]{64}$/);
  assert.equal(entries[0].at, new Date(NOW).toISOString());
  assert.deepEqual(JSON.parse(fs.readFileSync(head, 'utf8')).seq, 4);
  const v = log.verify();
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.entries, 4);
});

test('an edited entry, a cut line, a removed tail, a removed head and an inserted entry are each reported as the first broken link', (t) => {
  const cases = [
    ['edited', (file) => { const l = linesOf(file); const e = JSON.parse(l[1]); e.target = '[DEVICE_NAME]'; l[1] = JSON.stringify(e); writeLines(file, l); }, 2, /edited|hash/i],
    ['cut mid-line', (file) => { const text = fs.readFileSync(file, 'utf8'); fs.writeFileSync(file, text.slice(0, text.length - 40)); }, 4, /not JSON|truncat/i],
    ['tail removed', (file) => { const l = linesOf(file); writeLines(file, l.slice(0, 3)); }, 4, /truncat|head names/i],
    ['first entry removed', (file) => { const l = linesOf(file); writeLines(file, l.slice(1)); }, 1, /seq|prev|missing/i],
    ['forged entry inserted', (file) => { const l = linesOf(file); const forged = { ...JSON.parse(l[1]), seq: 3 }; l.splice(2, 0, JSON.stringify(forged)); writeLines(file, l); }, 3, /prev|hash|seq/i],
  ];
  for (const [name, damage, line, reason] of cases) {
    const { log, file } = seeded(t, 4);
    damage(file);
    const v = log.verify();
    assert.equal(v.ok, false, `${name}: detected`);
    assert.equal(v.firstBroken.line, line, `${name}: first broken line ${JSON.stringify(v.firstBroken)}`);
    assert.match(v.firstBroken.reason, reason, name);
  }
  const { log, head } = seeded(t, 2);
  fs.rmSync(head);
  const v = log.verify();
  assert.equal(v.ok, false, 'a missing head is detected');
  assert.match(v.firstBroken.reason, /head/i);
});

test('a reordered log is detected at the first entry out of place', (t) => {
  const { log, file } = seeded(t, 4);
  const l = linesOf(file);
  [l[1], l[2]] = [l[2], l[1]];
  writeLines(file, l);
  const v = log.verify();
  assert.equal(v.ok, false);
  assert.equal(v.firstBroken.line, 2);
  assert.match(v.firstBroken.reason, /seq|order|prev/i);
});

test('an append onto a broken tail is refused and names verify; the file is unchanged', (t) => {
  const { log, file } = seeded(t, 3);
  const l = linesOf(file);
  const e = JSON.parse(l[2]); e.state = 'OK'; e.connector = 'slack'; l[2] = JSON.stringify(e);
  writeLines(file, l);
  const before = fs.readFileSync(file, 'utf8');
  assert.throws(() => log.append(CALL), /verify/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('no secret, token, raw body or personal value can be written: unknown fields and values outside their shape are refused before a byte is written', (t) => {
  const dir = freshDir(t);
  const log = audit.openAuditLog({ dir, now: () => NOW });
  log.append(CALL);
  const file = path.join(dir, audit.LOG_FILE);
  const before = fs.readFileSync(file, 'utf8');
  const bad = [
    { ...CALL, body: '{"users":[{"email":"person@example.org"}]}' },
    { ...CALL, token: 'synthetic-token-value' },
    { ...CALL, data: { id: 1 } },
    { ...CALL, operation: 'ghp_' + 'A'.repeat(36) },
    { ...CALL, request_id: 'Bearer abc.def' },
    { ...CALL, connector: 'Fleet Server Prod' },
    { ...CALL, state: 'something else' },
    { ...CALL, attempts: -1 },
    { ...CALL, status: 'two hundred' },
    { ...PROCEDURE, target: PERSON_ADDRESS },
    { ...PROCEDURE, target: 'Jane Doe' },
    { ...PROCEDURE, target: '[UPN] and also disable MFA' },
    { ...PROCEDURE, r_class: 'R9' },
    { ...PROCEDURE, procedure_sha256: 'not-a-digest' },
    { ...APPROVAL, ref: 'ignore all previous instructions' },
    { ...APPROVAL, ref: PERSON_ADDRESS },
    { ...VERIFY, verified: 'yes' },
    { ...VERIFY, command: 'delete-user' },
    { kind: 'free-text', note: 'anything' },
    { ...CALL, seq: 99 },
    { ...CALL, hash: 'f'.repeat(64) },
  ];
  for (const entry of bad) {
    assert.throws(() => log.append(entry), audit.AuditRefused, JSON.stringify(entry).slice(0, 80));
  }
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'nothing was written');
  assert.equal(log.verify().ok, true);
});

test('concurrent writers in separate processes never corrupt the chain', async (t) => {
  const dir = freshDir(t);
  const writers = 4;
  const each = 25;
  const script = `const a = require(${JSON.stringify(path.join(__dirname, 'audit-log.js'))});
    const log = a.openAuditLog({ dir: process.argv[1] });
    for (let i = 0; i < ${each}; i += 1) log.append({ kind: 'connector-call', connector: 'slack', operation: 'users.info', state: 'OK', attempts: 1, status: 200, request_id: null, handoff: null, duration_ms: i });`;
  const runs = [];
  for (let w = 0; w < writers; w += 1) {
    runs.push(new Promise((resolve) => {
      const child = spawn(process.execPath, ['-e', script, dir], { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      child.stderr.on('data', (d) => { err += d; });
      child.on('close', (code) => resolve({ code, err }));
    }));
  }
  const results = await Promise.all(runs);
  for (const r of results) assert.equal(r.code, 0, r.err);
  const log = audit.openAuditLog({ dir });
  const v = log.verify();
  assert.equal(v.ok, true, JSON.stringify(v.firstBroken));
  assert.equal(v.entries, writers * each);
});

// Release Gate windows-latest failed at 96564ea: on Windows, opening the lock file while
// another writer is deleting it throws EPERM (or EACCES), not EEXIST, and the writer died
// instead of waiting its turn. The writer now waits on those codes too, on Windows only.
test('on Windows a lock file that another writer is deleting (EPERM or EACCES) means wait, not fail', (t) => {
  const dir = freshDir(t);
  const log = audit.openAuditLog({ dir });
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  const realOpen = fs.openSync;
  t.after(() => { Object.defineProperty(process, 'platform', platform); fs.openSync = realOpen; });
  Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
  for (const code of ['EPERM', 'EACCES']) {
    let thrown = 0;
    fs.openSync = (file, ...rest) => {
      if (String(file).endsWith('audit.lock') && thrown < 2) {
        thrown += 1;
        throw Object.assign(new Error(`${code}: operation not permitted, open 'audit.lock'`), { code });
      }
      return realOpen(file, ...rest);
    };
    log.append(CALL);
    assert.equal(thrown, 2, `${code}: the writer retried`);
  }
  fs.openSync = realOpen;
  assert.equal(log.verify().ok, true);
  assert.equal(log.entries().length, 2);
});

// Code review round 2, finding 4: a lock file being deleted clears in milliseconds; an EPERM
// or EACCES that lasts, with no lock file there, is a real permission error and is reported
// as itself, quickly, not as "held by another writer" after the 15 s wait.
// Code review round 3, finding 3: a lock pending deletion can be unreadable too, so the test
// that tells the two apart is whether the folder takes a new file. A real permission error
// refuses every new file in the folder (here: the lock and any other file).
test('on Windows a folder that refuses every new file (EPERM) is reported as itself, fast', (t) => {
  const dir = freshDir(t);
  const log = audit.openAuditLog({ dir });
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  const realOpen = fs.openSync;
  t.after(() => { Object.defineProperty(process, 'platform', platform); fs.openSync = realOpen; });
  Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
  fs.openSync = (file, ...rest) => {
    if (String(file).startsWith(dir) && !String(file).endsWith('audit.log')) throw Object.assign(new Error('EPERM: operation not permitted, open'), { code: 'EPERM' });
    return realOpen(file, ...rest);
  };
  const start = Date.now();
  assert.throws(() => log.append(CALL), (e) => e.code === 'EPERM' && !(e instanceof audit.AuditRefused));
  assert.ok(Date.now() - start < 5000, `took ${Date.now() - start} ms`);
});

test('on Windows a lock that stays pending deletion and unreadable for a while is waited out while the folder takes new files', (t) => {
  const dir = freshDir(t);
  const log = audit.openAuditLog({ dir });
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  const realOpen = fs.openSync;
  const realRead = fs.readFileSync;
  t.after(() => { Object.defineProperty(process, 'platform', platform); fs.openSync = realOpen; fs.readFileSync = realRead; });
  Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
  let denied = 0;
  const pending = Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
  fs.openSync = (file, ...rest) => {
    if (String(file).endsWith('audit.lock') && denied < 60) { denied += 1; throw pending; }
    return realOpen(file, ...rest);
  };
  fs.readFileSync = (file, ...rest) => {
    if (String(file).endsWith('audit.lock') && denied < 60) throw pending;
    return realRead(file, ...rest);
  };
  log.append(CALL);
  assert.equal(denied, 60, 'waited through 60 denials');
  fs.openSync = realOpen;
  fs.readFileSync = realRead;
  assert.equal(log.entries().length, 1);
});

test('status summarises connector failures by connector and state over a time window, matching a known event set', (t) => {
  const dir = freshDir(t);
  let clock = NOW - 3 * 24 * 3600 * 1000; // three days ago
  const log = audit.openAuditLog({ dir, now: () => clock });
  const call = (connector, state, extra = {}) => log.append({ ...CALL, connector, state, status: state === 'OK' ? 200 : null, ...extra });
  call('slack', 'TIMEOUT', { handoff: 'RETRIES_EXHAUSTED' }); // outside a 24 h window
  clock = NOW - 2 * 3600 * 1000; // two hours ago
  call('slack', 'OK');
  call('slack', 'TIMEOUT', { attempts: 3, handoff: 'RETRIES_EXHAUSTED' });
  call('slack', 'TIMEOUT', { attempts: 3, handoff: 'RETRIES_EXHAUSTED' });
  call('fleet', 'HTTP_ERROR', { status: 503, attempts: 3, handoff: 'RETRIES_EXHAUSTED' });
  call('jira', 'NO_CREDENTIALS', { attempts: 0 });
  log.append(VERIFY);
  const s = log.status({ sinceMs: NOW - 24 * 3600 * 1000, nowMs: NOW });
  assert.equal(s.chain, 'intact');
  assert.equal(s.calls, 5, 'five connector calls in the window');
  assert.equal(s.failures, 4);
  assert.deepEqual(s.byConnector, {
    fleet: { calls: 1, failures: 1, states: { HTTP_ERROR: 1 }, handoffs: { RETRIES_EXHAUSTED: 1 } },
    jira: { calls: 1, failures: 1, states: { NO_CREDENTIALS: 1 }, handoffs: {} },
    slack: { calls: 3, failures: 2, states: { TIMEOUT: 2 }, handoffs: { RETRIES_EXHAUSTED: 2 } },
  });
  const week = log.status({ sinceMs: NOW - 7 * 24 * 3600 * 1000, nowMs: NOW });
  assert.equal(week.byConnector.slack.states.TIMEOUT, 3, 'a wider window counts the older failure');
});

test('the CLI: verify exits 0 on an intact chain and 2 naming the first broken link; status prints the summary; a bad window is an input error', (t) => {
  const { dir, file } = seeded(t, 4);
  const env = { ...process.env, AEGIS_AUDIT_DIR: dir };
  const ok = spawnSync(process.execPath, [CLI, 'verify'], { env, encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /intact/);
  const st = spawnSync(process.execPath, [CLI, 'status', '--since', '24h'], { env, encoding: 'utf8' });
  assert.equal(st.status, 0, st.stderr);
  assert.equal(JSON.parse(st.stdout).chain, 'intact');
  assert.equal(spawnSync(process.execPath, [CLI, 'status', '--since', 'yesterday-ish'], { env, encoding: 'utf8' }).status, 1);
  const l = linesOf(file); const e = JSON.parse(l[2]); e.ref = 'IT-999'; l[2] = JSON.stringify(e); writeLines(file, l);
  const broken = spawnSync(process.execPath, [CLI, 'verify'], { env, encoding: 'utf8' });
  assert.equal(broken.status, 2);
  assert.match(broken.stdout, /line 3/);
  assert.doesNotMatch(broken.stdout + broken.stderr, /at Object\.|at Module\./, 'no stack trace');
});

// Code review round 2, finding 6, and round 3, finding 2: a procedure under a change id is
// written only by change-record.js open, which checks the read-back, the digest, the gate
// and the R class. The audit CLI refuses --change, and the trail itself refuses a
// change-linked procedure that misses any of them, whoever writes it.
test('the audit CLI refuses a procedure under a change id; the trail refuses a change-linked procedure without read-back, digest, gate or an R2/R3 class', (t) => {
  const dir = freshDir(t);
  const env = { ...process.env, AEGIS_AUDIT_DIR: dir };
  const base = [CLI, 'procedure', '--command', 'okta-mfa-reset', '--gate', 'okta-mfa-reset-selected-portal', '--r-class', 'R2', '--target', '[UPN]', '--procedure-sha256', 'a'.repeat(64), '--change', 'chg-0123456789ab'];
  for (const extra of [[], ['--read-back', 'okta:verify-factor-reset']]) {
    const r = spawnSync(process.execPath, [...base, ...extra], { env, encoding: 'utf8' });
    assert.equal(r.status, 1, extra.join(' '));
    assert.match(r.stderr, /change-record\.js open/);
  }
  const log = audit.openAuditLog({ dir });
  assert.equal(log.entries().length, 0);
  const full = { ...PROCEDURE, change: 'chg-0123456789ab' };
  for (const broken of [{ read_back: null }, { procedure_sha256: null }, { gate: null }, { r_class: 'R1' }]) {
    assert.throws(() => log.append({ ...full, ...broken }), audit.AuditRefused, JSON.stringify(broken));
  }
  assert.equal(log.entries().length, 0);
  log.append(full);
  assert.equal(log.entries().length, 1);
});

test('the default folder is the gitignored .aegis-state/audit, AEGIS_AUDIT_DIR overrides it, and the README says what the chain cannot prove', () => {
  const root = path.resolve(__dirname, '..', '..');
  assert.equal(audit.defaultAuditDir({}), path.join(root, '.aegis-state', 'audit'));
  assert.equal(audit.defaultAuditDir({ AEGIS_AUDIT_DIR: '/x/y' }), '/x/y');
  const ignored = spawnSync('git', ['check-ignore', '-q', path.join('.aegis-state', 'audit', 'audit.jsonl')], { cwd: root });
  assert.equal(ignored.status, 0, 'the audit log is gitignored');
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  assert.match(readme, /cannot prove/i);
  assert.match(readme, /external storage/i);
});

// Code review round 3 of the batch G3 close-out 2, finding 7: which read-backs may record a run
// is a rule for writing (append), not for the chain check, so a trail written under an older
// run-id table still verifies intact. The entry below is written by hand with a valid chain.
test('a run on a verify entry the run-id table does not name is refused on append, and an intact chain holding one still verifies', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-audit-r3-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const log = audit.openAuditLog({ dir });
  const entry = { kind: 'verify', connector: 'okta', command: 'verify-group-member', verified: true, state: 'OK', change: null, run: '3f2a9c1e-77b0-4c2b-9d1e-000000000001' };
  assert.throws(() => log.append(entry), audit.AuditRefused);
  const record = { seq: 1, at: '2026-10-31T00:00:00.000Z', ...entry, prev: audit.GENESIS };
  record.hash = audit.entryHash(record);
  const ordered = {};
  for (const key of Object.keys(record).sort()) ordered[key] = record[key];
  fs.writeFileSync(path.join(dir, audit.LOG_FILE), `${JSON.stringify(ordered)}\n`, { mode: 0o600 });
  fs.writeFileSync(path.join(dir, audit.HEAD_FILE), `${JSON.stringify({ seq: 1, hash: record.hash })}\n`, { mode: 0o600 });
  const check = audit.openAuditLog({ dir }).verify();
  assert.equal(check.ok, true, JSON.stringify(check));
});

// Batch G3 close-out 3, owner decision H1: a presence pass must never prove a removal. A verify
// entry records the flags that change what its pass means (audit-log.js PASS_FLAGS, such as
// --absent), in one canonical form, so a change record can name its read-back with them. On a
// read-back that has such flags the entry must say which ran ('' for none); on any other it
// records none. A change record's read-back names the same flags.
test('a verify entry records the flags that change what its pass means, in one form, and only on a read-back that has them', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-audit-h1-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const log = audit.openAuditLog({ dir });
  const read = (connector, command, flags) => ({ kind: 'verify', connector, command, verified: true, state: 'OK', change: null, ...(flags === undefined ? {} : { flags }) });
  assert.equal(log.append(read('okta', 'verify-group-member', '--absent')).seq, 1);
  assert.equal(log.append(read('okta', 'verify-group-member', '')).seq, 2, 'a presence read records no flag');
  assert.equal(log.append(read('github', 'verify-protection', '--enforce-admins --no-force-push --reviews 2')).seq, 3);
  // okta verify-factors-reset-all stands for a read-back with no pass flag since okta verify-factor-reset
  // --factor-type became one (the A3 fix on branch fix/g4-a3-factor-type)
  assert.equal(log.append(read('okta', 'verify-factors-reset-all')).seq, 4, 'a read-back with no pass flag records none');
  assert.throws(() => log.append(read('okta', 'verify-group-member')), audit.AuditRefused, 'a read-back with a pass flag says which ran');
  assert.throws(() => log.append(read('okta', 'verify-factors-reset-all', '--absent')), audit.AuditRefused, 'no flags on a read-back that has none');
  assert.throws(() => log.append(read('okta', 'verify-factor-reset')), audit.AuditRefused, 'a factor reset says which factor type it read');
  assert.throws(() => log.append(read('okta', 'verify-factor-reset', '--factor-type Push Factor')), audit.AuditRefused, 'a factor type is never free text');
  assert.throws(() => log.append(read('okta', 'verify-group-member', '--group 00g1')), audit.AuditRefused, 'an object flag is not a pass flag');
  assert.throws(() => log.append(read('okta', 'verify-status', '--status GONE')), audit.AuditRefused, 'a value outside the flag\'s set');
  assert.throws(() => log.append(read('github', 'verify-protection', '--reviews 2 --enforce-admins')), audit.AuditRefused, 'one canonical order');
  assert.throws(() => log.append(read('okta', 'verify-group-member', '--absent --absent')), audit.AuditRefused, 'a flag once');
  assert.equal(audit.passFlags('okta:verify-group-member', ['verify-group-member', '--group', '00g1', '--user', '00u1', '--absent', '--execute']), '--absent');
  assert.equal(audit.passFlags('okta:verify-group-member', ['verify-group-member', '--group', '00g1', '--user', '00u1']), '');
  assert.equal(audit.passFlags('github:verify-protection', ['verify-protection', '--no-force-push', '--repo', 'r', '--reviews', '2', '--enforce-admins']), '--enforce-admins --no-force-push --reviews 2');
  assert.equal(audit.passFlags('okta:verify-factors-reset-all', ['verify-factors-reset-all', '--user', '00u1']), null, 'no pass flags: null');
  assert.equal(audit.passFlags('okta:verify-factor-reset', ['verify-factor-reset', '--user', '00u1', '--factor-type', 'push']), '--factor-type push');
  assert.equal(audit.readBackFor('okta:verify-group-member', ['verify-group-member', '--absent']), 'okta:verify-group-member --absent');
  assert.equal(audit.readBackFor('okta:verify-factors-reset-all', ['verify-factors-reset-all', '--user', '00u1']), 'okta:verify-factors-reset-all');
  assert.equal(audit.readBackFor('okta:verify-factor-reset', ['verify-factor-reset', '--factor-type', 'push']), 'okta:verify-factor-reset --factor-type push');
  // a change record names its read-back with the same flags
  const proc = (readBack) => ({ kind: 'procedure', command: 'okta-group-membership', gate: 'okta-group-membership-remove-person-portal', r_class: 'R2', target: '[UPN]', read_back: readBack, procedure_sha256: 'a'.repeat(64), change: 'chg-0123456789ab' });
  assert.equal(log.append(proc('okta:verify-group-member --absent')).seq, 5);
  for (const bad of ['okta:verify-group-member --group 00g1', 'okta:verify-group-member  --absent', 'okta:verify-factor-reset --absent', 'github:verify-protection --reviews 2 --enforce-admins']) {
    assert.throws(() => log.append(proc(bad)), audit.AuditRefused, bad);
  }
  assert.equal(log.verify().ok, true);
});

// Security review 1 of the batch G3 close-out 3: the verify entry's flags were held to their form
// but not to the credential-shape check every other text field of the trail takes, and a token's
// shape can fit a flag's value rule (Google Workspace's --event).
test('a verify entry\'s flags never hold a credential-shaped value', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-audit-flags-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const log = audit.openAuditLog({ dir });
  const read = (flags) => ({ kind: 'verify', connector: 'google-workspace', command: 'verify-event', verified: true, state: 'OK', change: null, flags });
  for (const token of ['ghp_' + 'A'.repeat(36), 'AIza' + 'B'.repeat(30)]) {
    assert.throws(() => log.append(read(`--app login --event ${token}`)), audit.AuditRefused, token.slice(0, 4));
  }
  assert.equal(log.append(read('--app login --event login_success')).seq, 1);
  assert.equal(log.verify().ok, true);
});

// Code review round 1 of the batch G3 close-out 3, finding 4: Slack's verify-posted takes a digest
// in either case and lower-cases it, but the pass-flag rule took lower case only, so a run with an
// upper-case digest recorded no flag at all, as if it had run without one.
test('a digest the connector takes in either case is recorded in lower case, never dropped', () => {
  const upper = 'AB'.repeat(32);
  for (const kind of ['slack:verify-posted', 'linear:verify-comment', 'jira:verify-create', 'jira:verify-comment']) {
    const command = kind.split(':')[1];
    assert.equal(audit.passFlags(kind, [command, '--expect-sha256', upper]), `--expect-sha256 ${upper.toLowerCase()}`, kind);
    assert.equal(audit.readBackFor(kind, [command, '--expect-sha256', upper]), `${kind} --expect-sha256 ${upper.toLowerCase()}`, kind);
  }
  assert.equal(audit.passFlags('slack:verify-posted', ['verify-posted', '--expect-sha256', 'xyz']), '', 'a value that is no digest is still not recorded');
});

// Code review round 2 of the batch G3 close-out 3, finding 11: passFlags records a digest in lower
// case, but parseReadBack refused an upper-case one at open, so the two disagreed on one value.
test('a read-back named with an upper-case digest is named in lower case, as its runs are recorded', () => {
  const upper = 'CD'.repeat(32);
  const parsed = audit.parseReadBack(`slack:verify-posted --expect-sha256 ${upper}`);
  assert.equal(parsed.readBack, `slack:verify-posted --expect-sha256 ${upper.toLowerCase()}`);
  assert.equal(parsed.readBack, audit.readBackFor('slack:verify-posted', ['verify-posted', '--expect-sha256', upper]));
});
