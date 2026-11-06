'use strict';
// run-evidence.js <out-dir> <title> <run-dir> [--before <run-1-dir>...]: turns one batch 8 run folder into its
// saved evidence: desk.html, each init event, each answer, a summary table, and with --before the side-by-side
// against full run 1 (closing state, Fix card words, answer words, the line of the first action, cost), measured
// on full run 1's saved answers with the same counter the desk uses (scripts/demo/customer-desk.js answerStats).
// Local paths are written <home>, <repo>, <tmp>; the fictional customers' domains as [@Aegion_DOMAIN]; each long
// dash as -. No stream or debug log is copied.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const render = require(path.join(repo, 'scripts/demo/render.js'));
const { answerStats } = require(path.join(repo, 'scripts/demo/customer-desk.js'));
const home = os.homedir();
const account = os.userInfo().username;
const clean = (s) => String(s)
  .replaceAll(repo, '<repo>').replaceAll(home, '<home>')
  .replace(/\/(?:private\/)?(?:tmp|var\/folders)\/[^\s"'\]<]*/g, '<tmp>')
  .replace(new RegExp(`-Users-${account}-`, 'g'), '-Users-<account>-')
  .replace(new RegExp(`\\b${account}\\b`, 'g'), '<account>')
  .replace(/@[a-z0-9-]+\.example\.(?:com|org|net)\b/g, '@[@Aegion_DOMAIN]')
  .replaceAll('\u2014', '-');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

const argv = process.argv.slice(2);
const at = argv.indexOf('--before');
const before = at >= 0 ? argv.splice(at).slice(1) : [];
const [out, title, runDir] = argv;
fs.mkdirSync(path.join(out, 'init'), { recursive: true });
fs.mkdirSync(path.join(out, 'answers'), { recursive: true });
const run = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'));
const files = walk(runDir);
const fileOf = (id, suffix) => files.find((f) => path.basename(f) === `${id}${suffix}`);
fs.writeFileSync(path.join(out, 'desk.html'), clean(fs.readFileSync(path.join(runDir, 'desk.html'), 'utf8')));
for (const t of run.tickets) {
  const init = fileOf(t.id, '-init.json');
  if (init) fs.writeFileSync(path.join(out, 'init', `${t.id}-init.json`), clean(fs.readFileSync(init, 'utf8')));
  const answer = fileOf(t.id, '-answer.md');
  if (answer) fs.writeFileSync(path.join(out, 'answers', `${t.id}-answer.md`), clean(fs.readFileSync(answer, 'utf8')));
}
const cost = (t) => { const m = t.steps.find((s) => s.n === 4); return m && typeof m.cost_usd === 'number' ? m.cost_usd : null; };
const money = (n) => (n === null ? 'none' : n.toFixed(2));
const rows = run.tickets.map((t) => {
  const s = t.answer_stats || {};
  return `| ${t.id} | ${t.closing_state} | ${s.fix_card_words ?? 'no answer'} | ${s.answer_words ?? 'no answer'} | ${render.closingPlain(t)} | ${money(cost(t))} |`;
});
const lines = [`# ${title}: one row per ticket`, '', '| ticket | closing state | Fix card words | whole answer words | what stopped it, in plain words | cost in US dollars |', '|---|---|---|---|---|---|', ...rows, '',
  `Run totals: ${render.summaryLines(run.summary).join('; ')}`, ...(run.not_run || []).map((n) => `Did not run: ${n.id}, because ${n.reason}.`), '',
  'Reasons, as the desk wrote them:', '', ...run.tickets.map((t) => `- ${t.id}: ${(t.reason || 'none').replace(/\s+/g, ' ')}`), ''];
if (before.length) {
  const old = new Map();
  for (const d of before) {
    const r = JSON.parse(fs.readFileSync(path.join(d, 'run.json'), 'utf8'));
    const oldFiles = walk(d);
    for (const t of r.tickets) {
      const a = oldFiles.find((f) => path.basename(f) === `${t.id}-answer.md`);
      old.set(t.id, { t, stats: a ? answerStats(fs.readFileSync(a, 'utf8')) : null });
    }
  }
  lines.push('## Side by side with full run 1', '', 'Full run 1 is measured on its saved answers with the counter this run uses: words outside the aegis-desk block, and the line of the first numbered step. Full run 1 had no Fix card.', '',
    '| ticket | closing state, run 1 | closing state, now | Fix card words, run 1 | Fix card words, now | answer words, run 1 | answer words, now | first action line, run 1 | first action line, now | cost run 1 | cost now |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of run.tickets) {
    const o = old.get(t.id) || {};
    const os_ = o.stats || {};
    const s = t.answer_stats || {};
    lines.push(`| ${t.id} | ${o.t ? o.t.closing_state : 'not run'} | ${t.closing_state} | ${os_.fix_card_words ?? 'none'} | ${s.fix_card_words ?? 'none'} | ${os_.answer_words ?? 'none'} | ${s.answer_words ?? 'none'} | ${os_.first_action_line ?? 'none'} | ${s.first_action_line ?? 'none'} | ${o.t ? money(cost(o.t)) : 'none'} | ${money(cost(t))} |`);
  }
  lines.push('');
}
fs.writeFileSync(path.join(out, 'summary.md'), clean(lines.join('\n')));
console.log(clean(lines.join('\n')));
