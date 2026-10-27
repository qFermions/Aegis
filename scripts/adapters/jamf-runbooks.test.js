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

// Every line that saves something in the console (a breadcrumb ending in Save, or "then
// Save"), outside code fences, with the portal gate or preview that owns it: the
// nearest SAFETY GATE or PREVIEW ONLY marker above it in the same section.
function saveSteps(text) {
  const steps = [];
  let fenced = false;
  let owner = null;
  text.split('\n').forEach((line, index) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return; }
    if (fenced) return;
    if (/^#{1,6} /.test(line)) { owner = null; return; }
    const gated = line.match(/<!-- SAFETY GATE \[([a-z0-9-]+)\] -->/);
    if (gated) { owner = { id: gated[1], mode: 'gated' }; return; }
    const preview = line.match(/^>\s*\*\*PREVIEW ONLY \[([a-z0-9-]+)\]/);
    if (preview) { owner = { id: preview[1], mode: 'preview' }; return; }
    if (/→\s*\**Save\b|\bthen Save\b/.test(line)) steps.push({ line: index + 1, text: line.trim(), owner });
  });
  return steps;
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

test('a stage that can reach more than 10 Macs carries R3 ceremony: the App Installers rollout, and a large group leaving a profile\'s Targets', () => {
  // App Installers: a pilot gate bounded at 10 Macs, then an R3 rollout gate after review
  const pilot = gate(PATCH, 'jamf-patch-management-app-installer-portal');
  assert.match(pilot.field('Reversibility'), /^R2\b/);
  assert.match(pilot.field('Scope'), /10 or fewer/);
  assert.doesNotMatch(pilot.field('Scope'), /\bR3\b|above that/, 'the R2 gate no longer admits more than 10 Macs');
  assert.match(pilot.portal, /`\[MEMBER_COUNT\]` is 10 or fewer/);
  assert.match(section(PATCH, 'Phase F'), /\*\*Stop if\*\* `\[MEMBER_COUNT\]` is more than 10: a pilot above 10 Macs is the rollout stage/);
  const rollout = gate(PATCH, 'jamf-patch-management-app-installer-rollout-portal');
  assert.match(rollout.field('Reversibility'), /^R3\b/);
  assert.match(rollout.field('Scope'), /more than 10 Macs or all computers/);
  assert.match(rollout.portal, /Only after the pilot read-back, the pre-state, the independent review, `verify-group-count` on the rollout group and the exact match/);
  assert.notEqual(pilot.phrase, rollout.phrase, 'one phrase never carries into the next stage');
  assert.match(PATCH, /^## Phase F: .*\(R2 pilot, R3 rollout after independent review\)$/m);
  assert.match(PATCH, /Phase F, the pilot deployment \(R2 gate\)\..*then the rollout \(R3 gate, after review\)/, 'the fast path names both stages');
  assert.doesNotMatch(PATCH, /Phase F \(R2 gate\)/);

  // Profiles: a group leaves Targets through a gate whose Scope matches its size
  const phaseG = section(PROFILES, 'Phase G');
  const order = [...phaseG.matchAll(/<!-- SAFETY GATE \[([a-z0-9-]+)\] -->/g)].map((m) => m[1]);
  assert.deepEqual(order, ['jamf-config-profiles-remove-pilot-portal', 'jamf-config-profiles-remove-all-computers-portal', 'jamf-config-profiles-remove-group-portal'], 'first, second and third gate as the other runbooks name them');
  const small = gate(PROFILES, 'jamf-config-profiles-remove-pilot-portal');
  assert.match(small.field('Reversibility'), /^R2\b/);
  assert.match(small.field('Scope'), /10 or fewer/);
  assert.match(small.portal, /`verify-group-count` reads `\[MEMBER_COUNT\]` of 10 or fewer/);
  const large = gate(PROFILES, 'jamf-config-profiles-remove-group-portal');
  assert.match(large.field('Reversibility'), /^R3\b/);
  assert.match(large.field('Scope'), /more than 10 Macs/);
  assert.match(large.portal, /the profile's current scope is in the ticket with this gate named as its way back, the independent out-of-session review/);
  assert.match(large.phrase, /OF \[MEMBER_COUNT\] MACS FROM PROFILE \[PROFILE_NAME\] SCOPE AFTER REVIEW$/);
  assert.match(phaseG, /\*\*Stop if\*\* `\[MEMBER_COUNT\]` is more than 10/);
  assert.match(phaseG, /PREVIEW ONLY \[jamf-config-profiles-limitation-exclusion-preview\]/, 'taking a group out of Limitations or Exclusions widens the scope and is not authorized');

  // Inventory groups: the count picks the gate; Limitations and Exclusions are preview only
  const retire = section(GROUPS, 'Phase E');
  assert.match(retire, /group of 10 Macs or fewer: `\/jamf-config-profiles` Phase G's first gate \(R2\)/);
  assert.match(retire, /group of more than 10 Macs: the R3 path, the independent review first, then `\/jamf-config-profiles` Phase G's third gate, whose Scope is a group of more than 10 Macs/);
  assert.match(retire, /PREVIEW ONLY \[jamf-inventory-groups-limitation-exclusion-preview\]/);
  assert.doesNotMatch(retire, /a target is taken out with `\/jamf-config-profiles` Phase G for a profile/);
  assert.match(section(POLICIES, 'Phase D'), /takes a target group of more than 10 Macs out of scope to retire that group/);
});

test('every console Save in the five runbooks sits inside an action-local SAFETY GATE: no ungated scope change, saved search or group', () => {
  for (const [name, text] of Object.entries(ALL)) {
    const steps = saveSteps(text);
    assert.ok(steps.length > 0, `${name}: has Save steps`);
    for (const s of steps) {
      assert.ok(s.owner && s.owner.mode === 'gated', `${name}:${s.line}: a Save outside a SAFETY GATE (${s.text.slice(0, 90)})`);
    }
  }

  // FileVault: one Mac joins the FileVault profile only through its own R3 gate
  const oneMac = gate(FILEVAULT, 'jamf-filevault-one-mac-scope-portal');
  assert.match(oneMac.field('Target'), /^\[SERIAL_NUMBER\] in the Targets of FileVault profile \[PROFILE_NAME\]$/);
  assert.match(oneMac.field('Reversibility'), /^R3\b.*`\/jamf-config-profiles` Phase E's exclusion gate/);
  assert.equal(oneMac.phrase, 'ADD [SERIAL_NUMBER] TO FILEVAULT PROFILE [PROFILE_NAME] SCOPE AND DISTRIBUTE TO NEWLY ASSIGNED ONLY');
  assert.match(oneMac.portal, /Only after the pre-state and the written rollback are in the ticket/);
  assert.match(section(FILEVAULT, 'Phase D'), /put the Mac in the Phase B profile's scope first with Phase B's one-Mac gate \(R3\)/);

  // Inventory groups: the saved search is created under its own gate, and Phase C reuses that gate
  const search = gate(GROUPS, 'jamf-inventory-groups-saved-search-portal');
  assert.equal(search.phrase, 'CREATE SAVED SEARCH [ISSUE_ID]');
  assert.match(search.field('Reversibility'), /^R1\b/);
  assert.match(search.region, /Search Inventory → \*\*New\*\*/);
  assert.match(section(GROUPS, 'Phase C'), /under Phase B's search gate with this change's `\[ISSUE_ID\]`/);

  // Config profiles: the one-Mac static group fallback is planning only, and the exclusion names the Mac
  const exclude = gate(PROFILES, 'jamf-config-profiles-exclude-portal');
  assert.doesNotMatch(exclude.region, /static group/, 'the exclusion gate authorizes the Mac only');
  assert.match(exclude.region, /The Mac itself, never a group: if the picker does not list it, stop/);
  assert.match(section(PROFILES, 'Phase E'), /PREVIEW ONLY \[jamf-config-profiles-one-mac-group-preview\]:\*\* Planning only: a static group that holds only `\[SERIAL_NUMBER\]`/);
});

test('no Mac gets a second FileVault profile: Phase A reads each Mac\'s profiles, and every FileVault scope gate waits for that read', () => {
  const stops = FILEVAULT.split('\n').find((l) => l.startsWith('**Stop conditions:**')) || '';
  assert.match(stops, /already lists a FileVault or escrow profile \(Phase A step 5\): change that profile's scope with `\/jamf-config-profiles` instead/);
  const phaseA = section(FILEVAULT, 'Phase A');
  assert.match(phaseA, /^5\. Before Phase B, on each Mac it will reach: .*\*\*Stop if\*\* one is listed/m);
  assert.match(phaseA, /jamf-client\.js computer --serial \[SERIAL_NUMBER\] --section CONFIGURATION_PROFILES --execute/);
  const phaseB = section(FILEVAULT, 'Phase B');
  assert.match(phaseB, /\*\*Stop if\*\* any pilot Mac already lists a FileVault or escrow profile/);
  assert.match(gate(FILEVAULT, 'jamf-filevault-pilot-profile-portal').portal, /no pilot Mac lists another FileVault or escrow profile/);
  assert.match(gate(FILEVAULT, 'jamf-filevault-one-mac-scope-portal').portal, /the Mac lists no other FileVault or escrow profile \(Phase A step 5\)/);
  assert.match(phaseB, /Phase A step 5 finds no other FileVault or escrow profile on the rollout Macs/);
});
