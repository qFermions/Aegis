#!/usr/bin/env node
'use strict';
// side-by-side.js <batch 12 results.json> <batch 12 audit dir> <batch 12d results.json> <batch 12d audit dir>
// The two dev judged runs side by side, per lane and per mode (batch 12d, task 7): pass, fail, Fix card words (median,
// count over 150), human-confirmation and read-back failures, tool server calls allowed and refused, reads outside the
// repository, and reads of this repository's .git. Then every host the tool server reached and every refused call of
// the second run. Each cell reads "batch 12 / batch 12d". Reads local files only and calls no model; prints Markdown.
// The audit files are <audit dir>/<case id>-tool-audit.jsonl, one JSON line per call (scripts/mcp/aegis-tools/server.js).
const fs = require('node:fs');
const path = require('node:path');

const [oldFile, oldAudit, newFile, newAudit] = process.argv.slice(2);
if (!newAudit) {
  process.stderr.write('Usage: node side-by-side.js <batch 12 results.json> <batch 12 audit dir> <batch 12d results.json> <batch 12d audit dir>\n');
  process.exit(2);
}

const isRefused = (a) => String(a.decision).startsWith('refused_');
const hostOf = (input) => {
  if (!input) return '(none)';
  if (typeof input.url === 'string') { try { return new URL(input.url).hostname; } catch { return '(not a URL)'; } }
  return String(input.name || input.host || '(none)');
};
// a Read, Grep or Glob whose path or pattern names .git
const namesGit = (c) => [c.path, c.pattern].some((v) => typeof v === 'string' && /(^|[\\/])\.git([\\/]|$)/.test(v));

function load(file, auditDir) {
  const run = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cases = run.cases.map((r) => {
    const audit = [];
    try {
      for (const line of fs.readFileSync(path.join(auditDir, `${r.id}-tool-audit.jsonl`), 'utf8').split('\n')) if (line.trim()) audit.push(JSON.parse(line));
    } catch (e) { if (e.code !== 'ENOENT') throw e; } // a case that made no call has no file
    const failed = (name) => (r.checks || []).some((c) => c.check === name && c.applies && c.verdict === 'fail');
    const git = ((r.sut && r.sut.tool_calls) || []).filter(namesGit);
    return {
      id: r.id, lane: r.lane || 'none', mode: (r.mode && r.mode.named) || 'none named', verdict: r.verdict,
      card: typeof r.fix_card_words === 'number' ? r.fix_card_words : null,
      confirmation: failed('human-confirmation'), readBack: failed('read-back'), audit,
      outside: ((r.sut && r.sut.outside_reads) || []).length, gitTried: git.length, gitRead: git.filter((c) => !c.error).length,
      cost: ((r.sut && r.sut.cost_usd) || 0) + ((r.judge && r.judge.cost_usd) || 0),
    };
  });
  return { run, cases };
}

const median = (xs) => {
  if (!xs.length) return 'n/a';
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return String(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};

function stats(cases) {
  const cards = cases.map((c) => c.card).filter((w) => w !== null);
  const calls = cases.flatMap((c) => c.audit);
  return {
    cases: cases.length, pass: cases.filter((c) => c.verdict === 'PASS').length, fail: cases.filter((c) => c.verdict === 'FAIL').length,
    other: cases.filter((c) => c.verdict !== 'PASS' && c.verdict !== 'FAIL').length,
    cards: cards.length, median: median(cards), over: cards.filter((w) => w > 150).length,
    confirmation: cases.filter((c) => c.confirmation).length, readBack: cases.filter((c) => c.readBack).length,
    allowed: calls.filter((a) => !isRefused(a)).length, refused: calls.filter(isRefused).length,
    outside: cases.reduce((n, c) => n + c.outside, 0), gitTried: cases.reduce((n, c) => n + c.gitTried, 0), gitRead: cases.reduce((n, c) => n + c.gitRead, 0),
  };
}

const COLUMNS = [
  ['cases', (s) => s.cases], ['pass', (s) => s.pass], ['fail', (s) => s.fail], ['inconclusive or error', (s) => s.other],
  ['Fix cards', (s) => s.cards], ['card words, median', (s) => s.median], ['cards over 150', (s) => s.over],
  ['human-confirmation fails', (s) => s.confirmation], ['read-back fails', (s) => s.readBack],
  ['tool calls allowed', (s) => s.allowed], ['tool calls refused', (s) => s.refused], ['reads outside the repository', (s) => s.outside],
  ['.git reads tried', (s) => s.gitTried], ['.git reads that returned', (s) => s.gitRead],
];

function table(title, key, a, b) {
  const groups = [...new Set([...a.cases, ...b.cases].map((c) => c[key]))].sort();
  const out = [`## ${title}`, '', `| group | ${COLUMNS.map(([name]) => name).join(' | ')} |`, `|---|${COLUMNS.map(() => '---').join('|')}|`];
  const row = (name, x, y) => `| ${name} | ${COLUMNS.map(([, get]) => `${get(x)} / ${get(y)}`).join(' | ')} |`;
  for (const g of groups) out.push(row(g, stats(a.cases.filter((c) => c[key] === g)), stats(b.cases.filter((c) => c[key] === g))));
  out.push(row('all', stats(a.cases), stats(b.cases)), '');
  return out;
}

const a = load(oldFile, oldAudit);
const b = load(newFile, newAudit);
const out = ['# The dev judged runs side by side: batch 12 / batch 12d', '', `Each cell reads "batch 12 / batch 12d". Runs: ${a.run.run_id} and ${b.run.run_id}. A tool call is allowed when the server did not refuse it (it may still have failed: no DNS answer, an HTTP error, a timeout); refused is every decision that starts with refused_.`, ''];
out.push(...table('Per lane', 'lane', a, b), ...table('Per mode (the mode each answer named on its first line)', 'mode', a, b));

const usd = (cases) => cases.reduce((n, c) => n + c.cost, 0).toFixed(2);
out.push(`Spent, both sessions of every case: ${usd(a.cases)} / ${usd(b.cases)} US dollars.`, '');

for (const [label, set] of [['batch 12', a], ['batch 12d', b]]) {
  const calls = set.cases.flatMap((c) => c.audit.map((x) => ({ id: c.id, ...x })));
  out.push(`## Tool server calls of ${label}: ${calls.length}`, '', '| case | tool | host | decision | reason |', '|---|---|---|---|---|');
  for (const x of calls) out.push(`| ${x.id} | ${x.tool} | ${hostOf(x.input)} | ${x.decision} | ${x.decision !== 'ok' ? String(x.reason || '').replace(/\|/g, '/').slice(0, 200) : ''} |`);
  const reached = [...new Set(calls.filter((x) => (x.addresses || []).length > 0 || x.cached).map((x) => hostOf(x.input)))].sort();
  out.push('', `Hosts a connection or a cached page was used for: ${reached.join(', ') || 'none'}.`, '');
}
process.stdout.write(`${out.join('\n')}\n`);
