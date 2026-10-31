'use strict';
// session-revocation-limit.test.js: the known limit of verify-sessions-revoked (batch G4, task A4;
// D9 on PR #9).
//
// EXPECTED DECISION (written before the text)
// - Microsoft does not document whether a password reset moves signInSessionsValidFromDateTime, so
//   on a ticket that also reset the password, verify-sessions-revoked may pass without a revocation.
//   /mfa-issue, /password-reset and the connector's help text say so, the question is listed in
//   docs/aegis/g3/vendor-facts-to-check.md, and the owner's test-tenant runbook carries it.
// - No code behavior changes: the read-back still passes on signInSessionsValidFromDateTime at or
//   after --not-before (scripts/adapters/msgraph-client.test.js).
// Run: node --test scripts/adapters/session-revocation-limit.test.js

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LIMIT = 'Microsoft does not document whether a password reset moves `signInSessionsValidFromDateTime`, so on a ticket that also reset the password this read-back may pass without a revocation';

test('the limit is stated in /mfa-issue, /password-reset and the verify-sessions-revoked help text', () => {
  for (const runbook of ['.claude/commands/mfa-issue.md', '.claude/commands/password-reset.md']) {
    const text = read(runbook);
    assert.ok(text.includes(`**Known limit (session revocation):** ${LIMIT}`), `${runbook} states the limit`);
    assert.match(text, /vendor fact M-28/, `${runbook} names the fact to check`);
  }
  const help = require('./msgraph-client.js').USAGE;
  assert.ok(help.includes(LIMIT.replace(/`/g, '')), 'the connector usage states the limit');
  assert.ok(read('scripts/adapters/msgraph-client.js').includes('Microsoft does not document whether a password reset'), 'the header comment states it');
});

test('the question is listed among the vendor facts to check', () => {
  const row = read('docs/aegis/g3/vendor-facts-to-check.md').split('\n').find((l) => l.startsWith('| M-28 |'));
  assert.ok(row, 'an M-28 row');
  assert.match(row, /password reset/);
  assert.match(row, /signInSessionsValidFromDateTime/);
  assert.match(row, /verify-sessions-revoked/);
});
