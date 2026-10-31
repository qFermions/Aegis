'use strict';
require('../../adapters/socket-tripwire.js');
// cases.test.js: the judged-eval case schema (capability row 26, B1).
//
// EXPECTED DECISION (written before the module)
// - A case file is JSONL; blank lines are skipped. Every field is required; an unknown field
//   at the top level or inside expected is refused with its line number and field name.
// - Enums (platform, capability, class, probe, escalate, change_class), types, maximum
//   lengths, a non-empty must list, unique ids (short tokens) are enforced.
// - Invalid JSON is refused with its line number, and no refusal echoes the line's text.
// - The DEV set has exactly 8 cases DEV01..DEV08 covering several platforms, a CLARIFY
//   case, an injection probe, an R3 change and a non-empty follow_up.
// Run: node --test scripts/eval/judged/cases.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const cases = require('./cases.js');

const DEV = path.join(__dirname, 'dev-cases.jsonl');

function good(over = {}, expectedOver = {}) {
  return {
    id: 'C1', platform: 'microsoft', capability: 'it-support', scenario: 'unit', class: 'QUICK_FIX',
    ticket: 'A ticket for [UPN].', evidence: '', follow_up: '', probe: '',
    expected: { first_move: 'Do the likely thing.', must: ['Item one.'], must_not: [], escalate: 'no', change_class: 'R1', read_back: '', ...expectedOver },
    judge_notes: '', ...over,
  };
}
const line = (o) => JSON.stringify(o);

function refusal(text) {
  try { cases.parseCases(text); } catch (e) {
    assert.ok(e instanceof cases.CaseFileError, e.message);
    return e.errors;
  }
  assert.fail('the case file was accepted');
}

test('a valid file parses; blank lines are skipped and line numbers are kept', () => {
  const r = cases.parseCases(`\n${line(good())}\n\n${line(good({ id: 'C2' }))}\n`);
  assert.deepEqual(r.cases.map((c) => [c.id, c.line]), [['C1', 2], ['C2', 4]]);
});

test('an unknown top-level field and an unknown field inside expected are refused with line and name', () => {
  const top = refusal(line({ ...good(), extra: 1 }));
  assert.deepEqual(top, ['line 1: unknown field extra']);
  const nested = refusal(`${line(good())}\n${line(good({ id: 'C2' }, { surprise: true }))}`);
  assert.deepEqual(nested, ['line 2: unknown field expected.surprise']);
  const odd = refusal(line({ ...good(), 'bad name with spaces': 1 }));
  assert.match(odd[0], /line 1: unknown field \(a field name that is not a short token\)/);
});

test('a missing field is refused, at the top level and inside expected', () => {
  const o = good();
  delete o.follow_up;
  assert.deepEqual(refusal(line(o)), ['line 1: missing field follow_up']);
  const e = good();
  delete e.expected.read_back;
  assert.deepEqual(refusal(line(e)), ['line 1: missing field expected.read_back']);
});

test('a bad enum value is refused without echoing the value', () => {
  for (const [over, exp, field] of [
    [{ platform: 'mainframe-secret' }, {}, 'platform'],
    [{ capability: 'cooking' }, {}, 'capability'],
    [{ class: 'QUICK' }, {}, 'class'],
    [{ probe: 'jailbreak' }, {}, 'probe'],
    [{}, { escalate: 'maybe' }, 'expected.escalate'],
    [{}, { change_class: 'R4' }, 'expected.change_class'],
  ]) {
    const errs = refusal(line(good(over, exp)));
    assert.equal(errs.length, 1, field);
    assert.match(errs[0], new RegExp(`^line 1: field ${field.replace('.', '\\.')} is not one of: `), field);
    assert.doesNotMatch(errs[0], /mainframe-secret|cooking|jailbreak|maybe|R4\b/, 'the value is never echoed');
  }
});

test('a duplicate id is refused with both line numbers', () => {
  assert.deepEqual(refusal(`${line(good())}\n${line(good())}`), ['line 2: duplicate id C1 (first on line 1)']);
});

test('a wrong type is refused: string fields, arrays, items, the expected object, a non-object line', () => {
  assert.deepEqual(refusal(line(good({ ticket: 42 }))), ['line 1: field ticket must be a string']);
  assert.deepEqual(refusal(line(good({}, { must: 'one' }))), ['line 1: field expected.must must be an array of strings']);
  assert.deepEqual(refusal(line(good({}, { must: [] }))), ['line 1: field expected.must must hold at least one item']);
  assert.deepEqual(refusal(line(good({}, { must_not: ['ok', 7] }))), ['line 1: field expected.must_not[1] must be a string']);
  assert.deepEqual(refusal(line(good({ expected: ['x'] }))), ['line 1: field expected must be a JSON object']);
  assert.deepEqual(refusal('[1,2,3]'), ['line 1: a case must be a JSON object']);
  assert.deepEqual(refusal('null'), ['line 1: a case must be a JSON object']);
  assert.deepEqual(refusal(line(good({ id: 'has space' }))), ['line 1: field id has characters outside its allowed set']);
  assert.deepEqual(refusal(line(good({ ticket: '   ' }))), ['line 1: field ticket must not be empty']);
  assert.deepEqual(refusal(line(good({ ticket: 'x'.repeat(cases.LIMITS.ticket + 1) }))), [`line 1: field ticket is longer than ${cases.LIMITS.ticket} characters`]);
});

test('invalid JSON is refused with its line number and never echoes the line text', () => {
  const secret = '{"id": "C9", "ticket": "SECRET-TICKET-TEXT", ';
  const errs = refusal(`${line(good())}\n${secret}`);
  assert.deepEqual(errs, ['line 2: invalid JSON']);
  try { cases.parseCases(secret); } catch (e) { assert.doesNotMatch(e.message, /SECRET-TICKET-TEXT/); }
  assert.deepEqual(refusal('\n\n'), ['the case file holds no cases']);
});

test('the DEV set: 8 placeholder-only cases DEV01..DEV08 with the required coverage', () => {
  const { cases: dev } = cases.readCaseFile(DEV);
  assert.deepEqual(dev.map((c) => c.id), ['DEV01', 'DEV02', 'DEV03', 'DEV04', 'DEV05', 'DEV06', 'DEV07', 'DEV08']);
  assert.ok(dev.every((c) => c.id.includes('DEV')));
  assert.ok(new Set(dev.map((c) => c.platform)).size >= 5, 'several platforms');
  assert.ok(dev.some((c) => c.class === 'CLARIFY'));
  assert.ok(dev.some((c) => c.probe === 'injection'));
  assert.ok(dev.some((c) => c.expected.change_class === 'R3'));
  assert.ok(dev.some((c) => c.follow_up !== ''));
  const text = fs.readFileSync(DEV, 'utf8');
  assert.doesNotMatch(text, /[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}/, 'no email shape');
  assert.doesNotMatch(text, /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/, 'no phone shape');
  const dictionary = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'modules', 'security', 'placeholder-dictionary.md'), 'utf8');
  for (const token of new Set(text.match(/\[[A-Z@][A-Za-z0-9_@#-]*\]/g) || [])) assert.ok(dictionary.includes(`\`${token}\``), `${token} is a dictionary placeholder`);
});
