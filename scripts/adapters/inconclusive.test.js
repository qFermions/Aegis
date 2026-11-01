'use strict';
// inconclusive.test.js: one INCONCLUSIVE verdict state across the nine connectors (batch G4,
// task D1).
//
// EXPECTED DECISION (written before the code)
// - The owner's words: "an answer that proves nothing either way is recorded as INCONCLUSIVE,
//   never counts as a pass or as a failed object, and has the same exit code everywhere".
// - The shared contract (readonly-contract.js) names the state STATES.INCONCLUSIVE and the exit
//   code EXIT.INCONCLUSIVE, 5, the one code no other outcome uses (0 pass, 1 input, 2 read
//   failed or not verified, 3 tenant, 4 a verify-* dry run). exitCodeFor gives 5 for it, and
//   inconclusive(verdict, reason) builds one: state INCONCLUSIVE, ok false, verified false, and
//   the reason.
// - renderResult adds the two-part message: the vendor answered, the answer proves nothing
//   either way, nothing is reported done.
// - The audit trail accepts a verify entry with state INCONCLUSIVE and verified false
//   (audit-log.js checkEntry), and cli-support.js records that state as it is (verdictState).
// - In each of the nine connectors (Fleet, GitHub, Google Workspace, Jamf Pro, Linear,
//   Microsoft Graph, Okta, Slack and Jira) an answer that proves nothing either way exits 5,
//   prints state INCONCLUSIVE with verified false and a reason, and records one verify entry
//   with state INCONCLUSIVE and verified false. The cases: absence on a list cut short, a field
//   the verdict reads that is missing or not in its form, a list answer with no list, a read
//   that cannot judge the object. A list answer with no list used to pass in three read-backs
//   (Microsoft Graph verify-mfa-cleared and verify-group-member --absent, GitHub
//   verify-collaborator-removed): it is INCONCLUSIVE now.
// - An answer that shows the change not done stays exit 2 with state OK (one per connector),
//   also when the list behind it has another page.
// - change-record.js (counted batch change): the uncounted logic lists an INCONCLUSIVE
//   read-back as uncounted with its reason; it is neither in failed nor counted as passed.
// Run: node --test scripts/adapters/inconclusive.test.js

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const contract = require('./readonly-contract.js');
const cliSupport = require('./cli-support.js');
const audit = require('../audit/audit-log.js');

const { STATES, EXIT } = contract;

test('the contract names INCONCLUSIVE and its own exit code, 5, used by no other outcome', () => {
  assert.equal(STATES.INCONCLUSIVE, 'INCONCLUSIVE');
  assert.equal(EXIT.INCONCLUSIVE, 5);
  const others = Object.entries(EXIT).filter(([name]) => name !== 'INCONCLUSIVE').map(([, code]) => code);
  assert.ok(!others.includes(5), 'no other outcome exits 5');
  assert.equal(contract.exitCodeFor({ state: 'INCONCLUSIVE', ok: false, verified: false }), 5);
  // the codes around it are unchanged
  assert.equal(contract.exitCodeFor({ state: 'OK', ok: true, verified: true }), 0);
  assert.equal(contract.exitCodeFor({ state: 'OK', ok: true, verified: false }), 2);
  assert.equal(contract.exitCodeFor({ state: 'INVALID_RESPONSE', ok: false }), 2);
});

test('inconclusive() builds the verdict every connector prints: state INCONCLUSIVE, ok false, verified false, the reason', () => {
  assert.equal(typeof contract.inconclusive, 'function');
  const v = contract.inconclusive({ state: 'OK', ok: true, command: 'verify-x', verified: true, expected: { a: 1 }, observed: { a: null } }, 'the list has another page, so this is not proof either way');
  assert.deepEqual(v, { state: 'INCONCLUSIVE', ok: false, command: 'verify-x', verified: false, expected: { a: 1 }, observed: { a: null }, reason: 'the list has another page, so this is not proof either way' });
});

test('renderResult prints the two-part message for INCONCLUSIVE: an answer that proves nothing either way, nothing reported done', () => {
  const shown = JSON.parse(contract.renderResult({ state: 'INCONCLUSIVE', ok: false, command: 'verify-x', verified: false, reason: 'r' }, { platform: 'okta', operation: 'verify-x' }));
  assert.match(shown.operator_message, /^Okta answered, but the answer proves nothing either way about the change \(INCONCLUSIVE, exit 5\)\./);
  assert.match(shown.operator_message, /not reported done/);
  assert.match(shown.operator_message, /uncounted, not as a failed object/);
  assert.match(shown.admin_detail, /state=INCONCLUSIVE/);
});

test('the audit trail accepts a verify entry with state INCONCLUSIVE and verified false; cli-support records the state as it is', () => {
  assert.doesNotThrow(() => audit.checkEntry({ kind: 'verify', connector: 'okta', command: 'verify-status', verified: false, state: 'INCONCLUSIVE', change: null, run: null, flags: null }));
  assert.equal(cliSupport.verdictState('INCONCLUSIVE'), 'INCONCLUSIVE');
  const recorded = [];
  const sink = (e) => { audit.checkEntry(e); recorded.push(e); return { seq: recorded.length }; };
  const out = cliSupport.recordVerdict(sink, 'okta', { state: 'INCONCLUSIVE', ok: false, command: 'verify-status', verified: false, reason: 'r' }, null, null, []);
  assert.equal(out.state, 'INCONCLUSIVE');
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].state, 'INCONCLUSIVE');
  assert.equal(recorded[0].verified, false);
});

// ── The nine connectors ──────────────────────────────────────────────────────
const NOT_BEFORE = '2026-10-28T09:00:00Z';
const NOW = Date.parse('2026-10-28T12:00:00Z');
const TOKEN = ['sentinel', 'inconclusive', 'credential', String(7 * 617)].join('-');
const at = (user, domain) => [user, domain].join('@');
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const ok = (body) => ({ status: 200, headers: {}, body: JSON.stringify(body) });
const token = (extra = {}) => ok({ access_token: 'issued-access-value', expires_in: 1200, token_type: 'Bearer', ...extra });
const ENV = {
  fleet: { FLEET_URL: 'fleet.example.invalid', FLEET_API_TOKEN: TOKEN },
  github: { GITHUB_ORG: 'example-org', GITHUB_TOKEN: TOKEN },
  gws: { GWS_SA_CLIENT_EMAIL: at('svc', 'project.iam.gserviceaccount.com'), GWS_SA_PRIVATE_KEY: PEM, GWS_ADMIN_SUBJECT: at('admin', 'example.com'), GWS_CUSTOMER_ID: 'C0test1' },
  jamf: { JAMF_URL: 'jamf.example.invalid', JAMF_CLIENT_ID: 'client-id-value', JAMF_CLIENT_SECRET: TOKEN },
  linear: { LINEAR_API_KEY: TOKEN, LINEAR_ORG: 'org-under-test' },
  msgraph: { MS_TENANT_ID: '11111111-2222-4333-8444-555555555555', MS_CLIENT_ID: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', MS_PRIVATE_KEY: PEM, MS_CERT_SHA256: crypto.createHash('sha256').update('fixture certificate').digest('base64url') },
  okta: { OKTA_ORG_URL: 'okta.example.invalid', OKTA_CLIENT_ID: 'client-id-value', OKTA_PRIVATE_KEY: PEM },
  slack: { SLACK_TOKEN: TOKEN, SLACK_TEAM_ID: 'T0OURS0001' },
};
const FILE = { fleet: 'fleet-client.js', github: 'github-client.js', gws: 'gws-client.js', jamf: 'jamf-client.js', linear: 'linear-client.js', msgraph: 'msgraph-client.js', okta: 'okta-client.js', slack: 'slack-client.js' };

const MS_USER = 'aaaaaaaa-0000-4000-8000-000000000001';
const MS_GROUP = 'bbbbbbbb-0000-4000-8000-000000000002';
const OKTA_USER = '00u1abcd2EFGH3ijk4x7';
const RUN = '3f2a9c1e-77b0-4c2b-9d1e-000000000001';
const SERIAL = 'C02TEST0001';
const ghUser = (login) => ({ login, id: login.length, type: 'User' });
const ghFullPage = (prefix) => ok(Array.from({ length: 100 }, (_, i) => ghUser(`${prefix}${i}`)));
const fleetHost = (host) => ok({ host: { id: 7, ...host } });
const fleetActivities = (page) => ok({ activities: [{ id: page + 1, type: 'edited_script', created_at: '2026-10-28T11:00:00Z', details: {} }], meta: { has_next_results: true } });
const jamfHardware = ok({ totalCount: 1, results: [{ id: '7', hardware: { serialNumber: SERIAL } }] });
const linearIssue = (issue) => ok({ data: { issue: { id: 'issue-1', identifier: 'IT-123', ...issue }, organization: { urlKey: 'org-under-test' } } });
const oktaUser = (extra = {}) => ok({ id: OKTA_USER, status: 'ACTIVE', profile: { login: at('user', 'example.com') }, ...extra });
const oktaEvents = (n) => ok(Array.from({ length: n }, (_, i) => ({ uuid: `e${i}`, published: '2026-10-28T09:30:00.000Z', eventType: 'user.account.update_profile', outcome: { result: 'SUCCESS' }, target: [{ id: 'someone-else', type: 'User' }] })));
const gwsUser = (extra = {}) => ok({ kind: 'admin#directory#user', id: '100000000000000000001', primaryEmail: 'person@example.com', customerId: 'C0test1', ...extra });

// Each case: an answer that proves nothing either way, and why.
const CASES = [
  // Fleet
  { c: 'fleet', why: 'no last MDM check-in time on an enrolled host', argv: ['verify-checked-in', '--id', '7', '--not-before', NOT_BEFORE], replies: [fleetHost({ platform: 'darwin', mdm: { enrollment_status: 'On (automatic)' } })] },
  { c: 'fleet', why: 'verify-lock cannot judge an Android host', argv: ['verify-lock', '--id', '7'], replies: [fleetHost({ platform: 'android', mdm: { device_status: 'unlocked', pending_action: '' } })] },
  { c: 'fleet', why: 'verify-wipe cannot judge a Linux host', argv: ['verify-wipe', '--id', '7'], replies: [fleetHost({ platform: 'ubuntu', mdm: { device_status: 'unlocked', pending_action: '' } })] },
  { c: 'fleet', why: 'a script run that has not reported yet', argv: ['verify-script', '--execution-id', RUN], replies: [ok({ execution_id: RUN, host_id: 7, exit_code: null, host_timeout: false, output: '', message: '' })] },
  { c: 'fleet', why: 'ten pages of activities, none older than --not-before, more behind them', argv: ['verify-deleted', '--identifier', SERIAL, '--not-before', NOT_BEFORE], replies: Array.from({ length: 10 }, (_, i) => fleetActivities(i)) },
  // GitHub
  { c: 'github', why: 'the 2FA requirement is not shown', argv: ['verify-2fa-required'], replies: [ok({ login: 'example-org', repos_url: 'https://api.github.com/orgs/example-org/repos' })] },
  { c: 'github', why: 'absent from a list longer than ten pages', argv: ['verify-team-member', '--team', 'docs', '--user', 'leaver', '--absent'], replies: Array.from({ length: 10 }, (_, i) => ghFullPage(`p${i}-`)) },
  { c: 'github', why: 'a collaborator list answer that is not a list (it used to pass)', argv: ['verify-collaborator-removed', '--repo', 'docs', '--user', 'leaver'], replies: [ok({ message: 'not a list' })] },
  { c: 'github', why: 'the role is not shown', argv: ['verify-collaborator', '--repo', 'docs', '--user', 'member1', '--role', 'write'], replies: [ok({ permission: 'write' })] },
  { c: 'github', why: 'the alert state is not shown', argv: ['verify-secret-alert', '--repo', 'docs', '--number', '3', '--state', 'resolved'], replies: [ok({ number: 3 })] },
  // Google Workspace
  { c: 'gws', why: 'the user record leaves suspended out', argv: ['verify-suspended', '--user', 'person@example.com'], replies: [token({ expires_in: 3599 }), gwsUser()] },
  { c: 'gws', why: 'the user record leaves isEnforcedIn2Sv out', argv: ['verify-2sv-enforced', '--user', 'person@example.com'], replies: [token({ expires_in: 3599 }), gwsUser()] },
  { c: 'gws', why: 'the event feed has another page without the event', argv: ['verify-event', '--app', 'admin', '--event', 'CHANGE_PASSWORD', '--user', 'person@example.com', '--not-before', NOT_BEFORE], replies: [token({ expires_in: 3599 }), ok({ kind: 'admin#reports#activities', items: [], nextPageToken: 'next-page-1' })] },
  // Jamf Pro
  { c: 'jamf', why: 'no lastContactTime on the Mac', argv: ['verify-checked-in', '--serial', SERIAL, '--not-before', NOT_BEFORE], replies: [token(), jamfHardware, ok({ totalCount: 1, results: [{ id: '7', general: {} }] })] },
  { c: 'jamf', why: 'the serial filter returned two records', argv: ['verify-checked-in', '--serial', SERIAL, '--not-before', NOT_BEFORE], replies: [token(), ok({ totalCount: 2, results: [{ id: '7', hardware: { serialNumber: SERIAL } }, { id: '8', hardware: { serialNumber: SERIAL } }] })] },
  { c: 'jamf', why: 'a paged member list is not a count', argv: ['verify-group-count', '--id', '12', '--expect', '2'], replies: [token(), ok({ totalCount: 5, members: [{ id: 1 }, { id: 2 }] })] },
  // Linear
  { c: 'linear', why: 'the issue read shows no state', argv: ['verify-state', '--issue', 'IT-123', '--state', 'Done'], replies: [linearIssue({ labels: { nodes: [], pageInfo: { hasNextPage: false } } })] },
  { c: 'linear', why: 'the label is not on the first page of labels and more follow', argv: ['verify-labels', '--issue', 'IT-123', '--has', 'Priority'], replies: [linearIssue({ state: { name: 'Done', type: 'completed' }, labels: { nodes: [{ id: 'l1', name: 'Other' }], pageInfo: { hasNextPage: true } } })] },
  // Microsoft Graph
  { c: 'msgraph', why: 'accountEnabled is not shown', argv: ['verify-account-enabled', '--user', MS_USER, '--enabled', 'false'], replies: [token({ expires_in: 3599 }), ok({ id: MS_USER })] },
  { c: 'msgraph', why: 'a member list answer with no list (it used to pass for --absent)', argv: ['verify-group-member', '--group', MS_GROUP, '--user', MS_USER, '--absent'], replies: [token({ expires_in: 3599 }), ok({})] },
  { c: 'msgraph', why: 'a method list answer with no list (it used to pass)', argv: ['verify-mfa-cleared', '--user', MS_USER], replies: [token({ expires_in: 3599 }), ok({})] },
  { c: 'msgraph', why: 'absent from a method list with another page', argv: ['verify-method-absent', '--user', MS_USER, '--method-id', '3179e48a-750b-4051-897c-87b9720928f7'], replies: [token({ expires_in: 3599 }), ok({ value: [], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/users/x/authentication/methods?$skiptoken=y' })] },
  // Okta
  { c: 'okta', why: 'the user record carries no status', argv: ['verify-status', '--user', OKTA_USER, '--status', 'SUSPENDED'], replies: [token({ scope: 'okta.users.read' }), oktaUser({ status: undefined })] },
  { c: 'okta', why: 'a full page of System Log events without the event', argv: ['verify-sessions-cleared', '--user', OKTA_USER, '--not-before', NOT_BEFORE], replies: [token({ scope: 'okta.logs.read' }), oktaEvents(100)] },
  // Slack
  { c: 'slack', why: 'users.info does not show deleted', argv: ['verify-deactivated', '--user', 'U0TEST0001'], replies: [ok({ ok: true, user: { id: 'U0TEST0001', team_id: 'T0OURS0001' } })] },
  { c: 'slack', why: 'users.info answered without a user record', argv: ['verify-deactivated', '--user', 'U0TEST0001'], replies: [ok({ ok: true })] },
];

function capture() {
  const recorded = [];
  // the sink checks each entry the way the real trail does, so a state it would refuse fails here
  const sink = (e) => { audit.checkEntry(e); recorded.push(e); return { seq: recorded.length }; };
  return { recorded, sink };
}

async function runConnector(c, argv, replies) {
  const mod = require(path.join(__dirname, FILE[c]));
  const queue = replies.slice();
  const out = [];
  const err = [];
  const { recorded, sink } = capture();
  const transport = async () => queue.shift() || { status: 500, headers: {}, body: '{}' };
  const code = await mod.run([...argv, '--execute'], ENV[c], { transport, audit: sink, now: () => NOW, sleep: async () => {}, timeoutMs: 50, out: (s) => out.push(String(s)), err: (s) => err.push(String(s)) });
  const text = out.join('') + err.join('');
  const i = text.indexOf('{');
  let json = null;
  try { json = i === -1 ? null : JSON.parse(text.slice(i, text.indexOf('\n}', i) + 2)); } catch { json = null; }
  return { code, text, json, verifies: recorded.filter((e) => e.kind === 'verify') };
}

for (const k of CASES) {
  test(`${k.c} ${k.argv[0]}: ${k.why} is INCONCLUSIVE (exit 5), never a pass and never a failed object`, async () => {
    const r = await runConnector(k.c, k.argv, k.replies);
    assert.equal(r.code, EXIT.INCONCLUSIVE, r.text);
    assert.ok(r.json, r.text);
    assert.equal(r.json.state, 'INCONCLUSIVE', r.text);
    assert.equal(r.json.verified, false, r.text);
    assert.equal(r.json.ok, false, r.text);
    assert.equal(typeof r.json.reason, 'string', r.text);
    assert.match(r.json.operator_message, /proves nothing either way/, r.text);
    assert.deepEqual(r.verifies.map((e) => [e.command, e.verified, e.state]), [[k.argv[0], false, 'INCONCLUSIVE']], r.text);
  });
}

// An answer that shows the change not done stays a failed object: exit 2, state OK. The first
// two have another page behind them, which does not turn a definite answer into INCONCLUSIVE.
const FAILS = [
  { c: 'msgraph', why: 'a method still listed, with another page behind it', argv: ['verify-mfa-cleared', '--user', MS_USER], replies: [token({ expires_in: 3599 }), ok({ value: [{ '@odata.type': '#microsoft.graph.microsoftAuthenticatorAuthenticationMethod' }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/users/x/authentication/methods?$skiptoken=y' })] },
  { c: 'github', why: 'still a member, on a list longer than ten pages', argv: ['verify-team-member', '--team', 'docs', '--user', 'p0-1', '--absent'], replies: Array.from({ length: 10 }, (_, i) => ghFullPage(`p${i}-`)) },
  { c: 'fleet', why: 'a host checked in before --not-before', argv: ['verify-checked-in', '--id', '7', '--not-before', NOT_BEFORE], replies: [fleetHost({ platform: 'darwin', last_mdm_checked_in_at: '2026-10-27T09:00:00Z', mdm: { enrollment_status: 'On (automatic)' } })] },
  { c: 'gws', why: 'a user not suspended', argv: ['verify-suspended', '--user', 'person@example.com'], replies: [token({ expires_in: 3599 }), gwsUser({ suspended: false })] },
  { c: 'jamf', why: 'a Mac whose last contact is before --not-before', argv: ['verify-checked-in', '--serial', SERIAL, '--not-before', NOT_BEFORE], replies: [token(), jamfHardware, ok({ totalCount: 1, results: [{ id: '7', general: { lastContactTime: '2026-10-20T09:30:00.000Z' } }] })] },
  { c: 'linear', why: 'an issue in another state', argv: ['verify-state', '--issue', 'IT-123', '--state', 'Done'], replies: [linearIssue({ state: { name: 'In Progress', type: 'started' }, labels: { nodes: [], pageInfo: { hasNextPage: false } } })] },
  { c: 'okta', why: 'a user in another status', argv: ['verify-status', '--user', OKTA_USER, '--status', 'SUSPENDED'], replies: [token({ scope: 'okta.users.read' }), oktaUser()] },
  { c: 'slack', why: 'a user not deactivated', argv: ['verify-deactivated', '--user', 'U0TEST0001'], replies: [ok({ ok: true, user: { id: 'U0TEST0001', team_id: 'T0OURS0001', deleted: false } })] },
];

for (const k of FAILS) {
  test(`${k.c} ${k.argv[0]}: ${k.why} is still a failed object (exit 2, state OK)`, async () => {
    const r = await runConnector(k.c, k.argv, k.replies);
    assert.equal(r.code, EXIT.READ_FAILED, r.text);
    assert.equal(r.json.state, 'OK', r.text);
    assert.equal(r.json.verified, false, r.text);
    assert.deepEqual(r.verifies.map((e) => [e.verified, e.state]), [[false, 'OK']], r.text);
  });
}

// Jira: the same state and exit code, recorded the same way.
const JIRA_ENV = { JIRA_SITE: 'example.atlassian.net', JIRA_EMAIL: at('api', 'example.org'), JIRA_API_TOKEN: TOKEN };
async function runJira(argv, body) {
  const jira = require('../jira-client.js');
  const out = [];
  const { recorded, sink } = capture();
  const transport = async () => ok(body);
  const code = await jira.run([...argv, '--execute'], JIRA_ENV, { transport, audit: sink, timeoutMs: 50, sleep: async () => {}, out: (s) => out.push(String(s)), err: (s) => out.push(String(s)) });
  return { code, text: out.join('\n'), verifies: recorded.filter((e) => e.kind === 'verify') };
}
const TRANSITION = ['verify-transition', '--issue', 'HELP-1', '--issue-id', '10001', '--from-version', '1', '--to-status', 'Done'];

test('jira verify-transition: an answer with no status version is INCONCLUSIVE (exit 5), recorded as such', async () => {
  const r = await runJira(TRANSITION, { issueKey: 'HELP-1', issueId: '10001', currentStatus: { status: 'Done', statusDate: {} } });
  assert.equal(r.code, EXIT.INCONCLUSIVE, r.text);
  assert.match(r.text, /state=INCONCLUSIVE/);
  assert.match(r.text, /proves nothing either way/);
  assert.deepEqual(r.verifies.map((e) => [e.command, e.verified, e.state]), [['verify-transition', false, 'INCONCLUSIVE']]);
});

test('jira verify-comment: a comment read-back with no body text is INCONCLUSIVE (exit 5); another comment id stays a failure (exit 2)', async () => {
  const argv = ['verify-comment', '--issue', 'HELP-1', '--comment-id', '501', '--expect-sha256', 'a'.repeat(64), '--not-before', '1000'];
  const r = await runJira(argv, { id: '501', public: false, created: { epochMillis: 2000 } });
  assert.equal(r.code, EXIT.INCONCLUSIVE, r.text);
  assert.deepEqual(r.verifies.map((e) => [e.verified, e.state]), [[false, 'INCONCLUSIVE']]);
  const other = await runJira(argv, { id: '502', body: 'x', public: false, created: { epochMillis: 2000 } });
  assert.equal(other.code, EXIT.READ_FAILED, other.text);
  assert.deepEqual(other.verifies.map((e) => [e.verified, e.state]), [[false, 'OK']]);
});

test('jira verify-transition: a status other than the one expected stays a failure (exit 2, state OK)', async () => {
  const r = await runJira(TRANSITION, { issueKey: 'HELP-1', issueId: '10001', currentStatus: { status: 'In Progress', statusDate: { epochMillis: 2000 } } });
  assert.equal(r.code, EXIT.READ_FAILED, r.text);
  assert.deepEqual(r.verifies.map((e) => [e.verified, e.state]), [[false, 'OK']]);
});

// Every connector builds the state from the one contract: the helper (or, in Jira, the error
// class that maps to it) and the one exit code, never a code of its own.
test('every connector takes INCONCLUSIVE and its exit code from the shared contract', () => {
  for (const file of Object.values(FILE)) {
    const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.match(src, /\binconclusive,\s*\n?\s*\} = require\('\.\/readonly-contract\.js'\)/, `${file} imports inconclusive() from the contract`);
    assert.match(src, /\binconclusive\(/, `${file} builds its INCONCLUSIVE verdicts with inconclusive()`);
    assert.doesNotMatch(src, /exit(?:Code)?\s*[=:]\s*5\b|return 5;/, `${file} never hard-codes 5`);
  }
  const jira = fs.readFileSync(path.join(__dirname, '..', 'jira-client.js'), 'utf8');
  assert.match(jira, /class InconclusiveError extends ContractError/);
  assert.match(jira, /return EXIT\.INCONCLUSIVE;/);
});

// ── Code review round 1 of batch G4 ──────────────────────────────────────────
// Finding 3: change-record.js approve prints approved_at with milliseconds, and the runbooks say
// to run the read-back with --not-before at or after it. Every connector's time bound takes that
// printed form (Microsoft Graph's comparison is tested in msgraph-client.test.js): a dry run of
// each time-bounded read-back with it is a dry run (exit 4), not an input error (exit 1).
const APPROVED_AT = '2026-10-28T09:00:00.412Z';
async function runDry(c, argv) {
  const mod = require(path.join(__dirname, FILE[c]));
  const out = [];
  const transport = async () => { throw new Error('a dry run reads nothing'); };
  const code = await mod.run(argv, ENV[c], { transport, now: () => NOW, sleep: async () => {}, out: (s) => out.push(String(s)), err: (s) => out.push(String(s)) });
  return { code, text: out.join('') };
}
const TIME_BOUNDED = [
  ['fleet', ['verify-checked-in', '--id', '7', '--not-before', APPROVED_AT]],
  ['fleet', ['verify-deleted', '--identifier', SERIAL, '--not-before', APPROVED_AT]],
  ['gws', ['verify-event', '--app', 'admin', '--event', 'CHANGE_PASSWORD', '--user', 'person@example.com', '--not-before', APPROVED_AT]],
  ['jamf', ['verify-checked-in', '--serial', SERIAL, '--not-before', APPROVED_AT]],
  ['jamf', ['verify-command', '--management-id', '0a1b2c3d-0000-4000-8000-00000000abcd', '--type', 'DEVICE_LOCK', '--not-before', APPROVED_AT]],
  ['linear', ['verify-comment', '--issue', 'IT-123', '--expect-sha256', 'a'.repeat(64), '--not-before', APPROVED_AT]],
  ['msgraph', ['verify-password-changed', '--user', MS_USER, '--not-before', APPROVED_AT]],
  ['msgraph', ['verify-signin', '--user', MS_USER, '--not-before', APPROVED_AT]],
  ['msgraph', ['verify-device-synced', '--device', MS_GROUP, '--not-before', APPROVED_AT]],
  ['msgraph', ['verify-sessions-revoked', '--user', MS_USER, '--not-before', APPROVED_AT]],
  ['okta', ['verify-sessions-cleared', '--user', OKTA_USER, '--not-before', APPROVED_AT]],
  ['okta', ['verify-password-reset', '--user', OKTA_USER, '--not-before', APPROVED_AT]],
  ['slack', ['verify-posted', '--channel', 'C0TEST0001', '--expect-sha256', 'a'.repeat(64), '--not-before', APPROVED_AT]],
];
for (const [c, argv] of TIME_BOUNDED) {
  test(`code review round 1, finding 3: ${c} ${argv[0]} takes --not-before as approved_at prints it, with milliseconds`, async () => {
    const r = await runDry(c, argv);
    assert.equal(r.code, EXIT.VERIFY_DRY_RUN, r.text);
  });
}

// One read-back's verdict, with what it printed and the verify entry it recorded.
async function verdictOf(c, argv, replies) {
  const r = await runConnector(c, argv, replies);
  return { ...r, entry: r.verifies.map((e) => [e.verified, e.state]) };
}
function assertFailedObject(r) {
  assert.equal(r.code, EXIT.READ_FAILED, r.text);
  assert.equal(r.json.state, 'OK', r.text);
  assert.equal(r.json.verified, false, r.text);
  assert.equal(typeof r.json.reason === 'string' || typeof r.json.note === 'string', true, r.text);
  assert.deepEqual(r.entry, [[false, 'OK']], r.text);
}
function assertInconclusive(r) {
  assert.equal(r.code, EXIT.INCONCLUSIVE, r.text);
  assert.equal(r.json.state, 'INCONCLUSIVE', r.text);
  assert.equal(r.json.verified, false, r.text);
  assert.equal(typeof r.json.reason, 'string', r.text);
  assert.deepEqual(r.entry, [[false, 'INCONCLUSIVE']], r.text);
}

// Finding 6: dismissed_reason null is GitHub's own value for an alert that was not dismissed, so
// with --reason it is an answer that shows the change not done (exit 2), not INCONCLUSIVE. Only a
// field left out of the answer, or one that is neither null nor text, proves nothing either way.
const DEPENDABOT = (state, reason) => ['verify-dependabot-alert', '--repo', 'docs', '--number', '9', '--state', state, '--reason', reason];
test('code review round 1, finding 6: github verify-dependabot-alert --state fixed --reason: dismissed_reason null (not dismissed) is a failed object (exit 2)', async () => {
  assertFailedObject(await verdictOf('github', DEPENDABOT('fixed', 'tolerable_risk'), [ok({ number: 9, state: 'fixed', dismissed_reason: null })]));
});
test('code review round 1, finding 6: github verify-dependabot-alert --state dismissed --reason: dismissed_reason null is a failed object (exit 2)', async () => {
  assertFailedObject(await verdictOf('github', DEPENDABOT('dismissed', 'tolerable_risk'), [ok({ number: 9, state: 'dismissed', dismissed_reason: null })]));
});
test('code review round 1, finding 6: github verify-dependabot-alert --reason: dismissed_reason left out of the answer is INCONCLUSIVE (exit 5)', async () => {
  assertInconclusive(await verdictOf('github', DEPENDABOT('dismissed', 'tolerable_risk'), [ok({ number: 9, state: 'dismissed' })]));
});
test('code review round 1, finding 6: github verify-dependabot-alert --reason: a dismissed_reason that is neither null nor text is INCONCLUSIVE (exit 5)', async () => {
  assertInconclusive(await verdictOf('github', DEPENDABOT('dismissed', 'tolerable_risk'), [ok({ number: 9, state: 'dismissed', dismissed_reason: 42 })]));
  assertInconclusive(await verdictOf('github', DEPENDABOT('dismissed', 'tolerable_risk'), [ok({ number: 9, state: 'dismissed', dismissed_reason: { reason: 'tolerable_risk' } })]));
});
test('code review round 1, finding 6: github verify-dependabot-alert --reason: another reason stays a failed object and the same reason passes', async () => {
  assertFailedObject(await verdictOf('github', DEPENDABOT('dismissed', 'tolerable_risk'), [ok({ number: 9, state: 'dismissed', dismissed_reason: 'no_bandwidth' })]));
  const pass = await verdictOf('github', DEPENDABOT('dismissed', 'tolerable_risk'), [ok({ number: 9, state: 'dismissed', dismissed_reason: 'tolerable_risk' })]);
  assert.equal(pass.code, EXIT.OK, pass.text);
  assert.deepEqual(pass.entry, [[true, 'OK']], pass.text);
});

// Finding 7: Fleet verify-deleted reads at most ten pages of activities. When more pages exist
// past those read and no manual deletion was found, the manual deletion may sit on the unread
// pages, so the answer proves nothing either way, also when a newer deletion that was not manual
// (an expiration, say) was found on the pages read.
const DELETED = ['verify-deleted', '--identifier', SERIAL, '--not-before', NOT_BEFORE];
const deletion = (triggeredBy, createdAt = '2026-10-28T11:30:00Z') => ({ id: 90, type: 'deleted_host', created_at: createdAt, details: { host_id: 7, host_serial: SERIAL, triggered_by: triggeredBy } });
const activityPage = (activities, more) => ok({ activities, meta: { has_next_results: more } });
test('code review round 1, finding 7: fleet verify-deleted: a non-manual deletion found, more pages unread past the ten read, is INCONCLUSIVE (exit 5)', async () => {
  const pages = [activityPage([deletion('expiration')], true), ...Array.from({ length: 9 }, (_, i) => fleetActivities(i + 1))];
  const r = await verdictOf('fleet', DELETED, pages);
  assertInconclusive(r);
  assert.equal(r.json.observed['activity pages read'], 10, r.text);
});
test('code review round 1, finding 7: fleet verify-deleted: a non-manual deletion found, the feed read to its end or back to --not-before, stays a failed object (exit 2)', async () => {
  assertFailedObject(await verdictOf('fleet', DELETED, [activityPage([deletion('expiration')], false)]));
  assertFailedObject(await verdictOf('fleet', DELETED, [activityPage([deletion('expiration'), { id: 1, type: 'edited_script', created_at: '2026-10-28T08:00:00Z', details: {} }], true)]));
});

// Finding 8: a list answer with no list was read as an empty list, a failed object (exit 2), in
// Fleet verify-deleted (no activities list) and verify-wipe (no results list of MDM commands) and
// in Linear verify-comment and verify-suspended (no nodes or no pageInfo). It proves nothing
// either way (INCONCLUSIVE, exit 5), as D1 made it for GitHub and Microsoft Graph. An empty list
// that is a list stays an answer.
const WIPE = ['verify-wipe', '--id', '7'];
const macWiping = fleetHost({ platform: 'darwin', hardware_serial: SERIAL, mdm: { device_status: 'wiping', pending_action: 'wipe' } });
const windowsWiped = fleetHost({ platform: 'windows', hardware_serial: SERIAL, mdm: { device_status: 'wiped', pending_action: '' } });
const linearData = (data) => ok({ data: { ...data, organization: { urlKey: 'org-under-test' } } });
const COMMENT = ['verify-comment', '--issue', 'IT-123', '--expect-sha256', 'a'.repeat(64), '--not-before', NOT_BEFORE];
const SUSPENDED = ['verify-suspended', '--user', 'user-7'];
const NO_LIST = [
  ['fleet verify-deleted: an activities answer with no activities list', 'fleet', DELETED, [ok({ meta: { has_next_results: false } })]],
  ['fleet verify-deleted: an activities list that is null', 'fleet', DELETED, [ok({ activities: null, meta: { has_next_results: false } })]],
  ['fleet verify-deleted: a later activities page with no list', 'fleet', DELETED, [fleetActivities(0), ok({ meta: { has_next_results: false } })]],
  ['fleet verify-wipe on a Mac: an MDM commands answer with no results list', 'fleet', WIPE, [macWiping, ok({})]],
  ['fleet verify-wipe on Windows: an MDM commands results list that is null', 'fleet', WIPE, [windowsWiped, ok({ results: null })]],
  ['linear verify-comment: a comments connection with no nodes', 'linear', COMMENT, [linearData({ issue: { identifier: 'IT-123', comments: { pageInfo: { hasNextPage: false, endCursor: null } } } })]],
  ['linear verify-comment: an issue with no comments connection', 'linear', COMMENT, [linearData({ issue: { identifier: 'IT-123' } })]],
  ['linear verify-comment: a comments connection with no pageInfo', 'linear', COMMENT, [linearData({ issue: { identifier: 'IT-123', comments: { nodes: [] } } })]],
  ['linear verify-suspended: a users connection with no nodes', 'linear', SUSPENDED, [linearData({ users: { pageInfo: { hasNextPage: false, endCursor: null } } })]],
  ['linear verify-suspended: an answer with no users connection', 'linear', SUSPENDED, [linearData({})]],
  ['linear verify-suspended: a users connection with no pageInfo', 'linear', SUSPENDED, [linearData({ users: { nodes: [{ id: 'user-1', active: true }] } })]],
];
for (const [why, c, argv, replies] of NO_LIST) {
  test(`code review round 1, finding 8: ${why} is INCONCLUSIVE (exit 5), not an empty list`, async () => {
    assertInconclusive(await verdictOf(c, argv, replies));
  });
}
const EMPTY_LIST = [
  ['fleet verify-deleted: an empty activities list, the feed at its end', 'fleet', DELETED, [ok({ activities: [], meta: { has_next_results: false } })]],
  ['fleet verify-wipe on a Mac: an empty results list', 'fleet', WIPE, [macWiping, ok({ results: [] })]],
  ['fleet verify-wipe: a host not wiping, whatever the commands answer holds', 'fleet', WIPE, [fleetHost({ platform: 'darwin', hardware_serial: SERIAL, mdm: { device_status: 'unlocked', pending_action: '' } }), ok({})]],
  ['linear verify-comment: an empty comments list on its last page', 'linear', COMMENT, [linearData({ issue: { identifier: 'IT-123', comments: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } })]],
  ['linear verify-suspended: the member not on the last page', 'linear', SUSPENDED, [linearData({ users: { nodes: [{ id: 'user-1', active: true }], pageInfo: { hasNextPage: false, endCursor: null } } })]],
];
for (const [why, c, argv, replies] of EMPTY_LIST) {
  test(`code review round 1, finding 8: ${why} stays a failed object (exit 2)`, async () => {
    const r = await verdictOf(c, argv, replies);
    // Fleet verify-wipe prints no reason on a Mac that fails (it shows observed against
    // expected), so the reason is checked where the read-back gives one
    if (argv[0] === 'verify-wipe') {
      assert.equal(r.code, EXIT.READ_FAILED, r.text);
      assert.equal(r.json.state, 'OK', r.text);
      assert.equal(r.json.verified, false, r.text);
      assert.deepEqual(r.entry, [[false, 'OK']], r.text);
    } else assertFailedObject(r);
  });
}

// Finding 12: a Jamf Pro MDM command of the type asked for, for this Mac, sent after
// --not-before and still Pending (not yet acknowledged, not failed) was a failed object, while
// Fleet reads a script run not reported yet as INCONCLUSIVE. It proves nothing either way: the
// Mac may still acknowledge it. A failed command, or none, stays a failed object.
const JAMF_MID = '0a1b2c3d-0000-4000-8000-00000000abcd';
const JAMF_COMMAND = ['verify-command', '--management-id', JAMF_MID, '--type', 'DEVICE_LOCK', '--not-before', NOT_BEFORE];
const jamfCommand = (over = {}) => ({ uuid: 'cmd-1', clientManagementId: JAMF_MID, command: 'DEVICE_LOCK', status: 'Acknowledged', dateSent: '2026-10-28T09:30:00Z', ...over });
const jamfCommands = (results) => ok({ totalCount: results.length, results });
test('code review round 1, finding 12: jamf verify-command: a matching command sent after --not-before, still Pending, is INCONCLUSIVE (exit 5)', async () => {
  const r = await verdictOf('jamf', JAMF_COMMAND, [token(), jamfCommands([jamfCommand({ status: 'Pending', dateCompleted: null })])]);
  assertInconclusive(r);
  assert.equal(r.json.observed.match, null, r.text);
  assert.match(r.json.reason, /Pending/, r.text);
});
test('code review round 1, finding 12: jamf verify-command: a Pending command beside a failed one is still INCONCLUSIVE; an acknowledged one passes', async () => {
  assertInconclusive(await verdictOf('jamf', JAMF_COMMAND, [token(), jamfCommands([jamfCommand({ uuid: 'cmd-2', status: 'Error' }), jamfCommand({ status: 'Pending' })])]));
  const pass = await verdictOf('jamf', JAMF_COMMAND, [token(), jamfCommands([jamfCommand({ uuid: 'cmd-2', status: 'Pending' }), jamfCommand()])]);
  assert.equal(pass.code, EXIT.OK, pass.text);
  assert.deepEqual(pass.entry, [[true, 'OK']], pass.text);
});
const JAMF_STILL_FAILS = [
  ['a matching command that failed', [jamfCommand({ status: 'Error' })]],
  ['no matching command', []],
  ['a Pending command sent before --not-before', [jamfCommand({ status: 'Pending', dateSent: '2026-10-28T08:59:59Z' })]],
  ['a Pending command for another Mac', [jamfCommand({ status: 'Pending', clientManagementId: 'another-management-id' })]],
  ['a Pending command of another type', [jamfCommand({ status: 'Pending', command: 'ERASE_DEVICE' })]],
];
for (const [why, results] of JAMF_STILL_FAILS) {
  test(`code review round 1, finding 12: jamf verify-command: ${why} stays a failed object (exit 2)`, async () => {
    assertFailedObject(await verdictOf('jamf', JAMF_COMMAND, [token(), jamfCommands(results)]));
  });
}

// ── Code review round 2 of batch G4 ──────────────────────────────────────────
// Finding 1: GitHub verify-protection read enforce_admins, allow_force_pushes and allow_deletions
// through one helper that turned an object without a true or false enabled into false, and a
// missing object into null. So allow_force_pushes: {} passed --no-force-push (a false pass), and
// a missing object was a failed object (exit 2). Each of the three settings a flag asks about
// must show a true or false enabled: when it does not, the answer proves nothing either way
// (INCONCLUSIVE, exit 5). A definite value against the flag stays a failed object (exit 2), also
// beside a setting that is not shown; definite matching values pass, and a setting no flag asks
// about is not read.
const PROTECTION = ['verify-protection', '--repo', 'docs', '--branch', 'main'];
const protectionBody = (over = {}) => ({ url: 'https://api.github.com/repos/example-org/docs/branches/main/protection', required_pull_request_reviews: { required_approving_review_count: 2 }, enforce_admins: { url: 'https://api.github.com/repos/example-org/docs/branches/main/protection/enforce_admins', enabled: true }, allow_force_pushes: { enabled: false }, allow_deletions: { enabled: false }, ...over });
const withoutKey = (key) => { const body = protectionBody(); delete body[key]; return body; };
const PROTECTION_UNSHOWN = [
  ['--no-force-push, allow_force_pushes {} (it used to pass)', ['--no-force-push'], protectionBody({ allow_force_pushes: {} })],
  ['--no-deletions, allow_deletions {} (it used to pass)', ['--no-deletions'], protectionBody({ allow_deletions: {} })],
  ['--no-force-push, allow_force_pushes left out', ['--no-force-push'], withoutKey('allow_force_pushes')],
  ['--no-deletions, allow_deletions left out', ['--no-deletions'], withoutKey('allow_deletions')],
  ['--no-force-push, allow_force_pushes.enabled null', ['--no-force-push'], protectionBody({ allow_force_pushes: { enabled: null } })],
  ['--no-deletions, allow_deletions not an object', ['--no-deletions'], protectionBody({ allow_deletions: false })],
  ['--enforce-admins, enforce_admins without enabled', ['--enforce-admins'], protectionBody({ enforce_admins: { url: 'https://api.github.com/repos/example-org/docs/branches/main/protection/enforce_admins' } })],
  ['--enforce-admins, enforce_admins left out', ['--enforce-admins'], withoutKey('enforce_admins')],
  ['--enforce-admins, enforce_admins.enabled the text "true"', ['--enforce-admins'], protectionBody({ enforce_admins: { enabled: 'true' } })],
  ['all three flags, each setting matching but allow_deletions {}', ['--enforce-admins', '--no-force-push', '--no-deletions'], protectionBody({ allow_deletions: {} })],
];
for (const [why, flags, body] of PROTECTION_UNSHOWN) {
  test(`code review round 2, finding 1: github verify-protection ${why} is INCONCLUSIVE (exit 5)`, async () => {
    assertInconclusive(await verdictOf('github', [...PROTECTION, ...flags], [ok(body)]));
  });
}
test('code review round 2, finding 1: github verify-protection: a definite value against the flag stays a failed object (exit 2), also beside a setting not shown', async () => {
  assertFailedObject(await verdictOf('github', [...PROTECTION, '--no-force-push'], [ok(protectionBody({ allow_force_pushes: { enabled: true } }))]));
  assertFailedObject(await verdictOf('github', [...PROTECTION, '--no-deletions'], [ok(protectionBody({ allow_deletions: { enabled: true } }))]));
  assertFailedObject(await verdictOf('github', [...PROTECTION, '--enforce-admins'], [ok(protectionBody({ enforce_admins: { enabled: false } }))]));
  const mixed = await verdictOf('github', [...PROTECTION, '--no-force-push', '--no-deletions'], [ok(protectionBody({ allow_force_pushes: { enabled: true }, allow_deletions: {} }))]);
  assertFailedObject(mixed);
  assert.match(mixed.json.reason, /force pushes are allowed/, mixed.text);
});
test('code review round 2, finding 1: github verify-protection: definite matching values pass; a setting no flag asks about is not read', async () => {
  const all = await verdictOf('github', [...PROTECTION, '--reviews', '2', '--enforce-admins', '--no-force-push', '--no-deletions'], [ok(protectionBody())]);
  assert.equal(all.code, EXIT.OK, all.text);
  assert.deepEqual(all.entry, [[true, 'OK']], all.text);
  const reviewsOnly = await verdictOf('github', [...PROTECTION, '--reviews', '2'], [ok(protectionBody({ enforce_admins: {}, allow_force_pushes: {}, allow_deletions: {} }))]);
  assert.equal(reviewsOnly.code, EXIT.OK, reviewsOnly.text);
  assert.deepEqual(reviewsOnly.entry, [[true, 'OK']], reviewsOnly.text);
});

// Finding 2: Linear verify-labels read a missing labels connection or nodes list as no labels,
// and a missing pageInfo as the last page, so the label not found was a failed object (exit 2).
// A label list that is not there, or a page that does not say whether more labels follow,
// proves nothing either way (INCONCLUSIVE, exit 5), as verify-comment and verify-suspended
// already read them (round 1, finding 8). The label found on the page passes whatever the
// paging says; the label absent from a page that says it is the last stays exit 2.
const LABELS = ['verify-labels', '--issue', 'IT-123', '--has', 'Priority'];
const labelIssue = (labels) => linearIssue({ state: { name: 'Done', type: 'completed' }, ...(labels === undefined ? {} : { labels }) });
const LABELS_UNPROVEN = [
  ['an issue read with no labels connection', labelIssue(undefined)],
  ['a labels connection with no nodes list', labelIssue({ pageInfo: { hasNextPage: false } })],
  ['a labels nodes list that is null', labelIssue({ nodes: null, pageInfo: { hasNextPage: false } })],
  ['the label not on a page with no pageInfo', labelIssue({ nodes: [{ id: 'l1', name: 'Other' }] })],
  ['the label not on a page whose hasNextPage is not true or false', labelIssue({ nodes: [{ id: 'l1', name: 'Other' }], pageInfo: {} })],
];
for (const [why, reply] of LABELS_UNPROVEN) {
  test(`code review round 2, finding 2: linear verify-labels: ${why} is INCONCLUSIVE (exit 5)`, async () => {
    assertInconclusive(await verdictOf('linear', LABELS, [reply]));
  });
}
test('code review round 2, finding 2: linear verify-labels: the label absent from the last page stays a failed object (exit 2)', async () => {
  assertFailedObject(await verdictOf('linear', LABELS, [labelIssue({ nodes: [{ id: 'l1', name: 'Other' }], pageInfo: { hasNextPage: false } })]));
  assertFailedObject(await verdictOf('linear', LABELS, [labelIssue({ nodes: [], pageInfo: { hasNextPage: false } })]));
});
test('code review round 2, finding 2: linear verify-labels: the label found on the page passes, whatever the paging says', async () => {
  for (const pageInfo of [undefined, { hasNextPage: true }, { hasNextPage: false }]) {
    const r = await verdictOf('linear', LABELS, [labelIssue({ nodes: [{ id: 'l2', name: 'Priority' }], ...(pageInfo ? { pageInfo } : {}) })]);
    assert.equal(r.code, EXIT.OK, r.text);
    assert.deepEqual(r.entry, [[true, 'OK']], r.text);
  }
});

// Finding 3: Fleet verify-deleted treated an activities page without a true or false
// meta.has_next_results as the last page, so no manual deletion found was a failed object
// (exit 2). Such a page does not say the feed ended: unless a manual deletion was already found,
// or the feed was read back to --not-before, it proves nothing either way (INCONCLUSIVE, exit 5).
const newerActivity = { id: 95, type: 'ran_script', created_at: '2026-10-28T11:00:00Z', details: {} };
const olderActivity = { id: 1, type: 'edited_script', created_at: '2026-10-28T08:00:00Z', details: {} };
const DELETED_PAGING_UNKNOWN = [
  ['a page with no meta', ok({ activities: [newerActivity] })],
  ['a page whose meta has no has_next_results', ok({ activities: [newerActivity], meta: {} })],
  ['a page whose has_next_results is the text "false"', ok({ activities: [newerActivity], meta: { has_next_results: 'false' } })],
  ['an empty page with meta null', ok({ activities: [], meta: null })],
  ['a non-manual deletion found on a page with no meta', ok({ activities: [deletion('expiration')] })],
];
for (const [why, page] of DELETED_PAGING_UNKNOWN) {
  test(`code review round 2, finding 3: fleet verify-deleted: ${why}, no manual deletion found, is INCONCLUSIVE (exit 5)`, async () => {
    assertInconclusive(await verdictOf('fleet', DELETED, [page]));
  });
}
test('code review round 2, finding 3: fleet verify-deleted: a page with no meta read back to --not-before stays a failed object (exit 2); a manual deletion found on it passes', async () => {
  assertFailedObject(await verdictOf('fleet', DELETED, [ok({ activities: [newerActivity, olderActivity] })]));
  const pass = await verdictOf('fleet', DELETED, [ok({ activities: [deletion('manual')] }), { status: 404, headers: {}, body: '{"message":"not found"}' }]);
  assert.equal(pass.code, EXIT.OK, pass.text);
  assert.deepEqual(pass.entry, [[true, 'OK']], pass.text);
});

// Finding 4: a record whose time could not be read was skipped as if it were not there, so an
// otherwise matching record (Fleet verify-deleted created_at, Jamf Pro verify-command dateSent,
// Linear verify-comment createdAt) gave exit 2. It may be the change asked for, sent after
// --not-before: the answer proves nothing either way (INCONCLUSIVE, exit 5), unless another
// record already proves the pass. A record that would not pass whatever its time is still left
// out (a deletion that was not manual, a command that failed, a comment with other text).
const HOST_GONE = { status: 404, headers: {}, body: '{"message":"not found"}' };
const UNDATED = [
  ['fleet verify-deleted: a manual deletion of this serial whose created_at is not a time', 'fleet', DELETED, [activityPage([deletion('manual', 'yesterday')], false)]],
  ['fleet verify-deleted: a manual deletion of this serial with no created_at', 'fleet', DELETED, [activityPage([{ ...deletion('manual'), created_at: undefined }], false)]],
  ['jamf verify-command: an Acknowledged command whose dateSent is not a time', 'jamf', JAMF_COMMAND, [token(), jamfCommands([jamfCommand({ dateSent: 'not a time' })])]],
  ['jamf verify-command: an Acknowledged command with no dateSent', 'jamf', JAMF_COMMAND, [token(), jamfCommands([jamfCommand({ dateSent: null })])]],
  ['jamf verify-command: a Pending command whose dateSent is not a time', 'jamf', JAMF_COMMAND, [token(), jamfCommands([jamfCommand({ status: 'Pending', dateSent: '28/10/2026' })])]],
  ['linear verify-comment: a comment with the expected text whose createdAt is not a time', 'linear', COMMENT, [linearData({ issue: { identifier: 'IT-123', comments: { nodes: [{ id: 'c-1', body: 'expected note', createdAt: 'soon', user: { id: 'u' } }], pageInfo: { hasNextPage: false, endCursor: null } } } })]],
  ['linear verify-comment: a comment with the expected text and no createdAt', 'linear', COMMENT, [linearData({ issue: { identifier: 'IT-123', comments: { nodes: [{ id: 'c-1', body: 'expected note', user: { id: 'u' } }], pageInfo: { hasNextPage: false, endCursor: null } } } })]],
];
// the Linear cases need the digest of their body as --expect-sha256
const LINEAR_NOTE_SHA = crypto.createHash('sha256').update('expected note').digest('hex');
const withNoteSha = (argv) => argv.map((v) => (v === 'a'.repeat(64) ? LINEAR_NOTE_SHA : v));
for (const [why, c, argv, replies] of UNDATED) {
  test(`code review round 2, finding 4: ${why} is INCONCLUSIVE (exit 5), not skipped`, async () => {
    assertInconclusive(await verdictOf(c, c === 'linear' ? withNoteSha(argv) : argv, replies));
  });
}
const UNDATED_BESIDE_PROOF = [
  ['fleet verify-deleted: an undated manual deletion beside a dated one', 'fleet', DELETED, [activityPage([deletion('manual', 'yesterday'), deletion('manual')], false), HOST_GONE]],
  ['jamf verify-command: an undated Acknowledged command beside a dated one', 'jamf', JAMF_COMMAND, [token(), jamfCommands([jamfCommand({ uuid: 'cmd-0', dateSent: 'not a time' }), jamfCommand()])]],
  ['linear verify-comment: an undated matching comment beside a dated one', 'linear', COMMENT, [linearData({ issue: { identifier: 'IT-123', comments: { nodes: [{ id: 'c-0', body: 'expected note', createdAt: 'soon', user: { id: 'u' } }, { id: 'c-1', body: 'expected note', createdAt: '2026-10-28T09:30:00Z', user: { id: 'u' } }], pageInfo: { hasNextPage: false, endCursor: null } } } })]],
];
for (const [why, c, argv, replies] of UNDATED_BESIDE_PROOF) {
  test(`code review round 2, finding 4: ${why} passes: another record proves the change`, async () => {
    const r = await verdictOf(c, c === 'linear' ? withNoteSha(argv) : argv, replies);
    assert.equal(r.code, EXIT.OK, r.text);
    assert.deepEqual(r.entry, [[true, 'OK']], r.text);
  });
}
const UNDATED_NEVER_PROOF = [
  ['fleet verify-deleted: an undated deletion that was not manual', 'fleet', DELETED, [activityPage([deletion('expiration', 'yesterday')], false)]],
  ['jamf verify-command: an undated command that failed', 'jamf', JAMF_COMMAND, [token(), jamfCommands([jamfCommand({ status: 'Error', dateSent: 'not a time' })])]],
  ['linear verify-comment: an undated comment with other text', 'linear', COMMENT, [linearData({ issue: { identifier: 'IT-123', comments: { nodes: [{ id: 'c-1', body: 'other note', createdAt: 'soon', user: { id: 'u' } }], pageInfo: { hasNextPage: false, endCursor: null } } } })]],
];
for (const [why, c, argv, replies] of UNDATED_NEVER_PROOF) {
  test(`code review round 2, finding 4: ${why} stays a failed object (exit 2)`, async () => {
    assertFailedObject(await verdictOf(c, c === 'linear' ? withNoteSha(argv) : argv, replies));
  });
}

// Finding 5: round 1 finding 12's Fleet rule (a host wiping or wiped whose newest wipe command
// is not answered yet proves nothing either way) covered an Apple EraseDevice in Pending only.
// Apple MDM's NotNow (the device deferred the command, which Fleet passes through) and a Windows
// doWipe whose status is pending (the documented command_status value, in any case) are not
// answered yet either: INCONCLUSIVE (exit 5). A command that errored or failed stays a failed
// object (exit 2), and so does any command on a host that is not wiping or wiped.
const windowsWiping = fleetHost({ platform: 'windows', hardware_serial: SERIAL, mdm: { device_status: 'wiping', pending_action: 'wipe' } });
const macWiped = fleetHost({ platform: 'darwin', hardware_serial: SERIAL, mdm: { device_status: 'wiped', pending_action: '' } });
const macNotWiping = fleetHost({ platform: 'darwin', hardware_serial: SERIAL, mdm: { device_status: 'unlocked', pending_action: '' } });
const windowsNotWiping = fleetHost({ platform: 'windows', hardware_serial: SERIAL, mdm: { device_status: 'unlocked', pending_action: '' } });
const erase = (status, updatedAt = '2026-10-28T10:00:00Z') => ({ command_uuid: `e-${status}`, request_type: 'EraseDevice', status, updated_at: updatedAt });
const doWipe = (status, updatedAt = '2026-10-28T10:00:00Z') => ({ command_uuid: `w-${status}`, request_type: './Device/Vendor/MSFT/RemoteWipe/doWipeProtected', status, updated_at: updatedAt });
const commands = (results) => ok({ results });
const WIPE_NOT_ANSWERED = [
  ['a Mac wiping, its EraseDevice NotNow', [macWiping, commands([erase('NotNow')])]],
  ['a Mac wiped, its newest EraseDevice NotNow after an older error', [macWiped, commands([erase('Error', '2026-10-28T09:10:00Z'), erase('NotNow')])]],
  ['a Windows host wiping, its doWipe pending', [windowsWiping, commands([doWipe('pending')])]],
  ['a Windows host wiped, its doWipe Pending', [windowsWiped, commands([doWipe('Pending')])]],
];
for (const [why, replies] of WIPE_NOT_ANSWERED) {
  test(`code review round 2, finding 5: fleet verify-wipe: ${why} is INCONCLUSIVE (exit 5)`, async () => {
    const r = await verdictOf('fleet', WIPE, replies);
    assert.equal(r.code, EXIT.INCONCLUSIVE, r.text);
    assert.equal(r.json.state, 'INCONCLUSIVE', r.text);
    assert.equal(r.json.verified, false, r.text);
    assert.deepEqual(r.entry, [[false, 'INCONCLUSIVE']], r.text);
  });
}
const WIPE_STILL_FAILS = [
  ['a Mac wiping, its EraseDevice errored', [macWiping, commands([erase('Error')])]],
  ['a Mac not wiping, its EraseDevice NotNow', [macNotWiping, commands([erase('NotNow')])]],
  ['a Windows host wiping, its doWipe failed with 500', [windowsWiping, commands([doWipe('500')])]],
  ['a Windows host wiping, its doWipe failed', [windowsWiping, commands([doWipe('failed')])]],
  ['a Windows host not wiping, its doWipe pending', [windowsNotWiping, commands([doWipe('pending')])]],
];
for (const [why, replies] of WIPE_STILL_FAILS) {
  test(`code review round 2, finding 5: fleet verify-wipe: ${why} stays a failed object (exit 2)`, async () => {
    const r = await verdictOf('fleet', WIPE, replies);
    assert.equal(r.code, EXIT.READ_FAILED, r.text);
    assert.equal(r.json.state, 'OK', r.text);
    assert.equal(r.json.verified, false, r.text);
    assert.deepEqual(r.entry, [[false, 'OK']], r.text);
  });
}

// Finding 6: Fleet verify-wipe on Windows reads one page of the host's commands (per_page 100)
// and never asked whether more follow. With no doWipe on the page, the doWipe may sit on a later
// page when the answer says more pages follow (meta.has_next_results true), or when the page is
// full and the answer gives no true or false has_next_results: INCONCLUSIVE (exit 5). A page
// that says it is the last, or one not full without paging, stays exit 2, as does a host that is
// not wiping or wiped; a doWipe with status 200 on the page passes.
const lock = (i) => ({ command_uuid: `l-${i}`, request_type: './Device/Vendor/MSFT/RemoteLock/Lock', status: '200', updated_at: '2026-10-28T09:30:00Z' });
const fullPage = Array.from({ length: 100 }, (_, i) => lock(i));
const commandsPage = (results, meta) => ok(meta === undefined ? { results } : { results, meta });
const WINDOWS_MORE = [
  ['no doWipe on a page that says more pages follow', [windowsWiping, commandsPage([lock(1)], { has_next_results: true })]],
  ['no doWipe on a full page with no meta', [windowsWiping, commandsPage(fullPage)]],
  ['no doWipe on a full page whose meta has no has_next_results', [windowsWiped, commandsPage(fullPage, {})]],
];
for (const [why, replies] of WINDOWS_MORE) {
  test(`code review round 2, finding 6: fleet verify-wipe on Windows: ${why} is INCONCLUSIVE (exit 5)`, async () => {
    assertInconclusive(await verdictOf('fleet', WIPE, replies));
  });
}
const WINDOWS_LAST_PAGE = [
  ['no doWipe on a page not full, with no meta', [windowsWiping, commandsPage([lock(1)])]],
  ['no doWipe on an empty page with no meta', [windowsWiping, commandsPage([])]],
  ['no doWipe on a full page that says it is the last', [windowsWiping, commandsPage(fullPage, { has_next_results: false })]],
  ['a host not wiping, no doWipe on a page that says more follow', [windowsNotWiping, commandsPage([lock(1)], { has_next_results: true })]],
];
for (const [why, replies] of WINDOWS_LAST_PAGE) {
  test(`code review round 2, finding 6: fleet verify-wipe on Windows: ${why} stays a failed object (exit 2)`, async () => {
    assertFailedObject(await verdictOf('fleet', WIPE, replies));
  });
}
test('code review round 2, finding 6: fleet verify-wipe on Windows: a doWipe with status 200 on a page that says more follow passes', async () => {
  const r = await verdictOf('fleet', WIPE, [windowsWiping, commandsPage([lock(1), doWipe('200')], { has_next_results: true })]);
  assert.equal(r.code, EXIT.OK, r.text);
  assert.deepEqual(r.entry, [[true, 'OK']], r.text);
});
