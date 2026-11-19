#!/usr/bin/env node
'use strict';
// merge-run.js <part 1 results.json> <part 1 audit dir> <part 2 results.json> <part 2 audit dir> <out dir>
// The batch 12d dev judged run came in two parts: the sessions of the last 35 cases of part 1 did not start (every one
// returned ERROR, at no cost), so those 35 cases were run again as part 2. This joins them into one record (batch 12d,
// task 7): <out dir>/results.json holds part 1's cases in their order, each case that did not run replaced by its part 2
// record, with both run ids, both spends and their sum; <out dir>/audit/ holds each case's tool audit file from the part
// its record came from. Local paths are written <repo>, <home> and <tmp>, and each long dash as a hyphen (the
// repository's rule). Reads and writes local files only; calls no model.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const [oneFile, oneAudit, twoFile, twoAudit, outDir] = process.argv.slice(2);
if (!outDir) {
  process.stderr.write('Usage: node merge-run.js <part 1 results.json> <part 1 audit dir> <part 2 results.json> <part 2 audit dir> <out dir>\n');
  process.exit(2);
}
const repo = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const mask = (text) => text.split(repo).join('<repo>').split(os.homedir()).join('<home>').split('/private/tmp').join('<tmp>').split(String.fromCharCode(0x2014)).join('-');

const one = JSON.parse(fs.readFileSync(oneFile, 'utf8'));
const two = JSON.parse(fs.readFileSync(twoFile, 'utf8'));
const second = new Map(two.cases.map((c) => [c.id, c]));
const ran = (c) => Boolean(c.sut) && c.sut.state === 'OK';
const from = new Map();
const cases = one.cases.map((c) => {
  const pick = !ran(c) && second.has(c.id) ? 2 : 1;
  from.set(c.id, pick);
  return { ...(pick === 2 ? second.get(c.id) : c), run_part: pick };
});
const count = (v) => cases.filter((c) => c.verdict === v).length;
const merged = {
  run_id: `${one.run_id}+${two.run_id}`,
  parts: [one, two].map((r, i) => ({ part: i + 1, run_id: r.run_id, started: r.started, finished: r.finished, spent_usd: r.spent_usd, cases: cases.filter((c) => c.run_part === i + 1).length })),
  config: one.config,
  spent_usd: one.spent_usd + two.spent_usd,
  summary: { cases: cases.length, passed: count('PASS'), failed: count('FAIL'), other: cases.length - count('PASS') - count('FAIL') },
  label: one.label,
  cases,
};
fs.mkdirSync(path.join(outDir, 'audit'), { recursive: true });
fs.writeFileSync(path.join(outDir, 'results.json'), mask(`${JSON.stringify(merged, null, 1)}\n`));
let files = 0;
for (const [id, part] of from) {
  const src = path.join(part === 2 ? twoAudit : oneAudit, `${id}-tool-audit.jsonl`);
  let text = '';
  try { text = fs.readFileSync(src, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (text.trim() === '') continue; // a case that made no call keeps no file
  fs.writeFileSync(path.join(outDir, 'audit', `${id}-tool-audit.jsonl`), mask(text));
  files += 1;
}
process.stdout.write(`merged ${cases.length} cases (${merged.parts.map((p) => `part ${p.part}: ${p.cases}`).join(', ')}); PASS ${merged.summary.passed}, FAIL ${merged.summary.failed}, other ${merged.summary.other}; spent ${merged.spent_usd.toFixed(2)} US dollars; ${files} audit file(s)\n`);
