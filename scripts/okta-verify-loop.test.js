'use strict';
// okta-verify-loop.test.js: the Okta Verify sign-in loop after a macOS update (batch 9, task 8; batch 9b).
//
// EXPECTED DECISION (batch 9b, written before the runbook edit; an owner-authorized change of requirement:
// batch 9 pinned the admin step as the PREVIEW ONLY marker okta-verify-loop-admin-reauth because the owner's
// fill-in line was blank; the owner has now named the button, "Clear User Sessions")
// - /okta-mfa-reset keeps its section "Okta Verify sign-in loop after a macOS update" and its source line
//   "Source: operator-validated by the owner, 2026-11-06; not in Okta's published troubleshooting pages".
// - Its steps come in this order: three "**User check:**" steps (reinstalling Okta Verify is not the first
//   one: the ticket says it was already reinstalled), then the admin step, then Reset Authenticators as the
//   last resort, pointing to the existing reset gates, which stay in the runbook.
// - The admin step is a SAFETY GATE: okta-user-lifecycle-clear-sessions-portal (Phase C of
//   /okta-user-lifecycle), or a gate with its own id whose fields are Phase C's word for word. Before it, a
//   line to write the current UTC time as [NOT_BEFORE]; its PORTAL ACTION clicks Directory, People (or the
//   Dashboard search box), the user, More Actions, Clear User Sessions; after it, the verify-sessions-cleared
//   read-back with --not-before [NOT_BEFORE].
// - The PREVIEW ONLY marker okta-verify-loop-admin-reauth is gone from every runbook.
// Run: node --test scripts/okta-verify-loop.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const COMMANDS = path.join(__dirname, '..', '.claude', 'commands');
const TEXT = fs.readFileSync(path.join(COMMANDS, 'okta-mfa-reset.md'), 'utf8');
const LIFECYCLE = fs.readFileSync(path.join(COMMANDS, 'okta-user-lifecycle.md'), 'utf8');
const TITLE = 'Okta Verify sign-in loop after a macOS update';
const PHASE_C = 'okta-user-lifecycle-clear-sessions-portal';
const FIELDS = ['Target', 'Effect', 'Scope', 'Reversibility', 'Required confirmation', 'Failure behavior', 'Read-back'];
const READ_BACK = 'node scripts/adapters/okta-client.js verify-sessions-cleared --user [OKTA_USER_ID] --not-before [NOT_BEFORE] --execute';

// The section's lines: from its heading to the next heading of the same or a higher level outside a code
// fence (a "# HUMAN-RUN" comment in a bash fence is not a heading).
function section() {
  const lines = TEXT.split('\n');
  const start = lines.findIndex((l) => /^#{2,3} /.test(l) && l.replace(/^#+ /, '').trim() === TITLE);
  if (start < 0) return null;
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.length;
  let fenced = false;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\s*```/.test(lines[i])) fenced = !fenced;
    else if (!fenced && /^#+ /.test(lines[i]) && lines[i].match(/^#+/)[0].length <= level) { end = i; break; }
  }
  return lines.slice(start, end);
}

// A gate's field lines ("- **Name:** value") right after its marker line, as { name: value }.
function fieldsAfter(lines, at) {
  const out = {};
  for (let i = at + 1; i < lines.length; i += 1) {
    const m = /^- \*\*([A-Za-z -]+):\*\* (.*)$/.exec(lines[i]);
    if (!m) break;
    out[m[1]] = m[2];
  }
  return out;
}

const gatesIn = (lines) => lines.map((l, i) => ({ m: /^<!-- SAFETY GATE \[([a-z0-9-]+)\] -->$/.exec(l.trim()), i })).filter((x) => x.m).map((x) => ({ id: x.m[1], at: x.i }));
const phaseCFields = () => { const lines = LIFECYCLE.split('\n'); const g = gatesIn(lines).find((x) => x.id === PHASE_C); return g ? fieldsAfter(lines, g.at) : null; };

test('the section exists in /okta-mfa-reset with its source line, word for word', () => {
  // catches: the section put in another runbook, or a source line that claims Okta published the fix
  const s = section();
  assert.ok(s, `no "${TITLE}" section in okta-mfa-reset.md`);
  assert.ok(s.includes("Source: operator-validated by the owner, 2026-11-06; not in Okta's published troubleshooting pages"), 'the exact source line');
});

test('three user checks, then the admin gate, then Reset Authenticators as the last resort', () => {
  // catches: the reset (or the admin gate) listed before the user checks, a user check dropped, or the reset not last
  const s = section();
  assert.ok(s, 'section present');
  const checks = s.map((l, i) => (/^\s*(?:\d+[.)]\s+|[-*]\s+)?\*\*User check:\*\*\s*\S/.test(l) ? i : -1)).filter((i) => i >= 0);
  const gates = gatesIn(s);
  assert.equal(checks.length, 3, `three user checks, found ${checks.length}`);
  assert.equal(gates.length, 1, `one admin gate in the section, found ${gates.map((g) => g.id).join(', ') || 'none'}`);
  const gate = gates[0].at;
  assert.ok(checks.every((i) => i < gate), 'every user check comes before the admin gate');
  const reset = s.findIndex((l, i) => i > gate && /Reset Authenticators/.test(l));
  assert.ok(reset > gate, 'Reset Authenticators comes after the admin gate');
  assert.ok(!s.slice(0, gate).some((l) => /Reset Authenticators/.test(l)), 'no reset before the admin gate');
  assert.match(s[reset], /last resort/i, 'the reset is labeled the last resort');
  assert.ok(!s.slice(reset + 1).some((l) => /^\s*(?:\d+[.)]\s+)?\*\*User check:\*\*/.test(l) || /SAFETY GATE \[/.test(l)), 'nothing after the last resort');
});

test('the first user check is not a reinstall, since Okta Verify was already reinstalled', () => {
  // catches: "reinstall Okta Verify" as step 1, the step the ticket says was already done
  const s = section();
  assert.ok(s, 'section present');
  const first = s.find((l) => /\*\*User check:\*\*/.test(l));
  assert.ok(first, 'a user check');
  assert.doesNotMatch(first, /reinstall/i);
});

test('the admin gate is Phase C of /okta-user-lifecycle, or a gate of its own whose fields are Phase C\'s word for word', () => {
  // catches: a gate with a weaker phrase, another R class, a changed effect or scope, or no Read-back field
  const s = section();
  assert.ok(s, 'section present');
  const [gate] = gatesIn(s);
  assert.ok(gate, 'a SAFETY GATE in the section');
  const want = phaseCFields();
  assert.ok(want, `${PHASE_C} is still a gate in /okta-user-lifecycle`);
  for (const f of FIELDS) assert.ok(want[f], `Phase C has a ${f} field`);
  // evidence review 1, nit 3: compared whichever id the gate uses, so a reused id with weaker fields fails too
  assert.deepEqual(fieldsAfter(s, gate.at), want, `${gate.id}: the same fields as ${PHASE_C}`);
  assert.equal(want['Required confirmation'], 'Type exactly `CLEAR OKTA SESSIONS FOR [UPN]`.');
  assert.match(want.Reversibility, /^R1:/);
});

test('the gate\'s click path is the owner\'s: Directory, People or the Dashboard search box, the user, More Actions, Clear User Sessions', () => {
  // catches: the owner's "re-auth" word written as a button Okta does not have, or a path that skips More Actions
  const s = section();
  assert.ok(s, 'section present');
  const [gate] = gatesIn(s);
  assert.ok(gate, 'a SAFETY GATE in the section');
  const action = s.findIndex((l, i) => i > gate.at && l.includes(`**PORTAL ACTION [${gate.id}]:**`));
  assert.ok(action > gate.at, `a PORTAL ACTION for ${gate.id} right under the gate`);
  const click = s.slice(action + 1).find((l) => /^\s*1\.\s/.test(l));
  assert.ok(click, 'a first numbered click step');
  assert.match(click, /Okta Admin Console → Directory → People/);
  assert.match(click, /Dashboard/, 'the owner\'s route, the Dashboard search box, is named too');
  assert.match(click, /`?\[UPN\]`? → \*\*More Actions\*\* → \*\*Clear User Sessions\*\*/);
  assert.doesNotMatch(s.join('\n'), /\*\*re-?auth/i, 'no button named re-auth');
});

// The numbered steps 2 and 3 of one PORTAL ACTION block: from its label to the next blank line, so another
// block's steps are never read (code review 2 of batch 9b, finding 12).
function actionSteps(lines, id) {
  const at = lines.findIndex((l) => l.includes(`**PORTAL ACTION [${id}]:**`));
  assert.ok(at >= 0, `a PORTAL ACTION for ${id}`);
  const end = lines.findIndex((l, i) => i > at && l.trim() === '');
  return lines.slice(at + 1, end < 0 ? lines.length : end).filter((l) => /^\s*[23]\.\s/.test(l));
}
const block = (heading) => { const parts = TEXT.split(heading); assert.equal(parts.length, 2, `one "${heading}"`); return parts[1].split('\n## ')[0]; };
// the Fast path to the next heading, or to the end of the file when none follows (code review 3, a cleanup it noted)
const fastPath = () => { const lines = TEXT.split('\n'); const at = lines.indexOf('## Fast path'); assert.ok(at >= 0, 'a Fast path'); const end = lines.findIndex((l, i) => i > at && /^## /.test(l)); return lines.slice(at, end < 0 ? lines.length : end); };

test('the PORTAL ACTION dialog and read-back steps are Phase C\'s word for word', () => {
  // code review 1 of batch 9b, finding 8: catches the two copies of the session clear drifting apart past the field lines
  const s = section();
  assert.ok(s, 'section present');
  const [gate] = gatesIn(s);
  assert.ok(gate, 'a SAFETY GATE in the section');
  const phaseC = actionSteps(LIFECYCLE.split('\n'), PHASE_C);
  assert.equal(phaseC.length, 2, 'Phase C has steps 2 and 3');
  assert.deepEqual(actionSteps(s, gate.id), phaseC);
});

test('the Placeholders line defines [NOT_BEFORE] in the form the connector takes', () => {
  // code review 1 of batch 9b, finding 9: catches a tech writing "09:05 UTC", which the connector refuses
  const placeholders = TEXT.split('\n').find((l) => l.startsWith('**Placeholders:**'));
  assert.match(placeholders, /`\[NOT_BEFORE\]` \(the UTC time in ISO 8601, such as `2026-10-28T09:00:00Z`/);
});

test('the Fast path sends a loop ticket to its section first, with Phase B or Phase C as its last resort', () => {
  // code review 1, finding 10, and code review 2, finding 14: catches the quick route skipping the session clear,
  // or naming only Phase B where the section names Phase B or Phase C
  const fast = fastPath();
  const loop = fast.findIndex((l) => l.includes(TITLE));
  const phaseB = fast.findIndex((l) => /^\d+\. Phase B\b/.test(l));
  assert.ok(loop > 0 && loop < phaseB, 'the Fast path names the loop section before Phase B');
  assert.match(fast[loop], /Phase B, or Phase C when every enrollment must go, is its last resort/);
  // code review 3, finding 11: catches Phase B read as the next step after a loop the session clear already fixed
  assert.match(fast[phaseB], /^\d+\. Phase B \(a new phone, or the loop's last resort when the session clear did not stop it\):/);
});

test('the checklist has the session-clear item, which names how many reset items it waives and keeps the compromise item', () => {
  // code review 1, finding 2; code review 2, finding 13; code review 3, findings 2 and 10: catches a light path with no
  // checklist item, a wrong count of the waived items, or a checklist with no compromise item to keep
  const items = block('## ✅ Verification checklist').split('\n').filter((l) => /^- \[ \]/.test(l));
  const at = items.findIndex((l) => /verify-sessions-cleared/.test(l));
  assert.ok(at >= 0, 'a checklist item for the session-clear read-back');
  const compromise = items.findIndex((l) => /compromise was suspected/.test(l));
  assert.ok(compromise > at, 'a compromise item after it');
  const waived = items.slice(at + 1, compromise).length;
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
  assert.match(items[at], new RegExp(`the ${words[waived]} reset and re-enrollment items below do not apply`), `${waived} items sit between it and the compromise item`);
  assert.match(items[at], /if the reset followed, they apply too/);
  assert.match(items[at], /the compromise item applies either way/i);
});

test('a completed Jira form needs every read-back of the changes made, never only the ones that ran', () => {
  // code review 2, finding 1, and code review 3, finding 4: catches a rule a skipped read-back satisfies
  const note = block('## 📝 Jira-ready note');
  assert.doesNotMatch(note, /read-back this ticket ran passed|both when both ran/);
  assert.match(note, /every read-back above that the path taken requires passed/);
  assert.match(note, /both when both changes were made/);
});

test('the Jira note has a completed form for the loop fixed by the session clear alone', () => {
  // code review 1, finding 2, and code review 3, finding 5: catches that form deleted while the reset form still names the read
  const note = block('## 📝 Jira-ready note');
  const form = note.split('\n').find((l) => l.startsWith('> [Okta Verify loop fixed by the session clear'));
  assert.ok(form, 'the session-clear form');
  assert.match(form, /verify-sessions-cleared passed/);
  assert.match(form, /No authenticator was reset/);
});

test('the reset form fits the session clear then the reset: its slot, the Mac, and the signed_nonce read', () => {
  // code review 2, finding 5, and code review 3, finding 3: catches a form that forces "the new phone" on a Mac loop
  // ticket or has no slot for the FastPass read Phase B requires
  const note = block('## 📝 Jira-ready note');
  const form = note.split('\n').find((l) => l.startsWith('> [Only if all checks passed] Okta MFA reset'));
  assert.ok(form, 'the reset form');
  assert.match(form, /\[if the session clear ran first\][^\n]*verify-sessions-cleared passed/);
  assert.match(form, /\[on the new phone \/ on the Mac\]/);
  assert.match(form, /signed_nonce/);
});

test('a [NOT_BEFORE] line comes before the gate and the verify-sessions-cleared read-back after it', () => {
  // catches: a read-back with no time bound (it would pass on an older clear), or a time written after the click
  const s = section();
  assert.ok(s, 'section present');
  const [gate] = gatesIn(s);
  assert.ok(gate, 'a SAFETY GATE in the section');
  const notBefore = s.findIndex((l) => /current UTC time/.test(l) && /`\[NOT_BEFORE\]`/.test(l));
  assert.ok(notBefore >= 0 && notBefore < gate.at, 'the [NOT_BEFORE] line comes before the gate');
  const read = s.findIndex((l) => l.trim() === READ_BACK);
  assert.ok(read > gate.at, 'the verify-sessions-cleared read-back comes after the gate');
  const reset = s.findIndex((l, i) => i > gate.at && /Reset Authenticators/.test(l));
  assert.ok(read < reset, 'the read-back comes before the last resort');
});

test('the admin step says where it comes from and the two Okta limits on More Actions', () => {
  // catches: a step that reads as Okta's published fix for the loop, or the limits left out
  const s = section();
  assert.ok(s, 'section present');
  assert.ok(s.includes('Source: operator-validated by the owner on the real ticket, 2026-11-07, path confirmed against Okta\'s "How to clear user session" article.'), 'the admin step\'s source line');
  const gotcha = s.find((l) => /^\*\*Gotcha:\*\*/.test(l) && /More Actions/.test(l));
  assert.ok(gotcha, 'a Gotcha about More Actions');
  assert.match(gotcha, /own profile/i);
  // evidence review 1, finding 2: Okta limits the Clear User Sessions action to active users, not More Actions
  assert.match(gotcha, /\*\*Clear User Sessions\*\* is offered only for active users/);
});

test('the reset step points to the existing reset gates, which are still in the runbook', () => {
  // catches: a new or renamed reset gate invented for this section, or a pointer to a gate that does not exist
  const s = section();
  assert.ok(s, 'section present');
  const body = s.join('\n');
  for (const gate of ['okta-mfa-reset-selected-portal', 'okta-mfa-reset-all-portal']) {
    assert.match(body, new RegExp(`\`${gate}\``), `the section names ${gate}`);
    assert.ok(TEXT.includes(`<!-- SAFETY GATE [${gate}] -->`), `${gate} is still a gate`);
    assert.doesNotMatch(body, new RegExp(`SAFETY GATE \\[${gate}\\]`), `${gate} is not repeated in the section`);
  }
});

test('the PREVIEW ONLY marker okta-verify-loop-admin-reauth appears nowhere in .claude/commands', () => {
  // catches: the old marker left beside the new gate, here or in another runbook
  // evidence review 1, nit 2: every Markdown file under .claude/commands, subfolders included
  const hits = fs.readdirSync(COMMANDS, { recursive: true }).filter((f) => String(f).endsWith('.md'))
    .filter((f) => fs.readFileSync(path.join(COMMANDS, String(f)), 'utf8').includes('PREVIEW ONLY [okta-verify-loop-admin-reauth]'));
  assert.deepEqual(hits, []);
});
