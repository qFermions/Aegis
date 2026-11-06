'use strict';
// catalog.js: what the runbooks say about a gate, read with the audit code's own parsers, so the
// desk and change-record.js cannot disagree. A SAFETY GATE has an id, a runbook, an R class and a
// Read-back field; a PREVIEW ONLY marker authorizes nothing and takes no change record.

const fs = require('node:fs');
const path = require('node:path');

const { gateFields, boundReadBacks } = require('../audit/change-record.js');
const { deskBlock } = require('./answer.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RUNBOOKS = path.join(REPO_ROOT, '.claude', 'commands');
const PREVIEW = /PREVIEW ONLY \[([a-z0-9][a-z0-9-]*)\]/g;

// A read line a runbook runs without a change record: the same shape change-record.js reads
// (its RUNBOOK_LINE), with --execute and no --change.
const READ_LINE = /^node scripts\/(?:adapters\/)?([a-z]+)-client\.js (verify-[a-z0-9-]+)((?: [^`\n]*)?) --execute$/;
const CLIENT_CONNECTOR = Object.freeze({ gws: 'google-workspace' });
const MARK = /^<!-- SAFETY GATE \[|^# SAFETY GATE \[/;

// The read lines in one gate's own section: from the line after its marker (from: the marker's 1-based
// line number) to the next gate marker or the next heading outside a code fence. Used only for an R1 gate, which takes no change record (batch 8, task 5).
function sectionReads(lines, from) {
  const reads = [];
  let fenced = false;
  for (let i = from; i < lines.length; i += 1) {
    const l = lines[i];
    if (/^\s*```/.test(l)) { fenced = !fenced; continue; }
    if (MARK.test(l)) break;
    if (!fenced && /^#{1,6} /.test(l)) break;
    const m = READ_LINE.exec(l.trim());
    if (m && !/--change\b/.test(l)) reads.push({ kind: `${CLIENT_CONNECTOR[m[1]] || m[1]}:${m[2]}`, argv: [m[2], ...m[3].trim().split(/\s+/).filter(Boolean)], command: l.trim() });
  }
  return reads;
}

// The exact phrase a gate's "Required confirmation" field asks a person to type, or null: the last
// backtick span after "type exactly" on the gate's own field lines.
function phraseOf(lines, from) {
  for (let i = from; i < lines.length && /^(?:- \*\*[A-Za-z -]+:\*\*|# [A-Za-z -]+:)/.test(lines[i]); i += 1) {
    const m = /Required confirmation:\*{0,2}(.*)$/.exec(lines[i]);
    if (!m) continue;
    const after = m[1].split(/type exactly/i).pop();
    const spans = [...after.matchAll(/`([^`]+)`/g)];
    return spans.length ? spans[spans.length - 1][1] : null;
  }
  return null;
}

// id to { kind: 'gate', command, file, rClass, none, bound: [{ kind, argv, command }], reads, phrase } or
// { kind: 'preview', command, file }. A gate wins over a preview of the same id. reads: for an R1 gate
// that binds nothing, the read lines its own section names.
function catalog(dir = RUNBOOKS) {
  const found = new Map();
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const command = name.slice(0, -3);
    const file = path.join(dir, name);
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(PREVIEW)) if (!found.has(m[1])) found.set(m[1], { kind: 'preview', command, file });
    const lines = boundReadBacks(text);
    const all = text.split('\n');
    for (const g of gateFields(text)) {
      const seen = new Set();
      const bound = lines.filter((l) => l.gates.includes(g.id) && !seen.has(l.command) && seen.add(l.command)).map((l) => ({ kind: l.kind, argv: l.argv, command: l.command }));
      const reads = g.rClass === 'R1' && !bound.length ? sectionReads(all, g.line) : [];
      found.set(g.id, { kind: 'gate', command, file, rClass: g.rClass, none: g.readBack ? g.readBack.none : null, bound, reads, phrase: phraseOf(all, g.line) });
    }
  }
  return found;
}

// A line that says Gate: <value>. A leading > is not allowed: a quote is the ticket's text, not advice.
const GATE_LINE = /^[\s*_`#-]*Gate:[\s*_`]*(.*)$/i;

// The Gate lines that close the answer, and the text before them. Only these count: the answer format
// puts them in the aegis-desk block that closes the answer (batch 8), and an answer in the older form
// ends with them; a line anywhere else may be the ticket's own text repeated (SR-3). Inside the block,
// only its Gate lines count: its other lines (a phrase, a change record) name nothing.
function closingGateLines(answer) {
  const block = deskBlock(answer);
  if (block.present) {
    const values = block.lines.map((l) => GATE_LINE.exec(l)).filter(Boolean).map((m) => m[1]);
    return { values, body: block.body };
  }
  const lines = String(answer).split(/\r?\n/);
  const values = [];
  let i = lines.length - 1;
  for (; i >= 0; i -= 1) {
    if (lines[i].trim() === '') continue;
    const m = GATE_LINE.exec(lines[i]);
    if (!m) break;
    values.unshift(m[1]);
  }
  return { values, body: lines.slice(0, i + 1).join('\n') };
}

const says_none = (value) => /^none\b/i.test(value);
const GATE_ID_SOURCE = '(?<![A-Za-z0-9-])[a-z0-9]+(?:-[a-z0-9]+)+(?![A-Za-z0-9-])';
const GATE_ID = new RegExp(GATE_ID_SOURCE);

// True when one closing Gate line says none and also names a gate.
const contradictsItself = (answer) => closingGateLines(answer).values.some((v) => says_none(v) && GATE_ID.test(v));

// The gates an answer names: every whole lower-case hyphenated word on a closing Gate line, so no advised
// change is dropped silently. A word that is not a gate stops the ticket OPEN, the safe side.
function namedGates(answer) {
  const names = [];
  for (const value of closingGateLines(answer).values) {
    for (const id of value.match(new RegExp(GATE_ID_SOURCE, 'g')) || []) {
      if (!names.includes(id)) names.push(id);
    }
  }
  return names;
}

// A clarifying answer proposes no change: it closes with Gate: none and asks something. A question is a
// question mark that ends a sentence anywhere in a line of the answer's own text (batch 8, task 6), not
// in a quote, a heading or a line that is all bold; one inside a link (?site=all) ends nothing.
// shortcut: a rhetorical question reads as a question too, so such an answer shows CLARIFY; the page
// shows the answer for a person to read.
function clarifies(answer) {
  const { values, body } = closingGateLines(answer);
  return values.some(says_none) && body.split(/\r?\n/).some((l) => !/^\s*(?:[>#]|\*\*.*\*\*\s*$)/.test(l) && /\?(?=[\s*_`)"']|$)/.test(l));
}

module.exports = { REPO_ROOT, RUNBOOKS, catalog, closingGateLines, namedGates, contradictsItself, clarifies };
