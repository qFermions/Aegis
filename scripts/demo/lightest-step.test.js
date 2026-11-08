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

// Code review round 1 (batch 10), finding class B: the runbook ladder reader. It read a <details> block of
// scripted twins as gates of the phase above it; it took a phase a Try first line names only as the undo or the
// way back ("Phase C's Unlock undoes it") as a lighter rung; it missed "Phases B to D"; and it called a gate a
// later step when a fallback word anywhere on its line ("otherwise the user keeps looping") was not about it.
// Wrong implementations it catches: each of those four readings. Real runbooks, so the cases are the ones the
// review verified; the fixture covers the <details> boundary and the fallback tie on their own.
test('code review 1, class B (batch 10): the ladder reader keeps reference blocks, undo phases, phase ranges and unrelated fallback words out', (t) => {
  const c = catalog();
  const row = (...g) => lightestStepFirst(withDetails([], ...g), c);
  assert.equal(row('fleet-device-actions-lock-portal', 'fleet-device-actions-wipe-portal').verdict, 'fail', 'Lock is the rung below Wipe');
  assert.equal(row('fleet-device-actions-unlock-portal', 'fleet-device-actions-wipe-portal').verdict, 'pass', 'Unlock is named only as the undo');
  assert.equal(row('okta-user-lifecycle-suspend-portal', 'okta-user-lifecycle-deactivate-portal').verdict, 'fail', 'Suspend is the rung below Deactivate');
  assert.equal(row('okta-user-lifecycle-unsuspend-portal', 'okta-user-lifecycle-deactivate-portal').verdict, 'pass', 'Phase E is named only as the undo');
  assert.equal(row('okta-user-lifecycle-activate-portal', 'okta-user-lifecycle-reset-password-portal').verdict, 'pass', 'the scripted twins under Phase H are no rung of it');
  assert.equal(row('gws-2sv-reset-backup-codes-portal', 'gws-2sv-reset-turn-off-portal').verdict, 'fail', '"Phases B to D" names Phase B');
  assert.equal(row('gws-2sv-reset-key-remove-portal', 'gws-2sv-reset-turn-off-portal').verdict, 'fail', '"Phases B to D" names Phase C, between them');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-ladder-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'example-ref.md'), ['# Example', '## Phase B: Sign out (R1)', portal('ex-ref-signout', 'R1', 'sign the user out'), '',
    '## Phase C: Close the account (R3)', '**Try first:** Phase B, sign the user out.', '', '<details>', '<summary>API, the scale version</summary>', '', '```bash', '# SAFETY GATE [ex-ref-wipe-api]', '# Target: [UPN]', '# Effect: erase the account', '# Reversibility: R3: not reversible', '```', '', '</details>', '',
    '## Phase D: Revoke a token (R1)', portal('ex-ref-revoke', 'R1', 'revoke the token'), ''].join('\n'));
  const fx = catalog(dir);
  assert.equal(lightestStepFirst(withDetails([], 'ex-ref-signout', 'ex-ref-wipe-api'), fx).verdict, 'pass', 'a gate in a <details> block is not a rung of the phase above it');
  const unrelated = ['- Run `ex-ref-signout` now; otherwise the user keeps getting prompts.'];
  assert.equal(lightestStepFirst(withDetails(unrelated, 'ex-ref-signout', 'ex-ref-revoke'), fx).verdict, 'pass', 'the fallback word is in another clause than the gate');
  const tied = ['- Only if signing out did not stop the prompts: `ex-ref-revoke`.'];
  assert.equal(lightestStepFirst(withDetails(tied, 'ex-ref-signout', 'ex-ref-revoke'), fx).verdict, 'fail', 'the fallback is about this gate');
});

// Code review round 2 (batch 10), class B2: edges of round 1's reader. A later-step condition and its gate id written
// in two sentences ("Last resort: erase the Mac. Gate [x].", or with "e.g." inside) no longer tied; a phase named
// beside an undo note in one clause ("Phase B, which Phase D undoes") or a lighter step that is itself a restore was
// dropped; and after </details> the phase the block interrupted did not go on. Wrong implementations it catches: a
// split at every sentence end; a whole clause dropped for one undo word; a new section after </details>.
test('code review 2, class B2 (batch 10): two-sentence later steps tie, an undo note drops only its own phase, a phase goes on after </details>', (t) => {
  const c = catalog();
  for (const line of ['- Last resort: erase the Mac. Gate `jamf-lock-erase-wipe-portal`.', '- If it still does not come back (e.g. after a week), use `jamf-lock-erase-wipe-portal`.']) {
    assert.equal(lightestStepFirst(withDetails([line], 'okta-user-lifecycle-clear-sessions-portal', 'jamf-lock-erase-wipe-portal'), c).verdict, 'fail', line);
  }
  assert.equal(lightestStepFirst(withDetails(['- Run `okta-user-lifecycle-clear-sessions-portal` now. Otherwise the user keeps looping.'], 'okta-user-lifecycle-clear-sessions-portal', 'jamf-lock-erase-lock-portal'), c).verdict, 'pass', 'Otherwise opens another sentence');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-ladder-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'example-b2.md'), ['# Example',
    '## Phase B: Sign out (R1)', portal('ex-b2-signout', 'R1', 'sign the user out'), '',
    '## Phase C: Close the account (R3)', '**Try first:** Phase B, which Phase D undoes.', '', portal('ex-b2-close', 'R3', 'close the account'), '',
    '## Phase D: Restore the account (R1)', portal('ex-b2-restore', 'R1', 'restore the account'), '',
    '## Phase E: Purge the account (R3)', '**Try first:** Phase D, restore the account from the recycle bin.', '', portal('ex-b2-purge', 'R3', 'purge the account'), '',
    '## Phase F: Wipe the device (R3)', '**Try first:** Phase B, sign the user out.', '', '<details>', '<summary>API, the scale version</summary>', '', '```bash', '# SAFETY GATE [ex-b2-wipe-api]', '# Target: [UPN]', '# Reversibility: R3: not reversible', '```', '', '</details>', '', portal('ex-b2-wipe-portal', 'R3', 'wipe the device'), ''].join('\n'));
  const fx = catalog(dir);
  assert.equal(lightestStepFirst(withDetails([], 'ex-b2-signout', 'ex-b2-close'), fx).verdict, 'fail', 'Phase B is the rung below; only Phase D is the undo');
  assert.equal(lightestStepFirst(withDetails([], 'ex-b2-restore', 'ex-b2-purge'), fx).verdict, 'fail', 'a restore can be the lighter step');
  assert.equal(lightestStepFirst(withDetails([], 'ex-b2-signout', 'ex-b2-wipe-portal'), fx).verdict, 'fail', 'the phase goes on after </details>');
});
