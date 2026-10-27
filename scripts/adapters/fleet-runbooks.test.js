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
