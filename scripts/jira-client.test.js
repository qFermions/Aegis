#!/usr/bin/env node
/**
 * jira-client.test.js — eval/self-test for the JSM client.
 *
 * Zero-dep (built-in assert). Exercises the pure builders, the arg parser, and
 * the dry-run SAFETY invariant (no command hits the network without --execute).
 * Network is never touched: we stub https before requiring the client and assert
 * it stays untouched through every dry-run path.
 *
 *   node scripts/jira-client.test.js   → exit 0 all pass / 1 any fail
 */

'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const https = require('https');

// ── Network tripwire: any real https.request during a dry run fails the suite ──
let httpsCalls = 0;
const realRequest = https.request;
function trippedRequest() {
  httpsCalls++;
  throw new Error('NETWORK CALLED DURING DRY RUN — safety invariant violated');
}
https.request = trippedRequest;

const {
  REQUEST_TIMEOUT_MS,
  apiRequest,
  buildCreatePayload,
  buildCommentPayload,
  loadConfig,
  parseArgs,
  run,
} = require('./jira-client');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try { fn(); pass++; process.stdout.write(`  ok  ${name}\n`); }
  catch (e) { fail++; process.stdout.write(`FAIL  ${name}\n      ${e.message}\n`); }
}

async function asyncTest(name, fn) {
  try { await fn(); pass++; process.stdout.write(`  ok  ${name}\n`); }
  catch (e) { fail++; process.stdout.write(`FAIL  ${name}\n      ${e.message}\n`); }
}

async function captureOutput(fn) {
  const realStdoutWrite = process.stdout.write;
  const realStderrWrite = process.stderr.write;
  let stdout = '';
  let stderr = '';
  process.stdout.write = (chunk) => { stdout += String(chunk); return true; };
  process.stderr.write = (chunk) => { stderr += String(chunk); return true; };
  try {
    const value = await fn();
    return { value, stdout, stderr };
  } finally {
    process.stdout.write = realStdoutWrite;
    process.stderr.write = realStderrWrite;
  }
}

// ── buildCreatePayload ────────────────────────────────────────────────────────
test('create: builds the servicedeskapi shape with summary + description', () => {
  const p = buildCreatePayload({ serviceDeskId: 12, requestTypeId: 34, summary: 'Mailbox full', description: 'User [UPN] over quota' });
  assert.strictEqual(p.serviceDeskId, '12');
  assert.strictEqual(p.requestTypeId, '34');
  assert.strictEqual(p.requestFieldValues.summary, 'Mailbox full');
  assert.strictEqual(p.requestFieldValues.description, 'User [UPN] over quota');
});

test('create: coerces numeric ids to strings (API expects strings)', () => {
  const p = buildCreatePayload({ serviceDeskId: 1, requestTypeId: 2, summary: 's' });
  assert.strictEqual(typeof p.serviceDeskId, 'string');
  assert.strictEqual(typeof p.requestTypeId, 'string');
});

test('create: empty description defaults to empty string, not undefined', () => {
  const p = buildCreatePayload({ serviceDeskId: 1, requestTypeId: 2, summary: 's' });
  assert.strictEqual(p.requestFieldValues.description, '');
});

test('create: raiseOnBehalfOf only set when supplied', () => {
  const without = buildCreatePayload({ serviceDeskId: 1, requestTypeId: 2, summary: 's' });
  assert.ok(!('raiseOnBehalfOf' in without));
  const withIt = buildCreatePayload({ serviceDeskId: 1, requestTypeId: 2, summary: 's', raiseOnBehalfOf: 'user@example.org' });
  assert.strictEqual(withIt.raiseOnBehalfOf, 'user@example.org');
});

test('create: throws on missing serviceDeskId', () => {
  assert.throws(() => buildCreatePayload({ requestTypeId: 2, summary: 's' }), /serviceDeskId required/);
});
test('create: throws on missing requestTypeId', () => {
  assert.throws(() => buildCreatePayload({ serviceDeskId: 1, summary: 's' }), /requestTypeId required/);
});
test('create: throws on missing summary', () => {
  assert.throws(() => buildCreatePayload({ serviceDeskId: 1, requestTypeId: 2 }), /summary required/);
});

// ── buildCommentPayload ───────────────────────────────────────────────────────
test('comment: defaults to internal (public=false) — never leak to reporter by default', () => {
  const p = buildCommentPayload({ body: 'internal note' });
  assert.strictEqual(p.public, false);
});

test('comment: public flag honored when explicitly set', () => {
  const p = buildCommentPayload({ body: 'visible', isPublic: true });
  assert.strictEqual(p.public, true);
});

test('comment: false-looking strings never make a comment public', () => {
  const p = buildCommentPayload({ body: 'internal', isPublic: 'false' });
  assert.strictEqual(p.public, false);
});

test('comment: throws on empty body', () => {
  assert.throws(() => buildCommentPayload({}), /comment body required/);
});

// ── parseArgs ─────────────────────────────────────────────────────────────────
test('args: --flag value pairs and positional command', () => {
  const a = parseArgs(['create', '--summary', 'hello world', '--service-desk', '12']);
  assert.strictEqual(a._[0], 'create');
  assert.strictEqual(a.summary, 'hello world');
  assert.strictEqual(a['service-desk'], '12');
});

test('args: bare --flag before another --flag is boolean true', () => {
  const a = parseArgs(['comment', '--public', '--body', 'x']);
  assert.strictEqual(a.public, true);
  assert.strictEqual(a.body, 'x');
});

test('args: trailing bare --flag is boolean true', () => {
  const a = parseArgs(['create', '--execute']);
  assert.strictEqual(a.execute, true);
});

test('args: boolean-only flags reject separate values', () => {
  for (const flag of ['execute', 'confirm', 'public']) {
    assert.throws(
      () => parseArgs(['comment', `--${flag}`, 'false']),
      new RegExp(`Boolean flag --${flag} accepts no value`)
    );
  }
});

test('args: boolean-only flags reject equals forms', () => {
  for (const flag of ['execute', 'confirm', 'public']) {
    assert.throws(
      () => parseArgs(['comment', `--${flag}=false`]),
      /Flag values must be separate arguments/
    );
  }
});

test('args: duplicate flags are rejected', () => {
  assert.throws(() => parseArgs(['get', '--execute', '--execute']), /Duplicate flag: --execute/);
  assert.throws(() => parseArgs(['create', '--summary', 'one', '--summary', 'two']), /Duplicate flag: --summary/);
});

test('args: malformed, unknown, and missing-value flags are rejected', () => {
  assert.throws(() => parseArgs(['get', '---execute']), /Malformed flag/);
  assert.throws(() => parseArgs(['get', '--unsafe']), /Unknown flag/);
  assert.throws(() => parseArgs(['get', '--issue']), /requires a value/);
});

test('config: reports the exact JIRA_API_TOKEN variable name', () => {
  const { missing } = loadConfig({});
  assert.deepStrictEqual(missing, ['JIRA_SITE', 'JIRA_EMAIL', 'JIRA_API_TOKEN']);
});

test('request: default timeout is finite and positive', () => {
  assert.ok(Number.isFinite(REQUEST_TIMEOUT_MS));
  assert.ok(REQUEST_TIMEOUT_MS > 0);
});

// ── SAFETY invariant ──────────────────────────────────────────────────────────
test('safety: no https.request fired while requiring + building payloads (dry path)', () => {
  assert.strictEqual(httpsCalls, 0, 'expected zero network calls in pure/dry paths');
});

// ── Report ────────────────────────────────────────────────────────────────────
async function runAsyncTests() {
  await asyncTest('safety: false-looking and duplicate write flags fail before request creation', async () => {
    const cases = [
      ['create', '--service-desk', '12', '--request-type', '34', '--summary', 'test', '--execute', 'false'],
      ['transition', '--issue', '[JIRA-###]', '--to', 'Resolved', '--execute', 'false', '--confirm', 'false'],
      ['transition', '--issue', '[JIRA-###]', '--to', 'Resolved', '--execute', '--confirm=false'],
      ['comment', '--issue', '[JIRA-###]', '--body', 'test', '--public', 'false'],
      ['get', '--issue', '[JIRA-###]', '--execute', '--execute'],
    ];
    httpsCalls = 0;
    https.request = trippedRequest;
    for (const argv of cases) {
      const result = await captureOutput(() => run(argv, {}));
      assert.strictEqual(result.value, 1, `expected rejection for: ${argv.join(' ')}`);
      assert.match(result.stderr, /Argument error:/);
    }
    assert.strictEqual(httpsCalls, 0, 'invalid flags must fail before https.request');
  });

  await asyncTest('safety: create remains a no-config, zero-request dry run by default', async () => {
    httpsCalls = 0;
    https.request = trippedRequest;
    const result = await captureOutput(() => run([
      'create',
      '--service-desk', '12',
      '--request-type', '34',
      '--summary', 'test',
    ], {}));
    assert.strictEqual(result.value, 0);
    assert.match(result.stdout, /DRY RUN/);
    assert.strictEqual(httpsCalls, 0);
  });

  await asyncTest('safety: transition requires both bare --execute and --confirm gates', async () => {
    const cases = [
      [],
      ['--execute'],
      ['--confirm'],
    ];
    httpsCalls = 0;
    https.request = trippedRequest;
    for (const flags of cases) {
      const result = await captureOutput(() => run([
        'transition',
        '--issue', '[JIRA-###]',
        '--to', 'Resolved',
        ...flags,
      ], {}));
      assert.strictEqual(result.value, 0);
      assert.match(result.stdout, /DRY RUN/);
    }
    assert.strictEqual(httpsCalls, 0);
  });

  await asyncTest('safety: comment is internal and zero-request unless bare --public and --execute are present', async () => {
    httpsCalls = 0;
    https.request = trippedRequest;
    const result = await captureOutput(() => run([
      'comment',
      '--issue', '[JIRA-###]',
      '--body', 'internal test note',
    ], {}));
    assert.strictEqual(result.value, 0);
    assert.match(result.stdout, /"public": false/);
    assert.strictEqual(httpsCalls, 0);
  });

  await asyncTest('config: executed commands name JIRA_API_TOKEN and make no request when config is absent', async () => {
    httpsCalls = 0;
    https.request = trippedRequest;
    const result = await captureOutput(() => run([
      'get', '--issue', '[JIRA-###]', '--execute',
    ], {}));
    assert.strictEqual(result.value, 1);
    assert.match(result.stderr, /JIRA_API_TOKEN/);
    assert.ok(!result.stderr.includes('JIRA_TOKEN'));
    assert.strictEqual(httpsCalls, 0);
  });

  await asyncTest('request interception: explicit bare --public --execute sends one public comment only to the stub', async () => {
    httpsCalls = 0;
    let captured = null;
    https.request = (options, callback) => {
      httpsCalls++;
      let body = '';
      const req = new EventEmitter();
      req.write = (chunk) => { body += String(chunk); };
      req.end = () => {
        process.nextTick(() => {
          captured = { options, body };
          const res = new EventEmitter();
          res.statusCode = 201;
          callback(res);
          res.emit('data', '{}');
          res.emit('end');
        });
      };
      req.destroy = (error) => { if (error) req.emit('error', error); };
      return req;
    };
    try {
      const result = await captureOutput(() => run([
        'comment',
        '--issue', '[JIRA-###]',
        '--body', 'public test note',
        '--public',
        '--execute',
      ], {
        JIRA_SITE: 'example.atlassian.net',
        JIRA_EMAIL: 'api@example.org',
        JIRA_API_TOKEN: 'x',
      }));
      assert.strictEqual(result.value, 0);
      assert.strictEqual(httpsCalls, 1);
      assert.ok(captured, 'expected the intercepted request to be captured');
      assert.strictEqual(captured.options.hostname, 'example.atlassian.net');
      assert.strictEqual(JSON.parse(captured.body).public, true);
    } finally {
      https.request = trippedRequest;
    }
  });

  await asyncTest('request interception: redirects fail closed without disclosing the response body', async () => {
    httpsCalls = 0;
    const sensitiveBody = 'synthetic-sensitive-response-body';
    https.request = (_options, callback) => {
      httpsCalls++;
      const req = new EventEmitter();
      req.write = () => {};
      req.end = () => {
        process.nextTick(() => {
          const res = new EventEmitter();
          res.statusCode = 302;
          callback(res);
          res.emit('data', sensitiveBody);
          res.emit('end');
        });
      };
      req.destroy = (error) => { if (error) req.emit('error', error); };
      return req;
    };
    try {
      const result = await captureOutput(() => run([
        'comment',
        '--issue', '[JIRA-###]',
        '--body', 'internal test note',
        '--execute',
      ], {
        JIRA_SITE: 'example.atlassian.net',
        JIRA_EMAIL: 'api@example.org',
        JIRA_API_TOKEN: 'x',
      }));
      assert.strictEqual(result.value, 2);
      assert.strictEqual(httpsCalls, 1);
      assert.match(result.stderr, /HTTP 302/);
      assert.doesNotMatch(result.stdout, /Comment added/);
      assert.ok(!result.stderr.includes(sensitiveBody));
      assert.ok(!result.stdout.includes(sensitiveBody));
    } finally {
      https.request = trippedRequest;
    }
  });

  await asyncTest('request timeout: a hanging intercepted request is destroyed and rejected', async () => {
    httpsCalls = 0;
    let destroyed = false;
    https.request = () => {
      httpsCalls++;
      const req = new EventEmitter();
      req.write = () => {};
      req.end = () => {};
      req.destroy = (error) => {
        destroyed = true;
        if (error) req.emit('error', error);
      };
      return req;
    };
    try {
      await assert.rejects(
        apiRequest(
          { site: 'example.atlassian.net', email: 'api@example.org', token: 'x' },
          'GET',
          '/rest/servicedeskapi/test',
          null,
          10
        ),
        /timed out after 10ms/
      );
      assert.strictEqual(httpsCalls, 1);
      assert.strictEqual(destroyed, true);
    } finally {
      https.request = trippedRequest;
    }
  });
}

async function finish() {
  try {
    await runAsyncTests();
  } finally {
    https.request = realRequest;
  }
  process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
  process.exitCode = fail === 0 ? 0 : 1;
}

finish().catch((e) => {
  https.request = realRequest;
  process.stderr.write(`Unexpected test harness error: ${e.message}\n`);
  process.exitCode = 1;
});
