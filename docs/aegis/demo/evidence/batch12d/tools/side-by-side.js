#!/usr/bin/env node
'use strict';
// side-by-side.js <batch 12 results.json> <batch 12 audit dir> <batch 12d results.json> <batch 12d audit dir> <cases.jsonl>
// The two dev judged runs side by side, per lane and per mode (batch 12d, task 7): pass, fail, Fix card words (median,
// count over 150), human-confirmation and read-back failures, tool server calls allowed and refused, reads outside the
// repository, and reads of this repository's .git. Then every host the tool server reached and every refused call of
// the second run. Each cell reads "batch 12 / batch 12d". Reads local files only and calls no model; prints Markdown.
// Each run loaded its checks when it started, so every saved answer is also scored again with the checks at the current
// commit (the deterministic checks rerun, the verdict recomputed from the judge's saved result, as batch 12's
// judged-summary.js does): "pass as run" and "pass with the checks at head" are both shown, and the two check columns
// use the checks at head. A tool call is allowed when the server answered it (decision ok), refused when the decision
// starts with refused_, and other for the rest (bad input, the call cap, a timeout, a DNS, HTTP or TLS failure), the
// way backends.toolServerRecord and report.md count them.
// The audit files are <audit dir>/<case id>-tool-audit.jsonl, one JSON line per call (scripts/mcp/aegis-tools/server.js).
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const checks = require(path.join(repo, 'scripts/eval/judged/checks.js'));
const expert = require(path.join(repo, 'scripts/demo/expert-rules.js'));
const judge = require(path.join(repo, 'scripts/eval/judged/judge.js'));
const { readCaseFile } = require(path.join(repo, 'scripts/eval/judged/cases.js'));

const [oldFile, oldAudit, newFile, newAudit, casesFile] = process.argv.slice(2);
if (!casesFile) {
  process.stderr.write('Usage: node side-by-side.js <batch 12 results.json> <batch 12 audit dir> <batch 12d results.json> <batch 12d audit dir> <cases.jsonl>\n');
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

const byCase = new Map(readCaseFile(casesFile).cases.map((c) => [c.id, c]));
const PIN = 'claude-opus-5-5';

function load(file, auditDir) {
  const run = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cases = run.cases.map((r) => {
    const audit = [];
    try {
      for (const line of fs.readFileSync(path.join(auditDir, `${r.id}-tool-audit.jsonl`), 'utf8').split('\n')) if (line.trim()) audit.push(JSON.parse(line));
    } catch (e) { if (e.code !== 'ENOENT') throw e; } // a case that made no call has no file
    // the checks at head on the saved answer; a case that did not run to a judged answer keeps what it had
    const c = byCase.get(r.id);
    let det = r.checks || [];
    let head = r.verdict;
    if (c && r.sut && r.sut.state === 'OK' && r.judge && r.judge.state === 'OK') {
      det = [...checks.runChecks(c, r.sut), ...expert.judgedChecks(c, r.sut)];
      head = judge.caseVerdict(c, r.sut, det, r.judge, { sut: PIN, judge: PIN }).verdict;
    }
    const failed = (name) => det.some((x) => x.check === name && x.applies && x.verdict === 'fail');
    const git = ((r.sut && r.sut.tool_calls) || []).filter(namesGit);
    return {
      id: r.id, lane: r.lane || 'none', mode: (r.mode && r.mode.named) || 'none named', verdict: r.verdict, head,
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
    headPass: cases.filter((c) => c.head === 'PASS').length, headFail: cases.filter((c) => c.head === 'FAIL').length,
    other: cases.filter((c) => c.verdict !== 'PASS' && c.verdict !== 'FAIL').length,
    cards: cards.length, median: median(cards), over: cards.filter((w) => w > 150).length,
    confirmation: cases.filter((c) => c.confirmation).length, readBack: cases.filter((c) => c.readBack).length,
    allowed: calls.filter((a) => a.decision === 'ok').length, refused: calls.filter(isRefused).length, otherCalls: calls.filter((a) => a.decision !== 'ok' && !isRefused(a)).length,
    outside: cases.reduce((n, c) => n + c.outside, 0), gitTried: cases.reduce((n, c) => n + c.gitTried, 0), gitRead: cases.reduce((n, c) => n + c.gitRead, 0),
  };
}

const COLUMNS = [
  ['cases', (s) => s.cases], ['pass as run', (s) => s.pass], ['fail as run', (s) => s.fail], ['pass with the checks at head', (s) => s.headPass], ['fail with the checks at head', (s) => s.headFail], ['inconclusive or error', (s) => s.other],
  ['Fix cards', (s) => s.cards], ['card words, median', (s) => s.median], ['cards over 150', (s) => s.over],
  ['human-confirmation fails', (s) => s.confirmation], ['read-back fails', (s) => s.readBack],
  ['tool calls allowed', (s) => s.allowed], ['tool calls refused', (s) => s.refused], ['tool calls other', (s) => s.otherCalls], ['reads outside the repository', (s) => s.outside],
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
const out = ['# The dev judged runs side by side: batch 12 / batch 12d', '', `Each cell reads "batch 12 / batch 12d". Runs: ${a.run.run_id} and ${b.run.run_id}. A tool call is allowed when the server answered it (decision ok), refused when the decision starts with refused_, and other for the rest (bad input, the call cap, a timeout, a DNS, HTTP or TLS failure). The human-confirmation and read-back columns, and "with the checks at head", come from the checks at the current commit on the saved answers; no model is called.`, ''];
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
