'use strict';
// g2-boundary.test.js: no G2 command, adapter or generator output contains an
// autonomous write, for any of the five platforms (charter task 6, check C6).
//
// Contract: PRODUCT_CONTRACT.md (AEGIS ADVISES; HUMANS EXECUTE PRODUCTION CHANGES) and
// docs/aegis/lanes/g2.md (the allow-lists and refused paths per platform).
//
// EXPECTED DECISION
// 1. Every adapter (Fleet, Jamf Pro, Slack, Linear, Google Workspace), driven through
//    every CLI command it documents with --execute and a recording in-memory transport,
//    sends only reads: GET, a POST to Linear's /graphql whose document holds no mutation
//    or subscription, or the vendor's token exchange at its exact path with only its
//    grant fields. Without --execute it sends nothing at all.
// 2. Every adapter spec defines GET routes only, and no adapter source opens its own
//    connection (no http, https, net, tls or child_process) or writes a file.
// 3. The posture audit generator loads no network module, and its only write is the
//    local, gated report its own tests prove.
// 4. Every G2 runbook is operator-only (disable-model-invocation: true), states the
//    execution boundary, and every state change it describes is owned by a SAFETY GATE
//    or a PREVIEW ONLY marker in the checked-in state-change inventory.

require('./adapters/socket-tripwire.js');

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { assertQueryOnly } = require('./adapters/readonly-contract.js');

const ROOT = path.resolve(__dirname, '..');
const sentinel = (n) => ['sentinel', 'value', String(n)].join('-');

const G2_COMMANDS = ['fleet-host-health', 'fleet-policy-failures', 'fleet-vulnerable-software', 'fleet-osquery-investigation', 'fleet-device-actions',
  'linear-intake', 'linear-triage', 'linear-ticket-note', 'linear-workspace-admin',
  'slack-user-lifecycle', 'slack-guests-connect', 'slack-app-approval', 'slack-retention-export', 'slack-security-settings', 'slack-incident-comms',
  'jamf-config-profiles', 'jamf-policies-self-service', 'jamf-patch-management', 'jamf-filevault', 'jamf-inventory-groups',
  'gws-drive-sharing', 'gws-2sv-enforcement', 'gws-account-containment', 'gws-admin-roles', 'gws-security-posture'];

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const SHA = '0'.repeat(64);
const NOT_BEFORE = '2026-10-27T00:00:00Z';
// A drafted note for the offline commands (Linear note, Slack digest); the system temporary
// folder is one of the two places those commands read a note from. Removed after the tests.
const NOTE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-g2-boundary-'));
const NOTE_FILE = path.join(NOTE_DIR, 'note.md');
fs.writeFileSync(NOTE_FILE, 'Resolved. Fixture note for the boundary test.\n');
test.after(() => fs.rmSync(NOTE_DIR, { recursive: true, force: true }));

// Every CLI command each adapter documents (docs/aegis/lanes/g2.md, scripts/adapters/README.md,
// the runbooks). `offline` commands must send nothing even with --execute; the coverage test
// below fails when a runbook, the lane spec or the README names a command missing here.
const ADAPTERS = {
  fleet: {
    file: 'fleet-client.js',
    env: { FLEET_URL: 'fleet.example.org', FLEET_API_TOKEN: sentinel(1) },
    commands: [['me'], ['version'], ['host', '--id', '7'], ['host', '--identifier', 'C02FIXTURE01'], ['hosts', '--status', 'offline'],
      ['hosts', '--policy-id', '3', '--policy-response', 'failing'], ['host-mdm', '--id', '7'], ['host-software', '--id', '7', '--vulnerable'],
      ['host-activities', '--id', '7'], ['policies'], ['software', '--vulnerable'], ['vulnerability', '--cve', 'CVE-2026-12345'],
      ['script-result', '--execution-id', 'e1a2b3c4-0000-4000-8000-000000000001'], ['commands', '--host-identifier', 'C02FIXTURE01'], ['activities'],
      ['report-results', '--id', '4'], ['verify-lock', '--id', '7'], ['verify-unlock', '--id', '7'], ['verify-wipe', '--id', '7'],
      ['verify-script', '--execution-id', 'e1a2b3c4-0000-4000-8000-000000000001'], ['verify-mdm-off', '--id', '7'],
      ['verify-deleted', '--identifier', 'C02FIXTURE01', '--not-before', NOT_BEFORE], ['host-upcoming', '--id', '7']],
  },
  jamf: {
    file: 'jamf-client.js',
    env: { JAMF_URL: 'jamf.example.org', JAMF_CLIENT_ID: sentinel(2), JAMF_CLIENT_SECRET: sentinel(3) },
    token: { path: '/api/oauth/token', fields: ['client_id', 'client_secret', 'grant_type'] },
    commands: [['version'], ['computer', '--serial', 'C02FIXTURE01'], ['computer', '--serial', 'C02FIXTURE01', '--section', 'DISK_ENCRYPTION'],
      ['computer-detail', '--id', '12'], ['commands', '--management-id', 'a1b2c3d4-0000-4000-8000-000000000001'], ['smart-groups', '--name', 'Pilot'],
      ['group-members', '--id', '5'], ['profile', '--id', '9'], ['policy', '--id', '21'], ['history', '--id', '12', '--subset', 'PolicyLogs'],
      ['patch-titles'], ['patch-report', '--id', '3'], ['update-plans'], ['update-plan-events', '--id', 'a1b2c3d4-0000-4000-8000-000000000002'],
      ['verify-command', '--management-id', 'a1b2c3d4-0000-4000-8000-000000000001', '--type', 'DEVICE_LOCK', '--not-before', NOT_BEFORE],
      ['verify-profile', '--serial', 'C02FIXTURE01', '--profile-id', '9', '--profile-identifier', 'com.example.fixture.wifi'], ['verify-group-count', '--id', '5', '--expect', '3'],
      ['verify-filevault', '--serial', 'C02FIXTURE01'], ['verify-policy', '--id', '21', '--enabled', 'true']],
  },
  slack: {
    file: 'slack-client.js',
    env: { SLACK_TOKEN: sentinel(4), SLACK_ACCESS_LOGS_TOKEN: sentinel(6), SLACK_TEAM_ID: 'T0FIXTURE' },
    commands: [['whoami'], ['user', '--user', 'U0FIXTURE'], ['users'], ['team'], ['channel', '--channel', 'C0FIXTURE'], ['app-requests'],
      ['apps-approved'], ['apps-restricted'], ['access-logs'], ['verify-deactivated', '--user', 'U0FIXTURE'], ['verify-reactivated', '--user', 'U0FIXTURE'],
      ['verify-guest', '--user', 'U0FIXTURE', '--type', 'single'], ['verify-archived', '--channel', 'C0FIXTURE'],
      ['verify-posted', '--channel', 'C0FIXTURE', '--expect-sha256', SHA, '--not-before', NOT_BEFORE], ['verify-app-approved', '--app-id', 'A0FIXTURE'],
      ['verify-app-restricted', '--app-id', 'A0FIXTURE']],
    offline: [['digest', '--file', NOTE_FILE]],
  },
  linear: {
    file: 'linear-client.js',
    env: { LINEAR_API_KEY: sentinel(5), LINEAR_ORG: 'fixture-org' },
    commands: [['viewer'], ['issue', '--issue', 'IT-12'], ['comments', '--issue', 'IT-12'], ['states', '--team', 'IT'], ['labels'], ['triage'], ['members'],
      ['verify-comment', '--issue', 'IT-12', '--expect-sha256', SHA, '--not-before', NOT_BEFORE], ['verify-state', '--issue', 'IT-12', '--state', 'Done'],
      ['verify-labels', '--issue', 'IT-12', '--has', 'hardware'], ['verify-trashed', '--issue', 'IT-12'], ['verify-suspended', '--user', 'u-fixture-1'],
      ['verify-snoozed', '--issue', 'IT-12']],
    offline: [['note', '--issue', 'IT-12', '--body-file', NOTE_FILE]],
  },
  gws: {
    file: 'gws-client.js',
    env: { GWS_SA_CLIENT_EMAIL: 'reader@example.org', GWS_SA_PRIVATE_KEY: PEM, GWS_ADMIN_SUBJECT: 'admin@example.org', GWS_CUSTOMER_ID: 'C0fixture' },
    token: { path: '/token', fields: ['assertion', 'grant_type'] },
    commands: [['user', '--user', 'person@example.org'], ['users', '--query', 'isEnrolledIn2Sv=false'], ['roles'],
      ['role-assignments', '--user', 'person@example.org'], ['group-members', '--group', 'team@example.org'], ['mobile-devices'],
      ['chromeos-devices'], ['activities', '--app', 'drive', '--user', 'all'], ['usage', '--date', '2026-10-20', '--parameters', 'accounts:num_users_2sv_enrolled'],
      ['verify-suspended', '--user', 'person@example.org'], ['verify-2sv-enforced', '--user', 'person@example.org'],
      ['verify-ou', '--user', 'person@example.org', '--ou', '/Staff'], ['verify-admin-role-removed', '--user', 'person@example.org', '--role-id', '42'],
      ['verify-event', '--app', 'admin', '--event', 'CHANGE_PASSWORD', '--user', 'person@example.org', '--not-before', NOT_BEFORE],
      ['verify-2sv-not-enforced', '--user', 'person@example.org']],
  },
};

function recordingTransport(platform) {
  const calls = [];
  const transport = async (request) => {
    calls.push(request);
    const token = ADAPTERS[platform].token;
    if (token && request.path === token.path) return { status: 200, headers: {}, body: JSON.stringify({ access_token: sentinel(9), expires_in: 1800 }) };
    return { status: 200, headers: {}, body: JSON.stringify({ ok: true }) };
  };
  transport.calls = calls;
  return transport;
}

function isRead(platform, request) {
  const method = request.method;
  if (method === 'GET') return request.body === undefined || request.body === null;
  if (method !== 'POST') return false;
  const token = ADAPTERS[platform].token;
  if (token && request.path === token.path) {
    const fields = [...new URLSearchParams(request.body).keys()].sort();
    return JSON.stringify(fields) === JSON.stringify(token.fields);
  }
  if (platform === 'linear' && request.path === '/graphql') {
    const body = JSON.parse(request.body);
    try { assertQueryOnly(body.query); } catch { return false; }
    return true;
  }
  return false;
}

for (const [platform, adapter] of Object.entries(ADAPTERS)) {
  test(`${platform}: every documented adapter command sends reads only, and nothing without --execute`, async () => {
    const mod = require(path.join(__dirname, 'adapters', adapter.file));
    assert.equal(typeof mod.run, 'function', `${adapter.file} exports run(argv, env, deps)`);
    const writes = [];
    const unexercised = [];
    let reads = 0;
    for (const argv of adapter.commands) {
      const dry = recordingTransport(platform);
      await mod.run(argv, adapter.env, { transport: dry, out: () => {}, err: () => {}, sleep: async () => {} });
      assert.equal(dry.calls.length, 0, `${platform} ${argv.join(' ')}: a dry run sends nothing`);
      const live = recordingTransport(platform);
      await mod.run([...argv, '--execute'], adapter.env, { transport: live, out: () => {}, err: () => {}, sleep: async () => {} });
      // each command must reach its read: a fixture refused by input checks proves nothing
      if (!live.calls.some((request) => isRead(platform, request) && !(adapter.token && request.path === adapter.token.path))) unexercised.push(argv.join(' '));
      for (const request of live.calls) {
        if (isRead(platform, request)) reads += 1;
        else writes.push(`${argv.join(' ')} → ${request.method} ${request.path}`);
      }
    }
    for (const argv of adapter.offline || []) {
      for (const run of [argv, [...argv, '--execute']]) {
        const offline = recordingTransport(platform);
        await mod.run(run, adapter.env, { transport: offline, out: () => {}, err: () => {}, sleep: async () => {} });
        assert.equal(offline.calls.length, 0, `${platform} ${run.join(' ')}: an offline command sends nothing`);
      }
    }
    assert.deepEqual(writes, [], `${platform}: an adapter command sent a write`);
    assert.deepEqual(unexercised, [], `${platform}: a fixture sent no read with --execute`);
    assert.ok(reads >= adapter.commands.length, `${platform}: the commands were exercised (${reads} reads)`);
  });

  test(`${platform}: the adapter spec defines GET routes only and the source opens no connection of its own and writes no file`, () => {
    const mod = require(path.join(__dirname, 'adapters', adapter.file));
    assert.ok(mod.SPEC && Object.isFrozen(mod.SPEC), `${adapter.file} exports its frozen SPEC`);
    for (const route of Object.values(mod.SPEC.routes)) assert.equal(route.method, 'GET', `${platform}: route ${route.name}`);
    if (mod.SPEC.graphql) for (const doc of Object.values(mod.SPEC.graphql.documents)) assert.doesNotThrow(() => assertQueryOnly(doc));
    const source = fs.readFileSync(path.join(__dirname, 'adapters', adapter.file), 'utf8');
    assert.ok(!/require\(['"](?:node:)?(?:http|https|net|tls|dgram|child_process)['"]\)/.test(source), `${adapter.file} opens no connection of its own`);
    assert.ok(!/\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|unlink|unlinkSync|rmSync|mkdirSync|renameSync)\b/.test(source), `${adapter.file} writes no file`);
  });
}

test('every adapter command a runbook, the lane spec or the adapter README tells an operator to run is exercised above', () => {
  const sources = [...fs.readdirSync(path.join(ROOT, '.claude', 'commands')).filter((f) => f.endsWith('.md')).map((f) => path.join(ROOT, '.claude', 'commands', f)),
    path.join(ROOT, 'docs', 'aegis', 'lanes', 'g2.md'), path.join(__dirname, 'adapters', 'README.md')];
  const documented = new Set();
  for (const file of sources) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/node scripts\/adapters\/(fleet|linear|slack|jamf|gws)-client\.js ([a-z][a-z0-9-]*)/g)) documented.add(`${m[1]} ${m[2]}`);
  }
  const exercised = new Set(Object.entries(ADAPTERS).flatMap(([platform, a]) => [...a.commands, ...(a.offline || [])].map((argv) => `${platform} ${argv[0]}`)));
  assert.ok(documented.size >= 50, `the scan found the documented commands (${documented.size})`);
  assert.deepEqual([...documented].filter((c) => !exercised.has(c)).sort(), [], 'a documented adapter command is not exercised by this test');
});

test('the posture audit generator loads no network module', () => {
  const source = fs.readFileSync(path.join(__dirname, 'gws-posture-audit.js'), 'utf8');
  assert.ok(!/require\(['"](?:node:)?(?:http|https|net|tls|dgram)['"]\)|\bfetch\(/.test(source));
});

test('every G2 runbook is operator-only, states the execution boundary, and every state change in it is gated or a preview', () => {
  const inventory = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'security', 'STATE_CHANGE_INVENTORY.json'), 'utf8'));
  const problems = [];
  for (const name of G2_COMMANDS) {
    const file = `.claude/commands/${name}.md`;
    const absolute = path.join(ROOT, file);
    if (!fs.existsSync(absolute)) { problems.push(`${file}: missing`); continue; }
    const text = fs.readFileSync(absolute, 'utf8');
    if (!/^disable-model-invocation:\s*true\s*$/m.test(text)) problems.push(`${file}: not operator-only`);
    if (!/Aegis advises; a human administrator runs every step \(HUMAN-RUN\)/.test(text)) problems.push(`${file}: no execution boundary`);
    for (const entry of inventory.examples.filter((e) => e.file === file)) {
      if (!['gated', 'preview'].includes(entry.mode)) problems.push(`${file}: ${entry.id} is ${entry.mode}`);
    }
  }
  assert.deepEqual(problems, []);
});
