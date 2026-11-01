'use strict';
// okta-client.js: the read-only Okta connector (batch G3), built on the shared contract
// readonly-contract.js (README.md here). Facts: docs/aegis/g3/vendor-facts.md, section A3
// (O-01 to O-30). Scope manifest entry: scope-manifest.json, okta.
//
// Aegis advises; humans execute (PRODUCT_CONTRACT.md). This file reads the Okta Management
// API through eight GET routes and nothing else. It never suspends, deactivates, unlocks
// or deletes a user, never resets a factor or a password, never clears a session, never
// changes a group, a group rule, an app assignment or an admin role: each of those is a
// HUMAN-RUN step in a runbook, and a verify-* command below proves it afterwards.
//
// Usage: node scripts/adapters/okta-client.js <command> [flags] [--execute]
//   Reads (a dry run that prints the planned request unless --execute is given):
//     user --user [OKTA_USER_ID]|[USER@DOMAIN.COM]      factors --user ...      user-groups --user ...
//     group --group [OKTA_GROUP_ID]                      group-members --group ... [--after CURSOR]
//     group-rules [--search TEXT]                        app-user --app [APP_ID] --user [OKTA_USER_ID]
//     logs --since [NOT_BEFORE] [--event TYPE] [--target [OKTA_USER_ID]]
//   Read-backs (also a dry run unless --execute; each takes the Okta user ID):
//     verify-status            --user [OKTA_USER_ID] --status ACTIVE|SUSPENDED|DEPROVISIONED|LOCKED_OUT|
//                              PASSWORD_EXPIRED|PROVISIONED|RECOVERY|STAGED
//     verify-factor-reset      --user [OKTA_USER_ID] --factor-type TYPE
//     verify-factors-reset-all --user [OKTA_USER_ID]
//     verify-sessions-cleared  --user [OKTA_USER_ID] --not-before [NOT_BEFORE]
//     verify-password-reset    --user [OKTA_USER_ID] --not-before [NOT_BEFORE]
//     verify-group-member      --group [OKTA_GROUP_ID] --user [OKTA_USER_ID] [--absent]
//     verify-app-assigned      --app [APP_ID] --user [OKTA_USER_ID] [--absent]
//
// Environment (the host for a dry run too; the credentials only under --execute, and only
// by the token exchange):
//   OKTA_ORG_URL      the Okta org ([@Aegion_OKTA_ORG_URL]) as a bare hostname, no scheme,
//                     path or port. One org per tenant: the tenant is bound by this host,
//                     so no read returns exit 3.
//   OKTA_CLIENT_ID    the OAuth 2.0 service app's client ID.
//   OKTA_PRIVATE_KEY  the service app's RSA private key in PEM form, from the environment
//                     only (a value with literal \n escapes is read with them turned into
//                     line breaks). The assertion is signed RS256.
//   OKTA_KEY_ID       optional: the key ID, sent as the JWT header kid.
// No value of these three is printed.
//
// The token exchange (O-01 to O-06): one POST to https://{OKTA_ORG_URL}/oauth2/v1/token,
// form-encoded with exactly grant_type=client_credentials, scope (the four read scopes in
// SCOPES), client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer and
// client_assertion (an RS256 JWT: iss = sub = the client ID, aud = the token URL, iat,
// exp = iat + 300, a random jti). It is never retried (the contract), and one token serves
// every read of a run.
//
// Scope preflight (O-06, O-19): the token response's scope must hold only
// okta.<resource>.read scopes; a token that also grants a write scope (okta.users.manage,
// okta.workflows.invoke.manage, ...) is SCOPE_REFUSED before any read. Scopes are not the
// whole boundary (O-08, O-09): the service app must also hold the READ_ONLY_ADMIN role,
// which this connector does not read (O-10 needs okta.roles.read, which it does not ask
// for), so the role is checked in the Admin Console.
//
// Exit codes: 0 read or verified; 1 refused, input error, missing credentials or a
// write-scoped token; 2 the read failed or a verify-* read did not prove the write; 4 a
// verify-* dry run (nothing was read, so nothing is verified); 5 a verify-* answer that proves
// nothing either way (INCONCLUSIVE, batch G4 task D1).
//
// Facts this file relies on that section A3 does not state (or marks UNCONFIRMED), and the
// safer reading taken:
//   - Okta ID shapes: a user ID starts 00u, a group ID 00g, an app ID 0oa. A value of
//     another shape is refused (exit 1), never sent.
//   - GET /api/v1/users/:id also takes the login (the user, factors and user-groups reads
//     accept one); every read-back and app-user take the user ID only.
//   - Response fields: access_token and expires_in in the token response; id, status,
//     profile.login in a user; factorType in a factor; id and status in an app user;
//     published, eventType, target[].id and outcome.result in a System Log event. A
//     missing or unexpected field is reported as not proven, never as proof.
//   - Paging: the group members list is read 200 at a time with after = the last member's
//     id (the contract does not expose the Link header). A page that repeats a member
//     stops the walk as not proven.
//   - The System Log filter fields eventType and target.id (O-20 names a SCIM filter).
//   - An app-user read answers 404 when the user is not assigned (and when --app is
//     wrong, so "absent" carries a caveat to check the app ID).
//   - The JWT header carries typ JWT, and kid when OKTA_KEY_ID is set (O-04 and O-05 name
//     the claims and the algorithms only).
//   - Whether a service app must use DPoP is UNCONFIRMED (O-11); none is sent.
//   - A 429 carries no documented Retry-After (O-30, UNCONFIRMED); the contract's backoff
//     applies, and X-Rate-Limit-Reset (O-29) is not read.

const crypto = require('node:crypto');

const {
  STATES, EXIT, RefusedError, TripwireError,
  defineAdapter, createClient, renderResult, exitCodeFor, parseArgs, redactDeep, realCalendarTime, dryRunExit, inconclusive,
} = require('./readonly-contract.js');
const { cliDeps, recordVerdict, takeChange, changeRefusal } = require('./cli-support.js');

const PLATFORM = 'okta';

// ── The token exchange and the scopes ────────────────────────────────────────
const TOKEN_PATH = '/oauth2/v1/token';
const CLIENT_CREDENTIALS = 'client_credentials';
const ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
const ASSERTION_LIFETIME_SECONDS = 300; // O-04 allows at most one hour
const SCOPES = Object.freeze(['okta.users.read', 'okta.groups.read', 'okta.logs.read', 'okta.apps.read']);
const READ_SCOPE = /^okta\.[a-z]+(?:\.[a-z]+)*\.read$/i;

// Every scope this connector asks for must be one of the four read scopes above.
function checkScopes(scopes) {
  if (!Array.isArray(scopes) || !scopes.length) throw new Error('scopes: a non-empty list of read scopes is required');
  for (const scope of scopes) {
    if (typeof scope !== 'string' || !SCOPES.includes(scope) || !READ_SCOPE.test(scope)) {
      throw new Error(`scope ${String(scope).slice(0, 80)} is refused: only the four Okta read scopes are requested`);
    }
  }
  return true;
}
checkScopes(SCOPES);

// ── Validators (the CLI checks input with these, and the contract re-checks the path) ─
const USER_ID_SRC = '00u[A-Za-z0-9]{10,30}';
const EMAIL_SRC = "[A-Za-z0-9][A-Za-z0-9._+'-]{0,63}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.){1,8}[A-Za-z]{2,63}";
const USER_ID = new RegExp(`^${USER_ID_SRC}$`);
const USER_KEY = new RegExp(`^(?:${USER_ID_SRC}|(?=.{3,254}$)${EMAIL_SRC})$`);
const GROUP_ID = /^00g[A-Za-z0-9]{10,30}$/;
const APP_ID = /^0oa[A-Za-z0-9]{10,30}$/;
const OBJECT_ID = /^[A-Za-z0-9]{10,40}$/;
const AFTER = /^[A-Za-z0-9_-]{1,128}$/;
const PAGE_LIMIT = /^(?:[1-9][0-9]?|1[0-9]{2}|200)$/; // 1 to 200
const LOGS_LIMIT = /^(?:[1-9][0-9]{0,2}|1000)$/; // 1 to 1000 (O-20)
const SEARCH = /^[^\u0000-\u001f\u007f-\u009f]{1,256}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SORT_ORDER = /^(?:ASCENDING|DESCENDING)$/;
const EVENT_TYPE = /^[a-z][a-z0-9_]{0,40}(?:\.[a-z0-9_]{1,40}){1,6}$/;
// The System Log filter, in one safe grammar only: up to four terms joined by "and", each
// eventType or target.id compared with eq to a quoted value without quotes or spaces.
const FILTER_TERM = '(?:eventType|target\\.id) eq "[A-Za-z0-9._-]{1,128}"';
const LOG_FILTER = new RegExp(`^${FILTER_TERM}(?: and ${FILTER_TERM}){0,3}$`);
const STATUSES = Object.freeze(['ACTIVE', 'DEPROVISIONED', 'LOCKED_OUT', 'PASSWORD_EXPIRED', 'PROVISIONED', 'RECOVERY', 'STAGED', 'SUSPENDED']); // O-21
const FACTOR_TYPE = /^[a-z][a-z0-9_]{0,40}(?::[a-z0-9_]{1,40}){0,3}$/;
const CLIENT_ID_SHAPE = /^[A-Za-z0-9_-]{1,128}$/;
const KEY_ID_SHAPE = /^[A-Za-z0-9_.-]{1,128}$/;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

// ── The allow-list: eight GET reads ──────────────────────────────────────────
// groupRules comes before group: both have four segments, and the raw-path door takes the
// first route whose literal segments match.
const ROUTES = Object.freeze({
  user: { method: 'GET', path: '/api/v1/users/:id', params: { id: USER_KEY } }, // O-12
  userFactors: { method: 'GET', path: '/api/v1/users/:id/factors', params: { id: USER_KEY } }, // O-13
  userGroups: { method: 'GET', path: '/api/v1/users/:id/groups', params: { id: USER_KEY } }, // O-14
  groupRules: { method: 'GET', path: '/api/v1/groups/rules', query: { limit: PAGE_LIMIT, after: AFTER, search: SEARCH } }, // O-15
  group: { method: 'GET', path: '/api/v1/groups/:id', params: { id: GROUP_ID } }, // O-15
  groupMembers: { method: 'GET', path: '/api/v1/groups/:id/users', params: { id: GROUP_ID }, query: { limit: PAGE_LIMIT, after: AFTER } }, // O-15
  logs: { method: 'GET', path: '/api/v1/logs', query: { since: ISO_UTC, until: ISO_UTC, filter: LOG_FILTER, limit: LOGS_LIMIT, sortOrder: SORT_ORDER } }, // O-16, O-20
  appUser: { method: 'GET', path: '/api/v1/apps/:appId/users/:userId', params: { appId: APP_ID, userId: USER_ID } }, // O-17
});

// ── The signed assertion (O-02 to O-05) ──────────────────────────────────────
const b64url = (text) => Buffer.from(text, 'utf8').toString('base64url');
const pemFrom = (value) => (!value.includes('\n') && value.includes('\\n') ? value.replace(/\\n/g, '\n') : value);

// An RS256 JWT for Okta's private_key_jwt client authentication. Error messages name the
// variable only, never its value.
function signAssertion({ clientId, privateKey, keyId, host, nowMs }, remember = () => {}) {
  if (typeof clientId !== 'string' || !CLIENT_ID_SHAPE.test(clientId)) throw new RefusedError('OKTA_CLIENT_ID must be the service app\'s client ID: letters, digits, _ and - only (value withheld)');
  const kid = typeof keyId === 'string' && keyId !== '' ? keyId : null;
  if (keyId !== undefined && keyId !== '' && (kid === null || !KEY_ID_SHAPE.test(kid))) throw new RefusedError('OKTA_KEY_ID must be the key ID of the service app\'s public key: letters, digits, ., _ and - only (value withheld)');
  if (typeof host !== 'string' || !HOSTNAME.test(host)) throw new RefusedError('OKTA_ORG_URL must be a bare https hostname (no scheme, path, port or trailing dot)');
  if (!Number.isFinite(nowMs)) throw new RefusedError('the clock gave no time for the assertion');
  const pem = pemFrom(privateKey);
  remember(pem);
  let key;
  try {
    key = crypto.createPrivateKey(pem);
  } catch {
    throw new RefusedError('OKTA_PRIVATE_KEY is not a private key in PEM form that the connector can read (value withheld)');
  }
  if (key.asymmetricKeyType !== 'rsa') throw new RefusedError('OKTA_PRIVATE_KEY must be an RSA private key: the assertion is signed RS256 (value withheld)');
  const iat = Math.floor(nowMs / 1000);
  const header = { alg: 'RS256', typ: 'JWT', ...(kid ? { kid } : {}) };
  const claims = { iss: clientId, sub: clientId, aud: `https://${host}${TOKEN_PATH}`, iat, exp: iat + ASSERTION_LIFETIME_SECONDS, jti: crypto.randomUUID() };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signature = crypto.sign('sha256', Buffer.from(input, 'utf8'), key).toString('base64url');
  const assertion = `${input}.${signature}`;
  remember(assertion);
  return assertion;
}

// A spec per run: the assertion uses the run's clock and environment view, and the run can
// redact what it signed. The token audience and the optional key ID are read from env,
// inside the token exchange only. SPEC (exported) is the same spec on process.env and the
// system clock.
function makeSpec({ env = process.env, now = Date.now, remember = () => {} } = {}) {
  return defineAdapter({
    platform: PLATFORM,
    host: { env: 'OKTA_ORG_URL' },
    credentials: ['OKTA_CLIENT_ID', 'OKTA_PRIVATE_KEY'],
    auth: (creds, token) => ({ Authorization: `Bearer ${token}` }),
    routes: ROUTES,
    tokenExchange: {
      path: TOKEN_PATH,
      fields: ['grant_type', 'scope', 'client_assertion_type', 'client_assertion'],
      build: (creds) => ({
        grant_type: CLIENT_CREDENTIALS,
        scope: SCOPES.join(' '),
        client_assertion_type: ASSERTION_TYPE,
        client_assertion: signAssertion({ clientId: creds.OKTA_CLIENT_ID, privateKey: creds.OKTA_PRIVATE_KEY, keyId: env.OKTA_KEY_ID, host: env.OKTA_ORG_URL, nowMs: now() }, remember),
      }),
      parse: (json) => ({ token: json && json.access_token, expiresInSeconds: json ? Number(json.expires_in) : NaN }),
    },
    // batch G3: Okta returns the granted scopes in the token response's scope field (O-06);
    // only okta.<resource>.read scopes pass, so a write scope (O-19) is refused before a read
    scopes: {
      manifest: 'okta', kind: 'token', vendor: 'Okta',
      granted: (json) => (json && typeof json.scope === 'string' ? json.scope.split(' ').filter(Boolean) : null),
      allowed: (s) => typeof s === 'string' && READ_SCOPE.test(s),
    },
  });
}
const SPEC = makeSpec();

// ── Requests ─────────────────────────────────────────────────────────────────
const MEMBERS_PAGE = 200;
const MAX_PAGES = 10;
const LOGS_PAGE = 100;
const SESSION_CLEAR = 'user.session.clear'; // O-23
const PASSWORD_RESET = 'user.account.reset_password'; // O-27

const userRequest = (user) => ['user', { id: user }, {}];
const factorsRequest = (user) => ['userFactors', { id: user }, {}];
const membersRequest = (group, after) => ['groupMembers', { id: group }, after === undefined ? { limit: String(MEMBERS_PAGE) } : { limit: String(MEMBERS_PAGE), after }];
const appUserRequest = (app, user) => ['appUser', { appId: app, userId: user }, {}];
function logFilter(eventType, targetId) {
  const terms = [];
  if (eventType !== undefined) terms.push(`eventType eq "${eventType}"`);
  if (targetId !== undefined) terms.push(`target.id eq "${targetId}"`);
  return terms.length ? terms.join(' and ') : undefined;
}
const logsRequest = (since, filter) => ['logs', {}, filter === undefined ? { since, limit: String(LOGS_PAGE) } : { since, filter, limit: String(LOGS_PAGE) }];

// ── Commands ─────────────────────────────────────────────────────────────────
const COMMANDS = Object.freeze({
  user: { kind: 'read', required: ['user'], optional: [], request: (a) => userRequest(a.user) },
  factors: { kind: 'read', required: ['user'], optional: [], request: (a) => factorsRequest(a.user) },
  'user-groups': { kind: 'read', required: ['user'], optional: [], request: (a) => ['userGroups', { id: a.user }, {}] },
  group: { kind: 'read', required: ['group'], optional: [], request: (a) => ['group', { id: a.group }, {}] },
  'group-members': { kind: 'read', required: ['group'], optional: ['after'], request: (a) => membersRequest(a.group, a.after) },
  'group-rules': { kind: 'read', required: [], optional: ['search'], request: (a) => ['groupRules', {}, a.search === undefined ? {} : { search: a.search }] },
  logs: { kind: 'read', required: ['since'], optional: ['event', 'target'], request: (a) => logsRequest(a.since, logFilter(a.event, a.target)) },
  'app-user': { kind: 'read', required: ['app', 'user'], optional: [], request: (a) => appUserRequest(a.app, a.user) },
  'verify-status': {
    kind: 'verify', required: ['user', 'status'], optional: [], plans: (a) => [userRequest(a.user)],
    expected: (a) => ({ user: a.user, status: a.status }),
  },
  'verify-factor-reset': {
    kind: 'verify', required: ['user', 'factor-type'], optional: [], plans: (a) => [userRequest(a.user), factorsRequest(a.user)],
    expected: (a) => ({ user: a.user, factorType: a.factorType, enrolled: false }),
  },
  'verify-factors-reset-all': {
    kind: 'verify', required: ['user'], optional: [], plans: (a) => [userRequest(a.user), factorsRequest(a.user)],
    expected: (a) => ({ user: a.user, factors: 0 }),
  },
  'verify-sessions-cleared': {
    kind: 'verify', required: ['user', 'not-before'], optional: [], plans: (a) => [logsRequest(a.notBefore, logFilter(SESSION_CLEAR, a.user))],
    expected: (a) => ({ user: a.user, eventType: SESSION_CLEAR, notBefore: a.notBefore }),
  },
  'verify-password-reset': {
    kind: 'verify', required: ['user', 'not-before'], optional: [], plans: (a) => [logsRequest(a.notBefore, logFilter(PASSWORD_RESET, a.user))],
    expected: (a) => ({ user: a.user, eventType: PASSWORD_RESET, notBefore: a.notBefore }),
  },
  'verify-group-member': {
    kind: 'verify', required: ['group', 'user'], optional: ['absent'], plans: (a) => [userRequest(a.user), membersRequest(a.group)],
    expected: (a) => ({ group: a.group, user: a.user, member: a.absent !== true }),
    pages: `up to ${MAX_PAGES} pages of ${MEMBERS_PAGE} members, each next page with after set to the last member's id`,
  },
  'verify-app-assigned': {
    kind: 'verify', required: ['app', 'user'], optional: ['absent'], plans: (a) => [userRequest(a.user), appUserRequest(a.app, a.user)],
    expected: (a) => ({ app: a.app, user: a.user, assigned: a.absent !== true }),
  },
});

const VALUE_FLAGS = ['user', 'group', 'after', 'search', 'since', 'event', 'target', 'app', 'status', 'factor-type', 'not-before'];
const BOOLEAN_FLAGS = ['execute', 'absent'];
const READS_TAKING_A_LOGIN = ['user', 'factors', 'user-groups'];

const USAGE = [
  'Usage: node scripts/adapters/okta-client.js <command> [flags] [--execute]',
  '  Reads:   user --user [OKTA_USER_ID]|[USER@DOMAIN.COM] | factors --user ... | user-groups --user ...',
  '           group --group [OKTA_GROUP_ID] | group-members --group [OKTA_GROUP_ID] [--after CURSOR]',
  '           group-rules [--search TEXT] | app-user --app [APP_ID] --user [OKTA_USER_ID]',
  '           logs --since [NOT_BEFORE] [--event TYPE] [--target [OKTA_USER_ID]]',
  '  Verify:  verify-status --user [OKTA_USER_ID] --status ACTIVE|SUSPENDED|DEPROVISIONED|LOCKED_OUT|PASSWORD_EXPIRED|PROVISIONED|RECOVERY|STAGED',
  '           verify-factor-reset --user [OKTA_USER_ID] --factor-type TYPE | verify-factors-reset-all --user [OKTA_USER_ID]',
  '           verify-sessions-cleared --user [OKTA_USER_ID] --not-before [NOT_BEFORE]',
  '           verify-password-reset --user [OKTA_USER_ID] --not-before [NOT_BEFORE]',
  '           verify-group-member --group [OKTA_GROUP_ID] --user [OKTA_USER_ID] [--absent]',
  '           verify-app-assigned --app [APP_ID] --user [OKTA_USER_ID] [--absent]',
  'Reads and read-backs are a dry run unless the bare --execute flag is given. No command writes to Okta.',
  '',
].join('\n');

const realTime = (iso) => ISO_UTC.test(iso) && realCalendarTime(iso);

// Every flag is checked before a client exists, so bad input reads and sends nothing.
function validate(command, def, args) {
  for (const key of Object.keys(args)) {
    if (key === '_command' || key === 'execute') continue;
    if (!def.required.includes(key) && !def.optional.includes(key)) throw new RefusedError(`--${key} does not apply to ${command}`);
  }
  for (const flag of def.required) if (args[flag] === undefined) throw new RefusedError(`${command} needs --${flag}`);
  const a = {};
  if (args.user !== undefined) {
    if (READS_TAKING_A_LOGIN.includes(command)) {
      if (!USER_KEY.test(args.user)) throw new RefusedError('--user must be an Okta user ID ([OKTA_USER_ID], 00u...) or a login such as [USER@DOMAIN.COM]');
    } else if (!USER_ID.test(args.user)) {
      throw new RefusedError(`--user must be the Okta user ID ([OKTA_USER_ID], 00u...) for ${command}: it names one exact account`);
    }
    a.user = args.user;
  }
  if (args.group !== undefined) {
    if (!GROUP_ID.test(args.group)) throw new RefusedError('--group must be an Okta group ID ([OKTA_GROUP_ID], 00g...)');
    a.group = args.group;
  }
  if (args.app !== undefined) {
    if (!APP_ID.test(args.app)) throw new RefusedError('--app must be an Okta app ID ([APP_ID], 0oa...)');
    a.app = args.app;
  }
  if (args.after !== undefined) {
    if (!AFTER.test(args.after)) throw new RefusedError('--after must be a paging cursor: the id of the last member a previous read listed');
    a.after = args.after;
  }
  if (args.search !== undefined) {
    if (!SEARCH.test(args.search)) throw new RefusedError('--search must be 1 to 256 printable characters');
    a.search = args.search;
  }
  for (const [flag, key] of [['since', 'since'], ['not-before', 'notBefore']]) {
    if (args[flag] === undefined) continue;
    if (!ISO_UTC.test(args[flag])) throw new RefusedError(`--${flag} must be an ISO 8601 UTC time such as 2026-01-31T09:30:00.000Z`);
    if (!realTime(args[flag])) throw new RefusedError(`--${flag} is not a real date and time`);
    a[key] = args[flag];
  }
  if (args.event !== undefined) {
    if (!EVENT_TYPE.test(args.event)) throw new RefusedError('--event must be one System Log event type, such as user.session.clear');
    a.event = args.event;
  }
  if (args.target !== undefined) {
    if (!OBJECT_ID.test(args.target)) throw new RefusedError('--target must be one Okta object ID, such as [OKTA_USER_ID]');
    a.target = args.target;
  }
  if (args.status !== undefined) {
    if (!STATUSES.includes(args.status)) throw new RefusedError(`--status must be one of ${STATUSES.join(', ')}`);
    a.status = args.status;
  }
  if (args['factor-type'] !== undefined) {
    if (!FACTOR_TYPE.test(args['factor-type'])) throw new RefusedError('--factor-type must be one factor type, such as sms, push or token:software:totp');
    a.factorType = args['factor-type'];
  }
  if (args.absent === true) a.absent = true;
  return a;
}

// ── Personal fields ──────────────────────────────────────────────────────────
// A user's profile values (names, email addresses, phone numbers) except its login, its
// credentials (recovery question, provider), a factor's profile (phone number, email) and
// its _embedded block, and an app user's profile and credentials print as "set" or
// "missing", never as values. A flag on one keeps its path and withholds its text.
const PERSONAL_WITHHELD = '(personal detail withheld)';
const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const orNull = (value) => (value === undefined ? null : value);
const filled = (v) => (typeof v === 'string' ? v.trim() !== '' : Array.isArray(v) ? v.length > 0 : isObject(v) ? Object.keys(v).length > 0 : v !== null && v !== undefined);
const step = (at, key) => (/^[A-Za-z_$][\w$]*$/.test(key) ? `${at}.${key}` : `${at}[${JSON.stringify(key)}]`);

// keep null: the whole value prints as set or missing; otherwise each key does, except the
// keys in keep, which print as read.
function setOrMissing(value, at, masked, keep = []) {
  if (keep === null || !isObject(value)) {
    masked.push(at);
    return filled(value) ? 'set' : 'missing';
  }
  const out = {};
  for (const key of Object.keys(value)) {
    if (keep.includes(key)) { out[key] = value[key]; continue; }
    masked.push(step(at, key));
    out[key] = filled(value[key]) ? 'set' : 'missing';
  }
  return out;
}

function maskFields(record, at, masked, fields) {
  if (!isObject(record)) return record;
  const out = { ...record };
  for (const [field, keep] of fields) {
    if (Object.prototype.hasOwnProperty.call(record, field)) out[field] = setOrMissing(record[field], step(at, field), masked, keep);
  }
  return out;
}
const maskUser = (u, at, masked) => maskFields(u, at, masked, [['profile', ['login']], ['credentials', []]]);
const maskFactor = (f, at, masked) => maskFields(f, at, masked, [['profile', []], ['_embedded', null]]);
const maskAppUser = (u, at, masked) => maskFields(u, at, masked, [['profile', []], ['credentials', []]]);
const listOf = (maskOne) => (data, at, masked) => (Array.isArray(data) ? data.map((item, i) => maskOne(item, `${at}[${i}]`, masked)) : maskOne(data, at, masked));
const maskUsers = listOf(maskUser);
const maskFactors = listOf(maskFactor);

const MASKS = Object.freeze({ user: maskUser, factors: maskFactors, 'group-members': maskUsers, 'app-user': maskAppUser });

const underMasked = (p, masked) => masked.some((m) => p === m || p.startsWith(`${m}.`) || p.startsWith(`${m}[`));
const withhold = (flags, masked) => flags.map((f) => (underMasked(String(f.path), masked) ? { ...f, quote: PERSONAL_WITHHELD } : f));

// ── Reads ────────────────────────────────────────────────────────────────────
function failed(command, r) {
  return { command, ...r };
}

function readOutput(command, r) {
  const masked = [];
  const out = { state: STATES.OK, ok: true, command, status: r.status, attempts: r.attempts };
  if (r.request_id) out.request_id = r.request_id;
  out.data = MASKS[command] ? MASKS[command](r.data, '$', masked) : r.data;
  if (command === 'group-members' && Array.isArray(r.data) && r.data.length === MEMBERS_PAGE) {
    out.morePages = true;
    out.note = `a full page of ${MEMBERS_PAGE} members: more may follow; read the next page with --after set to the id of the last member listed`;
  }
  if (command === 'logs' && Array.isArray(r.data) && r.data.length === LOGS_PAGE) {
    out.morePages = true;
    out.note = `a full page of ${LOGS_PAGE} events: more may follow; narrow the read with --event or --target, or repeat it with --since set to the last event's published time`;
  }
  if (r.flags && r.flags.length) out.flags = withhold(r.flags, masked);
  if (r.scope_notice) out.scope_notice = r.scope_notice;
  return out;
}

// The reads of one read-back: each result's flags (personal ones withheld) and the scope
// notice are kept for the verdict.
function reader(client) {
  const kept = [];
  let count = 0;
  let notice = null;
  return {
    async get([route, params, query], mask) {
      const r = await client.get(route, params, query);
      count += 1;
      if (r.scope_notice && !notice) notice = r.scope_notice;
      if (r.ok && r.flags && r.flags.length) {
        const masked = [];
        if (mask) mask(r.data, '$', masked);
        for (const f of withhold(r.flags, masked)) kept.push({ n: count, f });
      }
      return r;
    },
    extra() {
      const out = {};
      if (kept.length) out.flags = kept.map(({ n, f }) => (count > 1 ? { ...f, path: `read ${n} ${f.path}` } : f));
      if (notice) out.scope_notice = notice;
      return out;
    },
  };
}

function verdict(command, verified, expected, observed, reason, extra = {}) {
  const out = { state: STATES.OK, ok: true, command, verified: verified === true, expected, observed };
  if (!out.verified) out.reason = reason;
  return { ...out, ...extra };
}

// An answer that proves nothing either way (batch G4, task D1): INCONCLUSIVE (exit 5), never a
// pass and never a failed object. Before D1 each of these was a verdict with state OK and
// verified false (exit 2), which a counted change took for a failed object.
function unproven(command, expected, observed, reason, extra = {}) {
  return { ...inconclusive({ state: STATES.OK, ok: true, command, verified: false, expected, observed }, reason), ...extra };
}

const NOT_THE_USER = 'the user record read is not the user asked for';
const idOf = (record) => (isObject(record) && typeof record.id === 'string' ? record.id : null);

// ── Read-backs ───────────────────────────────────────────────────────────────
async function verifyStatus(client, a) {
  const command = 'verify-status';
  const expected = COMMANDS[command].expected(a);
  const rd = reader(client);
  const r = await rd.get(userRequest(a.user), maskUser);
  if (!r.ok) return failed(command, r);
  const observed = { user: idOf(r.data), status: isObject(r.data) && typeof r.data.status === 'string' ? r.data.status : null };
  if (observed.user !== a.user) return verdict(command, false, expected, observed, NOT_THE_USER, rd.extra());
  if (observed.status === null) return unproven(command, expected, observed, 'the user record carries no status, so this is not proof either way', rd.extra());
  return verdict(command, observed.status === a.status, expected, observed, `the user's status is ${observed.status}, not ${a.status}`, rd.extra());
}

// The user read comes first, so a credential that cannot see the user never proves a reset.
async function factorsVerdict(client, a, command, judge) {
  const expected = COMMANDS[command].expected(a);
  const rd = reader(client);
  const ur = await rd.get(userRequest(a.user), maskUser);
  if (!ur.ok) return failed(command, ur);
  const observed = { user: idOf(ur.data), factorsRead: null, factorTypes: [] };
  if (observed.user !== a.user) return verdict(command, false, expected, observed, NOT_THE_USER, rd.extra());
  const fr = await rd.get(factorsRequest(a.user), maskFactors);
  if (!fr.ok) return failed(command, fr);
  if (!Array.isArray(fr.data)) return unproven(command, expected, observed, 'the factor read did not return a list, so this is not proof either way', rd.extra());
  const types = fr.data.map((f) => (isObject(f) && typeof f.factorType === 'string' ? f.factorType : null));
  observed.factorsRead = fr.data.length;
  observed.factorTypes = [...new Set(types.filter((t) => t !== null))];
  const [verified, reason, notProof] = judge(types);
  if (notProof) return unproven(command, expected, observed, reason, rd.extra());
  return verdict(command, verified, expected, observed, reason, rd.extra());
}

// judge: [verified, reason, proves nothing either way]
const verifyFactorReset = (client, a) => factorsVerdict(client, a, 'verify-factor-reset', (types) => {
  // a factor of that type still listed is an answer, whatever else the list holds
  if (types.includes(a.factorType)) return [false, `a ${a.factorType} factor is still listed for the user`];
  if (types.includes(null)) return [false, 'a listed factor carries no factorType, so the type cannot be ruled out either way', true];
  return [true, ''];
});

const verifyFactorsResetAll = (client, a) => factorsVerdict(client, a, 'verify-factors-reset-all', (types) => [types.length === 0, `${types.length} factor(s) are still listed for the user`]);

// A System Log event of that type, for that target, at or after --not-before, with outcome
// SUCCESS. A positive proof: one matching event is enough, so the first page decides.
function summariseEvent(e) {
  return {
    uuid: orNull(e.uuid),
    published: orNull(e.published),
    eventType: orNull(e.eventType),
    outcome: isObject(e.outcome) ? orNull(e.outcome.result) : null,
    actor: isObject(e.actor) ? { id: orNull(e.actor.id), type: orNull(e.actor.type), alternateId: orNull(e.actor.alternateId) } : null,
    targets: Array.isArray(e.target) ? e.target.filter(isObject).slice(0, 20).map((t) => ({ id: orNull(t.id), type: orNull(t.type) })) : [],
  };
}

async function eventVerdict(client, a, command, eventType) {
  const expected = COMMANDS[command].expected(a);
  const rd = reader(client);
  const r = await rd.get(logsRequest(a.notBefore, logFilter(eventType, a.user)));
  if (!r.ok) return failed(command, r);
  const observed = { eventsRead: null, match: null, eventsSinceNotBefore: [], morePages: false };
  if (!Array.isArray(r.data)) return unproven(command, expected, observed, 'the System Log read did not return a list of events, so this is not proof either way', rd.extra());
  observed.eventsRead = r.data.length;
  observed.morePages = r.data.length === LOGS_PAGE;
  const notBeforeMs = Date.parse(a.notBefore);
  for (const e of r.data) {
    if (!isObject(e)) continue;
    const t = typeof e.published === 'string' ? Date.parse(e.published) : NaN;
    if (!Number.isFinite(t) || t < notBeforeMs) continue;
    const summary = summariseEvent(e);
    const forTarget = Array.isArray(e.target) && e.target.some((x) => isObject(x) && x.id === a.user);
    const succeeded = isObject(e.outcome) && e.outcome.result === 'SUCCESS';
    if (e.eventType === eventType && forTarget && succeeded) {
      observed.match = summary;
      return verdict(command, true, expected, observed, '', rd.extra());
    }
    if (observed.eventsSinceNotBefore.length < 20) observed.eventsSinceNotBefore.push(summary);
  }
  const reason = `no ${eventType} event with outcome SUCCESS for ${a.user} at or after ${a.notBefore} among the ${r.data.length} event(s) read`;
  if (observed.morePages) return unproven(command, expected, observed, `${reason}; the read returned a full page, so this is not proof either way`, rd.extra());
  return verdict(command, false, expected, observed, reason, rd.extra());
}

const verifySessionsCleared = (client, a) => eventVerdict(client, a, 'verify-sessions-cleared', SESSION_CLEAR);
const verifyPasswordReset = (client, a) => eventVerdict(client, a, 'verify-password-reset', PASSWORD_RESET);

// The user read comes first (a credential that cannot see the user never proves "absent"),
// then at most MAX_PAGES pages of MEMBERS_PAGE members. "Absent" needs a short last page.
async function verifyGroupMember(client, a) {
  const command = 'verify-group-member';
  const expected = COMMANDS[command].expected(a);
  const rd = reader(client);
  const ur = await rd.get(userRequest(a.user), maskUser);
  if (!ur.ok) return failed(command, ur);
  const observed = { user: idOf(ur.data), group: a.group, pagesRead: 0, membersRead: 0, member: null, morePages: false };
  if (observed.user !== a.user) return verdict(command, false, expected, observed, NOT_THE_USER, rd.extra());
  const seen = new Set();
  let after;
  for (let n = 1; n <= MAX_PAGES; n += 1) {
    const r = await rd.get(membersRequest(a.group, after), maskUsers);
    if (!r.ok) return failed(command, r);
    observed.pagesRead = n;
    if (!Array.isArray(r.data)) return unproven(command, expected, observed, 'the member read did not return a list, so this is not proof either way', rd.extra());
    for (const m of r.data) {
      const id = idOf(m);
      if (id === null) return unproven(command, expected, observed, 'a listed member carries no id, so the list cannot be judged either way', rd.extra());
      if (seen.has(id)) return unproven(command, expected, observed, `page ${n} repeated a member already read, so the paging cannot be trusted either way`, rd.extra());
      seen.add(id);
      observed.membersRead += 1;
      if (id === a.user) {
        observed.member = true;
        return verdict(command, a.absent !== true, expected, observed, 'the user is still a member of the group', rd.extra());
      }
    }
    if (r.data.length < MEMBERS_PAGE) {
      observed.member = false;
      return verdict(command, a.absent === true, expected, observed, 'the user is not a member of the group', rd.extra());
    }
    after = idOf(r.data[r.data.length - 1]);
  }
  observed.morePages = true;
  const reason = `the group has more than ${MAX_PAGES} pages of ${MEMBERS_PAGE} members (${observed.membersRead} read) and the user was not on them, so this read proves nothing either way; check the membership in the Admin Console`;
  return unproven(command, expected, observed, reason, rd.extra());
}

const ASSIGNED = Object.freeze(['ACTIVE', 'PROVISIONED']);
const APP_404_CAVEAT = 'An HTTP 404 on the app-user read also comes from a wrong --app: check the app ID in the Admin Console before relying on this.';

// Present: the app-user read is 200 with status ACTIVE or PROVISIONED. Absent: that read is
// HTTP 404 and the user read before it succeeded, so a credential that sees nothing never
// proves "absent".
async function verifyAppAssigned(client, a) {
  const command = 'verify-app-assigned';
  const expected = COMMANDS[command].expected(a);
  const rd = reader(client);
  const ur = await rd.get(userRequest(a.user), maskUser);
  if (!ur.ok) return failed(command, ur);
  const observed = { user: idOf(ur.data), app: a.app, appUserHttpStatus: null, appUserStatus: null };
  if (observed.user !== a.user) return verdict(command, false, expected, observed, NOT_THE_USER, rd.extra());
  const r = await rd.get(appUserRequest(a.app, a.user), maskAppUser);
  if (r.ok) {
    const record = isObject(r.data) ? r.data : {};
    observed.appUserHttpStatus = r.status;
    observed.appUserStatus = typeof record.status === 'string' ? record.status : null;
    if (a.absent === true) return verdict(command, false, expected, observed, `the app-user read found an assignment (status ${observed.appUserStatus || 'not stated'})`, rd.extra());
    if (idOf(record) !== a.user) return verdict(command, false, expected, observed, 'the app-user record read is not the user asked for', rd.extra());
    if (observed.appUserStatus === null) return unproven(command, expected, observed, 'the assignment carries no status, so this is not proof either way', rd.extra());
    return verdict(command, ASSIGNED.includes(observed.appUserStatus), expected, observed, `the assignment's status is ${observed.appUserStatus || 'not stated'}, not ACTIVE or PROVISIONED`, rd.extra());
  }
  if (r.state === STATES.HTTP_ERROR && r.status === 404) {
    observed.appUserHttpStatus = 404;
    return verdict(command, a.absent === true, expected, observed, 'the app-user read returned HTTP 404: the user is not assigned to the app (or the app ID is wrong)', { caveat: APP_404_CAVEAT, ...rd.extra() });
  }
  return failed(command, r);
}

const VERIFY = Object.freeze({
  'verify-status': verifyStatus,
  'verify-factor-reset': verifyFactorReset,
  'verify-factors-reset-all': verifyFactorsResetAll,
  'verify-sessions-cleared': verifySessionsCleared,
  'verify-password-reset': verifyPasswordReset,
  'verify-group-member': verifyGroupMember,
  'verify-app-assigned': verifyAppAssigned,
});

// ── CLI ──────────────────────────────────────────────────────────────────────
const CREDENTIAL_VARS = ['OKTA_CLIENT_ID', 'OKTA_PRIVATE_KEY', 'OKTA_KEY_ID'];
const DRY_NOTE = 'dry run: no credentials read, no network';
const authLine = (host) => `before the first read, one POST to ${host}${TOKEN_PATH} with grant_type client_credentials, the scopes below and a client assertion signed with OKTA_PRIVATE_KEY (private_key_jwt); the access token then goes only in the Authorization header`;

// The contract's plan(): the host is read from OKTA_ORG_URL, no credential is read and
// nothing is sent.
function dryRun(client, command, def, a) {
  if (def.kind === 'read') {
    const plan = client.plan(...def.request(a));
    if (!plan.ok) return failed(command, plan);
    return { state: STATES.OK, ok: true, command, method: plan.method, host: plan.host, path: plan.path, scopes: [...SCOPES], auth: authLine(plan.host), note: DRY_NOTE, next: 'Add --execute to perform this read.' };
  }
  const requests = [];
  for (const args of def.plans(a)) {
    const plan = client.plan(...args);
    if (!plan.ok) return failed(command, plan);
    requests.push({ method: plan.method, host: plan.host, path: plan.path });
  }
  const res = { state: STATES.OK, ok: true, command, requests, expected: def.expected(a) };
  if (def.pages) res.pages = def.pages;
  return { ...res, scopes: [...SCOPES], auth: authLine(requests[0].host), note: DRY_NOTE, next: 'Add --execute to perform this read-back.' };
}

async function run(argv, env = process.env, deps = {}) {
  const out = deps.out || ((s) => process.stdout.write(s));
  const err = deps.err || ((s) => process.stderr.write(s));
  const now = deps.now || Date.now;
  const seen = [];
  const remember = (value) => { if (typeof value === 'string' && value.length >= 4 && !seen.includes(value)) seen.push(value); };
  let command;
  // batch G3 close-out (owner decision 1): --change binds a verify-* read-back to its change
  // record; it is taken out of argv here and checked below, before any read
  const bound = takeChange(argv);
  try {
    const args = parseArgs(bound.argv, { values: VALUE_FLAGS, booleans: BOOLEAN_FLAGS });
    command = args._command;
    if (command === 'help' || command === '--help' || command === '-h') { out(USAGE); return 0; }
    if (typeof command !== 'string' || !Object.prototype.hasOwnProperty.call(COMMANDS, command)) {
      err(USAGE);
      throw new RefusedError(command === undefined ? 'no command given' : 'unknown command; no command writes to Okta');
    }
    const def = COMMANDS[command];
    const a = validate(command, def, args);

    // The client only ever sees this view of the environment. It remembers the credential
    // values the token exchange read, so printed output is redacted with them too; this
    // file never reads a credential itself.
    const envView = new Proxy(env, {
      get(target, name) {
        const value = Reflect.get(target, name);
        if (typeof name === 'string' && CREDENTIAL_VARS.includes(name)) remember(value);
        return value;
      },
    });

    // batch G3: the audit sink, the scope preflight and the test seams come from cliDeps
    const cli = cliDeps(deps, env);
    const refusal = changeRefusal(PLATFORM, command, bound, cli.audit);
    if (refusal) throw new RefusedError(refusal);

    if (args.execute !== true) {
      const res = dryRun(createClient(makeSpec({ env: envView, now }), { env: envView }), command, def, a);
      const code = exitCodeFor(res);
      (code === 1 ? err : out)(renderResult(res, { platform: PLATFORM, operation: command }));
      return code === EXIT.OK ? dryRunExit(command, err) : code;
    }

    const client = createClient(makeSpec({ env: envView, now, remember }), { env: envView, ...cli });
    let res;
    if (def.kind === 'read') {
      const r = await client.get(...def.request(a));
      res = r.ok ? readOutput(command, r) : failed(command, r);
    } else {
      res = recordVerdict(cli.audit, PLATFORM, await VERIFY[command](client, a), bound.change, null, bound.argv);
    }
    const shown = redactDeep(res, seen);
    const code = exitCodeFor(shown);
    (code === 1 ? err : out)(renderResult(shown, { secrets: seen, platform: PLATFORM, operation: command }));
    return code;
  } catch (error) {
    if (error instanceof TripwireError || (error && error.name === 'NetworkTripwireError')) throw error;
    if (error instanceof RefusedError) {
      err(renderResult({ state: STATES.REFUSED, ok: false, error: error.message }, { secrets: seen, platform: PLATFORM, operation: command }));
      return 1;
    }
    err(renderResult({ state: STATES.INVALID_RESPONSE, ok: false, error: 'unexpected connector error (details withheld)' }, { platform: PLATFORM, operation: command }));
    return 2;
  }
}

if (require.main === module) {
  run(process.argv.slice(2), process.env).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(error && error.name === 'NetworkTripwireError' ? 'Network tripwire fired\n' : 'okta-client: unexpected error (details withheld)\n');
    process.exitCode = 2;
  });
}

module.exports = { SPEC, run, makeSpec, SCOPES, checkScopes, COMMANDS };
