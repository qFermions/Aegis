'use strict';
// sim/vendors.js: answers a connector's requests from the simulated tenant file, through the same
// transport seam the connector tests use. The connector's own code builds each request, checks it
// against its allow-list and judges the answer; only the wire is replaced. This file reads the tenant
// and opens no socket: a request it has no answer for gets a 404, so a verdict is never made up here.
//
// The simulated credentials are generated in memory for one run and never stored. They exist because
// the connectors' token exchanges sign with a real key shape; no vendor ever sees them.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ADAPTERS = path.join(__dirname, '..', '..', 'adapters');
const FILLER = 'simulated-read-value-no-vendor-sees';

let pem = null;
const simKey = () => {
  if (!pem) pem = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  return pem;
};

// connector name, as a change record names it, to its client module and simulated credentials.
const CONNECTORS = Object.freeze({
  msgraph: { module: 'msgraph-client.js', credentials: () => ({ MS_PRIVATE_KEY: simKey(), MS_CERT_SHA256: crypto.createHash('sha256').update('simulated certificate').digest('base64url') }) },
  okta: { module: 'okta-client.js', credentials: () => ({ OKTA_PRIVATE_KEY: simKey() }) },
  github: { module: 'github-client.js', credentials: () => ({ GITHUB_TOKEN: FILLER }) },
  'google-workspace': { module: 'gws-client.js', credentials: () => ({ GWS_SA_PRIVATE_KEY: simKey() }) },
  linear: { module: 'linear-client.js', credentials: () => ({ LINEAR_API_KEY: FILLER }) },
  jamf: { module: 'jamf-client.js', credentials: () => ({ JAMF_CLIENT_SECRET: FILLER }) },
  slack: { module: 'slack-client.js', credentials: () => ({ SLACK_TOKEN: FILLER }) },
});

const connectorModule = (name) => (CONNECTORS[name] ? require(path.join(ADAPTERS, CONNECTORS[name].module)) : null);
const simulatedCredentials = (name) => (CONNECTORS[name] ? CONNECTORS[name].credentials() : {});

const reply = (status, body) => ({ status, headers: {}, body: JSON.stringify(body) });
const ok = (body) => reply(200, body);
const notFound = () => reply(404, { message: 'Not Found (simulated tenant)' });
const token = (extra = {}) => ok({ token_type: 'Bearer', expires_in: 3599, access_token: FILLER, ...extra });

const SEGMENT = (p) => decodeURIComponent(p);
// One filter value from a request's query, such as hardware.serialNumber=="X", or null.
const filterValue = (req, field) => {
  const q = String(req.path).split('?')[1] || '';
  const filter = new URLSearchParams(q).get('filter') || '';
  const m = new RegExp(`${field.replace(/\./g, '\\.')}=="([^"]+)"`).exec(filter);
  return m ? m[1] : null;
};

const ROUTES = {
  msgraph(state, req, p) {
    if (req.method === 'POST') return token();
    const g = state.msgraph;
    let m = /^\/v1\.0\/users\/([^/]+)\/authentication\/methods$/.exec(p);
    if (m) return g.users[SEGMENT(m[1])] || g.methods[SEGMENT(m[1])] ? ok({ value: g.methods[SEGMENT(m[1])] }) : notFound();
    m = /^\/v1\.0\/users\/([^/]+)$/.exec(p);
    if (m) return g.users[SEGMENT(m[1])] ? ok(g.users[SEGMENT(m[1])]) : notFound();
    m = /^\/v1\.0\/groups\/([^/]+)\/members$/.exec(p);
    if (m) return ok({ value: g.groups[SEGMENT(m[1])] || [] });
    return notFound();
  },
  okta(state, req, p) {
    if (req.method === 'POST') return token({ scope: 'okta.users.read okta.groups.read okta.logs.read okta.apps.read' });
    const o = state.okta;
    let m = /^\/api\/v1\/users\/([^/]+)\/factors$/.exec(p);
    if (m) return o.factors[SEGMENT(m[1])] ? ok(o.factors[SEGMENT(m[1])]) : notFound();
    m = /^\/api\/v1\/users\/([^/]+)$/.exec(p);
    if (m) return o.users[SEGMENT(m[1])] ? ok(o.users[SEGMENT(m[1])]) : notFound();
    if (p === '/api/v1/logs') return ok(o.logs);
    return notFound();
  },
  github(state, req, p) {
    const g = state.github;
    if (p === `/orgs/${g.org}`) return ok({ login: g.org });
    const m = new RegExp(`^/orgs/${g.org}/memberships/([^/]+)$`).exec(p);
    if (m) return g.members[SEGMENT(m[1])] ? ok({ organization: { login: g.org }, ...g.members[SEGMENT(m[1])] }) : notFound();
    if (p === `/orgs/${g.org}/invitations`) return ok(g.invitations);
    if (p === `/orgs/${g.org}/outside_collaborators`) return ok(g.outside_collaborators);
    return notFound();
  },
  'google-workspace': (state, req, p) => {
    if (req.method === 'POST') return token();
    const m = /^\/admin\/directory\/v1\/users\/([^/]+)$/.exec(p);
    if (m) return state.gws.users[SEGMENT(m[1])] ? ok(state.gws.users[SEGMENT(m[1])]) : notFound();
    return notFound();
  },
  // Jamf Pro: the computers in the tenant's devices list, by serial, and the MDM commands sent to one.
  jamf(state, req, p) {
    if (req.method === 'POST') return token();
    if (p === '/api/v1/jamf-pro-version') return ok({ version: '11.0.0-simulated' });
    const jamfDevices = (state.devices || []).filter((d) => d.managed_by === 'Jamf Pro');
    if (p === '/api/v1/computers-inventory') {
      const serial = filterValue(req, 'hardware.serialNumber');
      const found = jamfDevices.filter((d) => d.serial === serial).map((d) => ({ id: d.jamf_id, general: { name: d.name, managementId: d.management_id, lastContactTime: d.last_contact }, hardware: { serialNumber: d.serial } }));
      return ok({ totalCount: found.length, results: found });
    }
    if (p === '/api/v2/mdm/commands') {
      const id = filterValue(req, 'clientManagementId');
      const d = jamfDevices.find((x) => x.management_id === id);
      const sent = d ? (d.mdm_commands || []).map((c) => ({ clientManagementId: id, ...c })) : [];
      return ok({ totalCount: sent.length, results: sent });
    }
    return notFound();
  },
  // Slack Web API (batch 9, task 9): users.info and auth.test from the tenant's Slack users. A Web API
  // answer is HTTP 200 with ok false for an unknown user, as Slack answers it.
  slack(state, req, p) {
    const s = state.slack;
    if (!s) return notFound();
    if (p === '/api/auth.test') return ok({ ok: true, team_id: s.team_id, user_id: 'U0DESKSIM', team: 'simulated' });
    if (p === '/api/users.info') {
      const id = new URLSearchParams(String(req.path).split('?')[1] || '').get('user');
      return s.users[id] ? ok({ ok: true, user: s.users[id] }) : ok({ ok: false, error: 'user_not_found' });
    }
    return notFound();
  },
  linear(state, req, p) {
    if (p !== '/graphql') return notFound();
    return ok({ data: { users: { nodes: state.linear.users, pageInfo: { hasNextPage: false, endCursor: null } }, organization: { urlKey: state.linear.urlKey } } });
  },
};

// A transport for one connector over one simulated tenant file. The file is read per request, so a
// read-back sees what the simulated operator left there.
function transportFor(connector, tenantFile) {
  return async (request) => {
    const state = JSON.parse(fs.readFileSync(tenantFile, 'utf8'));
    const route = ROUTES[connector];
    return route ? route(state, request, String(request.path).split('?')[0]) : notFound();
  };
}

module.exports = { CONNECTORS, connectorModule, simulatedCredentials, transportFor };
