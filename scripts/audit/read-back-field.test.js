'use strict';
// read-back-field.test.js: every SAFETY GATE names its read-back on one line (batch G4, task D2).
//
// EXPECTED DECISION (written before the change)
// - The owner's words: "An explicit Read-back: line in every SAFETY GATE: the verify-* command and
//   flags that prove it, or Read-back: none (<reason>). Change records read that line instead of
//   inferring the binding from where a line sits; a test fails when an R2 or R3 gate has neither."
// - Each gate has one Read-back field after its last field line: `- **Read-back:** ...` in the
//   portal form, `# Read-back: ...` in the fenced form. A gate that binds read-backs names each
//   command exactly as its runbook line runs it, from `node scripts/` to `--execute` (portal: in
//   backticks, several separated by "; "; fenced: one plain command, since a comment in a gated
//   bash fence may hold no backtick or semicolon). Any other gate says none with a reason (portal:
//   `none (<reason>)`; fenced: `none, <reason>`, since such a comment may hold no parenthesis); an
//   R1 gate's reason is "R1: no change record".
// - change-record.js binds a runbook line run with --change [CHANGE_ID] to the gates whose field
//   names its command, never to the gate whose section it sits in or the gate a comment names; open
//   takes only a read-back a gate's field names.
// - readBackProblems names, for one runbook: a gate with no Read-back field (with its R class), a
//   field that is not one of the two forms, a field naming a command no line of the runbook runs
//   with --change, a line run with --change that no field names, and an R0 or R1 gate whose field
//   names a command (an R1 change takes no change record).
// Run: node --test scripts/audit/read-back-field.test.js

require('../adapters/socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const changes = require('./change-record.js');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, '.claude', 'commands');
const runbooks = () => fs.readdirSync(DIR).filter((n) => n.endsWith('.md')).sort();
const read = (name) => fs.readFileSync(path.join(DIR, name), 'utf8');
// a runbook's text with the one line that equals `line` removed
const without = (text, line) => {
  const lines = text.split('\n');
  const i = lines.indexOf(line);
  assert.ok(i >= 0, `the line is in the runbook: ${line.slice(0, 100)}`);
  lines.splice(i, 1);
  return lines.join('\n');
};

test('D2: every SAFETY GATE in every runbook has one Read-back field, and no runbook has a Read-back problem', () => {
  let gates = 0;
  let naming = 0;
  for (const name of runbooks()) {
    const text = read(name);
    assert.deepEqual(changes.readBackProblems(text), [], `${name}: Read-back problems`);
    for (const g of changes.gateFields(text)) {
      gates += 1;
      assert.ok(g.readBack, `${name}: ${g.id} has a Read-back field`);
      if (g.readBack.commands.length) naming += 1;
      // an R1 gate takes no change record; an R2 or R3 gate with none gives a reason of its own
      if (g.rClass === 'R0' || g.rClass === 'R1') assert.equal(g.readBack.none, `${g.rClass}: no change record`, `${name}: ${g.id}`);
      else if (g.readBack.none !== null) assert.ok(g.readBack.none.length > 10 && !/^R[0-3]: no change record$/.test(g.readBack.none), `${name}: ${g.id} (${g.rClass}) gives its reason: ${g.readBack.none}`);
    }
  }
  // the SAFETY GATE count is unchanged (gate-r-class.test.js); 89 gates bind read-backs at the base
  assert.equal(gates, 343, 'every runbook gate');
  assert.equal(naming, 89, 'the gates that name read-backs');
});

test('D2: an R2 or R3 gate with no Read-back field fails, naming the gate and its class, in either form', () => {
  const portal = read('offboard.md');
  const field = portal.split('\n').find((l) => l.startsWith('- **Read-back:** `node scripts/adapters/msgraph-client.js verify-account-enabled'));
  assert.ok(field, 'the sign-in block names its read-back');
  const problems = changes.readBackProblems(without(portal, field));
  assert.ok(problems.some((p) => p.includes('offboard-cloud-block-portal') && p.includes('R3') && /no Read-back field/.test(p)), problems.join('\n'));
  const fenced = read('gws-group-membership.md');
  const gate = changes.gateFields(fenced).find((g) => g.id === 'gws-group-membership-remove');
  assert.ok(gate && !gate.portal && gate.readBack && gate.readBack.none, 'the fenced removal says none, with its reason');
  const lines = fenced.split('\n');
  assert.match(lines[gate.readBack.line - 1], /^# Read-back: none, /);
  lines.splice(gate.readBack.line - 1, 1);
  const fencedProblems = changes.readBackProblems(lines.join('\n'));
  assert.ok(fencedProblems.some((p) => p.includes('gws-group-membership-remove ') && p.includes('R2') && /no Read-back field/.test(p)), fencedProblems.join('\n'));
});

test('D2: a field naming a command the runbook does not run fails, and so does a line run under a change that no field names', () => {
  const text = read('okta-mfa-reset.md');
  const run = 'node scripts/adapters/okta-client.js verify-factors-reset-all --user [OKTA_USER_ID] --change [CHANGE_ID] --execute';
  const field = text.split('\n').find((l) => l === `# Read-back: ${run}`);
  assert.ok(field, 'the fenced reset of all factors names its read-back');
  // the field names a command the runbook does not run
  const wrong = text.replace(field, '# Read-back: node scripts/adapters/okta-client.js verify-status --user [OKTA_USER_ID] --status ACTIVE --change [CHANGE_ID] --execute');
  const problems = changes.readBackProblems(wrong);
  assert.ok(problems.some((p) => p.includes('okta-mfa-reset-all') && p.includes('verify-status --user [OKTA_USER_ID] --status ACTIVE') && /no line of the runbook runs/.test(p)), problems.join('\n'));
  // and the line it should have named is now named by no field
  assert.ok(problems.some((p) => p.includes(run) && /no gate's Read-back field names it/.test(p)), problems.join('\n'));
  // a field whose command differs from its line in one flag is a different command
  const flag = text.replace(field, `# Read-back: ${run.replace(' --change', ' --absent --change')}`);
  assert.ok(changes.readBackProblems(flag).some((p) => p.includes('okta-mfa-reset-all') && /no line of the runbook runs/.test(p)));
});

test('D2: an R1 gate whose field names a command fails; a field in neither form fails', () => {
  const text = read('okta-mfa-reset.md');
  const r1 = changes.gateFields(text).find((g) => g.rClass === 'R1');
  assert.ok(r1, 'an R1 gate in the runbook');
  const lines = text.split('\n');
  const run = 'node scripts/adapters/okta-client.js verify-factors-reset-all --user [OKTA_USER_ID] --change [CHANGE_ID] --execute';
  lines[r1.readBack.line - 1] = r1.portal ? `- **Read-back:** \`${run}\`` : `# Read-back: ${run}`;
  assert.ok(changes.readBackProblems(lines.join('\n')).some((p) => p.includes(r1.id) && /R1/.test(p) && /takes no change record/.test(p)));
  for (const bad of ['- **Read-back:** none', '- **Read-back:** nothing to read', '- **Read-back:** none, a reason in the fenced form', '- **Read-back:** node scripts/adapters/okta-client.js verify-status --user [OKTA_USER_ID] --change [CHANGE_ID] --execute']) {
    const portal = changes.gateFields(text).find((g) => g.portal);
    const copy = text.split('\n');
    copy[portal.readBack.line - 1] = bad;
    assert.ok(changes.readBackProblems(copy.join('\n')).some((p) => p.includes(portal.id) && /not one of the two forms/.test(p)), bad);
  }
});

// a runbook of two R2 gates: gate a's section holds a line run under a change, and a comment above
// it names gate a, but only gate b's Read-back field names it
const FIXTURE = [
  '# aegis-d2-fixture', '',
  '## Phase A', '',
  '<!-- SAFETY GATE [aegis-d2-a] -->',
  '- **Target:** [UPN]',
  '- **Reversibility:** R2 (a test gate)',
  '- **Read-back:** none (a test gate whose proof is a read)', '',
  '```bash',
  '# HUMAN-RUN read-only read-back of [aegis-d2-a]: passes only when the user is gone from the group',
  'node scripts/adapters/okta-client.js verify-group-member --group [OKTA_GROUP_ID] --user [OKTA_USER_ID] --absent --change [CHANGE_ID] --execute',
  '```', '',
  '## Phase B', '',
  '<!-- SAFETY GATE [aegis-d2-b] -->',
  '- **Target:** [UPN]',
  '- **Reversibility:** R2 (a test gate)',
  '- **Read-back:** `node scripts/adapters/okta-client.js verify-group-member --group [OKTA_GROUP_ID] --user [OKTA_USER_ID] --absent --change [CHANGE_ID] --execute`', '',
].join('\n');

test('D2: the binding comes from the Read-back field, not the section a line sits in or the gate its comment names', () => {
  assert.deepEqual(changes.readBackProblems(FIXTURE), []);
  const bound = changes.boundReadBacks(FIXTURE);
  assert.equal(bound.length, 1);
  assert.deepEqual(bound[0].gates, ['aegis-d2-b']);
  assert.equal(bound[0].kind, 'okta:verify-group-member');
  const fields = changes.gateFields(FIXTURE);
  assert.deepEqual(fields.map((g) => [g.id, g.rClass, g.portal, g.readBack.none, g.readBack.commands.length]), [['aegis-d2-a', 'R2', true, 'a test gate whose proof is a read', 0], ['aegis-d2-b', 'R2', true, null, 1]]);
});

test('D2: open takes the read-back a gate\'s field names and refuses one its field does not name, even one in its own section', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-d2-open-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const folder = path.join(dir, 'commands');
  fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, 'aegis-d2-fixture.md'), FIXTURE);
  const before = changes.useRunbooksForTests(folder);
  t.after(() => changes.useRunbooksForTests(before));
  const procedure = path.join(dir, 'procedure.md');
  fs.writeFileSync(procedure, 'The removal of [UPN] from the group.\n');
  const open = (gate, readBack) => {
    const out = [];
    const err = [];
    const code = changes.main(['open', '--command', 'aegis-d2-fixture', '--gate', gate, '--r-class', 'R2', '--target', '[UPN]', '--read-back', readBack, '--procedure-file', procedure], { AEGIS_AUDIT_DIR: path.join(dir, 'audit') }, { out: (s) => out.push(s), err: (s) => err.push(s) });
    return { code, out: out.join(''), err: err.join('') };
  };
  // gate b's field names the --absent read: open takes it, and names the read-back in its steps
  const ok = open('aegis-d2-b', 'okta:verify-group-member --absent');
  assert.equal(ok.code, 0, ok.err);
  assert.match(ok.out, /okta:verify-group-member --absent/);
  // the presence read is not the one the field names
  const presence = open('aegis-d2-b', 'okta:verify-group-member');
  assert.equal(presence.code, 1);
  assert.match(presence.err, /runs as okta:verify-group-member --absent, not as okta:verify-group-member/);
  // another connector's read-back is refused
  const other = open('aegis-d2-b', 'okta:verify-app-assigned --absent');
  assert.equal(other.code, 1);
  // gate a's section holds the line, and a comment names gate a, but its field names none
  const a = open('aegis-d2-a', 'okta:verify-group-member --absent');
  assert.equal(a.code, 1);
  assert.match(a.err, /gate aegis-d2-a .* binds no read-back/);
});
