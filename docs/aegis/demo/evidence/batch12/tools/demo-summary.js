#!/usr/bin/env node
'use strict';
// demo-summary.js <title> <earlier-summary.md> <run-dir>... : one Markdown summary of the Customer Desk runs given (later
// runs fill the tickets an earlier one did not run), with the batch 12 rows and a side by side against an earlier run's
// summary table (its first table: ticket, closing state, card words, ..., cost). Prints to stdout. Reads local files only.
const fs = require('node:fs');
const path = require('node:path');
const [title, earlierFile, ...dirs] = process.argv.slice(2);
const byId = new Map();
for (const dir of dirs) {
  const run = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8'));
  for (const t of run.tickets) {
    const audit = path.join(dir, 'customers', t.customer, 'tickets', `${t.id}-tool-audit.jsonl`);
    byId.set(t.id, { t, dir, calls: fs.existsSync(audit) ? fs.readFileSync(audit, 'utf8').split('\n').filter(Boolean).length : 0 });
  }
}
const order = [...byId.keys()].sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
const step = (t, n) => t.steps.find((s) => s.n === n) || {};
const cost = (t) => (typeof step(t, 4).cost_usd === 'number' ? step(t, 4).cost_usd.toFixed(2) : 'none');
const gates = (t) => (step(t, 6).signed_off || []).map((g) => g.gate).join(', ') || 'none';
const row = (t, name) => { const r = [...(step(t, 5).answer_checks || []), ...(step(t, 5).expert_checks || [])].find((x) => x.check === name); return r ? r.verdict : '-'; };
const earlier = new Map();
for (const line of fs.readFileSync(earlierFile, 'utf8').split('\n')) {
  const m = /^\| (T\d+m?) \| ([^|]+) \| ([^|]+) \|.*\| ([^|]+) \|$/.exec(line);
  if (m && !earlier.has(m[1])) earlier.set(m[1], { state: m[2].trim(), words: m[3].trim(), cost: m[4].trim() });
}
const L = [`# ${title}`, '', `Runs: ${dirs.map((d) => path.basename(d)).join(', ')} (claude-opus-5-5, tool server on, the batch 12 rules). One row per ticket; a ticket the first run did not reach was run in the next folder.`, '',
  '| ticket | closing state | mode named | Fix card words | gates signed off | lightest step first | tool calls | cost in US dollars |', '|---|---|---|---|---|---|---|---|'];
let total = 0;
for (const id of order) {
  const { t, calls } = byId.get(id);
  if (typeof step(t, 4).cost_usd === 'number') total += step(t, 4).cost_usd;
  L.push(`| ${id} | ${t.closing_state} | ${t.answer_mode || 'none'} | ${t.answer_stats ? t.answer_stats.fix_card_words : 'n/a'} | ${gates(t)} | ${row(t, 'lightest-step-first')} | ${calls} | ${cost(t)} |`);
}
L.push('', `Total cost of the sessions: ${total.toFixed(2)} US dollars.`, '', 'The batch 12 rows (docs/aegis/answer-format.md sections 2 and 9; a rule that does not cover the ticket shows as "-"):', '',
  '| ticket | answer mode row | escalate on compromise | least privilege | safe recovery | ask first when risky | Fix card 150 words |', '|---|---|---|---|---|---|---|');
for (const id of order) {
  const { t } = byId.get(id);
  L.push(`| ${id} | ${row(t, 'answer-mode')} | ${row(t, 'escalate-on-compromise')} | ${row(t, 'least-privilege')} | ${row(t, 'safe-recovery')} | ${row(t, 'ask-first-risky')} | ${row(t, 'fix-card-words')} |`);
}
L.push('', `Side by side with ${path.basename(path.dirname(earlierFile))} (batch 11, the same tickets):`, '', '| ticket | closing state then | closing state now | card words then | card words now | cost then | cost now |', '|---|---|---|---|---|---|---|');
for (const id of order) {
  const { t } = byId.get(id);
  const e = earlier.get(id) || { state: 'not run', words: '-', cost: '-' };
  L.push(`| ${id} | ${e.state} | ${t.closing_state} | ${e.words} | ${t.answer_stats ? t.answer_stats.fix_card_words : 'n/a'} | ${e.cost} | ${cost(t)} |`);
}
process.stdout.write(`${L.join('\n')}\n`);
