'use strict';
// fleet-runbooks.test.js: what the five Fleet runbooks (lane G2) must say, beyond the
// generic gate grammar that scripts/command-safety-gates.test.js already checks.
//
// Contract: PRODUCT_CONTRACT.md (AEGIS ADVISES; HUMANS EXECUTE PRODUCTION CHANGES), the
// R0 to R3 ladder in CLAUDE.md, SR-2 in modules/security/security-doctrine.md, and the
// Fleet section of docs/aegis/lanes/g2.md. Each test pins one reviewed decision so a later
// edit cannot quietly undo it. The files are read as text; nothing here runs a command.

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (name) => fs.readFileSync(path.join(ROOT, '.claude', 'commands', `${name}.md`), 'utf8');

const DEVICE = read('fleet-device-actions');
const HEALTH = read('fleet-host-health');
const POLICY = read('fleet-policy-failures');
const OSQUERY = read('fleet-osquery-investigation');
const VULN = read('fleet-vulnerable-software');

// One portal gate's region: from its SAFETY GATE marker to the next marker or heading.
function gate(text, id) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.includes(`<!-- SAFETY GATE [${id}] -->`));
  assert.ok(start >= 0, `gate ${id} not found`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\s*(?:<!--\s*SAFETY GATE|>\s*\*\*PREVIEW ONLY|#{1,6}\s)/.test(lines[i])) { end = i; break; }
  }
  const region = lines.slice(start, end).join('\n');
  const field = (name) => (region.match(new RegExp(`^- \\*\\*${name}:\\*\\*\\s*(.+)$`, 'm')) || [])[1] || '';
  const portal = (region.match(new RegExp(`^\\*\\*PORTAL ACTION \\[${id}\\]:\\*\\*\\s*(.+)$`, 'm')) || [])[1] || '';
  const phrase = (field('Required confirmation').match(/Type exactly `([^`]+)`/) || [])[1] || '';
  return { region, field, portal, phrase };
}

// The text of one "## " or "### " section, by the start of its heading.
function section(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => /^#{2,3} /.test(line) && line.replace(/^#{2,3} /, '').startsWith(heading));
  assert.ok(start >= 0, `section ${heading} not found`);
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = lines[i].match(/^(#{1,6}) /);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

test('deleting a host record is R3 everywhere (SR-2 device delete), with pre-state and rollback path before step 1', () => {
  const del = gate(DEVICE, 'fleet-device-actions-delete-portal');
  assert.match(del.field('Reversibility'), /^R3\b/, 'the delete gate is R3');
  assert.match(del.portal, /pre-state is saved to `tasks\/checkpoints\/`/, 'R3 needs the captured pre-state');
  assert.match(del.portal, /rollback path is written in the ticket before step 1/, 'R3 needs the written rollback path before step 1');
  assert.match(del.portal, /re-enrolls/, 'the rollback path says the record returns only by re-enrollment');
  assert.match(del.portal, /history and labels are lost/);

  assert.match(DEVICE, /\*\*Delete host\*\* \(R3\b/, 'the summary at the top names Delete host R3');
  assert.match(DEVICE, /^- Delete host is R3 as well: save the Phase A pre-state to `tasks\/checkpoints\/`/m);
  assert.match(DEVICE, /then delete the record \(R3 gate\)/, 'the fast path names the delete gate R3');
  assert.match(DEVICE, /^## Phase F: .*\(R3 each\)$/m, 'the Phase F heading names both actions R3');
  assert.doesNotMatch(section(DEVICE, 'Phase F'), /\bR2\b/, 'no R2 is left in Phase F');
  assert.doesNotMatch(DEVICE, /\*\*Delete host\*\* \(R2\)|delete the record \(R2|then R2\)/);

  assert.match(HEALTH, /removing the stale record is a gated R3 change/, 'fleet-host-health sends the stale record to the R3 gate');
  assert.doesNotMatch(HEALTH, /gated R2 change/);
});

test('each lock, wipe and Turn off MDM read-back names a proof that can pass on the platform it covers', () => {
  const lock = section(DEVICE, 'Phase B');
  assert.match(lock, /^\*\*Read-back, by platform:\*\*$/m);
  assert.match(lock, /^- Android: `verify-lock` cannot pass here/m, 'Android lock: verify-lock is named as unable to pass');
  assert.match(lock, /locked_host entry in `node scripts\/adapters\/fleet-client\.js host-activities --id \[HOST_ID\] --execute`/);
  assert.match(lock, /sees the lock screen on the device/, 'Android lock: the device itself confirms it');
  assert.match(lock, /An Android host never shows Locked: wait until Lock pending is gone/, 'the wait does not hang on a badge Android never shows');

  const wipe = section(DEVICE, 'Phase D');
  assert.match(wipe, /^- Company-owned Android: `verify-wipe` cannot pass here/m);
  assert.match(wipe, /`mdm\.device_status` `wiping` and then `wiped`, plus the wiped_host entry/);
  assert.match(wipe, /^- Linux: `verify-wipe` cannot pass here either/m);
  assert.match(wipe, /^- Mac, iPhone, iPad and Windows: `node scripts\/adapters\/fleet-client\.js verify-wipe/m);

  const mdmOff = section(DEVICE, 'F1: Turn off MDM');
  assert.match(mdmOff, /^- Mac: `node scripts\/adapters\/fleet-client\.js verify-mdm-off/m);
  assert.match(mdmOff, /^- iPhone, iPad and personally owned Android: `verify-mdm-off` covers macOS only here/m);
  assert.match(mdmOff, /mdm_unenrolled entry in `node scripts\/adapters\/fleet-client\.js host-activities --id \[HOST_ID\] --execute`/);
  assert.match(mdmOff, /`mdm\.enrollment_status` in `node scripts\/adapters\/fleet-client\.js host --id \[HOST_ID\] --execute` reading Off/);

  const checklist = section(DEVICE, '✅ Verification checklist');
  assert.match(checklist, /Android: no Locked badge and `verify-lock` cannot pass/);
  assert.match(checklist, /`wiped` plus wiped_host \(Android\)/);
  assert.match(checklist, /mdm_unenrolled plus enrollment Off \(iPhone, iPad, Android\)/);
});

test('the cancel gate names the one queued item it stops, in its target, its phrase and its read-back (SR-2: name the object)', () => {
  const cancel = gate(DEVICE, 'fleet-device-actions-cancel-portal');
  assert.match(cancel.field('Target'), /\[PENDING_ACTION\] \(\[PENDING_ACTION_ID\]\) queued for \[HOST_ID\]/);
  assert.equal(cancel.phrase, 'STOP PENDING [PENDING_ACTION] [PENDING_ACTION_ID] ON HOST [HOST_ID]');
  assert.match(cancel.field('Scope'), /exactly the one entry under Upcoming that `\[PENDING_ACTION_ID\]` names; other queued items stay queued/);
  assert.match(cancel.portal, /the item and its ID are written in the ticket/);
  assert.match(cancel.region, /\*\*Cancel\*\* on `\[PENDING_ACTION\]` \(`\[PENDING_ACTION_ID\]`\) only\./);
  assert.match(cancel.region, /\*\*Read-back:\*\* Upcoming no longer lists `\[PENDING_ACTION\]` \(`\[PENDING_ACTION_ID\]`\), and every other item it listed before is still there/);
  assert.match(cancel.region, /--command-status pending --execute` no longer lists `\[PENDING_ACTION_ID\]`/);
  const phaseG = section(DEVICE, 'Phase G');
  assert.match(phaseG, /lists each pending command with its request type \(DeviceLock, EnableLostMode, EraseDevice\) and its command UUID/, 'where the operator reads an MDM command ID');
  assert.match(phaseG, /Two items you cannot tell apart, or an ID you cannot read: stop/, 'the stop when the item cannot be named');
  const placeholders = DEVICE.split('\n').find((l) => l.startsWith('**Placeholders:**'));
  assert.match(placeholders, /`\[PENDING_ACTION\]` \(the one queued item to cancel/);
  assert.match(placeholders, /`\[PENDING_ACTION_ID\]` \(that item's ID/);
});

test('a remediation script on one host takes its R-class from what it changes, as in /fleet-device-actions E1: a security setting is R3 with the review', () => {
  const phase2 = section(POLICY, 'Phase 2');
  assert.match(phase2, /^### Phase 2: Fix one host \(R2, or R3 for a security setting; gated\)$/m);
  assert.match(phase2, /A script that changes a security setting \(the firewall, disk encryption, screen lock and the like\) or deletes data is R3/);
  assert.match(phase2, /save the setting's current value to `tasks\/checkpoints\/` and the ticket, write the rollback path/, 'R3 needs pre-state and rollback path');
  assert.match(phase2, /get the independent out-of-session review/, 'R3 needs the independent review');
  const run = gate(POLICY, 'fleet-policy-failures-run-script-portal');
  assert.match(run.field('Reversibility'), /^R2, or R3 by the rule above:/);
  assert.match(run.portal, /its R-class set, the independent review approved it when it is R3/, 'the portal precondition holds the review for R3');
  assert.doesNotMatch(POLICY, /^### Phase 4: .*\(R2 each\)$/m, 'Phase 4 follows the Phase 2 class, not a fixed R2');
  // The same action in /fleet-device-actions uses the same rule.
  assert.match(DEVICE, /a script that deletes data or changes a security setting is R3 and needs the independent review/);
});

test('more than 10 hosts already failing a policy go to the R3 batch gate in /fleet-device-actions, never to Phase 5, which does not reach them', () => {
  const phase4 = section(POLICY, 'Phase 4');
  const step3 = phase4.split('\n').find((l) => l.startsWith('3. ')) || '';
  assert.match(step3, /More than 10 out-of-line hosts is a mass write \(R3\), and Phase 5 does not reach them/);
  assert.match(step3, /through the R3 batch gate in `\/fleet-device-actions` \(E2\)/);
  assert.match(step3, /the host count is written in the ticket, the independent out-of-session review approved it/);
  assert.doesNotMatch(step3, /plan it through Phase 5/, 'Phase 5 is not a route for hosts already failing');
  const automation = gate(POLICY, 'fleet-policy-failures-automation-portal');
  assert.match(automation.field('Scope'), /more than 10 through the batch gate Phase 4 names/, 'Phase 5 points back to the same route');
  const batch = gate(DEVICE, 'fleet-device-actions-batch-script-portal');
  assert.match(batch.field('Reversibility'), /^R3\b/, 'the gate Phase 4 names is R3');
});

test('the R1 gates that say "installs nothing" keep every path that could install out of them', () => {
  const patch = gate(VULN, 'fleet-vulnerable-software-patch-policy-portal');
  assert.match(patch.field('Reversibility'), /^R1\b/);
  assert.doesNotMatch(patch.region, /Deploy → \*\*Patch\*\*/, 'the Deploy → Patch control (behaviour unverified) is not a step of the R1 policy gate');
  assert.match(patch.field('Scope'), /Deploy → Patch control is not part of this gate: the sources read do not say what it creates or whether it installs \(unverified\)/);
  assert.match(patch.region, /^1\. For every title, a Fleet-maintained app included: Fleet → Policies → `\[FLEET_NAME\]` → \*\*Add policy\*\*/m);

  const add = gate(VULN, 'fleet-vulnerable-software-add-software-portal');
  assert.match(add.field('Reversibility'), /^R1\b/);
  assert.doesNotMatch(add.field('Scope'), /^one software title in one fleet; adding it installs nothing on any host$/, 'no unconditional "installs nothing"');
  assert.match(add.field('Scope'), /offered for manual install only/);
  assert.match(add.region, /leave the install mode on manual, with any automatic install and self-service option off → \*\*Add\*\*/);
  assert.match(add.region, /leave any automatic install and self-service option off, before saving/, 'the custom-package path too');
  assert.match(add.region, /If automatic install is chosen, or the dialog will not leave it off, stop without saving: .*R3 rollout in Phase 4/);
});

test('the role check reads the operator\'s own role in Fleet; `me` only confirms the adapter token is an Observer', () => {
  for (const [name, text] of [['fleet-policy-failures', POLICY], ['fleet-osquery-investigation', OSQUERY], ['fleet-vulnerable-software', VULN]]) {
    const line = text.split('\n').find((l) => /\*\*Your role \(R0\):\*\*/.test(l)) || '';
    assert.ok(line, `${name}: the role check is present`);
    assert.match(line, /the role that counts is yours, the person who will click/, `${name}: the operator's own role is the evidence`);
    assert.match(line, /Read it in Fleet on your own account page \(My account\), or ask a Fleet Admin/, `${name}: where the operator reads it`);
    assert.match(line, /prints the adapter token's own role, not yours: expect Observer/, `${name}: me is the token's role only`);
    assert.doesNotMatch(line, /me --execute` prints the token's (?:global )?role/, `${name}: me is never presented as the operator's role`);
    const prerequisites = text.split('\n').find((l) => l.startsWith('**Prerequisites:**')) || '';
    assert.match(prerequisites, /own Fleet role, read in Fleet \(check \d\), not the adapter token's role from `me`/, `${name}: the prerequisite names the operator's own role`);
  }
});
