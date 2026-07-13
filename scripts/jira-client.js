#!/usr/bin/env node
/**
 * jira-client.js — Jira Service Management Cloud integration for Aegis.
 *
 * Turns an Aegis ticket work-up into a real JSM request, adds a resolution
 * comment, or reads request status — from the terminal. Zero npm deps (built-in
 * https only), matching the other scripts in this repo.
 *
 * API: JSM Cloud REST, POST /rest/servicedeskapi/request (the service-desk API,
 * NOT core /rest/api/3/issue — the latter bypasses request types and the portal).
 * Auth: HTTP Basic, base64(email:apiToken).
 *
 * Config — environment variables only (never hardcode; never commit a token):
 *   JIRA_SITE              e.g. your-domain.atlassian.net   (required)
 *   JIRA_EMAIL            the API-token owner's email        (required)
 *   JIRA_API_TOKEN        from id.atlassian.com/manage-profile/security/api-tokens (required)
 *   JIRA_SERVICE_DESK_ID  default service desk id            (optional; or pass --service-desk)
 *   JIRA_REQUEST_TYPE_ID  default request type id            (optional; or pass --request-type)
 *
 * SAFETY: dry-run by default. Every command prints the exact request it WOULD
 * send and exits without calling the API unless bare --execute is passed. Status
 * transitions additionally require bare --confirm (destructive-action gate:
 * moving a ticket is visible to the reporter and can fire automations/SLAs).
 * Boolean flags accept no value; false-looking or equals forms are rejected.
 *
 *   node scripts/jira-client.js list-desks
 *   node scripts/jira-client.js list-types --service-desk 12
 *   node scripts/jira-client.js create --summary "..." --description "..." [--execute]
 *   node scripts/jira-client.js comment --issue HELP-123 --body "..." [--public] [--execute]
 *   node scripts/jira-client.js get --issue HELP-123 [--execute]
 *   node scripts/jira-client.js transition --issue HELP-123 --to "Resolved" --execute --confirm
 *
 * Exit codes: 0 success / dry-run · 1 usage or config error · 2 API error.
 */

'use strict';

const https = require('https');

const REQUEST_TIMEOUT_MS = 15000;
const BOOLEAN_FLAGS = new Set(['execute', 'confirm', 'public']);
const VALUE_FLAGS = new Set([
  'service-desk',
  'request-type',
  'summary',
  'description',
  'on-behalf-of',
  'issue',
  'body',
  'to',
]);
const KNOWN_FLAGS = new Set([...BOOLEAN_FLAGS, ...VALUE_FLAGS]);

// ── Output helpers (this is a CLI — stdout is the product) ────────────────────
const out = (...a) => process.stdout.write(a.join(' ') + '\n');
const err = (...a) => process.stderr.write(a.join(' ') + '\n');

// ── Config from environment ───────────────────────────────────────────────────
function loadConfig(env = process.env) {
  const cfg = {
    site: env.JIRA_SITE,
    email: env.JIRA_EMAIL,
    token: env.JIRA_API_TOKEN,
    serviceDeskId: env.JIRA_SERVICE_DESK_ID || null,
    requestTypeId: env.JIRA_REQUEST_TYPE_ID || null,
  };
  const required = [
    ['site', 'JIRA_SITE'],
    ['email', 'JIRA_EMAIL'],
    ['token', 'JIRA_API_TOKEN'],
  ];
  const missing = required.filter(([key]) => !cfg[key]).map(([, envName]) => envName);
  return { cfg, missing };
}

// ── Minimal arg parser: --flag value, --bool ──────────────────────────────────
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      if (a === '--' || a.startsWith('---')) {
        throw new Error(`Malformed flag: ${a}`);
      }
      if (a.includes('=')) {
        throw new Error(`Flag values must be separate arguments; ${a} is not allowed`);
      }
      const key = a.slice(2);
      if (!KNOWN_FLAGS.has(key)) {
        throw new Error(`Unknown flag: --${key}`);
      }
      if (Object.prototype.hasOwnProperty.call(args, key)) {
        throw new Error(`Duplicate flag: --${key}`);
      }
      const next = argv[i + 1];
      if (BOOLEAN_FLAGS.has(key)) {
        if (next !== undefined && !next.startsWith('--')) {
          throw new Error(`Boolean flag --${key} accepts no value`);
        }
        args[key] = true;
        continue;
      }
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`Flag --${key} requires a value`);
      }
      args[key] = next;
      i++;
    } else {
      args._.push(a);
    }
  }
  return args;
}

// ── HTTPS request (returns {status, body, json}) ──────────────────────────────
function apiRequest(cfg, method, apiPath, payload, timeoutMs = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const auth = Buffer.from(`${cfg.email}:${cfg.token}`).toString('base64');
    const opts = {
      hostname: cfg.site,
      path: apiPath,
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    let timer;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const req = https.request(opts, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('error', fail);
      res.on('end', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch { /* non-JSON body */ }
        resolve({ status: res.statusCode, body: raw, json });
      });
    });
    req.on('error', fail);
    timer = setTimeout(() => {
      if (settled) return;
      const timeoutError = new Error(`Jira API request timed out after ${timeoutMs}ms`);
      req.destroy(timeoutError);
      fail(timeoutError);
    }, timeoutMs);
    if (data) req.write(data);
    req.end();
  });
}

// ── Payload builders (pure — unit-testable without network) ───────────────────
function buildCreatePayload({ serviceDeskId, requestTypeId, summary, description, raiseOnBehalfOf }) {
  if (!serviceDeskId) throw new Error('serviceDeskId required (env JIRA_SERVICE_DESK_ID or --service-desk)');
  if (!requestTypeId) throw new Error('requestTypeId required (env JIRA_REQUEST_TYPE_ID or --request-type)');
  if (!summary) throw new Error('summary required (--summary)');
  const payload = {
    serviceDeskId: String(serviceDeskId),
    requestTypeId: String(requestTypeId),
    requestFieldValues: {
      summary,
      description: description || '',
    },
  };
  // raiseOnBehalfOf takes the reporter's accountId or email — never invent one;
  // only set it when the operator supplies a real, sanitized value.
  if (raiseOnBehalfOf) payload.raiseOnBehalfOf = raiseOnBehalfOf;
  return payload;
}

function buildCommentPayload({ body, isPublic }) {
  if (!body) throw new Error('comment body required (--body)');
  return { body, public: isPublic === true };
}

function isSuccessfulStatus(status) {
  return Number.isInteger(status) && status >= 200 && status < 300;
}

function reportApiFailure(response) {
  const status = response && Number.isInteger(response.status) ? response.status : 'unknown';
  err(`Jira API request failed (HTTP ${status}); response body withheld.`);
  return 2;
}

// ── Command handlers ──────────────────────────────────────────────────────────
async function cmdListDesks(cfg, args) {
  if (args.execute !== true) {
    out('DRY RUN — would GET /rest/servicedeskapi/servicedesk');
    out('Add --execute to call the API.');
    return 0;
  }
  const res = await apiRequest(cfg, 'GET', '/rest/servicedeskapi/servicedesk');
  if (!isSuccessfulStatus(res.status)) return reportApiFailure(res);
  for (const d of res.json.values || []) out(`  id=${d.id}  key=${d.projectKey}  name=${d.projectName}`);
  return 0;
}

async function cmdListTypes(cfg, args) {
  const sd = args['service-desk'] || cfg.serviceDeskId;
  if (!sd) { err('service desk id required (--service-desk or JIRA_SERVICE_DESK_ID)'); return 1; }
  const apiPath = `/rest/servicedeskapi/servicedesk/${encodeURIComponent(sd)}/requesttype`;
  if (args.execute !== true) { out(`DRY RUN — would GET ${apiPath}`); out('Add --execute to call the API.'); return 0; }
  const res = await apiRequest(cfg, 'GET', apiPath);
  if (!isSuccessfulStatus(res.status)) return reportApiFailure(res);
  for (const t of res.json.values || []) out(`  id=${t.id}  name=${t.name}`);
  return 0;
}

async function cmdCreate(cfg, args) {
  const payload = buildCreatePayload({
    serviceDeskId: args['service-desk'] || cfg.serviceDeskId,
    requestTypeId: args['request-type'] || cfg.requestTypeId,
    summary: args.summary,
    description: args.description,
    raiseOnBehalfOf: args['on-behalf-of'],
  });
  if (args.execute !== true) {
    out('DRY RUN — would POST /rest/servicedeskapi/request');
    out(JSON.stringify(payload, null, 2));
    out('Add --execute to create the request.');
    return 0;
  }
  const res = await apiRequest(cfg, 'POST', '/rest/servicedeskapi/request', payload);
  if (!isSuccessfulStatus(res.status)) return reportApiFailure(res);
  out(`Created ${res.json.issueKey} — ${res.json._links && res.json._links.web ? res.json._links.web : '(no link)'}`);
  return 0;
}

async function cmdComment(cfg, args) {
  if (!args.issue) { err('--issue required'); return 1; }
  const payload = buildCommentPayload({ body: args.body, isPublic: args.public });
  const apiPath = `/rest/servicedeskapi/request/${encodeURIComponent(args.issue)}/comment`;
  if (args.execute !== true) {
    out(`DRY RUN — would POST ${apiPath}`);
    out(JSON.stringify(payload, null, 2));
    out(`Visibility: ${payload.public ? 'PUBLIC (reporter sees it)' : 'internal'}. Add --execute to post.`);
    return 0;
  }
  const res = await apiRequest(cfg, 'POST', apiPath, payload);
  if (!isSuccessfulStatus(res.status)) return reportApiFailure(res);
  out(`Comment added to ${args.issue}.`);
  return 0;
}

async function cmdGet(cfg, args) {
  if (!args.issue) { err('--issue required'); return 1; }
  const apiPath = `/rest/servicedeskapi/request/${encodeURIComponent(args.issue)}`;
  if (args.execute !== true) { out(`DRY RUN — would GET ${apiPath}`); out('Add --execute to read.'); return 0; }
  const res = await apiRequest(cfg, 'GET', apiPath);
  if (!isSuccessfulStatus(res.status)) return reportApiFailure(res);
  const r = res.json;
  out(`${r.issueKey}  status=${r.currentStatus && r.currentStatus.status}  type=${r.requestType && r.requestType.name}`);
  return 0;
}

async function cmdTransition(cfg, args) {
  if (!args.issue) { err('--issue required'); return 1; }
  if (!args.to) { err('--to <status name or transition id> required'); return 1; }
  const apiPath = `/rest/servicedeskapi/request/${encodeURIComponent(args.issue)}/transition`;
  // ⚠️ Destructive-action gate: a transition is reporter-visible and can fire
  // SLAs/automations. Dry-run unless BOTH --execute and --confirm are present.
  if (args.execute !== true || args.confirm !== true) {
    out(`⚠️  TRANSITION is a state change on ${args.issue} → "${args.to}"`);
    out(`DRY RUN — would POST ${apiPath}`);
    out('Requires BOTH --execute AND --confirm to proceed (reporter-visible; may fire SLAs/automations).');
    return 0;
  }
  // The transition id must be resolved first; we look it up to fail loudly on a bad name.
  const list = await apiRequest(cfg, 'GET', apiPath);
  if (!isSuccessfulStatus(list.status)) return reportApiFailure(list);
  const match = (list.json.values || []).find(
    (t) => t.id === String(args.to) || (t.name && t.name.toLowerCase() === String(args.to).toLowerCase())
  );
  if (!match) {
    err(`No transition "${args.to}" available for ${args.issue}. Available: ${(list.json.values || []).map((t) => t.name).join(', ')}`);
    return 2;
  }
  const res = await apiRequest(cfg, 'POST', apiPath, { id: match.id });
  if (!isSuccessfulStatus(res.status)) return reportApiFailure(res);
  out(`Transitioned ${args.issue} → ${match.name}.`);
  return 0;
}

const COMMANDS = {
  'list-desks': cmdListDesks,
  'list-types': cmdListTypes,
  create: cmdCreate,
  comment: cmdComment,
  get: cmdGet,
  transition: cmdTransition,
};

async function run(argv = process.argv.slice(2), env = process.env) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    err(`Argument error: ${e.message}`);
    return 1;
  }
  const command = args._[0];
  if (!command || !COMMANDS[command] || args._.length !== 1) {
    err('Usage: node scripts/jira-client.js <list-desks|list-types|create|comment|get|transition> [flags]');
    err('See the header of this file for flags and env vars. Dry-run by default; add --execute to call the API.');
    return 1;
  }
  const { cfg, missing } = loadConfig(env);
  // Only hard-require config when this invocation will actually hit the network.
  // transition is double-gated (execute AND confirm); everything else needs execute.
  const willCallApi = command === 'transition'
    ? args.execute === true && args.confirm === true
    : args.execute === true;
  if (willCallApi && missing.length) {
    err(`Missing required env vars: ${missing.join(', ')}`);
    err('Set them in your shell (never commit a token). See file header.');
    return 1;
  }
  try {
    return await COMMANDS[command](cfg, args);
  } catch (e) {
    err(`Error: ${e.message}`);
    return 1;
  }
}

// Run only when invoked directly; export pure builders for tests.
if (require.main === module) {
  run().then((code) => process.exit(code)).catch((e) => { err(String(e)); process.exit(1); });
}

module.exports = {
  REQUEST_TIMEOUT_MS,
  apiRequest,
  buildCreatePayload,
  buildCommentPayload,
  isSuccessfulStatus,
  parseArgs,
  loadConfig,
  run,
};
