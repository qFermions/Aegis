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

function freshDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-audit-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const CALL = { kind: 'connector-call', connector: 'fleet', operation: 'host', state: 'OK', attempts: 1, status: 200, request_id: null, handoff: null, duration_ms: 12 };
const PROCEDURE = { kind: 'procedure', command: 'okta-mfa-reset', gate: 'okta-mfa-reset-selected-portal', r_class: 'R2', target: '[UPN]', procedure_sha256: 'a'.repeat(64), change: 'chg-0123456789ab' };
const APPROVAL = { kind: 'approval', ref: 'IT-123', gate: 'okta-mfa-reset-selected-portal', procedure_sha256: 'a'.repeat(64), change: 'chg-0123456789ab' };
const VERIFY = { kind: 'verify', connector: 'okta', command: 'verify-factor-reset', verified: true, state: 'OK', change: null };

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
    { ...PROCEDURE, target: 'person@corp.example' },
    { ...PROCEDURE, target: 'Jane Doe' },
    { ...PROCEDURE, target: '[UPN] and also disable MFA' },
    { ...PROCEDURE, r_class: 'R9' },
    { ...PROCEDURE, procedure_sha256: 'not-a-digest' },
    { ...APPROVAL, ref: 'ignore all previous instructions' },
    { ...APPROVAL, ref: 'person@corp.example' },
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
