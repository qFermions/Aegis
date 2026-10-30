'use strict';
// rate-limit.test.js: GitHub rate-limit 403s stop reading as permission refusals (batch G3
// close-out, owner decision 3).
//
// EXPECTED DECISION (written before the code)
// - The shared contract has an opt-in rate-limit hook (spec.rateLimit); only GitHub turns it
//   on. GitHub's REST rate-limit page (vendor fact G-40, G-41): a primary-limit answer is 403
//   or 429 with x-ratelimit-remaining 0, retried only after x-ratelimit-reset (UTC epoch
//   seconds); a secondary-limit answer is 403 or 429 with a message saying so, retried after
//   retry-after seconds when present, else after the reset when remaining is 0, else after at
//   least one minute.
// - Primary limit: when one second after the reset is within the contract's 30-second cap and
//   the read's retry budget, the read waits that long and retries; otherwise it ends at once in
//   the named handoff state RATE_LIMITED, which gives the reset time in UTC (retry_at). A reset
//   that is malformed or already past is never waited on: RATE_LIMITED, no retry.
// - Secondary limit: retry-after within the cap is waited out; no retry-after (the docs' "at
//   least one minute" is over the cap) or a longer one ends in RATE_LIMITED.
// - A 403 with neither signal stays a permission refusal: HTTP_ERROR 403, one attempt.
// - The operator message for every rate-limit handoff says in plain words that this is a rate
//   limit, not a permission problem, and that the token should not be widened.
// - The body is read inside the contract only to find the secondary-limit message; it is never
//   printed, returned or written to the audit trail. The audit entry names RATE_LIMITED.
// - The other eight connectors do not opt in: a 403 carrying both signals is still a
//   permission refusal with one attempt.
// Run: node --test scripts/adapters/rate-limit.test.js

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const contract = require('./readonly-contract.js');
const audit = require('../audit/audit-log.js');

const { STATES } = contract;
const RAW = 'RAW-BODY-SENTINEL-6127';
const TOKEN = ['sentinel', 'rate', 'credential', String(7 * 887)].join('-');
const NOW = Date.parse('2026-10-30T12:00:00Z');
const NOW_S = NOW / 1000;
const ORG = 'org-a';
const ENV = Object.freeze({ GITHUB_ORG: ORG, GITHUB_TOKEN: TOKEN });
const ORG_BODY = { login: ORG, repos_url: `https://api.github.com/orgs/${ORG}/repos` };
const at = (user, domain) => [user, domain].join('@');

function queued(replies) {
  const calls = [];
  const transport = async (request) => {
    calls.push(request);
    const next = replies.length ? replies.shift() : { status: 500, body: '{}' };
    if (next instanceof Error) throw next;
    return { status: next.status, headers: next.headers || {}, body: typeof next.body === 'string' ? next.body : JSON.stringify(next.body === undefined ? {} : next.body) };
  };
  transport.calls = calls;
  return transport;
}
const ok = (body, headers = {}) => ({ status: 200, headers, body });
const primary = (status, reset, extra = {}) => ({ status, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset), 'x-ratelimit-limit': '5000', ...extra }, body: { message: `API rate limit exceeded ${RAW}` } });
const secondary = (status, headers = {}) => ({ status, headers: { 'x-ratelimit-remaining': '4900', ...headers }, body: { message: `You have exceeded a secondary rate limit. ${RAW}` } });
const forbidden = () => ({ status: 403, headers: { 'x-ratelimit-remaining': '4900' }, body: { message: `Resource not accessible by integration ${RAW}` } });

async function github(argv, replies, { now = () => NOW } = {}) {
  const gh = require('./github-client.js');
  const transport = queued(replies);
  const out = [];
  const err = [];
  const sleeps = [];
  const entries = [];
  const code = await gh.run(argv, ENV, {
    transport, now, sleep: async (ms) => { sleeps.push(ms); }, audit: (e) => entries.push(e),
    out: (s) => out.push(String(s)), err: (s) => err.push(String(s)),
  });
  const text = out.join('') + err.join('');
  const i = text.indexOf('{');
  return { code, text, json: i === -1 ? null : JSON.parse(text.slice(i, text.indexOf('\n}\n') + 2)), sleeps, calls: transport.calls, entries };
}

function assertRateLimitMessage(r, label) {
  assert.equal(r.json.handoff.state, 'RATE_LIMITED', `${label}: ${r.text}`);
  assert.match(r.json.operator_message, /rate limit, not a permission problem/i, label);
  assert.match(r.json.operator_message, /do not widen the token/i, label);
  assert.doesNotMatch(r.json.operator_message, /lacks a read permission/, label);
  assert.match(r.json.admin_detail, /handoff=RATE_LIMITED$/, label);
}

function assertNoBody(r, label) {
  assert.ok(!r.text.includes(RAW), `${label}: the response body is never printed`);
  assert.ok(!JSON.stringify(r.entries).includes(RAW), `${label}: the response body never reaches the audit trail`);
  assert.ok(!r.text.includes(TOKEN), `${label}: no credential`);
}

// ── GitHub: primary limit ────────────────────────────────────────────────────
test('github: a primary-limit 403 whose reset is within the cap waits until one second after the reset, retries once and succeeds', async () => {
  const r = await github(['org', '--execute'], [primary(403, NOW_S + 10), ok(ORG_BODY)]);
  assert.equal(r.code, 0, r.text);
  assert.deepEqual(r.sleeps, [11000], 'waited until one second after x-ratelimit-reset');
  assert.equal(r.calls.length, 2);
  assert.equal(r.json.attempts, 2);
  assertNoBody(r, 'within cap');
});

test('github: a primary-limit 403 whose reset is beyond the cap hands off at once with the reset time in UTC: one attempt, no wait, no retry storm', async () => {
  const reset = NOW_S + 1800;
  const r = await github(['org', '--execute'], [primary(403, reset), ok(ORG_BODY), ok(ORG_BODY)]);
  assert.equal(r.code, 2, r.text);
  assert.equal(r.calls.length, 1, 'one request, then the handoff');
  assert.deepEqual(r.sleeps, []);
  assert.equal(r.json.state, STATES.HTTP_ERROR);
  assert.equal(r.json.status, 403);
  assertRateLimitMessage(r, 'beyond cap');
  assert.equal(r.json.handoff.limit, 'primary');
  assert.equal(r.json.handoff.retry_at, '2026-10-30T12:30:00.000Z');
  assert.match(r.json.operator_message, /2026-10-30T12:30:00\.000Z/);
  const calls = r.entries.filter((e) => e.kind === 'connector-call');
  assert.deepEqual(calls.map((e) => [e.state, e.status, e.attempts, e.handoff]), [['HTTP_ERROR', 403, 1, 'RATE_LIMITED']]);
  assertNoBody(r, 'beyond cap');
});

test('github: a primary-limit 429 is handled the same way (within the cap: wait and retry; beyond it: RATE_LIMITED)', async () => {
  const within = await github(['org', '--execute'], [primary(429, NOW_S + 5), ok(ORG_BODY)]);
  assert.equal(within.code, 0, within.text);
  assert.deepEqual(within.sleeps, [6000]);
  const beyond = await github(['org', '--execute'], [primary(429, NOW_S + 3600)]);
  assert.equal(beyond.code, 2);
  assert.equal(beyond.calls.length, 1);
  assertRateLimitMessage(beyond, '429 beyond cap');
  assert.equal(beyond.json.status, 429);
});

test('github: a reset within the cap that does not fit the read\'s retry budget hands off instead of waiting', async () => {
  const gh = require('./github-client.js');
  const transport = queued([primary(403, NOW_S + 20), ok(ORG_BODY)]);
  const out = [];
  const sleeps = [];
  const code = await gh.run(['org', '--execute'], ENV, { transport, now: () => NOW, sleep: async (ms) => { sleeps.push(ms); }, retryBudgetMs: 25000, out: (s) => out.push(s), err: (s) => out.push(s) });
  assert.equal(code, 2);
  assert.equal(transport.calls.length, 1);
  assert.deepEqual(sleeps, []);
  assert.match(out.join(''), /"state": "RATE_LIMITED"/);
});

test('github: a reset that is malformed, missing or already past is never waited on: RATE_LIMITED after one attempt, no retry', async () => {
  for (const [label, reset] of [['malformed', 'soon'], ['negative', '-5'], ['past', String(NOW_S - 120)], ['now', String(NOW_S - 1)]]) {
    const r = await github(['org', '--execute'], [primary(403, reset), ok(ORG_BODY)]);
    assert.equal(r.code, 2, `${label}: ${r.text}`);
    assert.equal(r.calls.length, 1, `${label}: no retry`);
    assert.deepEqual(r.sleeps, [], label);
    assertRateLimitMessage(r, label);
    assert.equal(r.json.handoff.retry_at, null, `${label}: no usable reset time`);
    assertNoBody(r, label);
  }
  const missing = await github(['org', '--execute'], [{ status: 403, headers: { 'x-ratelimit-remaining': '0' }, body: { message: RAW } }]);
  assert.equal(missing.calls.length, 1);
  assertRateLimitMessage(missing, 'no reset header');
});

test('github: when every wait was within the cap and the limit still holds after the last retry, the read ends in RATE_LIMITED, not a permission refusal', async () => {
  const r = await github(['org', '--execute'], [primary(403, NOW_S + 2), primary(403, NOW_S + 2), primary(403, NOW_S + 2), ok(ORG_BODY)]);
  assert.equal(r.code, 2, r.text);
  assert.equal(r.calls.length, 3, 'the first try and two retries');
  assert.deepEqual(r.sleeps, [3000, 3000]);
  assertRateLimitMessage(r, 'still limited');
});

// ── GitHub: secondary limit ──────────────────────────────────────────────────
test('github: a secondary-limit 403 with retry-after within the cap waits that many seconds and retries', async () => {
  const r = await github(['org', '--execute'], [secondary(403, { 'retry-after': '7' }), ok(ORG_BODY)]);
  assert.equal(r.code, 0, r.text);
  assert.deepEqual(r.sleeps, [7000]);
  assert.equal(r.calls.length, 2);
  assertNoBody(r, 'secondary within cap');
});

test('github: a secondary-limit 403 without retry-after (the docs\' "at least one minute" is over the cap) or with a longer one hands off at once', async () => {
  const none = await github(['org', '--execute'], [secondary(403), ok(ORG_BODY)]);
  assert.equal(none.code, 2, none.text);
  assert.equal(none.calls.length, 1);
  assert.deepEqual(none.sleeps, []);
  assertRateLimitMessage(none, 'secondary, no retry-after');
  assert.equal(none.json.handoff.limit, 'secondary');
  assert.equal(none.json.handoff.retry_at, '2026-10-30T12:01:00.000Z', 'at least one minute');
  assertNoBody(none, 'secondary, no retry-after');
  const long = await github(['org', '--execute'], [secondary(429, { 'retry-after': '120' })]);
  assert.equal(long.calls.length, 1);
  assertRateLimitMessage(long, 'secondary, long retry-after');
  assert.equal(long.json.handoff.retry_at, '2026-10-30T12:02:00.000Z');
  const withReset = await github(['org', '--execute'], [secondary(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(NOW_S + 4) }), ok(ORG_BODY)]);
  assert.equal(withReset.code, 0, 'secondary with remaining 0: wait until the reset');
  assert.deepEqual(withReset.sleeps, [5000]);
});

// Code review round 1, finding 3: a usable retry-after is never thrown away, and a secondary
// limit with no usable time falls back to the vendor's "at least one minute".
test('github: a primary limit whose reset is missing or past but which carries retry-after within the cap waits retry-after and retries', async () => {
  for (const reset of [undefined, String(NOW_S - 30)]) {
    const headers = { 'x-ratelimit-remaining': '0', 'retry-after': '5', ...(reset === undefined ? {} : { 'x-ratelimit-reset': reset }) };
    const r = await github(['org', '--execute'], [{ status: 429, headers, body: { message: RAW } }, ok(ORG_BODY)]);
    assert.equal(r.code, 0, `${reset}: ${r.text}`);
    assert.deepEqual(r.sleeps, [5000]);
    assert.equal(r.calls.length, 2);
  }
});

test('github: a secondary limit with remaining 0 but a missing or past reset falls back to at least one minute, not to the clock message', async () => {
  for (const reset of [undefined, String(NOW_S - 30)]) {
    const headers = { 'x-ratelimit-remaining': '0', ...(reset === undefined ? {} : { 'x-ratelimit-reset': reset }) };
    const r = await github(['org', '--execute'], [{ status: 403, headers, body: { message: `You have exceeded a secondary rate limit ${RAW}` } }]);
    assert.equal(r.calls.length, 1);
    assertRateLimitMessage(r, `secondary, reset ${reset}`);
    assert.equal(r.json.handoff.limit, 'secondary');
    assert.equal(r.json.handoff.retry_at, '2026-10-30T12:01:00.000Z', 'at least one minute');
    assert.doesNotMatch(r.json.operator_message, /clock|no readable reset/);
  }
});

// ── GitHub: a plain permission 403 ───────────────────────────────────────────
test('github: a 403 with neither signal stays a permission refusal: one attempt, no wait, the permission message', async () => {
  const r = await github(['org', '--execute'], [forbidden(), ok(ORG_BODY)]);
  assert.equal(r.code, 2);
  assert.equal(r.calls.length, 1);
  assert.deepEqual(r.sleeps, []);
  assert.equal(r.json.state, STATES.HTTP_ERROR);
  assert.equal(r.json.handoff, undefined);
  assert.match(r.json.operator_message, /refused the read \(HTTP 403\): the credential lacks a read permission/);
  assert.doesNotMatch(r.json.operator_message, /rate limit/i);
  assertNoBody(r, 'permission 403');
  // a retry-after alone is not a rate-limit signal on a 403
  const onlyRetryAfter = await github(['org', '--execute'], [{ status: 403, headers: { 'retry-after': '5' }, body: { message: RAW } }]);
  assert.equal(onlyRetryAfter.calls.length, 1);
  assert.equal(onlyRetryAfter.json.handoff, undefined);
});

test('github: a body that is not JSON, or JSON without a message, is not a secondary-limit signal', async () => {
  for (const body of [`not json ${RAW}`, JSON.stringify([RAW]), JSON.stringify({ message: 42 }), JSON.stringify({ documentation_url: RAW })]) {
    const r = await github(['org', '--execute'], [{ status: 403, headers: {}, body }]);
    assert.equal(r.calls.length, 1);
    assert.equal(r.json.handoff, undefined, body);
    assert.ok(!r.text.includes(RAW));
  }
});

test('github: the rate-limit handoff is recorded in a real audit trail, which accepts RATE_LIMITED and holds no body', async (t) => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-rate-limit-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sink = audit.auditSink({ AEGIS_AUDIT_DIR: dir });
  const gh = require('./github-client.js');
  const out = [];
  const code = await gh.run(['org', '--execute'], ENV, { transport: queued([primary(403, NOW_S + 3600)]), now: () => NOW, sleep: async () => {}, audit: sink, out: (s) => out.push(s), err: (s) => out.push(s) });
  assert.equal(code, 2, out.join(''));
  const entries = sink.log.entries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].handoff, 'RATE_LIMITED');
  assert.equal(sink.log.verify().ok, true);
  assert.ok(!fs.readFileSync(path.join(dir, audit.LOG_FILE), 'utf8').includes(RAW));
  // the sink stamps entries with this machine's clock, not the injected one
  assert.deepEqual(sink.log.status({ sinceMs: 0, nowMs: Date.now() + 60000 }).byConnector.github.handoffs, { RATE_LIMITED: 1 });
});

// ── The contract hook ────────────────────────────────────────────────────────
test('contract: rateLimit is opt-in and checked when the spec is defined; only the GitHub spec turns it on', () => {
  const base = { platform: 'demo', host: { fixed: 'api.example.com' }, credentials: ['DEMO_TOKEN'], auth: () => ({}), routes: { one: { method: 'GET', path: '/one' } } };
  assert.equal(contract.defineAdapter(base).rateLimit, null);
  for (const bad of [{ statuses: [500] }, { statuses: [403], remainingHeader: 'X Bad' }, { statuses: [403], secondaryMessage: 'text' }]) {
    assert.throws(() => contract.defineAdapter({ ...base, rateLimit: { remainingHeader: 'x-ratelimit-remaining', resetHeader: 'x-ratelimit-reset', secondaryMessage: /secondary rate limit/i, messageField: 'message', ...bad } }), /rateLimit/);
  }
  assert.ok(require('./github-client.js').SPEC.rateLimit, 'GitHub opts in');
});

// Code review round 1, finding 13: the handoff's words come from the spec that opted in, so a
// connector with other header names is never told about GitHub's header or hourly window.
test('contract: the RATE_LIMITED message names the opted-in spec\'s own remaining-requests header and no window it does not have', async () => {
  const spec = contract.defineAdapter({
    platform: 'okta', host: { fixed: 'api.example.com' }, credentials: ['DEMO_TOKEN'], auth: () => ({}),
    routes: { one: { method: 'GET', path: '/one' } },
    rateLimit: { statuses: [429], remainingHeader: 'x-rate-limit-remaining', resetHeader: 'x-rate-limit-reset', secondaryMessage: /never matches this/, messageField: 'errorSummary' },
  });
  const transport = async () => ({ status: 429, headers: { 'x-rate-limit-remaining': '0', 'x-rate-limit-reset': String(NOW_S + 600) }, body: JSON.stringify({ errorSummary: RAW }) });
  const client = contract.createClient(spec, { env: { DEMO_TOKEN: TOKEN }, transport, now: () => NOW, sleep: async () => {} });
  const res = await client.get('one');
  assert.equal(res.handoff.state, 'RATE_LIMITED');
  const text = contract.renderResult(res, { platform: 'okta', operation: 'one' });
  assert.match(text, /HTTP 429 with x-rate-limit-remaining 0/);
  assert.doesNotMatch(text, /x-ratelimit-remaining|this hour/);
  assert.ok(!text.includes(RAW));
});

// ── The other eight connectors: a 403 is unchanged ──────────────────────────
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const BOTH = { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(NOW_S + 5), 'retry-after': '3' };
const BOTH_BODY = JSON.stringify({ message: `You have exceeded a secondary rate limit ${RAW}`, error: RAW });
const tokenBody = (extra = {}) => ok({ access_token: 'issued-access-value', expires_in: 1200, token_type: 'Bearer', ...extra });

const OTHERS = [
  { name: 'fleet', file: 'fleet-client.js', env: { FLEET_URL: 'fleet.example.invalid', FLEET_API_TOKEN: TOKEN }, argv: ['version', '--execute'], pre: [] },
  { name: 'jamf', file: 'jamf-client.js', env: { JAMF_URL: 'jamf.example.invalid', JAMF_CLIENT_ID: 'client-id-value', JAMF_CLIENT_SECRET: TOKEN }, argv: ['version', '--execute'], pre: [tokenBody()] },
  { name: 'slack', file: 'slack-client.js', env: { SLACK_TOKEN: TOKEN, SLACK_TEAM_ID: 'T0OURS0001' }, argv: ['team', '--execute'], pre: [] },
  { name: 'linear', file: 'linear-client.js', env: { LINEAR_API_KEY: TOKEN, LINEAR_ORG: 'org-under-test' }, argv: ['viewer', '--execute'], pre: [] },
  {
    name: 'google-workspace', file: 'gws-client.js',
    env: { GWS_SA_CLIENT_EMAIL: at('svc', 'project.iam.gserviceaccount.com'), GWS_SA_PRIVATE_KEY: PEM, GWS_ADMIN_SUBJECT: at('admin', 'example.com'), GWS_CUSTOMER_ID: 'C0test1' },
    argv: ['users', '--execute'], pre: [tokenBody({ expires_in: 3599 })],
  },
  {
    name: 'okta', file: 'okta-client.js', env: { OKTA_ORG_URL: 'okta.example.invalid', OKTA_CLIENT_ID: 'client-id-value', OKTA_PRIVATE_KEY: PEM },
    argv: ['user', '--user', '00u1abcd2EFGH3ijk4x7', '--execute'], pre: [tokenBody({ scope: 'okta.users.read' })],
  },
  {
    name: 'msgraph', file: 'msgraph-client.js',
    env: { MS_TENANT_ID: '11111111-2222-4333-8444-555555555555', MS_CLIENT_ID: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', MS_PRIVATE_KEY: PEM, MS_CERT_SHA256: crypto.createHash('sha256').update('fixture certificate').digest('base64url') },
    argv: ['user', '--user', 'aaaaaaaa-0000-4000-8000-000000000001', '--execute'], pre: [tokenBody({ expires_in: 3599 })],
  },
];

for (const c of OTHERS) {
  test(`${c.name}: a 403 carrying GitHub's rate-limit headers and message is still a permission refusal (one attempt, no wait, no RATE_LIMITED)`, async () => {
    const mod = require(`./${c.file}`);
    const transport = queued([...c.pre, { status: 403, headers: BOTH, body: BOTH_BODY }, ok({})]);
    const out = [];
    const sleeps = [];
    const code = await mod.run(c.argv, c.env, { transport, now: () => NOW, sleep: async (ms) => { sleeps.push(ms); }, timeoutMs: 20, out: (s) => out.push(String(s)), err: (s) => out.push(String(s)) });
    const text = out.join('');
    assert.equal(code, 2, text);
    assert.equal(transport.calls.length, c.pre.length + 1, `${c.name}: no retry`);
    assert.deepEqual(sleeps, []);
    assert.match(text, /HTTP 403/);
    assert.doesNotMatch(text, /RATE_LIMITED|rate limit, not a permission/);
    assert.ok(!text.includes(RAW));
    assert.equal(mod.SPEC ? mod.SPEC.rateLimit : mod.makeSpec({ tenant: c.env.MS_TENANT_ID }).rateLimit, null);
  });
}

test('jira: a 403 carrying GitHub\'s rate-limit headers and message is still a permission refusal (one attempt, no wait)', async () => {
  const jira = require('../jira-client.js');
  const env = { JIRA_SITE: 'example-tenant.atlassian.net', JIRA_EMAIL: at('api', 'example.org'), JIRA_API_TOKEN: TOKEN };
  const transport = queued([{ status: 403, headers: BOTH, body: BOTH_BODY }, ok({})]);
  const out = [];
  const sleeps = [];
  const code = await jira.run(['get', '--issue', 'HELP-1', '--execute'], env, { transport, timeoutMs: 20, sleep: async (ms) => { sleeps.push(ms); }, out: (s) => out.push(String(s)), err: (s) => out.push(String(s)) });
  const text = out.join('\n');
  assert.equal(code, 2, text);
  assert.equal(transport.calls.length, 1);
  assert.deepEqual(sleeps, []);
  assert.match(text, /HTTP 403/);
  assert.doesNotMatch(text, /RATE_LIMITED|rate limit, not a permission/);
  assert.ok(!text.includes(RAW));
  assert.equal(jira.JIRA_SPEC.rateLimit, null);
});
