'use strict';
// runbook-exit-codes.test.js: what a runbook says a verify-* read-back's exit codes mean (batch G4,
// code review round 1, finding 1).
//
// EXPECTED DECISION (written before the runbook edits)
// - Since batch G4 (task D1) a verify-* read-back has three outcomes: exit 0 proves the change,
//   exit 2 is an answer that shows it not done (or a failed read), and exit 5 is INCONCLUSIVE, an
//   answer that proves nothing either way (scripts/adapters/README.md). Runbook stop conditions and
//   read-back comments written before D1 named exit 2 as the only not-proved or stop signal, so an
//   operator reading them could take an exit 5 for something else.
// - Every runbook line about a verify-* read-back that names exit 2 (the line names a verify-*
//   command or a read-back, or it is a comment in a fence whose next command runs a verify-*
//   read-back) also says which one exit counts, with "any exit other than 0" (or, where exit 2 is
//   the answer the step expects, "other than 2"), and names exit 5 as INCONCLUSIVE. A ticket-note
//   template (a quoted line) that records the exit a read-back gave is not such a line.
// - No such line gives exit 2 for a field that is missing or malformed: that is exit 5 now.
// - Checked over every runbook in .claude/commands, not only the lines the reviewer named; the
//   named files must each hold at least one checked line, so the check cannot pass by finding none.
// Run: node --test scripts/audit/runbook-exit-codes.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const DIR = path.join(__dirname, '..', '..', '.claude', 'commands');
const EXIT_2 = /\bexit(?:s|ed)?(?: code)? `?2`?(?![0-9])/i;
const VERIFY = /\bverify-(?:[a-z]|\*)/;
const READ_BACK = /\bread-back\b/i;
const CLIENT_VERIFY = /-client\.js verify-[a-z]/;
const SAYS_WHICH_EXIT = /\bany exit other than [02]\b/i;
const NAMES_EXIT_5 = /\bexit 5\b[^\n]{0,4}INCONCLUSIVE/;
const MISSING_AS_2 = /\bexit(?:s)? 2\b[^.:]*\b(?:missing|malformed)\b|\b(?:missing|malformed)\b[^.:]*\bexit(?:s)? 2\b/i;

// every line of every runbook that names exit 2 about a verify-* read-back: { file, line, text }
function checkedLines() {
  const found = [];
  for (const name of fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).sort()) {
    const lines = fs.readFileSync(path.join(DIR, name), 'utf8').split('\n');
    let fence = false;
    lines.forEach((text, i) => {
      if (/^\s*```/.test(text)) { fence = !fence; return; }
      // a ticket-note template (a quoted line) records the exit a read-back gave; it gives no
      // meaning to any other exit
      if (!EXIT_2.test(text) || /^\s*>/.test(text)) return;
      let about = VERIFY.test(text) || READ_BACK.test(text);
      if (!about && fence && /^\s*#/.test(text)) {
        // the command the comment sits above: the next line in the fence that is not a comment
        for (let j = i + 1; j < lines.length && !/^\s*```/.test(lines[j]); j += 1) {
          if (!lines[j].trim() || /^\s*#/.test(lines[j])) continue;
          about = CLIENT_VERIFY.test(lines[j]);
          break;
        }
      }
      if (about) found.push({ file: name, line: i + 1, text });
    });
  }
  return found;
}

const NAMED = ['jamf-patch-management.md', 'jamf-filevault.md', 'slack-guests-connect.md', 'slack-app-approval.md', 'github-repo-access.md', 'jira-create.md', 'jira-update.md', 'jamf-policies-self-service.md'];

test('F1: the check finds the lines the reviewer named, in every named runbook', () => {
  const files = new Set(checkedLines().map((l) => l.file));
  for (const name of NAMED) assert.ok(files.has(name), `${name}: no line naming exit 2 about a verify-* read-back was found`);
});

test('F1: every runbook line that names exit 2 for a verify-* read-back says any other exit is not a pass and names exit 5 as INCONCLUSIVE', () => {
  const stale = checkedLines().filter((l) => !SAYS_WHICH_EXIT.test(l.text) || !NAMES_EXIT_5.test(l.text));
  assert.deepEqual(stale.map((l) => `${l.file}:${l.line}: ${l.text.trim().slice(0, 160)}`), [],
    'name the one exit that counts ("any exit other than 0 ...") and exit 5 INCONCLUSIVE, proves nothing either way, beside exit 2');
});

test('F1: no runbook line gives exit 2 for a read-back field that is missing or malformed (exit 5 since D1)', () => {
  const stale = checkedLines().filter((l) => MISSING_AS_2.test(l.text));
  assert.deepEqual(stale.map((l) => `${l.file}:${l.line}: ${l.text.trim().slice(0, 160)}`), []);
});
