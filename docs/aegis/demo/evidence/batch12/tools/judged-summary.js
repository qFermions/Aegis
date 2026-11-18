#!/usr/bin/env node
'use strict';
// judged-summary.js <results.json> <cases.jsonl> <batch11-results.json> <audit-dir>: the batch 12 dev judged run as
// Markdown tables (per case, per lane, per mode, the 24 batch 11 cases side by side, the hosts the tool server reached),
// and each case scored again with the checks at the current commit: the run loaded its checks before code reviews 1 and
// 2 changed claims-match-calls and the scanner, so both verdicts are shown. The re-score reruns the deterministic checks
// and recomputes the verdict from the judge's saved result; it calls no model. Prints to stdout; reads local files only.
const fs = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const checks = require(path.join(repo, 'scripts/eval/judged/checks.js'));
const expert = require(path.join(repo, 'scripts/demo/expert-rules.js'));
const judge = require(path.join(repo, 'scripts/eval/judged/judge.js'));
const { readCaseFile } = require(path.join(repo, 'scripts/eval/judged/cases.js'));

const [resultsFile, casesFile, b11File, auditDir] = process.argv.slice(2);
const run = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
const byCase = new Map(readCaseFile(casesFile).cases.map((c) => [c.id, c]));
const b11 = new Map(JSON.parse(fs.readFileSync(b11File, 'utf8')).cases.map((c) => [c.id, c]));
const PIN = 'claude-opus-5-5';
const SERVER = 'mcp__aegis-tools__';

const rows = run.cases.map((r) => {
  const c = byCase.get(r.id);
  let final = { verdict: r.verdict, reasons: r.reasons || [] };
  if (c && r.sut && r.sut.state === 'OK' && r.judge && r.judge.state === 'OK') {
    const det = [...checks.runChecks(c, r.sut), ...expert.judgedChecks(c, r.sut)];
    final = judge.caseVerdict(c, r.sut, det, r.judge, { sut: PIN, judge: PIN });
  }
  const counts = r.tool_call_counts || {};
  const server = Object.entries(counts).filter(([t]) => t.startsWith(SERVER)).reduce((a, [, n]) => a + n, 0);
  const other = Object.entries(counts).filter(([t]) => !t.startsWith(SERVER)).reduce((a, [, n]) => a + n, 0);
  const cost = ((r.sut && r.sut.cost_usd) || 0) + ((r.judge && r.judge.cost_usd) || 0);
  return { r, final, server, other, cost, outside: ((r.sut && r.sut.outside_reads) || []).length };
});

const pct = (n, d) => (d ? `${n}/${d} (${((100 * n) / d).toFixed(1)}%)` : 'n/a');
const median = (xs) => { if (!xs.length) return 'n/a'; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? String(s[m]) : String((s[m - 1] + s[m]) / 2); };
const card = (w) => (typeof w === 'number' ? String(w) : 'no card');
const out = [];
const say = (s = '') => out.push(s);

say('## Per case'); say();
say('| case | lane | mode named / expected | verdict as run | score | verdict with the final checks | Fix card words | tool server calls | other tool calls | cost (both sessions) | reads outside the repository | what failed it (as run) |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const x of rows) {
  const m = x.r.mode || {};
  say(`| ${x.r.id} | ${x.r.lane} | ${m.named || 'none'} / ${m.expected || '-'} | ${x.r.verdict} | ${x.r.total}/${x.r.max} | ${x.final.verdict} | ${card(x.r.fix_card_words)} | ${x.server} | ${x.other} | ${x.cost.toFixed(2)} | ${x.outside} | ${(x.r.reasons || []).join('; ') || 'none'} |`);
}

const group = (title, keyOf) => {
  say(); say(`## ${title}`); say();
  say('| group | cases | pass as run | pass with the final checks | mode named matches expected | cards over 150 words | Fix card words, median (cards) | tool server calls (cases) | reads outside the repository |');
  say('|---|---|---|---|---|---|---|---|---|');
  for (const k of [...new Set(rows.map(keyOf))].sort()) {
    const g = rows.filter((x) => keyOf(x) === k);
    const cards = g.map((x) => x.r.fix_card_words).filter((w) => typeof w === 'number');
    const withExpected = g.filter((x) => x.r.mode && x.r.mode.expected);
    say(`| ${k} | ${g.length} | ${pct(g.filter((x) => x.r.verdict === 'PASS').length, g.length)} | ${pct(g.filter((x) => x.final.verdict === 'PASS').length, g.length)} | ${withExpected.length ? pct(withExpected.filter((x) => x.r.mode.match).length, withExpected.length) : 'no expected mode'} | ${cards.filter((w) => w > 150).length} | ${median(cards)} (${cards.length}) | ${g.reduce((a, x) => a + x.server, 0)} (${g.filter((x) => x.server > 0).length}) | ${g.reduce((a, x) => a + x.outside, 0)} |`);
  }
};
group('Per lane', (x) => x.r.lane);
group('Per mode (the mode each answer named on its first line)', (x) => (x.r.mode && x.r.mode.named) || 'none named');

say(); say('## The 24 batch 11 cases side by side (the batch 11 run against this run)'); say();
say('| case | batch 11 verdict | batch 11 score | batch 12 verdict | batch 12 score | batch 12 Fix card words | batch 12 reasons |');
say('|---|---|---|---|---|---|---|');
const old = rows.filter((y) => b11.has(y.r.id));
for (const x of old) {
  const o = b11.get(x.r.id);
  say(`| ${x.r.id} | ${o.verdict} | ${o.total}/${o.max} | ${x.r.verdict} | ${x.r.total}/${x.r.max} | ${card(x.r.fix_card_words)} | ${(x.r.reasons || []).join('; ') || 'none'} |`);
}
const onlyCard = old.filter((x) => (x.r.reasons || []).length && x.r.reasons.every((s) => s === 'check fix-card-fits fail')).map((x) => x.r.id);
say(); say(`Batch 11: ${old.filter((x) => b11.get(x.r.id).verdict === 'PASS').length} of ${old.length} passed; batch 12: ${old.filter((x) => x.r.verdict === 'PASS').length} as run, ${old.filter((x) => x.final.verdict === 'PASS').length} with the final checks. Cases whose only failing reason is the 150-word card check: ${onlyCard.join(', ') || 'none'}.`);

say(); say('## Verdicts or reasons that change with the final checks'); say();
const changed = rows.filter((x) => x.final.verdict !== x.r.verdict || (x.final.reasons || []).join() !== (x.r.reasons || []).join());
if (!changed.length) say('None.');
for (const x of changed) say(`- ${x.r.id}: ${x.r.verdict} to ${x.final.verdict}; reasons as run: ${(x.r.reasons || []).join('; ') || 'none'}; with the final checks: ${(x.final.reasons || []).join('; ') || 'none'}.`);

say(); say('## Hosts the tool server reached (from the audit files)'); say();
const calls = [];
for (const f of fs.readdirSync(auditDir).filter((n) => n.endsWith('-tool-audit.jsonl')).sort()) {
  for (const line of fs.readFileSync(path.join(auditDir, f), 'utf8').split('\n').filter((l) => l.trim())) {
    const a = JSON.parse(line); const i = a.input || {};
    let host = i.name || i.host || '';
    if (i.url) { try { host = new URL(i.url).hostname; } catch { host = String(i.url); } }
    calls.push(`| ${f.replace('-tool-audit.jsonl', '')} | ${a.tool} | ${host} | ${a.decision} |`);
  }
}
say('| case | tool | host | decision |'); say('|---|---|---|---|');
for (const c of calls) say(c);

const passRun = rows.filter((x) => x.r.verdict === 'PASS').length;
const passFinal = rows.filter((x) => x.final.verdict === 'PASS').length;
say(); say(`Totals: ${rows.length} cases; PASS ${passRun} as run, ${passFinal} with the final checks; spent ${run.spent_usd.toFixed(2)} US dollars (both sessions of every case); tool server calls ${calls.length}.`);
process.stdout.write(`${out.join('\n')}\n`);
