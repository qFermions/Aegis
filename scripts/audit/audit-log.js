#!/usr/bin/env node
'use strict';
// audit-log.js: the one module that writes Aegis's own audit trail (batch G3, task 3b).
// README.md beside this file.
//
// Aegis advises; humans execute (PRODUCT_CONTRACT.md). This trail records what Aegis itself
// did: each connector call (time, connector, operation, result state, attempts), each
// procedure it issued (command, gate id, R class, placeholder target, digest), each approval
// reference the operator supplied (an issue key) and each verify-* result. It is a local
// file in a gitignored folder (.aegis-state/audit/ by default, AEGIS_AUDIT_DIR to move it).
//
// Append-only and hash-chained: every entry is one JSON line carrying seq, at, kind, its
// fields, prev (the hash of the entry before it, 64 zeros for the first) and hash, the
// SHA-256 of "aegis.audit.v1", prev and the entry's canonical JSON without its hash. A head
// file names the last seq and hash, so a removed tail is found too. verify walks the chain
// and names the first broken link.
//
// What may be written is an allow-list: five kinds, each with a fixed field list, and every
// value with a fixed shape (a name, a state, a number, a placeholder, an issue key, a
// digest). Anything else is refused before a byte is written, so a secret, a token, a raw
// body or a personal value cannot reach the file.
//
// One writer at a time: a lock file created with O_EXCL; a lock left by a process that is
// gone is removed under a second lock, after checking it is still the same lock.
//
// CLI:
//   node scripts/audit/audit-log.js verify                  exit 0 intact, 2 broken
//   node scripts/audit/audit-log.js status [--since 24h]    failures by connector and state
//   node scripts/audit/audit-log.js procedure --command C --gate G --r-class R2 --target [UPN] [--procedure-sha256 H]
//     (a change record is opened with change-record.js open instead)
//   node scripts/audit/audit-log.js approval --ref IT-123 --gate G --procedure-sha256 H --change chg-...
// Exit codes: 0 ok; 1 input error or a refused entry; 2 the chain is broken or unreadable.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const LOG_FILE = 'audit.jsonl';
const HEAD_FILE = 'audit.head';
const LOCK_FILE = 'audit.lock';
const STEAL_DIR = 'audit.lock.steal';
const GENESIS = '0'.repeat(64);
const HASH_PREFIX = 'aegis.audit.v1';
const LOCK_WAIT_MS = 15000;
const STEAL_STALE_MS = 30000;

class AuditRefused extends Error {
  constructor(message) { super(message); this.name = 'AuditRefused'; }
}
class AuditBroken extends Error {
  constructor(message) { super(message); this.name = 'AuditBroken'; }
}

// ── What may be written ──────────────────────────────────────────────────────
const STATES = new Set(['OK', 'REFUSED', 'NO_CREDENTIALS', 'HTTP_ERROR', 'TIMEOUT', 'NETWORK_ERROR', 'TENANT_MISMATCH',
  'INVALID_RESPONSE', 'SCOPE_REFUSED', 'AUDIT_FAILED']);
const HANDOFFS = new Set(['RETRIES_EXHAUSTED', 'RETRY_AFTER_TOO_LONG', 'RETRY_BUDGET_SPENT', 'RATE_LIMITED']);
const NAME = /^[a-z][a-z0-9-]{1,30}$/;
// a route or query name: short words joined by dots, dashes or underscores (no word over
// 28 characters, so a token-shaped string is not a name)
const OPERATION = /^(?=.{1,64}$)[A-Za-z][A-Za-z0-9]{0,27}(?:[._-][A-Za-z0-9]{1,28})*$/;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const COMMAND = /^[a-z0-9][a-z0-9-]{0,63}$/;
const VERIFY_COMMAND = /^verify-[a-z0-9-]{1,48}$/;
// The read-back a change record names: the connector and its verify-* command.
const READ_BACK = /^[a-z][a-z0-9-]{1,30}:verify-[a-z0-9-]{1,48}$/;
const GATE = /^[a-z0-9][a-z0-9-]{0,95}$/;
const R_CLASS = /^R[0-3]$/;
// A placeholder from modules/security/placeholder-dictionary.md: one bracketed token.
const PLACEHOLDER = /^\[(?:@Aegion_[A-Za-z0-9_]{1,40}|[A-Z][A-Z0-9_]{0,39}|USER@DOMAIN\.COM|JIRA-###)\]$/;
// An approval reference: an issue key (Linear or Jira), such as IT-123.
const ISSUE_KEY = /^[A-Z][A-Z0-9]{0,9}-[1-9][0-9]{0,6}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const CHANGE_ID = /^chg-[0-9a-f]{12}$/;
// A run id a read-back recorded (batch G3 close-out 2): a job id, today Fleet's script
// execution id, which Fleet documents as a UUID. Only a UUID is taken, so a serial, a host name
// or a user name typed in its place is refused (security review 1 of that batch).
const RUN_ID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
// The read-backs that record a run id, connector:command to the flag that holds it: only a job
// id belongs here, never a user, email, device name or serial (cli-support.js runIdOf).
const RUN_IDS = Object.freeze({ 'fleet:verify-script': 'execution-id' });
// Whether a read-back (connector:command) records a run id: the one test for the trail, the CLIs
// (cli-support.js runIdOf) and status (change-record.js countedView).
const recordsRunId = (readBack) => Object.prototype.hasOwnProperty.call(RUN_IDS, readBack);

// Credential shapes refused in any value, whatever its field allows (defence in depth):
// Slack, GitHub, OpenAI-style, Google, GitLab and Okta tokens, a JWT, a bearer or basic
// header, a private key block.
const CREDENTIAL_SHAPES = /xox[a-z]-|\bgh[pousr]_|github_pat_|\bsk-[A-Za-z0-9]|AIza[0-9A-Za-z_-]{10}|ya29\.|glpat-|\bSSWS\b|eyJ[A-Za-z0-9_-]{8,}\.|\b(?:Bearer|Basic)\s|-----BEGIN/i;
const isInt = (min, max) => (v) => Number.isInteger(v) && v >= min && v <= max;
const nullable = (check) => (v) => v === null || check(v);
const matches = (re) => (v) => typeof v === 'string' && re.test(v) && !CREDENTIAL_SHAPES.test(v);
const oneOf = (set) => (v) => typeof v === 'string' && set.has(v);

const KINDS = Object.freeze({
  'connector-call': {
    connector: matches(NAME), operation: matches(OPERATION), state: oneOf(STATES), attempts: isInt(0, 10),
    status: nullable(isInt(100, 599)), request_id: nullable(matches(REQUEST_ID)), handoff: nullable(oneOf(HANDOFFS)),
    duration_ms: isInt(0, 3600000),
  },
  procedure: {
    command: matches(COMMAND), gate: nullable(matches(GATE)), r_class: matches(R_CLASS), target: matches(PLACEHOLDER),
    read_back: nullable(matches(READ_BACK)), procedure_sha256: nullable(matches(SHA256)), change: nullable(matches(CHANGE_ID)),
    // the number of objects a counted batch change acts on, as written in the ticket
    expected: nullable(isInt(1, 99999)),
  },
  approval: {
    ref: matches(ISSUE_KEY), gate: matches(GATE), procedure_sha256: matches(SHA256), change: matches(CHANGE_ID),
  },
  verify: {
    connector: matches(NAME), command: matches(VERIFY_COMMAND), verified: (v) => typeof v === 'boolean', state: oneOf(STATES),
    change: nullable(matches(CHANGE_ID)), run: nullable(matches(RUN_ID)),
  },
  // joins a verify-* result already in the trail (its seq) to a change record
  'change-link': {
    change: matches(CHANGE_ID), verify_seq: isInt(1, Number.MAX_SAFE_INTEGER),
  },
});

// Checks an entry before it is written: the kind is known, every field of the kind is
// present with a value of its shape, and there is no other field. Returns the fields in
// a fixed order.
function checkEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new AuditRefused('an audit entry is an object');
  const kind = entry.kind;
  if (typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(KINDS, kind)) throw new AuditRefused('unknown audit entry kind');
  const rules = KINDS[kind];
  for (const key of Object.keys(entry)) {
    if (key !== 'kind' && !Object.prototype.hasOwnProperty.call(rules, key)) throw new AuditRefused(`field ${JSON.stringify(key).slice(0, 40)} is not recorded for ${kind}`);
  }
  const fields = { kind };
  for (const [key, check] of Object.entries(rules)) {
    const value = Object.prototype.hasOwnProperty.call(entry, key) ? entry[key] : null;
    if (!check(value)) throw new AuditRefused(`field ${key} of ${kind} is missing or not in its allowed form`);
    fields[key] = value;
  }
  // a procedure under a change id is a change record (change-record.js): it names the
  // read-back that proves it, the issued digest and the gate, and it is R2 or R3
  if (kind === 'procedure' && fields.change !== null) {
    if (fields.read_back === null || fields.procedure_sha256 === null || fields.gate === null || (fields.r_class !== 'R2' && fields.r_class !== 'R3')) {
      throw new AuditRefused('a procedure under a change id needs its read-back, digest and gate, and an R2 or R3 class');
    }
  }
  if (kind === 'procedure' && fields.expected !== null && fields.change === null) throw new AuditRefused('a count is recorded only on a change record');
  return fields;
}

// Rules for writing a new entry, on top of its form (checkEntry). They follow today's tables, so
// verify does not apply them to entries already in the chain: a trail written under an older
// run-id table still verifies (code review round 3 of the batch G3 close-out 2, finding 7).
function checkWrite(fields) {
  // a run id only on a read-back that records one (round 2, finding 14), so no other read-back's
  // flag value can reach the trail as a run
  if (fields.kind === 'verify' && fields.run !== null && !recordsRunId(`${fields.connector}:${fields.command}`)) {
    throw new AuditRefused('a run id is recorded only by a read-back that takes one');
  }
  return fields;
}

// ── Hashing ──────────────────────────────────────────────────────────────────
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function entryHash(entry) {
  const { hash, ...rest } = entry;
  return crypto.createHash('sha256').update(`${HASH_PREFIX}\n${rest.prev}\n${canonicalJson(rest)}`, 'utf8').digest('hex');
}

// ── Files ────────────────────────────────────────────────────────────────────
function defaultAuditDir(env = process.env) {
  return typeof env.AEGIS_AUDIT_DIR === 'string' && env.AEGIS_AUDIT_DIR ? env.AEGIS_AUDIT_DIR : path.join(ROOT, '.aegis-state', 'audit');
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function processAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

function writeAtomic(file, text) {
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  const fd = fs.openSync(tmp, 'w', 0o600);
  try { fs.writeSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
}

function openAuditLog({ dir = defaultAuditDir(), now = Date.now } = {}) {
  const logFile = path.join(dir, LOG_FILE);
  const headFile = path.join(dir, HEAD_FILE);
  const lockFile = path.join(dir, LOCK_FILE);
  const stealDir = path.join(dir, STEAL_DIR);

  // A lock left by a process that is gone is removed under the steal lock, and only if it
  // is still the same lock (the same owner line), so a fresh lock is never removed.
  function stealIfDead(owner) {
    const pid = Number(String(owner).split(':')[0]);
    if (!Number.isInteger(pid) || pid <= 0 || processAlive(pid)) return;
    try { fs.mkdirSync(stealDir); } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try { if (Date.now() - fs.statSync(stealDir).mtimeMs > STEAL_STALE_MS) fs.rmdirSync(stealDir); } catch { /* gone */ }
      return;
    }
    try { if (readText(lockFile) === owner) fs.unlinkSync(lockFile); } catch { /* another stealer won */ } finally {
      try { fs.rmdirSync(stealDir); } catch { /* already gone */ }
    }
  }

  // Creates and removes one probe file in the audit folder: true when the folder takes it.
  function folderTakesNewFiles() {
    const probe = path.join(dir, `.probe-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
    try { fs.closeSync(fs.openSync(probe, 'wx', 0o600)); } catch { return false; }
    try { fs.unlinkSync(probe); } catch { /* removed already */ }
    return true;
  }

  function withLock(fn) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const owner = `${process.pid}:${crypto.randomBytes(8).toString('hex')}`;
    const deadline = Date.now() + LOCK_WAIT_MS;
    for (;;) {
      try {
        const fd = fs.openSync(lockFile, 'wx', 0o600);
        try { fs.writeSync(fd, owner); } finally { fs.closeSync(fd); }
        break;
      } catch (error) {
        // Windows reports a lock file that another writer is deleting as EPERM or EACCES
        // (delete pending), not EEXIST, and the pending file may not be readable either. The
        // folder tells the two apart: if it takes a new file, the lock is busy, so wait; if it
        // refuses one too, this is a real permission error, raised as itself.
        const denied = process.platform === 'win32' && (error.code === 'EPERM' || error.code === 'EACCES');
        if (error.code !== 'EEXIST' && !denied) throw error;
        if (denied && !folderTakesNewFiles()) throw error;
      }
      const held = readText(lockFile);
      if (held) stealIfDead(held);
      if (Date.now() > deadline) throw new AuditRefused(`the audit lock is held by another writer (${lockFile}); retry, or remove it if no Aegis command is running`);
      sleepSync(5 + Math.floor(Math.random() * 10));
    }
    try { return fn(); } finally {
      try { if (readText(lockFile) === owner) fs.unlinkSync(lockFile); } catch { /* already gone */ }
    }
  }

  function readHead() {
    const text = readText(headFile);
    if (text === null) return null;
    try {
      const head = JSON.parse(text);
      return Number.isInteger(head.seq) && SHA256.test(head.hash) ? head : { invalid: true };
    } catch { return { invalid: true }; }
  }

  function readLines() {
    const text = readText(logFile);
    if (text === null || text === '') return { lines: [], endsWithNewline: true };
    return { lines: text.split('\n').slice(0, text.endsWith('\n') ? -1 : undefined), endsWithNewline: text.endsWith('\n') };
  }

  // Walks the whole chain. ok, entries and, when broken, firstBroken { line, seq, reason }.
  function verify() {
    const { lines, endsWithNewline } = readLines();
    let prev = GENESIS;
    let last = null;
    for (let i = 0; i < lines.length; i += 1) {
      const line = i + 1;
      let entry;
      try { entry = JSON.parse(lines[i]); } catch {
        const cut = i === lines.length - 1 && !endsWithNewline;
        return { ok: false, entries: i, firstBroken: { line, seq: null, reason: cut ? 'the last line is not JSON: the log was truncated mid-line' : 'the line is not JSON: edited or truncated' } };
      }
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { ok: false, entries: i, firstBroken: { line, seq: null, reason: 'the line is not an entry object' } };
      if (entry.seq !== line) return { ok: false, entries: i, firstBroken: { line, seq: entry.seq ?? null, reason: `seq is ${entry.seq}, expected ${line}: an entry is missing, inserted or out of order` } };
      if (entry.prev !== prev) return { ok: false, entries: i, firstBroken: { line, seq: entry.seq, reason: 'prev does not match the hash of the entry before it: the chain is broken (removed, inserted or reordered)' } };
      if (entryHash(entry) !== entry.hash) return { ok: false, entries: i, firstBroken: { line, seq: entry.seq, reason: 'the hash does not match the entry: the entry was edited' } };
      try {
        const { seq, at, prev: p, hash, ...fields } = entry;
        checkEntry(fields);
        if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))) throw new AuditRefused('at');
      } catch {
        return { ok: false, entries: i, firstBroken: { line, seq: entry.seq, reason: 'the entry holds a field or value the trail never writes' } };
      }
      prev = entry.hash;
      last = entry;
    }
    const head = readHead();
    const count = lines.length;
    if (count === 0 && head === null) return { ok: true, entries: 0 };
    if (head === null) return { ok: false, entries: count, firstBroken: { line: count, seq: last ? last.seq : null, reason: 'the head file is missing: the log cannot show it was not cut' } };
    if (head.invalid) return { ok: false, entries: count, firstBroken: { line: count, seq: last ? last.seq : null, reason: 'the head file is not readable' } };
    if (head.seq > count) return { ok: false, entries: count, firstBroken: { line: count + 1, seq: count + 1, reason: `the log was truncated: the head names seq ${head.seq}, the log ends at seq ${count}` } };
    if (last && head.seq === last.seq && head.hash === last.hash) return { ok: true, entries: count };
    if (last && head.seq === last.seq - 1 && head.hash === last.prev) {
      return { ok: true, entries: count, warning: 'the head is one entry behind the log (an interrupted write); the next append repairs it' };
    }
    return { ok: false, entries: count, firstBroken: { line: count, seq: last ? last.seq : null, reason: 'the head does not match the last entry' } };
  }

  // The tail an append builds on: the last entry must recompute and match the head (or be
  // the one entry an interrupted write left ahead of it). Anything else is a broken log.
  function tail() {
    const { lines } = readLines();
    const head = readHead();
    if (!lines.length) {
      if (head !== null) throw new AuditBroken('the audit log is empty but its head names an entry; run node scripts/audit/audit-log.js verify');
      return { seq: 0, hash: GENESIS };
    }
    let last;
    try { last = JSON.parse(lines[lines.length - 1]); } catch { last = null; }
    if (!last || entryHash(last) !== last.hash || last.seq !== lines.length) throw new AuditBroken('the last audit entry does not verify; run node scripts/audit/audit-log.js verify');
    if (!head || head.invalid) throw new AuditBroken('the audit head is missing or unreadable; run node scripts/audit/audit-log.js verify');
    if (head.seq === last.seq && head.hash === last.hash) return last;
    if (head.seq === last.seq - 1 && head.hash === last.prev) return last;
    throw new AuditBroken('the audit head does not match the log; run node scripts/audit/audit-log.js verify');
  }

  // guard(entries), when given, runs under the write lock on the trail as it is; if it throws,
  // nothing is written (a check that must not race another writer)
  function append(entry, { guard } = {}) {
    const fields = checkWrite(checkEntry(entry));
    return withLock(() => {
      if (guard) guard(entries());
      const before = tail();
      const record = { seq: before.seq + 1, at: new Date(now()).toISOString(), ...fields, prev: before.hash };
      record.hash = entryHash(record);
      const ordered = {};
      for (const key of Object.keys(record).sort()) ordered[key] = record[key];
      const fd = fs.openSync(logFile, 'a', 0o600);
      try { fs.writeSync(fd, `${JSON.stringify(ordered)}\n`); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      writeAtomic(headFile, `${JSON.stringify({ seq: record.seq, hash: record.hash })}\n`);
      return { seq: record.seq, hash: record.hash };
    });
  }

  function entries() {
    const out = [];
    for (const line of readLines().lines) {
      try { out.push(JSON.parse(line)); } catch { break; }
    }
    return out;
  }

  // Connector calls in the window, by connector: calls, failures, states of the failures
  // and the handoff states. Only entries before the first broken link are counted.
  function status({ sinceMs, nowMs = now() } = {}) {
    const check = verify();
    const counted = entries().slice(0, check.ok ? undefined : Math.max(0, check.firstBroken.line - 1));
    const byConnector = {};
    let calls = 0;
    let failures = 0;
    for (const e of counted) {
      if (e.kind !== 'connector-call') continue;
      const t = Date.parse(e.at);
      if (!(t >= sinceMs && t <= nowMs)) continue;
      calls += 1;
      const c = byConnector[e.connector] || (byConnector[e.connector] = { calls: 0, failures: 0, states: {}, handoffs: {} });
      c.calls += 1;
      if (e.state !== 'OK') {
        failures += 1;
        c.failures += 1;
        c.states[e.state] = (c.states[e.state] || 0) + 1;
      }
      if (e.handoff) c.handoffs[e.handoff] = (c.handoffs[e.handoff] || 0) + 1;
    }
    const sorted = {};
    for (const key of Object.keys(byConnector).sort()) sorted[key] = byConnector[key];
    return {
      chain: check.ok ? 'intact' : `broken at line ${check.firstBroken.line}: ${check.firstBroken.reason}`,
      since: new Date(sinceMs).toISOString(),
      until: new Date(nowMs).toISOString(),
      calls,
      failures,
      byConnector: sorted,
    };
  }

  return { dir, append, verify, status, entries };
}

// A sink for the contract and the CLIs: records one connector call or verify result, and
// throws (AuditRefused or AuditBroken) when it cannot, so the caller fails closed.
function auditSink(env = process.env, { now } = {}) {
  const log = openAuditLog({ dir: defaultAuditDir(env), now });
  const sink = (entry) => log.append(entry);
  sink.log = log;
  return sink;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const WINDOW = /^([1-9][0-9]{0,3})(h|d)$/;
function parseSince(value, nowMs) {
  if (value === undefined) return nowMs - 24 * 3600 * 1000;
  const m = WINDOW.exec(value);
  if (m) return nowMs - Number(m[1]) * (m[2] === 'h' ? 3600 : 86400) * 1000;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/.test(value) && Number.isFinite(Date.parse(value))) return Date.parse(value);
  throw new AuditRefused('--since takes a window such as 24h or 7d, or a UTC time such as 2026-10-28T09:00:00Z');
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!/^--[a-z][a-z0-9-]*$/.test(token)) throw new AuditRefused(`unexpected argument ${JSON.stringify(token).slice(0, 40)}`);
    const name = token.slice(2);
    if (name in flags) throw new AuditRefused(`--${name} may appear once`);
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new AuditRefused(`--${name} needs a value`);
    flags[name] = argv[i + 1];
    i += 1;
  }
  return flags;
}

function only(flags, allowed) {
  for (const key of Object.keys(flags)) if (!allowed.includes(key)) throw new AuditRefused(`unknown flag --${key.slice(0, 40)}`);
}

function main(argv = process.argv.slice(2), env = process.env, io = {}) {
  const out = io.out || ((s) => process.stdout.write(s));
  const err = io.err || ((s) => process.stderr.write(s));
  const [command, ...rest] = argv;
  try {
    const log = openAuditLog({ dir: defaultAuditDir(env) });
    const flags = parseFlags(rest);
    if (command === 'verify') {
      only(flags, []);
      const v = log.verify();
      if (v.ok) {
        out(`audit trail intact: ${v.entries} entries${v.warning ? `; note: ${v.warning}` : ''} (${log.dir})\n`);
        return 0;
      }
      out(`audit trail BROKEN at line ${v.firstBroken.line}${v.firstBroken.seq !== null ? ` (seq ${v.firstBroken.seq})` : ''}: ${v.firstBroken.reason}. The ${v.entries} entries before it verify.\n`);
      return 2;
    }
    if (command === 'status') {
      only(flags, ['since']);
      const nowMs = Date.now();
      out(`${JSON.stringify(log.status({ sinceMs: parseSince(flags.since, nowMs), nowMs }), null, 2)}\n`);
      return 0;
    }
    if (command === 'procedure') {
      only(flags, ['command', 'gate', 'r-class', 'target', 'read-back', 'procedure-sha256', 'change']);
      // a change record is opened with change-record.js open, which checks its read-back
      if (flags.change !== undefined) throw new AuditRefused('a procedure under a change id is opened with node scripts/audit/change-record.js open, which checks its read-back; this command records procedures without one');
      const r = log.append({ kind: 'procedure', command: flags.command, gate: flags.gate ?? null, r_class: flags['r-class'], target: flags.target, read_back: flags['read-back'] ?? null, procedure_sha256: flags['procedure-sha256'] ?? null, change: flags.change ?? null });
      out(`recorded procedure as audit entry ${r.seq}\n`);
      return 0;
    }
    if (command === 'approval') {
      only(flags, ['ref', 'gate', 'procedure-sha256', 'change']);
      const r = log.append({ kind: 'approval', ref: flags.ref, gate: flags.gate, procedure_sha256: flags['procedure-sha256'], change: flags.change });
      out(`recorded approval reference as audit entry ${r.seq}; it authorizes a person's procedure and makes no change\n`);
      return 0;
    }
    throw new AuditRefused('usage: audit-log.js verify | status [--since 24h] | procedure ... | approval ...');
  } catch (error) {
    if (error instanceof AuditRefused) { err(`audit-log: ${error.message}\n`); return 1; }
    if (error instanceof AuditBroken) { err(`audit-log: ${error.message}\n`); return 2; }
    err('audit-log: the audit trail could not be read or written (details withheld)\n');
    return 2;
  }
}

module.exports = {
  LOG_FILE, HEAD_FILE, GENESIS, KINDS, READ_BACK, CHANGE_ID, COMMAND, VERIFY_COMMAND, RUN_ID, RUN_IDS, recordsRunId, AuditRefused, AuditBroken,
  openAuditLog, auditSink, defaultAuditDir, checkEntry, entryHash, canonicalJson, main,
};

if (require.main === module) process.exitCode = main();
