'use strict';
// floor-times.js <before> <after>: the floors that chained two unbounded gaps, timed in the
// tier guard and the graph engine as they stood at two commits, on lines built to never
// complete them: 5 KB at both commits, and 20 KB at <after> (at <before> a 20 KB line takes
// 11 s to about 40 minutes per floor). Patterns are read with `git show`, never executed as
// code. Run from the repository root:
//   node docs/aegis/g3/evidence/tools/floor-times.js 9a636aa^ 9a636aa
const { execFileSync } = require('node:child_process');

const [before, after] = process.argv.slice(2);
if (!before || !after) { console.error('usage: floor-times.js <before> <after>'); process.exit(1); }

// Every `{ pattern: /.../flags, label: '...' }` line of a file at a commit, as RegExp objects.
function floors(ref, file) {
  const text = execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 1 << 26 });
  return [...text.matchAll(/^\s*\{ pattern: \/(.*)\/([a-z]*), label: '((?:[^'\\]|\\.)*)'/gm)]
    .map((m) => ({ re: new RegExp(m[1], m[2]), label: m[3].replace(/\\'/g, "'") }));
}
const cases = [
  ['group membership removal', 'remove member from '], ['security-control change (SR-2)', 'exclude from '],
  ['account / work-profile removal', 'remove account from '], ['security-control change \u2014 Google', 'exclude from '],
  ['Slack or Linear member', 'kick user '], ['Slack or Linear member', 'slack kick '], ['Okta lifecycle change', 'reset all '],
  ['Okta app unassignment', 'okta remove '], ['Okta app unassignment', 'remove app '], ['Fleet script run', 'run script '],
  ['Fleet script run', 'fleet run '], ['fleet-wide host operation', 'lock all '], ['Linear bulk issue operation', 'delete all '],
  ['retention change', 'change messages '], ['retention change', 'change retention '], ['fleet-wide computer or Mac', 'lock all '],
];
const line = (unit, n) => unit.repeat(Math.ceil(n / unit.length)).slice(0, n);
const ms = (re, text) => { const t = process.hrtime.bigint(); re.test(text); return (Number(process.hrtime.bigint() - t) / 1e6).toFixed(0); };
for (const [side, file] of [['guard', 'scripts/tier/tier-guard.js'], ['engine', 'scripts/graph/engine.js']]) {
  const a = floors(before, file);
  const b = floors(after, file);
  for (const [prefix, unit] of cases) {
    const i = a.findIndex((p) => p.label.startsWith(prefix));
    if (i < 0 || a[i].re.source === b[i].re.source) continue;
    console.log(`${side.padEnd(6)} ${prefix.replace('\u2014', '--').padEnd(32)} ${JSON.stringify(unit).padEnd(22)} 5 KB before ${ms(a[i].re, line(unit, 5000)).padStart(5)} ms, after ${ms(b[i].re, line(unit, 5000)).padStart(3)} ms; 20 KB after ${ms(b[i].re, line(unit, 20000)).padStart(3)} ms`);
  }
}
