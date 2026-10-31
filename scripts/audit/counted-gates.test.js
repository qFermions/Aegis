'use strict';
// counted-gates.test.js: which gates are counted batch changes (batch G3 close-out 2, owner
// decision 2).
//
// EXPECTED DECISION (written before the module)
// - Every runbook gate whose required confirmation names a count ([HOST_COUNT], [N], a
//   `$...Count` value and the like) is classified, so a new one cannot be missed:
//   - counted (change-record.js COUNTED_GATES): the count is a number of objects the change
//     acts on, and each object has its own verify-* read-back; open takes --expected N and
//     status is done only when N distinct bound read-backs passed;
//   - not counted, with the reason: the number is a setting (required reviews), one read-back
//     proves the whole count, or the gate has no verify-* read-back to count.
// - Each counted gate's runbook tells the operator to open the change with --expected and the
//   count's placeholder, and says what status then reports; the audit README says the same.
// Run: node --test scripts/audit/counted-gates.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { COUNTED_GATES } = require('./change-record.js');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, '.claude', 'commands');
const COUNT = /\[[A-Z_]*COUNT\]|\$[a-zA-Z]*Count\b|\[N\]/;

const ONE_READ = 'one verify-* read-back proves the whole count, so there is nothing to count per object';
const NO_VERIFY = 'no verify-* read-back proves it, so no change record can count one';
const NOT_COUNTED = Object.freeze({
  'github-branch-protection-add-rule-portal': '[N] is a setting, the number of required reviews, not a number of objects',
  'github-branch-protection-strengthen-rule-portal': '[N] is a setting, the number of required reviews, not a number of objects',
  'github-branch-protection-lower-reviews-portal': '[N] is a setting, the number of required reviews, not a number of objects',
  'github-org-security-2fa-require-portal': `one organization setting; ${ONE_READ} (verify-2fa-required)`,
  'github-repo-access-team-grant-portal': `one grant to one team, [MEMBER_COUNT] is the team's size; ${ONE_READ} (verify-collaborator for one member)`,
  'jamf-config-profiles-remove-group-portal': `one scope change; ${ONE_READ} (verify-group-count, verify-profile)`,
  'jamf-inventory-groups-smart-criteria-portal': `${ONE_READ} (verify-group-count --expect [MEMBER_COUNT])`,
  'jamf-inventory-groups-static-members-portal': `each Mac is read with the computer read, not a verify-* command; ${NO_VERIFY}`,
  'jamf-policies-self-service-change-portal': `one policy change; ${ONE_READ} (verify-policy)`,
  'slack-guests-connect-readd-members-portal': `proved in the GUI, the adapter reads no channel membership; ${NO_VERIFY}`,
  'offboard-clear-mfa-portal': `Microsoft runbook gate with no R class; ${NO_VERIFY}`,
  'offboard-license-remove-portal': `Microsoft runbook gate with no R class; ${NO_VERIFY}`,
  'offboard-group-strip-portal': `Microsoft runbook gate with no R class; ${NO_VERIFY}`,
  'offboard-dl-strip-portal': `Microsoft runbook gate with no R class; ${NO_VERIFY}`,
  'offboard-mailbox-delegation-strip-portal': `Microsoft runbook gate with no R class; ${NO_VERIFY}`,
  'offboard-voicemail-clear-portal': `Microsoft runbook gate with no R class; ${NO_VERIFY}`,
  'offboard-vpn-portal': `Microsoft runbook gate with no R class; ${NO_VERIFY}`,
  'offboard-physical-portal': `Microsoft runbook gate with no R class; ${NO_VERIFY}`,
  'quarantine-release-all-portal': `Microsoft runbook gate with no R class; ${NO_VERIFY}`,
  'print-queue-delete-portal': `Microsoft runbook gate with no R class; ${NO_VERIFY}`,
});

// gate id -> { file, confirmation } for every gate whose required confirmation names a count
function countGates() {
  const found = new Map();
  for (const file of fs.readdirSync(DIR).filter((n) => n.endsWith('.md'))) {
    let gate = null;
    for (const line of fs.readFileSync(path.join(DIR, file), 'utf8').split('\n')) {
      const m = line.match(/<!-- SAFETY GATE \[([^\]]+)\] -->|^# SAFETY GATE \[([^\]]+)\]/);
      if (m) gate = m[1] || m[2];
      if (gate && /^(?:- \*\*Required confirmation:\*\*|# Required confirmation:)/.test(line) && COUNT.test(line)) found.set(gate, { file, confirmation: line });
    }
  }
  return found;
}

test('every gate whose confirmation names a count is classified: counted, or not counted with its reason', () => {
  const found = countGates();
  const classified = [...Object.keys(COUNTED_GATES), ...Object.keys(NOT_COUNTED)].sort();
  assert.deepEqual([...found.keys()].sort(), classified);
  assert.equal(Object.keys(COUNTED_GATES).length, 4);
  for (const [gate, token] of Object.entries(COUNTED_GATES)) {
    assert.ok(found.get(gate).confirmation.includes(token), `${gate}: its confirmation names ${token}`);
  }
});

test('each counted gate\'s runbook opens its change with --expected and the count, and says what status reports', () => {
  const found = countGates();
  for (const [gate, token] of Object.entries(COUNTED_GATES)) {
    const text = fs.readFileSync(path.join(DIR, found.get(gate).file), 'utf8');
    const line = text.split('\n').find((l) => l.includes(`[${gate}]`) && l.includes('--expected'));
    assert.ok(line, `${found.get(gate).file}: a line names [${gate}] and --expected`);
    assert.ok(line.includes(`\`--expected ${token}\``), `${gate}: --expected ${token}`);
    assert.match(line, /verified k of N/, `${gate}: says what status reports`);
    // code review round 1 of the batch G3 close-out 2, finding 10: the change is opened and
    // approved before the gate, so the instruction comes before the gate's marker
    const lines = text.split('\n');
    assert.ok(lines.indexOf(line) < lines.findIndex((l) => l.includes(`SAFETY GATE [${gate}]`)), `${gate}: --expected comes before the gate`);
  }
  const page = fs.readFileSync(path.join(DIR, 'fleet-device-actions.md'), 'utf8');
  assert.doesNotMatch(page, /reads done once one linked read-back verified/, 'the one-host rule is gone from the batch run');
});

test('the audit README describes counted changes', () => {
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  assert.match(readme, /--expected N/);
  assert.match(readme, /verified k of N/);
  assert.match(readme, /partial/);
  assert.match(readme, /a repeated read of the same object is not detected/);
  for (const gate of Object.keys(COUNTED_GATES)) assert.ok(readme.includes(gate), `README names ${gate}`);
});
