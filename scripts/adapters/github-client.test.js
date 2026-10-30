'use strict';
// github-client.test.js: the read-only GitHub connector (batch G3, task 5a).
//
// EXPECTED DECISION (written before the code)
// - SPEC: one fixed host, api.github.com; every route is a GET; one credential,
//   GITHUB_TOKEN, sent only as "Authorization: Bearer", with the GitHub JSON media type,
//   an API version header and a User-Agent. No token exchange. Any non-GET request is
//   REFUSED before the credential is read.
// - The organization always comes from GITHUB_ORG: every org and repository path is built
//   from it, no command takes an org, and a response that names another organization
//   (a membership, an alert's repository owner, a team's address, the org itself) is
//   TENANT_MISMATCH with nothing returned.
// - Scope preflight (scope-manifest.json "github", kind header): a classic token whose
//   X-OAuth-Scopes holds anything but read:* scopes (repo, admin:org, security_events,
//   write:*) is SCOPE_REFUSED on the first answer and nothing more is sent; a token that
//   returns no X-OAuth-Scopes (fine-grained or App tokens) gets a scope_notice.
// - Every command is a dry run unless --execute: it prints the planned GET and reads no
//   credential. Reads print the answer; verify-* read-backs print verified true or false
//   with the reason, exit 0 when verified and 2 when not.
// - verify-offboarded proves absence only after a read that shows the credential can see
//   the organization; list read-backs walk at most 10 pages and say "not proof" past it.
// - A failure prints the two-part operator message (platform GitHub), never a body or the
//   token; the token never appears in any output.
// Run: node --test scripts/adapters/github-client.test.js

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const test = require('node:test');

const gh = require('./github-client.js');
const contract = require('./readonly-contract.js');

const { STATES } = contract;
const TOKEN = ['sentinel', 'gh', 'credential', String(7 * 1301)].join('-');
const ENV = Object.freeze({ GITHUB_ORG: 'org-a', GITHUB_TOKEN: TOKEN });

function queued(replies) {
  const calls = [];
  const transport = async (request) => {
    calls.push(request);
    const next = replies.length ? replies.shift() : { status: 500, body: '{}' };
    return { status: next.status, headers: next.headers || {}, body: typeof next.body === 'string' ? next.body : JSON.stringify(next.body === undefined ? {} : next.body) };
  };
  transport.calls = calls;
  return transport;
}
const ok = (body, headers = {}) => ({ status: 200, headers, body });
const notFound = () => ({ status: 404, body: { message: 'Not Found' } });

async function cli(argv, { env = ENV, replies = [], extra = {} } = {}) {
  const transport = queued(replies);
  const out = [];
  const err = [];
  const code = await gh.run(argv, env, { transport, sleep: async () => {}, out: (s) => out.push(String(s)), err: (s) => err.push(String(s)), ...extra });
  const text = out.join('') + err.join('');
  const first = (s) => { const i = s.indexOf('{'); return i === -1 ? null : JSON.parse(s.slice(i, s.lastIndexOf('}') + 1)); };
  return { code, stdout: out.join(''), stderr: err.join(''), text, json: first(out.join('') || err.join('')), transport };
}

const user = (login) => ({ login, id: 1000 + login.length, type: 'User', site_admin: false });

test('SPEC: fixed host, GET-only routes, one bearer credential with GitHub headers, no token exchange, header scopes', () => {
  const s = gh.SPEC;
  assert.deepEqual(s.host, { fixed: 'api.github.com' });
  assert.deepEqual(s.credentials, ['GITHUB_TOKEN']);
  assert.equal(s.tokenExchange, null);
  assert.equal(s.tenant.env, 'GITHUB_ORG');
  for (const [name, route] of Object.entries(s.routes)) assert.equal(route.method, 'GET', name);
  assert.equal(s.scopes.kind, 'header');
  assert.equal(s.scopes.header, 'x-oauth-scopes');
  assert.equal(s.scopes.manifest, 'github');
  const headers = s.auth({ GITHUB_TOKEN: TOKEN });
  assert.equal(headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(headers.Accept, 'application/vnd.github+json');
  assert.match(headers['X-GitHub-Api-Version'], /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(headers['User-Agent']);
  for (const [k, v] of Object.entries(headers)) if (k !== 'Authorization') assert.ok(!String(v).includes(TOKEN), k);
});

test('a non-GET request is refused before the credential is read; no org flag exists', async () => {
  const t = queued([]);
  const client = contract.createClient(gh.SPEC, { env: { GITHUB_ORG: 'org-a' }, transport: t });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const r = await client.send({ method, path: '/orgs/org-a/members/someone' });
    assert.equal(r.state, STATES.REFUSED, method);
  }
  assert.equal(t.calls.length, 0);
  const r = await cli(['members', '--org', 'org-b', '--execute']);
  assert.equal(r.code, 1);
  assert.equal(r.transport.calls.length, 0);
});

test('each read sends one GET to the path built from GITHUB_ORG, with the token only in Authorization', async () => {
  const cases = [
    [['org'], '/orgs/org-a', { login: 'org-a', repos_url: 'https://api.github.com/orgs/org-a/repos' }],
    [['members', '--filter', '2fa_disabled'], '/orgs/org-a/members?per_page=100&filter=2fa_disabled', [user('a1')]],
    [['membership', '--user', 'new-starter'], '/orgs/org-a/memberships/new-starter', { state: 'active', role: 'member', organization: { login: 'org-a' } }],
    [['teams'], '/orgs/org-a/teams?per_page=100', [{ slug: 'docs', html_url: 'https://github.com/orgs/org-a/teams/docs' }]],
    [['team-members', '--team', 'docs'], '/orgs/org-a/teams/docs/members?per_page=100', [user('a1')]],
    [['outside-collaborators'], '/orgs/org-a/outside_collaborators?per_page=100', []],
    [['invitations'], '/orgs/org-a/invitations?per_page=100', []],
    [['collaborators', '--repo', 'docs', '--affiliation', 'direct'], '/repos/org-a/docs/collaborators?per_page=100&affiliation=direct', [user('a1')]],
    [['permission', '--repo', 'docs', '--user', 'new-starter'], '/repos/org-a/docs/collaborators/new-starter/permission', { permission: 'read', role_name: 'read', user: user('new-starter') }],
    [['protection', '--repo', 'docs', '--branch', 'main'], '/repos/org-a/docs/branches/main/protection', { url: 'https://api.github.com/repos/org-a/docs/branches/main/protection' }],
    [['rulesets', '--repo', 'docs'], '/repos/org-a/docs/rulesets?includes_parents=true', [{ id: 1, source: 'org-a/docs', source_type: 'Repository' }]],
    [['branch-rules', '--repo', 'docs', '--branch', 'release/1.0'], '/repos/org-a/docs/rules/branches/release%2F1.0', []],
    [['audit-log', '--phrase', 'action:org.remove_member'], '/orgs/org-a/audit-log?per_page=100&phrase=action%3Aorg.remove_member', []],
    [['sso-authorizations'], '/orgs/org-a/credential-authorizations?per_page=100', []],
    [['secret-alerts', '--state', 'open'], '/orgs/org-a/secret-scanning/alerts?per_page=100&state=open', [{ number: 3, repository: { owner: { login: 'org-a' } } }]],
    [['secret-alert', '--repo', 'docs', '--number', '3'], '/repos/org-a/docs/secret-scanning/alerts/3', { number: 3, state: 'open' }],
    [['dependabot-alerts', '--severity', 'critical'], '/orgs/org-a/dependabot/alerts?per_page=100&severity=critical', []],
    [['dependabot-alert', '--repo', 'docs', '--number', '9'], '/repos/org-a/docs/dependabot/alerts/9', { number: 9, state: 'open' }],
  ];
  for (const [argv, path, body] of cases) {
    const r = await cli([...argv, '--execute'], { replies: [ok(body)] });
    assert.equal(r.code, 0, `${argv[0]}: ${r.text}`);
    assert.equal(r.transport.calls.length, 1, argv[0]);
    const call = r.transport.calls[0];
    assert.equal(call.method, 'GET', argv[0]);
    assert.equal(call.hostname, 'api.github.com', argv[0]);
    assert.equal(call.path, path, argv[0]);
    assert.equal(call.headers.Authorization, `Bearer ${TOKEN}`);
    assert.ok(!r.text.includes(TOKEN), `${argv[0]}: token printed`);
  }
});

test('issue reads the issue and its comments and prints the {issue, comments} shape the intake imports', async () => {
  const issue = { number: 7, title: 'Printer', body: 'Jammed', repository_url: 'https://api.github.com/repos/org-a/helpdesk', html_url: 'https://github.com/org-a/helpdesk/issues/7' };
  const r = await cli(['issue', '--repo', 'helpdesk', '--number', '7', '--execute'], { replies: [ok(issue), ok([{ body: 'Same here' }])] });
  assert.equal(r.code, 0, r.text);
  assert.deepEqual(r.transport.calls.map((c) => c.path), ['/repos/org-a/helpdesk/issues/7', '/repos/org-a/helpdesk/issues/7/comments?per_page=100']);
  assert.equal(r.json.data.issue.title, 'Printer');
  assert.equal(r.json.data.comments[0].body, 'Same here');
});

test('a dry run prints the planned GET, reads no credential and sends nothing', async () => {
  const r = await cli(['protection', '--repo', 'docs', '--branch', 'main'], { env: { GITHUB_ORG: 'org-a' } });
  assert.equal(r.code, 0, r.text);
  assert.equal(r.transport.calls.length, 0);
  assert.equal(r.json.path, '/repos/org-a/docs/branches/main/protection');
  assert.match(r.json.note, /dry run/);
  const unbound = await cli(['org'], { env: {} });
  assert.equal(unbound.code, 1, 'GITHUB_ORG must be set even for a dry run');
});

test('bad values are refused before anything is sent', async () => {
  for (const argv of [['permission', '--repo', '../x', '--user', 'a'], ['permission', '--repo', 'docs', '--user', 'bad user'], ['protection', '--repo', 'docs', '--branch', 'a/../b'],
    ['secret-alert', '--repo', 'docs', '--number', 'x'], ['members', '--filter', 'everyone'], ['verify-collaborator', '--repo', 'docs', '--user', 'a', '--role', 'owner'], ['delete-repo', '--repo', 'docs']]) {
    const r = await cli([...argv, '--execute']);
    assert.equal(r.code, 1, argv.join(' '));
    assert.equal(r.transport.calls.length, 0, argv.join(' '));
  }
});

test('a response that names another organization is TENANT_MISMATCH and nothing is returned', async () => {
  const cases = [
    [['membership', '--user', 'x'], { state: 'active', role: 'member', organization: { login: 'org-b' } }],
    [['secret-alerts'], [{ number: 1, repository: { owner: { login: 'org-b' } } }]],
    [['teams'], [{ slug: 'docs', html_url: 'https://github.com/orgs/org-b/teams/docs' }]],
    [['org'], { login: 'org-b', repos_url: 'https://api.github.com/orgs/org-b/repos' }],
    [['protection', '--repo', 'docs', '--branch', 'main'], { url: 'https://api.github.com/repos/org-b/docs/branches/main/protection' }],
  ];
  for (const [argv, body] of cases) {
    const r = await cli([...argv, '--execute'], { replies: [ok(body)] });
    assert.equal(r.code, 3, `${argv[0]}: ${r.text}`);
    assert.equal(r.json.state, STATES.TENANT_MISMATCH);
    assert.equal(r.json.data, undefined);
  }
});

test('scope preflight: a classic token with a write scope is refused on the first answer; read:* passes; no header gets a notice', async () => {
  const body = { login: 'org-a', repos_url: 'https://api.github.com/orgs/org-a/repos' };
  for (const scopes of ['repo, read:org', 'admin:org', 'read:org, security_events', 'write:packages']) {
    const r = await cli(['org', '--execute'], { replies: [ok(body, { 'x-oauth-scopes': scopes }), ok(body)], extra: { scopePreflight: true } });
    assert.equal(r.code, 1, scopes);
    assert.equal(r.json.state, STATES.SCOPE_REFUSED, scopes);
    assert.equal(r.json.data, undefined);
    assert.equal(r.transport.calls.length, 1);
    assert.match(r.json.operator_message, /GitHub credential holds write permissions/);
  }
  const good = await cli(['org', '--execute'], { replies: [ok(body, { 'X-OAuth-Scopes': 'read:org, read:audit_log' })], extra: { scopePreflight: true } });
  assert.equal(good.code, 0, good.text);
  assert.equal(good.json.scope_notice, undefined);
  for (const headers of [{}, { 'x-oauth-scopes': '' }]) {
    const fine = await cli(['org', '--execute'], { replies: [ok(body, headers)], extra: { scopePreflight: true } });
    assert.equal(fine.code, 0, fine.text);
    assert.match(fine.json.scope_notice, /GitHub did not return the granted scopes/);
  }
});

test('verify-collaborator: the role_name must equal the expected role', async () => {
  const yes = await cli(['verify-collaborator', '--repo', 'docs', '--user', 'New-Starter', '--role', 'read', '--execute'], { replies: [ok({ permission: 'read', role_name: 'read', user: user('new-starter') })] });
  assert.equal(yes.code, 0, yes.text);
  assert.equal(yes.json.verified, true);
  const no = await cli(['verify-collaborator', '--repo', 'docs', '--user', 'new-starter', '--role', 'read', '--execute'], { replies: [ok({ permission: 'write', role_name: 'maintain', user: user('new-starter') })] });
  assert.equal(no.code, 2);
  assert.equal(no.json.verified, false);
  assert.match(no.json.reason, /maintain/);
});

// A full page (100 records) means another page may follow; a shorter page is the last.
const fullPage = (prefix) => ok(Array.from({ length: 100 }, (_, i) => user(`${prefix}${i}`)));

test('verify-collaborator-removed: absent from every page of direct collaborators; a list past 10 pages is not proof', async () => {
  const page = (logins) => ok(logins.map(user));
  const gone = await cli(['verify-collaborator-removed', '--repo', 'docs', '--user', 'leaver', '--execute'], { replies: [fullPage('a'), page(['b1'])] });
  assert.equal(gone.code, 0, gone.text);
  assert.equal(gone.json.verified, true);
  assert.deepEqual(gone.transport.calls.map((c) => c.path), ['/repos/org-a/docs/collaborators?per_page=100&affiliation=direct', '/repos/org-a/docs/collaborators?per_page=100&affiliation=direct&page=2']);
  const still = await cli(['verify-collaborator-removed', '--repo', 'docs', '--user', 'leaver', '--execute'], { replies: [page(['a1', 'Leaver'])] });
  assert.equal(still.code, 2);
  assert.equal(still.json.verified, false);
  const long = await cli(['verify-collaborator-removed', '--repo', 'docs', '--user', 'leaver', '--execute'], { replies: Array.from({ length: 10 }, (_, i) => fullPage(`p${i}-`)) });
  assert.equal(long.code, 2);
  assert.match(long.json.reason, /not proof/);
  assert.equal(long.transport.calls.length, 10);
});

test('verify-offboarded: the org read must succeed first; then no membership, no invitation, not an outside collaborator', async () => {
  const org = ok({ login: 'org-a', repos_url: 'https://api.github.com/orgs/org-a/repos' });
  const done = await cli(['verify-offboarded', '--user', 'leaver', '--execute'], { replies: [org, notFound(), ok([]), ok([user('a1')])] });
  assert.equal(done.code, 0, done.text);
  assert.equal(done.json.verified, true);
  assert.deepEqual(done.transport.calls.map((c) => c.path), ['/orgs/org-a', '/orgs/org-a/memberships/leaver', '/orgs/org-a/invitations?per_page=100', '/orgs/org-a/outside_collaborators?per_page=100']);
  const member = await cli(['verify-offboarded', '--user', 'leaver', '--execute'], { replies: [org, ok({ state: 'active', role: 'member', organization: { login: 'org-a' } })] });
  assert.equal(member.code, 2);
  assert.match(member.json.reason, /still/);
  const converted = await cli(['verify-offboarded', '--user', 'leaver', '--execute'], { replies: [org, notFound(), ok([]), ok([user('leaver')])] });
  assert.equal(converted.code, 2);
  assert.match(converted.json.reason, /outside collaborator/);
  const invited = await cli(['verify-offboarded', '--user', 'leaver', '--execute'], { replies: [org, notFound(), ok([{ login: 'leaver' }])] });
  assert.equal(invited.code, 2);
  const blind = await cli(['verify-offboarded', '--user', 'leaver', '--execute'], { replies: [notFound()] });
  assert.equal(blind.code, 2, 'a credential that cannot see the org never proves absence');
  assert.equal(blind.transport.calls.length, 1);
});

test('verify-team-member, verify-protection, verify-2fa-required, verify-secret-alert, verify-dependabot-alert', async () => {
  const team = await cli(['verify-team-member', '--team', 'docs', '--user', 'a2', '--execute'], { replies: [ok([user('a1'), user('a2')])] });
  assert.equal(team.json.verified, true, team.text);
  const absent = await cli(['verify-team-member', '--team', 'docs', '--user', 'a2', '--absent', '--execute'], { replies: [ok([user('a1')])] });
  assert.equal(absent.json.verified, true, absent.text);

  const protection = { url: 'https://api.github.com/repos/org-a/docs/branches/main/protection', required_pull_request_reviews: { required_approving_review_count: 2 }, enforce_admins: { enabled: true }, allow_force_pushes: { enabled: false }, allow_deletions: { enabled: false } };
  const p = await cli(['verify-protection', '--repo', 'docs', '--branch', 'main', '--reviews', '2', '--enforce-admins', '--no-force-push', '--no-deletions', '--execute'], { replies: [ok(protection)] });
  assert.equal(p.json.verified, true, p.text);
  const weak = await cli(['verify-protection', '--repo', 'docs', '--branch', 'main', '--reviews', '2', '--no-force-push', '--execute'], { replies: [ok({ ...protection, required_pull_request_reviews: { required_approving_review_count: 1 }, allow_force_pushes: { enabled: true } })] });
  assert.equal(weak.code, 2);
  assert.match(weak.json.reason, /review/);
  const none = await cli(['verify-protection', '--repo', 'docs', '--branch', 'main', '--execute'], { replies: [notFound()] });
  assert.equal(none.code, 2);

  const twoFa = await cli(['verify-2fa-required', '--execute'], { replies: [ok({ login: 'org-a', repos_url: 'https://api.github.com/orgs/org-a/repos', two_factor_requirement_enabled: true })] });
  assert.equal(twoFa.json.verified, true, twoFa.text);
  const hidden = await cli(['verify-2fa-required', '--execute'], { replies: [ok({ login: 'org-a', repos_url: 'https://api.github.com/orgs/org-a/repos' })] });
  assert.equal(hidden.code, 2);
  assert.match(hidden.json.reason, /owner/);

  const sec = await cli(['verify-secret-alert', '--repo', 'docs', '--number', '3', '--state', 'resolved', '--resolution', 'revoked', '--execute'], { replies: [ok({ number: 3, state: 'resolved', resolution: 'revoked' })] });
  assert.equal(sec.json.verified, true, sec.text);
  const fp = await cli(['verify-secret-alert', '--repo', 'docs', '--number', '3', '--state', 'resolved', '--resolution', 'revoked', '--execute'], { replies: [ok({ number: 3, state: 'resolved', resolution: 'false_positive' })] });
  assert.equal(fp.code, 2);
  const dep = await cli(['verify-dependabot-alert', '--repo', 'docs', '--number', '9', '--state', 'dismissed', '--reason', 'tolerable_risk', '--execute'], { replies: [ok({ number: 9, state: 'dismissed', dismissed_reason: 'tolerable_risk' })] });
  assert.equal(dep.json.verified, true, dep.text);
  const fixed = await cli(['verify-dependabot-alert', '--repo', 'docs', '--number', '9', '--state', 'fixed', '--execute'], { replies: [ok({ number: 9, state: 'open' })] });
  assert.equal(fixed.code, 2);
});

test('a failure prints the two-part message for GitHub, with no body and no token', async () => {
  const r = await cli(['org', '--execute'], { replies: [{ status: 401, body: { message: 'Bad credentials', documentation_url: 'x' } }] });
  assert.equal(r.code, 2);
  assert.match(r.json.operator_message, /^GitHub rejected the credential \(HTTP 401\)/);
  assert.match(r.json.admin_detail, /^platform=github operation=org state=HTTP_ERROR status=401/);
  assert.ok(!r.text.includes('Bad credentials'));
  assert.ok(!r.text.includes(TOKEN));
  const missing = await cli(['org', '--execute'], { env: { GITHUB_ORG: 'org-a' } });
  assert.equal(missing.code, 1);
  assert.match(missing.json.operator_message, /GitHub credential is not set/);
});

test('verify-team-member --absent: absence on a list longer than 10 full pages is not proof', async () => {
  const long = await cli(['verify-team-member', '--team', 'docs', '--user', 'leaver', '--absent', '--execute'], { replies: Array.from({ length: 10 }, (_, i) => fullPage(`t${i}-`)) });
  assert.equal(long.code, 2, long.text);
  assert.equal(long.json.verified, false);
  assert.match(long.json.reason, /not proof/);
});
