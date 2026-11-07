'use strict';
// ladder-audit.test.js: lightest fix first, as a lint over every runbook (batch 9, task 8b).
//
// EXPECTED DECISION (written before ladder-audit.js)
// - A runbook section runs from a heading outside a code fence to the next one. A section is audited when it
//   holds a heavy gate: a SAFETY GATE whose R class is R3, or whose id or Effect line resets, wipes, erases,
//   deletes or re-registers.
// - It passes when a lighter step comes before its first heavy gate in the same section: a SAFETY GATE of R0
//   to R2 that is not heavy, a PREVIEW ONLY marker whose id is not heavy, or a line written as a step for this
//   ladder ("**User check:**", "**Lighter step:**", "**Try first:**"); or when the section has a line
//   "No lighter step: <reason>". Otherwise it fails, and the reason names the gate.
// - Microsoft and Google are separate rows of the audit, never one.
// Run: node --test scripts/lint/ladder-audit.test.js

const assert = require('node:assert/strict');
const test = require('node:test');

const ladder = require('./ladder-audit.js');

const gate = (id, r, effect, portal = true) => (portal
  ? [`<!-- SAFETY GATE [${id}] -->`, '- **Target:** [UPN]', `- **Effect:** ${effect}`, `- **Reversibility:** ${r}: as stated`, '- **Read-back:** none (a reason)']
  : ['```bash', `# SAFETY GATE [${id}]`, '# Target: [UPN]', `# Effect: ${effect}`, `# Reversibility: ${r}: as stated`, '# Read-back: none (a reason)', '```']).join('\n');

test('a section whose heavy gate comes after a lighter gate passes', () => {
  // catches: a lint that fails every section holding a heavy gate, lighter step or not
  const text = ['# X', '## Fix it', gate('x-signout', 'R1', 'sign the user out of every session'), '', gate('x-reset', 'R2', 'reset every authenticator')].join('\n');
  const [s] = ladder.auditText(text, 'x');
  assert.equal(s.verdict, 'pass', s.reason);
  assert.equal(s.heavy, 'x-reset');
});

test('a section whose first heavy gate has nothing lighter before it fails, and the reason names the gate', () => {
  // catches: a lint that counts a lighter step after the heavy gate, or one in another section
  const text = ['# X', '## Look', '**User check:** ask the user to sign in again.', '## Reset', gate('x-wipe', 'R3', 'wipe the device'), gate('x-signout', 'R1', 'sign the user out')].join('\n');
  const rows = ladder.auditText(text, 'x');
  assert.equal(rows.length, 1, 'only the section with a heavy gate is audited');
  assert.equal(rows[0].verdict, 'fail');
  assert.match(rows[0].reason, /x-wipe/);
});

test('a "No lighter step: <reason>" line passes the section, and an empty one does not', () => {
  // catches: a lint that ignores the escape line, or one that takes the bare words with no reason
  const ok = ['# X', '## Erase', 'No lighter step: the device is lost, so nothing on it can be signed out first.', gate('x-erase', 'R3', 'erase the Mac', false)].join('\n');
  assert.equal(ladder.auditText(ok, 'x')[0].verdict, 'pass');
  const empty = ['# X', '## Erase', 'No lighter step:', gate('x-erase', 'R3', 'erase the Mac', false)].join('\n');
  assert.equal(ladder.auditText(empty, 'x')[0].verdict, 'fail');
});

test('heavy means R3, or a reset, wipe, erase, delete or re-register in the id or the Effect line', () => {
  // catches: a lint that reads only the R class, so an R2 reset escapes the audit
  for (const [id, r, effect] of [['a-b', 'R3', 'turn off a policy'], ['a-reset', 'R2', 'x'], ['a-b', 'R2', 'deletes the device record'], ['a-b', 'R1', 're-register MFA methods'], ['a-erase', 'R1', 'x']]) {
    assert.equal(ladder.auditText(['## S', gate(id, r, effect)].join('\n'), 'x').length, 1, `${id} ${r} ${effect}`);
  }
  assert.equal(ladder.auditText(['## S', gate('a-signout', 'R1', 'sign out the user')].join('\n'), 'x').length, 0, 'a light gate alone is not audited');
});

test('a lighter PREVIEW ONLY marker or a user check counts; a heavy PREVIEW ONLY marker does not', () => {
  // catches: counting any marker as lighter, so a preview of a second wipe passes a wipe
  const preview = ['## S', 'PREVIEW ONLY [x-reauth-portal]: re-authenticate the user', gate('x-reset', 'R3', 'reset all')].join('\n');
  assert.equal(ladder.auditText(preview, 'x')[0].verdict, 'pass');
  const heavyPreview = ['## S', 'PREVIEW ONLY [x-wipe-preview]: wipe it', gate('x-reset', 'R3', 'reset all')].join('\n');
  assert.equal(ladder.auditText(heavyPreview, 'x')[0].verdict, 'fail');
  const userCheck = ['## S', '1. **User check:** restart the phone and open the app again.', gate('x-reset', 'R3', 'reset all')].join('\n');
  assert.equal(ladder.auditText(userCheck, 'x')[0].verdict, 'pass');
});

test('a heading inside a code fence does not start a section', () => {
  // catches: a fenced "# SAFETY GATE" or "# Effect:" comment read as a heading, splitting the section
  const text = ['## S', gate('x-signout', 'R1', 'sign out'), gate('x-erase', 'R3', 'erase the Mac', false)].join('\n');
  assert.equal(ladder.auditText(text, 'x')[0].verdict, 'pass');
});

test('Microsoft and Google are separate vendors, by runbook name', () => {
  // catches: one Microsoft-and-Google row hiding which vendor's runbooks fail
  assert.equal(ladder.vendorOf('gws-password-reset'), 'Google');
  assert.equal(ladder.vendorOf('password-reset'), 'Microsoft');
  assert.equal(ladder.vendorOf('okta-mfa-reset'), 'Okta');
  assert.equal(ladder.vendorOf('jamf-lock-erase'), 'Jamf');
  assert.equal(ladder.vendorOf('fleet-device-actions'), 'Fleet');
});

test('on the real runbooks, --check exits 0: the saved audit is fresh and the fixed scope passes', () => {
  // catches: a runbook edit that makes a section in SCOPE fail again, or an audit file left stale after an edit
  const out = [];
  const err = [];
  const code = ladder.main(['--check'], { out: (s) => out.push(s), err: (s) => err.push(s) });
  assert.equal(code, 0, err.join(''));
  assert.match(out.join(''), /the fixed scope passes/);
});

// Batch 9, found by the runbook fixes' review: the runbook's own name sat inside its gate ids, so a lock in
// /jamf-lock-erase ("jamf-lock-erase-lock-portal") read as an erase. A wrong implementation it catches: matching
// the heavy words against the whole id, runbook name included.
test('the runbook\'s own name in a gate id does not make the gate heavy', () => {
  const text = ['## Lock first', gate('jamf-lock-erase-lock-portal', 'R1', 'lock the Mac at its next check-in'), gate('jamf-lock-erase-wipe-portal', 'R3', 'erase the Mac')].join('\n');
  const [row] = ladder.auditText(text, 'jamf-lock-erase');
  assert.equal(row.heavy, 'jamf-lock-erase-wipe-portal', 'the lock is not the first heavy gate');
  assert.equal(row.verdict, 'pass', row.reason);
  assert.equal(ladder.auditText(text, 'other-runbook')[0].heavy, 'jamf-lock-erase-lock-portal', 'in a runbook of another name the words still count');
});
