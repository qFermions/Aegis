'use strict';
// change-binding.test.js: each read-back is bound to its change when it is recorded (batch G3
// close-out, owner decision 1).
//
// EXPECTED DECISION (written before the code)
// - Every verify-* command of the nine connectors (Fleet, GitHub, Google Workspace, Jamf Pro,
//   Linear, Microsoft Graph, Okta, Slack, Jira) takes --change chg-... . Before any read, dry
//   or live, it checks the id's form and that the local audit trail holds the change record
//   change-record.js open wrote for that id, naming this connector and verify-* command as its
//   read-back, with an approval of its procedure recorded after it. Otherwise it refuses with
//   an input error (exit 1) and the transport is never called.
// - A bound read-back's verify entry carries the change id; change-record.js link accepts it
//   and status reports the change done.
// - A read-back run without --change still prints its verdict and records change null, but
//   link refuses it; link also refuses a read-back bound to another change.
// - --change on a plain read, or on the placeholder [CHANGE_ID] itself, is an input error.
// Run: node --test scripts/adapters/change-binding.test.js

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const audit = require('../audit/audit-log.js');
const changes = require('../audit/change-record.js');

const TOKEN = ['sentinel', 'binding', 'credential', String(7 * 919)].join('-');
const NOW = Date.parse('2026-10-28T12:00:00Z');
const NOT_BEFORE = '2026-10-28T09:00:00Z';
const at = (user, domain) => [user, domain].join('@');
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const ok = (body) => ({ status: 200, headers: {}, body });
const token = (extra = {}) => ok({ access_token: 'issued-access-value', expires_in: 1200, token_type: 'Bearer', ...extra });

// One passing live read-back per connector, another verify-* command of the same connector,
// and a plain read.
const CONNECTORS = [
  {
    name: 'fleet', file: './fleet-client.js', env: { FLEET_URL: 'fleet.example.invalid', FLEET_API_TOKEN: TOKEN },
    verify: ['verify-checked-in', '--id', '7', '--not-before', NOT_BEFORE], other: 'verify-lock', read: ['host', '--id', '7'],
    replies: () => [ok({ host: { id: 7, platform: 'darwin', status: 'online', seen_time: '2026-10-28T09:40:00Z', detail_updated_at: '2026-10-28T09:20:00Z', last_mdm_checked_in_at: '2026-10-28T09:30:00Z', mdm: { enrollment_status: 'On (automatic)', connected_to_fleet: true } } })],
  },
  {
    name: 'github', file: './github-client.js', env: { GITHUB_ORG: 'org-a', GITHUB_TOKEN: TOKEN },
    verify: ['verify-2fa-required'], other: 'verify-protection', read: ['org'],
    replies: () => [ok({ login: 'org-a', repos_url: 'https://api.github.com/orgs/org-a/repos', two_factor_requirement_enabled: true })],
  },
  {
    name: 'google-workspace', file: './gws-client.js',
    env: { GWS_SA_CLIENT_EMAIL: at('svc', 'project.iam.gserviceaccount.com'), GWS_SA_PRIVATE_KEY: PEM, GWS_ADMIN_SUBJECT: at('admin', 'example.com'), GWS_CUSTOMER_ID: 'C0test1' },
    verify: ['verify-suspended', '--user', at('person', 'example.com')], other: 'verify-ou', read: ['user', '--user', at('person', 'example.com')],
    replies: () => [token({ expires_in: 3599 }), ok({ kind: 'admin#directory#user', id: '100000000000000000001', primaryEmail: at('person', 'example.com'), customerId: 'C0test1', orgUnitPath: '/Staff', suspended: true, suspensionReason: 'ADMIN' })],
  },
  {
    name: 'jamf', file: './jamf-client.js', env: { JAMF_URL: 'jamf.example.invalid', JAMF_CLIENT_ID: 'client-id-value', JAMF_CLIENT_SECRET: TOKEN },
    verify: ['verify-checked-in', '--serial', 'C02TEST0001', '--not-before', NOT_BEFORE], other: 'verify-filevault', read: ['computer', '--serial', 'C02TEST0001'],
    replies: () => [token(), ok({ totalCount: 1, results: [{ id: '7', hardware: { serialNumber: 'C02TEST0001' } }] }), ok({ totalCount: 1, results: [{ id: '7', general: { lastContactTime: '2026-10-28T09:30:00.000Z' } }] })],
  },
  {
    name: 'linear', file: './linear-client.js', env: { LINEAR_API_KEY: TOKEN, LINEAR_ORG: 'org-under-test' },
    verify: ['verify-state', '--issue', 'IT-123', '--state', 'Done'], other: 'verify-trashed', read: ['issue', '--issue', 'IT-123'],
    replies: () => [ok({ data: { issue: { id: 'issue-1', identifier: 'IT-123', title: 'Printer offline', state: { name: 'Done', type: 'completed' }, labels: { nodes: [], pageInfo: { hasNextPage: false } }, team: { key: 'IT' } }, organization: { urlKey: 'org-under-test' } } })],
  },
  {
    name: 'msgraph', file: './msgraph-client.js',
    env: { MS_TENANT_ID: '11111111-2222-4333-8444-555555555555', MS_CLIENT_ID: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', MS_PRIVATE_KEY: PEM, MS_CERT_SHA256: crypto.createHash('sha256').update('fixture certificate').digest('base64url') },
    verify: ['verify-account-enabled', '--user', 'aaaaaaaa-0000-4000-8000-000000000001', '--enabled', 'false'], other: 'verify-mfa-cleared', read: ['user', '--user', 'aaaaaaaa-0000-4000-8000-000000000001'],
    replies: () => [token({ expires_in: 3599 }), ok({ id: 'aaaaaaaa-0000-4000-8000-000000000001', accountEnabled: false })],
  },
  {
    name: 'okta', file: './okta-client.js', env: { OKTA_ORG_URL: 'okta.example.invalid', OKTA_CLIENT_ID: 'client-id-value', OKTA_PRIVATE_KEY: PEM },
    verify: ['verify-status', '--user', '00u1abcd2EFGH3ijk4x7', '--status', 'SUSPENDED'], other: 'verify-factor-reset', read: ['user', '--user', '00u1abcd2EFGH3ijk4x7'],
    replies: () => [token({ scope: 'okta.users.read' }), ok({ id: '00u1abcd2EFGH3ijk4x7', status: 'SUSPENDED', profile: { login: at('user', 'example.com') }, _links: { self: { href: 'https://okta.example.invalid/api/v1/users/00u1abcd2EFGH3ijk4x7' } } })],
  },
  {
    name: 'slack', file: './slack-client.js', env: { SLACK_TOKEN: TOKEN, SLACK_TEAM_ID: 'T0OURS0001' },
    verify: ['verify-deactivated', '--user', 'U0USER0001'], other: 'verify-guest', read: ['user', '--user', 'U0USER0001'],
    replies: () => [ok({ ok: true, user: { id: 'U0USER0001', team_id: 'T0OURS0001', deleted: true } })],
  },
  {
    name: 'jira', file: '../jira-client.js', env: { JIRA_SITE: 'example-tenant.atlassian.net', JIRA_EMAIL: at('api', 'example.org'), JIRA_API_TOKEN: TOKEN },
    verify: ['verify-transition', '--issue', 'HELP-1', '--issue-id', '10001', '--from-version', '1000', '--to-status', 'Done'], other: 'verify-comment', read: ['get', '--issue', 'HELP-1'],
    replies: () => [ok({ issueKey: 'HELP-1', issueId: '10001', currentStatus: { status: 'Done', statusDate: { epochMillis: 2000 } } })],
  },
];

function queued(replies) {
  const calls = [];
  const transport = async (request) => {
    calls.push(request);
    const next = replies.length ? replies.shift() : { status: 500, body: '{}' };
    return { status: next.status, headers: next.headers || {}, body: typeof next.body === 'string' ? next.body : JSON.stringify(next.body) };
  };
  transport.calls = calls;
  return transport;
}

function trail(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-change-binding-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { AEGIS_AUDIT_DIR: path.join(dir, 'audit') };
  const procedure = path.join(dir, 'procedure.md');
  fs.writeFileSync(procedure, 'Phase B: the gated change for [UPN].\nType exactly: CHANGE [UPN]\n');
  const sink = audit.auditSink(env);
  const record = (argv) => {
    const out = [];
    const err = [];
    const code = changes.main(argv, env, { out: (s) => out.push(s), err: (s) => err.push(s) });
    let json = null;
    try { json = JSON.parse(out.join('')); } catch { /* not JSON */ }
    return { code, json, text: out.join('') + err.join('') };
  };
  // open (and by default approve) a change record whose read-back is readBack
  const open = (readBack, { approve = true } = {}) => {
    const o = record(['open', '--command', 'binding-test', '--gate', 'binding-test-gate', '--r-class', 'R2', '--target', '[UPN]', '--read-back', readBack, '--procedure-file', procedure]);
    assert.equal(o.code, 0, o.text);
    if (approve) assert.equal(record(['approve', '--change', o.json.change, '--ref', 'IT-123', '--procedure-sha256', o.json.procedure_sha256]).code, 0);
    return o.json.change;
  };
  return { dir, env, sink, record, open };
}

async function run(c, argv, tr, { execute = true } = {}) {
  const mod = require(c.file);
  const transport = queued(c.replies());
  const out = [];
  const err = [];
  const code = await mod.run(execute ? [...argv, '--execute'] : argv, c.env, {
    transport, audit: tr.sink, now: () => NOW, sleep: async () => {}, timeoutMs: 50,
    out: (s) => out.push(String(s)), err: (s) => err.push(String(s)),
  });
  return { code, calls: transport.calls.length, text: `${out.join('\n')}\n${err.join('\n')}` };
}

const verifies = (tr) => tr.sink.log.entries().filter((e) => e.kind === 'verify');

for (const c of CONNECTORS) {
  const readBack = `${c.name}:${c.verify[0]}`;

  test(`${c.name}: --change naming no change, an unapproved change, or a change for another read-back is refused before any transport call, dry or live`, async (t) => {
    const tr = trail(t);
    const otherConnector = c.name === 'slack' ? 'fleet:verify-checked-in' : 'slack:verify-deactivated';
    const cases = [
      ['no such change', 'chg-0123456789ab'],
      ['not approved', tr.open(readBack, { approve: false })],
      ['another verify-* command', tr.open(`${c.name}:${c.other}`)],
      ['another connector', tr.open(otherConnector)],
    ];
    for (const [label, change] of cases) {
      for (const execute of [true, false]) {
        const before = tr.sink.log.entries().length;
        const r = await run(c, [...c.verify, '--change', change], tr, { execute });
        assert.equal(r.code, 1, `${c.name} ${label} (${execute ? 'live' : 'dry'}): ${r.text}`);
        assert.equal(r.calls, 0, `${c.name} ${label}: no transport call`);
        assert.equal(tr.sink.log.entries().length, before, `${c.name} ${label}: nothing recorded`);
      }
    }
  });

  test(`${c.name}: a read-back bound with --change records the change id; link accepts it and status reports the change done`, async (t) => {
    const tr = trail(t);
    const change = tr.open(readBack);
    const dry = await run(c, [...c.verify, '--change', change], tr, { execute: false });
    assert.equal(dry.code, 4, `a bound dry run is still a dry run: ${dry.text}`);
    assert.equal(dry.calls, 0);
    const r = await run(c, [...c.verify, '--change', change], tr);
    assert.equal(r.code, 0, r.text);
    const v = verifies(tr);
    assert.equal(v.length, 1);
    assert.equal(v[0].change, change);
    assert.equal(v[0].verified, true);
    assert.equal(tr.record(['link', '--change', change, '--verify-seq', String(v[0].seq)]).code, 0);
    const st = tr.record(['status', '--change', change]);
    assert.equal(st.code, 0, st.text);
    assert.equal(st.json.done, true);
  });

  test(`${c.name}: an unbound read-back still works and records change null, but link refuses it; link refuses one bound to another change`, async (t) => {
    const tr = trail(t);
    const change = tr.open(readBack);
    const other = tr.open(readBack);
    const unbound = await run(c, c.verify, tr);
    assert.equal(unbound.code, 0, unbound.text);
    const [u] = verifies(tr);
    assert.equal(u.change, null);
    const l1 = tr.record(['link', '--change', change, '--verify-seq', String(u.seq)]);
    assert.equal(l1.code, 2, l1.text);
    assert.match(l1.text, /--change/);
    const bound = await run(c, [...c.verify, '--change', other], tr);
    assert.equal(bound.code, 0, bound.text);
    const b = verifies(tr)[1];
    assert.equal(b.change, other);
    const l2 = tr.record(['link', '--change', change, '--verify-seq', String(b.seq)]);
    assert.equal(l2.code, 2, l2.text);
    assert.match(l2.text, new RegExp(other));
    assert.equal(tr.sink.log.entries().filter((e) => e.kind === 'change-link').length, 0, 'nothing linked');
    assert.equal(tr.record(['status', '--change', change]).json.done, false);
  });

  test(`${c.name}: --change on a plain read, with the [CHANGE_ID] placeholder left in, or given twice is an input error before any transport call`, async (t) => {
    const tr = trail(t);
    const change = tr.open(readBack);
    for (const [label, argv] of [
      ['plain read', [...c.read, '--change', change]],
      ['placeholder', [...c.verify, '--change', '[CHANGE_ID]']],
      ['twice', [...c.verify, '--change', change, '--change', change]],
      ['no value', [...c.verify, '--change']],
    ]) {
      const r = await run(c, argv, tr);
      assert.equal(r.code, 1, `${c.name} ${label}: ${r.text}`);
      assert.equal(r.calls, 0, `${c.name} ${label}`);
    }
  });
}

test('a verify-* with --change and no audit trail to check it against is refused, never run unbound', async () => {
  const gh = require('./github-client.js');
  const transport = queued([]);
  const out = [];
  const code = await gh.run(['verify-2fa-required', '--change', 'chg-0123456789ab', '--execute'], { GITHUB_ORG: 'org-a', GITHUB_TOKEN: TOKEN }, { transport, out: (s) => out.push(s), err: (s) => out.push(s) });
  assert.equal(code, 1, out.join(''));
  assert.equal(transport.calls.length, 0);
  assert.match(out.join(''), /audit trail/);
});

// The runbooks: every read-back of a gate marked R2 or R3 passes --change [CHANGE_ID]; no other
// read-back does (open refuses an R0 or R1 change record, so such a read-back could never
// run); each runbook with one says where the id comes from; the dictionary registers it.
test('runbooks: every read-back of an R2 or R3 gate passes --change [CHANGE_ID], no other does, and [CHANGE_ID] is registered', () => {
  const dir = path.join(__dirname, '..', '..', '.claude', 'commands');
  const VERIFY = /node scripts\/(?:adapters\/)?[a-z]+-client\.js verify-[a-z0-9-]+/;
  let bound = 0;
  let unbound = 0;
  for (const file of fs.readdirSync(dir).filter((n) => n.endsWith('.md'))) {
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
    let gate = null;
    let rClass = null;
    let has = false;
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      if (/^## /.test(l)) { gate = null; rClass = null; }
      // a gate is a marker block in the page or a comment block inside a bash fence (code review
      // round 1, finding 1: the fenced form was missed, and one R2 read-back with it)
      if (/<!-- SAFETY GATE \[[^\]]+\] -->|^# SAFETY GATE \[[^\]]+\]/.test(l)) { gate = l; rClass = null; }
      const r = l.match(/(?:\*\*Reversibility:\*\*|^# Reversibility:)\s*(R[0-3])/);
      if (r && gate) rClass = r[1];
      if (!VERIFY.test(l)) continue;
      const wantBound = rClass === 'R2' || rClass === 'R3';
      assert.equal(/--change \[CHANGE_ID\] --execute/.test(l), wantBound, `${file}:${i + 1} (${rClass || 'no gate'}): ${l.trim().slice(0, 120)}`);
      if (wantBound) { bound += 1; has = true; } else unbound += 1;
    }
    const text = lines.join('\n');
    if (has) assert.match(text, /\*\*Change record \((?:R2 and R3|R2|R3) gates\):\*\* before a gate[^\n]*`node scripts\/audit\/change-record\.js open`[^\n]*`\[CHANGE_ID\]`/, `${file}: says where [CHANGE_ID] comes from`);
    else assert.doesNotMatch(text, /\[CHANGE_ID\]/, `${file}: no change record, no [CHANGE_ID]`);
  }
  assert.equal(bound, 72, 'the 72 read-backs of R2 and R3 gates at the batch G3 close-out');
  assert.ok(unbound >= 80, `read-backs of R0 and R1 work stay unbound (${unbound})`);
  const dictionary = fs.readFileSync(path.join(__dirname, '..', '..', 'modules', 'security', 'placeholder-dictionary.md'), 'utf8');
  assert.match(dictionary, /`\[CHANGE_ID\]` \(the change id that\s+`node scripts\/audit\/change-record\.js open` prints/);
  // two read-backs of R2 and R3 changes are named in prose, not on a command line: the rollback
  // gate's read-back after a branch-protection exception, and the per-host read-back of a
  // batch script run (code review round 1, finding 1)
  const page = (name) => fs.readFileSync(path.join(dir, `${name}.md`), 'utf8');
  assert.match(page('github-branch-protection'), /Then run the rollback gate it names, and its read-back: `verify-protection [^`]*--change \[CHANGE_ID\]`/);
  assert.match(page('fleet-device-actions'), /`verify-script` passed for the pilot and, run with `--change \[CHANGE_ID\]`, for every checked host/);
});

// Fixed beyond the task: link needs the verify entry's audit seq (--verify-seq), so a recorded
// read-back prints it: "audit_seq" in the JSON of the eight adapters, an "audit seq" line from
// Jira. Before this, the seq could be found only by reading the trail's file.
for (const c of CONNECTORS) {
  test(`${c.name}: a recorded read-back prints its audit seq, the number change-record.js link takes`, async (t) => {
    const tr = trail(t);
    const change = tr.open(`${c.name}:${c.verify[0]}`);
    for (const argv of [[...c.verify, '--change', change], c.verify]) {
      const r = await run(c, argv, tr);
      assert.equal(r.code, 0, r.text);
      const seq = verifies(tr).pop().seq;
      const printed = c.name === 'jira' ? r.text.match(/^Recorded as audit entry (\d+)/m) : r.text.match(/"audit_seq": (\d+)/);
      assert.ok(printed, `${c.name}: the audit seq is printed\n${r.text}`);
      assert.equal(Number(printed[1]), seq);
    }
  });
}
