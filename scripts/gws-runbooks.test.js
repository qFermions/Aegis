'use strict';
// gws-runbooks.test.js: lane G2 checks on the five Google Workspace runbooks
// (.claude/commands/gws-account-containment.md, gws-2sv-enforcement.md, gws-admin-roles.md,
// gws-drive-sharing.md, gws-security-posture.md) that the shared gate grammar in
// scripts/command-safety-gates.test.js does not make: how each gate classes its risk,
// which phrase belongs to which effect, and whether each read-back can actually fail.
//
// Contract: PRODUCT_CONTRACT.md (AEGIS ADVISES; HUMANS EXECUTE PRODUCTION CHANGES), the
// R0-R3 table in CLAUDE.md, docs/security/COMMAND_RISK_METADATA.md ("use a distinct
// confirmation for each target and effect") and the Google Workspace section of
// docs/aegis/lanes/g2.md. Nothing here reads the network: every adapter line is run as
// the adapter's own dry run.

require('./adapters/socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const gws = require('./adapters/gws-client.js');

const ROOT = path.resolve(__dirname, '..');
const RUNBOOKS = Object.freeze([
  'gws-account-containment', 'gws-2sv-enforcement', 'gws-admin-roles', 'gws-drive-sharing', 'gws-security-posture',
]);
const fileOf = (name) => path.join(ROOT, '.claude', 'commands', `${name}.md`);
const textOf = (name) => fs.readFileSync(fileOf(name), 'utf8');
const linesOf = (name) => textOf(name).split('\n');

// ── Gates ────────────────────────────────────────────────────────────────────
// A portal gate: `<!-- SAFETY GATE [id] -->`, its six `- **Field:**` lines and its
// `**PORTAL ACTION [id]:**` block, which runs to the next heading or gate marker. A shell
// gate: `# SAFETY GATE [id]` in a fence, its `# Field:` comment lines and the rest of the
// fence.
const FIELD_NAMES = ['Target', 'Effect', 'Scope', 'Reversibility', 'Required confirmation', 'Failure behavior'];

function gatesOf(name) {
  const lines = linesOf(name);
  const gates = [];
  for (let i = 0; i < lines.length; i += 1) {
    const portal = lines[i].match(/^<!-- SAFETY GATE \[([a-z0-9-]+)\] -->$/);
    const shell = lines[i].match(/^# SAFETY GATE \[([a-z0-9-]+)\]$/);
    if (!portal && !shell) continue;
    const gate = { file: name, id: (portal || shell)[1], kind: portal ? 'portal' : 'shell', line: i + 1, fields: {} };
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      const field = portal
        ? lines[j].match(/^- \*\*([A-Za-z ]+):\*\*\s*(.*)$/)
        : lines[j].match(/^# ([A-Za-z ]+):\s*(.*)$/);
      if (!field || !FIELD_NAMES.includes(field[1])) break;
      gate.fields[field[1]] = field[2];
    }
    const block = [];
    for (; j < lines.length; j += 1) {
      if (portal && (/^#{1,6}\s/.test(lines[j]) || /^<!-- SAFETY GATE/.test(lines[j]))) break;
      if (shell && /^```\s*$/.test(lines[j])) break;
      block.push(lines[j]);
    }
    gate.block = block.join('\n');
    const confirmation = gate.fields['Required confirmation'] || '';
    gate.phrase = (portal ? confirmation.match(/type exactly `([^`]+)`/i) : confirmation.match(/type exactly "([^"]+)"/i))?.[1];
    gate.rClass = (gate.fields.Reversibility || '').match(/^(R[0-3])\b/)?.[1];
    gates.push(gate);
  }
  return gates;
}

const allGates = () => RUNBOOKS.flatMap(gatesOf);
const gateById = (id) => {
  const found = allGates().filter((g) => g.id === id);
  assert.equal(found.length, 1, `gate ${id}: expected exactly one, found ${found.length}`);
  return found[0];
};

test('the parser reads every gate in the five runbooks with all six fields, a phrase and an R-class', () => {
  const gates = allGates();
  assert.ok(gates.length >= 20, `only ${gates.length} gates parsed`);
  for (const g of gates) {
    for (const field of FIELD_NAMES) assert.ok(g.fields[field], `${g.file}:${g.line} ${g.id}: no ${field}`);
    assert.ok(g.phrase, `${g.file}:${g.line} ${g.id}: no exact phrase`);
    assert.ok(g.rClass, `${g.file}:${g.line} ${g.id}: Reversibility does not start with R0 to R3`);
  }
});

// ── Adapter lines ────────────────────────────────────────────────────────────
// Every `node scripts/adapters/gws-client.js` line in a bash fence, with its
// placeholders filled by sample values, must be accepted by the adapter's dry run
// (exit 0): a read-back the runbook names has to exist, with the flags it is given.
const SAMPLES = [
  ['[USER@DOMAIN.COM]', 'user@example.com'],
  ['[UPN]', 'admin@example.com'],
  ['[GROUP_EMAIL]', 'exceptions@example.com'],
  ['[EXTERNAL_DOMAIN]', 'partner.example'],
  ['[NOT_BEFORE]', '2026-10-27T11:50:00.000Z'],
  ['[ROLE_ID]', '91000000000001'],
  ['[OU_PATH]', 'Staff'],
  ['[FILE_NAME]', 'Budget sheet'],
  ['[APP_ID]', '1234567890-sample.apps.googleusercontent.com'],
  ['YYYY-MM-DD', '2026-10-25'],
];

function adapterLines(name) {
  const lines = linesOf(name);
  const found = [];
  let fence = null;
  lines.forEach((line, index) => {
    const open = line.match(/^```(\w*)\s*$/);
    if (open && fence === null) { fence = open[1] || 'untagged'; return; }
    if (/^```\s*$/.test(line) && fence !== null) { fence = null; return; }
    if (fence === 'bash' && /^node scripts\/adapters\/gws-client\.js\s/.test(line)) found.push({ file: name, line: index + 1, text: line });
  });
  return found;
}

function argvOf(text) {
  let filled = text;
  for (const [token, value] of SAMPLES) filled = filled.split(token).join(value);
  const words = [...filled.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => (m[1] !== undefined ? m[1] : m[2]));
  assert.equal(words[0], 'node');
  assert.equal(words[1], 'scripts/adapters/gws-client.js');
  return words.slice(2).filter((w) => w !== '--execute');
}

async function dryRun(argv) {
  const out = [];
  const err = [];
  const code = await gws.run(argv, {}, { out: (s) => out.push(String(s)), err: (s) => err.push(String(s)) });
  return { code, stdout: out.join(''), stderr: err.join('') };
}

test('every gws-client.js line in the five runbooks is a command and flag set the adapter accepts (dry run, exit 0)', async () => {
  const lines = RUNBOOKS.flatMap(adapterLines);
  assert.ok(lines.length >= 40, `only ${lines.length} adapter lines found`);
  for (const l of lines) {
    const res = await dryRun(argvOf(l.text));
    assert.equal(res.code, 0, `${l.file}:${l.line}: ${l.text}\n${res.stderr}`);
  }
});

// ── Finding: exit 2 is never a pass ─────────────────────────────────────────
// verify-* exits 2 both when the read proves the opposite state and when the read fails
// (403, 404, timeout, invalid response) or returns another user, so no runbook may treat
// exit 2 as the expected result. "Not enforced" has its own read-back.
test('no runbook treats exit 2 from a verify-* read as an expected result', () => {
  for (const name of RUNBOOKS) {
    const lines = linesOf(name);
    lines.forEach((line, index) => {
      if (!/\bexits?\s+2\b/i.test(line)) return;
      // a line about a verify-* read: it names one, or it is the comment above one
      const aboutVerify = /verify-/.test(line) || /gws-client\.js verify-/.test(lines[index + 1] || '');
      if (!aboutVerify) return;
      assert.match(line, /never a pass/i, `${name}.md:${index + 1}: exit 2 is presented as a result: ${line.trim()}`);
    });
  }
  const twoSv = textOf('gws-2sv-enforcement');
  assert.match(twoSv, /verify-2sv-not-enforced --user \[USER@DOMAIN\.COM\]/, 'the 2SV runbook proves "not enforced" with its own read-back');
});

// ── Finding: exception-group membership is a 2-Step Verification exemption ─────
// Joining or leaving [GROUP_EMAIL] changes who must use a second step, which the 2SV
// runbook classes R3. Both changes have their own gate and phrase in that runbook, the
// phrase names the exemption, and the stop conditions sit next to the gate that runs the
// change: approver and end date before an add, isEnrolledIn2Sv true before a remove.
const onlyAfter = (gate) => gate.block.match(/\*\*PORTAL ACTION \[[^\]]+\]:\*\*\s*Only after([^\n]*)/)?.[1] || '';

test('exception-group membership is gated in /gws-2sv-enforcement as R3, with the stop conditions beside each gate', () => {
  const twoSv = textOf('gws-2sv-enforcement');
  assert.doesNotMatch(twoSv, /\/gws-group-membership/, 'exception-group members are never handed to the generic R1 add / R2 remove gates');

  const exempt = gateById('gws-2sv-enforcement-exempt-portal');
  assert.equal(exempt.phrase, 'ADD [USER@DOMAIN.COM] TO 2-STEP VERIFICATION EXCEPTION GROUP [GROUP_EMAIL]');
  assert.equal(exempt.rClass, 'R3');
  assert.match(exempt.fields.Effect, /exempts them from 2-Step Verification enforcement/);
  assert.match(onlyAfter(exempt), /approver/);
  assert.match(onlyAfter(exempt), /end date/);

  const end = gateById('gws-2sv-enforcement-end-exemption-portal');
  assert.equal(end.phrase, 'REMOVE [USER@DOMAIN.COM] FROM 2-STEP VERIFICATION EXCEPTION GROUP [GROUP_EMAIL]');
  assert.equal(end.rClass, 'R3');
  assert.match(end.fields.Effect, /ends their 2-Step Verification exemption/);
  assert.match(onlyAfter(end), /isEnrolledIn2Sv` true/);
  // the user read that decides the stop condition comes before the gate, in the same phase
  const lines = linesOf('gws-2sv-enforcement');
  const phaseStart = lines.findIndex((l) => /^### Phase C3\b/.test(l));
  assert.ok(phaseStart >= 0 && phaseStart < end.line, 'Phase C3 heading precedes the remove gate');
  const before = lines.slice(phaseStart, end.line - 1).join('\n');
  assert.match(before, /\*\*Stop conditions:\*\*[^\n]*isEnrolledIn2Sv` false/);
  assert.match(before, /gws-client\.js user --user \[USER@DOMAIN\.COM\] --execute/);

  // the two phrases differ from the generic group-membership phrases
  const phrases = gatesOf('gws-2sv-enforcement').map((g) => g.phrase);
  assert.ok(!phrases.includes('ADD [USER@DOMAIN.COM] TO GROUP [GROUP_EMAIL]'));
  assert.ok(!phrases.includes('REMOVE [USER@DOMAIN.COM] FROM GROUP [GROUP_EMAIL]'));
});

// ── Finding: allowing enrollment for a whole unit is R3 ─────────────────────
// CLAUDE.md's R0-R3 table puts MFA changes and changes to more than 10 objects in R3, and
// the effect of unticking Allow on users who already enrolled is not in the sources, so
// Phase B is R3 and its rollback gate runs only while nobody in the unit is enrolled.
test('every 2-Step Verification gate is R3, and the Phase B rollback is gated to a state with a known effect', () => {
  const gates = gatesOf('gws-2sv-enforcement');
  for (const g of gates) assert.equal(g.rClass, 'R3', `${g.id}: ${g.fields.Reversibility}`);
  const text = textOf('gws-2sv-enforcement');
  assert.doesNotMatch(text, /\bR2\b/, 'no 2-Step Verification change in this runbook is classed R2');
  assert.match(text, /^## Phase B: Allow enrollment \(R3\)$/m);

  const allow = gateById('gws-2sv-enforcement-allow-portal');
  assert.match(allow.fields.Reversibility, /`TURN OFF 2-STEP VERIFICATION ENROLLMENT FOR OU \[OU_PATH\]`/);
  assert.match(allow.fields.Reversibility, /only while no user in the unit reads `isEnrolledIn2Sv` true/);

  const rollback = gateById('gws-2sv-enforcement-allow-rollback-portal');
  assert.equal(rollback.phrase, 'TURN OFF 2-STEP VERIFICATION ENROLLMENT FOR OU [OU_PATH]');
  assert.equal(rollback.rClass, 'R3');
  assert.match(onlyAfter(rollback), /enrolled-users read for `\[OU_PATH\]` succeeded with nobody listed/);
  const lines = linesOf('gws-2sv-enforcement');
  const phaseStart = lines.findIndex((l) => /^### Phase B rollback\b/.test(l));
  assert.ok(phaseStart >= 0 && phaseStart < rollback.line);
  const before = lines.slice(phaseStart, rollback.line - 1).join('\n');
  assert.match(before, /\*\*Stop conditions:\*\* any user in `\[OU_PATH\]` reads `isEnrolledIn2Sv` true/);
  assert.match(before, /gws-client\.js users --query "orgUnitPath='\/\[OU_PATH\]' isEnrolledIn2Sv=true"/);
});

// ── Finding: every admin-role assignment is R3 ──────────────────────────────
// /gws-audit-log states that role grants are R3 regardless; the lane research gives R2 for
// a delegated role. Two runbooks may not give different classes for the same action, and
// the lane rule is the safer reading, so every gate that assigns a role is R3, with the
// written rollback in the ticket before the change.
test('every gate that assigns an admin role is R3, matching /gws-audit-log, and records the source conflict', () => {
  const audit = fs.readFileSync(fileOf('gws-audit-log'), 'utf8');
  assert.match(audit, /role grants are R3 regardless/, '/gws-audit-log still states the class this check enforces');
  const assigning = allGates().filter((g) => /^assign\b[^;]*\brole\b/i.test(g.fields.Effect || ''));
  assert.ok(assigning.length >= 1, 'the admin-roles runbook has an assignment gate');
  for (const g of assigning) {
    assert.equal(g.rClass, 'R3', `${g.file}:${g.line} ${g.id}: ${g.fields.Reversibility}`);
    assert.doesNotMatch(g.fields.Reversibility, /\bR2\b/, `${g.id}: no R2 branch for a delegated role`);
    assert.match(onlyAfter(g), /written rollback/, `${g.id}: the R3 ceremony puts the written rollback before the change`);
  }
  const roles = textOf('gws-admin-roles');
  assert.match(roles, /^## Phase C: Assign a role \(R3\)$/m);
  assert.match(roles, /^3\. Phase C: assign a role \(R3 for every role\b/m);
  assert.match(roles, /\*\*Written rollback \(in the ticket before the change\):\*\*/);
  assert.match(roles, /`\/gws-audit-log` classes role grants R3 regardless; the lane research classes a delegated role R2/);
});

// ── Finding: one phrase binds one effect ─────────────────────────────────────
// COMMAND_RISK_METADATA.md: "Use a distinct confirmation for each target and effect." A
// phrase may appear on two gates only when they make the same change (the GUI gate and
// the GAM gate for one revoke), and no gate may leave its direction to a value decided
// later ("change whether …", "ticked or unticked").
const targetTokens = (g) => [...new Set(((g.fields.Target || '').match(/\[[A-Za-z0-9_@.,-]+\]/g) || []))].sort();

test('each exact phrase binds one effect: shared only by gates with the same effect and target, never a two-way change', () => {
  for (const name of RUNBOOKS) {
    const gates = gatesOf(name);
    const byPhrase = new Map();
    for (const g of gates) {
      if (!byPhrase.has(g.phrase)) byPhrase.set(g.phrase, []);
      byPhrase.get(g.phrase).push(g);
      assert.doesNotMatch(g.fields.Effect, /\bwhether\b|\bor not\b|\bon or off\b/i, `${name}:${g.line} ${g.id}: the Effect leaves the direction open`);
      assert.doesNotMatch(g.block, /ticked or unticked|to the decided value/i, `${name}:${g.line} ${g.id}: the action leaves the direction open`);
    }
    for (const [phrase, same] of byPhrase) {
      for (const other of same.slice(1)) {
        assert.equal(other.fields.Effect, same[0].fields.Effect, `${name}: "${phrase}" is used for two effects (${same[0].id}, ${other.id})`);
        assert.deepEqual(targetTokens(other), targetTokens(same[0]), `${name}: "${phrase}" is used for two targets (${same[0].id}, ${other.id})`);
      }
    }
  }

  const allow = gateById('gws-admin-roles-recovery-allow-portal');
  const off = gateById('gws-admin-roles-recovery-off-portal');
  assert.equal(allow.phrase, 'ALLOW SUPER ADMIN ACCOUNT RECOVERY FOR OU [OU_PATH]');
  assert.equal(off.phrase, 'TURN OFF SUPER ADMIN ACCOUNT RECOVERY FOR OU [OU_PATH]');
  assert.match(allow.fields.Effect, /^allow\b/);
  assert.match(off.fields.Effect, /^turn off\b/);
  for (const g of [allow, off]) {
    assert.equal(g.rClass, 'R3');
    assert.match(g.fields.Scope, /one organizational unit, not a configuration group/, `${g.id}: the scope names only what the phrase names`);
  }
  assert.ok(!allGates().some((g) => g.id === 'gws-admin-roles-recovery-portal'), 'the two-way recovery gate is gone');
});

// ── Finding: an admin's event proves a change only when it names the target ────────
// verify-event matches the actor, the event name and the time. When the actor is the
// administrator ([UPN]), the same admin's change on another account or file (during the
// incident, or the same afternoon) would pass, so every such read-back carries --target,
// and the checklists ask for it.
test('every verify-event whose actor is the administrator carries --target, and the checklists require the target', () => {
  const adminActor = RUNBOOKS.flatMap(adapterLines).filter((l) => /\bverify-event\b/.test(l.text) && /--user \[UPN\]/.test(l.text));
  assert.ok(adminActor.length >= 3, `only ${adminActor.length} admin-actor verify-event lines`);
  for (const l of adminActor) {
    assert.match(l.text, /--target (?:\[USER@DOMAIN\.COM\]|"\[FILE_NAME\]"|\[EXTERNAL_DOMAIN\]|\[OU_PATH\])/, `${l.file}:${l.line}: ${l.text}`);
  }
  assert.match(textOf('gws-account-containment'), /^- \[ \] Phase C: `verify-event --app admin --event CHANGE_PASSWORD --target \[USER@DOMAIN\.COM\]` exited 0/m);
  assert.match(textOf('gws-account-containment'), /or the Admin log events entry for `\[USER@DOMAIN\.COM\]` was found in the GUI/);
  assert.match(textOf('gws-admin-roles'), /`verify-event --target \[USER@DOMAIN\.COM\]` exits 0/);
  assert.match(textOf('gws-drive-sharing'), /`verify-event --app drive --target "\[FILE_NAME\]"` passed/);
});

// ── Finding: a read-back must be able to fail ───────────────────────────────
// Copying an event name out of the activities output and then running verify-event for
// that same name passes whenever the admin made any change after NOT_BEFORE. Where the
// event name is not in the sources, the value read back in the Admin console is the
// proof and the activities read is supporting evidence; every verify-event names a
// concrete event, and no checklist or note calls a copied-name read "passed".
test('no read-back copies its event name from the read before it; where no event name is known, the Admin console value is the proof', () => {
  for (const name of RUNBOOKS) {
    const text = textOf(name);
    assert.doesNotMatch(text, /EVENT_NAME_FROM_THE_READ_ABOVE|name copied from the read above/, `${name}: a self-confirming read-back`);
  }
  for (const l of RUNBOOKS.flatMap(adapterLines).filter((x) => /\bverify-event\b/.test(x.text))) {
    assert.match(l.text, /--event (?:CHANGE_PASSWORD|ASSIGN_ROLE|GRANT_ADMIN_PRIVILEGE|login_success|change_user_access)\b/, `${l.file}:${l.line}: verify-event names an event from the sources: ${l.text}`);
  }
  // the checklists and notes of the two runbooks the finding named
  const drive = textOf('gws-drive-sharing');
  assert.match(drive, /^- \[ \] Phase D \(if run\): Admin console → Account → Domains → Allowlisted domains lists `\[EXTERNAL_DOMAIN\]` \(the proof\)/m);
  assert.match(drive, /^- \[ \] Phase E \(if run\): the sharing panel shows the new value for `\[OU_PATH\]` \(the proof\)/m);
  assert.doesNotMatch(drive, /`verify-event --app admin` passed/);
  const posture = textOf('gws-security-posture');
  assert.match(posture, /^- \[ \] Phase E \(if run\): the panel or app list shows the new value \(the proof\)/m);
  assert.doesNotMatch(posture, /verify-event/, 'the posture runbook has no setting change a verify-event can prove');
  assert.doesNotMatch(posture, /the adapter proves the change/);
});

// ── Finding: a rollback "under its own phrase" is a gate that exists ──────────────────
// An R3 change needs its written rollback before step 1 runs. A Reversibility line that
// promises a rollback "under its own phrase" has to quote that phrase, and the phrase has
// to be another gate's exact confirmation in the same runbook. A rollback the runbook does
// not authorize (an Inherit click, re-trusting an app) says it is a separate reviewed change.
const quotedPhrases = (text) => [...text.matchAll(/`([A-Z0-9][A-Z0-9 .,'-]*(?:\[[A-Za-z0-9_@.,-]+\][A-Z0-9 .,'-]*)*)`/g)]
  .map((m) => m[1]).filter((p) => /[A-Z]{3,}/.test(p) && / /.test(p));

test('every rollback promised "under its own phrase" quotes a gate phrase that exists in the same runbook', () => {
  for (const name of RUNBOOKS) {
    const gates = gatesOf(name);
    const phrases = new Set(gates.map((g) => g.phrase));
    for (const g of gates) {
      const rev = g.fields.Reversibility || '';
      const quoted = quotedPhrases(rev);
      for (const p of quoted) assert.ok(phrases.has(p), `${name}:${g.line} ${g.id}: rollback phrase \`${p}\` is no gate's phrase in this runbook`);
      for (const p of quoted) assert.notEqual(p, g.phrase, `${name}:${g.line} ${g.id}: a gate is not its own rollback`);
      if (/own phrase/.test(rev)) assert.ok(quoted.length > 0, `${name}:${g.line} ${g.id}: "own phrase" without the phrase: ${rev}`);
      if (/click Inherit/i.test(rev)) assert.match(rev, /separate reviewed change/, `${name}:${g.line} ${g.id}: an ungated Inherit click offered as the rollback`);
    }
  }
  // the instances the review named now have their gates
  assert.equal(gateById('gws-2sv-enforcement-group-reenforce-portal').phrase, 'ENABLE 2-STEP VERIFICATION ENFORCEMENT FOR GROUP [GROUP_EMAIL]');
  assert.match(onlyAfter(gateById('gws-2sv-enforcement-group-reenforce-portal')), /every member shows `isEnrolledIn2Sv` true/);
  assert.equal(gateById('gws-2sv-enforcement-methods-restore-portal').phrase, 'RESTORE 2-STEP VERIFICATION METHODS FOR OU [OU_PATH]');
  assert.equal(gateById('gws-2sv-enforcement-allow-rollback-portal').phrase, 'TURN OFF 2-STEP VERIFICATION ENROLLMENT FOR OU [OU_PATH]');
  assert.equal(gateById('gws-drive-sharing-allowlist-remove-portal').phrase, 'REMOVE ALLOWLISTED DOMAIN [EXTERNAL_DOMAIN]');
  const block = gateById('gws-security-posture-app-block-portal');
  assert.match(block.fields.Reversibility, /not authorized here/);
  assert.match(block.fields.Reversibility, /separate reviewed change/);
  assert.doesNotMatch(block.fields.Reversibility, /own phrase/);
  assert.match(onlyAfter(block), /written rollback path/);
});

// ── Finding: no R2+ change without captured pre-state, urgent or not ───────────
// CLAUDE.md contract rule 1. The containment fast path may suspend before the rest of
// Phase A, but never before one `user` read (status, OU, isAdmin) is in the ticket, and
// the suspend gate's action waits for it.
test('the containment suspend gate waits for a user read in the ticket, also on the urgent path', () => {
  const suspend = gateById('gws-account-containment-suspend-portal');
  assert.match(onlyAfter(suspend), /the `user` read for `\[USER@DOMAIN\.COM\]` \(status, organizational unit and `isAdmin`\) is in the ticket/);
  const lines = linesOf('gws-account-containment');
  const phaseStart = lines.findIndex((l) => /^## Phase B: Suspend the account/.test(l));
  assert.ok(phaseStart >= 0 && phaseStart < suspend.line);
  const before = lines.slice(phaseStart, suspend.line - 1).join('\n');
  assert.match(before, /\*\*Pre-state, always, even on the urgent path:\*\*/);
  assert.match(before, /^node scripts\/adapters\/gws-client\.js user --user \[USER@DOMAIN\.COM\] --execute$/m);
  const text = textOf('gws-account-containment');
  for (const line of text.split('\n').filter((l) => /visibly active/.test(l))) {
    assert.match(line, /run (?:only )?the `user` read/, `the urgent path reads the account first: ${line}`);
    assert.doesNotMatch(line, /run Phase B first|go straight to the Phase B gate/, line);
  }
});
