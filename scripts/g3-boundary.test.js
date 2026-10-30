'use strict';
// g3-boundary.test.js: no command, connector, intake or audit path added in batch G3 can
// write to a vendor system (charter task 7).
//
// Contract: PRODUCT_CONTRACT.md (AEGIS ADVISES; HUMANS EXECUTE PRODUCTION CHANGES).
//
// EXPECTED DECISION
// 1. Every G3 connector (GitHub, Microsoft Graph, Okta), driven through every CLI command
//    it has with --execute and a recording in-memory transport, sends only reads: GET, or
//    the vendor's token exchange at its exact host and path with only its declared fields.
//    Without --execute it sends nothing at all.
// 2. Every G3 connector spec defines GET routes only, and no G3 source (the connectors,
//    scopes.js, cli-support.js, operator-message.js, the intake, clarify.js, the audit
//    modules) opens a connection of its own; the connectors write no file.
// 3. The intake sends at most one read (Linear's AegisIssueIntake query) and writes one
//    file only, the case's state.json, and only under --save.
// 4. Every connector command a runbook or README names is exercised by item 1.
// 5. Every G3 runbook is operator-only, states the execution boundary, and every state
//    change in it is a SAFETY GATE or PREVIEW ONLY entry in the checked-in inventory.

require('./adapters/socket-tripwire.js');

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { assertQueryOnly } = require('./adapters/readonly-contract.js');

const ROOT = path.resolve(__dirname, '..');
const sentinel = (n) => ['sentinel', 'g3', 'value', String(n)].join('-');
const NOT_BEFORE = '2026-10-27T00:00:00Z';
const TENANT = '11111111-2222-4333-8444-555555555555';
const U = 'aaaaaaaa-0000-4000-8000-000000000001';
const OKTA_USER = '00u1a2b3c4d5e6f7g8h9';
const OKTA_GROUP = '00g1a2b3c4d5e6f7g8h9';
const OKTA_APP = '0oa1a2b3c4d5e6f7g8h9';
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });

const G3_RUNBOOKS = ['github-repo-access', 'github-branch-protection', 'github-org-security', 'github-offboard-member', 'github-security-alerts', 'okta-group-membership'];

const ADAPTERS = {
  github: {
    file: 'github-client.js',
    env: { GITHUB_ORG: 'org-a', GITHUB_TOKEN: sentinel(1) },
    commands: [['org'], ['members', '--filter', '2fa_disabled'], ['membership', '--user', 'person-a'], ['teams'], ['team-members', '--team', 'docs'],
      ['outside-collaborators'], ['invitations'], ['collaborators', '--repo', 'docs'], ['permission', '--repo', 'docs', '--user', 'person-a'],
      ['protection', '--repo', 'docs', '--branch', 'main'], ['rulesets', '--repo', 'docs'], ['branch-rules', '--repo', 'docs', '--branch', 'main'],
      ['audit-log', '--phrase', 'action:org.remove_member'], ['sso-authorizations'], ['secret-alerts'], ['secret-alert', '--repo', 'docs', '--number', '3'],
      ['dependabot-alerts'], ['dependabot-alert', '--repo', 'docs', '--number', '9'], ['issue', '--repo', 'helpdesk', '--number', '7'],
      ['verify-collaborator', '--repo', 'docs', '--user', 'person-a', '--role', 'read'], ['verify-collaborator-removed', '--repo', 'docs', '--user', 'person-a'],
      ['verify-offboarded', '--user', 'person-a'], ['verify-team-member', '--team', 'docs', '--user', 'person-a'],
      ['verify-protection', '--repo', 'docs', '--branch', 'main', '--reviews', '2'], ['verify-2fa-required'],
      ['verify-secret-alert', '--repo', 'docs', '--number', '3', '--state', 'resolved'], ['verify-dependabot-alert', '--repo', 'docs', '--number', '9', '--state', 'fixed']],
  },
  msgraph: {
    file: 'msgraph-client.js',
    env: { MS_TENANT_ID: TENANT, MS_CLIENT_ID: 'bbbbbbbb-0000-4000-8000-000000000009', MS_PRIVATE_KEY: PEM, MS_CERT_SHA256: crypto.createHash('sha256').update('x').digest('base64url') },
    token: { host: 'login.microsoftonline.com', path: `/${TENANT}/oauth2/v2.0/token`, fields: ['client_assertion', 'client_assertion_type', 'client_id', 'grant_type', 'scope'] },
    commands: [['user', '--user', U], ['auth-methods', '--user', U], ['member-of', '--user', U], ['group-members', '--group', U], ['sign-ins', '--user', U, '--since', NOT_BEFORE],
      ['managed-device', '--device', U], ['verify-password-changed', '--user', U, '--not-before', NOT_BEFORE], ['verify-account-enabled', '--user', U, '--enabled', 'true'],
      ['verify-mfa-method', '--user', U, '--method', 'fido2'], ['verify-mfa-cleared', '--user', U], ['verify-signin', '--user', U, '--not-before', NOT_BEFORE],
      ['verify-device-synced', '--device', U, '--not-before', NOT_BEFORE], ['verify-group-member', '--group', U, '--user', U]],
  },
  okta: {
    file: 'okta-client.js',
    env: { OKTA_ORG_URL: 'okta.example.org', OKTA_CLIENT_ID: '0oaclientfixture01', OKTA_PRIVATE_KEY: PEM },
    token: { host: 'okta.example.org', path: '/oauth2/v1/token', fields: ['client_assertion', 'client_assertion_type', 'grant_type', 'scope'] },
    commands: [['user', '--user', OKTA_USER], ['factors', '--user', OKTA_USER], ['user-groups', '--user', OKTA_USER], ['group', '--group', OKTA_GROUP],
      ['group-members', '--group', OKTA_GROUP], ['group-rules'], ['logs', '--since', NOT_BEFORE], ['app-user', '--app', OKTA_APP, '--user', OKTA_USER],
      ['verify-status', '--user', OKTA_USER, '--status', 'SUSPENDED'], ['verify-factor-reset', '--user', OKTA_USER, '--factor-type', 'push'],
      ['verify-factors-reset-all', '--user', OKTA_USER], ['verify-sessions-cleared', '--user', OKTA_USER, '--not-before', NOT_BEFORE],
      ['verify-password-reset', '--user', OKTA_USER, '--not-before', NOT_BEFORE], ['verify-group-member', '--group', OKTA_GROUP, '--user', OKTA_USER],
      ['verify-app-assigned', '--app', OKTA_APP, '--user', OKTA_USER]],
  },
};

function recordingTransport(adapter) {
  const calls = [];
  const transport = async (request) => {
    calls.push(request);
    if (adapter.token && request.path === adapter.token.path) return { status: 200, headers: {}, body: JSON.stringify({ access_token: sentinel(9), expires_in: 1800, token_type: 'Bearer' }) };
    return { status: 200, headers: {}, body: JSON.stringify({ ok: true }) };
  };
  transport.calls = calls;
  return transport;
}

function isRead(adapter, request) {
  if (request.method === 'GET') return request.body === undefined || request.body === null;
  if (request.method !== 'POST' || !adapter.token) return false;
  if (request.path !== adapter.token.path || (adapter.token.host && request.hostname !== adapter.token.host)) return false;
  return JSON.stringify([...new URLSearchParams(request.body).keys()].sort()) === JSON.stringify(adapter.token.fields);
}

const loadSpec = (mod) => (mod.makeSpec && !mod.SPEC ? mod.makeSpec({ tenant: TENANT }) : mod.SPEC);

for (const [platform, adapter] of Object.entries(ADAPTERS)) {
  test(`${platform}: every connector command sends reads only, and nothing without --execute`, async () => {
    const mod = require(path.join(__dirname, 'adapters', adapter.file));
    const writes = [];
    const unexercised = [];
    for (const argv of adapter.commands) {
      const dry = recordingTransport(adapter);
      const dryCode = await mod.run(argv, adapter.env, { transport: dry, out: () => {}, err: () => {}, sleep: async () => {} });
      assert.equal(dryCode, 0, `${platform} ${argv.join(' ')}: the dry run is accepted`);
      assert.equal(dry.calls.length, 0, `${platform} ${argv.join(' ')}: a dry run sends nothing`);
      const live = recordingTransport(adapter);
      await mod.run([...argv, '--execute'], adapter.env, { transport: live, out: () => {}, err: () => {}, sleep: async () => {} });
      if (!live.calls.some((r) => r.method === 'GET')) unexercised.push(argv.join(' '));
      for (const request of live.calls) if (!isRead(adapter, request)) writes.push(`${argv.join(' ')} -> ${request.method} ${request.path}`);
    }
    assert.deepEqual(writes, [], `${platform}: a connector command sent a write`);
    assert.deepEqual(unexercised, [], `${platform}: a fixture sent no read with --execute`);
    assert.deepEqual(adapter.commands.map((a) => a[0]).sort(), Object.keys(mod.COMMANDS).sort(), `${platform}: every command the connector has is exercised`);
  });

  test(`${platform}: the spec defines GET routes only and the source opens no connection and writes no file`, () => {
    const mod = require(path.join(__dirname, 'adapters', adapter.file));
    const spec = loadSpec(mod);
    assert.ok(Object.isFrozen(spec));
    for (const route of Object.values(spec.routes)) assert.equal(route.method, 'GET', `${platform}: route ${route.name}`);
    if (spec.graphql) for (const doc of Object.values(spec.graphql.documents)) assert.doesNotThrow(() => assertQueryOnly(doc));
    const source = fs.readFileSync(path.join(__dirname, 'adapters', adapter.file), 'utf8');
    assert.ok(!/require\(['"](?:node:)?(?:http|https|net|tls|dgram|child_process)['"]\)/.test(source), `${adapter.file} opens no connection of its own`);
    assert.ok(!/\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|unlink|unlinkSync|rmSync|mkdirSync|renameSync)\b/.test(source), `${adapter.file} writes no file`);
  });
}

test('no G3 module opens a connection of its own', () => {
  const files = ['scripts/adapters/scopes.js', 'scripts/adapters/cli-support.js', 'scripts/adapters/operator-message.js', 'scripts/intake/intake.js', 'scripts/intake/clarify.js',
    'scripts/audit/audit-log.js', 'scripts/audit/change-record.js', 'scripts/eval/g3-ticket-eval.js'];
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(!/require\(['"](?:node:)?(?:http|https|net|tls|dgram)['"]\)|\bfetch\(/.test(source), `${file} opens no connection`);
  }
  for (const file of ['scripts/adapters/scopes.js', 'scripts/adapters/cli-support.js', 'scripts/adapters/operator-message.js', 'scripts/intake/clarify.js']) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(!/\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|unlinkSync|rmSync|mkdirSync|renameSync)\b/.test(source), `${file} writes no file`);
  }
});

test('the intake sends at most one read and writes only the case state.json, only in saveCase', async () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'intake', 'intake.js'), 'utf8');
  const writes = [...source.matchAll(/\bfs\.(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|unlinkSync|rmSync|mkdirSync|renameSync)\b/g)].map((m) => m.index);
  const save = source.indexOf('function saveCase(');
  const saveEnd = source.indexOf('\n}\n', save);
  assert.ok(save > 0 && writes.length === 2 && writes.every((i) => i > save && i < saveEnd), 'the only file writes are the two in saveCase (its folder and state.json)');
  const intake = require('./intake/intake.js');
  const calls = [];
  const transport = async (request) => {
    calls.push(request);
    return { status: 200, headers: {}, body: JSON.stringify({ data: { issue: { identifier: 'IT-1', title: 'Printer', description: 'Jammed', comments: { nodes: [] } }, organization: { urlKey: 'org-a' } } }) };
  };
  const r = await intake.fromLinear('IT-1', { env: { LINEAR_ORG: 'org-a', LINEAR_API_KEY: sentinel(5) }, deps: { transport, sleep: async () => {} } });
  assert.equal(r.state, 'ACCEPTED');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].path, '/graphql');
  assert.doesNotThrow(() => assertQueryOnly(JSON.parse(calls[0].body).query));
});

test('every G3 connector command a runbook or README tells an operator to run is exercised above', () => {
  const sources = [...fs.readdirSync(path.join(ROOT, '.claude', 'commands')).filter((f) => f.endsWith('.md')).map((f) => path.join(ROOT, '.claude', 'commands', f)),
    path.join(__dirname, 'adapters', 'README.md')];
  const documented = new Set();
  for (const file of sources) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/node scripts\/adapters\/(github|msgraph|okta)-client\.js ([a-z][a-z0-9-]*)/g)) documented.add(`${m[1]} ${m[2]}`);
  }
  const exercised = new Set(Object.entries(ADAPTERS).flatMap(([platform, a]) => a.commands.map((argv) => `${platform} ${argv[0]}`)));
  assert.ok(documented.size >= 10, `the scan found the documented commands (${documented.size})`);
  assert.deepEqual([...documented].filter((c) => !exercised.has(c)).sort(), []);
});

test('every G3 runbook is operator-only, states the execution boundary, and every state change in it is gated or a preview', () => {
  const inventory = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'security', 'STATE_CHANGE_INVENTORY.json'), 'utf8'));
  const problems = [];
  for (const name of G3_RUNBOOKS) {
    const file = `.claude/commands/${name}.md`;
    const absolute = path.join(ROOT, file);
    if (!fs.existsSync(absolute)) { problems.push(`${file}: missing`); continue; }
    const text = fs.readFileSync(absolute, 'utf8');
    if (!/^disable-model-invocation:\s*true\s*$/m.test(text)) problems.push(`${file}: not operator-only`);
    if (!/Aegis advises; a human administrator runs every step \(HUMAN-RUN\)/.test(text)) problems.push(`${file}: no execution boundary`);
    const entries = inventory.examples.filter((e) => e.file === file);
    if (!entries.length) problems.push(`${file}: no entry in the state-change inventory`);
    for (const entry of entries) if (!['gated', 'preview'].includes(entry.mode)) problems.push(`${file}: ${entry.id} is ${entry.mode}`);
  }
  assert.deepEqual(problems, []);
});
