'use strict';
// time-bound-capture.test.js: a runbook takes the time bound of a change-bound read-back at or
// after the change's approval (batch G4, code review round 2, finding 9).
//
// EXPECTED DECISION (written before the fix)
// - A read-back line run with --change [CHANGE_ID] and a time bound (--not-before [NOT_BEFORE], or
//   any flag audit-log.js PASS_FLAGS declares a time bound) proves its change only when the bound
//   is at or after the change's approval; an earlier bound is refused before the read (round 1,
//   finding 4). The change is opened and approved before its gate, so a bound written down before
//   the gate, or at "the time the work started", is earlier than the approval and the read-back is
//   always refused.
// - So for every such line in every runbook in .claude/commands, the nearest instruction above it
//   that says when its placeholder is taken must either name approved_at (the time
//   change-record.js approve prints), or be a step of a PORTAL ACTION block (taken while the person
//   makes the change, after the gate's confirmation, which follows the approval). A runbook with
//   no such instruction above the line fails too.
// - An instruction that says when a placeholder is taken: a line that is not a command, holding
//   the placeholder after "as" in a sentence that takes, uses, writes or records a value ("Write
//   the current time ... as [NOT_BEFORE]"), after "write down", before "written", or defining it
//   as a time ("[NOT_BEFORE] (the UTC time ..."). Lines run without --change are not checked:
//   they have no approval to follow.
// Run: node --test scripts/audit/time-bound-capture.test.js

require('../adapters/socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const audit = require('./audit-log.js');
const changes = require('./change-record.js');

const COMMANDS = path.resolve(__dirname, '..', '..', '.claude', 'commands');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// the sentence of line that says when placeholder p is taken, or null
function captureIn(line, p) {
  if (!line.includes(p)) return null;
  const q = `\`?${escape(p)}\`?`;
  const forms = [
    new RegExp(`\\b(?:take|takes|taken|use|uses|write|writes|record|records|note)\\b[^.;]*?\\bas\\s+${q}`, 'i'),
    new RegExp(`\\bwrite down\\s+${q}`, 'i'),
    new RegExp(`${q}\\s+written\\b`, 'i'),
    new RegExp(`${q}\\s+\\((?:the\\s+)?(?:UTC\\s+)?time\\b`, 'i'),
  ];
  for (const sentence of line.split(/(?<=\.)\s+/)) {
    if (sentence.includes(p) && forms.some((f) => f.test(sentence))) return sentence;
  }
  return null;
}

// What breaks the ordering in one runbook, one sentence each.
function captureProblems(text) {
  const lines = text.split('\n');
  // the lines of each PORTAL ACTION block: from its line to the first blank line
  const portal = new Set();
  let inPortal = false;
  lines.forEach((l, i) => {
    if (/^\*\*PORTAL ACTION \[/.test(l)) inPortal = true;
    else if (!l.trim()) inPortal = false;
    if (inPortal) portal.add(i);
  });
  const isCommand = (l) => /^\s*node scripts\//.test(l) || /^- \*\*Read-back:\*\*/.test(l) || /^#\s*Read-back:/.test(l);
  const problems = [];
  const checked = [];
  for (const b of changes.boundReadBacks(text)) {
    const rules = audit.PASS_FLAGS[b.kind] || {};
    for (let i = 1; i < b.argv.length; i += 1) {
      const name = b.argv[i].startsWith('--') ? b.argv[i].slice(2) : null;
      if (!name || rules[name] !== audit.TIME) continue;
      const p = b.argv[i + 1];
      if (!/^\[[A-Z0-9_]+\]$/.test(p || '')) { problems.push(`line ${b.line}: --${name} takes ${p}, not a placeholder whose capture can be checked`); continue; }
      checked.push({ line: b.line, flag: name, p });
      let found = null;
      for (let j = b.line - 2; j >= 0 && !found; j -= 1) {
        if (isCommand(lines[j])) continue;
        const sentence = captureIn(lines[j], p);
        if (sentence) found = { at: j, sentence };
      }
      if (!found) { problems.push(`line ${b.line}: --${name} ${p} on a line run with --change, but no line above it says when ${p} is taken; take it as the approved_at that change-record.js approve prints`); continue; }
      if (/approved_at/.test(found.sentence) || portal.has(found.at)) continue;
      problems.push(`line ${b.line}: --${name} ${p} on a line run with --change is taken at line ${found.at + 1} ("${found.sentence.slice(0, 140)}"), which is not at or after the change's approval: the bound is refused before the read; take it as the approved_at that change-record.js approve prints, or as a step of the change itself`);
    }
  }
  return { problems, checked };
}

// whether a runbook gets its own test below
const selected = (text) => captureProblems(text).checked.length > 0;

const runbooks = fs.readdirSync(COMMANDS).filter((f) => f.endsWith('.md')).sort();
const withTimed = runbooks.filter((f) => selected(fs.readFileSync(path.join(COMMANDS, f), 'utf8')));

test('F9: the check finds the change-bound read-backs with a time bound (it is not vacuous)', () => {
  const lines = withTimed.reduce((n, f) => n + captureProblems(fs.readFileSync(path.join(COMMANDS, f), 'utf8')).checked.length, 0);
  assert.ok(withTimed.length >= 8, `runbooks with such a line: ${withTimed.join(', ')}`);
  assert.ok(lines >= 13, `such lines: ${lines}`);
});

test('F9: the check refuses a bound taken before the gate, at the start of the work, or nowhere, and accepts approved_at or a step of the change', () => {
  const run = 'node scripts/adapters/msgraph-client.js verify-sessions-revoked --user [USER_ID] --not-before [NOT_BEFORE] --change [CHANGE_ID] --execute';
  const gate = (field) => `<!-- SAFETY GATE [t-revoke-portal] -->\n- **Reversibility:** R2 (test)\n- **Read-back:** \`${field}\``;
  const field = run.replace(/^node scripts\/adapters\//, '');
  const doc = (before, portalStep = '1. Click **Revoke**.') => `# t\n\n${before}\n\n${gate(field)}\n**PORTAL ACTION [t-revoke-portal]:** Only after the exact match:\n${portalStep}\n\n\`\`\`bash\n${run}\n\`\`\`\n`;
  assert.equal(captureProblems(doc('Write down `[NOT_BEFORE]` now.')).problems.length, 1, 'written down before the gate');
  assert.equal(captureProblems(doc('Use the time the work started as `[NOT_BEFORE]` (UTC).')).problems.length, 1, 'the start of the work');
  assert.equal(captureProblems(doc('Write the current time (UTC, ISO 8601) in the ticket as `[NOT_BEFORE]` just before the change.')).problems.length, 1, 'just before the change, above the gate');
  assert.equal(captureProblems(doc('Nothing here.')).problems.length, 1, 'taken nowhere');
  assert.deepEqual(captureProblems(doc('Take as `[NOT_BEFORE]` the `approved_at` that `change-record.js approve` prints.')).problems, [], 'approved_at');
  assert.deepEqual(captureProblems(doc('Write down `[NOT_BEFORE]` now.', '1. Click **Revoke**. Write the save time as `[NOT_BEFORE]`.')).problems, [], 'a step of the change');
});

// Code review round 3 of batch G4, finding 5: (a) a runbook whose change-bound time flags all
// take a literal value got no test of its own, so its "not a placeholder" problem could never
// fail; every runbook with a change-bound time flag gets one. (b) Any sentence that merely held
// the word approved_at passed; only a sentence that says to take or use the approved_at does (the
// forms the runbooks use: "take as [NOT_BEFORE] the approved_at that ...", "use the approved_at
// ... as [NOT_BEFORE]", or a definition "[NOT_BEFORE] (the time ...: the approved_at that ...").
test('round 3 F5: a runbook whose change-bound time flags all take a literal value is selected for its own test, and fails it', () => {
  const run = 'node scripts/adapters/msgraph-client.js verify-sessions-revoked --user [USER_ID] --not-before 2026-10-28T09:00:00Z --change [CHANGE_ID] --execute';
  const doc = `# t\n\n<!-- SAFETY GATE [t-revoke-portal] -->\n- **Reversibility:** R2 (test)\n- **Read-back:** \`${run.replace(/^node scripts\/adapters\//, '')}\`\n\n\`\`\`bash\n${run}\n\`\`\`\n`;
  assert.equal(captureProblems(doc).problems.length, 1, 'the literal is a problem');
  assert.equal(selected(doc), true, 'the runbook gets its own test');
});

test('round 3 F5: a sentence that holds approved_at without saying to take or use it is refused; the forms the runbooks use are accepted', () => {
  const run = 'node scripts/adapters/msgraph-client.js verify-sessions-revoked --user [USER_ID] --not-before [NOT_BEFORE] --change [CHANGE_ID] --execute';
  const field = run.replace(/^node scripts\/adapters\//, '');
  const doc = (before) => `# t\n\n${before}\n\n<!-- SAFETY GATE [t-revoke-portal] -->\n- **Reversibility:** R2 (test)\n- **Read-back:** \`${field}\`\n**PORTAL ACTION [t-revoke-portal]:** Only after the exact match:\n1. Click **Revoke**.\n\n\`\`\`bash\n${run}\n\`\`\`\n`;
  const refused = [
    'Take as `[NOT_BEFORE]` the time the work started, not the `approved_at` that `change-record.js approve` prints.',
    'Use the time the work started as `[NOT_BEFORE]`; the `approved_at` comes later.',
    'Write down `[NOT_BEFORE]` now, before the approved_at exists.',
    '`[NOT_BEFORE]` (the time the work started, not the `approved_at` that `change-record.js approve` prints).',
  ];
  for (const s of refused) assert.equal(captureProblems(doc(s)).problems.length, 1, s);
  const accepted = [
    'Take as `[NOT_BEFORE]` the `approved_at` that `change-record.js approve` prints for this gate\'s change, and write it in the ticket.',
    'For a read-back run with `--change [CHANGE_ID]`, take as `[NOT_BEFORE]` the `approved_at` that `change-record.js approve` printed for that read-back\'s change.',
    'Use the `approved_at` that `change-record.js approve` printed as `[NOT_BEFORE]`.',
    '`[NOT_BEFORE]` (the UTC time, ISO 8601, every read-back starts from: under a change record, the `approved_at` that `change-record.js approve` prints; otherwise the time you write down just before a change).',
    '`[NOT_BEFORE]` (the time a read-back starts from: for one run with `--change [CHANGE_ID]`, the `approved_at` that `change-record.js approve` printed for that change).',
  ];
  for (const s of accepted) assert.deepEqual(captureProblems(doc(s)).problems, [], s);
});

for (const f of withTimed) {
  test(`F9: ${f} takes the time bound of each change-bound read-back at or after the approval`, () => {
    const { problems } = captureProblems(fs.readFileSync(path.join(COMMANDS, f), 'utf8'));
    assert.deepEqual(problems, [], `${f}:\n${problems.join('\n')}`);
  });
}
