'use strict';
// run-evidence.js <out-dir> <title> <run-dir> --ticket-set <tidy|messy> [--before <batch 8 evidence dir>]: turns one
// batch 9 run folder into its saved evidence: desk.html, each init event, each answer, a summary table with the two
// messages to the user word for word, and, with --before, the side-by-side against batch 8's run of the same set
// (closing state, Fix card words, the user messages, the new user-message check applied to both, cost). batch 8's
// closing states and costs are read from its saved summary.md, its messages from its saved answers.
// The thinking-rules table reads each answer by rule, not by meaning (named under the table): a person should
// read the answers. Local paths are written <home>, <repo>, <tmp>; the fictional customers' domains as
// [@Aegion_DOMAIN]; each long dash as -. No stream or debug log is copied.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const render = require(path.join(repo, 'scripts/demo/render.js'));
const { answerStats } = require(path.join(repo, 'scripts/demo/customer-desk.js'));
const a = require(path.join(repo, 'scripts/demo/answer.js'));
const data = require(path.join(repo, 'scripts/demo/customers.js'));
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

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const before = flag('--before');
const set = flag('--ticket-set') || 'tidy';
const [out, title, runDir] = argv;
fs.mkdirSync(path.join(out, 'init'), { recursive: true });
fs.mkdirSync(path.join(out, 'answers'), { recursive: true });
const run = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'));
const files = walk(runDir);
const fileOf = (id, suffix) => files.find((f) => path.basename(f) === `${id}${suffix}`);
const tickets = new Map(data.loadData(set === 'messy' ? 'messy' : undefined).tickets.map((t) => [t.id, t]));
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
const cost = (t) => { const m = t.steps.find((s) => s.n === 4); return m && typeof m.cost_usd === 'number' ? m.cost_usd : null; };
const money = (n) => (n === null || n === undefined ? 'none' : Number(n).toFixed(2));
const row5 = (t, check) => { const s = t.steps.find((x) => x.n === 5); const r = s && (s.answer_checks || []).find((c) => c.check === check); return r ? r.verdict : 'not reached'; };
const ticketText = (id) => { const t = tickets.get(id); if (!t) return ''; try { return JSON.stringify(t); } catch { return ''; } };

const lines = [`# ${title}: one row per ticket`, '',
  '| ticket | closing state | Fix card words | what stopped it, in plain words | Tell the user now | Tell the user when done | user message now check | lightest step first | cost in US dollars |',
  '|---|---|---|---|---|---|---|---|---|',
  ...run.tickets.map((t) => {
    const card = answers.has(t.id) ? a.fixCard(answers.get(t.id)) : { parts: {} };
    const s = t.answer_stats || {};
    return `| ${t.id} | ${t.closing_state} | ${s.fix_card_words ?? 'no answer'} | ${cell(render.closingPlain(t))} | ${cell(card.parts.tellNow)} | ${cell(card.parts.tellDone)} | ${row5(t, 'user-message-now')} | ${row5(t, 'lightest-step-first')} | ${money(cost(t))} |`;
  }), '',
  `Run totals: ${render.summaryLines(run.summary).join('; ')}`, ...(run.not_run || []).map((n) => `Did not run: ${n.id}, because ${n.reason}.`), '',
  'Reasons, as the desk wrote them:', '', ...run.tickets.map((t) => `- ${t.id}: ${(t.reason || 'none').replace(/\s+/g, ' ')}`), ''];

// The three thinking rules (docs/aegis/answer-format.md, section 2), read by rule:
// - what changed: applies when the ticket names a recent change; passes when the card's first step names it.
// - lightest step first: the desk's own row at step 5.
// - look before guessing: applies to a sign-in, MFA, account or device ticket; passes when the first step reads a log,
//   a sign-in record, an audit log or a device status.
const CHANGE_IN_TICKET = /\b(update[ds]?|upgrade[ds]?|new (?:phone|laptop|mac|device)|got a new|changed? (?:my )?(?:phone|password)|password (?:change|reset)|moved|policy)\b/i;
const LOOK_TICKET = /\b(sign[- ]?in|log ?in|login|mfa|authenticator|okta|verify|locked|account|password|laptop|macbook|device|phone)\b/i;
const LOOK_STEP = /\b(log|logs|sign-in record|audit|system log|report|status|inventory|history|trace|read|look|check)\b/i;
function thinking(id, answer) {
  const card = answer ? a.fixCard(answer) : null;
  const first = card && card.steps.length ? card.steps[0] : '';
  const ticket = ticketText(id);
  const change = CHANGE_IN_TICKET.exec(ticket);
  let whatChanged = 'n/a (no change named)';
  if (change) {
    const word = change[1].toLowerCase().split(' ').pop().replace(/[ds]$/, '');
    whatChanged = first && new RegExp(`\\b${word}`, 'i').test(first) ? 'pass' : 'fail';
  }
  const look = LOOK_TICKET.test(ticket) ? (first && LOOK_STEP.test(first) ? 'pass' : 'fail') : 'n/a';
  return { whatChanged, look, first };
}
lines.push('## The three thinking rules, per answer', '',
  '| ticket | what changed | lightest step first | look before guessing | first step, as written |', '|---|---|---|---|---|',
  ...run.tickets.map((t) => { const r = thinking(t.id, answers.get(t.id)); return `| ${t.id} | ${r.whatChanged} | ${row5(t, 'lightest-step-first')} | ${r.look} | ${cell(r.first)} |`; }), '',
  'Read by rule: "what changed" applies when the ticket names a recent change and passes when the first step names it; "look before guessing" applies to a sign-in, account or device ticket and passes when the first step reads, looks or checks; "lightest step first" is the desk\'s row. A word match is not a judgment of the step: a person should read the answers.', '');

if (before) {
  const oldSummary = fs.readFileSync(path.join(before, 'summary.md'), 'utf8');
  const oldRow = new Map();
  for (const l of oldSummary.split('\n')) {
    const m = /^\| (T\d+m?) \| ([A-Z ()]+) \| [^|]* \| [^|]* \| [^|]* \| ([0-9.]+|none) \|$/.exec(l);
    if (m) oldRow.set(m[1], { state: m[2].trim(), cost: m[3] === 'none' ? null : Number(m[3]) });
  }
  lines.push(`## Side by side with batch 8 (${path.basename(before)})`, '', 'Batch 8 answers had one "Tell the user" line; the new check reads it as the now line. Batch 8 had no T9m.', '',
    '| ticket | closing state, batch 8 | closing state, now | Fix card words, batch 8 | Fix card words, now | Tell the user, batch 8 | user message check, batch 8 | Tell the user now, now | Tell the user when done, now | user message check, now | cost batch 8 | cost now |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of run.tickets) {
    const f = path.join(before, 'answers', `${t.id}-answer.txt`);
    const oldAnswer = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
    const oc = oldAnswer ? a.fixCard(oldAnswer) : { parts: {} };
    const oldCheck = oldAnswer ? (a.answerChecks(oldAnswer, { ticket: ticketText(t.id) }).find((r) => r.check === 'user-message-now') || {}).verdict : 'not run';
    const o = oldRow.get(t.id) || {};
    const nc = answers.has(t.id) ? a.fixCard(answers.get(t.id)) : { parts: {} };
    lines.push(`| ${t.id} | ${o.state || 'not run'} | ${t.closing_state} | ${oldAnswer ? answerStats(oldAnswer).fix_card_words : 'none'} | ${(t.answer_stats || {}).fix_card_words ?? 'none'} | ${cell(oc.parts.tellNow)} | ${oldCheck} | ${cell(nc.parts.tellNow)} | ${cell(nc.parts.tellDone)} | ${row5(t, 'user-message-now')} | ${money(o.cost)} | ${money(cost(t))} |`);
  }
  lines.push('');
}
fs.writeFileSync(path.join(out, 'summary.md'), clean(lines.join('\n')));
console.log(clean(lines.join('\n')));
