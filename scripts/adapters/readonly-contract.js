'use strict';
// readonly-contract.js: the one read-only contract every G2 adapter is built on
// (Fleet, Jamf Pro, Slack, Linear, Google Workspace). README.md beside this file.
//
// Aegis advises; humans execute (PRODUCT_CONTRACT.md). An adapter built here can
// read a vendor system through an exact allow-list and nothing else:
//   - a GET route the spec names, with validated path parameters and query keys;
//   - for GraphQL, a POST to the spec's one GraphQL path whose query text is
//     byte-equal to a named query document defined in code (never a mutation or
//     subscription);
//   - the vendor's documented token exchange, built by the client itself from the
//     named credentials, with exactly the declared grant fields.
// Everything else is refused before a credential is read or a socket is opened.
// Credentials come from named environment variables only and never leave the
// module in a result, an error or an exception. Response text is data: it is
// scanned for instruction text, which is flagged and quoted, never followed. A
// response holding a record from another tenant returns no data. Reads retry a
// bounded number of times; the token exchange never repeats.
//
// Batch G3: a 429 or 503 with Retry-After is waited out up to 30 s, and a longer one is not;
// the backoff has jitter; the total time one read may spend retrying is capped; every read
// that gives up ends in a named handoff state with plain words for the operator; a request
// id the vendor returns is kept; with an audit sink (scripts/audit/) every request is one
// connector-call entry, and a sink that fails withholds the answer.
//
// Batch G3 close-out (owner decision 3): an opt-in rate-limit hook (spec.rateLimit; only
// GitHub turns it on). A 403 or 429 that carries the vendor's documented rate-limit signal
// (the remaining-requests header at 0, or a body message naming the secondary limit) is a
// rate limit, not a permission refusal: it is waited out when the vendor's own wait fits the
// 30 s cap and the retry budget, and otherwise ends in the RATE_LIMITED handoff with the time
// in UTC after which the read may run again. The body is read here only to test that message;
// it never leaves this file.
//
// The transport is injected. The default is node:https, and it throws "Network
// tripwire fired" when AEGIS_NETWORK_TRIPWIRE=1 (every adapter test sets it
// through socket-tripwire.js), so no test can reach a real system.

const https = require('node:https');
const { injectionMarkersIn } = require('../tier/tier-guard.js');
const { operatorMessage, handoffFor, isFailure } = require('./operator-message.js');

const STATES = Object.freeze({
  OK: 'OK',
  REFUSED: 'REFUSED',
  NO_CREDENTIALS: 'NO_CREDENTIALS',
  HTTP_ERROR: 'HTTP_ERROR',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  // batch G3: the credential holds a write scope beyond the manifest; the audit trail could
  // not record the request
  SCOPE_REFUSED: 'SCOPE_REFUSED',
  AUDIT_FAILED: 'AUDIT_FAILED',
});

// The named states a read ends in when it gives up retrying (batch G3).
const HANDOFF = Object.freeze({
  RETRIES_EXHAUSTED: 'RETRIES_EXHAUSTED',
  RETRY_AFTER_TOO_LONG: 'RETRY_AFTER_TOO_LONG',
  RETRY_BUDGET_SPENT: 'RETRY_BUDGET_SPENT',
  // batch G3 close-out: the vendor's rate limit could not be waited out within the cap
  RATE_LIMITED: 'RATE_LIMITED',
});

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRIES_CAP = 3;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const QUOTE_LIMIT = 200;
const BACKOFF_BASE_MS = 200;
const BACKOFF_CAP_MS = 2000;
const MAX_RETRY_AFTER_MS = 30000;
const DEFAULT_RETRY_BUDGET_MS = 60000;
// Response headers that carry the vendor's request id, in the order they are tried.
const REQUEST_ID_HEADERS = ['x-request-id', 'x-github-request-id', 'x-okta-request-id', 'request-id', 'client-request-id',
  'x-ms-request-id', 'x-slack-req-id', 'x-arequestid', 'x-amzn-requestid'];
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const REDACTED = '[REDACTED]';
const TRIPWIRE_MESSAGE = 'Network tripwire fired';

class RefusedError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'RefusedError';
    this.state = STATES.REFUSED;
  }
}

class TripwireError extends Error {
  constructor() {
    super(TRIPWIRE_MESSAGE);
    this.name = 'NetworkTripwireError';
  }
}

// ── Untrusted response text (SR-3) ───────────────────────────────────────────
// The shared injection markers (scripts/tier/tier-guard.js) plus instruction shapes
// that only make sense aimed at an agent reading an API response.
const ADAPTER_MARKERS = [
  { pattern: /\b(?:run|execute|paste)\s+(?:the\s+following|this)\s+(?:command|script|code)\b/i, marker: 'run-this-command' },
  { pattern: /\bcurl\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/i, marker: 'pipe-to-shell' },
  { pattern: /^\s*(?:system|assistant|developer)\s*:/im, marker: 'role-prefix' },
  { pattern: /\b(?:as|you are)\s+(?:an?\s+)?(?:ai|assistant|agent|llm|language model)\b[^.]{0,80}\b(?:must|should|now)\b/i, marker: 'agent-directive' },
];

function markersIn(text) {
  const found = new Set(injectionMarkersIn(text));
  for (const { pattern, marker } of ADAPTER_MARKERS) if (pattern.test(text)) found.add(marker);
  return [...found];
}

function quote(text) {
  const clean = String(text).replace(/[\u0000-\u001f\u007f]/g, ' ');
  const cut = clean.length > QUOTE_LIMIT ? `${clean.slice(0, QUOTE_LIMIT)}...` : clean;
  return JSON.stringify(cut);
}

function scanUntrusted(value, at = '$', flags = []) {
  if (typeof value === 'string') {
    const markers = markersIn(value);
    if (markers.length) flags.push({ path: at, markers, quote: quote(value) });
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => scanUntrusted(item, `${at}[${i}]`, flags));
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      const step = /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
      scanUntrusted(value[key], `${at}${step}`, flags);
    }
  }
  return flags;
}

// ── Secret redaction ─────────────────────────────────────────────────────────
function redactString(text, secrets) {
  let out = String(text);
  for (const s of secrets) if (s && s.length >= 4) out = out.split(s).join(REDACTED);
  return out;
}

function redactDeep(value, secrets) {
  if (!secrets.length) return value;
  if (typeof value === 'string') return redactString(value, secrets);
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, secrets));
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[redactString(key, secrets)] = redactDeep(value[key], secrets);
    return out;
  }
  return value;
}

// ── GraphQL: queries only ────────────────────────────────────────────────────
// A small lexer: comments and strings (including block strings) are removed, then
// every top-level definition must start with `query`, `fragment` or `{`. A
// `mutation` or `subscription` operation anywhere at the top level is refused, so
// a mutation hidden after a query cannot pass.
function stripGraphQL(doc) {
  let out = '';
  let i = 0;
  while (i < doc.length) {
    const ch = doc[i];
    if (doc.startsWith('"""', i)) {
      const end = doc.indexOf('"""', i + 3);
      if (end < 0) throw new RefusedError('GraphQL document has an unterminated block string');
      out += ' ';
      i = end + 3;
    } else if (ch === '"') {
      let j = i + 1;
      while (j < doc.length && doc[j] !== '"' && doc[j] !== '\n' && doc[j] !== '\r') j += doc[j] === '\\' ? 2 : 1;
      if (doc[j] !== '"') throw new RefusedError('GraphQL document has an unterminated string');
      out += ' ';
      i = j + 1;
    } else if (ch === '#') {
      // a comment ends at a line terminator: \n, \r or \r\n (GraphQL LineTerminator)
      let end = i + 1;
      while (end < doc.length && doc[end] !== '\n' && doc[end] !== '\r') end += 1;
      i = end;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

function assertQueryOnly(doc) {
  if (typeof doc !== 'string' || !doc.trim()) throw new RefusedError('GraphQL document is empty');
  const code = stripGraphQL(doc);
  let depth = 0;
  let expectDefinition = true;
  const tokens = code.match(/[{}]|[A-Za-z_][A-Za-z0-9_]*|[^\s{}A-Za-z_]+/g) || [];
  for (const token of tokens) {
    if (token === '{') {
      if (depth === 0 && expectDefinition) expectDefinition = false; // shorthand query
      depth += 1;
    } else if (token === '}') {
      depth -= 1;
      if (depth < 0) throw new RefusedError('GraphQL document has an unbalanced brace');
      if (depth === 0) expectDefinition = true;
    } else if (depth === 0) {
      if (expectDefinition) {
        if (token === 'mutation' || token === 'subscription') throw new RefusedError('GraphQL mutation or subscription operations are refused: this adapter reads only');
        if (token !== 'query' && token !== 'fragment') throw new RefusedError('GraphQL document has an unknown top-level definition');
        expectDefinition = false;
      }
    }
  }
  if (depth !== 0) throw new RefusedError('GraphQL document has an unbalanced brace');
  if (!expectDefinition) throw new RefusedError('GraphQL document ends inside a definition');
  return true;
}

function operationNameOf(doc) {
  const m = stripGraphQL(doc).match(/^\s*query\s+([A-Za-z_][A-Za-z0-9_]*)/);
  return m ? m[1] : null;
}

// ── Spec definition ──────────────────────────────────────────────────────────
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;
const PATH_SEGMENT = /^(?:[A-Za-z0-9_.~-]+|:[a-zA-Z][A-Za-z0-9]*)$/;
const ENV_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;

function freezeRoute(name, route) {
  if (!route || route.method !== 'GET') throw new Error(`route ${name}: every route must be a GET (reads only)`);
  if (typeof route.path !== 'string' || !route.path.startsWith('/') || route.path.includes('?') || route.path.includes('//')) throw new Error(`route ${name}: path must be an absolute path without a query`);
  const segments = route.path.split('/').slice(1);
  for (const seg of segments) {
    if (!PATH_SEGMENT.test(seg) || seg === '.' || seg === '..') throw new Error(`route ${name}: bad path segment ${seg}`);
  }
  const params = route.params || {};
  for (const seg of segments.filter((s) => s.startsWith(':'))) {
    if (!(params[seg.slice(1)] instanceof RegExp)) throw new Error(`route ${name}: parameter ${seg} needs a validator`);
  }
  const query = route.query || {};
  for (const [key, check] of Object.entries(query)) {
    if (!(check instanceof RegExp)) throw new Error(`route ${name}: query key ${key} needs a validator`);
  }
  return Object.freeze({ name, method: 'GET', path: route.path, segments: Object.freeze(segments), params: Object.freeze({ ...params }), query: Object.freeze({ ...query }), fixedQuery: Object.freeze({ ...(route.fixedQuery || {}) }) });
}

function hostSpec(host, label) {
  if (!host) throw new Error(`${label}: a host is required`);
  if (host.fixed !== undefined) {
    if (!HOSTNAME.test(host.fixed)) throw new Error(`${label}: fixed host must be a bare hostname`);
    return Object.freeze({ fixed: host.fixed });
  }
  if (!ENV_NAME.test(host.env || '')) throw new Error(`${label}: host env name is required`);
  return Object.freeze({ env: host.env });
}

function defineAdapter(spec) {
  if (!spec || typeof spec.platform !== 'string' || !/^[a-z][a-z0-9-]{1,30}$/.test(spec.platform)) throw new Error('adapter spec needs a platform name');
  const credentials = spec.credentials || [];
  if (!Array.isArray(credentials) || !credentials.length || !credentials.every((n) => ENV_NAME.test(n))) throw new Error('adapter spec needs named credential environment variables');
  if (typeof spec.auth !== 'function') throw new Error('adapter spec needs an auth header builder');
  const routes = {};
  for (const [name, route] of Object.entries(spec.routes || {})) routes[name] = freezeRoute(name, route);
  let graphql = null;
  if (spec.graphql) {
    if (typeof spec.graphql.path !== 'string' || !spec.graphql.path.startsWith('/')) throw new Error('graphql path must be absolute');
    const documents = {};
    for (const [name, doc] of Object.entries(spec.graphql.documents || {})) {
      try { assertQueryOnly(doc); } catch (error) { throw new Error(`graphql document ${name}: ${error.message}`); }
      if (operationNameOf(doc) !== name) throw new Error(`graphql document ${name}: its operation name must be ${name}`);
      documents[name] = doc;
    }
    graphql = Object.freeze({ path: spec.graphql.path, host: spec.graphql.host ? hostSpec(spec.graphql.host, 'graphql') : null, documents: Object.freeze(documents) });
  }
  let tokenExchange = null;
  if (spec.tokenExchange) {
    const t = spec.tokenExchange;
    if (typeof t.path !== 'string' || !t.path.startsWith('/') || t.path.includes('?')) throw new Error('token exchange path must be an absolute path without a query');
    if (!Array.isArray(t.fields) || typeof t.build !== 'function' || typeof t.parse !== 'function') throw new Error('token exchange needs fields, build and parse');
    tokenExchange = Object.freeze({
      path: t.path,
      host: t.host ? hostSpec(t.host, 'token exchange') : null,
      fields: Object.freeze([...t.fields].sort()),
      build: t.build,
      parse: t.parse,
      headers: t.headers || null,
      contentType: t.contentType || 'application/x-www-form-urlencoded',
    });
  }
  // batch G3: how the vendor exposes the scopes or role a credential holds, and which are
  // read-only (scripts/adapters/scope-manifest.json, docs/aegis/g3/scope-manifest.md)
  let scopes = null;
  if (spec.scopes) {
    const s = spec.scopes;
    if (typeof s.manifest !== 'string' || !/^[a-z][a-z0-9-]{1,40}$/.test(s.manifest)) throw new Error('scopes need a manifest entry name');
    if (!['header', 'token', 'route', 'none'].includes(s.kind)) throw new Error('scopes kind is header, token, route or none');
    if (typeof s.vendor !== 'string' || !s.vendor) throw new Error('scopes need the vendor name for the notice');
    if (s.kind !== 'none' && (typeof s.granted !== 'function' || typeof s.allowed !== 'function')) throw new Error('scopes need granted and allowed functions');
    if (s.kind === 'header' && !/^[a-z][a-z0-9-]{1,60}$/.test(s.header || '')) throw new Error('header scopes need a lower-case header name');
    if (s.kind === 'route' && !(s.route in routes)) throw new Error('route scopes need a route of this spec');
    if (s.kind === 'token' && !spec.tokenExchange) throw new Error('token scopes need a token exchange');
    scopes = Object.freeze({ manifest: s.manifest, kind: s.kind, vendor: s.vendor, header: s.header || null, route: s.route || null, granted: s.granted || null, allowed: s.allowed || null });
  }
  // batch G3 close-out: the opt-in rate-limit hook, data only (rateLimitOf reads it)
  let rateLimit = null;
  if (spec.rateLimit) {
    const r = spec.rateLimit;
    const header = /^[a-z][a-z0-9-]{1,60}$/;
    if (!Array.isArray(r.statuses) || !r.statuses.length || !r.statuses.every((s) => s === 403 || s === 429)) throw new Error('rateLimit statuses are 403 and/or 429');
    if (!header.test(r.remainingHeader || '') || !header.test(r.resetHeader || '')) throw new Error('rateLimit needs lower-case remaining and reset header names');
    if (!(r.secondaryMessage instanceof RegExp) || !/^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(r.messageField || '')) throw new Error('rateLimit needs a secondaryMessage pattern and the body field that holds it');
    rateLimit = Object.freeze({ statuses: Object.freeze([...r.statuses]), remainingHeader: r.remainingHeader, resetHeader: r.resetHeader, secondaryMessage: r.secondaryMessage, messageField: r.messageField });
  }
  let tenant = null;
  if (spec.tenant) {
    if (!ENV_NAME.test(spec.tenant.env || '') || typeof spec.tenant.collect !== 'function') throw new Error('tenant binding needs an env name and a collect function');
    tenant = Object.freeze({ env: spec.tenant.env, collect: spec.tenant.collect });
  }
  return Object.freeze({
    platform: spec.platform,
    host: hostSpec(spec.host, 'adapter'),
    credentials: Object.freeze([...credentials]),
    auth: spec.auth,
    routes: Object.freeze(routes),
    graphql,
    tokenExchange,
    tenant,
    scopes,
    rateLimit,
  });
}

// ── Request checks (all run before any credential or network) ────────────────
function resolveHost(hostDef, env) {
  const value = hostDef.fixed !== undefined ? hostDef.fixed : env[hostDef.env];
  if (typeof value !== 'string' || !HOSTNAME.test(value)) {
    throw new RefusedError(hostDef.env ? `${hostDef.env} must be a bare https hostname (no scheme, path, port or trailing dot)` : 'host is not a bare hostname');
  }
  return value;
}

function plainString(value) {
  return typeof value === 'string' && !/[\u0000-\u001f\u007f]/.test(value);
}

function buildRoutePath(route, params = {}, query = {}) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) throw new RefusedError('route parameters must be an object');
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw new RefusedError('route query must be an object');
  for (const key of Object.keys(params)) if (!(key in route.params)) throw new RefusedError(`route ${route.name} has no parameter ${key}`);
  const parts = route.segments.map((seg) => {
    if (!seg.startsWith(':')) return seg;
    const key = seg.slice(1);
    const value = params[key];
    if (!plainString(value) || !route.params[key].test(value) || value === '.' || value === '..') throw new RefusedError(`route ${route.name}: parameter ${key} is not allowed`);
    return encodeURIComponent(value);
  });
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(route.fixedQuery)) search.append(key, value);
  for (const [key, value] of Object.entries(query)) {
    if (!(key in route.query)) throw new RefusedError(`route ${route.name}: query key ${key} is not allowed`);
    if (!plainString(value) || !route.query[key].test(value)) throw new RefusedError(`route ${route.name}: query value for ${key} is not allowed`);
    search.append(key, value);
  }
  const qs = search.toString();
  return `/${parts.join('/')}${qs ? `?${qs}` : ''}`;
}

// Match a raw GET path to one allow-listed route; the canonical path is rebuilt
// from the validated values, so what is sent is what was checked.
function matchRawGet(spec, rawPath) {
  if (!plainString(rawPath) || !rawPath.startsWith('/') || rawPath.startsWith('//') || rawPath.includes('#')) throw new RefusedError('path must be a local absolute path without controls');
  const [pathPart, queryPart = ''] = rawPath.split(/\?(.*)/s);
  const segments = pathPart.split('/').slice(1);
  for (const route of Object.values(spec.routes)) {
    if (route.segments.length !== segments.length) continue;
    const params = {};
    let match = true;
    for (let i = 0; i < segments.length; i += 1) {
      const want = route.segments[i];
      if (want.startsWith(':')) params[want.slice(1)] = segments[i];
      else if (want !== segments[i]) { match = false; break; }
    }
    if (!match) continue;
    const search = new URLSearchParams(queryPart);
    const query = {};
    for (const [key, value] of search) {
      if (key in query) throw new RefusedError('a query key may appear once');
      if (key in route.fixedQuery) { if (value !== route.fixedQuery[key]) throw new RefusedError('fixed query value changed'); continue; }
      query[key] = value;
    }
    return { route, path: buildRoutePath(route, params, query) };
  }
  throw new RefusedError('request is not on the allow-list');
}

function checkVariables(variables) {
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) throw new RefusedError('GraphQL variables must be an object');
  for (const value of Object.values(variables)) {
    const ok = value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || plainString(value);
    if (!ok) throw new RefusedError('GraphQL variables must be plain values');
  }
}

function checkGraphQLBody(spec, body) {
  if (!spec.graphql) throw new RefusedError('this adapter has no GraphQL endpoint');
  let parsed;
  try { parsed = JSON.parse(body); } catch { throw new RefusedError('GraphQL body must be JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new RefusedError('GraphQL body must be one request object');
  for (const key of Object.keys(parsed)) if (!['query', 'variables', 'operationName'].includes(key)) throw new RefusedError('GraphQL body has an unexpected field');
  assertQueryOnly(parsed.query);
  const name = Object.keys(spec.graphql.documents).find((n) => spec.graphql.documents[n] === parsed.query);
  if (!name) throw new RefusedError('GraphQL document is not one of the named query documents');
  if (parsed.operationName !== undefined && parsed.operationName !== name) throw new RefusedError('GraphQL operationName does not match the document');
  checkVariables(parsed.variables === undefined ? {} : parsed.variables);
  return { name, body: JSON.stringify({ query: parsed.query, variables: parsed.variables || {}, operationName: name }) };
}

// The raw door. Every request the client sends passes here first.
function checkRequest(spec, env, request) {
  if (!request || typeof request !== 'object') throw new RefusedError('request must be an object');
  const method = request.method;
  if (typeof method !== 'string') throw new RefusedError('method must be a string');
  const host = resolveHost(spec.host, env);
  if (request.host !== undefined && request.host !== host) throw new RefusedError('request host is not the configured host');
  if (method === 'GET') {
    if (request.body !== undefined && request.body !== null) throw new RefusedError('a GET request carries no body');
    const { route, path } = matchRawGet(spec, request.path);
    return { kind: 'read', method: 'GET', host, path, route: route.name };
  }
  if (method === 'POST' && spec.graphql && request.path === spec.graphql.path) {
    const gqlHost = spec.graphql.host ? resolveHost(spec.graphql.host, env) : host;
    if (request.host !== undefined && request.host !== gqlHost) throw new RefusedError('request host is not the GraphQL host');
    const { name, body } = checkGraphQLBody(spec, request.body);
    return { kind: 'read', method: 'POST', host: gqlHost, path: spec.graphql.path, body, document: name };
  }
  throw new RefusedError('only allow-listed GET reads and named GraphQL queries are sent; every write is a HUMAN-RUN procedure');
}

function checkTokenBody(spec, fields) {
  const keys = Object.keys(fields).sort();
  if (keys.length !== spec.tokenExchange.fields.length || keys.some((k, i) => k !== spec.tokenExchange.fields[i])) {
    throw new RefusedError('token exchange carries only its declared grant fields');
  }
  for (const value of Object.values(fields)) if (!plainString(value)) throw new RefusedError('token exchange fields must be plain values');
}

// An ISO 8601 time with a zone whose date and time fields are real (no 30 February, no
// hour 24). Date.parse rolls impossible dates forward, so it alone is not enough.
const ISO_ZONED_TIME = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.[0-9]{1,9})?)?(?:Z|[+-]([0-9]{2}):([0-9]{2}))$/;
function realCalendarTime(value) {
  const m = typeof value === 'string' ? ISO_ZONED_TIME.exec(value) : null;
  if (!m) return false;
  const [year, month, day, hour, minute] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  const second = m[6] === undefined ? 0 : Number(m[6]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > lastDay || hour > 23 || minute > 59 || second > 59) return false;
  if (m[7] !== undefined && (Number(m[7]) > 14 || Number(m[8]) > 59)) return false;
  return Number.isFinite(Date.parse(value));
}

// ── Transport ────────────────────────────────────────────────────────────────
// The transport takes the request function as a parameter so its limits can be tested
// without a socket. A request that outlives timeoutMs is destroyed (the client stops
// waiting at the same time), so no socket outlives the read; a body over the read limit
// stops with AEGIS_RESPONSE_TOO_LARGE, which the client reports once and does not retry.
function makeHttpsTransport(requestFn) {
  return (request) => new Promise((resolve, reject) => {
    let deadline = null;
    const finish = (fn, value) => { if (deadline) clearTimeout(deadline); deadline = null; fn(value); };
    const req = requestFn({ hostname: request.hostname, path: request.path, method: request.method, headers: request.headers, port: 443 }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES + 1) {
          req.destroy(Object.assign(new Error('response larger than the read limit'), { code: 'AEGIS_RESPONSE_TOO_LARGE' }));
          return;
        }
        chunks.push(chunk);
      });
      res.on('error', (error) => finish(reject, error));
      res.on('end', () => finish(resolve, { status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', (error) => finish(reject, error));
    req.setTimeout(request.timeoutMs, () => req.destroy(new Error('timeout')));
    deadline = setTimeout(() => req.destroy(new Error('timeout')), request.timeoutMs);
    if (request.body !== undefined) req.write(request.body);
    req.end();
  });
}

function httpsTransport(request) {
  if (process.env.AEGIS_NETWORK_TRIPWIRE === '1') throw new TripwireError();
  return makeHttpsTransport((options, onResponse) => https.request(options, onResponse))(request);
}

function withTimeout(promiseFactory, timeoutMs) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve({ timedOut: true }); } }, timeoutMs);
    let started;
    try { started = Promise.resolve(promiseFactory()); } catch (error) { clearTimeout(timer); done = true; reject(error); return; }
    started.then((value) => { if (!done) { done = true; clearTimeout(timer); resolve({ value }); } },
      (error) => { if (!done) { done = true; clearTimeout(timer); reject(error); } });
  });
}

// ── Retry timing (batch G3) ──────────────────────────────────────────────────
// The wait before retry n: the base doubles from 200 ms to a 2 s cap, and the wait is drawn
// from [base/2, base] (equal jitter), so many readers do not retry in step.
function backoffDelay(attempt, random = Math.random) {
  const base = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1));
  const r = Math.min(1, Math.max(0, Number(random()) || 0));
  return Math.round(base / 2 + r * (base / 2));
}

function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return undefined;
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() !== name) continue;
    const v = headers[key];
    return Array.isArray(v) ? String(v[0]) : (v === undefined || v === null ? undefined : String(v));
  }
  return undefined;
}

// Retry-After as milliseconds from now: whole seconds, or an HTTP date (IMF-fixdate). Any
// other form is ignored and the normal backoff applies.
const HTTP_DATE = /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/;
function retryAfterMs(headers, nowMs) {
  const raw = headerValue(headers, 'retry-after');
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (/^\d{1,7}$/.test(value)) return Number(value) * 1000;
  if (HTTP_DATE.test(value)) {
    const at = Date.parse(value);
    if (Number.isFinite(at)) return Math.max(0, at - nowMs);
  }
  return undefined;
}

// The vendor's rate-limit signal on a 403 or 429 (batch G3 close-out, owner decision 3), or
// null when there is none. primary: the remaining header is 0, so the read may run again one
// second after the reset header's time (UTC epoch seconds), or a retry-after the answer
// carries when that is later; when the reset is missing, malformed or already past, the
// retry-after alone, else no usable time.
// secondary: the body's message names the secondary limit; retry-after seconds when present,
// else the reset when remaining is 0 and the reset is usable, else at least one minute (the
// vendor's rule). The body is parsed only to test that message.
const SECONDARY_DEFAULT_WAIT_MS = 60000;
function rateLimitOf(rl, res, nowMs) {
  const remaining = headerValue(res.headers, rl.remainingHeader);
  const exhausted = remaining !== undefined && remaining.trim() === '0';
  let secondary = false;
  try {
    const parsed = typeof res.body === 'string' && res.body.length <= MAX_RESPONSE_BYTES ? JSON.parse(res.body) : null;
    const message = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed[rl.messageField] : null;
    secondary = typeof message === 'string' && rl.secondaryMessage.test(message);
  } catch { secondary = false; }
  if (!exhausted && !secondary) return null;
  // the result carries the spec's own header name, so the operator message names it
  const limit = { kind: secondary ? 'secondary' : 'primary', header: rl.remainingHeader };
  const untilReset = () => {
    const raw = headerValue(res.headers, rl.resetHeader);
    const value = raw === undefined ? '' : raw.trim();
    if (!/^[0-9]{1,12}$/.test(value)) return { limit, waitMs: null, retryAt: null, reset: 'unreadable' };
    const after = Number(value) * 1000 + 1000;
    if (after <= nowMs) return { limit, waitMs: null, retryAt: null, reset: 'past' };
    return { limit, waitMs: after - nowMs, retryAt: Number(value) * 1000 };
  };
  const wait = retryAfterMs(res.headers, nowMs);
  const byRetryAfter = wait === undefined ? null : { limit, waitMs: wait, retryAt: nowMs + wait };
  const byReset = exhausted ? untilReset() : null;
  if (secondary) {
    if (byRetryAfter) return byRetryAfter;
    if (byReset && byReset.waitMs !== null) return byReset;
    return { limit, waitMs: SECONDARY_DEFAULT_WAIT_MS, retryAt: nowMs + SECONDARY_DEFAULT_WAIT_MS };
  }
  // primary: the later of a usable reset and a retry-after, so no retry comes before either
  if (byReset.waitMs === null) return byRetryAfter || byReset;
  return byRetryAfter && byRetryAfter.waitMs > byReset.waitMs ? byRetryAfter : byReset;
}

function requestIdOf(headers) {
  for (const name of REQUEST_ID_HEADERS) {
    const v = headerValue(headers, name);
    if (v !== undefined && REQUEST_ID.test(v)) return v;
  }
  return undefined;
}

// ── Client ───────────────────────────────────────────────────────────────────
function result(state, extra = {}) {
  return { state, ok: state === STATES.OK, ...extra };
}

function createClient(spec, deps = {}) {
  if (!spec || !Object.isFrozen(spec) || !spec.routes) throw new Error('createClient needs a spec from defineAdapter');
  const env = deps.env || process.env;
  const transport = deps.transport || httpsTransport;
  const timeoutMs = Number.isFinite(deps.timeoutMs) && deps.timeoutMs > 0 ? deps.timeoutMs : DEFAULT_TIMEOUT_MS;
  const maxRetries = Math.min(MAX_RETRIES_CAP, Number.isInteger(deps.maxRetries) && deps.maxRetries >= 0 ? deps.maxRetries : DEFAULT_MAX_RETRIES);
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = deps.now || Date.now;
  const random = typeof deps.random === 'function' ? deps.random : Math.random;
  const retryBudgetMs = Number.isFinite(deps.retryBudgetMs) && deps.retryBudgetMs > 0 ? deps.retryBudgetMs : DEFAULT_RETRY_BUDGET_MS;
  const audit = typeof deps.audit === 'function' ? deps.audit : null;
  // batch G3: the scope preflight is on for a person running a CLI (no injected transport)
  // and for any caller that asks; a test transport turns it off unless the test asks.
  const scopePreflight = deps.scopePreflight !== undefined ? deps.scopePreflight === true : !deps.transport;
  let scopeVerdict = null; // null: not checked yet; { ok, notice } or { refused }
  let noticeShown = false;
  let inPreflight = false;
  let token = null;
  let tokenExpiresAt = 0;
  const secrets = [];

  function tenantExpected() {
    if (!spec.tenant) return null;
    const value = env[spec.tenant.env];
    if (!plainString(value) || !value.trim()) throw new RefusedError(`${spec.tenant.env} must name this deployment's tenant before any read`);
    return value;
  }

  function loadCredentials() {
    const creds = {};
    const missing = [];
    for (const name of spec.credentials) {
      const value = env[name];
      if (typeof value !== 'string' || !value.length) missing.push(name);
      else creds[name] = value;
    }
    for (const value of Object.values(creds)) if (!secrets.includes(value)) secrets.push(value);
    return { creds, missing };
  }

  // One transport attempt, with the client's own timeout; errors become states.
  async function attempt(request) {
    let outcome;
    try {
      outcome = await withTimeout(() => transport({ ...request, timeoutMs }), timeoutMs);
    } catch (error) {
      if (error instanceof TripwireError || (error && error.message === TRIPWIRE_MESSAGE)) throw new TripwireError();
      if (error && error.code === 'AEGIS_RESPONSE_TOO_LARGE') return result(STATES.INVALID_RESPONSE, { error: 'response larger than the read limit' });
      return result(STATES.NETWORK_ERROR, { error: 'network error (details withheld)' });
    }
    if (outcome.timedOut) return result(STATES.TIMEOUT, { error: `no response within ${timeoutMs} ms` });
    const res = outcome.value;
    if (!res || !Number.isInteger(res.status)) return result(STATES.INVALID_RESPONSE, { error: 'transport returned no status' });
    // the request id and Retry-After are read from the headers; the headers themselves never
    // leave this function
    const meta = {};
    const id = requestIdOf(res.headers);
    if (id !== undefined) meta.request_id = id;
    if (spec.scopes && spec.scopes.kind === 'header') meta.scopeHeader = headerValue(res.headers, spec.scopes.header);
    if (res.status < 200 || res.status >= 300) {
      const wait = res.status === 429 || res.status === 503 ? retryAfterMs(res.headers, now()) : undefined;
      const limited = spec.rateLimit && spec.rateLimit.statuses.includes(res.status) ? rateLimitOf(spec.rateLimit, res, now()) : null;
      return result(STATES.HTTP_ERROR, { status: res.status, ...meta, error: `HTTP ${res.status} (body withheld)`, ...(wait !== undefined ? { retryAfterMs: wait } : {}), ...(limited ? { rateLimit: limited } : {}) });
    }
    const body = typeof res.body === 'string' ? res.body : '';
    if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) return result(STATES.INVALID_RESPONSE, { status: res.status, ...meta, error: 'response larger than the read limit' });
    let json;
    try { json = JSON.parse(body); } catch { return result(STATES.INVALID_RESPONSE, { status: res.status, ...meta, error: 'response is not JSON (body withheld)' }); }
    return result(STATES.OK, { status: res.status, ...meta, json });
  }

  // One connector-call entry per request (batch G3). The entry holds names, a state and
  // numbers only. A sink that throws turns the answer into AUDIT_FAILED: no data is
  // returned without its record.
  function record(operation, r, attempts, startedAt) {
    if (!audit) return null;
    try {
      audit({
        kind: 'connector-call',
        connector: spec.platform,
        operation,
        state: r.state,
        attempts,
        status: Number.isInteger(r.status) ? r.status : null,
        request_id: typeof r.request_id === 'string' ? r.request_id : null,
        handoff: r.handoff && typeof r.handoff.state === 'string' ? r.handoff.state : null,
        duration_ms: Math.max(0, Math.round(now() - startedAt)),
      });
      return null;
    } catch {
      return result(STATES.AUDIT_FAILED, { attempts, error: 'the audit trail could not record this request, so its answer is withheld' });
    }
  }

  // The public shape of a failed attempt: internal timing fields dropped.
  function failure(r, attempts, extra = {}) {
    const { retryAfterMs: _wait, json: _json, scopeHeader: _scopes, rateLimit: _limit, ...rest } = r;
    return { ...rest, attempts, ...extra };
  }

  // The scope verdict from what the vendor exposed: null or undefined means it exposed
  // nothing readable (a notice on first use); otherwise every granted scope or role must be
  // one the manifest allows, or the credential is refused for this client.
  function judgeScopes(granted, where) {
    if (granted === null || granted === undefined) {
      return { ok: true, notice: `${spec.scopes.vendor} did not return the granted scopes ${where}, so Aegis could not check that this credential is read-only; use a credential with exactly the read scopes in docs/aegis/g3/scope-manifest.md` };
    }
    const beyond = granted.filter((s) => !spec.scopes.allowed(s));
    if (!beyond.length) return { ok: true, notice: null };
    return {
      refused: result(STATES.SCOPE_REFUSED, {
        write_scopes: beyond,
        error: `this credential holds scopes or roles beyond the read-only manifest (${beyond.join(', ')}); Aegis does not use it`,
      }),
    };
  }

  function notExposedNotice() {
    return `${spec.scopes.vendor} does not expose which scopes or role this credential holds, so Aegis cannot prove it is read-only; use a credential with exactly the read scopes in docs/aegis/g3/scope-manifest.md`;
  }

  // A refusal judged from the token response or the who-am-I read is its own audit entry
  // (operation scope-preflight); the call before it was recorded with its own state.
  function recordRefusal(startedAt) {
    const refused = { ...scopeVerdict.refused, attempts: 0 };
    return record('scope-preflight', refused, 0, startedAt) || refused;
  }

  // Attaches the first-use notice to the first result of this client.
  function withNotice(res) {
    if (!scopePreflight || !spec.scopes || noticeShown || !scopeVerdict || !scopeVerdict.notice) return res;
    noticeShown = true;
    return { ...res, scope_notice: scopeVerdict.notice };
  }

  const retryable = (r) => r.state === STATES.TIMEOUT || r.state === STATES.NETWORK_ERROR || (r.state === STATES.HTTP_ERROR && (r.status === 429 || r.status >= 500));

  async function ensureToken(creds) {
    if (!spec.tokenExchange) return null;
    if (token && now() < tokenExpiresAt) return token;
    const fields = spec.tokenExchange.build(creds);
    checkTokenBody(spec, fields);
    const host = spec.tokenExchange.host ? resolveHost(spec.tokenExchange.host, env) : resolveHost(spec.host, env);
    const body = spec.tokenExchange.contentType === 'application/json' ? JSON.stringify(fields) : new URLSearchParams(fields).toString();
    const headers = { 'Content-Type': spec.tokenExchange.contentType, Accept: 'application/json', ...(spec.tokenExchange.headers ? spec.tokenExchange.headers(creds) : {}) };
    // The token exchange is not a read: one attempt, never retried.
    const startedAt = now();
    const r = await attempt({ hostname: host, path: spec.tokenExchange.path, method: 'POST', headers, body });
    const audited = record('token-exchange', r, 1, startedAt);
    if (audited) return { failed: audited };
    if (!r.ok) return { failed: failure(r, 1) };
    let parsed;
    try { parsed = spec.tokenExchange.parse(r.json); } catch { parsed = null; }
    if (!parsed || !plainString(parsed.token) || !parsed.token) return { failed: result(STATES.INVALID_RESPONSE, { error: 'token exchange returned no token' }) };
    if (scopePreflight && spec.scopes && spec.scopes.kind === 'token' && !scopeVerdict) {
      let granted = null;
      try { granted = spec.scopes.granted(r.json); } catch { granted = null; }
      scopeVerdict = judgeScopes(granted, 'in the token response');
      if (scopeVerdict.refused) return { failed: recordRefusal(startedAt) };
    }
    token = parsed.token;
    if (!secrets.includes(token)) secrets.push(token);
    // Refresh before the vendor's own expiry: a quarter of the lifetime early, at most
    // 60 s early; a lifetime the response does not state is taken as 300 s.
    const life = Number.isFinite(parsed.expiresInSeconds) && parsed.expiresInSeconds > 0 ? parsed.expiresInSeconds : 300;
    tokenExpiresAt = now() + (life - Math.min(60, life / 4)) * 1000;
    return token;
  }

  async function perform(checked) {
    const expectedTenant = tenantExpected();
    if (scopeVerdict && scopeVerdict.refused) return scopeVerdict.refused;
    const { creds, missing } = loadCredentials();
    if (missing.length) {
      // batch G3 (task 6b): a failure that never reaches the network is on the trail too
      const res = result(STATES.NO_CREDENTIALS, { error: `missing credential environment variable(s): ${missing.join(', ')}` });
      return record(checked.route || checked.document || 'read', res, 0, now()) || res;
    }
    if (scopePreflight && spec.scopes && !scopeVerdict && !inPreflight) {
      if (spec.scopes.kind === 'none') scopeVerdict = { ok: true, notice: notExposedNotice() };
      if (spec.scopes.kind === 'route') {
        // the vendor's own "who am I" read comes first; its answer decides
        const startedAt = now();
        inPreflight = true;
        let pre;
        try { pre = await perform(routeRequest(spec.scopes.route, {}, {})); } finally { inPreflight = false; }
        if (!pre.ok) return pre;
        let granted = null;
        try { granted = spec.scopes.granted(pre.data); } catch { granted = null; }
        scopeVerdict = judgeScopes(granted, `from ${spec.scopes.route}`);
        if (scopeVerdict.refused) return recordRefusal(startedAt);
      }
    }
    const tokenOrFail = await ensureToken(creds);
    if (tokenOrFail && tokenOrFail.failed) return tokenOrFail.failed;
    const headers = { Accept: 'application/json', ...spec.auth(creds, tokenOrFail) };
    if (checked.body !== undefined) headers['Content-Type'] = 'application/json';
    const request = { hostname: checked.host, path: checked.path, method: checked.method, headers, body: checked.body };
    const operation = checked.route || checked.document || 'read';
    const startedAt = now();
    let r;
    let attempts = 0;
    let handoff = null;
    for (;;) {
      attempts += 1;
      r = await attempt(request);
      if (r.ok) break;
      // batch G3 close-out: a vendor rate limit is waited out only when the vendor's own wait
      // is known, within the cap, and fits the retry count and budget; otherwise it hands off
      // at once, so a limited read never turns into a burst of retries
      if (r.rateLimit) {
        const w = r.rateLimit.waitMs;
        const fits = w !== null && w >= 0 && w <= MAX_RETRY_AFTER_MS && attempts <= maxRetries && now() - startedAt + w + timeoutMs <= retryBudgetMs;
        if (!fits) { handoff = { state: HANDOFF.RATE_LIMITED, rateLimit: r.rateLimit }; break; }
        await sleep(w);
        continue;
      }
      if (!retryable(r)) break;
      if (attempts > maxRetries) { handoff = { state: HANDOFF.RETRIES_EXHAUSTED }; break; }
      let wait;
      if (r.retryAfterMs !== undefined) {
        if (r.retryAfterMs > MAX_RETRY_AFTER_MS) {
          handoff = { state: HANDOFF.RETRY_AFTER_TOO_LONG, retryAfterSeconds: Math.ceil(r.retryAfterMs / 1000) };
          break;
        }
        wait = r.retryAfterMs;
      } else {
        wait = backoffDelay(attempts, random);
      }
      // a retry is made only when its wait and one more full attempt still fit in the budget
      if (now() - startedAt + wait + timeoutMs > retryBudgetMs) { handoff = { state: HANDOFF.RETRY_BUDGET_SPENT }; break; }
      await sleep(wait);
    }
    if (!r.ok) {
      const base = failure(r, attempts);
      if (handoff) {
        base.handoff = handoffFor(handoff.state, base, { platform: spec.platform, retryAfterSeconds: handoff.retryAfterSeconds, budgetMs: retryBudgetMs, rateLimit: handoff.rateLimit });
      }
      return record(operation, base, attempts, startedAt) || base;
    }
    if (scopePreflight && spec.scopes && spec.scopes.kind === 'header' && !scopeVerdict && !inPreflight) {
      let granted = null;
      try { granted = r.scopeHeader === undefined ? null : spec.scopes.granted(r.scopeHeader); } catch { granted = null; }
      scopeVerdict = judgeScopes(granted, `in the ${spec.scopes.header} header`);
      if (scopeVerdict.refused) {
        const refused = { ...scopeVerdict.refused, attempts, status: r.status };
        return record(operation, refused, attempts, startedAt) || refused;
      }
    }
    const audited = record(operation, r, attempts, startedAt);
    if (audited) return audited;
    let ids = [];
    if (spec.tenant) {
      try { ids = spec.tenant.collect(r.json) || []; } catch { return result(STATES.INVALID_RESPONSE, { attempts, error: 'tenant fields unreadable' }); }
      if (!Array.isArray(ids) || ids.some((id) => id !== expectedTenant)) {
        return result(STATES.TENANT_MISMATCH, { attempts, error: `a record in the response belongs to another tenant than ${spec.tenant.env}; nothing is returned` });
      }
    }
    const data = redactDeep(r.json, secrets);
    return withNotice(result(STATES.OK, { status: r.status, attempts, ...(r.request_id ? { request_id: r.request_id } : {}), data, flags: scanUntrusted(data) }));
  }

  async function run(fn) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof TripwireError) throw error;
      if (error instanceof RefusedError) {
        // recorded under a fixed operation name, so refused input never enters the trail
        const res = result(STATES.REFUSED, { error: redactString(error.message, secrets) });
        return record('refused-request', res, 0, now()) || res;
      }
      return result(STATES.INVALID_RESPONSE, { error: 'unexpected adapter error (details withheld)' });
    }
  }

  // get() and plan() validate the route's own parameters and build the encoded path
  // once; they do not send that encoded path back through the raw-path check, which
  // would test '%40' against a rule written for '@'. A raw send() stays strict.
  function routeRequest(routeName, params, query) {
    const route = Object.prototype.hasOwnProperty.call(spec.routes, routeName) ? spec.routes[routeName] : null;
    if (!route) throw new RefusedError(`route ${routeName} is not on the allow-list`);
    return { kind: 'read', method: 'GET', host: resolveHost(spec.host, env), path: buildRoutePath(route, params, query), route: route.name };
  }

  return {
    platform: spec.platform,
    send: (request) => run(() => perform(checkRequest(spec, env, request))),
    get: (routeName, params = {}, query = {}) => run(() => perform(routeRequest(routeName, params, query))),
    graphql: (name, variables = {}) => run(() => {
      if (!spec.graphql || !Object.prototype.hasOwnProperty.call(spec.graphql.documents, name)) throw new RefusedError(`GraphQL document ${name} is not defined`);
      checkVariables(variables);
      const body = JSON.stringify({ query: spec.graphql.documents[name], variables, operationName: name });
      return perform(checkRequest(spec, env, { method: 'POST', path: spec.graphql.path, body }));
    }),
    plan: (routeName, params = {}, query = {}) => {
      try {
        const checked = routeRequest(routeName, params, query);
        return { state: STATES.OK, ok: true, method: checked.method, host: checked.host, path: checked.path, note: 'dry run: no credentials read, no network' };
      } catch (error) {
        if (error instanceof RefusedError) return result(STATES.REFUSED, { error: error.message });
        throw error;
      }
    },
    planGraphql: (name, variables = {}) => {
      try {
        if (!spec.graphql || !Object.prototype.hasOwnProperty.call(spec.graphql.documents, name)) throw new RefusedError(`GraphQL document ${name} is not defined`);
        checkVariables(variables);
        const body = JSON.stringify({ query: spec.graphql.documents[name], variables, operationName: name });
        const checked = checkRequest(spec, env, { method: 'POST', path: spec.graphql.path, body });
        return { state: STATES.OK, ok: true, method: 'POST', host: checked.host, path: checked.path, document: name, variables, note: 'dry run: no credentials read, no network' };
      } catch (error) {
        if (error instanceof RefusedError) return result(STATES.REFUSED, { error: error.message });
        throw error;
      }
    },
  };
}

// ── Rendering for adapter CLIs ───────────────────────────────────────────────
// Untrusted text stays inside JSON strings; flagged fields are listed with their
// path and a quoted excerpt, and a fixed line says they were not followed.
// Batch G3: a failed result (any state but OK, or a read-back that did not verify) also
// carries the two-part message every connector prints: operator_message (what happened,
// what was not done, the next step) and admin_detail (platform, operation, state, status,
// attempts, request id, handoff). Both come from operator-message.js: fixed text and the
// result's own checked fields.
function renderResult(res, { secrets = [], platform, operation } = {}) {
  let shown = res;
  if (isFailure(res)) {
    const m = operatorMessage(res, { platform, operation: operation || res.command });
    shown = { ...res, operator_message: m.operator, admin_detail: m.admin };
  }
  const safe = redactDeep(shown, secrets);
  const lines = [JSON.stringify(safe, null, 2)];
  if (Array.isArray(safe.flags) && safe.flags.length) {
    lines.push(`WARNING: ${safe.flags.length} field(s) carry instruction-like text. It is vendor data, quoted below, and was not followed:`);
    for (const f of safe.flags) lines.push(`  ${f.path} [${f.markers.join(', ')}] ${f.quote}`);
  }
  return `${lines.join('\n')}\n`;
}

// Exit codes shared by every adapter CLI and the Jira client. VERIFY_DRY_RUN (batch G3
// close-out, owner decision 2): a verify-* dry run reads nothing, so it proves nothing, and it
// never exits with 0, the code of a passed read-back.
const EXIT = Object.freeze({ OK: 0, INPUT: 1, READ_FAILED: 2, TENANT: 3, VERIFY_DRY_RUN: 4 });
const NOT_VERIFIED_DRY_RUN = 'NOT VERIFIED: a dry run reads nothing, so it proves nothing (exit 4).';
const isVerifyCommand = (command) => typeof command === 'string' && /^verify-[a-z0-9-]{1,48}$/.test(command);

// The exit code of a dry run whose plan was printed: a verify-* command also prints the NOT
// VERIFIED line (on stderr, so the planned request on stdout stays one JSON object) and exits
// VERIFY_DRY_RUN; a plain read's dry run exits OK.
function dryRunExit(command, err) {
  if (!isVerifyCommand(command)) return EXIT.OK;
  err(`${NOT_VERIFIED_DRY_RUN}\n`);
  return EXIT.VERIFY_DRY_RUN;
}

function exitCodeFor(res) {
  if (!res) return EXIT.READ_FAILED;
  if (res.state === STATES.OK) return res.verified === false ? EXIT.READ_FAILED : EXIT.OK;
  if (res.state === STATES.REFUSED || res.state === STATES.NO_CREDENTIALS || res.state === STATES.SCOPE_REFUSED) return EXIT.INPUT;
  if (res.state === STATES.TENANT_MISMATCH) return EXIT.TENANT;
  return EXIT.READ_FAILED;
}

// Minimal flag parser for adapter CLIs: --name value pairs and the bare --execute.
function parseArgs(argv, { values = [], booleans = ['execute'] } = {}) {
  const [command, ...rest] = argv;
  const args = { _command: command };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) throw new RefusedError(`unexpected argument ${JSON.stringify(token).slice(0, 60)}`);
    const name = token.slice(2);
    if (booleans.includes(name)) { args[name] = true; continue; }
    if (!values.includes(name)) throw new RefusedError(`unknown flag --${name.slice(0, 40)}`);
    if (i + 1 >= rest.length || rest[i + 1].startsWith('--')) throw new RefusedError(`--${name} needs a value`);
    if (name in args) throw new RefusedError(`--${name} may appear once`);
    args[name] = rest[i + 1];
    i += 1;
  }
  return args;
}

module.exports = {
  STATES, EXIT, HANDOFF, MAX_RESPONSE_BYTES, TRIPWIRE_MESSAGE, MAX_RETRY_AFTER_MS, DEFAULT_RETRY_BUDGET_MS, backoffDelay,
  RefusedError, TripwireError,
  defineAdapter, createClient, checkRequest, assertQueryOnly, scanUntrusted, markersIn,
  renderResult, exitCodeFor, parseArgs, redactDeep, httpsTransport, makeHttpsTransport, realCalendarTime,
  NOT_VERIFIED_DRY_RUN, isVerifyCommand, dryRunExit,
};
