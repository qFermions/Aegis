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
const { testRunbooks } = require('../audit/trail-helper.js');

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
  const gateFor = testRunbooks(dir);
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
    // a test gate that binds this read-back (trail-helper.js testRunbooks)
    const g = gateFor(readBack);
    const o = record(['open', '--command', g.command, '--gate', g.gate, '--r-class', 'R2', '--target', '[UPN]', '--read-back', readBack, '--procedure-file', procedure]);
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
  // the read-back with the flags that change what its pass means (batch G3 close-out 3, H1)
  const readBack = audit.readBackFor(`${c.name}:${c.verify[0]}`, c.verify);

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
    // a read-back in its own section names the gate it proves in the comment above it
    // ("read-back of [mfa-require-reregister-portal]"), and takes that gate's class (batch G3
    // close-out 2, owner decision 1: the /mfa-issue read-backs sit under "## Read-back")
    const classOf = new Map();
    let id = null;
    for (const l of lines) {
      const g = l.match(/<!-- SAFETY GATE \[([^\]]+)\] -->|^# SAFETY GATE \[([^\]]+)\]/);
      if (g) id = g[1] || g[2];
      const rv = l.match(/(?:\*\*Reversibility:\*\*|^# Reversibility:)(.*)$/);
      if (rv && id) classOf.set(id, (rv[1].split(/\bseparate\b/)[0].match(/\bR[0-3]\b/g) || []).sort().pop() || null);
    }
    let gate = null;
    let rClass = null;
    let has = false;
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      if (/^## /.test(l)) { gate = null; rClass = null; }
      // a gate is a marker block in the page or a comment block inside a bash fence (code review
      // round 1, finding 1: the fenced form was missed, and one R2 read-back with it)
      if (/<!-- SAFETY GATE \[[^\]]+\] -->|^# SAFETY GATE \[[^\]]+\]/.test(l)) { gate = l; rClass = null; }
      // a gate whose class depends on scope ("R1 to R3", "R2 or R3", "R1 for one file (R2 for 2
      // to 10 files", "R1 when ...; R2 when ...") counts as its highest class, since the change
      // may be R2 or R3 (code review round 2, finding 1; round 3, finding 5); a class written
      // after "separate" names another gate ("the separate R3 Phase F gate") and does not count
      const r = l.match(/(?:\*\*Reversibility:\*\*|^# Reversibility:)(.*)$/);
      if (r && gate) rClass = (r[1].split(/\bseparate\b/)[0].match(/\bR[0-3]\b/g) || []).sort().pop() || null;
      if (!VERIFY.test(l)) continue;
      // a comment may name several gates ("read-back of [a], [b] or [c]"): the highest class of
      // them counts (code review round 1 of the batch G3 close-out 3, finding 1)
      const namedFor = (lines[i - 1] || '').match(/^# [^\n]*\bread-back of (\[[a-z0-9-]+\](?:(?:,? or |,? and |, )\[[a-z0-9-]+\])*)/);
      const namedClasses = namedFor ? [...namedFor[1].matchAll(/\[([a-z0-9-]+)\]/g)].map((x) => classOf.get(x[1])).filter(Boolean) : [];
      const cls = namedClasses.length ? namedClasses.sort().pop() : rClass;
      // a read that checks another object than the change's proof (a pilot Mac that keeps a
      // profile the change removes elsewhere) runs unbound and says so: under the change it would
      // be refused, since the change names one read-back with its flags (batch G3 close-out 3, H1)
      const notProof = /not this change's proof/.test(lines[i - 1] || '');
      const wantBound = (cls === 'R2' || cls === 'R3') && !notProof;
      assert.equal(/--change \[CHANGE_ID\] --execute/.test(l), wantBound, `${file}:${i + 1} (${cls || 'no gate'}): ${l.trim().slice(0, 120)}`);
      if (wantBound) { bound += 1; has = true; } else unbound += 1;
    }
    const text = lines.join('\n');
    // a read-back named in prose is the whole command line, with --execute: a fragment without
    // it is a dry run, which exits 4 and records no verdict to link (code review round 3, finding 4)
    for (const [, span] of text.matchAll(/`((?:verify-|node scripts)[^`]*--change \[CHANGE_ID\][^`]*)`/g)) {
      assert.match(span, /^node scripts\/(?:adapters\/)?[a-z]+-client\.js verify-[a-z0-9-]+ [^`]*--change \[CHANGE_ID\] --execute$/, `${file}: ${span}`);
    }
    if (has) assert.match(text, /\*\*Change record \((?:R2 and R3|R2|R3) gates\):\*\* before a gate[^\n]*`node scripts\/audit\/change-record\.js open`[^\n]*`\[CHANGE_ID\]`/, `${file}: says where [CHANGE_ID] comes from`);
    else assert.doesNotMatch(text, /\[CHANGE_ID\]/, `${file}: no change record, no [CHANGE_ID]`);
  }
  // 78 at the batch G3 close-out (the two prose read-backs written as whole command lines count
  // too, round 3, finding 4); 79 with /mfa-issue's verify-mfa-cleared, the read-back of its R3
  // Require re-register MFA gate (batch G3 close-out 2, owner decision 1)
  // batch G3 close-out 3, H1: the pilot read under /jamf-config-profiles' removal from all
  // computers runs unbound (79 to 78, 76 to 77), and /okta-group-membership's rule change binds a
  // read-back for the people who join beside the one for those who leave (78 to 79)
  // owner decision H3: /mfa-issue binds verify-sessions-revoked and verify-method-absent (79 to 81)
  // owner decision H4: the newly classed gates of /offboard (4), /password-reset (2, one of them
  // the verify-password-changed line that was unbound) and /security-alert-triage (3) bind their
  // read-backs (81 to 90 bound, 77 to 76 unbound)
  assert.equal(bound, 90, 'the 90 read-backs of R2 and R3 gates');
  assert.equal(unbound, 76, 'the 76 read-backs of R0 and R1 work, of no gate, or not a change\'s proof stay unbound');
  const dictionary = fs.readFileSync(path.join(__dirname, '..', '..', 'modules', 'security', 'placeholder-dictionary.md'), 'utf8');
  assert.match(dictionary, /`\[CHANGE_ID\]` \(the change id that\s+`node scripts\/audit\/change-record\.js open` prints/);
  // two read-backs of R2 and R3 changes are named in prose, not on a command line: the rollback
  // gate's read-back after a branch-protection exception, and the per-host read-back of a
  // batch script run (code review round 1, finding 1)
  const page = (name) => fs.readFileSync(path.join(dir, `${name}.md`), 'utf8');
  assert.match(page('github-branch-protection'), /Then run the rollback gate it names, and its read-back: `node scripts\/adapters\/github-client\.js verify-protection [^`]*--change \[CHANGE_ID\] --execute`/);
  // the batch script run (R3): its read-back step and its checkpoint (code review round 2, finding 5)
  assert.match(page('fleet-device-actions'), /\*\*Read-back:\*\* [^\n]*`node scripts\/adapters\/fleet-client\.js verify-script --execution-id \[EXECUTION_ID\] --change \[CHANGE_ID\] --execute`/);
  // the pilot (E1) and the batch (E2) are two changes with two ids, and status proves one host,
  // not the batch (code review round 3, finding 3)
  assert.match(page('fleet-device-actions'), /`verify-script` passed for the pilot \(with `--change \[CHANGE_ID\]` set to the E1 change's id, unless step 1 set R1\) and, with `--change \[CHANGE_ID\]` set to this gate's own change id, for every checked host/);
  // the read-back names the change opened before the gate (code review round 2 of the batch G3
  // close-out 2, finding 13: the moved text had left a broken sentence)
  assert.match(page('fleet-device-actions'), /with `\[CHANGE_ID\]` the id of this gate's own change record, opened before the gate \(above\), not the pilot's\. Any host/);
  assert.doesNotMatch(page('fleet-device-actions'), /not the pilot's\. \(opened/);
  // the batch is a counted change (batch G3 close-out 2, owner decision 2): opened with
  // --expected [HOST_COUNT], done only when every checked host's read-back passed
  assert.match(page('fleet-device-actions'), /\*\*Counted change:\*\* before the gate, open this gate's own change record for \[fleet-device-actions-batch-script-portal\], not the pilot's, with `--expected \[HOST_COUNT\]`, the host count in the ticket, then record its approval\./);
  // a gate whose class is set at run time says when to drop --change: the portal gate by its
  // step 1, the fenced fleetctl gate by the class its own precondition writes in the ticket, in
  // a comment the gated-fence rules allow (code review round 3, finding 8)
  assert.equal((page('fleet-device-actions').match(/drop `--change \[CHANGE_ID\]` when step 1 set R1/g) || []).length, 1);
  // the two gates that are R1 or R2 by scope say when to drop --change (code review round 3, finding 5)
  assert.match(page('gws-drive-sharing'), /drop `--change \[CHANGE_ID\]` for one file: an R1 removal has no change record/);
  assert.match(page('github-repo-access'), /drop `--change \[CHANGE_ID\]` when the Phase A role was read, triage or write: an R1 change has no change record/);
  assert.match(page('fleet-device-actions'), /^# read-back: passes only when that execution reports exit code 0, and drop the --change flag and its id when the ticket gives this script R1, since an R1 run has no change record\nnode scripts\/adapters\/fleet-client\.js verify-script --execution-id \[EXECUTION_ID\] --change \[CHANGE_ID\] --execute$/m);
});

// Fixed beyond the task: link needs the verify entry's audit seq (--verify-seq), so a recorded
// read-back prints it: "audit_seq" in the JSON of the eight adapters, an "audit seq" line from
// Jira. Before this, the seq could be found only by reading the trail's file. Code review round
// 1, finding 5: it is printed only for a read-back link can accept, one bound with --change
// that verified; an unbound one prints no seq to link.
const printedSeq = (c, text) => (c.name === 'jira' ? text.match(/^Recorded as audit entry (\d+)/m) : text.match(/"audit_seq": (\d+)/));
for (const c of CONNECTORS) {
  test(`${c.name}: a bound read-back that verified prints its audit seq, the number change-record.js link takes; an unbound one prints none`, async (t) => {
    const tr = trail(t);
    const change = tr.open(audit.readBackFor(`${c.name}:${c.verify[0]}`, c.verify));
    const bound = await run(c, [...c.verify, '--change', change], tr);
    assert.equal(bound.code, 0, bound.text);
    const printed = printedSeq(c, bound.text);
    assert.ok(printed, `${c.name}: the audit seq is printed\n${bound.text}`);
    assert.equal(Number(printed[1]), verifies(tr).pop().seq);
    assert.equal(tr.record(['link', '--change', change, '--verify-seq', printed[1]]).code, 0, 'the printed seq links');
    const unbound = await run(c, c.verify, tr);
    assert.equal(unbound.code, 0, unbound.text);
    assert.equal(printedSeq(c, unbound.text), null, `${c.name}: no seq for a read-back link refuses\n${unbound.text}`);
  });
}

// Batch G3 close-out 2, owner decision 2: a read-back that takes a job id records it as its
// verify entry's run, so a counted batch change counts each run once. Fleet's verify-script is
// the one (--execution-id); every other read-back records run null, so no user, email, device
// name or serial is ever recorded as a run.
test('fleet verify-script records its execution id as the run; every other read-back records none', async (t) => {
  const tr = trail(t);
  const support = require('./cli-support.js');
  assert.deepEqual(support.RUN_ID_FLAGS, { 'fleet:verify-script': 'execution-id' });
  const fleet = CONNECTORS.find((c) => c.name === 'fleet');
  const change = tr.open('fleet:verify-script');
  const id = 'e797d6c6-3aae-11ee-be56-0242ac120002';
  const script = (body) => ({ ...fleet, replies: () => [ok(body)] });
  const r = await run(script({ execution_id: id, host_id: 7, exit_code: 0, host_timeout: false, output: 'done', message: '' }), ['verify-script', '--execution-id', id, '--change', change], tr);
  assert.equal(r.code, 0, r.text);
  const e = verifies(tr).pop();
  assert.equal(e.run, id);
  assert.equal(e.change, change);
  // security review 1 of the batch G3 close-out 2: the run is recorded only when it is a UUID
  // and Fleet answered for exactly that id, so a serial or host name typed as an execution id,
  // a failed read and an answer for another id all record run null
  // code review round 3, finding 5: Fleet's execution ids are UUIDs (vendor-facts.md F-12), so a
  // serial or host name typed as one is refused before any read; verify-script can no longer
  // pass on an id the trail does not take as a run (it passed with run null before)
  const before = verifies(tr).length;
  const serial = await run(script({ execution_id: 'C02XK1ABJG5H', host_id: 7, exit_code: 0, host_timeout: false }), ['verify-script', '--execution-id', 'C02XK1ABJG5H', '--change', change], tr);
  assert.equal(serial.code, 1, serial.text);
  assert.equal(verifies(tr).length, before, 'a serial is never read, so nothing is recorded');
  // code review round 3, finding 2: a UUID is one id in either case, so an id typed in upper case
  // that Fleet answers in lower case verifies, and the run is recorded in lower case
  const upper = await run(script({ execution_id: id, host_id: 7, exit_code: 0, host_timeout: false }), ['verify-script', '--execution-id', id.toUpperCase(), '--change', change], tr);
  assert.equal(upper.code, 0, upper.text);
  assert.equal(verifies(tr).pop().run, id);
  const failed = await run({ ...fleet, replies: () => [{ status: 404, body: '{}' }] }, ['verify-script', '--execution-id', id, '--change', change], tr);
  assert.equal(failed.code, 2, failed.text);
  assert.equal(verifies(tr).pop().run, null, 'a failed read records no run');
  const other = await run(script({ execution_id: 'd6cffa75-b5b5-41ef-9230-15073c8a88cf', host_id: 7, exit_code: 0, host_timeout: false }), ['verify-script', '--execution-id', id, '--change', change], tr);
  assert.equal(other.code, 2, other.text);
  assert.equal(verifies(tr).pop().run, null, 'an answer for another id records no run');
  // code review round 2, finding 6: an answer that names no execution id does not verify, so the
  // command and the change record agree
  const noId = await run(script({ host_id: 7, exit_code: 0, host_timeout: false }), ['verify-script', '--execution-id', id, '--change', change], tr);
  assert.equal(noId.code, 2, noId.text);
  assert.equal(verifies(tr).pop().verified, false);
  // code review round 3, finding 6: Fleet documents execution_id in the script result's answer
  const facts = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'aegis', 'g3', 'vendor-facts.md'), 'utf8');
  const f12 = facts.split('\n').find((l) => l.startsWith('- F-12.'));
  assert.ok(f12 && f12.includes('/api/v1/fleet/scripts/results/:execution_id') && f12.includes('"execution_id": "e797d6c6-3aae-11ee-be56-0242ac120002"'), String(f12));
  assert.match(fs.readFileSync(path.join(__dirname, 'fleet-client.js'), 'utf8'), /vendor-facts\.md F-12/);
  for (const c of CONNECTORS) {
    const other = await run(c, c.verify, tr);
    assert.equal(other.code, 0, `${c.name}: ${other.text}`);
    assert.equal(verifies(tr).pop().run, null, `${c.name}: no run id recorded`);
  }
});

// Code review round 1, finding 6: --change=chg-... is refused with a message that says the id
// goes in its own argument, not as an unknown flag.
for (const c of CONNECTORS) {
  test(`${c.name}: --change=chg-... is refused before any transport call with a message that names the two-argument form`, async (t) => {
    const tr = trail(t);
    const change = tr.open(audit.readBackFor(`${c.name}:${c.verify[0]}`, c.verify));
    const r = await run(c, [...c.verify, `--change=${change}`], tr);
    assert.equal(r.code, 1, r.text);
    assert.equal(r.calls, 0);
    assert.match(r.text, /--change takes the change id as the next argument/);
  });
}

// Code review round 1, finding 9: one rule for a verify-* command name. cli-support.js checks
// with the trail's own forms (audit-log.js), and the contract's isVerifyCommand (which may not
// load the trail's file module) must agree with them.
// node --test also runs files named test-*.js, *-test.js, *_test.js, test.js or under a test/
// folder: a support module with such a name runs as one empty passing test and lifts the count
// (the trail helper did, as test-trail.js). Only *.test.js files hold tests here.
test('no support file under scripts/ has a name node --test runs as a test file', () => {
  const root = path.join(__dirname, '..');
  const picked = fs.readdirSync(root, { recursive: true }).map((p) => String(p).split(path.sep).join('/'))
    .filter((p) => /(^|\/)(test-[^/]*|[^/]*-test|[^/]*_test|test)\.(js|mjs|cjs)$|(^|\/)test\/.*\.(js|mjs|cjs)$/.test(p));
  assert.deepEqual(picked, []);
});

test('the contract, cli-support and the audit trail agree on what a verify-* command and a change id are', () => {
  const contract = require('./readonly-contract.js');
  const support = require('./cli-support.js');
  for (const name of ['verify-lock', 'verify-2fa-required', 'verify-', 'verify-Lock', 'verifylock', 'host', `verify-${'a'.repeat(48)}`, `verify-${'a'.repeat(49)}`, 'verify-a_b']) {
    assert.equal(contract.isVerifyCommand(name), audit.VERIFY_COMMAND.test(name), name);
  }
  // code review round 1 of the batch G3 close-out 2, finding 11: one table of read-backs that
  // record a run id, and one run-id form, both the trail's
  assert.equal(support.RUN_ID_FLAGS, audit.RUN_IDS);
  for (const id of ['e797d6c6-3aae-11ee-be56-0242ac120002', 'E797D6C6-3AAE-11EE-BE56-0242AC120002', 'C02XK1ABJG5H', 'exec-0001']) {
    assert.equal(support.runIdOf('fleet', 'verify-script', { 'execution-id': id }, id) !== null, audit.RUN_ID.test(id), id);
  }
  for (const id of ['chg-0123456789ab', 'chg-0123456789AB', 'chg-0123456789a', '[CHANGE_ID]']) {
    const refusal = support.changeRefusal('github', 'verify-2fa-required', { change: id }, null);
    assert.equal(/must be the change id/.test(refusal), !audit.CHANGE_ID.test(id), id);
  }
});

// Code review round 1, finding 10: an offline command (Slack digest, Linear note) refuses
// --change with the fixed "not a read-back" message, before it reads any file.
test('offline commands refuse --change as not a read-back, before reading any file', async () => {
  const { NOT_A_READ_BACK } = require('./cli-support.js');
  for (const [file, argv] of [['./slack-client.js', ['digest', '--file', 'no-such-file.txt']], ['./linear-client.js', ['note', '--issue', 'IT-1', '--body-file', 'no-such-file.md']]]) {
    const out = [];
    const code = await require(file).run([...argv, '--change', 'chg-0123456789ab'], {}, { transport: async () => { throw new Error('no network'); }, out: (s) => out.push(String(s)), err: (s) => out.push(String(s)) });
    assert.equal(code, 1, out.join(''));
    assert.ok(out.join('').includes(NOT_A_READ_BACK), out.join(''));
  }
});

// Code review round 1, finding 12: the --change wiring is three calls in each CLI, so a static
// guard fails any connector with a verify-* command that leaves one out (a new one included).
test('every connector with a verify-* command takes --change out of argv, checks it, and records its verdict under it', () => {
  const files = fs.readdirSync(__dirname).filter((n) => n.endsWith('-client.js')).map((n) => path.join(__dirname, n));
  files.push(path.join(__dirname, '..', 'jira-client.js'));
  let checked = 0;
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    if (!/^\s+'verify-[a-z0-9-]+':/m.test(src)) continue;
    checked += 1;
    const name = path.basename(file);
    assert.match(src, /const bound = takeChange\(argv\);/, `${name}: takes --change out of argv`);
    // the whole takeChange result, never bound.change (code review round 3, finding 2)
    assert.match(src, /changeRefusal\([^,()]+, [^,()]+, bound, /, `${name}: checks --change before any read, given takeChange's result`);
    assert.doesNotMatch(src, /changeRefusal\([^)]*bound\.change/, `${name}: never passes bound.change to changeRefusal`);
    if (name === 'jira-client.js') {
      assert.match(src, /runtime\.change = bound\.change;/, `${name}: records the verdict under the change`);
      assert.match(src, /runtime\.argv = bound\.argv;/, `${name}: records the flags that change what its pass means`);
    }
    else {
      // each call's arguments, with parentheses nested up to two levels
      const calls = [...src.matchAll(/recordVerdict\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/g)].map((m) => m[1]);
      assert.ok(calls.length >= 1, `${name}: records its verdicts`);
      // bound.change is the fourth argument, then the run id (a job id, or null: batch G3 close-out
      // 2, owner decision 2), then bound.argv, from which the flags that change what the pass
      // means are recorded (batch G3 close-out 3, owner decision H1)
      for (const call of calls) assert.match(call, /,\s*bound\.change\s*,\s*(?:null|runIdOf\('[a-z-]+', name, args(?:, [^()]+)?\))\s*,\s*bound\.argv\s*$/, `${name}: recordVerdict(${call.slice(0, 60)}) passes bound.change, the run id and bound.argv`);
    }
  }
  assert.equal(checked, 9, 'the nine connectors with read-backs');
});

// Code review round 2, finding 7: on a plain read, --change in either form is refused as not a
// read-back, never with advice to retry in the two-argument form.
for (const c of CONNECTORS) {
  test(`${c.name}: --change=chg-... on a plain read is refused as not a read-back`, async (t) => {
    const tr = trail(t);
    const r = await run(c, [...c.read, '--change=chg-0123456789ab'], tr);
    assert.equal(r.code, 1, r.text);
    assert.equal(r.calls, 0);
    assert.match(r.text, /this command is not a read-back/);
    assert.doesNotMatch(r.text, /next argument/);
  });
}

// Code review round 2, finding 8: a bound read-back that did not verify prints no seq either,
// since link refuses it.
test('a bound read-back that did not verify prints no audit seq (adapters through recordVerdict, and Jira)', async (t) => {
  const tr = trail(t);
  const change = tr.open('fleet:verify-lock');
  const { recordVerdict } = require('./cli-support.js');
  const failed = recordVerdict(tr.sink, 'fleet', { command: 'verify-lock', state: 'OK', verified: false }, change);
  assert.equal(failed.audit_seq, undefined);
  const passed = recordVerdict(tr.sink, 'fleet', { command: 'verify-lock', state: 'OK', verified: true }, change);
  assert.ok(Number.isInteger(passed.audit_seq), 'the control: a verified bound read-back prints it');
  const jira = CONNECTORS.find((c) => c.name === 'jira');
  const jchange = tr.open('jira:verify-transition');
  const mod = require(jira.file);
  const out = [];
  const code = await mod.run([...jira.verify.slice(0, -1), 'Resolved', '--change', jchange, '--execute'], jira.env, {
    transport: queued(jira.replies()), audit: tr.sink, timeoutMs: 50, sleep: async () => {}, out: (s) => out.push(String(s)), err: (s) => out.push(String(s)),
  });
  assert.equal(code, 2, out.join('\n'));
  assert.doesNotMatch(out.join('\n'), /Recorded as audit entry/);
  assert.equal(verifies(tr).pop().verified, false);
});

// Code review round 3, finding 2: changeRefusal fails closed when it is not given takeChange's
// result (a change id string, nothing), instead of reading that as "no --change".
test('changeRefusal refuses when it is not given takeChange\'s result', () => {
  const { changeRefusal } = require('./cli-support.js');
  for (const wrong of ['chg-0123456789ab', undefined, null, 42]) {
    assert.match(String(changeRefusal('fleet', 'verify-lock', wrong, null)), /takeChange/, String(wrong));
  }
  assert.equal(changeRefusal('fleet', 'verify-lock', { change: undefined }, null), null, 'no --change: nothing to check');
});

// ── Batch G3 close-out 3, owner decision H1: a presence pass never proves a removal ───────────
// Each read-back whose pass a flag changes records the flags it ran with; one with none records
// none.
test('every connector records the flags that change what its read-back passes on, and none on a read-back without them', async (t) => {
  const tr = trail(t);
  for (const c of CONNECTORS) {
    const kind = `${c.name}:${c.verify[0]}`;
    const change = tr.open(audit.readBackFor(kind, c.verify));
    const r = await run(c, [...c.verify, '--change', change], tr);
    assert.equal(r.code, 0, `${c.name}: ${r.text}`);
    const e = verifies(tr).pop();
    assert.equal(e.flags, audit.passFlags(kind, c.verify), `${c.name}: flags`);
  }
  assert.equal(verifies(tr).find((e) => e.connector === 'msgraph').flags, '--enabled false');
  assert.equal(verifies(tr).find((e) => e.connector === 'okta').flags, '--status SUSPENDED');
  assert.equal(verifies(tr).find((e) => e.connector === 'fleet').flags, null);
});

// Per command with --absent: under a removal change a read without --absent is refused before any
// transport call; one with it is recorded with its flag, links and reads done; under an add change
// a read with --absent is refused before any transport call.
const conn = (name) => CONNECTORS.find((c) => c.name === name);
const ABSENT = [
  { name: 'okta', command: 'verify-group-member', argv: ['--group', '00g1abcd2EFGH3ijk4x7', '--user', '00u1abcd2EFGH3ijk4x7'],
    replies: () => [token({ scope: 'okta.users.read okta.groups.read' }), ok({ id: '00u1abcd2EFGH3ijk4x7', status: 'ACTIVE', profile: { login: at('user', 'example.com') }, _links: { self: { href: 'https://okta.example.invalid/api/v1/users/00u1abcd2EFGH3ijk4x7' } } }), ok([{ id: '00u0000000000000other', status: 'ACTIVE', profile: { login: at('other', 'example.com') } }])] },
  { name: 'okta', command: 'verify-app-assigned', argv: ['--app', '0oa1abcd2EFGH3ijk4x7', '--user', '00u1abcd2EFGH3ijk4x7'],
    replies: () => [token({ scope: 'okta.users.read okta.apps.read' }), ok({ id: '00u1abcd2EFGH3ijk4x7', status: 'ACTIVE', profile: { login: at('user', 'example.com') }, _links: { self: { href: 'https://okta.example.invalid/api/v1/users/00u1abcd2EFGH3ijk4x7' } } }), { status: 404, body: { errorCode: 'E0000007' } }] },
  { name: 'github', command: 'verify-team-member', argv: ['--team', 'docs', '--user', 'a2'],
    replies: () => [ok([{ login: 'a1', id: 1002, type: 'User', site_admin: false }])] },
  { name: 'msgraph', command: 'verify-group-member', argv: ['--group', 'bbbbbbbb-0000-4000-8000-000000000002', '--user', 'aaaaaaaa-0000-4000-8000-000000000001'],
    replies: () => [token({ expires_in: 3599 }), ok({ value: [{ id: 'aaaaaaaa-0000-4000-8000-000000000009' }] })] },
  { name: 'jamf', command: 'verify-profile', argv: ['--serial', 'C02TEST0001', '--profile-id', '9', '--profile-identifier', 'com.example.profile.9'],
    replies: () => [token(), ok({ totalCount: 1, results: [{ id: '42', hardware: { serialNumber: 'C02TEST0001' } }] }), ok({ totalCount: 1, results: [{ id: '42', configurationProfiles: [{ id: '7', displayName: 'Wi-Fi', profileIdentifier: 'com.example.profile.7' }] }] })] },
];
for (const a of ABSENT) {
  test(`${a.name} ${a.command}: a removal change takes only the --absent read, and an add change never does`, async (t) => {
    const tr = trail(t);
    const c = { ...conn(a.name), replies: a.replies };
    const kind = `${a.name}:${a.command}`;
    const removal = tr.open(`${kind} --absent`);
    const presence = await run(c, [a.command, ...a.argv, '--change', removal], tr);
    assert.equal(presence.code, 1, presence.text);
    assert.equal(presence.calls, 0, 'refused before any transport call');
    assert.match(presence.text, new RegExp(`${kind} --absent`));
    const absent = await run(c, [a.command, ...a.argv, '--absent', '--change', removal], tr);
    assert.equal(absent.code, 0, absent.text);
    const e = verifies(tr).pop();
    assert.equal(e.flags, '--absent');
    assert.equal(tr.record(['link', '--change', removal, '--verify-seq', String(e.seq)]).code, 0);
    assert.equal(tr.record(['status', '--change', removal]).json.done, true);
    const add = tr.open(kind);
    const wrong = await run(c, [a.command, ...a.argv, '--absent', '--change', add], tr);
    assert.equal(wrong.code, 1, wrong.text);
    assert.equal(wrong.calls, 0);
    assert.equal(tr.record(['status', '--change', add]).json.done, false);
  });
}
