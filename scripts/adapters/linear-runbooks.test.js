'use strict';
// linear-runbooks.test.js: the four Linear runbooks (.claude/commands/linear-*.md) against
// the R0 to R3 ladder (CLAUDE.md) and against the read-only Linear adapter they call.
//
// Contract: PRODUCT_CONTRACT.md (AEGIS ADVISES; HUMANS EXECUTE PRODUCTION CHANGES), the
// gate grammar in docs/security/COMMAND_RISK_METADATA.md (checked for every runbook by
// scripts/command-safety-gates.test.js) and the Linear section of docs/aegis/lanes/g2.md.
// This file adds the Linear-specific rules that the shared grammar does not state.
//
// EXPECTED DECISION
// 1. Every delete is R3. A gate whose Effect deletes something is classed R3 and names
//    its written rollback path, and its PORTAL ACTION waits for that path to be in the
//    ticket. No heading or fast-path line labels a delete with a lower class.
// 2. Every phrase names what changes. A gate's Target and its exact phrase bind the
//    same placeholders; a gate that sets a priority names [PRIORITY_LEVEL], a snooze
//    names [DATE_TIME], and a gate that edits or deletes one comment names
//    [COMMENT_ID]. A priority-only correction (triage Phase E) goes through a gate whose
//    Effect changes the priority and nothing else.
//
// Nothing here reads a credential or opens a socket: the runbooks are files on disk.

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const RUNBOOKS = ['linear-intake', 'linear-ticket-note', 'linear-triage', 'linear-workspace-admin'];
const text = Object.fromEntries(RUNBOOKS.map((name) => [name, fs.readFileSync(path.join(ROOT, '.claude', 'commands', `${name}.md`), 'utf8')]));

// Each SAFETY GATE with its fields and the region it owns (up to the next gate, preview
// marker or heading), as command-safety-gates.test.js bounds a portal gate.
function gates(name) {
  const lines = text[name].split('\n');
  const out = [];
  lines.forEach((line, index) => {
    const marker = line.match(/^<!-- SAFETY GATE \[([\w-]+)\] -->$/);
    if (!marker) return;
    let end = index + 1;
    while (end < lines.length && !/^(?:<!-- SAFETY GATE|>\s*\*\*PREVIEW ONLY|#{1,6}\s)/.test(lines[end])) end += 1;
    const region = lines.slice(index, end).join('\n');
    const field = (label) => (region.match(new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.+)$`, 'm')) || [])[1] || '';
    out.push({
      file: name, id: marker[1], line: index + 1, region,
      target: field('Target'), effect: field('Effect'), scope: field('Scope'), reversibility: field('Reversibility'),
      phrase: (field('Required confirmation').match(/Type exactly `([^`]+)`/) || [])[1] || '',
      action: (region.match(new RegExp(`^\\*\\*PORTAL ACTION \\[${marker[1]}\\]:\\*\\*\\s*(.+)$`, 'm')) || [])[1] || '',
    });
  });
  return out;
}
const ALL_GATES = RUNBOOKS.flatMap(gates);

test('the four runbooks carry the gates this file judges', () => {
  assert.ok(ALL_GATES.length >= 14, `found ${ALL_GATES.length} gates`);
  for (const g of ALL_GATES) {
    assert.ok(g.target && g.effect && g.reversibility && g.phrase && g.action, `${g.id}: every field and the PORTAL ACTION are present`);
  }
});

test('every delete is R3: its gate names the written rollback path, the action waits for it, and no line labels a delete lower', () => {
  const deletes = ALL_GATES.filter((g) => /^delete\b/i.test(g.effect));
  assert.deepEqual(deletes.map((g) => g.id).sort(), [
    'linear-ticket-note-delete-portal', 'linear-workspace-admin-bulk-delete-portal', 'linear-workspace-admin-delete-portal',
  ]);
  for (const g of deletes) {
    assert.match(g.reversibility, /^R3\b/, `${g.id}: a delete is R3 (CLAUDE.md: wipe, delete, disable)`);
    assert.match(g.region, /written rollback path/i, `${g.id}: names its written rollback path`);
    assert.match(g.action, /written rollback path[^:]*in the ticket/i, `${g.id}: the action waits for the rollback path to be in the ticket`);
  }
  const lower = [];
  for (const name of RUNBOOKS) {
    text[name].split('\n').forEach((line, index) => {
      for (const m of line.matchAll(/\bdelet\w*\b[^()\n]*\((R[0-3])\b/gi)) {
        if (m[1] !== 'R3') lower.push(`${name}.md:${index + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(lower, [], 'a heading or fast-path line labels a delete below R3');
});

const tokens = (value) => [...new Set(value.match(/\[[A-Za-z0-9_@.,-]+\]/g) || [])].sort();
const section = (name, heading) => {
  const start = text[name].indexOf(`\n## ${heading}`);
  assert.ok(start >= 0, `${name}: no "## ${heading}" section`);
  const end = text[name].indexOf('\n## ', start + 4);
  return text[name].slice(start, end < 0 ? undefined : end);
};

test('every gate phrase names the value or the comment it changes, and its Target binds the same placeholders', () => {
  const problems = [];
  for (const g of ALL_GATES) {
    if (JSON.stringify(tokens(g.target)) !== JSON.stringify(tokens(g.phrase))) problems.push(`${g.id}: Target ${tokens(g.target).join(' ')} but phrase ${tokens(g.phrase).join(' ')}`);
    if (/\bpriority\b/i.test(g.effect) && !g.phrase.includes('[PRIORITY_LEVEL]')) problems.push(`${g.id}: sets a priority, phrase names no [PRIORITY_LEVEL]`);
    if (/\bsnooze\b/i.test(g.effect) && !g.phrase.includes('[DATE_TIME]')) problems.push(`${g.id}: sets a snooze, phrase names no [DATE_TIME]`);
    if (/^(?:replace|delete)\b[^;]*\b(?:comment|copy)\b/i.test(g.effect) && !g.phrase.includes('[COMMENT_ID]')) problems.push(`${g.id}: edits or deletes one comment, phrase names no [COMMENT_ID]`);
  }
  assert.deepEqual(problems, []);
  const byId = Object.fromEntries(ALL_GATES.map((g) => [g.id, g]));
  assert.equal(byId['linear-triage-fields-portal'].phrase, 'SET PRIORITY [PRIORITY_LEVEL] AND ADD LABEL [LABEL_NAME] ON [ISSUE_ID]');
  assert.equal(byId['linear-intake-label-priority-portal'].phrase, 'SET PRIORITY [PRIORITY_LEVEL] AND ADD LABEL [LABEL_NAME] ON [ISSUE_ID]');
  assert.equal(byId['linear-triage-snooze-portal'].phrase, 'SET SNOOZE ON [ISSUE_ID] UNTIL [DATE_TIME]');
  assert.equal(byId['linear-ticket-note-replace-portal'].phrase, 'REPLACE TEXT OF COMMENT [COMMENT_ID] ON [ISSUE_ID] WITH [NOTE_SHA256]');
  assert.equal(byId['linear-ticket-note-delete-portal'].phrase, 'DELETE NOTE COPY [COMMENT_ID] ON [ISSUE_ID]');
});

test('triage Phase E corrects a wrong priority under a gate that changes the priority and nothing else', () => {
  const g = ALL_GATES.find((x) => x.id === 'linear-triage-priority-portal');
  assert.ok(g, 'linear-triage-priority-portal exists');
  assert.equal(g.phrase, 'SET PRIORITY [PRIORITY_LEVEL] ON [ISSUE_ID]');
  assert.ok(!/\blabel\b/i.test(g.effect), 'the priority-only gate changes no label');
  assert.match(g.reversibility, /^R1\b/);
  const phaseE = section('linear-triage', 'Phase E');
  assert.ok(phaseE.includes('<!-- SAFETY GATE [linear-triage-priority-portal] -->'), 'the gate sits in Phase E');
  assert.match(phaseE, /wrong priority goes through the priority-only gate/);
  assert.ok(!/fields gate/i.test(phaseE), 'Phase E no longer sends a priority-only change to the fields gate, which adds a label');
});
