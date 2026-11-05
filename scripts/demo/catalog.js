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

const GATE_LINE = /^[\s>*_`#-]*Gate:[\s*_`]*(.*)$/gim;
// True when the answer has a Gate line that says none.
const saysNoGate = (answer) => [...String(answer).matchAll(GATE_LINE)].some((m) => /^none\b/i.test(m[1]));

// The gates an answer names: its `Gate: <id>` lines (the desk's prompt asks for them), else any
// SAFETY GATE [id] it writes. An id has a hyphen, so prose after an id is not read as one.
function namedGates(answer) {
  const names = [];
  const add = (id) => { if (!names.includes(id)) names.push(id); };
  for (const m of String(answer).matchAll(GATE_LINE)) {
    for (const part of m[1].split(/[,;]/)) {
      const id = /^[\s*_`[]*([a-z0-9]+(?:-[a-z0-9]+)+)/.exec(part);
      if (id) add(id[1]);
    }
  }
  if (names.length) return names;
  for (const m of String(answer).matchAll(/SAFETY GATE \[([a-z0-9][a-z0-9-]*)\]/g)) add(m[1]);
  return names;
}

module.exports = { REPO_ROOT, RUNBOOKS, GATE_LINE, catalog, namedGates, saysNoGate };
