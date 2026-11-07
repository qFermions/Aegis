'use strict';
require('../adapters/socket-tripwire.js');
// lightest-step.test.js: the desk check "lightest step first" (batch 9, task 8c).
//
// EXPECTED DECISION (written before the code)
// - The first advised admin change is the first Gate line in the answer's closing aegis-desk block.
// - The check fails when that gate is heavy (R3, or its id or Effect line resets, wipes, erases, deletes or
//   re-registers) and the runbook section holding it lists a lighter admin step before it: a SAFETY GATE of
//   R0 to R2 that is not heavy, or a PREVIEW ONLY marker for a lighter action. A user check in the section is
//   not an admin change, so it does not make the check fail.
// - It passes when the first gate is not heavy, when the section lists no lighter admin step, when the answer
//   advises no change, or when the answer names the lighter gate first.
// - It is a row on the page and never stops the ticket.
// Run: node --test scripts/demo/lightest-step.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { catalog } = require('./catalog.js');
const { lightestStepFirst } = require('./step-ladder.js');

const portal = (id, r, effect) => [`<!-- SAFETY GATE [${id}] -->`, '- **Target:** [UPN]', `- **Effect:** ${effect}`, '- **Scope:** one user', `- **Reversibility:** ${r}: as stated`, `- **Required confirmation:** Type exactly \`DO ${id} FOR [UPN]\`.`, '- **Failure behavior:** stop.', '- **Read-back:** none (a reason)'].join('\n');
const RUNBOOK = ['# Example sign-in loop', '',
  '## Loop after an update', '**User check:** quit and reopen the app.', 'PREVIEW ONLY [ex-loop-reauth]: re-authenticate the user in the console.', '', portal('ex-loop-reset', 'R3', 'reset every authenticator'), '',
  '## Lost phone', '**User check:** confirm the phone is gone.', '', portal('ex-lost-reset', 'R3', 'reset every authenticator'), '',
  '## Sign out first', portal('ex-signout', 'R1', 'sign the user out of every session'), '', portal('ex-signout-reset', 'R2', 'reset the password'), '',
].join('\n');

function fixtureCatalog(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-ladder-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'example-loop.md'), RUNBOOK);
  return catalog(dir);
}
const answer = (...gates) => ['## Fix', "**What's wrong:** x.", '', '```aegis-desk', ...gates.map((g) => `Gate: ${g}`), '```', ''].join('\n');

test('fails: the first change is a heavy reset while the section lists a lighter admin step', (t) => {
  // catches: a check that only looks at the R class of the first gate, ignoring what the section offers
  const row = lightestStepFirst(answer('ex-loop-reset'), fixtureCatalog(t));
  assert.equal(row.check, 'lightest-step-first');
  assert.equal(row.verdict, 'fail');
  assert.match(row.detail, /ex-loop-reauth/);
});

test('passes: the section lists only a user check before the heavy gate', (t) => {
  // catches: a user step counted as an admin change, failing every lost-device reset
  assert.equal(lightestStepFirst(answer('ex-lost-reset'), fixtureCatalog(t)).verdict, 'pass');
});

test('passes: the answer names the lighter gate first, then the heavy one', (t) => {
  // catches: a check that fails whenever a heavy gate appears anywhere in the answer
  assert.equal(lightestStepFirst(answer('ex-signout', 'ex-signout-reset'), fixtureCatalog(t)).verdict, 'pass');
});

test('fails: the heavy gate first, the lighter gate of its own section second', (t) => {
  // catches: a check that reads the set of gates, not their order
  assert.equal(lightestStepFirst(answer('ex-signout-reset', 'ex-signout'), fixtureCatalog(t)).verdict, 'fail');
});

test('passes: no change advised, or a first change that is not heavy, or a gate no runbook holds', (t) => {
  // catches: a check that fails Gate: none answers or crashes on an unknown gate
  const c = fixtureCatalog(t);
  assert.equal(lightestStepFirst(answer('none'), c).verdict, 'pass');
  assert.equal(lightestStepFirst(answer('ex-signout'), c).verdict, 'pass');
  assert.equal(lightestStepFirst(answer('not-a-gate-here'), c).verdict, 'pass');
  assert.equal(lightestStepFirst('No block at all.', c).verdict, 'pass');
});

test('the desk shows it as its own row at step 5, and a failed row does not stop the ticket', async () => {
  // catches: a row computed but never shown, or one that closes the ticket FAILED
  const desk = fs.readFileSync(path.join(__dirname, 'customer-desk.js'), 'utf8');
  assert.match(desk, /lightestStepFirst\(answer, ctx\.gates\)/);
  const close = desk.slice(desk.indexOf('// 5 CHECKS'), desk.indexOf('// 6 APPROVAL'));
  assert.doesNotMatch(close, /lightest[^\n]*close\(/, 'no close() is driven by the row');
});

// Code review round 1 (batch 9), finding 8: a "Try first:" or "Lighter step:" line names a lighter admin action
// (often a gate in another phase), but the row counted only gates and markers. Wrong implementation it catches:
// every ladder line read as a user step.
test('code review 1, finding 8: a Try first or Lighter step line counts as a lighter admin step; a User check does not', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-ladder-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'example-wipe.md'), ['# Example', '## Wipe', '**Try first:** Phase B, lock the Mac.', '', portal('ex-wipe-portal', 'R3', 'erase the Mac'), '', '## Reset', '**Lighter step:** [ex-signout-portal] signs the user out.', '', portal('ex-all-reset', 'R3', 'reset every authenticator'), ''].join('\n'));
  const c = catalog(dir);
  assert.equal(lightestStepFirst(answer('ex-wipe-portal'), c).verdict, 'fail');
  assert.equal(lightestStepFirst(answer('ex-all-reset'), c).verdict, 'fail');
});
