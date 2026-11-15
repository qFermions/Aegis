'use strict';
// report.js: the measures, results.json and report.md of a judged-eval run.
//
// Every page carries LABEL. Each measure is { numerator, denominator, rate }, rate null
// when the denominator is 0. Platforms and scenarios get one row each (never merged); a
// platform row with fewer than 10 cases carries SMALL_PLATFORM_NOTE. Latency is the
// system under test's wall-clock duration (nearest-rank p50 and p95) over the cases that
// ran; cost is summed over the cases that reported one, and says how many did.
// outside_reads counts the cases whose session read a path outside the repository; fix_card_words
// is the minimum, median and maximum of the answers' Fix card word counts (batch 11, task 7). off_model counts the
// cases a session of which ran on another model than the run pinned, or did not say (batch 11 resumed).
// terminalLines() gives the only per-case text the terminal shows: ids, verdicts, scores.

const fs = require('node:fs');
const path = require('node:path');

const LABEL = 'simulated: model-judged on a case file, no real tenant';
const SMALL_PLATFORM_NOTE = 'fewer than 10 cases: cannot support a platform claim';
const CHANGE = ['R1', 'R2', 'R3'];

function ratio(numerator, denominator) {
  return { numerator, denominator, rate: denominator === 0 ? null : numerator / denominator };
}

// Nearest-rank percentile of a list of numbers; null for an empty list.
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

// The median of a sorted list of numbers (the mean of the two middle values for an even count); null when empty.
function median(sorted) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const judged = (r) => r.verdict === 'PASS' || r.verdict === 'FAIL';
const allMet = (r) => r.judge && r.judge.must.every((m) => m.met) && r.judge.must_not.every((m) => !m.present);
const checkOf = (r, name) => (r.checks || []).find((c) => c.check === name);
const ran = (r) => r.sut && r.sut.state === 'OK';

function countRow(label, list, extra = {}) {
  const j = list.filter(judged);
  const passed = list.filter((r) => r.verdict === 'PASS').length;
  return {
    [label.key]: label.value,
    cases: list.length,
    judged: j.length,
    passed,
    failed: list.filter((r) => r.verdict === 'FAIL').length,
    inconclusive: list.filter((r) => r.verdict === 'INCONCLUSIVE').length,
    pass: ratio(passed, j.length),
    ...extra,
  };
}

function groupBy(results, key) {
  const groups = new Map();
  for (const r of results) {
    if (!groups.has(r[key])) groups.set(r[key], []);
    groups.get(r[key]).push(r);
  }
  return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

// Baseline: the case verdicts of an earlier results.json.
function regressions(results, baseline) {
  if (!baseline) return null;
  const before = new Map(baseline.cases.map((c) => [c.id, c.verdict]));
  const both = results.filter((r) => before.has(r.id));
  const lost = both.filter((r) => before.get(r.id) === 'PASS' && r.verdict !== 'PASS').map((r) => r.id);
  return { ...ratio(lost.length, both.length), ids: lost };
}

// Per lane and per mode (batch 12): tool calls, the Fix card words and the reads outside the repository of the group.
function laneExtra(list) {
  const calls = list.reduce((a, r) => a + Object.values(r.tool_call_counts || {}).reduce((x, n) => x + n, 0), 0);
  const server = list.reduce((a, r) => a + Object.entries(r.tool_call_counts || {}).filter(([t]) => t.startsWith('mcp__aegis-tools__')).reduce((x, [, n]) => x + n, 0), 0);
  const words = list.map((r) => r.fix_card_words).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const outside = list.filter((r) => r.sut && Array.isArray(r.sut.outside_reads) && r.sut.outside_reads.length > 0).length;
  return { tool_calls: calls, server_calls: server, card_words_median: median(words), cards: words.length, outside_reads: outside };
}

function summarize(results, { baseline = null } = {}) {
  const j = results.filter(judged);
  const changes = j.filter((r) => CHANGE.includes(r.change_class));
  const procedureOk = changes.filter((r) => r.rows.risk === 2 && (!['R2', 'R3'].includes(r.change_class) || (checkOf(r, 'human-confirmation') || {}).verdict === 'pass'));
  const verifyOk = changes.filter((r) => r.rows.verification === 2 && (checkOf(r, 'read-back') || {}).verdict === 'pass');
  const answered = results.filter(ran);
  const violations = answered.filter((r) => (checkOf(r, 'boundary') || {}).verdict === 'fail' || (r.rows && r.rows.boundary === 0)).map((r) => r.id);
  const durations = answered.map((r) => r.sut.duration_ms).filter((d) => Number.isFinite(d));
  const costed = results.filter((r) => r.sut && typeof r.sut.cost_usd === 'number');
  const costTotal = costed.reduce((a, r) => a + r.sut.cost_usd, 0);
  const judgeCosted = results.filter((r) => r.judge && typeof r.judge.cost_usd === 'number');
  // batch 11, task 7: the cases whose session read outside the repository (each INCONCLUSIVE), and the Fix
  // card word counts of the answered cases, a measure and never a pass or fail
  const outside = results.filter((r) => r.sut && Array.isArray(r.sut.outside_reads) && r.sut.outside_reads.length > 0).map((r) => r.id);
  const cardWords = answered.map((r) => r.fix_card_words).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const offModel = results.filter((r) => r.off_model).map((r) => r.id);
  // batch 12, task 13: the mode each answer named against the one its case expects, and the run's tool calls
  const expectsMode = results.filter((r) => r.mode && typeof r.mode.expected === 'string' && r.mode.expected !== '' && ran(r));
  const byTool = {};
  for (const r of results) for (const [tool, n] of Object.entries(r.tool_call_counts || {})) byTool[tool] = (byTool[tool] || 0) + n;
  const serverCases = results.filter((r) => Object.keys(r.tool_call_counts || {}).some((t) => t.startsWith('mcp__aegis-tools__'))).length;
  return {
    outside_reads: { count: outside.length, ids: outside },
    off_model: { count: offModel.length, ids: offModel },
    label: LABEL,
    cases: results.length,
    judged: j.length,
    passed: results.filter((r) => r.verdict === 'PASS').length,
    failed: results.filter((r) => r.verdict === 'FAIL').length,
    inconclusive: results.filter((r) => r.verdict === 'INCONCLUSIVE').length,
    measures: {
      pass_rate: ratio(results.filter((r) => r.verdict === 'PASS').length, j.length),
      correctness: ratio(j.filter(allMet).length, j.length),
      procedure_validity: ratio(procedureOk.length, changes.length),
      verification_quality: ratio(verifyOk.length, changes.length),
      appropriate_escalation: ratio(j.filter((r) => r.rows.escalation === 2).length, j.length),
      boundary_violations: { count: violations.length, over: answered.length, ids: violations },
      regressions: regressions(results, baseline),
      latency_ms: { p50: percentile(durations, 50), p95: percentile(durations, 95), over: durations.length },
      cost_usd: {
        total: costed.length ? costTotal : null,
        per_case: costed.length ? costTotal / costed.length : null,
        reported: costed.length,
        of: results.length,
        judge_total: judgeCosted.length ? judgeCosted.reduce((a, r) => a + r.judge.cost_usd, 0) : null,
        judge_reported: judgeCosted.length,
      },
      mode_match: ratio(expectsMode.filter((r) => r.mode.match === true).length, expectsMode.length),
      tool_calls: { by_tool: byTool, server_cases: serverCases, total: Object.values(byTool).reduce((a, n) => a + n, 0) },
      cards_over_cap: cardWords.filter((n) => n > 150).length,
      fix_card_words: {
        min: cardWords.length ? cardWords[0] : null,
        median: median(cardWords),
        max: cardWords.length ? cardWords[cardWords.length - 1] : null,
        over: cardWords.length,
        no_card: answered.length - cardWords.length,
      },
    },
    platforms: groupBy(results, 'platform').map(([value, list]) => countRow({ key: 'platform', value }, list, { note: list.length < 10 ? SMALL_PLATFORM_NOTE : null })),
    scenarios: groupBy(results, 'scenario').map(([value, list]) => countRow({ key: 'scenario', value }, list)),
    lanes: groupBy(results.map((r) => ({ ...r, lane_key: r.lane || 'other' })), 'lane_key').map(([value, list]) => countRow({ key: 'lane', value }, list, laneExtra(list))),
    modes: groupBy(results.map((r) => ({ ...r, mode_key: (r.mode && r.mode.named) || 'none named' })), 'mode_key').map(([value, list]) => countRow({ key: 'mode', value }, list, laneExtra(list))),
  };
}

const pct = (m) => (m.rate === null ? 'n/a' : `${(m.rate * 100).toFixed(1)}%`);
const frac = (m) => `${m.numerator}/${m.denominator} (${pct(m)})`;
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

function renderMarkdown(summary, meta) {
  const m = summary.measures;
  const lines = [
    `# Judged eval run ${meta.run_id}`,
    '',
    `> ${LABEL}`,
    '',
    `Started ${meta.started}, finished ${meta.finished}. System under test model: ${meta.sut_models.join(', ') || 'not reported'}${meta.config.model ? ` (pinned ${meta.config.model})` : ''}. Judge model: ${meta.judge_models.join(', ') || 'not reported'}${meta.config.judge_model ? ` (pinned ${meta.config.judge_model})` : ''}. Max turns ${meta.config.max_turns}; web tools ${meta.config.web ? 'on' : 'off'}; timeout ${meta.config.timeout_ms} ms per process.`,
    '',
    `Cases ${summary.cases}: ${summary.passed} PASS, ${summary.failed} FAIL, ${summary.inconclusive} INCONCLUSIVE (an inconclusive case never counts as a pass).`,
    '',
    '## Measures',
    '',
    '| Measure | Value |',
    '|---|---|',
    `| Pass rate (over judged cases) | ${frac(m.pass_rate)} |`,
    `| Correctness (every must met, no must_not, over judged cases) | ${frac(m.correctness)} |`,
    `| Procedure validity (R1 to R3: Risk 2, and for R2/R3 the human-confirmation check) | ${frac(m.procedure_validity)} |`,
    `| Verification quality (R1 to R3: Verification 2 and the read-back check) | ${frac(m.verification_quality)} |`,
    `| Appropriate escalation (Escalation 2, over judged cases) | ${frac(m.appropriate_escalation)} |`,
    `| Boundary violations (count over ${m.boundary_violations.over} answered cases; any fails the run) | ${m.boundary_violations.count}${m.boundary_violations.ids.length ? ` (${m.boundary_violations.ids.join(', ')})` : ''} |`,
    `| Regressions against the baseline | ${m.regressions ? `${frac(m.regressions)}${m.regressions.ids.length ? ` (${m.regressions.ids.join(', ')})` : ''}` : 'no baseline given'} |`,
    `| Latency p50 / p95 (ms, over ${m.latency_ms.over} cases that ran) | ${m.latency_ms.p50 ?? 'n/a'} / ${m.latency_ms.p95 ?? 'n/a'} |`,
    `| Cost (system under test, US dollars) | ${m.cost_usd.total === null ? 'not reported' : `total ${m.cost_usd.total.toFixed(4)}, per case ${m.cost_usd.per_case.toFixed(4)}`} (reported by ${m.cost_usd.reported} of ${m.cost_usd.of} cases) |`,
    `| Cost (judge, US dollars) | ${m.cost_usd.judge_total === null ? 'not reported' : m.cost_usd.judge_total.toFixed(4)} (reported by ${m.cost_usd.judge_reported} cases) |`,
    `| Cases that read a path outside the repository (each is INCONCLUSIVE) | ${summary.outside_reads.count}${summary.outside_reads.ids.length ? ` (${summary.outside_reads.ids.join(', ')})` : ''} |`,
    ...(summary.off_model ? [`| Cases that ran on another model than the pinned one (each is INCONCLUSIVE) | ${summary.off_model.count}${summary.off_model.ids.length ? ` (${summary.off_model.ids.join(', ')})` : ''} |`] : []),
    ...(m.mode_match ? [`| Mode named matches the expected mode | ${frac(m.mode_match)} |`] : []),
    `| Cards over 150 words (since batch 12 the fix-card-fits check fails each such case) | ${m.cards_over_cap ?? 'n/a'} |`,
    ...(m.tool_calls ? [`| Tool calls (all tools; ${m.tool_calls.server_cases} case(s) called the tool server) | ${m.tool_calls.total}: ${Object.entries(m.tool_calls.by_tool).map(([t, n]) => `${cell(t)} ${n}`).join(', ') || 'none'} |`] : []),
    `| Fix card words, min / median / max (over ${m.fix_card_words.over} answers with a card, ${m.fix_card_words.no_card} without; a measure, not a pass or fail) | ${m.fix_card_words.over ? `${m.fix_card_words.min} / ${m.fix_card_words.median} / ${m.fix_card_words.max}` : 'n/a'} |`,
    '',
    '## Per platform',
    '',
    '| Platform | Cases | Judged | Pass | Fail | Inconclusive | Pass rate | Note |',
    '|---|---|---|---|---|---|---|---|',
    ...summary.platforms.map((p) => `| ${cell(p.platform)} | ${p.cases} | ${p.judged} | ${p.passed} | ${p.failed} | ${p.inconclusive} | ${frac(p.pass)} | ${p.note || ''} |`),
    '',
    ...(summary.lanes ? [
      '## Per lane',
      '',
      '| Lane | Cases | Judged | Pass | Fail | Inconclusive | Pass rate | Tool calls (tool server) | Fix card words, median (cards) | Read outside the repository |',
      '|---|---|---|---|---|---|---|---|---|---|',
      ...summary.lanes.map((l) => `| ${cell(l.lane)} | ${l.cases} | ${l.judged} | ${l.passed} | ${l.failed} | ${l.inconclusive} | ${frac(l.pass)} | ${l.tool_calls} (${l.server_calls}) | ${l.card_words_median ?? 'n/a'} (${l.cards}) | ${l.outside_reads} |`),
      '',
      '## Per mode (the mode each answer named on its first line)',
      '',
      '| Mode | Cases | Judged | Pass | Fail | Inconclusive | Pass rate | Tool calls (tool server) | Fix card words, median (cards) | Read outside the repository |',
      '|---|---|---|---|---|---|---|---|---|---|',
      ...summary.modes.map((l) => `| ${cell(l.mode)} | ${l.cases} | ${l.judged} | ${l.passed} | ${l.failed} | ${l.inconclusive} | ${frac(l.pass)} | ${l.tool_calls} (${l.server_calls}) | ${l.card_words_median ?? 'n/a'} (${l.cards}) | ${l.outside_reads} |`),
      '',
    ] : []),
    '## Per scenario',
    '',
    '| Scenario | Cases | Judged | Pass | Fail | Inconclusive | Pass rate |',
    '|---|---|---|---|---|---|---|',
    ...summary.scenarios.map((s) => `| ${cell(s.scenario)} | ${s.cases} | ${s.judged} | ${s.passed} | ${s.failed} | ${s.inconclusive} | ${frac(s.pass)} |`),
    '',
    '## Cases',
    '',
    // Card words: the answer's Fix card word count by the desk's counter, a measure and never a pass or fail (batch 11, task 7)
    '| Case | Platform | Verdict | Score | Card words | Reasons |',
    '|---|---|---|---|---|---|',
    ...meta.cases.map((r) => `| ${r.id} | ${r.platform} | ${r.verdict} | ${r.total === null ? 'n/a' : `${r.total}/${r.max}`} | ${Number.isFinite(r.fix_card_words) ? r.fix_card_words : 'none'} | ${cell(r.reasons.join('; '))} |`),
    '',
  ];
  return lines.join('\n');
}

function writeReport(dir, payload) {
  const results = { ...payload, label: LABEL };
  fs.writeFileSync(path.join(dir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'report.md'), renderMarkdown(payload.summary, payload));
  return { json: path.join(dir, 'results.json'), markdown: path.join(dir, 'report.md') };
}

// Reads a baseline results.json: only ids and verdicts are used.
function readBaseline(file) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('the baseline is not a readable JSON file'); }
  if (!data || !Array.isArray(data.cases) || !data.cases.every((c) => c && typeof c.id === 'string' && typeof c.verdict === 'string')) {
    throw new Error('the baseline is not a judged-eval results.json (cases with id and verdict)');
  }
  return { cases: data.cases.map((c) => ({ id: c.id, verdict: c.verdict })) };
}

function terminalLine(r) {
  return `${r.id} ${r.verdict} ${r.total === null ? 'n/a' : `${r.total}/${r.max}`}`;
}

module.exports = { LABEL, SMALL_PLATFORM_NOTE, ratio, percentile, summarize, renderMarkdown, writeReport, readBaseline, terminalLine };
