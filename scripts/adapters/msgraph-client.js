'use strict';
// msgraph-client.js: the read-only Microsoft Graph connector (batch G3, task 5c), built on
// the shared contract readonly-contract.js (README.md here).
//
// Aegis advises; humans execute (PRODUCT_CONTRACT.md). This file reads Microsoft Graph
// through GET routes on graph.microsoft.com and nothing else. It never resets a password,
// blocks sign-in, removes an authentication method, revokes sessions, changes a group or
// syncs a device: each of those is a HUMAN-RUN step in a runbook (/password-reset,
// /mfa-issue, /intune-compliance), and a verify-* command below proves it afterwards.
//
// Usage: node scripts/adapters/msgraph-client.js <command> [flags] [--execute]
//   Reads (a dry run that prints the planned request unless --execute is given):
//     user --user [USER_ID]|[UPN] | auth-methods --user ... | member-of --user ...
//     group-members --group [GROUP_ID] | sign-ins --user [USER_ID] --since [NOT_BEFORE]
//     managed-device --device [DEVICE_ID]
//   Read-backs (verified true or false; exit 0 verified, 2 not verified, 4 a dry run):
//     verify-password-changed --user U --not-before T   (lastPasswordChangeDateTime at or after T)
//     verify-account-enabled  --user U --enabled true|false
//     verify-mfa-method       --user U --method microsoftAuthenticator|phone|fido2|softwareOath|windowsHelloForBusiness|email|temporaryAccessPass
//     verify-mfa-cleared      --user U   (no phone, Authenticator or software OATH method left, as
//                                         "Require re-register MFA" leaves it; vendor fact B-18)
//     verify-signin           --user [USER_ID] --not-before T   (a successful sign-in at or after T)
//     verify-device-synced    --device [DEVICE_ID] --not-before T   (Intune lastSyncDateTime at or after T)
//     verify-group-member     --group [GROUP_ID] --user [USER_ID] [--absent]
//     verify-sessions-revoked --user [USER_ID] --not-before T   (signInSessionsValidFromDateTime at or
//                                         after T: Revoke sessions resets it; vendor facts M-26, M-27)
//     verify-method-absent    --user [USER_ID] --method-id [METHOD_ID]   (that method id no longer
//                                         listed in the user's authentication methods)
//
// Environment: MS_TENANT_ID (the tenant GUID: the token URL is the tenant's own, so a
// token can only come from this tenant), MS_CLIENT_ID, MS_PRIVATE_KEY (PEM) and
// MS_CERT_SHA256 (the certificate's base64url SHA-256 thumbprint, sent as x5t#S256).
// App-only, certificate credential; no client secret. Microsoft says to treat access tokens
// as opaque and the token response has no scope list, so the granted permissions cannot
// be checked: the first result says so (scope-manifest.json "msgraph").

const crypto = require('node:crypto');
const {
  STATES, RefusedError, TripwireError, defineAdapter, createClient, renderResult, exitCodeFor, parseArgs, redactDeep, dryRunExit,
} = require('./readonly-contract.js');
const { cliDeps, recordVerdict, takeChange, changeRefusal } = require('./cli-support.js');

const API_HOST = 'graph.microsoft.com';
const TOKEN_HOST = 'login.microsoftonline.com';
const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
const ASSERTION_LIFETIME_SECONDS = 300;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9.-]{1,190})$/i;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const SIGNIN_FILTER = /^userId eq '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' and createdDateTime ge \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/i;
const METHODS = ['microsoftAuthenticator', 'phone', 'fido2', 'softwareOath', 'windowsHelloForBusiness', 'email', 'temporaryAccessPass'];
// "Require re-register MFA" deletes these (vendor fact B-18)
const CLEARED_BY_REREGISTER = ['microsoftAuthenticator', 'phone', 'softwareOath'];

const USER_SELECT = 'id,userPrincipalName,accountEnabled,userType,onPremisesSyncEnabled,lastPasswordChangeDateTime,createdDateTime';
const DEVICE_SELECT = 'id,deviceName,lastSyncDateTime,complianceState,operatingSystem,managementState';
const ROUTES = Object.freeze({
  user: { method: 'GET', path: '/v1.0/users/:user', params: { user: USER }, fixedQuery: { $select: USER_SELECT } },
  // the session property is returned only on $select (vendor fact M-27), so it has its own read
  userSessions: { method: 'GET', path: '/v1.0/users/:user', params: { user: USER }, fixedQuery: { $select: 'id,signInSessionsValidFromDateTime' } },
  authMethods: { method: 'GET', path: '/v1.0/users/:user/authentication/methods', params: { user: USER } },
  memberOf: { method: 'GET', path: '/v1.0/users/:user/memberOf', params: { user: USER }, fixedQuery: { $select: 'id,displayName' } },
  groupMembers: { method: 'GET', path: '/v1.0/groups/:group/members', params: { group: GUID }, fixedQuery: { $select: 'id,userPrincipalName' } },
  signIns: { method: 'GET', path: '/v1.0/auditLogs/signIns', fixedQuery: { $top: '50' }, query: { $filter: SIGNIN_FILTER } },
  managedDevice: { method: 'GET', path: '/v1.0/deviceManagement/managedDevices/:device', params: { device: GUID }, fixedQuery: { $select: DEVICE_SELECT } },
});

const b64url = (s) => Buffer.from(s, 'utf8').toString('base64url');

// The client assertion: PS256, x5t#S256 in the header (vendor fact M-02).
function signAssertion(creds, tenant, nowMs, remember) {
  const key = crypto.createPrivateKey(creds.MS_PRIVATE_KEY);
  const iat = Math.floor(nowMs / 1000);
  const header = { alg: 'PS256', typ: 'JWT', 'x5t#S256': creds.MS_CERT_SHA256 };
  const claims = { aud: `https://${TOKEN_HOST}/${tenant}/oauth2/v2.0/token`, iss: creds.MS_CLIENT_ID, sub: creds.MS_CLIENT_ID, jti: crypto.randomUUID(), nbf: iat, iat, exp: iat + ASSERTION_LIFETIME_SECONDS };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signature = crypto.sign('sha256', Buffer.from(input, 'utf8'), { key, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 }).toString('base64url');
  const assertion = `${input}.${signature}`;
  remember(assertion);
  return assertion;
}

// A spec per tenant: the token URL carries MS_TENANT_ID, which must be a tenant GUID.
function makeSpec({ tenant, now = Date.now, remember = () => {} } = {}) {
  if (typeof tenant !== 'string' || !GUID.test(tenant)) throw new RefusedError('MS_TENANT_ID must be the tenant GUID before any read');
  return defineAdapter({
    platform: 'msgraph',
    host: { fixed: API_HOST },
    credentials: ['MS_CLIENT_ID', 'MS_PRIVATE_KEY', 'MS_CERT_SHA256'],
    auth: (creds, token) => ({ Authorization: `Bearer ${token}` }),
    routes: ROUTES,
    tokenExchange: {
      host: { fixed: TOKEN_HOST },
      path: `/${tenant.toLowerCase()}/oauth2/v2.0/token`,
      fields: ['client_id', 'scope', 'grant_type', 'client_assertion_type', 'client_assertion'],
      build: (creds) => ({ client_id: creds.MS_CLIENT_ID, scope: GRAPH_SCOPE, grant_type: 'client_credentials', client_assertion_type: ASSERTION_TYPE, client_assertion: signAssertion(creds, tenant.toLowerCase(), now(), remember) }),
      parse: (json) => ({ token: json && json.access_token, expiresInSeconds: json ? Number(json.expires_in) : NaN }),
    },
    // batch G3: Microsoft says to treat access tokens as opaque (vendor facts M-06, M-07)
    // and the token response has no scope field (M-03): not exposed
    scopes: { manifest: 'msgraph', kind: 'none', vendor: 'Microsoft Graph' },
  });
}

// ── Commands ─────────────────────────────────────────────────────────────────
// an authentication method's id as the methods read prints it: a GUID or a base64url string
const METHOD_ID = /^[A-Za-z0-9_-]{1,128}$/;
const RULES = { user: USER, group: GUID, device: GUID, since: ISO_UTC, 'not-before': ISO_UTC, enabled: /^(?:true|false)$/, method: new RegExp(`^(?:${METHODS.join('|')})$`), 'method-id': METHOD_ID };
const VALUE_FLAGS = Object.keys(RULES);
const BOOLEAN_FLAGS = ['execute', 'absent'];
const step = (route, params = {}, query = {}) => ({ route, params, query });
const signinFilter = (user, since) => `userId eq '${user}' and createdDateTime ge ${since}`;

const COMMANDS = Object.freeze({
  user: { kind: 'read', flags: ['user'], steps: (a) => [step('user', { user: a.user })] },
  'auth-methods': { kind: 'read', flags: ['user'], steps: (a) => [step('authMethods', { user: a.user })] },
  'member-of': { kind: 'read', flags: ['user'], steps: (a) => [step('memberOf', { user: a.user })] },
  'group-members': { kind: 'read', flags: ['group'], steps: (a) => [step('groupMembers', { group: a.group })] },
  'sign-ins': { kind: 'read', flags: ['user', 'since'], guidUser: true, steps: (a) => [step('signIns', {}, { $filter: signinFilter(a.user, a.since) })] },
  'managed-device': { kind: 'read', flags: ['device'], steps: (a) => [step('managedDevice', { device: a.device })] },
  'verify-password-changed': { kind: 'verify', flags: ['user', 'not-before'], steps: (a) => [step('user', { user: a.user })], expected: (a) => ({ user: a.user, lastPasswordChangeDateTime: `at or after ${a['not-before']}` }) },
  'verify-account-enabled': { kind: 'verify', flags: ['user', 'enabled'], steps: (a) => [step('user', { user: a.user })], expected: (a) => ({ user: a.user, accountEnabled: a.enabled === 'true' }) },
  'verify-mfa-method': { kind: 'verify', flags: ['user', 'method'], steps: (a) => [step('authMethods', { user: a.user })], expected: (a) => ({ user: a.user, registered: a.method }) },
  'verify-mfa-cleared': { kind: 'verify', flags: ['user'], steps: (a) => [step('authMethods', { user: a.user })], expected: (a) => ({ user: a.user, none_of: CLEARED_BY_REREGISTER }) },
  'verify-signin': { kind: 'verify', flags: ['user', 'not-before'], guidUser: true, steps: (a) => [step('signIns', {}, { $filter: signinFilter(a.user, a['not-before']) })], expected: (a) => ({ user: a.user, successful_sign_in: `at or after ${a['not-before']}` }) },
  'verify-device-synced': { kind: 'verify', flags: ['device', 'not-before'], steps: (a) => [step('managedDevice', { device: a.device })], expected: (a) => ({ device: a.device, lastSyncDateTime: `at or after ${a['not-before']}` }) },
  'verify-group-member': { kind: 'verify', flags: ['group', 'user'], booleans: ['absent'], guidUser: true, steps: (a) => [step('groupMembers', { group: a.group })], expected: (a) => ({ group: a.group, user: a.user, member: !a.absent }) },
  // batch G3 close-out 3, owner decision H3: the read-backs of /mfa-issue's session revocation
  // and one-method delete
  'verify-sessions-revoked': { kind: 'verify', flags: ['user', 'not-before'], steps: (a) => [step('userSessions', { user: a.user })], expected: (a) => ({ user: a.user, signInSessionsValidFromDateTime: `at or after ${a['not-before']}` }) },
  'verify-method-absent': { kind: 'verify', flags: ['user', 'method-id'], steps: (a) => [step('authMethods', { user: a.user })], expected: (a) => ({ user: a.user, method_id: a['method-id'], listed: false }) },
});

const USAGE = `Usage: node scripts/adapters/msgraph-client.js <command> [flags] [--execute]
  Commands: ${Object.keys(COMMANDS).join(' | ')}
  MS_TENANT_ID names the tenant; the credentials are read only with --execute.
`;

function validate(command, def, args) {
  const allowedBooleans = new Set(['execute', ...(def.booleans || [])]);
  for (const key of Object.keys(args)) {
    if (key === '_command') continue;
    if (BOOLEAN_FLAGS.includes(key) ? !allowedBooleans.has(key) : !(def.flags || []).includes(key)) throw new RefusedError(`${command} takes no --${key}`);
  }
  for (const f of def.flags || []) if (args[f] === undefined) throw new RefusedError(`${command} needs --${f}`);
  for (const f of def.flags || []) if (!RULES[f].test(args[f])) throw new RefusedError(`--${f} is not an allowed value for ${command}`);
  if (def.guidUser && !GUID.test(args.user)) throw new RefusedError(`${command} needs the user's object ID (a GUID), not a sign-in name`);
  return { ...args };
}

// ── Read-backs ───────────────────────────────────────────────────────────────
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const atOrAfter = (value, iso) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) >= Date.parse(iso);
const methodsOf = (data) => (isObject(data) && Array.isArray(data.value) ? data.value : []).filter(isObject)
  .map((m) => (typeof m['@odata.type'] === 'string' ? (/^#microsoft\.graph\.([A-Za-z0-9]+)AuthenticationMethod$/.exec(m['@odata.type']) || [])[1] : undefined)).filter(Boolean);

function judge(command, a, data) {
  const d = isObject(data) ? data : {};
  switch (command) {
    case 'verify-password-changed':
      return atOrAfter(d.lastPasswordChangeDateTime, a['not-before'])
        ? { verified: true, observed: { lastPasswordChangeDateTime: d.lastPasswordChangeDateTime } }
        : { verified: false, observed: { lastPasswordChangeDateTime: d.lastPasswordChangeDateTime === undefined ? null : d.lastPasswordChangeDateTime }, reason: `the password was last changed ${d.lastPasswordChangeDateTime || 'at no stated time'}, before ${a['not-before']}` };
    case 'verify-account-enabled': {
      const want = a.enabled === 'true';
      return d.accountEnabled === want
        ? { verified: true, observed: { accountEnabled: d.accountEnabled } }
        : { verified: false, observed: { accountEnabled: d.accountEnabled === undefined ? null : d.accountEnabled }, reason: `accountEnabled is ${d.accountEnabled === undefined ? 'not shown' : d.accountEnabled}, not ${want}` };
    }
    case 'verify-mfa-method': {
      const methods = methodsOf(d);
      return methods.includes(a.method)
        ? { verified: true, observed: { methods } }
        : { verified: false, observed: { methods }, reason: `no ${a.method} method is registered` };
    }
    case 'verify-mfa-cleared': {
      const methods = methodsOf(d);
      const left = methods.filter((m) => CLEARED_BY_REREGISTER.includes(m));
      if (isObject(d) && typeof d['@odata.nextLink'] === 'string') return { verified: false, observed: { methods }, reason: 'the method list has another page, so this is not proof either way' };
      return left.length ? { verified: false, observed: { methods }, reason: `still registered: ${left.join(', ')}` } : { verified: true, observed: { methods } };
    }
    case 'verify-signin': {
      const items = (Array.isArray(d.value) ? d.value : []).filter(isObject);
      const good = items.find((s) => atOrAfter(s.createdDateTime, a['not-before']) && isObject(s.status) && s.status.errorCode === 0);
      if (good) return { verified: true, observed: { createdDateTime: good.createdDateTime, errorCode: 0 } };
      const codes = items.slice(0, 10).map((s) => (isObject(s.status) ? s.status.errorCode : null));
      return { verified: false, observed: { sign_ins_read: items.length, error_codes: codes }, reason: `no successful sign-in at or after ${a['not-before']} among the ${items.length} read` };
    }
    case 'verify-device-synced':
      return atOrAfter(d.lastSyncDateTime, a['not-before'])
        ? { verified: true, observed: { lastSyncDateTime: d.lastSyncDateTime, complianceState: d.complianceState === undefined ? null : d.complianceState } }
        : { verified: false, observed: { lastSyncDateTime: d.lastSyncDateTime === undefined ? null : d.lastSyncDateTime }, reason: `the device last synced ${d.lastSyncDateTime || 'at no stated time'}, before ${a['not-before']}` };
    case 'verify-group-member': {
      const ids = (Array.isArray(d.value) ? d.value : []).filter(isObject).map((m) => String(m.id || '').toLowerCase());
      const present = ids.includes(a.user.toLowerCase());
      // absence on a page with more pages behind it proves nothing, either way
      if (!present && typeof d['@odata.nextLink'] === 'string') return { verified: false, observed: { member: false }, reason: 'the member list has another page, so this is not proof either way; check in the Entra admin center' };
      if (present === !a.absent) return { verified: true, observed: { member: present } };
      return { verified: false, observed: { member: present }, reason: present ? 'the user is still a member' : 'the user is not a member' };
    }
    case 'verify-sessions-revoked': {
      // Revoke sessions resets signInSessionsValidFromDateTime to the time of the revocation
      // (vendor fact M-26); Microsoft notes tokens may take a few minutes more to be revoked
      const value = d.signInSessionsValidFromDateTime;
      if (value === undefined || value === null) return { verified: false, observed: { signInSessionsValidFromDateTime: null }, reason: 'signInSessionsValidFromDateTime is not in the answer, so this is not proof either way' };
      if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return { verified: false, observed: { signInSessionsValidFromDateTime: null }, reason: 'signInSessionsValidFromDateTime is not a time, so this is not proof either way' };
      return atOrAfter(value, a['not-before'])
        ? { verified: true, observed: { signInSessionsValidFromDateTime: value } }
        : { verified: false, observed: { signInSessionsValidFromDateTime: value }, reason: `sessions are valid from ${value}, before ${a['not-before']}: they were not revoked since` };
    }
    case 'verify-method-absent': {
      if (!isObject(data) || !Array.isArray(data.value)) return { verified: false, observed: { listed: null }, reason: 'the answer has no method list, so this is not proof either way' };
      const ids = data.value.filter(isObject).map((m) => String(m.id || ''));
      if (ids.includes(a['method-id'])) return { verified: false, observed: { listed: true }, reason: 'the method is still listed' };
      // absence on a page with more pages behind it proves nothing
      if (typeof data['@odata.nextLink'] === 'string') return { verified: false, observed: { listed: false }, reason: 'the method list has another page, so this is not proof either way' };
      return { verified: true, observed: { listed: false, methods_read: ids.length } };
    }
    default:
      throw new RefusedError('unknown read-back');
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function run(argv, env = process.env, deps = {}) {
  const out = deps.out || ((s) => process.stdout.write(s));
  const err = deps.err || ((s) => process.stderr.write(s));
  const now = deps.now || Date.now;
  const seen = [];
  const remember = (value) => { if (typeof value === 'string' && value.length >= 4 && !seen.includes(value)) seen.push(value); };
  const secrets = () => [...seen, ...['MS_CLIENT_ID', 'MS_PRIVATE_KEY', 'MS_CERT_SHA256'].map((n) => env[n]).filter((v) => typeof v === 'string' && v.length >= 4)];
  // batch G3 close-out (owner decision 1): --change binds a verify-* read-back to its change
  // record; it is taken out of argv here and checked below, before any read
  const bound = takeChange(argv);
  try {
    const args = parseArgs(bound.argv, { values: VALUE_FLAGS, booleans: BOOLEAN_FLAGS });
    const command = args._command;
    if (command === 'help' || command === '--help') { out(USAGE); return 0; }
    if (typeof command !== 'string' || !Object.prototype.hasOwnProperty.call(COMMANDS, command)) {
      err(USAGE);
      throw new RefusedError(command === undefined ? 'no command given' : 'unknown command; no command writes to Microsoft 365');
    }
    const def = COMMANDS[command];
    const a = validate(command, def, args);
    const spec = makeSpec({ tenant: env.MS_TENANT_ID, now, remember });
    const steps = def.steps(a);
    const cli = cliDeps(deps, env);
    const refusal = changeRefusal('msgraph', command, bound, cli.audit);
    if (refusal) throw new RefusedError(refusal);

    if (args.execute !== true) {
      const dryClient = createClient(spec, { env: {}, transport: async () => { throw new Error('dry run'); } });
      const p = dryClient.plan(steps[0].route, steps[0].params, steps[0].query);
      if (p.state !== STATES.OK) throw new RefusedError(p.error || 'request refused');
      const shown = { state: STATES.OK, ok: true, command, method: p.method, host: p.host, path: p.path };
      if (def.kind === 'verify') shown.expected = def.expected(a);
      shown.auth = `before the first read, one POST to ${TOKEN_HOST}/${env.MS_TENANT_ID.toLowerCase()}/oauth2/v2.0/token with a certificate assertion; the access token then goes only in the Authorization header`;
      shown.note = 'dry run: no credentials read, no network';
      shown.next = 'Add --execute to perform this read.';
      out(renderResult(shown, { platform: 'msgraph' }));
      return dryRunExit(command, err);
    }

    const client = createClient(spec, { env, ...cli, now });
    const r = await client.get(steps[0].route, steps[0].params, steps[0].query);
    let res;
    if (!r.ok) res = { command, ...r };
    else if (def.kind === 'read') {
      res = { state: STATES.OK, ok: true, command, status: r.status, attempts: r.attempts, data: r.data, ...(r.scope_notice ? { scope_notice: r.scope_notice } : {}), ...(r.flags && r.flags.length ? { flags: r.flags } : {}) };
      if (isObject(r.data) && typeof r.data['@odata.nextLink'] === 'string') { res.morePages = true; res.note = 'more records exist: narrow the read (a later --since) or read the rest in the admin center'; }
    } else {
      const judged = judge(command, a, r.data);
      const verdict = { state: STATES.OK, ok: true, command, verified: judged.verified === true, expected: def.expected(a), observed: judged.observed, ...(r.scope_notice ? { scope_notice: r.scope_notice } : {}) };
      if (!verdict.verified) verdict.reason = judged.reason;
      res = recordVerdict(cli.audit, 'msgraph', verdict, bound.change, null, bound.argv);
    }
    const shown = redactDeep(res, secrets());
    const code = exitCodeFor(shown);
    (code === 1 ? err : out)(renderResult(shown, { secrets: secrets(), platform: 'msgraph', operation: command }));
    return code;
  } catch (error) {
    if (error instanceof TripwireError || (error && error.name === 'NetworkTripwireError')) throw error;
    if (error instanceof RefusedError) {
      err(renderResult({ state: STATES.REFUSED, ok: false, error: error.message }, { secrets: secrets(), platform: 'msgraph' }));
      return 1;
    }
    err(renderResult({ state: STATES.INVALID_RESPONSE, ok: false, error: 'unexpected adapter error (details withheld)' }, { platform: 'msgraph' }));
    return 2;
  }
}

if (require.main === module) {
  run(process.argv.slice(2), process.env).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(error && error.name === 'NetworkTripwireError' ? 'Network tripwire fired\n' : 'msgraph-client: unexpected error (details withheld)\n');
    process.exitCode = 2;
  });
}

module.exports = { makeSpec, ROUTES, COMMANDS, run, CLEARED_BY_REREGISTER, METHODS };
