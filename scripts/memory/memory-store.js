'use strict';
/**
 * memory-store.js — Aegis Memory V1 pure logic (no filesystem I/O).
 *
 * Controlled operational memory: deliberately retained, decision-relevant
 * knowledge — NOT a transcript archive. Lifecycle:
 *
 *   proposal → candidate → verified → (stale | superseded)
 *                  ↘ rejected                ↑ verify / supersede
 *
 * Boundaries enforced here (memory-cli.js owns disk, lock, ledger):
 *   - strict schema: unknown keys reject (scripts/graph/schema.js discipline)
 *   - sanitizer gate on every proposal (reuses scripts/graph/sanitize.js);
 *     for durable memory, PII and injection markers BLOCK — stricter than the
 *     graph edge, because memory outlives the run that produced it (SR-3/SR-8)
 *   - scope "case" is refused: case/episodic state lives in the run
 *     (tasks/graph-runs/<runId>/state.json), never in durable memory
 *   - dedup before write; conflict-with-verified refuses without an explicit
 *     supersede/distinct resolution — no silent overwrite, ever
 *   - staleness is volatility-class policy, not one global timer
 *   - retrieval is bounded (top-K ≤ 5) and lexical — no embeddings at this scale
 */

const { scanArtifact } = require('../graph/sanitize');

// ── vocabulary ───────────────────────────────────────────────────────────────

const TYPES = ['FACT', 'SKILL', 'CORRECTION', 'DECISION'];
const STATUSES = ['candidate', 'verified', 'stale', 'superseded', 'rejected'];
const SCOPES = ['org', 'vendor', 'engineering', 'case'];
const SENSITIVITY = ['org-internal', 'shareable'];
const PROVENANCE_KINDS = ['operator', 'graph-run', 'lesson', 'vendor-doc', 'external-content'];
// external-content may SUPPORT a memory but can never be its sole justification
// (raw content must not promote itself — SR-3).
const TRUSTED_PROVENANCE = ['operator', 'graph-run', 'lesson', 'vendor-doc'];

// Staleness policy by volatility class — different knowledge ages differently.
// null = no timer (event-driven only, via mark-stale when the dependency changes).
const VOLATILITY_WINDOW_DAYS = {
  'vendor-ui': 90, // portal paths / blade names move often
  'vendor-mechanic': 180, // API + product behavior moves slower
  'org-procedure': null, // changes when the org changes it
  'engineering-invariant': 365, // PS semantics, verification discipline
};

const LIMITS = {
  summaryMin: 20,
  summaryMax: 400,
  detailMax: 2000,
  pointerDetailMax: 400, // pointer records must not duplicate the procedure
  keywordsMin: 3,
  keywordsMax: 12,
  retrieveDefault: 3,
  retrieveMax: 5,
};

// Proposal = what a session may suggest. Everything else (id, status, history,
// supersededBy, created, lastVerified) is store-owned and unrepresentable in a
// proposal — same rule that keeps humanGate out of graph artifacts.
const PROPOSAL_KEYS = ['schema', 'type', 'summary', 'detail', 'scope', 'volatility', 'sensitivity', 'keywords', 'canonicalPointer', 'provenance'];
const RECORD_KEYS = PROPOSAL_KEYS.concat(['id', 'status', 'created', 'lastVerified', 'supersedes', 'supersededBy', 'history']);

// ── validation ───────────────────────────────────────────────────────────────

function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

function validateProvenance(prov, errors) {
  if (!Array.isArray(prov) || prov.length === 0) { errors.push('provenance: non-empty array required'); return; }
  prov.forEach((p, i) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) { errors.push(`provenance[${i}]: object required`); return; }
    for (const k of Object.keys(p)) if (!['kind', 'ref', 'note'].includes(k)) errors.push(`provenance[${i}].${k}: unknown key`);
    if (!PROVENANCE_KINDS.includes(p.kind)) errors.push(`provenance[${i}].kind: one of ${PROVENANCE_KINDS.join('|')}`);
    if (typeof p.ref !== 'string' || !p.ref.trim()) errors.push(`provenance[${i}].ref: non-empty string required`);
  });
}

function validateProposal(p) {
  const errors = [];
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['proposal must be a JSON object'];
  for (const k of Object.keys(p)) if (!PROPOSAL_KEYS.includes(k)) errors.push(`${k}: unknown key (store-owned fields cannot be proposed)`);
  if (p.schema !== 'aegis.memory.proposal.v1') errors.push('schema: must be "aegis.memory.proposal.v1"');
  if (!TYPES.includes(p.type)) errors.push(`type: one of ${TYPES.join('|')}`);
  if (typeof p.summary !== 'string' || p.summary.trim().length < LIMITS.summaryMin || p.summary.length > LIMITS.summaryMax) {
    errors.push(`summary: string of ${LIMITS.summaryMin}–${LIMITS.summaryMax} chars (one reusable idea)`);
  }
  const detailMax = p.canonicalPointer ? LIMITS.pointerDetailMax : LIMITS.detailMax;
  if (p.detail !== undefined && (typeof p.detail !== 'string' || p.detail.length > detailMax)) {
    errors.push(`detail: string ≤ ${detailMax} chars${p.canonicalPointer ? ' (pointer records must not duplicate the canonical procedure)' : ''}`);
  }
  if (!SCOPES.includes(p.scope)) errors.push(`scope: one of ${SCOPES.join('|')}`);
  if (!(p.volatility in VOLATILITY_WINDOW_DAYS)) errors.push(`volatility: one of ${Object.keys(VOLATILITY_WINDOW_DAYS).join('|')}`);
  if (!SENSITIVITY.includes(p.sensitivity)) errors.push(`sensitivity: one of ${SENSITIVITY.join('|')}`);
  if (!Array.isArray(p.keywords) || p.keywords.length < LIMITS.keywordsMin || p.keywords.length > LIMITS.keywordsMax
    || !p.keywords.every((k) => typeof k === 'string' && /^[a-z0-9][a-z0-9-]{1,39}$/.test(k))) {
    errors.push(`keywords: ${LIMITS.keywordsMin}–${LIMITS.keywordsMax} lowercase tokens (a-z0-9-)`);
  }
  if (p.canonicalPointer !== undefined && p.canonicalPointer !== null
    && (typeof p.canonicalPointer !== 'string' || !p.canonicalPointer.trim() || p.canonicalPointer.includes('..'))) {
    errors.push('canonicalPointer: null or repo-relative path (no "..")');
  }
  validateProvenance(p.provenance, errors);
  return errors;
}

// ── sanitizer gate (persist gate — stricter than the graph edge) ─────────────

/**
 * For durable memory everything except dangerous-PS mentions is a BLOCK:
 * tenant literals + credentials (already BLOCK at the edge), PII (WARN at the
 * edge → BLOCK here: memory outlives the ticket that justified the data), and
 * injection markers (FLAG at the edge → BLOCK here: distilled lessons never
 * legitimately contain injected instructions; the canonical catalog of those
 * patterns lives in modules/security/threat_detection.md and is pointed to,
 * not copied). Dangerous-PS mentions stay WARN — a SKILL memory may
 * legitimately caution about a destructive cmdlet by name.
 */
function sanitizeGate(proposal) {
  const scan = scanArtifact(proposal);
  const blocks = [];
  for (const b of scan.blocks) blocks.push({ class: 'tenant-or-credential', label: b.label, path: b.path });
  for (const p of scan.piiWarnings) blocks.push({ class: 'pii', label: p.label, path: p.path });
  for (const f of scan.injectionFlags) blocks.push({ class: 'injection-marker', label: f.marker, path: f.path });
  return { blocks, warnings: scan.warnings.map((w) => ({ class: 'dangerous-ps-mention', label: w.label, path: w.path })) };
}

// ── lexical machinery (deterministic; no embeddings at this scale) ───────────

const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'with', 'to', 'of', 'in', 'on', 'at', 'by', 'from',
  'is', 'are', 'was', 'were', 'it', 'this', 'that', 'how', 'what', 'why', 'when', 'who',
  'does', 'do', 'did', 'can', 'could', 'should', 'would', 'my', 'our', 'their', 'be', 'not']);

function tokenize(text) {
  return String(text).toLowerCase().split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function jaccard(aSet, bSet) {
  let inter = 0;
  for (const x of aSet) if (bSet.has(x)) inter++;
  const union = aSet.size + bSet.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ── dedup / conflict ─────────────────────────────────────────────────────────

/**
 * A proposal duplicates an existing record (candidate or verified — anything
 * still retrievable or promotable) only when it states the SAME CLAIM: heavy
 * summary overlap, or heavy keyword overlap backed by moderate summary
 * overlap. Same TOPIC with a different claim (keywords overlap, summaries
 * diverge) is NOT a duplicate — it must reach the promote-time conflict gate
 * as a potential contradiction. Duplicates merge provenance into the existing
 * record instead of creating a competing page.
 */
function dedupMatch(proposal, indexRecords) {
  const kw = new Set(proposal.keywords);
  const sum = new Set(tokenize(proposal.summary));
  let best = null;
  for (const rec of indexRecords) {
    if (rec.status === 'rejected' || rec.status === 'superseded') continue;
    const kwScore = jaccard(kw, new Set(rec.keywords));
    const sumScore = jaccard(sum, new Set(tokenize(rec.summary)));
    const score = Math.max(kwScore, sumScore);
    if ((sumScore >= 0.7 || (kwScore >= 0.5 && sumScore >= 0.4)) && (!best || score > best.score)) {
      best = { id: rec.id, score: Number(score.toFixed(2)) };
    }
  }
  return best;
}

/**
 * Same-topic verified records are potential contradictions. Promotion is
 * fail-closed: every conflict id must be explicitly resolved as either
 * --supersede <id> (new truth replaces old, audit preserved) or
 * --distinct <id> (operator asserts both are true). Never silent.
 */
function conflictScan(candidate, indexRecords) {
  const kw = new Set(candidate.keywords);
  const hits = [];
  for (const rec of indexRecords) {
    if (rec.status !== 'verified' && rec.status !== 'stale') continue;
    if (rec.id === candidate.id) continue;
    let shared = 0;
    for (const k of rec.keywords) if (kw.has(k)) shared++;
    if (shared >= 2) hits.push(rec.id);
  }
  return hits;
}

// ── staleness (derived at read time; policy per volatility class) ────────────

function daysBetween(fromDate, toDate) {
  return Math.floor((new Date(toDate) - new Date(fromDate)) / 86400000);
}

function effectiveStaleness(rec, asOf) {
  if (rec.status === 'stale') return { stale: true, note: 'REVIEW-REQUIRED — explicitly marked stale' };
  const windowDays = VOLATILITY_WINDOW_DAYS[rec.volatility];
  if (windowDays === null || windowDays === undefined) return { stale: false, note: null };
  const ref = rec.lastVerified || rec.created;
  const age = daysBetween(ref, asOf);
  if (age > windowDays) {
    return { stale: true, note: `REVIEW-REQUIRED — ${rec.volatility} unverified for ${age}d (window ${windowDays}d)` };
  }
  return { stale: false, note: null };
}

// ── retrieval scoring (bounded, index-only) ──────────────────────────────────

function scoreQuery(queryTokens, rec) {
  const kw = new Set(rec.keywords);
  const sum = new Set(tokenize(rec.summary));
  let score = 0;
  for (const t of queryTokens) {
    if (kw.has(t)) score += 3;
    else if (sum.has(t)) score += 1;
  }
  return score;
}

/**
 * Retrieve top-K relevant entries. Fresh verified entries rank first; stale
 * entries are still findable but always flagged REVIEW-REQUIRED and sorted
 * after every fresh hit — an old fact must never be confidently reused as
 * current. Superseded and rejected records never surface (their successor
 * does); candidates only with includeCandidates (review workflows).
 */
function retrieve(query, indexRecords, opts = {}) {
  const asOf = opts.asOf || new Date().toISOString().slice(0, 10);
  const limit = Math.min(opts.limit || LIMITS.retrieveDefault, LIMITS.retrieveMax);
  const queryTokens = tokenize(query);
  const scored = [];
  for (const rec of indexRecords) {
    if (rec.status === 'superseded' || rec.status === 'rejected') continue;
    if (rec.status === 'candidate' && !opts.includeCandidates) continue;
    const score = scoreQuery(queryTokens, rec);
    if (score <= 0) continue;
    const { stale, note } = effectiveStaleness(rec, asOf);
    scored.push({ rec, score, stale, staleNote: note });
  }
  scored.sort((a, b) => (a.stale !== b.stale) ? (a.stale ? 1 : -1) : (b.score - a.score) || a.rec.id.localeCompare(b.rec.id));
  return scored.slice(0, limit).map(({ rec, score, stale, staleNote }) => ({
    id: rec.id,
    type: rec.type,
    status: rec.status,
    stale,
    staleNote,
    score,
    summary: rec.summary,
    canonicalPointer: rec.canonicalPointer || null,
    lastVerified: rec.lastVerified || null,
  }));
}

module.exports = {
  TYPES,
  STATUSES,
  SCOPES,
  SENSITIVITY,
  PROVENANCE_KINDS,
  TRUSTED_PROVENANCE,
  VOLATILITY_WINDOW_DAYS,
  LIMITS,
  RECORD_KEYS,
  validateProposal,
  sanitizeGate,
  tokenize,
  dedupMatch,
  conflictScan,
  effectiveStaleness,
  retrieve,
};
