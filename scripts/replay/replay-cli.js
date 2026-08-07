#!/usr/bin/env node
'use strict';
// replay-cli.js — Aegis deterministic replay cache (V1, ADR-006 / WS2).
//
// A previously VERIFIED ticket solution with an unchanged authority basis is
// replayable immediately, with ZERO ticket-solving model/agent/loop/graph
// invocations. This CLI is the entire fast path: deterministic normalization,
// exact-key lookup, fingerprint-based staleness, verbatim render.
//
// Design constraints (enforced by replay.test.js R4):
//   - no network modules (http/https/net/tls/dns), no child_process, no fetch
//   - pure fs + crypto + path — runs offline, no model anywhere
//
// Lifecycle:  record (candidate) → verify (+evidence, deps fingerprinted)
//             → lookup/render (CACHE_HIT) → authority change → STALE
//             (preserved as historical evidence, never silently served)
//
// Only VERIFIED solutions replay. Candidates, drafts, and failed attempts are
// not authoritative memory. Invalidation is dependency-fingerprint based
// (sha256 of each authority file), never an arbitrary time TTL.
//
// Store: memory/replay/ (gitignored — private tickets never ship; the engine
// and synthetic fixtures are the public artifact).
//
// Exit codes: 0 ok · 1 usage/error · 2 refusal (unverified) · 3 stale without
// --historical · 4 sanitization block · 5 lock contention

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const STORE = process.env.AEGIS_REPLAY_DIR || path.join(ROOT, 'memory', 'replay');
const INDEX = path.join(STORE, 'index.json');
const LOCK = path.join(STORE, '.lock');

// ── deterministic normalization — no model decides what "the same ticket" is ──
function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const keyOf = (text) => sha256(normalize(text));

// ── minimal sanitization at the persistence boundary (SR-8) ──────────────────
// Secrets/credentials and the real tenant literal can never enter the store.
function sanitizationHits(text) {
  const hits = [];
  const patterns = [
    [/ghp_[A-Za-z0-9]{20,}/, 'GitHub token'],
    [/github_pat_[A-Za-z0-9_]{20,}/, 'GitHub fine-grained token'],
    [/sk-[A-Za-z0-9-]{20,}/, 'API secret key'],
    [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key material'],
    [/\bpassword\s*[:=]\s*\S{4,}/i, 'plaintext password assignment'],
  ];
  for (const [re, label] of patterns) if (re.test(text)) hits.push(label);
  for (const v of ['AEGION_DOMAIN', 'AEGION_ORG_NAME']) {
    const lit = process.env[v];
    if (lit && lit.length > 3 && text.toLowerCase().includes(lit.toLowerCase())) {
      hits.push(`tenant literal (${v})`);
    }
  }
  return hits;
}

// ── store primitives (atomic write, mkdir lock) ──────────────────────────────
function loadIndex() {
  if (!fs.existsSync(INDEX)) return { schema: 'aegis.replay.v1', seq: 0, cases: {}, aliases: {} };
  try { return JSON.parse(fs.readFileSync(INDEX, 'utf8')); }
  catch (e) { fail(1, 'store corrupt: index.json unreadable — ' + e.message); }
}
function atomicWrite(file, data) {
  const tmp = file + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
function saveIndex(ix) { atomicWrite(INDEX, JSON.stringify(ix, null, 2)); }
function casePath(id) { return path.join(STORE, id + '.json'); }
function loadCase(id) {
  const p = casePath(id);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { fail(1, `store corrupt: ${id}.json unreadable — ` + e.message); }
}
function saveCase(c) { atomicWrite(casePath(c.caseId), JSON.stringify(c, null, 2)); }
let lockHeld = false;
function withLock(fn) {
  // R8 guard: a write store inside the repo must stay under the git-ignored
  // memory/ area — a redirected in-tree store could otherwise be committed.
  const rel = path.relative(ROOT, STORE);
  if (!rel.startsWith('..') && !/^memory[\\/]/.test(rel)) {
    fail(4, 'refused: AEGIS_REPLAY_DIR points inside the repo outside memory/ — private cases could be committed');
  }
  fs.mkdirSync(STORE, { recursive: true });
  try { fs.mkdirSync(LOCK); } catch {
    fail(5, 'store is locked by another writer — retry after it completes (stale lock: remove ' + LOCK + ')');
  }
  lockHeld = true;
  try { return fn(); } finally { lockHeld = false; try { fs.rmdirSync(LOCK); } catch {} }
}

function fingerprint(deps) {
  return deps.map((p) => {
    const abs = path.isAbsolute(p) ? p : path.join(ROOT, p);
    if (!fs.existsSync(abs)) fail(1, `dependency does not exist on disk: ${p}`);
    return { path: p, sha256: sha256(fs.readFileSync(abs)) };
  });
}
function depDrift(c) {
  const changed = [];
  for (const d of c.deps || []) {
    const abs = path.isAbsolute(d.path) ? d.path : path.join(ROOT, d.path);
    if (!fs.existsSync(abs)) { changed.push({ path: d.path, reason: 'missing' }); continue; }
    if (sha256(fs.readFileSync(abs)) !== d.sha256) changed.push({ path: d.path, reason: 'content changed' });
  }
  return changed;
}

function out(obj) { console.log(JSON.stringify(obj, null, 2)); }
function fail(code, msg) {
  if (lockHeld) { lockHeld = false; try { fs.rmdirSync(LOCK); } catch {} }
  console.error(JSON.stringify({ ok: false, error: msg }));
  process.exit(code);
}

// ── arg parsing ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const cmd = argv[0];
function opt(name) {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const has = (name) => argv.includes('--' + name);

// ── resolve a ticket (or explicit case id) to a case ─────────────────────────
function resolveCase(ix, ticket, id) {
  if (id && !id.startsWith('--')) return { caseId: id, via: 'id' };
  if (!ticket) fail(1, 'need --ticket "<text>" or a case id');
  const k = keyOf(ticket);
  const caseId = ix.cases[k] || ix.aliases[k];
  return { caseId, via: ix.cases[k] ? 'exact' : (ix.aliases[k] ? 'alias' : 'none'), key: k };
}

switch (cmd) {
  case 'record': {
    const ticket = opt('ticket');
    const solutionFile = opt('solution-file');
    if (!ticket || !solutionFile) fail(1, 'usage: record --ticket "<text>" --solution-file <path> [--deps p1,p2]');
    const solution = fs.readFileSync(solutionFile, 'utf8');
    const hits = sanitizationHits(ticket + '\n' + solution);
    if (hits.length) fail(4, 'sanitization BLOCK — refused to persist: ' + hits.join(', '));
    withLock(() => {
      const ix = loadIndex();
      const k = keyOf(ticket);
      if (ix.cases[k]) fail(1, `exact ticket already recorded as ${ix.cases[k]} (use verify/invalidate on it)`);
      ix.seq += 1;
      const caseId = 'case-' + String(ix.seq).padStart(4, '0');
      const now = new Date().toISOString();
      const c = {
        schema: 'aegis.replay.case.v1', caseId,
        ticket, normalized: normalize(ticket), key: k,
        status: 'candidate', solution,
        deps: (opt('deps') || '').split(',').filter(Boolean).map((p) => ({ path: p.trim(), sha256: null })),
        provenance: { createdAt: now, verifiedAt: null, evidence: null },
        history: [{ at: now, event: 'recorded (candidate — not replayable until verified)' }],
      };
      ix.cases[k] = caseId;
      saveCase(c); saveIndex(ix);
      out({ ok: true, caseId, status: 'candidate', note: 'not replayable until verified with evidence' });
    });
    break;
  }

  case 'verify': {
    const id = argv[1];
    const evidence = opt('evidence');
    if (!id) fail(1, 'usage: verify <caseId> --evidence "<how this solution was proven>"');
    if (!evidence || evidence.length < 10) {
      fail(2, 'verification refused: --evidence is required — unverified output is not authoritative memory');
    }
    const evHits = sanitizationHits(evidence);
    if (evHits.length) fail(4, 'sanitization BLOCK — evidence text refused: ' + evHits.join(', '));
    withLock(() => {
      const c = loadCase(id);
      if (!c) fail(1, 'no such case: ' + id);
      const depPaths = c.deps.map((d) => d.path);
      if (!depPaths.length && !has('no-deps')) {
        fail(2, 'verification refused: no authority dependencies recorded — a dep-less case can never auto-stale. Re-record with --deps, or acknowledge explicitly with --no-deps');
      }
      c.deps = depPaths.length ? fingerprint(depPaths) : [];
      c.status = 'verified';
      c.provenance.verifiedAt = new Date().toISOString();
      c.provenance.evidence = evidence;
      c.history.push({ at: c.provenance.verifiedAt, event: 'verified', evidence });
      saveCase(c);
      out({ ok: true, caseId: id, status: 'verified', deps: c.deps });
    });
    break;
  }

  case 'lookup': {
    const ticket = opt('ticket');
    if (!ticket) fail(1, 'usage: lookup --ticket "<text>"');
    const ix = loadIndex();
    const { caseId, via, key } = resolveCase(ix, ticket);
    if (!caseId) { out({ ok: true, result: 'MISS', key, route: 'adaptive' }); break; }
    const c = loadCase(caseId);
    if (!c || c.status === 'candidate') {
      out({ ok: true, result: 'MISS', key, caseId, route: 'adaptive', note: 'case exists but is not verified — candidates never replay' });
      break;
    }
    const drift = depDrift(c);
    if (c.status === 'stale' || drift.length) {
      if (c.status !== 'stale') {
        withLock(() => {
          const cc = loadCase(caseId);
          if (cc && cc.status !== 'stale') {
            cc.status = 'stale';
            cc.history.push({ at: new Date().toISOString(), event: 'marked stale at lookup', changed: drift });
            saveCase(cc);
          }
        });
      }
      out({ ok: true, result: 'STALE', caseId, via, changed: drift.length ? drift : c.history.at(-1).changed, route: 'adaptive', note: 'authority basis changed — preserved as historical, not current' });
      break;
    }
    out({ ok: true, result: 'CACHE_HIT', caseId, via, verifiedAt: c.provenance.verifiedAt, deps: c.deps.length, render: `node scripts/replay/replay-cli.js render ${caseId}` });
    break;
  }

  case 'render': {
    const ix = loadIndex();
    const { caseId } = resolveCase(ix, opt('ticket'), argv[1]);
    if (!caseId) fail(1, 'no matching case');
    const c = loadCase(caseId);
    if (!c) fail(1, 'no such case: ' + caseId);
    if (c.status === 'candidate') fail(2, 'render refused: case is unverified (candidate) — only verified solutions replay');
    const drift = depDrift(c);
    if (c.status === 'stale' || drift.length) {
      if (!has('historical')) fail(3, 'render refused: case is STALE (authority changed: ' + JSON.stringify(drift.length ? drift : 'previously detected') + ') — pass --historical to view as historical evidence');
      console.log('⚠️ STALE — HISTORICAL EVIDENCE ONLY. Authority basis has changed since verification; route the live ticket through the normal adaptive path.\n');
    } else if (c.status !== 'verified' || !c.provenance || !c.provenance.evidence) {
      fail(2, 'render refused: case is not in a verified state (unknown or corrupt status)');
    }
    process.stdout.write(c.solution);
    break;
  }

  case 'alias': {
    const id = opt('case');
    const ticket = opt('ticket');
    if (!id || !ticket) fail(1, 'usage: alias --case <caseId> --ticket "<alias text>"');
    withLock(() => {
      const ix = loadIndex();
      if (!loadCase(id)) fail(1, 'no such case: ' + id);
      ix.aliases[keyOf(ticket)] = id;
      saveIndex(ix);
      out({ ok: true, caseId: id, aliasKey: keyOf(ticket) });
    });
    break;
  }

  case 'invalidate': {
    const id = argv[1];
    if (!id) fail(1, 'usage: invalidate <caseId> --reason "<why>"');
    const reason = opt('reason') || '(none given)';
    const rHits = sanitizationHits(reason);
    if (rHits.length) fail(4, 'sanitization BLOCK — reason text refused: ' + rHits.join(', '));
    withLock(() => {
      const c = loadCase(id);
      if (!c) fail(1, 'no such case: ' + id);
      c.status = 'stale';
      c.history.push({ at: new Date().toISOString(), event: 'manually invalidated', reason });
      saveCase(c);
      out({ ok: true, caseId: id, status: 'stale' });
    });
    break;
  }

  case 'status': {
    const c = loadCase(argv[1]);
    if (!c) fail(1, 'no such case: ' + (argv[1] || '(missing id)'));
    out({ ok: true, caseId: c.caseId, status: c.status, provenance: c.provenance, deps: c.deps, history: c.history });
    break;
  }

  case 'list': {
    const ix = loadIndex();
    const rows = Object.values(ix.cases).map((id) => {
      const c = loadCase(id);
      return c ? { caseId: c.caseId, status: c.status, ticket: c.ticket.slice(0, 60) } : { caseId: id, status: 'MISSING' };
    });
    out({ ok: true, count: rows.length, cases: rows });
    break;
  }

  default:
    fail(1, 'usage: replay-cli.js <record|verify|lookup|render|alias|invalidate|status|list> …');
}
