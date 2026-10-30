'use strict';
// floor-diff.js <before> <after>: every tier-guard and graph-engine floor whose pattern
// differs between two commits must give the same answer on every input: each corpus
// ticket, each quoted sentence in the tier and graph tests, and 40,000 random sentences per
// floor built from the floor's own words and placeholders (a fixed seed, so a rerun gives
// the same sentences). Patterns are read with `git show`, never executed as code. Run from
// the repository root: node docs/aegis/g3/evidence/tools/floor-diff.js 9a636aa^ 9a636aa
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const [before, after] = process.argv.slice(2);
if (!before || !after) { console.error('usage: floor-diff.js <before> <after>'); process.exit(1); }

function floors(ref, file) {
  const text = execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 1 << 26 });
  return [...text.matchAll(/^\s*\{ pattern: \/(.*)\/([a-z]*), label: '((?:[^'\\]|\\.)*)'/gm)]
    .map((m) => ({ re: new RegExp(m[1], m[2]), label: m[3] }));
}
const pairs = [];
for (const file of ['scripts/tier/tier-guard.js', 'scripts/graph/engine.js']) {
  const a = floors(before, file);
  const b = floors(after, file);
  if (a.length !== b.length) throw new Error(`${file}: ${a.length} floors at ${before}, ${b.length} at ${after}`);
  a.forEach((p, i) => { if (p.re.source !== b[i].re.source) pairs.push({ file, label: p.label, old: p.re, now: b[i].re }); });
}
const corpus = [];
for (const f of fs.readdirSync('scripts/eval').filter((x) => /-tickets\.json$/.test(x))) {
  const j = JSON.parse(fs.readFileSync(`scripts/eval/${f}`, 'utf8'));
  for (const t of (j.tickets || j)) corpus.push(String(t.text || t.ticket || t.input || ''));
}
for (const f of ['scripts/tier/tier-routing.test.js', 'scripts/graph/engine.test.js']) {
  if (fs.existsSync(f)) for (const m of fs.readFileSync(f, 'utf8').matchAll(/'((?:[^'\\]|\\.){8,300})'/g)) corpus.push(m[1]);
}
// a 32-bit linear congruential generator in integer arithmetic (Math.imul), so the sequence
// does not lose bits to floating point and repeat early
let seed = 7;
const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % k; };
const fillers = ['the', 'a', 'please', 'today', 'for', 'and', 'then', 'our', 'it', 'all', 'from', 'on', 'of', '.', ',', 'to', 'in'];
console.log(`${pairs.length} floors changed between ${before} and ${after}`);
console.log(`${corpus.length} corpus tickets and test sentences, plus 40000 random sentences per floor`);
let checked = 0;
let distinct = 0;
const differ = [];
for (const p of pairs) {
  const words = [...new Set(p.old.source.replace(/\\[bdswBDSW]/g, ' ').match(/\[[A-Z_@.]+\]|[a-z][a-z-]{1,}/gi) || [])];
  const inputs = [...corpus];
  for (let k = 0; k < 40000; k += 1) {
    const n = 2 + rnd(9);
    const ws = [];
    for (let j = 0; j < n; j += 1) ws.push(rnd(3) ? words[rnd(words.length)] : fillers[rnd(fillers.length)]);
    inputs.push(ws.join(' '));
  }
  distinct += new Set(inputs).size;
  for (const s of inputs) {
    checked += 1;
    if (p.old.test(s) !== p.now.test(s)) { differ.push(`${p.file} ${p.label}: ${JSON.stringify(s)}`); break; }
  }
}
console.log(`${checked} comparisons on ${pairs.length} floors (${distinct} distinct inputs); ${differ.length} disagreements`);
differ.forEach((d) => console.log(`  ${d}`));
