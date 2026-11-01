'use strict';
// runbook-change-examples.test.js: the read-back a runbook tells the operator to name at open is one
// open accepts (batch G4, code review round 1, finding 5).
//
// EXPECTED DECISION (written before the runbook edits)
// - change-record.js open accepts a --read-back only in the form a bound line of the gate runs it:
//   the same pass flags (sameForm), a time bound named bare. Batch G4 made --not-before a pass flag
//   (task A3), and change-record paragraphs written before it still gave examples without it, such
//   as msgraph:verify-sessions-revoked in /mfa-issue, which open now refuses. Some first mentions
//   ("as --read-back, such as connector:verify-...") named a read-back bare whose every line in
//   that runbook runs with a pass flag (--expect, --role, --status), which open refuses too.
// - Every connector:verify-* read-back a runbook writes in backticks is checked against the lines
//   that runbook binds with --change [CHANGE_ID], as sameForm compares them: some line of its kind
//   must run in its form, a placeholder value ([N]) standing for any value its rule takes on
//   either side. The one exception is the shared sentence that illustrates a time bound with
//   msgraph:verify-sessions-revoked --not-before in every runbook that binds one, whatever its
//   connector (pass-flags.test.js holds that sentence in place).
// - Checked over every runbook in .claude/commands, not only the four the reviewer named; the
//   check must find examples in each of those four, so it cannot pass by finding none.
// Run: node --test scripts/audit/runbook-change-examples.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const audit = require('./audit-log.js');
const changes = require('./change-record.js');

const DIR = path.join(__dirname, '..', '..', '.claude', 'commands');
const CONNECTORS = 'fleet|github|google-workspace|jamf|linear|msgraph|okta|slack|jira';
const EXAMPLE = new RegExp(`\`(?:--read-back )?'?((?:${CONNECTORS}):verify-[a-z0-9-]+(?: --?[a-z0-9-]+(?: (?:"[^"\`]*"|[^\`' -][^\`' ]*))?)*)'?\``, 'g');
const TIME_ILLUSTRATION = 'is named with it and no value, such as `msgraph:verify-sessions-revoked --not-before`';
const PLACEHOLDER = /^\[[^\]]+\]$/;
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// An example as open reads its --read-back, where a placeholder value stands for the value the
// operator fills in: { kind, values } for sameForm, or { problem } when open would refuse it whatever
// the placeholder holds (a flag that is not a pass flag, a time bound with a value, a value outside
// its rule).
function parseExample(text) {
  const [kind, ...rest] = text.match(/"[^"]*"|\S+/g);
  const rules = audit.PASS_FLAGS[kind];
  const values = new Map();
  if (rest.length && !rules) return { problem: `no flag changes what ${kind}'s pass means` };
  for (let i = 0; i < rest.length; i += 1) {
    const name = rest[i].replace(/^--/, '');
    if (!rest[i].startsWith('--') || !hasOwn(rules, name)) return { problem: `${rest[i]} is not a pass flag of ${kind}` };
    if (rules[name] === audit.SWITCH) { values.set(name, null); continue; }
    const next = rest[i + 1];
    if (rules[name] === audit.TIME) {
      if (next !== undefined && !next.startsWith('--')) return { problem: `--${name} is a time bound, named without its value` };
      values.set(name, null);
      continue;
    }
    if (next === undefined || next.startsWith('--')) return { problem: `--${name} needs a value` };
    const value = next.replace(/^"|"$/g, '');
    if (!PLACEHOLDER.test(value) && !rules[name].test(rules[name] === audit.DIGEST ? value.toLowerCase() : value)) return { problem: `--${name} ${value} is outside its rule` };
    values.set(name, value);
    i += 1;
  }
  return { kind, values };
}

// every example in every runbook: { file, line, example, problem } (problem null when open accepts it)
function examples() {
  const found = [];
  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).sort()) {
    const text = fs.readFileSync(path.join(DIR, file), 'utf8');
    const bound = changes.boundReadBacks(text);
    text.split('\n').forEach((l, i) => {
      for (const m of l.matchAll(EXAMPLE)) {
        if (l.slice(Math.max(0, m.index - TIME_ILLUSTRATION.length + m[0].length), m.index + m[0].length) === TIME_ILLUSTRATION) continue;
        const parsed = parseExample(m[1]);
        let problem = parsed.problem || null;
        if (!problem) {
          const lines = bound.filter((b) => b.kind === parsed.kind);
          if (!lines.length) problem = `no line of this runbook runs ${parsed.kind} with --change [CHANGE_ID]`;
          else if (hasOwn(audit.PASS_FLAGS, parsed.kind) && !lines.some((b) => changes.sameForm(parsed, b))) {
            problem = `open refuses it: the lines run ${[...new Set(lines.map((b) => b.command.replace(/^node scripts\/(?:adapters\/)?/, '').replace(/ --change \[CHANGE_ID\] --execute$/, '')))].join(' or ')}`;
          }
        }
        found.push({ file, line: i + 1, example: m[1], problem });
      }
    });
  }
  return found;
}

const NAMED = ['mfa-issue.md', 'gws-account-containment.md', 'gws-admin-roles.md', 'gws-drive-sharing.md'];

test('F5: the check finds read-back examples in each runbook the reviewer named', () => {
  const files = new Set(examples().map((e) => e.file));
  for (const name of NAMED) assert.ok(files.has(name), `${name}: no read-back example found`);
});

test('F5: every read-back a runbook names in backticks is one change-record.js open accepts for a line of that runbook', () => {
  const stale = examples().filter((e) => e.problem).map((e) => `${e.file}:${e.line}: ${e.example}: ${e.problem}`);
  assert.deepEqual(stale, [], 'name the read-back with the pass flags its line runs, a time bound bare');
});

test('F5: the example parser reads the forms open takes and refuses the ones it refuses', () => {
  assert.deepEqual([...parseExample('msgraph:verify-sessions-revoked --not-before').values], [['not-before', null]]);
  assert.deepEqual([...parseExample('github:verify-protection --enforce-admins --reviews [N]').values], [['enforce-admins', null], ['reviews', '[N]']]);
  assert.match(parseExample('msgraph:verify-sessions-revoked --not-before 2026-10-28T09:00:00Z').problem, /time bound/);
  assert.match(parseExample('okta:verify-group-member --user [OKTA_USER_ID]').problem, /not a pass flag/);
  assert.match(parseExample('okta:verify-status --status [STATUS] --absent').problem, /not a pass flag/);
});
