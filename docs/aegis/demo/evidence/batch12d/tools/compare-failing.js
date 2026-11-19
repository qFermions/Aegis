'use strict';
// compare.js <full run output> <baseline failing-names.txt>: the failing test names of the run against the baseline list.
const fs = require('node:fs');
const [run, base] = process.argv.slice(2);
const text = fs.readFileSync(run, 'utf8');
const section = text.slice(text.indexOf('✖ failing tests:'));
const failing = [...new Set(section.split('\n').filter((l) => l.startsWith('✖ ') && !l.startsWith('✖ failing tests')).map((l) => l.slice(2).replace(/ \([\d.]+m?s\)$/, '')))].sort();
const baseline = fs.readFileSync(base, 'utf8').split('\n').filter(Boolean).sort();
const extra = failing.filter((n) => !baseline.includes(n));
const fixed = baseline.filter((n) => !failing.includes(n));
console.log(`failing in this run: ${failing.length}; in the baseline list: ${baseline.length}`);
console.log(`failing now and not in the baseline: ${extra.length}`);
for (const n of extra) console.log(`  + ${n}`);
console.log(`in the baseline and passing now: ${fixed.length}`);
for (const n of fixed) console.log(`  - ${n}`);
console.log(extra.length === 0 && fixed.length === 0 ? 'SAME 41 NAMES' : 'DIFFERENT');
for (const line of text.split('\n').filter((l) => /^ℹ (tests|pass|fail|cancelled|skipped|todo) /.test(l))) console.log(line);
console.log(text.trim().split('\n').pop());
