'use strict';
// contract-g3.test.js: batch G3 additions to the shared read-only contract
// (readonly-contract.js): failure handling (task 4c), the audit hook (task 3b) and the
// two-part operator message (task 6a). The G2 suite (readonly-contract.test.js) is unchanged.
//
// EXPECTED DECISION (written before the code)
// - Retry-After on a 429 or 503 is honoured up to 30 s: the next try waits exactly that
//   long (seconds or an HTTP date); a longer Retry-After is not waited out: the read stops
//   in the handoff state RETRY_AFTER_TOO_LONG and says when to try again.
// - Without Retry-After the backoff keeps its 200 ms base doubling to a 2 s cap, with jitter:
//   each wait is in [base/2, base].
// - The total time a read may spend retrying is capped (60 s by default): a retry that would
//   pass the cap is not made; the read stops in RETRY_BUDGET_SPENT.
// - A read that uses every retry stops in RETRIES_EXHAUSTED. Every exhausted read carries a
//   handoff with plain words: what failed, what was not done, the next step.
// - A non-read (the token exchange) is never retried, also with a Retry-After.
// - A request id from the vendor's response headers is kept on the result when it has a
//   safe form; anything else is dropped.
// - With an audit sink, every request (each read and the token exchange) is recorded as one
//   connector-call entry with no data, token or body; a sink that fails withholds the answer
//   (AUDIT_FAILED).
// - renderResult adds a plain operator message and an admin detail line to every failure:
//   no stack trace, no raw body, no credential.
// Run: node --test scripts/adapters/contract-g3.test.js

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const test = require('node:test');

const contract = require('./readonly-contract.js');
const { operatorMessage } = require('./operator-message.js');

const { STATES, HANDOFF } = contract;
const SECRET = 'synthetic-contract-token-value';
const ENV = Object.freeze({ EXAMPLE_HOST: 'example.invalid', EXAMPLE_TOKEN: SECRET });

function spec() {
  return contract.defineAdapter({
    platform: 'example',
    host: { env: 'EXAMPLE_HOST' },
    credentials: ['EXAMPLE_TOKEN'],
    auth: (c) => ({ Authorization: `Bearer ${c.EXAMPLE_TOKEN}` }),
    routes: { me: { method: 'GET', path: '/api/me' } },
  });
}

function exchangeSpec() {
  return contract.defineAdapter({
    platform: 'example',
    host: { env: 'EXAMPLE_HOST' },
    credentials: ['EXAMPLE_TOKEN'],
    auth: (c, token) => ({ Authorization: `Bearer ${token}` }),
    routes: { me: { method: 'GET', path: '/api/me' } },
    tokenExchange: {
      path: '/oauth/token', fields: ['grant_type', 'client_secret'],
      build: (c) => ({ grant_type: 'client_credentials', client_secret: c.EXAMPLE_TOKEN }),
      parse: (j) => ({ token: j.access_token, expiresInSeconds: j.expires_in }),
    },
  });
}

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

function harness(replies, extra = {}) {
  const sleeps = [];
  let clock = 1_000_000;
  const transport = queued(replies);
  const c = contract.createClient(extra.spec || spec(), {
    env: ENV, transport, timeoutMs: extra.timeoutMs || 50, maxRetries: extra.maxRetries ?? 2,
    sleep: async (ms) => { sleeps.push(ms); clock += ms; },
    now: () => clock,
    random: extra.random || (() => 0.5),
    retryBudgetMs: extra.retryBudgetMs,
    audit: extra.audit,
  });
  return { c, transport, sleeps, advance: (ms) => { clock += ms; } };
}

test('Retry-After in seconds or as an HTTP date is waited exactly, up to 30 s, then the read succeeds', async () => {
  const s = harness([{ status: 429, headers: { 'retry-after': '3' } }, { status: 200, body: { me: 1 } }]);
  const r = await s.c.get('me');
  assert.equal(r.state, STATES.OK);
  assert.equal(r.attempts, 2);
  assert.deepEqual(s.sleeps, [3000]);

  const date = new Date(1_000_000 + 5000).toUTCString();
  const d = harness([{ status: 503, headers: { 'retry-after': date } }, { status: 200, body: {} }]);
  assert.equal((await d.c.get('me')).state, STATES.OK);
  assert.deepEqual(d.sleeps, [5000]);

  const edge = harness([{ status: 429, headers: { 'Retry-After': '30' } }, { status: 200, body: {} }]);
  assert.equal((await edge.c.get('me')).state, STATES.OK);
  assert.deepEqual(edge.sleeps, [30000], 'exactly 30 s is honoured; the header name is read in any case');
});

test('a Retry-After over 30 s is not waited out: the read stops in RETRY_AFTER_TOO_LONG with when to try again', async () => {
  const s = harness([{ status: 429, headers: { 'retry-after': '120' } }, { status: 200, body: {} }]);
  const r = await s.c.get('me');
  assert.equal(r.state, STATES.HTTP_ERROR);
  assert.equal(r.status, 429);
  assert.equal(r.attempts, 1);
  assert.deepEqual(s.sleeps, []);
  assert.equal(s.transport.calls.length, 1, 'no second request');
  assert.equal(r.handoff.state, HANDOFF.RETRY_AFTER_TOO_LONG);
  assert.equal(r.handoff.retry_after_seconds, 120);
  assert.match(r.handoff.next_step, /120 seconds|after/i);
});

test('without Retry-After the backoff doubles from 200 ms to a 2 s cap with jitter inside [base/2, base]', async () => {
  for (const rnd of [0, 0.25, 0.5, 0.999]) {
    const replies = [{ status: 503 }, { status: 503 }, { status: 503 }, { status: 503 }, { status: 503 }, { status: 200, body: {} }];
    const s = harness(replies, { random: () => rnd, maxRetries: 3 });
    await s.c.get('me');
    assert.equal(s.sleeps.length, 3);
    [200, 400, 800].forEach((base, i) => {
      assert.ok(s.sleeps[i] >= base / 2 && s.sleeps[i] <= base, `random ${rnd}, retry ${i + 1}: ${s.sleeps[i]} in [${base / 2}, ${base}]`);
    });
  }
  const capped = harness([{ status: 502 }, { status: 502 }, { status: 502 }, { status: 502 }], { random: () => 0.999, maxRetries: 3 });
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const base = Math.min(2000, 200 * 2 ** (attempt - 1));
    for (const rnd of [0, 0.999]) {
      const d = contract.backoffDelay(attempt, () => rnd);
      assert.ok(d >= base / 2 && d <= base, `attempt ${attempt}: ${d}`);
      assert.ok(d <= 2000, 'never above the 2 s cap');
    }
  }
  await capped.c.get('me');
});

test('the total retry time is capped: a retry that would pass the budget is not made (RETRY_BUDGET_SPENT)', async () => {
  // each attempt takes 20 s of (simulated) time before it fails, inside its 20 s timeout; a
  // retry is made only when its wait and a full attempt still fit in the budget
  const slow = () => { s.advance(20000); return { status: 503, headers: {}, body: '{}' }; };
  const s = harness([slow, slow, slow, slow], { maxRetries: 3, retryBudgetMs: 45000, timeoutMs: 20000 });
  const r = await s.c.get('me');
  assert.equal(r.state, STATES.HTTP_ERROR);
  assert.equal(r.attempts, 2, 'a third attempt could end past the 45 s budget');
  assert.equal(r.handoff.state, HANDOFF.RETRY_BUDGET_SPENT);
  const spent = s.sleeps.reduce((a, b) => a + b, 0) + r.attempts * 20000;
  assert.ok(spent <= 45000, `time spent ${spent} ms stays inside the budget`);
});

test('every exhausted read ends in RETRIES_EXHAUSTED with what failed, what was not done and the next step', async () => {
  const kinds = [
    ['TIMEOUT', () => new Promise(() => {})],
    ['NETWORK_ERROR', new Error('socket hang up')],
    ['HTTP_ERROR 429', { status: 429 }],
    ['HTTP_ERROR 500', { status: 500 }],
    ['HTTP_ERROR 502', { status: 502 }],
    ['HTTP_ERROR 503', { status: 503 }],
  ];
  for (const [label, reply] of kinds) {
    const s = harness([reply, reply, reply, reply]);
    const r = await s.c.get('me');
    assert.equal(r.ok, false, label);
    assert.equal(r.attempts, 3, label);
    assert.ok(r.handoff, `${label}: a handoff`);
    assert.equal(r.handoff.state, HANDOFF.RETRIES_EXHAUSTED, label);
    for (const part of ['what_failed', 'not_done', 'next_step']) assert.ok(typeof r.handoff[part] === 'string' && r.handoff[part].length > 10, `${label}: ${part}`);
    assert.match(r.handoff.not_done, /nothing was (read|changed)/i, label);
    assert.ok(!JSON.stringify(r).includes(SECRET), `${label}: no credential`);
  }
  const notFound = harness([{ status: 404 }]);
  const nf = await notFound.c.get('me');
  assert.equal(nf.attempts, 1);
  assert.equal(nf.handoff, undefined, 'a 404 is not retried, so it is not an exhausted read');
});

test('a non-read is never retried: the token exchange runs once even with a short Retry-After', async () => {
  for (const reply of [{ status: 429, headers: { 'retry-after': '1' } }, { status: 503 }, new Error('reset')]) {
    const s = harness([reply, { status: 200, body: { access_token: 'a', expires_in: 600 } }, { status: 200, body: {} }], { spec: exchangeSpec() });
    const r = await s.c.get('me');
    assert.notEqual(r.state, STATES.OK);
    assert.equal(s.transport.calls.length, 1, 'one token exchange and nothing after it');
    assert.equal(s.transport.calls[0].method, 'POST');
    assert.deepEqual(s.sleeps, []);
  }
});

test('a request id of a safe form is kept from the response headers; anything else is dropped', async () => {
  const ok = harness([{ status: 200, headers: { 'x-request-id': 'req-123_ABC.4:5' }, body: {} }]);
  assert.equal((await ok.c.get('me')).request_id, 'req-123_ABC.4:5');
  const gh = harness([{ status: 404, headers: { 'x-github-request-id': 'C0DE:1234:ABCD:5678:9ABC' } }]);
  assert.equal((await gh.c.get('me')).request_id, 'C0DE:1234:ABCD:5678:9ABC');
  const bad = harness([{ status: 404, headers: { 'x-request-id': 'id with spaces <script>' } }]);
  assert.equal((await bad.c.get('me')).request_id, undefined);
});

test('with an audit sink every request is one connector-call entry with no data, token or body; a failing sink withholds the answer', async () => {
  const entries = [];
  const s = harness([{ status: 200, body: { access_token: 'issued-access-value', expires_in: 600 } }, { status: 503 }, { status: 200, headers: { 'x-request-id': 'r-1' }, body: { name: 'data value' } }], { spec: exchangeSpec(), audit: (e) => entries.push(e) });
  const r = await s.c.get('me');
  assert.equal(r.state, STATES.OK);
  assert.deepEqual(entries.map((e) => [e.kind, e.connector, e.operation, e.state, e.attempts]), [
    ['connector-call', 'example', 'token-exchange', 'OK', 1],
    ['connector-call', 'example', 'me', 'OK', 2],
  ]);
  assert.equal(entries[1].request_id, 'r-1');
  for (const e of entries) {
    assert.deepEqual(Object.keys(e).sort(), ['attempts', 'connector', 'duration_ms', 'handoff', 'kind', 'operation', 'request_id', 'state', 'status']);
    const text = JSON.stringify(e);
    assert.ok(!text.includes(SECRET) && !text.includes('issued-access-value') && !text.includes('data value'), 'no credential, token or data');
  }
  const failing = harness([{ status: 200, body: { secret_data: 1 } }], { audit: () => { throw new Error('disk full'); } });
  const fr = await failing.c.get('me');
  assert.equal(fr.state, STATES.AUDIT_FAILED);
  assert.equal(fr.data, undefined, 'no data without an audit record');
  assert.equal(contract.exitCodeFor(fr), contract.EXIT.READ_FAILED);
});

test('renderResult adds a plain operator message and an admin detail line to every failure, and nothing to a success', () => {
  const failures = [
    { state: STATES.REFUSED, ok: false, error: 'route me: parameter id is not allowed' },
    { state: STATES.NO_CREDENTIALS, ok: false, error: 'missing credential environment variable(s): EXAMPLE_TOKEN' },
    { state: STATES.HTTP_ERROR, ok: false, status: 401, attempts: 1, error: 'HTTP 401 (body withheld)' },
    { state: STATES.HTTP_ERROR, ok: false, status: 403, attempts: 1, request_id: 'r-9', error: 'HTTP 403 (body withheld)' },
    { state: STATES.HTTP_ERROR, ok: false, status: 404, attempts: 1, error: 'HTTP 404 (body withheld)' },
    { state: STATES.TIMEOUT, ok: false, attempts: 3, error: 'no response within 15000 ms', handoff: { state: HANDOFF.RETRIES_EXHAUSTED, what_failed: 'x'.repeat(12), not_done: 'Nothing was read.', next_step: 'y'.repeat(12) } },
    { state: STATES.NETWORK_ERROR, ok: false, attempts: 3, error: 'network error (details withheld)' },
    { state: STATES.TENANT_MISMATCH, ok: false, attempts: 1, error: 'a record in the response belongs to another tenant' },
    { state: STATES.INVALID_RESPONSE, ok: false, error: 'response is not JSON (body withheld)' },
    { state: STATES.SCOPE_REFUSED, ok: false, error: 'write scopes: chat:write', write_scopes: ['chat:write'] },
    { state: STATES.AUDIT_FAILED, ok: false, error: 'the audit trail could not record this read' },
    { state: STATES.OK, ok: true, verified: false, command: 'verify-x', reason: 'deleted is not true' },
  ];
  for (const res of failures) {
    const text = contract.renderResult(res, { platform: 'slack', secrets: [SECRET] });
    const json = JSON.parse(text.split('\nWARNING:')[0]);
    assert.equal(typeof json.operator_message, 'string', res.state);
    assert.ok(json.operator_message.split('. ').length >= 3, `${res.state}: three parts: ${json.operator_message}`);
    assert.match(json.admin_detail, /^platform=slack .*state=[A-Z_]+ status=\S+ attempts=\S+ request_id=\S+ handoff=\S+$/, res.state);
    assert.doesNotMatch(text, /\n\s+at\s/, 'no stack trace');
    assert.ok(!text.includes(SECRET));
  }
  const success = JSON.parse(contract.renderResult({ state: STATES.OK, ok: true, data: { a: 1 } }, { platform: 'slack' }));
  assert.equal(success.operator_message, undefined);
  assert.equal(success.admin_detail, undefined);
  const m = operatorMessage({ state: STATES.HTTP_ERROR, ok: false, status: 403, attempts: 1, request_id: 'r-9' }, { platform: 'github', operation: 'branchProtection' });
  assert.match(m.operator, /GitHub/);
  assert.match(m.admin, /request_id=r-9/);
  assert.match(m.admin, /operation=branchProtection/);
});
