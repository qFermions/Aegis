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
  // the role is read before the click, inside the gate's own action (code review round 2, finding 8)
  assert.match(PAGE, /^\*\*PORTAL ACTION \[mfa-require-reregister-portal\]:\*\* Only after the exact match, signed in as at least Authentication Administrator/m);
  assert.doesNotMatch(PAGE, /\*\*Role needed \(Require re-register MFA\):\*\*/);
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

// Code review round 1 of the batch G3 close-out 2. Finding 7: an R2 or R3 change needs its
// pre-state captured and, for R3, a written rollback path before step 1 (CLAUDE.md, contract
// rule 1 and the R3 row). Finding 8: verify-mfa-cleared passes only before the user registers
// again, so it runs right after the gate. Finding 9: the checklist and note give each path its
// own proof, since the one-method delete has no verify-* read-back.
test('/mfa-issue R2 and R3 actions capture pre-state and a rollback path, and each path has its own proof', () => {
  for (const id of ['mfa-require-reregister-portal', 'mfa-method-delete-portal']) {
    const action = PAGE.split('\n').find((l) => l.startsWith(`**PORTAL ACTION [${id}]:**`));
    // the pre-state is the connector's own read, saved as it prints (code review round 2, finding 15)
    assert.match(action, /the method list from `node scripts\/adapters\/msgraph-client\.js auth-methods --user \[USER_ID\] --execute` saved to `tasks\/checkpoints\/`/, id);
    assert.match(action, /rollback path written in the ticket/, id);
  }
  // the R2 revocation captures its pre-state too (code review round 2, finding 10)
  const revoke = PAGE.split('\n').find((l) => l.startsWith('**PORTAL ACTION [mfa-session-revoke-portal]:**'));
  // code review round 3, finding 3: the look-back starts before the loss ([DATE_TIME], written in
  // the ticket), not at [NOT_BEFORE], the time the post-change read-backs start from
  assert.match(revoke, /the user's recent sign-ins from `node scripts\/adapters\/msgraph-client\.js sign-ins --user \[USER_ID\] --since \[DATE_TIME\] --execute` saved to `tasks\/checkpoints\/`/);
  assert.match(revoke, /\[DATE_TIME\] a time before the device was lost/);
  assert.doesNotMatch(revoke, /\[NOT_BEFORE\]/);
  assert.doesNotMatch(revoke, /no pre-state to restore/);
  const re = PAGE.split('\n').find((l) => l.startsWith('**PORTAL ACTION [mfa-require-reregister-portal]:**'));
  assert.match(re, /right away, before the user registers again \(step 2\)/);
  const lines = PAGE.split('\n');
  const i = lines.findIndex((l) => /msgraph-client\.js verify-mfa-cleared /.test(l));
  assert.match(lines[i - 1], /run it right after that gate, before the user registers again/);
  assert.match(PAGE, /^- \[ \] Require re-register MFA path: `verify-mfa-cleared` passed under its change right after the gate, before the new registration$/m);
  // code review round 3, finding 8: the raw read holds phone numbers and device names, so it stays
  // in tasks/checkpoints/ and the ticket gets the method type only
  // batch G3 close-out 3, owner decision H3: the delete is proved by verify-method-absent under
  // its change; the raw auth-methods output still stays in tasks/checkpoints/
  assert.match(PAGE, /^- \[ \] One-method delete path: `verify-method-absent` passed under its change \(the `auth-methods` output stays in `tasks\/checkpoints\/`; the ticket names the method type only\)$/m);
  assert.doesNotMatch(PAGE, /its output written in the ticket|the `auth-methods` output for the delete/);
  assert.doesNotMatch(PAGE, /`verify-mfa-cleared` passed after the re-register step/, 'the old unconditional checklist line is gone');
});


// Batch G3 close-out 3, owner decision H3: every R2 and R3 gate in /mfa-issue has a read-back
// bound to its change: session revocation by verify-sessions-revoked, the one-method delete by
// verify-method-absent, Require re-register MFA by verify-mfa-cleared. The vendor facts quote
// the two Microsoft Learn pages, and the scope manifest names the least-privileged read for each.
test('every R2 and R3 gate in /mfa-issue has a read-back bound to its change', () => {
  const lines = PAGE.split('\n');
  const bound = [
    ['mfa-session-revoke-portal', 'node scripts/adapters/msgraph-client.js verify-sessions-revoked --user [USER_ID] --not-before [NOT_BEFORE] --change [CHANGE_ID] --execute'],
    ['mfa-method-delete-portal', 'node scripts/adapters/msgraph-client.js verify-method-absent --user [USER_ID] --method-id [METHOD_ID] --change [CHANGE_ID] --execute'],
    ['mfa-require-reregister-portal', 'node scripts/adapters/msgraph-client.js verify-mfa-cleared --user [USER_ID] --change [CHANGE_ID] --execute'],
  ];
  for (const [gate, line] of bound) {
    const i = lines.indexOf(line);
    assert.ok(i > 0, `${gate}: ${line}`);
    assert.match(lines[i - 1], new RegExp(`^# HUMAN-RUN read-only read-back of \\[${gate}\\]`), gate);
  }
  const para = lines.find((l) => l.startsWith('**Change record (R2 and R3 gates):**'));
  for (const rb of ['msgraph:verify-sessions-revoked', 'msgraph:verify-method-absent', 'msgraph:verify-mfa-cleared']) assert.ok(para.includes(`\`${rb}\``), rb);
  assert.doesNotMatch(PAGE, /take no change record/);
  assert.match(PAGE, /^- \[ \] Session revocation: `verify-sessions-revoked` passed under its change/m);
  const facts = read('docs', 'aegis', 'g3', 'vendor-facts.md');
  const m26 = facts.split('\n').find((l) => l.startsWith('- M-26.'));
  assert.ok(m26 && m26.includes('"by resetting the') && m26.includes('https://learn.microsoft.com/graph/api/user-revokesigninsessions?view=graph-rest-1.0') && /few minutes/.test(m26), String(m26));
  const m27 = facts.split('\n').find((l) => l.startsWith('- M-27.'));
  assert.ok(m27 && m27.includes('"Requires') && m27.includes('signInSessionsValidFromDateTime'), String(m27));
  const manifest = JSON.parse(read('scripts', 'adapters', 'scope-manifest.json')).connectors.msgraph;
  assert.ok(manifest.least_privilege.some((p) => /^User\.Read\.All\b.*verify-sessions-revoked/.test(p)), 'User.Read.All names verify-sessions-revoked');
  assert.ok(manifest.least_privilege.some((p) => /^UserAuthenticationMethod\.Read\.All\b.*verify-method-absent/.test(p)), 'UserAuthenticationMethod.Read.All names verify-method-absent');
  assert.ok(manifest.sources.some((src) => /user-revokesigninsessions/.test(src.url) && src.read_on === '2026-10-31'));
  assert.ok(manifest.facts.includes('M-26') && manifest.facts.includes('M-27'));
});

// Batch G3 close-out 3, owner decision H5: the "New phone / re-register" list starts at step 1
// and counts on without a gap (it started at 2 since before the batch G3 close-out 2).
test('the New phone / re-register list starts at step 1 and counts on', () => {
  const lines = PAGE.split('\n');
  const from = lines.indexOf('**New phone / re-register:**');
  const to = lines.indexOf('**Not getting prompts:**');
  assert.ok(from > 0 && to > from, 'the section');
  const steps = lines.slice(from, to).map((l) => l.match(/^(\d+)\. /)).filter(Boolean).map((m) => Number(m[1]));
  assert.deepEqual(steps, steps.map((_, i) => i + 1), `steps ${steps.join(', ')}`);
});

// Code review round 1 of the batch G3 close-out 3, finding 14: under CommonMark a list item that
// does not start at 1 cannot interrupt a paragraph or a quote, so steps 2 and 3, written straight
// after the PORTAL ACTION paragraph and the PREVIEW ONLY quote, rendered as part of them. Each step
// after the first follows a blank line or another step's line.
test('each step of the New phone / re-register list after the first renders as a list item', () => {
  const lines = PAGE.split('\n');
  const from = lines.indexOf('**New phone / re-register:**');
  const to = lines.indexOf('**Not getting prompts:**');
  for (let i = from + 1; i < to; i += 1) {
    const m = lines[i].match(/^(\d+)\. /);
    if (!m || m[1] === '1') continue;
    assert.ok(lines[i - 1] === '' || /^\d+\. /.test(lines[i - 1]), `mfa-issue.md:${i + 1}: step ${m[1]} follows ${JSON.stringify(lines[i - 1].slice(0, 40))}`);
  }
});
