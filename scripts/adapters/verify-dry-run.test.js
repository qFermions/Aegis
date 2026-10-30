'use strict';
// verify-dry-run.test.js: a verify-* dry run exits 4 in every connector (batch G3 close-out,
// owner decision 2).
//
// EXPECTED DECISION (written before the code)
// - A dry run reads nothing, so it proves nothing. In each of the nine connectors (Fleet,
//   GitHub, Google Workspace, Jamf Pro, Linear, Microsoft Graph, Okta, Slack and Jira) a
//   verify-* dry run whose request was planned exits 4, the shared contract's
//   EXIT.VERIFY_DRY_RUN, never 0 (the code of a passed read-back), and prints the line
//   "NOT VERIFIED: a dry run reads nothing, so it proves nothing". It still sends nothing.
// - A plain read's dry run exits 0 and prints no such line.
// - Jira uses the shared constant: EXIT_VERIFY_DRY_RUN is EXIT.VERIFY_DRY_RUN.
// - A live verify-* that passes still exits 0 and one that fails exits 2: each connector's own
//   suite proves it (cited in checks.md, row E2).
// Run: node --test scripts/adapters/verify-dry-run.test.js

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const contract = require('./readonly-contract.js');

const NOT_BEFORE = '2026-10-28T09:00:00Z';
const LINE = /^NOT VERIFIED: a dry run reads nothing, so it proves nothing/m;

// One verify-* and one plain read per connector, each a valid dry run.
const CONNECTORS = {
  fleet: {
    file: 'fleet-client.js', env: { FLEET_URL: 'fleet.example.invalid' },
    verify: ['verify-checked-in', '--id', '7', '--not-before', NOT_BEFORE], read: ['host', '--id', '7'],
  },
  github: {
    file: 'github-client.js', env: { GITHUB_ORG: 'example-org' },
    verify: ['verify-2fa-required'], read: ['org'],
  },
  'google-workspace': {
    file: 'gws-client.js', env: {},
    verify: ['verify-suspended', '--user', 'person@example.com'], read: ['user', '--user', 'person@example.com'],
  },
  jamf: {
    file: 'jamf-client.js', env: { JAMF_URL: 'jamf.example.invalid' },
    verify: ['verify-checked-in', '--serial', 'C02TEST0001', '--not-before', NOT_BEFORE], read: ['computer', '--serial', 'C02TEST0001'],
  },
  linear: {
    file: 'linear-client.js', env: {},
    verify: ['verify-state', '--issue', 'IT-123', '--state', 'Done'], read: ['issue', '--issue', 'IT-123'],
  },
  msgraph: {
    file: 'msgraph-client.js', env: { MS_TENANT_ID: '11111111-2222-4333-8444-555555555555' },
    verify: ['verify-account-enabled', '--user', 'aaaaaaaa-0000-4000-8000-000000000001', '--enabled', 'false'],
    read: ['user', '--user', 'aaaaaaaa-0000-4000-8000-000000000001'],
  },
  okta: {
    file: 'okta-client.js', env: { OKTA_ORG_URL: 'okta.example.invalid' },
    verify: ['verify-status', '--user', '00u1abcd2EFGH3ijk4x7', '--status', 'SUSPENDED'], read: ['user', '--user', '00u1abcd2EFGH3ijk4x7'],
  },
  slack: {
    file: 'slack-client.js', env: { SLACK_TEAM_ID: 'T0OURS0001' },
    verify: ['verify-deactivated', '--user', 'U0TEST0001'], read: ['user', '--user', 'U0TEST0001'],
  },
};

async function dry(file, argv, env) {
  const mod = require(path.join(__dirname, file));
  const out = [];
  const err = [];
  let sent = 0;
  const transport = async () => { sent += 1; throw new Error('a dry run sends nothing'); };
  const code = await mod.run(argv, env, { transport, out: (s) => out.push(String(s)), err: (s) => err.push(String(s)) });
  return { code, stdout: out.join(''), stderr: err.join(''), sent };
}

test('the shared contract names the verify-* dry-run exit code 4 beside the other four', () => {
  assert.deepEqual({ ...contract.EXIT }, { OK: 0, INPUT: 1, READ_FAILED: 2, TENANT: 3, VERIFY_DRY_RUN: 4 });
  assert.match(contract.NOT_VERIFIED_DRY_RUN, LINE);
});

for (const [name, c] of Object.entries(CONNECTORS)) {
  test(`${name}: a verify-* dry run exits 4 and says NOT VERIFIED; a plain read dry run exits 0 without it; neither sends anything`, async () => {
    const v = await dry(c.file, c.verify, c.env);
    assert.equal(v.code, 4, `${c.verify.join(' ')}\n${v.stdout}${v.stderr}`);
    assert.match(v.stdout + v.stderr, LINE, `${c.verify[0]} prints the NOT VERIFIED line`);
    assert.match(v.stdout, /dry run/, 'the planned request is still printed');
    assert.equal(v.sent, 0);
    const r = await dry(c.file, c.read, c.env);
    assert.equal(r.code, 0, `${c.read.join(' ')}\n${r.stdout}${r.stderr}`);
    assert.doesNotMatch(r.stdout + r.stderr, LINE, 'a plain read is not a read-back');
    assert.equal(r.sent, 0);
  });
}

test('a verify-* dry run that the connector refuses (bad input) still exits 1, not 4', async () => {
  const r = await dry('github-client.js', ['verify-collaborator', '--repo', 'service-repo', '--user', 'octo-person', '--role', 'owner'], { GITHUB_ORG: 'example-org' });
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout + r.stderr, LINE);
});

test('jira: the verify-* dry run uses the shared constant (4) and prints the same NOT VERIFIED line; get dry run exits 0', async () => {
  const jira = require('../jira-client.js');
  assert.equal(jira.EXIT_VERIFY_DRY_RUN, contract.EXIT.VERIFY_DRY_RUN);
  const run = async (argv) => {
    const out = [];
    const err = [];
    let fetched = 0;
    const code = await jira.run(argv, { JIRA_SITE: 'example.atlassian.net' }, {
      fetch: async () => { fetched += 1; throw new Error('a dry run sends nothing'); },
      getCredentials: async () => { throw new Error('a dry run reads no credential'); },
      out: (s) => out.push(String(s)), err: (s) => err.push(String(s)),
    });
    return { code, text: out.join('\n') + err.join('\n'), fetched };
  };
  const v = await run(['verify-transition', '--issue', 'HELP-1', '--issue-id', '10001', '--from-version', '1', '--to-status', 'Done']);
  assert.equal(v.code, 4, v.text);
  assert.ok(v.text.includes(contract.NOT_VERIFIED_DRY_RUN), v.text);
  assert.equal(v.fetched, 0);
  const g = await run(['get', '--issue', 'HELP-1']);
  assert.equal(g.code, 0, g.text);
  assert.doesNotMatch(g.text, LINE);
});
