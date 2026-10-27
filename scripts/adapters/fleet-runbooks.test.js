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

const fleet = require('./fleet-client.js');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (name) => fs.readFileSync(path.join(ROOT, '.claude', 'commands', `${name}.md`), 'utf8');

const DEVICE = read('fleet-device-actions');
const HEALTH = read('fleet-host-health');
const POLICY = read('fleet-policy-failures');
const OSQUERY = read('fleet-osquery-investigation');
const VULN = read('fleet-vulnerable-software');

// The one precondition every gate that runs a script on one host carries (R2 and R3
// need the captured pre-state; R3 also needs the written rollback path and the
// independent review: CLAUDE.md contract rule 1 and the R3 row). It has no semicolon
// or parentheses, which a shell gate's comment may not carry, and backticks are dropped
// before comparing, because that comment line carries the same words without them.
const SCRIPT_PRESTATE = 'the pre-state of what the script changes is saved to tasks/checkpoints/ when the script is R2 or R3, and when it is R3 the rollback path, naming the compensating script and who reviews it, is written and the independent review approved it';
const plain = (text) => text.replace(/`/g, '');

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

test('a queued script\'s cancel can be filled and proven: host-upcoming names its execution ID, and the read-back compares every page with the before list', () => {
  const phaseG = section(DEVICE, 'Phase G');
  const steps = phaseG.split('\n');
  const step2 = steps.find((l) => l.startsWith('2. A queued script')) || '';
  assert.match(step2, /`node scripts\/adapters\/fleet-client\.js host-upcoming --id \[HOST_ID\] --execute` reads the host's upcoming activities/, 'step 2 names the read that yields a queued script\'s ID');
  assert.match(step2, /`details\.script_execution_id`, which is `\[PENDING_ACTION_ID\]`/);
  assert.match(step2, /while `meta\.has_next_results` is true, read the next/, 'every page is read');
  assert.match(step2, /\(unverified\)/, 'the field names the sources do not list for this read are marked unverified');
  assert.doesNotMatch(phaseG, /the adapter does not read upcoming activities/);
  const step3 = steps.find((l) => l.startsWith('3. ')) || '';
  assert.match(step3, /Write the before list in the ticket: every item steps 1 and 2 returned, every page/);
  const handOff = steps.find((l) => l.startsWith('4. ')) || '';
  assert.match(handOff, /Two items you cannot tell apart, or an ID you cannot read: stop and cancel nothing/);
  assert.match(handOff, /runs the same two reads \(`commands` and `host-upcoming`\) again/, 'the hand-off names the reads the next owner runs');

  const cancel = gate(DEVICE, 'fleet-device-actions-cancel-portal');
  assert.match(cancel.portal, /the before list from steps 1 to 3 is in the ticket/);
  const readBack = phaseG.split('\n').find((l) => l.startsWith('**Read-back:**')) || '';
  assert.match(readBack, /Run the step 1 and step 2 reads again, every page, and compare them with the before list/);
  assert.match(readBack, /`node scripts\/adapters\/fleet-client\.js host-upcoming --id \[HOST_ID\] --execute` no longer lists `\[PENDING_ACTION_ID\]` and still lists every other queued item from the before list/, 'a script\'s cancel: gone, and the others still queued');
  assert.match(readBack, /still lists the other pending commands from the before list/, 'an MDM command\'s cancel: the others still pending');
  assert.match(readBack, /any other missing item means more than the one item was cancelled/);

  // The Phase A scale block (section() stops at the block's first "# " comment line).
  assert.match(DEVICE, /^node scripts\/adapters\/fleet-client\.js host-upcoming --id \[HOST_ID\] --execute +# items still queued for this host/m, 'the Phase A pre-state read includes the queued items');
  const checklist = section(DEVICE, '✅ Verification checklist');
  assert.match(checklist, /the `host-upcoming` and `commands` reads, every page, compared with the before list/);
});

test('every adapter command a Fleet runbook tells the operator to run exists in fleet-client.js, with flags it accepts', () => {
  const commands = { ...fleet.READS, ...fleet.VERIFIES };
  let count = 0;
  for (const [name, text] of [['fleet-device-actions', DEVICE], ['fleet-host-health', HEALTH], ['fleet-policy-failures', POLICY], ['fleet-osquery-investigation', OSQUERY], ['fleet-vulnerable-software', VULN]]) {
    for (const m of text.matchAll(/node scripts\/adapters\/fleet-client\.js ([a-z][a-z-]*)([^`\n#]*)/g)) {
      count += 1;
      const [, cmd, rest] = m;
      if (cmd === 'help') continue;
      assert.ok(Object.prototype.hasOwnProperty.call(commands, cmd), `${name}: fleet-client.js has no command ${cmd}`);
      const accepted = new Set(['execute', ...(commands[cmd].values || []), ...(commands[cmd].booleans || [])]);
      for (const f of rest.matchAll(/(?:^|\s)--([a-z][a-z-]*)/g)) assert.ok(accepted.has(f[1]), `${name}: ${cmd} does not take --${f[1]}`);
    }
  }
  assert.ok(count >= 30, `expected the runbooks to name the adapter often, found ${count}`);
  assert.match(DEVICE, /fleet-client\.js host-upcoming --id \[HOST_ID\]/, 'the cancel gate\'s read is one the adapter has');
});

test('a remediation script on one host takes its R-class from what it changes, as in /fleet-device-actions E1: a security setting is R3 with the review', () => {
  const phase2 = section(POLICY, 'Phase 2');
  assert.match(phase2, /^### Phase 2: Fix one host \(R2, or R3 for a security setting; gated\)$/m);
  assert.match(phase2, /A script that changes a security setting \(the firewall, disk encryption, screen lock and the like\) or deletes data is R3/);
  assert.match(phase2, /save the setting's current value to `tasks\/checkpoints\/` and the ticket, write the rollback path/, 'R3 needs pre-state and rollback path');
  assert.match(phase2, /get the independent out-of-session review/, 'R3 needs the independent review');
  const run = gate(POLICY, 'fleet-policy-failures-run-script-portal');
  assert.match(run.field('Reversibility'), /^R2, or R3 by the rule above:/);
  assert.match(run.portal, /the script body was read and its R-class set, the pre-state is in the ticket, /);
  assert.ok(plain(run.portal).includes(SCRIPT_PRESTATE), 'the portal precondition holds the checkpoint for R2 and R3, and the rollback path and review for R3');
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

test('nits: the batch phrase binds the host count, the osquery storage read cancels its edit forms, the lane spec names only verify-wipe on GET /commands', () => {
  const batch = gate(DEVICE, 'fleet-device-actions-batch-script-portal');
  assert.equal(batch.phrase, 'RUN SCRIPT [SCRIPT_NAME] ON [HOST_COUNT] CHECKED HOSTS IN FLEET [FLEET_NAME]');
  assert.match(batch.field('Target'), /\[HOST_COUNT\] hosts checked in \[FLEET_NAME\]/);
  assert.match(batch.field('Scope'), /must equal \[HOST_COUNT\], the number written in the ticket/);
  assert.match(DEVICE.split('\n').find((l) => l.startsWith('**Placeholders:**')), /`\[HOST_COUNT\]` \(the number of hosts written in the ticket before a batch\)/);

  const storage = OSQUERY.split('\n').find((l) => /\*\*Is storage on \(R0/.test(l)) || '';
  assert.match(storage, /read inside edit forms/);
  assert.match(storage, /close each form with Cancel \(or its close control\) instead of just leaving the page, so no edit is saved/);
  assert.doesNotMatch(storage, /Leave the edit view without saving\.$/);

  const spec = fs.readFileSync(path.join(ROOT, 'docs', 'aegis', 'lanes', 'g2.md'), 'utf8');
  const commandsRow = spec.split('\n').find((l) => l.startsWith('| MDM commands | GET `/api/v1/fleet/commands`')) || '';
  assert.match(commandsRow, /`verify-wipe`: the wipe command's status/);
  assert.doesNotMatch(commandsRow, /`verify-lock`, `verify-wipe`/, 'verify-lock reads GET /hosts/:id only');
});

// The comment line that sits right above the canonical `if` of one shell gate.
function shellPrecondition(text, id) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === `# SAFETY GATE [${id}]`);
  assert.ok(start >= 0, `shell gate ${id} not found`);
  const ifLine = lines.findIndex((line, i) => i > start && line.startsWith('if IFS= read -r confirmation'));
  assert.ok(ifLine > start, `shell gate ${id}: no comparison`);
  return lines.slice(start, ifLine).filter((line) => line.startsWith('# precondition')).join('\n');
}

test('the fleetctl gates carry the prerequisites their portal counterparts carry, and every script gate asks for the pre-state', () => {
  const lock = shellPrecondition(DEVICE, 'fleet-device-actions-lock-cli');
  assert.match(lock, /the Phase A pre-state is saved to tasks\/checkpoints\//);
  assert.match(lock, /runs Fleet Premium/);
  assert.match(lock, /you hold Maintainer or Admin/);

  const script = shellPrecondition(DEVICE, 'fleet-device-actions-run-script-cli');
  assert.match(script, /every line of \[FILE_NAME\] has been read/);
  assert.match(script, /its R-class from R1 to R3 is written in the ticket/);
  assert.match(script, /the current value of what it changes is in the ticket as the pre-state/);
  assert.ok(plain(script).includes(SCRIPT_PRESTATE), 'the fleetctl script gate asks for the same checkpoint, rollback path and review as E1');

  const e1 = gate(DEVICE, 'fleet-device-actions-run-script-portal');
  assert.match(e1.portal, /the current value of what the script changes is in the ticket, /);
  assert.ok(plain(e1.portal).includes(SCRIPT_PRESTATE), 'E1 asks for the checkpoint for R2 and R3, and the rollback path and review for R3');
  const e2 = gate(DEVICE, 'fleet-device-actions-batch-script-portal');
  assert.match(e2.portal, /the pre-state of what the script changes is saved to `tasks\/checkpoints\/` and the rollback path is written/);
});

test('one script on one host asks for the same R2 and R3 ceremony in all three gates: checkpoint for R2 and R3, rollback path and review for R3', () => {
  const places = [
    ['fleet-device-actions E1 portal', gate(DEVICE, 'fleet-device-actions-run-script-portal').portal],
    ['fleet-device-actions fleetctl run-script', shellPrecondition(DEVICE, 'fleet-device-actions-run-script-cli')],
    ['fleet-policy-failures Phase 2 portal', gate(POLICY, 'fleet-policy-failures-run-script-portal').portal],
  ];
  for (const [where, text] of places) assert.ok(plain(text).includes(SCRIPT_PRESTATE), `${where}: the shared precondition sentence is missing`);
  // The R2 path keeps its pre-state in tasks/checkpoints/, not in the ticket only.
  const policyRun = gate(POLICY, 'fleet-policy-failures-run-script-portal');
  assert.match(policyRun.field('Reversibility'), /save the setting's current value \(the pre-state\) to `tasks\/checkpoints\/` and the ticket before you start/);
  assert.doesNotMatch(policyRun.field('Reversibility'), /copy the setting's current value \(the pre-state\) into the ticket before you start/);
  assert.match(section(POLICY, 'Phase 2'), /Any other fix on one host is R2, and its pre-state \(the setting's current value\) is saved to `tasks\/checkpoints\/` and the ticket before the gate as well/);
  // The R3 list at the top covers a one-host script that is R3, not only a batch.
  const r3 = DEVICE.split('\n').find((l) => l.startsWith('- Wipe, Turn off MDM')) || '';
  assert.match(r3, /a script on one host that deletes data or changes a security setting \(Phase E step 1\) are R3: save the pre-state to `tasks\/checkpoints\/`, write the rollback path, and get an independent out-of-session review before the gate runs/);
});

test('the exposure check compares against the ticket\'s own count, not the F04 corpus number', () => {
  const phase1 = section(VULN, 'Phase 1');
  assert.match(phase1, /^3\. Compare the count with the count in the ticket \(`\[N\]`\)\./m);
  assert.doesNotMatch(VULN, /ticket's 30\b/);
  // 30 hosts appears only inside the quoted example ticket.
  for (const line of VULN.split('\n').filter((l) => /\b30 hosts\b/.test(l))) assert.match(line, /"[^"]*\b30 hosts\b[^"]*"/, `unquoted ticket number: ${line.slice(0, 80)}`);
  const placeholders = VULN.split('\n').find((l) => l.startsWith('**Placeholders:**'));
  assert.match(placeholders, /`\[N\]` \(the exposed host count the ticket states\)/);
});

test('the vulnerable-title read that yields [SOFTWARE_TITLE_ID] pages, so a long list can be read to the end', () => {
  assert.match(VULN, /^node scripts\/adapters\/fleet-client\.js software --vulnerable --fleet-id \[FLEET_ID\] --page 0 --per-page 100 --execute$/m);
  assert.doesNotMatch(VULN, /software --vulnerable --fleet-id \[FLEET_ID\] --execute/);
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
