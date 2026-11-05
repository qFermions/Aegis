'use strict';
// catalog.js: what the runbooks say about a gate, read with the audit code's own parsers, so the
// desk and change-record.js cannot disagree. A SAFETY GATE has an id, a runbook, an R class and a
// Read-back field; a PREVIEW ONLY marker authorizes nothing and takes no change record.

const fs = require('node:fs');
const path = require('node:path');

const { gateFields, boundReadBacks } = require('../audit/change-record.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RUNBOOKS = path.join(REPO_ROOT, '.claude', 'commands');
const PREVIEW = /PREVIEW ONLY \[([a-z0-9][a-z0-9-]*)\]/g;

// id to { kind: 'gate', command, file, rClass, none, bound: [{ kind, argv, command }] } or
// { kind: 'preview', command, file }. A gate wins over a preview of the same id.
function catalog(dir = RUNBOOKS) {
  const found = new Map();
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const command = name.slice(0, -3);
    const file = path.join(dir, name);
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(PREVIEW)) if (!found.has(m[1])) found.set(m[1], { kind: 'preview', command, file });
    const lines = boundReadBacks(text);
    for (const g of gateFields(text)) {
      const seen = new Set();
      const bound = lines.filter((l) => l.gates.includes(g.id) && !seen.has(l.command) && seen.add(l.command)).map((l) => ({ kind: l.kind, argv: l.argv, command: l.command }));
      found.set(g.id, { kind: 'gate', command, file, rClass: g.rClass, none: g.readBack ? g.readBack.none : null, bound });
    }
  }
  return found;
}

// A line that says Gate: <value>. A leading > is not allowed: a quote is the ticket's text, not advice.
const GATE_LINE = /^[\s*_`-]*Gate:[\s*_`]*(.*)$/i;

// The Gate lines that close the answer, and the text before them. Only these count: the prompt asks
// the answer to end with them, and a line anywhere else may be the ticket's own text repeated (SR-3).
function closingGateLines(answer) {
  const lines = String(answer).split('\n');
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

// The gates an answer names. An id has a hyphen, so prose after an id is not read as one.
function namedGates(answer) {
  const names = [];
  for (const value of closingGateLines(answer).values) {
    for (const part of value.split(/[,;]/)) {
      const id = /^[\s*_`[]*([a-z0-9]+(?:-[a-z0-9]+)+)/.exec(part);
      if (id && !names.includes(id[1])) names.push(id[1]);
    }
  }
  return names;
}

// A clarifying answer proposes no change: it closes with Gate: none and asks something. shortcut: a
// question is a line that ends in a question mark, so one asked mid-line reads as no question; a
// person reading the answer can tell, and the ticket then shows OPEN rather than a false CLARIFY.
function clarifies(answer) {
  const { values, body } = closingGateLines(answer);
  return values.some((v) => /^none\b/i.test(v)) && /\?[\s*_`)]*$/m.test(body);
}

module.exports = { REPO_ROOT, RUNBOOKS, catalog, namedGates, clarifies };
