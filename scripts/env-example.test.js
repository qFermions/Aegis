'use strict';
// env-example.test.js: .env.example names every environment variable the connectors, the Jira
// client, the intake and the audit trail read (batch G3 close-out, owner decision 5).
//
// EXPECTED DECISION (written before the file changes)
// - Every name read through process.env or a connector's env object in scripts/adapters/
//   (the nine connector CLIs, the shared contract, cli-support.js and scopes.js),
//   scripts/jira-client.js, scripts/intake/ and scripts/audit/ is a NAME= line in
//   .env.example. Names are found in the source: env.NAME, env['NAME'], a spec's or source's
//   env: 'NAME', and a spec's credentials: [...] list. A name missing from .env.example fails
//   this test and names the variable.
// - The scan is checked against the connectors' own specs (credentials, host and tenant
//   variables), so a scan that misses a declared name fails too.
// - .env.example holds names and placeholders only: each value is empty or one placeholder
//   registered in modules/security/placeholder-dictionary.md; no value has a credential
//   shape. Each group of names starts with one comment line.
// - This test reads source files, .env.example and the dictionary only: never .env or any
//   other env file, and never a value from the environment.
// Run: node --test scripts/env-example.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const EXAMPLE = path.join(ROOT, '.env.example');

// The files whose environment reads .env.example must name.
function sourceFiles() {
  const list = (dir, keep) => fs.readdirSync(path.join(ROOT, dir)).filter((n) => n.endsWith('.js') && !n.endsWith('.test.js') && keep(n)).map((n) => path.join(dir, n));
  return [
    ...list('scripts/adapters', (n) => n.endsWith('-client.js') || ['readonly-contract.js', 'cli-support.js', 'scopes.js'].includes(n)),
    'scripts/jira-client.js',
    ...list('scripts/intake', () => true),
    ...list('scripts/audit', (n) => n !== 'test-trail.js'),
  ];
}

const NAME = '[A-Z][A-Z0-9_]*[A-Z0-9]';
const READS = [
  new RegExp(`\\benv\\.(${NAME})\\b`, 'g'),
  new RegExp(`\\benv\\[\\s*['"](${NAME})['"]\\s*\\]`, 'g'),
  new RegExp(`\\benv:\\s*['"](${NAME})['"]`, 'g'),
];

// Every environment variable name a source reads.
function namesRead(source) {
  const names = new Set();
  for (const re of READS) for (const m of source.matchAll(re)) names.add(m[1]);
  for (const m of source.matchAll(/\bcredentials:\s*\[([^\]]*)\]/g)) {
    for (const q of m[1].matchAll(new RegExp(`['"](${NAME})['"]`, 'g'))) names.add(q[1]);
  }
  return names;
}

function readNames() {
  const all = new Map();
  for (const file of sourceFiles()) {
    for (const n of namesRead(fs.readFileSync(path.join(ROOT, file), 'utf8'))) {
      if (!all.has(n)) all.set(n, []);
      all.get(n).push(file);
    }
  }
  return all;
}

// NAME=value lines of an env example text.
function exampleEntries(text) {
  const entries = new Map();
  for (const line of text.split('\n')) {
    const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (m) entries.set(m[1], m[2]);
  }
  return entries;
}

// The names read that the example text does not name, with the files that read them.
function missingFrom(text, read = readNames()) {
  const named = exampleEntries(text);
  return [...read.keys()].filter((n) => !named.has(n)).sort().map((n) => `${n} (read in ${read.get(n).join(', ')})`);
}

test('every environment variable a connector, the Jira client, the intake or the audit trail reads is named in .env.example', () => {
  const missing = missingFrom(fs.readFileSync(EXAMPLE, 'utf8'));
  assert.deepEqual(missing, [], `.env.example is missing:\n  ${missing.join('\n  ')}`);
});

test('the scan finds every name the connectors declare (credentials, host and tenant), and the names the task names', () => {
  const read = readNames();
  const specs = [
    require('./adapters/fleet-client.js').SPEC, require('./adapters/jamf-client.js').SPEC,
    require('./adapters/slack-client.js').SPEC, require('./adapters/slack-client.js').ACCESS_LOGS_SPEC,
    require('./adapters/linear-client.js').SPEC, require('./adapters/gws-client.js').SPEC,
    require('./adapters/okta-client.js').SPEC, require('./adapters/github-client.js').SPEC,
    require('./adapters/msgraph-client.js').makeSpec({ tenant: '11111111-2222-4333-8444-555555555555' }),
    require('./jira-client.js').JIRA_SPEC,
  ];
  const declared = new Set();
  for (const s of specs) {
    for (const c of s.credentials) declared.add(c);
    if (s.host.env) declared.add(s.host.env);
    if (s.tenant) declared.add(s.tenant.env);
  }
  declared.add('MS_TENANT_ID');
  for (const n of declared) assert.ok(read.has(n), `the scan misses ${n}`);
  for (const n of ['GITHUB_ORG', 'GITHUB_TOKEN', 'AEGIS_AUDIT_DIR', 'AEGIS_GRAPH_RUNS_DIR', 'AEGION_DOMAIN', 'JIRA_SITE']) assert.ok(read.has(n), `the scan misses ${n}`);
  assert.ok(read.size >= 34, `only ${read.size} names found (34 at the batch G3 close-out)`);
});

test('a name removed from .env.example is reported by name', () => {
  const text = fs.readFileSync(EXAMPLE, 'utf8').split('\n').filter((l) => !l.startsWith('GITHUB_ORG=')).join('\n');
  const missing = missingFrom(text);
  assert.equal(missing.length, 1, missing.join('; '));
  assert.match(missing[0], /^GITHUB_ORG \(read in scripts\/adapters\/github-client\.js/);
});

test('.env.example holds names and placeholders only: each value empty or one registered placeholder, no credential shape, one comment line per group', () => {
  const text = fs.readFileSync(EXAMPLE, 'utf8');
  const dictionary = fs.readFileSync(path.join(ROOT, 'modules', 'security', 'placeholder-dictionary.md'), 'utf8');
  // credential shapes (Slack, GitHub, OpenAI-style, Google, GitLab, Okta, a JWT, an auth header,
  // a key block), and for a value also any long unbroken token
  const CREDENTIAL = /xox[a-z]-|\bgh[pousr]_|github_pat_|\bsk-[A-Za-z0-9]|AIza[0-9A-Za-z_-]{10}|ya29\.|glpat-|\bSSWS\b|eyJ[A-Za-z0-9_-]{8,}|\b(?:Bearer|Basic)\s|-----BEGIN/;
  const LONG_TOKEN = /[A-Za-z0-9+/=_-]{32,}/;
  const entries = exampleEntries(text);
  assert.ok(entries.size >= 39, `${entries.size} names (39 at the batch G3 close-out)`);
  for (const [name, value] of entries) {
    if (value === '') continue;
    assert.match(value, /^\[[^\]\s]+\]$/, `${name}: a value is empty or one placeholder`);
    assert.ok(dictionary.includes(`\`${value}\``), `${name}: ${value} is registered in the placeholder dictionary`);
    assert.doesNotMatch(value, CREDENTIAL, `${name}: no credential shape`);
    assert.doesNotMatch(value, LONG_TOKEN, `${name}: no long token`);
  }
  assert.doesNotMatch(text, CREDENTIAL, 'no credential shape anywhere in the file');
  // each block of NAME= lines follows exactly one comment line
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^[A-Z][A-Z0-9_]*=/.test(lines[i]) || /^[A-Z][A-Z0-9_]*=/.test(lines[i - 1] || '')) continue;
    assert.match(lines[i - 1] || '', /^# \S/, `line ${i + 1} (${lines[i]}) starts a group with a comment line`);
    assert.doesNotMatch(lines[i - 2] || '', /^#/, `line ${i + 1}: one comment line per group`);
  }
});
