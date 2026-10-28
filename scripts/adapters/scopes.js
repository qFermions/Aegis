'use strict';
// scopes.js: the read-only scope manifest, one connector at a time (batch G3, task 3a).
//
// Usage: node scripts/adapters/scopes.js <connector> [--execute]
//   connectors: fleet, jamf, slack, slack-access-logs, linear, google-workspace, jira, github,
//   msgraph (its --execute read needs MS_SCOPE_CHECK_USER, a user object ID to read)
//
// Without --execute (the default) it prints the connector's entry in scope-manifest.json:
// the least-privilege read scopes or role, what is refused, how the vendor exposes a
// credential's granted scopes, and the vendor pages read. No credential is read and
// nothing is sent.
//
// With --execute it runs the scope preflight for the credential exported in this shell:
// one cheap read through the connector's own adapter spec (GET only, as every connector),
// and prints whether the credential was refused (SCOPE_REFUSED, exit 1), passed, or could
// not be checked because the vendor does not expose its scopes (scope_notice, exit 0).
// The read is recorded in the audit trail like any connector call.

const fs = require('node:fs');
const path = require('node:path');
const { createClient, renderResult, exitCodeFor } = require('./readonly-contract.js');
const { cliDeps } = require('./cli-support.js');

const MANIFEST_FILE = path.join(__dirname, 'scope-manifest.json');

// The one cheap read per connector that --execute sends. Loaded only under --execute.
const PROBES = Object.freeze({
  fleet: { load: () => require('./fleet-client.js').SPEC, get: 'version' },
  jamf: { load: () => require('./jamf-client.js').SPEC, get: 'version' },
  slack: { load: () => require('./slack-client.js').SPEC, get: 'auth.test' },
  'slack-access-logs': { load: () => require('./slack-client.js').ACCESS_LOGS_SPEC, get: 'auth.test' },
  linear: { load: () => require('./linear-client.js').SPEC, graphql: 'AegisViewer' },
  'google-workspace': { load: () => require('./gws-client.js').SPEC, get: 'roles' },
  jira: { load: () => require('../jira-client.js').JIRA_SPEC, get: 'servicedesk' },
  github: { load: () => require('./github-client.js').SPEC, get: 'org', params: (env) => ({ org: env.GITHUB_ORG }) },
  msgraph: { load: (env) => require('./msgraph-client.js').makeSpec({ tenant: env.MS_TENANT_ID }), get: 'authMethods', params: (env) => ({ user: env.MS_SCOPE_CHECK_USER }) },
});

function loadManifest(file = MANIFEST_FILE) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function usage() {
  return `usage: node scripts/adapters/scopes.js <${Object.keys(PROBES).join('|')}> [--execute]\n`;
}

async function run(argv, env = process.env, deps = {}) {
  const out = deps.out || ((s) => process.stdout.write(s));
  const err = deps.err || ((s) => process.stderr.write(s));
  const [connector, ...rest] = argv;
  const manifest = loadManifest(deps.manifestFile);
  const known = Object.prototype.hasOwnProperty.call(PROBES, connector || '') && manifest.connectors[connector];
  const execute = rest.length === 1 && rest[0] === '--execute';
  if (!known || (rest.length && !execute)) {
    err(`scopes: ${known ? 'the only flag is --execute' : `unknown connector ${JSON.stringify(String(connector || '')).slice(0, 60)}`}\n${usage()}`);
    return 1;
  }
  const entry = manifest.connectors[connector];
  if (!execute) {
    out(`${JSON.stringify({ connector, ...entry, note: 'dry run: no credential read, nothing sent; add --execute to check the credential exported in this shell' }, null, 2)}\n`);
    return 0;
  }
  const probe = PROBES[connector];
  const spec = probe.load(env);
  const client = createClient(spec, { env, ...cliDeps(deps, env), scopePreflight: true });
  const res = probe.graphql ? await client.graphql(probe.graphql) : await client.get(probe.get, probe.params ? probe.params(env) : {});
  const secrets = spec.credentials.map((name) => env[name]).filter((v) => typeof v === 'string' && v.length > 0);
  const shown = {
    connector,
    state: res.state,
    scope_check: res.state === 'SCOPE_REFUSED' ? 'refused' : res.scope_notice ? 'not exposed by the vendor' : res.state === 'OK' ? 'passed' : 'not reached',
    ...(res.write_scopes ? { write_scopes: res.write_scopes } : {}),
    ...(res.scope_notice ? { scope_notice: res.scope_notice } : {}),
    ...(res.state === 'OK' ? {} : { status: res.status, attempts: res.attempts, request_id: res.request_id, handoff: res.handoff, error: res.error }),
    least_privilege: entry.least_privilege,
  };
  const code = exitCodeFor(res);
  (code === 1 ? err : out)(renderResult(shown, { secrets, platform: connector === 'slack-access-logs' ? 'slack' : connector, operation: 'scope-check' }));
  return code;
}

if (require.main === module) {
  run(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => {
    process.stderr.write(`scopes: ${e && e.message ? e.message : 'failed'}\n`);
    process.exitCode = 2;
  });
}

module.exports = { run, loadManifest, PROBES, MANIFEST_FILE };
