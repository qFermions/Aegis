'use strict';
// inconclusive-r3.test.js: code review round 3 of batch G4, finding 2.
//
// EXPECTED DECISION (written before the code)
// - Round 2 finding 4 (Fleet verify-deleted, Jamf Pro verify-command, Linear verify-comment):
//   a record that would prove the change but whose time cannot be read may be the change asked
//   for, made after --not-before. Skipping it as if it were not there gave exit 2. The answer
//   proves nothing either way: INCONCLUSIVE (exit 5, state INCONCLUSIVE, verified false, a
//   reason), unless another record in the same answer already proves the change (exit 0).
// - A record whose time cannot be read and that would not pass whatever its time (another event,
//   a failed outcome, a failed sign-in, other text) is still left out: the answer stays a failed
//   object (exit 2, state OK) when nothing else proves the change.
// - Round 3 finding 2: the same class in four more connectors, each fixed the same way:
//   Google Workspace verify-event (id.time), Okta verify-sessions-cleared and
//   verify-password-reset (published), Microsoft Graph verify-signin (createdDateTime) and Slack
//   verify-posted (ts). A time that is missing counts as one that cannot be read.
// Run: node --test scripts/adapters/inconclusive-r3.test.js

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const test = require('node:test');

const { EXIT } = require('./readonly-contract.js');
const audit = require('../audit/audit-log.js');

const NOT_BEFORE = '2026-10-28T09:00:00Z';
const AFTER = '2026-10-28T09:30:00Z';
const NOW = Date.parse('2026-10-28T12:00:00Z');
const TOKEN = ['sentinel', 'inconclusive', 'r3', String(7 * 617)].join('-');
const at = (user, domain) => [user, domain].join('@');
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const ok = (body) => ({ status: 200, headers: {}, body: JSON.stringify(body) });
const token = (extra = {}) => ok({ access_token: 'issued-access-value', expires_in: 1200, token_type: 'Bearer', ...extra });
const ENV = {
  gws: { GWS_SA_CLIENT_EMAIL: at('svc', 'project.iam.gserviceaccount.com'), GWS_SA_PRIVATE_KEY: PEM, GWS_ADMIN_SUBJECT: at('admin', 'example.com'), GWS_CUSTOMER_ID: 'C0test1' },
  msgraph: { MS_TENANT_ID: '11111111-2222-4333-8444-555555555555', MS_CLIENT_ID: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', MS_PRIVATE_KEY: PEM, MS_CERT_SHA256: crypto.createHash('sha256').update('fixture certificate').digest('base64url') },
  okta: { OKTA_ORG_URL: 'okta.example.invalid', OKTA_CLIENT_ID: 'client-id-value', OKTA_PRIVATE_KEY: PEM },
  slack: { SLACK_TOKEN: TOKEN, SLACK_TEAM_ID: 'T0OURS0001' },
};
const FILE = { gws: 'gws-client.js', msgraph: 'msgraph-client.js', okta: 'okta-client.js', slack: 'slack-client.js' };

async function verdictOf(c, argv, replies) {
  const mod = require(path.join(__dirname, FILE[c]));
  const queue = replies.slice();
  const out = [];
  const recorded = [];
  // the sink checks each entry the way the real trail does
  const sink = (e) => { audit.checkEntry(e); recorded.push(e); return { seq: recorded.length }; };
  const transport = async () => queue.shift() || { status: 500, headers: {}, body: '{}' };
  const code = await mod.run([...argv, '--execute'], ENV[c], { transport, audit: sink, now: () => NOW, sleep: async () => {}, timeoutMs: 50, out: (s) => out.push(String(s)), err: (s) => out.push(String(s)) });
  const text = out.join('');
  const i = text.indexOf('{');
  let json = null;
  try { json = i === -1 ? null : JSON.parse(text.slice(i, text.indexOf('\n}', i) + 2)); } catch { json = null; }
  return { code, text, json, entry: recorded.filter((e) => e.kind === 'verify').map((e) => [e.verified, e.state]) };
}
function assertInconclusive(r) {
  assert.equal(r.code, EXIT.INCONCLUSIVE, r.text);
  assert.ok(r.json, r.text);
  assert.equal(r.json.state, 'INCONCLUSIVE', r.text);
  assert.equal(r.json.verified, false, r.text);
  assert.equal(typeof r.json.reason, 'string', r.text);
  assert.match(r.json.reason, /not proof either way/, r.text);
  assert.deepEqual(r.entry, [[false, 'INCONCLUSIVE']], r.text);
}
function assertPass(r) {
  assert.equal(r.code, EXIT.OK, r.text);
  assert.equal(r.json.verified, true, r.text);
  assert.deepEqual(r.entry, [[true, 'OK']], r.text);
}
function assertFailedObject(r) {
  assert.equal(r.code, EXIT.READ_FAILED, r.text);
  assert.ok(r.json, r.text);
  assert.equal(r.json.state, 'OK', r.text);
  assert.equal(r.json.verified, false, r.text);
  assert.equal(typeof r.json.reason, 'string', r.text);
  assert.deepEqual(r.entry, [[false, 'OK']], r.text);
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const NO_TIME = Symbol('no time');
const withTime = (record, key, time) => {
  const out = { ...record };
  if (time === NO_TIME) delete out[key]; else out[key] = time;
  return out;
};

// Google Workspace: an admin CHANGE_PASSWORD event by the user.
const GWS_USER = 'person@example.com';
const GWS_EVENT = ['verify-event', '--app', 'admin', '--event', 'CHANGE_PASSWORD', '--user', GWS_USER, '--not-before', NOT_BEFORE];
const gwsActivity = ({ time = AFTER, name = 'CHANGE_PASSWORD' } = {}) => ({
  kind: 'admin#reports#activity',
  id: withTime({ uniqueQualifier: '5501', applicationName: 'admin', customerId: 'C0test1' }, 'time', time),
  actor: { email: GWS_USER, profileId: '100000000000000000001' },
  events: [{ type: 'USER_SETTINGS', name }],
});
const gwsFeed = (items) => [token({ expires_in: 3599 }), ok({ kind: 'admin#reports#activities', items })];

// Okta: a System Log event for the user.
const OKTA_USER = '00u1abcd2EFGH3ijk4x7';
const OKTA_COMMANDS = [['verify-sessions-cleared', 'user.session.clear'], ['verify-password-reset', 'user.account.reset_password']];
const oktaEvent = (eventType, { published = '2026-10-28T09:30:00.000Z', result = 'SUCCESS', uuid = 'e1' } = {}) => withTime({ uuid, eventType, outcome: { result }, target: [{ id: OKTA_USER, type: 'User' }] }, 'published', published);
const oktaLog = (events) => [token({ scope: 'okta.logs.read' }), ok(events)];

// Microsoft Graph: a sign-in by the user.
const MS_USER = 'aaaaaaaa-0000-4000-8000-000000000001';
const MS_SIGNIN = ['verify-signin', '--user', MS_USER, '--not-before', NOT_BEFORE];
const signIn = ({ time = AFTER, errorCode = 0 } = {}) => withTime({ status: { errorCode } }, 'createdDateTime', time);
const signIns = (value) => [token({ expires_in: 3599 }), ok({ value })];

// Slack: a person's plain message in the channel.
const NOTE = 'Status: mail is down.';
const NOTE_SHA = crypto.createHash('sha256').update(NOTE).digest('hex');
const SLACK_POSTED = ['verify-posted', '--channel', 'C0TEST0001', '--expect-sha256', NOTE_SHA, '--not-before', NOT_BEFORE];
const TS_AFTER = `${Date.parse(AFTER) / 1000}.000100`;
const slackMessage = ({ ts = TS_AFTER, text = NOTE } = {}) => withTime({ type: 'message', user: 'U0POSTER01', text }, 'ts', ts);
const slackHistory = (messages) => [ok({ ok: true, team: 'Workspace', user: 'it-reader', team_id: 'T0OURS0001', user_id: 'U0READER01' }), ok({ ok: true, messages, has_more: false })];

// ── A record that would prove the change, with a time that cannot be read ────
const UNDATED = [
  ['gws verify-event: a matching event whose id.time is not a time', 'gws', GWS_EVENT, gwsFeed([gwsActivity({ time: 'yesterday' })])],
  ['gws verify-event: a matching event with no id.time', 'gws', GWS_EVENT, gwsFeed([gwsActivity({ time: NO_TIME })])],
  ...OKTA_COMMANDS.flatMap(([command, type]) => [
    [`okta ${command}: a matching SUCCESS event whose published is not a time`, 'okta', [command, '--user', OKTA_USER, '--not-before', NOT_BEFORE], oktaLog([oktaEvent(type, { published: '28/10/2026' })])],
    [`okta ${command}: a matching SUCCESS event with no published`, 'okta', [command, '--user', OKTA_USER, '--not-before', NOT_BEFORE], oktaLog([oktaEvent(type, { published: NO_TIME })])],
  ]),
  ['msgraph verify-signin: a successful sign-in whose createdDateTime is not a time', 'msgraph', MS_SIGNIN, signIns([signIn({ time: 'soon' })])],
  ['msgraph verify-signin: a successful sign-in with no createdDateTime', 'msgraph', MS_SIGNIN, signIns([signIn({ time: NO_TIME })])],
  ['slack verify-posted: a plain message with the expected text whose ts is malformed', 'slack', SLACK_POSTED, slackHistory([slackMessage({ ts: 'soon' })])],
  ['slack verify-posted: a plain message with the expected text and no ts', 'slack', SLACK_POSTED, slackHistory([slackMessage({ ts: NO_TIME })])],
];
for (const [why, c, argv, replies] of UNDATED) {
  test(`code review round 3, finding 2: ${why} is INCONCLUSIVE (exit 5), not skipped`, async () => {
    assertInconclusive(await verdictOf(c, argv, replies));
  });
}

// ── The same, beside a dated record that proves the change ───────────────────
const UNDATED_BESIDE_PROOF = [
  ['gws verify-event: an undated matching event beside a dated one', 'gws', GWS_EVENT, gwsFeed([gwsActivity({ time: 'yesterday' }), gwsActivity()])],
  ...OKTA_COMMANDS.map(([command, type]) => [`okta ${command}: an undated matching event beside a dated one`, 'okta', [command, '--user', OKTA_USER, '--not-before', NOT_BEFORE], oktaLog([oktaEvent(type, { published: 'not a time', uuid: 'e0' }), oktaEvent(type)])]),
  ['msgraph verify-signin: an undated successful sign-in beside a dated one', 'msgraph', MS_SIGNIN, signIns([signIn({ time: 'soon' }), signIn()])],
  ['slack verify-posted: a matching message with a malformed ts beside one with a good ts', 'slack', SLACK_POSTED, slackHistory([slackMessage({ ts: 'soon' }), slackMessage()])],
];
for (const [why, c, argv, replies] of UNDATED_BESIDE_PROOF) {
  test(`code review round 3, finding 2: ${why} passes: another record proves the change`, async () => {
    assertPass(await verdictOf(c, argv, replies));
  });
}

// ── An undated record that would never pass whatever its time ────────────────
const UNDATED_NEVER_PROOF = [
  ['gws verify-event: an undated event of another name', 'gws', GWS_EVENT, gwsFeed([gwsActivity({ time: 'yesterday', name: 'ADD_GROUP_MEMBER' })])],
  ...OKTA_COMMANDS.map(([command, type]) => [`okta ${command}: an undated event with outcome FAILURE`, 'okta', [command, '--user', OKTA_USER, '--not-before', NOT_BEFORE], oktaLog([oktaEvent(type, { published: 'not a time', result: 'FAILURE' })])]),
  ['msgraph verify-signin: an undated failed sign-in', 'msgraph', MS_SIGNIN, signIns([signIn({ time: 'soon', errorCode: 50126 })])],
  ['slack verify-posted: an undated message with other text', 'slack', SLACK_POSTED, slackHistory([slackMessage({ ts: 'soon', text: 'Unrelated chatter' })])],
];
for (const [why, c, argv, replies] of UNDATED_NEVER_PROOF) {
  test(`code review round 3, finding 2: ${why} stays a failed object (exit 2)`, async () => {
    assertFailedObject(await verdictOf(c, argv, replies));
  });
}
