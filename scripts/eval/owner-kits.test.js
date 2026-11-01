require('../adapters/socket-tripwire.js'); // first, so no socket can open in this file
// owner-kits.test.js: the owner's kits for readiness rows 4, 9, 10, 11 and 12 (docs/aegis/owner/).
//
// EXPECTED DECISION (written before the code)
// - Every connector command in test-tenant-runbook.md sits in a two-line bash block: the dry run,
//   then the same line with the bare --execute. Each dry run, with fake placeholder-shaped values
//   and fake environment values, is accepted by the connector's own run(argv, env, deps): a read
//   and a scope check exit 0, a verify-* exits 4 (the shared EXIT.VERIFY_DRY_RUN), and the
//   injected transport is never called.
// - The page covers every read and verify-* command each connector exports, and has a section
//   for every connector in scope-manifest.json.
// - Every Markdown link in the four owner pages that points into the repository resolves.
// - No email address except a bracketed placeholder, no phone number, no U+2014, and every
//   [@Aegion_*] token is in the placeholder dictionary.
// - The Microsoft Graph password-reset question is on the page word for word.
// Run: node --test scripts/eval/owner-kits.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { EXIT } = require('../adapters/readonly-contract.js');

const ROOT = path.resolve(__dirname, '..', '..');
const OWNER = path.join(ROOT, 'docs', 'aegis', 'owner');
const RUNBOOK = fs.readFileSync(path.join(OWNER, 'test-tenant-runbook.md'), 'utf8');
const DOCS = ['test-tenant-runbook.md', 'vendor-facts-priority.md', 'operator-validation.md', 'shadow-pilot.md'];
const TEXTS = [...DOCS, 'operator-sample-template.csv'].map((f) => [f, fs.readFileSync(path.join(OWNER, f), 'utf8')]);

const GUID = (n) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
const at = (user, domain) => [user, domain].join('@');
const COMMON = {
  '[HOST_ID]': '7', '[SERIAL_NUMBER]': 'C02TEST0001', '[CVE_ID]': 'CVE-2026-12345', '[EXECUTION_ID]': GUID(1),
  '[REPORT_ID]': '4', '[NOT_BEFORE]': '2026-10-28T09:00:00Z', '[GITHUB_USER]': 'octo-person', '[TEAM_SLUG]': 'it-team',
  '[REPO_NAME]': 'service-repo', '[BRANCH_NAME]': 'main', '[ALERT_NUMBER]': '3', '[N]': '10001',
  '[USER@DOMAIN.COM]': at('person', 'example.com'), '[UPN]': at('other', 'example.com'), '[GROUP_EMAIL]': at('itstaff', 'example.com'),
  '[OU_PATH]': 'Staff', '[ROLE_ID]': '12345', 'YYYY-MM-DD': '2026-10-27', '[DEVICE_ID]': '7', '[SMART_GROUP]': 'Test Macs',
  '[SMART_GROUP_ID]': '5', '[PROFILE_ID]': '6', '[POLICY_ID]': '8', '[PATCH_TITLE_ID]': '9', '[PLAN_UUID]': GUID(2),
  '[COMMAND_TYPE]': 'UPDATE_INVENTORY', '[PROFILE_IDENTIFIER]': 'com.example.wifi', '[MEMBER_COUNT]': '12',
  '[ISSUE_ID]': 'IT-123', '[@Aegion_LINEAR_TEAM]': 'IT', '[NOTE_SHA256]': 'a'.repeat(64), '[STATE_NAME]': 'Done',
  '[LABEL_NAME]': 'Hardware', '[USER_ID]': 'user-1', '[GROUP_ID]': GUID(3), '[METHOD_ID]': 'method-1',
  '[OKTA_USER_ID]': '00u1abcd2EFGH3ijk4x7', '[OKTA_GROUP_ID]': '00g1abcd2EFGH3ijk4x7', '[APP_ID]': '0oa1abcd2EFGH3ijk4x7',
  '[CHANNEL_ID]': 'C0TEST0001', '[JIRA-###]': 'HELP-1', '[COMMENT_ID]': '20001', '[STATUS]': 'Done',
};
// Per connector: the env a dry run needs (no credential), and placeholder values whose shape differs.
const CONNECTORS = {
  'fleet-client.js': { env: { FLEET_URL: 'fleet.example.invalid' } },
  'github-client.js': { env: { GITHUB_ORG: 'example-org' } },
  'gws-client.js': { env: {} },
  'jamf-client.js': { env: { JAMF_URL: 'jamf.example.invalid' } },
  'linear-client.js': { env: {} },
  'msgraph-client.js': { env: { MS_TENANT_ID: '11111111-2222-4333-8444-555555555555' }, values: { '[USER_ID]': GUID(4), '[DEVICE_ID]': GUID(5) } },
  'okta-client.js': { env: { OKTA_ORG_URL: 'okta.example.invalid' } },
  'slack-client.js': { env: { SLACK_TEAM_ID: 'T0OURS0001' }, values: { '[USER_ID]': 'U0TEST0001', '[APP_ID]': 'A0TEST0001' } },
  'scopes.js': { env: {} },
  'jira-client.js': { env: { JIRA_SITE: 'example.atlassian.net' }, values: { '[NOT_BEFORE]': '1761642000000' } },
};

// Every bash block on the page, as lists of lines.
function bashBlocks(text) {
  const blocks = [];
  let current = null;
  for (const line of text.split('\n')) {
    if (current === null && /^```bash\s*$/.test(line)) { current = []; continue; }
    if (current !== null && /^```\s*$/.test(line)) { blocks.push(current); current = null; continue; }
    if (current !== null && line.trim()) current.push(line.trim());
  }
  return blocks;
}

// A shell-like split: spaces separate words, double quotes group them.
function words(line) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

const BLOCKS = bashBlocks(RUNBOOK);
const COMMANDS = BLOCKS.flat();

test('every bash block is the dry run, then the same line with the bare --execute', () => {
  assert.ok(BLOCKS.length >= 100, `${BLOCKS.length} blocks`);
  for (const [dryLine, liveLine] of BLOCKS.map((b) => [b[0], b[1]])) {
    assert.equal(BLOCKS.find((b) => b[0] === dryLine).length, 2, dryLine);
    assert.match(dryLine, /^node scripts\/(?:adapters\/[a-z]+(?:-client)?\.js|jira-client\.js) /, dryLine);
    assert.doesNotMatch(dryLine, /--execute/, dryLine);
    assert.equal(liveLine, `${dryLine} --execute`);
  }
});

async function dryRun(line) {
  const [, script, ...argv] = words(line);
  const file = path.basename(script);
  const c = CONNECTORS[file];
  assert.ok(c, `no fake environment for ${file}`);
  const values = { ...COMMON, ...(c.values || {}) };
  const args = argv.filter((a) => a !== '--execute').map((a) => {
    let v = a;
    for (const [k, val] of Object.entries(values)) v = v.split(k).join(val);
    assert.doesNotMatch(v, /\[[^\]]*\]/, `${line}: placeholder ${v} has no fake value in this test`);
    return v;
  });
  const mod = require(path.join(ROOT, script));
  let sent = 0;
  const fail = async () => { sent += 1; throw new Error('a dry run sends nothing'); };
  const out = [];
  const deps = { transport: fail, fetch: fail, getCredentials: fail, out: (s) => out.push(String(s)), err: (s) => out.push(String(s)) };
  const code = await mod.run(args, c.env, deps);
  return { code, sent, args, text: out.join('\n') };
}

test('each dry run is accepted with fake values: a read exits 0, a verify-* exits 4, nothing is sent', async () => {
  const dryLines = BLOCKS.map((b) => b[0]);
  for (const line of dryLines) {
    const r = await dryRun(line);
    const verify = /^verify-/.test(r.args[0]);
    const want = verify ? EXIT.VERIFY_DRY_RUN : EXIT.OK;
    assert.equal(r.code, want, `${line}\n${r.text}`);
    assert.equal(r.sent, 0, `${line} called the transport`);
  }
});

test('the page runs every read and verify-* each connector exports, and the Jira reads and read-backs', () => {
  const used = new Map();
  for (const line of COMMANDS) {
    const [, script, command] = words(line);
    const file = path.basename(script);
    if (!used.has(file)) used.set(file, new Set());
    used.get(file).add(command);
  }
  const fleet = require('../adapters/fleet-client.js');
  const expected = {
    'fleet-client.js': [...Object.keys(fleet.READS), ...Object.keys(fleet.VERIFIES)],
    'jira-client.js': ['list-desks', 'list-types', 'get', 'transition', 'verify-create', 'verify-comment', 'verify-transition'],
  };
  for (const f of ['github-client.js', 'msgraph-client.js', 'okta-client.js', 'slack-client.js']) {
    const table = require(`../adapters/${f}`).COMMANDS;
    expected[f] = Object.keys(table).filter((n) => table[n].kind !== 'offline');
  }
  for (const [file, names] of Object.entries(expected)) {
    const missing = names.filter((n) => !(used.get(file) || new Set()).has(n));
    assert.deepEqual(missing, [], `${file} commands missing from the runbook`);
  }
});

test('every connector in scope-manifest.json has its own section', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'adapters', 'scope-manifest.json'), 'utf8'));
  for (const key of Object.keys(manifest.connectors)) {
    assert.match(RUNBOOK, new RegExp(`^#{2,3} .+ \\(\`${key}\`\\)$`, 'm'), `no section for ${key}`);
  }
});

test('the Microsoft Graph password-reset question is on the page word for word', () => {
  const question = 'Microsoft does not document whether a password reset moves signInSessionsValidFromDateTime, so on a ticket that also reset the password, verify-sessions-revoked may pass without a revocation. On the test tenant: reset a test user\'s password without revoking sessions, then run verify-sessions-revoked with --not-before set to just before the reset, and record whether it passes.';
  assert.ok(RUNBOOK.includes(question));
});

test('every Markdown link in the owner pages that points into the repository resolves', () => {
  for (const doc of DOCS) {
    const text = fs.readFileSync(path.join(OWNER, doc), 'utf8');
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      const file = path.resolve(OWNER, target.split('#')[0]);
      assert.ok(file.startsWith(ROOT + path.sep), `${doc}: ${target} leaves the repository`);
      assert.ok(fs.existsSync(file), `${doc}: ${target} does not resolve`);
    }
  }
});

test('no real-name shapes: only bracketed email placeholders, no phone number, no U+2014, registered [@Aegion_*] tokens only', () => {
  const dictionary = fs.readFileSync(path.join(ROOT, 'modules', 'security', 'placeholder-dictionary.md'), 'utf8');
  for (const [file, text] of TEXTS) {
    for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
      const bracketed = text[m.index - 1] === '[' && text[m.index + m[0].length] === ']';
      assert.ok(bracketed, `${file}: email-shaped text ${m[0]}`);
    }
    assert.doesNotMatch(text, /(?:\+\d{1,3}[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/, `${file}: phone-shaped text`);
    assert.doesNotMatch(text, /\u2014/, `${file}: U+2014`);
    for (const m of text.matchAll(/\[@Aegion_[A-Z0-9_]+\]/g)) assert.ok(dictionary.includes(m[0]), `${file}: ${m[0]} is not in the dictionary`);
  }
});
