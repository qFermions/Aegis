'use strict';
// floor-times.js <before> <after>: the floors that chained two unbounded gaps, timed in the
// tier guard and the graph engine as they stood at two commits, on lines built to never
// complete them: 5 KB at both commits, and 20 KB at <after> (at <before> a 20 KB line takes
// 9 to 48 s per two-gap floor, the `20kb` mode below). Patterns are read with `git show`, never executed as
// code. Run from the repository root:
//   node docs/aegis/g3/evidence/tools/floor-times.js 9a636aa^ 9a636aa
// With a third argument `20kb` it times only <before> on a 20 KB line instead (minutes), and
// for a floor that takes over 2 s on 5 KB it prints its growth on 1, 2 and 4 KB instead.
const { execFileSync } = require('node:child_process');

const [before, after, mode] = process.argv.slice(2);
if (!before || !after) { console.error('usage: floor-times.js <before> <after>'); process.exit(1); }

// Every `{ pattern: /.../flags, label: '...' }` line of a file at a commit, as RegExp objects.
function floors(ref, file) {
  const text = execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 1 << 26 });
  return [...text.matchAll(/^\s*\{ pattern: \/(.*)\/([a-z]*), label: '((?:[^'\\]|\\.)*)'/gm)]
    .map((m) => ({ re: new RegExp(m[1], m[2]), label: m[3].replace(/\\'/g, "'") }));
}
const cases = [
  ['group membership removal', 'remove member from '], ['security-control change (SR-2)', 'exclude from '],
  ['account / work-profile removal', 'remove account from '], [/^security-control change\W+Google/, 'exclude from '],
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
  if (a.length !== b.length) throw new Error(`${file}: ${a.length} floors at ${before}, ${b.length} at ${after}`);
  for (const [prefix, unit] of cases) {
    const matches = (p) => (prefix instanceof RegExp ? prefix.test(p.label) : p.label.startsWith(prefix));
    // each side is looked up by label, so a floor added, removed or moved between the two
    // commits cannot pair one floor before with another after
    const i = a.findIndex(matches);
    const j = b.findIndex(matches);
    // the guard-only case has no engine twin; any other case missing is an error, never a skip
    if (i < 0 && side === 'engine' && prefix === 'security-control change (SR-2)') continue;
    if (i < 0) throw new Error(`${side}: no floor matching ${prefix} at ${before}`);
    if (j < 0) throw new Error(`${side}: no floor matching ${prefix} at ${after}`);
    if (a[i].re.source === b[j].re.source) continue;
    const shown = prefix instanceof RegExp ? 'security-control change -- Google' : prefix;
    const name = `${side.padEnd(6)} ${shown.padEnd(32)} ${JSON.stringify(unit).padEnd(22)}`;
    if (mode === '20kb') {
      const five = Number(ms(a[i].re, line(unit, 5000)));
      if (five > 2000) console.log(`${name} before: 1 KB ${ms(a[i].re, line(unit, 1000))} ms, 2 KB ${ms(a[i].re, line(unit, 2000))} ms, 4 KB ${ms(a[i].re, line(unit, 4000))} ms (20 KB not run)`);
      else console.log(`${name} before: 20 KB ${ms(a[i].re, line(unit, 20000))} ms`);
      continue;
    }
    console.log(`${name} 5 KB before ${ms(a[i].re, line(unit, 5000)).padStart(5)} ms, after ${ms(b[j].re, line(unit, 5000)).padStart(3)} ms; 20 KB after ${ms(b[j].re, line(unit, 20000)).padStart(3)} ms`);
  }
}
