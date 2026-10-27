#!/usr/bin/env node
/**
 * Jira Service Management Cloud client for Aegis: reads and HUMAN-RUN procedures only.
 *
 * Aegis advises; humans execute (PRODUCT_CONTRACT.md). This client never sends a
 * Jira write: the transport refuses every method but GET, so no code path here can
 * create a request, post a comment, or transition (close) a ticket. The write
 * commands (create, comment, transition) print the exact payload, a SHA-256 binding
 * line, and a HUMAN-RUN procedure (portal steps, or a curl command that asks for the
 * API token interactively) for the administrator to run in their own portal or
 * terminal. The verify-* commands then prove the human's write by an independent
 * read-back. Reads run only with the bare --execute flag; credentials are read only
 * for a read. --execute or --confirm on a write is refused before credentials or
 * network.
 *
 * Configuration (environment only):
 *   JIRA_SITE             bare <tenant>.atlassian.net hostname
 *   JIRA_EMAIL            API-token owner email
 *   JIRA_API_TOKEN        Atlassian API token (reads only)
 *   JIRA_SERVICE_DESK_ID  optional default numeric service desk id
 *   JIRA_REQUEST_TYPE_ID  optional default numeric request type id
 *
 * Examples:
 *   node scripts/jira-client.js create --summary "..." --description "..."
 *   node scripts/jira-client.js verify-create --issue HELP-123 --expect-sha256 <digest> --not-before <ms> --execute
 *   node scripts/jira-client.js comment --issue HELP-123 --body "..."
 *   node scripts/jira-client.js transition --issue HELP-123 --to Resolved --execute
 *
 * Exit codes: 0 preview, read or verified read-back; 1 input error or a refused
 * write; 2 API, preflight or read-back failure (including a read-back that does not
 * prove the human's write).
 */

'use strict';

const crypto = require('node:crypto');
const https = require('node:https');

const REQUEST_TIMEOUT_MS = 15000;
const TRANSITION_PAGE_LIMIT = 50;
// A verify-* read-back proves the administrator's write only if the object was made
// after the preview that prepared it. The preview prints its own time minus this
// margin, so modest clock skew between this machine and Jira cannot fail a real write.
const NOT_BEFORE_MARGIN_MS = 10 * 60 * 1000;
const MAX_TRANSITION_PAGES = 100;

const BOOLEAN_FLAGS = new Set(['execute', 'public']);
const VALUE_FLAGS = new Set([
  'service-desk',
  'request-type',
  'summary',
  'description',
  'on-behalf-of',
  'issue',
  'body',
  'to',
  'confirm',
  'comment-id',
  'issue-id',
  'from-version',
  'to-status',
  'not-before',
  'expect-sha256',
]);
const KNOWN_FLAGS = new Set([...BOOLEAN_FLAGS, ...VALUE_FLAGS]);

class InputError extends Error {}
class ApiError extends Error {
  constructor(status = null) {
    super('Jira API request failed');
    this.status = Number.isInteger(status) ? status : null;
  }
}
class ContractError extends Error {}

const defaultOut = (message) => process.stdout.write(`${message}\n`);
const defaultErr = (message) => process.stderr.write(`${message}\n`);

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function serializePayload(payload) {
  return JSON.stringify(payload);
}

function normalizeSite(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InputError('JIRA_SITE is required and must be a bare <tenant>.atlassian.net hostname.');
  }
  if (value !== value.trim() || /[\x00-\x20\x7f]/.test(value)) {
    throw new InputError('JIRA_SITE must not contain whitespace or control characters.');
  }
  const normalized = value.toLowerCase();
  const match = normalized.match(/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.atlassian\.net$/);
  if (!match || match[1].length > 63) {
    throw new InputError('JIRA_SITE must be a bare <tenant>.atlassian.net hostname (no scheme, path, port, or trailing dot).');
  }
  return normalized;
}

function normalizePositiveId(value, label) {
  const text = value === undefined || value === null ? '' : String(value);
  if (!/^[1-9][0-9]*$/.test(text)) throw new InputError(`${label} must be a positive numeric id.`);
  return text;
}

function normalizeIssueKey(value) {
  if (typeof value !== 'string' || value !== value.trim() || /[\x00-\x20\x7f]/.test(value)) {
    throw new InputError('--issue must be one Jira issue key with no whitespace or control characters.');
  }
  const normalized = value.toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{0,19}-[1-9][0-9]*$/.test(normalized)) {
    throw new InputError('--issue must be a Jira issue key such as HELP-123.');
  }
  return normalized;
}

function requireText(value, label, { controlsAllowed = true } = {}) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new InputError(`${label} is required.`);
  if (value.includes('\0') || (!controlsAllowed && /[\x00-\x1f\x7f]/.test(value))) {
    throw new InputError(`${label} contains unsupported control characters.`);
  }
  return value;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    if (token === '--' || token.startsWith('---')) throw new InputError(`Malformed flag: ${token}`);
    if (token.includes('=')) throw new InputError(`Flag values must be separate arguments; ${token} is not allowed.`);
    const key = token.slice(2);
    if (!KNOWN_FLAGS.has(key)) throw new InputError(`Unknown flag: --${key}`);
    if (Object.prototype.hasOwnProperty.call(args, key)) throw new InputError(`Duplicate flag: --${key}`);

    const next = argv[index + 1];
    if (BOOLEAN_FLAGS.has(key)) {
      if (next !== undefined && !next.startsWith('--')) {
        throw new InputError(`Boolean flag --${key} accepts no value.`);
      }
      args[key] = true;
      continue;
    }
    if (next === undefined || next.startsWith('--')) throw new InputError(`Flag --${key} requires a value.`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function loadCredentials(env = process.env) {
  const missing = [];
  if (!env.JIRA_EMAIL) missing.push('JIRA_EMAIL');
  if (!env.JIRA_API_TOKEN) missing.push('JIRA_API_TOKEN');
  if (missing.length) throw new InputError(`Missing required env vars: ${missing.join(', ')}.`);
  return { email: String(env.JIRA_EMAIL), token: String(env.JIRA_API_TOKEN) };
}

function normalizeCredentials(credentials) {
  if (!credentials || typeof credentials.email !== 'string' || credentials.email.length === 0 ||
      typeof credentials.token !== 'string' || credentials.token.length === 0) {
    throw new InputError('Credential provider must return non-empty email and token values.');
  }
  return { email: credentials.email, token: credentials.token };
}

function buildCreatePayload({ serviceDeskId, requestTypeId, summary, description, raiseOnBehalfOf }) {
  const desk = normalizePositiveId(serviceDeskId, 'serviceDeskId');
  const type = normalizePositiveId(requestTypeId, 'requestTypeId');
  const safeSummary = requireText(summary, 'summary');
  const payload = {
    serviceDeskId: desk,
    requestTypeId: type,
    requestFieldValues: {
      summary: safeSummary,
      description: description === undefined ? '' : requireText(description, 'description'),
    },
  };
  if (raiseOnBehalfOf !== undefined) payload.raiseOnBehalfOf = requireText(raiseOnBehalfOf, 'on-behalf-of');
  return payload;
}

function buildCommentPayload({ body, isPublic }) {
  return { body: requireText(body, 'comment body'), public: isPublic === true };
}

// The build*Confirmation helpers produce the binding line printed with every HUMAN-RUN
// procedure: site, target and full payload SHA-256 in one phrase, so the administrator
// can see exactly what they are about to send and notice any drift between two previews.
// No phrase unlocks a write here; the client has none.
function buildCreateConfirmation(site, payload) {
  const normalizedSite = normalizeSite(site);
  const digest = sha256Hex(serializePayload(payload));
  return `CREATE JSM REQUEST ON ${normalizedSite} DESK ${payload.serviceDeskId} TYPE ${payload.requestTypeId} PAYLOAD SHA256 ${digest}`;
}

function buildCommentConfirmation(site, issueKey, payload) {
  const normalizedSite = normalizeSite(site);
  const issue = normalizeIssueKey(issueKey);
  const visibility = payload.public === true ? 'PUBLIC' : 'INTERNAL';
  const digest = sha256Hex(serializePayload(payload));
  return `POST ${visibility} JSM COMMENT ON ${normalizedSite} ISSUE ${issue} PAYLOAD SHA256 ${digest}`;
}

function stateFingerprint(site, snapshot) {
  return sha256Hex(JSON.stringify({
    site: normalizeSite(site),
    issueKey: snapshot.issueKey,
    issueId: snapshot.issueId,
    currentStatus: snapshot.currentStatus,
    statusVersion: snapshot.statusVersion,
  }));
}

function transitionFingerprint(transition) {
  return sha256Hex(JSON.stringify({ id: transition.id, name: transition.name }));
}

function buildTransitionConfirmation(site, snapshot, transition) {
  const normalizedSite = normalizeSite(site);
  return `TRANSITION JSM ISSUE ${snapshot.issueKey} ID ${snapshot.issueId} ON ${normalizedSite} ` +
    `FROM STATE SHA256 ${stateFingerprint(normalizedSite, snapshot)} ` +
    `USING TRANSITION ${transition.id} SHA256 ${transitionFingerprint(transition)}`;
}

function isSuccessfulStatus(status) {
  return Number.isInteger(status) && status >= 200 && status < 300;
}

function apiRequest(cfg, method, apiPath, payload = null, options = {}) {
  if (typeof options === 'number') options = { timeoutMs: options };
  const timeoutMs = options.timeoutMs || REQUEST_TIMEOUT_MS;
  const requestImpl = options.request || https.request;
  const site = normalizeSite(cfg && cfg.site);
  const credentials = normalizeCredentials(cfg);
  const upperMethod = String(method).toUpperCase();
  // The product boundary at the transport: Aegis reads Jira; a human performs every write.
  if (upperMethod !== 'GET') throw new InputError('This client sends GET requests only; Jira writes are human-run.');
  if (payload !== null && payload !== undefined) throw new InputError('A GET request carries no payload.');
  if (typeof apiPath !== 'string' || !apiPath.startsWith('/rest/servicedeskapi/') ||
      /[\x00-\x20\x7f]/.test(apiPath) || apiPath.includes('://')) {
    throw new InputError('Jira API path must be a local /rest/servicedeskapi/ path without controls.');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new InputError('Request timeout must be positive.');

  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${credentials.email}:${credentials.token}`, 'utf8').toString('base64');
    const requestOptions = {
      hostname: site,
      path: apiPath,
      method: upperMethod,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    };

    let settled = false;
    let timer;
    const finishError = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const request = requestImpl(requestOptions, (response) => {
      let raw = '';
      response.on('data', (chunk) => { raw += String(chunk); });
      response.on('error', finishError);
      response.on('end', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        let json = null;
        try { json = raw.length ? JSON.parse(raw) : null; } catch { /* response bodies are never echoed */ }
        resolve({ status: response.statusCode, body: raw, json });
      });
    });
    request.on('error', finishError);
    timer = setTimeout(() => {
      if (settled) return;
      const timeoutError = new Error(`Jira API request timed out after ${timeoutMs}ms`);
      request.destroy(timeoutError);
      finishError(timeoutError);
    }, timeoutMs);
    request.end();
  });
}

function createRuntime(env, dependencies = {}) {
  return {
    env,
    fetch: dependencies.fetch || apiRequest,
    getCredentials: dependencies.getCredentials || loadCredentials,
    now: dependencies.now || Date.now,
    out: dependencies.out || defaultOut,
    err: dependencies.err || defaultErr,
  };
}

async function networkConfig(runtime, site) {
  const credentials = normalizeCredentials(await runtime.getCredentials(runtime.env));
  return { site: normalizeSite(site), ...credentials };
}

async function fetchResponse(runtime, cfg, method, apiPath) {
  if (method !== 'GET') throw new InputError('This client sends GET requests only; Jira writes are human-run.');
  let response;
  try {
    response = await runtime.fetch(cfg, method, apiPath);
  } catch {
    throw new ApiError();
  }
  if (!response || !Number.isInteger(response.status)) throw new ApiError();
  return response;
}

function requireSuccess(response) {
  if (!isSuccessfulStatus(response.status)) throw new ApiError(response.status);
  return response;
}

const WRITE_REFUSAL = 'Refused: this client never sends a Jira write. Aegis advises; humans execute (PRODUCT_CONTRACT.md).';

function refuseWrite(runtime, next) {
  runtime.err(WRITE_REFUSAL);
  runtime.err(next);
  runtime.err('No credentials were read and no network call was made.');
  return 1;
}

function previewNotBefore(runtime) {
  return Math.max(0, Math.floor(runtime.now()) - NOT_BEFORE_MARGIN_MS);
}

function requireNotBefore(args) {
  return Number(normalizePositiveId(args['not-before'], '--not-before (epoch milliseconds printed by the preview)'));
}

// The creation time Jira stamped on a request or comment, in epoch milliseconds.
function createdMillis(json, field, label) {
  const stamp = json && json[field];
  if (!stamp || !Number.isInteger(stamp.epochMillis)) throw new ContractError(`${label} read-back carries no creation time.`);
  return stamp.epochMillis;
}

// POSIX single-quote quoting for the commands a procedure prints; the human pastes them.
function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

// The curl form of a human-run write, as one copyable line. --user with the email only
// makes curl prompt for the API token, so the token never sits on the command line, in
// shell history, or in this process. The JSON is one physical line (JSON.stringify
// escapes newlines) and is passed as a single shell-quoted argument.
function curlPostLine(site, apiPath, payload) {
  return `     curl --fail-with-body --silent --show-error --user "$JIRA_EMAIL" --header 'Content-Type: application/json' ` +
    `--request POST ${shellQuote(`https://${site}${apiPath}`)} --data-binary ${shellQuote(serializePayload(payload))}`;
}

// PowerShell single-quoted strings end at any of ' and the typographic single quotes
// U+2018 to U+201B; doubling each keeps it literal.
function psQuote(value) {
  return `'${String(value).replace(/['\u2018\u2019\u201A\u201B]/g, (ch) => ch + ch)}'`;
}

// The same write for PowerShell 7 on Windows: Get-Credential asks for the API token.
// The charset is explicit: PowerShell before 7.4 encodes a string body as ISO-8859-1
// unless the content type names one, which would mangle any non-ASCII text.
function powershellPostLine(site, apiPath, payload) {
  return `     Invoke-RestMethod -Method Post -Uri ${psQuote(`https://${site}${apiPath}`)} -Authentication Basic ` +
    "-Credential (Get-Credential -UserName $env:JIRA_EMAIL -Message 'Atlassian API token') " +
    `-ContentType 'application/json; charset=utf-8' -Body ${psQuote(serializePayload(payload))}`;
}

function apiLines(site, apiPath, payload) {
  return [
    '  2. Or the API, in your own terminal; each line asks for your API token instead of reading it from the environment.',
    '     bash or zsh (macOS, Linux, WSL, Git Bash):',
    curlPostLine(site, apiPath, payload),
    '     PowerShell 7 (Windows):',
    powershellPostLine(site, apiPath, payload),
  ];
}

function printProcedure(runtime, lines) {
  runtime.out('HUMAN-RUN procedure (Aegis advises; you execute this write yourself):');
  for (const line of lines) runtime.out(line);
}

function normalizeWriteReceipt(json, label) {
  if (!json || typeof json !== 'object') throw new ContractError(`Malformed ${label} receipt.`);
  let issueKey;
  try { issueKey = normalizeIssueKey(json.issueKey); }
  catch { throw new ContractError(`Malformed issue key in ${label} receipt.`); }
  const issueId = String(json.issueId === undefined ? '' : json.issueId);
  if (!/^[1-9][0-9]*$/.test(issueId)) throw new ContractError(`Invalid immutable issue id in ${label} receipt.`);
  return { issueKey, issueId };
}

// The read-back digest covers exactly what a create read-back can show (service desk,
// request type, summary, description), so the preview can print it and verify-create can
// take it in place of free text that would need shell quoting.
function createDigest({ serviceDeskId, requestTypeId, summary, description }) {
  return sha256Hex(JSON.stringify({ serviceDeskId, requestTypeId, summary, description }));
}

function requestFieldText(json, fieldId, { optional = false } = {}) {
  if (!Array.isArray(json.requestFieldValues)) throw new ContractError('Request read-back has no field collection.');
  const matches = json.requestFieldValues.filter((field) => field && field.fieldId === fieldId);
  if (optional && matches.length === 0) return '';
  if (matches.length !== 1 || typeof matches[0].value !== 'string') throw new ContractError(`Request read-back did not carry exactly one ${fieldId}.`);
  return matches[0].value;
}

function requireDigest(args) {
  const value = args['expect-sha256'];
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new InputError('--expect-sha256 must be the 64-hex digest the preview printed.');
  return value;
}

function verifyCreatedRequestReadBack(json, issueKey, expectSha256) {
  const observed = normalizeWriteReceipt(json, 'create read-back');
  if (observed.issueKey !== issueKey) throw new ContractError('Create read-back identity did not match the expected request.');
  let serviceDeskId;
  let requestTypeId;
  try {
    serviceDeskId = normalizePositiveId(json.serviceDeskId, 'read-back serviceDeskId');
    requestTypeId = normalizePositiveId(json.requestTypeId, 'read-back requestTypeId');
  } catch {
    throw new ContractError('Create read-back returned invalid request type identity.');
  }
  const fields = {
    serviceDeskId,
    requestTypeId,
    summary: requestFieldText(json, 'summary'),
    description: requestFieldText(json, 'description', { optional: true }),
  };
  if (createDigest(fields) !== expectSha256) {
    throw new ContractError('Create read-back did not match the approved service desk, request type, summary and description.');
  }
  return observed;
}

function verifyCommentReadBack(json, commentId, expectSha256) {
  if (!json || typeof json !== 'object') throw new ContractError('Malformed comment read-back.');
  const id = String(json.id === undefined ? '' : json.id);
  if (id !== commentId || typeof json.body !== 'string' || typeof json.public !== 'boolean' ||
      sha256Hex(serializePayload({ body: json.body, public: json.public })) !== expectSha256) {
    throw new ContractError('Comment read-back did not prove the approved id, body, and visibility.');
  }
  return { id };
}

function normalizeCustomerRequest(json, expectedIssueKey) {
  if (!json || typeof json !== 'object') throw new ContractError('Malformed customer request response.');
  let issueKey;
  try { issueKey = normalizeIssueKey(json.issueKey); } catch { throw new ContractError('Malformed issue key in response.'); }
  if (issueKey !== expectedIssueKey) throw new ContractError('Jira returned a different issue key.');
  const issueId = String(json.issueId === undefined ? '' : json.issueId);
  if (!/^[1-9][0-9]*$/.test(issueId)) throw new ContractError('Jira returned an invalid immutable issue id.');
  const status = json.currentStatus && json.currentStatus.status;
  if (typeof status !== 'string' || status.length === 0 || /[\x00-\x1f\x7f]/.test(status)) {
    throw new ContractError('Jira returned an invalid current status.');
  }
  const date = json.currentStatus.statusDate || {};
  let statusVersion = '';
  if (Number.isInteger(date.epochMillis)) statusVersion = String(date.epochMillis);
  // The version is printed unquoted in the verify-transition line a human pastes, so
  // it must be a timestamp and nothing else ($, backticks or spaces would be shell).
  else if (typeof date.iso8601 === 'string' && /^[0-9A-Za-z:.+-]{1,64}$/.test(date.iso8601)) statusVersion = date.iso8601;
  if (statusVersion.length === 0) throw new ContractError('Jira returned no valid current-status version.');
  return { issueKey, issueId, currentStatus: status, statusVersion };
}

function normalizeTransition(value) {
  if (!value || typeof value !== 'object') throw new ContractError('Malformed transition entry.');
  const id = String(value.id === undefined ? '' : value.id);
  if (!/^[0-9]+$/.test(id)) throw new ContractError('Transition id must be numeric.');
  const name = value.name;
  if (typeof name !== 'string' || name.trim().length === 0 || /[\x00-\x1f\x7f]/.test(name)) {
    throw new ContractError('Transition name is missing or contains control characters.');
  }
  return { id, name };
}

async function fetchAllTransitions(runtime, cfg, issueKey) {
  const transitions = [];
  const seenIds = new Set();
  let start = 0;

  for (let pageNumber = 0; pageNumber < MAX_TRANSITION_PAGES; pageNumber += 1) {
    const apiPath = `/rest/servicedeskapi/request/${encodeURIComponent(issueKey)}/transition` +
      `?start=${start}&limit=${TRANSITION_PAGE_LIMIT}`;
    const response = requireSuccess(await fetchResponse(runtime, cfg, 'GET', apiPath));
    const page = response.json;
    if (!page || typeof page !== 'object' || !Array.isArray(page.values) ||
        !Number.isInteger(page.start) || page.start !== start ||
        !Number.isInteger(page.size) || page.size !== page.values.length ||
        !Number.isInteger(page.limit) || page.limit <= 0 ||
        typeof page.isLastPage !== 'boolean') {
      throw new ContractError('Malformed or non-progressing Jira transition page.');
    }

    for (const raw of page.values) {
      const transition = normalizeTransition(raw);
      if (seenIds.has(transition.id)) throw new ContractError('Duplicate transition id returned across pages.');
      seenIds.add(transition.id);
      transitions.push(transition);
    }

    if (page.isLastPage) return transitions;
    const nextStart = start + page.values.length;
    if (nextStart <= start) throw new ContractError('Non-progressing Jira transition pagination.');
    start = nextStart;
  }
  throw new ContractError('Jira transition pagination exceeded the safety limit.');
}

function resolveTransition(transitions, selector) {
  const target = requireText(selector, 'to', { controlsAllowed: false });
  if (/^[0-9]+$/.test(target)) {
    const byId = transitions.filter((transition) => transition.id === target);
    if (byId.length !== 1) throw new ContractError(`Transition id ${target} did not resolve uniquely.`);
    return byId[0];
  }
  const folded = target.toLocaleLowerCase('en-US');
  const byName = transitions.filter((transition) => transition.name.toLocaleLowerCase('en-US') === folded);
  if (byName.length !== 1) throw new ContractError(`Transition name did not resolve uniquely (${byName.length} matches).`);
  return byName[0];
}

async function preflightTransition(runtime, cfg, issueKey, selector) {
  const requestPath = `/rest/servicedeskapi/request/${encodeURIComponent(issueKey)}`;
  const requestResponse = requireSuccess(await fetchResponse(runtime, cfg, 'GET', requestPath));
  const snapshot = normalizeCustomerRequest(requestResponse.json, issueKey);
  const transitions = await fetchAllTransitions(runtime, cfg, issueKey);
  const transition = resolveTransition(transitions, selector);
  const confirmation = buildTransitionConfirmation(cfg.site, snapshot, transition);
  return { snapshot, transition, confirmation };
}

async function cmdListDesks(runtime, args) {
  if (args.execute !== true) {
    runtime.out('DRY RUN - would GET /rest/servicedeskapi/servicedesk. Add --execute to perform this read.');
    return 0;
  }
  const site = normalizeSite(runtime.env.JIRA_SITE);
  const cfg = await networkConfig(runtime, site);
  const response = requireSuccess(await fetchResponse(runtime, cfg, 'GET', '/rest/servicedeskapi/servicedesk'));
  for (const desk of (response.json && response.json.values) || []) {
    runtime.out(`id=${String(desk.id)} key=${String(desk.projectKey)} name=${String(desk.projectName)}`);
  }
  return 0;
}

async function cmdListTypes(runtime, args) {
  const deskId = normalizePositiveId(args['service-desk'] || runtime.env.JIRA_SERVICE_DESK_ID, 'service desk id');
  const apiPath = `/rest/servicedeskapi/servicedesk/${encodeURIComponent(deskId)}/requesttype`;
  if (args.execute !== true) {
    runtime.out(`DRY RUN - would GET ${apiPath}. Add --execute to perform this read.`);
    return 0;
  }
  const site = normalizeSite(runtime.env.JIRA_SITE);
  const cfg = await networkConfig(runtime, site);
  const response = requireSuccess(await fetchResponse(runtime, cfg, 'GET', apiPath));
  for (const type of (response.json && response.json.values) || []) {
    runtime.out(`id=${String(type.id)} name=${String(type.name)}`);
  }
  return 0;
}

function createPayloadFromArgs(runtime, args) {
  return buildCreatePayload({
    serviceDeskId: args['service-desk'] || runtime.env.JIRA_SERVICE_DESK_ID,
    requestTypeId: args['request-type'] || runtime.env.JIRA_REQUEST_TYPE_ID,
    summary: args.summary,
    description: args.description,
    raiseOnBehalfOf: args['on-behalf-of'],
  });
}

async function cmdCreate(runtime, args) {
  const site = normalizeSite(runtime.env.JIRA_SITE);
  const payload = createPayloadFromArgs(runtime, args);
  runtime.out(`PREVIEW - exact create payload: ${serializePayload(payload)}`);
  runtime.out(`Payload binding: ${buildCreateConfirmation(site, payload)}`);
  printProcedure(runtime, [
    `  1. Portal: the customer portal of service desk ${payload.serviceDeskId} -> Raise a request -> request type ${payload.requestTypeId}` +
      ' -> paste the summary and description from the payload above, unedited -> Create.' +
      (payload.raiseOnBehalfOf === undefined ? '' : ' Raise it on behalf of the reporter named in the payload.'),
    ...apiLines(site, '/rest/servicedeskapi/request', payload),
    '  3. Prove it with a read-back, using the issue key Jira returned:',
    `     node scripts/jira-client.js verify-create --issue [JIRA-###] --expect-sha256 ${createDigest({ ...payload, ...payload.requestFieldValues })} --not-before ${previewNotBefore(runtime)} --execute`,
  ]);
  if (args.execute === true || args.confirm !== undefined) {
    return refuseWrite(runtime, 'Run the HUMAN-RUN procedure printed above yourself, in the portal or your own terminal.');
  }
  return 0;
}

async function cmdComment(runtime, args) {
  const issueKey = normalizeIssueKey(args.issue);
  const site = normalizeSite(runtime.env.JIRA_SITE);
  const payload = buildCommentPayload({ body: args.body, isPublic: args.public });
  const visibility = payload.public ? 'PUBLIC' : 'INTERNAL';
  const apiPath = `/rest/servicedeskapi/request/${encodeURIComponent(issueKey)}/comment`;
  runtime.out(`PREVIEW - exact comment payload: ${serializePayload(payload)}`);
  runtime.out(`Visibility: ${visibility}${payload.public ? ' (the reporter can read it)' : ' (agents only)'}`);
  runtime.out(`Payload binding: ${buildCommentConfirmation(site, issueKey, payload)}`);
  printProcedure(runtime, [
    `  1. Portal: open ${issueKey} -> ${payload.public ? 'Reply to customer' : 'Add internal note'} -> paste the body from the payload above, unedited -> Save.`,
    ...apiLines(site, apiPath, payload),
    '  3. Prove it with a read-back, using the comment id Jira returned:',
    `     node scripts/jira-client.js verify-comment --issue ${issueKey} --comment-id [COMMENT_ID] --expect-sha256 ${sha256Hex(serializePayload(payload))}` +
      ` --not-before ${previewNotBefore(runtime)} --execute`,
  ]);
  if (args.execute === true || args.confirm !== undefined) {
    return refuseWrite(runtime, 'Run the HUMAN-RUN procedure printed above yourself, in the portal or your own terminal.');
  }
  return 0;
}

async function cmdGet(runtime, args) {
  const issueKey = normalizeIssueKey(args.issue);
  const apiPath = `/rest/servicedeskapi/request/${encodeURIComponent(issueKey)}`;
  if (args.execute !== true) {
    runtime.out(`DRY RUN - would GET ${apiPath}. Add --execute to perform this read.`);
    return 0;
  }
  const site = normalizeSite(runtime.env.JIRA_SITE);
  const cfg = await networkConfig(runtime, site);
  const response = requireSuccess(await fetchResponse(runtime, cfg, 'GET', apiPath));
  const snapshot = normalizeCustomerRequest(response.json, issueKey);
  runtime.out(`${snapshot.issueKey} ID ${snapshot.issueId} status=${snapshot.currentStatus}`);
  return 0;
}

async function cmdTransition(runtime, args) {
  const issueKey = normalizeIssueKey(args.issue);
  const selector = requireText(args.to, 'to', { controlsAllowed: false });
  if (args.confirm !== undefined) {
    return refuseWrite(runtime, 'Run the read-only preflight (--execute without --confirm) and follow the HUMAN-RUN procedure it prints.');
  }
  if (args.execute !== true) {
    runtime.out(`LOCAL PREVIEW - transition ${issueKey} using selector "${selector}".`);
    runtime.out('No API call was made. Add --execute for a read-only live preflight that prints the HUMAN-RUN procedure.');
    return 0;
  }

  const site = normalizeSite(runtime.env.JIRA_SITE);
  const cfg = await networkConfig(runtime, site);
  const preflight = await preflightTransition(runtime, cfg, issueKey, selector);
  const { snapshot, transition } = preflight;
  runtime.out(`Preflight target: ${snapshot.issueKey} ID ${snapshot.issueId}; current status=${snapshot.currentStatus}.`);
  runtime.out(`Resolved transition: ID ${transition.id} name=${transition.name}.`);
  runtime.out(`Transition binding: ${preflight.confirmation}`);
  printProcedure(runtime, [
    '  0. Re-run this preflight just before you act. If the binding line changed, the request moved: stop and read it again.',
    `  1. Portal: open ${snapshot.issueKey} -> status button -> ${transition.name}.`,
    ...apiLines(site, `/rest/servicedeskapi/request/${encodeURIComponent(snapshot.issueKey)}/transition`, { id: transition.id }),
    '  3. Prove it with a read-back:',
    `     node scripts/jira-client.js verify-transition --issue ${snapshot.issueKey} --issue-id ${snapshot.issueId}` +
      ` --from-version ${snapshot.statusVersion} --to-status '[STATUS AFTER]' --execute`,
    '     Replace [STATUS AFTER] with the status this transition should leave the request in.',
  ]);
  return 0;
}

// The verify-* commands take only what the preview printed (keys, numbers, digests), so a
// stray free-text flag is refused rather than silently ignored.
const VERIFY_FLAGS = {
  'verify-create': ['issue', 'expect-sha256', 'not-before', 'execute'],
  'verify-comment': ['issue', 'comment-id', 'expect-sha256', 'not-before', 'execute'],
  'verify-transition': ['issue', 'issue-id', 'from-version', 'to-status', 'execute'],
};
function requireVerifyFlags(command, args) {
  const extra = Object.keys(args).filter((key) => key !== '_' && !VERIFY_FLAGS[command].includes(key));
  if (extra.length) throw new InputError(`${command} does not take --${extra[0]}; pass only the values the preview printed (${VERIFY_FLAGS[command].map((f) => `--${f}`).join(' ')}).`);
}

function dryRunRead(runtime, args, apiPath) {
  if (args.execute === true) return false;
  runtime.out(`DRY RUN - would GET ${apiPath}. Add --execute to perform this read.`);
  return true;
}

// verify-create: the human created the request; prove the key, the immutable id, the
// service desk, the request type, the summary and the description by an independent GET.
async function cmdVerifyCreate(runtime, args) {
  requireVerifyFlags('verify-create', args);
  const issueKey = normalizeIssueKey(args.issue);
  const site = normalizeSite(runtime.env.JIRA_SITE);
  const expectSha256 = requireDigest(args);
  const notBefore = requireNotBefore(args);
  const apiPath = `/rest/servicedeskapi/request/${encodeURIComponent(issueKey)}`;
  if (dryRunRead(runtime, args, apiPath)) return 0;
  const cfg = await networkConfig(runtime, site);
  const response = requireSuccess(await fetchResponse(runtime, cfg, 'GET', apiPath));
  const observed = verifyCreatedRequestReadBack(response.json, issueKey, expectSha256);
  // Same text is not the same write: an older request with this summary and description
  // (a recurring ticket) was not created by the procedure this preview printed.
  if (createdMillis(response.json, 'createdDate', 'Create') < notBefore) {
    throw new ContractError('The request was created before the preview that prepared it; it is not the administrator\'s new request.');
  }
  runtime.out(`Verified: ${observed.issueKey} ID ${observed.issueId} was created after the preview and carries the approved service desk, request type, summary and description.`);
  return 0;
}

// verify-comment: prove the comment id, the exact body and the visibility the human chose.
async function cmdVerifyComment(runtime, args) {
  requireVerifyFlags('verify-comment', args);
  const issueKey = normalizeIssueKey(args.issue);
  const commentId = normalizePositiveId(args['comment-id'], '--comment-id');
  const site = normalizeSite(runtime.env.JIRA_SITE);
  const expectSha256 = requireDigest(args);
  const notBefore = requireNotBefore(args);
  const apiPath = `/rest/servicedeskapi/request/${encodeURIComponent(issueKey)}/comment/${encodeURIComponent(commentId)}`;
  if (dryRunRead(runtime, args, apiPath)) return 0;
  const cfg = await networkConfig(runtime, site);
  const response = requireSuccess(await fetchResponse(runtime, cfg, 'GET', apiPath));
  verifyCommentReadBack(response.json, commentId, expectSha256);
  if (createdMillis(response.json, 'created', 'Comment') < notBefore) {
    throw new ContractError('The comment was created before the preview that prepared it; it is not the administrator\'s new comment.');
  }
  runtime.out(`Verified: ${response.json.public ? 'PUBLIC' : 'INTERNAL'} comment ${commentId} on ${issueKey} was created after the preview and carries the approved body and visibility.`);
  return 0;
}

// verify-transition: prove the same immutable request moved after the preflight (its
// status version changed) and now sits in the status the administrator expected. A
// different status (an automation, a customer reply, another transition) does not pass.
async function cmdVerifyTransition(runtime, args) {
  requireVerifyFlags('verify-transition', args);
  const issueKey = normalizeIssueKey(args.issue);
  const issueId = normalizePositiveId(args['issue-id'], '--issue-id');
  const fromVersion = requireText(args['from-version'], 'from-version', { controlsAllowed: false });
  if (!/^[0-9A-Za-z:.+-]{1,64}$/.test(fromVersion)) throw new InputError('--from-version must be the status version the preflight printed.');
  const toStatus = requireText(args['to-status'], 'to-status', { controlsAllowed: false });
  if (/^\[.*\]$/.test(toStatus)) throw new InputError('--to-status still holds the placeholder; name the status the transition should leave.');
  const site = normalizeSite(runtime.env.JIRA_SITE);
  const apiPath = `/rest/servicedeskapi/request/${encodeURIComponent(issueKey)}`;
  if (dryRunRead(runtime, args, apiPath)) return 0;
  const cfg = await networkConfig(runtime, site);
  const response = requireSuccess(await fetchResponse(runtime, cfg, 'GET', apiPath));
  const after = normalizeCustomerRequest(response.json, issueKey);
  if (after.issueId !== issueId) throw new ContractError('Jira returned a different immutable issue id.');
  if (after.statusVersion === fromVersion) throw new ContractError('The status has not changed since the preflight; the transition is not proven.');
  if (after.currentStatus !== toStatus) {
    throw new ContractError(`The request is in ${after.currentStatus}, not ${toStatus}; something other than this transition moved it, or it has not been applied.`);
  }
  runtime.out(`Verified: ${after.issueKey} ID ${after.issueId} moved after the preflight and is now ${after.currentStatus}.`);
  return 0;
}

const COMMANDS = {
  'list-desks': cmdListDesks,
  'list-types': cmdListTypes,
  create: cmdCreate,
  comment: cmdComment,
  get: cmdGet,
  transition: cmdTransition,
  'verify-create': cmdVerifyCreate,
  'verify-comment': cmdVerifyComment,
  'verify-transition': cmdVerifyTransition,
};

async function run(argv = process.argv.slice(2), env = process.env, dependencies = {}) {
  const runtime = createRuntime(env, dependencies);
  let args;
  try {
    args = parseArgs(argv);
    const command = args._[0];
    if (!command || !COMMANDS[command] || args._.length !== 1) {
      throw new InputError('Usage: node scripts/jira-client.js ' +
        '<list-desks|list-types|create|comment|get|transition|verify-create|verify-comment|verify-transition> [flags]');
    }
    return await COMMANDS[command](runtime, args);
  } catch (error) {
    if (error instanceof InputError) {
      runtime.err(`Input error: ${error.message}`);
      return 1;
    }
    if (error instanceof ApiError) {
      const suffix = error.status === null ? '' : ` (HTTP ${error.status})`;
      runtime.err(`Jira API request failed${suffix}; response body withheld.`);
      return 2;
    }
    if (error instanceof ContractError) {
      runtime.err(`Jira preflight/read-back contract failed: ${error.message} This client sends no writes.`);
      return 2;
    }
    runtime.err('Jira operation failed safely; details withheld.');
    return 2;
  }
}

if (require.main === module) {
  run().then((code) => { process.exitCode = code; });
}

module.exports = {
  REQUEST_TIMEOUT_MS,
  TRANSITION_PAGE_LIMIT,
  apiRequest,
  buildCommentConfirmation,
  buildCommentPayload,
  buildCreateConfirmation,
  buildCreatePayload,
  buildTransitionConfirmation,
  createDigest,
  fetchAllTransitions,
  loadCredentials,
  normalizeIssueKey,
  normalizeSite,
  normalizeWriteReceipt,
  parseArgs,
  preflightTransition,
  WRITE_REFUSAL,
  resolveTransition,
  run,
  serializePayload,
  sha256Hex,
  stateFingerprint,
  transitionFingerprint,
  verifyCommentReadBack,
  verifyCreatedRequestReadBack,
};
