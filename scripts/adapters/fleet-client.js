'use strict';
// fleet-client.js: the read-only Fleet adapter (lane G2), built on the shared
// contract in readonly-contract.js. Tests: fleet-client.test.js. Allow-list and
// sources: the Fleet section of docs/aegis/lanes/g2.md.
//
// Aegis advises; humans execute (PRODUCT_CONTRACT.md). This CLI reads a Fleet
// server and never writes to it. Lock, unlock, wipe, run a script, turn off MDM
// and delete a host are HUMAN-RUN steps in a runbook; the verify-* commands here
// prove them afterwards with reads.
//
//   node scripts/adapters/fleet-client.js <command> [flags] [--execute]
//   node scripts/adapters/fleet-client.js help
//
// Environment: FLEET_URL (the Fleet server's bare hostname, no scheme or path) and
// FLEET_API_TOKEN (an API-only user's token, sent as "Authorization: Bearer").
// There is no token exchange: Fleet's POST /api/v1/fleet/login is a password
// login and is refused. There is no tenant variable: one Fleet server serves one
// tenant, so the configured host is the binding.
//
// Dry run by default: without the bare --execute flag the CLI prints the exact
// request(s) it would send (method, host, path), reads no credential and opens no
// connection. Exit codes (shared by every adapter): 0 read or verified; 1 refused
// input or missing credentials; 2 the read failed or a verify-* read did not
// prove the write; 3 a record from another tenant (never raised here, see above).
//
// Vendor facts come from Fleet's own docs source (fleetdm/fleet on GitHub, read
// 2026-10-27): the REST API reference, the lock and wipe guide, the enroll guide
// and the audit-log activity list. fleetdm.com itself could not be opened from the
// session that wrote this file.

const {
  STATES, RefusedError, defineAdapter, createClient, renderResult, exitCodeFor, parseArgs, scanUntrusted, realCalendarTime,
} = require('./readonly-contract.js');
const { cliDeps, recordVerdict } = require('./cli-support.js');

// ── Validators ───────────────────────────────────────────────────────────────
const ID = /^[1-9][0-9]{0,9}$/; // host, policy, fleet, report and software title ids
const PAGE = /^(?:0|[1-9][0-9]{0,4})$/; // Fleet pages start at 0
const PER_PAGE = /^(?:[1-9][0-9]{0,2}|1000)$/; // 1 to 1000
const IDENTIFIER = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/; // serial, UUID or hostname
const CVE = /^CVE-[0-9]{4}-[0-9]{4,7}$/; // the path always carries the upper-case form
// The CLI also takes the lower-case form Fleet's own examples use (cve-...). Without
// the u flag, i never folds a non-ASCII letter into an ASCII one, so a look-alike
// character is still refused.
const CVE_ANY_CASE = /^cve-[0-9]{4}-[0-9]{4,7}$/i;
const EXECUTION_ID = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?$/;
const HOST_STATUS = /^(?:new|online|offline|mia|missing)$/;
const POLICY_RESPONSE = /^(?:passing|failing)$/;
const COMMAND_STATUS = /^(?:ran|pending|failed)$/; // the documented command_status values
const REQUEST_TYPE = /^[A-Za-z0-9./_-]{1,200}$/; // Apple names (EraseDevice) and Windows LocURIs
const TRUE_ONLY = /^true$/;
const TIMESTAMP = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:\.[0-9]{1,9})?)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;

const NEWEST_FIRST = Object.freeze({ order_key: 'created_at', order_direction: 'desc' });

// ── The allow-list: exactly the reads in the lane spec's Fleet table ─────────
// Route order matters for raw paths: hosts/identifier/:identifier is matched
// before hosts/:id/mdm and the other six-segment host routes.
const SPEC = defineAdapter({
  platform: 'fleet',
  host: { env: 'FLEET_URL' },
  credentials: ['FLEET_API_TOKEN'],
  auth: (creds) => ({ Authorization: `Bearer ${creds.FLEET_API_TOKEN}` }),
  routes: {
    me: { method: 'GET', path: '/api/v1/fleet/me' },
    version: { method: 'GET', path: '/api/v1/fleet/version' },
    // exclude_software=true: Fleet's own load guidance for host reads.
    hostByIdentifier: { method: 'GET', path: '/api/v1/fleet/hosts/identifier/:identifier', params: { identifier: IDENTIFIER }, fixedQuery: { exclude_software: 'true' } },
    host: { method: 'GET', path: '/api/v1/fleet/hosts/:id', params: { id: ID }, fixedQuery: { exclude_software: 'true' } },
    hosts: {
      method: 'GET',
      path: '/api/v1/fleet/hosts',
      query: { status: HOST_STATUS, policy_id: ID, policy_response: POLICY_RESPONSE, software_title_id: ID, page: PAGE, per_page: PER_PAGE },
    },
    hostMdm: { method: 'GET', path: '/api/v1/fleet/hosts/:id/mdm', params: { id: ID } },
    hostSoftware: { method: 'GET', path: '/api/v1/fleet/hosts/:id/software', params: { id: ID }, query: { vulnerable: TRUE_ONLY, page: PAGE, per_page: PER_PAGE } },
    hostActivities: { method: 'GET', path: '/api/v1/fleet/hosts/:id/activities', params: { id: ID }, fixedQuery: NEWEST_FIRST, query: { page: PAGE, per_page: PER_PAGE } },
    // Queued work on one host (an Observer read): the only read that names a queued
    // script's execution id before it runs, which the cancel gate needs. The vendor
    // reference documents it with the per-host activity reads and their paging; it
    // gives no order parameters for it, so none is sent.
    hostUpcoming: { method: 'GET', path: '/api/v1/fleet/hosts/:id/activities/upcoming', params: { id: ID }, query: { page: PAGE, per_page: PER_PAGE } },
    globalPolicies: { method: 'GET', path: '/api/v1/fleet/global/policies' },
    fleetPolicies: { method: 'GET', path: '/api/v1/fleet/fleets/:id/policies', params: { id: ID } },
    softwareTitles: { method: 'GET', path: '/api/v1/fleet/software/titles', query: { vulnerable: TRUE_ONLY, fleet_id: ID, page: PAGE, per_page: PER_PAGE } },
    vulnerability: { method: 'GET', path: '/api/v1/fleet/vulnerabilities/:cve', params: { cve: CVE } },
    scriptResult: { method: 'GET', path: '/api/v1/fleet/scripts/results/:executionId', params: { executionId: EXECUTION_ID } },
    // Fleet's default page is 10 commands: the commands read pages with --page and
    // --per-page, and verify-wipe on Windows asks for 100.
    mdmCommands: { method: 'GET', path: '/api/v1/fleet/commands', query: { host_identifier: IDENTIFIER, request_type: REQUEST_TYPE, command_status: COMMAND_STATUS, page: PAGE, per_page: PER_PAGE } },
    activities: { method: 'GET', path: '/api/v1/fleet/activities', fixedQuery: NEWEST_FIRST, query: { page: PAGE, per_page: PER_PAGE } },
    reportResults: { method: 'GET', path: '/api/v1/fleet/reports/:id/report', params: { id: ID } },
  },
  // batch G3: the scope preflight reads the API user's roles from /me first (Fleet REST API,
  // fleetdm/fleet docs, read 2026-10-28); only the observer role passes, globally or per
  // team (Fleet calls teams fleets too). observer_plus can run live reports on hosts, and
  // maintainer, admin, technician and gitops can change hosts, so each is refused.
  scopes: {
    manifest: 'fleet', kind: 'route', vendor: 'Fleet', route: 'me',
    granted: (body) => {
      const user = body && body.user;
      if (!user || typeof user !== 'object') return null;
      const roles = new Set();
      if (typeof user.global_role === 'string' && user.global_role) roles.add(`global:${user.global_role}`);
      for (const list of [user.teams, user.fleets]) for (const t of Array.isArray(list) ? list : []) if (t && typeof t.role === 'string') roles.add(`team:${t.role}`);
      return [...roles];
    },
    allowed: (role) => role === 'global:observer' || role === 'team:observer',
  },
});

// ── Small helpers ────────────────────────────────────────────────────────────
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const field = (obj, key) => (isObject(obj) && has(obj, key) && obj[key] !== undefined ? obj[key] : null);

function requireFlags(args, names) {
  for (const name of names) if (!has(args, name)) throw new RefusedError(`--${name} is required`);
}

function exactlyOne(args, a, b) {
  if (has(args, a) === has(args, b)) throw new RefusedError(`give exactly one of --${a} or --${b}`);
}

function together(args, a, b) {
  if (has(args, a) !== has(args, b)) throw new RefusedError(`--${a} and --${b} go together`);
}

// Build a query object in a fixed order from CLI flags: [flag, query key] pairs.
function queryFrom(args, pairs) {
  const query = {};
  for (const [flag, key] of pairs) {
    if (!has(args, flag)) continue;
    query[key] = args[flag] === true ? 'true' : args[flag];
  }
  return query;
}

const PAGING = [['page', 'page'], ['per-page', 'per_page']];

// Fleet's activity reads return up to 10,000 records when page and per_page are left
// out (vendor docs), which can pass the contract's 5 MB response limit on a busy host
// or server. host-activities, host-upcoming and activities therefore always send both:
// page 0 of 100 unless --page or --per-page says otherwise.
const ACTIVITY_PAGE = Object.freeze({ page: '0', per_page: '100' });
function activityPage(args) {
  return {
    page: has(args, 'page') ? args.page : ACTIVITY_PAGE.page,
    per_page: has(args, 'per-page') ? args['per-page'] : ACTIVITY_PAGE.per_page,
  };
}

// ── Read commands: one request each ──────────────────────────────────────────
const READS = {
  me: { summary: 'the adapter token\'s own user and role (an API-only Observer is expected); it is not the operator\'s role', usage: '', request: () => ['me'] },
  version: { summary: 'the Fleet server version', usage: '', request: () => ['version'] },
  host: {
    summary: 'one host: status, seen_time, disk encryption, mdm.device_status, mdm.pending_action, failing policies',
    usage: '--id [HOST_ID] | --identifier [SERIAL_NUMBER]',
    values: ['id', 'identifier'],
    check: (a) => exactlyOne(a, 'id', 'identifier'),
    request: (a) => (has(a, 'id') ? ['host', { id: a.id }] : ['hostByIdentifier', { identifier: a.identifier }]),
  },
  hosts: {
    summary: 'hosts by status, by one policy\'s result or by software title',
    usage: '[--status online|offline|mia|missing|new] [--policy-id N --policy-response passing|failing] [--software-title-id N] [--page N --per-page N]',
    values: ['status', 'policy-id', 'policy-response', 'software-title-id', 'page', 'per-page'],
    check: (a) => together(a, 'policy-id', 'policy-response'),
    request: (a) => ['hosts', {}, queryFrom(a, [['status', 'status'], ['policy-id', 'policy_id'], ['policy-response', 'policy_response'], ['software-title-id', 'software_title_id'], ...PAGING])],
  },
  'host-mdm': { summary: 'one host\'s MDM enrollment', usage: '--id [HOST_ID]', values: ['id'], required: ['id'], request: (a) => ['hostMdm', { id: a.id }] },
  'host-software': {
    summary: 'software on one host, optionally only vulnerable software',
    usage: '--id [HOST_ID] [--vulnerable] [--page N --per-page N]',
    values: ['id', 'page', 'per-page'],
    booleans: ['vulnerable'],
    required: ['id'],
    request: (a) => ['hostSoftware', { id: a.id }, queryFrom(a, [['vulnerable', 'vulnerable'], ...PAGING])],
  },
  'host-activities': {
    summary: 'one host\'s activity feed, newest first (script execution ids); 100 per page unless --per-page says otherwise',
    usage: '--id [HOST_ID] [--page N --per-page N]',
    values: ['id', 'page', 'per-page'],
    required: ['id'],
    request: (a) => ['hostActivities', { id: a.id }, activityPage(a)],
  },
  'host-upcoming': {
    summary: 'one host\'s upcoming (queued) activities, such as a queued script and its execution id, read before and after a cancel; 100 per page unless --per-page says otherwise',
    usage: '--id [HOST_ID] [--page N --per-page N]',
    values: ['id', 'page', 'per-page'],
    required: ['id'],
    request: (a) => ['hostUpcoming', { id: a.id }, activityPage(a)],
  },
  policies: {
    summary: 'global policies, or one fleet\'s policies, with failing counts',
    usage: '[--fleet-id N]',
    values: ['fleet-id'],
    request: (a) => (has(a, 'fleet-id') ? ['fleetPolicies', { id: a['fleet-id'] }] : ['globalPolicies']),
  },
  software: {
    summary: 'software titles, optionally only vulnerable ones, optionally for one fleet',
    usage: '[--vulnerable] [--fleet-id N] [--page N --per-page N]',
    values: ['fleet-id', 'page', 'per-page'],
    booleans: ['vulnerable'],
    request: (a) => ['softwareTitles', {}, queryFrom(a, [['vulnerable', 'vulnerable'], ['fleet-id', 'fleet_id'], ...PAGING])],
  },
  vulnerability: {
    summary: 'one CVE and the hosts it affects (HTTP 204: Fleet knows the CVE and nothing is affected)',
    usage: '--cve [CVE_ID] (CVE-... or cve-...)',
    values: ['cve'],
    required: ['cve'],
    request: (a) => ['vulnerability', { cve: CVE_ANY_CASE.test(a.cve) ? a.cve.toUpperCase() : a.cve }],
    // Fleet answers 204 with no body when it knows the CVE and no host or
    // software is affected. The contract reads an empty body as not JSON.
    shape: (res) => (res.state === STATES.INVALID_RESPONSE && res.status === 204
      ? { state: STATES.OK, ok: true, status: 204, attempts: res.attempts, data: null, flags: [], note: 'HTTP 204: Fleet knows this CVE and nothing is affected' }
      : res),
  },
  'script-result': { summary: 'one script run: exit_code and output', usage: '--execution-id [EXECUTION_ID]', values: ['execution-id'], required: ['execution-id'], request: (a) => ['scriptResult', { executionId: a['execution-id'] }] },
  commands: {
    summary: 'MDM commands sent to one host and their status',
    usage: '--host-identifier [SERIAL_NUMBER] [--request-type T] [--command-status ran|pending|failed] [--page N --per-page N]',
    values: ['host-identifier', 'request-type', 'command-status', 'page', 'per-page'],
    required: ['host-identifier'],
    request: (a) => ['mdmCommands', {}, queryFrom(a, [['host-identifier', 'host_identifier'], ['request-type', 'request_type'], ['command-status', 'command_status'], ...PAGING])],
  },
  activities: {
    summary: 'the activity feed (audit trail), newest first; 100 per page unless --per-page says otherwise',
    usage: '[--page N --per-page N]',
    values: ['page', 'per-page'],
    request: (a) => ['activities', {}, activityPage(a)],
  },
  'report-results': { summary: 'one stored osquery report\'s rows', usage: '--id N', values: ['id'], required: ['id'], request: (a) => ['reportResults', { id: a.id }] },
};

// ── verify-* read-backs ──────────────────────────────────────────────────────
const APPLE = new Set(['darwin', 'ios', 'ipados']);
const DELETED_PAGES = 10;
const DELETED_PER_PAGE = '100';

function hostOf(data) {
  return isObject(data) && isObject(data.host) ? data.host : {};
}

function mdmOf(host) {
  return isObject(host.mdm) ? host.mdm : {};
}

// The newest entry by updated_at; ties and missing times keep the vendor's order.
function newest(list) {
  const time = (c) => { const t = Date.parse(field(c, 'updated_at')); return Number.isFinite(t) ? t : -Infinity; };
  return list.map((c, i) => [c, i]).sort((x, y) => (time(y[0]) - time(x[0])) || (x[1] - y[1])).map(([c]) => c)[0] || null;
}

function commandView(c) {
  return c ? { command_uuid: field(c, 'command_uuid'), request_type: field(c, 'request_type'), status: field(c, 'status'), updated_at: field(c, 'updated_at') } : null;
}

// device_status and pending_action from GET /hosts/:id decide lock and unlock.
function deviceStatusVerify(wantStatus) {
  return async (read, args) => {
    const r = await read('host', { id: args.id });
    if (!r.ok) return { failed: r };
    const host = hostOf(r.data);
    const mdm = mdmOf(host);
    const observed = {
      'host.id': field(host, 'id'),
      'host.platform': field(host, 'platform'),
      'host.mdm.device_status': field(mdm, 'device_status'),
      'host.mdm.pending_action': field(mdm, 'pending_action'),
    };
    const expected = { 'host.id': [Number(args.id)], 'host.mdm.device_status': [wantStatus], 'host.mdm.pending_action': [''] };
    const verified = Object.keys(expected).every((k) => expected[k].includes(observed[k]));
    const notes = [];
    if (observed['host.platform'] === 'android') {
      notes.push(wantStatus === 'locked'
        ? 'verify-lock cannot pass for an Android host: Fleet never shows Locked there (vendor docs). Prove the request with the locked_host entry in host-activities, and confirm the lock on the device.'
        : 'Fleet never shows Locked for Android hosts (vendor docs): confirm on the device.');
    }
    if (wantStatus === 'unlocked' && APPLE.has(observed['host.platform'])) notes.push('A Mac unlocks only after the PIN is typed on it, and an Apple host unlocked within 1 minute of locking shows Locked until its next check-in (vendor guide).');
    return { verified, observed, expected, note: notes.join(' ') || undefined };
  };
}

async function verifyWipe(read, args) {
  const r = await read('host', { id: args.id });
  if (!r.ok) return { failed: r };
  const host = hostOf(r.data);
  const mdm = mdmOf(host);
  const platform = field(host, 'platform');
  const observed = { 'host.id': field(host, 'id'), 'host.platform': platform, 'host.mdm.device_status': field(mdm, 'device_status'), 'host.mdm.pending_action': field(mdm, 'pending_action') };
  const apple = APPLE.has(platform);
  const windows = platform === 'windows';
  const expected = {
    'host.id': [Number(args.id)],
    'host.mdm.device_status': ['wiping', 'wiped'],
    'wipe command': apple
      ? { request_type: 'EraseDevice', status: ['Acknowledged'] }
      : { request_type: 'a Windows RemoteWipe doWipe command (doWipe, doWipeProtected and similar)', status: ['200'] },
  };
  const statusOk = expected['host.id'].includes(observed['host.id']) && expected['host.mdm.device_status'].includes(observed['host.mdm.device_status']);
  if (!apple && !windows) {
    const how = platform === 'android'
      ? 'A company-owned Android wipe is not an EraseDevice or doWipe command, so prove it with mdm.device_status (wiping, then wiped) in host --id and the wiped_host entry in host-activities.'
      : 'Fleet wipes a Linux host with a script and shows no Wipe badge for it, so prove that wipe with verify-script --execution-id [EXECUTION_ID] (the id is in host-activities).';
    return {
      verified: false,
      observed,
      expected,
      note: `This read proves Apple (EraseDevice) and Windows (doWipe) wipes only. ${how} Platform read: ${JSON.stringify(platform)}.`,
    };
  }
  const serial = field(host, 'hardware_serial');
  const uuid = field(host, 'uuid');
  const identifier = [serial, uuid].find((v) => typeof v === 'string' && IDENTIFIER.test(v)) || null;
  observed['commands host_identifier'] = identifier;
  if (!identifier) {
    observed['wipe command'] = null;
    return { verified: false, observed, expected, note: 'The host record has no serial or UUID usable as a host_identifier, so its wipe command cannot be read.' };
  }
  const query = apple ? { host_identifier: identifier, request_type: 'EraseDevice' } : { host_identifier: identifier, per_page: '100' };
  const c = await read('mdmCommands', {}, query);
  if (!c.ok) return { failed: c, observed };
  const list = isObject(c.data) && Array.isArray(c.data.results) ? c.data.results.filter(isObject) : [];
  const matching = apple
    ? list.filter((x) => x.request_type === 'EraseDevice')
    : list.filter((x) => typeof x.request_type === 'string' && /doWipe/.test(x.request_type));
  const command = newest(matching);
  observed['wipe command'] = commandView(command);
  const commandOk = command !== null && (apple ? command.status === 'Acknowledged' : String(command.status) === '200');
  const note = windows ? 'Windows command status is an OMA-DM code (vendor docs); the doWipe request_type shape is read from the vendor\'s wipe options and is unverified, so only a doWipe command with status 200 counts.' : undefined;
  return { verified: statusOk && commandOk, observed, expected, note };
}

async function verifyScript(read, args) {
  const r = await read('scriptResult', { executionId: args['execution-id'] });
  if (!r.ok) return { failed: r };
  const d = isObject(r.data) ? r.data : {};
  const observed = {
    execution_id: field(d, 'execution_id'),
    host_id: field(d, 'host_id'),
    exit_code: field(d, 'exit_code'),
    host_timeout: field(d, 'host_timeout'),
    output: field(d, 'output'),
    message: field(d, 'message'),
  };
  const expected = { execution_id: [args['execution-id']], exit_code: [0], host_timeout: [false] };
  // An execution_id that is present must be the one asked for.
  const idOk = observed.execution_id === null || observed.execution_id === args['execution-id'];
  const verified = idOk && observed.exit_code === 0 && observed.host_timeout === false;
  const note = observed.exit_code === null ? 'exit_code null: the host has not reported the result yet (vendor docs).' : undefined;
  return { verified, observed, expected, note };
}

async function verifyMdmOff(read, args) {
  const m = await read('hostMdm', { id: args.id });
  // Fleet answers null for a host with no MDM enrollment; HTTP 204 counts as empty too.
  const empty = (m.ok && m.data === null) || (m.state === STATES.INVALID_RESPONSE && m.status === 204);
  if (!m.ok && !empty) return { failed: m };
  const r = await read('host', { id: args.id });
  if (!r.ok) return { failed: r };
  const host = hostOf(r.data);
  const enrollment = field(mdmOf(host), 'enrollment_status');
  const observed = {
    'GET /hosts/:id/mdm': empty ? null : (m.data === undefined ? null : m.data),
    'GET /hosts/:id/mdm status': m.status === undefined ? null : m.status,
    'host.id': field(host, 'id'),
    'host.mdm.enrollment_status': enrollment,
  };
  const expected = { 'GET /hosts/:id/mdm': [null], 'host.id': [Number(args.id)], 'host.mdm.enrollment_status': ['Off', '', null] };
  const verified = empty && expected['host.id'].includes(observed['host.id']) && expected['host.mdm.enrollment_status'].includes(enrollment);
  return { verified, observed, expected, note: 'Pending and every "On (...)" enrollment status count as still enrolled.' };
}

function activityView(a) {
  const d = isObject(a.details) ? a.details : {};
  return { id: field(a, 'id'), type: field(a, 'type'), created_at: field(a, 'created_at'), details: { host_id: field(d, 'host_id'), host_serial: field(d, 'host_serial'), triggered_by: field(d, 'triggered_by') } };
}

async function verifyDeleted(read, args) {
  const identifier = args.identifier;
  const notBefore = Date.parse(args['not-before']);
  let manual = null;
  let other = null;
  let pages = 0;
  let reachedNotBefore = false;
  // Activities come newest first (order_key=created_at, order_direction=desc), so
  // the search stops at the first activity older than --not-before.
  while (pages < DELETED_PAGES && !manual && !reachedNotBefore) {
    const r = await read('activities', {}, { page: String(pages), per_page: DELETED_PER_PAGE });
    pages += 1;
    if (!r.ok) return { failed: r };
    const list = isObject(r.data) && Array.isArray(r.data.activities) ? r.data.activities.filter(isObject) : [];
    for (const a of list) {
      const t = Date.parse(field(a, 'created_at'));
      if (!Number.isFinite(t)) continue;
      if (t < notBefore) { reachedNotBefore = true; break; }
      const d = isObject(a.details) ? a.details : {};
      if (a.type !== 'deleted_host' || d.host_serial !== identifier) continue;
      if (d.triggered_by === 'manual') { manual = a; break; }
      if (!other) other = a;
    }
    const more = isObject(r.data) && isObject(r.data.meta) && r.data.meta.has_next_results === true;
    if (!more) break;
  }
  const found = manual || other;
  const observed = { 'deleted_host activity': found ? activityView(found) : null, 'activity pages read': pages };
  const expected = {
    'deleted_host activity': { type: 'deleted_host', 'details.host_serial': identifier, 'details.triggered_by': 'manual', created_at: `at or after ${args['not-before']}` },
    'host lookup by identifier': 'HTTP 404 (not found), or a host id other than the deleted one (the device re-enrolled)',
  };
  if (!manual) {
    const why = other ? 'the deleted_host activity for this serial was not a manual deletion' : `no deleted_host activity for this serial at or after --not-before in the ${pages} newest page(s) read (at most ${DELETED_PAGES} of ${DELETED_PER_PAGE})`;
    return { verified: false, observed, expected, note: why };
  }
  const deletedId = isObject(manual.details) ? field(manual.details, 'host_id') : null;
  const h = await read('hostByIdentifier', { identifier });
  if (h.state === STATES.HTTP_ERROR && h.status === 404) {
    observed['host lookup by identifier'] = 'HTTP 404 (not found)';
    return { verified: true, observed, expected };
  }
  if (!h.ok) return { failed: h, observed };
  const nowId = field(hostOf(h.data), 'id');
  observed['host lookup by identifier'] = { 'host.id': nowId };
  const reenrolled = deletedId !== null && nowId !== null && nowId !== deletedId;
  return {
    verified: reenrolled,
    observed,
    expected,
    note: reenrolled ? 'The serial now resolves to a new host id: the device re-enrolled after the deletion.' : 'The serial still resolves to the deleted host id (or the ids cannot be compared).',
  };
}

// batch G3 (task 5d): the MDM check-in read-back. last_mdm_checked_in_at and
// mdm.enrollment_status come from GET /hosts/:id (vendor facts F-07, F-08).
async function verifyCheckedIn(read, args) {
  const r = await read('host', { id: args.id });
  if (!r.ok) return { failed: r };
  const host = hostOf(r.data);
  const mdm = mdmOf(host);
  const observed = {
    'host.id': field(host, 'id'),
    'host.platform': field(host, 'platform'),
    'host.status': field(host, 'status'),
    'host.seen_time': field(host, 'seen_time'),
    'host.last_mdm_checked_in_at': field(host, 'last_mdm_checked_in_at'),
    'host.mdm.enrollment_status': field(mdm, 'enrollment_status'),
  };
  const expected = { 'host.id': Number(args.id), 'host.mdm.enrollment_status': 'On (...)', 'host.last_mdm_checked_in_at': `at or after ${args['not-before']}` };
  const enrolled = typeof observed['host.mdm.enrollment_status'] === 'string' && /^On\b/.test(observed['host.mdm.enrollment_status']);
  const checkedIn = Date.parse(observed['host.last_mdm_checked_in_at']);
  if (observed['host.id'] !== Number(args.id)) return { verified: false, observed, expected, note: 'the response is not the host asked for' };
  if (!enrolled) return { verified: false, observed, expected, note: 'the host is not enrolled in MDM, so it has no MDM check-in: read host.seen_time and host.status for the agent instead' };
  const verified = Number.isFinite(checkedIn) && checkedIn >= Date.parse(args['not-before']);
  return { verified, observed, expected, note: verified ? undefined : `the last MDM check-in is not at or after ${args['not-before']}; ask the person to open the device and check in, then read again` };
}

const VERIFIES = {
  'verify-lock': {
    summary: 'prove a human lock: mdm.device_status is locked and nothing is pending',
    usage: '--id [HOST_ID]',
    values: ['id'],
    required: ['id'],
    requests: (a) => [['host', { id: a.id }]],
    verify: deviceStatusVerify('locked'),
  },
  'verify-unlock': {
    summary: 'prove a human unlock: mdm.device_status is unlocked and nothing is pending',
    usage: '--id [HOST_ID]',
    values: ['id'],
    required: ['id'],
    requests: (a) => [['host', { id: a.id }]],
    verify: deviceStatusVerify('unlocked'),
  },
  'verify-wipe': {
    summary: 'prove a human wipe: wiping or wiped, and the EraseDevice (Apple) or doWipe (Windows) command acknowledged',
    usage: '--id [HOST_ID]',
    values: ['id'],
    required: ['id'],
    requests: (a) => [['host', { id: a.id }]],
    then: 'then GET /api/v1/fleet/commands?host_identifier=<the host\'s serial>&request_type=EraseDevice (Apple) or &per_page=100 (Windows); Android needs host --id and host-activities, Linux needs verify-script',
    verify: verifyWipe,
  },
  'verify-script': {
    summary: 'prove a human script run: exit_code 0 and no timeout for one execution id',
    usage: '--execution-id [EXECUTION_ID]',
    values: ['execution-id'],
    required: ['execution-id'],
    requests: (a) => [['scriptResult', { executionId: a['execution-id'] }]],
    verify: verifyScript,
  },
  'verify-mdm-off': {
    summary: 'prove a human turned off MDM: the host MDM read is empty and enrollment no longer reads On',
    usage: '--id [HOST_ID]',
    values: ['id'],
    required: ['id'],
    requests: (a) => [['hostMdm', { id: a.id }], ['host', { id: a.id }]],
    verify: verifyMdmOff,
  },
  'verify-checked-in': {
    summary: 'prove a device checked in: MDM enrollment On and last_mdm_checked_in_at at or after --not-before',
    usage: '--id [HOST_ID] --not-before [NOT_BEFORE]',
    values: ['id', 'not-before'],
    required: ['id', 'not-before'],
    check: (a, now) => {
      if (!TIMESTAMP.test(a['not-before'])) throw new RefusedError('--not-before must be an ISO 8601 time with a zone, for example 2026-10-27T09:00:00Z');
      if (!realCalendarTime(a['not-before'])) throw new RefusedError('--not-before is not a real date and time');
      if (Date.parse(a['not-before']) > now()) throw new RefusedError('--not-before is in the future');
    },
    requests: (a) => [['host', { id: a.id }]],
    verify: verifyCheckedIn,
  },
  'verify-deleted': {
    summary: 'prove a human host deletion: a manual deleted_host activity for the serial after --not-before, and the serial no longer resolves to that host',
    usage: '--identifier [SERIAL_NUMBER] --not-before [NOT_BEFORE]',
    values: ['identifier', 'not-before'],
    required: ['identifier', 'not-before'],
    check: (a, now) => {
      if (!TIMESTAMP.test(a['not-before'])) throw new RefusedError('--not-before must be an ISO 8601 time with a zone, for example 2026-10-27T09:00:00Z');
      if (!realCalendarTime(a['not-before'])) throw new RefusedError('--not-before is not a real date and time');
      if (Date.parse(a['not-before']) > now()) throw new RefusedError('--not-before is in the future');
    },
    requests: (a) => [['activities', {}, { page: '0', per_page: DELETED_PER_PAGE }], ['hostByIdentifier', { identifier: a.identifier }]],
    then: 'more activity pages (newest first, at most 10 of 100) until an activity older than --not-before; the identifier lookup runs only after a manual deleted_host activity is found',
    verify: verifyDeleted,
  },
};

// ── CLI ──────────────────────────────────────────────────────────────────────
const DRY_RUN_NOTE = 'dry run: no credentials read, no network. Add the bare --execute flag to perform the read.';

function helpText() {
  const lines = [
    'fleet-client.js: read-only Fleet adapter (lane G2). Aegis advises; humans execute.',
    '',
    'Usage: node scripts/adapters/fleet-client.js <command> [flags] [--execute]',
    'Environment: FLEET_URL (bare hostname), FLEET_API_TOKEN (API-only user token, sent as Bearer).',
    'Without --execute every command prints the exact request(s) it would send and reads no credential.',
    '',
    'Reads:',
  ];
  for (const [name, c] of Object.entries(READS)) lines.push(`  ${name} ${c.usage}`.trimEnd(), `      ${c.summary}`);
  lines.push('', 'Read-backs (exit 0 verified, 2 not verified):');
  for (const [name, c] of Object.entries(VERIFIES)) lines.push(`  ${name} ${c.usage}`, `      ${c.summary}`);
  lines.push(
    '',
    'Writes are not commands here. Lock, unlock, wipe, run a script, turn off MDM, delete a host,',
    'transfer, live reports and the secret reads (disk encryption key, Recovery Lock password,',
    'managed account password) are refused; each write is a HUMAN-RUN step in a runbook, proved',
    'afterwards with a verify-* read.',
    'Exit codes: 0 read or verified; 1 refused input or missing credentials; 2 read failed or not verified.',
  );
  return `${lines.join('\n')}\n`;
}

function emit(output, { out, err, secrets = [] }) {
  const code = exitCodeFor(output);
  (code === 1 ? err : out)(renderResult(output, { secrets, platform: 'fleet' }));
  return code;
}

async function run(argv, env = process.env, deps = {}) {
  const out = deps.out || ((s) => process.stdout.write(s));
  const err = deps.err || ((s) => process.stderr.write(s));
  const list = Array.isArray(argv) ? argv.map(String) : [];
  const name = list[0];
  if (name === 'help' || name === '--help') { out(helpText()); return 0; }

  const isRead = typeof name === 'string' && has(READS, name);
  const isVerify = typeof name === 'string' && has(VERIFIES, name);
  if (!isRead && !isVerify) {
    const shown = typeof name === 'string' ? name.slice(0, 40) : null;
    return emit({ command: shown, state: STATES.REFUSED, ok: false, error: 'not a read command of this adapter. Every Fleet write is a HUMAN-RUN step in a runbook; run "help" for the read and verify-* commands.' }, { out, err });
  }
  const command = isRead ? READS[name] : VERIFIES[name];
  const now = deps.now || Date.now;

  let args;
  let requests;
  try {
    args = parseArgs(list, { values: command.values || [], booleans: ['execute', ...(command.booleans || [])] });
    requireFlags(args, command.required || []);
    if (command.check) command.check(args, now);
    requests = isRead ? [command.request(args)] : command.requests(args);
  } catch (error) {
    if (!(error instanceof RefusedError)) throw error;
    return emit({ command: name, state: STATES.REFUSED, ok: false, error: error.message }, { out, err });
  }

  // batch G3: the audit sink (and the test seams) come from cliDeps
  const cli = cliDeps(deps, env);
  const client = createClient(SPEC, { env, ...cli });

  // Every request known before the read is checked here, with no credential read.
  const planned = [];
  for (const [route, params = {}, query = {}] of requests) {
    const p = client.plan(route, params, query);
    if (!p.ok) return emit({ command: name, state: p.state, ok: false, error: p.error }, { out, err });
    planned.push({ method: p.method, host: p.host, path: p.path });
  }

  if (args.execute !== true) {
    const dry = { command: name, state: STATES.OK, dry_run: true, requests: planned };
    if (command.then) dry.then = command.then;
    dry.note = DRY_RUN_NOTE;
    return emit(dry, { out, err });
  }

  if (isRead) {
    const [route, params = {}, query = {}] = requests[0];
    const res = await client.get(route, params, query);
    const shaped = command.shape ? command.shape(res) : res;
    const secrets = credentialValues(env);
    return emit({ command: name, request: planned[0], ...shaped }, { out, err, secrets });
  }

  // verify-*: each read is logged with its path and state.
  const reads = [];
  const read = async (route, params = {}, query = {}) => {
    const p = client.plan(route, params, query);
    const res = await client.get(route, params, query);
    reads.push({ method: 'GET', path: p.ok ? p.path : null, state: res.state, status: res.status === undefined ? null : res.status });
    return res;
  };
  const outcome = await command.verify(read, args);
  const secrets = credentialValues(env);
  let output;
  if (outcome.failed) {
    const f = outcome.failed;
    output = { command: name, state: f.state, verified: false, status: f.status === undefined ? null : f.status, error: f.error, observed: outcome.observed || {}, reads };
  } else {
    output = { command: name, state: STATES.OK, verified: outcome.verified === true, observed: outcome.observed, expected: outcome.expected, reads };
    if (outcome.note) output.note = outcome.note;
  }
  output.flags = scanUntrusted(output.observed, '$.observed');
  return emit(recordVerdict(cli.audit, 'fleet', output), { out, err, secrets });
}

// Read only after the client has used it, so printed output can be redacted
// against it a second time (the contract already redacts results).
function credentialValues(env) {
  const value = env.FLEET_API_TOKEN;
  return typeof value === 'string' && value.length ? [value] : [];
}

module.exports = { SPEC, run, READS, VERIFIES };

if (require.main === module) {
  run(process.argv.slice(2), process.env).then(
    (code) => { process.exitCode = code; },
    (error) => {
      process.stderr.write(`${error && error.message === 'Network tripwire fired' ? 'Network tripwire fired' : 'fleet-client: unexpected error (details withheld)'}\n`);
      process.exitCode = 2;
    },
  );
}
