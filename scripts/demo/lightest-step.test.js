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
  fs.writeFileSync(path.join(dir, 'example-lost.md'), ['# Lost', '## Lost', '**User check:** confirm the phone is gone.', '', portal('ex-lost-wipe', 'R3', 'erase the phone'), ''].join('\n'));
  assert.equal(lightestStepFirst(answer('ex-lost-wipe'), catalog(dir)).verdict, 'pass', 'a User check is no admin step');
});

// ── Batch 10, task 1: one rung per action block ─────────────────────────────────────────────────────────
// EXPECTED DECISION (written before the code)
// - The aegis-desk block lists only the gates to run now. The row also fails when the block holds a gate of a
//   higher reversibility class (R2 or R3) together with a lighter gate for the same symptom: the runbook names
//   the lighter one as its rung below, on a "Try first:" or "Lighter step:" line in the heavier gate's section
//   (by gate id or by the phase that holds it), or on a fallback line ("Last resort", "only when the steps
//   above did not ...", "if it still ...") that names the heavier gate after the lighter gate in one section.
// - It also fails when a gate in the block is named, outside the block, on a line that calls it a last resort
//   or a step for when an earlier change did not work, and the block holds another gate: two rungs in one block.
// - It passes when the block holds only the rung to run now, even after user checks ("if it still loops" after
//   a user check is the order of the ticket, not a second rung), and when two gates of one block are steps of
//   one checklist that no ladder line ties together (an offboarding).
const REPO = path.join(__dirname, '..', '..');
const T9M_9B = fs.readFileSync(path.join(REPO, 'docs', 'aegis', 'demo', 'evidence', 'batch9b', 'T9m', 'answers', 'T9m-answer.txt'), 'utf8');
// the same answer with only the session clear in its block: the last four lines of the block taken out
const T9M_ONE_RUNG = T9M_9B.replace(/\nGate: okta-mfa-reset-selected-portal\n[\s\S]*?(?=\n```)/, '');

test('batch 10, task 1: batch 9b\'s T9m answer fails, its block holds the session clear and the last-resort reset', () => {
  // catches: a row that reads only the first gate (batch 9b's row passed this answer)
  const row = lightestStepFirst(T9M_9B, catalog());
  assert.equal(row.verdict, 'fail', row.detail);
  assert.match(row.detail, /okta-mfa-reset-selected-portal/);
  assert.match(row.detail, /okta-mfa-reset-clear-sessions-portal/);
});

test('batch 10, task 1: the same T9m answer with only the session clear in the block passes', () => {
  // catches: a row that fails every answer whose prose mentions a later, heavier step
  assert.doesNotMatch(T9M_ONE_RUNG, /Gate: okta-mfa-reset-selected-portal/, 'the fixture took the reset out');
  assert.match(T9M_ONE_RUNG, /Gate: okta-mfa-reset-clear-sessions-portal/);
  assert.equal(lightestStepFirst(T9M_ONE_RUNG, catalog()).verdict, 'pass');
});

const LADDER_RUNBOOK = ['# Example mail forwarding', '',
  '## Phase B: Turn off the forwarding rule (R2)', '**User check:** ask whether the user set up the forwarding themselves.', '', portal('ex-rule-off', 'R2', 'turn off one inbox forwarding rule'), '',
  '## Phase C: Delete every inbox rule (R3)', '**Try first:** Phase B, turn off the forwarding rule and watch for new forwarding.', '', portal('ex-rules-delete', 'R3', 'delete every inbox rule of one mailbox'), '',
  '## Phase D: Sign the user out', portal('ex-app-signout', 'R1', 'sign the user out of the app'), '',
  '## Phase E: Revoke the app token', portal('ex-app-token-revoke', 'R1', 'revoke the app token'), '',
  '## Phase F: Hand over the files', portal('ex-files-transfer', 'R2', 'move the files to the manager'), '',
].join('\n');
function ladderCatalog(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-ladder-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'example-forwarding.md'), LADDER_RUNBOOK);
  return catalog(dir);
}
const withDetails = (details, ...gates) => ['## Fix', "**What's wrong:** x.", '', '## Details', ...details, '', '```aegis-desk', ...gates.map((g) => `Gate: ${g}`), '```', ''].join('\n');

test('batch 10, task 1, pair 1: a rule turned off and the delete its runbook says to try it before, in one block, fails; the rule turned off alone passes', (t) => {
  // catches: a row that compares the two gates' R classes without asking whether the runbook ties them as rungs
  const c = ladderCatalog(t);
  const both = lightestStepFirst(withDetails([], 'ex-rule-off', 'ex-rules-delete'), c);
  assert.equal(both.verdict, 'fail', both.detail);
  assert.match(both.detail, /ex-rules-delete/);
  const later = ['- Step 5, only if forwarding comes back within a day: delete every inbox rule, gate `ex-rules-delete`.'];
  assert.equal(lightestStepFirst(withDetails(later, 'ex-rule-off'), c).verdict, 'pass', 'the delete named for later, outside the block');
  // the order inside the block does not hide it
  assert.equal(lightestStepFirst(withDetails([], 'ex-rules-delete', 'ex-rule-off'), c).verdict, 'fail');
});

test('batch 10, task 1, pair 2: two gates of one class, the second named as the step for when the first did not work, fail together; the first alone passes', (t) => {
  // catches: a row that only compares R classes, so two R1 rungs in one block pass
  const c = ladderCatalog(t);
  const details = ['- Step 4, only if signing out did not stop the prompts: revoke the app token, gate `ex-app-token-revoke`.'];
  const both = lightestStepFirst(withDetails(details, 'ex-app-signout', 'ex-app-token-revoke'), c);
  assert.equal(both.verdict, 'fail', both.detail);
  assert.match(both.detail, /ex-app-token-revoke/);
  assert.equal(lightestStepFirst(withDetails(details, 'ex-app-signout'), c).verdict, 'pass');
  // "if it still fails" after a user check, with its one gate in the block, is the rung to run now
  const afterCheck = ['- Step 3, if the user check in step 2 did not work: revoke the app token, gate `ex-app-token-revoke`.'];
  assert.equal(lightestStepFirst(withDetails(afterCheck, 'ex-app-token-revoke'), c).verdict, 'pass');
});

test('batch 10, task 1: gates of one checklist that no ladder line ties together pass, here and in the real offboarding runbook', (t) => {
  // catches: a row that fails every block holding an R1 and an R2 gate, such as an offboarding
  assert.equal(lightestStepFirst(withDetails([], 'ex-app-signout', 'ex-files-transfer'), ladderCatalog(t)).verdict, 'pass');
  const offboard = withDetails([], 'gws-offboard-okta-deactivate-portal', 'gws-offboard-suspend-portal', 'gws-offboard-drive-transfer-portal', 'gws-offboard-calendar-transfer-portal');
  assert.equal(lightestStepFirst(offboard, catalog()).verdict, 'pass', lightestStepFirst(offboard, catalog()).detail);
});
