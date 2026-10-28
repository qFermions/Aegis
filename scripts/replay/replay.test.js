#!/usr/bin/env node
'use strict';
// replay.test.js — behavioral suite for the deterministic replay cache (WS2).
// R1–R8 map 1:1 to the acceptance requirements in ADR-006 / the 2026-08-07
// engineering phase; R9–R14 cover the V2 identity-variant (shape) keys, the
// PII persistence boundary, lock/concurrency behavior, and runtime negative
// evidence for the zero-model claim. Zero-dep, sandboxed store per test.

const { execFileSync, spawnSync } = require('child_process');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CLI = path.join(__dirname, 'replay-cli.js');
const ROOT = path.resolve(__dirname, '..', '..');
let passed = 0, failed = 0;

function run(args, { store, expectExit = 0, extraEnv = {} } = {}) {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      encoding: 'utf8',
      env: { ...process.env, AEGIS_REPLAY_DIR: store, ...extraEnv },
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

function seedVerified(sb, { ticket = TICKET, extra = [] } = {}) {
  const sol = path.join(sb.work, 'solution.md');
  const dep = path.join(sb.work, 'authority.md');
  fs.writeFileSync(sol, SOLUTION);
  fs.writeFileSync(dep, 'authority doctrine v1 — basis for the onboarding flow');
  run(['record', '--ticket', ticket, '--solution-file', sol, '--deps', dep], { store: sb.store });
  run(['verify', 'case-0001', '--evidence', 'live run verified via directory read-back 2026-08-07', ...extra], { store: sb.store });
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
  // an alias pointing at an unverified case is still a MISS — aliases never bypass verification
  const viaAlias = j(run(['lookup', '--ticket', 'still writable'], { store: sb.store }));
  assert.strictEqual(viaAlias.result, 'MISS');
  assert.match(viaAlias.note, /not verified/);
});

// R3 — exact repeat (and deterministic variants + alias) produce CACHE_HIT
test('R3 exact repeat is CACHE_HIT; normalization and alias hit deterministically', () => {
  const sb = sandbox();
  seedVerified(sb);
  const exact = j(run(['lookup', '--ticket', TICKET], { store: sb.store }));
  assert.strictEqual(exact.result, 'CACHE_HIT');
  assert.strictEqual(exact.via, 'exact');
  const variant = j(run(['lookup', '--ticket', '  ONBOARD a new hire:: [FIRST_NAME] [LAST_NAME],, starts [START_DATE], standard staff profile!  '], { store: sb.store }));
  assert.strictEqual(variant.result, 'CACHE_HIT', 'case/whitespace/punctuation variants must key identically');
  run(['alias', '--case', 'case-0001', '--ticket', 'new hire setup standard profile'], { store: sb.store });
  const viaAlias = j(run(['lookup', '--ticket', 'New hire setup — standard profile'], { store: sb.store }));
  assert.strictEqual(viaAlias.result, 'CACHE_HIT');
  assert.strictEqual(viaAlias.via, 'alias');
  const rendered = run(['render', 'case-0001'], { store: sb.store });
  assert.strictEqual(rendered, SOLUTION, 'render must be byte-verbatim');
  assert.strictEqual(run(['render', '--ticket', 'New hire setup — standard profile'], { store: sb.store }), SOLUTION, 'render resolves aliases too');
});

// R4 — the fast path invokes no model, agent, loop, graph, or network:
//      (a) statically, across the whole module graph the CLI loads;
//      (b) at run time, under a tripwire that throws on any network, DNS,
//          subprocess, or fetch call — lookup and render still succeed.
test('R4 fast path has no network/model/subprocess capability — static module graph AND runtime tripwire', () => {
  const graph = [CLI, path.join(ROOT, 'scripts', 'tier', 'tier-guard.js')];
  for (const file of graph) {
    const src = fs.readFileSync(file, 'utf8');
    for (const banned of ["require('http", "require('net", "require('tls", "require('dns", "require('child_process", "require('worker_threads", 'fetch(', 'XMLHttpRequest', 'WebSocket', 'import(']) {
      assert.ok(!src.includes(banned), `forbidden capability in fast path ${path.basename(file)}: ${banned}`);
    }
    // every require in the graph is a node built-in from the allowed set or a graph member
    for (const m of src.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
      const dep = m[1];
      assert.ok(['fs', 'path', 'crypto', '../tier/tier-guard.js'].includes(dep), `unexpected dependency in fast path: ${dep}`);
    }
  }
  const sb = sandbox();
  seedVerified(sb);
  const tripwire = path.join(sb.work, 'tripwire.js');
  fs.writeFileSync(tripwire, `
    'use strict';
    const trip = (what) => () => { throw new Error('TRIPWIRE: ' + what + ' was called on the replay fast path'); };
    // arm every outbound-capable entry point; leave net.Socket/Server alone because
    // Node's own stdio pipes are built on them (stubbing those breaks console output)
    const ARM = {
      http: ['request', 'get', 'createServer'], https: ['request', 'get', 'createServer'],
      net: ['connect', 'createConnection', 'createServer'], tls: ['connect', 'createServer'],
      dns: ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveMx', 'resolveTxt', 'resolveSrv', 'resolveCname', 'resolveNs', 'reverse'],
      child_process: ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'],
      worker_threads: ['Worker'],
    };
    for (const [mod, names] of Object.entries(ARM)) {
      const m = require(mod);
      for (const k of names) { try { m[k] = trip(mod + '.' + k); } catch {} }
    }
    globalThis.fetch = trip('fetch');
  `);
  const extraEnv = { NODE_OPTIONS: `--require ${tripwire.replace(/\\/g, '/')}` };
  const t0 = Date.now();
  const hit = j(run(['lookup', '--ticket', TICKET], { store: sb.store, extraEnv }));
  assert.strictEqual(hit.result, 'CACHE_HIT', 'lookup must succeed with every network/subprocess call armed to throw');
  assert.strictEqual(run(['render', 'case-0001'], { store: sb.store, extraEnv }), SOLUTION, 'render must succeed under the tripwire');
  assert.ok(Date.now() - t0 < 5000, 'fast path must complete in local-fs time');
  // the tripwire itself is live: a process that touches the network under it must fail
  const probe = spawnSync('node', ['-e', "require('https').get('https://example.invalid/')"], { encoding: 'utf8', env: { ...process.env, ...extraEnv } });
  assert.notStrictEqual(probe.status, 0, 'a network call under the tripwire must exit non-zero');
  assert.match(probe.stderr, /TRIPWIRE/, 'a network call under the tripwire must throw — proves the tripwire is armed');
  const probe2 = spawnSync('node', ['-e', "require('child_process').execSync('node -v')"], { encoding: 'utf8', env: { ...process.env, ...extraEnv } });
  assert.match(probe2.stderr, /TRIPWIRE/, 'a subprocess call under the tripwire must throw too');
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

// R9 — PII persistence boundary (SR-1): real emails and phone numbers never enter the store,
//      placeholders and RFC example domains do; the block applies to every write surface.
test('R9 real email / phone number content is refused at record, verify, alias, invalidate; placeholders pass', () => {
  // synthetic PII assembled at run time so the repository's own scanner never sees a literal
  const FAKE_EMAIL = ['jane.doe', 'contoso.com'].join('@');
  const FAKE_PHONE = ['555', '123', '4567'].join('-');
  const sb = sandbox();
  const pii = path.join(sb.work, 'pii.md');
  fs.writeFileSync(pii, `grant ${FAKE_EMAIL} full access\n`);
  const r = run(['record', '--ticket', 'grant access', '--solution-file', pii], { store: sb.store, expectExit: 4 });
  assert.match(r, /real email address/);
  fs.writeFileSync(pii, `call the user back on ${FAKE_PHONE}\n`);
  assert.match(run(['record', '--ticket', 'callback', '--solution-file', pii], { store: sb.store, expectExit: 4 }), /phone number/);
  // a real email in the TICKET text is refused too
  fs.writeFileSync(pii, 'placeholder solution for [UPN]\n');
  assert.match(run(['record', '--ticket', `reset MFA for ${FAKE_EMAIL}`, '--solution-file', pii], { store: sb.store, expectExit: 4 }), /real email address/);
  // placeholders and example domains are fine
  fs.writeFileSync(pii, 'grant [USER@DOMAIN.COM] full access; decoy tenant aegion.example.org; contact admin@example.com\n');
  run(['record', '--ticket', 'grant [UPN] access to [SHARED_MAILBOX]', '--solution-file', pii, '--deps', pii], { store: sb.store });
  assert.match(run(['verify', 'case-0001', '--evidence', `confirmed with ${FAKE_EMAIL} by phone`], { store: sb.store, expectExit: 4 }), /real email address/);
  assert.match(run(['alias', '--case', 'case-0001', '--ticket', `mailbox for ${FAKE_EMAIL}`], { store: sb.store, expectExit: 4 }), /real email address/);
  assert.match(run(['invalidate', 'case-0001', '--reason', `reported by ${FAKE_EMAIL}`], { store: sb.store, expectExit: 4 }), /real email address/);
  assert.ok(!fs.readFileSync(path.join(sb.store, 'index.json'), 'utf8').includes('contoso'), 'nothing PII-shaped reached the index');
  // square brackets are not a placeholder: [real@address] and [phone] are still PII (review finding A5)
  fs.writeFileSync(pii, `contact [${FAKE_EMAIL}] or [${FAKE_PHONE}]\n`);
  const bracketed = run(['record', '--ticket', 'bracketed pii', '--solution-file', pii], { store: sb.store, expectExit: 4 });
  assert.match(bracketed, /real email address/); assert.match(bracketed, /phone number/);
  // other phone shapes: parenthesised, international, bare ten digits
  for (const ph of [`(${FAKE_PHONE.slice(0, 3)}) ${FAKE_PHONE.slice(4)}`, '+44 20 7946 0958', FAKE_PHONE.replace(/-/g, '')]) {
    fs.writeFileSync(pii, `call ${ph}\n`);
    assert.match(run(['record', '--ticket', 'phone ' + ph.length, '--solution-file', pii], { store: sb.store, expectExit: 4 }), /phone number/, `phone shape ${ph}`);
  }
  // an UPPER-CASE bracket-wrapped address is not a placeholder either; neither is a digit string with a trailing # (second review)
  fs.writeFileSync(pii, `contact [${FAKE_EMAIL.toUpperCase()}]\n`);
  assert.match(run(['record', '--ticket', 'upper bracket', '--solution-file', pii], { store: sb.store, expectExit: 4 }), /real email address/);
  fs.writeFileSync(pii, `call [${FAKE_PHONE}#]\n`);
  assert.match(run(['record', '--ticket', 'hash bracket', '--solution-file', pii], { store: sb.store, expectExit: 4 }), /phone number/);
  // E.164 without separators and the +country (0) trunk form
  for (const ph of ['+1' + FAKE_PHONE.replace(/-/g, ''), '+44 (0)20 7946 0958']) {
    fs.writeFileSync(pii, `call ${ph}\n`);
    assert.match(run(['record', '--ticket', 'phone e164 ' + ph.length, '--solution-file', pii], { store: sb.store, expectExit: 4 }), /phone number/, `phone shape ${ph}`);
  }
  // canonical placeholders still pass in bracket form
  fs.writeFileSync(pii, 'contact [USER@DOMAIN.COM] on [PHONE_NUMBER]; ticket [JIRA-###]; tenant [@Aegion_DOMAIN]; device [DT-FirstName,LastName]\n');
  run(['record', '--ticket', 'placeholder-only record', '--solution-file', pii, '--deps', pii], { store: sb.store });
});

// R10 — identity-variant (shape) keys: opt-in, same words, one identity literal slotted.
test('R10 shape: a verified, opted-in, risk-clean case hits for the same wording with a different single user; placeholders and literals key identically', () => {
  const sb = sandbox();
  const ticket = 'Give [UPN] access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.';
  seedVerified(sb, { ticket, extra: ['--identity-variants'] });
  const st = j(run(['status', 'case-0001'], { store: sb.store }));
  assert.strictEqual(st.shape.enabled, true); assert.strictEqual(st.shape.slots, 1);
  assert.strictEqual(st.shape.objectClass, 'member-user', '[UPN] binds the case to the member-user class deterministically');
  assert.strictEqual(st.shape.anchor, 'placeholder');
  // a raw literal has no deterministic class → MISS until the caller establishes it
  const rawLit = j(run(['lookup', '--ticket', 'Give someone@example.org access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.'], { store: sb.store }));
  assert.strictEqual(rawLit.result, 'MISS'); assert.match(rawLit.note, /no deterministic object class/);
  const literal = j(run(['lookup', '--ticket', 'Give someone@example.org access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.', '--object-class', 'member-user'], { store: sb.store }));
  assert.strictEqual(literal.result, 'CACHE_HIT'); assert.strictEqual(literal.via, 'shape'); assert.strictEqual(literal.anchor, 'asserted');
  const otherPh = j(run(['lookup', '--ticket', 'Give [USER@DOMAIN.COM] access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook'], { store: sb.store }));
  assert.strictEqual(otherPh.result, 'CACHE_HIT'); assert.strictEqual(otherPh.via, 'shape'); assert.strictEqual(otherPh.anchor, 'placeholder');
  assert.strictEqual(run(['render', '--ticket', 'Give someone@example.org access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.', '--object-class', 'member-user'], { store: sb.store }), SOLUTION, 'render resolves a shape hit verbatim');
  run(['render', '--ticket', 'Give someone@example.org access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.'], { store: sb.store, expectExit: 1 });
  // the exact key still wins over shape when both exist
  const exact = j(run(['lookup', '--ticket', ticket], { store: sb.store }));
  assert.strictEqual(exact.via, 'exact');
});

// R11 — shape safety: slot count, wording, risk floor, and opt-in all gate the match.
test('R11 shape never matches across object count, changed wording, a consequential ticket, or a case that did not opt in', () => {
  const sb = sandbox();
  const ticket = 'Give [UPN] access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.';
  seedVerified(sb, { ticket, extra: ['--identity-variants'] });
  const miss = (t) => j(run(['lookup', '--ticket', t], { store: sb.store }));
  assert.strictEqual(miss('Give a@example.org and b@example.org access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.').result, 'MISS', 'two identities ≠ one identity');
  assert.strictEqual(miss('Give [UPN] full access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.').result, 'MISS', 'one changed word is a different ticket');
  assert.strictEqual(miss('Remove [UPN] access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.').result, 'MISS', 'destructive verb: different words AND the floor is T3');
  // a consequential stored ticket cannot opt in at all
  const sb2 = sandbox();
  const sol = path.join(sb2.work, 's.md'); const dep = path.join(sb2.work, 'd.md');
  fs.writeFileSync(sol, SOLUTION); fs.writeFileSync(dep, 'doctrine');
  run(['record', '--ticket', 'Disable [UPN] and revoke their sessions', '--solution-file', sol, '--deps', dep], { store: sb2.store });
  const refused = run(['verify', 'case-0001', '--evidence', 'verified in a lab tenant read-back', '--identity-variants'], { store: sb2.store, expectExit: 2 });
  assert.match(refused, /tier-guard floor/);
  // a case with no identity slot cannot opt in either (nothing to slot)
  const sb3 = sandbox();
  fs.writeFileSync(path.join(sb3.work, 's.md'), SOLUTION); fs.writeFileSync(path.join(sb3.work, 'd.md'), 'doctrine');
  run(['record', '--ticket', 'How do I set an out-of-office reply in Outlook?', '--solution-file', path.join(sb3.work, 's.md'), '--deps', path.join(sb3.work, 'd.md')], { store: sb3.store });
  assert.match(run(['verify', 'case-0001', '--evidence', 'verified render round-trip in Outlook', '--identity-variants'], { store: sb3.store, expectExit: 2 }), /nothing to slot/);
  // without opt-in, an identity variant is a MISS even though the words match
  const sb4 = sandbox();
  seedVerified(sb4, { ticket });
  assert.strictEqual(j(run(['lookup', '--ticket', 'Give someone@example.org access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.'], { store: sb4.store })).result, 'MISS', 'shape keys are opt-in per verified case');
  // two identity slots cannot opt in: the roles (delegate ↔ owner) could swap (review finding A6)
  const sb5 = sandbox();
  fs.writeFileSync(path.join(sb5.work, 's.md'), SOLUTION); fs.writeFileSync(path.join(sb5.work, 'd.md'), 'doctrine');
  run(['record', '--ticket', 'Give [UPN] delegate access to the [MANAGER_UPN] calendar', '--solution-file', path.join(sb5.work, 's.md'), '--deps', path.join(sb5.work, 'd.md')], { store: sb5.store });
  assert.match(run(['verify', 'case-0001', '--evidence', 'verified delegation read-back in lab tenant', '--identity-variants'], { store: sb5.store, expectExit: 2 }), /2 identity slots/);
  // a homoglyph cannot hide a risk word: "wıpe" (dotless i) floors at the guard AND is refused for shape on both sides (review finding A7)
  const sb6 = sandbox();
  fs.writeFileSync(path.join(sb6.work, 's.md'), SOLUTION); fs.writeFileSync(path.join(sb6.work, 'd.md'), 'doctrine');
  const homoglyph = 'Please wıpe the lost phone for [UPN] today';
  const rec = j(run(['record', '--ticket', homoglyph, '--solution-file', path.join(sb6.work, 's.md'), '--deps', path.join(sb6.work, 'd.md')], { store: sb6.store }));
  assert.strictEqual(rec.riskFloor, 'T3', 'confusable folding must let the guard see "wipe"');
  assert.match(run(['verify', 'case-0001', '--evidence', 'verified wipe read-back in lab tenant', '--identity-variants'], { store: sb6.store, expectExit: 2 }), /tier-guard floor|non-ASCII/);
  // an invisible format character (zero-width space inside "wipe") is folded away by the guard and refused for shape (second review)
  const sb8 = sandbox();
  fs.writeFileSync(path.join(sb8.work, 's.md'), SOLUTION); fs.writeFileSync(path.join(sb8.work, 'd.md'), 'doctrine');
  const zw = 'Please wi' + String.fromCharCode(0x200b) + 'pe the lost phone for [UPN] today';
  assert.strictEqual(j(run(['record', '--ticket', zw, '--solution-file', path.join(sb8.work, 's.md'), '--deps', path.join(sb8.work, 'd.md')], { store: sb8.store })).riskFloor, 'T3', 'zero-width space must not hide "wipe" from the guard');
  assert.match(run(['verify', 'case-0001', '--evidence', 'verified wipe read-back in lab tenant', '--identity-variants'], { store: sb8.store, expectExit: 2 }), /tier-guard floor|non-ASCII/);
  assert.match(run(['explain', '--ticket', zw], { store: sb8.store }), /not consulted/);
  // and a benign non-ASCII ticket is still refused for shape (fails closed), while exact keys keep working
  const sb7 = sandbox();
  fs.writeFileSync(path.join(sb7.work, 's.md'), SOLUTION); fs.writeFileSync(path.join(sb7.work, 'd.md'), 'doctrine');
  const accented = 'Give [UPN] access to the café shared mailbox';
  run(['record', '--ticket', accented, '--solution-file', path.join(sb7.work, 's.md'), '--deps', path.join(sb7.work, 'd.md')], { store: sb7.store });
  assert.match(run(['verify', 'case-0001', '--evidence', 'verified delegation read-back in lab tenant', '--identity-variants'], { store: sb7.store, expectExit: 2 }), /non-ASCII/);
  run(['verify', 'case-0001', '--evidence', 'verified delegation read-back in lab tenant'], { store: sb7.store });
  assert.strictEqual(j(run(['lookup', '--ticket', accented], { store: sb7.store })).result, 'CACHE_HIT');
});

// R12 — the dangerous pairs from the ticket corpus never share a key, at any layer.
test('R12 corpus dangerous pairs: no exact-key or shape-key collision, floors differ', () => {
  const replay = require(CLI);
  const { assess } = require(path.join(ROOT, 'scripts', 'tier', 'tier-guard.js'));
  const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'eval', 'ms-tickets.json'), 'utf8'));
  const byId = Object.fromEntries(corpus.tickets.map((t) => [t.id, t]));
  assert.ok(corpus.dangerousPairs.length >= 5, 'corpus must carry the adversarial pairs');
  for (const p of corpus.dangerousPairs) {
    const a = byId[p.a].text; const b = byId[p.b].text;
    assert.notStrictEqual(replay.keyOf(a), replay.keyOf(b), `${p.a}/${p.b} exact keys collide`);
    for (const cls of replay.OBJECT_CLASSES) {
      assert.notStrictEqual(replay.shapeIndexKey(replay.shapeOf(a).shape, cls), replay.shapeIndexKey(replay.shapeOf(b).shape, cls), `${p.a}/${p.b} shape keys collide for class ${cls}`);
    }
    if (p.floorsMustDiffer) assert.notStrictEqual(assess(a).floor, assess(b).floor, `${p.a}/${p.b} floors must differ`);
  }
});

// R13 — a held lock refuses a second writer deterministically (exit 5) and reads still work.
test('R13 lock contention: writes fail closed with exit 5 while a lock is held; lookups are unaffected; a failed write leaves no partial case', () => {
  const sb = sandbox();
  seedVerified(sb);
  fs.mkdirSync(path.join(sb.store, '.lock'));
  const sol = path.join(sb.work, 's2.md'); fs.writeFileSync(sol, SOLUTION);
  const refused = run(['record', '--ticket', 'second ticket while locked', '--solution-file', sol], { store: sb.store, expectExit: 5 });
  assert.match(refused, /locked by another writer/);
  assert.ok(!fs.existsSync(path.join(sb.store, 'case-0002.json')), 'no partial case written');
  assert.strictEqual(j(run(['lookup', '--ticket', TICKET], { store: sb.store })).result, 'CACHE_HIT', 'reads do not need the write lock');
  fs.rmdirSync(path.join(sb.store, '.lock'));
  run(['record', '--ticket', 'second ticket while locked', '--solution-file', sol], { store: sb.store });
});

// R14 — concurrent writers: N parallel records → every outcome is either a clean success or an
//       exit-5 refusal; the store is never corrupt and every successful case is unique and loadable.
test('R14 parallel records never corrupt the store — each writer succeeds or is refused, never half-written', () => {
  const sb = sandbox();
  const sol = path.join(sb.work, 's.md'); fs.writeFileSync(sol, SOLUTION);
  const results = [];
  const children = [];
  for (let i = 0; i < 6; i++) {
    children.push(spawnSync('node', [CLI, 'record', '--ticket', `parallel ticket ${i}`, '--solution-file', sol], { encoding: 'utf8', env: { ...process.env, AEGIS_REPLAY_DIR: sb.store } }));
  }
  for (const c of children) results.push(c.status);
  assert.ok(results.every((s) => s === 0 || s === 5), `unexpected exit codes: ${results.join(',')}`);
  const ix = JSON.parse(fs.readFileSync(path.join(sb.store, 'index.json'), 'utf8'));
  const ids = Object.values(ix.cases);
  assert.strictEqual(new Set(ids).size, ids.length, 'case ids are unique');
  assert.strictEqual(ids.length, results.filter((s) => s === 0).length, 'index entries equal successful writers');
  for (const id of ids) JSON.parse(fs.readFileSync(path.join(sb.store, id + '.json'), 'utf8'));
  assert.ok(!fs.existsSync(path.join(sb.store, '.lock')), 'no lock left behind');
  assert.ok(ids.length >= 1, 'at least one writer succeeded');
});

// R15 — object-class binding: a case verified for a member user never renders for a guest,
//       a shared mailbox, a distribution/M365 group, or an identity of unknown class.
test('R15 wrong-object-type replay is impossible: class must be established on both sides and agree', () => {
  const replay = require(CLI);
  const seed = (ticket, extra = []) => {
    const sb = sandbox();
    fs.writeFileSync(path.join(sb.work, 's.md'), SOLUTION); fs.writeFileSync(path.join(sb.work, 'd.md'), 'doctrine');
    run(['record', '--ticket', ticket, '--solution-file', path.join(sb.work, 's.md'), '--deps', path.join(sb.work, 'd.md')], { store: sb.store });
    return sb;
  };
  const look = (sb, ticket, cls) => j(run(['lookup', '--ticket', ticket, ...(cls ? ['--object-class', cls] : [])], { store: sb.store }));

  // member user vs guest — placeholder anchor, Microsoft's #EXT# marker, and assertion
  const member = seed('Add [UPN] to the Finance team in Teams');
  run(['verify', 'case-0001', '--evidence', 'verified membership read-back in lab tenant', '--identity-variants'], { store: member.store });
  assert.strictEqual(look(member, 'Add [USER@DOMAIN.COM] to the Finance team in Teams').result, 'CACHE_HIT');
  assert.strictEqual(look(member, 'Add [GUEST_UPN] to the Finance team in Teams').result, 'MISS', 'guest placeholder ≠ member');
  const ext = look(member, 'Add someone_partner.tld#EXT#@tenant.onmicrosoft.com to the Finance team in Teams');
  assert.strictEqual(ext.result, 'MISS'); assert.match(ext.note, /mismatch.*guest.*ext-marker/, 'the #EXT# marker classifies the literal as guest deterministically');
  const contradiction = look(member, 'Add someone_partner.tld#EXT#@tenant.onmicrosoft.com to the Finance team in Teams', 'member-user');
  assert.strictEqual(contradiction.result, 'MISS'); assert.match(contradiction.note, /contradicts/);
  assert.strictEqual(look(member, 'Add someone@example.org to the Finance team in Teams', 'guest').result, 'MISS');
  // member user vs shared mailbox / distribution group / M365 group / resource / service account — assertion mismatch
  for (const cls of ['shared-mailbox', 'distribution-group', 'm365-group', 'resource-mailbox', 'service-account']) {
    const r = look(member, 'Add someone@example.org to the Finance team in Teams', cls);
    assert.strictEqual(r.result, 'MISS', cls); assert.match(r.note, /object class mismatch/);
  }
  // unknown class (raw literal, no assertion) → MISS, and an invalid class name is refused
  assert.match(look(member, 'Add someone@example.org to the Finance team in Teams').note, /no deterministic object class/);
  assert.match(look(member, 'Add someone@example.org to the Finance team in Teams', 'contractor').note, /unknown --object-class/);
  // user mailbox vs shared mailbox — same wording, different class, MISS both ways
  const userMbx = seed('Set the retention tag on the mailbox of [UPN] to two years');
  run(['verify', 'case-0001', '--evidence', 'verified retention read-back in lab tenant', '--identity-variants'], { store: userMbx.store });
  assert.strictEqual(look(userMbx, 'Set the retention tag on the mailbox of reception@example.org to two years', 'shared-mailbox').result, 'MISS');
  assert.strictEqual(look(userMbx, 'Set the retention tag on the mailbox of reception@example.org to two years', 'member-user').result, 'CACHE_HIT');
  const shared = seed('Set the retention tag on the mailbox of reception@example.org to two years');
  assert.match(run(['verify', 'case-0001', '--evidence', 'verified retention read-back in lab tenant', '--identity-variants'], { store: shared.store, expectExit: 2 }), /no deterministic object class/, 'a raw-literal case cannot opt in without stating its class');
  run(['verify', 'case-0001', '--evidence', 'verified retention read-back in lab tenant', '--identity-variants', '--object-class', 'shared-mailbox'], { store: shared.store });
  assert.strictEqual(look(shared, 'Set the retention tag on the mailbox of [UPN] to two years').result, 'MISS', 'member placeholder ≠ shared-mailbox case');
  assert.strictEqual(look(shared, 'Set the retention tag on the mailbox of other@example.org to two years', 'shared-mailbox').result, 'CACHE_HIT');
  // a case verified against [EMAIL] (ambiguous token) cannot opt in without a class; verify refuses a contradiction too
  const amb = seed('Send the welcome pack to [EMAIL] today');
  assert.match(run(['verify', 'case-0001', '--evidence', 'verified send in lab tenant', '--identity-variants'], { store: amb.store, expectExit: 2 }), /no deterministic object class/);
  const guestCase = seed('Add [GUEST_UPN] to the Finance team in Teams');
  assert.match(run(['verify', 'case-0001', '--evidence', 'verified guest invite in lab tenant', '--identity-variants', '--object-class', 'member-user'], { store: guestCase.store, expectExit: 2 }), /contradicts/);
  // a member-user case and a guest case with the SAME wording coexist — the shape index is keyed per class — and route by class
  const both = seed('Add [UPN] to the Finance team in Teams');
  run(['verify', 'case-0001', '--evidence', 'verified membership read-back in lab tenant', '--identity-variants'], { store: both.store });
  fs.writeFileSync(path.join(both.work, 'g.md'), '# guest invitation work-up\n\nVerified: guest invite accepted at [@Aegion].\n');
  run(['record', '--ticket', 'Add [GUEST_UPN] to the Finance team in Teams', '--solution-file', path.join(both.work, 'g.md'), '--deps', path.join(both.work, 'd.md')], { store: both.store });
  const gv = j(run(['verify', 'case-0002', '--evidence', 'verified guest invite in lab tenant', '--identity-variants'], { store: both.store }));
  assert.strictEqual(gv.objectClass, 'guest');
  assert.strictEqual(look(both, 'Add [USER_UPN] to the Finance team in Teams').caseId, 'case-0001');
  assert.strictEqual(look(both, 'Add x_partner.tld#EXT#@t.onmicrosoft.com to the Finance team in Teams').caseId, 'case-0002');
  assert.strictEqual(look(both, 'Add x@example.org to the Finance team in Teams', 'guest').caseId, 'case-0002');
  assert.match(look(both, 'Add x@example.org to the Finance team in Teams').note, /member-user, guest/, 'unknown class names the classes that exist and still misses');
  // an assertion that contradicts the ticket's own anchor is refused on the EXACT path too (second review finding)
  const exactContra = look(member, 'Add [UPN] to the Finance team in Teams', 'guest');
  assert.strictEqual(exactContra.result, 'MISS'); assert.match(exactContra.note, /contradicts/);
  // an assertion on a multi-slot ticket is refused as such, not judged against the first slot
  const twoSlot = look(member, 'Give [UPN] delegate access to the [MANAGER_UPN] calendar', 'member-user');
  assert.strictEqual(twoSlot.result, 'MISS'); assert.match(twoSlot.note, /exactly one identity slot/);
  // aliases cannot bridge a risk floor or an object class (second review finding)
  assert.match(run(['alias', '--case', 'case-0001', '--ticket', 'Wipe [DEVICE_NAME] now'], { store: member.store, expectExit: 2 }), /floor differs/);
  assert.match(run(['alias', '--case', 'case-0001', '--ticket', 'Add [GUEST_UPN] to the finance team please'], { store: member.store, expectExit: 2 }), /object class differs/);
  run(['alias', '--case', 'case-0001', '--ticket', 'Add [UPN] to the finance team please'], { store: member.store });
  assert.strictEqual(look(member, 'add [UPN] to the finance team please').via, 'alias');
  // pure helpers agree with the CLI
  assert.deepStrictEqual(replay.slotClass('Add [UPN] to the team'), { objectClass: 'member-user', anchor: 'placeholder' });
  assert.deepStrictEqual(replay.slotClass('Add x_y.tld#EXT#@t.onmicrosoft.com to the team'), { objectClass: 'guest', anchor: 'ext-marker' });
  assert.deepStrictEqual(replay.slotClass('Add x@example.org to the team'), { objectClass: 'unknown', anchor: 'none' });
});

test('R16 the secret-key pattern needs a word boundary: a word ending in "sk-" is prose, an sk- key is still refused', () => {
  const replay = require(CLI);
  assert.deepStrictEqual(replay.sanitizationHits('Run the disk-cleanup-maintenance-window task on [DEVICE_NAME] after hours.'), []);
  assert.deepStrictEqual(replay.sanitizationHits('Schedule the task-scheduler-maintenance-window review with [UPN].'), []);
  const key = ['sk', 'abcdefghijklmnopqrstuvwxyz0123'].join('-');
  assert.ok(replay.sanitizationHits(`key ${key} pasted`).includes('API secret key'), 'a real-shaped key is still refused');
  assert.ok(replay.sanitizationHits(`(${key})`).includes('API secret key'), 'after punctuation too');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
