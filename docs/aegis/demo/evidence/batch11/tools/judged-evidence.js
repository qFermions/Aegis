'use strict';
// judged-evidence.js <out-dir> <results-dir>: turns one judged run's results folder (outside the repository) into
// its saved evidence: report.md and results.json with this machine's paths written <home>, <repo>, <tmp>, and
// summary.md: one row per case with its rule group, verdict, score, Fix card words, cost and what failed it; the
// counts per group; the reads outside the repository; the cost against the run's limit. Batch 11, task 8.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const home = os.homedir();
const account = os.userInfo().username;
const clean = (s) => String(s)
  .replaceAll(repo, '<repo>').replaceAll(home, '<home>')
  .replace(/\/(?:private\/)?(?:tmp|var\/folders)\/[^\s"'\]<\\]*/g, '<tmp>')
  .replace(new RegExp(`-Users-${account}-`, 'g'), '-Users-<account>-')
  .replace(new RegExp(`\\b${account}\\b`, 'g'), '<account>')
  .replaceAll(String.fromCharCode(0x2014), '-');
const cell = (s) => (s === undefined || s === null || s === '' ? 'none' : String(s).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim());
const money = (n) => (typeof n === 'number' ? n.toFixed(2) : 'none');

const [out, resultsDir] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const run = JSON.parse(fs.readFileSync(path.join(resultsDir, 'results.json'), 'utf8'));
fs.writeFileSync(path.join(out, 'report.md'), clean(fs.readFileSync(path.join(resultsDir, 'report.md'), 'utf8')));
fs.writeFileSync(path.join(out, 'results.json'), clean(fs.readFileSync(path.join(resultsDir, 'results.json'), 'utf8')));

// The rule a batch 11 case was written for, from its scenario name; the eight earlier cases are batch G4's.
const GROUPS = [
  ['a new way in before the old way out', /lost-phone|replaced-phone/], ['who else, and what left', /open-to-anyone|wrong-group/],
  ['how wide before why', /will-not-load|cannot-reach/], ['every change carries its class and double-check', /new-starter-plan|rename-and-grants/],
  ['sender authentication (mail)', /spf-dkim|unauthenticated-sender/], ['offboarding', /leaver/], ['ask first', /^ask-first-/], ['a setup was given', /^setup-/],
];
const groupOf = (c) => { const n = Number(c.id.replace(/\D/g, '')); if (n <= 8) return 'batch G4 case'; const g = GROUPS.find(([, re]) => re.test(c.scenario)); return g ? g[0] : 'other'; };
const caseCost = (c) => (c.sut && typeof c.sut.cost_usd === 'number' ? c.sut.cost_usd : 0) + (c.judge && typeof c.judge.cost_usd === 'number' ? c.judge.cost_usd : 0);
const failedItems = (c) => {
  if (!c.judge || !Array.isArray(c.judge.must)) return [];
  return [...c.judge.must.filter((m) => !m.met).map((m) => `must not met: ${m.item}`), ...c.judge.must_not.filter((m) => m.present).map((m) => `must_not present: ${m.item}`)];
};
// The rule a deterministic check enforces and the line of checks.js that implements it (evidence review: name the
// rule and its line for every failed case).
const checksSrc = fs.readFileSync(path.join(repo, 'scripts/eval/judged/checks.js'), 'utf8').split('\n');
const ruleOf = (name) => {
  const fn = `function check${name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')}(`;
  const at = checksSrc.findIndex((l) => l.startsWith(fn));
  const doc = checksSrc.find((l) => new RegExp(`^//\\s+${name}\\s`).test(l));
  return `${doc ? doc.replace(/^\/\/\s+\S+\s+/, '').trim() : name} (scripts/eval/judged/checks.js:${at + 1})`;
};
// a short answer is quoted whole (the ask-first cases), so the lines that failed it are on the page
const shortAnswer = (c) => (c.sut && typeof c.sut.answer === 'string' && c.sut.answer.split(/\s+/).length <= 80 ? [`  - the answer, whole: "${cell(c.sut.answer)}"`] : []);
const lines = [`# The dev judged run of batch 11: ${run.cases.length} cases, run ${run.run_id}`, '',
  'The cases are the builder\'s own, written next to the rules they test, so this run shows the pipeline and the rules at work and is not an independent measure of answer quality. No case text is shown here; the ids and scenario names are in `scripts/eval/judged/dev-cases.jsonl`.', '',
  `Models: system under test ${cell((run.sut_models || []).join(', '))} (pinned ${cell(run.config && run.config.model)}); judge ${cell((run.judge_models || []).join(', '))} (pinned ${cell(run.config && run.config.judge_model)}); cases on another model than the pin (each INCONCLUSIVE): ${run.summary && run.summary.off_model ? `${run.summary.off_model.count}${run.summary.off_model.ids.length ? ` (${run.summary.off_model.ids.join(', ')})` : ''}` : 'not recorded'}. Limit: ${run.config && run.config.budget_usd !== null && run.config.budget_usd !== undefined ? `${money(run.config.budget_usd)} US dollars` : 'none'}; spent ${money(run.spent_usd)} US dollars. ${cell(run.verdict && run.verdict.line)}`, '',
  '| case | platform | written for | setup given | model (system under test / judge) | verdict | score | Fix card words | cost | reads outside the repository | what failed it |', '|---|---|---|---|---|---|---|---|---|---|---|',
  ...run.cases.map((c) => `| ${c.id} | ${c.platform} | ${groupOf(c)} | ${c.setup_given ? 'yes' : 'no'} | ${cell([...new Set((c.sut && c.sut.turns ? c.sut.turns : [c.sut || {}]).map((x) => x.model))].join(', '))} / ${cell(c.judge && c.judge.model)} | ${c.verdict} | ${c.total === null ? 'n/a' : `${c.total}/${c.max}`} | ${Number.isFinite(c.fix_card_words) ? c.fix_card_words : 'no card'} | ${money(caseCost(c))} | ${c.sut && (c.sut.outside_reads || []).length ? cell(c.sut.outside_reads.join(', ')) : 'none'} | ${cell(c.reasons.join('; '))} |`), ''];
const groups = [...new Set(run.cases.map(groupOf))];
lines.push('## Per group', '', '| written for | cases | pass | fail | inconclusive |', '|---|---|---|---|---|',
  ...groups.map((g) => { const list = run.cases.filter((c) => groupOf(c) === g); const n = (v) => list.filter((c) => c.verdict === v).length; return `| ${g} | ${list.length} | ${n('PASS')} | ${n('FAIL')} | ${n('INCONCLUSIVE')} |`; }), '');
const words = run.cases.map((c) => c.fix_card_words).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
const median = words.length ? (words.length % 2 ? words[(words.length - 1) / 2] : (words[words.length / 2 - 1] + words[words.length / 2]) / 2) : null;
const count = (v) => run.cases.filter((c) => c.verdict === v).length;
const outside = run.cases.filter((c) => c.sut && (c.sut.outside_reads || []).length);
const calls = run.cases.reduce((a, c) => a + ((c.sut && c.sut.tool_calls) || []).length, 0);
const refused = run.cases.reduce((a, c) => a + ((c.sut && c.sut.tool_calls) || []).filter((x) => x.error).length, 0);
lines.push('## Totals', '',
  `- Cases: ${run.cases.length}; pass ${count('PASS')}, fail ${count('FAIL')}, inconclusive ${count('INCONCLUSIVE')}.`,
  `- Fix card words over the ${words.length} answers with a card: minimum ${words.length ? words[0] : 'n/a'}, median ${median ?? 'n/a'}, maximum ${words.length ? words[words.length - 1] : 'n/a'}; ${run.cases.filter((c) => c.sut && c.sut.state === 'OK' && !Number.isFinite(c.fix_card_words)).length} answered case(s) with no card.`,
  `- Reads outside the repository: ${outside.length} case(s)${outside.length ? ` (${outside.map((c) => c.id).join(', ')})` : ''}. Tool calls recorded: ${calls}, of which ${refused} were refused or failed.`,
  `- Cost: ${money(run.cases.reduce((a, c) => a + caseCost(c), 0))} US dollars (system under test ${money(run.cases.reduce((a, c) => a + (c.sut && typeof c.sut.cost_usd === 'number' ? c.sut.cost_usd : 0), 0))}, judge ${money(run.cases.reduce((a, c) => a + (c.judge && typeof c.judge.cost_usd === 'number' ? c.judge.cost_usd : 0), 0))}).`, '');
lines.push('## Every failed case: the item or check that failed it', '',
  'A case fails on a `must` item the judge marked not met, a `must_not` item it marked present, a deterministic check (`scripts/eval/judged/checks.js`), a row scored 0 on Risk, Privacy, Continuity or Boundary, or a total under 70% (`scripts/eval/judged/judge.js`, `caseVerdict`).', '',
  ...run.cases.filter((c) => c.verdict !== 'PASS').flatMap((c) => [`- **${c.id}** (${c.verdict}): ${cell(c.reasons.join('; '))}`, ...failedItems(c).map((x) => `  - ${cell(x)}`), ...(c.checks || []).filter((k) => k.verdict !== 'pass').map((k) => `  - check ${k.check} ${k.verdict}: ${ruleOf(k.check)}${k.span ? `; matched "${cell(k.span).slice(0, 160)}"` : '; the answer holds no line that meets it'}`), ...shortAnswer(c), ...(c.judge && c.judge.notes ? [`  - judge's note, whole: ${cell(c.judge.notes)}`] : [])]), '');
fs.writeFileSync(path.join(out, 'summary.md'), clean(lines.join('\n')));
console.log(clean(lines.join('\n')));
