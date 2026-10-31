'use strict';
// pass-flags.test.js: which read-back flags change what a pass means (batch G3 close-out 3, owner
// decision H1: a presence pass must never prove a removal).
//
// EXPECTED DECISION (written before the module)
// - Every flag a runbook passes to a verify-* command is classified, so a new one cannot be
//   missed:
//   - a pass flag (audit-log.js PASS_FLAGS): it flips or sets what the read must find (--absent,
//     --enabled false, --status DEPROVISIONED, --role write, --expect 12, a note's digest), from
//     a closed set of values, a number or a digest. The verify entry records it, the change
//     record names its read-back with it, and only a read-back with the same flags counts;
//   - not a pass flag, with the reason: it names the object read (a user, group, serial, factor
//     or method), bounds the time, or is free text the operator chooses (a state, label, unit,
//     trigger or frequency name). Binding a read to those is object-level binding, owner
//     decision 3, parked; the trail records no free text.
// - Each runbook with a bound read-back that has a pass flag tells the operator to name the
//   read-back with it, and each counted gate's paragraph names it.
// Run: node --test scripts/audit/pass-flags.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const audit = require('./audit-log.js');
const { COUNTED_GATES, boundReadBacks } = require('./change-record.js');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, '.claude', 'commands');
const CONNECTOR = { gws: 'google-workspace' };
const VERIFY_LINE = /node scripts\/(?:adapters\/)?([a-z]+)-client\.js (verify-[a-z0-9-]+)([^`\n]*)/;

const OBJECT = 'names the object the read checks; which object was read is object-level binding (owner decision 3, parked)';
const TIME = 'a time or version bound: which events are recent enough, not what a pass means';
const FREE = 'a free-text name the operator chooses; binding the read to it is object-level binding (owner decision 3, parked), and the trail records no free text';
const NOT_PASS_ANY = Object.freeze({
  user: OBJECT, group: OBJECT, team: OBJECT, repo: OBJECT, branch: OBJECT, number: OBJECT, id: OBJECT, serial: OBJECT, issue: OBJECT,
  channel: OBJECT, device: OBJECT, 'profile-id': OBJECT, 'profile-identifier': OBJECT, 'role-id': OBJECT,
  'management-id': OBJECT, 'execution-id': OBJECT, identifier: OBJECT, 'app-id': OBJECT, 'comment-id': OBJECT,
  'issue-id': OBJECT, author: OBJECT, target: OBJECT, 'method-id': OBJECT,
  // batch G4, task A3: --not-before is a pass flag now (D10 on PR #9); the version bound stays here
  'from-version': TIME,
});
const NOT_PASS = Object.freeze({
  'okta:verify-app-assigned --app': OBJECT,
  'okta:verify-factor-reset --factor-type': `${OBJECT}: which factor`,
  // batch G4, task A3: msgraph verify-mfa-method --method is a pass flag now (the owner's minimum)
  'linear:verify-state --state': `${FREE}: a workflow state`,
  'linear:verify-labels --has': `${FREE}: a label`,
  'jira:verify-transition --to-status': `${FREE}: a status`,
  'google-workspace:verify-ou --ou': `${FREE}: an organizational unit`,
  'jamf:verify-policy --trigger': `${FREE}: a trigger`,
  'jamf:verify-policy --frequency': `${FREE}: a frequency`,
});

// every read-back line in the runbooks, with its kind, flags and whether it is bound
function readBackLines() {
  const found = [];
  for (const file of fs.readdirSync(DIR).filter((n) => n.endsWith('.md'))) {
    const lines = fs.readFileSync(path.join(DIR, file), 'utf8').split('\n');
    lines.forEach((l, i) => {
      const m = l.match(VERIFY_LINE);
      if (!m) return;
      const kind = `${CONNECTOR[m[1]] || m[1]}:${m[2]}`;
      const argv = [m[2], ...m[3].trim().split(/\s+/).filter(Boolean)];
      found.push({ file, line: i + 1, kind, argv, bound: /--change \[CHANGE_ID\]/.test(l), flags: argv.filter((w) => w.startsWith('--') && w !== '--execute' && w !== '--change').map((w) => w.slice(2)) });
    });
  }
  return found;
}

test('every flag a runbook passes to a read-back is classified: a pass flag, or not one with its reason', () => {
  for (const r of readBackLines()) {
    for (const flag of r.flags) {
      const pass = Object.prototype.hasOwnProperty.call(audit.PASS_FLAGS, r.kind) && Object.prototype.hasOwnProperty.call(audit.PASS_FLAGS[r.kind], flag);
      const not = Object.prototype.hasOwnProperty.call(NOT_PASS, `${r.kind} --${flag}`) || Object.prototype.hasOwnProperty.call(NOT_PASS_ANY, flag);
      assert.ok(pass !== not, `${r.file}:${r.line} ${r.kind} --${flag}: ${pass ? 'both a pass flag and listed as not one' : 'not classified'}`);
    }
  }
  // the owner's minimum: --absent on each read-back that takes it
  for (const kind of ['okta:verify-group-member', 'okta:verify-app-assigned', 'github:verify-team-member', 'msgraph:verify-group-member', 'jamf:verify-profile']) {
    assert.equal(audit.PASS_FLAGS[kind].absent, 'switch', kind);
  }
  assert.ok(audit.PASS_FLAGS['jamf:verify-group-count'].expect, '--expect style flags are pass flags');
});

test('each pass flag is a flag its connector takes, and every value rule is a closed set, a number or a digest', () => {
  const FILES = { fleet: 'scripts/adapters/fleet-client.js', github: 'scripts/adapters/github-client.js', 'google-workspace': 'scripts/adapters/gws-client.js', jamf: 'scripts/adapters/jamf-client.js', linear: 'scripts/adapters/linear-client.js', msgraph: 'scripts/adapters/msgraph-client.js', okta: 'scripts/adapters/okta-client.js', slack: 'scripts/adapters/slack-client.js', jira: 'scripts/jira-client.js' };
  for (const [kind, flags] of Object.entries(audit.PASS_FLAGS)) {
    const [connector, command] = kind.split(':');
    const src = fs.readFileSync(path.join(ROOT, FILES[connector]), 'utf8');
    assert.match(src, new RegExp(`'${command}'`), `${kind}: the connector has the command`);
    for (const [flag, rule] of Object.entries(flags)) {
      assert.ok(src.includes(`'${flag}'`) || src.includes(`${flag}:`), `${kind} --${flag}: the connector takes the flag`);
      if (rule === 'switch') continue;
      // batch G4, task A3: a time bound is its own rule (a UTC time, checked in audit-log.js)
      if (rule === 'time') { assert.equal(flag, 'not-before', `${kind} --${flag}: only --not-before is a time bound`); continue; }
      assert.ok(rule instanceof RegExp, `${kind} --${flag}: a switch, a time bound or a value rule`);
      assert.ok(!rule.test('two words') && !rule.test(''), `${kind} --${flag}: no free text, no empty value`);
    }
  }
});

test('each runbook with a bound read-back that has a pass flag says to name the read-back with it; each counted gate names it', () => {
  const bound = readBackLines().filter((r) => r.bound && audit.passFlags(r.kind, r.argv));
  const files = new Set(bound.map((r) => r.file));
  assert.ok(files.size >= 10, `runbooks with such a line: ${[...files].join(', ')}`);
  for (const file of files) {
    const text = fs.readFileSync(path.join(DIR, file), 'utf8');
    assert.match(text, /Name the read-back with the flags on its line below that change what its pass means/, `${file}: says to name the read-back with its pass flags`);
  }
  const text = fs.readFileSync(path.join(DIR, 'okta-group-membership.md'), 'utf8');
  const remove = text.split('\n').find((l) => l.includes('[okta-group-membership-bulk-remove-portal]') && l.includes('--expected'));
  assert.match(remove, /`--read-back 'okta:verify-group-member --absent'`/, 'the counted removal names its --absent read-back');
  assert.ok(Object.prototype.hasOwnProperty.call(COUNTED_GATES, 'okta-group-membership-bulk-remove-portal'));
});

test('a bound read-back under a removal gate proves the removal: no bound presence read of the same kind sits beside an --absent one', () => {
  // a read that checks another object than the change's proof (a pilot Mac that keeps the
  // profile) is not bound to the change; otherwise the gate's change could be opened for the
  // presence form and a presence pass would prove the removal. The lines are read as
  // change-record.js binds them: every gate a comment names, else the section's gate (code review
  // round 1 of the batch G3 close-out 3, finding 8: a line under "## Read-back" with its gate
  // named in the comment was skipped, and only the first of several named gates was read)
  const byGate = new Map();
  for (const file of fs.readdirSync(DIR).filter((n) => n.endsWith('.md'))) {
    for (const b of boundReadBacks(fs.readFileSync(path.join(DIR, file), 'utf8'))) {
      assert.ok(b.gates.length, `${file}:${b.line}: a bound read-back names its gate or sits under one`);
      for (const gate of b.gates) {
        const key = `${file} ${gate} ${b.kind}`;
        if (!byGate.has(key)) byGate.set(key, new Set());
        byGate.get(key).add(b.argv.includes('--absent') ? 'absent' : 'present');
      }
    }
  }
  const both = [...byGate].filter(([, forms]) => forms.size > 1).map(([key]) => key);
  // the one gate that legitimately proves both directions (a rule change that adds some people
  // and removes others) says it takes one change record per direction
  assert.deepEqual(both, ['okta-group-membership.md okta-group-membership-rule-change-portal okta:verify-group-member']);
  assert.match(fs.readFileSync(path.join(DIR, 'okta-group-membership.md'), 'utf8'), /one change record for the people who leave \(`okta:verify-group-member --absent`\) and one for the people who join \(`okta:verify-group-member`\)/);
});

// Code review round 2 of the batch G3 close-out 3, findings 6 and 10: the pilot read under
// /jamf-config-profiles' removal from All Computers pointed to Phase C's line, which runs under
// --change, so copying it under this change was refused; and the audit README still described an
// unbound pilot line. The comment now says the pilot group keeps the profile without a read here.
test('no read-back is named under a change for an object the change does not touch, and the audit README says so', () => {
  const jamf = fs.readFileSync(path.join(DIR, 'jamf-config-profiles.md'), 'utf8');
  assert.doesNotMatch(jamf, /check one with Phase C's read-back/);
  // code review round 3, finding 3: the removal can drop the pilot group by mistake, so a pilot
  // Mac is read after it, in a read-only section of its own that no gate's change covers
  assert.match(jamf, /# the pilot group must still list the profile: read one pilot Mac with the check after the removals below \(R0, no change record\)/);
  const check = jamf.split('\n## ').find((sec) => sec.startsWith('After a removal: the pilot group still holds the profile (R0)'));
  assert.ok(check, 'the R0 section after the removals');
  assert.match(check, /\nnode scripts\/adapters\/jamf-client\.js verify-profile --serial \[SERIAL_NUMBER\] --profile-id \[PROFILE_ID\] --profile-identifier \[PROFILE_IDENTIFIER\] --execute\n/);
  assert.doesNotMatch(check, /SAFETY GATE|--change/);
  const readme = fs.readFileSync(path.join(ROOT, 'scripts', 'audit', 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /runs without `--change`, and its runbook says so/);
  assert.match(readme, /every read-back line under an R2 or R3 gate is bound to that gate's change/);
});

// Batch G4, task A3: a read-back bounded in time (--not-before) is named with its bound, bare, and
// runs with a bound at or after the approval's time; each runbook that binds one under a change says
// so in its change-record paragraph.
const TIME_SENTENCE = 'A read-back whose line has `--not-before` is named with it and no value';
test('each runbook that binds a time-bounded read-back says to name its bound bare and to run it at or after the approval', () => {
  const timed = readBackLines().filter((r) => r.bound && r.flags.includes('not-before'));
  const files = [...new Set(timed.map((r) => r.file))].sort();
  assert.deepEqual(files, ['fleet-device-actions.md', 'gws-account-containment.md', 'gws-admin-roles.md', 'gws-drive-sharing.md', 'jamf-config-profiles.md', 'mfa-issue.md', 'offboard.md', 'password-reset.md', 'security-alert-triage.md']);
  for (const file of files) {
    const paragraph = fs.readFileSync(path.join(DIR, file), 'utf8').split('\n').find((l) => l.startsWith('**Change record'));
    assert.ok(paragraph && paragraph.includes(TIME_SENTENCE), `${file}: the change-record paragraph names the time bound`);
    assert.match(paragraph, /at or after the approval's time, which `approve` prints/, file);
  }
});
