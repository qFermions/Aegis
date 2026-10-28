'use strict';
// scope-preflight.test.js: the read-only scope manifest and the scope preflight
// (batch G3, task 3a).
//
// EXPECTED DECISION (written before the code)
// - scripts/adapters/scope-manifest.json names, for every connector, the least-privilege
//   read scopes or role, how the vendor exposes a credential's granted scopes (a response
//   header, the token response, an API read, or not at all) and the vendor pages with the
//   date they were read. Each adapter spec's scopes block points at its manifest entry and
//   uses the same exposure kind.
// - Where the vendor exposes them, a credential holding any write scope or role beyond the
//   manifest is refused (SCOPE_REFUSED, exit 1): Slack from x-oauth-scopes before the first
//   answer is used, Google Workspace from the token response before any read, Fleet from
//   /api/v1/fleet/me before the first read. The refusal names the scopes; the answer is
//   never returned and no later request is sent.
// - Where the vendor does not expose them (Linear, Jira, Jamf Pro), the first result says
//   so in scope_notice, and the manifest says so.
// - The preflight is on for a person running a CLI (no injected transport) and in any test
//   that asks for it.
// - scripts/adapters/scopes.js prints a connector's manifest entry (dry) and refuses an
//   unknown connector.
// Run: node --test scripts/adapters/scope-preflight.test.js

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const contract = require('./readonly-contract.js');
const fleet = require('./fleet-client.js');
const slack = require('./slack-client.js');
const gws = require('./gws-client.js');
const linear = require('./linear-client.js');
const jamf = require('./jamf-client.js');
const jira = require('../jira-client.js');

const { STATES } = contract;
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, 'scope-manifest.json'), 'utf8'));
const TOKEN = ['sentinel', 'scope', 'credential', String(13 * 577)].join('-');
const at = (user, domain) => [user, domain].join('@');

function queued(replies) {
  const calls = [];
  const transport = async (request) => {
    calls.push(request);
    const next = replies.length ? replies.shift() : { status: 500, body: '{}' };
    if (next instanceof Error) throw next;
    return { status: next.status, headers: next.headers || {}, body: typeof next.body === 'string' ? next.body : JSON.stringify(next.body || {}) };
  };
  transport.calls = calls;
  return transport;
}
const ok = (body, headers = {}) => ({ status: 200, headers, body });

test('the manifest names every connector: least-privilege reads, how scopes are exposed, and dated vendor sources', () => {
  for (const name of ['fleet', 'jamf', 'slack', 'slack-access-logs', 'linear', 'google-workspace', 'jira']) {
    const entry = MANIFEST.connectors[name];
    assert.ok(entry, `${name}: manifest entry`);
    assert.ok(Array.isArray(entry.least_privilege) && entry.least_privilege.length > 0, `${name}: least privilege`);
    assert.ok(['header', 'token', 'route', 'none'].includes(entry.exposure.kind), `${name}: exposure kind`);
    assert.ok(typeof entry.exposure.how === 'string' && entry.exposure.how.length > 20, `${name}: says how (or that it is not exposed)`);
    assert.ok(Array.isArray(entry.sources) && entry.sources.length > 0, `${name}: sources`);
    for (const s of entry.sources) {
      assert.match(s.url, /^https:\/\//, `${name}: source url`);
      assert.match(s.read_on, /^2026-\d{2}-\d{2}$/, `${name}: read date`);
      assert.ok(['vendor docs page', 'vendor repo', 'search excerpt'].includes(s.how), `${name}: how read`);
    }
  }
  const specs = { fleet: fleet.SPEC, slack: slack.SPEC, 'slack-access-logs': slack.ACCESS_LOGS_SPEC, linear: linear.SPEC, 'google-workspace': gws.SPEC, jamf: jamf.SPEC, jira: jira.JIRA_SPEC };
  for (const [name, spec] of Object.entries(specs)) {
    assert.ok(spec.scopes, `${name}: the spec has a scopes block`);
    assert.equal(spec.scopes.manifest, name, `${name}: points at its manifest entry`);
    assert.equal(spec.scopes.kind, MANIFEST.connectors[name].exposure.kind, `${name}: same exposure kind as the manifest`);
  }
});

test('Slack: a token whose x-oauth-scopes holds a write scope is refused before its answer is used, and nothing more is sent', async () => {
  const env = { SLACK_TOKEN: TOKEN, SLACK_TEAM_ID: 'T0OURS0001' };
  const body = { ok: true, team: { id: 'T0OURS0001', name: 'workspace' } };
  const t = queued([ok(body, { 'x-oauth-scopes': 'users:read,team:read,chat:write' }), ok(body)]);
  const c = contract.createClient(slack.SPEC, { env, transport: t, scopePreflight: true, sleep: async () => {} });
  const r = await c.get('team.info');
  assert.equal(r.state, STATES.SCOPE_REFUSED);
  assert.deepEqual(r.write_scopes, ['chat:write']);
  assert.equal(r.data, undefined);
  const again = await c.get('team.info');
  assert.equal(again.state, STATES.SCOPE_REFUSED, 'the refusal holds for the client');
  assert.equal(t.calls.length, 1, 'no second request with a refused credential');
  assert.equal(contract.exitCodeFor(r), contract.EXIT.INPUT);

  const good = queued([ok(body, { 'X-OAuth-Scopes': 'users:read, team:read, channels:history, admin.apps:read' })]);
  const cg = contract.createClient(slack.SPEC, { env, transport: good, scopePreflight: true, sleep: async () => {} });
  const rg = await cg.get('team.info');
  assert.equal(rg.state, STATES.OK);
  assert.equal(rg.scope_notice, undefined);

  const none = queued([ok(body)]);
  const rn = await contract.createClient(slack.SPEC, { env, transport: none, scopePreflight: true, sleep: async () => {} }).get('team.info');
  assert.equal(rn.state, STATES.OK);
  assert.match(rn.scope_notice, /did not return|not exposed|could not be read/i, 'a missing header is said on first use');

  const logs = queued([ok({ ok: true, team_id: 'T0OURS0001' }, { 'x-oauth-scopes': 'admin' })]);
  const rl = await contract.createClient(slack.ACCESS_LOGS_SPEC, { env: { SLACK_ACCESS_LOGS_TOKEN: TOKEN, SLACK_TEAM_ID: 'T0OURS0001' }, transport: logs, scopePreflight: true, sleep: async () => {} }).get('auth.test');
  assert.equal(rl.state, STATES.OK, 'the access-logs token may hold admin, as its manifest entry says');
});

test('Google Workspace: a token response that grants a write scope is refused before any read', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const env = { GWS_SA_CLIENT_EMAIL: at('svc', 'project.iam.gserviceaccount.com'), GWS_SA_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }), GWS_ADMIN_SUBJECT: at('admin', 'example.com'), GWS_CUSTOMER_ID: 'C0test1' };
  const write = queued([ok({ access_token: 'issued', expires_in: 3599, scope: 'https://www.googleapis.com/auth/admin.directory.user.readonly https://www.googleapis.com/auth/admin.directory.user' }), ok({ users: [] })]);
  const r = await contract.createClient(gws.SPEC, { env, transport: write, scopePreflight: true, sleep: async () => {} }).get('users');
  assert.equal(r.state, STATES.SCOPE_REFUSED, JSON.stringify(r));
  assert.deepEqual(r.write_scopes, ['https://www.googleapis.com/auth/admin.directory.user']);
  assert.equal(write.calls.length, 1, 'only the token exchange');
  const read = queued([ok({ access_token: 'issued', expires_in: 3599, scope: 'https://www.googleapis.com/auth/admin.directory.user.readonly' }), ok({ users: [{ customerId: 'C0test1' }] })]);
  const rr = await contract.createClient(gws.SPEC, { env, transport: read, scopePreflight: true, sleep: async () => {} }).get('users');
  assert.equal(rr.state, STATES.OK, JSON.stringify(rr));
});

test('Fleet: the API user\'s role is read from /me first; any role beyond observer is refused, and observer reads proceed', async () => {
  const env = { FLEET_URL: 'fleet.example.invalid', FLEET_API_TOKEN: TOKEN };
  for (const [user, refused] of [
    [{ global_role: 'admin', teams: [] }, ['global:admin']],
    [{ global_role: 'observer_plus', teams: [] }, ['global:observer_plus']],
    [{ global_role: null, teams: [{ id: 2, role: 'maintainer' }], fleets: [{ id: 2, role: 'maintainer' }] }, ['team:maintainer']],
    [{ global_role: 'gitops', teams: [] }, ['global:gitops']],
  ]) {
    const t = queued([ok({ user }), ok({ version: '4.60.0' })]);
    const r = await contract.createClient(fleet.SPEC, { env, transport: t, scopePreflight: true, sleep: async () => {} }).get('version');
    assert.equal(r.state, STATES.SCOPE_REFUSED, JSON.stringify(user));
    assert.deepEqual(r.write_scopes, refused);
    assert.equal(t.calls.length, 1);
    assert.equal(t.calls[0].path, '/api/v1/fleet/me');
  }
  const t = queued([ok({ user: { global_role: 'observer', teams: [] } }), ok({ version: '4.60.0' })]);
  const r = await contract.createClient(fleet.SPEC, { env, transport: t, scopePreflight: true, sleep: async () => {} }).get('version');
  assert.equal(r.state, STATES.OK);
  assert.deepEqual(t.calls.map((c) => c.path), ['/api/v1/fleet/me', '/api/v1/fleet/version']);
});

test('Linear, Jira and Jamf Pro do not expose a credential\'s scopes: the first result says so and no extra request is made', async () => {
  const lin = queued([ok({ data: { viewer: { id: 'u1', admin: false, guest: false, owner: false, organization: { urlKey: 'org-a' } }, organization: { urlKey: 'org-a' } } })]);
  const rl = await contract.createClient(linear.SPEC, { env: { LINEAR_API_KEY: TOKEN, LINEAR_ORG: 'org-a' }, transport: lin, scopePreflight: true, sleep: async () => {} }).graphql('AegisViewer');
  assert.equal(rl.state, STATES.OK);
  assert.match(rl.scope_notice, /Linear does not expose/);
  assert.equal(lin.calls.length, 1);

  const ji = queued([ok({ issueKey: 'HELP-1' })]);
  const rj = await contract.createClient(jira.JIRA_SPEC, { env: { JIRA_SITE: 'example.atlassian.net', JIRA_EMAIL: at('api', 'example.org'), JIRA_API_TOKEN: TOKEN }, transport: ji, scopePreflight: true, sleep: async () => {} }).get('request', { issue: 'HELP-1' });
  assert.equal(rj.state, STATES.OK);
  assert.match(rj.scope_notice, /Jira does not expose/);

  const ja = queued([ok({ access_token: 'issued', expires_in: 600, scope: 'api-role:7' }), ok({ version: '11.10.0' })]);
  const rja = await contract.createClient(jamf.SPEC, { env: { JAMF_URL: 'jamf.example.invalid', JAMF_CLIENT_ID: 'client-id', JAMF_CLIENT_SECRET: TOKEN }, transport: ja, scopePreflight: true, sleep: async () => {} }).get('version');
  assert.equal(rja.state, STATES.OK);
  assert.match(rja.scope_notice, /Jamf Pro does not expose/);
  assert.equal(ja.calls.length, 2, 'the token exchange and the read only');
});

test('the preflight is on by default for a person running a CLI and off for an injected test transport unless asked', async () => {
  const { cliDeps } = require('./cli-support.js');
  assert.equal(cliDeps({}, {}).scopePreflight, true);
  assert.equal(cliDeps({ transport: async () => ({}) }, {}).scopePreflight, false);
  assert.equal(cliDeps({ transport: async () => ({}), scopePreflight: true }, {}).scopePreflight, true);
  const t = queued([ok({ user: { global_role: 'admin', teams: [] } }), ok({ version: '4.60.0' })]);
  const out = [];
  const code = await fleet.run(['version', '--execute'], { FLEET_URL: 'fleet.example.invalid', FLEET_API_TOKEN: TOKEN }, { transport: t, scopePreflight: true, out: (s) => out.push(s), err: (s) => out.push(s), sleep: async () => {} });
  assert.equal(code, 1);
  const text = out.join('');
  assert.match(text, /"state": "SCOPE_REFUSED"/);
  assert.match(text, /"operator_message": "The Fleet credential holds write permissions/);
  assert.ok(!text.includes(TOKEN));
});

test('scopes.js prints a connector\'s manifest entry and refuses an unknown connector', () => {
  const cli = path.join(__dirname, 'scopes.js');
  const r = spawnSync(process.execPath, [cli, 'slack'], { encoding: 'utf8', env: { ...process.env, AEGIS_NETWORK_TRIPWIRE: '1' } });
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(r.stdout);
  assert.equal(json.connector, 'slack');
  assert.equal(json.exposure.kind, 'header');
  assert.match(json.note, /dry run/i);
  const bad = spawnSync(process.execPath, [cli, 'not-a-connector'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
});
