#!/usr/bin/env node
'use strict';
// d2-binding-compare.js <base-commit>: batch G4, task D2. For every SAFETY GATE in .claude/commands,
// the read-back commands it bound at <base-commit> (read the way change-record.js read them there:
// the gates a "read-back of [gate]" comment names, else the gate whose section the line sits in)
// against the commands change-record.js binds to it now, from its Read-back field. Prints the gates
// whose binding differs (none expected) and the counts. Read-only: `git show` of the base. Run from
// the repository root.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const base = process.argv[2];
if (!/^[0-9a-f]{7,40}$/.test(base || '')) { console.error('usage: d2-binding-compare.js <base commit>'); process.exit(1); }
const changes = require(path.join(process.cwd(), 'scripts', 'audit', 'change-record.js'));
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 });
const RUNBOOK_LINE = /node scripts\/(?:adapters\/)?([a-z]+)-client\.js (verify-[a-z0-9-]+)([^`\n]*)/;
const commandOf = (line) => { const rest = line.slice(line.match(RUNBOOK_LINE).index); return rest.slice(0, rest.indexOf(' --execute') + ' --execute'.length); };
function baseBinding(text) {
  const lines = text.split('\n');
  const byGate = new Map();
  let current = null;
  lines.forEach((l, i) => {
    if (/^## /.test(l)) current = null;
    const g = l.match(/<!-- SAFETY GATE \[([^\]]+)\] -->|^# SAFETY GATE \[([^\]]+)\]/);
    if (g) current = g[1] || g[2];
    if (!RUNBOOK_LINE.test(l) || !/--change \[CHANGE_ID\]/.test(l)) return;
    for (const gate of changes.namedGates(lines[i - 1]) || (current ? [current] : [])) byGate.set(gate, new Set([...(byGate.get(gate) || []), commandOf(l)]));
  });
  return byGate;
}
const files = git('ls-tree', '--name-only', base, '.claude/commands/').split('\n').filter((f) => f.endsWith('.md'));
let gates = 0;
let bound = 0;
const differ = [];
for (const file of files) {
  const before = baseBinding(git('show', `${base}:${file}`));
  const text = fs.readFileSync(file, 'utf8');
  for (const g of changes.gateFields(text)) {
    gates += 1;
    const was = [...(before.get(g.id) || [])].sort();
    const now = [...new Set(changes.boundReadBacks(text).filter((b) => b.gates.includes(g.id)).map((b) => b.command))].sort();
    if (now.length) bound += 1;
    if (JSON.stringify(was) !== JSON.stringify(now)) differ.push(`${file} ${g.id}:\n  at ${base}: ${was.join(' | ') || 'none'}\n  now: ${now.join(' | ') || 'none'}`);
  }
}
console.log(`gates now: ${gates}; gates binding a read-back now: ${bound}; gates whose bound commands differ from ${base}: ${differ.length}`);
for (const d of differ) console.log(d);
process.exitCode = differ.length ? 1 : 0;
