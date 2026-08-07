#!/usr/bin/env node
'use strict';
// replay.test.js — behavioral suite for the deterministic replay cache (WS2).
// R1–R8 map 1:1 to the acceptance requirements in ADR-006 / the 2026-08-07
// engineering phase. Zero-dep, sandboxed store per test via AEGIS_REPLAY_DIR.

const { execFileSync } = require('child_process');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CLI = path.join(__dirname, 'replay-cli.js');
const ROOT = path.resolve(__dirname, '..', '..');
let passed = 0, failed = 0;

function run(args, { store, expectExit = 0 } = {}) {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      encoding: 'utf8',
      env: { ...process.env, AEGIS_REPLAY_DIR: store },
    });
    if (expectExit !== 0) throw new Error(`expected exit ${expectExit}, got 0`);
    return stdout;
  } catch (e) {
    if (e.status === expectExit) return (e.stdout || '') + (e.stderr || '');
    throw e;
  }
}
const j = (s) => JSON.parse(s);

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-replay-'));
  return { store: path.join(dir, 'store'), work: dir };
}
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); }
}

const TICKET = 'Onboard a new hire: [FIRST_NAME] [LAST_NAME], starts [START_DATE], standard staff profile.';
const SOLUTION = '# Verified onboarding work-up\n\n1. Create AD user [FIRST_NAME].[LAST_NAME] → 2. sync → 3. license [LICENSE_TYPE] → 4. MFA at aka.ms/mfasetup.\nVerified: Get-MgUser -UserId "[UPN]" returned licensed account.\n';

function seedVerified(sb) {
  const sol = path.join(sb.work, 'solution.md');
  const dep = path.join(sb.work, 'authority.md');
  fs.writeFileSync(sol, SOLUTION);
  fs.writeFileSync(dep, 'authority doctrine v1 — basis for the onboarding flow');
  run(['record', '--ticket', TICKET, '--solution-file', sol, '--deps', dep], { store: sb.store });
  run(['verify', 'case-0001', '--evidence', 'live run verified via directory read-back 2026-08-07'], { store: sb.store });
  return { sol, dep };
}

// R1 — first occurrence: MISS, routed to the normal adaptive path
test('R1 first occurrence is a MISS routed to adaptive', () => {
  const sb = sandbox();
  const r = j(run(['lookup', '--ticket', TICKET], { store: sb.store }));
  assert.strictEqual(r.result, 'MISS');
  assert.strictEqual(r.route, 'adaptive');
});

// R2 — only a VERIFIED solution becomes replayable
test('R2 recorded-but-unverified candidate never replays; failed write releases the lock', () => {
  const sb = sandbox();
  const sol = path.join(sb.work, 's.md');
  fs.writeFileSync(sol, SOLUTION);
  run(['record', '--ticket', TICKET, '--solution-file', sol], { store: sb.store });
  const r = j(run(['lookup', '--ticket', TICKET], { store: sb.store }));
  assert.strictEqual(r.result, 'MISS', 'candidate must not produce CACHE_HIT');
  const c = JSON.parse(fs.readFileSync(path.join(sb.store, 'case-0001.json'), 'utf8'));
  assert.strictEqual(c.status, 'candidate', 'record can only ever create candidates');
  run(['render', 'case-0001'], { store: sb.store, expectExit: 2 });
  // a refusal INSIDE the lock (duplicate ticket) must release the lock
  run(['record', '--ticket', TICKET, '--solution-file', sol], { store: sb.store, expectExit: 1 });
  assert.ok(!fs.existsSync(path.join(sb.store, '.lock')), 'lock must be released after a failed write');
  run(['alias', '--case', 'case-0001', '--ticket', 'still writable'], { store: sb.store });
});

// R3 — exact repeat (and deterministic variants + alias) produce CACHE_HIT
test('R3 exact repeat is CACHE_HIT; normalization and alias hit deterministically', () => {
  const sb = sandbox();
  seedVerified(sb);
  const exact = j(run(['lookup', '--ticket', TICKET], { store: sb.store }));
  assert.strictEqual(exact.result, 'CACHE_HIT');
  const variant = j(run(['lookup', '--ticket', '  ONBOARD a new hire:: [FIRST_NAME] [LAST_NAME],, starts [START_DATE], standard staff profile!  '], { store: sb.store }));
  assert.strictEqual(variant.result, 'CACHE_HIT', 'case/whitespace/punctuation variants must key identically');
  run(['alias', '--case', 'case-0001', '--ticket', 'new hire setup standard profile'], { store: sb.store });
  const viaAlias = j(run(['lookup', '--ticket', 'New hire setup — standard profile'], { store: sb.store }));
  assert.strictEqual(viaAlias.result, 'CACHE_HIT');
  assert.strictEqual(viaAlias.via, 'alias');
  const rendered = run(['render', 'case-0001'], { store: sb.store });
  assert.strictEqual(rendered, SOLUTION, 'render must be byte-verbatim');
});

// R4 — the fast path invokes no model, agent, loop, graph, or network
test('R4 CLI source has no network/model/subprocess capability at all', () => {
  const src = fs.readFileSync(CLI, 'utf8');
  for (const banned of ["require('http", "require('net", "require('tls", "require('dns", "require('child_process", 'fetch(', 'XMLHttpRequest', 'WebSocket']) {
    assert.ok(!src.includes(banned), `forbidden capability in fast path: ${banned}`);
  }
  const sb = sandbox();
  seedVerified(sb);
  const t0 = Date.now();
  run(['lookup', '--ticket', TICKET], { store: sb.store });
  run(['render', 'case-0001'], { store: sb.store });
  assert.ok(Date.now() - t0 < 5000, 'fast path must complete in local-fs time');
});

// R5 — unverified output cannot enter the replayable state
test('R5 verification demands evidence AND a dependency basis (or explicit --no-deps)', () => {
  const sb = sandbox();
  const sol = path.join(sb.work, 's.md');
  fs.writeFileSync(sol, SOLUTION);
  run(['record', '--ticket', TICKET, '--solution-file', sol], { store: sb.store });
  run(['verify', 'case-0001'], { store: sb.store, expectExit: 2 });
  run(['verify', 'case-0001', '--evidence', 'short'], { store: sb.store, expectExit: 2 });
  // dep-less verify refused without explicit acknowledgement — a dep-less case
  // could never auto-stale, silently defeating fingerprint invalidation
  run(['verify', 'case-0001', '--evidence', 'proper verification evidence text'], { store: sb.store, expectExit: 2 });
  let c = JSON.parse(fs.readFileSync(path.join(sb.store, 'case-0001.json'), 'utf8'));
  assert.strictEqual(c.status, 'candidate');
  run(['verify', 'case-0001', '--evidence', 'proper verification evidence text', '--no-deps'], { store: sb.store });
  c = JSON.parse(fs.readFileSync(path.join(sb.store, 'case-0001.json'), 'utf8'));
  assert.strictEqual(c.status, 'verified', 'explicit --no-deps acknowledgement permits verify');
});

// R6 — relevant authority change marks the case STALE, preserved not served
test('R6 authority-file change invalidates: STALE at lookup, render refuses, history preserved', () => {
  const sb = sandbox();
  const { dep } = seedVerified(sb);
  fs.appendFileSync(dep, '\nDOCTRINE CHANGED — new gate added');
  const r = j(run(['lookup', '--ticket', TICKET], { store: sb.store }));
  assert.strictEqual(r.result, 'STALE');
  run(['render', 'case-0001'], { store: sb.store, expectExit: 3 });
  const hist = run(['render', 'case-0001', '--historical'], { store: sb.store });
  assert.ok(hist.includes('STALE — HISTORICAL EVIDENCE ONLY'), 'historical view must carry the stale banner');
  assert.ok(hist.includes('Verified onboarding work-up'), 'historical evidence is preserved, not deleted');
});

// R7 — unrelated change does NOT invalidate (dependency tracking is precise)
test('R7 unrelated file change leaves the cache hit intact', () => {
  const sb = sandbox();
  seedVerified(sb);
  fs.writeFileSync(path.join(sb.work, 'unrelated.md'), 'some other doc changed');
  const r = j(run(['lookup', '--ticket', TICKET], { store: sb.store }));
  assert.strictEqual(r.result, 'CACHE_HIT');
});

// R8 — private ticket content stays out of public release artifacts
test('R8 real store is git-ignored; secrets are blocked at persist; fixtures are synthetic', () => {
  execFileSync('git', ['check-ignore', '-q', '--', 'memory/replay'], { cwd: ROOT });
  const sb = sandbox();
  const sol = path.join(sb.work, 'leak.md');
  fs.writeFileSync(sol, 'fix applied\ntoken = ghp_' + '0'.repeat(30));
  run(['record', '--ticket', 'leaky ticket', '--solution-file', sol], { store: sb.store, expectExit: 4 });
  const fixDir = path.join(__dirname, 'fixtures');
  for (const f of fs.readdirSync(fixDir)) {
    const body = fs.readFileSync(path.join(fixDir, f), 'utf8');
    assert.ok(/\[(FIRST_NAME|UPN|START_DATE|@Aegion)/.test(body), `fixture ${f} must be placeholder-based`);
    assert.strictEqual(sanHitsInFixture(body), 0, `fixture ${f} must contain no secret-shaped content`);
  }
  function sanHitsInFixture(t) {
    return [/ghp_[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN/].filter((re) => re.test(t)).length;
  }
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
