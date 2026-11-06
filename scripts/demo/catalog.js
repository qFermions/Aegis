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
// a runbook line may quote a value ("[STATE_NAME]"); the argument the client gets has no quote marks, so
// the placeholder can be filled (code review 3, finding 6). shortcut: a quoted value with a space in it
// would still be split; no runbook read line has one today.
const unquote = (a) => a.replace(/^"(.*)"$/, '$1');
const MARK = /^<!-- SAFETY GATE \[|^# SAFETY GATE \[/;

// The read line in one gate's own section: from the line after its marker (from: the marker's 1-based
// line number) to the next gate marker or the next heading outside a code fence. Used only for an R1
// gate, which takes no change record (batch 8, task 5). It counts only when the section names exactly
// one read: a section with two lists alternatives (an activate reads PROVISIONED or ACTIVE) or reads
// that prove other changes, and a read bound by where it sits proves nothing (code review 1, finding 4).
// The fence state is counted from the top of the file, so a gate whose marker sits inside a bash fence
// starts inside it (finding 9). The same read written twice counts once (code review 2, finding 10).
function sectionReads(lines, from, fencedAt) {
  const reads = [];
  const seen = new Set();
  let fenced = fencedAt[from - 1];
  for (let i = from; i < lines.length; i += 1) {
    const l = lines[i];
    if (/^\s*```/.test(l)) { fenced = !fenced; continue; }
    if (MARK.test(l)) break;
    if (!fenced && /^#{1,6} /.test(l)) break;
    const m = READ_LINE.exec(l.trim());
    if (m && !/--change\b/.test(l) && !seen.has(l.trim()) && seen.add(l.trim())) reads.push({ kind: `${CLIENT_CONNECTOR[m[1]] || m[1]}:${m[2]}`, argv: [m[2], ...m[3].trim().split(/\s+/).filter(Boolean).map(unquote)], command: l.trim() });
  }
  return reads.length === 1 ? reads : [];
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
    // whether each line sits inside a code fence, counted once per file (code review 2, finding 15)
    const fencedAt = [];
    let open = false;
    for (const l of all) { fencedAt.push(open); if (/^\s*```/.test(l)) open = !open; }
    for (const g of gateFields(text)) {
      const seen = new Set();
      const bound = lines.filter((l) => l.gates.includes(g.id) && !seen.has(l.command) && seen.add(l.command)).map((l) => ({ kind: l.kind, argv: l.argv, command: l.command }));
      const reads = g.rClass === 'R1' && !bound.length ? sectionReads(all, g.line, fencedAt) : [];
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
// question mark that ends a sentence anywhere in a line of the answer's own text (batch 8, task 6), after
// a word, so "'???'" asks nothing; not in a quote, a heading, a line that is all bold, a code fence or
// inline code (code review 1, finding 5). A question inside quote marks counts, since that is how an
// answer gives the tech a question to pass on (code review 2, finding 3), unless it is the ticket's own
// question repeated word for word (code review 3, finding 1): ticket, when given, is the ticket's text.
// A link's ?site=all ends nothing. shortcut: a rhetorical question reads as a question too, so such an
// answer shows CLARIFY; the page shows the answer for a person to read.
const QUESTION = /[A-Za-z0-9)\]]\?+(?=[\s*_)"'\u201d\u2019]|$)/g;
const squash = (t) => String(t).toLowerCase().replace(/[^a-z0-9?]+/g, ' ').trim();
function clarifies(answer, ticket = '') {
  const { values, body } = closingGateLines(answer);
  if (!values.some(says_none)) return false;
  const theirs = squash(ticket);
  let fenced = false;
  return body.split(/\r?\n/).some((l) => {
    if (/^\s*```/.test(l)) { fenced = !fenced; return false; }
    if (fenced || /^\s*(?:[>#]|\*\*.*\*\*\s*$)/.test(l)) return false;
    const text = l.replace(/`[^`]*`/g, ' ');
    return [...text.matchAll(QUESTION)].some((m) => {
      // the asked sentence runs back from its question mark to the nearest sentence end or opening quote
      const start = Math.max(...['.', '!', '?', '"', '\u201c'].map((c) => text.lastIndexOf(c, m.index))) + 1;
      const asked = squash(text.slice(start, m.index + m[0].length));
      return !(theirs && asked.length > 8 && theirs.includes(asked));
    });
  });
}

module.exports = { REPO_ROOT, RUNBOOKS, catalog, closingGateLines, namedGates, contradictsItself, clarifies, says_none };
