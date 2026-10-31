'use strict';
// cases.js: reads and validates a judged-eval case file (capability row 26).
//
// A case file is JSONL: one JSON object per line, blank lines skipped. Every field is
// required, and an unknown field at the top level or inside `expected` is refused with
// its line number and field name. Every string is data: its type and length are checked,
// and no refusal ever echoes a line's text or a field's value (only the line number, the
// field name, and the id once the id itself has been checked as a short token).
//
// parseCases(text) returns { cases } or throws CaseFileError with every problem found
// (up to MAX_ERRORS). readCaseFile(file) reads the file with a size cap first.

const fs = require('node:fs');

const ENUMS = Object.freeze({
  platform: ['microsoft', 'google', 'okta', 'jamf', 'fleet', 'slack', 'linear', 'github', 'jira', 'network', 'platform-neutral'],
  capability: ['it-support', 'security', 'platform-engineering', 'agent-strategy', 'agent-ops'],
  class: ['QUICK_FIX', 'DIAGNOSTIC', 'PROCEDURE', 'REFERENCE', 'CLARIFY'],
  probe: ['', 'injection', 'urgency', 'wrong-customer', 'stale-procedure', 'missing-privilege'],
  escalate: ['yes', 'no'],
  change_class: ['R0', 'R1', 'R2', 'R3', 'none'],
});

const TOP_FIELDS = Object.freeze(['id', 'platform', 'capability', 'scenario', 'class', 'ticket', 'evidence', 'follow_up', 'probe', 'expected', 'judge_notes']);
const EXPECTED_FIELDS = Object.freeze(['first_move', 'must', 'must_not', 'escalate', 'change_class', 'read_back']);

// Maximum lengths in characters. A ticket and its evidence each fit in one argument of a
// child process (the backend also checks the built prompt's byte size).
const LIMITS = Object.freeze({
  id: 40,
  scenario: 80,
  ticket: 20000,
  evidence: 20000,
  follow_up: 4000,
  judge_notes: 4000,
  first_move: 1000,
  read_back: 1000,
  item: 500,
  items: 20,
});
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_CASES = 1000;
const MAX_ERRORS = 50;

const ID_RE = /^[A-Za-z0-9_-]+$/;
const SCENARIO_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/;
const FIELD_NAME_RE = /^[A-Za-z0-9_]{1,40}$/;

class CaseFileError extends Error {
  constructor(errors) {
    super(`case file refused: ${errors.length} problem(s)\n${errors.map((e) => `  ${e}`).join('\n')}`);
    this.name = 'CaseFileError';
    this.errors = errors;
  }
}

// A field name from the file is data too: show it only when it is a short token.
function shownName(name) {
  return FIELD_NAME_RE.test(name) ? name : '(a field name that is not a short token)';
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function checkString(errs, line, field, value, { max, nonEmpty = false, pattern = null }) {
  if (typeof value !== 'string') { errs.push(`line ${line}: field ${field} must be a string`); return false; }
  if (value.length > max) { errs.push(`line ${line}: field ${field} is longer than ${max} characters`); return false; }
  if (nonEmpty && value.trim() === '') { errs.push(`line ${line}: field ${field} must not be empty`); return false; }
  if (pattern && !pattern.test(value)) { errs.push(`line ${line}: field ${field} has characters outside its allowed set`); return false; }
  return true;
}

function checkEnum(errs, line, field, value) {
  if (typeof value !== 'string') { errs.push(`line ${line}: field ${field} must be a string`); return; }
  if (!ENUMS[field.replace(/^expected\./, '')].includes(value)) {
    errs.push(`line ${line}: field ${field} is not one of: ${ENUMS[field.replace(/^expected\./, '')].map((v) => (v === '' ? '""' : v)).join(', ')}`);
  }
}

function checkItems(errs, line, field, value, nonEmpty) {
  if (!Array.isArray(value)) { errs.push(`line ${line}: field ${field} must be an array of strings`); return; }
  if (nonEmpty && value.length === 0) { errs.push(`line ${line}: field ${field} must hold at least one item`); return; }
  if (value.length > LIMITS.items) { errs.push(`line ${line}: field ${field} holds more than ${LIMITS.items} items`); return; }
  value.forEach((item, i) => checkString(errs, line, `${field}[${i}]`, item, { max: LIMITS.item, nonEmpty: true }));
}

function checkFields(errs, line, obj, allowed, prefix) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) errs.push(`line ${line}: unknown field ${prefix}${shownName(key)}`);
  }
  let complete = true;
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) { errs.push(`line ${line}: missing field ${prefix}${key}`); complete = false; }
  }
  return complete;
}

// Validates one parsed line; pushes problems into errs and returns the case or null.
function validateCase(obj, line, errs) {
  const before = errs.length;
  if (!isPlainObject(obj)) { errs.push(`line ${line}: a case must be a JSON object`); return null; }
  if (!checkFields(errs, line, obj, TOP_FIELDS, '')) return null;
  checkString(errs, line, 'id', obj.id, { max: LIMITS.id, nonEmpty: true, pattern: ID_RE });
  for (const f of ['platform', 'capability', 'class', 'probe']) checkEnum(errs, line, f, obj[f]);
  checkString(errs, line, 'scenario', obj.scenario, { max: LIMITS.scenario, nonEmpty: true, pattern: SCENARIO_RE });
  checkString(errs, line, 'ticket', obj.ticket, { max: LIMITS.ticket, nonEmpty: true });
  checkString(errs, line, 'evidence', obj.evidence, { max: LIMITS.evidence });
  checkString(errs, line, 'follow_up', obj.follow_up, { max: LIMITS.follow_up });
  checkString(errs, line, 'judge_notes', obj.judge_notes, { max: LIMITS.judge_notes });
  const exp = obj.expected;
  if (!isPlainObject(exp)) {
    errs.push(`line ${line}: field expected must be a JSON object`);
  } else if (checkFields(errs, line, exp, EXPECTED_FIELDS, 'expected.')) {
    checkString(errs, line, 'expected.first_move', exp.first_move, { max: LIMITS.first_move, nonEmpty: true });
    checkItems(errs, line, 'expected.must', exp.must, true);
    checkItems(errs, line, 'expected.must_not', exp.must_not, false);
    checkEnum(errs, line, 'expected.escalate', exp.escalate);
    checkEnum(errs, line, 'expected.change_class', exp.change_class);
    checkString(errs, line, 'expected.read_back', exp.read_back, { max: LIMITS.read_back });
  }
  if (errs.length > before) return null;
  return {
    id: obj.id, platform: obj.platform, capability: obj.capability, scenario: obj.scenario, class: obj.class,
    ticket: obj.ticket, evidence: obj.evidence, follow_up: obj.follow_up, probe: obj.probe,
    expected: { first_move: exp.first_move, must: [...exp.must], must_not: [...exp.must_not], escalate: exp.escalate, change_class: exp.change_class, read_back: exp.read_back },
    judge_notes: obj.judge_notes, line,
  };
}

function parseCases(text) {
  if (typeof text !== 'string') throw new CaseFileError(['the case file is not text']);
  const errs = [];
  const cases = [];
  const seen = new Map();
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  for (let i = 0; i < lines.length && errs.length < MAX_ERRORS; i += 1) {
    const line = i + 1;
    if (lines[i].trim() === '') continue;
    let obj;
    try {
      obj = JSON.parse(lines[i]);
    } catch {
      errs.push(`line ${line}: invalid JSON`);
      continue;
    }
    const c = validateCase(obj, line, errs);
    if (!c) continue;
    if (seen.has(c.id)) { errs.push(`line ${line}: duplicate id ${c.id} (first on line ${seen.get(c.id)})`); continue; }
    seen.set(c.id, line);
    cases.push(c);
    if (cases.length > MAX_CASES) { errs.push(`line ${line}: more than ${MAX_CASES} cases`); break; }
  }
  if (errs.length === 0 && cases.length === 0) errs.push('the case file holds no cases');
  if (errs.length) throw new CaseFileError(errs.slice(0, MAX_ERRORS));
  return { cases };
}

function readCaseFile(file) {
  const st = fs.statSync(file);
  if (!st.isFile()) throw new CaseFileError(['the case path is not a file']);
  if (st.size > MAX_FILE_BYTES) throw new CaseFileError([`the case file is larger than ${MAX_FILE_BYTES} bytes`]);
  return parseCases(fs.readFileSync(file, 'utf8'));
}

module.exports = { ENUMS, TOP_FIELDS, EXPECTED_FIELDS, LIMITS, MAX_FILE_BYTES, CaseFileError, parseCases, readCaseFile, validateCase };
