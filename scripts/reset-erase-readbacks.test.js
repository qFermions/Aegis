'use strict';
// reset-erase-readbacks.test.js: the Google password reset and the Jamf erase name their read-backs
// (batch 9, task 7).
//
// EXPECTED DECISION (written before the runbook edits)
// - /gws-password-reset Phase B's portal gate is R1, so it takes no change record: its Read-back field
//   stays none (R1: no change record), and its own section holds exactly one read line, the Google
//   Admin audit read /gws-account-containment Phase C already uses (verify-event --app admin --event
//   CHANGE_PASSWORD ... --target [USER@DOMAIN.COM]), without --change. The desk reads that one line.
// - /jamf-lock-erase Phase C's wipe gate is R3, so its Read-back field names a Jamf command-status read
//   bound with --change: the existing jamf-client.js verify-command, with the erase command type
//   (ERASE_DEVICE, the type value is UNCONFIRMED on the allowed vendor hosts) and --not-before. No new
//   adapter route: verify-command already reads an MDM command's status (GET /api/v2/mdm/commands).
// - Both runbooks have no Read-back problem as change-record.js reads them.
// Run: node --test scripts/reset-erase-readbacks.test.js

require('./adapters/socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { catalog } = require('./demo/catalog.js');
const { readBackProblems } = require('./audit/change-record.js');

const DIR = path.join(__dirname, '..', '.claude', 'commands');
const gates = catalog(DIR);
const flag = (argv, name) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };

test('the Google password reset gate is R1 and its own section names exactly one CHANGE_PASSWORD audit read', () => {
  // catches: the read placed under Phase C (outside the gate's section), written with --change, or a second read beside it
  const g = gates.get('gws-password-reset-password-portal');
  assert.equal(g.rClass, 'R1');
  assert.deepEqual(g.bound, []);
  assert.equal(g.none, 'R1: no change record');
  assert.equal(g.reads.length, 1, 'exactly one read line in the gate section');
  const [r] = g.reads;
  assert.equal(r.kind, 'google-workspace:verify-event');
  assert.equal(flag(r.argv, '--app'), 'admin');
  assert.equal(flag(r.argv, '--event'), 'CHANGE_PASSWORD');
  assert.equal(flag(r.argv, '--target'), '[USER@DOMAIN.COM]');
  assert.equal(flag(r.argv, '--not-before'), '[NOT_BEFORE]');
  assert.doesNotMatch(r.command, /--change/);
});

test('the read line is the one /gws-account-containment uses, without --change', () => {
  // catches: a read with other flags (no --target, another event), so the desk reads a different proof than containment
  const containment = fs.readFileSync(path.join(DIR, 'gws-account-containment.md'), 'utf8');
  // the runbook line it runs, not its gate's Read-back field (which names the command without node scripts/)
  const line = containment.split('\n').find((l) => /^node scripts\/adapters\/gws-client\.js verify-event --app admin --event CHANGE_PASSWORD/.test(l.trim()) && /--change \[CHANGE_ID\]/.test(l));
  assert.ok(line, 'containment still has its bound read line');
  assert.equal(gates.get('gws-password-reset-password-portal').reads[0].command, line.trim().replace(' --change [CHANGE_ID]', ''));
});

test('the Jamf wipe gate binds a verify-command read of the erase command, under its change record', () => {
  // catches: a field naming DEVICE_LOCK, a read without --not-before, or a field naming a line the runbook never runs
  const g = gates.get('jamf-lock-erase-wipe-portal');
  assert.equal(g.rClass, 'R3');
  assert.equal(g.none, null);
  assert.equal(g.bound.length, 1);
  const [b] = g.bound;
  assert.equal(b.kind, 'jamf:verify-command');
  assert.equal(flag(b.argv, '--type'), 'ERASE_DEVICE');
  assert.equal(flag(b.argv, '--management-id'), '[DEVICE_ID]');
  assert.equal(flag(b.argv, '--not-before'), '[NOT_BEFORE]');
  assert.match(b.command, /--change \[CHANGE_ID\] --execute$/);
});

test('both runbooks keep the Read-back contract change-record.js reads', () => {
  // catches: an R1 field naming a command, a bound line no gate names, or a missing change-record paragraph
  for (const name of ['gws-password-reset', 'jamf-lock-erase']) {
    assert.deepEqual(readBackProblems(fs.readFileSync(path.join(DIR, `${name}.md`), 'utf8')), [], name);
  }
  const page = fs.readFileSync(path.join(DIR, 'jamf-lock-erase.md'), 'utf8');
  assert.ok(/\*\*Change record \(R3 gates\):\*\* before a gate[^\n]*`node scripts\/audit\/change-record\.js open`[^\n]*`\[CHANGE_ID\]`/.test(page), 'jamf-lock-erase says where [CHANGE_ID] comes from');
});
