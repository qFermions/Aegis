'use strict';
// failure-messages.test.js: every connector CLI prints the two-part failure message for
// every failure state it can reach (batch G3, task 6a), records its calls and verify-*
// results in the audit trail when given a sink (task 3b), and the CLI default wiring turns
// the audit sink on whenever no test transport is injected.
//
// EXPECTED DECISION (written before the wiring)
// - For Fleet, Jamf Pro, Slack, Linear, Google Workspace and Jira, each failure state
//   (refused input, missing credentials, HTTP error, timeout, network error, an answer that
//   is not JSON, a record from another tenant where the connector binds one, and a failing
//   audit sink) prints operator_message (what happened, what was not done, the next step)
//   and admin_detail (platform, operation, state, status, attempts, request id, handoff).
//   Never a stack trace, the raw body or a credential.
// - A verify-* verdict is recorded as one verify entry; a sink that fails withholds it.
// - cliDeps: no injected transport means the real audit sink; an injected one means none.
// Run: node --test scripts/adapters/failure-messages.test.js

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const { cliDeps } = require('./cli-support.js');

const TOKEN = ['sentinel', 'failure', 'credential', String(7 * 991)].join('-');
const RAW = 'RAW-BODY-SENTINEL-4471';
const at = (user, domain) => [user, domain].join('@');

const never = () => new Promise(() => {});
const ok = (body, headers = {}) => ({ status: 200, headers, body: JSON.stringify(body) });

function queued(replies) {
  const calls = [];
  const transport = async (request) => {
    calls.push(request);
    const next = replies.length ? replies.shift() : { status: 500, body: '{}' };
    if (typeof next === 'function') return next(request);
    if (next instanceof Error) throw next;
    return { status: next.status, headers: next.headers || {}, body: typeof next.body === 'string' ? next.body : JSON.stringify(next.body || {}) };
  };
  transport.calls = calls;
  return transport;
}

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });

const CONNECTORS = [
  {
    name: 'fleet', mod: require('./fleet-client.js'),
    env: { FLEET_URL: 'fleet.example.invalid', FLEET_API_TOKEN: TOKEN }, creds: ['FLEET_API_TOKEN'],
    argv: ['version', '--execute'], pre: [], body: { version: '4.60.0' },
    verify: { argv: ['verify-lock', '--id', '7', '--execute'], body: { host: { id: 7, mdm: { device_status: 'unlocked', pending_action: '' } } } },
  },
  {
    name: 'jamf', mod: require('./jamf-client.js'),
    env: { JAMF_URL: 'jamf.example.invalid', JAMF_CLIENT_ID: 'client-id-value', JAMF_CLIENT_SECRET: TOKEN }, creds: ['JAMF_CLIENT_ID', 'JAMF_CLIENT_SECRET'],
    argv: ['version', '--execute'], pre: [ok({ access_token: 'issued-access', expires_in: 1200 })], body: { version: '11.10.0' },
  },
  {
    name: 'slack', mod: require('./slack-client.js'),
    env: { SLACK_TOKEN: TOKEN, SLACK_TEAM_ID: 'T0OURS0001' }, creds: ['SLACK_TOKEN'],
    argv: ['team', '--execute'], pre: [], body: { ok: true, team: { id: 'T0OURS0001', name: 'workspace' } },
    tenantBody: { ok: true, team: { id: 'T0OTHER001', name: 'other' } },
    verify: { argv: ['verify-deactivated', '--user', 'U0USER0001', '--execute'], body: { ok: true, user: { id: 'U0USER0001', team_id: 'T0OURS0001', deleted: false } } },
  },
  {
    name: 'linear', mod: require('./linear-client.js'),
    env: { LINEAR_API_KEY: TOKEN, LINEAR_ORG: 'org-under-test' }, creds: ['LINEAR_API_KEY'],
    argv: ['viewer', '--execute'], pre: [],
    body: { data: { viewer: { id: 'u1', admin: false, guest: false, owner: false, organization: { urlKey: 'org-under-test' } }, organization: { urlKey: 'org-under-test' } } },
    tenantBody: { data: { viewer: { id: 'u1', admin: false, guest: false, owner: false, organization: { urlKey: 'other-org' } }, organization: { urlKey: 'other-org' } } },
  },
  {
    name: 'gws', mod: require('./gws-client.js'),
    env: { GWS_SA_CLIENT_EMAIL: at('svc', 'project.iam.gserviceaccount.com'), GWS_SA_PRIVATE_KEY: PEM, GWS_ADMIN_SUBJECT: at('admin', 'example.com'), GWS_CUSTOMER_ID: 'C0test1' },
    creds: ['GWS_SA_CLIENT_EMAIL', 'GWS_SA_PRIVATE_KEY', 'GWS_ADMIN_SUBJECT'],
    argv: ['users', '--execute'], pre: [ok({ access_token: 'issued-access', expires_in: 3599, token_type: 'Bearer' })],
    body: { users: [{ customerId: 'C0test1', id: '1' }] }, tenantBody: { users: [{ customerId: 'C0other', id: '2' }] },
  },
];

async function cli(c, argv, { env = c.env, replies = [], audit, timeoutMs = 20 } = {}) {
  const transport = queued(replies);
  const out = [];
  const err = [];
  const code = await c.mod.run(argv, env, {
    transport, audit, timeoutMs, sleep: async () => {}, now: () => Date.parse('2026-10-28T12:00:00Z'),
    out: (s) => out.push(String(s)), err: (s) => err.push(String(s)),
  });
  return { code, text: out.join('') + err.join(''), transport };
}

function assertTwoParts(text, platform, state, label) {
  assert.match(text, /"operator_message": "[^"]+\. [^"]+\. [^"]+"/, `${label}: operator message in three parts`);
  const admin = text.match(/"admin_detail": "([^"]+)"/);
  assert.ok(admin, `${label}: admin detail line`);
  assert.match(admin[1], new RegExp(`^platform=${platform} operation=\\S+ state=${state} status=\\S+ attempts=\\S+ request_id=\\S+ handoff=\\S+$`), `${label}: ${admin[1]}`);
  assert.doesNotMatch(text, /\n\s+at\s+\S+\s+\(/, `${label}: no stack trace`);
  assert.ok(!text.includes(TOKEN), `${label}: no credential`);
  assert.ok(!text.includes(RAW), `${label}: no raw body`);
}

for (const c of CONNECTORS) {
  test(`${c.name}: every failure state prints the two-part message, with no stack trace, raw body or credential`, async () => {
    const cases = [
      ['REFUSED', { argv: [c.argv[0], '--not-a-flag', 'x', '--execute'] }],
      ['NO_CREDENTIALS', { env: Object.fromEntries(Object.entries(c.env).filter(([k]) => !c.creds.includes(k))) }],
      ['HTTP_ERROR', { replies: [...c.pre, { status: 403, body: JSON.stringify({ error: RAW }) }] }],
      ['TIMEOUT', { replies: [...c.pre, never, never, never] }],
      ['NETWORK_ERROR', { replies: [...c.pre, new Error(RAW), new Error(RAW), new Error(RAW)] }],
      ['INVALID_RESPONSE', { replies: [...c.pre, { status: 200, body: `not json ${RAW}` }] }],
      ['AUDIT_FAILED', { replies: [...c.pre, ok(c.body)], audit: () => { throw new Error(RAW); } }],
    ];
    if (c.tenantBody) cases.push(['TENANT_MISMATCH', { replies: [...c.pre, ok(c.tenantBody)] }]);
    for (const [state, o] of cases) {
      const r = await cli(c, o.argv || c.argv, { env: o.env, replies: o.replies ? [...o.replies] : [], audit: o.audit });
      assert.notEqual(r.code, 0, `${c.name} ${state}: a failure exits non-zero`);
      assertTwoParts(r.text, c.name, state, `${c.name} ${state}`);
    }
  });

  test(`${c.name}: with an audit sink each request is one connector-call entry, and a success prints no failure message`, async () => {
    const entries = [];
    const r = await cli(c, c.argv, { replies: [...c.pre, ok(c.body)], audit: (e) => entries.push(e) });
    assert.equal(r.code, 0, r.text);
    assert.doesNotMatch(r.text, /operator_message|admin_detail/);
    const reads = entries.filter((e) => e.kind === 'connector-call' && e.operation !== 'token-exchange');
    assert.equal(reads.length, 1, JSON.stringify(entries));
    assert.equal(reads[0].connector, c.name);
    assert.equal(reads[0].state, 'OK');
    assert.ok(!JSON.stringify(entries).includes(TOKEN));
  });

  if (c.verify) {
    test(`${c.name}: a verify-* verdict is recorded as one verify entry; a sink that fails withholds the verdict`, async () => {
      const entries = [];
      const r = await cli(c, c.verify.argv, { replies: [...c.pre, ok(c.verify.body)], audit: (e) => entries.push(e) });
      assert.equal(r.code, 2, r.text);
      assertTwoParts(r.text, c.name, 'OK', `${c.name} not verified`);
      const verdicts = entries.filter((e) => e.kind === 'verify');
      assert.deepEqual(verdicts.map((e) => [e.connector, e.command, e.verified]), [[c.name, c.verify.argv[0], false]]);
      let calls = 0;
      const failing = await cli(c, c.verify.argv, { replies: [...c.pre, ok(c.verify.body)], audit: (e) => { calls += 1; if (e.kind === 'verify') throw new Error(RAW); } });
      assert.equal(failing.code, 2);
      assert.ok(calls >= 2);
      assertTwoParts(failing.text, c.name, 'AUDIT_FAILED', `${c.name} verdict not recorded`);
    });
  }
}

test('jira: every failure prints the two-part message on stderr, with no stack trace, raw body or credential', async () => {
  const jira = require('../jira-client.js');
  const env = { JIRA_SITE: 'example-tenant.atlassian.net', JIRA_EMAIL: at('api', 'example.org'), JIRA_API_TOKEN: TOKEN };
  const cases = [
    ['REFUSED', ['get', '--issue', 'not a key', '--execute'], [], env],
    ['NO_CREDENTIALS', ['get', '--issue', 'HELP-1', '--execute'], [], { JIRA_SITE: env.JIRA_SITE }],
    ['HTTP_ERROR', ['get', '--issue', 'HELP-1', '--execute'], [{ status: 403, body: JSON.stringify({ errorMessage: RAW }) }], env],
    ['TIMEOUT', ['get', '--issue', 'HELP-1', '--execute'], [never, never, never], env],
    ['NETWORK_ERROR', ['get', '--issue', 'HELP-1', '--execute'], [new Error(RAW), new Error(RAW), new Error(RAW)], env],
    ['INVALID_RESPONSE', ['get', '--issue', 'HELP-1', '--execute'], [{ status: 200, body: `not json ${RAW}` }], env],
    ['AUDIT_FAILED', ['get', '--issue', 'HELP-1', '--execute'], [ok({ issueKey: 'HELP-1', issueId: '1', currentStatus: { status: 'Open', statusDate: { epochMillis: 1 } } })], env, () => { throw new Error(RAW); }],
  ];
  for (const [state, argv, replies, e, audit] of cases) {
    const out = [];
    const err = [];
    const code = await jira.run(argv, e, { transport: queued([...replies]), audit, timeoutMs: 20, sleep: async () => {}, out: (s) => out.push(String(s)), err: (s) => err.push(String(s)) });
    const stderr = err.join('\n');
    const text = out.join('\n') + stderr;
    assert.notEqual(code, 0, state);
    assert.match(stderr, /^Aegis: [^\n]+\. [^\n]+\. [^\n]+$/m, `${state}: operator line: ${stderr}`);
    assert.match(stderr, new RegExp(`^admin detail: platform=jira operation=\\S+ state=${state} status=\\S+ attempts=\\S+ request_id=\\S+ handoff=\\S+$`, 'm'), `${state}: ${stderr}`);
    assert.doesNotMatch(text, /\n\s+at\s+\S+\s+\(/, `${state}: no stack trace`);
    assert.ok(!text.includes(TOKEN) && !text.includes(RAW), `${state}: no credential or raw body`);
  }
});

test('cliDeps: no injected transport means the real audit sink; an injected transport means none unless the test passes one', () => {
  const prod = cliDeps({}, { AEGIS_AUDIT_DIR: process.env.AEGIS_AUDIT_DIR });
  assert.equal(typeof prod.audit, 'function', 'a person running the CLI always gets the audit sink');
  const testing = cliDeps({ transport: async () => ({}) }, {});
  assert.equal(testing.audit, null);
  const explicit = () => {};
  assert.equal(cliDeps({ transport: async () => ({}), audit: explicit }, {}).audit, explicit);
});
