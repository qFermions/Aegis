#!/usr/bin/env node
'use strict';
// gate-field-lines.js <before> <after>: every SAFETY GATE in .claude/commands at two commits,
// compared field by field (Target, Effect, Scope, Reversibility, Required confirmation, Failure
// behavior, in either the marker form `- **Field:**` or the fenced form `# Field:`) and by its
// PORTAL ACTION line. Prints the gate counts, every gate whose fields changed, and for each
// change whether it is only an R class put first on the Reversibility line (the rest of the line
// unchanged) or anything else. H4's check: no gate's text changes beyond its class line.
// Read-only: `git show` of the two commits. Run from the repository root.
const { execFileSync } = require('node:child_process');

const [before, after] = process.argv.slice(2);
if (!before || !after) { console.error('usage: gate-field-lines.js <before> <after>'); process.exit(1); }
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 });
const FIELD = /^(?:- \*\*|# )(Target|Effect|Scope|Reversibility|Required confirmation|Failure behavior):(?:\*\*)? ?(.*)$/;
const GATE = /<!-- SAFETY GATE \[([^\]]+)\] -->|^# SAFETY GATE \[([^\]]+)\]/;

function gates(commit) {
  const out = new Map();
  const files = git('ls-tree', '--name-only', commit, '.claude/commands/').split('\n').filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const lines = git('show', `${commit}:${file}`).split('\n');
    lines.forEach((l, i) => {
      const g = l.match(GATE);
      if (!g) return;
      const id = g[1] || g[2];
      const fields = {};
      for (let j = i + 1; j < lines.length; j++) {
        const f = lines[j].match(FIELD);
        if (!f) break;
        fields[f[1]] = f[2];
      }
      const action = lines.find((x) => x.startsWith(`**PORTAL ACTION [${id}]:**`)) || null;
      out.set(`${file} ${id}`, { fields, action });
    });
  }
  return out;
}

const a = gates(before);
const b = gates(after);
console.log(`gates at ${before}: ${a.size}; at ${after}: ${b.size}`);
const gone = [...a.keys()].filter((k) => !b.has(k));
const added = [...b.keys()].filter((k) => !a.has(k));
console.log(`gates removed: ${gone.length}${gone.length ? ` (${gone.join(', ')})` : ''}; gates added: ${added.length}${added.length ? ` (${added.join(', ')})` : ''}`);
let classOnly = 0;
const other = [];
for (const [key, x] of a) {
  const y = b.get(key);
  if (!y) continue;
  for (const name of new Set([...Object.keys(x.fields), ...Object.keys(y.fields)])) {
    const was = x.fields[name];
    const now = y.fields[name];
    if (was === now) continue;
    const m = name === 'Reversibility' && typeof was === 'string' && typeof now === 'string' && now.match(/^(R[0-3]) \([^]*?\): (.*)$/);
    if (m && now.endsWith(`: ${was}`) && !/\bR[0-3]\b/.test(was)) { classOnly++; continue; }
    other.push(`${key} ${name}:\n  before: ${was}\n  after:  ${now}`);
  }
  if (x.action !== y.action) other.push(`${key} PORTAL ACTION:\n  before: ${x.action}\n  after:  ${y.action}`);
}
console.log(`gates whose only change is an R class put first on the Reversibility line: ${classOnly}`);
console.log(`any other change to a gate field or PORTAL ACTION line: ${other.length}`);
for (const o of other) console.log(o);
