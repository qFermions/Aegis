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
