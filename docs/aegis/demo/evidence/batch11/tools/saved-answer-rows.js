'use strict';
// saved-answer-rows.js: reads the answers batch 10's two runs saved (full-run-6, messy; full-run-7, tidy) with the
// batch 11 rows, at no cost: what the new rules say about answers written before the rules existed. Prints a table.
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const data = require(path.join(repo, 'scripts/demo/customers.js'));
const { seniorRows } = require(path.join(repo, 'scripts/demo/senior-rules.js'));
const CHECKS = ['assumed-setup', 'ask-first', 'new-way-in-first', 'who-else-what-left', 'how-wide-before-why', 'change-class-and-check'];
const out = ['| run | ticket | assumed setup | ask first | new way in first | who else, what left | how wide before why | class and double-check |', '|---|---|---|---|---|---|---|---|'];
const notes = [];
for (const [run, set] of [['full-run-6', 'messy'], ['full-run-7', 'tidy']]) {
  const { customers, tickets } = data.loadData(set);
  for (const t of tickets) {
    const file = path.join(repo, 'docs/aegis/demo/evidence', run, 'answers', `${t.id}-answer.txt`);
    if (!fs.existsSync(file)) continue;
    const customer = customers.find((c) => c.id === t.customer);
    // the ticket as the customer sent it (the desk reads the intake's redacted text; the rows read the same words)
    const rows = seniorRows(fs.readFileSync(file, 'utf8'), { setup: data.profileText(customer), ticket: data.rawItem(t, customer) });
    const cell = (check) => { const r = rows.find((x) => x.check === check); return r ? r.verdict : '-'; };
    out.push(`| ${run} | ${t.id} | ${CHECKS.map(cell).join(' | ')} |`);
    for (const r of rows.filter((x) => x.verdict === 'fail')) notes.push(`- ${run} ${t.id}, ${r.check}: ${String(r.detail).replace(/\s+/g, ' ')}`);
  }
}
console.log(out.join('\n'));
console.log('\nWhat each failing row said:\n');
console.log(notes.join('\n'));
