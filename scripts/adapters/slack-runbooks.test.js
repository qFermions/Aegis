'use strict';
// slack-runbooks.test.js: structural checks on the six Slack runbooks (lane G2) that the
// shared safety-gate test (scripts/command-safety-gates.test.js) does not make. That test
// proves every portal gate has its six fields, an exact phrase that binds the target and
// an Effect whose verbs the phrase carries. This file adds the Slack-specific rules a
// fresh-context review found missing:
//
// 1. A PORTAL ACTION changes only what its gate names. No step and no "Before:" line
//    leaves a second setting to the operator's judgement ("decide whether ..."); a second
//    change gets its own gate.
//
// Reads the Markdown only: no credential, no network, no Slack call.

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const NAMES = Object.freeze([
  'slack-user-lifecycle', 'slack-security-settings', 'slack-incident-comms',
  'slack-guests-connect', 'slack-app-approval', 'slack-retention-export',
]);

function load(name) {
  const text = fs.readFileSync(path.join(ROOT, '.claude', 'commands', `${name}.md`), 'utf8').replace(/\r\n/g, '\n');
  return { name, text, lines: text.split('\n') };
}

const DOCS = new Map(NAMES.map((name) => [name, load(name)]));

// The heading of the section a line sits in ("## Phase D: ...").
function sectionAt(doc, index) {
  for (let i = index; i >= 0; i -= 1) if (/^## /.test(doc.lines[i])) return doc.lines[i];
  return '';
}

function sectionLines(doc, heading) {
  const start = doc.lines.indexOf(heading);
  if (start < 0) return [];
  let end = start + 1;
  while (end < doc.lines.length && !/^## /.test(doc.lines[end])) end += 1;
  return doc.lines.slice(start, end);
}

// A gate runs from its SAFETY GATE marker to the next marker, PREVIEW ONLY marker,
// "Role needed" line or heading. Its steps are the numbered lines after its PORTAL
// ACTION label, up to the first fence or verification checkpoint.
function parseGates(doc) {
  const gates = [];
  doc.lines.forEach((line, index) => {
    const marker = line.match(/^<!-- SAFETY GATE \[([a-z0-9-]+)\] -->$/);
    if (!marker) return;
    const id = marker[1];
    let end = index + 1;
    while (end < doc.lines.length && !/^(?:<!-- SAFETY GATE |> \*\*PREVIEW ONLY |\*\*Role needed:\*\*|#{1,6} )/.test(doc.lines[end])) end += 1;
    const region = doc.lines.slice(index, end);
    const field = (name) => {
      const found = region.find((l) => l.startsWith(`- **${name}:** `));
      return found ? found.slice(`- **${name}:** `.length) : '';
    };
    const phrase = (field('Required confirmation').match(/type exactly `([^`]+)`/i) || [])[1] || '';
    const steps = [];
    const action = region.findIndex((l) => l.startsWith(`**PORTAL ACTION [${id}]:**`));
    if (action >= 0) {
      for (let k = action + 1; k < region.length; k += 1) {
        if (/^```|^\*\*Verification checkpoint:\*\*/.test(region[k])) break;
        if (/^\d+\. /.test(region[k])) steps.push(region[k]);
      }
    }
    gates.push({
      id, line: index + 1, section: sectionAt(doc, index), region: region.join('\n'), steps, phrase,
      target: field('Target'), effect: field('Effect'), scope: field('Scope'), reversibility: field('Reversibility'),
    });
  });
  return gates;
}

const GATES = new Map(NAMES.map((name) => [name, parseGates(DOCS.get(name))]));

test('the parser finds every gate in the six Slack runbooks, each with its fields and a PORTAL ACTION step', () => {
  for (const [name, gates] of GATES) {
    const markers = (DOCS.get(name).text.match(/^<!-- SAFETY GATE \[/gm) || []).length;
    assert.ok(markers > 0, name);
    assert.equal(gates.length, markers, name);
    for (const gate of gates) {
      for (const key of ['target', 'effect', 'scope', 'reversibility', 'phrase']) assert.ok(gate[key], `${gate.id}: no ${key}`);
      assert.ok(gate.steps.length > 0, `${gate.id}: no PORTAL ACTION step`);
    }
  }
});

// ── 1. A PORTAL ACTION changes only what its gate names ─────────────────────────────
test('no PORTAL ACTION step and no Before line of a gated phase leaves a second setting to the operator', () => {
  const failures = [];
  for (const [name, gates] of GATES) {
    const doc = DOCS.get(name);
    for (const gate of gates) {
      const before = sectionLines(doc, gate.section).filter((l) => l.startsWith('**Before:**'));
      for (const line of [...gate.steps, ...before]) {
        if (/\bdecide\b/i.test(line)) failures.push(`${name} ${gate.id}: a decision inside the action: ${line}`);
        if (/\bSMS\b/.test(line) && /\bblock/i.test(line) && !/\bSMS\b/.test(gate.effect)) failures.push(`${name} ${gate.id}: changes SMS without naming it: ${line}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('slack-app-approval: the require gate leaves the request policy and the request managers as recorded; granting request management has its own R2 gate and its R1 removal', () => {
  const gates = GATES.get('slack-app-approval');
  const require = gates.find((g) => /\bREQUIRE APPROVED APPS\b/.test(g.phrase));
  assert.ok(require, 'the require gate exists');
  assert.ok(require.steps.some((s) => /request policy|who manages requests|request managers/i.test(s) && /\b(?:recorded|changes neither)\b/i.test(s)), 'the require gate keeps the request policy and managers as Phase A recorded them');
  for (const step of require.steps) assert.doesNotMatch(step, /\b(?:grant|delegate|add)\b/i, `the require gate grants nothing: ${step}`);

  const grant = gates.find((g) => /\bAPP REQUEST MANAGEMENT\b/.test(g.phrase) && /\bGRANT\b/.test(g.phrase));
  assert.ok(grant, 'a gate of its own grants app request management');
  assert.match(grant.target, /\[USER_ID\]/);
  assert.ok(grant.phrase.includes('[USER_ID]'));
  assert.match(grant.reversibility, /^R2\b/);
  const remove = gates.find((g) => /\bAPP REQUEST MANAGERS\b/.test(g.phrase) && /\bREMOVE\b/.test(g.phrase));
  assert.ok(remove, 'taking request management back has its own gate');
  assert.ok(remove.phrase.includes('[USER_ID]'));
  assert.match(remove.reversibility, /^R1\b/);
});

test('slack-security-settings: blocking SMS is its own R3 gate with the Phase A value as rollback, and the two-factor requirement leaves the methods as recorded', () => {
  const doc = DOCS.get('slack-security-settings');
  const gates = GATES.get('slack-security-settings');
  const sms = gates.filter((g) => /\bSMS\b/.test(g.effect));
  assert.equal(sms.length, 1, 'exactly one gate changes SMS');
  assert.match(sms[0].phrase, /\bBLOCK SMS\b/);
  assert.match(sms[0].reversibility, /^R3\b/);
  assert.match(sms[0].reversibility, /Phase A/);
  const require = gates.find((g) => g.id === 'slack-security-settings-2fa-require-portal');
  assert.ok(require);
  assert.doesNotMatch(require.effect, /\bSMS\b/);
  assert.ok(require.steps.some((s) => /methods as Phase A recorded/i.test(s)), 'the requirement gate keeps the allowed methods');
  const phaseA = sectionLines(doc, doc.lines.find((l) => /^## Phase A:/.test(l))).join('\n');
  assert.match(phaseA, /\bSMS\b/, 'Phase A records whether SMS is allowed');
});
