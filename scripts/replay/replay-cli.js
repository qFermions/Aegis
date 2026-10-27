#!/usr/bin/env node
'use strict';
// replay-cli.js — Aegis deterministic replay cache (V2, ADR-006 / WS2).
//
// A previously VERIFIED ticket solution with an unchanged authority basis is
// replayable immediately, with ZERO ticket-solving model/agent/loop/graph
// invocations. This CLI is the entire fast path: deterministic normalization,
// exact-key lookup, fingerprint-based staleness, verbatim render.
//
// Design constraints (enforced by replay.test.js R4 — statically on the module
// graph AND at run time under a network/subprocess tripwire):
//   - no network modules (http/https/net/tls/dns), no child_process, no fetch
//   - pure fs + crypto + path (+ the pure-function tier guard) — runs offline
//
// Lifecycle:  record (candidate) → verify (+evidence, deps fingerprinted)
//             → lookup/render (CACHE_HIT) → authority change → STALE
//             (preserved as historical evidence, never silently served)
//
// Only VERIFIED solutions replay. Candidates, drafts, and failed attempts are
// not authoritative memory. Invalidation is dependency-fingerprint based
// (sha256 of each authority file), never an arbitrary time TTL.
//
// V2 — three deterministic keys per verified case, checked in this order:
//   exact   sha256(normalize(ticket))        — punctuation/case/whitespace-insensitive
//   alias   an operator-registered second key for a known equivalent phrasing
//   shape   sha256("shape.v2|" + objectClass + "|" + shapeOf(ticket)) — the SAME
//           words with the identity literal (a UPN/email or an identity
//           placeholder) replaced by one slot token, keyed per object class.
//           OPT-IN per case at verify time (--identity-variants), only consulted
//           when BOTH the stored ticket and the lookup ticket are clean under the
//           tier guard (floor "none"), pure ASCII, carry EXACTLY ONE slot, and
//           agree on the slot's object class (placeholder token, Microsoft's
//           #EXT# guest marker, or an explicit --object-class assertion recorded
//           as such). No semantic similarity anywhere.
//
// Persistence boundary (SR-1/SR-8): secret-shaped content, the tenant literal,
// real email addresses, and phone-number patterns are refused at record /
// verify / alias / invalidate — private material cannot enter the store.
// Instruction-shaped text (SR-3) is refused at the same boundary: a verified
// solution renders verbatim with zero new reasoning, so an embedded
// instruction would be served as approved knowledge.
//
// Store: memory/replay/ (gitignored — private tickets never ship; the engine
// and synthetic fixtures are the public artifact).
//
// Exit codes: 0 ok · 1 usage/error · 2 refusal (unverified) · 3 stale without
// --historical · 4 sanitization block · 5 lock contention · 6 tenant binding
// refused (the store belongs to another tenant, or it is bound and
// AEGION_DOMAIN is unset)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { assess, foldedForms, injectionMarkersIn, hasForeignOrgToken, containsLiteral, maskCanonicalPlaceholders } = require('../tier/tier-guard.js'); // pure functions, no I/O

const ROOT = path.resolve(__dirname, '..', '..');
const STORE = process.env.AEGIS_REPLAY_DIR || path.join(ROOT, 'memory', 'replay');
const INDEX = path.join(STORE, 'index.json');
const LOCK = path.join(STORE, '.lock');
const TENANT = path.join(STORE, 'tenant.json');

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

// ── shape: identity literals → one slot; everything else stays exact ─────────
// Identity placeholders from modules/security/placeholder-dictionary.md that
// stand for a single principal's sign-in name, plus any email-shaped literal.
const IDENTITY_PLACEHOLDERS = ['[UPN]', '[USER@DOMAIN.COM]', '[MANAGER_UPN]', '[USER_UPN]', '[GUEST_UPN]', '[EMAIL]'];
const EMAIL_LITERAL = /[A-Za-z0-9._%+#-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g; // "#" so a guest UPN (…#EXT#@tenant) is one literal
const SLOT = '<id>';

// ── object class of the identity slot ────────────────────────────────────────
// A shape hit is only safe when the STORED case and the LOOKUP ticket agree on
// what kind of principal the slot names: a member user's procedure is not a
// guest's (B2B invitation), a shared mailbox's, or a distribution group's. The
// class is established deterministically from the placeholder token (the
// dictionary says what [UPN] is) or from Microsoft's guest UPN marker (#EXT#).
// A raw email literal has NO deterministic class — it stays 'unknown' and the
// caller must pass --object-class to assert one (recorded as anchor 'asserted',
// never inferred here). unknown on either side → MISS, never a guess.
const OBJECT_CLASSES = ['member-user', 'guest', 'shared-mailbox', 'distribution-group', 'm365-group', 'resource-mailbox', 'service-account'];
const PLACEHOLDER_CLASS = { '[UPN]': 'member-user', '[USER@DOMAIN.COM]': 'member-user', '[MANAGER_UPN]': 'member-user', '[USER_UPN]': 'member-user', '[GUEST_UPN]': 'guest', '[EMAIL]': 'unknown' };
const GUEST_UPN_MARKER = /#EXT#@/i;

function slotClass(text) {
  // { objectClass, anchor } for the single identity slot in `text`
  const s = String(text);
  for (const ph of IDENTITY_PLACEHOLDERS) {
    if (new RegExp(ph.replace(/[[\]@.]/g, (ch) => '\\' + ch), 'i').test(s)) {
      const cls = PLACEHOLDER_CLASS[ph] || 'unknown';
      return { objectClass: cls, anchor: cls === 'unknown' ? 'none' : 'placeholder' };
    }
  }
  const lit = s.match(EMAIL_LITERAL);
  if (lit && GUEST_UPN_MARKER.test(lit[0])) return { objectClass: 'guest', anchor: 'ext-marker' };
  return { objectClass: 'unknown', anchor: 'none' };
}

// Resolve the class for one side, honouring an explicit assertion only where it
// does not contradict a deterministic anchor. Returns { objectClass, anchor } or
// { refused: reason }.
function resolveClass(text, asserted) {
  const d = slotClass(text);
  if (asserted && !OBJECT_CLASSES.includes(asserted)) return { refused: `unknown --object-class "${asserted}" (valid: ${OBJECT_CLASSES.join(', ')})` };
  if (d.objectClass !== 'unknown') {
    if (asserted && asserted !== d.objectClass) return { refused: `asserted object class "${asserted}" contradicts the deterministic anchor "${d.objectClass}" (${d.anchor})` };
    return d;
  }
  if (asserted) return { objectClass: asserted, anchor: 'asserted' };
  return { objectClass: 'unknown', anchor: 'none' };
}

const SENTINEL = String.fromCharCode(1); // never survives normalize(); marks where an identity literal stood
function shapeOf(text) {
  let s = String(text);
  for (const ph of IDENTITY_PLACEHOLDERS) {
    s = s.replace(new RegExp(ph.replace(/[[\]@.]/g, (ch) => '\\' + ch), 'gi'), SENTINEL);
  }
  s = s.replace(EMAIL_LITERAL, SENTINEL);
  const segments = s.split(SENTINEL);
  const slots = segments.length - 1;
  const shape = segments.map(normalize).join(` ${SLOT} `).replace(/\s+/g, ' ').trim();
  return { shape, slots };
}

// ── sanitization at the persistence boundary (SR-1 / SR-8) ───────────────────
// Secrets/credentials, the real tenant literal, real email addresses, and
// phone-number patterns can never enter the store. Canonical placeholders and
// RFC example domains are exempt; nothing else is.
const ALLOWED_EMAIL_DOMAIN = /(^|\.)example\.(com|org|net)$/i;
function sanitizationHits(text) {
  const hits = [];
  const forms = foldedForms(text); // one fold for the literal, marker and org-token checks
  const patterns = [
    [/ghp_[A-Za-z0-9]{20,}/, 'GitHub token'],
    [/github_pat_[A-Za-z0-9_]{20,}/, 'GitHub fine-grained token'],
    [/sk-[A-Za-z0-9-]{20,}/, 'API secret key'],
    [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key material'],
    [/\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\b/, 'JWT'],
    [/\bpassword\s*[:=]\s*\S{4,}/i, 'plaintext password assignment'],
  ];
  for (const [re, label] of patterns) if (re.test(text)) hits.push(label);
  const lowerForms = forms.map((f) => f.toLowerCase());
  for (const v of ['AEGION_DOMAIN', 'AEGION_ORG_NAME']) {
    const lit = process.env[v];
    if (lit && lit.length > 3 && containsLiteral(text, lit, forms, lowerForms)) {
      hits.push(`tenant literal (${v})`);
    }
  }
  // PII: strip only CANONICAL placeholder shapes before the scan — an upper-case
  // token such as [USER@DOMAIN.COM] / [JIRA-###] or the [@Aegion_*] family. A
  // bracket wrapped around a real, lower-case address or a digit string is not
  // a placeholder and is scanned like any other text.
  const unbracketed = maskCanonicalPlaceholders(text);
  for (const m of unbracketed.matchAll(EMAIL_LITERAL)) {
    const domain = m[0].slice(m[0].indexOf('@') + 1);
    if (!ALLOWED_EMAIL_DOMAIN.test(domain)) { hits.push('real email address (use [USER@DOMAIN.COM] / [UPN])'); break; }
  }
  if (PHONE_LITERAL.test(unbracketed)) hits.push('phone number pattern (use [PHONE_NUMBER])');
  hits.push(...injectionHits(text, forms));
  if (hasForeignOrgToken(text, forms)) hits.push('mixed-tenant case (an org token from another namespace than [@Aegion_*]; one deployment serves one tenant)');
  return hits;
}

// Instruction-shaped text (SR-3) and a second org namespace (SR-1/SR-8) use the rules
// shared with the graph edge sanitizer in scripts/tier/tier-guard.js (one copy), matched
// as written and confusable-folded, so obfuscation does not carry an instruction or a
// second tenant into a solution that renders verbatim.
function injectionHits(text, forms) {
  return injectionMarkersIn(text, forms)
    .map((name) => `instruction-shaped text (prompt-injection marker: ${name}; content is data, never instructions)`);
}
// dashed · dotted · spaced · parenthesised area code · +country with 2–4 groups ·
// +country (0) trunk form · E.164 without separators · bare ten digits
const PHONE_LITERAL = /(?:\(\d{3}\)\s?\d{3}[-.\s]?\d{4}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\+\d{1,3}\s*\(0\)\s*\d{2,4}(?:[\s-]\d{2,4}){1,4}\b|\+\d{1,3}(?:[\s-]\d{2,4}){2,4}\b|\+\d{9,15}\b|\b\d{10}\b)/;

// Canonical placeholders are recognised by the shared rule in scripts/tier/tier-guard.js.
// Shape safety: only pure-ASCII tickets are shape-eligible. A homoglyph ("wıpe",
// Cyrillic "а") or an invisible format character (a zero-width space between
// "wi" and "pe") could otherwise slip past an English risk pattern and let a
// consequential procedure register as identity-variant eligible. Any code point
// above 0x7F disqualifies — letters, marks, and format characters alike.
function hasNonAscii(text) {
  return /[^\x00-\x7F]/.test(String(text));
}

// Read-time gate: a case file is re-checked against the persistence boundary
// every time lookup or render would serve it, because render prints the stored
// solution verbatim with zero reasoning. A case changed on disk outside this CLI
// so that it carries instruction-shaped text, a secret, a real address, the
// tenant literal or a second org namespace is withheld. Labels only, never text.
// Residual: a gate-clean edit is not detected (case files carry no seal).
// audit: status and list print every field of the case, so every string leaf and key
// name is checked one by one (a newline inside a leaf stays a newline), and the
// caseId and status must have their own shapes.
const CASE_STATUSES = new Set(['candidate', 'verified', 'stale']);
function stringLeaves(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringLeaves(v, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { out.push(k); stringLeaves(v, out); }
  return out;
}
function storedCaseHits(c, { audit = false } = {}) {
  const hits = [c.ticket, c.solution].some((t) => typeof t !== 'string') ? ['stored text is not a string'] : [];
  const texts = audit ? stringLeaves(c) : [c.ticket, c.solution].filter((t) => typeof t === 'string');
  for (const t of texts) hits.push(...sanitizationHits(t));
  if (audit && !validCaseId(c.caseId)) hits.push('stored caseId is not a case id');
  if (audit && !CASE_STATUSES.has(c.status)) hits.push('stored status is not a replay status');
  return Array.from(new Set(hits));
}
const validCaseId = (id) => (/^case-\d{4}$/.test(String(id)) ? id : null);

// ── store primitives (atomic write, mkdir lock) ──────────────────────────────
function loadIndex() {
  if (!fs.existsSync(INDEX)) return { schema: 'aegis.replay.v2', seq: 0, cases: {}, aliases: {}, shapes: {} };
  try {
    const ix = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
    if (!ix.shapes) ix.shapes = {}; // v1 stores upgrade in place: no shape keys until a case opts in
    return ix;
  } catch (e) { fail(1, 'store corrupt: index.json unreadable — ' + e.message); }
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
// ── tenant binding (one store, one tenant) ───────────────────────────────────
// Verified solutions are one tenant's knowledge. The store's first write under
// a tenant (AEGION_DOMAIN) binds it: tenant.json records a fingerprint of the
// tenant domain, never the literal (SR-8). Every command then refuses (exit 6)
// when the runtime tenant differs or is unset. An unbound store (created before
// this rule, or only written with AEGION_DOMAIN unset) carries no evidence of
// whose it is: it stays readable, and its first write under a tenant binds it.
// Same rule as scripts/memory/memory-cli.js (inline: R4 pins this file's deps).
const tenantFingerprint = (domain) => sha256('aegis.tenant.v1\n' + domain.trim().toLowerCase());
function runtimeTenant() {
  const d = process.env.AEGION_DOMAIN;
  return d && d.trim() ? tenantFingerprint(d) : null;
}
function boundTenant() {
  if (!fs.existsSync(TENANT)) return null;
  try {
    const b = JSON.parse(fs.readFileSync(TENANT, 'utf8'));
    if (b && b.schema === 'aegis.tenant-binding.v1' && /^[0-9a-f]{64}$/.test(b.tenant)) return b.tenant;
  } catch { /* unreadable binding: refused below */ }
  return fail(6, 'tenant binding unreadable: the owner of this store cannot be established; nothing read or written');
}
function assertTenant() {
  const bound = boundTenant();
  if (!bound) return;
  const current = runtimeTenant();
  if (!current) fail(6, 'store is bound to a tenant but AEGION_DOMAIN is not set: this case cannot be shown to belong to it; nothing read or written');
  if (current !== bound) fail(6, `store belongs to another tenant (binding ${bound.slice(0, 12)}, runtime ${current.slice(0, 12)}): one store, one tenant; nothing read or written`);
}
function bindTenantIfUnbound() {
  const current = runtimeTenant();
  if (!current || fs.existsSync(TENANT)) return;
  atomicWrite(TENANT, JSON.stringify({ schema: 'aegis.tenant-binding.v1', tenant: current, boundAt: new Date().toISOString() }, null, 2));
}

let lockHeld = false;
function withLock(fn) {
  // R8 guard: a write store inside the repo must stay under the git-ignored
  // memory/ area — a redirected in-tree store could otherwise be committed.
  const rel = path.relative(ROOT, STORE);
  const outsideRepo = rel.startsWith('..') || path.isAbsolute(rel); // cross-drive => absolute on Windows
  if (!outsideRepo && !/^memory[\\/]/.test(rel)) {
    fail(4, 'refused: AEGIS_REPLAY_DIR points inside the repo outside memory/ — private cases could be committed');
  }
  fs.mkdirSync(STORE, { recursive: true });
  try { fs.mkdirSync(LOCK); } catch {
    fail(5, 'store is locked by another writer — retry after it completes (stale lock: remove ' + LOCK + ')');
  }
  lockHeld = true;
  // Re-checked under the lock (another writer may have bound the store since
  // main() checked it); bound only after fn() returns, so a refused write never
  // claims the store. Same rule as scripts/memory/memory-cli.js.
  try { assertTenant(); const result = fn(); bindTenantIfUnbound(); return result; } finally { lockHeld = false; try { fs.rmdirSync(LOCK); } catch {} }
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

// ── resolve a ticket (or explicit case id) to a case: exact → alias → shape ──
function resolveCase(ix, ticket, id, assertedClass) {
  if (id && !id.startsWith('--')) return { caseId: id, via: 'id' };
  if (!ticket) fail(1, 'need --ticket "<text>" or a case id');
  const k = keyOf(ticket);
  // an explicit --object-class that contradicts the ticket's own deterministic
  // anchor is refused on EVERY path, exact and alias included — a caller who
  // says "member-user" about a #EXT# guest is wrong about the ticket, and the
  // engine never lets an assertion outrank an anchor
  if (assertedClass) {
    if (shapeOf(ticket).slots !== 1) return { caseId: null, via: 'none', key: k, shapeRefused: 'a --object-class assertion applies to exactly one identity slot; this ticket has ' + shapeOf(ticket).slots + ' — drop the flag (exact and alias keys need no class)' };
    const chk = resolveClass(ticket, assertedClass);
    if (chk.refused) return { caseId: null, via: 'none', key: k, shapeRefused: chk.refused };
  }
  if (ix.cases[k]) return { caseId: ix.cases[k], via: 'exact', key: k };
  if (ix.aliases[k]) return { caseId: ix.aliases[k], via: 'alias', key: k };
  // shape: only for risk-clean, ASCII-only tickets with EXACTLY ONE identity
  // slot whose object class is established, only against cases that opted in,
  // are themselves risk-clean under the CURRENT guard, and are bound to the
  // SAME object class. One slot means there is no role to confuse; ASCII-only
  // means no homoglyph can hide a risk word; class agreement means a member
  // user's procedure never renders for a guest, a shared mailbox, or a group.
  const { shape, slots } = shapeOf(ticket);
  if (slots === 1 && !hasNonAscii(ticket) && assess(ticket).floor === 'none') {
    // the shape index is keyed per object class, so a member-user case and a
    // guest case with the same wording coexist and are told apart by class
    const cls = resolveClass(ticket, assertedClass);
    if (cls.refused) return { caseId: null, via: 'none', key: k, shapeRefused: cls.refused };
    const owners = OBJECT_CLASSES.filter((cl) => ix.shapes[shapeIndexKey(shape, cl)]);
    if (!owners.length) return { caseId: null, via: 'none', key: k };
    if (cls.objectClass === 'unknown') {
      return { caseId: null, via: 'none', key: k, shapeRefused: `identity literal has no deterministic object class (verified case(s) exist for: ${owners.join(', ')}) — pass --object-class <class> only when the operator's own words establish it, otherwise route adaptive` };
    }
    const sk = shapeIndexKey(shape, cls.objectClass);
    const cid = ix.shapes[sk];
    if (!cid) {
      return { caseId: null, via: 'none', key: k, shapeRefused: `object class mismatch: verified case(s) exist for ${owners.join(', ')}, lookup is "${cls.objectClass}" (${cls.anchor})` };
    }
    const c = loadCase(cid);
    const bound = c && c.shape && c.shape.enabled && c.shape.slots === 1 && c.shape.objectClass === cls.objectClass;
    if (bound && !hasNonAscii(c.ticket) && assess(c.ticket).floor === 'none') {
      return { caseId: cid, via: 'shape', key: k, shapeKey: sk, slots, objectClass: cls.objectClass, anchor: cls.anchor };
    }
    return { caseId: null, via: 'none', key: k, shapeRefused: 'shape matched a case that is not class-bound, no longer risk-clean, or no longer opted in' };
  }
  return { caseId: null, via: 'none', key: k };
}
const shapeIndexKey = (shape, objectClass) => sha256('shape.v2|' + objectClass + '|' + shape);

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  function opt(name) {
    const i = argv.indexOf('--' + name);
    return i >= 0 ? argv[i + 1] : undefined;
  }
  const has = (name) => argv.includes('--' + name);
  assertTenant(); // every command reads or writes the store

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
        const risk = assess(ticket);
        const c = {
          schema: 'aegis.replay.case.v2', caseId,
          ticket, normalized: normalize(ticket), key: k,
          riskAtRecord: risk,
          status: 'candidate', solution,
          shape: null,
          deps: (opt('deps') || '').split(',').filter(Boolean).map((p) => ({ path: p.trim(), sha256: null })),
          provenance: { createdAt: now, verifiedAt: null, evidence: null },
          history: [{ at: now, event: 'recorded (candidate — not replayable until verified)' }],
        };
        ix.cases[k] = caseId;
        saveCase(c); saveIndex(ix);
        out({ ok: true, caseId, status: 'candidate', riskFloor: risk.floor, note: 'not replayable until verified with evidence' });
      });
      break;
    }

    case 'verify': {
      const id = argv[1];
      const evidence = opt('evidence');
      if (!id) fail(1, 'usage: verify <caseId> --evidence "<how this solution was proven>" [--no-deps] [--identity-variants]');
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
        const ix = loadIndex();
        if (has('identity-variants')) {
          const { shape, slots } = shapeOf(c.ticket);
          const risk = assess(c.ticket);
          if (risk.floor !== 'none') fail(2, 'identity-variants refused: the stored ticket trips the tier-guard floor (' + risk.triggers.join('; ') + ') — consequential work replays on exact keys and aliases only');
          if (hasNonAscii(c.ticket)) fail(2, 'identity-variants refused: the stored ticket contains non-ASCII letters — a homoglyph could hide a risk word from the guard, so such tickets replay on exact keys and aliases only');
          if (slots < 1) fail(2, 'identity-variants refused: the stored ticket carries no identity literal or [UPN]-class placeholder, so there is nothing to slot — exact key already covers it');
          if (slots > 1) fail(2, `identity-variants refused: the stored ticket carries ${slots} identity slots — with two principals the roles could swap (delegate ↔ owner), so only single-identity tickets may opt in`);
          const cls = resolveClass(c.ticket, opt('object-class'));
          if (cls.refused) fail(2, 'identity-variants refused: ' + cls.refused);
          if (cls.objectClass === 'unknown') fail(2, 'identity-variants refused: the stored ticket\'s identity slot has no deterministic object class — write the ticket with a dictionary token ([UPN] / [GUEST_UPN]) or pass --object-class <' + OBJECT_CLASSES.join('|') + '> stating what the verified procedure applies to');
          const sk = shapeIndexKey(shape, cls.objectClass);
          if (ix.shapes[sk] && ix.shapes[sk] !== id) fail(1, `shape already owned by ${ix.shapes[sk]} for object class ${cls.objectClass} — two verified cases cannot share a shape within one class`);
          ix.shapes[sk] = id;
          c.shape = { key: sk, shape, slots, objectClass: cls.objectClass, anchor: cls.anchor, enabled: true, enabledAt: new Date().toISOString() };
          c.history.push({ at: c.shape.enabledAt, event: 'identity-variants enabled (shape key registered)', slots, objectClass: cls.objectClass, anchor: cls.anchor });
        }
        c.deps = depPaths.length ? fingerprint(depPaths) : [];
        c.status = 'verified';
        c.provenance.verifiedAt = new Date().toISOString();
        c.provenance.evidence = evidence;
        c.history.push({ at: c.provenance.verifiedAt, event: 'verified', evidence });
        saveCase(c); saveIndex(ix);
        out({ ok: true, caseId: id, status: 'verified', deps: c.deps, identityVariants: !!(c.shape && c.shape.enabled), slots: c.shape ? c.shape.slots : 0, objectClass: c.shape ? c.shape.objectClass : undefined, anchor: c.shape ? c.shape.anchor : undefined });
      });
      break;
    }

    case 'lookup': {
      const ticket = opt('ticket');
      if (!ticket) fail(1, 'usage: lookup --ticket "<text>"');
      const ix = loadIndex();
      const r = resolveCase(ix, ticket, undefined, opt('object-class'));
      if (!r.caseId) { out({ ok: true, result: 'MISS', key: r.key, route: 'adaptive', ...(r.shapeRefused ? { note: r.shapeRefused } : {}) }); break; }
      const c = loadCase(r.caseId);
      if (!c || c.status === 'candidate') {
        out({ ok: true, result: 'MISS', key: r.key, caseId: r.caseId, route: 'adaptive', note: 'case exists but is not verified — candidates never replay' });
        break;
      }
      const stored = storedCaseHits(c);
      if (stored.length) {
        out({ ok: true, result: 'MISS', key: r.key, caseId: r.caseId, route: 'adaptive', withheld: stored, note: 'case withheld: its stored text fails the persistence boundary (changed on disk outside replay-cli.js?); work the ticket fresh' });
        break;
      }
      const drift = depDrift(c);
      if (c.status === 'stale' || drift.length) {
        if (c.status !== 'stale') {
          withLock(() => {
            const cc = loadCase(r.caseId);
            if (cc && cc.status !== 'stale') {
              cc.status = 'stale';
              cc.history.push({ at: new Date().toISOString(), event: 'marked stale at lookup', changed: drift });
              saveCase(cc);
            }
          });
        }
        out({ ok: true, result: 'STALE', caseId: r.caseId, via: r.via, changed: drift.length ? drift : 'previously detected (status shows the checked history)', route: 'adaptive', note: 'authority basis changed — preserved as historical, not current' });
        break;
      }
      const hit = { ok: true, result: 'CACHE_HIT', caseId: r.caseId, via: r.via, verifiedAt: c.provenance.verifiedAt, deps: c.deps.length, render: `node scripts/replay/replay-cli.js render ${r.caseId}` };
      if (r.via === 'shape') {
        hit.objectClass = r.objectClass; hit.anchor = r.anchor;
        hit.note = `identity-variant of a verified case: identical wording, one ${r.objectClass} identity slotted (class anchor: ${r.anchor}); tier-guard floor clean on both sides`;
      }
      out(hit);
      break;
    }

    case 'render': {
      const ix = loadIndex();
      const { caseId } = resolveCase(ix, opt('ticket'), argv[1], opt('object-class'));
      if (!caseId) fail(1, 'no matching case');
      const c = loadCase(caseId);
      if (!c) fail(1, 'no such case: ' + caseId);
      if (c.status === 'candidate') fail(2, 'render refused: case is unverified (candidate) — only verified solutions replay');
      const stored = storedCaseHits(c);
      if (stored.length) fail(4, 'render refused: the stored case fails the persistence boundary (changed on disk outside replay-cli.js?): ' + stored.join(', '));
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
      const aHits = sanitizationHits(ticket);
      if (aHits.length) fail(4, 'sanitization BLOCK — alias text refused: ' + aHits.join(', '));
      withLock(() => {
        const ix = loadIndex();
        const c = loadCase(id);
        if (!c) fail(1, 'no such case: ' + id);
        // an alias is operator-registered, but it still cannot bridge a risk floor
        // or an object class: "wipe …" must never be a second key for a routine
        // case, and a guest phrasing must never be a key for a member-user case
        const aRisk = assess(ticket); const cRisk = assess(c.ticket);
        if (aRisk.floor !== cRisk.floor) fail(2, `alias refused: tier-guard floor differs (alias ${aRisk.floor}${aRisk.triggers.length ? ': ' + aRisk.triggers.join('; ') : ''} vs case ${cRisk.floor}) — an alias cannot bridge a risk class`);
        const aCls = slotClass(ticket).objectClass; const cCls = (c.shape && c.shape.objectClass) || slotClass(c.ticket).objectClass;
        if (aCls !== 'unknown' && cCls !== 'unknown' && aCls !== cCls) fail(2, `alias refused: identity object class differs (alias "${aCls}" vs case "${cCls}") — an alias cannot bridge an object class`);
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

    case 'explain': {
      // Why would this ticket hit or miss? Pure computation, no store writes.
      const ticket = opt('ticket');
      if (!ticket) fail(1, 'usage: explain --ticket "<text>"');
      const ix = fs.existsSync(INDEX) ? loadIndex() : { cases: {}, aliases: {}, shapes: {} };
      const { shape, slots } = shapeOf(ticket);
      const risk = assess(ticket);
      const k = keyOf(ticket);
      const cls = slots === 1 ? resolveClass(ticket, opt('object-class')) : { objectClass: 'n/a', anchor: 'n/a' };
      const sk = cls.objectClass && !cls.refused && cls.objectClass !== 'n/a' && cls.objectClass !== 'unknown' ? shapeIndexKey(shape, cls.objectClass) : null;
      const shapeReason = slots !== 1 ? (slots < 1 ? 'no identity slot' : `${slots} identity slots (only exactly one may match)`)
        : hasNonAscii(ticket) ? 'non-ASCII character present'
          : risk.floor !== 'none' ? 'tier-guard floor ' + risk.floor
            : cls.refused ? cls.refused
              : cls.objectClass === 'unknown' ? 'identity literal has no deterministic object class (pass --object-class only when the operator\'s words establish it)' : null;
      out({
        ok: true, normalized: normalize(ticket), exactKey: k, shape, slots, shapeKey: sk,
        objectClass: cls.objectClass, classAnchor: cls.anchor,
        riskFloor: risk.floor, riskTriggers: risk.triggers,
        wouldConsult: { exact: !!ix.cases[k], alias: !!ix.aliases[k], shape: shapeReason ? 'not consulted (' + shapeReason + ')' : !!(sk && ix.shapes[sk]) },
      });
      break;
    }

    case 'status': {
      const c = loadCase(argv[1]);
      if (!c) fail(1, 'no such case: ' + (argv[1] || '(missing id)'));
      const stored = storedCaseHits(c, { audit: true });
      if (stored.length) { out({ ok: true, caseId: validCaseId(c.caseId), withheld: stored, note: 'stored text fails the persistence boundary (changed on disk outside replay-cli.js?); not printed' }); break; }
      out({ ok: true, caseId: c.caseId, status: c.status, shape: c.shape, riskAtRecord: c.riskAtRecord, provenance: c.provenance, deps: c.deps, history: c.history });
      break;
    }

    case 'list': {
      const ix = loadIndex();
      const rows = Object.values(ix.cases).map((id) => {
        const c = loadCase(id);
        if (!c) return { caseId: validCaseId(id), status: 'MISSING' };
        const stored = storedCaseHits(c, { audit: true });
        if (stored.length) return { caseId: validCaseId(c.caseId), withheld: stored };
        return { caseId: c.caseId, status: c.status, identityVariants: !!(c.shape && c.shape.enabled), ticket: c.ticket.slice(0, 60) };
      });
      out({ ok: true, count: rows.length, cases: rows });
      break;
    }

    default:
      fail(1, 'usage: replay-cli.js <record|verify|lookup|render|alias|invalidate|explain|status|list> …');
  }
}

module.exports = { normalize, keyOf, shapeOf, shapeIndexKey, sanitizationHits, slotClass, resolveClass, IDENTITY_PLACEHOLDERS, OBJECT_CLASSES, SLOT };

if (require.main === module) main();
