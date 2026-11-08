'use strict';
// run-evidence.js <out-dir> <title> <run-dir> --ticket-set <tidy|messy> --before <evidence dir> [--before-t9m <dir>]:
// turns one batch 10 run folder into its saved evidence, as batch 9's tool does (desk.html, each init event, each
// answer), and writes summary.md: one row per ticket with what stopped it, as the exact answer or runbook line and
// the desk rule (the customer-desk.js line that closed it); the gates each action block lists; the side by side
// against the run named by --before (full-run-4 or full-run-5) and, for T9m, batch 9b's run. Earlier closing states,
// costs and lightest-step rows are read from the earlier summary.md; earlier gates from the earlier answers. Local
// paths are written <home>, <repo>, <tmp>; the fictional customers' domains as [@Aegion_DOMAIN]; each long dash as -.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const render = require(path.join(repo, 'scripts/demo/render.js'));
const { answerStats } = require(path.join(repo, 'scripts/demo/customer-desk.js'));
const a = require(path.join(repo, 'scripts/demo/answer.js'));
const { catalog, namedGates, closingGateLines, says_none } = require(path.join(repo, 'scripts/demo/catalog.js'));
const { gateFields } = require(path.join(repo, 'scripts/audit/change-record.js'));
const home = os.homedir();
const account = os.userInfo().username;
const clean = (s) => String(s)
  .replaceAll(repo, '<repo>').replaceAll(home, '<home>')
  .replace(/\/(?:private\/)?(?:tmp|var\/folders)\/[^\s"'\]<]*/g, '<tmp>')
  .replace(new RegExp(`-Users-${account}-`, 'g'), '-Users-<account>-')
  .replace(new RegExp(`\\b${account}\\b`, 'g'), '<account>')
  .replace(/@[a-z0-9-]+\.example\.(?:com|org|net)\b/g, '@[@Aegion_DOMAIN]')
  .replaceAll(String.fromCharCode(0x2014), '-');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const cell = (s) => (s === undefined || s === null || s === '' ? 'none' : String(s).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim());
const money = (n) => (n === null || n === undefined ? 'none' : Number(n).toFixed(2));

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const before = flag('--before');
const beforeT9m = flag('--before-t9m');
flag('--ticket-set');
const [out, title, runDir] = argv;
fs.mkdirSync(path.join(out, 'init'), { recursive: true });
fs.mkdirSync(path.join(out, 'answers'), { recursive: true });
const run = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'));
const files = walk(runDir);
const fileOf = (id, suffix) => files.find((f) => path.basename(f) === `${id}${suffix}`);
fs.writeFileSync(path.join(out, 'desk.html'), clean(fs.readFileSync(path.join(runDir, 'desk.html'), 'utf8')));
const answers = new Map();
for (const t of run.tickets) {
  const init = fileOf(t.id, '-init.json');
  if (init) fs.writeFileSync(path.join(out, 'init', `${t.id}-init.json`), clean(fs.readFileSync(init, 'utf8')));
  const answer = fileOf(t.id, '-answer.md');
  if (answer) {
    const text = fs.readFileSync(answer, 'utf8');
    answers.set(t.id, text);
    fs.writeFileSync(path.join(out, 'answers', `${t.id}-answer.txt`), clean(text).replace(/\n*$/, '\n'));
  }
}
const step = (t, n) => t.steps.find((s) => s.n === n);
const cost = (t) => { const s = step(t, 4); return s && typeof s.cost_usd === 'number' ? s.cost_usd : null; };
const row5 = (t, check) => { const s = step(t, 5); const r = s && (s.answer_checks || []).find((c) => c.check === check); return r ? r.verdict : 'not reached'; };

// The desk line that closed a ticket: the close() call whose fixed words the reason carries.
const DESK = fs.readFileSync(path.join(repo, 'scripts/demo/customer-desk.js'), 'utf8').split('\n');
const REASONS = [
  [/cannot be proved by a read-back/, 'at least one change cannot be proved'], [/names no gate the runbooks know/, 'names no gate the runbooks know'],
  [/which no runbook holds as a gate/, 'which no runbook holds as a gate'], [/PREVIEW ONLY marker/, 'a PREVIEW ONLY marker in'],
  [/advises looking first/, 'advises looking first'], [/contradicts itself/, 'contradicts itself'], [/read-back shows the change was not done/, 'read-back shows the change was not done'],
  [/boundary check matched/, 'the boundary check matched'], [/probe check matched/, 'the probe check matched'], [/intake refused/, 'intake refused the ticket'],
  [/could not finish/, 'the desk could not finish'],
];
function deskLine(t) {
  const hit = REASONS.find(([re]) => re.test(t.reason || ''));
  const want = hit ? hit[1] : null;
  const i = DESK.findIndex((l) => /return close\(/.test(l) && l.includes(`'${t.closing_state}'`) && (!want || l.includes(want)));
  return i < 0 ? 'scripts/demo/customer-desk.js' : `scripts/demo/customer-desk.js:${i + 1}`;
}
const gates = catalog();
const rel = (f) => path.relative(repo, f);
function readBackLine(id) {
  const g = gates.get(id);
  if (!g || g.kind !== 'gate') return `${id} (no SAFETY GATE)`;
  const f = gateFields(fs.readFileSync(g.file, 'utf8')).find((x) => x.id === id);
  return f && f.readBack ? `${rel(g.file)}:${f.readBack.line} (${id}: Read-back: ${cell(f.readBack.value).slice(0, 90)})` : `${rel(g.file)} (${id})`;
}
// What stopped one ticket: the answer or runbook line, then the desk rule.
function stopped(t, answer) {
  const s = t.closing_state;
  if (s === 'RESOLVED (SIMULATED)') return 'none';
  const rule = `${deskLine(t)}: ${cell(t.reason || s)}`;
  if (s === 'INCONCLUSIVE') {
    const rb = step(t, 8);
    const ids = [...new Set(String((rb && rb.output) || '').split('\n').map((l) => /^([a-z0-9]+(?:-[a-z0-9]+)+): INCONCLUSIVE/.exec(l.trim())).filter(Boolean).map((m) => m[1]))];
    return `${ids.map(readBackLine).join('; ') || 'a read-back that did not pass'}; rule ${rule}`;
  }
  if (!answer) return `no answer; rule ${rule}`;
  const values = closingGateLines(answer).values;
  if (values.some(says_none)) {
    const look = a.onlyLooks(answer);
    if (s === 'OPEN' && look.change) {
      const k = look.steps.findIndex((x) => a.stepChange(x) === look.change);
      return `answer step ${k + 1}: "${cell(look.steps[k] || '')}" (its verb "${look.change}" is a change word, so the answer does not only look); rule ${rule}`;
    }
    if (s === 'CLARIFY') {
      // the first line of the answer's own text (outside the closing block and any fence) that asks something
      let fenced = false;
      const asked = closingGateLines(answer).body.split(/\r?\n/).find((l) => { if (/^\s*```/.test(l)) { fenced = !fenced; return false; } return !fenced && /[A-Za-z0-9)\]]\?+(?=[\s*_)"'”’]|$)/.test(l); });
      return `answer line "${cell(asked || '')}" asks a question with Gate: none; rule ${deskLine(t)}: CLARIFY`;
    }
    return `answer line "Gate: none"; rule ${rule}`;
  }
  return `answer lines ${values.map((v) => `"Gate: ${v}"`).join(', ')}; rule ${rule}`;
}

const blockGates = (answer) => (answer ? namedGates(answer).join(', ') || 'none' : 'no answer');
const lines = [`# ${title}: one row per ticket`, '',
  '| ticket | closing state | Fix card words | what stopped it: the line, then the desk rule | gates the action block lists | lightest step first | cost in US dollars |',
  '|---|---|---|---|---|---|---|',
  ...run.tickets.map((t) => `| ${t.id} | ${t.closing_state} | ${(t.answer_stats || {}).fix_card_words ?? 'no answer'} | ${cell(stopped(t, answers.get(t.id)))} | ${blockGates(answers.get(t.id))} | ${row5(t, 'lightest-step-first')} | ${money(cost(t))} |`), '',
  `Run totals: ${render.summaryLines(run.summary).join('; ')}`, ...(run.not_run || []).map((n) => `Did not run: ${n.id}, because ${n.reason}.`), '',
  'Reasons, as the desk wrote them:', '', ...run.tickets.map((t) => `- ${t.id}: ${(t.reason || 'none').replace(/\s+/g, ' ')}`), '',
  'The two messages to the user, word for word:', '', '| ticket | Tell the user now | user message now check | Tell the user when done |', '|---|---|---|---|',
  ...run.tickets.map((t) => { const c = answers.has(t.id) ? a.fixCard(answers.get(t.id)) : { parts: {} }; return `| ${t.id} | ${cell(c.parts.tellNow)} | ${row5(t, 'user-message-now')} | ${cell(c.parts.tellDone)} |`; }), ''];

// An earlier summary.md row: batch 9's format (nine columns) and this tool's (seven).
function earlier(dir) {
  const rows = new Map();
  if (!dir) return rows;
  for (const l of fs.readFileSync(path.join(dir, 'summary.md'), 'utf8').split('\n')) {
    const cells = l.split(/(?<!\\)\|/).slice(1, -1).map((x) => x.trim());
    if (!/^T\d+m?$/.test(cells[0] || '') || !/^[A-Z][A-Z ()]+$/.test(cells[1] || '')) continue;
    if (rows.has(cells[0])) continue;
    const answerFile = path.join(dir, 'answers', `${cells[0]}-answer.txt`);
    const answer = fs.existsSync(answerFile) ? fs.readFileSync(answerFile, 'utf8') : null;
    rows.set(cells[0], { state: cells[1], words: cells[2], lightest: cells[cells.length - 2], cost: cells[cells.length - 1], gates: blockGates(answer) });
  }
  return rows;
}
if (before) {
  const old = earlier(before);
  const old9b = earlier(beforeT9m);
  const name = path.basename(before);
  lines.push(`## Side by side with ${name}${beforeT9m ? ' and, for T9m, batch 9b' : ''}`, '',
    `| ticket | closing state, ${name} | closing state, now | Fix card words, ${name} | Fix card words, now | lightest step first, ${name} | lightest step first, now | cost ${name} | cost now |`,
    '|---|---|---|---|---|---|---|---|---|');
  for (const t of run.tickets) {
    const o = old.get(t.id) || {};
    lines.push(`| ${t.id} | ${o.state || 'not run'} | ${t.closing_state} | ${o.words || 'none'} | ${(t.answer_stats || {}).fix_card_words ?? 'none'} | ${o.lightest || 'none'} | ${row5(t, 'lightest-step-first')} | ${o.cost || 'none'} | ${money(cost(t))} |`);
  }
  lines.push('');
  const t9 = run.tickets.find((x) => x.id === 'T9m');
  if (beforeT9m && t9) {
    const o9 = old9b.get('T9m') || {};
    const o4 = old.get('T9m') || {};
    lines.push('## T9m: batch 9 and batch 9b against now', '', '| run | closing state | Fix card words | gates the action block lists | lightest step first | cost |', '|---|---|---|---|---|---|',
      `| ${name} (batch 9) | ${o4.state || 'none'} | ${o4.words || 'none'} | ${o4.gates || 'none'} | ${o4.lightest || 'none'} | ${o4.cost || 'none'} |`,
      `| batch 9b | ${o9.state || 'none'} | ${o9.words || 'none'} | ${o9.gates || 'none'} | ${o9.lightest || 'none'} | ${o9.cost || 'none'} |`,
      `| now | ${t9.closing_state} | ${(t9.answer_stats || {}).fix_card_words ?? 'none'} | ${blockGates(answers.get('T9m'))} | ${row5(t9, 'lightest-step-first')} | ${money(cost(t9))} |`, '');
  }
}
fs.writeFileSync(path.join(out, 'summary.md'), clean(lines.join('\n')));
console.log(clean(lines.join('\n')));
