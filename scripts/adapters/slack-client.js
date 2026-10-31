'use strict';
// slack-client.js: the read-only Slack Web API adapter (lane G2), built on the shared
// contract in readonly-contract.js. README.md beside this file; the allow-list and the
// refused writes are listed in docs/aegis/lanes/g2.md, section "Slack".
//
// Aegis advises; humans execute (PRODUCT_CONTRACT.md). This adapter sends GET reads to
// https://slack.com/api/<method> for ten methods and nothing else: nine on SPEC and
// team.accessLogs (with its own auth.test) on ACCESS_LOGS_SPEC. Every Slack write
// (a message, reaction, invite, channel change, deactivation, session reset or app
// approval) is a HUMAN-RUN step in a runbook under .claude/commands/; the verify-*
// commands here prove that step afterwards with a read.
//
// Usage: node scripts/adapters/slack-client.js <command> [flags] [--execute]
//   Without the bare --execute flag every read prints its planned request(s) and
//   exits 0: no credential is read and nothing is sent.
//
//   Offline (no credential, no network, no --execute):
//     digest --file [NOTE_FILE]            SHA-256 of the whitespace-normalised draft,
//                                          a not-before time and the verify-posted line
//   Reads:
//     whoami                               auth.test
//     user --user [USER_ID]                users.info (state fields only, no profile)
//     users [--limit 1-200] [--cursor C]   users.list (state fields and counts)
//     team                                 team.info
//     channel --channel [CHANNEL_ID]       conversations.info
//     app-requests | apps-approved | apps-restricted [--limit 1-1000] [--cursor C]
//                                          admin.apps.*.list (Enterprise org token
//                                          with admin.apps:read), team_id = SLACK_TEAM_ID
//     access-logs [--count 1-1000] [--page 1-100]
//                                          auth.test, then team.accessLogs (paid plans)
//   Read-backs (exit 0 verified, 2 not verified, 4 a dry run):
//     verify-deactivated --user [USER_ID]  users.info: deleted is true
//     verify-reactivated --user [USER_ID]  users.info: deleted is false or absent
//     verify-guest --user [USER_ID] --type single|multi
//                                          single: is_ultra_restricted is true;
//                                          multi: is_restricted true, is_ultra_restricted
//                                          not true; never for a deactivated account
//     verify-archived --channel [CHANNEL_ID]
//                                          conversations.info: is_archived is true
//     verify-posted --channel [CHANNEL_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE]
//                                          auth.test, then conversations.history
//                                          (oldest = not-before, limit 50): a person's
//                                          plain message (no subtype, bot_id or app_id)
//                                          after not-before with that digest
//     verify-app-approved --app-id [APP_ID]
//                                          in admin.apps.approved.list and out of
//                                          admin.apps.requests.list (10 pages each at most)
//     verify-app-restricted --app-id [APP_ID]
//                                          in admin.apps.restricted.list
//
// Environment: SLACK_TEAM_ID names this deployment's workspace (T...). Each read sends
// one token, only as Authorization: Bearer, and needs only the scopes in this table
// (SCOPES below; scope names from Slack's 2021 OpenAPI spec and search excerpts of
// docs.slack.dev, so confirm them on the app's OAuth page):
//   command                                  token variable           scopes
//   digest                                   none (offline)           none
//   whoami                                   SLACK_TOKEN              none (auth.test)
//   user, users, verify-deactivated,         SLACK_TOKEN              users:read
//     verify-reactivated, verify-guest
//   team                                     SLACK_TOKEN              team:read
//   channel, verify-archived                 SLACK_TOKEN              channels:read (public channel),
//                                                                     groups:read (private channel)
//   verify-posted                            SLACK_TOKEN              channels:history (public channel),
//                                                                     groups:history (private channel)
//   app-requests, apps-approved,             SLACK_TOKEN              admin.apps:read only (an Enterprise
//     apps-restricted, verify-app-approved,                           org-level user token; never with
//     verify-app-restricted                                           admin.apps:write)
//   access-logs                              SLACK_ACCESS_LOGS_TOKEN  admin (an admin's user token,
//                                                                     paid plans)
// The admin scope also authorizes Slack's SCIM API, including DELETE /Users (a
// deactivation), so access-logs reads its own variable: a separate token, exported for
// that one read and unset right after, never SLACK_TOKEN. No other command reads
// SLACK_ACCESS_LOGS_TOKEN, access-logs never reads SLACK_TOKEN, and SPEC refuses
// team.accessLogs, so SLACK_TOKEN never needs the admin scope.
//
// A user, member, team or channel record whose team id is another workspace's, or
// that has none, is refused (exit 3). access-logs and verify-posted, whose answers
// carry no team id, first read auth.test and stop unless its team_id is SLACK_TEAM_ID.
//
// Slack answers HTTP 200 with ok: false on an error. That is a failed read (exit 2)
// reported with the error code only. There is no token exchange: oauth.v2.access needs
// a browser redirect and a code a person approves.
//
// Exit codes: 0 read or verified; 1 refused, input error or missing credentials;
// 2 read failed or not verified; 3 a record from another workspace; 4 a verify-* dry run.
//
// Vendor facts (read 2026-10-27, docs/aegis/lanes/g2.md): method names, the
// https://slack.com/api/ base and the Bearer header from Slack's SDK source; user and
// conversation fields and scopes from Slack's OpenAPI spec (last updated 2021, so the
// guest fields and channel.context_team_id are read the safe way: a missing field
// fails the check); app list shapes and team.accessLogs from search excerpts of
// docs.slack.dev. Message text is compared as returned: Slack formatting of links,
// mentions or the characters & < > was not in the sources, so such a draft may not
// verify (a false "not verified", never a false pass).

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  STATES, EXIT, RefusedError, TRIPWIRE_MESSAGE,
  defineAdapter, createClient, renderResult, exitCodeFor, parseArgs, scanUntrusted, realCalendarTime, dryRunExit,
} = require('./readonly-contract.js');
const { cliDeps, recordVerdict, takeChange, changeRefusal } = require('./cli-support.js');

const HOST = 'slack.com';
const HISTORY_LIMIT = '50';
const APP_PAGE_LIMIT = '100';
const MAX_APP_PAGES = 10;
const MAX_DRAFT_BYTES = 1024 * 1024;

const PATTERNS = Object.freeze({
  user: /^[UW][A-Z0-9]{2,30}$/,
  channel: /^[CG][A-Z0-9]{2,30}$/,
  team: /^T[A-Z0-9]{2,30}$/,
  app: /^A[A-Z0-9]{2,30}$/,
  cursor: /^[A-Za-z0-9+/=_-]{1,512}$/,
  limit200: /^(?:[1-9][0-9]?|1[0-9]{2}|200)$/,
  limit1000: /^(?:[1-9][0-9]{0,2}|1000)$/,
  page100: /^(?:[1-9][0-9]?|100)$/,
  oldest: /^[0-9]{10}\.[0-9]{6}$/,
  sha256: /^[0-9a-fA-F]{64}$/,
  slackError: /^[a-z_]{1,64}$/,
});

// Named in docs/aegis/lanes/g2.md as refused. None of them is a route below, and the
// contract refuses every name that is not a route, so this list is documentation plus
// a load-time check that nobody adds one of them to the allow-list.
const REFUSED_METHODS = Object.freeze([
  'chat.postMessage', 'chat.update', 'chat.delete', 'reactions.add',
  'conversations.archive', 'conversations.invite', 'conversations.kick',
  'admin.users.remove', 'admin.users.session.reset', 'admin.conversations.delete',
  'admin.apps.approve', 'oauth.v2.access',
]);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// The tenant fields of each allow-listed answer. An answer with ok other than true
// is a Slack error and is reported by code only, so it binds nothing here.
function teamIdsIn(json) {
  if (!isObject(json) || json.ok !== true) return [];
  const ids = [];
  if (has(json, 'team_id')) ids.push(json.team_id); // auth.test
  if (isObject(json.user)) ids.push(json.user.team_id); // users.info
  if (Array.isArray(json.members)) for (const m of json.members) ids.push(isObject(m) ? m.team_id : undefined); // users.list
  if (isObject(json.team)) ids.push(json.team.id); // team.info
  if (isObject(json.channel)) ids.push(json.channel.context_team_id); // conversations.info
  return ids;
}

const appListQuery = { team_id: PATTERNS.team, limit: PATTERNS.limit1000, cursor: PATTERNS.cursor };

// batch G3: the scope preflight (scripts/adapters/scope-manifest.json). Slack returns the
// token's scopes in the x-oauth-scopes header (docs.slack.dev, legacy OAuth scopes page,
// read 2026-10-28). Only read scopes pass: names ending in :read, :read.<detail> or
// :history; admin passes only for the access-logs token, whose one read needs it.
const SLACK_READ_SCOPE = /^[a-z][a-z0-9_.]*:(?:read(?:\.[a-z0-9_]+)?|history)$/;
const scopeList = (value) => String(value).split(',').map((s) => s.trim()).filter(Boolean);
const AUTH_TEST_ROUTE = { method: 'GET', path: '/api/auth.test' };

const SPEC = defineAdapter({
  platform: 'slack',
  host: { fixed: HOST },
  credentials: ['SLACK_TOKEN'],
  auth: (creds) => ({ Authorization: `Bearer ${creds.SLACK_TOKEN}` }),
  routes: {
    'auth.test': AUTH_TEST_ROUTE,
    'users.info': { method: 'GET', path: '/api/users.info', query: { user: PATTERNS.user } },
    'users.list': { method: 'GET', path: '/api/users.list', query: { limit: PATTERNS.limit200, cursor: PATTERNS.cursor } },
    'team.info': { method: 'GET', path: '/api/team.info' },
    'conversations.info': { method: 'GET', path: '/api/conversations.info', query: { channel: PATTERNS.channel } },
    'conversations.history': {
      method: 'GET',
      path: '/api/conversations.history',
      query: { channel: PATTERNS.channel, oldest: PATTERNS.oldest },
      fixedQuery: { limit: HISTORY_LIMIT },
    },
    'admin.apps.requests.list': { method: 'GET', path: '/api/admin.apps.requests.list', query: appListQuery },
    'admin.apps.approved.list': { method: 'GET', path: '/api/admin.apps.approved.list', query: appListQuery },
    'admin.apps.restricted.list': { method: 'GET', path: '/api/admin.apps.restricted.list', query: appListQuery },
  },
  tenant: { env: 'SLACK_TEAM_ID', collect: teamIdsIn },
  scopes: { manifest: 'slack', kind: 'header', vendor: 'Slack', header: 'x-oauth-scopes', granted: scopeList, allowed: (s) => SLACK_READ_SCOPE.test(s) },
});

// team.accessLogs needs the admin scope, so it has its own spec and its own token
// variable: SLACK_TOKEN is never asked to carry that scope.
const ACCESS_LOGS_SPEC = defineAdapter({
  platform: 'slack',
  host: { fixed: HOST },
  credentials: ['SLACK_ACCESS_LOGS_TOKEN'],
  auth: (creds) => ({ Authorization: `Bearer ${creds.SLACK_ACCESS_LOGS_TOKEN}` }),
  routes: {
    'auth.test': AUTH_TEST_ROUTE,
    'team.accessLogs': { method: 'GET', path: '/api/team.accessLogs', query: { count: PATTERNS.limit1000, page: PATTERNS.page100 } },
  },
  tenant: { env: 'SLACK_TEAM_ID', collect: teamIdsIn },
  scopes: { manifest: 'slack-access-logs', kind: 'header', vendor: 'Slack', header: 'x-oauth-scopes', granted: scopeList, allowed: (s) => s === 'admin' || SLACK_READ_SCOPE.test(s) },
});

for (const spec of [SPEC, ACCESS_LOGS_SPEC]) {
  for (const name of REFUSED_METHODS) {
    if (has(spec.routes, name)) throw new Error(`slack-client: ${name} is a refused method and cannot be a route`);
  }
}

// ── Draft digest (the Linear note's normalisation) ──────────────────────────
// CRLF to LF, trailing spaces and tabs removed from each line, trailing newlines
// removed. Nothing else changes, so any edit to the text changes the digest.
function normaliseText(text) {
  return String(text)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// ── Time ────────────────────────────────────────────────────────────────────
// the form only (fraction of 1 to 3 digits, as Google Workspace and Linear take it); the
// calendar and the zone are checked by the contract's realCalendarTime
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const NOT_BEFORE_RULE = 'an ISO 8601 time with a zone (2026-10-27T18:30:00Z) or epoch milliseconds, not in the future';

function parseNotBefore(value, nowMs) {
  let ms;
  if (/^[0-9]{13}$/.test(value)) {
    ms = Number(value);
  } else {
    if (!ISO_TIME.test(value)) throw new RefusedError(`--not-before must be ${NOT_BEFORE_RULE}`);
    // the contract's calendar and zone check, shared with the other adapters
    if (!realCalendarTime(value)) throw new RefusedError(`--not-before is not a real date and time; it must be ${NOT_BEFORE_RULE}`);
    ms = Date.parse(value);
  }
  if (!Number.isSafeInteger(ms) || ms < 1e12) throw new RefusedError(`--not-before must be ${NOT_BEFORE_RULE}`);
  if (ms > nowMs) throw new RefusedError('--not-before is in the future, so no post can be after it yet');
  return ms;
}

// Slack's oldest parameter and message ts are seconds with six decimal places.
function oldestFromMs(ms) {
  return `${Math.floor(ms / 1000)}.${String(ms % 1000).padStart(3, '0')}000`;
}

function tsToMicros(ts) {
  if (typeof ts !== 'string' || !/^[0-9]{1,12}\.[0-9]{1,6}$/.test(ts)) return null;
  const [sec, frac] = ts.split('.');
  return BigInt(sec) * 1000000n + BigInt(frac.padEnd(6, '0'));
}

// ── Response shaping ────────────────────────────────────────────────────────
// user and users print state fields only: no names, emails, phone numbers or titles.
const USER_STATE_FIELDS = Object.freeze([
  'id', 'team_id', 'deleted', 'is_admin', 'is_owner', 'is_primary_owner', 'is_restricted',
  'is_ultra_restricted', 'is_bot', 'is_app_user', 'is_stranger', 'is_invited_user', 'has_2fa',
  'two_factor_type', 'updated',
]);

function userState(record) {
  const out = {};
  if (!isObject(record)) return out;
  for (const key of USER_STATE_FIELDS) {
    const v = record[key];
    if (has(record, key) && (typeof v === 'boolean' || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)))) out[key] = v;
  }
  return out;
}

function memberKind(m) {
  if (m.deleted === true) return 'deactivated';
  if (m.is_bot === true || m.id === 'USLACKBOT') return 'active_bots';
  if (m.is_ultra_restricted === true) return 'active_single_channel_guests';
  if (m.is_restricted === true) return 'active_multi_channel_guests';
  return 'active_full_members';
}

function nextCursor(body) {
  const meta = isObject(body.response_metadata) ? body.response_metadata : {};
  return typeof meta.next_cursor === 'string' ? meta.next_cursor : '';
}

// An app list entry is printed as returned, except that a person in it (the requester,
// under "user") is printed by ID only.
function appEntry(entry) {
  if (!isObject(entry)) return entry;
  if (!isObject(entry.user)) return entry;
  return { ...entry, user: has(entry.user, 'id') ? { id: entry.user.id } : {} };
}

const LOGIN_FIELDS = Object.freeze(['user_id', 'date_first', 'date_last', 'count', 'ip', 'user_agent', 'isp', 'country', 'region']);

const SHAPES = {
  whoami: (body) => (typeof body.team_id === 'string' ? { data: body } : null),
  user: (body) => (isObject(body.user) ? { data: { user: userState(body.user) } } : null),
  users: (body) => {
    if (!Array.isArray(body.members)) return null;
    const members = body.members.map(userState);
    const summary = {
      members_on_page: members.length,
      deactivated: 0,
      active_full_members: 0,
      active_multi_channel_guests: 0,
      active_single_channel_guests: 0,
      active_bots: 0,
      next_cursor: nextCursor(body),
    };
    for (const m of members) summary[memberKind(m)] += 1;
    return { data: { members }, summary };
  },
  team: (body) => (isObject(body.team) ? { data: { team: body.team } } : null),
  channel: (body) => (isObject(body.channel) ? { data: { channel: body.channel } } : null),
  apps: (key) => (body) => {
    if (!Array.isArray(body[key])) return null;
    const ids = body[key].map((e) => (isObject(e) && isObject(e.app) && typeof e.app.id === 'string' ? e.app.id : null));
    return { data: { [key]: body[key].map(appEntry) }, summary: { apps_on_page: ids.length, app_ids: ids, next_cursor: nextCursor(body) } };
  },
  logs: (body) => {
    if (!Array.isArray(body.logins)) return null;
    const logins = body.logins.map((l) => {
      const out = {};
      if (isObject(l)) for (const k of LOGIN_FIELDS) if (has(l, k)) out[k] = l[k];
      return out;
    });
    return { data: { logins, paging: isObject(body.paging) ? body.paging : null } };
  },
};

// ── Commands ────────────────────────────────────────────────────────────────
const RULES = Object.freeze({
  user: { pattern: PATTERNS.user, says: 'a Slack user ID: U or W, then capital letters and digits' },
  channel: { pattern: PATTERNS.channel, says: 'a Slack channel ID: C or G, then capital letters and digits (direct messages are not read)' },
  app: { pattern: PATTERNS.app, says: 'a Slack app ID: A, then capital letters and digits' },
  cursor: { pattern: PATTERNS.cursor, says: 'a next_cursor value from an earlier read (letters, digits, + / = _ -, at most 512)' },
  limit200: { pattern: PATTERNS.limit200, says: 'a whole number from 1 to 200' },
  limit1000: { pattern: PATTERNS.limit1000, says: 'a whole number from 1 to 1000' },
  page100: { pattern: PATTERNS.page100, says: 'a whole number from 1 to 100' },
  guestType: { pattern: /^(?:single|multi)$/, says: 'single or multi' },
  sha256: { pattern: PATTERNS.sha256, says: '64 hexadecimal characters (the SHA-256 that digest printed)' },
  notBefore: { says: NOT_BEFORE_RULE },
  file: { says: 'a path to the saved draft' },
});

const step = (route, query = {}) => ({ route, query });
const pick = (args, keys) => {
  const out = {};
  for (const k of keys) if (args[k] !== undefined) out[k] = args[k];
  return out;
};
const appListCommand = (route, key) => ({
  kind: 'read',
  team: true,
  flags: { limit: RULES.limit1000, cursor: RULES.cursor },
  steps: (a, ctx) => [step(route, { team_id: ctx.team, ...pick(a, ['limit', 'cursor']) })],
  shape: SHAPES.apps(key),
});

const COMMANDS = Object.freeze({
  digest: { kind: 'offline', flags: { file: RULES.file }, required: ['file'] },
  whoami: { kind: 'read', flags: {}, steps: () => [step('auth.test')], shape: SHAPES.whoami },
  user: { kind: 'read', flags: { user: RULES.user }, required: ['user'], steps: (a) => [step('users.info', { user: a.user })], shape: SHAPES.user },
  users: { kind: 'read', flags: { limit: RULES.limit200, cursor: RULES.cursor }, steps: (a) => [step('users.list', pick(a, ['limit', 'cursor']))], shape: SHAPES.users },
  team: { kind: 'read', flags: {}, steps: () => [step('team.info')], shape: SHAPES.team },
  channel: { kind: 'read', flags: { channel: RULES.channel }, required: ['channel'], steps: (a) => [step('conversations.info', { channel: a.channel })], shape: SHAPES.channel },
  'app-requests': appListCommand('admin.apps.requests.list', 'app_requests'),
  'apps-approved': appListCommand('admin.apps.approved.list', 'approved_apps'),
  'apps-restricted': appListCommand('admin.apps.restricted.list', 'restricted_apps'),
  'access-logs': {
    kind: 'read',
    spec: ACCESS_LOGS_SPEC,
    flags: { count: RULES.limit1000, page: RULES.page100 },
    steps: (a) => [step('auth.test'), step('team.accessLogs', pick(a, ['count', 'page']))],
    shape: SHAPES.logs,
  },
  'verify-deactivated': { kind: 'verify', flags: { user: RULES.user }, required: ['user'], steps: (a) => [step('users.info', { user: a.user })], verify: verifyUser('deactivated') },
  'verify-reactivated': { kind: 'verify', flags: { user: RULES.user }, required: ['user'], steps: (a) => [step('users.info', { user: a.user })], verify: verifyUser('reactivated') },
  'verify-guest': {
    kind: 'verify',
    flags: { user: RULES.user, type: RULES.guestType },
    required: ['user', 'type'],
    steps: (a) => [step('users.info', { user: a.user })],
    verify: verifyUser('guest'),
  },
  'verify-archived': { kind: 'verify', flags: { channel: RULES.channel }, required: ['channel'], steps: (a) => [step('conversations.info', { channel: a.channel })], verify: verifyArchived },
  'verify-posted': {
    kind: 'verify',
    flags: { channel: RULES.channel, 'expect-sha256': RULES.sha256, 'not-before': RULES.notBefore },
    required: ['channel', 'expect-sha256', 'not-before'],
    steps: (a, ctx) => [step('auth.test'), step('conversations.history', { channel: a.channel, oldest: ctx.oldest })],
    verify: verifyPosted,
  },
  // For the two app read-backs, steps are the first pages the dry run prints; the
  // verify function then follows next_cursor itself (scanAppList).
  'verify-app-approved': {
    kind: 'verify',
    team: true,
    flags: { 'app-id': RULES.app },
    required: ['app-id'],
    steps: (a, ctx) => [
      step('admin.apps.approved.list', { team_id: ctx.team, limit: APP_PAGE_LIMIT }),
      step('admin.apps.requests.list', { team_id: ctx.team, limit: APP_PAGE_LIMIT }),
    ],
    pagination: `follows next_cursor up to ${MAX_APP_PAGES} pages per list`,
    verify: verifyAppApproved,
  },
  'verify-app-restricted': {
    kind: 'verify',
    team: true,
    flags: { 'app-id': RULES.app },
    required: ['app-id'],
    steps: (a, ctx) => [step('admin.apps.restricted.list', { team_id: ctx.team, limit: APP_PAGE_LIMIT })],
    pagination: `follows next_cursor up to ${MAX_APP_PAGES} pages`,
    verify: verifyAppRestricted,
  },
});

// The token variable and the scopes each command needs (the table in the header).
// channel and verify-archived need channels:read for a public channel or groups:read
// for a private one; verify-posted needs channels:history or groups:history the same way.
const scope = (token, scopes) => Object.freeze({ token, scopes: Object.freeze(scopes) });
const SCOPES = Object.freeze({
  digest: scope(null, []),
  whoami: scope('SLACK_TOKEN', []),
  user: scope('SLACK_TOKEN', ['users:read']),
  users: scope('SLACK_TOKEN', ['users:read']),
  team: scope('SLACK_TOKEN', ['team:read']),
  channel: scope('SLACK_TOKEN', ['channels:read', 'groups:read']),
  'app-requests': scope('SLACK_TOKEN', ['admin.apps:read']),
  'apps-approved': scope('SLACK_TOKEN', ['admin.apps:read']),
  'apps-restricted': scope('SLACK_TOKEN', ['admin.apps:read']),
  'access-logs': scope('SLACK_ACCESS_LOGS_TOKEN', ['admin']),
  'verify-deactivated': scope('SLACK_TOKEN', ['users:read']),
  'verify-reactivated': scope('SLACK_TOKEN', ['users:read']),
  'verify-guest': scope('SLACK_TOKEN', ['users:read']),
  'verify-archived': scope('SLACK_TOKEN', ['channels:read', 'groups:read']),
  'verify-posted': scope('SLACK_TOKEN', ['channels:history', 'groups:history']),
  'verify-app-approved': scope('SLACK_TOKEN', ['admin.apps:read']),
  'verify-app-restricted': scope('SLACK_TOKEN', ['admin.apps:read']),
});

for (const [name, def] of Object.entries(COMMANDS)) {
  const entry = SCOPES[name];
  const spec = def.spec || SPEC;
  if (!entry) throw new Error(`slack-client: ${name} has no scope entry`);
  if (def.kind !== 'offline' && spec.credentials[0] !== entry.token) throw new Error(`slack-client: ${name} reads ${spec.credentials[0]}, its scope entry names ${entry.token}`);
}

function parseCommand(argv) {
  if (!Array.isArray(argv) || !argv.every((a) => typeof a === 'string')) throw new RefusedError('arguments must be a list of strings');
  const command = argv[0];
  if (typeof command !== 'string' || !has(COMMANDS, command)) {
    throw new RefusedError(`unknown command; the commands are: ${Object.keys(COMMANDS).join(', ')}`);
  }
  const def = COMMANDS[command];
  const args = parseArgs(argv, { values: Object.keys(def.flags), booleans: def.kind === 'offline' ? [] : ['execute'] });
  for (const name of def.required || []) {
    if (args[name] === undefined) throw new RefusedError(`${command} needs --${name} (${def.flags[name].says})`);
  }
  for (const [name, rule] of Object.entries(def.flags)) {
    if (args[name] !== undefined && rule.pattern && !rule.pattern.test(args[name])) throw new RefusedError(`--${name} must be ${rule.says}`);
  }
  return { command, def, args };
}

// SLACK_TEAM_ID is a tenant binding, not a credential: it may be read for a dry run.
function teamFromEnv(env) {
  const value = env.SLACK_TEAM_ID;
  if (typeof value !== 'string' || !value.length) throw new RefusedError('SLACK_TEAM_ID must name this deployment\'s Slack workspace (T...) before any read');
  if (!PATTERNS.team.test(value)) throw new RefusedError('SLACK_TEAM_ID must be a Slack workspace ID: T, then capital letters and digits');
  return value;
}

// ── Reads ───────────────────────────────────────────────────────────────────
// Slack answers HTTP 200 with ok: false on an error: a failed read, error code only.
function slackOutcome(res) {
  if (res.state !== STATES.OK) return res;
  const body = res.data;
  if (!isObject(body) || body.ok !== true) {
    const raw = isObject(body) ? body.error : undefined;
    const code = typeof raw === 'string' && PATTERNS.slackError.test(raw) ? raw : 'unknown';
    return {
      state: STATES.HTTP_ERROR,
      ok: false,
      status: res.status,
      attempts: res.attempts,
      slack_error: code,
      error: `Slack answered ok: false with error code ${code}; the rest of the answer is withheld`,
    };
  }
  return res;
}

function invalid(message) {
  return { state: STATES.INVALID_RESPONSE, ok: false, error: message };
}

// A flag always names its path, but it quotes the text only on a field the read exists
// to show: on users.info and users.list the printed state fields; on every other route
// the fields listed in QUOTED_FIELDS (a channel's name, purpose and topic, a message's
// own text, an app's own fields, a login's agent and place). Anything else, such as a
// person's name, a requester, an attachment author or a file title, is withheld: an
// allow-list, so a field Slack adds later is withheld too. Every Slack flag passes
// through here: readSteps and scanAppList.
const PERSON_ROUTES = new Set(['users.info', 'users.list']);
const APP_FIELDS = /^\$\.(?:approved_apps|restricted_apps|app_requests)\[[0-9]+\]\.(?:app\.(?:name|description|help_url|privacy_policy_url|app_homepage_url|app_directory_url|additional_info)|scopes\[[0-9]+\]\.(?:name|description))$/;
const QUOTED_FIELDS = Object.freeze({
  'auth.test': /^\$\.(?:team|url)$/,
  'team.info': /^\$\.team\.(?:name|domain|email_domain|enterprise_name)$/,
  'conversations.info': /^\$\.channel\.(?:name|name_normalized|purpose\.value|topic\.value)$/,
  'conversations.history': /^\$\.messages\[[0-9]+\]\.text$/,
  'admin.apps.approved.list': APP_FIELDS,
  'admin.apps.restricted.list': APP_FIELDS,
  'admin.apps.requests.list': APP_FIELDS,
  'team.accessLogs': /^\$\.logins\[[0-9]+\]\.(?:user_agent|isp|country|region)$/,
});
function withholdPersonal(flags, route) {
  return (flags || []).map((f) => {
    const path = String(f.path);
    const lastKey = path.replace(/\[[0-9]+\]/g, '').split('.').pop();
    const shown = PERSON_ROUTES.has(route)
      ? USER_STATE_FIELDS.includes(lastKey)
      : Boolean(QUOTED_FIELDS[route] && QUOTED_FIELDS[route].test(path));
    return shown ? f : { ...f, quote: '(text withheld: not a field this read shows)' };
  });
}

function withPrefix(flags, route) {
  return (flags || []).map((f) => (route ? { ...f, path: `${route} ${f.path}` } : f));
}

// Runs the steps in order and stops at the first that is not a usable answer. An
// auth.test step must name a team_id (the contract has already refused another one).
async function readSteps(client, steps) {
  const multi = steps.length > 1;
  const flags = [];
  let last = null;
  for (const s of steps) {
    const res = slackOutcome(await client.get(s.route, {}, s.query));
    if (!res.ok) return { failed: res, step: s.route };
    if (s.route === 'auth.test' && typeof res.data.team_id !== 'string') {
      return { failed: invalid('auth.test answered without a team_id, so the workspace is not proven'), step: s.route };
    }
    flags.push(...withPrefix(withholdPersonal(res.flags, s.route), multi ? s.route : null));
    last = res;
  }
  return { last, flags };
}

// A failed read prints its state and a fixed message, never the answer.
function failure(command, outcome) {
  const f = outcome.failed;
  const out = { state: f.state, ok: false, command, step: outcome.step };
  for (const key of ['status', 'attempts', 'slack_error', 'error']) if (f[key] !== undefined) out[key] = f[key];
  return out;
}

async function runRead(command, def, steps, client) {
  const outcome = await readSteps(client, steps);
  if (outcome.failed) return failure(command, outcome);
  const shaped = def.shape(outcome.last.data);
  if (!shaped) return { ...invalid(`${steps[steps.length - 1].route} answered without the expected record`), command };
  return { state: STATES.OK, ok: true, command, status: outcome.last.status, attempts: outcome.last.attempts, ...shaped, flags: outcome.flags };
}

function verdict(command, verified, expected, observed, reason, flags) {
  const res = { state: STATES.OK, ok: true, command, verified, expected, observed };
  if (!verified) res.reason = reason;
  res.flags = flags || [];
  return res;
}

function notProven(command, outcome, expected) {
  return { ...failure(command, outcome), verified: false, expected, observed: {}, reason: 'the read did not complete, so the change is not proven' };
}

function unreadable(command, message, expected) {
  return { ...invalid(message), command, verified: false, expected, observed: {}, reason: 'the answer did not hold the record, so the change is not proven' };
}

const orNull = (record, key) => (has(record, key) ? record[key] : null);

function verifyUser(kind) {
  return async function verify(command, args, ctx, client, steps) {
    const target = args.user;
    let expected;
    if (kind === 'deactivated') expected = { user: target, deleted: true };
    else if (kind === 'reactivated') expected = { user: target, deleted: false };
    else if (args.type === 'single') expected = { user: target, deleted: false, is_ultra_restricted: true };
    else expected = { user: target, deleted: false, is_restricted: true, is_ultra_restricted: false };
    const outcome = await readSteps(client, steps);
    if (outcome.failed) return notProven(command, outcome, expected);
    const u = outcome.last.data.user;
    if (!isObject(u)) return unreadable(command, 'users.info answered without a user record', expected);
    const observed = {
      user: orNull(u, 'id'),
      deleted: orNull(u, 'deleted'),
      is_restricted: orNull(u, 'is_restricted'),
      is_ultra_restricted: orNull(u, 'is_ultra_restricted'),
    };
    const problems = [];
    if (u.id !== target) problems.push('users.info answered for another user');
    if (kind === 'deactivated' && u.deleted !== true) problems.push('deleted is not true: the account is still active');
    if (kind !== 'deactivated' && u.deleted === true) problems.push('deleted is true: the account is deactivated');
    if (kind === 'guest' && args.type === 'single' && u.is_ultra_restricted !== true) problems.push('is_ultra_restricted is not true: not a single-channel guest');
    if (kind === 'guest' && args.type === 'multi') {
      if (u.is_restricted !== true) problems.push('is_restricted is not true: not a guest');
      if (u.is_ultra_restricted === true) problems.push('is_ultra_restricted is true: a single-channel guest, not multi-channel');
    }
    return verdict(command, problems.length === 0, expected, observed, problems.join('; '), outcome.flags);
  };
}

async function verifyArchived(command, args, ctx, client, steps) {
  const expected = { channel: args.channel, is_archived: true };
  const outcome = await readSteps(client, steps);
  if (outcome.failed) return notProven(command, outcome, expected);
  const ch = outcome.last.data.channel;
  if (!isObject(ch)) return unreadable(command, 'conversations.info answered without a channel record', expected);
  const observed = { channel: orNull(ch, 'id'), is_archived: orNull(ch, 'is_archived') };
  const problems = [];
  if (ch.id !== args.channel) problems.push('conversations.info answered for another channel');
  if (ch.is_archived !== true) problems.push('is_archived is not true: the channel is not archived');
  return verdict(command, problems.length === 0, expected, observed, problems.join('; '), outcome.flags);
}

async function verifyPosted(command, args, ctx, client, steps) {
  const want = args['expect-sha256'].toLowerCase();
  const expected = { channel: args.channel, sha256: want, posted_after: new Date(ctx.notBeforeMs).toISOString(), plain_message: true };
  const outcome = await readSteps(client, steps);
  if (outcome.failed) return notProven(command, outcome, expected);
  const body = outcome.last.data;
  if (!Array.isArray(body.messages)) return unreadable(command, 'conversations.history answered without messages', expected);
  const oldest = tsToMicros(ctx.oldest);
  let plainAfter = 0;
  let matched = null;
  for (const m of body.messages) {
    // A person's plain message: no subtype, and no bot_id or app_id (an app posting with
    // a bot token may carry those without a subtype). bot_id and app_id were not in the
    // sources read; skipping them can only turn a pass into "not verified".
    if (!isObject(m) || m.type !== 'message' || has(m, 'subtype') || has(m, 'bot_id') || has(m, 'app_id')) continue;
    const ts = tsToMicros(m.ts);
    if (ts === null || ts <= oldest) continue;
    plainAfter += 1;
    if (matched === null && typeof m.text === 'string' && sha256Hex(normaliseText(m.text)) === want) matched = m.ts;
  }
  const hasMore = body.has_more === true;
  const observed = { channel: args.channel, messages_read: body.messages.length, plain_messages_after_not_before: plainAfter, has_more: hasMore, matched_ts: matched };
  let reason = '';
  if (matched === null) {
    reason = hasMore
      ? `Slack returned ${body.messages.length} messages after --not-before and says more exist (has_more); none of the ${HISTORY_LIMIT} read is a person's plain message (no subtype, bot_id or app_id) with the expected SHA-256, so the read cannot prove the post: use a --not-before closer to the post or confirm it in the channel`
      : 'no message posted after --not-before in this channel without a subtype, bot_id or app_id has the expected SHA-256; an edited or reformatted message does not match, and a message carrying a subtype, bot_id or app_id is skipped';
  }
  return verdict(command, matched !== null, expected, observed, reason, outcome.flags);
}

// Reads one admin.apps list page by page (at most MAX_APP_PAGES) looking for the app.
async function scanAppList(client, route, key, team, appId) {
  const flags = [];
  let cursor = null;
  let pages = 0;
  let found = false;
  let complete = false;
  let note = '';
  for (;;) {
    const query = { team_id: team, limit: APP_PAGE_LIMIT };
    if (cursor) query.cursor = cursor;
    const res = slackOutcome(await client.get(route, {}, query));
    if (!res.ok) return { failed: res, step: route };
    pages += 1;
    flags.push(...withPrefix(withholdPersonal(res.flags, route), route));
    const list = res.data[key];
    if (!Array.isArray(list)) return { failed: invalid(`${route} answered without ${key}`), step: route };
    if (list.some((e) => isObject(e) && isObject(e.app) && e.app.id === appId)) found = true;
    const next = nextCursor(res.data);
    if (!next) { complete = true; break; }
    if (found) break;
    if (pages >= MAX_APP_PAGES) { note = `${route} has more than ${MAX_APP_PAGES} pages`; break; }
    if (!PATTERNS.cursor.test(next)) { note = `${route} returned a next_cursor outside the allowed pattern`; break; }
    cursor = next;
  }
  return { found, complete, pages, flags, note };
}

async function verifyAppApproved(command, args, ctx, client) {
  const appId = args['app-id'];
  const expected = { app_id: appId, in_approved_list: true, in_pending_requests: false };
  const approved = await scanAppList(client, 'admin.apps.approved.list', 'approved_apps', ctx.team, appId);
  if (approved.failed) return notProven(command, approved, expected);
  const requests = await scanAppList(client, 'admin.apps.requests.list', 'app_requests', ctx.team, appId);
  if (requests.failed) return notProven(command, requests, expected);
  const observed = {
    app_id: appId,
    in_approved_list: approved.found,
    approved_pages_read: approved.pages,
    in_pending_requests: requests.found,
    requests_list_complete: requests.complete,
    requests_pages_read: requests.pages,
  };
  const problems = [];
  if (!approved.found) problems.push(`the app is not in admin.apps.approved.list${approved.note ? ` (${approved.note})` : ''}`);
  if (requests.found) problems.push('the app is still in admin.apps.requests.list: the request is pending');
  else if (!requests.complete) problems.push(`admin.apps.requests.list was not read to the end (${requests.note}), so the request is not proven gone`);
  return verdict(command, problems.length === 0, expected, observed, problems.join('; '), [...approved.flags, ...requests.flags]);
}

async function verifyAppRestricted(command, args, ctx, client) {
  const appId = args['app-id'];
  const expected = { app_id: appId, in_restricted_list: true };
  const restricted = await scanAppList(client, 'admin.apps.restricted.list', 'restricted_apps', ctx.team, appId);
  if (restricted.failed) return notProven(command, restricted, expected);
  const observed = { app_id: appId, in_restricted_list: restricted.found, restricted_list_complete: restricted.complete, restricted_pages_read: restricted.pages };
  const reason = restricted.found ? '' : `the app is not in admin.apps.restricted.list${restricted.note ? ` (${restricted.note})` : ''}`;
  return verdict(command, restricted.found, expected, observed, reason, restricted.flags);
}

// ── Offline digest ──────────────────────────────────────────────────────────
function isEnvFile(file) {
  const base = path.basename(file).toLowerCase();
  return base === '.env' || base.startsWith('.env.') || base.endsWith('.env');
}

function digest(args, deps, now) {
  const file = args.file;
  if (!file.trim()) throw new RefusedError('--file needs a path to the saved draft');
  if (isEnvFile(file)) throw new RefusedError('a .env file is never opened');
  const readFile = typeof deps.readFile === 'function' ? deps.readFile : fs.readFileSync;
  let raw;
  try { raw = readFile(file); } catch { throw new RefusedError('--file could not be read as a file'); }
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), 'utf8');
  if (bytes.length > MAX_DRAFT_BYTES) throw new RefusedError('the draft is larger than 1 MB');
  const text = normaliseText(bytes.toString('utf8').replace(/^﻿/, ''));
  if (!text.trim()) throw new RefusedError('the draft is empty');
  const sha = sha256Hex(text);
  const notBefore = new Date(now()).toISOString();
  const line = `node scripts/adapters/slack-client.js verify-posted --channel [CHANNEL_ID] --expect-sha256 ${sha} --not-before ${notBefore} --execute`;
  return {
    result: {
      state: STATES.OK,
      ok: true,
      command: 'digest',
      sha256: sha,
      not_before: notBefore,
      characters: text.length,
      lines: text.split('\n').length,
      verify_posted: line,
      note: 'offline: no credentials read, no network. A person posts the file text unchanged as a plain message; any edit changes the digest.',
      flags: scanUntrusted(text, '$.draft'),
    },
    line,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
async function run(argv, env, deps = {}) {
  const environment = env || process.env;
  const out = typeof deps.out === 'function' ? deps.out : (s) => process.stdout.write(s);
  const err = typeof deps.err === 'function' ? deps.err : (s) => process.stderr.write(s);
  const now = typeof deps.now === 'function' ? deps.now : Date.now;
  const emit = (res, secrets = []) => {
    out(renderResult(res, { secrets, platform: 'slack' }));
    return exitCodeFor(res);
  };
  const refuse = (command, error) => {
    err(`REFUSED: ${error.message}\n`);
    return emit({ state: STATES.REFUSED, ok: false, command: command || null, error: error.message });
  };

  let command = null;
  let def;
  let args;
  const ctx = {};
  let steps;
  let client;
  let cli = null;
  // batch G3 close-out (owner decision 1): --change binds a verify-* read-back to its change
  // record; it is taken out of argv here and checked below, before any read
  const bound = takeChange(argv);
  try {
    ({ command, def, args } = parseCommand(bound.argv));
    // an offline command is not a read-back: --change in either form is refused by the one rule
    const offlineRefusal = def.kind === 'offline' ? changeRefusal('slack', command, bound, null) : null;
    if (offlineRefusal) throw new RefusedError(offlineRefusal);
    if (def.kind === 'offline') {
      const { result, line } = digest(args, deps, now);
      const code = emit(result);
      out(`Run after a person posts the file text unchanged (HUMAN-RUN read-back):\n${line}\n`);
      return code;
    }
    if (def.team) ctx.team = teamFromEnv(environment);
    if (args['not-before'] !== undefined) {
      ctx.notBeforeMs = parseNotBefore(args['not-before'], now());
      ctx.oldest = oldestFromMs(ctx.notBeforeMs);
    }
    steps = def.steps(args, ctx);
    // batch G3: the audit sink (and the test seams) come from cliDeps
    cli = cliDeps(deps, environment);
    const refusal = changeRefusal('slack', command, bound, cli.audit);
    if (refusal) throw new RefusedError(refusal);
    client = createClient(def.spec || SPEC, { env: environment, ...cli });
    const planned = steps.map((s) => client.plan(s.route, {}, s.query));
    const refusedPlan = planned.find((p) => p.state !== STATES.OK);
    if (refusedPlan) throw new RefusedError(refusedPlan.error);
    if (!args.execute) {
      const dry = {
        state: STATES.OK,
        ok: true,
        command,
        dry_run: true,
        requests: planned.map((p) => ({ method: p.method, host: p.host, path: p.path })),
        note: 'dry run: no credentials read, no network. Add the bare --execute flag to perform the read.',
      };
      if (def.pagination) dry.pagination = def.pagination;
      const code = emit(dry);
      return code === EXIT.OK ? dryRunExit(command, err) : code;
    }
    teamFromEnv(environment); // the workspace binding comes before any read
  } catch (error) {
    if (error instanceof RefusedError) return refuse(command, error);
    throw error;
  }

  const res = def.kind === 'verify'
    ? recordVerdict(cli.audit, 'slack', await def.verify(command, args, ctx, client, steps), bound.change, null, bound.argv)
    : await runRead(command, def, steps, client);
  // Only the variable this command's spec names is read, and only after the request
  // was allowed; that value is redacted from everything printed.
  const token = res.state === STATES.REFUSED ? undefined : environment[(def.spec || SPEC).credentials[0]];
  return emit(res, typeof token === 'string' && token.length ? [token] : []);
}

module.exports = { SPEC, ACCESS_LOGS_SPEC, COMMANDS, SCOPES, run, REFUSED_METHODS, normaliseText };

if (require.main === module) {
  run(process.argv.slice(2), process.env).then(
    (code) => { process.exitCode = code; },
    (error) => {
      const tripwire = error && error.message === TRIPWIRE_MESSAGE;
      process.stderr.write(`${tripwire ? TRIPWIRE_MESSAGE : 'slack-client: unexpected error (details withheld)'}\n`);
      process.exitCode = 2;
    },
  );
}
