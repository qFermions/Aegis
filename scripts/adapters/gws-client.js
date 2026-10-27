'use strict';
// gws-client.js: the read-only Google Workspace adapter for lane G2 (docs/aegis/lanes/g2.md,
// Google Workspace section), built on the shared contract readonly-contract.js (README.md here).
//
// Aegis advises; humans execute (PRODUCT_CONTRACT.md). This file reads the Admin SDK
// Directory and Reports APIs through nine GET reads and nothing else. It never creates,
// changes, suspends, deletes or restores a user, never changes a group, a role, 2-Step
// Verification, a device or Drive sharing, and never revokes a token: each of those is a
// HUMAN-RUN step in a runbook, and a verify-* command below proves it afterwards.
//
// Usage: node scripts/adapters/gws-client.js <command> [flags] [--execute]
//   Reads (a dry run that prints the planned request unless --execute is given):
//     user --user [USER@DOMAIN.COM]
//     users [--query "isEnrolledIn2Sv=false"] [--max-results N] [--page-token VALUE]
//     roles
//     role-assignments [--user [USER@DOMAIN.COM]] [--role-id N]
//     group-members --group [GROUP_EMAIL]
//     mobile-devices | chromeos-devices
//     activities --app admin|login|drive|token|saml|user_accounts [--user all|[USER@DOMAIN.COM]]
//                [--start ISO] [--end ISO] [--event NAME] [--max-results N]
//     usage --date YYYY-MM-DD --parameters accounts:num_users_2sv_enrolled,...
//   Read-backs (also a dry run unless --execute):
//     verify-suspended          --user [USER@DOMAIN.COM]
//     verify-2sv-enforced       --user [USER@DOMAIN.COM]
//     verify-2sv-not-enforced   --user [USER@DOMAIN.COM]
//     verify-ou                 --user [USER@DOMAIN.COM] --ou [OU_PATH]
//     verify-admin-role-removed --user [USER@DOMAIN.COM] --role-id N
//     verify-event              --app APP --event NAME --user [USER@DOMAIN.COM] --not-before [NOT_BEFORE]
//                               [--target [USER@DOMAIN.COM]]
//   --user also takes a numeric user ID ([USER_ID]). For verify-event, --user is the actor;
//   --target is who or what the event acted on: the matched event must carry a parameter
//   whose value (or one of whose multiValue entries) equals it (an email address in any
//   case, any other text exactly). Parameter names are not confirmed in the lane's sources,
//   so the match ignores them, and the matched event's parameters are printed in
//   observed.match.parameters. The match is judged on the same allowed GET; no new route.
//
// Environment, read only under --execute and only after the request is allowed:
//   GWS_SA_CLIENT_EMAIL  the service account's email (the JWT issuer)
//   GWS_SA_PRIVATE_KEY   the service account's RSA private key in PEM form, from the
//                        environment only (never a key file; a value with literal \n
//                        escapes is read with them turned into line breaks)
//   GWS_ADMIN_SUBJECT    the admin the service account impersonates (domain-wide delegation)
//   GWS_CUSTOMER_ID      this deployment's customer ID ([@Aegion_GWS_CUSTOMER_ID]); a record
//                        whose customerId names another customer returns no data (exit 3)
// The contract treats the first three as credentials: no value of theirs is printed, so
// an address equal to GWS_ADMIN_SUBJECT or GWS_SA_CLIENT_EMAIL prints as [REDACTED].
//
// Hosts are fixed: reads go to admin.googleapis.com; the token exchange is one
// POST https://oauth2.googleapis.com/token, form-encoded, with exactly grant_type
// (urn:ietf:params:oauth:grant-type:jwt-bearer) and assertion (an RS256 JWT signed here
// with node:crypto: iss, sub, scope, aud, iat, exp = iat + 3600). It is never retried.
// Scopes are the seven read-only scopes in SCOPES. admin.directory.user.security is never
// requested (it also grants writes), so OAuth grants and app passwords are read from the
// Reports API token events instead of tokens.list and asps.list.
//
// Exit codes: 0 read or verified; 1 refused, input error or missing credentials;
// 2 the read failed or a verify-* read did not prove the write; 3 another customer.
//
// Requests are built here as raw paths and pass the contract's own allow-list door
// (checkRequest for a dry run, client.send for a read). The contract's get() and plan()
// would encode an email path value twice ([USER@DOMAIN.COM] would leave as %2540), so
// they are not used.
//
// Facts the lane could not confirm (vendor pages unreachable; research from Google's
// discovery documents and auth library on GitHub, docs/aegis/lanes/g2.md), and the safer
// reading taken here:
//   - users --query syntax (isEnrolledIn2Sv=false, isAdmin=true) is unconfirmed: the text
//     is passed through unchanged, and a query Google rejects is a failed read (exit 2).
//   - usage parameter names come from a search excerpt; they are passed through unchanged.
//   - Admin and Drive event names are unconfirmed: verify-event matches the exact name
//     given, so a wrong name reads as not verified (exit 2), never as proof.
//   - role-assignments reads direct assignments only (includeIndirectRoleAssignments is
//     not on the lane's allow-list); verify-admin-role-removed says a role held through a
//     group is not shown.
//   - The User Reports 2-Step Verification column may lag up to 48 hours (search excerpt);
//     verify-2sv-enforced and verify-2sv-not-enforced read the user's isEnforcedIn2Sv
//     field instead. "Not enforced" is its own read-back, never the failure exit of
//     verify-2sv-enforced: that exit (2) also means a failed read (403, 404, timeout) or a
//     record for another user, so it proves nothing.
//   - Rate limits and error codes are unconfirmed; the contract retries a read on 429 or
//     5xx at most twice and never repeats the token exchange.

const crypto = require('node:crypto');

const {
  STATES, RefusedError, TripwireError,
  defineAdapter, createClient, checkRequest, renderResult, exitCodeFor, parseArgs, redactDeep,
} = require('./readonly-contract.js');

// ── Hosts, token exchange and scopes ─────────────────────────────────────────
const API_HOST = 'admin.googleapis.com';
const TOKEN_HOST = 'oauth2.googleapis.com';
const TOKEN_PATH = '/token';
const TOKEN_AUDIENCE = `https://${TOKEN_HOST}${TOKEN_PATH}`;
const JWT_BEARER = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
const ASSERTION_LIFETIME_SECONDS = 3600; // Google's auth library default (lane research)
const SCOPE_PREFIX = 'https://www.googleapis.com/auth/';
const READ_ONLY_SCOPE_NAMES = Object.freeze([
  'admin.directory.user.readonly',
  'admin.directory.group.readonly',
  'admin.directory.rolemanagement.readonly',
  'admin.directory.device.mobile.readonly',
  'admin.directory.device.chromeos.readonly',
  'admin.reports.audit.readonly',
  'admin.reports.usage.readonly',
]);
const SCOPES = Object.freeze(READ_ONLY_SCOPE_NAMES.map((name) => `${SCOPE_PREFIX}${name}`));

// Every scope this adapter asks for must be one of the seven read-only scopes above.
// Anything else (admin.directory.user.security first, which also grants writes) is refused.
function checkScopes(scopes) {
  if (!Array.isArray(scopes) || !scopes.length) throw new Error('scopes: a non-empty list of read-only scopes is required');
  for (const scope of scopes) {
    if (typeof scope !== 'string' || !scope.startsWith(SCOPE_PREFIX)) throw new Error(`scope ${String(scope).slice(0, 80)} is refused: only read-only Admin SDK scopes are requested`);
    const name = scope.slice(SCOPE_PREFIX.length);
    if (!READ_ONLY_SCOPE_NAMES.includes(name) || !name.endsWith('.readonly')) {
      throw new Error(`scope ${name.slice(0, 80)} is refused: it is not on the lane's read-only list`);
    }
  }
  return true;
}
checkScopes(SCOPES);

// ── Validators (the CLI checks input with these, and the contract re-checks the path) ─
// An email path value goes out encoded once by the contract (@ as %40). '%' and '/' are
// never accepted, so a value cannot carry a pre-encoded or extra path segment.
const EMAIL_SRC = "[A-Za-z0-9][A-Za-z0-9._+'-]{0,63}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.){1,8}[A-Za-z]{2,63}";
const NUMERIC_ID_SRC = '[0-9]{1,30}';
const EMAIL = new RegExp(`^(?=.{3,254}$)${EMAIL_SRC}$`);
const NUMERIC_ID = new RegExp(`^${NUMERIC_ID_SRC}$`);
const USER_KEY = new RegExp(`^(?=.{1,254}$)(?:${EMAIL_SRC}|${NUMERIC_ID_SRC})$`);
const ACTIVITY_USER_KEY = new RegExp(`^(?=.{1,254}$)(?:all|${EMAIL_SRC}|${NUMERIC_ID_SRC})$`);
const GROUP_KEY = new RegExp(`^(?=.{1,254}$)(?:${EMAIL_SRC}|[A-Za-z0-9]{1,64})$`);
const ROLE_ID = /^[0-9]{1,20}$/;
const APPS = Object.freeze(['admin', 'login', 'drive', 'token', 'saml', 'user_accounts']);
const APP = new RegExp(`^(?:${APPS.join('|')})$`);
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EVENT_NAME = /^[A-Za-z][A-Za-z0-9_]{0,99}$/;
const USERS_MAX = /^(?:[1-9][0-9]?|[1-4][0-9]{2}|500)$/; // users.list maxResults 1 to 500
const ACTIVITIES_MAX = /^(?:[1-9][0-9]{0,2}|1000)$/; // activities.list maxResults 1 to 1000
const PAGE_TOKEN = /^[A-Za-z0-9_.~+/=-]{1,1024}$/;
const USER_QUERY = /^[^\u0000-\u001f\u007f-\u009f]{1,256}$/u;
const USAGE_PARAMETER = '[a-z][a-z0-9_]{0,40}:[a-z][a-z0-9_]{0,80}';
const USAGE_PARAMETERS = new RegExp(`^${USAGE_PARAMETER}(?:,${USAGE_PARAMETER}){0,19}$`);
const OU_PATH = /^\/[^\u0000-\u001f\u007f-\u009f]{0,255}$/u;
const TARGET = /^[^\u0000-\u001f\u007f-\u009f]{1,256}$/u;

// ── The allow-list: the lane's nine reads ────────────────────────────────────
const DIRECTORY = '/admin/directory/v1';
const REPORTS = '/admin/reports/v1';
const ROUTES = Object.freeze({
  user: { method: 'GET', path: `${DIRECTORY}/users/:userKey`, params: { userKey: USER_KEY } },
  users: {
    method: 'GET', path: `${DIRECTORY}/users`, fixedQuery: { customer: 'my_customer' },
    query: { query: USER_QUERY, maxResults: USERS_MAX, pageToken: PAGE_TOKEN },
  },
  roles: { method: 'GET', path: `${DIRECTORY}/customer/my_customer/roles` },
  roleAssignments: { method: 'GET', path: `${DIRECTORY}/customer/my_customer/roleassignments`, query: { userKey: USER_KEY, roleId: ROLE_ID } },
  groupMembers: { method: 'GET', path: `${DIRECTORY}/groups/:groupKey/members`, params: { groupKey: GROUP_KEY } },
  mobileDevices: { method: 'GET', path: `${DIRECTORY}/customer/my_customer/devices/mobile` },
  chromeosDevices: { method: 'GET', path: `${DIRECTORY}/customer/my_customer/devices/chromeos` },
  activities: {
    method: 'GET', path: `${REPORTS}/activity/users/:userKey/applications/:applicationName`,
    params: { userKey: ACTIVITY_USER_KEY, applicationName: APP },
    query: { startTime: ISO_UTC, endTime: ISO_UTC, eventName: EVENT_NAME, maxResults: ACTIVITIES_MAX },
  },
  usage: { method: 'GET', path: `${REPORTS}/usage/dates/:date`, params: { date: DATE }, query: { parameters: USAGE_PARAMETERS } },
});

// ── Tenant: the customer IDs a response names ────────────────────────────────
// The resources that carry a customer ID must carry it; one that names another customer
// makes the contract return no data. Roles, role assignments, group members and devices
// carry none: they are read under my_customer (the impersonated admin's own customer)
// or by a group key, and a run against another customer shows on any user read.
function collectTenant(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('response is not an object');
  const ids = [];
  const need = (value) => {
    if (typeof value !== 'string' || !value) throw new Error('a record carries no customerId');
    ids.push(value);
  };
  if (json.kind === 'admin#directory#user' || typeof json.primaryEmail === 'string') need(json.customerId);
  if (json.users !== undefined) {
    if (!Array.isArray(json.users)) throw new Error('users is not a list');
    for (const user of json.users) need(user && user.customerId);
  }
  if (json.items !== undefined && Array.isArray(json.items)) {
    const activities = json.kind === 'admin#reports#activities';
    for (const item of json.items) {
      const id = item && item.id;
      if (activities || (id && typeof id === 'object')) need(id && typeof id === 'object' ? id.customerId : undefined);
    }
  }
  if (json.usageReports !== undefined) {
    if (!Array.isArray(json.usageReports)) throw new Error('usageReports is not a list');
    for (const report of json.usageReports) need(report && report.entity && report.entity.customerId);
  }
  return ids;
}

// ── The signed assertion ─────────────────────────────────────────────────────
const b64url = (text) => Buffer.from(text, 'utf8').toString('base64url');

function pemFrom(value) {
  return !value.includes('\n') && value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

// An RS256 JWT for Google's JWT bearer grant. Error messages name the variable only.
function signAssertion(creds, nowMs, remember = () => {}) {
  if (!EMAIL.test(creds.GWS_SA_CLIENT_EMAIL)) throw new RefusedError('GWS_SA_CLIENT_EMAIL must be the service account\'s email address (value withheld)');
  if (!EMAIL.test(creds.GWS_ADMIN_SUBJECT)) throw new RefusedError('GWS_ADMIN_SUBJECT must be the email address of the admin the service account impersonates (value withheld)');
  if (!Number.isFinite(nowMs)) throw new RefusedError('the clock gave no time for the assertion');
  const pem = pemFrom(creds.GWS_SA_PRIVATE_KEY);
  remember(pem);
  let key;
  try {
    key = crypto.createPrivateKey(pem);
  } catch {
    throw new RefusedError('GWS_SA_PRIVATE_KEY is not a private key in PEM form that the adapter can read (value withheld)');
  }
  if (key.asymmetricKeyType !== 'rsa') throw new RefusedError('GWS_SA_PRIVATE_KEY must be an RSA private key: the assertion is signed RS256 (value withheld)');
  const iat = Math.floor(nowMs / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: creds.GWS_SA_CLIENT_EMAIL,
    sub: creds.GWS_ADMIN_SUBJECT,
    scope: SCOPES.join(' '),
    aud: TOKEN_AUDIENCE,
    iat,
    exp: iat + ASSERTION_LIFETIME_SECONDS,
  };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signature = crypto.sign('sha256', Buffer.from(input, 'utf8'), key).toString('base64url');
  const assertion = `${input}.${signature}`;
  remember(assertion);
  return assertion;
}

// A spec per run, so the assertion uses the run's clock and the run can redact what it
// signed; SPEC (exported) is the same spec on the system clock.
function makeSpec({ now = Date.now, remember = () => {} } = {}) {
  return defineAdapter({
    platform: 'google-workspace',
    host: { fixed: API_HOST },
    credentials: ['GWS_SA_CLIENT_EMAIL', 'GWS_SA_PRIVATE_KEY', 'GWS_ADMIN_SUBJECT'],
    auth: (creds, token) => ({ Authorization: `Bearer ${token}` }),
    routes: ROUTES,
    tokenExchange: {
      host: { fixed: TOKEN_HOST },
      path: TOKEN_PATH,
      fields: ['grant_type', 'assertion'],
      build: (creds) => ({ grant_type: JWT_BEARER, assertion: signAssertion(creds, now(), remember) }),
      parse: (json) => ({ token: json && json.access_token, expiresInSeconds: json ? Number(json.expires_in) : NaN }),
    },
    tenant: { env: 'GWS_CUSTOMER_ID', collect: collectTenant },
  });
}
const SPEC = makeSpec();

// ── Request paths (raw; the contract encodes and re-checks each value) ───────
function withQuery(base, pairs) {
  const search = new URLSearchParams();
  for (const [key, value] of pairs) if (value !== undefined) search.append(key, value);
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

const PATHS = Object.freeze({
  user: (a) => `${DIRECTORY}/users/${a.user}`,
  users: (a) => withQuery(`${DIRECTORY}/users`, [['customer', 'my_customer'], ['query', a.query], ['maxResults', a.maxResults], ['pageToken', a.pageToken]]),
  roles: () => `${DIRECTORY}/customer/my_customer/roles`,
  roleAssignments: (a) => withQuery(`${DIRECTORY}/customer/my_customer/roleassignments`, [['userKey', a.user], ['roleId', a.roleId]]),
  groupMembers: (a) => `${DIRECTORY}/groups/${a.group}/members`,
  mobileDevices: () => `${DIRECTORY}/customer/my_customer/devices/mobile`,
  chromeosDevices: () => `${DIRECTORY}/customer/my_customer/devices/chromeos`,
  activities: (a) => withQuery(`${REPORTS}/activity/users/${a.user}/applications/${a.app}`, [['startTime', a.start], ['endTime', a.end], ['eventName', a.event], ['maxResults', a.maxResults]]),
  usage: (a) => withQuery(`${REPORTS}/usage/dates/${a.date}`, [['parameters', a.parameters]]),
});

// ── Commands ─────────────────────────────────────────────────────────────────
const COMMANDS = Object.freeze({
  user: { kind: 'read', required: ['user'], optional: [], paths: (a) => [PATHS.user(a)] },
  users: { kind: 'read', required: [], optional: ['query', 'max-results', 'page-token'], paths: (a) => [PATHS.users(a)] },
  roles: { kind: 'read', required: [], optional: [], paths: () => [PATHS.roles()] },
  'role-assignments': { kind: 'read', required: [], optional: ['user', 'role-id'], paths: (a) => [PATHS.roleAssignments(a)] },
  'group-members': { kind: 'read', required: ['group'], optional: [], paths: (a) => [PATHS.groupMembers(a)] },
  'mobile-devices': { kind: 'read', required: [], optional: [], paths: () => [PATHS.mobileDevices()] },
  'chromeos-devices': { kind: 'read', required: [], optional: [], paths: () => [PATHS.chromeosDevices()] },
  activities: { kind: 'read', required: ['app'], optional: ['user', 'start', 'end', 'event', 'max-results'], paths: (a) => [PATHS.activities(a)] },
  usage: { kind: 'read', required: ['date', 'parameters'], optional: [], paths: (a) => [PATHS.usage(a)] },
  'verify-suspended': {
    kind: 'verify', required: ['user'], optional: [], paths: (a) => [PATHS.user(a)],
    expected: (a) => ({ user: a.user, suspended: true }),
  },
  'verify-2sv-enforced': {
    kind: 'verify', required: ['user'], optional: [], paths: (a) => [PATHS.user(a)],
    expected: (a) => ({ user: a.user, isEnforcedIn2Sv: true }),
  },
  // Proves the opposite state (an exception-group member, or a unit after enforcement is
  // turned off): exit 0 only on a successful read of the named user whose
  // isEnforcedIn2Sv is exactly false.
  'verify-2sv-not-enforced': {
    kind: 'verify', required: ['user'], optional: [], paths: (a) => [PATHS.user(a)],
    expected: (a) => ({ user: a.user, isEnforcedIn2Sv: false }),
  },
  'verify-ou': {
    kind: 'verify', required: ['user', 'ou'], optional: [], paths: (a) => [PATHS.user(a)],
    expected: (a) => ({ user: a.user, orgUnitPath: a.ou }),
  },
  // The user read proves the account exists and is the one asked for; the assignments
  // are then read by userKey only (the lane's read-back) and the role is matched here.
  'verify-admin-role-removed': {
    kind: 'verify', required: ['user', 'role-id'], optional: [], paths: (a) => [PATHS.user(a), PATHS.roleAssignments({ user: a.user })],
    expected: (a) => ({ user: a.user, roleId: a.roleId, assigned: false }),
  },
  'verify-event': {
    kind: 'verify', required: ['app', 'event', 'user', 'not-before'], optional: ['target'],
    paths: (a) => [PATHS.activities({ user: a.user, app: a.app, start: a.notBefore, event: a.event })],
    expected: (a) => ({ app: a.app, event: a.event, user: a.user, notBefore: a.notBefore, ...(a.target === undefined ? {} : { target: a.target }) }),
  },
});

const VALUE_FLAGS = ['user', 'query', 'max-results', 'page-token', 'role-id', 'group', 'app', 'start', 'end', 'event', 'date', 'parameters', 'ou', 'not-before', 'target'];

const USAGE = [
  'Usage: node scripts/adapters/gws-client.js <command> [flags] [--execute]',
  '  Reads:   user --user [USER@DOMAIN.COM]',
  '           users [--query "isEnrolledIn2Sv=false"] [--max-results N] [--page-token VALUE]',
  '           roles | role-assignments [--user [USER@DOMAIN.COM]] [--role-id N]',
  '           group-members --group [GROUP_EMAIL] | mobile-devices | chromeos-devices',
  '           activities --app admin|login|drive|token|saml|user_accounts [--user all|[USER@DOMAIN.COM]]',
  '                      [--start ISO] [--end ISO] [--event NAME] [--max-results N]',
  '           usage --date YYYY-MM-DD --parameters accounts:num_users_2sv_enrolled,...',
  '  Verify:  verify-suspended --user [USER@DOMAIN.COM] | verify-2sv-enforced --user [USER@DOMAIN.COM]',
  '           verify-2sv-not-enforced --user [USER@DOMAIN.COM]',
  '           verify-ou --user [USER@DOMAIN.COM] --ou [OU_PATH]',
  '           verify-admin-role-removed --user [USER@DOMAIN.COM] --role-id N',
  '           verify-event --app APP --event NAME --user [USER@DOMAIN.COM] --not-before [NOT_BEFORE]',
  '                        [--target [USER@DOMAIN.COM]]   (who or what the event acted on)',
  'Reads and read-backs are a dry run unless the bare --execute flag is given. No command writes to Google Workspace.',
  '',
].join('\n');

const realDate = (date) => DATE.test(date) && new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date;
const realTime = (iso) => ISO_UTC.test(iso) && Number.isFinite(Date.parse(iso)) && realDate(iso.slice(0, 10));

// Every flag is checked before a client exists, so bad input reads and sends nothing.
function validate(command, def, args) {
  for (const key of Object.keys(args)) {
    if (key === '_command' || key === 'execute') continue;
    if (!def.required.includes(key) && !def.optional.includes(key)) throw new RefusedError(`--${key} does not apply to ${command}`);
  }
  for (const flag of def.required) if (args[flag] === undefined) throw new RefusedError(`${command} needs --${flag}`);
  const a = {};
  if (args.user !== undefined) {
    const allowAll = command === 'activities';
    if (!(allowAll ? ACTIVITY_USER_KEY : USER_KEY).test(args.user)) {
      throw new RefusedError(allowAll
        ? '--user must be all, one email address such as [USER@DOMAIN.COM], or a numeric user ID'
        : '--user must be one email address such as [USER@DOMAIN.COM] or a numeric user ID ([USER_ID]); only activities takes all');
    }
    a.user = args.user;
  }
  if (command === 'activities' && a.user === undefined) a.user = 'all';
  if (args.query !== undefined) {
    if (!USER_QUERY.test(args.query)) throw new RefusedError('--query must be 1 to 256 printable characters, such as "isEnrolledIn2Sv=false"');
    a.query = args.query;
  }
  if (args['max-results'] !== undefined) {
    const limit = command === 'users' ? USERS_MAX : ACTIVITIES_MAX;
    if (!limit.test(args['max-results'])) throw new RefusedError(`--max-results must be a whole number from 1 to ${command === 'users' ? 500 : 1000}`);
    a.maxResults = args['max-results'];
  }
  if (args['page-token'] !== undefined) {
    if (!PAGE_TOKEN.test(args['page-token'])) throw new RefusedError('--page-token must be the nextPageToken value a previous users read printed');
    a.pageToken = args['page-token'];
  }
  if (args['role-id'] !== undefined) {
    if (!ROLE_ID.test(args['role-id'])) throw new RefusedError('--role-id must be a numeric role ID (the roles read lists them)');
    a.roleId = args['role-id'];
  }
  if (args.group !== undefined) {
    if (!GROUP_KEY.test(args.group)) throw new RefusedError('--group must be a group email address ([GROUP_EMAIL]) or a group ID');
    a.group = args.group;
  }
  if (args.app !== undefined) {
    if (!APP.test(args.app)) throw new RefusedError(`--app must be one of ${APPS.join(', ')} (the lane's list)`);
    a.app = args.app;
  }
  for (const [flag, key] of [['start', 'start'], ['end', 'end'], ['not-before', 'notBefore']]) {
    if (args[flag] === undefined) continue;
    if (!realTime(args[flag])) throw new RefusedError(`--${flag} must be an ISO 8601 UTC time such as 2026-01-31T09:30:00.000Z`);
    a[key] = args[flag];
  }
  if (a.start !== undefined && a.end !== undefined && Date.parse(a.start) >= Date.parse(a.end)) throw new RefusedError('--start must be before --end');
  if (args.event !== undefined) {
    if (!EVENT_NAME.test(args.event)) throw new RefusedError('--event must be one event name: letters, digits and underscores, such as CHANGE_PASSWORD');
    a.event = args.event;
  }
  if (args.date !== undefined) {
    if (!realDate(args.date)) throw new RefusedError('--date must be a calendar date, YYYY-MM-DD');
    a.date = args.date;
  }
  if (args.parameters !== undefined) {
    if (!USAGE_PARAMETERS.test(args.parameters)) throw new RefusedError('--parameters must be a comma-separated list of application:parameter names, such as accounts:num_users_2sv_enrolled');
    a.parameters = args.parameters;
  }
  if (args.ou !== undefined) {
    if (!OU_PATH.test(args.ou)) throw new RefusedError('--ou must be an organizational unit path that starts with /, such as /[OU_PATH]');
    a.ou = args.ou;
  }
  if (args.target !== undefined) {
    if (!TARGET.test(args.target)) throw new RefusedError('--target must be 1 to 256 printable characters: the account, file or domain the event acted on, such as [USER@DOMAIN.COM]');
    a.target = args.target;
  }
  return a;
}

// ── Read-back judgements ─────────────────────────────────────────────────────
// The contract's redaction marker, taken from the contract itself.
const REDACTED = redactDeep('mark', ['mark']);
const MAX_LISTED = 20;
const orNull = (value) => (value === undefined ? null : value);
const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const lower = (value) => String(value).toLowerCase();

// An address read back matches --user when it is the same address in any case. The
// contract prints a credential value as [REDACTED]; such a value matches only when --user
// is itself one of the configured addresses (the read is already filtered to --user by
// its path).
function identityMatches(observed, wanted, ctx) {
  if (typeof observed !== 'string') return false;
  if (lower(observed) === lower(wanted)) return true;
  return observed === REDACTED && ctx.identities.some((value) => lower(value) === lower(wanted));
}

function sameUser(record, wanted, ctx) {
  if (!isObject(record)) return false;
  if (NUMERIC_ID.test(wanted)) return record.id === wanted;
  const names = [record.primaryEmail, ...(Array.isArray(record.aliases) ? record.aliases : []), ...(Array.isArray(record.nonEditableAliases) ? record.nonEditableAliases : [])];
  return names.some((name) => identityMatches(name, wanted, ctx));
}

const NOT_THE_USER = 'the user record read is not the user asked for';

// An activity event's parameters, as printed: each one's name with its value or
// multiValue (the string forms the Reports API returns; other value kinds are listed by
// name only).
function parametersOf(event) {
  const list = Array.isArray(event.parameters) ? event.parameters.filter(isObject) : [];
  return list.slice(0, MAX_LISTED).map((p) => {
    const shown = { name: orNull(p.name) };
    if (typeof p.value === 'string') shown.value = p.value;
    if (Array.isArray(p.multiValue)) shown.multiValue = p.multiValue.filter((v) => typeof v === 'string');
    return shown;
  });
}

// --target matches a parameter value: an email address in any case (and a redacted
// credential identity when --target names it), any other text exactly.
function eventNamesTarget(event, target, ctx) {
  const list = Array.isArray(event.parameters) ? event.parameters.filter(isObject) : [];
  const values = list.flatMap((p) => [p.value, ...(Array.isArray(p.multiValue) ? p.multiValue : [])]).filter((v) => typeof v === 'string');
  return EMAIL.test(target) ? values.some((v) => identityMatches(v, target, ctx)) : values.includes(target);
}

const JUDGES = Object.freeze({
  'verify-suspended': (a, [user], ctx) => {
    const observed = { user: orNull(isObject(user) ? user.primaryEmail : undefined), suspended: orNull(isObject(user) ? user.suspended : undefined), suspensionReason: orNull(isObject(user) ? user.suspensionReason : undefined) };
    if (!sameUser(user, a.user, ctx)) return { verified: false, observed, reason: NOT_THE_USER };
    return { verified: user.suspended === true, observed, reason: 'the user is not suspended' };
  },
  'verify-2sv-enforced': (a, [user], ctx) => {
    const observed = { user: orNull(isObject(user) ? user.primaryEmail : undefined), isEnforcedIn2Sv: orNull(isObject(user) ? user.isEnforcedIn2Sv : undefined), isEnrolledIn2Sv: orNull(isObject(user) ? user.isEnrolledIn2Sv : undefined) };
    if (!sameUser(user, a.user, ctx)) return { verified: false, observed, reason: NOT_THE_USER };
    return { verified: user.isEnforcedIn2Sv === true, observed, reason: '2-Step Verification is not enforced for the user (isEnforcedIn2Sv is not true)' };
  },
  'verify-2sv-not-enforced': (a, [user], ctx) => {
    const observed = { user: orNull(isObject(user) ? user.primaryEmail : undefined), isEnforcedIn2Sv: orNull(isObject(user) ? user.isEnforcedIn2Sv : undefined), isEnrolledIn2Sv: orNull(isObject(user) ? user.isEnrolledIn2Sv : undefined) };
    if (!sameUser(user, a.user, ctx)) return { verified: false, observed, reason: NOT_THE_USER };
    return { verified: user.isEnforcedIn2Sv === false, observed, reason: 'the read does not show 2-Step Verification as not enforced for the user (isEnforcedIn2Sv is not false)' };
  },
  'verify-ou': (a, [user], ctx) => {
    const observed = { user: orNull(isObject(user) ? user.primaryEmail : undefined), orgUnitPath: orNull(isObject(user) ? user.orgUnitPath : undefined) };
    if (!sameUser(user, a.user, ctx)) return { verified: false, observed, reason: NOT_THE_USER };
    return { verified: user.orgUnitPath === a.ou, observed, reason: 'the user is not in the organizational unit given (paths match exactly, case included)' };
  },
  'verify-admin-role-removed': (a, [user, list], ctx) => {
    const items = isObject(list) && Array.isArray(list.items) ? list.items : [];
    const held = [...new Set(items.filter(isObject).map((i) => (i.roleId === undefined || i.roleId === null ? null : String(i.roleId))).filter((id) => id !== null))];
    const morePages = isObject(list) && typeof list.nextPageToken === 'string' && list.nextPageToken !== '';
    const observed = {
      user: orNull(isObject(user) ? user.primaryEmail : undefined),
      isAdmin: orNull(isObject(user) ? user.isAdmin : undefined),
      isDelegatedAdmin: orNull(isObject(user) ? user.isDelegatedAdmin : undefined),
      assignmentsRead: items.length,
      roleIdsHeld: held,
      morePages,
    };
    const caveat = 'This read lists direct assignments only (includeIndirectRoleAssignments is not on the lane\'s allow-list): a role held through a group is not shown. Check the groups that hold the role with group-members.';
    if (!sameUser(user, a.user, ctx)) return { verified: false, observed, reason: NOT_THE_USER, caveat };
    if (held.includes(a.roleId)) return { verified: false, observed, reason: 'the user still holds a direct assignment of the role', caveat };
    if (morePages) return { verified: false, observed, reason: 'the assignments list has another page, so the role missing from the first page is not proof', caveat };
    return { verified: true, observed, caveat };
  },
  'verify-event': (a, [feed], ctx) => {
    const notBeforeMs = Date.parse(a.notBefore);
    const items = isObject(feed) && Array.isArray(feed.items) ? feed.items : [];
    const morePages = isObject(feed) && typeof feed.nextPageToken === 'string' && feed.nextPageToken !== '';
    const observed = { recordsRead: items.length, match: null, recordsSinceNotBefore: [], morePages };
    for (const item of items) {
      if (!isObject(item) || !isObject(item.id)) continue;
      const time = typeof item.id.time === 'string' ? item.id.time : null;
      const t = time === null ? NaN : Date.parse(time);
      if (!Number.isFinite(t) || t < notBeforeMs) continue;
      const events = Array.isArray(item.events) ? item.events.filter(isObject) : [];
      const names = events.map((e) => e.name).filter((n) => typeof n === 'string');
      const named = events.filter((e) => e.name === a.event);
      const actor = isObject(item.actor) ? item.actor : {};
      const summary = { time, application: orNull(item.id.applicationName), events: names, actorEmail: orNull(actor.email) };
      if (named.length) summary.parameters = parametersOf(named[0]);
      const sameApp = item.id.applicationName === undefined || item.id.applicationName === a.app;
      const sameActor = NUMERIC_ID.test(a.user) ? actor.profileId === a.user : identityMatches(actor.email, a.user, ctx);
      const hit = named.find((e) => a.target === undefined || eventNamesTarget(e, a.target, ctx));
      if (sameApp && sameActor && hit) {
        observed.match = { ...summary, parameters: parametersOf(hit) };
        return { verified: true, observed };
      }
      if (observed.recordsSinceNotBefore.length < MAX_LISTED) observed.recordsSinceNotBefore.push(summary);
    }
    const about = a.target === undefined ? '' : ` whose parameters name ${a.target}`;
    let reason = `no ${a.app} event named ${a.event} by the user${about} at or after ${a.notBefore} among the ${items.length} record(s) read`;
    if (morePages) reason += '; the read has another page, so this is not proof either way';
    return { verified: false, observed, reason };
  },
});

// ── Reads ────────────────────────────────────────────────────────────────────
async function readAll(client, paths) {
  const results = [];
  for (const p of paths) {
    const res = await client.send({ method: 'GET', path: p });
    if (!res.ok) return { failed: res };
    results.push(res);
  }
  return { results };
}

// A user's recovery email and phone are printed as "set" or "missing", never as values:
// the runbooks record only whether each is set, and the values are personal contact
// details. A field the response leaves out stays out (a runbook records it as missing).
const RECOVERY_FIELDS = Object.freeze(['recoveryEmail', 'recoveryPhone']);
function maskRecovery(record) {
  if (!isObject(record)) return record;
  const present = RECOVERY_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(record, f));
  if (!present.length) return record;
  const masked = { ...record };
  for (const f of present) masked[f] = typeof record[f] === 'string' && record[f].trim() !== '' ? 'set' : 'missing';
  return masked;
}
function maskUserData(command, data) {
  if (command === 'user') return maskRecovery(data);
  if (command === 'users' && isObject(data) && Array.isArray(data.users)) return { ...data, users: data.users.map(maskRecovery) };
  return data;
}

function readOutput(command, res) {
  const out = { state: STATES.OK, ok: true, command, status: res.status, attempts: res.attempts, data: maskUserData(command, res.data) };
  if (isObject(res.data) && typeof res.data.nextPageToken === 'string' && res.data.nextPageToken) {
    out.morePages = true;
    out.note = command === 'users'
      ? 'more users: repeat the read with --page-token set to data.nextPageToken'
      : 'more records exist: the lane allow-list reads the first page only, so narrow the read or check the rest in the Admin console';
  }
  if (res.flags && res.flags.length) {
    // a flagged recovery detail is reported by path only, so its value is never printed
    out.flags = res.flags.map((f) => (/\.recovery(?:Email|Phone)$/.test(String(f.path)) ? { ...f, quote: '(recovery detail withheld)' } : f));
  }
  return out;
}

function verdictOutput(command, def, a, results, ctx) {
  const judged = JUDGES[command](a, results.map((r) => r.data), ctx);
  const out = { state: STATES.OK, ok: true, command, verified: judged.verified === true, expected: def.expected(a), observed: judged.observed };
  if (!out.verified) out.reason = judged.reason;
  if (judged.caveat) out.caveat = judged.caveat;
  if (JSON.stringify(judged.observed).includes(REDACTED)) {
    out.redactedNote = 'an address equal to GWS_ADMIN_SUBJECT or GWS_SA_CLIENT_EMAIL is printed as [REDACTED]';
  }
  const flags = [];
  results.forEach((r, i) => {
    for (const f of r.flags || []) flags.push(results.length > 1 ? { ...f, path: `read ${i + 1} ${f.path}` } : f);
  });
  if (flags.length) out.flags = flags;
  return out;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const NO_ENV = Object.freeze({});
const CREDENTIAL_VARS = ['GWS_SA_CLIENT_EMAIL', 'GWS_SA_PRIVATE_KEY', 'GWS_ADMIN_SUBJECT'];
const IDENTITY_VARS = ['GWS_SA_CLIENT_EMAIL', 'GWS_ADMIN_SUBJECT'];

function dryRun(command, def, a, paths) {
  // The contract's own door, with an empty environment: the hosts are fixed, so no
  // variable is read and nothing is sent.
  const planned = paths.map((p) => checkRequest(SPEC, NO_ENV, { method: 'GET', path: p }));
  const shown = { state: STATES.OK, ok: true, command, method: planned[0].method, host: planned[0].host, path: planned[0].path };
  if (planned.length > 1) shown.then = planned.slice(1).map((p) => ({ method: p.method, host: p.host, path: p.path }));
  if (def.kind === 'verify') shown.expected = def.expected(a);
  shown.auth = `before the first read, one POST to ${TOKEN_HOST}${TOKEN_PATH} with grant_type and a signed assertion for the scopes below; the access token then goes only in the Authorization header`;
  shown.scopes = [...SCOPES];
  shown.note = 'dry run: no credentials read, no network';
  shown.next = 'Add --execute to perform this read.';
  return shown;
}

async function run(argv, env = process.env, deps = {}) {
  const out = deps.out || ((s) => process.stdout.write(s));
  const err = deps.err || ((s) => process.stderr.write(s));
  const now = deps.now || Date.now;
  const seen = [];
  const identities = [];
  const remember = (value) => { if (typeof value === 'string' && value.length >= 4 && !seen.includes(value)) seen.push(value); };
  try {
    const args = parseArgs(Array.isArray(argv) ? argv : [], { values: VALUE_FLAGS });
    const command = args._command;
    if (command === 'help' || command === '--help' || command === '-h') { out(USAGE); return 0; }
    if (typeof command !== 'string' || !Object.prototype.hasOwnProperty.call(COMMANDS, command)) {
      err(USAGE);
      throw new RefusedError(command === undefined ? 'no command given' : 'unknown command; no command writes to Google Workspace');
    }
    const def = COMMANDS[command];
    const a = validate(command, def, args);
    const paths = def.paths(a);

    if (args.execute !== true) {
      out(renderResult(dryRun(command, def, a, paths)));
      return 0;
    }

    // The client only ever sees this view of the environment. It remembers the
    // credential values the contract read, so printed output is redacted with them too;
    // this file never reads a credential itself.
    const envView = new Proxy(env, {
      get(target, name) {
        const value = Reflect.get(target, name);
        if (typeof name === 'string' && CREDENTIAL_VARS.includes(name) && typeof value === 'string' && value) {
          remember(value);
          if (IDENTITY_VARS.includes(name) && !identities.includes(value)) identities.push(value);
        }
        return value;
      },
    });
    const client = createClient(makeSpec({ now, remember }), {
      env: envView, transport: deps.transport, sleep: deps.sleep, now: deps.now, timeoutMs: deps.timeoutMs, maxRetries: deps.maxRetries,
    });
    const read = await readAll(client, paths);
    let res;
    if (read.failed) res = { command, ...read.failed };
    else if (def.kind === 'read') res = readOutput(command, read.results[0]);
    else res = verdictOutput(command, def, a, read.results, { identities });
    const shown = redactDeep(res, seen);
    const code = exitCodeFor(shown);
    (code === 1 ? err : out)(renderResult(shown, { secrets: seen }));
    return code;
  } catch (error) {
    if (error instanceof TripwireError || (error && error.name === 'NetworkTripwireError')) throw error;
    if (error instanceof RefusedError) {
      err(renderResult({ state: STATES.REFUSED, ok: false, error: error.message }, { secrets: seen }));
      return 1;
    }
    err(renderResult({ state: STATES.INVALID_RESPONSE, ok: false, error: 'unexpected adapter error (details withheld)' }));
    return 2;
  }
}

if (require.main === module) {
  run(process.argv.slice(2), process.env).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(error && error.name === 'NetworkTripwireError' ? 'Network tripwire fired\n' : 'gws-client: unexpected error (details withheld)\n');
    process.exitCode = 2;
  });
}

module.exports = { SPEC, run, makeSpec, SCOPES, READ_ONLY_SCOPE_NAMES, checkScopes, collectTenant };
