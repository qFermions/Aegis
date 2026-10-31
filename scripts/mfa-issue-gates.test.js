'use strict';
// mfa-issue-gates.test.js: the gates of /mfa-issue (batch G3 close-out 2, owner decision 1).
//
// EXPECTED DECISION (written before the runbook change)
// - "Require re-register MFA" has its own R3 gate, [mfa-require-reregister-portal], with a
//   PORTAL ACTION, as the alternative to the one-method delete [mfa-method-delete-portal]: one
//   or the other for a ticket, never both. Its Effect quotes Microsoft Learn (under 25 words),
//   its role is at least Authentication Administrator, and its confirmation is exactly
//   REQUIRE MFA RE-REGISTER FOR [UPN] AND DELETE ITS MFA METHODS (the owner's phrase plus the
//   deletion it causes, which the existing gate rule requires the typed phrase to name).
// - Every gate in the runbook carries one R class from CLAUDE.md's Risk-Classified Execution
//   Policy and cites the row: both MFA changes are R3 ("CA/MFA/licensing changes"); session
//   revocation fits no row cleanly and takes the higher of the two it touches, R2, saying why.
// - verify-mfa-cleared is the bound read-back of the re-register gate (--change [CHANGE_ID]),
//   and vendor fact B-18 carries the quote as re-read on 2026-10-31.
// Run: node --test scripts/mfa-issue-gates.test.js

require('./adapters/socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const PAGE = read('.claude', 'commands', 'mfa-issue.md');
const QUOTE = 'deactivates the user\'s hardware OATH tokens and deletes the following authentication methods from this user: phone numbers, Microsoft Authenticator apps and software OATH tokens';

// Each gate: its id, its form (a marker block in the page or a comment block in a fence) and
// its fields, read from the lines right after the marker.
function gates(text) {
  const lines = text.split('\n');
  const found = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^<!-- SAFETY GATE \[([^\]]+)\] -->$|^# SAFETY GATE \[([^\]]+)\]$/);
    if (!m) continue;
    const portal = Boolean(m[1]);
    const fields = {};
    for (let j = i + 1; j < lines.length; j += 1) {
      const f = portal ? lines[j].match(/^- \*\*([A-Za-z ]+):\*\* (.*)$/) : lines[j].match(/^# ([A-Z][A-Za-z ]+): (.*)$/);
      if (!f) break;
      fields[f[1]] = f[2];
    }
    found.push({ id: m[1] || m[2], portal, fields });
  }
  return found;
}

const CLASSES = { 'mfa-session-revoke-portal': 'R2', 'mfa-method-delete-portal': 'R3', 'mfa-require-reregister-portal': 'R3', 'mfa-session-revoke': 'R2' };

test('every /mfa-issue gate carries one R class from CLAUDE.md\'s risk table and cites the row', () => {
  const found = gates(PAGE);
  assert.deepEqual(found.map((g) => g.id).sort(), Object.keys(CLASSES).sort(), 'the four gates of /mfa-issue');
  const claude = read('CLAUDE.md');
  assert.match(claude, /\| \*\*R3 [^|]*\| [^|]*CA\/MFA\/licensing changes \|/, 'the R3 row the gates cite');
  for (const g of found) {
    const rev = g.fields.Reversibility;
    assert.ok(rev, `${g.id}: has a Reversibility line`);
    // one class only: the pin test in change-binding.test.js reads the highest R token
    assert.deepEqual([...new Set(rev.match(/\bR[0-3]\b/g) || [])], [CLASSES[g.id]], `${g.id}: ${rev}`);
    assert.ok(rev.startsWith(`${CLASSES[g.id]} `) || rev.startsWith(`${CLASSES[g.id]}:`), `${g.id}: the class comes first`);
    assert.match(rev, /CLAUDE\.md/, `${g.id}: cites CLAUDE.md's table`);
    if (CLASSES[g.id] === 'R3') assert.match(rev, /CA\/MFA\/licensing changes/, `${g.id}: cites the R3 row`);
  }
  const revoke = found.find((g) => g.id === 'mfa-session-revoke-portal').fields.Reversibility;
  assert.match(revoke, /fits no row cleanly/);
  assert.match(revoke, /the higher of the two/);
});

test('Require re-register MFA is gated R3 as the alternative to the one-method delete, never both', () => {
  const g = gates(PAGE).find((x) => x.id === 'mfa-require-reregister-portal');
  assert.ok(g && g.portal, 'a portal gate [mfa-require-reregister-portal]');
  assert.equal(g.fields.Target, '[UPN]');
  assert.ok(g.fields.Effect.includes(`"${QUOTE}"`), `the Effect quotes Microsoft Learn: ${g.fields.Effect}`);
  assert.ok(QUOTE.split(/\s+/).length < 25, 'the quote is under 25 words');
  assert.match(g.fields.Scope, /^one user\b/);
  assert.match(g.fields.Reversibility, /not reversible; the user must register again before any sign-in that requires MFA/);
  // the owner's phrase, then the action it deletes: command-safety-gates.test.js requires the
  // typed phrase to name each action family of the Effect, and the quote says "deletes"
  assert.equal(g.fields['Required confirmation'], 'Type exactly `REQUIRE MFA RE-REGISTER FOR [UPN] AND DELETE ITS MFA METHODS`.');
  const del = gates(PAGE).find((x) => x.id === 'mfa-method-delete-portal');
  assert.equal(g.fields['Failure behavior'], del.fields['Failure behavior'], 'fails as the other gates do');
  assert.match(PAGE, /^\*\*PORTAL ACTION \[mfa-require-reregister-portal\]:\*\* Only after the exact match, [^\n]*\*\*Authentication methods\*\*[^\n]*\*\*Require re-register MFA\*\*/m);
  assert.match(PAGE, /\[mfa-require-reregister-portal\][^\n]*\[mfa-method-delete-portal\][^\n]*one or the other for a ticket, never both|\[mfa-method-delete-portal\][^\n]*\[mfa-require-reregister-portal\][^\n]*one or the other for a ticket, never both/);
  assert.match(PAGE, /\*\*Role needed \(Require re-register MFA\):\*\* at least Authentication Administrator/);
});

test('verify-mfa-cleared is the bound read-back of the re-register gate, and its change record is named', () => {
  const lines = PAGE.split('\n');
  const i = lines.findIndex((l) => /msgraph-client\.js verify-mfa-cleared /.test(l));
  assert.ok(i > 0, 'the verify-mfa-cleared line');
  assert.match(lines[i - 1], /^# HUMAN-RUN read-only read-back of \[mfa-require-reregister-portal\]/);
  assert.equal(lines[i], 'node scripts/adapters/msgraph-client.js verify-mfa-cleared --user [USER_ID] --change [CHANGE_ID] --execute');
  assert.match(PAGE, /\*\*Change record \(R2 and R3 gates\):\*\* [^\n]*`msgraph:verify-mfa-cleared`/);
});

test('vendor fact B-18 quotes the page as re-read on 2026-10-31', () => {
  const facts = read('docs', 'aegis', 'g3', 'vendor-facts.md');
  const b18 = facts.split('\n').find((l) => l.startsWith('- B-18.'));
  assert.ok(b18, 'B-18');
  assert.ok(b18.includes(`"${QUOTE}"`), b18);
  assert.match(b18, /2026-10-31/);
  assert.match(b18, /https:\/\/learn\.microsoft\.com\/entra\/identity\/authentication\/howto-mfa-userdevicesettings/);
});
