'use strict';
// msgraph-client.test.js: the read-only Microsoft Graph connector (batch G3, task 5c).
//
// EXPECTED DECISION (written before the code)
// - Reads only: GET routes on graph.microsoft.com (v1.0) for users, authentication
//   methods, group membership, sign-in logs and devices (Entra and Intune), with a fixed
//   $select on user and device reads so no personal field is asked for. Any non-GET is
//   REFUSED before a credential is read.
// - App-only token: one POST to login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/token
//   (MS_TENANT_ID must be a tenant GUID), form fields exactly client_id, scope
//   (https://graph.microsoft.com/.default), grant_type=client_credentials,
//   client_assertion_type and client_assertion: a PS256 JWT signed with MS_PRIVATE_KEY whose
//   header carries x5t#S256 (MS_CERT_SHA256) and whose claims are aud (the token URL),
//   iss = sub = client id, jti, nbf, iat, exp. Never retried. No client secret is used.
// - Scopes: Microsoft says to treat access tokens as opaque and the token response has no
//   scope field, so the first result carries a scope_notice (manifest kind none); the
//   manifest names the .Read.All permissions to grant and refuses ReadWrite and the rest.
// - The tenant is bound by the token URL: a token can only come from MS_TENANT_ID.
// - Dry run unless --execute. verify-* read-backs for the password-reset and MFA runbooks
//   (password changed after a time, account enabled or disabled, an MFA method registered
//   or cleared, a sign-in after a time, an Intune device synced after a time, a group
//   membership) print verified true or false, exit 0 or 2.
// - A failure prints the two-part message for Microsoft Graph; no credential, assertion
//   or token ever appears in output.
// Run: node --test scripts/adapters/msgraph-client.test.js

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const ms = require('./msgraph-client.js');
const contract = require('./readonly-contract.js');

const { STATES } = contract;
const TENANT = '11111111-2222-4333-8444-555555555555';
const CLIENT = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const THUMB = crypto.createHash('sha256').update('fixture certificate').digest('base64url');
const ENV = Object.freeze({ MS_TENANT_ID: TENANT, MS_CLIENT_ID: CLIENT, MS_PRIVATE_KEY: PEM, MS_CERT_SHA256: THUMB });
const ISSUED = ['issued', 'graph', 'access', String(17 * 61)].join('-');
const NOW = Date.parse('2026-10-28T10:00:00Z');

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
const token = () => ok({ token_type: 'Bearer', expires_in: 3599, access_token: ISSUED });

async function cli(argv, { env = ENV, replies = [], extra = {} } = {}) {
  const transport = queued(replies);
  const out = [];
  const err = [];
  const code = await ms.run(argv, env, { transport, sleep: async () => {}, now: () => NOW, out: (s) => out.push(String(s)), err: (s) => err.push(String(s)), ...extra });
  const raw = out.join('') || err.join('');
  const i = raw.indexOf('{');
  return { code, text: out.join('') + err.join(''), json: i === -1 ? null : JSON.parse(raw.slice(i, raw.lastIndexOf('}') + 1)), transport };
}

test('SPEC: GET-only routes on graph.microsoft.com; the token exchange on login.microsoftonline.com with exactly the certificate fields; scopes not exposed', () => {
  const spec = ms.makeSpec({ tenant: TENANT });
  assert.deepEqual(spec.host, { fixed: 'graph.microsoft.com' });
  for (const [name, route] of Object.entries(spec.routes)) {
    assert.equal(route.method, 'GET', name);
    assert.match(route.path, /^\/v1\.0\//, name);
  }
  assert.deepEqual(spec.tokenExchange.host, { fixed: 'login.microsoftonline.com' });
  assert.equal(spec.tokenExchange.path, `/${TENANT}/oauth2/v2.0/token`);
  assert.deepEqual([...spec.tokenExchange.fields].sort(), ['client_assertion', 'client_assertion_type', 'client_id', 'grant_type', 'scope']);
  assert.equal(spec.scopes.kind, 'none');
  assert.equal(spec.scopes.manifest, 'msgraph');
  assert.throws(() => ms.makeSpec({ tenant: 'contoso-example' }), /tenant/i, 'MS_TENANT_ID must be a GUID');
});

test('the token exchange: one POST with a PS256 assertion carrying x5t#S256, verified with the public key; then the read with only the bearer token', async () => {
  const r = await cli(['user', '--user', 'aaaaaaaa-0000-4000-8000-000000000001', '--execute'], { replies: [token(), ok({ id: 'aaaaaaaa-0000-4000-8000-000000000001', accountEnabled: true, userType: 'Member' })] });
  assert.equal(r.code, 0, r.text);
  const [ex, read] = r.transport.calls;
  assert.equal(ex.method, 'POST');
  assert.equal(ex.hostname, 'login.microsoftonline.com');
  assert.equal(ex.path, `/${TENANT}/oauth2/v2.0/token`);
  const form = Object.fromEntries(new URLSearchParams(ex.body));
  assert.deepEqual(Object.keys(form).sort(), ['client_assertion', 'client_assertion_type', 'client_id', 'grant_type', 'scope']);
  assert.equal(form.grant_type, 'client_credentials');
  assert.equal(form.scope, 'https://graph.microsoft.com/.default');
  assert.equal(form.client_assertion_type, 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
  const [h, c, sig] = form.client_assertion.split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
  const claims = JSON.parse(Buffer.from(c, 'base64url').toString('utf8'));
  assert.equal(header.alg, 'PS256');
  assert.equal(header['x5t#S256'], THUMB);
  assert.equal(claims.aud, `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`);
  assert.equal(claims.iss, CLIENT);
  assert.equal(claims.sub, CLIENT);
  assert.ok(claims.exp > claims.iat && claims.exp - claims.iat <= 600 && typeof claims.jti === 'string' && claims.nbf <= claims.iat);
  assert.ok(crypto.verify('sha256', Buffer.from(`${h}.${c}`), { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 }, Buffer.from(sig, 'base64url')), 'PS256 signature');
  assert.equal(read.method, 'GET');
  assert.equal(read.hostname, 'graph.microsoft.com');
  assert.match(read.path, /^\/v1\.0\/users\/aaaaaaaa-0000-4000-8000-000000000001\?%24select=/);
  assert.equal(read.headers.Authorization, `Bearer ${ISSUED}`);
  for (const secret of [PEM, ISSUED, form.client_assertion]) assert.ok(!r.text.includes(secret), 'nothing secret printed');
  const failed = await cli(['user', '--user', 'aaaaaaaa-0000-4000-8000-000000000001', '--execute'], { replies: [{ status: 503, body: {} }, token()] });
  assert.equal(failed.transport.calls.length, 1, 'the token exchange is never retried');
});

test('each read sends one GET to its path; user and device reads carry a fixed $select', async () => {
  const U = 'aaaaaaaa-0000-4000-8000-000000000001';
  const G = 'bbbbbbbb-0000-4000-8000-000000000002';
  const D = 'cccccccc-0000-4000-8000-000000000003';
  const cases = [
    [['user', '--user', U], `/v1.0/users/${U}?%24select=id%2CuserPrincipalName%2CaccountEnabled%2CuserType%2ConPremisesSyncEnabled%2ClastPasswordChangeDateTime%2CcreatedDateTime`],
    [['auth-methods', '--user', U], `/v1.0/users/${U}/authentication/methods`],
    [['member-of', '--user', U], `/v1.0/users/${U}/memberOf?%24select=id%2CdisplayName`],
    [['group-members', '--group', G], `/v1.0/groups/${G}/members?%24select=id%2CuserPrincipalName`],
    [['sign-ins', '--user', U, '--since', '2026-10-28T08:00:00Z'], `/v1.0/auditLogs/signIns?%24top=50&%24filter=userId+eq+%27${U}%27+and+createdDateTime+ge+2026-10-28T08%3A00%3A00Z`],
    [['managed-device', '--device', D], `/v1.0/deviceManagement/managedDevices/${D}?%24select=id%2CdeviceName%2ClastSyncDateTime%2CcomplianceState%2CoperatingSystem%2CmanagementState`],
  ];
  for (const [argv, path] of cases) {
    // an injected transport turns the scope preflight off unless the test asks (cli-support.js)
    const r = await cli([...argv, '--execute'], { replies: [token(), ok({ value: [] })], extra: { scopePreflight: true } });
    assert.equal(r.code, 0, `${argv[0]}: ${r.text}`);
    assert.equal(r.transport.calls.length, 2, argv[0]);
    assert.equal(r.transport.calls[1].path, path, argv[0]);
    assert.match(r.json.scope_notice, /Microsoft Graph does not expose/, `${argv[0]}: the not-exposed notice`);
  }
});

test('a dry run sends nothing and reads no credential; bad values and writes are refused before anything is sent', async () => {
  const dry = await cli(['auth-methods', '--user', 'aaaaaaaa-0000-4000-8000-000000000001'], { env: { MS_TENANT_ID: TENANT } });
  assert.equal(dry.code, 0, dry.text);
  assert.equal(dry.transport.calls.length, 0);
  assert.match(dry.json.note, /dry run/);
  for (const argv of [['user', '--user', 'not a guid'], ['sign-ins', '--user', 'aaaaaaaa-0000-4000-8000-000000000001', '--since', 'yesterday'], ['reset-password', '--user', 'aaaaaaaa-0000-4000-8000-000000000001']]) {
    const r = await cli([...argv, '--execute']);
    assert.equal(r.code, 1, argv.join(' '));
    assert.equal(r.transport.calls.length, 0, argv.join(' '));
  }
  const client = contract.createClient(ms.makeSpec({ tenant: TENANT }), { env: ENV, transport: queued([]) });
  for (const method of ['POST', 'PATCH', 'DELETE']) assert.equal((await client.send({ method, path: '/v1.0/users/aaaaaaaa-0000-4000-8000-000000000001' })).state, STATES.REFUSED);
});

test('verify read-backs for the password-reset and MFA runbooks', async () => {
  const U = 'aaaaaaaa-0000-4000-8000-000000000001';
  const v = async (argv, body) => cli([...argv, '--execute'], { replies: [token(), ok(body)] });
  let r = await v(['verify-password-changed', '--user', U, '--not-before', '2026-10-28T09:00:00Z'], { id: U, lastPasswordChangeDateTime: '2026-10-28T09:05:00Z' });
  assert.equal(r.json.verified, true, r.text);
  r = await v(['verify-password-changed', '--user', U, '--not-before', '2026-10-28T09:00:00Z'], { id: U, lastPasswordChangeDateTime: '2026-10-27T09:05:00Z' });
  assert.equal(r.code, 2);
  r = await v(['verify-account-enabled', '--user', U, '--enabled', 'false'], { id: U, accountEnabled: false });
  assert.equal(r.json.verified, true, r.text);
  r = await v(['verify-account-enabled', '--user', U, '--enabled', 'true'], { id: U, accountEnabled: false });
  assert.equal(r.code, 2);
  const methods = { value: [{ '@odata.type': '#microsoft.graph.passwordAuthenticationMethod' }, { '@odata.type': '#microsoft.graph.microsoftAuthenticatorAuthenticationMethod' }] };
  r = await v(['verify-mfa-method', '--user', U, '--method', 'microsoftAuthenticator'], methods);
  assert.equal(r.json.verified, true, r.text);
  r = await v(['verify-mfa-method', '--user', U, '--method', 'fido2'], methods);
  assert.equal(r.code, 2);
  r = await v(['verify-mfa-cleared', '--user', U], { value: [{ '@odata.type': '#microsoft.graph.passwordAuthenticationMethod' }] });
  assert.equal(r.json.verified, true, r.text);
  r = await v(['verify-mfa-cleared', '--user', U], methods);
  assert.equal(r.code, 2);
  assert.match(r.json.reason, /microsoftAuthenticator/);
  r = await v(['verify-signin', '--user', U, '--not-before', '2026-10-28T09:00:00Z'], { value: [{ createdDateTime: '2026-10-28T09:30:00Z', status: { errorCode: 0 } }] });
  assert.equal(r.json.verified, true, r.text);
  r = await v(['verify-signin', '--user', U, '--not-before', '2026-10-28T09:00:00Z'], { value: [{ createdDateTime: '2026-10-28T09:30:00Z', status: { errorCode: 50126 } }] });
  assert.equal(r.code, 2, 'a failed sign-in is not proof');
  r = await v(['verify-device-synced', '--device', 'cccccccc-0000-4000-8000-000000000003', '--not-before', '2026-10-28T09:00:00Z'], { id: 'x', lastSyncDateTime: '2026-10-28T09:10:00Z', complianceState: 'compliant' });
  assert.equal(r.json.verified, true, r.text);
  r = await v(['verify-device-synced', '--device', 'cccccccc-0000-4000-8000-000000000003', '--not-before', '2026-10-28T09:00:00Z'], { id: 'x', lastSyncDateTime: '2026-10-20T09:10:00Z' });
  assert.equal(r.code, 2);
  r = await v(['verify-group-member', '--group', 'bbbbbbbb-0000-4000-8000-000000000002', '--user', U], { value: [{ id: U }] });
  assert.equal(r.json.verified, true, r.text);
  r = await v(['verify-group-member', '--group', 'bbbbbbbb-0000-4000-8000-000000000002', '--user', U, '--absent'], { value: [{ id: U }] });
  assert.equal(r.code, 2);
  r = await v(['verify-group-member', '--group', 'bbbbbbbb-0000-4000-8000-000000000002', '--user', U, '--absent'], { value: [], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/groups/x/members?$skiptoken=y' });
  assert.equal(r.code, 5, 'absence on a first page with more pages is not proof (batch G4, task D1: INCONCLUSIVE)');
});

test('a failure prints the two-part message for Microsoft Graph with no body, key, assertion or token', async () => {
  const r = await cli(['user', '--user', 'aaaaaaaa-0000-4000-8000-000000000001', '--execute'], { replies: [token(), { status: 403, body: { error: { code: 'Authorization_RequestDenied', message: 'Insufficient privileges' } } }] });
  assert.equal(r.code, 2);
  assert.match(r.json.operator_message, /^Microsoft Graph refused the read \(HTTP 403\)/);
  assert.match(r.json.admin_detail, /^platform=msgraph operation=user state=HTTP_ERROR status=403/);
  assert.ok(!r.text.includes('Insufficient privileges') && !r.text.includes(ISSUED) && !r.text.includes('PRIVATE KEY'));
  const missing = await cli(['user', '--user', 'aaaaaaaa-0000-4000-8000-000000000001', '--execute'], { env: { MS_TENANT_ID: TENANT } });
  assert.equal(missing.code, 1);
  assert.match(missing.json.operator_message, /Microsoft Graph credential is not set/);
});

// Batch G3 close-out 3, owner decision H3: read-backs for the two /mfa-issue actions that had
// none. verify-sessions-revoked reads the user's signInSessionsValidFromDateTime, which Graph
// returns only on $select (vendor fact M-27) and which revocation resets to the current time
// (M-26): it passes when that time is at or after --not-before. verify-method-absent reads the
// user's authentication methods and passes when the method id is no longer listed. GET only;
// a read that fails never proves anything.
test('verify-sessions-revoked: passes when the sessions are valid only from --not-before on; fails on an earlier, missing or malformed time, and on 403 or 404', async () => {
  const U = 'aaaaaaaa-0000-4000-8000-000000000001';
  const argv = ['verify-sessions-revoked', '--user', U, '--not-before', '2026-10-28T09:00:00Z'];
  const v = (replies) => cli([...argv, '--execute'], { replies: [token(), ...replies] });
  const pass = await v([ok({ id: U, signInSessionsValidFromDateTime: '2026-10-28T09:02:10Z' })]);
  assert.equal(pass.code, 0, pass.text);
  assert.equal(pass.json.verified, true);
  const call = pass.transport.calls[1];
  assert.equal(call.method, 'GET');
  assert.match(call.path || call.url || '', new RegExp(`/v1\\.0/users/${U}\\?%24select=id%2CsignInSessionsValidFromDateTime$`));
  const before = await v([ok({ id: U, signInSessionsValidFromDateTime: '2026-10-27T18:00:00Z' })]);
  assert.equal(before.code, 2);
  assert.match(before.json.reason, /before 2026-10-28T09:00:00Z/);
  const missing = await v([ok({ id: U })]);
  assert.equal(missing.code, 5); // batch G4, task D1: INCONCLUSIVE
  assert.match(missing.json.reason, /not in the answer/);
  const malformed = await v([ok({ id: U, signInSessionsValidFromDateTime: 'yesterday' })]);
  assert.equal(malformed.code, 5); // batch G4, task D1: INCONCLUSIVE
  assert.match(malformed.json.reason, /not a time/);
  // a failed read prints its state and no verdict, and exits 2 (the contract's shape)
  const denied = await v([{ status: 403, body: { error: { code: 'Authorization_RequestDenied' } } }]);
  assert.equal(denied.code, 2);
  assert.equal(denied.json.state, 'HTTP_ERROR');
  assert.notEqual(denied.json.verified, true);
  const gone = await v([{ status: 404, body: { error: { code: 'Request_ResourceNotFound' } } }]);
  assert.equal(gone.code, 2);
  assert.equal(gone.json.state, 'HTTP_ERROR');
  assert.notEqual(gone.json.verified, true);
  const dry = await cli(argv);
  assert.equal(dry.code, 4, dry.text);
  assert.equal(dry.transport.calls.length, 0);
});

test('verify-method-absent: passes when the method id is no longer listed; fails when it is, when the list is missing or has another page, and on 403 or 404', async () => {
  const U = 'aaaaaaaa-0000-4000-8000-000000000001';
  const ID = '3179e48a-750b-4051-897c-87b9720928f7';
  const argv = ['verify-method-absent', '--user', U, '--method-id', ID];
  const v = (replies) => cli([...argv, '--execute'], { replies: [token(), ...replies] });
  const other = { id: '28c10230-6103-485e-b985-444c60001490', '@odata.type': '#microsoft.graph.passwordAuthenticationMethod' };
  const pass = await v([ok({ value: [other] })]);
  assert.equal(pass.code, 0, pass.text);
  assert.equal(pass.json.verified, true);
  assert.equal(pass.transport.calls[1].method, 'GET');
  const still = await v([ok({ value: [other, { id: ID, '@odata.type': '#microsoft.graph.phoneAuthenticationMethod' }] })]);
  assert.equal(still.code, 2);
  assert.match(still.json.reason, /still listed/);
  const missing = await v([ok({})]);
  assert.equal(missing.code, 5); // batch G4, task D1: INCONCLUSIVE
  assert.match(missing.json.reason, /no method list/);
  const paged = await v([ok({ value: [other], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/users/x/authentication/methods?$skiptoken=y' })]);
  assert.equal(paged.code, 5, 'absence on a page with more pages behind it is not proof (batch G4, task D1: INCONCLUSIVE)');
  const denied = await v([{ status: 403, body: { error: { code: 'Authorization_RequestDenied' } } }]);
  assert.equal(denied.code, 2);
  assert.equal(denied.json.state, 'HTTP_ERROR');
  const gone = await v([{ status: 404, body: { error: { code: 'Request_ResourceNotFound' } } }]);
  assert.equal(gone.code, 2);
  assert.equal(gone.json.state, 'HTTP_ERROR');
  assert.notEqual(gone.json.verified, true, 'a 404 never proves the method gone');
  const dry = await cli(argv);
  assert.equal(dry.code, 4, dry.text);
  assert.equal(dry.transport.calls.length, 0);
  const bad = await cli(['verify-method-absent', '--user', U, '--method-id', 'a b']);
  assert.equal(bad.code, 1, 'a method id is one token of letters, digits, - and _');
});

// Code review round 1 of the batch G3 close-out 3, finding 7: an answer that proves nothing either
// way (no method list, or another page behind it) was recorded as a read that got an answer and
// failed, so it kept the counted MFA clear partial for good. It was then INVALID_RESPONSE, a read
// with no usable answer; since batch G4 (task D1) it is INCONCLUSIVE (exit 5), which a counted change lists as uncounted; it still never passes.
test('verify-method-absent: an answer that proves nothing either way is recorded as INCONCLUSIVE, never as a failed object', async () => {
  const U = 'aaaaaaaa-0000-4000-8000-000000000001';
  const ID = '3179e48a-750b-4051-897c-87b9720928f7';
  const recorded = [];
  const v = (body) => cli(['verify-method-absent', '--user', U, '--method-id', ID, '--execute'], { replies: [token(), ok(body)], extra: { audit: (e) => { recorded.push(e); return { seq: recorded.length }; } } });
  for (const body of [{}, { value: [{ id: '28c10230-6103-485e-b985-444c60001490' }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/users/x/authentication/methods?$skiptoken=y' }]) {
    const r = await v(body);
    assert.equal(r.code, 5, r.text);
    assert.equal(r.json.state, 'INCONCLUSIVE', r.text);
    assert.notEqual(r.json.verified, true);
  }
  assert.deepEqual(recorded.filter((e) => e.kind === 'verify').map((e) => [e.state, e.verified]), [['INCONCLUSIVE', false], ['INCONCLUSIVE', false]]);
  const still = await v({ value: [{ id: ID }] });
  assert.equal(still.json.state, 'OK', 'a method still listed is an answer: the object failed');
});

// Security review 1 of the batch G3 close-out 3: the method id was compared case for case, so a
// GUID typed in capitals read as absent while Graph still listed it in lower case. A GUID is
// compared without case; any other id (a base64url id, such as a FIDO2 key's) keeps its case.
test('verify-method-absent: a GUID method id still listed in another case is still listed; a base64url id keeps its case', async () => {
  const U = 'aaaaaaaa-0000-4000-8000-000000000001';
  const ID = '3179e48a-750b-4051-897c-87b9720928f7';
  const v = (methodId, listed) => cli(['verify-method-absent', '--user', U, '--method-id', methodId, '--execute'], { replies: [token(), ok({ value: listed.map((id) => ({ id })) })] });
  const upper = await v(ID.toUpperCase(), [ID]);
  assert.equal(upper.code, 2, upper.text);
  assert.match(upper.json.reason, /still listed/);
  const lower = await v(ID, [ID.toUpperCase()]);
  assert.equal(lower.code, 2, lower.text);
  const key = '-2_GRUg2-HYz6_1YG4YRAQ2';
  assert.equal((await v(key, [key])).code, 2, 'the same base64url id is still listed');
  const otherCase = await v(key.toLowerCase(), [key]);
  assert.equal(otherCase.code, 0, `a base64url id in another case is another id: ${otherCase.text}`);
});

// Code review round 1 of batch G4, finding 3: change-record.js approve prints approved_at with
// milliseconds (2026-11-01T10:00:00.412Z) and the runbooks say to run the read-back with
// --not-before at or after the approval. --not-before took whole seconds only, so the printed
// value was refused, and cutting it to whole seconds landed before the approval. Every
// --not-before (and --since, which shares its rule and the sign-in filter) now takes an ISO UTC
// time with 1 to 3 fractional digits, compared at millisecond precision, and the audit entry
// records it in the same form approved_at has.
test('every --not-before takes the approved_at form with milliseconds and compares at millisecond precision', async () => {
  const U = 'aaaaaaaa-0000-4000-8000-000000000001';
  const D = 'cccccccc-0000-4000-8000-000000000003';
  const T = '2026-10-28T09:00:00.412Z';
  const BEFORE = '2026-10-28T09:00:00.411Z';
  const recorded = [];
  const audit = (e) => { recorded.push(e); return { seq: recorded.length }; };
  const v = (argv, body) => cli([...argv, '--execute'], { replies: [token(), ok(body)], extra: { audit } });
  const cases = [
    [['verify-password-changed', '--user', U, '--not-before', T], (t) => ({ id: U, lastPasswordChangeDateTime: t })],
    [['verify-signin', '--user', U, '--not-before', T], (t) => ({ value: [{ createdDateTime: t, status: { errorCode: 0 } }] })],
    [['verify-device-synced', '--device', D, '--not-before', T], (t) => ({ id: D, lastSyncDateTime: t })],
    [['verify-sessions-revoked', '--user', U, '--not-before', T], (t) => ({ id: U, signInSessionsValidFromDateTime: t })],
  ];
  for (const [argv, body] of cases) {
    const at = await v(argv, body(T));
    assert.equal(at.code, 0, `${argv[0]} at the bound: ${at.text}`);
    assert.equal(at.json.verified, true, at.text);
    const early = await v(argv, body(BEFORE));
    assert.equal(early.code, 2, `${argv[0]} one millisecond before the bound: ${early.text}`);
    assert.equal(early.json.state, 'OK', early.text);
  }
  // the audit entry records the bound as approved_at prints it
  const verifies = recorded.filter((e) => e.kind === 'verify');
  assert.equal(verifies.length, 8);
  for (const e of verifies) assert.equal(e.flags, `--not-before ${T}`, JSON.stringify(e));
  // the sign-in filter carries the bound as given
  const signin = await v(cases[1][0], cases[1][1](T));
  assert.ok(signin.transport.calls[1].path.includes(`createdDateTime+ge+${T.replace(/:/g, '%3A')}`), signin.transport.calls[1].path);
  // one, two or three fractional digits; --since takes the same form
  for (const t of ['2026-10-28T09:00:00.4Z', '2026-10-28T09:00:00.41Z', T]) {
    assert.equal((await cli(['verify-password-changed', '--user', U, '--not-before', t])).code, 4, t);
    assert.equal((await cli(['sign-ins', '--user', U, '--since', t])).code, 0, t);
  }
  // anything else is still refused before any read
  for (const t of ['2026-10-28T09:00:00.4123Z', '2026-10-28T09:00:00.Z', '2026-10-28T09:00Z', '2026-10-28T09:00:00.412+00:00']) {
    const r = await cli(['verify-password-changed', '--user', U, '--not-before', t, '--execute'], { replies: [token(), ok({})] });
    assert.equal(r.code, 1, t);
    assert.equal(r.transport.calls.length, 0, t);
  }
});
