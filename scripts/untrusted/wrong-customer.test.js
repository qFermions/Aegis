// wrong-customer.test.js: a case or a store that mixes two tenants.
//
// Contract: REVIEW.md "Project failure" (customer data from one tenant must
// never be reachable from another tenant's case), SR-1 and SR-8 in
// modules/security/security-doctrine.md, modules/security/placeholder-dictionary.md
// (the [@Aegion_*] namespace is this deployment's org; the tenant domain is
// env-var only, AEGION_DOMAIN).
//
// Model: one Aegis deployment serves one tenant. Its org tokens are the
// [@Aegion_*] family and its tenant identity at runtime is AEGION_DOMAIN.
// Every case in a deployment is that tenant's case, so an org-namespace token
// of any OTHER namespace ([@<Name>_<UPPER_SUFFIX>], for example a second
// org's [@Otherorg_DOMAIN]) inside a case means the case mixes two tenants.
//
// EXPECTED DECISION
// A case or a store that mixes two tenants fails closed: nothing is created,
// stored, retrieved or rendered, and no text belonging to the other tenant is
// printed. Concretely (sandbox stores and run dirs only; tenant domains are
// RFC example domains set through AEGION_DOMAIN in the child environment):
//
// 1. scripts/graph/graph-cli.js new with a ticket carrying [@Aegion_DOMAIN]
//    and [@Otherorg_DOMAIN], and with a ticket carrying only
//    [@Otherorg_DOMAIN].
//    MUST: exit 3 and create no run directory.
//    Control: a ticket with [@Aegion_*] tokens, [UPN], [GUEST_UPN] and a B2B
//    guest #EXT# literal at an example domain MUST still exit 0. A guest from
//    another directory is one customer's case, not a second customer.
//
// 2. graph-cli.js submit of a SPECIALIST artifact whose evidence pulls in
//    [@Otherorg_DOMAIN].
//    MUST: exit 3; node stays "SPECIALIST"; none of that evidence lands in
//    state.
//
// 3. scripts/memory/memory-cli.js propose with an [@Otherorg_*] token in
//    summary or detail.
//    MUST: exit 3 and write no record.
//
// 4. scripts/replay/replay-cli.js record with an [@Otherorg_*] token in the
//    ticket or in the solution.
//    MUST: exit 4 and create no case.
//
// 5. A memory store first written under AEGION_DOMAIN=<tenant A>.
//    MUST: under tenant A, retrieve returns the record. Under tenant B, and
//    with AEGION_DOMAIN unset, retrieve, show, list and propose exit 6 and
//    print none of tenant A's stored text. No file in the store contains the
//    tenant A literal (the binding is a fingerprint, SR-8).
//
// 6. A replay store first written under tenant A.
//    MUST: under tenant A, lookup is CACHE_HIT. Under tenant B, and with
//    AEGION_DOMAIN unset, lookup, render, list, status, explain and record
//    exit 6 and print none of the stored solution.
//
// 7. Backward compatibility. A store with no tenant binding (created before
//    this rule existed, or only ever written with AEGION_DOMAIN unset) holds
//    no evidence of whose it is.
//    MUST: it stays readable as before; its first write under a tenant binds
//    it to that tenant, after which rules 5 and 6 apply.

'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const GRAPH_CLI = path.join(ROOT, 'scripts', 'graph', 'graph-cli.js');
const MEM_CLI = path.join(ROOT, 'scripts', 'memory', 'memory-cli.js');
const REPLAY_CLI = path.join(ROOT, 'scripts', 'replay', 'replay-cli.js');

const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-untrusted-tenant-'));
const RUNS = path.join(WORK, 'runs');
test.after(() => fs.rmSync(WORK, { recursive: true, force: true }));

// Two tenants, RFC example domains only. Each child process gets exactly the
// tenant the case names: the operator's own AEGION_DOMAIN never leaks in.
const TENANT_A = 'tenant-a.example.com';
const TENANT_B = 'tenant-b.example.org';
function envFor(tenant, extra) {
  const env = { ...process.env, AEGION_ORG_NAME: 'canary-org-placeholder', ...(extra || {}) };
  delete env.AEGION_DOMAIN;
  if (tenant) env.AEGION_DOMAIN = tenant;
  return env;
}

function run(cli, args, env) {
  const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env, windowsHide: true });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* asserted by the caller */ }
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', json };
}
const short = (r) => `exit ${r.code}: ${(r.stdout + ' | ' + r.stderr).replace(/\s+/g, ' ').slice(0, 300)}`;
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');
const graph = (args) => run(GRAPH_CLI, args, envFor(TENANT_A, { AEGIS_GRAPH_RUNS_DIR: RUNS }));
const memAs = (tenant, dir) => (args) => run(MEM_CLI, args, envFor(tenant, { AEGIS_MEMORY_DIR: dir }));
const replayAs = (tenant, store) => (args) => run(REPLAY_CLI, args, envFor(tenant, { AEGIS_REPLAY_DIR: store }));

let seq = 0;
function freshDir(label) {
  const d = path.join(WORK, `${label}-${++seq}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function writeFile(name, content) {
  const p = path.join(WORK, `${++seq}-${name}`);
  fs.writeFileSync(p, content);
  return p;
}
const runDirs = () => (fs.existsSync(RUNS) ? fs.readdirSync(RUNS).sort() : []);
const listFiles = (dir) => fs.readdirSync(dir, { recursive: true }).map((f) => path.join(dir, f)).filter((f) => fs.statSync(f).isFile());
function assertNoLiteral(dir, literal) {
  for (const f of listFiles(dir)) {
    assert.ok(!fs.readFileSync(f, 'utf8').toLowerCase().includes(literal), `${path.basename(f)} must not contain the tenant literal (SR-8)`);
  }
}

const PROPOSAL = JSON.parse(fixture('tenant-proposal.json'));
const OTHER_PROPOSAL = {
  ...PROPOSAL,
  summary: 'Printer queue resets are scheduled after hours so the finance print run is never interrupted',
  detail: '',
  keywords: ['printer', 'queue', 'after-hours'],
};

// ── 1. graph intake ──────────────────────────────────────────────────────────

test('C1 graph intake: a ticket mixing two org namespaces, or naming only another org, is refused (exit 3) and creates no run', () => {
  for (const f of ['tenant-mixed-ticket.txt', 'tenant-foreign-ticket.txt']) {
    const before = runDirs();
    const r = graph(['new', '--ticket-file', path.join(FIXTURES, f)]);
    assert.equal(r.code, 3, `${f} must be refused: ${short(r)}`);
    assert.deepEqual(runDirs(), before, `${f}: no run directory may be created`);
  }
});

test('C1 control: a B2B guest ticket inside the deployment namespace ([GUEST_UPN], #EXT#) is one customer and is accepted', () => {
  const r = graph(['new', '--ticket-file', path.join(FIXTURES, 'tenant-b2b-guest-ticket.txt')]);
  assert.equal(r.code, 0, short(r));
});

// ── 2. graph submit ──────────────────────────────────────────────────────────

test('C2 graph submit: evidence that pulls in another org namespace is refused (exit 3); node and evidence are unchanged', () => {
  const r = graph(['new', '--ticket-file', path.join(FIXTURES, 'tenant-b2b-guest-ticket.txt')]);
  assert.equal(r.code, 0, short(r));
  const runId = r.json.runId;
  const arts = JSON.parse(fixture('tenant-artifacts.json'));
  let s = graph(['submit', runId, '--node', 'ROUTER', '--file', writeFile('router.json', JSON.stringify(arts.ROUTER))]);
  assert.equal(s.code, 0, short(s));
  s = graph(['submit', runId, '--node', 'SPECIALIST', '--file', writeFile('specialist.json', JSON.stringify(arts.SPECIALIST_FOREIGN))]);
  assert.equal(s.code, 3, `foreign evidence must be refused: ${short(s)}`);
  const st = graph(['status', runId]).json.state;
  assert.equal(st.node, 'SPECIALIST', 'state does not advance');
  assert.deepEqual(st.evidence, [], 'no evidence from the refused artifact lands in state');
  assert.ok(!JSON.stringify(st).includes('[@Otherorg_'), 'the other tenant\'s token appears nowhere in state');
});

// ── 3. memory propose ────────────────────────────────────────────────────────

test('C3 memory propose carrying another org namespace token is refused (exit 3) and writes no record', () => {
  const dir = freshDir('c3');
  for (const patch of [
    { detail: 'Copied from the [@Otherorg_DOMAIN] runbook: the review cycle there is monthly.' },
    { summary: 'The [@Otherorg_DOMAIN] tenant keeps its guest access review on a monthly cycle' },
  ]) {
    const r = memAs(TENANT_A, dir)(['propose', '--file', writeFile('proposal.json', JSON.stringify({ ...PROPOSAL, ...patch }))]);
    assert.equal(r.code, 3, short(r));
  }
  assert.equal(fs.readdirSync(dir).filter((f) => /^mem-\d{4}\.json$/.test(f)).length, 0, 'no record may persist');
});

// ── 4. replay record ─────────────────────────────────────────────────────────

test('C4 replay record carrying another org namespace token in the ticket or the solution is refused (exit 4) and creates no case', () => {
  const store = path.join(freshDir('c4'), 'store');
  const A = replayAs(TENANT_A, store);
  const dep = writeFile('authority.md', 'authority doctrine v1 for guest access\n');
  const clean = writeFile('solution.md', fixture('tenant-solution.md'));
  const foreign = writeFile('solution-foreign.md', fixture('tenant-solution.md') + '\nSame fix as in the [@Otherorg_DOMAIN] tenant.\n');

  let r = A(['record', '--ticket', 'Guest [GUEST_UPN] from [@Otherorg_DOMAIN] cannot open the finance site.', '--solution-file', clean, '--deps', dep]);
  assert.equal(r.code, 4, `foreign token in the ticket: ${short(r)}`);
  r = A(['record', '--ticket', 'Guest [GUEST_UPN] cannot open the finance site shared by [UPN].', '--solution-file', foreign, '--deps', dep]);
  assert.equal(r.code, 4, `foreign token in the solution: ${short(r)}`);
  const cases = fs.existsSync(store) ? fs.readdirSync(store).filter((f) => /^case-\d{4}\.json$/.test(f)) : [];
  assert.deepEqual(cases, [], 'no case may be created');
});

// ── 5. memory store bound to tenant A ────────────────────────────────────────

test('C5 a memory store written under tenant A refuses tenant B and an unset tenant (exit 6) and never prints tenant A text', () => {
  const dir = freshDir('c5');
  const A = memAs(TENANT_A, dir);
  const query = 'guest access review for the finance site';
  let r = A(['propose', '--file', writeFile('proposal.json', JSON.stringify(PROPOSAL))]);
  assert.equal(r.code, 0, short(r));
  const id = r.json.id;
  assert.equal(A(['promote', id]).code, 0);
  r = A(['retrieve', '--query', query]);
  assert.equal(r.json.count, 1, `tenant A reads its own store: ${short(r)}`);

  const otherFile = writeFile('other.json', JSON.stringify(OTHER_PROPOSAL));
  for (const tenant of [TENANT_B, null]) {
    const who = memAs(tenant, dir);
    for (const args of [['retrieve', '--query', query], ['show', id], ['list'], ['propose', '--file', otherFile]]) {
      r = who(args);
      assert.equal(r.code, 6, `${tenant || 'unset tenant'} ${args[0]} must be refused: ${short(r)}`);
      assert.ok(!(r.stdout + r.stderr).includes('TENANT-A-ONLY'), 'tenant A text is never printed to another tenant');
    }
  }
  assert.equal(fs.readdirSync(dir).filter((f) => /^mem-\d{4}\.json$/.test(f)).length, 1, 'the refused propose wrote nothing');
  assertNoLiteral(dir, TENANT_A);
  assert.equal(A(['retrieve', '--query', query]).json.count, 1, 'tenant A still reads its store');
});

// ── 6. replay store bound to tenant A ────────────────────────────────────────

test('C6 a replay store written under tenant A refuses tenant B and an unset tenant (exit 6) and never prints the solution', () => {
  const store = path.join(freshDir('c6'), 'store');
  const A = replayAs(TENANT_A, store);
  const ticket = 'Guest [GUEST_UPN] cannot open the finance site shared by [UPN].';
  const solution = writeFile('solution.md', fixture('tenant-solution.md'));
  const dep = writeFile('authority.md', 'authority doctrine v1 for guest access\n');
  let r = A(['record', '--ticket', ticket, '--solution-file', solution, '--deps', dep]);
  assert.equal(r.code, 0, short(r));
  r = A(['verify', 'case-0001', '--evidence', 'synthetic fixture: guest membership read back on the site']);
  assert.equal(r.code, 0, short(r));
  assert.equal(A(['lookup', '--ticket', ticket]).json.result, 'CACHE_HIT');

  const second = writeFile('solution-2.md', '# Another verified work-up\n\n1. Confirm the printer queue for [DEVICE_NAME].\n');
  for (const tenant of [TENANT_B, null]) {
    const who = replayAs(tenant, store);
    for (const args of [
      ['lookup', '--ticket', ticket],
      ['render', 'case-0001'],
      ['list'],
      ['status', 'case-0001'],
      ['explain', '--ticket', ticket],
      ['record', '--ticket', 'Printer queue for [DEVICE_NAME] is stuck.', '--solution-file', second, '--deps', dep],
    ]) {
      r = who(args);
      assert.equal(r.code, 6, `${tenant || 'unset tenant'} ${args[0]} must be refused: ${short(r)}`);
      assert.ok(!(r.stdout + r.stderr).includes('TENANT-A-SOLUTION-SENTINEL'), 'the stored solution is never printed to another tenant');
    }
  }
  assert.equal(fs.readdirSync(store).filter((f) => /^case-\d{4}\.json$/.test(f)).length, 1, 'the refused record wrote nothing');
  assertNoLiteral(store, TENANT_A);
  assert.equal(A(['lookup', '--ticket', ticket]).json.result, 'CACHE_HIT', 'tenant A still hits');
  assert.ok(A(['render', 'case-0001']).stdout.includes('TENANT-A-SOLUTION-SENTINEL'));
});

// ── 7. unbound (legacy) stores ───────────────────────────────────────────────

test('C7 a store with no tenant binding stays readable; its first write under a tenant binds it (memory and replay)', () => {
  // memory
  const dir = freshDir('c7-mem');
  const U = memAs(null, dir);
  const query = 'guest access review for the finance site';
  let r = U(['propose', '--file', writeFile('proposal.json', JSON.stringify(PROPOSAL))]);
  assert.equal(r.code, 0, short(r));
  assert.equal(U(['promote', r.json.id]).code, 0);
  for (const tenant of [TENANT_A, TENANT_B]) {
    r = memAs(tenant, dir)(['retrieve', '--query', query]);
    assert.equal(r.code, 0, `an unbound store stays readable (${tenant}): ${short(r)}`);
    assert.equal(r.json.count, 1);
  }
  r = memAs(TENANT_A, dir)(['propose', '--file', writeFile('other.json', JSON.stringify(OTHER_PROPOSAL))]);
  assert.equal(r.code, 0, `first write under tenant A: ${short(r)}`);
  assert.equal(memAs(TENANT_B, dir)(['retrieve', '--query', query]).code, 6, 'now bound: tenant B is refused');
  assert.equal(memAs(TENANT_A, dir)(['retrieve', '--query', query]).json.count, 1, 'tenant A still reads');

  // replay
  const store = path.join(freshDir('c7-replay'), 'store');
  const ticket = 'Guest [GUEST_UPN] cannot open the finance site shared by [UPN].';
  const dep = writeFile('authority.md', 'authority doctrine v1 for guest access\n');
  r = replayAs(null, store)(['record', '--ticket', ticket, '--solution-file', writeFile('solution.md', fixture('tenant-solution.md')), '--deps', dep]);
  assert.equal(r.code, 0, short(r));
  assert.equal(replayAs(null, store)(['verify', 'case-0001', '--evidence', 'synthetic fixture: guest membership read back on the site']).code, 0);
  for (const tenant of [TENANT_A, TENANT_B]) {
    assert.equal(replayAs(tenant, store)(['lookup', '--ticket', ticket]).json.result, 'CACHE_HIT', `an unbound store stays readable (${tenant})`);
  }
  r = replayAs(TENANT_A, store)(['record', '--ticket', 'Printer queue for [DEVICE_NAME] is stuck.', '--solution-file', writeFile('solution-2.md', '# Printer\n\n1. Restart the queue for [DEVICE_NAME].\n'), '--deps', dep]);
  assert.equal(r.code, 0, `first write under tenant A: ${short(r)}`);
  assert.equal(replayAs(TENANT_B, store)(['lookup', '--ticket', ticket]).code, 6, 'now bound: tenant B is refused');
  assert.equal(replayAs(TENANT_A, store)(['lookup', '--ticket', ticket]).json.result, 'CACHE_HIT', 'tenant A still hits');
});
