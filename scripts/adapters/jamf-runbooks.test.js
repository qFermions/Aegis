'use strict';
// jamf-runbooks.test.js: what the five Jamf Pro runbooks (lane G2) must say, beyond the
// generic gate grammar that scripts/command-safety-gates.test.js already checks.
//
// Contract: PRODUCT_CONTRACT.md (AEGIS ADVISES; HUMANS EXECUTE PRODUCTION CHANGES), the
// R0 to R3 ladder in CLAUDE.md (Risk-Classified Execution Policy), SR-2 in
// modules/security/security-doctrine.md, and the Jamf Pro section of
// docs/aegis/lanes/g2.md. Each test pins one reviewed decision so a later edit cannot
// quietly undo it. The files are read as text; nothing here runs a command.

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (name) => fs.readFileSync(path.join(ROOT, '.claude', 'commands', `${name}.md`), 'utf8');

const PROFILES = read('jamf-config-profiles');
const POLICIES = read('jamf-policies-self-service');
const GROUPS = read('jamf-inventory-groups');
const PATCH = read('jamf-patch-management');
const FILEVAULT = read('jamf-filevault');
const ALL = { 'jamf-config-profiles': PROFILES, 'jamf-policies-self-service': POLICIES, 'jamf-inventory-groups': GROUPS, 'jamf-patch-management': PATCH, 'jamf-filevault': FILEVAULT };

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
  return { region, field, portal, phrase, start: start + 1 };
}

// The text of one "## " or "### " section, by the start of its heading. A "# " line
// inside a code fence is a shell comment, not a heading.
function section(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => /^#{2,3} /.test(line) && line.replace(/^#{2,3} /, '').startsWith(heading));
  assert.ok(start >= 0, `section ${heading} not found`);
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.length;
  let fenced = false;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\s*```/.test(lines[i])) { fenced = !fenced; continue; }
    const m = !fenced && lines[i].match(/^(#{1,6}) /);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

test('reads that can carry secrets are never pasted whole into a ticket: the runbooks name the fields to copy', () => {
  for (const [name, text] of Object.entries(ALL)) {
    assert.doesNotMatch(text, /paste it into the ticket/i, `${name}: no read is pasted whole into a ticket`);
  }
  const profileRead = PROFILES.split('\n').findIndex((l) => /jamf-client\.js profile --id \[PROFILE_ID\] --execute/.test(l));
  assert.match(PROFILES.split('\n').slice(profileRead - 2, profileRead).join('\n'), /copy into the ticket as the pre-state: the level, the distribution method, Targets, Limitations, Exclusions and the payload names - never the whole output/);
  assert.match(PROFILES, /withholds every payload setting and prints only each payload's type, identifier and display name under payloadSummary/);
  assert.match(section(PROFILES, 'Phase F'), /the adapter withholds payload settings, so the new values are compared on screen/);
  assert.match(section(PROFILES, 'Phase F'), /A password, certificate or challenge is never copied/);
  assert.match(POLICIES, /copy into the ticket as the pre-state: Enabled, the triggers ticked, the execution frequency, Targets, Limitations, Exclusions and the Self Service setting - never the whole output/);
  assert.match(POLICIES, /the adapter withholds script parameters and the run command/);
  assert.match(section(GROUPS, 'Phase A'), /copy into the ticket only the fields the question needs .* - never the whole output/);
  assert.match(section(GROUPS, 'Phase B'), /an attribute whose name contains pass, secret, token, key or pin is printed without its value: read it on screen and never copy it into the ticket/);
});

test('every profile read-back names the profile by its identifier, so an install or an entry for another profile is never proof', () => {
  for (const [name, text] of [['jamf-config-profiles', PROFILES], ['jamf-filevault', FILEVAULT]]) {
    const calls = text.split('\n').filter((l) => /jamf-client\.js verify-(?:profile|command) /.test(l));
    assert.ok(calls.length > 0, `${name}: has profile read-backs`);
    for (const line of calls) assert.match(line, /--profile-identifier \[PROFILE_IDENTIFIER\]/, `${name}: ${line.trim()}`);
    const placeholders = text.split('\n').find((l) => l.startsWith('**Placeholders:**')) || '';
    assert.match(placeholders, /`\[PROFILE_IDENTIFIER\]` \(that profile's own PayloadIdentifier: `payloadSummary\[0\]\.profile\.PayloadIdentifier` in the `profile --id` read/, `${name}: says where the identifier is read`);
  }
  for (const phase of ['Phase C', 'Phase D', 'Phase E', 'Phase F']) {
    const text = section(PROFILES, phase);
    assert.match(text, /--profile-identifier \[PROFILE_IDENTIFIER\]/, `${phase} reads the profile back by its identifier`);
  }
  // Phase F: verify-profile passed before the redistribution too, so the proof of the
  // reinstall is a fresh acknowledged install for this profile after the distribution time.
  assert.match(section(PROFILES, 'Phase F'), /verify-command --management-id \[DEVICE_ID\] --type INSTALL_PROFILE --profile-identifier \[PROFILE_IDENTIFIER\] --not-before \[NOT_BEFORE\] --execute/);
  assert.match(section(PROFILES, 'Phase A'), /Write the profile's identifier in the ticket as `\[PROFILE_IDENTIFIER\]`/);
  assert.match(section(FILEVAULT, 'Phase B'), /jamf-client\.js profile --id \[PROFILE_ID\] --execute/, 'the FileVault runbook reads the new profile\'s identifier');
});

test('every policy read-back proves a property, never mere existence: no trigger ticked after the Self Service create, disabled after the disable', () => {
  for (const [name, text] of Object.entries(ALL)) {
    for (const line of text.split('\n').filter((l) => /jamf-client\.js verify-policy /.test(l))) {
      assert.match(line, /--(?:trigger|frequency|enabled|no-triggers)\b/, `${name}: ${line.trim()} names what it proves`);
    }
  }
  const create = section(POLICIES, 'Phase C');
  assert.match(create, /verify-policy --id \[POLICY_ID\] --frequency "Once per computer" --enabled true --no-triggers --execute/, 'a ticked trigger would turn the Self Service item into an automatic install');
  const change = section(POLICIES, 'Phase D');
  assert.match(change, /verify-policy --id \[POLICY_ID\] --enabled false --execute/, 'the disable read-back proves the policy reads disabled');
  assert.match(change, /verify-policy --id \[POLICY_ID\] --trigger checkin --frequency "Once every day" --enabled true --execute/);
  assert.match(section(FILEVAULT, 'Phase D'), /verify-policy --id \[POLICY_ID\] --trigger checkin --frequency "Once per computer" --enabled true --execute/, 'the new-key policy read-back proves its trigger and frequency');
});
