#!/usr/bin/env node
/**
 * memory-cli.js — Aegis Memory V1 driver surface. THE ONLY WRITE PATH.
 *
 * Subagents (Read/Grep/Glob only) cannot invoke this; the graph engine never
 * does; no hook or cron does. Every mutation is a deliberate CLI invocation
 * from the trusted Aegis session or the operator, serialized by an exclusive
 * lock — candidate findings from any number of agents funnel through here.
 *
 * Storage (local-only, gitignored — memory may hold org-internal knowledge):
 *   <memDir>/index.json    retrieval metadata for every record (small; the
 *                          read path loads ONLY this plus top-K records)
 *   <memDir>/mem-NNNN.json full records: detail, provenance, history
 *   <memDir>/ledger.jsonl  append-only write-path instrumentation:
 *                          every propose/promote/refusal/decline with verdict
 *   memDir = AEGIS_MEMORY_DIR or <repo>/memory
 *
 * All output is JSON on stdout (graph-cli idiom).
 * Exit codes: 0 ok · 1 error · 2 invalid proposal/sequence · 3 sanitizer BLOCK
 *             4 promotion gate refused (case-scope, conflict unresolved,
 *               external-only provenance, missing canonical pointer)
 *             5 duplicate (merge into the match instead)
 *
 * Usage:
 *   node scripts/memory/memory-cli.js propose    --file p.json [--as-of YYYY-MM-DD]
 *   node scripts/memory/memory-cli.js merge      <id> --kind graph-run --ref <ref> [--note "…"]
 *   node scripts/memory/memory-cli.js promote    <id> [--supersede <oldId>] [--distinct <id,id>] [--as-of …]
 *   node scripts/memory/memory-cli.js reject     <id> --reason "…"
 *   node scripts/memory/memory-cli.js verify     <id> [--as-of …]
 *   node scripts/memory/memory-cli.js mark-stale <id> --reason "…"
 *   node scripts/memory/memory-cli.js decline    --ref <run-or-ticket ref> --reason "nothing reusable"
 *   node scripts/memory/memory-cli.js retrieve   --query "…" [--limit N] [--as-of …] [--include-candidates]
 *   node scripts/memory/memory-cli.js show       <id>
 *   node scripts/memory/memory-cli.js list       [--status s]
 *   node scripts/memory/memory-cli.js stats
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('./memory-store');

const REPO_ROOT = path.join(__dirname, '..', '..');
const MEM_DIR = process.env.AEGIS_MEMORY_DIR || path.join(REPO_ROOT, 'memory');
const INDEX_PATH = path.join(MEM_DIR, 'index.json');
const LEDGER_PATH = path.join(MEM_DIR, 'ledger.jsonl');
const LOCK_PATH = path.join(MEM_DIR, '.lock');
const LOCK_STALE_MS = 5 * 60 * 1000;

function out(obj) { console.log(JSON.stringify(obj, null, 2)); }
function fail(code, message, details) {
  out({ ok: false, error: message, details: details || [] });
  process.exit(code);
}

function today() { return new Date().toISOString().slice(0, 10); }
function asOf(flags) {
  if (flags['as-of'] && !/^\d{4}-\d{2}-\d{2}$/.test(String(flags['as-of']))) fail(1, '--as-of must be YYYY-MM-DD');
  return flags['as-of'] || today();
}

// ── storage ──────────────────────────────────────────────────────────────────

function loadIndex() {
  if (!fs.existsSync(INDEX_PATH)) return { schema: 'aegis.memory.index.v1', nextId: 1, records: [] };
  return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
}

function atomicWrite(p, content) {
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, p);
}

function saveIndex(index) {
  fs.mkdirSync(MEM_DIR, { recursive: true });
  atomicWrite(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
}

function recordPath(id) { return path.join(MEM_DIR, `${id}.json`); }

function loadRecord(id) {
  const p = recordPath(id);
  if (!/^mem-\d{4}$/.test(String(id)) || !fs.existsSync(p)) fail(1, `memory not found: ${id} (looked in ${MEM_DIR})`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveRecord(rec) {
  fs.mkdirSync(MEM_DIR, { recursive: true });
  atomicWrite(recordPath(rec.id), JSON.stringify(rec, null, 2) + '\n');
}

function indexRow(rec) {
  return {
    id: rec.id,
    type: rec.type,
    status: rec.status,
    scope: rec.scope,
    volatility: rec.volatility,
    sensitivity: rec.sensitivity,
    keywords: rec.keywords,
    summary: rec.summary,
    canonicalPointer: rec.canonicalPointer || null,
    created: rec.created,
    lastVerified: rec.lastVerified || null,
    supersedes: rec.supersedes || null,
    supersededBy: rec.supersededBy || null,
  };
}

function upsertIndex(index, rec) {
  const row = indexRow(rec);
  const i = index.records.findIndex((r) => r.id === rec.id);
  if (i >= 0) index.records[i] = row; else index.records.push(row);
}

// Ledger: the write path must be able to answer "how many candidates were
// considered / promoted / deduplicated / rejected, and on what evidence" —
// one appended line per decision, best-effort, never blocks the operation.
function ledger(event, fields) {
  try {
    fs.mkdirSync(MEM_DIR, { recursive: true });
    fs.appendFileSync(LEDGER_PATH, JSON.stringify({ at: new Date().toISOString(), event, ...fields }) + '\n');
  } catch (e) { /* instrumentation only */ }
}

function readLedger() {
  if (!fs.existsSync(LEDGER_PATH)) return [];
  return fs.readFileSync(LEDGER_PATH, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// ── write serialization (one controlled promotion path, no last-writer-wins) ─

function releaseLock() {
  try { fs.rmdirSync(LOCK_PATH); } catch (e) { /* already released */ }
}

function withLock(fn) {
  fs.mkdirSync(MEM_DIR, { recursive: true });
  try {
    fs.mkdirSync(LOCK_PATH);
  } catch (e) {
    const age = fs.existsSync(LOCK_PATH) ? Date.now() - fs.statSync(LOCK_PATH).mtimeMs : 0;
    if (age < LOCK_STALE_MS) fail(1, 'memory store is locked by another writer — retry after it finishes');
    fs.rmdirSync(LOCK_PATH); // stale lock (crashed writer) — steal it
    fs.mkdirSync(LOCK_PATH);
  }
  // fail() exits the process from inside fn — release on exit, not just finally.
  process.on('exit', releaseLock);
  try {
    return fn();
  } finally {
    releaseLock();
  }
}

function history(rec, event, detail) {
  rec.history.push({ at: new Date().toISOString(), event, detail });
}

// ── evidence durability ──────────────────────────────────────────────────────

function resolveRef(ref) {
  // refs resolve against the repo root; absolute refs (e.g. an overridden
  // runs dir) pass through path.resolve unchanged
  return path.resolve(REPO_ROOT, String(ref).split('#')[0]);
}

function isFileRef(ref) {
  const p = resolveRef(ref);
  return fs.existsSync(p) && fs.statSync(p).isFile();
}

/**
 * Capture a content fingerprint (sha256 + size + capture time) for every
 * file-resolvable provenance ref that lacks one. Store-owned: proposals
 * cannot supply fingerprints. This preserves the distinction between "this
 * memory once had evidence" (fingerprint survives) and "its evidence remains
 * auditable on disk" (audit reports intact) WITHOUT copying run traces or
 * their PII into memory — graph runs are gitignored, local-only, and carry
 * no retention guarantee for the lifetime of a verified memory.
 */
function fingerprintProvenance(rec) {
  for (const p of rec.provenance) {
    if (p.sha256 || !isFileRef(p.ref)) continue;
    const buf = fs.readFileSync(resolveRef(p.ref));
    p.sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    p.bytes = buf.length;
    p.capturedAt = new Date().toISOString();
  }
}

function auditProvenance(rec) {
  return rec.provenance.map((p) => {
    let state;
    if (!p.sha256) {
      state = 'unfingerprinted (non-file ref or pre-fingerprint promotion)';
    } else if (!isFileRef(p.ref)) {
      state = 'missing-evidence (once existed — fingerprint preserved)';
    } else {
      const buf = fs.readFileSync(resolveRef(p.ref));
      state = crypto.createHash('sha256').update(buf).digest('hex') === p.sha256 ? 'intact' : 'drifted (content changed since capture)';
    }
    return { kind: p.kind, ref: p.ref, sha256: p.sha256 || null, capturedAt: p.capturedAt || null, state };
  });
}

// ── commands ─────────────────────────────────────────────────────────────────

function cmdPropose(flags) {
  if (!flags.file) fail(1, 'required: --file <proposal.json>');
  if (!fs.existsSync(flags.file)) fail(1, `proposal file not found: ${flags.file}`);
  let proposal;
  try {
    proposal = JSON.parse(fs.readFileSync(flags.file, 'utf8'));
  } catch (e) {
    fail(2, `proposal is not valid JSON: ${e.message}`);
  }

  const errors = store.validateProposal(proposal);
  if (errors.length) {
    ledger('INVALID', { reasons: errors.slice(0, 5) });
    fail(2, 'invalid proposal', errors);
  }

  // Persist gate: nothing sensitive, nothing injected, ever (SR-3/SR-8).
  const scan = store.sanitizeGate(proposal);
  if (scan.blocks.length) {
    ledger('BLOCKED', { classes: scan.blocks.map((b) => `${b.class}:${b.label}`) });
    fail(3, 'sanitizer BLOCK — proposal not stored', scan.blocks);
  }

  // Case/episodic state is not durable knowledge — it lives in the run.
  if (proposal.scope === 'case') {
    ledger('CASE_REFUSED', { summary: proposal.summary.slice(0, 120) });
    fail(4, 'scope "case" refused: case state belongs in the run state (tasks/graph-runs/<runId>/state.json), not in durable memory');
  }

  return withLock(() => {
    const index = loadIndex();
    const dup = store.dedupMatch(proposal, index.records);
    if (dup) {
      ledger('DUPLICATE', { matchId: dup.id, score: dup.score });
      fail(5, `duplicate of ${dup.id} (similarity ${dup.score}) — use: merge ${dup.id} --kind <k> --ref <r> to add provenance`, [dup]);
    }
    const id = `mem-${String(index.nextId).padStart(4, '0')}`;
    index.nextId += 1;
    const rec = {
      schema: 'aegis.memory.v1',
      id,
      type: proposal.type,
      status: 'candidate',
      summary: proposal.summary,
      detail: proposal.detail || '',
      scope: proposal.scope,
      volatility: proposal.volatility,
      sensitivity: proposal.sensitivity,
      keywords: proposal.keywords,
      canonicalPointer: proposal.canonicalPointer || null,
      provenance: proposal.provenance,
      created: asOf(flags),
      lastVerified: null,
      supersedes: null,
      supersededBy: null,
      history: [],
    };
    history(rec, 'proposed', `candidate created from ${proposal.provenance.length} provenance ref(s)`);
    saveRecord(rec);
    upsertIndex(index, rec);
    saveIndex(index);
    ledger('PROPOSED', { id, evidence: proposal.provenance.map((p) => `${p.kind}:${p.ref}`) });
    out({ ok: true, id, status: 'candidate', warnings: scan.warnings });
  });
}

function cmdMerge(id, flags) {
  if (!flags.kind || !flags.ref) fail(1, 'required: --kind <provenance kind> --ref <ref>');
  if (!store.PROVENANCE_KINDS.includes(flags.kind)) fail(2, `--kind must be one of ${store.PROVENANCE_KINDS.join('|')}`);
  return withLock(() => {
    const rec = loadRecord(id);
    if (rec.status === 'rejected' || rec.status === 'superseded') fail(2, `cannot merge into a ${rec.status} record`);
    const entry = { kind: flags.kind, ref: String(flags.ref) };
    if (flags.note) entry.note = String(flags.note);
    const scan = store.sanitizeGate({ p: [entry.ref, entry.note || ''] });
    if (scan.blocks.length) fail(3, 'sanitizer BLOCK — provenance not merged', scan.blocks);
    rec.provenance.push(entry);
    fingerprintProvenance(rec);
    history(rec, 'provenance-merged', `${flags.kind}:${flags.ref}`);
    saveRecord(rec);
    ledger('MERGED', { id, evidence: [`${flags.kind}:${flags.ref}`] });
    out({ ok: true, id, provenanceCount: rec.provenance.length });
  });
}

function cmdPromote(id, flags) {
  return withLock(() => {
    const rec = loadRecord(id);
    const index = loadIndex();
    if (rec.status !== 'candidate') fail(2, `promote requires status candidate (found: ${rec.status})`);

    // Raw/external content can support, never solely justify (SR-3).
    if (!rec.provenance.some((p) => store.TRUSTED_PROVENANCE.includes(p.kind))) {
      ledger('GATE_REFUSED', { id, reason: 'external-only provenance' });
      fail(4, `promotion refused: provenance is external-content only — a trusted source (${store.TRUSTED_PROVENANCE.join('|')}) must support durable memory`);
    }

    // Agent-derived evidence is trusted only when it is auditable: a
    // graph-run ref must resolve to a real trace on disk, not an assertion.
    for (const p of rec.provenance) {
      if (p.kind === 'graph-run' && !isFileRef(p.ref)) {
        ledger('GATE_REFUSED', { id, reason: `graph-run evidence not on disk: ${p.ref}` });
        fail(4, `promotion refused: graph-run evidence does not exist on disk: ${p.ref} — agent-derived provenance must be auditable, not asserted`);
      }
    }

    // A pointer to canonical knowledge must point at something real.
    if (rec.canonicalPointer) {
      const target = path.join(REPO_ROOT, rec.canonicalPointer.split('#')[0]);
      if (!fs.existsSync(target)) {
        ledger('GATE_REFUSED', { id, reason: `canonicalPointer missing: ${rec.canonicalPointer}` });
        fail(4, `promotion refused: canonicalPointer does not exist on disk: ${rec.canonicalPointer}`);
      }
    }

    // Contradiction gate: same-topic verified records must be explicitly
    // resolved — supersede or assert-distinct. Silence is refusal.
    const conflicts = store.conflictScan(rec, index.records);
    const supersedeId = flags.supersede ? String(flags.supersede) : null;
    const distinct = flags.distinct ? String(flags.distinct).split(',').map((s) => s.trim()).filter(Boolean) : [];
    const unresolved = conflicts.filter((c) => c !== supersedeId && !distinct.includes(c));
    if (unresolved.length) {
      ledger('CONFLICT_REFUSED', { id, conflicts: unresolved });
      fail(4, `promotion refused: potential contradiction with verified ${unresolved.join(', ')} — resolve with --supersede <id> or --distinct <id[,id]> after comparing them`, unresolved);
    }

    const date = asOf(flags);
    if (supersedeId) {
      const old = loadRecord(supersedeId);
      if (old.status !== 'verified' && old.status !== 'stale') fail(2, `--supersede target must be verified or stale (found: ${old.status})`);
      old.status = 'superseded';
      old.supersededBy = rec.id;
      history(old, 'superseded', `replaced by ${rec.id} on ${date}`);
      saveRecord(old);
      upsertIndex(index, old);
      rec.supersedes = supersedeId;
    }
    for (const d of distinct) history(rec, 'distinct-asserted', `operator asserts no contradiction with ${d}`);

    rec.status = 'verified';
    rec.lastVerified = date;
    fingerprintProvenance(rec);
    history(rec, 'promoted', `verified on ${date}${supersedeId ? `, supersedes ${supersedeId}` : ''}`);
    saveRecord(rec);
    upsertIndex(index, rec);
    saveIndex(index);
    ledger('PROMOTED', { id, supersedes: supersedeId, evidence: rec.provenance.map((p) => `${p.kind}:${p.ref}`) });
    out({ ok: true, id, status: 'verified', supersedes: supersedeId, lastVerified: date });
  });
}

function cmdReject(id, flags) {
  return withLock(() => {
    const rec = loadRecord(id);
    if (rec.status !== 'candidate') fail(2, `reject requires status candidate (found: ${rec.status})`);
    rec.status = 'rejected';
    history(rec, 'rejected', String(flags.reason || 'no reason given'));
    saveRecord(rec);
    const index = loadIndex();
    upsertIndex(index, rec);
    saveIndex(index);
    ledger('REJECTED', { id, reason: String(flags.reason || '') });
    out({ ok: true, id, status: 'rejected' });
  });
}

function cmdVerify(id, flags) {
  return withLock(() => {
    const rec = loadRecord(id);
    if (rec.status !== 'verified' && rec.status !== 'stale') fail(2, `verify requires status verified|stale (found: ${rec.status})`);
    const date = asOf(flags);
    rec.status = 'verified';
    rec.lastVerified = date;
    fingerprintProvenance(rec); // backfill fingerprints absent at promotion
    history(rec, 'verified', `re-verified current on ${date}`);
    saveRecord(rec);
    const index = loadIndex();
    upsertIndex(index, rec);
    saveIndex(index);
    ledger('VERIFIED', { id, date });
    out({ ok: true, id, status: 'verified', lastVerified: date });
  });
}

function cmdMarkStale(id, flags) {
  return withLock(() => {
    const rec = loadRecord(id);
    if (rec.status !== 'verified') fail(2, `mark-stale requires status verified (found: ${rec.status})`);
    rec.status = 'stale';
    history(rec, 'marked-stale', String(flags.reason || 'dependency changed'));
    saveRecord(rec);
    const index = loadIndex();
    upsertIndex(index, rec);
    saveIndex(index);
    ledger('MARKED_STALE', { id, reason: String(flags.reason || '') });
    out({ ok: true, id, status: 'stale' });
  });
}

// Deliberate non-retention is a first-class, auditable outcome: a run that
// teaches nothing reusable gets a DECLINED ledger line, not a memory.
function cmdDecline(flags) {
  if (!flags.ref) fail(1, 'required: --ref <run/ticket ref> [--reason "…"]');
  return withLock(() => {
    ledger('DECLINED', { ref: String(flags.ref), reason: String(flags.reason || 'nothing reusable beyond this case') });
    out({ ok: true, declined: String(flags.ref) });
  });
}

function cmdRetrieve(flags) {
  if (!flags.query || typeof flags.query !== 'string') fail(1, 'required: --query "<words>"');
  const index = loadIndex();
  const results = store.retrieve(flags.query, index.records, {
    asOf: asOf(flags),
    limit: flags.limit ? parseInt(flags.limit, 10) : undefined,
    includeCandidates: Boolean(flags['include-candidates']),
  });
  // Bounded read path: top-K records opened only for their provenance refs.
  for (const r of results) {
    const rec = loadRecord(r.id);
    r.provenance = rec.provenance.map((p) => `${p.kind}:${p.ref}`);
  }
  out({ ok: true, query: flags.query, count: results.length, results });
}

function cmdShow(id) {
  out({ ok: true, record: loadRecord(id) });
}

// Evidence audit: reports, never gates. A memory whose evidence has left the
// disk stays verified (truth ≠ file retention) but the loss is visible.
function cmdAudit(id) {
  const rec = loadRecord(id);
  out({ ok: true, id: rec.id, status: rec.status, evidence: auditProvenance(rec) });
}

function cmdList(flags) {
  const index = loadIndex();
  const rows = index.records
    .filter((r) => !flags.status || r.status === flags.status)
    .map((r) => ({ id: r.id, type: r.type, status: r.status, scope: r.scope, volatility: r.volatility, summary: r.summary.slice(0, 100) }));
  out({ ok: true, count: rows.length, records: rows });
}

function cmdStats() {
  const index = loadIndex();
  const byStatus = {};
  for (const s of store.STATUSES) byStatus[s] = 0;
  for (const r of index.records) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  const events = {};
  for (const e of readLedger()) events[e.event] = (events[e.event] || 0) + 1;
  out({ ok: true, records: { total: index.records.length, ...byStatus }, ledger: events });
}

// ── main ─────────────────────────────────────────────────────────────────────

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      flags[argv[i].slice(2)] = (i + 1 < argv.length && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
    }
  }
  return flags;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const id = rest.length > 0 && !rest[0].startsWith('--') ? rest[0] : null;
  const flags = parseFlags(rest);

  switch (cmd) {
    case 'propose': return cmdPropose(flags);
    case 'merge': return id ? cmdMerge(id, flags) : fail(1, 'required: <id>');
    case 'promote': return id ? cmdPromote(id, flags) : fail(1, 'required: <id>');
    case 'reject': return id ? cmdReject(id, flags) : fail(1, 'required: <id>');
    case 'verify': return id ? cmdVerify(id, flags) : fail(1, 'required: <id>');
    case 'mark-stale': return id ? cmdMarkStale(id, flags) : fail(1, 'required: <id>');
    case 'decline': return cmdDecline(flags);
    case 'retrieve': return cmdRetrieve(flags);
    case 'show': return id ? cmdShow(id) : fail(1, 'required: <id>');
    case 'audit': return id ? cmdAudit(id) : fail(1, 'required: <id>');
    case 'list': return cmdList(flags);
    case 'stats': return cmdStats();
    default:
      fail(1, 'usage: memory-cli.js <propose|merge|promote|reject|verify|mark-stale|decline|retrieve|show|list|stats> — see scripts/memory/README.md');
  }
}

main();
